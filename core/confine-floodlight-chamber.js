// Floodlight (DC) chamber confinement — a side-effecting module whose ONLY job is to be
// `core/floodlight-chamber.worker.js`'s FIRST import (spec 048-02 AC1, mirroring
// `core/confine-google-ads-chamber.js`'s own security-parity rationale for the gtag-family chamber —
// floodlight is hosted the SAME way, spec 046-01's `createFloodlightConnector`).
//
// SAME ES-MODULE POST-ORDER ARGUMENT as core/confine-ga4-chamber.js / core/confine-ga4-gtag-chamber.js
// / core/confine-pixel-chamber.js / core/confine-google-ads-chamber.js: the floodlight chamber is a
// `type:"module"` worker that STATICALLY imports its connector (`createConnectorHost`,
// `createFloodlightConnector`). A module's own top-level body runs only AFTER its statically-imported
// dependencies' top-levels have run, in source order — so confinement must be its OWN module, imported
// FIRST above the connector imports; otherwise a compromised connector module's top-level `const f =
// self.fetch` would capture the LIVE fetch before confinement could reassign it. See
// core/confine-ga4-chamber.js's header for the full argument (proven by test/egress-confinement.test.js).
//
// SAME INVERSION AS GA4/PIXEL/GTAG/GOOGLE-ADS: the floodlight connector's egress is the `ready`
// postMessage (`core/connector-host.js`'s `routeBatch` return value), never a mediated fetch inside the
// worker — both `mapToDcCollect` and `mapToDcActivity` return a `{url, method:"GET"}` descriptor, they
// never call `fetch` themselves — so `fetch` itself is WITHHELD here (`withholdFetch: true`), exactly
// like GA4/pixel/gtag/google-ads' chambers (the inverse of alloy's `fetchPreserved` invariant). This
// applies to BOTH DC beacon forms (ccm/collect + the `;`-matrix activity) — one chamber, one confinement
// posture.
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has no `self`) — the same
// guard core/floodlight-chamber.worker.js already uses.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
