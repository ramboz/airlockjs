---
status: Accepted
dependencies: [adr-0017, adr-0031]
last_verified: 2026-10-12
frame_review: true
---

# ADR-0032: Airlock boundary acceptance; Adobe reporting as follow-up

## Status

Accepted (2026-10-12)

## Context

Airlock acceptance belongs at the governed SDK boundary, not Adobe's asynchronous reporting pipeline.

At 2026-10-12T21:08:41.261Z the owner approved making downstream Adobe reporting
nonblocking for acceptance: "Yes, let's mark that more as a follow-upgoal. we established
the baseline reporting already, so the overall flow works. the rest can be handled later
when the need arises." This follows the explicit proposal to gate stock-versus-chamber
final-wire conformance, consent/egress enforcement and real response/rendering behavior.

[R-012](../research/R-012-adobe-first-compatibility.md) already records a pinned stock
journey, one ordinary Analytics page/custom receipt each, and two cumulative Target Scoped
display counts in owner-confirmed Development. These observations establish an initial
working reporting path, not complete product processing or per-run Target attribution.
The original fifteen-export, fourteen-hour sequence was an author-selected protocol in
open 051-02, not an Adobe requirement. Manual report availability became an unrelated
dependency on implementation behind the airlock.

This decision refines the **acceptance boundary** in ADR-0031's product-evidence requirements.
ADR-0031's Adobe-first direction, full pinned SDK inventory and safeguards remain authoritative;
it is not superseded wholesale. Its Accepted body and all closed specs/reviews remain unchanged.
Where current reporting-gate prose conflicts, this decision takes precedence. No release,
version bump, additional resource access or runtime capability is authorized.

## Decision Options Considered

### Option A: Require per-stage Adobe report receipts for every release scenario

- **Pros:** Demonstrates the configured downstream product pipeline and attribution.
- **Cons:** Depends on product-specific async processing, reporting access, manual exports
  and configuration outside Airlock; does not isolate stock/chamber defects. Not selected.

### Option B: Accept a queued SDK call or pre-serialization XDM object

- **Pros:** Cheap, hermetic assertions.
- **Cons:** Misses SDK transformation, blocked/incorrect dispatch, routing, lost results,
  duplicate notifications and host rendering failures. Rejected.

### Option C: Require actual governed wire and response behavior; defer downstream reporting

- **Pros:** Tests the behavior Airlock can enforce and preserves native SDK semantics.
- **Cons:** Does not guarantee vendor ingestion, attribution or reporting; those require
  separately scoped follow-up evidence. Chosen by the owner.

## Recommended Decision

Adopt Option C for Adobe-first implementation and release acceptance.

1. **Final requests, not intent.** Execute the exact unmodified pinned SDK on both stock
   and chamber arms with equivalent synthetic inputs. Inspect serialized URL/method/body
   and relevant non-secret headers at actual dispatch through the trusted egress seam.
   Verify XDM, Adobe-specific `data`, identity, consent, routing and notification identity;
   a `sendEvent()` call, queue acceptance, fixture result or HTTP 200 alone cannot pass.
2. **Specific equivalence.** Use a closed comparison inventory with path-specific rules
   for unavoidable IDs/timestamps. Record raw private evidence and every permitted
   difference. Never blanket-strip identifiers, event types, routing, ordering or
   proposition references to manufacture stock/chamber equality.
3. **Real return path.** Verify responses/results/errors reach the caller through the
   bridge. Verify approved personalization safely renders in the owned placement,
   and native DISPLAY/INTERACT reference the returned proposition only after actual
   rendering/trusted interaction. Adobe notifications remain mandatory wire behavior;
   GA4 exposure is not a substitute.
4. **Controls remain mandatory.** Negative consent, no-offer, non-render, tenant/endpoint,
   identity/revocation, errors, duplicate/retry and lifetime scenarios test actual wire,
   return and host behavior. Observe no unauthorized dispatch for forbidden operations
   within a defined finite window. Never call unsupported or swallowed operations passes.
5. **Evidence layers stay distinct.** Stub tests prove harness behavior, a local receiving
   sink proves dispatch/serialization, and approved real Adobe calls prove that scenario's
   live protocol/response behavior. A chamber-compatibility claim needs actual worker
   execution, not stock-only evidence or an unexecuted XDM assertion. Malformed-request
   errors from the vendor still block acceptance.
6. **Downstream follow-up, not erased work.** Product ingestion, counter stability,
   per-run attribution, campaign conversion/click-goal reporting, CJA data views and RTCDP
   downstream activation are nonblocking follow-up goals. Optional evidence is retained;
   absence alone cannot block unrelated wire-qualified work. A concrete vendor error or
   contradictory receipt revealing a request defect is investigated, not ignored.
   Claims of *downstream product validation* still require that product's real evidence.
