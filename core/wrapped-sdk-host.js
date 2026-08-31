/**
 * Wrapped-SDK host (spec 014-01) — the MAIN-THREAD host that manages a
 * wrapped-SDK chamber's round-trip egress + cookie write-back, extracted from
 * the inline main-thread logic in rig/alloy-chamber-harness.html (spec 012-01
 * AC4) into a reusable, Node-unit-testable module.
 *
 * This is the sibling of core/connector-host.js: that module hosts a
 * connector INSIDE the chamber (worker-side, generic across archetypes); this
 * one hosts the chamber's round-trip egress from the ORCHESTRATOR side
 * (main-thread), implementing the declared-AND-gated
 * `caps.egress.dispatch(req) -> Response` capability
 * (contracts/capability.d.ts, ADR-0010). `core/airlock.js` + its hardcoded
 * GA4 `core/chamber.worker.js` (the fire-and-forget path) are UNTOUCHED by
 * this slice — convergence is 014-03.
 *
 * The wrapped-SDK egress model (contrast GA4's fire-and-forget): a stock
 * vendor SDK issues its OWN worker-side `fetch`; the chamber INTERCEPTS it
 * (unchanged chamber-internal transport — connectors/alloy/alloy-chamber.worker.js)
 * and posts `{ type: "intercepted-fetch", id, url, method, headers, body }` to
 * main. This host answers that message by calling the INJECTED
 * `caps.egress.dispatch(req)` — the orchestrator's OWN implementation of the
 * ADR-0010 capability (a future seal gates INSIDE that implementation,
 * against the connector manifest's declared `endpoints`/`purposes`; this
 * slice lands the gate-able surface, not the teeth) — and posts the response
 * back as `{ type: "intercepted-fetch-response", id, status, statusText,
 * headers, body }`. This host is deliberately transport-agnostic: it does not
 * know (or need to know) whether `caps.egress.dispatch` hits a real Edge, a
 * same-origin rewrite to a local stub, or a fake in a unit test — that is the
 * caller's wiring, injected.
 *
 * AC6 hardening: a `caps.egress.dispatch` call that never settles would hang
 * the chamber's `sendEvent` forever (the vendor SDK's own fetch promise never
 * resolves/rejects). A bounded `timeoutMs` races the dispatch; on timeout this
 * host posts a `status:0` error response itself, so the CHAMBER's pending
 * fetch REJECTS instead of hanging (mirrored by
 * connectors/alloy/alloy-chamber.worker.js's `resolveInterceptedFetch`,
 * unchanged) — `sendEvent` settles (rejected), it does not hang.
 *
 * Cookie write-back: the chamber's synchronous cookie cache (012-01 AC3)
 * mirrors every write ASYNCHRONOUSLY to main as
 * `{ type: "cookie-writeback", value }`. The chamber's shim computes a fake
 * apex domain + Secure/SameSite=None (the R-004 shim location) that a real
 * jar on a plain http/localhost origin would reject outright, so this host
 * reconciles the raw `Set-Cookie`-shaped string to the test origin first
 * (`reconcileForBrokerJar`: drop `domain=`/`secure`/`samesite=`, keep
 * `name=value` + any other attrs) before handing it to the injected
 * `caps.cookies.reconcile` sink — byte-for-byte the harness's proven logic
 * (rig/alloy-chamber-harness.html), just relocated.
 *
 * Pure — no `self`/`postMessage`/DOM at module top level (only `setTimeout` /
 * `clearTimeout` / `Promise`, all present in Node) — so it imports and
 * unit-tests directly in Node (test/wrapped-sdk-host.test.js), exactly like
 * core/connector-host.js. The real Worker chamber + a real main-thread
 * `fetch` are injected by the caller (rig/alloy-core-host.mjs's harness); a
 * fake chamber + fake caps drive the same logic in the unit test, no Worker
 * required.
 *
 * Config-integrity (spec 015-01, ADR-0011): an optional `configIntegrity` pin
 * gates `dispatchInterceptedFetch` BEFORE `caps.egress.dispatch` runs the real
 * fetch — the single chokepoint every intercepted interact crosses. On ANY
 * deviation (foreign host; tenant-key absent, polluted, or mismatched) the
 * default disposition is to HOLD (no real egress) and emit a redacted
 * diagnostic; absent the option, the host behaves exactly as before (back-compat).
 *
 * Disposition (spec 015-02): `configIntegrity.disposition` selects HOLD (the
 * default — fail-closed, no egress) or `"override"` — an opt-in availability
 * choice that, instead of holding, RE-DERIVES the dispatch to the host-pinned
 * host + tenant (`pinnedDispatchUrl`, evasion-proof — it discards whatever the
 * chamber supplied) and sends, STILL alerting (`disposition: "overridden"`).
 * Override is availability-over-integrity (it forwards the chamber-built body to
 * the honest tenant — the ADR-0011 body residual) and is never silent. An
 * INCOMPLETE pin can't be re-derived to a valid destination, so it HOLDS even
 * under override.
 *
 * Consent (spec 020-02, ADR-0007 — the TRUSTED seam-side enforcement, does
 * NOT trust the chamber): an optional `consent` vector + `egressPurposes`
 * gate `dispatchInterceptedFetch` AFTER config-integrity, BEFORE
 * mainDispatch/caps.egress.dispatch — the same chokepoint. alloy carries NO
 * body-consent field (020-01 Finding), so unlike 017-03's NON-STRICT
 * `egressVerdict` use at the GA4 seal (a denied DATA-USE purpose still
 * sends — delegate-and-send, premised on a body-consent field to reshape),
 * a denied/pending governing purpose here must be DROPPED, never sent:
 * `egressVerdict(consent, egressPurposes, { strict: true })` is REQUIRED,
 * not the non-strict default. A non-"send" verdict HOLDS (status:0,
 * `statusText: "held at the seal: consent"`, `consentHeld` incremented, a
 * redacted `kind:"consent"` diagnostic) — the same fail-closed shape the
 * ceiling/config-integrity holds use above. pending -> DROP (not
 * hold+buffer) is the first-impl choice: the alloy interact is a
 * synchronous vendor-SDK round trip, not a queued beacon like GA4's async
 * seal — a pending->hold+flush refinement mirroring 017-03 is a named
 * follow-on. This seam gate is independent of, and complements, alloy's OWN
 * `setConsent` command driven in the chamber's alloy-boot glue
 * (connectors/alloy/alloy-chamber.worker.js + connectors/alloy/consent.js):
 * defense-in-depth — seam-enforce (trusted) + delegate (idiomatic, but
 * inside the untrusted chamber). Gated on `egressPurposes.length`
 * (back-compat: no purposes wired -> skipped entirely, byte-unchanged).
 *
 * Payload strip (spec 020-02 AC3, optional, non-load-bearing): an optional
 * `payloadDenylist` strips denylisted fields from every intercepted
 * `events[].xdm` (parse -> core/payload-governance.js's `governPayload` ->
 * re-serialize; 020-01 live-confirmed the round-trip is Edge-safe) before
 * dispatch. The alloy body is already read-minimized by construction
 * (connectors/alloy/connector.js's `toXdm` 2-field allowlist + `context:[]`)
 * — this is thin defense-in-depth, gated on `payloadDenylist` being
 * non-empty (byte-unchanged otherwise).
 */
