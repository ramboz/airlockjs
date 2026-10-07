# Tasks: Adobe integration proving ground

> All work is pending. Only spec 051 is sliced; specs 052-057 remain outlines.

## 051-01 — read-only access preflight

- [ ] Confirm local credential handoff and the approved read-only org/test-resource scope.
- [ ] Verify current supported API/auth operations and define the redacted input/report contract.
- [ ] Write failing CLI tests for ready, blocked/unverified, invalid input, denied/missing resource,
      timeout, pagination limits, mutation refusal and secret redaction.
- [ ] Implement the bounded preflight utility and operator instructions.
- [ ] Record a real redacted result or explicitly blocked live status in R-012.
- [ ] Complete required reviews and reconciliation through Jig; do not infer baseline readiness.

## 051-02 — reproducible test setup and stock baseline

- [ ] Require a recent ready preflight and owner-approved product-specific resource/mutation plan.
- [ ] Pin reference commit, SDK version/hash, test deployment and configuration.
- [ ] Confirm receipt/report correlation and waiting windows before writing assertions.
- [ ] Write failing plan/apply/reuse/ownership-conflict/redaction/refusal tests.
- [ ] Implement supported setup APIs and precise guided steps where supported APIs are unavailable.
- [ ] Execute stock Analytics page/custom and Target HTML/display journeys with negative controls.
- [ ] Record redacted resource ownership, evidence and baseline measurements in R-012.
- [ ] Complete required reviews/reconciliation; leave unobserved product outcomes unfinished.

## 051-03 — bounded SDK compatibility decision

- [ ] Obtain owner approval for the proposed 8-hour active-time budget and representative probes.
- [ ] Enumerate/document the pinned public SDK and reference integration inventory.
- [ ] Probe callback/page-state, DOM and identity/consent/lifetime boundaries using the approved baseline.
- [ ] Attempt the complete chamber Analytics/Target/display journey without production fallback.
- [ ] Record established/divergent/incompatible/blocked results and measurement noise.
- [ ] Propose numeric build/release constraints and assign inventory rows to 052-057 or explicit decisions.
- [ ] Record proceed/reshape/stop and the required Outcome; request scope/ADR approval when necessary.
- [ ] Complete required reviews/reconciliation and audit dependent drafts before any readiness change.
