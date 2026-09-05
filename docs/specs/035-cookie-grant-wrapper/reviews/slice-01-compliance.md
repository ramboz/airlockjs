---
slice: 035-01 — name-scope + name-validate the live alloy cookie grant
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-05T20:30:57Z
prompt_source: review.py implementation docs/specs/035-cookie-grant-wrapper/spec.md 035-01 <deliverables>
---

VERDICT: pass

REASONING:
All six acceptance criteria are met, enforced on both trusted seams (READ seed-filter before the
worker; WRITE-back validate+scope on the host) as the frame-critique-ratified design prescribed —
including the load-bearing wiring (ALLOY_COOKIE_NAMES as a same-reference SSOT export mirroring
ALLOY_INTERACT_ENDPOINT; grantedCookieNames threaded as a createWrappedSdkHost option captured in the
handler closure, not via host.init). Tests are meaningful and non-vacuous: the AC1/AC2/AC3/AC4
assertions each fail if the feature is removed, and the WRITE-side no-regression is proven
end-to-end through the real boot→bootAlloy seam with the gate active. Fail-closed, redacted
(name-only) diagnostics, and back-compat (null gate) all hold. No correctness or security bugs found.

AC COVERAGE (verified):
- AC1 (READ scope): scopeSeedCookies + bootAlloy wiring; init.cookie asserted exactly "kndctr_org=2; demdex=3".
- AC2 (WRITE scope + validation): write-back gate drops _ga/session/injection/splitting; reconciles granted names.
- AC3 (SSOT): ALLOY_COOKIE_NAMES export, same-reference manifest, both seams import it (toBe same-ref test).
- AC4 (exact-vs-prefix): matchesGrantedName, incl. pinned negative demdex_evil.
- AC5 (no-regression): READ + WRITE round-trip end-to-end with the gate ACTIVE (AMCV_TEST%40AdobeOrg survives).
- AC6 (follow-ons): documented; SecurityError rider dispositioned as documented follow-on.

NIT (non-blocking, addressed at REVIEWED): a control-char test's description claimed NUL coverage; the
test in fact exercised a RAW NUL byte in the source literal (invisible; broke tooling) — corrected to
the portable \0 escape (same NUL char). Behavior unchanged.
