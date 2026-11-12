---
status: DONE
dependencies: [059-19, 059-20, adr-0043]
last_verified: 2026-11-05
kind: feature
frame_review: true
arch_review: false
---

## Slice 059-21 - Connect a local gtag queue to the conversion chamber

**Goal:** A developer keeps the standard `gtag()` queue stub and sends queued
and subsequent local conversions through the real first-party worker without
calling `drainDataLayer()` after each command.

The owner authorized completing the local implementation plan on 2026-11-05.
The recovered setup and native evidence remain inputs to 059-01. This slice
delivers the missing automatic queue-entry seam for local construction, not
the complete conversion cutover. It consumes 059-01's command-to-worker path
without changing that slice's readiness or acceptance criteria.

**DoR:**
- [x] 059-19 and 059-20 provide the existing adapter and local worker path.
- [x] Accepted ADR-0047 retains one trusted first-party mapping worker.
- [x] The existing `drainDataLayer()` accepts standard JavaScript `arguments`
      entries but requires an explicit drain after later queue appends.
      Grounding: `test/google-ads-datalayer-experimental.test.js:28-59`.
- [x] Independent authoring review passes this bounded local-only frame.

**Acceptance Criteria:**

1. A separate source-only entry helper attaches the existing experimental
   adapter to one ordinary local `dataLayer` array. The unchanged standard
   stub, `function gtag() { dataLayer.push(arguments); }`, works before and
   after attachment. Prior entries are drained once, later pushes are captured
   synchronously in order, and mutable conversion parameters retain their
   capture-time values. Normal `push()` return values are preserved.
2. The helper uses the existing adapter's capture, mapping, queue, consent and
   transport logic. It neither maps vendor fields on main nor installs
   `window.gtag`, loads a native SDK, selects new experimental command modes,
   changes production boot/build/contracts, or accepts a vendor endpoint.
   Existing literal-loopback endpoint restrictions remain binding.
3. An actual Node worker and an independent literal-loopback HTTP receiver
   observe queued config and two distinct conversion commands from the
   standard stub. Config produces no request; each admitted conversion arrives
   once with its exact destination/label/value/currency/transaction/page
   relationships. The test does not substitute a fake mapper or worker.
4. Pending/denied conversions produce no arrivals and are not replayed after
   grant. Only a newly captured granted conversion sends. Malformed commands
   retain existing visible rejection outcomes; invalid queue shape, changed
   history, unsupported active queue hooks and queue overflow fail visibly.
   Failed attachment leaves no live worker or installed hook.
5. One queue has one attachment for its page lifetime. Duplicate or repeated
   attachment cannot replay the retained conversion history. Disposal restores
   only the helper's own push hook, does not overwrite a later owner's hook,
   and closes the adapter/worker. Cleanup failures are visible. No queue entry
   or unrelated global is erased.
6. Tests witness a failing entry-path regression before implementation and
   cover actual-worker positives, consent, invalid input, overflow, duplicate
   attachment, restoration, and cleanup. Targeted Google/shared tests and lint
   pass. Documentation supplies a complete local usage example and states
   that the caller must keep native tags absent.

**DoD:**
- [x] Entry helper and real-worker conversion controls pass.
- [x] Required compliance and craft reviews pass.
- [x] Reconciliation review and documentation are complete.
- [x] No vendor request, browser execution, deployment or account change occurs.
- [x] No native-wire, browser, performance, vendor-receipt or attribution claim is made.

**Anti-horizontal-phasing check:** The developer's existing queue stub reaches
the real local conversion receiver without manual per-command draining.

## Assumptions

None.

## Boundaries

The helper is opt-in and source-only. The ordinary array requirement is not
proof that a native runtime is absent; the caller owns that condition.
Google's complete response sequence, native consent-wait policy, production
boundary/C2/C3 readiness and all 059-01 criteria remain open. No new acquisition
runner, source-verifier worker, external resource or live authority is added.

### Deviation log

- The new helper composes the existing adapter. Attachment is asynchronous so
  rejection can await cleanup; queue capture itself stays synchronous. The
  lifetime identity guard prevents replay on duplicate attachment or reuse
  after disposal. Once construction begins, a failed attempt consumes that
  queue identity. Invalid preflight input does not reserve an identity.
- Compliance found two real gaps. Pending/denied commands could send if the
  host granted before worker readiness. Preflight rejection also left newly
  supplied workers live. Six actual cases failed before correction, then
  passed. The existing Google adapter now retains capture-time host consent
  separately from the unchanged worker event and still checks live consent at
  dispatch. This small shared correction also protects direct calls and
  explicit queue drains. It adds no vendor mapping or consent-wait policy.
- All rejection paths attempt cleanup of newly supplied chambers. A duplicate
  call borrowing the existing queue owner's chamber neither acquires nor
  closes it. Disposal preserves a later owner's hook and exposes failures.
- Craft passed with one test-assertion nit. The conditional disposal assertion
  was made unconditional; the dedicated real-worker early-rejection controls
  already passed. No blocker was deferred.
- The first entry test failed for the missing helper before implementation.
  Corrected Google/shared regressions pass 857 tests across 40 files. Repository
  lint and build pass. The documented example, run as an `.mjs` file at the
  repository root, observes one loopback arrival and closes its resources.
  An earlier stdin launch failed before verified receipt; the file-based
  launch is the validated example. Neither is browser or native evidence.
- The known default-suite capture/supervision failures from consolidation
  remain unresolved. The default suite was not rerun or relabelled green.

### Reconciliation sweep

- updated - source helper, direct/explicit-drain consent capture, actual-worker
  controls and complete local usage example. Queue bounds and owner cleanup
  remain explicit; production boot, core host and worker contract are unchanged.
- updated - architecture source catalog, current 059 plan/tasks, branch handoff,
  this slice's review evidence and derived board. Full 059-01 gates remain open.
- updated - memory learning records the capture-time versus dispatch-time
  consent gap so a future wrapper does not reintroduce it.
- no-op - existing native evidence, private configuration, accepted decisions,
  closed slice records, frozen contracts, Meta source, build/package/version,
  release qualification and deployment. No new architectural authority or
  rejected load-bearing design alternative was introduced.
- no-op - inbox review found no item closed by this local entry helper.
  Existing primers remain appropriate because the full spec stays in progress.
- no-op - coverage audit reports no uncovered or dangling use cases. Nine older
  untraced specs are advisory and unrelated to this change.
- no-op - leanness review retained one narrow helper and the shared consent fix.
  No new runner, verifier, browser controller, command mode or generic framework.

### Close-out (post-DONE)

The local entry step is complete after reconciliation. Full 059-01 remains
READY_FOR_REVIEW. The next product work is its complete-reference and
boundary/scenario/numerical readiness, then a separately scoped comparison.
This result grants no native acquisition or live deployment authority.
