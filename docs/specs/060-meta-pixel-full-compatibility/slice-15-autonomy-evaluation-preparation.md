---
status: DONE
dependencies: [adr-0047, 058-03]
last_verified: 2026-11-05
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-15 - Prepare the Meta reference matrix and autonomous evaluation

**Goal:** An operator can inspect the complete planned Meta reference matrix,
run meaningful local evaluation controls and obtain a fail-closed Meta goal
gate, with a precise handoff for later autonomous feature work.

The owner requested autonomous completion of this preparation pass, reference
matrix work, usable evals and oracle adjustment on 2026-11-05. This authorizes
source preparation and local checks, including directly owning oracle changes.
It does not authorize SDK acquisition, native collection, live events, site or
account mutation, a full programme loop, or automatic approval of reference
data, judged rubrics, readiness or new run limits.

The twelve full product journeys remain 060-01 through 060-12. This additional
preparation slice neither completes their acceptance criteria nor changes the
closed construction/POC records. Performance optimization remains deferred.

**DoR:**
- [x] Owner preparation/oracle/evaluation scope is explicit.
- [x] Shared branch baseline `1ad2933dc604b7b287e58e636d7e27b90882ad37`.
- [x] Accepted ADR-0047 and existing 058 comparator/report boundaries inspected.
- [x] Fresh pinned Sol framing pass and normal readiness/claim.

**Acceptance Criteria:**

1. Publish one machine-readable, source-cited reference matrix under this
   spec's `oracle/` directory, with all 20 F families, 18 SC scenario families,
   twelve product owners and nine cross-cutting C obligations retained.
   Include per-journey acceptance-criterion coverage. Validate the roster
   against authoritative spec/slice data so missing, duplicate or invented
   entries cannot become a green coverage result. Structural coverage is
   separate from implementation or qualification.
2. Record evidence by layer and source kind: public documentation, synthetic
   fixture/local worker, native attempt, actual dispatch/response, backend
   receipt and product matching/deduplication/catalog/attribution. Existing
   058/061/062/063 records supply only their named scope. Cite existing
   runtime/configuration pins and unresolved epochs where available, without
   inferring current qualification or copying private values. Unavailable
   handles, unknown behavior and missing layer executors remain blockers,
   not exclusions or fabricated reference rows.
3. Add a bounded deterministic operator command and local eval controls.
   Reuse existing comparison/readback mechanisms where their contract fits.
   Exercise positive and negative/mutation cases that detect missing/extra
   requests, changed Pixel/event/value, duplicate or reordered fields,
   unavailable response/body, empty positives, redacted-value equality,
   copied-reference candidates and unsupported/unknown behavior. All data
   used in local self-tests is explicitly synthetic. A green local control
   cannot count as native compatibility or product evidence.
4. Preserve the existing default root oracle's Vitest and GA4 checks and
   threshold. Add one explicit `meta-pixel-full-parity` profile, with unknown
   profiles rejected visibly, so ordinary Adobe/legacy work does not acquire
   an unrelated Meta release gate. The Meta profile must include the baseline
   checks and a real completion-evidence gate; it cannot pass from counts,
   lifecycle labels, HTTP 200, synthetic tests or a mutable `fullParity` flag.
   Missing qualified references, approval/freeze, required checks or layer
   executors block. Preserve 0/1/2 oracle exits and the existing 058 report
   contract separately. No global threshold reduction or silent skip.
5. Colocate Servo evidence plans for all twelve product journeys, including
   the C1-C9 obligations not captured by a numbered-AC parser. Distinguish
   deterministic wire/state controls from proposed text-judged evidence-
   fidelity reviews. Proposed rubrics/datasets must contain meaningful,
   clearly labelled cases rather than EDIT ME or fabricated native truth.
   Text judgment can assess truthful reporting of supplied evidence; it
   cannot determine private wire correctness or supply a missing reference.
   Use normal authoring helpers; leave human-owned approval/freeze proposed
   and never invoke an approval helper on the owner's behalf.
6. Deliver a proposed programme brief and mutation perimeter. Preserve
   acceptance criteria, oracle/reference truth and reviewer independence
   outside the future implementer's writable surface. Pin native Terra
   implementation and fresh Sol review routing. Name permitted local work,
   restricted external actions, case-bound evidence inputs, escalation and
   no-progress stops. Budget/iteration/candidate caps not supplied by the
   owner stay explicit unresolved launch fields, not guessed hard guarantees.
