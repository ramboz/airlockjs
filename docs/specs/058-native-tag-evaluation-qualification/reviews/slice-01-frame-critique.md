---
slice: 058-01 - Local recorder and no-send qualification
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-15T23:50:59Z
prompt_source: review.py frame-critique spec058 058-01 spec.md slice-01-local-qualification.md; target e24c50fc
---

VERDICT: needs-changes

REASONING:
The highest-risk assumption is that observed attempts plus a silent tripwire demonstrate effective enforcement for every declared transport. The frame honestly separates observation, enforcement and vendor outcomes, but a generic receiving-sink positive does not exclude native rejection or an ineffective fixture as the reason forbidden traffic never arrives. Pending ADR acceptance and browser/limit selection are legitimate future gates, not defects.

SPECIFIC ISSUES:
- `docs/specs/058-native-tag-evaluation-qualification/slice-01-local-qualification.md:23-36,42-50,61` — **Blocker: tripwire silence is not yet a non-vacuous per-transport enforcement test.** The required GET/POST positive and separately passing positive fixture need not establish that each forbidden fetch/image/XHR/beacon/redirect scenario can actually reach its tripwire. A browser-native refusal or misaddressed probe can therefore leave the receiver silent even with a defective guard; the generic failing-control requirement need not expose that failure for every claimed surface. **Smallest correction:** require each claimed matrix case to reach the tripwire in a matched, same-run positive leg that explicitly allows only that loopback destination, then produce observed attempts and zero arrivals under enforcement. Require a loopback-scoped disabled/bypassed-guard mutation to make qualification fail; missing or unsuccessful matched controls must be `inconclusive`, never `qualified`.

RECONCILIATION NOTES:
None; this is a pre-implementation frame finding, not an implementation deviation.

Provenance: independent jig:reviewer frame critique of shared draft commit
e24c50fc2d8a332fee6c48dd8a0bb4ef78b1233a. The author has since tightened
the matched controls; those changes are not approved by this initial verdict.
