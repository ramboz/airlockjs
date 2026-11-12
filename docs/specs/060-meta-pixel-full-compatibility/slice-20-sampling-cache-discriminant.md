---
status: DONE
dependencies: [060-18, 060-19, adr-0055]
last_verified: 2026-11-09
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-20 - Distinguish worker cache behavior and prepare a real timing transition

The completed comparison used unchanged inputs, so it could not distinguish
cached reuse from resampling. This packet gives an operator a separately named
reader with distinguishable worker inputs and prepares an SDK-free browser
lifecycle case. The tradeoff is a narrower, falsifiable result while native
sampling and referrer-manager causality remain unresolved.

**Goal:** An operator can exercise one-PageView worker-cache controls, read
their actual serialized evidence, and prepare a separately admitted SDK-free
early-init/late-PageView comparison without reopening 060-19.

The canonical integrator explicitly assigned 060-20 to app session
`6141e2d7-bbcd-4970-b970-3f985e7c49b3`, branch
`meta-sampling-experiment`, clean base
`43b101a64f9ccf0d5056c3ebda50723c88a19361`, after current noncompetition
checks. No ADR is allocated. The owner directly clarified "I meant to implement
the plan" and then selected "Prepare source controls + SDK-free
early-init/late-PageView browser case; stop before execution (Recommended)".
This commissions source work, not a browser operation.

**DoR:**
- [x] Actual clean canonical ancestry and isolated app/branch are verified.
- [x] Explicit allocation and noncompetition checks are confirmed.
- [x] Owner selected source controls and SDK-free fixture preparation.
- [x] Source-backed runtime behavior and existing changed-input tests are read.
- [x] Fresh explicitly pinned Sol framing passes.
- [x] Normal readiness reaches READY_FOR_IMPLEMENTATION without a foreign claim.

**Acceptance Criteria:**

1. Provide separately named, import-inert packet/reader, CLI, browser recorder
   and first-party page source. Imports and source controls must not launch a
   browser, evaluate/acquire vendor bytes, install dependencies, read the old
   private packet, or invoke the historical case. Preserve all 060-19 source,
   inputs/readers and closed records, runtime semantics, fixed historical
   serving rosters, stable contracts and production selection.
2. Reuse existing adapter, actual serialized Node worker and independent
   loopback receiver for five fresh-instance controls. Each has one synthetic
   Pixel init and one PageView: timing positive A=12.5 then B=99.25 yields A;
   timing zero then B yields B; timing zero then zero omits `plt`; referrer
   init mapping to `fb` then event mapping to `empty` yields cached `fb` with
   initialization-only storage; default-off omits both fields and feature
   capture/storage. Use empty synthetic in-memory referrer backing, never
   copied native state. Reuse existing cache prior art rather than claiming
   those semantics were previously untested.
3. Retain actual admitted command scalars and directional worker messages,
   correlated initialization/event completions, dispatch and independent
   receiver evidence. The new reader derives predictions from those raw inputs,
   validates exact field multiplicity and one-event protocol, and distinguishes
   missing evidence from contradictory evidence. Bracket snapshots cannot
   substitute for command inputs. Two omissions or equal redactions do not pass
   a positive comparison. State explicitly which competing explanation each
   distinguishable control falsifies.
4. Prepare three fresh SDK-free browser contexts, in order: late-init timing-on
   positive; early-init timing-on with the sole PageView after DOMContentLoaded;
   paired default-off. Use one host-owned canonical IPv4 loopback binding and
   the unchanged serialized module worker. Referrer, preparation and `_fbp`
   flags remain off in all browser contexts. There are zero browser observer
   storage reads and zero runtime storage primitives.
5. Use ordinary first-party deferred-module/lifecycle scheduling. The early
   case must actually record a valid modern navigation entry and init
   `domContentLoadedEventEnd == 0`, then a later positive PageView duration.
   Record the five raw timing scalars without rounding; correlate command and
   lifecycle chronology. If the condition is not created, stop explicitly,
   without a retry/tuning loop. No parser blocker, held response, busy wait,
   timing/API override, UA/realm spoof, debug hook, changed vendor bytes or
   artificial native state is permitted. Do not deadlock DOMContentLoaded by
   waiting for it in the module's top-level awaited evaluation.
