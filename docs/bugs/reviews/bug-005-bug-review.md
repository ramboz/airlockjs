---
bug: 002
pass: bug-review
verdict: pass
reviewer: jig:reviewer ledger-bug-review
reviewed_at: 2026-11-10T19:16:35Z
prompt_source: review.py bug-review docs/bugs/005-admission-ledger-capacity.md; immutable bug002-ledger-review-v1.patch
---

VERDICT: pass

All hunks in the five-file patch were reviewed statically. The fix addresses
the undersized ledger directly: it bounds resulting UTF-8 bytes, including
newline, before writing while preserving existing admission caps, locking,
FD checks and fsync. Tests cover the reported fourth reservation, complete
two-arm histories, oversized dates, the exact byte boundary, record retention
and custody refusals. Documented RED/GREEN evidence supports the regression;
the reviewer did not execute it independently.

Retain the repair-specific, one-command fresh-main-check exception and blank
main-check fields. No fresh-main verification occurred. Lifecycle green
attestation, craft review and removal of the temporary test-command override
remain pending. This is bug002 bug-review only, not live-sample validation
or whole-slice completion.
