---
status: IN_PROGRESS
dependencies: [059-13, 059-14, adr-0035, adr-0038]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 059-18 - Additional lineage-bound Meta stock case

**Goal:** The operator can use the owner's newly authorized additional Meta
stock case without refunding the original spent case or granting arbitrary
retries. The same confined inspected engine either produces complete originals
or preserves a visibly spent/inconclusive result. Routine preparation and
scheduling are autonomous within that one additional case, not repeated owner
questions or an unlimited test budget.

This is a separate authority path under [ADR-0035](../../decisions/adr-0035-additional-one-shot-meta-authority.md),
not an amendment of the original four-case record, ADR-0034 or closed slices.
It serves UC-10 and leaves full native/chamber/product/C2/C3 gates unchanged.

**DoR:**
- [x] Genuine owner authorization at 2026-10-21T18:33:04.581Z explicitly
      answers the request for one additional bounded Meta stock case.
      The exact question/answer is durably private, not synthesized approval.
- [x] Original authority and actual consumed Meta reservation were rechecked
      by SHA/device/inode without modification. Actual original stock outcome
      remains spent/inconclusive; zero forwarded HTTP is not a refund.
- [x] Shared engine/journal/physical guard exist and have prior exact-source
      SDK-absent qualification. New code invalidates their old source leases.
- [x] Current Adobe status reports no conflict with code/SDK-absent local
      qualification, not a live hold, current quiescence or resource exclusion.
- [x] Paired ADR/slice frame review passed and ADR-0035 is Accepted.

**Acceptance Criteria:**

1. **Closed additional scope.** Accept only the fixed additional Meta grant
   for this genuine decision, with one init/PageView, native-default consent
   and all existing eight-request/64-observation/byte/60-second limits.
   Its authority is Meta-only; original/synthetic authority paths retain their
   existing behavior. Reject arbitrary IDs, extra keys/cases, copied original
   records, enlarged budgets, consent override and future/repeated grants.
   No general authority registry, arbitrary program or override flag.
2. **Immutable original lineage.** Bind the original authority and actual
   spent Meta reservation with canonical private handles/hash/device/inode,
   verify their closed content and exact authority/case relationships, and
   keep them snapshotted through admission, reservation, source continuation
   and cleanup/publication. Missing, unspent, malformed, unrelated, replaced
   or changed lineage fails closed. Never write/reset/delete/refund the
   original authority or slot, and do not borrow a chamber/Google slot.
3. **Additional canonical consumption.** Bind the additional authority's own
   path/hash/device/inode and fixed canonical slot to the exact source/input/
   inspection/window case. Reserve durably before any SDK execution; concurrent
   attempts have one winner. Failure, interruption or zero HTTP is spent.
   Changed output, copied permission, another namespace or repeated preparation
   cannot renew it. Direct journal/engine callers cannot widen this scope.
4. **Honest permission and delegation.** Bind the new owner-decision evidence
   and a separate additional inspected permission, explicitly distinguishing
   the prior original slot already spent from the new slot not yet consumed.
   Preserve all prior transport/privacy exceptions and strict upstream TLS.
   Record operator-selected finite timing under owner delegation, not an
   invented exact owner-chosen timestamp. Pre-admission rescheduling requires
   fresh bindings/receipts and actual coordination; no silent hold extension,
   expired evidence reuse or rescheduling after consumption.
5. **Reuse without native bypass.** Use the existing prepared-plan/private
   lease, confined browser, shared physical semantic/count/response guard,
   retained source-pair selection and complete-capture/cleanup/publication
   path. Existing stock CLI stays disabled. Source, setup, original-location,
   independent frame/compliance/craft/architecture/reconciliation and actual
   nonoverlap/resource gates remain required. A new grant does not fabricate
   settings readback, SDK consumption, socket closure or vendor acceptance.
6. **Qualify the new path itself.** Witness TDD for new journal/engine cases,
   including refreshed-hash semantic lineage controls, candidate/Google
   refusal, concurrent one-winner reservation, mutation before/after prepare/
   reservation, changed copied location, spent additional slot and receipt/
   source mismatches. Actual SDK-absent local H1/H2 positives must traverse the
   additional lineage/reservation path; local fixture evidence alone can never
   supply a native lease. Bind their source/original/actual-exit/closure proof
   to the new native gate. The existing fourteen-controller/eleven-relay
   coverage is refreshed, not silently relabelled as coverage it lacks.
   Removing an actual additional-authority guard must defeat its regression.
7. **Preserve surfaces and evidence.** Keep complete producer/source/test/
   driver/dependency closure, original HTTP bytes and public/private
   separation. Tests, new source helpers and qualification readers must cover
   every added dependency. Invalid data and failed IO stop explicitly; no
   wildcard, success-shaped fallback, fabricated reference or returned
   expected payload. Historical failures/indices remain intact.
8. **Bounded actual operator result.** After actual required reviews and
   current-source qualification, the parent may prepare one finite additional
   case under the delegated timing scope, separately coordinate before live
   effects, and execute only if all actual gates pass. Preserve actual exit,
   original hashes, complete resource disposition and explicit cleanup/abort
   handoff. Missing readiness aborts before admission; a spent case is not
   retried. No source download/account/campaign/billing/site mutation,
   fabricated click, Google/chamber/production inspection or product/C2/C3/
   vendor outcome follows.

**DoD:**
- [ ] Witnessed red/green, mutation and genuine additional-path SDK-absent
      controls and full refreshed shared-guard originals pass.
- [ ] Required code/frame/architecture/checkpoint reconciliation passes clear.
- [ ] Operator guide/open plans/architecture distinguish original and new
      authority, autonomous finite timing and unresolved product evidence.
- [ ] Parent records actual additional result or concrete pre-admission
      blocker, without minting another grant or hiding consumed authority.

**Anti-horizontal-phasing check:** The operator gets a complete new-approval
to canonical-consumption to guarded stock result path, not a parser-only
authority feature or permission to skip native preparation.

## Assumptions

- Unverified: closed additional lineage checks and canonical reservation can
  preserve both the original spent record and a single new winner across file
  mutation/concurrency. SDK-absent actual-path controls must falsify this.
- Unverified: the pinned complete native chain fits the unchanged physical/
  byte envelope. Unknown behavior remains inconclusive; no budget is inferred.
- Unverified: a fixed supervised native child, case-owned temporary root and
  pre-exec launcher rendezvous can preserve acquisition ownership and finite
  abort disposition before BrowserServer returns without widening confinement.
  Proposed ADR-0038 and same-path SDK-absent falsification must establish this;
  the existing local-only proof does not.

### Deviation log (after reconciliation)

Implementation handoff (2026-10-21; independent reconciliation still pending):

- Closed additional authority, original spent-lineage validation, separate
  permission/delegated scheduling, descriptor-identity canonical consumption
  and a required additional-path qualification gate are implemented. The
  controller/journal/qualifier share the unchanged strict JSON/data validators;
  all added helpers/tests are included in the source closures.
- Witnessed initial red: 43 new controls failed before the implementation.
  Further direct-journal/source-closure and qualification-original controls
  also failed before their guards. Removing the actual spent-parent semantic
  guard made the refreshed-hash unspent-parent regression fail; its exact
  source bytes were restored.
- Initial handoff closure regression: **557 passed, 33 opt-in skipped** across twelve
  files; repository lint and whitespace checks passed. Additional qualification:
  **25 passed**, including actual fixed SDK-absent H1/H2 positives and three
  post-reservation original/grant/slot replacement controls. Each positive
  child exited 0 with one complete original response and all sixteen closure
  flags true; the three mutation children exited 2 with irreversible synthetic
  consumption and complete cleanup. No native authority was derived.
- Preserved failures: an initial outer qualifier rejected successful H1/H2
  children because it expected eighteen rather than sixteen cleanup fields.
  An intermediate race harness mutated too early for output originals, and a
  reservation replacement exposed the need to retain the journal descriptor's
  identity rather than re-discovering it. These original failed runs remain
  intact; corrected current-source runs are separate, not rewritten retries.
- Private `059-18-*` red/green/mutation, child-exit, final-original and closure
  witnesses are retained by the coordinator. The final read-only check matched
  the genuine original authority, spent slot and decision by SHA/device/inode.
  No real owner grant/permission/slot/output or native window was written,
  no SDK/public-provider/source-download work was executed, and no shared
  browser resources were used.
- Deliberate handoff boundary: full refreshed fourteen-controller/eleven-relay
  originals, independent reviews, actual coordination and the bounded actual
  operator result/pre-admission blocker remain with the parent. Prior shared
  indices are historical after these source changes; the new native gate
  still requires a current shared index as well as current additional proof.
  All DoD boxes remain unticked because their complete obligations are not
  yet met. No product/C2/C3/vendor acceptance or further grant is claimed.

