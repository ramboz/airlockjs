---
slice: 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T20:54:24Z
prompt_source: review.py reconciliation
---

Reconciliation review — VERDICT PASS. All seven deviation-log items check out against the actual deliverables: the two-config split (vitest.config.js excludes test/oracle-ga4.test.js; vitest.oracle.config.js + test:oracle run it alone) with the recursion guard removed; the hermeticity fix (env-deletion of GA4_MEASUREMENT_ID/GA4_API_SECRET in the live-check test child); the THRESHOLD-outside-SEED comment; the binary-invariant comment; and the credential-free-by-default skip path all match. Item 6 honestly flags AC3's "placeholder endpoint" wording as aspirational rather than hiding that the live check POSTs to the real GA4 endpoint when creds are supplied. Sweep dispositions faithful: .servo/refinement-todo.md Threshold entry marked RESOLVED; slice-04-ci-core.md AC1 now includes the `npm run test:oracle` step; docs/refinement-todo.md/architecture.md no-ops genuine (Threshold is servo-owned, not in jig's refinement-todo). Cross-slice slice-04 edit is legitimate (that slice is READY_FOR_REVIEW with dependencies:[007-01], and the CI step is the direct consequence of 007-01 moving the gate-flip proof out of npm test) — not scope creep. No closed spec or ADR silently altered. The AND-gate/binary-invariant oracle-design decisions are appropriately deferred to the 07-03 "servo oracle design" ADR (named trigger, authored with OQ6) and preserved inline as oracle.sh comments meanwhile — nothing owed now. No issues.
