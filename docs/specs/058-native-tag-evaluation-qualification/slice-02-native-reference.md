---
status: DRAFT
dependencies: [058-01]
last_verified:
frame_review: true
arch_review: true
---

## Slice 058-02 - Pinned native attempted-request reference

**Goal:** An operator can acquire a complete, provenance-qualified native
attempted-request reference without external dispatch, or receive an explicit
inconclusive result instead of an empty baseline.

**DoR:**
- [ ] 058-01 qualifies the actual transport/guard/recorder surface.
- [ ] The private runtime/configuration snapshot and scenario grant are supplied
      explicitly; absence never triggers download, discovery or a live resend.
- [ ] Native/runtime/browser differences and account prerequisites are identified.

**Acceptance Criteria:**

1. The command records native runtime/configuration hashes, dependency closure,
   browser conditions, scenario inputs, consent and the finite observation window.
   A body/schema placeholder cannot impersonate official-runtime execution.
2. Locally fulfilled resources execute the pinned native tag. The recorder retains
   every in-scope attempted request, including ordering, duplicate query fields,
   original bodies, relevant headers and response/ownership relationships.
   Dispatch, cookie acceptance and redirects not actually executed remain unproved.
3. Missing resources, an empty expected-positive PageView/conversion, asynchronous
   capture failure or unexplained branch produces `inconclusive`, never exit 0.
   The known Meta no-beacon case is an explicit failing reference fixture, not
   a successful empty expected set.
4. Disabled and consent-negative scenarios report absence only when tied to
   their qualified positive reference. No URL flag, simulated callback or
   user-reported receipt substitutes for the positive native attempt.
5. Changing an input amount/identity/consent/destination must have a discriminable
   observed effect where the pinned native contract requires one; otherwise the
   scenario remains blocked rather than accepted on mere field presence.
6. No real vendor event, customer traffic or network fallback occurs. An actual
   owned-backend experiment requires a separate finite grant outside this phase.

**DoD:**
- [ ] Targeted tests and independent required reviews pass.
- [ ] Positive and falsifiable negative controls are retained separately.
- [ ] Unresolved native behavior is carried to the vendor spec and readiness gate.

**Anti-horizontal-phasing check:** The operator acquires a named trustworthy
reference or an actionable blocked result through one end-to-end command.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; record evidence limits and durable learnings.

### Deviation log (after reconciliation)

Not implemented.

### Reconciliation sweep

Pending implementation.
