---
status: DONE
dependencies: [058-03, 059-16, adr-0033]
last_verified: 2026-10-21
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-17 - Offline native-attempt/chamber diagnostic

**Goal:** An operator supplies an existing native-attempt reference and an
independently captured first-party chamber result, and gets a private,
source-linked diagnostic of the observed request differences. The native and
chamber producers remain distinct. This makes the existing legacy gaps
measurable without executing another SDK or treating incomplete evidence as
replacement acceptance.

This is the attempt-layer part of the consumer prerequisite named in the
first-journey plan and 059-16 AC6, not a complete native/whole-wire consumer.
It serves UC-10. Native responses, equivalent inputs/consent/cohorts, C2/C3,
complete replacement and vendor outcomes remain separate gates.

**DoR:**
- [x] 058-03 supplies the strict native-attempt reader/comparison prior art at
      `rig/native-tag-comparison.mjs:238-252,403-554,688-720`.
      Its existing public comparison behavior must remain unchanged.
- [x] 059-16 is DONE and exports `inspectCapture` at
      `rig/chamber-capture.mjs:1266-1353`; its distinct schema and real-worker/
      source/HTTP checks are not replaced by a caller's assertion.
- [x] Parent executed the retained normal chamber inspector on current source:
      guard PASS, conclusive, two independent worker/receiver positives.
      The reader correctly does not claim whole-CLI completion.
- [x] Explicit retained Meta/Google attempt handles and original expected pins
      exist in the earlier comparison evidence. They are no-send attempted
      references, not complete live stock responses or current source leases.
- [x] The original Meta stock case is spent/inconclusive. This work reads
      existing evidence only; it needs no SDK, browser, source GET, original
      authority/slot, account, deployment, live window or new event grant.
- [x] Independent frame review passed before implementation; source positives,
      request controls and nonacceptance outcomes are distinct.

**Acceptance Criteria:**

1. **Fixed offline entry.** A closed Node interface consumes explicit private
   reference report/capture/completion handles and expected reference pins,
   plus a chamber output and its separate whole-CLI command-witness handle.
   Only the retained `meta-pageview` and `google-ads-conversion` profiles and
   their `baseline`/matching chamber-positive case are supported. No arbitrary
   driver, URL, program, normalization rule, live mode or implicit discovery.
   Source/build/Node/OS/browser identities are preserved, not declared equal.
2. **Reuse strict reference validation.** Expose a read-only native-attempt
   inspection seam using the existing validator, not self-comparison,
   a copied candidate or a fabricated native producer. It must validate all
   source cases/controls, original handles, completion, expected pins, request
   relationships and absence of redaction. Reject local stand-ins, unknown
   fields, malformed/ambiguous JSON, empty/missing positives, stale/missing
   originals and the actual spent/incomplete inspected-stock schema.
   No optional flag skips observations or promotes this to whole-wire proof.
3. **Real chamber and true completion.** Use the unchanged 059-16 inspector,
   require its ordinary conclusive case and actual worker/source/HTTP chain,
   and independently validate the supplied post-whole-CLI witness: actual
   exit0/no signal/timeout, bounded spawn-to-close chronology, unchanged source
   pins, output identity and final file digests. A producer snapshot or inner
   child witness alone cannot satisfy this gate. Recheck immutable originals
   through publication. Do not modify or relabel any input.
4. **Exact observed-attempt diagnostic.** Retain nonempty measurement and
   companion request order and compare actual URL spelling, ordered/duplicate
   query pairs, method, resource type and body state/bytes. Never replace a
   loopback endpoint with a vendor endpoint, Fetch with Image, absent with
   empty, or protected IDs/values/document/consent with common sentinels.
   Known fixture/source/observer exclusions are explicit and counted;
   unknown fields/categories are not silently dropped. Original request-stage
   versus final-header evidence and missing responses/cookies/edges remain
   labelled unavailable or noncomparable, not invented equal.
