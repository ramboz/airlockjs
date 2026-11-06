---
status: READY_FOR_REVIEW
dependencies: [adr-0017, adr-0033, adr-0043, 058-01, 058-02, 058-03, 058-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: google-ads-chamber
---

## Slice 059-01 - Owned direct conversion cutover

**Goal:** An adopter replaces one owned direct website-conversion path with actual
chamber execution and receives an honest complete-sequence result, without native
Ads fallback or an overstated product claim.

**DoR:**
- [x] ADR-0033 is Accepted after its real frame review.
- [ ] This slice frame and bounded transport/response design pass required
      review without silently changing ADR-0017.
- [x] [ADR-0043](../../decisions/adr-0043-google-meta-request-authority.md)
      has the research-backed recommendation, required reviews and owner
      acceptance recorded on 2026-11-02. Production fit remains a separate gate.
- [ ] 058-01 qualifies the exact recorder/guard surface; shared 058-02 controls
      and Google-specific 058-04 supply a positive pinned attempted reference;
      058-03 detects missing branches, input-value mutations and empty/partial
      references. Complete native response/dispatch evidence is separately
      required below; a pre-response attempt cannot supply it.
- [ ] B2/B3 are resolved for this case: native secondary outcome, body/redirect
      evidence, branch closure, runtime/module bytes and effective settings.
      The existing partial smoke is not sufficient.
- [ ] Parent supplies `OWNED-RESOURCES` destination/label/Secondary metadata,
      the explicitly scheduled isolated owned surface, initial state, consent
      transcript, qualified native artifact and finite actual-dispatch grant.
- [ ] C2 conditions and C3 numerical budgets are evidence-pinned before
      implementation; parent source investigation establishes integration
      feasibility. A further implementation grant exists.

**Acceptance Criteria:**

1. **Adopter path.** An operator supplies private handles and one owned page-load
   or click-triggered direct conversion. The replacement initializes without any
   native Ads executable, preserves the site's intended action, and makes no
   account, billing, campaign or unrelated tag change.
2. **Actual worker.** Evidence traces initialization and the conversion through
   serialized airlock messages to the real isolated chamber and governed host
   dispatch. A main-thread mapper, generated payload or simulated worker cannot
   satisfy this criterion; denied grants and chamber failure are visible.
3. **Value and route.** The labeled conversion preserves destination/label,
   exact controlled value/currency and transaction-ID relationships, including
   native omission/empty/zero distinctions in this case's reference. No hardcoded
   transaction, invented default or equal-sentinel normalization can pass.
4. **Whole chain.** C1 accounts for initial page/config requests, the primary
   conversion, returned fetch/fallback references and every actually applicable
   response/redirect/cookie/auxiliary branch. Private marker-loss dependencies
   remain subject to reviewed authority; broad host allowances are forbidden.
   A reference-only URL is distinguished from an executed branch.
5. **Real HTTP boundary.** Under the separate finite grant, native/chamber
   browser dispatch and response/cookie behavior are observed for the complete
   case. Interception-only evidence, absent secondary response or unreadable
   required body yields `inconclusive`, not a complete conversion qualification.
6. **Callbacks and page safety.** The case's native callback and navigation
   behavior is preserved through bounded host correlation, with count/arguments/
   ordering recorded. No arbitrary callback code executes in the chamber;
   callback/HTTP success never masquerades as accepted conversion or attribution.
7. **Falsifiable result.** Removing the worker, dropping a response branch,
   altering label/value/currency/order, duplicating a request or substituting an
   empty native reference prevents qualification. Invalid input is visible
   before execution, without leaking private values.
8. **Scoped operator receipt.** Output separates worker execution, attempt,
   actual dispatch, product receipt, matching, reporting and attribution.
   Missing product evidence remains explicitly blocked for full adoption;
   this slice is never advertised as full F05 or full Ads replacement.
   The complete path meets C3 and the stable boot/push/handle contracts.

**DoD:**
- [ ] Each criterion has retained positive and witnessed failing controls;
      targeted existing/new tests and applicable lint pass.
- [ ] Required compliance, craft, architecture and reconciliation reviews pass.
- [ ] Private complete evidence and sanitized operator procedure are retained;
      no value, cookie, private path or credential enters committed output.
- [ ] Honest deviation/reconciliation records preserve original criteria and
      carry remaining product/matrix obligations to 059-12, without waiving them.

**Anti-horizontal-phasing check:** The adopter gets a complete conversion-entry
to worker to governed response-chain journey and a usable scoped decision.

## Owner-directed construction - 2026-10-29

The owner approved building the Google and Meta replacements from the available
reference evidence before complete native-response captures are available.
This permits experimental construction only: unsupported behavior stays
visible, production cutover remains blocked, and the DoR, acceptance criteria
and full-parity evidence above are not marked complete. This direction does not
authorize a browser run, vendor request or changes to the accepted core boundary.
The experimental `experimentalRouting` mode now supports a matching local
destination and action label through the first-party worker and loopback
receiver. This is not a native routing or full-conversion qualification.

Synthetic fake-worker controls demonstrated that the default and
remarketing-enabled local paths can pass substituted conversion labels, values
or transaction IDs, added fields and duplicate labels to a mock transport with
a plausible settled result. No network request was made. These tests
characterize an open host-correlation gap, not protections or native behavior;
the real boundary and criteria above remain unfulfilled.

## Readiness checkpoint - 2026-10-16

### Local response-chain construction - 2026-11-06

The owner directed implementation of the bounded
[worker response-chain packet](plan.md#local-worker-response-chain-packet---2026-11-06).
It extends experimental construction from the existing Node worker/loopback
primary to captured message parsing and fixed local POST/redirect stages.
This is no-send construction, not a new product owner or readiness transition.
The original criteria and native/browser/performance/receipt requirements
remain open. The spent original Google stock and missing manual response
evidence remain unchanged. No browser or vendor request is authorized.

**Current navigation:** this dated checkpoint and the criteria above are
preserved. Completed059-19 is offline construction, and the next authoring
step059-20 is local-browser construction; neither closes this slice's DoR.
Use the [delivery queue](../../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
for prerequisites and existing feature/decision owners, not another full-conversion
spec. A required first-case behavior cannot be excused as later-feature work.

**READY_FOR_REVIEW (authoring) / blocked before implementation**, not rejected
as infeasible. The actual blocked-draft frame pass certifies its premise only.
The [source-backed first-path plan](plan.md#first-journey-readiness-checkpoint---2026-10-16)
records the actual integrated code and validation. A genuine built worker
mapped the existing page-load event but returned zero requests for a direct
conversion; no `gtag` facade was installed. The public entry remains the frozen
`push({ event, ...params })` shape. New facade/command state, full collector
sequence, governed response/credential/transport behavior and an independent
chamber capture adapter are work, not hidden capabilities of the shipped subset.

Complete native wire and measured C3 acceptance remain absent. The plan's
paired four-case envelope is **approval-required**, with separate guard review
and qualification before any live admission. The standing Adobe source-push
hold is honored; no shared-site deployment or account mutation is proposed.
No new product implementation or Servo approval is claimed by this checkpoint.

## Resumption note - 2026-10-19

The owner explicitly approved the bounded four-case envelope. All cases remain
unspent, and local 059-13/14 controls do not close the fresh setup, exact live
policy, complete native wire or measured C2/C3 prerequisites. The historical
2026-10-16 checkpoint above is preserved; this product slice is still authoring
review, not implementation-ready.

## Assumptions

- Unverified: a complete native reference and authorized corresponding browser
  response branches can be obtained; the retained smoke demonstrably lacks them.
- Unverified: the needed dispatch/response mediation fits the inspected stable
  core and pinned performance budget without ambient authority.

### Close-out (post-DONE)

- [ ] Parent regenerates/checks the board and reconciles affected live prose
      after actual DONE; no release or full-support claim follows automatically.

### Deviation log (after reconciliation)

The full product path is not implemented. The owner-directed 2026-11-06
experimental worker-chain construction is implemented separately. Its
[bounded deviation log](plan.md#bounded-worker-chain-deviation-log)
records the browser-safe parser reuse and actual review corrections.
Full compliance remains needs-changes; no native/product DoR is cleared.

### Reconciliation sweep

Full product reconciliation remains pending. The bounded construction
[sweep](plan.md#bounded-worker-chain-reconciliation-sweep) updates only
experimental Google sources and related documentation. Core/contracts,
Meta, Accepted decisions, native policy, original authority and lifecycle
remain unchanged. Parent covering verification passed 1171 tests; local
Node/loopback evidence is not browser or complete conversion qualification.
