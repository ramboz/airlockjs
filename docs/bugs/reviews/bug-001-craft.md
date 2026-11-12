---
bug: 001
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-16T01:22:11Z
prompt_source: pr-review skill craft pass; exact guarded query additions and actual source copies
---

VERDICT: pass

REASONING:
Canonical predicate, README and actual pre-import guard preserve four unique
required keys while admitting only the intended off forms. Meta-only,
malformed, duplicate, encoded, unknown and omitted-required variants remain
rejected. Origin/path/fragment, case/run, consent and bounded-bootstrap defenses
remain. Regressions and the complete actual-bootstrap/entry fixture cover the
producing boundary without changing product code or permitting native transport.

RECONCILIATION NOTES:
No bounded deviation found. Read-only review inspected, not reran, tests/proof.
Offline craft PASS only; deployment, real SDK,45-second performance and full
slice remain unproved. Failed18 and spending remain; unavailable is not context19
approval.
