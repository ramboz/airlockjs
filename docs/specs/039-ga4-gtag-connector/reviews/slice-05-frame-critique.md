---
slice: 039-05 — Consent-Mode defaults carriage (gcd derivation)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-09T00:34:17Z
prompt_source: review.py frame-critique <spec> 'defaults carriage' <slice>
---

Frame-critique verdict: **needs-changes** (round 1, independent jig:reviewer, read-only, pre-implementation) → slice DEFERRED.

Load-bearing flaw: the two live gcd anchors (r granted / q denied) were captured via consent UPDATE on one page whose
DECLARED DEFAULT is denied — they vary only the resolved-vector dimension at a fixed default. So they under-determine the
encoder: consistent with BOTH a pure-vector map (default ignored) AND f(default,vector). AC2 ("reproduce both anchors")
is non-discriminating for AC1's central claim that gcd needs the declared-default input; a pure-vector encoder passes
every stated test. The anchor labeled "(default granted)" is actually (default-denied → update-granted); per CMv2 the
letters encode a (default × update) PAIR, so the true default-granted letter was never observed. The kill-criterion is
toothless at build time (both codes reproducible by the simplest one-input model). Model has flip-flopped 3x — thin
grounding signal.

Deferral rationale (post-review): the reviewer's fix (promote a declared-default-varying + mixed-vector capture to a
DoR precondition) was attempted live and FAILED — rapid gtag consent updates race the event dispatch, yielding
internally-inconsistent beacons (observed-rules.md UPDATE(2)). gcd cannot be honestly grounded from this reference page
now. Deferred with a resolution trigger (clean multi-state captures OR authoritative CMv2 gcd letter table). gcs state
parity ships in 039-02; gcd modeling-defaults follows once grounded.
