---
slice: 039-05 — Consent-Mode defaults carriage (gcd derivation)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T16:37:11Z
prompt_source: review.py frame-critique <spec> 'defaults carriage' <slice> (round 4)
---

Frame-critique verdict: **pass** (round 4, independent jig:reviewer, read-only, pre-implementation). Re-opened from
DEFERRED after new grounding. Rounds 1-3 (needs-changes) drove: (r1) the un-anchored declared-default dimension → scoped
to default-denied + omit-otherwise; (r2) synthetic-fixture-gcd contradiction + uncommitted anchors + "omit is parity-safe"
overclaim → corrected the 038 fixture gcd to the observed 13r3r3r3r5l1, committed the anchors, reframed omit as a tracked
known non-parity; (r3) the position order was asserted (homogeneous-tail anchors only pinned position 1) → captured the
FOUR single-signal-granted states live (long-poll past gtag dedup), each pinning one position.

Round-4 PASS: reviewer re-derived all 6 committed anchors (test/fixtures/parity-ga4-consent-gcd.redacted.json) from the
formula, confirmed each position is observed in both r and q under differing other-signal states (independence) and that a
2↔3 swap would falsify the only-analytics/only-ad_user_data anchors — so per-signal mapping, position order, and
independence are ALL live-grounded for the default-denied config. gcs cross-consistency holds. Unobservable regions
(default-granted letters; framing under a non-denied default) are explicitly scoped out with an honest omit-and-track
discipline + resolution trigger.

Non-blocking scope note (fold at reconciliation): the `5l1` tail / `3` separators are treated as constant framing;
because the declared default was fixed denied-all, "constant filler" is observationally indistinguishable from "encodes
a 5th signal" (e.g. security_storage). Immaterial for the reference-page target (tail carried verbatim, observed
constant); worth a line if the connector's target widens.
