---
slice: 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T21:42:38Z
prompt_source: review.py implementation
---

Compliance — PASS. All three ACs verified against the shipped chamber protocol. AC1: rig/isolation-probe.worker.js imports the UNMODIFIED core/chamber.worker.js and makes a bare `document` reference (not typeof/self.document) in try/catch, reporting via unsolicited postMessage without hijacking self.onmessage (the chamber's onmessage stays registered for AC2). AC2: the chamber's real init/events/{ready} protocol runs in the SAME worker; asserted mapToMp output fields (client_id, events[0].name, params.session_id) match connectors/ga4/map.js exactly. AC3: oracle.sh COMPONENTS contains only vitest/ga4_mp_conformance (no isolation entry); orchestrator confirmed `git diff --stat oracle.sh core/chamber.worker.js connectors/ga4/map.js` empty. Exit process.exit(pass?0:1) is clean for 07-05 gating. Page-nav to /package.json is a harmless same-origin carrier. RECONCILIATION: deviation log TBD (rig diverges from uc1 by design — serves source tree, no build, no CSP); DoD mutation-test + checkboxes to close at reconciliation.