5. **Honest outcome and privacy.** Public output contains fixed categories,
   counts and false native/vendor/whole-wire/replacement/attribution/C2/C3
   claims, never owned values, paths, cookies or value-derived tokens. Original
   values and full differences stay in private output. Source-validation
   success and a zero-difference request control are not full compatibility.
   Known differences are visible nonconformance; missing/equivalence evidence
   is inconclusive. There is no native-qualification success mode.
6. **Bounded IO and publication.** Use the existing ten-second offline budget,
   64 KiB manifest and 2 MiB native resource limits, at most 256 reference
   requests/64 chamber observations and 128 difference categories. Keep the
   chamber's existing 8 MiB aggregate bound. Reject noncanonical/unsafe paths,
   symlinks, nonregular files, wrong private permissions, existing outputs and
   unbounded/ambiguous trees. Exclusive private output and its digest/completion
   evidence remain truthful on failure; the producer cannot attest its future
   exit. No changes to the original event caps or canonical reservations.
7. **Falsifiable controls and actual retained inputs.** Witness TDD for the
   new seams. Valid-source and exact-request local controls precede intended
   failures for altered URL/encoding/query order/duplicate values, method/type/
   body, empty/dropped/extra requests, redaction, changed pins/originals,
   missing/failed outer completion, wrong profile/case, unsupported schema,
   unsafe paths and output collision. A guard-removal mutation must defeat a
   corresponding test. Run both retained native-attempt profiles against the
   actual independently qualified chamber capture, preserving browser/consent/
   input/endpoint differences and an honest nonacceptance outcome.
8. **No product or authority expansion.** Existing native comparison,
   chamber capture and admission tests remain valid. No production/core/
   connector/contract/dependency changes, closed-record amendment, accepted
   decision rewrite, source push, new SDK execution, event, slot reset or new
   authority namespace. The fully qualified native/chamber consumer remains
   open until complete compatible references and real replacements exist.

**DoD:**
- [x] Witnessed red/green and intended mutations pass; actual retained-input
      diagnostics have independently observed exits and unchanged originals.
- [x] Frame/compliance/craft/architecture/checkpoint reconciliation pass.
- [x] Operator guide, plans/tasks, open overview and architecture distinguish
      attempted-request diagnostics from whole-wire or product acceptance.
- [x] Derived board checked; live authority and first-product readiness unchanged.

**Anti-horizontal-phasing check:** The operator obtains a finite explicit-input
to genuine-source validation to useful private diagnostic path, not another
unconnected parser or a replacement for complete native evidence.

## Assumptions

- Unverified: sharing the existing native validator through a read-only seam
  can preserve its current strict source/control checks without weakening the
  old comparator. Existing regression tests and source-negative controls must
  falsify that premise.
- Unverified: the two existing producer schemas can expose their known
  request differences without hiding cohort/input/transport gaps or promoting
  source qualification into compatibility. Independent retained-input runs
  and raw-request mutations must establish that limited diagnostic behavior.

### Deviation log (after reconciliation)

Implementation handoff (2026-10-21; independent reconciliation pending):

- Added the closed offline consumer and operator guide at
  `rig/chamber-comparison.mjs` / `.md`, with portable synthetic controls in
  `rig/chamber-comparison.test.mjs`. Exposed `inspectNativeAttempt` in the
  existing native comparator using its actual source/completion/observation
  validators, without self-comparison or altering legacy comparison semantics.
- The narrowly necessary shared leaf `rig/attempt-evidence-io.mjs` supplies
  bounded private no-follow/nonblocking reads, duplicate-key rejection and
  immutable snapshots to both readers. It is explicitly included in the
  consumer source closure; no framework, plugin or policy seam was introduced.
- Native regression fixtures now resolve the system temporary directory to
  its canonical path for the strict reader. The existing data-URL mutation
  test resolves the new leaf import absolutely; its original assertion and
  mutation remain intact.
