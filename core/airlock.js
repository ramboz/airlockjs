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

export function createAirlock({ trackers, workFactor, endpoints, ctx, unloadCritical }) {
  const log = [];
  const projection = {};
  const ring = [];
  let seq = 0;
  let dispatched = 0;
  let scheduled = false;

  // OQ10 fast path: synchronous main-thread mapping+egress for unload-critical
  // beacons and the ring tail at teardown. Reuses the pure `mapToMp` (byte-for-byte
  // the same payload the worker builds) and never touches the worker.
  const criticalTypes = new Set(unloadCritical || []);
  const critical = createCriticalDispatcher({ ctx, endpoints, trackers });

  const worker = new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" });
  worker.postMessage({ type: "init", trackers, workFactor, endpoints, ctx });

  // Orchestrator dispatch: the worker returns mapped requests; send them on the
  // MAIN thread immediately (fetch keepalive is cheap + survives page teardown).
  worker.onmessage = (e) => {
    const ready = e.data && e.data.ready;
    if (!ready) return;
    for (const r of ready) {
      fetch(r.url, { method: "POST", body: r.body, keepalive: true })
        .then(() => { dispatched++; }, () => { dispatched++; });
    }
  };

  const drain = () => {
    scheduled = false;
    if (!ring.length) return;
    const batch = ring.splice(0, 50); // chunk
    worker.postMessage({ type: "events", batch });
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
    for (const d of remaining) critical.dispatch({ type: d.type, params: d.params });
  };
  if (typeof addEventListener === "function") {
    addEventListener("visibilitychange", () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") unloadFlush();
    });
    addEventListener("pagehide", unloadFlush);
  }

  return {
    /** Interaction-path entry: append + fold + enqueue. O(1), no mapping. */
    push(event) {
      const descriptor = { seq: seq++, type: event.type, ts: performance.now(), params: event.params };
      log.push(descriptor);
      projection[event.type] = descriptor; // trivial synchronous fold (AD-3)
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
    pushCritical(event) { critical.dispatch(event); },
    getState() { return projection; },
    flushNow() { while (ring.length) worker.postMessage({ type: "events", batch: ring.splice(0, 50) }); },
    stats() { return { dispatched, logged: log.length, ...critical.stats() }; },
  };
}