Same-task AC6/7 compliance correction (2026-10-21):

- The reviewer correctly found that the new reader trusted response/wire match
  flags and accepted empty placeholder request/response originals. Correction
  derives request fields with the existing strict wire observer/policy and
  checks complete request/response, ownership, logical/Network/Fetch, ordered
  headers, bytes/framing, actual protocol and both endpoint wire relationships.
  Response parsing is deliberately closed to the fixed SDK-absent normal H1/H2
  positives; no shared physical parser, limits, catalogue or policy changed.
- Regression fixtures now produce complete first-party bytes through the real
  shared observer. The old placeholder proof explicitly rejects. Seventy-four
  refreshed-hash request/response/correlation/wire/protocol contradictions are
  also applied to independent copies of the genuine H1/H2 packet/causal proof;
  the real captures and each failed archive remain intact.
- Initial correction red exposed 74 semantic acceptance failures and one
  frozen H2 test-array mutation error; the latter was corrected by copying
  serialized fixture data. Removing the real new broker/original wire-hash
  comparison then defeated both H1/H2 regression assertions. Exact source
  was restored before qualification.
- Corrected-source closure: **632 passed, 33 opt-in skipped**, repository lint
  passed. Actual additional suite: **100 passed**, including genuine H1/H2
  positives, 74 retained genuine-derived negative archives, and three actual
  post-reservation mutation controls. Private `059-18-correction-*` artifacts
  retain red/green, mutation, command exits and final original/closure checks.
- All earlier additional-path and parent-refreshed shared fourteen/eleven
  indices are historical after this correction. Parent owns renewed reviews,
  final shared requalification and actual operator result/blocker; the slice
  remains IN_PROGRESS with every DoD box unticked. No real native authority,
  window, slot, SDK, source download or public-provider effect occurred.

Same-task craft reservation/runner correction (2026-10-21):

- The reviewer correctly identified that the qualification reader checked
  reservation relationships without closing its schema, prerequisite marker
  and timestamp. It now validates the exact journal record/version, requires
  the false bookkeeping-only prerequisite marker and a safe integer reservation
  time inside the case window and strictly before recorded cleanup/publication.
  The passing packet/causal/protocol reader boundaries are unchanged.
- TDD red: 30 reservation schema/timestamp contradictions were accepted despite
  refreshed handles, and a real startup child failed through incidental ENOENT.
  The runner now classifies a failed child immediately after preserving its
  actual receipt, before opening absent originals. Its fixed program/API scope
  is unchanged.
- Fifty refreshed-hash H1/H2 reservation controls check expiry, window start,
  cleanup/publication chronology, missing/wrong schema and marker, extra keys
  and every identity/digest relationship, using valid genuine-derived packet
  baselines. Every failed archive and genuine capture is retained independently.
  Removing the new before-cleanup guard defeated both protocol regressions;
  exact source was restored before actual qualification.
- Craft-corrected actual suite: **151 passed**, including genuine H1/H2,
  74 original controls, 50 reservation controls, three post-reservation
  replacement children and a real failed-startup control. Affected controller/
  journal/qualification units: **264 passed, 19 opt-in skipped**. Repository
  lint passed. Private `059-18-craft-reservation-*` witnesses retain red/green,
  mutation, actual exits and final original/closure evidence.
- The parent's conditional real additional records are outside this correction
  and were not read or modified. All earlier indices are historical after this
  source change; parent owns review verdicts, final shared fourteen/eleven
  qualification and actual case preparation/admission. Slice and DoD state
  remain unchanged. No real slot, window, SDK/source download/public-provider
  action, commit or review transition occurred.

Same-task architecture supervision correction (2026-10-21):

- The reviewer correctly identified that execFile's 60-second SIGTERM timeout
  could await Playwright's graceful shutdown indefinitely. A fixed mandatory
  additional-case supervisor now reserves bounded TERM/STOP/KILL, ownership
  observation, process/profile/port/key cleanup and receipt time within the
  unchanged case's absolute window. It observes Node exit rather than awaiting
  pipe/browser close indefinitely; missed closure is explicit and unqualified.
- Pending launch, verified Node/listener ownership and launch-created profile/
  browser lifetime are durably registered before problematic shutdown. Signals
  use fresh birth/image/UID/group checks on specific PIDs. Only the pinned
  launcher exec chain and the exact ancestry-bound observed Chrome startup
  auxiliary are recognized; no global/name-based/shared-MCP actions occur.
  New helper/tests are covered by the fixed complete source closures.
- New supervision tests were red before implementation; missing/failed
  supervision and open ephemeral-key receipts also defeated the old reader.
  Removing the actual pre-signal birth check defeated its regression. Exact
  final source was restored before qualification.
- Actual failure is not startup-only or a selected error: owned Chromium and
  first-party originals are acquired, originals saved, Chrome actually stopped
  and Node SIGTERM actually ignored. Parent TERM/KILL escalation then observes
  every recorded process stopped, private profile and ephemeral keys removed,
  and endpoints closed. That forced case stays unqualified with SIGKILL,
  while matched supervised H1/H2 qualify. Previous authority/journal/semantic
  reservation and packet comparisons are not relaxed.
- Final source: **697 passed, 34 opt-in skipped** in thirteen closure unit
  files, repository lint passed, **166 passed** in the actual additional
  suite. Private `059-18-supervision-handoff-*` / `handoff-v1*` witnesses bind
  actual commands, current-source registrations, originals and final cleanup.
- Historical local failures remain intact: two early acquisitions before
  complete browser registration retain **unknown browser/profile and unregistered-key disposition**,
  not a claim of closure. Another registered stopped-browser failure required
  an exact birth/image/group/UID/profile-checked late recovery; its original
  unqualified receipt is unchanged. The unknowns are an explicit parent
  resource-handoff caveat before any global clearance/live admission claim.
- All previous indices remain historical after this source change. Parent owns
  review verdicts, shared fourteen/eleven refresh, resource coordination and
  the actual operator result/blocker. Real additional records were not read
  or modified; no native SDK/public-provider/source download, real slot/window,
  agents, commit or review transition occurred. DoD boxes remain unticked.

Same-task architecture reader-semantic correction (2026-10-21):

- Final Node group inventory is now mandatory and semantically equivalent to
  the producer's closed predicate: empty means absent; any listed row must be
  the same recorded Node lifetime/parent/group/UID/birth in kernel zombie state
  with final `"zombie"`. Live/unknown/missing/malformed/unrelated rows cannot
  hide behind closed/qualified flags.
- All six ownership registrations are closed, ordered and bound to final
  Node/browser/profile/member/port/key identities and chronology. The reader
  validates the pinned launcher's legitimate exec transition before ready,
  then exact final Chrome command/profile ownership, full member ancestry and
  inventory. Acquisition precedes producer cleanup; final ledger follows Node
  exit. Producer changes only record the observed root command, existing exit
  timestamp and final ledger—finite termination design/policy is unchanged.
- TDD red reproduced **82** refreshed-hash contradictions. Complete unit
  baselines now include ownership facts, empty/zombie inventories and a valid
  launcher transition; no phase-label-only passing fixture remains. Both
  genuine H1/H2 proofs are independently copied for 82 retained reader controls;
  original manifests, journals and evidence remain unchanged.
- Removing the actual new final-Node-disposition guard defeated both protocol
  regressions; exact source was restored. Affected unit/controller/journal
  suites: **361 passed, 20 opt-in skipped**. Repository lint passed. Final
  actual additional suite: **249 passed**, including current-source H1/H2,
  stuck shutdown and 206 retained contradiction archives. Private
  `059-18-supervision-reader-*` artifacts preserve red/green/mutation, actual
  exits and post-exit original/closure checks.
- The first actual attempt on this source was correctly refused by the existing
  `additional_group_unanchored` supervisor guard, with closed resource
  disposition but unqualified evidence. It remains a failed original. A fresh
  finite SDK-absent attempt on unchanged source passed; no guard was relaxed or
  failed proof overwritten.
- Earlier unknown profiles remain a separate historical/operational readiness
  issue. Parent's reported absence/proxy/SPKI checks do not become retrospective
  profile closure or all-lane quiescence. No such profiles or real additional
  records were inspected/changed here. Parent owns key cleanup, operational
  scope review, shared fourteen/eleven refresh and actual admission/result.
  Slice remains IN_PROGRESS, DoD unticked, with no SDK/public/real-case,
  commit, agents or review transition.

Parent reader-source checkpoint before the later ordering fix (2026-10-21):

- Parent validation passed **780 units / 34 explicit opt-in skips**, targeted
  lint, strict current additional-path inspection and the refreshed shared
  fourteen-controller/eleven-relay proof (**99 controller / 352 regression**,
  strict original/source verifier exit 0). The parent checked **4,496**
  post-exit original/command-witness hashes and device/inode identities.
  These results supersede no historical failed proof; prior source-bound
  indices remain historical.
