---
status: READY_FOR_IMPLEMENTATION
dependencies: [059-13, 059-14, adr-0035]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-18 - Additional lineage-bound Meta stock case

**Goal:** The operator can use the owner's newly authorized additional Meta
stock case without refunding the original spent case or granting arbitrary
retries. The same confined inspected engine either produces complete originals
or preserves a visibly spent/inconclusive result. Routine preparation and
scheduling are autonomous within that one additional case, not repeated owner
questions or an unlimited test budget.

This is a separate authority path under [ADR-0035](../../decisions/adr-0035-additional-one-shot-meta-authority.md),
not an amendment of the original four-case record, ADR-0034 or closed slices.
It serves UC-10 and leaves full native/chamber/product/C2/C3 gates unchanged.

**DoR:**
- [x] Genuine owner authorization at 2026-10-21T18:33:04.581Z explicitly
      answers the request for one additional bounded Meta stock case.
      The exact question/answer is durably private, not synthesized approval.
- [x] Original authority and actual consumed Meta reservation were rechecked
      by SHA/device/inode without modification. Actual original stock outcome
      remains spent/inconclusive; zero forwarded HTTP is not a refund.
- [x] Shared engine/journal/physical guard exist and have prior exact-source
      SDK-absent qualification. New code invalidates their old source leases.
- [x] Current Adobe status reports no conflict with code/SDK-absent local
      qualification, not a live hold, current quiescence or resource exclusion.
- [x] Paired ADR/slice frame review passed and ADR-0035 is Accepted.

**Acceptance Criteria:**

1. **Closed additional scope.** Accept only the fixed additional Meta grant
   for this genuine decision, with one init/PageView, native-default consent
   and all existing eight-request/64-observation/byte/60-second limits.
   Its authority is Meta-only; original/synthetic authority paths retain their
   existing behavior. Reject arbitrary IDs, extra keys/cases, copied original
   records, enlarged budgets, consent override and future/repeated grants.
   No general authority registry, arbitrary program or override flag.
2. **Immutable original lineage.** Bind the original authority and actual
   spent Meta reservation with canonical private handles/hash/device/inode,
   verify their closed content and exact authority/case relationships, and
   keep them snapshotted through admission, reservation, source continuation
   and cleanup/publication. Missing, unspent, malformed, unrelated, replaced
   or changed lineage fails closed. Never write/reset/delete/refund the
   original authority or slot, and do not borrow a chamber/Google slot.
3. **Additional canonical consumption.** Bind the additional authority's own
   path/hash/device/inode and fixed canonical slot to the exact source/input/
   inspection/window case. Reserve durably before any SDK execution; concurrent
   attempts have one winner. Failure, interruption or zero HTTP is spent.
   Changed output, copied permission, another namespace or repeated preparation
   cannot renew it. Direct journal/engine callers cannot widen this scope.
4. **Honest permission and delegation.** Bind the new owner-decision evidence
   and a separate additional inspected permission, explicitly distinguishing
   the prior original slot already spent from the new slot not yet consumed.
   Preserve all prior transport/privacy exceptions and strict upstream TLS.
   Record operator-selected finite timing under owner delegation, not an
   invented exact owner-chosen timestamp. Pre-admission rescheduling requires
   fresh bindings/receipts and actual coordination; no silent hold extension,
   expired evidence reuse or rescheduling after consumption.
5. **Reuse without native bypass.** Use the existing prepared-plan/private
   lease, confined browser, shared physical semantic/count/response guard,
   retained source-pair selection and complete-capture/cleanup/publication
   path. Existing stock CLI stays disabled. Source, setup, original-location,
   independent frame/compliance/craft/architecture/reconciliation and actual
   nonoverlap/resource gates remain required. A new grant does not fabricate
   settings readback, SDK consumption, socket closure or vendor acceptance.
6. **Qualify the new path itself.** Witness TDD for new journal/engine cases,
   including refreshed-hash semantic lineage controls, candidate/Google
   refusal, concurrent one-winner reservation, mutation before/after prepare/
   reservation, changed copied location, spent additional slot and receipt/
   source mismatches. Actual SDK-absent local H1/H2 positives must traverse the
   additional lineage/reservation path; local fixture evidence alone can never
   supply a native lease. Bind their source/original/actual-exit/closure proof
   to the new native gate. The existing fourteen-controller/eleven-relay
   coverage is refreshed, not silently relabelled as coverage it lacks.
   Removing an actual additional-authority guard must defeat its regression.
7. **Preserve surfaces and evidence.** Keep complete producer/source/test/
   driver/dependency closure, original HTTP bytes and public/private
   separation. Tests, new source helpers and qualification readers must cover
   every added dependency. Invalid data and failed IO stop explicitly; no
   wildcard, success-shaped fallback, fabricated reference or returned
   expected payload. Historical failures/indices remain intact.
8. **Bounded actual operator result.** After actual required reviews and
   current-source qualification, the parent may prepare one finite additional
   case under the delegated timing scope, separately coordinate before live
   effects, and execute only if all actual gates pass. Preserve actual exit,
   original hashes, complete resource disposition and explicit cleanup/abort
   handoff. Missing readiness aborts before admission; a spent case is not
   retried. No source download/account/campaign/billing/site mutation,
   fabricated click, Google/chamber/production inspection or product/C2/C3/
   vendor outcome follows.

**DoD:**
- [ ] Witnessed red/green, mutation and genuine additional-path SDK-absent
      controls and full refreshed shared-guard originals pass.
- [ ] Required code/frame/architecture/checkpoint reconciliation passes clear.
- [ ] Operator guide/open plans/architecture distinguish original and new
      authority, autonomous finite timing and unresolved product evidence.
- [ ] Parent records actual additional result or concrete pre-admission
      blocker, without minting another grant or hiding consumed authority.

**Anti-horizontal-phasing check:** The operator gets a complete new-approval
to canonical-consumption to guarded stock result path, not a parser-only
authority feature or permission to skip native preparation.

## Assumptions

- Unverified: closed additional lineage checks and canonical reservation can
  preserve both the original spent record and a single new winner across file
  mutation/concurrency. SDK-absent actual-path controls must falsify this.
- Unverified: the pinned complete native chain fits the unchanged physical/
  byte envelope. Unknown behavior remains inconclusive; no budget is inferred.

### Deviation log (after reconciliation)

Not implemented. No additional authority file, slot, live window or SDK case
has been admitted by authoring this slice.

### Reconciliation sweep

Pending implementation, real qualification and independent checkpoint review.

### Close-out (post-DONE)

- [ ] Preserve original/additional spend history and complete native/
      replacement/consumer/equivalence/C2/C3/vendor residuals.
