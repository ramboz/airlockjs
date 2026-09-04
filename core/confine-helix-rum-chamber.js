// helix-rum chamber confinement — a side-effecting module whose ONLY job is to
// be `core/helix-rum-chamber.worker.js`'s FIRST import (spec 030-02, mirroring
// core/confine-pixel-chamber.js for the RUM connector).
//
// SAME ES-MODULE POST-ORDER ARGUMENT as core/confine-pixel-chamber.js / GA4: the
// helix-rum chamber is a `type:"module"` worker that STATICALLY imports its
// connector (`createConnectorHost`, `createHelixRumConnector`). A module's own
// top-level runs only AFTER its statically-imported dependencies' top-levels, in
// source order — so confinement must be its OWN module, imported FIRST, or a
// compromised connector module's `const f = self.fetch` would capture the live
// fetch first. Proven by test/egress-confinement.test.js.
//
// SAME INVERSION AS GA4/pixel: the RUM connector's egress inside the chamber is
// the `ready` postMessage (`core/connector-host.js`'s routeBatch return), never a
// mediated fetch — the main-thread orchestrator dispatches, and RUM's CWV capture
// (web-vitals) is a MAIN-THREAD concern, not the chamber's. So `fetch` is WITHHELD
// here (`withholdFetch: true`), exactly like the pixel chamber.
import { applyEgressConfinement } from "./egress-confinement.js";

// Guarded so this module stays importable outside a real Worker (vitest has no
// `self`) — the same guard core/helix-rum-chamber.worker.js already uses.
if (typeof self !== "undefined") {
  applyEgressConfinement(self, { withholdFetch: true });
}
