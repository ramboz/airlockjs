// DOM-chamber confinement — a side-effecting module whose ONLY job is to be
// `core/dom-chamber.worker.js`'s FIRST import (spec 025-02 — mirrors
// `core/confine-ga4-chamber.js` / `core/confine-pixel-chamber.js`).
//
// SAME ES-MODULE POST-ORDER ARGUMENT as the other two confine-*-chamber.js
// modules: the DOM chamber is a `type:"module"` worker that statically
// imports its host logic (`createDomChamberHost` from `./dom-chamber-host.js`,
// which in turn imports the mirror). A module's own top-level body runs only
// AFTER its statically-imported dependencies' top-levels have run — so
// confinement must be its OWN module, imported FIRST above those imports;
// otherwise a compromised mirror/host module's top-level `const f =
// self.fetch` would capture the LIVE fetch before confinement could reassign
// it. See core/confine-ga4-chamber.js's header for the full argument (proven
// by test/egress-confinement.test.js).
//
// SAME INVERSION AS GA4/PIXEL: the DOM chamber's only egress is the
// worker->main mutation-flush `postMessage` (`./worker-dom/protocol.js`'s
// `createMutationsMessage`), never a mediated fetch inside the worker — so
// `fetch` itself is WITHHELD here (`withholdFetch: true`), exactly like the
// other two chambers (the inverse of alloy's `fetchPreserved` invariant).
// A dom-chamber tag running off-thread must not be able to reach the network
// by ANY path — that is the whole point of confining it in the first place.
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard the other confine-*-chamber.js modules use.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
