/**
 * patchDatalayer-style main-thread baseline (spec 003-01).
 *
 * The competent main-thread comparison for the head-to-head: capture on the
 * interaction path is cheap; the map + serialize + send run on the MAIN thread,
 * drained in CHUNKS on idle (ADR-0002's chunked, yield-aware drain — but here the
 * chunk does the MAPPING on-thread). Fair, not a strawman: it defers and chunks
 * exactly like the airlock path; the ONLY difference from the worker path
 * (003-02) is WHERE the per-event mapping runs — here, the main thread.
 *
 * Under sustained interaction the chunked drain runs in the idle gaps between
 * interactions, so a chunk executing when the next interaction arrives inflates
 * that interaction's latency (INP). The worker path moves that per-event mapping
 * off-thread, leaving the main thread only the lighter drain.
 */
import { mapToMp } from "../connectors/ga4/map.js";

/** Calibrated busy-wait modelling per-event mapping cost (microseconds). */
function busy(micros) {
  if (micros <= 0) return;
  const end = performance.now() + micros / 1000;
  while (performance.now() < end) {} // eslint-disable-line no-empty
}

/**
 * @param {{ endpoint: string, ctx: object, workFactor?: number, chunk?: number }} opts
 *   workFactor = modelled mapping cost per event, in MICROSECONDS.
 *   chunk = events mapped per idle drain before yielding.
 */
export function createBaseline({ endpoint, ctx, workFactor = 0, chunk = 5 }) {
  let queue = [];
  let scheduled = false;
  let mapped = 0;
  let dispatched = 0;

  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestIdleCallback(drain, { timeout: 50 });
    }
  };

  function drain() {
    scheduled = false;
    let processed = 0;
    while (queue.length && processed < chunk) {
      const event = queue.shift();
      const body = mapToMp(event, ctx); // ← main-thread mapping (the differentiator)
      busy(workFactor); // model heavier connector mapping cost
      const payload = JSON.stringify(body);
      fetch(endpoint, { method: "POST", body: payload, keepalive: true }).then(
        () => { dispatched++; },
        () => { dispatched++; },
      );
      mapped++;
      processed++;
    }
    if (queue.length) schedule(); // more to do → yield, then continue (chunked)
  }

  return {
    /** Interaction-path entry: capture + ensure a drain is scheduled. Cheap. */
    push(event) { queue.push(event); schedule(); },
    /** Drain everything synchronously (end of storm / unload). */
    flushNow() { while (queue.length) drain(); },
    stats() { return { mapped, dispatched, pending: queue.length }; },
  };
}
