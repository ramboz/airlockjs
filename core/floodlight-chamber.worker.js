/**
 * The Floodlight (DC) chamber (spec 048-02 AC1) — hosts the `Connector`-conforming
 * `connectors/floodlight/connector.js`'s `createFloodlightConnector` through the SAME
 * `core/connector-host.js` mechanism `core/google-ads-chamber.worker.js` (google-ads),
 * `core/ga4-gtag-chamber.worker.js` (gtag), `core/pixel-chamber.worker.js` (pixel), and
 * `core/chamber.worker.js` (GA4-MP) already use. Mirrors `core/google-ads-chamber.worker.js`'s shape
 * closely — the same first-import egress-confinement guard (`./confine-floodlight-chamber.js`) and host
 * wiring — swapping the hosted factory AND **nesting** the init config under `connectorConfig` (NOT the
 * top-level `{type:"init", ...connectorConfig}` spread the other chambers use), because Floodlight's
 * config carries a native `type` field that would otherwise clobber the `type:"init"` discriminant (see
 * the `onmessage` init branch below). This is 048-01's frame-critique pattern applied
 * to Floodlight: the DC connector's steady-state page-load beacon(s) are mapped OFF-THREAD in this one
 * chamber, exactly like google-ads/gtag — `createFloodlightRemap` (the connector's other export) covers
 * only the seal's held→flush re-map, not this steady-state path.
 *
 * BOTH DC BEACON FORMS THROUGH ONE CHAMBER (spec 046-02, A1-floodlight): `createFloodlightConnector`'s
 * own `handle()` fans a single `page_view` out to the `ccm/collect` beacon ALWAYS, plus the `;`-matrix
 * `activity` beacon too when the Floodlight-native identity (`src`) is configured — this chamber hosts
 * that ONE connector unmodified, so both forms cross the SAME worker/init/routeBatch path; there is no
 * per-form chamber or config type.
 *
 * WIRE PROTOCOL — UNLIKE `core/google-ads-chamber.worker.js`'s (a load-bearing deviation, 048-02):
 *   IN  `{ type: "init", connectorConfig }`  (connectorConfig: `{ conversionId, src?, type?, cat?,
 *       ctx, endpoint?, activityEndpoint? }`, the config `createFloodlightConnector` interprets)
 *   IN  `{ type: "events", batch }`          (batch: descriptor[])
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 * Every OTHER gtag-family chamber's init message SPREADS its connectorConfig at the message's TOP
 * LEVEL (`{ type: "init", ...connectorConfig }`) — but floodlight's OWN config carries a field
 * literally named `type` (the Floodlight-native activity tag, e.g. "grptag00"), which would COLLIDE
 * with this message's `type: "init"` discriminant under a top-level spread (object-literal last-key-
 * wins would silently clobber one or the other — either losing the "init" tag, so `m.type === "init"`
 * never matches again and the chamber permanently no-ops, or losing the connector's own activity tag).
 * `core/airlock.js`'s connector-selection seam therefore NESTS the config under its own
 * `connectorConfig` key for `connector: "floodlight"` specifically (its one bespoke branch), instead of
 * generalizing the shared `{ type: "init", ...connectorConfig }` spread the other five connectors use.
 *
 * EGRESS CONFINEMENT (026-01-style security parity, applied here for floodlight): like
 * `core/google-ads-chamber.worker.js`, this file's FIRST import (`./confine-floodlight-chamber.js`,
 * above) withholds `fetch` before the connector imports below evaluate. The connector's own egress is
 * the `ready` postMessage, never a mediated fetch inside the worker — exactly like GA4-MP/pixel/gtag/
 * google-ads' inversion — so the SAME `withholdFetch: true` posture applies verbatim (source-order +
 * withholdFetch both regression-pinned in test/egress-confinement.test.js).
 *
 * No DOM, no ambient globals (ADR-0001) — mirrors chamber.worker.js.
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering fix, applied here for the
// floodlight chamber). ES-module evaluation is POST-ORDER, so a statically-imported module's top-level
// runs before THIS file's body — and imports evaluate in SOURCE ORDER, so putting this FIRST guarantees
// egress confinement (withholding `fetch`, since the connector's egress is the `ready` postMessage, not
// a mediated fetch) runs before the connector imports below can capture a live `fetch`. See
// core/confine-floodlight-chamber.js for the full argument.
import "./confine-floodlight-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createFloodlightConnector } from "../connectors/floodlight/connector.js";

let host = null;
let initPromise = null;

// Guarded so this module stays importable outside a real Worker (vitest has no
// `self`) — the same guard core/pixel-chamber.worker.js / core/google-ads-chamber.worker.js use.
if (typeof self !== "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      // NESTED, unlike the other gtag-family chambers' `const { type, ...config } = m` strip (see the
      // header doc comment above) — floodlight's own config can carry a `type` field, so the sender
      // nests it under `connectorConfig` instead of spreading it at the message's top level.
      host = createConnectorHost(createFloodlightConnector, m.connectorConfig || {});
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
          // Mirrors core/google-ads-chamber.worker.js's own top-level-routeBatch-failure
          // backstop — unreachable in practice (airlock.js always posts a proper array
          // batch), but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
