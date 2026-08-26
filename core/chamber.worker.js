/**
 * The chamber (spec 003-02) — the Web Worker side of the airlock. Runs N GA4
 * connectors off the main thread: each maps a descriptor to an MP payload
 * (complex per-tracker work) and egresses to its endpoint. No DOM, no ambient
 * globals (ADR-0001) — touching `document` would throw here (isolation seed).
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
    let egressed = 0;
    for (const descriptor of m.batch) {
      const event = { type: descriptor.type, params: descriptor.params };
      for (let t = 0; t < cfg.trackers; t++) {
        const body = mapToMp(event, cfg.ctx); // map (contract-shaped)
        busy(cfg.workFactor); // complex per-tracker logic — OFF the main thread
        // egress: keepalive fetch from the worker to the tracker's endpoint
        fetch(cfg.endpoints[t], {
          method: "POST",
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {});
        egressed++;
      }
    }
    self.postMessage({ egressed });
  }
};
