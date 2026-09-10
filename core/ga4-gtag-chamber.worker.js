/**
 * The GA4 gtag-protocol chamber (spec 041-01 AC2) — hosts the now-`Connector`-
 * conforming `connectors/ga4/gtag.js`'s `createGa4GtagConnector` through the
 * SAME `core/connector-host.js` mechanism `core/chamber.worker.js` (GA4-MP),
 * `core/pixel-chamber.worker.js` (pixel), and `connectors/alloy/alloy-chamber.
 * worker.js` (alloy) already use. Mirrors `core/pixel-chamber.worker.js`'s
 * shape byte-for-byte — the same first-import egress-confinement guard
 * (`./confine-ga4-gtag-chamber.js`) and host wiring — swapping only the
 * hosted factory.
 *
 * WIRE PROTOCOL — same shape as `core/pixel-chamber.worker.js`'s:
 *   IN  `{ type: "init", ...gtagConfig }`   (gtagConfig: `{ measurementId, ctx,
 *       endpoint }`, the config `createGa4GtagConnector` interprets)
 *   IN  `{ type: "events", batch }`          (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * `core/airlock.js`'s connector-selection seam
 * (`createAirlock({ connector: "ga4-gtag", connectorConfig })`) generalizes
 * its own init-message construction to post `{ type: "init", ...connectorConfig }`
 * here verbatim — no trackers/workFactor GA4-MP-shaped fields are sent (this
 * connector never reads them; it has no per-tracker fan-out).
 *
 * EGRESS CONFINEMENT (026-01-style security parity, applied here for gtag):
 * like `core/pixel-chamber.worker.js`, this file's FIRST import
 * (`./confine-ga4-gtag-chamber.js`, above) withholds `fetch` before the
 * connector imports below evaluate. The gtag connector's own egress is the
 * `ready` postMessage, never a mediated fetch inside the worker — exactly
 * like GA4-MP/pixel's inversion — so the SAME `withholdFetch: true` posture
 * applies verbatim (source-order + withholdFetch both regression-pinned in
 * test/egress-confinement.test.js).
 *
 * No DOM, no ambient globals (ADR-0001) — mirrors chamber.worker.js.
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering
// fix, applied here for the gtag chamber). ES-module evaluation is POST-ORDER,
// so a statically-imported module's top-level runs before THIS file's body —
// and imports evaluate in SOURCE ORDER, so putting this FIRST guarantees
// egress confinement (withholding `fetch`, since the gtag connector's egress
// is the `ready` postMessage, not a mediated fetch) runs before the connector
// imports below can capture a live `fetch`. See
// core/confine-ga4-gtag-chamber.js for the full argument.
import "./confine-ga4-gtag-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createGa4GtagConnector } from "../connectors/ga4/gtag.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard core/pixel-chamber.worker.js uses.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const { type, ...config } = m; // strip the message's own discriminant
      host = createConnectorHost(createGa4GtagConnector, config);
      initPromise = host.init({}); // no capabilities are wired for the gtag archetype today
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
          // Mirrors core/pixel-chamber.worker.js's own top-level-routeBatch-failure
          // backstop — unreachable in practice (airlock.js always posts a
          // proper array batch), but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
