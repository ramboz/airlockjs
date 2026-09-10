/**
 * Main-thread synchronous egress — the OQ10 unload fast path (spec 003 follow-up).
 *
 * The normal path is ADR-0002 Option C: the worker MAPS off-thread and the
 * orchestrator DISPATCHES on the main thread. But an event GENERATED inside the
 * unload window — the canonical last beacon, an outbound-link click or a closing
 * `page_view` — cannot complete an async worker round-trip before the page is torn
 * down, so it is never mapped and never sent (the loss OQ10 / R-001 flagged).
 *
 * This dispatcher closes that gap: it maps on the MAIN thread synchronously,
 * reusing the exact same pure `mapToMp` the worker uses (so the payload is
 * byte-identical, keeping delivery honest), and issues
 * `fetch(url, { keepalive: true })` immediately with no worker hop. It serves
 * (a) events the caller declares unload-critical via `pushCritical`, and (b) the
 * not-yet-drained ring tail flushed at `visibilitychange`→hidden / `pagehide`.
 * Because these events never enter the worker, there is NO two-sender dedup
 * problem — the fast path is their sole sender (the OQ10 hard part dissolves by
 * construction, not by an ack protocol).
 *
 * Synchronous main-thread mapping is precisely what the airlock avoids on the
 * INTERACTION path (it wrecks INP). It is acceptable here only because the page is
 * unloading: there is no subsequent interaction to protect, and delivery now
 * outranks INP. Callers MUST NOT route steady-state events through this path.
 *
 * The aggregate `keepalive` body budget (~64 KiB in Chrome — architecture.md
 * § Tech stack) is enforced here: once exhausted, further sends are dropped and
 * counted, so an over-budget unload burst degrades predictably and visibly
 * instead of failing silently.
 */
import { mapToMp } from "../connectors/ga4/map.js";

/** Chrome's aggregate in-flight `keepalive` request-body cap. */
export const KEEPALIVE_BUDGET_BYTES = 64 * 1024;

/**
 * Method-aware fetch-init shape — SHARED by this module's own synchronous
 * unload dispatch (below) and the steady-state worker-mapped dispatch path
 * (`core/airlock.js`'s `worker.onmessage` handler + its `setConsent` held-
 * beacon flush). Originated at spec 026-01 AC4 (resolving OQ10 for the GET
 * case) as a `core/airlock.js`-local helper; moved HERE at spec 042-01 so
 * both the synchronous unload path and the steady-state path share the exact
 * same, can't-drift shape instead of two copies that could silently diverge.
 * `undefined`/anything-but-"GET" -> the historical `{ method: "POST", body,
 * keepalive: true }` shape, BYTE-UNCHANGED for every existing POST connector
 * (GA4's EgressRequest never sets `method` at all — a GA4 regression test
 * pins this). `"GET"` -> `{ method: "GET", keepalive: true }`, deliberately
 * OMITTING `body` — a real `fetch(url, { method: "GET", body })` throws.
 * @param {"GET"|"POST"|undefined} method
 * @param {string|undefined} [body]
 * @returns {{ method: string, body?: string, keepalive: true }}
 */
export function fetchInit(method, body) {
  return method === "GET" ? { method: "GET", keepalive: true } : { method: "POST", body, keepalive: true };
}