import { checkEndpointCeiling } from "./endpoint-ceiling.js";
import { checkConfigIntegrity, pinnedDispatchUrl, hostOf } from "./config-integrity.js";
import { egressVerdict } from "./consent.js";
import { governPayload } from "./payload-governance.js";

// Default diagnostics seam (mirrors core/airlock.js's `consoleDiagnostic`):
// console-backed, so a caller that doesn't inject `onDiagnostic` still
// observes a held config-integrity deviation instead of it vanishing
// silently. Callers may inject `onDiagnostic` (the same 009-02 sink) to
// intercept the same records instead.
function consoleDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}

/**
 * @param {{
 *   chamber: {
 *     postMessage: (msg: Record<string, unknown>) => void,
 *     onMessage: (cb: (msg: Record<string, unknown>) => void) => void,
 *   },
 *   caps: {
 *     egress: {
 *       dispatch: (req: { url: string, method?: string, headers?: Record<string, string>, body?: string }) =>
 *         Promise<{ status: number, statusText?: string, headers?: Record<string, string>, body: string }>,
 *     },
 *     cookies?: { reconcile: (reconciledSetCookie: string) => void },
 *   },
 *   timeoutMs?: number,
 *   configIntegrity?: ({ pinnedHost: string, tenantKey: string, pinnedTenant: string, disposition?: ("hold" | "override") } | null),
 *   endpointCeiling?: (readonly string[] | null),
 *   consent?: (Record<string, string> | null),
 *   egressPurposes?: readonly string[],
 *   payloadDenylist?: (readonly string[] | null),
 *   onDiagnostic?: (record: { level: string, kind: string, [k: string]: unknown }) => void,
 * }} opts
 * @returns {{
 *   init: (initMsg?: Record<string, unknown>) => void,
 *   driveEvent: (event: object) => Promise<{ summary: object, ready: unknown[] }>,
 *   getState: () => {
 *     phases: string[],
 *     writeBacks: string[],
 *     mainDispatch: { count: number, requests: Array<{ url: string, method?: string, body?: string }> },
 *     summary: object | null,
 *     ready: unknown[],
 *     fatal: object | null,
 *     held: number,
 *     overridden: number,
 *     ceilingHeld: number,
 *     consentHeld: number,
 *   },
 * }}
 */
