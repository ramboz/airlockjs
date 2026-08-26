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
 * Open (OQ10): a beacon GENERATED inside the unload window still cannot round-trip
 * to the worker to be mapped — that needs a main-thread synchronous mapping fast
 * path for declared unload-critical event types. Out of scope for this spike; the
 * measurement confirms the need.
 */
export function createAirlock({ trackers, workFactor, endpoints, ctx }) {
  const log = [];
  const projection = {};
  const ring = [];
  let seq = 0;
  let dispatched = 0;
  let scheduled = false;

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

  // OQ10 backstop: at unload, push whatever is still buffered to the worker so it
  // gets mapped + returned + dispatched. (The unload-GENERATED last beacon still
  // needs a main-thread fast path — see header.)
  if (typeof addEventListener === "function") {
    addEventListener("visibilitychange", () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        while (ring.length) worker.postMessage({ type: "events", batch: ring.splice(0, 50) });
      }
    });
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
    stats() { return { dispatched, logged: log.length }; },
  };
}