- Architecture reviewer `4ee56ebe` turns 0-2 passed the finite-supervisor and
  final-inventory/identity-registration corrections. Compliance reviewer
  `173fe812` turn 2 confirmed AC1-7 continuity across those later deltas.
  These are read-only reviews with no reviewer execution or rehash claims;
  final craft continuity and checkpoint reconciliation are separate gates.
- The parent created conditional additional grant/inspection data on their
  own fixed private identities. No executable case permission, additional
  slot, native SDK execution or selected live window exists. The prospective
  20:30 proposal was withdrawn before any hold or admission.
- Four exactly attributable early temporary private keys were removed under
  verified ownership. Historical browser/profile dispositions remain UNKNOWN.
  Named-panel closure and dated exact Node/proxy/SPKI-root absence are not
  current all-helper quiescence, host closure or process/profile authority.
  The Adobe lane's current-helper/finite-hold gate remains its own obligation.
  The independent current-helper scope assessment found that the requested
  whole-helper quiescence cannot be proved from the retained ownership records:
  two early ledgers lack an acquired browser/group/descendant anchor. Newer
  successful cleanup does not fill that active-process evidence gap. Supported
  retained no-acquisition or attributable lineage/termination evidence would
  be needed; repeating marker checks or deleting historical directories is
  not a substitute. No hold is requested and no broader cleanup authority
  follows.
- The genuine 14:52 owner setup report and 18:33 additional authorization
  remain dated facts, not renewed settings/API readback. The authenticated
  runtime acquisition's overall failed socket-cleanup outcome is preserved
  separately from its completed authenticated body. No fresh GET/init is
  inferred as preflight permission.
- The operator result/pre-admission blocker and remaining DoD boxes stay
  open. This is a reviewed-code preparation checkpoint, not AC8 completion,
  native/chamber acceptance, full replacement or C2/C3 proof.

Same-task craft turn-2 discovery ordering correction (2026-10-21):

- Polling and browser-ready discovery could overlap while the first acquisition
  had inserted ownership but not finished group inventory/publication. A local
  promise chain now serializes that real operation. Every caller still scans
  afresh; rejection is propagated, not ignored. No new abstraction/API/program,
  phase-order relaxation, signal/escalation or deadline-policy change.
- The deterministic pure-unit regression drives the real supervisor with
  process/OS/TCP doubles and a held inventory barrier, not copied discovery
  logic. It witnesses early acknowledgement before the fix and requires proper
  ordering, launcher exec continuity and late-member discovery after the fix.
  Simulated exit is 2/qualification false. No real child, browser, socket or
  signal is used. Removing the real queue defeats the regression.
- Pure red exit 1, green exit 0, serialization-removal mutation exit 1, exact
  source restored; final helper units **7 passed, 1 browser opt-in skipped**.
  Repository lint passed. `059-18-discovery-serialization-*` private witnesses
  retain actual unit-command exits, not a browser-qualified proof.
- Work resumed at **2026-10-21T21:47:00Z**, invalidating the 21:44 UTC idle
  attestation as a current state. No Chromium/browser qualification/benchmark,
  real record/case/public operation, agents, commit or lifecycle transition
  occurred. Historical failures/UNKNOWN browser profiles are unchanged. The
  preceding parent 4,496/shared/source proof is historical after this source
  change; parent owns review and any separately permitted fresh qualification.
  No browser work is queued and no fresh readiness/resource attestation is
  claimed here.

Parent ordering-source pre-admission code checkpoint (2026-10-21):

- Parent pure validation passed **781 units / 34 explicit opt-in skips** and
  targeted lint. Current shared fourteen-controller/eleven-relay originals
  passed **99 controller / 352 regression** and strict current-source inspection
  after actual outer command exit 0. Earlier indices remain historical.
- The single actual additional suite passed **250 tests**, two files, external
  CLI exit 0 observed at **22:12:56.933532Z**. Current H1/H2 normals qualified
  with complete original responses and resource closure; three mutation races
  exited 2, startup exited 1 and the stuck control ended SIGKILL/9,592 ms.
  Those failure controls remain unqualified with recorded owned cleanup.
  All **206** contradiction archives and their baseline relationships remain.
- The parent independently inspected the additional index and checked **10,051**
  artifact hashes/device/inode identities plus **30** source-file locators.
  Additional/shared/current source vectors match. Genuine original authority,
  spent slot, owner decision and conditional additional records are unchanged;
  additional case permission and canonical reservation remain absent.
- A private observer metadata-save preflight first failed before any Vitest/
  browser execution. Its failure and source snapshot remain intact. A corrected
  non-browser save preflight preceded the single actual suite in a new output
  namespace; there was no hidden actual-case retry or source change.
- Actual compliance, craft and architecture reviewers each confirmed bounded
  ordering-delta continuity at turn 3. The original findings/corrections remain
  recorded; none of these turns is represented as a fresh whole-code audit,
  reviewer command execution or native admission.
- Independent checkpoint reconciliation passed (`8bdd6978`, turn 0), scoped
  only to the IN_PROGRESS code checkpoint, not AC8 or DONE. Current case-bound
  setup/source/resource/nonoverlap receipts, finite timing and the actual
  additional operator result remain open. The stronger whole-helper assertion
  remains unprovable from the early ledgers; a future narrow case cannot
  silently turn that into host closure or clear the Adobe gate.
- All actual SDK-absent commands completed; no further source/test/browser work
  is queued. No native SDK, provider traffic, source GET, real slot, live
  window, finite hold, production change or full-replacement claim occurred.

Native resource preparation finding after the code checkpoint (2026-10-21):

- The reviewed tooling checkpoint is committed as `74fa0cc`. It is not a
  resource-ready native case. A separate as-built native-path review found
  that durable additional ports/pending/browser registrations at
  `rig/inspected-meta-stock.mjs:1443-1454` are local-only, and the fixed
  supervisor admits SDK-absent qualification cases, not native execution.
- Native normal-path browser handles, fresh context, authenticated proxy
  peer, listener/socket/task closure and key-removal evidence are real.
  They do not supply an interrupted-launch browser/group/profile ledger,
  independent Node-failure supervision or positive temporary-profile removal.
  Root-process escalation and sixteen successful flags cannot establish those
  unwritten capabilities.
- Resource-ready admission therefore remains blocked on actual supported
  new-native-case acquisition/abort coverage, including late/interrupted
  browser launch and attributable failure handoff. The existing local proof
  is not relabelled as native supervision. No case permission, finite window,
  hold, reservation or SDK effect is created.
- This concrete new-case gap is separate from both historical UNKNOWN
  dispositions and Adobe's unprovable whole-helper assertion. Neither is
  reopened, cleared or made a historical-directory deletion requirement.
  The parent owns bounded implementation framing under unchanged AC5/8;
  further code/qualification must preserve all original authority, safety
  and source-bound review gates.

### Proposed native implementation contract under AC5/8

[ADR-0038](../../decisions/adr-0038-supervised-native-meta-resource-lifecycle.md)
proposes one fixed native-additional child route and closed ownership-ticket
protocol. It remains Proposed, not design acceptance or native authority.
Original ACs and all historical records above are preserved.
The earlier checkpoint's executed proof and review passes remain valid for
its unchanged source; whole-slice DoD boxes are open because the new native
resource obligations are not implemented or qualified yet.

- Keep inert preparation/private plan and transport capabilities. Parent
  dispatch passes the exact immutable manifest/case metadata, never serialized
  execution capabilities; the child really reprepares and alone consumes
  the original-location-bound additional canonical slot before SDK.
- Register parent-owned temporary root and pending acquisition before launch.
  A fixed pre-Chrome-exec rendezvous must independently attribute the launcher/
  group/profile before acknowledgement, survive engine-Node interruption and
  record late ownership or an explicit unqualified abort without guessed PIDs.
- Bind native common endpoints/inspector key separately from fixture-only
  receiver roles. Resource readiness cannot replace source/setup/review,
  logical/physical policy, strict TLS, immutable lineage or one-shot checks.
- Use the same absolute case deadline, qualified observation/cleanup/publication
  reserves and authoritative parent resource result; never restart the budget
  in the child, promote wire-complete/cleanup-unknown output or refund spend.
- Qualify the **same new orchestration/acquisition branch** with a closed
  SDK-absent counterpart: actual H1/H2, allocated shutdown, genuine interruption
  before launchServer returns, parent disconnect, identity/chronology/deletion/
  source/window negatives and a real guard-removal witness. Synthetic proof
  cannot mint a native lease. Refresh every affected source/helper/test/
  launcher dependency and shared proof after source changes.
- This is preparation work under the existing grant, not permission for public
  SDK/provider activity or broader process/profile action. A focused design
  question received only an unavailable-user/autonomous-work response, not a
  new exact owner acceptance. Independent framing, implementation reviews and
  actual qualification remain required; no live case follows from drafting.

