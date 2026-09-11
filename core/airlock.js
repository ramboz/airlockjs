/**
 * Minimal airlock runtime (spec 003) — the off-main-thread path.
 *
 * Main thread: `push()` appends a descriptor to the event log, folds a
 * synchronous projection (O(1)), and enqueues to a ring buffer — cheap, on the
 * interaction path (ADR-0002). A chunked drain on idle serializes a batch and
 * `postMessage`s it to a single Web Worker chamber (ADR-0001 plain Worker).
 *
 * Egress is ADR-0002 Option C: the worker MAPS (off-thread, INP-safe) and returns
 * ready requests; the orchestrator DISPATCHES them on the main thread via
 * `fetch` keepalive, and flushes on `visibilitychange`→`hidden` so pending egress
 * survives teardown (OQ10 / R-001). Main-thread dispatch of a prebuilt keepalive
 * body is cheap and does not touch INP (mapping stayed in the worker).
 *
 * OQ10 unload fast path (closed): a beacon GENERATED inside the unload window
 * cannot round-trip to the worker to be mapped before teardown, so those events
 * take a main-thread SYNCHRONOUS mapping path instead — `pushCritical()` for
 * caller-declared unload-critical beacons (outbound click, closing `page_view`),
 * and a synchronous flush of the not-yet-drained ring tail at
 * `visibilitychange`→hidden / `pagehide`. Both reuse the same pure `mapToMp` the
 * worker uses (byte-identical payloads) via `core/egress.js`, and never enter the
 * worker — so there is no two-sender dedup problem. Synchronous mapping is only
 * taken at unload, where there is no interaction left to protect.
 */
import { createCriticalDispatcher, fetchInit } from "./egress.js";
import { mapToRum } from "../connectors/helix-rum/map.js";
import { createGa4GtagConnector } from "../connectors/ga4/gtag.js";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { mergeAdvancedMatching } from "../connectors/pixel/advanced-matching.js";
import { originPath, checkEndpointCeiling } from "./endpoint-ceiling.js";
import { egressVerdict } from "./consent.js";
import { governPayload, DEFAULT_DENYLIST } from "./payload-governance.js";

// Default diagnostics seam: console-backed, severity-differentiated (warn for a
// per-descriptor drop, error for a chamber-level crash). Callers may inject
// `onDiagnostic` (e.g. the future OQ7 inspector) to intercept the same records;
// it is the single sink, so no call site hard-codes `console` directly.
function consoleDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}

// 040-04: one shared encoder for the egress-failure diagnostic's UTF-8 body
// byte count — TextEncoder.encode() is stateless, so a module-level instance is
// safe and avoids constructing one per (rare) failure.
const EGRESS_TEXT_ENCODER = new TextEncoder();

// Method-aware dispatch (spec 026-01 AC4 — resolves OQ10 for the GET case,
// three sites: the held-beacon record below, this helper's two call sites at
// the steady-state `worker.onmessage` dispatch and the `setConsent` flush).
// `fetchInit` itself now lives in `core/egress.js` (spec 042-01) — imported
// above — so this synchronous worker-mapped path and the unload fast path
// (core/egress.js's own `createCriticalDispatcher`) share the exact same,
// can't-drift GET/POST init shape instead of two copies that could diverge.

