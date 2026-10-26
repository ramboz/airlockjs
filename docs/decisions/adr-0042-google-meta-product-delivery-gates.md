---
status: Proposed
dependencies: [adr-0017, adr-0033]
last_verified:
frame_review: true
---

# ADR-0042: Google and Meta product-first delivery gates

Build one observable advertising journey at a time, while keeping full
replacement as the final bar. Give prerequisite work a named consumer,
bounded budget and stop condition instead of letting it become the product.
The tradeoff is visible incomplete support during construction, never
relaxed acceptance or unsafe execution.

## Status

Proposed (2026-10-26)

Owner requested this planning packet; acceptance of this recommendation is
still pending. Number0042 is locally coordinated with the Adobe lane's0041,
not reserved on origin. The Jig scaffold's local0039 was renumbered before
any commit to avoid other-lane provisional numbers. No Accepted ADR is amended.

## Context

Google and Meta need product milestones that cannot be replaced by infrastructure progress.

[ADR-0033](adr-0033-reframe-onto-full-google-meta-compatibility.md) already
requires complete browser-tag replacement. Existing specs059 and060 own
twelve full-compatibility journeys per vendor; they are not missing a
feature backlog. Their first journeys remain unqualified. Two separately
labelled product increments now execute locally:
[060-13](../specs/060-meta-pixel-full-compatibility/slice-13-offline-pageview-prototype.md)
and [059-19](../specs/059-google-ads-full-compatibility/slice-19-offline-conversion-prototype.md).
Their worker/receiver evidence does not qualify browser, identity, native
response sequences, CWV or attribution.

The failed single local container control and its separately completed
cleanup are recorded in059-18. They did not start the guest program or
establish an independent browser holder. Adding more successful helper
tests would not itself deliver Google/Meta behavior.

The owner on2026-10-26 requested proper remaining specs/ADRs to prevent drift.
This decision concerns the work-admission boundary between vendor delivery
and reusable qualification tools, not a new runtime API or execution exception.
The [delivery queue](../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
names concrete outputs and existing owners.

## Decision Options Considered

### Option A: Finish a general unattended runner before further product work

- **Pros:** Reusable execution and interruption handling could benefit vendors.
- **Cons:** Unbounded prerequisite growth; helper completion can masquerade as
  product progress, even when a full browser reference remains unavailable.
  Not recommended as the default work queue.

### Option B: Add fields and features using synthetic or partial captures alone

- **Pros:** Fast visible output and larger apparent coverage.
- **Cons:** Encourages guessed cookies/encodings/response branches and weak
  comparison oracles. Cannot meet ADR-0033. Rejected.

### Option C: Bounded product journeys with separate evidence gates

- **Pros:** Runnable behavior, explicit missing evidence, reusable existing
  hosts and clear decisions when a real boundary is insufficient.
- **Cons:** Incomplete support remains visible; some work must wait for a
  reference, qualified execution path or explicit owner action. Recommended.

## Recommended Decision

Adopt Option C, without superseding ADR-0017 or ADR-0033.

1. **One owner for each missing behavior.** Reuse059/060's existing feature
   slices and058/059-15/18 evidence owners. Add a slice only for a new bounded
   end-to-end deliverable, not another outline of an already owned feature.
   The next drafts are060-14 local-browser PageView, then059-20 local-browser
   conversion. Their code can be prepared independently of live vendor access;
   actual execution still requires their explicit DoR.
2. **Construction and acceptance are different.** Source/unit, actual Node
   worker/local receipt, actual browser/local receipt, native attempt,
   native/chamber request-response/host-effect comparison and product outcomes
   are separately named evidence. Do not promote one into the next.
   Full059-01/060-01 and C1-C9 stay unchanged; prototype defaults and consent
   rules are not adopted as native semantics.
3. **Every prerequisite has a consumer and an exit.** Before more runner,
   browser-holder, oracle, transport or capability work, identify the exact
   product slice/criterion it unlocks, reuse searched, smallest deliverable,
   measurable success/failure and a finite preparation budget. Default proposal:
   stop after two active hours or one coherent result, whichever comes first.
   This is a checkpoint, not authorization, a reliable billing meter or a
   reason to abandon safe custody of an already issued operation. At the stop,
   report evidence/blocker and choose independent product work; do not silently
   renew or broaden the helper.
4. **One product slice actively implemented per vendor.** Independent source
   work may run in parallel; serialize shared site changes and measurement
   windows under current coordination. Count finished journeys and remaining
   criteria, not commits, agents, field counts or test totals as product progress.
5. **No invented authority or compatibility.** Browser acquisition needs a
   current permitted launch/stop/loss plan; if an owner-supervised exception is
   chosen, it needs its own specific decision and run approval. Another lane's
   ADR, the original image/control grants or this ADR cannot grant it.
   Production reference capture uses the operator's stricter zero-forwarded-
   measurement scope; actual vendor response/receipt validation belongs on
   separately approved owned test resources. Intercepted attempts cannot prove
   delivery. No automatic retry or refund of a spent case.
6. **Evidence-led decisions, not speculative APIs.** Cookie scopes/attributes,
   response transport/credentials/redirects and timing-critical host operations
   get separate narrowly scoped ADRs when the owning journey has evidence and
   alternatives. No general cookie jar, DOM/network proxy or core freeze bypass.
   Draft the decision before implementation; accepting it and authorizing a run
   remain separate actions.
7. **One queue and honest status.** Each plan points to the delivery queue,
   which maps outputs to canonical slices, entry gates and evidence. A new
   discovery gets an owner or a bounded blocker there before implementation.
   Draft/READY_FOR_REVIEW means authoring review, not execution readiness.

## Consequences

**Becomes easier:**
- See the next deliverable and why any supporting work is necessary.
- Continue local construction without asserting native equivalence or
  waiting on unrelated billing, account or general-runner investigations.
- Reject scope expansion explicitly while preserving the complete feature target.

**Becomes harder:**
- A seemingly reusable tool needs a concrete bounded consumer before admission.
- Live/reference gaps and owner decisions cannot be hidden behind green local
  tests. Missing behavior remains unfinished, not an accepted exclusion.
- Later slices must maintain the feature/cohort/field/branch ledger as discovery
  grows; a fixed initial inventory is not proof that it is exhaustive.

## Assumptions

- Grounded: the completed prototype records cite actual local executions,
  negative controls and their limitations. Their browser factories are source
  plumbing, not browser evidence; the next two draft slices make that gap explicit.
- Unverified: a current qualified or separately owner-supervised browser
  execution plan can be supplied. Its absence blocks those actual runs, not
  permission to implement a general runner implicitly.
- The two-active-hour preparation checkpoint is a proposed management limit,
  not an empirically sufficient implementation estimate or a measured CWV budget.

## Kill criteria

- A split milestone is advertised as a native-compatible product before its
  unchanged full acceptance criteria pass.
- Work cannot preserve required isolation/consent/performance under existing
  contracts: stop that path for an evidence-backed specific decision, not a
  silent privilege expansion or subset redefinition.
- The queue repeatedly admits supporting work without a concrete product
  consumer or stops reauthoring specs instead of producing the named result.

## Open questions

- Planning packet frame critique passed separately for this ADR and each next
  browser slice; a separate documentation-consistency review also passed.
  These reviews do not constitute owner acceptance or implementation approval.
- Owner acceptance of this sequencing/checkpoint recommendation.
- For the first actual browser run, which permitted execution/loss/stop plan
  is available? This ADR does not choose an operational exception.
- Cookie authority and response/credentialed-transport designs remain later
  evidence-triggered decisions under existing first-journey/feature owners.