/**
 * @param {object} opts
 * @param {object} [opts.ctx]        session/identity context for `mapper` (POST path only)
 * @param {string[]} [opts.endpoints] per-tracker collect URLs (POST path only)
 * @param {number} [opts.trackers]  number of trackers (defaults to endpoints.length)
 * @param {number} [opts.budgetBytes] aggregate keepalive budget (defaults to 64 KiB)
 * @param {Function} [opts.fetchImpl] injectable fetch (defaults to global `fetch`)
 * @param {(s: string) => number} [opts.encode] body byte-sizer (defaults to UTF-8 length)
 * @param {(event: object) => Array<{url: string, method?: string, body?: string}>} [opts.requestMapper]
 *   spec 042-01: an OPTIONAL connector-generic GET/POST request mapper —
 *   `(event) => EgressRequest[]`. When present, `dispatch(event)` calls
 *   `requestMapper(event)` and issues one `fetch(req.url, fetchInit(req.method,
 *   req.body))` per returned request (the SAME init shape the steady-state
 *   worker seam uses), bypassing the legacy per-tracker `mapper`/`endpoints`/
 *   budget path below ENTIRELY — a GET request carries no body and consumes no
 *   keepalive budget (A2); an empty `[]` result is a clean no-op. Absent (the
 *   default) -> the legacy POST path runs byte-unchanged.
 *
 *   GET-SHAPED BY CURRENT DESIGN (042-01 craft/arch review): every caller's
 *   `handle` returns GET-only requests (ga4-gtag; pixel in 042-02), so the
 *   budget-bypass above is a no-op in practice. `fetchInit` still honors a
 *   POST `req.method` (it is method-generic), but a POST returned here would
 *   send WITHOUT the aggregate-keepalive-budget accounting the per-tracker
 *   loop enforces — an intentionally-unbudgeted boundary while GET is the only
 *   shape, NOT budgeted prophylactically for a caller that does not yet exist.
 *   A future POST-returning `requestMapper` must revisit budget accounting here.
 */
export function createCriticalDispatcher({
  ctx,
  endpoints,
  trackers,
  // 030-01: the main-thread unload mapper is connector-generic. Default = GA4's
  // `mapToMp` (byte-unchanged for every existing caller); a worker-mapped connector
  // whose map lives in the chamber (e.g. helix-rum) passes a closure binding its own
  // main-thread mapper — `(event, ctx) => mapToRum(event, ctx, sampling)` — so its
  // unload-critical events (RUM's INP/late-CLS at page-hide) egress correctly instead
  // of being GA4-mis-mapped or dropped.
  mapper = mapToMp,
  budgetBytes = KEEPALIVE_BUDGET_BYTES,
  fetchImpl = typeof fetch !== "undefined" ? fetch : null,
  encode = (s) => new TextEncoder().encode(s).length,
  requestMapper,
}) {
  let used = 0;
  let dispatched = 0;
  let dropped = 0;
  // Guarded against a missing `endpoints` (byte-unchanged for every existing
  // caller, which always passes `endpoints`): a requestMapper-only construction
  // (042-01, e.g. the ga4-gtag wiring) legitimately omits `endpoints`/`trackers`
  // entirely, since the legacy per-tracker loop below never runs for it.
  const n = typeof trackers === "number" ? trackers : (endpoints ? endpoints.length : 0);

  /**
   * Synchronously map `event` and issue a keepalive send. Fire-and-forget:
   * keepalive lets each request outlive the page, so we never await — every
   * send is ISSUED before this call returns (that synchronicity is the whole
   * point at teardown).
   *
   * 042-01: a `requestMapper` (present) takes over ENTIRELY — one fetch per
   * `EgressRequest` it returns, GET/POST-aware via the shared `fetchInit`
   * above, no per-tracker fan-out, no body/budget accounting (a GET carries
   * no body, A2). Absent -> the legacy per-tracker POST path below, untouched.
   */
  function dispatch(event) {
    if (typeof requestMapper === "function") {
      const requests = requestMapper(event) || [];
      for (const req of requests) {
        try {
          const p = fetchImpl(req.url, fetchInit(req.method, req.body));
          // Swallow async rejection: at teardown there is no one to handle it.
          if (p && typeof p.then === "function") p.then(() => {}, () => {});
          dispatched++;
        } catch {
          dropped++;
        }
      }
      return;
    }
    for (let t = 0; t < n; t++) {
      const body = JSON.stringify(mapper(event, ctx));
      const bytes = encode(body);
      if (used + bytes > budgetBytes) {
        dropped++;
        continue;
      }
      used += bytes;
      try {
        const p = fetchImpl(endpoints[t], { method: "POST", body, keepalive: true });
        // Swallow async rejection: at teardown there is no one to handle it.
        if (p && typeof p.then === "function") p.then(() => {}, () => {});
        dispatched++;
      } catch {
        dropped++;
      }
    }
  }

  return {
    dispatch,
    bytesUsed: () => used,
    stats: () => ({
      fastDispatched: dispatched,
      fastDropped: dropped,
      keepaliveBytesUsed: used,
    }),
  };
}
