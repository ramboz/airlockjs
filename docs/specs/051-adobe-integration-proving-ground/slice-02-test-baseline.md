---
status: DRAFT
dependencies: [051-01, adr-0031]
last_verified:
kind: feature
frame_review: true
---

## Slice 051-02 — reproducible test setup and stock baseline

**Goal:** An integrator can reproduce a synthetic Analytics/Target journey through pinned stock
`aem-martech` in approved test resources, including Adobe-native display reporting and outcome evidence.

**DoR:**
- [ ] 051-01's utility is complete and a recent real report verifies the required access/test scope.
- [ ] Owner approves the setup plan's org, product resources, domain, mutations and cleanup scope.
- [ ] Pin the reference commit, stock Alloy version/hash and relevant SDK configuration.
- [ ] Define product receipt/report observation methods, correlation and finite waiting windows.
- [ ] Verify supported setup APIs; prepare precise guided steps for any API-unavailable operations.

**Acceptance Criteria:**

1. **Plan before apply.** Setup supports an inspection/plan mode that performs no mutations and
   lists resource reuse/creation, side effects, required approvals, quota/cost concerns and local
   state location. Apply refuses a plan outside the explicitly approved org/test scope.
2. **Repeatable scoped resources.** Re-running the approved setup reuses the same owned fixtures
   rather than duplicating them. Existing resources are not overwritten on a name collision;
   ownership/configuration conflicts are reported. Store live resource IDs only in local state.
   API-unavailable steps are documented and confirmed, not silently skipped.
3. **Pinned stock Analytics journey.** A synthetic page-view and distinct custom event traverse
   the pinned stock integration to the designated Analytics test suite. Record their relevant
   payload/routing/identity and independently observed product outcomes within the documented
   window; a sent request or HTTP response alone does not satisfy this criterion.
4. **Pinned stock Target journey.** The declared test activity returns the expected HTML offer;
   the intended placement displays it, and a native Adobe display notification referencing that
   proposition is observed in the agreed product diagnostic/report surface. Record correlation,
   actual display count and any retries/duplicates; do not assert exactly-once semantics without evidence.
5. **Negative controls.** The baseline's defined no-consent/no-offer/non-rendered cases show the
   corresponding absence or vendor-specified alternative behavior. A display notification is not
   reported for an offer that was never rendered. Controls make the receipt assertions non-vacuous.
6. **Separate product isolation.** The resource manifest verifies Analytics suite and Target
   environment/workspace/property isolation independently of AEP sandbox selection. Test activity
   activation/publication runs only within the approved test targeting; no production publication.
7. **Safe local evidence and cleanup.** Raw captures/identifiers remain local; committed fixtures
   and R-012 evidence are synthetic/redacted. Cleanup has a dry-run list of exact owned resources
   and requires explicit approval; unrelated/shared resources and sandbox resets are excluded.
8. **Measured baseline.** Collect initial performance observations under recorded browser/device/
   throttling/content conditions, preserving eager-network/rendering and main-thread cost.
   These observations establish noise and candidate budgets, not a claim that Airlock improved them.

**DoD:**
- [ ] Setup plan/apply/reuse/refusal and redaction behavior have hermetic tests with witnessed failures.
- [ ] Stock Analytics/Target positive and negative live evidence is recorded using the approved methods.
- [ ] Product latency/visibility blockers leave baseline acceptance incomplete; no stub passes as live evidence.
- [ ] Compliance/craft and reconciliation evidence recorded; deviation log and sweep completed.
- [ ] Operator instructions and R-012 contain a reproducible scenario and explicit remaining constraints.

**Anti-horizontal-phasing check:** This slice delivers a usable stock reference installation and
observed product journey, not merely schemas/datastreams that might enable a future test.

## Assumptions

- The authorized organization can provide a test suite, a scoped Target activity and an observable
  reporting/diagnostic route. Available licensing alone does not establish these prerequisites.
- The pinned stock integration can produce the chosen synthetic journey on the test domain.
  API support and publication constraints must be verified before applying the resource plan.

### Deviation log (after reconciliation)

Not implemented; no resources or stock outcomes have been observed by this draft.

### Reconciliation sweep

Pending implementation: update R-012, setup/probe instructions, local-state/redaction contract,
release handoff, status board and any approved architecture/decision changes.

### Close-out (post-DONE)

- [ ] Regenerate the status board and identify the exact stock baseline available to 051-03.
- [ ] Preserve unresolved product/API limits and targeted cleanup ownership.
