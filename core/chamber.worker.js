/**
 * The GA4 chamber (spec 003; converged onto the generic host — spec 014-03).
 * Runs GA4 off the main thread by hosting `connectors/ga4/connector.js`
 * through the SAME generic `core/connector-host.js` mechanism
 * `connectors/alloy/alloy-chamber.worker.js` hosts alloy through — retiring
 * this file's old hardcoded `mapToMp`/`mapBatch` import (MVP2 arch flag 3).
 * It does NOT fetch here: mapping stays off-thread (INP-safe), egress
 * dispatch is the orchestrator's job on the main thread (ADR-0002 Option C).
 *
 * WIRE PROTOCOL — unchanged (core/airlock.js speaks the SAME messages as
 * before this slice; only this file's INTERNALS changed):
 *   IN  `{ type: "init", trackers, workFactor, endpoints, ctx }`
 *   IN  `{ type: "events", batch }`               (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * `{ ready, dropped }` is `core/connector-host.js`'s `routeBatch` return shape
 * — byte-identical to the old `mapBatch`'s, so `core/airlock.js`'s
 * `onmessage`/`drain`/`ring`/`projection`/`unloadFlush` need no change at all
 * (014-03 AC2/AC4).
 *
 * INIT-BEFORE-EVENTS sequencing: `createConnectorHost`'s `init`/`routeBatch`
 * are async (vs the old `mapBatch`'s sync call), so the "events" handler
 * explicitly chains off the retained `initPromise` rather than assuming
 * ordering — correct even if a caller's init hasn't technically settled yet
 * (GA4's `init` is a synchronous no-op under the hood, so in practice it
 * always has by the time a real second `postMessage` arrives).
 *
 * No DOM, no ambient globals (ADR-0001) — touching `document` would throw
 * here, exactly as before this slice (unchanged realm/isolation properties;
 * see rig/isolation.mjs).
 */
import { createConnectorHost } from "./connector-host.js";
import { createGa4Connector } from "../connectors/ga4/connector.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — unchanged from the old `mapBatch`-hosting file (009-01
// frame-critique). The pure mapping/containment logic this used to guard now
// lives in core/connector-host.js + connectors/ga4/connector.js, both
// independently Node-testable; this file is now pure worker-side glue,
// exactly like connectors/alloy/alloy-chamber.worker.js.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const { type, ...config } = m; // strip the message's own discriminant
      host = createConnectorHost(createGa4Connector, config);
      initPromise = host.init({}); // no capabilities are wired for GA4 today
      return;
    }
    if (m.type === "events" && host) {
      Promise.resolve(initPromise)
        .then(() => host.routeBatch(m.batch))
        .then(({ ready, dropped }) => {
          // hand the ready egress requests back to the orchestrator to dispatch
          self.postMessage({ ready, dropped });
        })
        .catch((err) => {
          // A TOP-LEVEL routeBatch failure (e.g. a malformed, non-iterable batch)
          // is a chamber-level fault. The old SYNC mapBatch threw it to
          // core/airlock.js's `worker.onerror` (009-02); async routeBatch would
          // instead leak a SILENT unhandled rejection. Surface it through the same
          // diagnostics seam via a batch-level `dropped` entry (per-event drops are
          // already handled inside routeBatch). Unreachable in practice —
          // airlock.js always posts a proper array batch — but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