6. Preserve host policy and worker interpretation. The browser case has no
   native SDK, upstream measurement, additional origin, storage capability,
   live/owned binding or arbitrary routing. The Node referrer control retains
   the two exact ADR-0055 names, <=16 ASCII bytes/null, eight primitive ceiling,
   one outstanding operation, get/set/expiry-only remove and strict
   consent/tag/generation/origin checks. Its fresh external sample performs
   six initialization primitives and none at PageView. No enumeration, probe,
   clear, repair, rollback, native copying/seeding or broader `_fbp` grant.
7. Prepare a distinct explicit run/read entry with complete page/worker/control
   source admission and exclusive new packet/binding. Source or roster drift,
   wrong origin, used directory or invalid admission refuses before launch.
   A digest is drift evidence, never owner permission. The optional operation
   remains unexecuted pending exact source/operational review and a separate
   owner decision on the final concrete fixture, routes, bindings and budgets.
   Do not reuse the historical 4/32/32 inventory or its spent grant.
8. Enforce at most one already available headed browser at exact existing pin
   `151.0.7922.34`, three contexts, three PageViews, 64 requests/context,
   2 MiB/body, 8 MiB aggregate retained data and 512 KiB candidate bridge.
   Retain bounded trace rows and raw chronology, separate command/harness
   captures, terminal unknown-route abort, restrictive CSP, blocked service
   workers and closed WebSockets. Exact roster multiplicity comes from the
   final source closure, not guessed counts or a case-time roster rewrite.
9. Keep work/hard ceilings no greater than 80/90 seconds and cleanup waits
   bounded at 1.5 seconds. Cover route/receiver/worker/publication and late
   acquisitions. Missing positive, uncreated condition, source/version drift,
   dependency/budget/consent/protocol failures and incomplete cleanup stop the
   matrix. No automatic retry, extra context, acquisition or installation.
   Report cleanup API settlement separately from unknown process/profile/OS/
   host cleanup and never claim physical containment.
10. Write new raw records exclusively as 0600 files beneath a fresh owned
    0700 private directory outside tracked source. Bind exact source, inputs,
    configuration and evidence; validate raw records before projection. Emit
    only closed categories/counts and public source citations, never raw
    timing/state, URLs, identifiers, dynamic names, arbitrary exceptions or
    private digests. Publication/binding/cleanup failures are explicit.
11. Keep synthetic relationship, candidate lifecycle observation, uncreated
    condition, inconsistent evidence and incomplete operation distinguishable.
    No result establishes native timing-plugin installation/read/cache,
    referrer-manager causality, identical native inputs, vendor receipt,
    response qualification or full compatibility. Full parity and full
    060-01 remain false. 060-19's conservative reader remains unchanged.
12. Before any tests, audit the exact selected Node execution/import closure,
    runner/config/setup/hooks, helper main guards and Node worker graph.
    Exercise first-party page/recorder bodies only through synthetic services
    in that selector. A browser import/launch must fail the selector; no
    browser-capable test, default Meta discovery, dependency install or
    `test/meta-behavioral-replay.test.js`. Witness new reader/protocol red/green
    and meaningful restored mutations/negative controls, use scoped lint,
    and preserve existing behavior. Existing green cache tests are prior art,
    not new witnessed red/green.
13. Implementation is one native Jig implementer explicitly pinned to
    `gpt-6.1-terra`, admitted at READY_FOR_IMPLEMENTATION and taking its own
    claim. Fresh framing, compliance, craft, architecture and reconciliation
    are explicitly pinned `gpt-6.1-sol`; no substitution or self-review.
    Stop at reviewed source delivery with normal gated lifecycle, clean
    feature-line handoff and source/operation evidence clearly separated.

**DoD:**
- [x] Fresh Sol framing and normal readiness/claim are recorded.
- [x] Approved source packet and audited Node-only controls are complete.
- [x] Fresh exact-source Sol compliance, craft and architecture pass.
- [x] Deviations, documentation, reconciliation and clean handoff are recorded.
- [x] Browser/SDK execution remains explicitly unperformed and unapproved.

## Grounding

The complete session plan is outside tracked source. Existing first-positive
sampling/cache and wire assignment are
`connectors/meta-pixel/pageview-prototype.js:36-41,287-293,355-394,416-461`;
actual admission capture is `adapters/meta-pixel-prototype.js:188-225,906-928`.
Referrer interpretation/cache and init-only primitive admission are
`connectors/meta-pixel/pageview-prototype.js:148-201,357-377,460-461` and
`adapters/meta-pixel-prototype.js:1062-1093`.

