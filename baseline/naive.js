/**
 * Naive multi-tracker main-thread baseline (spec 003) — the COMMON real-world
 * case, not a strawman: N trackers each run complex logic synchronously and
 * sequentially in the interaction handler, each reporting to its own endpoint,
 * with NO requestIdleCallback / rAF / setTimeout deferral. This is what a stack
 * of GTM/Launch tags plus a few hand-rolled `onclick` trackers actually does —
 * and where 150ms+ INP comes from (domain report, 2026-08-26).
 *
 * Per interaction: T trackers × workFactor µs of synchronous main-thread work +
 * T egress calls, all on the interaction. INP ≈ T × workFactor.
 */
import { mapToMp } from "../connectors/ga4/map.js";

function busy(micros) {
  if (micros <= 0) return;
  const end = performance.now() + micros / 1000;
  while (performance.now() < end) {} // eslint-disable-line no-empty
}

export function createNaive({ trackers, workFactor, endpoints, ctx }) {
  let egressed = 0;
  return {
    push(event) {
      for (let t = 0; t < trackers; t++) {
        const body = mapToMp(event, ctx);
        busy(workFactor); // complex per-tracker logic, ON the interaction, sequential
        fetch(endpoints[t], { method: "POST", body: JSON.stringify(body), keepalive: true })
          .then(() => { egressed++; }, () => { egressed++; });
      }
    },
    flushNow() {},
    stats() { return { egressed }; },
  };
}
