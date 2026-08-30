---
slice: 015-02 — override availability option
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-30T23:22:49Z
prompt_source: independent jig:reviewer read of the 015-02 override branch (found 1 blocker → fixed)
---

## Compliance review — 015-02 — PASS

- **Redaction upheld under the new disposition.** The overridden diagnostic passes only `reason`
  (disposition-neutral deviation name, param NAME only) — never the raw datastream/host value; a test
  now asserts `reason` excludes the attacker value. No `...check` spread.
- **No secrets / no live identifiers** — synthetic `11111111`/`99999999` only.
- **AC coverage.** AC1 opt-in/off-by-default (explicit-hold + incomplete-pin + honest-path tests);
  AC2 re-derive host+tenant + send (same-host + foreign-host + pollution via the composed unit test);
  AC3 always-alerts, now with a `reason`-coherence assertion; AC4 body-trade documented (ADR-0011 §7 +
  spec + slice).
- **Residuals tracked honestly, not dismissed:** protocol-blindness (http downgrade) reclassified from
  "negligible" to a tracked refinement-todo item scoped to the egress allow-list (ADR-0004), per the
  review; body-`orgId` + GA4-async still tracked from 015-01.

No compliance findings.
