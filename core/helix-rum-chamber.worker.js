/**
 * The helix-rum chamber (spec 030-02) — hosts the native RUM connector
 * (`connectors/helix-rum/connector.js`'s `createHelixRumConnector`) through the
 * SAME `core/connector-host.js` mechanism GA4 / pixel / alloy already use.
 * Mirrors `core/pixel-chamber.worker.js`'s shape — the same first-import
 * egress-confinement guard (`./confine-helix-rum-chamber.js`) and host wiring —
 * swapping only the hosted factory.
 *
 * WIRE PROTOCOL — same shape as pixel-chamber.worker.js's:
 *   IN  `{ type: "init", ...rumConfig }`   (rumConfig: `{ collectBaseURL, rate,
 *       weight, id, isSelected, ctx: { referer } }` createHelixRumConnector
 *       interprets — the main-thread-minted sampling `{weight, id, isSelected}`
 *       is passed so main↔worker agree, 030-02)
 *   IN  `{ type: "events", batch }`        (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * `core/airlock.js`'s connector-selection seam
 * (`createAirlock({ connector: "helix-rum", connectorConfig })`) posts
 * `{ type: "init", ...connectorConfig }` here verbatim.
 *
 * EGRESS CONFINEMENT: this file's FIRST import (`./confine-helix-rum-chamber.js`)
 * withholds `fetch` — the RUM connector's chamber egress is the `ready`
 * postMessage, and CWV capture is main-thread. No DOM, no ambient globals (ADR-0001).
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (source-order guarantee — see the pixel
// chamber's header + core/confine-helix-rum-chamber.js for the full argument).
import "./confine-helix-rum-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createHelixRumConnector } from "../connectors/helix-rum/connector.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has no
// `self`) — the same guard core/pixel-chamber.worker.js uses.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const { type, ...config } = m; // strip the message's own discriminant
      host = createConnectorHost(createHelixRumConnector, config);
      initPromise = host.init({}); // no capabilities wired — RUM requests none (no cookie)
      return;
    }
    if (m.type === "events" && host) {
      Promise.resolve(initPromise)
        .then(() => host.routeBatch(m.batch))
        .then(({ ready, dropped }) => {
          self.postMessage({ ready, dropped });
        })
        .catch((err) => {
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
