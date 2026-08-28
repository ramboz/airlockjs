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

/**
 * Map one cycle's batch of descriptors to ready-to-send MP requests.
 *
 * Pure — no `self`/`postMessage`/DOM — so it is directly importable/testable
 * in Node (spec 009-01 frame-critique: `chamber.worker.js` had no test
 * because the side-effecting `self.onmessage` module wasn't importable).
 *
 * Isolation granularity is PER DESCRIPTOR, not per (descriptor, tracker):
 * `mapToMp`'s result depends on `event + ctx`, not the tracker, so a throw on
 * a descriptor recurs for every tracker. The try/catch wraps the whole
 * descriptor — on throw, no request is pushed for ANY of its trackers, the
 * descriptor is recorded in `dropped`, and mapping continues with the next
 * descriptor (ADR-0001 containment: one bad event does not take the batch
 * down, and the caller — `self.onmessage` — never sees the throw).
 *
 * @param {Array<{ type: string, params?: Record<string, unknown> }>} batch
 * @param {{ trackers: number, workFactor: number, endpoints: string[], ctx: object }} cfg
 * @returns {{ ready: Array<{ url: string, body: string }>, dropped: Array<{ type: string, reason: string }> }}
 */
export function mapBatch(batch, cfg) {
  const ready = [];
  const dropped = [];
  for (const [index, descriptor] of batch.entries()) {
    const event = { type: descriptor.type, params: descriptor.params };
    try {
      for (let t = 0; t < cfg.trackers; t++) {
        const body = mapToMp(event, cfg.ctx); // map (contract-shaped)
        busy(cfg.workFactor); // complex per-tracker logic — OFF the main thread
        ready.push({ url: cfg.endpoints[t], body: JSON.stringify(body) });
      }
    } catch (err) {
      // `index` disambiguates two same-`type` drops in one batch (009-01 craft
      // review); `reason` is defensive against a non-Error throw yielding
      // `undefined` — the drop must be recorded, never vanished (spec A2).
      const reason = err && err.message != null ? err.message : String(err);
      dropped.push({ index, type: descriptor.type, reason });
    }
  }
  return { ready, dropped };
}

// Guarded so `mapBatch` is importable from Node (vitest has no `self`) per the
// 009-01 frame-critique — the worker global is absent outside a real Worker.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") { cfg = m; return; }
    if (m.type === "events" && cfg) {
      const { ready, dropped } = mapBatch(m.batch, cfg);
      // hand the ready egress requests back to the orchestrator to dispatch
      self.postMessage({ ready, dropped });
    }
  };
}