- Source qualification and exact-request controls remain separate. Output has
  no exit0 or native-qualification mode: known differences are nonconformant
  (1), insufficient/equivalence evidence inconclusive (2), invalid entry or
  unavailable exclusive output invalid_input (3). Private completion is a
  publication snapshot, never an attestation of the producer's future exit.
- Actual retained-input diagnostics and their independently witnessed exits
  were pending parent execution at the implementation handoff; the executed
  checkpoint below supersedes that pending status. No SDK/native producer, browser, capture,
  qualification run, source GET, public/vendor network, live authority,
  canonical reservation or slot was used or changed here. Local synthetic
  unit tests are not native/worker evidence.
- Parent-owned overview/boards/plans/tasks/architecture/reviews/memory were
  not edited by the implementer. Aggregate DoD boxes remain unchecked because
  retained-input runs, independent review and those documentation sweeps
  are not complete at this handoff. No full native/chamber acceptance or
  first-product readiness is claimed.

### Implementation evidence (private session artifacts)

All paths below are relative to the existing private session's `files/`
directory; no owned input values or SDK bodies are copied into this record.

- `059-17-red-06d310d9-5ecd-45f1-9328-aec392f4edf5/`:
  actual initial exit1; missing consumer module / missing native inspection
  export. Existing tests: 204 passed; new reader controls: 13 failed.
- `059-17-source-shape-red-bdc389b3-278f-44e2-9631-e1b58670e7c0/`:
  actual exit1; 83 passed / 8 failed before nested source-shape/profile guards.
  An earlier exploratory source-shape run also caught a test-registration
  mistake; it was corrected before this witnessed red run.
- `059-17-null-options-red-af736538-f250-4fd5-87d6-bdfcb7d219fa/`:
  actual exit1 / one failed unit before accepting the known null
  worker-options snapshots of non-worker controls.
- `059-17-native-guard-red-e2e339be-7936-4065-a165-7766d3c4fedf/`:
  actual exit1 / two failed units before the reader rejected unknown
  categories/case names in guard rows (without changing legacy comparison).
- `059-17-green-5b2e7d77-b38b-4b89-8987-9e5b8f390b82/`:
  actual exit0, 478 passed / 0 failed / 4 explicitly skipped producer tests.
  Includes native comparator, consumer, unchanged capture's read-only units
  and unchanged admission's synthetic units.
- `059-17-guard-removal-9dd3c042-4b72-4816-9cbd-610d5a1ade40/`:
  removing the actual whole-CLI exit0 guard caused the corresponding
  `rejects outer command exit` assertion to fail (expected exit >=2, got 1).
  Actual exit1 / one failed test; the guard was immediately restored.
- `059-17-restored-green-78ea75e2-8b6a-4f92-96b4-6a922827fb87/`:
  final actual exit0, **480 passed / 0 failed / 4 skipped**; 92 consumer units,
  219 native comparator/reader units, 19 unchanged read-only chamber units,
  150 unchanged synthetic admission units. Producer/browser tests disabled
  explicitly with `AIRLOCK_CHAMBER_QUALIFICATION=0`.

Each directory retains actual Vitest `results.json` and observed command
status/signal/chronology in `command.json`. No command exit was invented.
Targeted ESLint on all five owned JS implementation/test files and
`git diff --check` passed. No build, install or producer execution was needed.

### Parent retained-input checkpoint

The parent independently reproduced all 480 tests (four producer/browser
opt-ins explicitly skipped), focused lint and unchanged-live-guard
source/original verification. No new browser qualification was needed.

Actual subprocess-close witnesses in `059-17-retained-diagnostics-1/`
recorded exit1 for both existing source pairs: Meta 598 ms, one native attempt
versus one chamber request and three URL/query/resource-type differences;
Google 564 ms, ten versus one and fourteen differences including nine missing
requests. Both source-validation gates passed. Private comparison/report/
completion hashes and all original native, chamber, command, authority and
spent-slot hashes were independently verified unchanged.

