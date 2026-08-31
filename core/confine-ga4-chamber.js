// GA4 chamber confinement — a side-effecting module whose ONLY job is to be
// `core/chamber.worker.js`'s FIRST import (spec 016-01 AC2, re-critique).
//
// WHY A SEPARATE FIRST-IMPORT MODULE, NOT A CALL IN THE CHAMBER BODY/INIT
// HANDLER: `core/chamber.worker.js` is a `type:"module"` worker that
// STATICALLY imports its connector (`createConnectorHost`,
// `createGa4Connector`). ES-module evaluation is POST-ORDER: a module's own
// top-level body runs only AFTER all of its statically-imported dependency
// modules' top-levels have already run, in source order. So if confinement
// were called from inside `chamber.worker.js`'s own body (or its `init`
// message handler), the connector modules' top-level code would ALREADY have
// executed by the time confinement runs — a compromised connector module's
// top-level `const f = self.fetch` would capture the LIVE, un-withheld
// `fetch` before confinement ever touches the scope. Confinement only
// REASSIGNS the `fetch` property going forward; it cannot retroactively
// invalidate a reference already captured into a local binding (proven by
// `test/egress-confinement.test.js`'s captured-before-confinement case).
//
// The fix: make confinement itself a module whose TOP-LEVEL applies it, and
// import THAT module first, above the connector imports, in
// `core/chamber.worker.js`. By the same post-order rule, THIS module's
// top-level (and therefore `applyEgressConfinement`) now runs before the
// connector imports below it are evaluated — so any connector-module
// top-level capture already sees the withheld stub.
//
// GA4-SPECIFIC INVERSION: GA4's egress is the `ready` postMessage
// (`core/connector-host.js`'s `routeBatch` return value), not a mediated
// fetch (unlike alloy) — so `fetch` itself is WITHHELD here
// (`withholdFetch: true`), the inverse of alloy's `fetchPreserved` invariant.
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard `core/chamber.worker.js` already uses.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
