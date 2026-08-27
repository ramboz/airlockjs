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
 * @param {object} opts
 * @param {object} opts.ctx        session/identity context for `mapToMp`
 * @param {string[]} opts.endpoints per-tracker collect URLs
 * @param {number} [opts.trackers]  number of trackers (defaults to endpoints.length)
 * @param {number} [opts.budgetBytes] aggregate keepalive budget (defaults to 64 KiB)
 * @param {Function} [opts.fetchImpl] injectable fetch (defaults to global `fetch`)
 * @param {(s: string) => number} [opts.encode] body byte-sizer (defaults to UTF-8 length)
 */
export function createCriticalDispatcher({
  ctx,
  endpoints,
  trackers,
  budgetBytes = KEEPALIVE_BUDGET_BYTES,
  fetchImpl = typeof fetch !== "undefined" ? fetch : null,
  encode = (s) => new TextEncoder().encode(s).length,
}) {
  let used = 0;
  let dispatched = 0;
  let dropped = 0;
  const n = typeof trackers === "number" ? trackers : endpoints.length;

  /**
   * Synchronously map `event` for every tracker and issue a keepalive send.
   * Fire-and-forget: keepalive lets each request outlive the page, so we never
   * await — every send is ISSUED before this call returns (that synchronicity is
   * the whole point at teardown).
   */
  function dispatch(event) {
    for (let t = 0; t < n; t++) {
      const body = JSON.stringify(mapToMp(event, ctx));
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
