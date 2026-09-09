---
slice: 039-05 — Consent-Mode defaults carriage (gcd derivation)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T16:57:14Z
prompt_source: review.py reconciliation <spec> 'defaults carriage'
---

Reconciliation verdict: **pass** (independent jig:reviewer, read-only). All deviation-log/sweep claims verified against
source: (a) encodeGcd at gtag.js:190-196 with the isDeniedAllDefault gate (gtag.js:149-152: absent/null→emit,
explicit-non-denied→omit); (b) descriptor gapMap is empty {} (gcd moved into attributionFields); (c) both
reconciliation-time hardenings present + passing — the toHaveLength(6) anchor guard and the partial/empty-object
consentDefault omission test; (d) the default-granted known-non-parity gap is tracked (AC4 + Assumptions) with a
resolution trigger, deliberately NOT re-added to gapMap; (e) frozen-MP golden-hash + no-import guard hold, single-page
fixture carries the corrected live gcd. The 6-anchor fixture matches AC2. Scope clean, no over-build (the
encodeGcs/encodeGcd inline mirror is a defensible N=2 non-abstraction, honestly logged). The one substantive
interpretation — absent consentDefault → denied-all → emit — is honestly logged in-code + deviation log. No issues.