7. Check actual execution capability read-only. Installed Servo's unsupported
   Copilot goal/loop path must stay unsupported; no Claude fallback or SDK/
   plugin port is part of this pass. Document standalone quality-gate use
   with native Copilot coordination as a distinct, bounded route, not a
   claim of Servo's hard spend/context guarantees. Formal readiness artifacts,
   if generated, stay proposed; missing authority or caps cannot yield ready.
8. Witness red-to-green tests for the preparation tool, matrix contracts,
   false-pass/mutation controls and scoped oracle integration. Test invalid
   or tampered reference/approval plans and the actual incomplete matrix.
   The real full-parity check must currently remain nonpassing with named
   gaps. Validate that synthetic/POC successes cannot upgrade it, and that
   existing approved/default oracle behavior is preserved. No native/browser
   or network work is implicitly run by importing the tool or reading a gate.
9. Fresh explicitly pinned Sol compliance, craft and architecture reviews,
   normal recording/reconciliation and a committed canonical-branch handoff
   complete this preparation slice. Report separately what is usable now,
   what still needs qualified reference acquisition, and what needs owner
   approval. Do not mark the twelve product journeys DONE or launch a
   successor programme as a consequence of completing preparation.

**Scope:** new reference/eval/oracle files under this spec; one small
`rig/meta-parity-readiness.mjs` operator with directly owning tests/guide;
owning root-oracle/profile metadata and this slice's documentation/status.
No connector/core/runtime/SDK/production-site changes or generic scheduler,
runner, keeper, isolation service or model-host backend implementation.

**DoD:**
- [x] Source-backed matrix and meaningful local eval controls are implemented.
- [x] Scoped Meta oracle preserves baseline behavior and fails closed.
- [x] Proposed reference/judgment/mandate approvals and launch blockers are clear.
- [x] Targeted validation and fresh pinned Sol reviews are recorded.
- [x] Reconciliation, normal gates and canonical handoff are complete.

## Grounding

The full inventory and F/SC ownership are in `spec.md:246-280`; numbered
criteria and dependencies are in 060-01 through 060-12, with C1-C9 at
`spec.md:137-156`. At the framed baseline, root `oracle.sh:34-37`
registered only Vitest and GA4 conformance, at threshold 1.0. Their default
registration and scoring bodies remain unchanged by the scoped Meta profile.
`rig/chamber-comparison.md:49-91` exposes attempted/local layers and no
full-parity pass mode. `rig/meta-behavioral-report.mjs:29-67` always keeps
its selected-field comparison inconclusive. The fixed owned POC evidence
and performance baseline are recorded in the work plan, not a full native
oracle.

The installed Servo routing probe explicitly refused Copilot loop/goal
execution with `native_capability_unavailable`; no agent was dispatched.
Spec-oracle approval, generic eval emit/freeze and readiness approval are
human-owned boundaries, not permissions inferred from source-authoring.

## Assumptions

Existing named comparison seams can support some deterministic controls
without changing their evidence meaning. Verify their actual exports and
bounded input contracts; unsupported full-wire/product surfaces remain
explicitly unavailable, rather than a new invented comparator.

## Implementation handoff

The [source-backed matrix](oracle/reference-matrix.json),
[operator guide](../../../rig/meta-parity-readiness.md) and
[proposed programme handoff](autonomy-preparation.md) describe the prepared
local controls and named gaps. Journey plans and fragments remain proposed.
No reference approval, full-journey qualification or launch authority follows
from this preparation. The owning record below carries independent reviews,
reconciliation and normal lifecycle completion separately.

### Deviation log

Prep source is `b9171c68a54fa632829ceb1701204bdb95128bbc`, following
initial implementation `929505c`. A fresh native Terra writer implemented
the packet; every required review was explicitly dispatched on fresh Sol.

- The first compliance pass caught non-hermetic tests requiring a particular
  installed Servo/Python path. Normal units now use labelled command stubs;
  real Servo integration is explicit via `SERVO_ROOT`, skips only when absent
  and fails for an invalid supplied root.
- Three originally vacuous controls were removed from the detected count.
  Copied-candidate provenance, response observation and cohort qualification
  are named unavailable with exact missing-executor reasons. Twelve real
  synthetic attempt controls remain. No unavailable control was fabricated
  to satisfy a quota.