Proposed bootstrap refinement after the Node peer checkpoint:

- Distinguish supervisor P, launching Node E, shell/eventual-Chrome L and
  connecting Node helper H. H's socket identity and membership in L's group
  require their own closed predicate; the direct-peer group-leader rule stays
  unchanged.
- Scope E's TMPDIR before its module startup, not merely the browser launch
  environment. A fixed shell forwards driver arguments unchanged, retains
  FD0-4 across exec and closes FD3/4 only in H. No Node execve/private browser
  hooks, browser-log handshake or unsupported profile option.
- A parent-written enrollment after scoped E/L/H observations may enable
  only TCP. Actual H kernel peer plus revalidated L/profile and durable ledger
  are still required for exec-ready. Loss before attribution must not become
  ownership, exec permission or closed cleanup.
- No implementation/browser readiness is inferred from this refinement.
  Pure parsing/role tests and actual first-party shell/FD/PID proof precede
  separately qualified real Chrome/profile/pre-return interruption controls.
  The earliest launching-Node failure and whole-case timing remain unproved.

Bounded owned rendezvous-peer feasibility checkpoint (2026-10-21):

- This is conservative offline falsification under Proposed ADR-0038, not
  acceptance of that design or implementation/readiness of native dispatch.
  No native plan/lease/transport/launcher, profile or browser was activated.
- Added only a fixed first-party Node/TCP peer primitive/test and its complete
  source-closure pins. Public socket tuples and exact issued-PID `ps`/`lsof`
  observations bind peer to parent/group/UID/birth/image before/after sampling.
  Claimed PID/correlation are not OS ownership; private correlation values are
  never retained, only digests.
- The parent-owned root and issuance are durable before TCP/fork allocation;
  a real child ownership registration/IPC ACK precedes child TCP. Wrong owned
  sibling and forged launcher PID/correct correlation negatives actually
  connect and are rejected by kernel ownership, not a selected mock failure.
  Wrong correlation and connected no-frame timeout controls also execute.
- TDD pure red preceded implementation; **17 pure/source-closure assertions
  passed**. Removing the real kernel-owner check defeats the forged-PID
  regression, and exact source was restored. Private metadata-save preflight
  passed before the one actual fixed Node/TCP CLI run.
- Actual CLI exit **0**, all five controls matched, elapsed **2,955 ms** within
  the fixed 45-second primitive envelope. Both owned helpers exited 0 with no
  signals, empty groups and closed listener/accepted sockets. Private
  `059-18-rendezvous-peer-*` witnesses retain actual CLI close, source vectors,
  original observations and post-exit identities. No unexpected actual failure
  or automatic retry occurred.
- Remaining gaps are actual launcher exec/profile/late acquisition, the native
  child and case contract, disconnect/forced-abort integration and the unchanged
  whole-native 60-second budget. Earlier source proofs are historical; parent
  owns later reviews/qualification and any decision on ADR-0038. Historical
  UNKNOWNs, real records, native authority and slice/lifecycle state are
  unchanged. No browser/SDK/provider/source GET/real grant/slot or wider
  process/profile work occurred; no further work is queued.

Peer cleanup fail-closed disposal correction (2026-10-21; pure units only):

- Compliance turn 4 identified that process-observation failure or a non-ESRCH
  signal error escaped `stopPeer` before parent handle disposal. The caller
  recorded UNKNOWN, but retained stdio/IPC/child handles could defeat finite
  observer return. Parent-handle disposal now runs in unconditional finally,
  attempting each handle even if an earlier disposal fails. Errors are not
  swallowed, UNKNOWN is not relabelled closed, and no unverified identity is
  signalled. No reader or native activation change.
- Deterministic pure regressions execute the real run/stopPeer/caller code with
  a non-exiting child and mocked OS/process/listener boundaries: observation
  error and EPERM were red; both plus changed-identity/no-signal control are
  green. Removing the actual finally/disposal guard defeats all three. Exact
  source was restored. Minimum pure/source-pin suite: **20 passed**, lint pass;
  `059-18-rendezvous-disposal-*` witnesses retain actual command exits.
- No actual Node/TCP helper job, browser/profile, SDK/provider, real record/slot,
  source GET, wider OS action, agents, commit or lifecycle/ADR transition ran.
  The original v1 five-connected kernel evidence is unchanged and useful only
  for its narrow normal path, not failure-budget proof. Current indices are
  historical after source changes; fresh fixed actual peer proof awaits parent
  rereview and explicit coordinated GO. Native/exec/profile/whole-case deadline
  gaps, historic UNKNOWNs and Adobe's gate remain unchanged; no work is queued.

Corrected-source peer checkpoint (2026-10-21):

- The parent independently verified the five correction-receipt hashes/file
  identities and ran **135 pure tests / 15 explicit opt-in skips**, with
  targeted lint pass. Actual compliance/craft/architecture bounded peer-delta
  reviews passed; none is a fresh whole-slice/native audit.
- One separately authorized corrected-source fixed Node/TCP refresh exited
  **0** at **23:44:32.073437Z**, elapsed **2,985 ms**. All five cases actually
  connected with the expected kernel-owner/correlation/frame dispositions.
  Both helpers exited 0 without signals; groups, listener and sockets closed.
  Parent verified **26** current artifact hashes/device/inode identities and
  replayed four actual-observation assessments. The **30** historical v1
  locators and **five** disposal receipts were independently checked unchanged.
- This is normal/frame-timeout Node peer proof, not a real failure-path timing
  qualification. Actual launcher exec/profile, pre-return browser acquisition,
  parent loss, native orchestration and the whole 60-second lifecycle remain
  unproved. ADR-0038 remains Proposed; no native permission, window or slot.
  Old source-bound full browser indices remain historical after this delta.
- No source/test changes occurred during the refresh. No browser/profile,
  SDK/provider/source GET, actual owner grant/slot or historical-UNKNOWN action
  occurred. Independent peer-checkpoint reconciliation passed (`8bdd6978`,
  turn 2), scoped only to this Node/TCP delta, not native readiness or DONE.

P/E/L/H source/pure candidate (2026-10-22):

- Added fixed synthetic bootstrap module/shell/test, closed role-specific
  E/L/H guards and separate TCP-only/exec-ready enrollment. The established
  direct-peer predicate and existing launcher remain unchanged. Only the
  fixed first-party Node FD target is reachable; no Chrome/native dispatcher
  or transport is integrated.
- New source/pure tests passed **42**, with the actual fixture opt-in skipped.
  Author affected tests passed **180 / 17 skipped**, lint passed. Guard removal
  produced two kernel-owner failures and one helper-refusal failure; exact
  source was restored. Parent independently checked **48** command/source/
  observer hashes/file identities and repeated **42 pure / one opt-in skip**
  with targeted lint pass.
- The default affected suite also completed **eight existing Node subprocess
  checks**: four synthetic reservation contenders and four disabled-CLI
  refusals. This is not an all-processes-absent claim. No new P/E/L/H shell/
  Node/TCP fixture, browser/profile, SDK/provider or real-slot operation ran.
- Both complete source closures include all three new files. Earlier
  source-bound proof remains historical after source changes. Actual handle
  identity support, causal FD traffic, launcher exec continuity, earliest
  E-loss and adverse cleanup timing remain unproved. Proposed ADR-0038 and
  native readiness remain open; no actual fixture follows without separate
  review, current coordination and explicit parent go-ahead.

First actual P/E/L/H fixture - failed, stopped (2026-10-22):

- After bounded compliance/craft/architecture source/pure passes and current
  lane coordination, one fixed first-party normal/refusal suite ran. Actual
  CLI exit was **1** at **00:55:59.175785Z**; one test failed and 42 were skipped.
  Normal failed `synthetic_os_observation_failed` after H attribution but
  before TCP enrollment. No exec-ready, target execution or FD round-trip
  was established. The connected refusal case never started.
- Source vectors and all 36 fixed-source hashes stayed unchanged. The producer
  did not retain the precise failing OS command/status/stderr. Root cause is
  therefore undetermined, not proof of unsupported descriptor identity or
  noninheritance. No automatic retry, source change or claimed qualifier pass.
- The scoped post-exit observation at **00:58:05.313436Z** found all five
  recorded lifetimes absent, three recorded groups empty and the exact
  registered endpoint refusing connection. E exited 2; the producer recorded
  one identity-checked H SIGTERM. The matching synthetic fixture directory
  remains retained, not a browser profile; TLS keys were not applicable.
- Parent verification matched **17** original-artifact hashes/file identities,
  **36** fixed-source locators and the private observer. Original authority,
  spent reservation and owner decision remained unchanged; the additional
  case permission/slot remain absent. A read-only parent verifier initially
  compared numeric device/inode values with strings; normalizing those types
  corrected the verifier without changing evidence or rerunning the fixture.
