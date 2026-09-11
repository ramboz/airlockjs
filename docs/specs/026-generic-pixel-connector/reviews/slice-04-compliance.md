---
slice: 026-04 — Meta advanced matching (worker-hashed, eager, unload-cached)
pass: compliance
verdict: pass
reviewer: general-purpose (independent-review, Opus)
reviewed_at: 2026-09-11T15:20:26Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING:
All 7 ACs met + exercised by non-vacuous tests (41 passing across 4 files). The 4 security
properties hold + are witnessed: raw identity never egresses/crosses back (only 64-hex hashes
posted/cached/merged); only hashes populate identityCache (airlock.js:325-329); the payloadDenylist
bypass on setIdentity is by-design + provably safe under the withholdFetch-confined worker (tests
assert the raw feed reaches the worker intact yet only the hash appears on the wire even with a
denylist covering em/ph/external_id). ADR-0022 kill-criterion #2 honored: the teardown-race test
drives the identification-then-immediate-navigate PII profile (em/ph set, then pagehide before the
hash resolves) → per-field omit, no raw, while warm external_id ships. Back-compat byte-identical
(empty cache → same requests reference); GA4 setIdentity is a harmless no-op.

SPECIFIC ISSUES: (none blocking — no correctness/edge/security defects found)

RECONCILIATION NOTES:
- Deviation-log heading is `### Deviation log (after reconciliation)`; confirmed acceptable (042/
  026-06 RECONCILED with the same suffix — the gate matches the prefix).
- Mid-session identity invalidation: overwrite-refresh works (a re-posted field overwrites the
  cache) but there is no clear-to-remove path (ADR-0022 § Consequences names it). No AC/public API
  can clear identity today, so it can't arise — record as a known limitation in refinement-todo.
- Comment typo advanced-matching.js:48 — "Texas → 'tx'" should be "'te'" (truncation); deviation-log
  item 5 states it correctly. Fix the comment.
- Sweep-table TODOs + docs/architecture.md (new worker→main identity seam + hash cache) +
  docs/refinement-todo.md (026-04 placeholder → external_id resolved; em/ph end-to-end still
  doc-grounded) close at reconciliation, before DONE, plus the arch + reconciliation gates.
