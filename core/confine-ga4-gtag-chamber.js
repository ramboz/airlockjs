// GA4 gtag chamber confinement — a side-effecting module whose ONLY job is to
// be `core/ga4-gtag-chamber.worker.js`'s FIRST import (spec 041-01 AC2,
// mirroring `core/confine-pixel-chamber.js`'s own security-parity rationale
// for a THIRD egress-confined chamber).
//
// SAME ES-MODULE POST-ORDER ARGUMENT as core/confine-ga4-chamber.js /
// core/confine-pixel-chamber.js: the gtag chamber is a `type:"module"` worker
// that STATICALLY imports its connector (`createConnectorHost`,
// `createGa4GtagConnector`). A module's own top-level body runs only AFTER
// its statically-imported dependencies' top-levels have run, in source order
// — so confinement must be its OWN module, imported FIRST above the
// connector imports; otherwise a compromised connector module's top-level
// `const f = self.fetch` would capture the LIVE fetch before confinement
// could reassign it. See core/confine-ga4-chamber.js's header for the full
// argument (proven by test/egress-confinement.test.js).
//
// SAME INVERSION AS GA4/PIXEL: the gtag connector's egress is the `ready`
// postMessage (`core/connector-host.js`'s `routeBatch` return value), never a
// mediated fetch inside the worker — `mapToGtagCollect` returns a `{url,
// method:"GET"}` descriptor, it never calls `fetch` itself — so `fetch`
// itself is WITHHELD here (`withholdFetch: true`), exactly like GA4/pixel's
// chambers (the inverse of alloy's `fetchPreserved` invariant).
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard core/ga4-gtag-chamber.worker.js already uses.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
