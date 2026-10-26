---
status: READY_FOR_REVIEW
dependencies: [059-19]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 059-20 - Exercise the SDK-free conversion in a local browser

**Goal:** A developer invokes queued synthetic `gtag` conversions on one local
browser page and independently receives their exact values through a real
module worker and governed host. This is not a qualified Google conversion.

**DoR:**
- [x] 059-19 supplies the source-only adapter, worker and truthful gap report.
- [x] The bounded browser-journey frame passes independent critique.
- [ ] The concrete same-origin asset/local-primary implementation and test
      plan are reviewed before implementation is admitted.
- [ ] A finite plan binds current browser/version/source/profile and an actual
      launch/stop owner. Use a qualified execution path or separately explicit
      owner-supervised plan covering interruption/cleanup; no inferred native
      exception, replayed container authority or borrowed source lease.
- [ ] Fix all case/send/byte/deadline limits before acquisition; the interval
      includes cleanup and publication. Prove declared no-external-send controls
      before navigation. Missing ownership or visibility means no launch.

**Acceptance Criteria:**

1. One first-party127.0.0.1 page imports the actual experimental adapter and
   same-origin conversion module worker. Queued config and two synthetic
   conversions with different value/currency/transaction/page snapshots cross
   real browser structured clone and unchanged connector/wrapped hosts to the
   exact literal local primary route. No direct mapper or Node bridge counts.
2. Independent receiver evidence preserves destination path/label, numeric
   value, currency, transaction and page relationships for both conversions,
   including zero/empty/omitted controls. Config emits zero; denied/pending/
   grant-without-new-command each have zero arrivals. Prototype config and
   consent rules are not native Google behavior.
3. Before navigation, permit only fixed local assets and primary receiver.
   Local receiving positives/enforced negatives/bypasses cover actual declared
   transports. No external request, Google runtime/config, remote import,
   vendor endpoint, owned account event, callback execution or response-linked
   follow-up is allowed. Returned script/URL data stays inert. Surface gaps
   that prevent proving this rather than trusting logical interception counts.
4. Record actual browser worker execution/native-runtime absence, request and
   response observations, independent arrivals and correlated command results.
   A withheld response demonstrates the barrier; malformed/late/duplicate
   responses, loss of worker/receiver and overflow reject visibly. A blocked
   request, source-only facade or HTTP200 alone cannot establish receipt.
5. Preserve the complete059-19 gap report:12 historical shape rows/62 names,
   primary39 pairs with only5 local mappings, response-linked missing branch,
   and unavailable native values/SDK/browser/cookie/CWV/outcome evidence.
   Browser-local execution does not upgrade native equality or attribution.
6. Observe all owned browser/profile/worker/server/socket dispositions and
   final external command completion within the declared original interval.
   Interruption/lost handles leave an exact UNKNOWN handoff, not clean success,
   guessed cleanup, a new clock or automatic rerun.
7. Reuse the existing Google prototype without production/core/frozen/build
   changes, and regress the Meta path. A reusable local test fixture may be
   shared only for demonstrated common behavior; do not add a general runner,
   arbitrary URL proxy or optional container framework. Any missing prerequisite
   is a named blocker, not permission to expand the slice.059-01/C1-C9 remain open.

**DoD:**
- [ ] Actual browser conversion-to-local-receiver positives and failed controls.
- [ ] Final owned cleanup/external completion; unresolved ownership blocks DONE.
- [ ] Targeted Google/Meta/host/contract regressions and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation pass.
- [ ] Usage, browser/cohort/evidence limits and delivery queue reconciled.

**Anti-horizontal-phasing check:** One executable local browser conversion
journey with values and report, not another acquisition helper.

## Grounding

- `adapters/google-ads-prototype.js` contains fixed browser-worker plumbing;
  059-19 proves only its first-party Node execution/loopback path.
- `connectors/google-ads/conversion-prototype.worker.js` retains config and
  awaits correlated mediated responses; existing native policy fields are
  not a complete response-chain implementation.

## Assumptions

- Unverified: the exact module/CSP/origin/browser arrangement supports the
  local path without a frozen-interface change.
- Unverified: a current execution/stop plan is available; parent must establish
  it separately instead of admitting general supervision work here.

### Deviation log

Not implemented. The original complete-conversion slice059-01 is unchanged.

### Reconciliation sweep

Pending implementation: local browser instructions/evidence, native gap
boundaries, unchanged Meta/core/production behavior and owned cleanup.