Three matched actual-input controls then returned exit2 with no completion:
`059-17-retained-diagnostics-outer-exit-1/` substitutes an explicitly synthetic
negative copy of the outer witness with exit2; `...-missing-outer-1/` supplies
a nonexistent outer handle; `...-spent-reference-1/` supplies the actual spent/
incomplete inspected-stock report/capture/completion. The first two reject at
outer completion after native validation; the last rejects at native source.
The ordinary retained pair is their nonempty source-positive control, not
a manufactured native-parity pass.

All runs were read-only/offline with no SDK, producer, browser, public/vendor
network, source GET or new reservation. Differing cohorts/inputs/consent/
transport/endpoints and unavailable full native evidence remain explicit.
These are actual diagnostic outcomes, not source-lease renewal or replacement
acceptance. Independent checkpoint reviews remain pending.

### Compliance correction handoff (2026-10-21)

Addressed both findings from compliance `dba3b655` turn0, without changing the
legacy `runNativeComparison` path or the chamber producer:

- The strict native reader now reconciles the fixed guard fixture and
  `http_tripwire` observations against the report's actual-attempt/abort/
  zero-arrival evidence: row counts, categories, case, loopback URL/path
  relationships, methods/types, abort versus local fulfillment, original
  generated-fixture digest and receiver records. Asserted counters alone no
  longer qualify a missing control observation. Synthetic recorder-shaped
  fixtures now mirror the producer's HTTP/process paths, XHR and 500 ms guard.
- Tree inspection now uses owned `opendirSync` handles with `bufferSize: 1`,
  checking the deadline and global entry limit during traversal. Every handle
  closes in `finally`, including on width/deadline failure. Only the at-most-80
  collected identity snapshots are sorted for stable recheck; a wide directory
  is never materialized with `readdirSync`.
- Added 34 native controls across both profiles, explicitly deleting guard
  observations with ordinals/counts and all descriptor/completion hashes
  refreshed, plus three real local-FS tree controls. The small-tree positive
  precedes width/deadline negatives; instrumented actual directory handles
  prove bounded name consumption, finite buffering and closure on failure.

Private session evidence (relative to the existing `files/` directory):

- `059-17-compliance-red-00f632ee-c0b1-42b9-88ea-0ce4857e806f/`:
  actual exit1, 3 passed / 36 failed before implementation. Both reconciled
  guard deletions were accepted; the old width walk materialized 166 names
  and the deadline control incorrectly reached `tree_limit`.
- `059-17-compliance-guard-removal-17cff42a-bfa2-48c0-8d76-442c7382b155/`:
  removing the new strict guard-reconciliation call made both refreshed-hash
  deletion tests fail (actual exit1 / two failures). The call was restored.
- `059-17-compliance-restored-green-1919ba0b-0d74-4c42-bf54-11021bd6bb53/`:
  actual exit0, **348 passed / 0 failed**, the smallest affected suites:
  253 native comparator/reader and 95 consumer/IO tests. All 37 new controls
  pass. Targeted ESLint on the four corrected JS files and whitespace checks
  passed. Each evidence directory retains real results and command witnesses.

The parent retained-input checkpoint above remains preserved as historical
evidence from the preceding source closure. Parent-owned corrected-source
reproduction subsequently passed 517 tests with four producer/browser opt-ins
skipped and focused lint. Actual retained diagnostics in
`059-17-retained-diagnostics-2/` again returned exit1 with both source gates:
Meta 694 ms (one versus one, three differences) and Google 648 ms (ten versus
one, fourteen differences including nine missing requests). The matching
`...-outer-exit-2/`, `...-missing-outer-2/` and `...-spent-reference-2/` controls
returned exit2 with no completion at their intended gates. Source snapshots
and all original native/chamber/command/authority/spent-slot hashes remained
unchanged through actual process close.