- Retain this failed normal and unstarted refusal outcome. Source-read-only
  diagnosis is the only next assignment; no new OS/helper/browser run follows.
  ADR-0038 remains Proposed; no browser/profile/SDK/provider/native/real-slot
  work or historical-UNKNOWN/Adobe-gate clearance occurred.

Fixed OS-command diagnostic correction - source/pure only (2026-10-22):

- V1 remains FAILED normal / refusal NOT RUN / root cause UNDETERMINED.
  No original receipt, source locator or historical disposition was rewritten.
- The existing helper/callsites now retain immutable case-linked issued/
  completed observations: fixed phase/role/query, expected-not-fresh identity,
  monotonic deadline/timeout data, actual Node status/error distinctions and
  bounded original stdout/stderr bytes/hashes with explicit unavailable and
  truncation markers. Missing Node signal/killed fields remain nullable, not
  fabricated false statuses; four status-precision REDs covered those shapes.
  Errors/results expose command receipt locators.
- Utility-specific absence needs an established owned identity; scoped-child
  absence additionally binds the matching prior process observation. Required
  descriptor/socket absence and observation/signal errors stay fail-closed,
  with UNKNOWN cleanup and unconditional handle disposal where appropriate.
- Eleven initial pure regressions were RED; thirteen diagnostic controls pass
  through the real pre-enrollment/cleanup path with OS/child/socket/signal
  boundaries doubled. Actual no-match and byte-bound guard removals defeated
  their regressions; exact source restored. Minimum pure bootstrap/peer suite
  passed 73 with one actual opt-in skipped; both source-pin assertions passed.
  Existing subprocess CLI/race tests were not run.
- A parallel-query RED caught publication of incomplete sibling receipts.
  The existing role-query batch now settles its already-started, individually
  bounded queries before propagating failure/cleanup/publication; timing
  limits are unchanged. Removing this actual barrier defeated its regression;
  exact source was restored. No actual OS observation is claimed by this control.
- No actual OS/helper/FD/TCP/browser run or retry occurred. Existing timing,
  target/URL/API and native gates are unchanged. Source changes make previous
  indices historical; FD/exec/earliest-loss/native-60s capability remains
  unproved. ADR-0038 stays Proposed; parent owns review and any later actual GO.

Second diagnostic normal - state rejection retained (2026-10-22):

- The separately authorized normal-only API returned at
  **01:42:33.680860Z**, CLI exit **0**, but its result was FAILED/unqualified:
  `witnessed:false`, `errors:["role_lifetime"]`. API completion is not
  qualification. No descriptor/kernel-peer query, FD round-trip, target or
  refusal execution occurred.
- All **22** issued/completed query pairs were retained. Query 010's complete
  successful `ps` output shows P in **`Us`**, with unchanged PID, parent,
  group, UID, birth and command hash. The frozen `^[RSI]` predicate rejected
  that state. This diagnoses v2's particular rejection, not v1's missing
  command error; v1 remains FAILED/root cause UNDETERMINED.
- The recorded post-exit observation at **01:45:15.258814Z** found all four
  P/E/L/H PIDs absent, three recorded groups empty and the registered endpoint
  refusing connection. The synthetic fixture directory is retained, not a
  browser profile. These are historical, registered-subset observations.
- Parent verification preserved **62** original-artifact hashes/file
  identities, **36** frozen-source locators before editing, and every query
  pair's captured byte/hash relationship. Original authority/spent/decision
  stayed unchanged and the additional permission/slot remained absent.

macOS waiting-state correction - source/pure only (2026-10-22):

- Local macOS `ps(1)` documentation defines `U` as uninterruptible wait,
  distinct from stopped `T` and zombie `Z`; suffix `s` is a session leader.
  The two inline identity-eligibility predicates in the bootstrap and direct
  Node peer helpers now recognize `U`/`Us` without equating a wait with a lost
  process. The separate supervisor's stopped-process semantics are unchanged.
- Waiting is not progress, responsiveness, signal completion or eventual
  cleanup. All exact lifetime/ancestry/UID/image/fixture checks, kernel peer
  ownership, acknowledgement, query/absolute deadlines and explicit UNKNOWN
  cleanup handling remain binding. Stopped, dead, unknown and non-string
  states still reject.
- Witnessed red: **11 failed / 101 passed / one actual opt-in skipped**.
  Corrected pure bootstrap/peer tests: **112 passed / one opt-in skipped**,
  targeted lint passed. Tests cover each role's wait transition, identity
  changes while waiting, wrong kernel owners and the real producer path
  reaching a deliberately failing descriptor query without enrollment/exec.
- Replaying v2's original successful process-query bytes now accepts only
  their stable identities; the historical failed result is unchanged and
  descriptor/exec support remains unproved. A fresh independent source review
  passed this bounded correction in the existing control plane, not native
  readiness. No new actual fixture, process query, child fork or browser ran
  during these checks; current full-source indices remain historical.

Third diagnostic normal - unsupported descriptor observer (2026-10-22):

- After the waiting-state correction's pure proof and fresh independent
  review, one fixed normal-only local diagnostic ran on frozen source.
  Node CLI exited **2** at **15:36:54.088746Z**; the external observer exited
  1 to report the failed/unqualified result. No refusal or automatic retry.
- This run passed role-state assessment and reached query014: the installed
  `/usr/sbin/lsof` **4.91** rejected `+ff` with exit1 and original stderr
  `unknown file struct option: f`. Its capability help also omits the `F`
  file-structure-address field. This is a concrete blocker for this specific
  descriptor-observation mechanism, not evidence that every possible
  descriptor-isolation proof is impossible.
- No enrollment, kernel-peer query, FD round-trip or target execution was
  established. The guard remains closed; unsupported output is not treated
  as empty descriptors, inherited-handle absence or a qualifier pass.
  V1 stays FAILED/root UNDETERMINED and v2 stays FAILED/`Us` rejection.
- Parent preserved **64** original-artifact locators and all **23** query
  pairs, with unchanged before/after source vectors. Fresh observations of
  only these four recorded lifetimes found them absent; their three recorded
  groups were empty and the registered endpoint refused connection. The
  synthetic directory remains retained with matching identity. Producer
  E exited2 and recorded one identity-checked H SIGTERM. No host-wide or
  historical-helper closure follows.
- The initial new private observer adapter failed its metadata preflight
  before any fixture: importing the older CLI script attempted its existing
  directory's exclusive mkdir and failed without writing originals. A
  self-contained fixed observer passed preflight before the single actual
  v3 run. The failed adapter/preflight and older v2 bytes are retained.
- Native readiness remains blocked on a supported, separately framed and
  falsified descriptor-isolation mechanism. No unsupported-option removal,
  zero-identity fallback, browser launch or new native permission/slot follows.
  ADR-0038 remains Proposed; all historical UNKNOWNs and Adobe's independent
  whole-helper gate remain unchanged.

Supported descriptor-observer alternative - implementation in progress
(2026-10-22):

- The installed SDK declares `proc_pidinfo`/`proc_pidfdinfo` and an opaque
  per-socket handle. A fixed self-only C probe actually observed distinct
  socket identities, a matching `dup` identity, a bounded FD inventory and a
  causal byte, then closed all five owned descriptors. It queried no other
  PID and created no child/browser/profile or provider connection.
- The initial compile failed because direct clang invocation lacked an SDK
  sysroot; the original build error is retained. The explicit existing SDK
  path compiled successfully without installing anything, then the single
  self-only probe exited0. This is a supported mechanical candidate, not
  cross-process or P/E/L/H qualification.
- Implement the fixed observer with independently checked caller-to-E/L/H
  ancestry, kernel birth/UID/group stability and complete bounded inventory.
  Missing/unknown socket information, changed binaries/sources, partial
  enumeration and races must fail closed. No arbitrary process/program,
  fabricated lsof record, FD-number substitute or deadline expansion.
- The source implementation now enumerates only the caller P's owned child E,
  E's L and L's H before any target FD query, rechecks kernel birth/UID/group/
  image and full FD inventories, and rejects changed/unknown/partial data.
  It uses an explicitly typed JSON inventory, not fabricated lsof output.
  A fixed `inherited-debug` first-party negative deliberately retains the
  actual handles in H so cross-process alias detection can be falsified.
- Runtime compilation was dropped before execution: preparation builds only
  the fixed C source outside the mechanical case, retaining compiler/source/
  SDK/binary hashes and actual build exit. The tracked cohort permits only
  that exact binary at its hash-derived private path. Missing/mutated source,
  headers, cohort or binary stops before E; there is no caller program input
  and no compiler tree inside the 45-second fixture. No binary is committed.
