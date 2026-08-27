---
slice: 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T20:14:45Z
prompt_source: review.py frame-critique (re-review round 3)
---

Final re-review after mechanism-naming clarification. VERDICT PASS. The revised AC1 names a mechanically coherent mechanism consistent with the DoR, verified against source: core/chamber.worker.js:24 assigns self.onmessage at module top level, so a wrapper module `import`ing the UNMODIFIED chamber runs that side effect and registers the handler for AC2's positive control — no chamber edit required. All ES modules loaded into one Worker share a single WorkerGlobalScope, so a bare `document` reference in the wrapper throws ReferenceError in the exact realm that later runs mapToMp (connectors/ga4/map.js, a pure module loadable unbundled). AC1 (wrapper import + bare deref, no chamber edit) and the DoR (load the wrapper, not chamber.worker.js directly) no longer contradict. NO frame flaws remain. Two under-documented implementation details (not frame flaws, for 07-05/implementation): the wrapper lives in rig/ and its relative import chain (rig -> ../core/chamber.worker.js -> ../connectors/ga4/map.js) requires all three trees served under one root; AC1's "asserting it throws" implies a try/catch around the bare reference so evaluation completes and the throw is reported. The reframe (Node-hermetic -> real-Worker browser rig, not an oracle.sh COMPONENTS entry) is captured in the slice header banner + AC3; no new deviation.
