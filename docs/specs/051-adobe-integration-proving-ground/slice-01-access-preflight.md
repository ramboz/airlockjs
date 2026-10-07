---
status: DRAFT
dependencies: [adr-0031]
last_verified:
kind: feature
frame_review: true
---

## Slice 051-01 — read-only access preflight

**Goal:** An integrator can run a safe preflight and see exactly which permissions/resources
allow an isolated Analytics/Target baseline and which actions an administrator still needs to take.

**DoR:**
- [ ] Approved non-secret input contract for target org, test-resource selectors and credential source.
- [ ] Current official API/auth references checked for every operation the preflight will use.
- [ ] Hermetic success, denied, missing-resource, timeout and malformed-response fixtures prepared.
- [ ] Live discovery runs only after the owner supplies approved local credentials and read-only scope.

**Acceptance Criteria:**

1. **Useful report.** The CLI produces a redacted machine-readable report and a concise operator
   summary. Each required Analytics/Target/Data Collection permission or resource has a stable
   check name, `ready`, `blocked` or `unverified` state, reason category and next action.
   A versioned report shape and documented invocation are delivered with the tool.
2. **Honest exit status.** Exit 0 means every required baseline check was verified ready.
   Any blocked/unverified required check produces a nonzero exit. Invalid configuration,
   denied access, absent resource and unreachable service are distinguishable in the report;
   transport failures are not mislabeled as confirmed lack of entitlement.
3. **Read-only boundary.** Discovery executes only the explicitly documented read/list operations.
   Tests assert no create/update/delete, activity activation, publication, paid provisioning or
   production/default-resource mutation is attempted. A selected resource must match the approved
   org and product-specific test scope; an AEP sandbox alone never makes Target/Analytics safe.
4. **Secret-safe operation.** Credentials are read from the approved local source, not command-line
   literals or browser configuration. Tokens, authorization headers, raw identities and live
   identifiers are absent from emitted logs and durable reports; synthetic sentinel tests verify
   redaction on success and error paths.
5. **Actionable unknowns.** Unsupported/unverified admin API capabilities identify the exact
   documentation or guided UI/admin step still needed. The tool never probes an undocumented
   internal endpoint merely to avoid a manual step, nor switches org/resource silently.
6. **Deterministic and bounded discovery.** Repeated unchanged fixture input produces the same
   check states/next actions. Pagination and network waits have configured, documented finite
   limits; partial enumeration is `unverified`, not an exhaustive ready result.
7. **Grounded live status.** R-012 records the redacted real preflight result if access is available,
   or explicitly records that only the utility/fixture behavior is proven. Missing credentials
   can block baseline execution without being reported as product access successfully verified.

**DoD:**
- [ ] ACs are exercised through the operator CLI with hermetic fixtures and named error cases.
- [ ] Redaction, mutation refusal and partial-enumeration tests witnessed red-to-green.
- [ ] Required compliance/craft review evidence recorded; no status advance from documentation alone.
- [ ] Deviation log/reconciliation sweep and reconciliation review completed.
- [ ] R-012 and operator instructions distinguish real access from fixture-only results.

**Anti-horizontal-phasing check:** The preflight is independently useful: an operator gets an
actionable readiness/access report even if no test resources can yet be created.

## Assumptions

- The organization's enabled APIs/product profiles expose enough read-only information to verify
  the required test scope. If not, report `unverified` and name the required admin confirmation.
- A stable redacted resource selector can distinguish the approved test scope. The implementation
  must establish that selector instead of trusting a friendly resource name.

### Deviation log (after reconciliation)

Not implemented; no deviations or successful API observations are claimed.

### Reconciliation sweep

Pending implementation: check R-012, operator probe docs, release handoff, status board and memory.
No reconciliation verdict is recorded at DRAFT.

### Close-out (post-DONE)

- [ ] Regenerate the status board through Jig and retain the live-access caveat in its notes.
- [ ] Record any unresolved permission/API limitation without making 051-02 ready.
