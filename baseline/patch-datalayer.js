/**
 * Competently-deferred multi-tracker main-thread baseline (spec 003) — the
 * "done right" main-thread version, rarely seen in the wild: N trackers, but the
 * complex mapping + egress is drained in CHUNKS on requestIdleCallback. The
 * browser deprioritizes idle callbacks under pending input, so this is INP-safe
 * (measured: p75 stays low even at 12s of deferred work). The point of the
 * head-to-head is that (a) almost no real stack does this — see baseline/naive.js
 * — and (b) the airlock gives this INP-safety BY CONSTRUCTION, off-thread, with
 * per-tracker isolation, with no discipline to get wrong.
 */
import { mapToMp } from "../connectors/ga4/map.js";

function busy(micros) {
  if (micros <= 0) return;
  const end = performance.now() + micros / 1000;
  while (performance.now() < end) {} // eslint-disable-line no-empty
}

export function createDeferred({ trackers, workFactor, endpoints, ctx, chunk = 3 }) {
  let queue = [];
  let scheduled = false;
  let egressed = 0;

  const schedule = () => {
    if (!scheduled) { scheduled = true; requestIdleCallback(drain, { timeout: 50 }); }
  };
  function drain() {
    scheduled = false;
    let processed = 0;
    while (queue.length && processed < chunk) {
      const event = queue.shift();
      for (let t = 0; t < trackers; t++) {
        const body = mapToMp(event, ctx);
        busy(workFactor); // complex per-tracker logic — main thread, but idle-deferred
        fetch(endpoints[t], { method: "POST", body: JSON.stringify(body), keepalive: true })
          .then(() => { egressed++; }, () => { egressed++; });
      }
      processed++;
    }
    if (queue.length) schedule();
  }

  return {
    push(event) { queue.push(event); schedule(); },
    flushNow() { while (queue.length) drain(); },
    stats() { return { egressed, pending: queue.length }; },
  };
}