- TDD witnessed15 missing-assessor failures, then strict valid/contradictory
  inventory tests, two missing C-source pins and two missing cohort pins.
  Disabling the actual inherited-handle rejection defeated its regression,
  then the source line was restored. Current focused pure/closure run passed
  **136**, with131 filtered/opt-in cases not executed; JS lint and C syntax
  checks passed. The cross-process observer and new bootstrap controls have
  **not run** yet.
- An initial API-units diagnostic failed before retaining its forked child's
  PID/exit; its parent finally closed the pipe, but intended EOF/alarm exit
  is not observed termination. Preserve that limited UNKNOWN without guessing
  a PID. The corrected check persisted ownership first and unconditionally
  reaped its child, exit0; raw `proc_listchildpids` return1 establishes PID
  counts, not bytes. This is distinct from the earlier browser/profile
  UNKNOWNs and grants no broader closure/cleanup authority.
- Parent owns the exact new-method framing and any later actual execution.
  Source/pure/compile-only work may proceed under the Proposed decision;
  cross-process alias/closure and bootstrap controls still need real proof.
  The failed lsof attempt stays failed. No native permission, window or slot
  is created; historical UNKNOWNs and Adobe's separate gate stay open.

Current-source Node/shell observer qualification (2026-10-22):

- The first inherited-handle run failed before the C entrypoint: dyld rejected
  the nondefault no-UUID build with `SIGABRT`/`missing LC_UUID`. Its66 artifact
  locators and scoped cleanup are retained. Default platform linker metadata
  corrected that loader issue; the new pinned binary's no-argument smoke
  reached its closed-role guard without querying any PID.
- The next owned inherited negative actually observed the same two socket
  identities in L3/4 and H3/4 and rejected before enrollment/target. Parent
  verified69 artifacts and the raw inventory/byte relationships. A separate
  normal then actually passed two FD round-trips, preserved PID/birth and
  socket identities through exec, and exited0 at17:28:02.112194Z. Parent
  verified105 artifacts and five descriptor observations. These remain
  genuine prior-source observations, not retroactive repair of failures.
- Before claiming refusal qualification, the producer was tightened to
  require H's explicit case/challenge-bound refusal receipt, L's real H
  subprocess exit2, E's nonsignal exit2 and ordered timestamps. L's status
  writer uses only shell builtins, exclusive600 output and no new process.
  Generic exits/signals cannot substitute for refusal. Thirteen initial REDs
  covered the missing observer/checker; the code-review finding in the test
  consumer then had three connected-but-failed REDs and was fixed too.
- Each actual control now has a separate sequential opt-in test and explicit
  measured elapsed time below45 seconds. The runner uses one worker, no
  file/test concurrency, no shuffle and bail1. The current-source formal
  NORMAL/REFUSE-EXEC/inherited suite actually passed **3/3**, outer CLI0,
  with118 unrelated cases filtered and unchanged source before/after.
  This is one explicitly authorized three-control SDK-absent suite, not
  another real Meta case or hidden retry.
- Parent verification reconciled **265** original-artifact locators, all
  query-byte/hash relationships, five/four/two typed descriptor observations,
  exact refusal receipts/status/timestamps and expected control outcomes.
  Ten newly registered PIDs were absent, seven registered groups empty and
  all three exact endpoints refused connection. These are registered-subset
  observations, not historical or host-wide clearance.
- Focused pure/source-closure tests passed **154**, with unrelated/actual
  controls filtered. Fresh reviewer99812462 passes cover the fixed observer,
  closed execution environment, default-linker cohort and corrected refusal
  producer/consumer/test ordering with their actual separate scopes. No
  reviewer executed tests or rehashed originals.
- This resolves the chosen Node/shell descriptor-observation blocker. Real
  Chrome exec/CDP, real profile ownership, interrupted pre-return acquisition,
  native orchestration, whole-native deadlines and native/vendor/C2/C3
  acceptance remain open. ADR-0038 stays Proposed; extra Meta authority is
  unspent. No Chrome, vendor SDK/provider, real event slot or source push ran.

SDK-absent Chrome source/pure handoff (2026-10-22; not actual qualification):

- Checkpoint `466e709` persists the qualified Node/shell observer foundation.
  The next prototype adds fixed pre-exec, runtime, actor, IO and launcher
  modules plus normal/pre-return-abort controls, all in both source closures.
  It does not implement or authorize the native additional-case runner.
- Fifty-four source/pure tests and two pin assertions pass; two actual
  browser controls remain disarmed. A removed kernel-peer guard caused the
  boundary regression to fail, then exact source restoration passed. All
  simulated child/OS/socket/signal receipts remain source/pure artifacts,
  not independently observed browser/profile/cleanup proof.
- Parent verified ten new source identities/hashes and retained command/log
  relationships. Independent source review is pending. Actual Chrome/CDP,
  real profile removal, E-stopped pre-return acquisition/abort, mechanical
  deadlines and the earliest fatal seam remain unproved. No actual browser,
  observer, signal, vendor SDK, source GET or extra Meta slot ran.
- The new complete source vector supersedes the `466e709` Node suite's
  current-source claim for later execution; its actual original result
  remains valid only for its recorded lease. Full shared/additional refresh,
  ADR-0038 acceptance and the whole slice's DoD remain open.
- Initial independent source compliance returned **needs-changes** for four
  HIGH issues: a post-attribution fork/detach escape after the last snapshot,
  non-atomic polled handoff files, unsettled endpoint probes on deadline and
  result publication excluded from completion. Source/pure corrections are
  in progress; complete custody/profile deletion must stay UNKNOWN unless a
  supported boundary is established. Actual controls remain disarmed.
- A disposable local Linux PID-namespace alternative is in conditional frame
  review only. Installed client binaries/public namespace and image metadata
  are not a ready daemon/image or an executed containment proof. The exact
  owner question received unavailable-user/general-autonomy text, not an
  exact design choice or Accepted ADR. No daemon, image pull, container,
  installation or new reference execution is authorized by that proposal.
- That frame's V1 required independent custody during pending start, the
  original nonrenewable budget before watchdog arming, and detached-child
  **and** controller-loss coverage. V2's bounded correction rereview passed
  for source/pure framing only. A fixed first-party Node-only namespace
  prototype is now being implemented in new files; actual engine/image,
  clock bounds, custody/settlement and teardown remain qualification blockers.
  See Proposed ADR-0038's conditional alternative; no runtime GO follows.
- The guarded Mac source correction handoff adds unconditional pre-acquisition
  refusal to public/direct/worker/shell routes; its modeled post-exec branch
  retains UNKNOWN and refuses complete custody/profile deletion. Atomic
  committed publication, tracked probe settlement and an independently bound
  external-completion consumer replace the three other unsafe inferences.
  Candidates remain unqualified in memory and on disk.
- This handoff has **80 source/pure tests plus two source-closure assertions**,
  with current source unchanged across the recorded commands. Parent checked
  fourteen source identities, eighteen hashes, selected raw logs, the public
  admission guard's RED/exact restoration and unchanged original/conditional
  authority. These are source/pure checks, not real-browser or resource proof;
  correction compliance passed for the fourteen prototype files and four
  closure edits only, relying on hard NO-GO/UNKNOWN rather than solved
  descendant custody. Craft and architecture passed for this guarded source
  scope, not runtime custody. A default five-second
  pure-runner timeout was corrected to the existing case cap, not erased.
- The contained Node candidate's first handoff had75 source/model tests but
  had no S/executor/inspect implementation. That original model checkpoint
  remains historical, not a claim of actual independent custody.
  Its original source/pure artifacts were verified and moved unchanged from
  the accidental repository directory to private session storage; relocation
  mappings preserve the historical paths. No runtime action occurred.
- Its next handoff implements fixed S/W/P actors, a fixed Docker executor and
  typed inspection source, with all21 namespace files in both source closures.
  It reports132 source/pure tests plus two closure assertions under doubled
  boundaries; parent verified25 changed source hashes/four dependencies,
  selected raw logs/restoration and unchanged historical/authority inputs.
  No actual client, engine, image, namespace, clock or browser was exercised.
- Initial independent namespace compliance returned **needs-changes** for four
  HIGH source defects: lease validation missing after blocking registration,
  failed cleanup cached across late creation, init dropping required payload
  context, and a consumer still bound to model rather than actor/P output.
  Corrections are in progress. These are implementation defects, not mere
  missing permissions; hard NO-GO/NOT_PREPARED and qualification false remain.
- The correction handoff now contains22 namespace source files and four
  closure edits, with167 source/pure tests plus two closure assertions.
  Source/client/config checks follow blocking publication at each spawn
  boundary; late creation retains cleanup continuation; init passes only
  the exact payload context; and the public consumer reads real P/S output
  and the complete fixed entry command rather than model artifacts.
  The integrated pipeline runs actual source functions with all physical
  boundaries doubled. Correction compliance rereview found the substantive
  wiring fixes but still required changes: permit writes also needed
  post-publication lease validation, the consumer must enforce transcript
  order, and ARM durations must respect the declared conservative remaining
  budget rather than only the generic45-second ceiling. Those three source
  corrections were required; that intermediate review was not a correction
  pass. Their subsequent bounded pass is recorded below.
