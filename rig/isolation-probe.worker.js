// Wrapper entry module for rig/isolation.mjs (spec 007-02, AC1). Loaded as
// the `{type:"module"}` Worker by the rig. It `import`s the UNMODIFIED
// chamber (core/chamber.worker.js), which registers the chamber's real
// `self.onmessage` in THIS realm — that registration is the AC2 positive
// control the rig drives afterward. All ES modules loaded into one Worker
// share a single WorkerGlobalScope, so a bare `document` dereference made
// HERE runs in the exact realm that later runs `mapToMp` — proving the
// no-DOM realm guarantee with no edit to the shipped chamber.
import "../core/chamber.worker.js";

// Bare, unqualified reference (NOT `typeof document` / `self.document` —
// those resolve to `undefined` even in Node and are realm-independent;
// only the throwing bare-reference form discriminates a Worker realm from
// a DOM-bearing main thread — 007-02 AC1). Wrapped in try/catch so module
// evaluation COMPLETES: a top-level throw would error the worker and take
// down the AC2 positive control with it.
let domThrew = false;
let errName = null;
try {
  // eslint-disable-next-line no-undef
  document;
} catch (e) {
  domThrew = true;
  errName = e.name;
}

// Unsolicited report to the main thread — do NOT hijack self.onmessage,
// the chamber owns it (registered by the import above).
self.postMessage({ type: "isolation", domThrew, errName });
