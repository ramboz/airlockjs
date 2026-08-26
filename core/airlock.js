/**
 * Minimal airlock runtime (spec 003-02) — the off-main-thread path.
 *
 * Main thread: `push()` appends a descriptor to the event log, folds a
 * synchronous projection (O(1)), and enqueues to a ring buffer — cheap, on the
 * interaction path (ADR-0002). A chunked drain on idle serializes a batch and
 * `postMessage`s it to a single Web Worker chamber (ADR-0001 plain Worker).
 *
 * Worker: N connectors each do the complex per-tracker mapping + egress OFF the
 * main thread. Same total work as the baselines — only the thread differs.
 */
export function createAirlock({ trackers, workFactor, endpoints, ctx }) {
  const log = [];
  const projection = {};
  const ring = [];
  let seq = 0;
  let acked = 0;
  let scheduled = false;

  const worker = new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => { if (e.data && e.data.egressed) acked += e.data.egressed; };
  worker.postMessage({ type: "init", trackers, workFactor, endpoints, ctx });

  const drain = () => {
    scheduled = false;
    if (!ring.length) return;
    const batch = ring.splice(0, 50); // chunk
    worker.postMessage({ type: "events", batch }); // structured clone
    if (ring.length) schedule();
  };
  function schedule() {
    if (!scheduled) { scheduled = true; requestIdleCallback(drain, { timeout: 50 }); }
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
    getState() { return projection; },
    flushNow() { while (ring.length) worker.postMessage({ type: "events", batch: ring.splice(0, 50) }); },
    stats() { return { acked, logged: log.length }; },
  };
}