Prior art is `test/meta-pageview-performance-experimental.test.js:27-70` and
`test/meta-pageview-referrer-experimental.test.js:19-52`. 060-19's outcome
records unchanged timing and unresolved native causality in
`referrer-timing-outcome.md:49-82`; its recorder/reader conservatism is
`rig/meta-referrer-timing-browser.mjs:314-320` and
`rig/meta-referrer-timing-case.mjs:543-550`. Accepted ADR-0055:106-165
supplies the unchanged runtime capability ceiling.

## Assumptions

- Ordinary deferred-module scheduling can capture a pre-DOMContentLoaded
  command and a later positive command in the selected browser. This is
  unexecuted; condition-not-created is an explicit result, not a passing
  transition or permission to add delays or retry.
- Existing import-inert helpers can support the new packet without editing
  closed case files. Any necessary boundary change must be surfaced before
  implementation rather than silently widening this scope.

## Implementation boundary

Allowed implementation paths are `rig/meta-sampling-case.mjs`,
`rig/meta-sampling-cli.mjs`, `rig/meta-sampling-browser.mjs`,
`rig/meta-sampling-page.js` and `test/meta-sampling-case.test.js`. An additional
small test-only fixture is allowed only if indispensable and explicitly
reported. Runtime/helper files remain unchanged.

The coordinator owns this slice, its reviews, directly related spec
plan/tasks/index, operator/work-plan prose, changelog and derived board.
No accepted ADR or closed record may be amended. Preserve 060-01's foreign
claim, 063-01 ownership, 059-18 NO-GO, UNKNOWN cleanup/traffic and withheld
history boundaries. No new ADR, main checkout, PR or push.

## Coordinator source evidence

The final craft-corrected source passed 118 tests in the exact audited Node
selector, five-file scoped ESLint and `git diff --check` in the coordinator's
own execution. The source-only `admit` entry was recomputed on those same
bytes: 18 page modules, 12 worker modules, 34 control modules and 33 derived
requests per context, with `ownerPermission: false`. These are static source
counts, not an observed browser roster or operation permission.

Producer receipts retain new regression reds and isolated mutated-evidence
negatives. Temporary reader task-bound and field-multiplicity mutations were
witnessed and restored. They were not producer/runtime, browser or vendor-SDK
mutations. The old cache tests remain prior art.

### Deviation log

No approved scope deviation or waiver was needed. Review corrections tightened
deadline/abort propagation, stop-before-further-effects behavior, partial
private evidence retention, wire identity and outcome correlation, raw bridge
status, command/lifecycle timing consistency, configuration order/endpoint
binding and isolated negative controls. Original ACs remain unchanged.

The stopped synchronous implementer was replaced only after its idle state
was verified and the normal own-slice READY_FOR_IMPLEMENTATION handoff cleared
its claim. The replacement and reviews were explicitly model-pinned; host
Task/read-agent observations are retained in the session. That staffing
decision was delegated orchestration, not a new direct human selection or a
new source/runtime grant.

### Reconciliation sweep

- **Updated:** this slice, spec index/plan/tasks, operator guide, work-plan
  section34, changelog and derived status board. Source preparation and actual
  execution remain separate; no approved browser invocation exists.
- **No-op:** runtime/helper source, package manifests/lock, production defaults,
  stable contracts and architecture prose. This adds an internal experimental
  packet, not a production boundary or storage capability. Fresh architecture
  review found no new ADR requirement; it does not approve an operation.
- **No-op:** accepted ADRs and conventions. No ADR is allocated, no convention
  change is proposed, and no existing decision is superseded.
- **No-op:** the scoped inbox check found only earlier generic-pixel discussion;
  no inbox item is claimed resolved by this packet. Native causality and actual
  lifecycle/route qualification stay explicitly unresolved in this slice.
- **No-op:** product vision and primer compression. Full060-01 remains open;
  the parent spec is not closed by this bounded source delivery.
- **No-op:** memory consolidation found no new domain term, contributor-wide
  convention or out-of-spec shipped decision to persist. The memory summary
  and existing team opt-out check completed without changes.
