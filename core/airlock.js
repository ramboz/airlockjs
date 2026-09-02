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
import { createCriticalDispatcher } from "./egress.js";
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

// Method-aware dispatch (spec 026-01 AC4 — resolves OQ10 for the GET case,
// three sites: the held-beacon record below, this helper's two call sites at
// the steady-state `worker.onmessage` dispatch and the `setConsent` flush).
// `undefined`/anything-but-"GET" -> the historical `{ method: "POST", body,
// keepalive: true }` shape, BYTE-UNCHANGED for every existing POST connector
// (GA4's EgressRequest never sets `method` at all — a GA4 regression test
// pins this). "GET" -> `{ method: "GET", keepalive: true }`, deliberately
// OMITTING `body` — a real `fetch(url, { method: "GET", body })` throws.
function fetchInit(method, body) {
  return method === "GET" ? { method: "GET", keepalive: true } : { method: "POST", body, keepalive: true };
}

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
  // connector factory + worker URL" gap): `connector: "pixel"` hosts
  // `connectors/pixel/connector.js`'s createPixelConnector via
  // `core/pixel-chamber.worker.js` instead of the default GA4 chamber, and
  // generalizes the `worker.postMessage({type:"init", …})` payload below to
  // carry `connectorConfig` (the declarative pixel config) instead of the
  // GA4-shaped `{trackers, workFactor, endpoints, ctx}` fields. Omitted (or
  // any value other than "pixel") -> the GA4 default path, BYTE-UNCHANGED
  // (a regression test pins the worker URL + the exact init message shape).
  connector,
  connectorConfig,
}) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
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
  const critical = createCriticalDispatcher({ ctx, endpoints, trackers });

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

  // 026-01 AC3 — the connector-selection seam. Both `new Worker(new URL(…))`
  // call sites below are STATIC STRING LITERALS (a runtime-computed
  // specifier would still work in a browser at runtime, but build.mjs's own
  // bundle-layout assertion greps the emitted bundle for a literal
  // `new Worker(new URL("…"` — keeping GA4's literal call FIRST in source
  // order, byte-unchanged, keeps that assertion honest for the untouched
  // default path). `core/pixel-chamber.worker.js` is not yet wired into
  // build.mjs as a third bundle entry — a disclosed residual for a real EDS
  // rollout, out of this slice's tested scope (Node/vitest only).
  const worker =
    connector !== "pixel"
      ? new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" })
      : new Worker(new URL("./pixel-chamber.worker.js", import.meta.url), { type: "module" });
  // Init-message generalization (:149 -> here): GA4's shape
  // (`{trackers, workFactor, endpoints, ctx}`) is unrelated to what the pixel
  // chamber's createPixelConnector(config) needs (`{endpoint, eventMap,
  // paramMap, …}`) — so a pixel instance posts `connectorConfig` verbatim
  // instead, never the GA4-shaped fields.
  worker.postMessage(
    connector === "pixel"
      ? { type: "init", ...(connectorConfig || {}) }
      : { type: "init", trackers, workFactor, endpoints, ctx },
  );

  // Orchestrator dispatch: the worker returns mapped requests; send them on the
  // MAIN thread immediately (fetch keepalive is cheap + survives page teardown).
  worker.onmessage = (e) => {
    const data = e.data;
    const ready = data && data.ready;
    if (ready) {
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
            heldBeacons.push({ url: r.url, method: r.method, body: r.body });
            diagnose({
              level: "warn",
              kind: "consent",
              disposition: "held",
              purpose: egressPurposes.join(","),
              reason: "purpose pending — held at the seal",
            });
            continue;
          }
          // v === "send" -> fall through to the 016-01 ceiling check + fetch (unchanged)
        }
        // 016-01 AC3/AC4: fail-closed endpoint ceiling — before dispatching,
        // hold any destination outside the connector's DECLARED endpoints
        // (origin+pathname; ADR-0006's declared-as-ceiling law). An
        // undeclared destination gets NO fetch and NO dispatched++ (the seal
        // bites); it is surfaced via the 009-02 diagnostics sink so a held
        // egress is never silently invisible.
        if (ceiling.length) {
          const c = checkEndpointCeiling(r.url, endpoints);
          if (c.verdict === "hold") {
            diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c.destination, reason: c.reason });
            continue;
          }
        }
        fetch(r.url, fetchInit(r.method, r.body))
          .then(() => { dispatched++; }, () => { dispatched++; });
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
    for (const d of remaining) criticalDispatchGated({ type: d.type, params: d.params });
  };
  // 021-01 AC1 (OQ12 item 4): a NAMED reference, not an inline anonymous fn — an
  // anonymous listener can never be individually removeEventListener'd, which is
  // exactly what dispose() below needs to do.
  function onVisibilityChange() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") unloadFlush();
  }
  // 026-01 AC10 (frame-critique #2a) — connector-conditional: a pixel
  // instance does NOT wire the unload listeners at all. Without this gate, a
  // pixel event still ring-resident at teardown would hit `unloadFlush` ->
  // `criticalDispatchGated` -> the UNCONDITIONALLY-constructed GA4 `critical`
  // dispatcher below (:118, deliberately left constructing for every
  // connector so `stats()`/`pushCritical` need no null-guards) — mapping it
  // via GA4's OWN `mapToMp` and POSTing it to `facebook.com/tr` as if it
  // were a GA4 event (a mis-map, not a beacon). Gating the WIRING (not the
  // construction) is the minimal neutralization: the event is instead simply
  // DROPPED at teardown (an unload-loss deferred, bounded + disclosed;
  // unload-critical GET dispatch for pixels is a later slice). GA4's own
  // path (connector !== "pixel") is untouched — still wires both listeners.
  if (connector !== "pixel" && typeof addEventListener === "function") {
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
      // 026-01 (craft-review): the SECOND mis-map entry AC10 must also close.
      // `criticalDispatchGated` routes through the unconditionally-constructed
      // GA4 `critical` dispatcher (:141 -> mapToMp), so on a pixel instance
      // this would GA4-map + POST a pixel event to `facebook.com/tr` — the
      // exact mis-map AC10 neutralizes on the UNLOAD wiring (:336), reachable
      // here as a second entry on the raw createAirlock handle (the adapter's
      // bootMetaPixel omits pushCritical, but that is convention, not enforced
      // — rigs/tests call createAirlock directly). A pixel has NO main-thread
      // critical mapper (its map lives in the worker), so DROP + diagnose,
      // symmetric with the gated unload wiring; unload-critical GET dispatch
      // for pixels is a later slice.
      if (connector === "pixel") {
        diagnose({
          level: "warn",
          kind: "dropped",
          reason: "pushCritical unsupported for a pixel connector (no main-thread critical mapper; routing to the GA4 critical dispatcher would mis-map)",
        });
        return;
      }
      const { event: type, ...params } = evt || {}; // same contract shape as push()
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: pushCritical() dropped — missing/empty `event` name", evt);
        return;
      }
      criticalDispatchGated({ type, params });
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
          });
        }
      }
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
  };
}
