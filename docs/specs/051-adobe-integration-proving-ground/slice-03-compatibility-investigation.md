---
status: DRAFT
dependencies: [051-02, adr-0031]
last_verified:
kind: spike
frame_review: true
arch_review: true
---

## Slice 051-03 — bounded SDK compatibility decision

**Goal:** The release owner can decide which safe compatibility approach to build, from a complete
pinned surface inventory and representative stock-versus-chamber evidence rather than SDK boot alone.

**Question:** Can the assigned stock Alloy and `aem-martech` semantics, especially callbacks and
DOM/page-state behavior, be preserved through the chamber boundary without widening authority?

**Time-box:** Owner-approved on 2026-10-08: **8 active engineering hours**, excluding external
access/report waiting. The whole run must also remain **strictly below 10,000 credits**, including
refinement/reviews/execution as tracked by the parent. Stop before either ceiling with explicit
unknowns; any extension needs a new approval, not an unbounded probe loop. This grant does not
clear baseline, contract, experiment-review or performance-evidence readiness gates.

**Findings:** No new compatibility experiments executed. Starting source/documentation evidence
and current subset gaps are in [R-012](../../research/R-012-adobe-first-compatibility.md).

**Outcome:** Not determined at DRAFT. At completion record `ADR-NNNN created` if a new approach
decision is needed, `spec NNN-NN unblocked` only for an actually refined dependent slice, or
`abandoned (reason)` for an infeasible route. A reshape/stop result does not approve a narrower v1.0 gate.

**DoR:**
- [ ] Approved time-box, pinned SDK version/hash and stock reference commit.
- [ ] 051-02's reproducible baseline and live observation methods are available.
- [ ] The representative experiment set and any prototype permissions are reviewed.
- [ ] Numeric measurement conditions/limits for the experiment are defined before execution.
- [ ] Full production implementation and scope revision remain explicitly outside this slice.

The budget part of the first item is granted, but the compound item remains unchecked until its
pins/readiness are verified. Use 051-02's official Alloy 2.31.1 artifact consistently in both
arms, with the reference's trailing-LF difference disclosed. Offline comparison is not SDK proof.
Numeric performance acceptance bands still come from the measured stock evidence and owner
review; the execution grant supplies no invented threshold. AJO/CJA/RTCDP are deferred in this
run's experiments while their release inventory rows remain owned and visibly unverified.

**Acceptance Criteria:**

1. **Closed inventory boundary.** Enumerate the pinned version's documented public commands,
   relevant options/results/events/callbacks and `aem-martech` integration APIs. Cite the exact
   documentation/source set and why it closes this inventory; an empty grep is not completeness.
   Classify every row as worker-native, mediated, host-side, incompatible or unverified.
2. **Hard behavior probes.** Exercise representative SDK behaviors chosen for decision value:
   general event/results, callback or synchronous page-state dependence, one DOM-dependent
   proposition behavior, and an identity/consent/lifetime edge. Compare stock and chamber behavior
   or record a concrete incompatibility; proxy boot success is insufficient.
3. **One complete journey attempt.** Against 051-02's stock baseline, attempt synthetic Analytics
   page/custom receipt plus Target offer/rendering and Adobe-native display receipt through a
   bounded chamber/probe path. Classify each step as established, divergent, incompatible or blocked
   with evidence. A successful journey requires every required step's outcome; missing Adobe
   notifications cannot be replaced by a GA4 exposure.
4. **No hidden production implementation.** Any exploratory adapter glue stays under the approved
   probe scope; it is not a frozen/public SDK bridge. Main-thread unrestricted SDK fallback,
   silent endpoint widening, modified stock bundles or disabled controls are not permitted
   shortcuts. A necessary authority change becomes a decision request.
5. **Measured constraints.** Report equivalent stock/chamber observations including startup,
   structured-clone, decision-network and host rendering cost; document repetitions, dispersion/
   noise and lab-versus-field limits. Propose numeric implementation/release bands for owner review,
   not guessed or retroactively relaxed thresholds.
6. **Owned handoff.** Assign every release-relevant inventory row and product scenario to specs
   052-057 or a named unresolved decision with a concrete trigger. Record the recommended approach,
   alternatives, unsupported behavior, access blockers and next refinement order in R-012.
   No unowned requirement silently disappears from the full-support contract.
7. **Bounded conclusion.** Finish within the approved active-time budget with proceed/reshape/stop
   reasoning and the appropriate Outcome. Unverified behavior remains unverified; the spike may
   complete with negative findings, but cannot mark missing baseline work or full SDK support complete.

**DoD:**
- [ ] Every finding carries executed evidence or an explicit unverified classification.
- [ ] Probe assertions have negative controls; no fixture-only result is labeled live product proof.
- [ ] Frame, compliance, craft, architecture and reconciliation evidence required by the lifecycle
      is recorded before the corresponding transitions.
- [ ] R-012 contains the conclusion, limitations and proposed handoff; new decisions use ADRs.
- [ ] Deviation log/sweep includes any time-box change or refused authority expansion.

**Anti-horizontal-phasing check:** The deliverable is an actionable owner decision about the SDK
integration approach, not a research prelude to an unbounded monolithic implementation.

## Assumptions

- A useful set of discriminating experiments can fit the approved budget once the stock baseline
  exists. Stop/reshape with evidence if it cannot; no automatic extension or release-gate change.
- Callback/page-state/DOM fidelity can be preserved safely for the required surface.
  This is the contested assumption under investigation, not a commitment that the answer is yes.

### Deviation log (after reconciliation)

Not executed. No compatibility experiment time has been charged to the approved spike budget;
parent tracking must include this refinement/review work in the overall credit ceiling.

### Reconciliation sweep

Pending execution: R-012 findings/conclusion, release compatibility gate, inventory ownership across
052-057, approved ADRs, status board, primer and refinement ledger.

### Close-out (post-DONE)

- [ ] Audit dependent drafts if the route is abandoned or needs reshaping; no automatic readiness.
- [ ] Update research status only when its overall question is settled, preserving still-open setup/
      product/full-compatibility questions.
- [ ] Regenerate the board and carry the resulting decision/evidence pointer rather than a full-support claim.