7. **Other gates survive.** Full version-pinned command/options/results/events coverage,
   explicit incompatibilities, governed consent/cookies/DOM/network, frozen core,
   authorized resource isolation, adoption/rollback and measured performance remain
   required. Missing access to execute a required live response scenario remains a
   blocker for that scenario, not grounds to label it supported. No full SDK/release
   success follows from the initial smoke. The eight-active-hour 051-03 cap remains.

There is no new runtime behavior in this decision and no shipped-code retrofit.
Execution still refines/reviews open baseline and compatibility slices before traffic.

## Re-baselining manifest

Retire draft obligations on the old mandatory reporting premise first.

| Existing artifact | Disposition | Action |
|---|---|---|
| 051-02's fifteen-export/stable-counter/three-hour reporting stages | `retire-draft` | Replace the open draft with bounded stock wire/response/render/control/performance acceptance; preserve the old reporting plan as historical provenance, not an executable prerequisite. |
| 056 downstream product-workflow outline | `retire-draft` | Keep as a nonblocking follow-up; do not delete scope or manufacture DONE. No executable slices exist. |
| ADR-0031 | `reaffirm` | Retain Adobe-first/full-SDK/control direction; this decision overrides only mandatory downstream-receipt acceptance. Keep Accepted body unchanged. |
| Other ADRs and all DONE slices/reviews, including 051-01/04/05/06 | `reaffirm` | No closed-record amendment, evidence rewrite or gate waiver. |
| Open 051 overview/02/03/plan/tasks | `rewrite` | Require real stock/chamber dispatch and result/rendering evidence, not mandatory exports. Preserve baseline/spike gates. |
| Open 052/053/054/055/057 outlines | `rewrite` | Retain event/notification/identity/Launch/adopter/performance work; qualify at wire/response/host boundary, link optional reporting to 056. |
| Adobe release plan, slate and portable goal brief | `rewrite` | Update current assurance and dependencies; product reporting is not a v1.0 prerequisite. No publication authority. |
| Vision, architecture, root README and CLAUDE | `rewrite` | Explain the boundary and limited claims without changing use cases or module contracts. |
| Operator README, research note/index, glossary, refinement ledger and inbox | `rewrite` | Retain measured receipts and attribution residuals as follow-up; remove manual-export availability as an implementation blocker. |
| Historical third-party/MVP plans, research and generic workflow/conventions | `reaffirm` | This Adobe decision does not waive third-party customer validation or change conventions. |

## Coverage floor

**Level 1:** Decision/spec paths and boundary/reporting matches scanned; live
prose/release/research/memory docs, root README and CLAUDE scanned. Project skill trees
are excused: no project-owned SKILL.md found in the listed configuration locations;
installed skills are tooling, not release authority. No shipped code is changed or claimed audited.

**Level 2:** Detailed reads cover ADR-0031, the 051 overview/open baseline/spike, all
052-057 outlines, release/goal/slate, vision success criteria, architecture header, README,
primer and glossary. Literal receipt/outcome/report/gate/export searches identify current
references in research/index, refinement/inbox and operator docs. Those named artifacts
are the rewrite set; older dated histories and completed spec/review artifacts are retained.
This targeted authority read may miss indirect wording; the floor exposes rather than
eliminates that risk. Later contradictory *current* guidance requires reconciliation,
not silent edits to Accepted records.

## Emergent work

No new runtime feature or spec family is invented here. Existing 051-02 owns the stock
wire oracle, 051-03 the chamber feasibility decision, and 052-055/057 implementation/adoption.
Existing 056 owns the nonblocking downstream-reporting follow-up. Its trigger is a concrete
adopter need for product reporting/attribution or a suspected discrepancy needing product
evidence; refine its operator/access/cost plan then, not before unrelated work.

## Consequences

**Becomes easier:** Automated assertions cover the boundary Airlock owns; no staffed CSV
schedule, artificial reporting-stage spacing or click-goal provisioning merely to prove
native notification dispatch. Existing baseline reporting is reused without resends.

**Becomes harder:** Wire normalization and response/host tests must be precise and fail
closed. A broad "Adobe works" claim becomes versioned boundary-qualified support.
Downstream product assurance needs separate evidence when requested.

## Assumptions

Comparative wire/results tests can expose relevant chamber defects without vendor
counter exports for every case. This is an assurance choice, not proved absence of all
possible downstream differences. Actual 051-02/03 tests must validate it; contradictory
report evidence is a reason to investigate/revisit it. R-012 supplies executed initial
stock/Analytics/Target observations; none establishes chamber parity.

## Kill criteria

An assigned behavior cannot be discriminated at wire/response/host boundary; normalization
hides a material routing/identity/notification difference; or an adopter contract requires
downstream validation. Mark the behavior blocked and request scenario evidence, not broad
authority or fabricated success.

## Open questions

Exact versioned comparison rules, live scenario set and numeric performance bands remain
to be refined in 051-02/03. This decision does not solve them or waive review.