export function createWrappedSdkHost({
  chamber,
  caps,
  timeoutMs = 5000,
  configIntegrity = null,
  endpointCeiling = null,
  consent = null,
  egressPurposes = [],
  payloadDenylist = null,
  onDiagnostic,
}) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
  // FAIL-LOUD on a consent misconfiguration (020-02 arch review): a `consent`
  // vector wired WITHOUT `egressPurposes` skips the TRUSTED seam-side drop
  // entirely (the gate below is `egressPurposes.length`-gated), leaving only the
  // in-chamber `setConsent` DELEGATE — which runs inside the untrusted chamber
  // and is never enforcement. Warn once at construction so this never silently
  // disables the trusted control (the in-chamber delegate alone is not the seal).
  if (consent && !egressPurposes.length) {
    diagnose({
      level: "warn",
      kind: "consent",
      disposition: "not-enforced",
      reason: "consent vector wired without egressPurposes — the TRUSTED seam-side drop is OFF; only the in-chamber setConsent delegate is active",
    });
  }
  const state = {
    phases: [],
    writeBacks: [],
    mainDispatch: { count: 0, requests: [] },
    summary: null,
    ready: [],
    fatal: null,
    held: 0,
    overridden: 0,
    ceilingHeld: 0,
    consentHeld: 0,
  };

  let queuedEvent = null;
  let onResult = null; // { resolve, reject } for the in-flight driveEvent() call

  /**
   * Answer one intercepted-fetch: call the injected `caps.egress.dispatch`
   * (the real main-thread fetch) and post the response back to the chamber.
   * Races a `timeoutMs` bound (AC6) so a dispatch that never settles still
   * yields a `status:0` response — the chamber's pending fetch REJECTS, it
   * never hangs. Guarded against posting twice (a timeout THEN a late
   * settle, or vice versa) with a per-call `settled` flag.
   */
  function dispatchInterceptedFetch(m) {
    // (A) ENDPOINT CEILING (spec 016-01/016-02, ADR-0006): owns HOST+PATH, runs
    // on EVERY intercepted egress, BEFORE config-integrity and BEFORE
    // caps.egress.dispatch — an undeclared destination must never reach the
    // tenant check or the real fetch. Absent `endpointCeiling`, this control is
    // skipped entirely (back-compat with 014-01/015 callers that never pass it).
    if (endpointCeiling) {
      const c = checkEndpointCeiling(m.url, endpointCeiling);
      if (c.verdict === "hold") {
        state.ceilingHeld += 1;
        diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c.destination, reason: c.reason });
        // HOLD: no real egress, and config-integrity never runs on this dispatch
        // — same fail-closed response shape as a config-integrity hold below.
        chamber.postMessage({ type: "intercepted-fetch-response", id: m.id, status: 0, statusText: "held at the seal: endpoint-ceiling", body: "" });
        return;
      }
    }

    // Config-integrity (spec 015-01/02, ADR-0011): checked BEFORE anything else
    // reaches egress — a HELD dispatch must not count as a real dispatch
    // (mainDispatch stays accurate) and must not reach caps.egress.dispatch (no
    // real egress).
    //
    // (B) AXIS RECONCILIATION (016-02 AC2): once a ceiling is ALSO wired, it has
    // already confirmed (above) that this destination is a DECLARED host+path —
    // config-integrity's remaining job narrows to the TENANT, so it is scoped to
    // requests aimed at its OWN `pinnedHost` (the interact). Absent a ceiling,
    // config-integrity runs on every egress exactly as 015 shipped it
    // (standalone, unchanged — the block below is byte-identical to 015).
    const runConfigIntegrity = configIntegrity && (!endpointCeiling || hostOf(m.url) === configIntegrity.pinnedHost);
    if (runConfigIntegrity) {
      const check = checkConfigIntegrity(m.url, configIntegrity);
      if (check.verdict === "hold") {
        // A complete pin can be re-derived to a valid destination; an incomplete
        // one (a misconfiguration) cannot, so it HOLDS even under override.
        const pinComplete = !!(configIntegrity.pinnedHost && configIntegrity.tenantKey && configIntegrity.pinnedTenant);
        if (configIntegrity.disposition === "override" && pinComplete) {
          // OVERRIDE (015-02, opt-in): re-derive to the host-pinned host+tenant and
          // SEND (evasion-proof — discards whatever the chamber supplied), STILL
          // alerting. Availability-over-integrity: the chamber-built body still
          // reaches the honest tenant (the ADR-0011 body residual). Never silent.
          state.overridden += 1;
          diagnose({ level: "error", kind: "config-integrity", disposition: "overridden", reason: check.reason });
          m = { ...m, url: pinnedDispatchUrl(m.url, configIntegrity) };
          // fall through to dispatch the CORRECTED url below
        } else {
          state.held += 1;
          // ALERT (009-02) — redacted: name the deviation, never the raw identifier values.
          diagnose({ level: "error", kind: "config-integrity", disposition: "held", reason: check.reason });
          // HOLD: no real egress. Settle the chamber's pending fetch REJECTED (mirrors the AC6 error shape)
          // so sendEvent rejects instead of hanging — the seal bites, fail-closed.
          chamber.postMessage({ type: "intercepted-fetch-response", id: m.id, status: 0, statusText: "held at the seal: config-integrity", body: "" });
          return;
        }
      }
    } else if (endpointCeiling && configIntegrity && hostOf(m.url) !== configIntegrity.pinnedHost) {
      // (C) DISCLOSURE (016-02 AC4/AC6d-e — the tenant-coverage gap made
      // OBSERVABLE, never opened silently). Both controls are wired, and this
      // destination is a DECLARED origin (the ceiling above already allowed it)
      // that is NOT config-integrity's pinnedHost — so config-integrity did NOT
      // check a tenant on it. The ceiling's host+path confinement is real, but
      // this dispatch is tenant-BLIND. Only fires once a 2nd declared origin
      // exists — the single-origin FLOOR this slice ships (016-02 AC3) has no
      // non-pinnedHost declared origin, so this branch is dormant in the shipped
      // alloy config; it exists for the day a second tenant-keyed origin is
      // declared (which needs the multi-tenant-pin follow-up, not a blind add).
      diagnose({
        level: "warn",
        kind: "config-integrity",
        disposition: "unpinned-declared-origin",
        reason: "config-integrity: declared origin is not the tenant-pinned host — tenant NOT checked here (multi-tenant-pin follow-up)",
      });
    }

    // AC1 (spec 020-02, ADR-0007) — the TRUSTED seam-side consent gate: does
    // NOT trust the chamber. Runs AFTER config-integrity/endpoint-ceiling,
    // BEFORE mainDispatch/caps.egress.dispatch — same chokepoint, same
    // fail-closed shape. Gated on `egressPurposes.length` (back-compat: no
    // purposes wired -> skipped entirely, byte-unchanged).
    //
    // `strict: true` is REQUIRED here (020-01 craft catch) — NOT
    // `egressVerdict`'s non-strict default. The non-strict default returns
    // "send" on a data-use denial because that path is premised on a
    // body-consent field (GA4's MP `consent` object — 017-01's reshape-and-
    // send). alloy has NO body-consent field, so a denied/pending governing
    // purpose sent anyway would LEAK, not reshape — it must be SUPPRESSED.
    //
    // pending -> DROP here (not hold+buffer) is the first-impl fail-closed
    // choice: the alloy interact is a synchronous vendor-SDK round trip
    // (alloy's own pending `sendEvent` promise), not a queued { url, body }
    // beacon like GA4's async seal (017-03) — a pending->hold+flush
    // refinement mirroring that seal is a named follow-on, not built here.
    if (egressPurposes.length) {
      const verdict = egressVerdict(consent, egressPurposes, { strict: true });
      if (verdict !== "send") {
        state.consentHeld += 1;
        // ALERT (009-02) — redacted: names the governing purpose(s) only,
        // never the resolved identity/XDM values.
        diagnose({
          level: "warn",
          kind: "consent",
          disposition: "held",
          purpose: egressPurposes.join(","),
          reason: "un-granted governing purpose — alloy interact held at the seal",
        });
        // HOLD: no real egress. Settle the chamber's pending fetch REJECTED
        // (same shape as the ceiling/config-integrity holds above) so
        // sendEvent rejects instead of hanging — fail-closed.
        chamber.postMessage({ type: "intercepted-fetch-response", id: m.id, status: 0, statusText: "held at the seal: consent", body: "" });
        return;
      }
    }

    // AC3 (spec 020-02) — optional thin defense-in-depth payload strip: gated
    // on a non-empty `payloadDenylist` (back-compat: absent/empty leaves
    // `m.body` byte-unchanged). Non-load-bearing — the alloy interact body
    // is already read-minimized by construction
    // (connectors/alloy/connector.js's `toXdm` 2-field allowlist +
    // `context:[]`; 020-01 Finding).
    if (payloadDenylist && payloadDenylist.length && m.body) {
      const strippedBody = stripInterceptedXdmBody(
        m.body,
        payloadDenylist,
        (field) => diagnose({ level: "warn", kind: "payload-governance", disposition: "stripped", field }),
        (reason) => diagnose({ level: "error", kind: "payload-governance", disposition: "skipped", reason }),
      );
      if (strippedBody !== m.body) m = { ...m, body: strippedBody };
    }

    state.mainDispatch.count += 1;
    state.mainDispatch.requests.push({ url: m.url, method: m.method, body: m.body });

    let settled = false;
    const respond = (payload) => {
      if (settled) return;
      settled = true;
      chamber.postMessage({ type: "intercepted-fetch-response", id: m.id, ...payload });
    };

    const timer = setTimeout(() => {
      respond({
        status: 0,
        statusText: `intercepted-fetch timed out after ${timeoutMs}ms (no main-thread response)`,
        body: "",
      });
    }, timeoutMs);

    Promise.resolve()
      .then(() => caps.egress.dispatch({ url: m.url, method: m.method, headers: m.headers, body: m.body }))
      .then((res) => {
        clearTimeout(timer);
        respond({
          status: (res && res.status) || 0,
          statusText: (res && res.statusText) || "",
          headers: (res && res.headers) || { "content-type": "application/json" },
          body: res && res.body != null ? res.body : "",
        });
      })
      .catch((err) => {
        clearTimeout(timer);
        respond({ status: 0, statusText: String((err && err.message) || err), body: "" });
      });
  }

  function handleMessage(raw) {
    const m = raw || {};
    if (m.type === "phase") {
      state.phases.push(m.name);
      // Mirrors the harness's reactive drive: the moment the chamber reports
      // it configured, send the ONE queued page event (see driveEvent below).
      if (m.name === "configured" && queuedEvent) {
        const event = queuedEvent;
        queuedEvent = null;
        chamber.postMessage({ type: "event", event });
      }
    } else if (m.type === "intercepted-fetch") {
      dispatchInterceptedFetch(m);
    } else if (m.type === "cookie-writeback") {
      state.writeBacks.push(m.value);
      const reconciled = reconcileForBrokerJar(m.value);
      if (caps.cookies && typeof caps.cookies.reconcile === "function") {
        // Guard a throwing sink so one bad write-back can't take down the message
        // handler (mirrors the harness's `try { document.cookie = … } catch {}`).
        try { caps.cookies.reconcile(reconciled); } catch (e) { /* sink self-guards */ }
      }
    } else if (m.type === "result") {
      state.summary = m.summary;
      state.ready = m.ready || [];
      if (onResult) {
        const { resolve } = onResult;
        onResult = null;
        resolve({ summary: m.summary, ready: m.ready || [] });
      }
    } else if (m.type === "fatal") {
      state.fatal = m;
      if (onResult) {
        const { reject } = onResult;
        onResult = null;
        reject(Object.assign(new Error(m.message || "chamber fatal"), { detail: m }));
      }
    }
    // Any other message type (e.g. the 012-01 AC5 `egress-probe-result`) is a
    // chamber-protocol concern this host does not own — deliberately ignored
    // here; a caller that needs it registers its OWN independent listener on
    // the underlying transport (see rig/alloy-core-host-harness.html, which
    // uses `addEventListener` rather than the single-slot `onmessage`).
  }

  chamber.onMessage(handleMessage);

  return {
    /** Boot the chamber: posts `{ type: "init", ...initMsg }`. */
    init(initMsg) {
      chamber.postMessage({ type: "init", ...(initMsg || {}) });
    },
    /**
     * Drive ONE page event through the chamber: queues `event` to be sent the
     * moment the chamber reports `phase:"configured"`, and settles when the
     * chamber reports back — resolves `{ summary, ready }` on `result`,
     * rejects on `fatal`. Call once, after `init()`.
     */
    driveEvent(event) {
      return new Promise((resolve, reject) => {
        // Single-slot by design (one page event per host). Guard re-entry so a
        // second call can't silently clobber the first's resolve/reject and hang it.
        if (onResult) {
          reject(new Error("driveEvent already in flight — call once, after init()"));
          return;
        }
        queuedEvent = event;
        onResult = { resolve, reject };
      });
    },
    /** A snapshot of everything observed so far (for rig/test assertions). */
    getState() {
      return {
        phases: state.phases.slice(),
        writeBacks: state.writeBacks.slice(),
        mainDispatch: { count: state.mainDispatch.count, requests: state.mainDispatch.requests.slice() },
        summary: state.summary,
        ready: state.ready.slice(),
        fatal: state.fatal,
        held: state.held,
        overridden: state.overridden,
        ceilingHeld: state.ceilingHeld,
        consentHeld: state.consentHeld,
      };
    },
  };
}

