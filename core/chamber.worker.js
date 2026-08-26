/**
 * The chamber (spec 003) — the Web Worker side of the airlock. Runs N GA4
 * connectors off the main thread: each maps a descriptor to an MP payload (the
 * complex per-tracker work) and RETURNS the ready-to-send request to the
 * orchestrator. It does NOT fetch here.
 *
 * This is ADR-0002's Option C egress: mapping stays off-thread (INP-safe), but
 * dispatch is the orchestrator's job on the main thread, where keepalive is most
 * reliable and the unload flush lives (OQ10 / R-001). A worker-only fetch loses
 * its in-flight/queued egress when the worker is torn down with the page.
 *
 * No DOM, no ambient globals (ADR-0001) — touching `document` would throw here.
 */
import { mapToMp } from "../connectors/ga4/map.js";

let cfg = null;

function busy(micros) {
  if (micros <= 0) return;
  const end = performance.now() + micros / 1000;
  while (performance.now() < end) {} // eslint-disable-line no-empty
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") { cfg = m; return; }
  if (m.type === "events" && cfg) {
    const ready = [];
    for (const descriptor of m.batch) {
      const event = { type: descriptor.type, params: descriptor.params };
      for (let t = 0; t < cfg.trackers; t++) {
        const body = mapToMp(event, cfg.ctx); // map (contract-shaped)
        busy(cfg.workFactor); // complex per-tracker logic — OFF the main thread
        ready.push({ url: cfg.endpoints[t], body: JSON.stringify(body) });
      }
    }
    // hand the ready egress requests back to the orchestrator to dispatch
    self.postMessage({ ready });
  }
};
