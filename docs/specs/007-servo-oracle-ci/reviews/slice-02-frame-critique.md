---
slice: 007-02 — `isolation_invariant` oracle component (build the structural assert)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-27T19:52:28Z
prompt_source: review.py frame-critique
---

Frame-critique attacked the hermetic-isolation-test premise. FINDING (needs-changes): asserting "a connector touching document throws inside the chamber" via Node/vitest is vacuous. (1) No jsdom/happy-dom in devDeps and no @vitest-environment directive, so tests run in Node where document/window are absent — a document-touch throws because NODE has no DOM, not because the chamber strips it; it would pass even with the airlock removed. The guarantee ADR-0001 pins (Worker-scope-lacks-document vs main-thread-has-document) is exactly what a Node process cannot exhibit. (2) core/chamber.worker.js statically imports one pure function (mapToMp) via self.onmessage — no dynamic connector-loading seam to exercise, and it cannot run under Node (self/performance/postMessage). (3) No-DOM is a browser-platform property, not airlock source, so the AC3 regression + DoD mutation test have no well-defined target — a runnable-but-hollow gate. Resolution: either move the faithful assert to a real Worker/browser realm (07-05 territory, reclassifying it off servo-unattended-hermetic), or honestly re-scope the hermetic claim (e.g. a static source-level DOM-free check) and drop the "exercises the chamber boundary / catches isolation regression" language. Note: MVP1's chamber runs one pure first-party fn; arbitrary-connector runtime isolation is an MVP2 (wrapped-SDK) concern.