export function createAirlock({
  trackers,
  workFactor,
  endpoints,
  ctx,
  unloadCritical,
  onDiagnostic,
  consent = null,
  egressPurposes = [],
  consentStrict = false,
  payloadDenylist = [],
  // Connector-selection seam (spec 026-01 AC3, resolving the "GA4-hardcoded
  // connector factory + worker URL" gap; spec 025-03 AC6 adds a THIRD
  // branch): `connector: "pixel"` hosts `connectors/pixel/connector.js`'s
  // createPixelConnector via `core/pixel-chamber.worker.js`; `connector:
  // "dom"` hosts airlock's own worker-side DOM mirror
  // (`core/worker-dom/mirror.js`) via `core/dom-chamber.worker.js` — instead
  // of the default GA4 chamber. Both non-GA4 branches generalize the
  // `worker.postMessage({type:"init", …})` payload below to carry
  // `connectorConfig` VERBATIM (a free-form bag the specific chamber
  // interprets — the pixel chamber reads its declarative config fields, the
  // dom chamber reads `{authorSource, elements, workUs}`) instead of the
  // GA4-shaped `{trackers, workFactor, endpoints, ctx}` fields. Omitted (or
  // any value other than "pixel"/"dom") -> the GA4 default path,
  // BYTE-UNCHANGED (a regression test pins the worker URL + the exact init
  // message shape for both GA4 AND pixel).
  connector,
  connectorConfig,
  // 040-02 (ADR-0021 Option C): the OPTIONAL core-egress coalescing hook —
  // `(requests: EgressRequest[]) => EgressRequest[]` — a connector-agnostic
  // main-thread seam a caller may inject to merge same-endpoint (origin+path)
  // `ready` requests within ONE lock-through cycle, AFTER the per-request
  // egress verdict + endpoint-ceiling gates and BEFORE dispatch (never across
  // cycles, never on inputs those gates already dropped/held). Absent, or not
  // a function -> NO-COALESCE (the default): every survivor dispatches as its
  // own `fetch`, byte-identical to pre-040-02 behavior. This slice wires ONLY
  // the seam; the GA4-specific batching strategy is a later connector-level
  // concern (040-03), not this parameter. Distinct from — and NOT wired to —
  // `core/coalescing-broker.js` (Alloy's identity-mint deduper on a different,
  // round-trip path; ADR-0021 Amendment 2026-09-09).
  coalesce,
}) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
  // 028-02 per-beacon correlation: a per-INSTANCE random tag (minted once) namespaces
  // this airlock's beacon ids so they stay unique in the SHARED inspector collector —
  // two co-wired instances (e.g. a GA4 airlock + a pixel airlock) must not collide on
  // `1,2,3…`. A held beacon's id is minted once (below) and reused at flush, so its
  // `consent held` and `consent flushed` records share one `beaconId`.
  // Pad-then-slice guarantees a fixed 6-char tag even for the ~2^-53 degenerate
  // Math.random() values (0 → "", 0.5 → "i") a bare slice(2,8) would shorten (028-02 craft review).
  const inspectorTag = (Math.random().toString(36).slice(2) + "000000").slice(0, 6);
  let beaconSeq = 0;
  // 019-01 AC1/AC6 (ADR-0012): the EFFECTIVE denylist merges the conservative
  // built-in DEFAULT_DENYLIST with the host's own `payloadDenylist`, reduced
  // ONCE at construction. **ALWAYS-ON built-in default (maintainer decision,
  // 2026-08-31):** the tiny high-confidence set (password/ssn/cvv/card-number
  // family — fields that must NEVER reach an analytics vendor) strips even on
  // an UNCONFIGURED deployment, because the footgun population (a site that
  // never considered PII) is exactly the unconfigured one, and this set is a
  // near-no-op for real GA4 payloads (none legitimately carry those exact
  // field names). This is a deliberate departure from the 015/016/017 opt-in
  // pattern: those gates are STRUCTURAL (no endpoints -> no ceiling), whereas
  // this default is a constant that CAN be always-on. Back-compat (AC6) is
  // preserved in CONTENT, not reference: a payload with none of the denied
  // fields is byte-identical after governance (governPayload returns the same
  // reference when nothing is stripped). The host `payloadDenylist` EXTENDS
  // the built-in set (defense-in-depth — the default is never the sole
  // protection, CLAUDE.md security-MUST).
  const effectiveDenylist = [...DEFAULT_DENYLIST, ...(payloadDenylist || [])];
  // 019-01 AC7: the IMPURE caller — both governance points below share this
  // ONE closure — emits a redacted diagnostic per stripped field (the field
  // NAME only, never the value) via the existing `diagnose` seam.
  // `governPayload` itself stays pure (DoR) and never touches `diagnose`.
  function governParams(params) {
    if (!effectiveDenylist.length) return params; // identity — mirrors governPayload's own check
    const { governed, stripped, error } = governPayload(params, effectiveDenylist);
    // 019-01 arch+craft review: a fail-open (governPayload caught a throwing
    // getter and skipped governance) must NOT be silent — surface it error-level.
    if (error) {
      diagnose({ level: "error", kind: "payload-governance", disposition: "skipped", reason: "govern-failed" });
    }
    for (const field of stripped) {
      diagnose({ level: "warn", kind: "payload-governance", disposition: "stripped", field });
    }
    return governed;
  }
  // 016-01 AC3/AC5: the endpoint ceiling, reduced ONCE from the host's
  // construction-time declared `endpoints` — never derived from a chamber's
  // `ready` request, so a compromised chamber cannot widen its own ceiling.
  // Gated below on `ceiling.length` so a caller with no declared endpoints is
  // unaffected (back-compat); a connector with declared endpoints (GA4,
  // always) gets the ceiling enforced on every dispatch.
  const ceiling = (endpoints || []).map(originPath).filter(Boolean);
  // 017-03 AC1/AC2 (ADR-0007 point ③ — the seal): `consentVector` is a
  // MUTABLE main-thread copy seeded from the boot-time `consent` opt — the
  // returned handle's `setConsent` updates it (this slice's OWN
  // consent-update path; 017-01's seam is boot-time-only, see `setConsent`'s
  // doc comment below). `heldBeacons` retains the already-mapped `{ url,
  // body }` ready requests a pending governing purpose holds — flushing them
  // is a pure main-thread re-`fetch`, never a re-map/worker round-trip.
  // Gated below on `egressPurposes.length`, exactly like the ceiling's own
  // `ceiling.length` gate: a caller with no declared egress purpose is
  // unaffected (back-compat).
  let consentVector = consent || {};
  const heldBeacons = [];
  // 026-04 (ADR-0022 Option C): the main-side advanced-matching hash cache —
  // per-field `ud[...]` hashes the pixel chamber posts back on the `identity`
  // channel (worker→main), keyed by field. HASH-ONLY: raw identity never
  // crosses back, so this can never hold a raw value. Read SYNCHRONOUSLY (no
  // await) by the 042 unload `requestMapper` below to merge `ud[...]` into the
  // closing beacon. Null-prototype so a pathological field name can't rewire it.
  // Empty for every non-pixel / non-advanced-matching instance -> no effect.
  const identityCache = Object.create(null);
  const log = [];
  // Null-prototype: event names are object keys, so a pathological name like
  // "__proto__" must land as an own key, not rewire the projection's prototype.
  const projection = Object.create(null);
  const ring = [];
  let seq = 0;
  let dispatched = 0;
  let scheduled = false;

  // OQ10 fast path: synchronous main-thread mapping+egress for unload-critical
  // beacons and the ring tail at teardown. Reuses the pure `mapToMp` (byte-for-byte
  // the same payload the worker builds) and never touches the worker.
  const criticalTypes = new Set(unloadCritical || []);
  // 030-01: the main-thread unload dispatcher is connector-generic. A helix-rum
  // instance maps via `mapToRum` bound with its per-page sampling (`{weight, id}`,
  // passed in `connectorConfig.sampling` so the main-thread unload path and the
  // worker connector agree), so RUM's INP/late-CLS finalizing at page-hide egress
  // the RUM shape to `ot.aem.live` instead of being GA4-mis-mapped or dropped. Every
  // other connector omits `mapper` and gets egress.js's default `mapToMp`
  // (byte-unchanged). The unload wiring below is unconditional (042-02 retired
  // the `workerMappedGetEgress` gate) and always included helix-rum, so no
  // wiring change is needed here.
  // 030-01 (craft review): a helix-rum instance MUST carry its per-page sampling
  // (`{weight, id}`), or its unload CWV silently falls back to GA4 mapping — the exact
  // mis-map this slice fixes. bootHelixRum (030-02) always passes it; a raw createAirlock
  // misuse is surfaced LOUDLY, not degraded silently.
  if (connector === "helix-rum" && !(connectorConfig && connectorConfig.sampling)) {
    console.error(
      "airlock: helix-rum instance constructed without connectorConfig.sampling — its unload CWV would fall back to GA4 mapping; bootHelixRum must pass { sampling: { weight, id } }.",
    );
  }
  // 026-04: the pixel unload connector, built ONCE from an advancedMatching-
  // STRIPPED config — its `handle` produces the identity-agnostic base `/tr`
  // (the `ud[...]` is merged from `identityCache` in the requestMapper below).
  // Stripping keeps the raw boot `external_id` out of the connector entirely
  // (it only ever reaches the worker's eager hasher, never this main-thread
  // connector). Non-pixel connectors never touch it.
  const pixelUnloadConnector =
    connector === "pixel"
      ? createPixelConnector((({ advancedMatching, ...rest }) => rest)(connectorConfig || {}))
      : null;
  const critical = createCriticalDispatcher({
    ctx,
    endpoints,
    trackers,
    ...(connector === "helix-rum" && connectorConfig && connectorConfig.sampling
      ? { mapper: (event, mapCtx) => mapToRum(event, mapCtx, connectorConfig.sampling) }
      : {}),
    // 042-01: ga4-gtag's map lives entirely in its own pure `handle` (no
    // main-thread `mapper` reshape needed, unlike helix-rum above) — the
    // SAME `EgressRequest[]`-returning function `core/ga4-gtag-chamber.worker.js`
    // hosts via `createConnectorHost`. Constructed ONCE here (not per dispatch),
    // mirroring the helix-rum branch's own single construction. `handle` is a
    // closure over `measurementId`/`ctx`/`endpoint` (no `this`), so passing it
    // directly as `requestMapper` is safe.
    ...(connector === "ga4-gtag"
      ? { requestMapper: createGa4GtagConnector(connectorConfig || {}).handle }
      : {}),
    // 042-02: generalizes the SAME mechanism to pixel. pixel's `handle` reads
    // NO `ctx` at all (only the declarative `{endpoint, eventMap, paramMap}`
    // config, unlike gtag's `ctx`-reading `handle` above) — the SIMPLER case,
    // still a pure closure over `config` (no `this`), so passing it directly
    // as `requestMapper` is safe. Constructed ONCE here, mirroring both
    // branches above. An unmapped `event.type` -> `handle` returns `[]`,
    // which `critical.dispatch` already tolerates as a clean no-op (042-01
    // AC2).
    //
    // 026-04 (ADR-0022): the pixel unload `requestMapper` merges the cached
    // advanced-matching hashes into the closing `/tr` GET — SYNCHRONOUSLY (read
    // the `identityCache`, no await; the eager hashing already warmed it). The
    // connector's own `handle` stays identity-agnostic (it built the base
    // `/tr`); `mergeAdvancedMatching` appends `ud[...]` per-field (a still-cold
    // field is omitted, never blanked, never raw). `pixelUnloadConnector` is
    // built ONCE from an advancedMatching-stripped config (defense: the connector
    // never even receives the raw boot identity).
    ...(connector === "pixel"
      ? {
          requestMapper: (event) =>
            mergeAdvancedMatching(pixelUnloadConnector.handle(event), identityCache),
        }
      : {}),
  });

  // 017-03 AC4 (ADR-0007 point ③, both-sites parity): the sync/unload path has
  // NO "later" to flush a held beacon to — the page is tearing down, so a hold
  // here could never be released. Unlike the async seal above (hold + flush),
  // an un-granted governing purpose on this path is DROPPED outright, never
  // held. Gated on `egressPurposes.length` exactly like the async gate
  // (back-compat: a caller with no declared egress purpose is unaffected).
  const criticalDispatchGated = (d) => {
    if (egressPurposes.length) {
      const v = egressVerdict(consentVector, egressPurposes, { strict: consentStrict });
      if (v !== "send") {
        diagnose({
          level: "warn",
          kind: "consent",
          disposition: "dropped",
          purpose: egressPurposes.join(","),
          reason: "sync/unload path — un-granted purpose dropped (no hold at teardown)",
        });
        return;
      }
    }
    // 019-01 AC3 (ADR-0012 point B): govern BEFORE mapToMp — this single
    // dispatcher is shared by BOTH pushCritical() and the unloadFlush
    // ring-tail below, so governing once here covers both call sites.
    // Non-mutating: `d.params` may be the SAME object the log/ring still
    // holds (the unloadFlush case) — `governParams` never writes through it.
    critical.dispatch({ ...d, params: governParams(d.params) });
  };

  // 026-01 AC3 / 025-03 AC6 / 041-01 AC3 — the connector-selection seam, FOUR
  // branches. Every worker call site below uses a STATIC STRING LITERAL
  // specifier (a runtime-computed specifier would still work in a browser,
  // but build.mjs's bundle-layout assertion scans the emitted bundle for
  // every worker reference and requires each to resolve to an emitted
  // same-origin sibling — 026-05's N-worker generalization,
  // order-independent). `./chamber.worker.js` (GA4-MP, default),
  // `./pixel-chamber.worker.js` (pixel, 026-01), `./dom-chamber.worker.js`
  // (dom, 025-03), and `./ga4-gtag-chamber.worker.js` (ga4-gtag, 041-01) are
  // ALL wired as build.mjs bundle entries, so a real EDS page resolves each
  // to its sibling file.
  const worker =
    connector === "pixel"
      ? new Worker(new URL("./pixel-chamber.worker.js", import.meta.url), { type: "module" })
      : connector === "dom"
        ? new Worker(new URL("./dom-chamber.worker.js", import.meta.url), { type: "module" })
        : connector === "helix-rum"
          ? new Worker(new URL("./helix-rum-chamber.worker.js", import.meta.url), { type: "module" })
          : connector === "ga4-gtag"
            ? new Worker(new URL("./ga4-gtag-chamber.worker.js", import.meta.url), { type: "module" })
            : new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" });
  // Init-message generalization (:149 -> here): GA4-MP's shape
  // (`{trackers, workFactor, endpoints, ctx}`) is unrelated to what the
  // pixel chamber's createPixelConnector(config) needs (`{endpoint,
  // eventMap, paramMap, …}`), what the dom chamber's
  // createDomChamberHost().boot() needs (`{authorSource, elements,
  // workUs}`), or what the gtag chamber's createGa4GtagConnector(config)
  // needs (`{measurementId, ctx, endpoint}`) — so a pixel, dom, helix-rum, OR
  // ga4-gtag instance posts `connectorConfig` verbatim instead, never the
  // GA4-MP-shaped fields.
  worker.postMessage(
    connector === "pixel" || connector === "dom" || connector === "helix-rum" || connector === "ga4-gtag"
      ? { type: "init", ...(connectorConfig || {}) }
      : { type: "init", trackers, workFactor, endpoints, ctx },
  );

  // Orchestrator dispatch: the worker returns mapped requests; send them on the
  // MAIN thread immediately (fetch keepalive is cheap + survives page teardown).
  worker.onmessage = (e) => {
    const data = e.data;
    // 026-04 (ADR-0022): the worker→main advanced-matching IDENTITY channel —
    // the pixel chamber posts `{ type: "identity", ud: { <field>: <hex> } }` as
    // each eager hash resolves. Cache them per-field (hash-only) for the
    // synchronous unload merge. This carries NO `ready`, so it must be handled
    // BEFORE the ready/dropped dispatch below and return early.
    if (data && data.type === "identity" && data.ud && typeof data.ud === "object") {
      for (const field of Object.keys(data.ud)) {
        const hex = data.ud[field];
        if (hex != null) identityCache[field] = hex;
      }
      return;
    }
    const ready = data && data.ready;
    if (ready) {
      // 040-02: the endpoint-ceiling gate, shared VERBATIM by phase 1 (inputs)
      // and phase 2 (coalescer outputs) so the two sides can never drift
      // (craft + arch review). Returns true (and emits the 009-02
      // endpoint-ceiling diagnostic) when `url` is outside the connector's
      // DECLARED endpoints and must be held; false when it may dispatch. Gated
      // on `ceiling.length` (back-compat: a caller with no declared endpoints
      // is unaffected). NOTE (arch review): phase 2 re-checks ONLY the endpoint
      // ceiling on outputs, NOT the consent verdict — `egressVerdict` is
      // URL-independent and cycle-uniform, so every survivor in this cycle
      // already shares the SAME "send" verdict and the output verdict is
      // preserved by construction. Do NOT add a per-endpoint verdict here.
      const holdIfOffCeiling = (url) => {
        if (!ceiling.length) return false;
        const c = checkEndpointCeiling(url, endpoints);
        if (c.verdict === "hold") {
          diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c.destination, reason: c.reason });
          return true;
        }
        return false;
      };
      // 040-04 (ADR-0021 OQ#1) — the shared dispatch closure BOTH the
      // no-coalesce (single-beacon) and coalesced-POST sites below call, so
      // the two cannot drift (mirrors `holdIfOffCeiling`'s dedup above).
      // Additive: `dispatched++` still fires on EITHER branch (a delivery WAS
      // attempted — byte-identical to pre-040-04 on the success path); a
      // rejection ALSO emits a `kind:"egress-failure"` diagnostic, closing the
      // previously-swallowed-failure gap. `destination` is `originPath(url)`
      // (origin+path only — never the full URL/query, which carries cid/event
      // data), consistent with the endpoint-ceiling diagnostic above. `bytes`
      // (UTF-8 byte length of the body) is present only for a POST (body
      // defined) — a generic size signal, no body-structure/event-count
      // assumption (AC3; precise event-count is deferred to 040-05). No
      // retry: exactly one `fetch` call per request, win or lose (AC2).
      const dispatch = (req) => {
        fetch(req.url, fetchInit(req.method, req.body)).then(
          () => { dispatched++; },
          () => {
            dispatched++;
            // `bytes` is keyed off METHOD (not just body-presence): a GET never
            // sends a body (`fetchInit` omits it), so a stray `body` on a GET
            // request must NOT report bytes that never went on the wire — this
            // mirrors `fetchInit`'s own GET/POST asymmetry (craft/compliance nit).
            const isPost = req.method !== "GET";
            diagnose({
              level: "warn",
              kind: "egress-failure",
              destination: originPath(req.url),
              method: isPost ? "POST" : "GET",
              ...(isPost && req.body != null ? { bytes: EGRESS_TEXT_ENCODER.encode(req.body).length } : {}),
            });
          },
        );
      };
      // 040-02 (ADR-0021 Option C) — PHASE 1: collect survivors. Governance
      // (the 017-03 consent seal, then the 016-01 endpoint ceiling) runs
      // UNCHANGED, in the SAME order, with the SAME diagnose/heldBeacons/
      // beaconSeq side effects — only the terminal `fetch` moved out of this
      // loop, into phase 2 below. A request that passes both gates is a
      // "survivor"; a denied/held one never reaches phase 2 at all.
      const survivors = [];
      for (const r of ready) {
        // 017-03 AC1/AC3/AC5 (ADR-0007 point ③): the consent gate runs BEFORE
        // the 016-01 endpoint ceiling — a held/dropped beacon must never reach
        // the ceiling/fetch at all. Gated on `egressPurposes.length`, so a
        // caller with no declared egress purpose (back-compat) skips this
        // block entirely — byte-identical to pre-017-03 behaviour.
        if (egressPurposes.length) {
          const v = egressVerdict(consentVector, egressPurposes, { strict: consentStrict });
          if (v === "drop") {
            diagnose({
              level: "warn",
              kind: "consent",
              disposition: "dropped",
              purpose: egressPurposes.join(","),
              reason: "strict regime — un-granted purpose dropped",
            });
            continue;
          }
          if (v === "hold") {
            // 026-01 AC4 (frame-critique #2b): capture `method` too — else a
            // held GET can never flush as a GET (setConsent's flush below
            // would default it back to POST, corrupting a pixel beacon).
            // 028-02: mint the beacon id ONCE here + carry it on the held beacon
            // so the later flush record shares it (the held→flushed chain).
            const beaconId = `${inspectorTag}#${(beaconSeq += 1)}`;
            heldBeacons.push({ url: r.url, method: r.method, body: r.body, beaconId });
            diagnose({
              level: "warn",
              kind: "consent",
              disposition: "held",
              purpose: egressPurposes.join(","),
              reason: "purpose pending — held at the seal",
              beaconId,
              destination: r.url,
            });
            continue;
          }
          // v === "send" -> fall through to the 016-01 ceiling check (unchanged)
        }
        // 016-01 AC3/AC4: fail-closed endpoint ceiling (ADR-0006's
        // declared-as-ceiling law) — hold any destination outside the
        // connector's DECLARED endpoints (origin+pathname); an undeclared
        // destination gets NO fetch and NO dispatched++, surfaced via the
        // 009-02 diagnostics sink so a held egress is never silently invisible.
        // Shared with the phase-2 output re-check via `holdIfOffCeiling`.
        if (holdIfOffCeiling(r.url)) continue;
        survivors.push(r);
      }

      // 040-02 — PHASE 2: dispatch. No `coalesce` hook (the default) -> one
      // `fetch` per survivor, in ready-order, BYTE-IDENTICAL to the pre-040-02
      // inline loop — no grouping, no re-checking the ceiling (already passed
      // above). This keeps every existing connector's observable egress
      // unchanged until it opts in.
      if (typeof coalesce !== "function") {
        for (const r of survivors) {
          dispatch(r);
        }
      } else {
        // A `coalesce` hook is present: group survivors by endpoint
        // (origin+path, ignoring query — ADR-0021's coalescing-group key),
        // first-seen order, ONE lock-through cycle only (this `ready` array;
        // never across `worker.onmessage` deliveries). Each group is handed
        // to the connector's hook; its returned `EgressRequest[]` is the
        // dispatch set for that group.
        const groups = new Map();
        for (const r of survivors) {
          const key = originPath(r.url);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(r);
        }
        for (const groupRequests of groups.values()) {
          const outputs = coalesce(groupRequests) || [];
          for (const out of outputs) {
            // AC1 (ADR-0021:88 output-ceiling-bypass hazard): the coalescer's
            // OUTPUT re-enters `fetch` here, so it is re-validated against the
            // SAME pure endpoint ceiling before dispatch (via the shared
            // `holdIfOffCeiling`) — a hook emitting an off-endpoint URL is
            // held, not egressed, exactly like an ungoverned input. The
            // ceiling is the declared-endpoint set (AC1's prescribed
            // `checkEndpointCeiling` mechanism); a hook cannot egress outside
            // it.
            if (holdIfOffCeiling(out.url)) continue;
            dispatch(out);
          }
        }
      }
    }
    // 009-02 AC2: surface each 009-01 per-descriptor drop — otherwise a
    // malformed event silently vanishes instead of being diagnosable.
    const dropped = data && data.dropped;
    if (dropped && dropped.length) {
      for (const d of dropped) {
        diagnose({ level: "warn", kind: "dropped", type: d.type, reason: d.reason, index: d.index });
      }
    }
  };

  // 009-02 AC1: a chamber-level worker error (NOT a caught per-descriptor
  // throw — e.g. a worker-module load error or an internal bug) is otherwise
  // silently swallowed once handled/registered. The Worker boundary already
  // keeps the page alive regardless (spec 009-02 frame-critique); this
  // registration makes the failure OBSERVED via the same diagnostics seam.
  // ErrorEvent fields degrade gracefully — never surface an empty record.
  worker.onerror = (err) => {
    diagnose({
      level: "error",
      kind: "chamber-error",
      message: err && err.message != null ? err.message : String(err),
      ...(err && err.filename != null ? { filename: err.filename } : {}),
      ...(err && err.lineno != null ? { lineno: err.lineno } : {}),
    });
  };

  // 019-01 AC2/AC6 (ADR-0012 point A): the SINGLE governed exit both drain()
  // and flushNow() route through, extracted from the pre-019-01 shared
  // `worker.postMessage({ type: "events", batch })` — so a future third
  // async consumer cannot silently bypass governance. Empty effective
  // denylist -> SHORT-CIRCUIT: post the ORIGINAL batch as-is, allocating no
  // governed copy / new descriptor wrappers (byte-unchanged on the hot
  // INP-sensitive drain path).
  const sendBatch = (batch) => {
    if (!effectiveDenylist.length) {
      worker.postMessage({ type: "events", batch });
      return;
    }
    const governedBatch = batch.map((d) => ({ ...d, params: governParams(d.params) }));
    worker.postMessage({ type: "events", batch: governedBatch });
  };

  const drain = () => {
    scheduled = false;
    if (!ring.length) return;
    const batch = ring.splice(0, 50); // chunk
    sendBatch(batch);
    if (ring.length) schedule();
  };
  function schedule() {
    if (!scheduled) { scheduled = true; requestIdleCallback(drain, { timeout: 50 }); }
  }

  // OQ10 backstop: at unload, map + dispatch whatever is still buffered
  // SYNCHRONOUSLY on the main thread (a worker round-trip cannot complete before
  // teardown — the old postMessage-to-worker backstop lost this tail). Declared
  // unload-critical types go first so they win the keepalive budget. Events flushed
  // here were never sent to the worker (still in the ring), so no double-send.
  const unloadFlush = () => {
    if (!ring.length) return;
    const remaining = ring.splice(0, ring.length);
    remaining.sort(
      (a, b) => (criticalTypes.has(b.type) ? 1 : 0) - (criticalTypes.has(a.type) ? 1 : 0),
    );
    // 030-01: forward the descriptor's `ts` (its `push()`-time stamp). GA4's `mapToMp`
    // ignores it (byte-unchanged), but a connector-generic mapper (RUM's `mapToRum`)
    // reads it as the beacon's `t` — dropping it would make a page-hide INP beacon carry
    // `t:0` instead of its capture time (030-01 craft review).
    for (const d of remaining) criticalDispatchGated({ type: d.type, params: d.params, ts: d.ts });
  };
  // 021-01 AC1 (OQ12 item 4): a NAMED reference, not an inline anonymous fn — an
  // anonymous listener can never be individually removeEventListener'd, which is
  // exactly what dispose() below needs to do.
  function onVisibilityChange() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") unloadFlush();
  }
  // 026-01 AC10 (frame-critique #2a) / 041-01 follow-up / 042-01 / 042-02 —
  // pixel and ga4-gtag used to be a connector class whose map lives entirely
  // in the WORKER, whose egress is GET, and which had NO main-thread critical
  // mapper: wiring the unload listeners unconditionally for them would have
  // hit the UNCONDITIONALLY-constructed GA4 `critical` dispatcher's `mapToMp`
  // default (deliberately left constructing for every connector so `stats()`/
  // `pushCritical` need no null-guards) and mis-mapped their beacon as a GA4
  // POST to the wrong (POST-shaped) destination. 042-01 (ga4-gtag) and 042-02
  // (pixel) each closed that gap by giving the `critical` dispatcher above
  // its OWN `requestMapper` (the connector's own `handle`) instead of gating
  // the wiring out — so the `workerMappedGetEgress` boolean that used to gate
  // pixel out here is retired: no connector is gated out of the unload path
  // anymore.
  //
  // INVARIANT for a FUTURE worker-mapped connector: it MUST supply the
  // `critical` dispatcher above a critical mapper — a POST `mapper` (like
  // helix-rum's) or a GET `requestMapper` (like ga4-gtag's/pixel's) — or its
  // unload/`pushCritical` tail will silently mis-map through the default
  // `mapToMp` instead of being neutralized or correctly flushed.
  if (typeof addEventListener === "function") {
    addEventListener("visibilitychange", onVisibilityChange);
    addEventListener("pagehide", unloadFlush);
  }

  // 021-01 AC1 (OQ12 item 4): make the runtime library-safe — a host can tear this
  // instance down. Removes the two unload listeners (by the SAME named references
  // registered above) and terminates the Worker. Idempotent (the `disposed` guard
  // makes a second call a no-op — no double-terminate, no throw) and null-safe (no
  // `removeEventListener` global, or a Worker stand-in with no `.terminate`, both
  // silently skip that step rather than throw). Purely additive: nothing above ever
  // calls `dispose()` itself, so the single-boot path (AC3) is byte-unchanged.
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (typeof removeEventListener === "function") {
      removeEventListener("visibilitychange", onVisibilityChange);
      removeEventListener("pagehide", unloadFlush);
    }
    if (worker && typeof worker.terminate === "function") worker.terminate();
  }

  return {
    /**
     * Interaction-path entry: append + fold + enqueue. O(1), no mapping.
     *
     * Accepts the PINNED contract shape `push({ event: "name", ...params })`
     * (contracts/push-api.md): the reserved `event` key is the GA4 event name,
     * every other key is a param. We normalize to the internal `{ type, params }`
     * descriptor here — the log/projection/ring/worker and the golden `mapToMp` all
     * stay on `{ type, params }`, so reconciling the surface is a one-line unpack.
     */
    push(evt) {
      const { event: type, ...params } = evt || {};
      // Envelope guard (contracts/push-event.schema.json: `event` required, minLength
      // 1). Drop + warn, never throw — the interaction path must stay O(1) and must
      // not break the page on a malformed caller.
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: push() dropped — missing/empty `event` name", evt);
        return;
      }
      const descriptor = { seq: seq++, type, ts: performance.now(), params };
      log.push(descriptor);
      projection[type] = descriptor; // trivial synchronous fold (AD-3)
      ring.push(descriptor);
      schedule();
    },
    /**
     * Unload-critical entry (OQ10 fast path): map + send SYNCHRONOUSLY on the main
     * thread, right now, bypassing the worker. Call from an outbound-link click or
     * a `pagehide`/`beforeunload` handler for the canonical last beacon — the event
     * generated inside the unload window that the async worker path would lose.
     * Steady-state events MUST use `push()`; this path is INP-unsafe by design and
     * only justified when the page is going away.
     */
    pushCritical(evt) {
      // 026-01 (craft-review) / 041-01 follow-up / 042-01 / 042-02: this used
      // to be the SECOND mis-map entry AC10 flagged, for the worker-mapped
      // GET-egress class (pixel, ga4-gtag) — a DROP + diagnose lived here to
      // neutralize it. `criticalDispatchGated` routes through
      // `critical.dispatch`, which now carries a `requestMapper` (the
      // connector's own `handle`, wired at construction above) for BOTH
      // connectors, so a pixel or ga4-gtag instance maps + GETs correctly
      // here too and no longer needs a drop-guard. See the unload-wiring `if`
      // above for the invariant a future worker-mapped connector must satisfy
      // instead.
      const { event: type, ...params } = evt || {}; // same contract shape as push()
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: pushCritical() dropped — missing/empty `event` name", evt);
        return;
      }
      // 030-01: stamp `ts` (there is no prior push() to inherit it from on this direct
      // entry). GA4's mapToMp ignores it (byte-unchanged); RUM's mapToRum reads it as `t`.
      criticalDispatchGated({ type, params, ts: performance.now() });
    },
    /**
     * 017-03 AC2 (ADR-0007 point ③ — THIS slice's own main-thread
     * consent-update path; NOT 017-01's deferred worker `ctx` re-send, which
     * governs only the mapper reshape ① and stays deferred). Merges `vector`
     * into the mutable main-thread consent state. On a pending→granted edge
     * for a HELD egress purpose, the buffered beacons are FLUSHED — a pure
     * main-thread re-`fetch(url, body)` (they are already mapped; no worker,
     * no re-map), so a flushed beacon still carries its BOOT-TIME mapper
     * reshape (a named residual — docs/refinement-todo.md). A still-pending
     * purpose's beacons stay held.
     * @param {Record<string, string>} vector a partial consent-vector update
     *   (core/consent.js's shape), merged over the existing state.
     */
    setConsent(vector) {
      consentVector = { ...consentVector, ...(vector || {}) };
      if (
        egressPurposes.length &&
        heldBeacons.length &&
        egressVerdict(consentVector, egressPurposes, { strict: consentStrict }) === "send"
      ) {
        const flushing = heldBeacons.splice(0, heldBeacons.length);
        for (const b of flushing) {
          fetch(b.url, fetchInit(b.method, b.body))
            .then(() => { dispatched++; }, () => { dispatched++; });
          diagnose({
            level: "warn",
            kind: "consent",
            disposition: "flushed",
            purpose: egressPurposes.join(","),
            reason: "purpose granted — held beacon flushed",
            beaconId: b.beaconId, // 028-02: same id as this beacon's `held` record → the held→flushed chain
            destination: b.url,
          });
        }
      }
    },
    /**
     * 026-04 (ADR-0022): feed raw advanced-matching identity to the pixel
     * chamber on the DEDICATED `identity` channel — `{ em, ph, fn, … }` set once
     * the visitor is identified (`external_id` rides the boot `init` message
     * instead). This posts the raw values straight to the worker, BYPASSING the
     * input `governParams`/`payloadDenylist` (which would strip email/phone
     * before they could be hashed) — safe because the worker is egress-confined
     * (A5): it eager-normalizes + SHA-256-hashes each field and posts back ONLY
     * the hash (cached above for the unload merge). The raw value is not retained
     * on the main thread. A no-op for a non-pixel worker (its chamber ignores the
     * `identity` message type).
     * @param {Record<string, string>} raw the raw PII fields to hash (em/ph/…).
     */
    setIdentity(raw) {
      worker.postMessage({ type: "identity", raw });
    },
    /**
     * Synchronous read (AD-3): no argument → the whole projection; a dotted path
     * (`getState("a.b.c")`, contracts/push-api.md) → the value at that path in the
     * projection, `undefined` if any hop is absent. Never throws on a missing path.
     */
    getState(path) {
      if (path == null) return projection;
      let cur = projection;
      for (const key of String(path).split(".")) {
        if (cur == null) return undefined;
        cur = cur[key];
      }
      return cur;
    },
    flushNow() { while (ring.length) sendBatch(ring.splice(0, 50)); },
    stats() { return { dispatched, logged: log.length, ...critical.stats() }; },
    /**
     * 021-01 AC1 (OQ12 item 4): tear this instance down — removes the
     * visibilitychange/pagehide listeners and terminates the Worker. Idempotent
     * (a second call is a no-op) and null-safe (no addEventListener/Worker.terminate
     * -> skipped, never throws). See the `dispose` closure above for the guard.
     */
    dispose,
    // spec 025-03 AC6: expose the raw `worker` ONLY for connector:"dom" —
    // GA4/pixel stay byte-unchanged (no `worker` key at all — this handle's
    // shape for those two connectors is unaffected). A dom-chamber tag's
    // protocol (main->worker event-forward, worker->main mutation-flush,
    // `core/worker-dom/protocol.js`) is architecturally DIFFERENT from GA4/
    // pixel's ready/dropped egress protocol this handle's `push`/
    // `pushCritical`/`worker.onmessage` machinery is built for — a dom-tag
    // adapter (a `bootWorkerDomTag`-style boot, or a rig) drives that
    // DIFFERENT protocol directly against the SAME underlying worker this
    // seam already constructed + initialized, rather than this module
    // growing a second, unrelated dispatch shape it would otherwise need to
    // understand. Freely reassigning `worker.onmessage` is expected (this
    // module's OWN ready/dropped handler is a harmless no-op for the
    // `{type:"mutations"}` shape the dom chamber posts).
    ...(connector === "dom" ? { worker } : {}),
  };
}
