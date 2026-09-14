/**
 * The Google Ads (AW) chamber (spec 048-01 AC1) — hosts the `Connector`-conforming
 * `connectors/google-ads/connector.js`'s `createGoogleAdsConnector` through the SAME
 * `core/connector-host.js` mechanism `core/ga4-gtag-chamber.worker.js` (gtag),
 * `core/pixel-chamber.worker.js` (pixel), and `core/chamber.worker.js` (GA4-MP) already
 * use. Mirrors `core/ga4-gtag-chamber.worker.js`'s shape byte-for-byte — the same
 * first-import egress-confinement guard (`./confine-google-ads-chamber.js`) and host
 * wiring — swapping only the hosted factory. This is the frame-critique's correction
 * (spec 048-01, 2026-09-14): the AW connector's steady-state page-load beacon is mapped
 * OFF-THREAD in its own chamber, exactly like gtag — `createGoogleAdsRemap` (the
 * connector's other export) covers only the seal's held→flush re-map, not this
 * steady-state path.
 *
 * WIRE PROTOCOL — same shape as `core/ga4-gtag-chamber.worker.js`'s:
 *   IN  `{ type: "init", ...gAdsConfig }`   (gAdsConfig: `{ conversionId, ctx,
 *       endpoint }`, the config `createGoogleAdsConnector` interprets)
 *   IN  `{ type: "events", batch }`          (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * `core/airlock.js`'s connector-selection seam
 * (`createAirlock({ connector: "google-ads", connectorConfig })`) generalizes its own
 * init-message construction to post `{ type: "init", ...connectorConfig }` here
 * verbatim — no GA4-MP-shaped trackers/workFactor fields are sent (this connector never
 * reads them; it has no per-tracker fan-out).
 *
 * EGRESS CONFINEMENT (026-01-style security parity, applied here for google-ads): like
 * `core/ga4-gtag-chamber.worker.js`, this file's FIRST import
 * (`./confine-google-ads-chamber.js`, above) withholds `fetch` before the connector
 * imports below evaluate. The connector's own egress is the `ready` postMessage, never a
 * mediated fetch inside the worker — exactly like GA4-MP/pixel/gtag's inversion — so the
 * SAME `withholdFetch: true` posture applies verbatim (source-order + withholdFetch both
 * regression-pinned in test/egress-confinement.test.js).
 *
 * No DOM, no ambient globals (ADR-0001) — mirrors chamber.worker.js.
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering fix,
// applied here for the google-ads chamber). ES-module evaluation is POST-ORDER, so a
// statically-imported module's top-level runs before THIS file's body — and imports
// evaluate in SOURCE ORDER, so putting this FIRST guarantees egress confinement
// (withholding `fetch`, since the connector's egress is the `ready` postMessage, not a
// mediated fetch) runs before the connector imports below can capture a live `fetch`.
// See core/confine-google-ads-chamber.js for the full argument.
import "./confine-google-ads-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createGoogleAdsConnector } from "../connectors/google-ads/connector.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has no
// `self`) — the same guard core/pixel-chamber.worker.js / core/ga4-gtag-chamber.worker.js use.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const { type, ...config } = m; // strip the message's own discriminant
      host = createConnectorHost(createGoogleAdsConnector, config);
      initPromise = host.init({}); // no capabilities are wired for the gtag-family archetype today
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
          // Mirrors core/ga4-gtag-chamber.worker.js's own top-level-routeBatch-failure
          // backstop — unreachable in practice (airlock.js always posts a proper array
          // batch), but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
