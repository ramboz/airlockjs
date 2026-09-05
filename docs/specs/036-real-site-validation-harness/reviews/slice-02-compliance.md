---
slice: 036-02 — supported-subset live smoke (GA4 + alloy) + residuals checklist + run-procedure
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-05T23:18:21Z
prompt_source: review.py implementation docs/specs/036-real-site-validation-harness/spec.md 036-02 <deliverables>
---

VERDICT: pass

REASONING:
All five ACs are met by the deliverable. The rig asserts boot-health + GA4 MP-conformance + alloy-FIRED
(presence only) + RUM sent-shape and NEVER labels alloy/RUM "accepted" (verified in both the disposition
strings and the guarding unit tests). The residuals checklist names an honest reveal per residual and
requires downstream RUM-data inspection for the cwv-superset gate, with a captured beacon explicitly
declared insufficient. The local dry-run is provable (GA4 conformance + alloy chamber boot-health, with
alloy's interact honestly reported not-exercised-locally); the procedure is consolidated in
docs/real-site-validation.md; and rig/e2e.mjs genuinely reuses the extracted smoke-core primitives rather
than forking them. The pure verdict/disposition tests are non-vacuous — they fail if a disposition
wrongly claims acceptance or if a boot failure doesn't fail the verdict.

NON-BLOCKING (all addressed at REVIEWED via the craft-fix cycle): the consent-granted assumption is now
a documented operator note; boot-health now also gates on the positive window.airlock-installed signal;
the live RUM sampling asymmetry is handled (informational, not a false-fail). Green-run claims
(npm test / build / lint, e2e post-refactor, the local dry-run) are corroborated by the craft re-run +
the reconciliation pass.
