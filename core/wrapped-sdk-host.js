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
 * dispatch is HELD (no real egress) and a redacted diagnostic is emitted;
 * absent the option, the host behaves exactly as before (back-compat).
 */
import { checkConfigIntegrity } from "./config-integrity.js";

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
 *   configIntegrity?: ({ pinnedHost: string, tenantKey: string, pinnedTenant: string } | null),
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
 *   },
 * }}
 */
export function createWrappedSdkHost({ chamber, caps, timeoutMs = 5000, configIntegrity = null, onDiagnostic }) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
  const state = {
    phases: [],
    writeBacks: [],
    mainDispatch: { count: 0, requests: [] },
    summary: null,
    ready: [],
    fatal: null,
    held: 0,
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
    // Config-integrity (spec 015-01, ADR-0011): checked BEFORE anything else
    // — a HELD dispatch must not count as a real dispatch (mainDispatch stays
    // accurate) and must not reach caps.egress.dispatch (no real egress).
    if (configIntegrity) {
      const check = checkConfigIntegrity(m.url, configIntegrity);
      if (check.verdict === "hold") {
        state.held += 1;
        // ALERT (009-02) — redacted: name the deviation, never the raw identifier values.
        diagnose({ level: "error", kind: "config-integrity", disposition: "held", reason: check.reason });
        // HOLD: no real egress. Settle the chamber's pending fetch REJECTED (mirrors the AC6 error shape)
        // so sendEvent rejects instead of hanging — the seal bites, fail-closed.
        chamber.postMessage({ type: "intercepted-fetch-response", id: m.id, status: 0, statusText: "held at the seal: config-integrity", body: "" });
        return;
      }
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
