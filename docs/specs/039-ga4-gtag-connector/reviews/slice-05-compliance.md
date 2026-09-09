---
slice: 039-05 — Consent-Mode defaults carriage (gcd derivation)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T16:51:53Z
prompt_source: review.py implementation <spec> 'defaults carriage' <deliverables>
---

Compliance verdict: **pass**. All 4 ACs met + genuinely exercised. AC1 encodeGcd emits 13<L>3<L>3<L>3<L>5l1 over the four
purposes in the live-grounded order (granted→r/denied→q). AC2 the six anchors are loaded from the committed fixture (not
hardcoded) via a data-driven loop; the four single-signal anchors each pin a position → a GCD_PURPOSES swap fails ≥1
anchor (non-vacuous); encoder deletion → null also fails. AC3 gcs/gcd single-beacon lockstep. AC4 default-denied gate
(isDeniedAllDefault: unset→denied-all, present→all-four-explicitly-denied) with BOTH non-denied-default omission AND
unset-default emission covered, plus pending-signal omission. Descriptor gapMap now empty {} (every curated field emitted),
guarded by the en-drop regression test; the AC5 + 039-03 multipage ripple edits thread all four consent purposes to values
the fixtures actually carry (gcd=13r3r3r3r5l1/gcs=G111) — no papered-over dropped-field regression.
Note (robustness, non-blocking): the anchor loop has no toHaveLength guard → if the fixture is trimmed, coverage silently
shrinks. Reconciliation: record the absent-consentDefault→denied-all interpretation of AC4 as a deviation-log line;
restate the default-granted known non-parity gap.