/**
 * Reconcile a vendor `Set-Cookie`-shaped string into the broker's REAL jar
 * (byte-for-byte the proven logic from rig/alloy-chamber-harness.html,
 * relocated here per spec 014-01). The chamber's sync-cookie shim computes a
 * fake `airlock.example` domain + `Secure`/`SameSite=None` (the R-004 shim
 * location); those attributes make a plain http/localhost jar reject the
 * cookie outright. Dropping them (keeping `name=value` + any other attrs)
 * lets the cookie actually land on the test origin.
 * @param {string} raw
 * @returns {string}
 */
export function reconcileForBrokerJar(raw) {
  return String(raw)
    .split(";")
    .map((s) => s.trim())
    .filter((seg) => {
      const s = seg.toLowerCase();
      return !s.startsWith("domain=") && s !== "secure" && !s.startsWith("samesite=");
    })
    .join("; ");
}

/**
 * AC3 (spec 020-02) — parse the intercepted alloy interact body, strip every
 * `denylist`-denied field from EVERY `events[].xdm` via
 * core/payload-governance.js's `governPayload`, and re-serialize (020-01
 * live-confirmed this parse -> strip -> re-serialize round-trip is
 * Edge-safe). Calls `onStripped(field)` once per stripped field NAME (never
 * the value — redaction discipline) and `onError(reason)` if governance
 * failed safe on a given event's xdm. Never throws: a body that is not valid
 * JSON, or carries no `events` array, is returned UNCHANGED (the identical
 * string reference) — same when nothing actually matched the denylist,
 * mirroring `governPayload`'s own no-needless-copy contract.
 * @param {string} rawBody
 * @param {readonly string[]} denylist
 * @param {(field: string) => void} onStripped
 * @param {(reason: string) => void} onError
 * @returns {string}
 */
function stripInterceptedXdmBody(rawBody, denylist, onStripped, onError) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (e) {
    return rawBody; // not JSON — leave untouched, never throw
  }
  if (!parsed || !Array.isArray(parsed.events)) return rawBody;

  let changed = false;
  const events = parsed.events.map((evt) => {
    if (!evt || typeof evt !== "object" || evt.xdm == null || typeof evt.xdm !== "object") return evt;
    const { governed, stripped, error } = governPayload(evt.xdm, denylist);
    if (error && typeof onError === "function") onError("govern-failed");
    if (!stripped.length) return evt;
    changed = true;
    for (const field of stripped) {
      if (typeof onStripped === "function") onStripped(field);
    }
    return { ...evt, xdm: governed };
  });

  return changed ? JSON.stringify({ ...parsed, events }) : rawBody;
}