- **Advisory:** use-case coverage reported zero gaps/dangling links and nine
  pre-existing untraced specs, none060. Those unrelated records were not edited.
- **Leanness:** the packet reuses the adapter, serialized worker, receiver,
  deadline and private-file helpers. Only the four approved rig modules and
  one owning test file were added; no general runner or additional fixture.
- **Preserved:** completed060-19 source/readers/evidence/records,060-18 and
  ADR-0055, foreign claims,059-18 NO-GO, UNKNOWN cleanup/traffic and withheld
  histories. No closed-record amendment, shared window, main checkout,
  PR/push, acquisition or browser/SDK operation occurred.

The chronological implementation checkpoints below are retained producer
history. This coordinator section supersedes their intermediate test counts
and stale-admission notes; review and terminal lifecycle gates are separate.

## Implementation checkpoints

The normal transition recorded this branch's IN_PROGRESS claim. The five
approved source/test files are prepared; no runtime or helper files changed.
The new controls use fresh actual Node workers and a separate local receiver.
The SDK-free fixture and its guarded operation are source preparation only:
no browser or SDK operation was performed or approved.

Before the exact selector was run, the selected installed Vitest entry and
runner/defaults, project config, setup/hooks, helper main guards, Node worker
bootstrap/static graph, and the new test's imports and executable branches
were audited. Browser-library access is mocked to throw and the page/recorder
bodies use synthetic services. The revised exact selector passed 118 tests;
scoped lint passed. New red/green checks and isolated negative controls covered
raw input and protocol contradictions, missing evidence, lifecycle condition,
route failure, bridge limits, cleanup, admission and private readback.

The parent reported a source-only admission recomputation for the prior
66-test revision: 18 page modules, 12 worker modules, 34 control modules,
33 requests per context, and no owner permission. This further revision makes
that digest stale; no revised admission was computed here. Counts are not an
observed browser roster. Lifecycle feasibility, real routes and native
causality remain unqualified.

Compliance recorded `needs-changes` on the earlier source. The revision
propagates the Node-control deadline and abort, validates the exact wire Pixel
ID, brackets admitted command timestamps in the same performance clock as
lifecycle markers, and validates raw bridge status. Four corresponding tests
were witnessed red before the fixes; additional synthetic tests cover late
cleanup and explicitly uncreated complete-document state. Independent
rereview again recorded `needs-changes`. The subsequent revision gates each
Node initialization and completed control before further issuance/acquisition,
retains partial failure evidence through private publication/readback, and
rejects navigation ends later than their same-clock admitted command. Focused
tests were witnessed red before the fixes; the producer-to-private-readback
failure path and plausible synthetic lifecycle fixtures are covered.
The next compliance pass recorded `needs-changes` on lifecycle ordering.
The current revision requires positive navigation ends within the inclusive
same-clock listener/task interval, validates paired modern entry and harness
captures, and checks command chronology before uncreated classification.
The reader also accepts the page's actual no-outcomes zero-event uncreated
shape only after validating its dispatch and receiver evidence, and rejects
contradictory status or dispatch in the no-event init-uncreated branch.
Focused early/late negatives were witnessed red; the temporary reader
mutation used to witness after-task negatives was restored. Craft then
recorded `needs-changes`: the subsequent revision validates complete
correlated Node success summaries and the browser's ordered configuration,
configured phase and exact local endpoint before projection. New protocol
negatives were witnessed red and green; the duplicate-`plt` test now changes
both correlated URLs and failed under a restored reader-only multiplicity
mutation. Independent rereview remains outstanding; no operational grant
is implied.

### Close-out (post-DONE)

060-20 is DONE for reviewed source preparation. Source commit
`c059404e4d213665013fae00941f4ddedf795c27` contains the five-file packet,
related documentation and fresh pinned Sol frame, compliance, craft,
architecture and reconciliation verdicts. Normal transitions cleared every
required gate and released the own-slice claim.

The coordinator's SESSION `files/sampling-source-handoff.txt` records the
committed manifest, final metadata commit and clean feature-line checkpoint.
Canonical integration remains separate. Completed 060-19 and runtime/helper
semantics are unchanged.

No browser/SDK operation was performed or approved. Actual lifecycle
feasibility, route multiplicity and native causality remain unqualified.
A changed operation still needs exact reviewed admission and a separate
owner decision; no automatic successor or execution follows this close-out.
