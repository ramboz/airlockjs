---
slice: 049-02 — direct-beacon-transport suppression (egress-parity completeness)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T20:59:48Z
prompt_source: review.py implementation (re-review after AC4 fix)
---

Compliance re-review (jig:reviewer, opus) after the AC4 coverage-gap fix. **VERDICT: pass.**

All four ACs met with non-vacuous tests. AC1/AC3 proven in the real-browser rig via network-presence controls (each
suppressed URL paired with a loading keep-URL; the collision asserts exactly-one network request). AC2's keepalive
exemption is mutation-verified in the pure vitest predicate (removing the carve-out flips MATCHING_URL+fetch+keepalive
from exempt to suppressed → red) and end-to-end in the rig. AC4 uninstall/idempotency is proven by `===` identity
comparisons against natives captured before the first install — the rig honestly labels its behavioral
"still-reaches-network" assertions as non-discriminating and relies on the identity checks, exactly the discrimination
the vacuous-test check demands.

Grounding (core/egress.js fetchInit → keepalive:true for GET+POST; grep confirms no main-thread Image/sendBeacon/XHR
in airlock's own egress), ADR-0030's delegation of the beacon-transport set to spec level, residual tracking
(refinement-todo A-residuals), CI gating (rig:tag-suppressor a non-continue-on-error step), and vendor-neutrality (grep
guard) all hold.

**Non-blocking finding (low severity, logged to refinement-todo):** the suppressed `XMLHttpRequest.send`
(tag-suppressor.js:670-682) returns without firing a completion event, unlike sendBeacon (returns true) / fetch
(resolves 204), which simulate success so the caller is not nudged to a fallback transport — container code chained on
`xhr.onload`/`onloadend` would stall. XHR is defensive / not in the reference idiom; fails safe; all four transports
suppressed anyway. Recorded as a consistency residual, not a correctness blocker.

Supersedes the prior compliance verdict (needs-changes on the AC4 coverage gap), now closed by the rig's
identity-assertion phase + the re-scoped no-DOM unit test.