- Parent verified26 current source hashes/four dependencies, raw167/2 logs,
  three spawn-revalidation and two late-cleanup guard-removal failures,
  exact restoration and unchanged authority/clock-gap artifacts. Historical
  75/132 checkpoints and failed pipeline/parser/lint attempts remain intact.
  None is actual process/namespace/clock/cleanup evidence. Valid buffered WORK
  may still arrive after S dies; S loss invalidates qualification, not already
  issued bytes. Detected loss prevents further admission/cases.
- The next correction handoff reports189 source/pure tests and two closure
  assertions. It accounts for seven fixed P/S effect frontiers, rechecks
  leases after the last blocking boundary, replays ordered source transcripts
  and uses the same `conservativeArm` helper for production and consumption.
  Guard removals caused six permit, one ordering and four budget failures;
  exact restoration passed. Parent verified26 source/four dependency hashes,
  the reported log relationships, historical correction/clock-gap originals
  and unchanged authority. Independent correction rereview passed only the
  three specified defects, seven effect sites and coupled checks in the
  current22/four-pin surface. Fresh craft then found two blocking consumer
  gaps: cleanup timestamps were not checked against producer dependencies,
  and empty pre-init-loss stdout was rejected despite the valid zero-frame
  branch. Its bounded correction rereview passed consumer/pipeline changes;
  current namespace architecture has also passed its bounded source scope;
  final source reconciliation remains, not whole runtime acceptance.
  This is source-only, not an OS-atomic exec or clock/runtime proof.
- The craft correction reports208 source/pure tests plus two closure
  assertions. The reader replays twelve finite producer dependency families,
  preserving permitted start/stop overlap while requiring settlement before
  wait/removal, and accepts exactly empty stdout only as zero frames in the
  valid branch. Seven DAG-guard and one empty-branch removal failures plus
  exact restoration are retained. Parent verified26 source/four dependency
  hashes and selected logs/current originals/authority; the craft follow-up
  did not execute or rehash anything. These remain doubled-boundary source
  checks, not genuine namespace/clock/cleanup proof.
- The exact qualified-clock issuer/reader/provenance/rate/margin/original-start
  contract remains unframed. A separate no-workload, retrospective clock
  observation proposal passed conditional source framing only: it may never
  ARM/WORK/fork a payload, certify future rates, or authorize normal/native
  entry. Actual H/O custody, original-budget transfer, runtime/image and
  cleanup ownership still block any execution. That proposal is not yet
  implemented and supplies no operational clock capability.

No-work clock-observation source handoff (2026-10-22; unqualified):

- Namespace source checkpoint `63e62c1` is committed and hard-disabled.
  The next increment adds19 no-work clock-observation files plus four
  source-vector/pin edits. Fixed H/O/P/S/init source and the retrospective
  reader are present, but actual H issuer/start/close/original-byte custody,
  runtime/image/cleanup and execution authority remain unavailable.
- Selected source/pure validation reports56 new observation cases,
  133 unchanged namespace actor/admission/pipeline cases and two hash
  assertions:191 selected passes, not all208 namespace regressions.
  The two closure checks use synthetic Chrome metadata and prohibit physical
  effects. Both vectors include all19 files (99/95 entries), but these are
  unqualified source metadata, not an actual runtime/source-qualification lease.
- Parent verified23 source identities/hashes, original17 source files and
  retained private proofs, selected log/hash relationships and unchanged
  original/conditional authority. Initial independent source review requires
  two corrections: exact custody must be reacquired after blocking operation
  publication before START, and each parent publication must follow that
  parent's observed child settlement in the same clock domain. Source
  corrections were started before the overnight session ended; the original
  implementer/reviewer handles were unavailable on2026-10-23 resume.
  Prior80-pin metadata is historical after this integration.
- Resume recovered the correction source and retained failed/green originals.
  The current guards reacquire exact custody/request/ancestor originals after
  publication before effects, including one-use ticket and H receipt issuance.
  The reader encloses child close/stream/IPC settlement within the parent's
  publication using only that parent's clock domain; equal timestamps remain
  valid. No child/parent clock epochs are compared.
- Current selected source/pure validation passes226 cases:91 observation
  cases,133 unchanged namespace cases and two pin assertions. Twelve guard
  removal failures cover custody, same-domain settlement and issuer-original
  retention; all four mutated files were restored byte-exactly before the
  full green run. Failed CLI-option and missing-private-proof-root attempts
  are retained as runner/setup failures, not TDD REDs or runtime attempts.
  Fresh bounded correction review passed those two findings and their coupled
  retained-original frontiers. It performed no tests or rehashes and is not a
  whole-slice/source audit or runtime approval; no earlier reviewer approval
  is invented after the unavailable handles. Craft/architecture remain.
- Craft identified a blocking self-confirming fixture: the backend double
  generated expected inspection predicates through production code without
  independently checking CREATE confinement. The corrected double now checks
  the complete fixed argv, environment and inspection template independently
  before emitting a response. Oversized-output/IPC diagnostics are also
  coalesced and capped without abandoning settlement observations.
- Eight new source tests cover the independent oracle and diagnostic bound.
  Real production network/template weakening and diagnostic-guard removal
  make the coupled pipeline assertions fail; exact restoration yields234
  selected passes (99 observation,133 namespace subset,two pin assertions).
  A first diagnostic harness timeout is retained separately from the genuine
  bound assertion failure. Craft correction rereview passed only the two-file
  oracle/diagnostic delta; current architecture and final reconciliation
  remain. Admission and every actual qualification flag are unchanged.
- Architecture then found the fixed init's environment contract omitted
  Docker-added HOSTNAME. The independent double now models daemon HOSTNAME/
  HOME; CREATE fixes the case hostname and HOME=/case, inspection validates
  the hostname, and init validates only those exact values with its existing
  closed environment. Unknown variables, missing/foreign hostname, foreign
  home and unexpected TERM refuse. Docker's documented defaults are cited
  in private evidence; no daemon was contacted.
- The new source-pipeline positive failed the original environment guard,
  then the corrected selected suite passed241 cases (106 observation,
  133 namespace subset,two pins). Its bounded three-file architecture correction
  rereview passed, not a renewed whole implementation audit. Final source
  reconciliation passed after a stale-count summary correction and its
  paragraph-only rereview. Actual image configuration, H provenance, clock
  bounds and runtime/cleanup readiness are still unproved.
- The first-party init only emits bounded HELLO/CLOCK frames and exits:
  no ARM/WORK/fork/payload/listener/SDK. Source WeakMap receipts are not actual
  H provenance; public H/runtime/image admission always refuses. No actual
  observation or prospective clock/rate capability is minted, and all
  observation/runtime/qualified-clock/workload/native flags remain false.

Fixed host-observer prerequisite (2026-10-23; no actual controls yet):

- After `c9993d3`, a separate fixed Node-only host observer/fixture/reader
  source path adds eleven files plus four pin edits. It reuses the existing
  child collector, captures the original pre-spawn start and retains exact
  child publication/exit/stream/IPC evidence. Only normal exit0 and explicit
  failed-child exit2 controls are contemplated; no arbitrary program, signal,
  backend, browser or vendor target is selectable.
- Its first handoff reports75 new host source/pure cases plus the preceding
  241 selected regressions,316 total. Both source vectors include all eleven
  files (110/106 entries); these remain source metadata, not qualification.
  Actual controls are separately selected and have not run. Host fixture
  receipts cannot be redeemed for observation O or clock/workload/native
  authority; independent whole-command completion remains required.
- Initial compliance requires three corrections: bind the actual directory
  fsync descriptor to its issued root; burn canonical nonce/root issuance and
  plan consumption before fallible preparation/validation; and recheck the
  child parent/deadline after blocking reads before publication. These source
  corrections passed bounded rereview of four files and their coupled
  contracts, not an actual GO or whole implementation audit. Current source
  coverage reports340 selected cases (99 host,241 preceding cases), with
  guard-removal failures1/2/4/9 and exact restoration retained. Independent
  craft/architecture and the separate outer-caller review remain pending.
- Craft found two pre-run blockers in the independent outer caller: Node
  custody needed revalidation after blocking intent publication and after
  close, and a failed timeout-diagnostic write could discard settlement
  ownership. The caller now binds executable/source/caller/proof originals at
  those frontiers and retains its exact pending command in `finally` even
  when diagnostic filing fails. Four SOURCE tests with doubled subprocesses
  and owned temporary files pass; the real Node guard removal fails and
  exact restoration passes. Narrow caller rereview passed only that corrected
  caller/test scope; repository HOST code was not re-audited. Architecture/
  caller safety and final reconciliation remain; no actual fixed host control
  was launched.
