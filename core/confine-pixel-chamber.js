// Pixel chamber confinement — a side-effecting module whose ONLY job is to be
// `core/pixel-chamber.worker.js`'s FIRST import (spec 026-01, craft-review:
// security parity with core/confine-ga4-chamber.js for an AD-VENDOR egress
// chamber).
//
// SAME ES-MODULE POST-ORDER ARGUMENT as core/confine-ga4-chamber.js: the pixel
// chamber is a `type:"module"` worker that STATICALLY imports its connector
// (`createConnectorHost`, `createPixelConnector`). A module's own top-level
// body runs only AFTER its statically-imported dependencies' top-levels have
// run, in source order — so confinement must be its OWN module, imported FIRST
// above the connector imports; otherwise a compromised connector module's
// top-level `const f = self.fetch` would capture the LIVE fetch before
// confinement could reassign it. See core/confine-ga4-chamber.js's header for
// the full argument (proven by test/egress-confinement.test.js).
//
// SAME INVERSION AS GA4: the pixel connector's egress is the `ready`
// postMessage (`core/connector-host.js`'s `routeBatch` return value), never a
// mediated fetch inside the worker — so `fetch` itself is WITHHELD here
// (`withholdFetch: true`), exactly like GA4's chamber (the inverse of alloy's
// `fetchPreserved` invariant). A future slice may fold both confine-*-chamber.js
// modules into one shared confine-chamber.js (026-02, when the config contract
// lands) — kept as a sibling here to avoid touching GA4's proven path.
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard core/pixel-chamber.worker.js already uses.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
