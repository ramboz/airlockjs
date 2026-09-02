/**
 * The pixel chamber (spec 026-01 AC3) — hosts the generic, vendor-neutral
 * `connectors/pixel/connector.js`'s `createPixelConnector` through the SAME
 * `core/connector-host.js` mechanism `core/chamber.worker.js` (GA4) and
 * `connectors/alloy/alloy-chamber.worker.js` (alloy) already use. Mirrors
 * `core/chamber.worker.js`'s shape — the same first-import egress-confinement
 * guard (`./confine-pixel-chamber.js`) and host wiring — swapping only the
 * hosted factory and dropping the GA4-shaped init fields
 * (`trackers`/`workFactor`/`ctx`) the pixel connector never reads.
 *
 * WIRE PROTOCOL — same shape as `core/chamber.worker.js`'s:
 *   IN  `{ type: "init", ...pixelConfig }`   (pixelConfig: the declarative
 *       `{ endpoint, eventMap, paramMap, … }` createPixelConnector interprets)
 *   IN  `{ type: "events", batch }`          (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * `core/airlock.js`'s connector-selection seam
 * (`createAirlock({ connector: "pixel", connectorConfig })`) generalizes its
 * own init-message construction to post `{ type: "init", ...connectorConfig }`
 * here verbatim — no trackers/workFactor/ctx are sent (this connector never
 * reads them; it has no per-tracker fan-out and no host-sourced identity,
 * spec 026-01's "Identity honesty").
 *
 * EGRESS CONFINEMENT (026-01 craft-review — security parity for an ad-vendor
 * chamber): like `core/chamber.worker.js`, this file's FIRST import
 * (`./confine-pixel-chamber.js`, above) withholds `fetch` before the connector
 * imports below evaluate. The pixel connector's own egress is the `ready`
 * postMessage, never a mediated fetch inside the worker — exactly like GA4's
 * inversion — so the SAME `withholdFetch: true` posture applies verbatim
 * (source-order + withholdFetch both regression-pinned in
 * test/egress-confinement.test.js).
 *
 * No DOM, no ambient globals (ADR-0001) — mirrors chamber.worker.js.
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering
// fix, applied here for the pixel chamber — 026-01 craft-review). ES-module
// evaluation is POST-ORDER, so a statically-imported module's top-level runs
// before THIS file's body — and imports evaluate in SOURCE ORDER, so putting
// this FIRST guarantees egress confinement (withholding `fetch`, since the
// pixel connector's egress is the `ready` postMessage, not a mediated fetch)
// runs before the connector imports below can capture a live `fetch`. See
// core/confine-pixel-chamber.js for the full argument.
import "./confine-pixel-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createPixelConnector } from "../connectors/pixel/connector.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard core/chamber.worker.js uses.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const { type, ...config } = m; // strip the message's own discriminant
      host = createConnectorHost(createPixelConnector, config);
      initPromise = host.init({}); // no capabilities are wired for the pixel archetype today
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
          // Mirrors core/chamber.worker.js's own top-level-routeBatch-failure
          // backstop — unreachable in practice (airlock.js always posts a
          // proper array batch), but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