- Architecture then found three source gaps: the caller retained a second
  source snapshot rather than the one whose reviewed hash passed; fixture
  RESULT/final-exit checks still preceded blocking validation; and close
  evidence omitted the actual owned fixture child PID. The caller now retains
  the exact checked snapshot, with its race reproduced then five caller
  source cases green. Fixture fences now follow blocking validation before
  RESULT, closed COMPLETE validation witness and expected exit. The actual
  owned `ChildProcess.pid` is retained in immutable `host-issued.json` and
  bound across messages/output/exit/close/reader; missing/invalid PID refuses
  ACK without dropping the handle. No PID lookup, signal or selectable PID
  API was added.
- Architecture correction rereview passed only six HOST/two private caller
  files. Current425 selected source cases (184 host,241 prior) and six
  guard-removal/restoration witnesses remain source-only. Parent verified15
  source originals/30artifact hashes and unchanged authority; final source/
  documentation reconciliation passed this bounded checkpoint, not execution.
  Current preparation/coordination and explicit
  reviewed GO remain before either actual control. Two-frame source archives
  are historical, not current HELLO/RESULT/COMPLETE evidence.
  No actual host control, PID probe/control or backend operation occurred.
- Parent prepared an independent fixed outer caller, but it has not launched
  a control. Own temporary-file tests found APFS directory entry creation
  changes `nlink` without changing directory identity; directory descriptor
  checks retain exact device/inode/type/owner/mode instead. Exact original-
  file link/time/hash checks are not relaxed. This is not process custody
  or durability proof.
- The raw source-proof artifacts were moved unchanged from the ignored
  repository output directory to private session storage with byte/identity
  mappings; historical paths were not rewritten. All actual Docker/H/runtime/
  image/clock admission remains unavailable. The narrow Docker read-only
  question received general autonomy, not an exact backend grant. No Meta
  permission, slot, SDK or historical UNKNOWN disposition changed.

### Reconciliation sweep

- **Updated:** operator guide, architecture and open 059/060 plans distinguish
  the new fixed authority, current local proof, autonomous finite scheduling,
  historical unknown resource dispositions and remaining native gates.
- **No-op:** stable core/connectors/build/dependencies, frozen contracts,
  accepted decision bodies, original authority/spent slot and closed slices.
  This reference-only path adds no runtime capability or deployment.
- **Updated:** memory learnings record acquisition-ledger continuity,
  discovery/ready ordering, installed-tool/SDK capability limits and
  cause-specific negatives that cannot hide behind mandatory UNKNOWN.
  Earlier deterministic memory checks remain recorded; the current summary
  does not change hot-cache primers or conventions.
- **No-op:** existing inbox and refinement residuals remain broader native/
  product work, not resolved by this additional grant. **Updated:** regenerated
  the derived status board from the actual IN_PROGRESS record; its old
  READY_FOR_IMPLEMENTATION row was stale. Board, ADR index and focused slice
  structural checks passed. Prior branch work and
  accepted ADR-0035/framing commits are outside this implementation checkpoint;
  the earlier authority-checkpoint diff was from `c6cde7f`, not the entire
  branch versus main. The **earlier Node/shell observer checkpoint** was the
  change from `d76c316` through its fixed C/cohort, Node/shell/consumer,
  source-closure and related documentation delta, committed as `466e709`.
  Browser prototype files were excluded from that commit.
  The **earlier guarded Mac source checkpoint** added fourteen prototype/
  completion/launcher/config/test files, four closure/pin-assertion edits and
  related source-status/review/memory documentation after `466e709` and the
  documentation-only `65cb86d`. Separate owned-namespace source and all
  private source/model artifacts were excluded from that `3e1ca33` commit.
  The **earlier namespace source checkpoint** added22 fixed supervisor/
  worker/entry/consumer/init/payload/admission/cohort/clock/Dockerfile/test
  files and four source-closure/pin edits after `3e1ca33`, plus related
  documentation/review/memory telemetry, committed as `63e62c1`. Private
  receipts, frozen copies and the then-future observation source were excluded.
  The **earlier no-work observation checkpoint** added19 fixed observation/
  admission/reader/init/test/config/cohort/Dockerfile sources and four pin
  edits after `63e62c1`, committed as `c9993d3`. Private receipts and frozen
  cross-lane copies were excluded.
  The **current host-only source checkpoint** adds eleven fixed host observer/
  fixture/reader/plan/protocol/publication/test/config files and four pin
  edits after `c9993d3`, plus related documentation/review/memory. The
  separately reviewed private caller/test remain session artifacts, not
  package code. No actual control, qualification or execution permission is
  added by the commit; private originals and frozen copies remain excluded.
- **Updated:** earlier independent checkpoint reconciliations passed for their
  recorded source ranges; none re-graded ACs or completed the operator result.
  The earlier `d76c316`-based reconciliation found only documentation status/
  source-range inconsistencies; corrected text distinguishes historical lsof
  failure, qualified Node/shell controls and open Chrome/native obligations.
  Its bounded two-location correction rereview passed; that follow-up did not
  repeat the source/evidence review or accept ACs, the whole slice or Native.
- **Updated:** the earlier Mac compliance/craft passes cover only the
  hard-disabled source checkpoint. The craft assertion nit was corrected
  with fault-specific witnesses and a minimal recorded-group diagnostic;
  two real guard removals caused two source/pure failures, then exact
  restoration and the full source suite passed. Its bounded rereview passed
  without rehashing or execution. Fresh current architecture review passed
  fourteen files and four closure edits for deliberate NO-GO/truthful UNKNOWN;
  final checkpoint reconciliation passed for this bounded source/documentation
  scope only. No pass relabels custody or native evidence, completes ACs/DoD,
  or grants runtime execution.
- **Updated:** earlier namespace compliance passed its bounded corrected
  effect-frontier/protocol/budget scope; craft passed its consumer chronology/
  empty-output correction scope after two blockers. All prior four/three/two
  findings and75/132/167/189 source leases remain historical. Current208/2
  source evidence uses doubled boundaries, not runtime/cohort/clock custody.
  Fresh namespace architecture passed22/four-pin source trust boundaries,
  fixed custody/settlement contracts and leanness. Final source reconciliation
  passed after one documentation/telemetry correction and its paragraph-only
  rereview, not a repeated source audit or DoD acceptance;
  the no-work observation implementation was not part of that checkpoint.
  Its current source implementation still cannot enable an observation,
  qualified clock or workload. Hard NO-GO/NOT_PREPARED remains the safety gate.
- **Updated:** the current derived-board refresh changes review-selection
  telemetry only, not slice status. Earlier recorded richer-channel selection
  is historical. The earlier namespace and observation craft
  receipts record
  `substrate: not-shown` and `applied_skill: none`; the board faithfully
  reflects that advisory telemetry gap. No selection provenance or lifecycle
  advance is inferred from the prompt-source description.
- **Updated:** the earlier observation correction pass covers retained-original
  frontiers and same-domain nested settlement, not a new complete audit.
  Craft's confinement-oracle blocker and diagnostic nit were fixed in two
  files and passed bounded rereview. The234-case craft-correction lease is
  historical after the environment correction. That241-case source lease
  (106 observation,133 namespace subset,two pins) uses doubled boundaries and
  independent backend expectations; earlier191/226/234 proofs and all failed
  attempts remain their own source histories.
  Architecture's environment correction also passed its three-file scope.
  Final source reconciliation passed only the bounded source/documentation
  scope and subsequent count-paragraph correction. Actual H, engine/
  image custody, runtime cleanup and qualified clock contracts remain absent.
- **Updated:** current host compliance closed its three custody/burn/fence
  findings in a four-file correction scope; craft closed two private-caller
  findings in its caller/test scope; architecture closed the retained-source
  snapshot, final lifetime and fixture-PID findings in six HOST/two private
  files. These are scoped follow-ups, not fresh full audits at every edit.
  Current425 source cases (184 host,241 prior) and five private-caller source
  units use doubled subprocess boundaries; all316/340 histories remain.
  Host-issued PID and HELLO/RESULT/COMPLETE are not future exit evidence.
  Final bounded source/documentation reconciliation passed; current exact
  preparation/coordination and a separate parent GO decision remain before
  any actual controls. No source pass supplies actual closure or a clock cap.
- **Deferred:** parent-owned case-bound receipts,
  current finite resource coordination and actual additional operator result
  or concrete pre-admission blocker. Slice remains IN_PROGRESS; no lifecycle
  transition substitutes for those obligations.

### Close-out (post-DONE)

- [ ] Preserve original/additional spend history and complete native/
      replacement/consumer/equivalence/C2/C3/vendor residuals.
