---
status: DONE
dependencies: [058-03, 059-13, 059-14, adr-0033]
last_verified: 2026-10-20
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-16 - SDK-absent chamber capture qualification

**Goal:** An operator captures a real first-party chamber's serialized
input/output and local HTTP result, with source/native-absence provenance
that cannot be confused with a native reference or a complete replacement.
The fixed local path can proceed while separately approved live cases await
fresh external setup facts.

This delivers a capture/qualification adapter prerequisite named in the
[first-journey plan](plan.md#first-journey-readiness-checkpoint---2026-10-16).
It does not implement the product slices, grant a vendor event or produce
whole-wire/native parity from legacy subset connectors.

**DoR:**
- [x] 058-03 and 059-13/14 provide strict comparison, local admission and
      actual-browser receiver-control prior art; their closed records are
      not amended.
- [x] Existing EDS boots accept a test endpoint override without a public
      API change (`adapters/eds/index.js:846-858,1203-1223`).
- [x] The actual runtime constructs module workers, posts init/events and
      dispatches worker results on the host (`core/airlock.js:337-379,429`).
- [x] A private SDK-absent current-source probe built through `buildAirlock`
      and observed two genuine browser workers, serialized messages and two
      literal-loopback sink requests, with owned resources closed. The
      initial CommonJS-import failure is retained separately.
- [x] No live vendor, SDK initialization, source download, account mutation,
      original case reservation or production/core change is needed.
- [x] The proposed capture/qualification frame passes independent review
      ([frame verdict](reviews/slice-16-frame-critique.md)); implementation
      and actual control qualification remain outstanding.

**Acceptance Criteria:**

1. **One fixed local executable.** A closed entry builds current first-party
   assets into new private scratch and runs the actual exported Meta/Google
   EDS boots with synthetic identifiers and literal-loopback endpoint
   overrides. Use the existing unmodified loopback-confined launcher and
   resolver denial. Source graph, assets, fixture, browser/dependency/cohort
   and helper identities are explicit. No arbitrary URL/program/asset/
   driver interface, live mode, SDK fallback or private owner input.
2. **Actual chamber provenance.** Observe actual browser worker targets
   independently of page instrumentation, their loaded source identities
   and worker-global execution. Capture original structured-cloned
   init/events/result traffic without changing its values. Link one public
   `push({event,...})` input through its serialized batch, genuine worker
   result and host request. Main-only mapping, a fake worker marker or
   a received HTTP request alone cannot establish this chain.
3. **Source/native absence.** Fulfill/serve only the exact built first-party
   graph and generated harness sources. Unknown source/target/surface stops
   qualification before further execution or with an explicit gap. Native
   facade presence/absence alone is not a source proof: a future first-party
   facade may legitimately expose vendor-compatible globals. A controlled
   first-party forbidden-source marker has enforced/bypass evidence without
   loading any official vendor bytes. Do not claim a generic proof about
   arbitrary unreviewed bundles.
4. **Original local HTTP capture.** Install observation before navigation,
   preserve actual URL/query order/duplicates, method/resource type, body
   state, available final headers, response status/ordered headers and
   original body, and compare with the independent receiving sink. Local
   script/fixture loads and emitted measurements stay distinguishable.
   Unavailable required originals are inconclusive, never empty/replayed/
   expected-value substitutes. Legacy Fetch versus native Image is recorded,
   not normalized into equivalence.
5. **Falsifiable source and worker controls.** Both vendor paths have
   nonempty matched real-worker/local-sink positives. Fixed negatives cover
   main-only emission that still reaches the same sink, dropped event-batch
   delivery, forbidden source, missing/changed source pins, output collision,
   incomplete original and failed/deadline cleanup. Each intended failure
   links to a passing positive and is not a confounded transport failure.
   Removal of the worker/source proof must make its control fail.
6. **Distinct closed producer and reader.** Emit a versioned private chamber
   capture report and raw evidence, plus a read-only strict qualification
   inspector. Source/event/worker/HTTP relationships and digests are checked;
   empty or stale evidence fails closed. State `legacy_subset_source: true`,
   local-only scope and false native/vendor/full-replacement/attribution
   claims. Do not fabricate a native producer report, rename this source to
   `local_complete_sequence` to bypass worker checks, or change the existing
   comparator to accept it as native/whole-wire evidence. Integration into
   a later qualified native/chamber consumer remains explicit unfinished work.
7. **Finite private lifecycle and true completion.** One absolute at-most-
   sixty-second cohort budget covers build, browser, accepted observation,
   cleanup and publication. Bound at most 64 observed requests, 2 KiB URLs,
   64 KiB request headers/body, 2 MiB response and 8 MiB original retention.
   Keep guards and failed-close ownership through cleanup, settle observers,
   close only owned resources and retain available failed originals.
   Exclusive private output rejects unsafe/existing paths. Producer snapshots
   do not attest future exit; independently observe command completion and
   source/report/capture digests. Do not create any original owner journal,
   native authority, Servo approval, deployment or live-window reservation.

**DoD:**
- [x] Witnessed red-to-green validation and actual SDK-absent worker/sink
      positives and intended negatives pass on the exact current source.
- [ ] Frame, compliance, craft, architecture and checkpoint reconciliation
      reviews pass; reviewer findings and failure originals are preserved.
- [x] Operator guide and plans identify this source as local legacy subset
      qualification, not full vendor/chamber/native support.
- [x] Existing comparator/admission/browser/native-preparation behavior is
      preserved; original live-case gates and budgets remain untouched.

**Anti-horizontal-phasing check:** The operator gets a complete built-boot to
real-worker to local-receiver to private-qualified-receipt path, not a
parser-only milestone or a substitute for the eventual product replacement.

## Assumptions

- Unverified: actual browser target observations, pinned built sources and
  structured-clone trace can distinguish the real worker path from a
  main-only emitter under the fixed fixture. The receiving main-only control
  must falsify that claim; page-created markers alone are insufficient.
- Unverified: all required original local response observations and source
  events can be retained within the fixed lifecycle budget without changing
  actual host/worker behavior. Missing originals or ambiguous relationships
  stop qualification.
- Current qualification is for explicitly reviewed first-party build inputs,
  not arbitrary injected code. It neither proves absence of all imaginable
  embedded SDK implementations nor authenticates external source ownership.

### Deviation log (after reconciliation)

Initial implementation is on disk, not accepted. The first compliance pass
returned needs-changes: equal empty/invalid response originals could evade
semantic checks; the publication control bypassed the ordinary publisher;
pending browser acquisition could escape ownership; and the full-command
deadline ended before final publication/inspection. All four require
correction, witnessed regressions and fresh exact-source qualification.
The initial verdict is preserved; earlier self-inspection passes are not
accepted evidence for the missing controls. The corrected implementation
uses canonical original/framing checks, one shared publisher, retained late
browser ownership and a whole-command clock with external post-exit receipts.
A real guard-removal mutation published 387 ms late and failed the control;
exact source was restored before the new three-cohort qualification.
Compliance re-review passed. The subsequent craft pass found an additional
failed-producer gap: the parent sent SIGTERM without observing termination
or escalating, so an owned browser could outlive the command. that correction and a real producer-abort control were required. The final
implementation verifies process birth/image/group/user and private-profile
ownership, observes bounded TERM/KILL escalation, handles vanished-PID races
and records final resource closure separately from initial failure.
The actual abort retains SIGKILL, left-behind state and rejected qualification;
the first unknown abort is unchanged, with a separate later cleanup sidecar.
Fresh final normal/cleanup/publication/abort whole-CLI receipts are
8.788/50.617/55.738/3.991 seconds, all within sixty seconds. Compliance
and craft delta reviews, architecture and checkpoint reconciliation passed.
Initial verdicts and all earlier source-bound outcomes are preserved;
original acceptance criteria remain unchanged.

### Reconciliation sweep

- **Updated:** this slice, overview/plan/tasks, operator guide and architecture
  distinguish the local legacy producer from native/whole-wire acceptance.
  The guide records 50s cleanup, 55s publication, 57s producer and 60s absolute
  limits, real late acquisition/abort controls and separate whole-CLI receipts.
- **Preserved:** initial compliance/craft findings, genuine publisher-removal
  failure, unknown first abort and its separate cleanup sidecar. Initial TDD
  red exists only in the implementer's tool transcript; later correction
  reds, green runs and external post-exit receipts have retained private files.
  Earlier source cohorts are historical, never silently repinned.
- **No-op:** production/core/connectors/build, frozen contracts, dependencies,
  native comparator, original authority/journals, closed specs and Accepted
  ADRs. No public capability or new load-bearing decision beyond ADR-0033's
  existing non-substitution rule; no new ADR or convention change.
- **Leanness:** two new code/test files, a fixed operator interface and no
  arbitrary program/URL/source plug-in, live switch or reusable authority.
  Binary graph encoding and process-lifetime checks directly serve required
  original/provenance/closure controls, not a new runtime framework.
- **Memory/inbox:** persisted the demonstrated pending-browser ownership
  failure; existing publisher-guard learning was not duplicated. Memory has
  33 learnings/32 terms, with the existing people opt-out unchanged.
  No directly resolved inbox item. Coverage has no missing/dangling use case;
  nine existing infrastructure orphans remain advisory, not part of this work.
- **Still open:** complete native stock, actual replacement implementations,
  qualified native/chamber consumer integration, C2/C3 and product/matching/
  attribution evidence. Fresh Meta setup confirmation remains unavailable.
  All four live slots remain unreserved/unspent; no source deployment,
  vendor SDK event, new source GET, live window or Servo approval occurred.
- **Review checkpoint:** final compliance, craft, architecture and
  checkpoint reconciliation pass within this local-only scope.

### Close-out (post-DONE)

- [x] Regenerate/check board and preserve the live-admission blockers.
- [x] Native stock, true replacement candidates, complete wire/C2/C3 and
      product/matching/attribution evidence remain separately required.