- The matrix now cites the available historical 2.9.426 configuration pin.
  It does not upgrade the separate 2.9.435 owner-described epoch.
- The helper's keyword classification initially called wire mutation an
  opinion and sent other wire/state criteria toward text judgment. All 86
  numbered obligations now explicitly name deterministic evidence needs and
  unavailable executors; the proposed text rubric is only report fidelity
  for AC-060-01-7. C1-C9 remains covered for each journey.
- This is a blocker-only safety/preparation gate, not a full-native grader.
  It has no completion-pass executor. Actual matrix diagnosis is inconclusive,
  and the Meta profile refuses all twelve proposed/unapproved plans.
  Qualified references and executors must be supplied before a future
  completion-pass implementation can be approved.
- Craft N1, whitespace-tolerant matching for a historical-pin unit assertion,
  is deferred as nonblocking test polish. No runtime or acceptance change
  follows from that nit.

The coordinator independently observed 14 owning/configured integration
tests pass with zero skips, plus source lint, shell syntax and diff checks.
With `SERVO_ROOT` absent, the 12 hermetic units pass and two real integration
tests explicitly skip. The writer also recorded applicable existing comparator
selectors: 37 targeted cases passed with unrelated cases excluded by selector.
Original behavioural REDs, timeout corrections and final nonpassing gate
outputs are preserved in the private source audit.

The coordinator independently compared the old default oracle's component
bodies, roster and threshold: all remain identical. No model judge, approval,
freeze, native/SDK acquisition, browser, live event, site/account change or
full programme loop was performed.

Reconciliation first requested explicit dispositions for all prep-owned
artifacts and inherited-history exclusions. The documentation-only sweep
correction was reviewed in a fresh narrow Sol context and passes.
No runtime or experimental work was repeated for this correction.

### Reconciliation sweep

- Scope: this prep packet is compared with shared baseline
  `1ad2933dc604b7b287e58e636d7e27b90882ad37`, including its framing,
  source commits and final documentation/review changes. Earlier branch
  history versus `main` is inherited context, not this packet's inventory
  or a request to reconcile unrelated work.
- Updated: matrix, twelve proposed evidence plans and C obligations, operator
  guide, report-fidelity proposal, programme/perimeter/checklist and this
  owning slice. The shared work-plan handoff records preparation separately
  from native qualification.
- Updated: `oracle.sh` and `.servo/install.json` expose only the explicit
  Meta profile while retaining default component bodies, roster and
  threshold. `rig/meta-parity-readiness.mjs`, its unit/integration suites and
  guide implement the bounded prep command and controls, not a native grader.
- Updated: the open spec overview indexes 060-15 without changing the
  twelve product journeys. `docs/specs/README.md` is regenerated through the
  normal helper; new slice-15 review records carry fresh Sol verdicts.
- No-op: root README and CLAUDE primer keep their existing support limits and
  Meta routing. The new operator is indexed in the owning spec and dedicated
  guide; preparation adds no product-support or full-programme readiness
  claim requiring a front-door rewrite.
- No-op: inbox and project refinement ledger were checked; the prep tool
  does not close their remaining native/capability/product decisions.
  `.servo/refinement-todo.md` already records the threshold-1.0 decision,
  which this packet preserves. No deferred trigger was silently promoted.
- No-op: original twelve product criteria and their status; all closed
  058/061/062/063 records; stable core, connectors, adapters, production build,
  dependency manifests, SDK pins and site configuration.
- No-op: accepted decisions and conventions. Architecture review found no
  new ADR-worthy runtime decision; no decision number was allocated.
- No-op: performance optimization stays deferred. SDK-free baseline numbers
  are not native evidence or an optimization mandate.
- No-op: no new domain term or contributor-wide convention. Memory retains
  existing owning records instead of duplicating temporary run status.
- Deferred launch inputs: qualified case-bound native references, complete
  independent layer executors, human review/approval/freeze, allowed external
  actions, owner-selected run limits and an enforced mutation perimeter.
  Current Servo/Copilot goal/loop routing remains unsupported.
- Leanness: one offline prep operator, existing comparator/freeze reuse and
  one explicit root profile. No generic runner, scheduler, keeper, isolation
  service, new backend or automatic successor was built.

### Close-out (post-DONE)

- [x] Regenerate/check the board and return the immutable shared-branch handoff.