Compliance rereview passed both corrections, retaining the initial findings
and failed controls. This correction used only local
synthetic tests/FS and read-only producer/evidence inspection: no producer,
SDK, browser, network, authority or reservation action. The separate
parent commands were offline consumers only. No API/CLI/exit semantics or
acceptance claims changed; craft/architecture/checkpoint reconciliation remain
required before aggregate DoD closure.

### Final code-review checkpoint

Compliance, craft and architecture passed. Craft identified a nonblocking
startup classification error: an expired import/startup clock became
`invalid_options`/exit3. A new direct-CLI synthetic-clock unit first failed
with expected2/actual3; the minimum catch now preserves deadline failures as
inconclusive/exit2 while malformed options remain invalid_input/exit3.
The unit covers 9,999/10,000/10,001 ms; it is not an actual ten-second expired
command or producer qualification. Craft confirmed the narrow correction.

The final parent suite passed **518 tests, four producer/browser opt-ins
explicitly skipped**, plus focused lint. Final-source actual diagnostics and
three rejection controls are preserved in the `059-17-retained-diagnostics-4/`
family; earlier source closures remain historical. Both source gates and the
same literal differences were observed. The independent caller also checked
post-exit completion-declared output hashes, stdout/report equality, exact
counts and all non-equivalence/false-claim flags. All original source/command/
authority/spent-slot hashes remained unchanged. No SDK/browser/producer/
public-network/new reservation occurred.

Architecture found no blocker or leanness concern: existing ADR-0040/0034
framing suffices and no new runtime capability decision is needed. No
reviewer command/test/rehash or future producer exit is invented.

### Reconciliation sweep

- **Updated:** this open slice, 059 overview/plan/tasks, 060 plan, architecture,
  the new diagnostic guide, the existing native-comparison guide and live
  chamber-capture guide. Attempt diagnostics remain distinct from complete
  native wire and actual replacement; the old comparator API is unchanged.
- **Preserved:** initial missing-export/source-shape failures, both compliance
  blockers, real guard-removal failures, the startup unit red and each old
  source-bound retained-input run. Corrections never requalify the spent stock
  reference or relabel a chamber/native producer.
- **Architecture/leanness:** one shared bounded IO/JSON leaf serves two
  readers; fixed profiles/baseline and source-specific validation, no general
  proxy, driver, normalization framework or public runtime API. Architecture
  review confirms existing decisions cover this reference-only integration.
- **No-op:** production/core/connectors/build/dependencies/frozen contracts,
  release/version/distribution, conventions, Accepted decisions, closed
  records and Adobe's work. The original live-guard source/original index
  independently remained valid; no new browser qualification was needed.
- **Memory/inbox:** persisted actual-control/counter reconciliation and
  pre-allocation directory bounding lessons. Memory has 36 learnings/32 terms;
  existing people opt-out unchanged. No inbox item is resolved by this
  attempt-layer tool. UC coverage has no missing/dangling links; nine
  pre-existing infrastructure orphans remain advisory.
- **Still open:** complete live native reference and complete qualified
  native/chamber consumer, equivalent inputs/consent/cohorts, full product
  implementations, C2/C3 and vendor outcomes. Original Meta stock stays
  spent/inconclusive; dependent Meta chamber stays blocked and the other
  three slots unused. No retry, new authority namespace or candidate
  substitution follows; fresh explicit owner authority is required.
- **Lifecycle:** frame, code and checkpoint reconciliation passes are
  recorded; the derived board is regenerated by its helper. The independent
  reconciliation review found no additional deviations or scope expansion.
  Final gated commit/DONE close-out follows. This closes only the named
  offline prerequisite, not the full vendor goal or first-product readiness.

### Close-out (post-DONE)

- [x] Keep complete native wire, equivalent cohort/input/consent, actual
      replacement, full consumer, C2/C3 and vendor outcome residuals open.
