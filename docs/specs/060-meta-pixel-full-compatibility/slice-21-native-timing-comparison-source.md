---
status: DONE
dependencies: [060-19, 060-20, adr-0055]
last_verified: 2026-11-11
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-21 - Prepare a bounded native timing comparison

An operator needs a native-only source entry that compares a late positive
PageView with an early queued init and later PageView. The source can report
the relationship between observed document timing and wire `plt`. It cannot
locate the SDK's internal sampling boundary or establish native cache behavior.
The tradeoff is a smaller useful observation with native causality unresolved.

**Goal:** Prepare one separately admitted native-only comparison and private
reader, verified with synthetic source controls, without running a browser or SDK.

The owner approved the completed native comparison plan with "sounds good.
do it now". This commissions source preparation only. Canonical integrator
`705fca77-9393-4a81-ade9-7d800aa6d748` explicitly allocated 060-21 to app/client
`bcff0cf6-b43b-4496-90f9-44bbc089f069`, branch `native-timing-source`, on
2026-11-11 after current noncompetition checks. The verified clean base is
`3bab3b0c306647e6a0c56ce45ebe5af277ebddb5`, with `c059404e` and `43b101a6`
ancestors. This is a feature-line allocation, not a global reservation.
No ADR, operation grant, case binding, live window or successor is allocated.

This vertical path slice serves the existing spec's UC-10 comparison workflow.
The approved SESSION plan is
`/Users/ramboz/.copilot/session-state/93cfffd7-0286-49f6-a79e-25e99bc789aa/plan.md`;
its proposed paths become the exact implementation allowlist below.

**DoR:**
- [x] Actual isolated clean canonical ancestry and explicit allocation verified.
- [x] Owner source approval and source/operation separation recorded.
- [x] Approved plan and relevant existing lifecycle/loader/fixture edges read.
- [x] Fresh pinned Sol framing clears the actual assumptions and scope.
- [x] Normal readiness reaches READY_FOR_IMPLEMENTATION before implementation.

**Acceptance Criteria:**

1. Add only the four separately named, import-inert source surfaces
   `rig/meta-native-sampling-page.js`, `rig/meta-native-sampling-browser.mjs`,
   `rig/meta-native-sampling-case.mjs`, `rig/meta-native-sampling-cli.mjs`,
   and `test/meta-native-sampling-case.test.js`. Importing them and running
   source controls must not import/launch a browser package, evaluate/acquire
   vendor bytes, invoke either historical operation, start workers/listeners,
   or read historical private evidence. Reuse inert leaf helpers only after
   auditing their actual import and execution edges.
2. Prepare at most one future headful browser with normal default selection
   and at most two fresh sequential native contexts: late positive control,
   then early queued-init/later-event. Each completed context has one consent
   grant, one init and one explicit PageView. Missing late positive or failure
   to create the early condition terminates the operation before further
   context/event issuance. No worker, loopback listener or old Node control
   matrix is part of this new native-only entry.
3. Use ordinary deferred-module and task scheduling. Install the early
   DOMContentLoaded listener synchronously and return from module evaluation
   without awaiting that event. Queue ordinary native bootstrap/consent/init
   before DOMContentLoaded. Issue the sole PageView from a subsequent task
   after DOMContentLoaded and SDK readiness. Require an actual modern entry
   with zero queue-time domContentLoadedEventEnd and a later strictly positive
   completed duration. Late timing must be positive before SDK installation
   and stable through the event. Missing conditions are terminal
   `condition-not-created`, not a favorable result or a reason to tune/retry.
4. Retain all five raw timing scalars/availability, epoch and monotonic
   chronology at queue/install-bracket/event boundaries, ordinary command
   issuance, runtime load/readiness and own document/referrer/UA/XHR context.
   Brackets and `fbq.callMethod` readiness are never plugin installation or
   sampling witnesses. No held response, parser blocker, busy wait, timing/API/
   realm/UA override, debug/internal hook, vendor edit, state seeding/copying,
   consent bypass, changed plugin opt-in or extra event is permitted.
5. Bind source and roles, private inputs and retained HTTPS origin through
   the unchanged `loadPinnedCaseInputs` loader. Derive and verify the complete
   first-party/module dependency closure and exact logical route multiset
   before launch. The proposed document + entry + page module + pinned runtime
   + pinned configuration + one aborted measurement is six rows/context only
   if the actual closure establishes it. Unknown imports, extra routes,
   multiplicity/source/role/origin/consent drift refuse, never repair the roster
   during execution. Missing originals stop; no acquisition or reconstruction.
6. Fulfill only admitted first-party sources and both original SDK resources
   locally, abort the selected native measurement, and abort/record/stop on
   everything outside the exact roster. Record complete bounded request and
   response-or-abort rows with field multiplicity and raw numeric `plt`.
   Use restrictive CSP, block service workers and native workers, and close
   unexpected WebSocket behavior. No extra origin or vendor receipt/response
   qualification is inferred from interception or a script-load event.
7. Enforce ceilings of 64 requests/context, 2 MiB/body, 8 MiB shared charged
   retained data and 512 KiB first-party result bridge charged to that budget.
   Work cutoff is at most 80 seconds; hard cutoff is at most 90 seconds
   including cleanup, exclusive publication and built-in readback. Navigation
   and SDK readiness each have a 5-second ceiling; after the sole PageView,
   allow one bounded 1-second observation interval. Cleanup waits are at most
   1.5 seconds and never extend beyond the hard cutoff. Cover late resource
   acquisition, route settlement, publication/readback and stalled cleanup.
8. Prepare explicit one-shot admission for a future newly owner-bound case,
   with source/input/role/route/effect bindings. A digest is drift evidence,
   never permission. Write only to one fresh exclusively owned 0700 private
   case directory with exclusive 0600 attempt marker and packet, bounded
   publication and private built-in readback. Source work uses synthetic
   admission only; it creates no true case binding/reservation or live hold.
9. The private reader derives observed relationships from raw records,
   independently checking chronology, source/role binding, complete exact
   roster, command count, measurement multiplicity, numeric validity, budget/
   deadline and cleanup. Distinguish invalid/incomplete evidence, uncreated
   condition, missing positive control, contradicted own-input relationship
   and observed native wire relationship. A valid early zero-to-positive wire
   relationship falsifies only the queue-time-only model. An eligible late
   mismatch contradicts the limited own-input expectation without diagnosing
   its native cause. Preserve partial evidence and actual issued effects.
10. Every result leaves native plugin install/sample/cache boundary,
    referrer-manager input/selection, identical worker/native inputs, vendor
    receipt/response/reporting qualification and full parity unresolved.
    Historical worker evidence is context, not a contemporaneous paired
    qualification. Publish only closed categories/counts and public source
    citations, never raw timing, identifiers, private URLs/pins/digests,
    arbitrary exceptions or dynamic names.
11. Zero harness storage observation is not a bound on native SDK ambient
    DOM/cookie/storage effects. Add no storage observer or new worker capability.
    Preserve the existing experimental referrer default-off, exact-bound
    consent/tag/generation/origin, two-key, <=16 ASCII-byte/null, get/set/
    expiry-only-remove, eight-primitive and one-outstanding limits unchanged.
    No general storage, `_fbp` expansion, copying/seeding or origin expansion.
12. Audit the selected test runner/config/setup/hooks and complete import/
    execution closure before source checks. Use synthetic browser/platform
    handles and synthetic inert SDK bytes only; a real browser import/launch
    must fail the selector. Witness failing new tests before implementation,
    then green using
    `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`.
    Cover missing/duplicate measurement or field, changed scalar, reversed
    chronology, queue/plugin conflation, hidden failed condition, source/role/
    origin/consent drift, unrostered dependency, exhausted limits and stalled
    cleanup. Record actual outcomes and narrow regression/lint checks.
    Missing tooling is an immediate reported blocker before provisioning.
13. Preserve closed 060-19/20, their readers/evidence/grants, accepted ADR-0055,
    occupied Google ADRs, foreign claims, existing helpers/runtime semantics
    and historical serving rosters. No main checkout, PR, push, SDK/source
    acquisition, browser/version/signing query, native byte evaluation,
    deployment, account mutation, automatic native operation or successor.
    Added signing/exact-version preflight is waived; do not reinstate it or
    change existing historical runner guards.
14. Use one native Jig implementer explicitly gpt-6.1-terra/default after normal
    readiness, taking its own local claim. All Jig reviews are fresh explicitly
    gpt-6.1-sol/default: framing, then postimplementation compliance, craft and
    architecture in order, followed by source reconciliation. No gate bypass,
    overlapping writer or self-review. Stop immediately on a concrete blocker
    or after three non-improving attempts. Commit reviewed source locally with
    a conventional message/trailer; canonical integration is separate.

**DoD:**
- [x] Fresh framing evidence and ordinary readiness/claim are recorded.
- [x] Source-only tests have audited actual red/green and final outcomes.
- [ ] Ordered fresh compliance, craft and architecture reviews pass.
- [ ] Source reconciliation and fresh reconciliation review pass.
- [ ] Allowed-file manifest and reviewed local commit handoff are complete.
- [x] No native/browser/SDK operation is performed or automatically scheduled.

## Grounding

`rig/meta-sampling-page.js:110-186` grounds ordinary listener/task scheduling
and explicit uncreated-condition handling. Its worker init is not native init.
`rig/meta-pageview-source-loader.mjs:51-108` grounds the unchanged three-role
private originals loader and retained HTTPS origin derivation.
`vitest.config.js:26-39` shows the selected runner configuration with no
configured setup file; the new test's execution/import closure still needs
its own audit before running.
`docs/product-vision.md:146-149` bounds the existing UC-10 comparison goal.
The completed approved SESSION plan supplies the native feasibility limits,
falsifiers, effect ledger and existing recorder/reader provenance.

## Assumptions

- Ordinary loading may create zero queue-time and positive later native
  document timing. This is not executed here. A missing transition is terminal
  `condition-not-created`; no internal SDK sample is inferred.
- The final private original configuration may issue exactly the proposed
  native request inventory under ordinary loading. Source closure and future
  admission must establish the exact roster; unknown or extra effects stop
  rather than being patched into a running case.
- Existing inert leaf helpers can support the new private entry without
  changing completed helpers or contracts. A required out-of-allowlist change
  is a blocker for the coordinator, not implicit authority.

## Review derivation

The real assumptions require frame review. Architecture review is declared for
the new private operation/reader and admission boundary. There is no visual
design surface. Scoped lint is required, without a separate code-health pass.
The waived signing/version steps add neither a gate nor a review pass.

## Implementation boundary

Exact implementation files are the five paths in AC1. Only this slice, its
reviews and directly required lifecycle metadata may be added alongside them.
Shared edits are bounded to one new 060 overview slice link, that spec's
plan/tasks, derived status board, one new handoff section in
`docs/releases/google-meta-work-plan.md`, a source-only CHANGELOG entry and
scoped operator guidance in `rig/meta-behavioral-poc.md`. Preserve historical
sections. Source plans/scratch stay in SESSION artifacts.

### Close-out (post-DONE)

No whole-spec close-out is claimed. Full 060-01 and foreign claims remain as
recorded. Source delivery cannot satisfy any native operation or parity gate.

### Deviation log

- **Authority and handoff.** The source commission rests on the owner's
  “sounds good. do it now.” The resolved dependency input `771bd5c8` chose
  “Approve worktree-local dependency setup (Recommended)”; its answerer is
  not independently attested, and the parent did not answer it. The parent
  `614` answered replacement input `28d4820a` as coordinator scheduling,
  not as a new direct-owner quote. The stopped writer's claim was released
  and picked up through normal transitions. There was no overlapping writer.
- **Discovery.** Scout and a schema discovery interface were not available
  in this writer's tool catalog. The explicitly permitted, read-only native
  fallback was restricted to this worktree and is labeled UNINDEXED. It
  supplies no indexed impact, affected-test or review claim.
- **Partial preservation.** An initial 40/40 included a diagnostic negative
  for the unreserved store; it did not prove the required preservation.
  The new preservation regression then failed at `capture-size-limit`
  before readback. The correction reserves bridge, serialization, packet
  and readback capacity under the same 8 MiB total. Conservative ordinary
  capture can stop below that ceiling. Filesystem and hard-deadline
  publication failures remain explicit; publication is not guaranteed
  under arbitrary filesystem failure.
- **Representation and capacity.** The original partition could not hold
  the mandatory 435,104-byte runtime: its base64 response alone requires
  580,140 bytes. The two-context full-roster control failed before the
  source-table correction. Bound source bodies are now retained once and
  response references are verified against role, digest and bytes. This
  replaces repeated inline response bodies, not the evidence or byte cap.
  The published-size synthetic sample used 5,314,300 of 8,388,608 bytes
  through exclusive publication and readback. Actual private manifest and
  input sizes are unknown and separately charged. The sample is not a
  universal capacity guarantee or a native qualification.
- **Review corrections.** Independent review findings drove regressions
  and fixes for work cutoff, late acquisition, cross-context lifecycle
  order, chronology, partial measurements, and immediate stop on route,
  metadata, recorder, header and socket refusals. The redundant roster
  length test was removed rather than counted as evidence. The final
  late-fulfillment control awaits the actual route task and observes the
  inert buffer's base64 conversion. Removing the released-loan guard made
  that targeted test fail; restoring it made the test pass and restored
  the browser source checksum. The guard prevents late retained-response
  materialization after loan release. It does not prove underlying browser
  I/O cancellation. These findings and the craft test nit are resolved,
  not waived.
- **Chronology.** A same-millisecond late-close and early-start epoch tie
  is conservatively refused. It is not promoted to a wire relation.

The checkpoints below are historical red/green receipts. Their then-current
test totals and pending-review statements do not describe the current state.
The final owning selector passed 119/119 and the synthetic loader selector
passed 5/5. Scoped ESLint and tracked and untracked whitespace checks
passed. The coordinator independently confirmed 124 synthetic tests and
scoped lint; the reviewers did not rerun them. All five frozen source and
test checksums match the recorded values.

Fresh independent [compliance](reviews/slice-21-compliance.md),
[craft](reviews/slice-21-craft.md) and
[architecture](reviews/slice-21-arch.md) verdicts pass, in that order. The
fresh [reconciliation](reviews/slice-21-reconciliation.md) rerun also passes.
The coordinator completed the normal gated transitions through `REVIEWED`
to `RECONCILED`. Reviewed source was committed locally as
`aba7124201fd51be0671cb5744d93c6db7d4f70f` with 18 allowed files and the
required trailer. The coordinator reports that the gitleaks pre-commit
check passed. Final handoff, the normal `DONE` transition and its metadata
commit remain pending. Canonical integration is separate. No
native/browser/SDK operation, actual binding or automatic successor was
performed or scheduled.

The two review DoD boxes remain unchecked. The transition helper auto-ticks
its standard “Implementation review passed” and “Reconciliation review
passed” labels, not this slice's custom labels. The recorded pass artifacts
above establish the review results; this writer does not manually tick a
review-passed box.

### Reconciliation sweep

- **Updated: release and spec records.** `CHANGELOG.md` records the
  source-only addition and pending operation approval.
  `docs/specs/060-meta-pixel-full-compatibility/spec.md` adds the 060-21
  overview link. `docs/specs/060-meta-pixel-full-compatibility/plan.md`
  records the bounded plan, checks and review state.
  `docs/specs/060-meta-pixel-full-compatibility/tasks.md` records completed
  source and reconciliation reviews and pending final handoff work.
- **Updated: handoff and operator guidance.**
  `docs/releases/google-meta-work-plan.md` adds the source handoff and
  remaining admission boundaries. `rig/meta-behavioral-poc.md` describes
  the private proposal, accounting and limits for an operator.
- **Updated: private source and synthetic controls.**
  `rig/meta-native-sampling-page.js` prepares page scheduling;
  `rig/meta-native-sampling-browser.mjs` bounds capture and cleanup;
  `rig/meta-native-sampling-case.mjs` independently reads evidence;
  `rig/meta-native-sampling-cli.mjs` prepares admission and publication;
  `test/meta-native-sampling-case.test.js` tests those surfaces using
  synthetic inputs. These files remain frozen.
- **Updated: slice and review evidence.**
  `docs/specs/060-meta-pixel-full-compatibility/slice-21-native-timing-comparison-source.md`
  records the criteria, deviation log and sweep.
  `docs/specs/060-meta-pixel-full-compatibility/reviews/slice-21-frame-critique.md`
  records the framing pass.
  `docs/specs/060-meta-pixel-full-compatibility/reviews/slice-21-compliance.md`,
  `docs/specs/060-meta-pixel-full-compatibility/reviews/slice-21-craft.md`
  and `docs/specs/060-meta-pixel-full-compatibility/reviews/slice-21-arch.md`
  record the ordered source review passes.
  `docs/specs/060-meta-pixel-full-compatibility/reviews/slice-21-reconciliation.md`
  records the fresh reconciliation pass after the earlier needs-changes
  finding was addressed.
- **Architecture and contracts:** Private source preparation only. Runtime,
  public contracts, historical guards and the existing three-original loader
  are unchanged. No new ADR is needed or allocated.
- **Conventions:** No convention change or human approval is requested.
- **Inbox and bugs:** The inbox was read and contains no resolved item for
  this slice. The bug board lists three DONE defects: wire redaction, local
  fixture import closure and shared-host consent. None is reopened or closed
  by this private source preparation.
- **Glossary and primer:** Full spec 060 is not closing. The coordinator's
  read-only memory summary and team opt-out check identified no qualified
  new durable term or convention. No memory, people or glossary file changed.
- **Leanness and use case:** The private source and synthetic controls stay
  within the declared acceptance criteria. The coverage helper reports zero
  gaps and zero dangling references. Its nine orphan specs are advisory and
  outside this slice. UC-10 remains an open comparison goal, not a parity
  claim.
- **Derived board:** The normal helper regenerated `docs/specs/README.md`
  after the reconciled transition. Its board check passed.
- **Closed records and effects:** Closed 060-19/20 records, ADR-0055,
  historical serving rosters and other occupied ADRs remain unchanged.
  This source grants no actual admission, reservation or live window. API
  cleanup is reported separately from unknown OS, process and profile
  cleanup. Native plugin sampling, cache/referrer causality, identical
  inputs, vendor receipt/response/reporting, ambient SDK storage effects
  and full parity remain unresolved.

## Source-control audit (UNINDEXED)

The replacement writer picked up the released claim through the normal
READY_FOR_IMPLEMENTATION to IN_PROGRESS transition. The coordinator scheduled
the replacement under the existing owner source approval.

Before the behavioral red, the selected Vitest 4.1.11 configuration was
inspected. It uses the Node environment and default forks pool. It configures
no setup files or global setup. The API is disabled by default, and the runner
only listens when an API port is configured. The test imports Vitest and
`node:module` and uses native file-URL dynamic imports of the four new surfaces.
At that checkpoint those surfaces did not exist. The existing Vite mocks alone do not
establish refusal for that native import path. A synchronous Node resolve guard
and nested-import canary were added before executing the selector. The guard
must itself pass in the observed run. All service handles and SDK strings in
the test are synthetic. The closure must be audited again after new source is
written and before any green or final check.

The exact owning selector ran once before implementation. It returned 17
failing assertions and one passing test. The passing test was the nested
native browser-import refusal canary. The 17 failures reported missing
functions from the four absent implementation surfaces. For example,
`test/meta-native-sampling-case.test.js:71` expected
`scheduleNativeSamplingPage` to be a function and received `undefined`.
This is behavioral red, not an observed browser operation.

The first implementation file is an import-inert page module with no imports.
For the next source selector its only executed scheduler call receives a
synthetic document, performance object, timer queue and service functions.
The default bootstrap and runtime-script creation paths are not called. Reader
fixtures were expanded before reader implementation to require bindings,
timing brackets, chronology, context, resource accounting and cleanup.
The second selector run returned 17 failures and two passes out of 19 tests.
The nested import refusal and synthetic early-listener scheduling passed.
The remaining failures are missing browser, reader and CLI exports.
The scheduling fixture was then corrected to use `interactive`, the relevant
deferred-module ready state. The next run returned 18 failures and one pass.
The new failure at `test/meta-native-sampling-case.test.js:128` exposed the
page module's incorrect refusal of `interactive`. The page was changed to
refuse only `complete`; that change still needs a confirming run.
The newly added reader also has no imports or top-level platform effects. Its
selected calls receive synthetic packets only. The page and reader can be
included in the next selector without a browser package or SDK input.
That selector returned 11 passes and eight failures out of 19. The
`interactive` listener case passed. Remaining failures identify the absent
browser and CLI surfaces. This is not a final green or review result.
The browser surface now imports only `node:perf_hooks` and the inert deadline,
source-loader and private-recorder leaves. The recorder imports the inert
request-capture module. Their top-level edges contain no browser import or
native operation. The next tests call only roster, route and limit functions,
plus the synthetic page and reader controls. They do not call the browser
recorder or load private inputs.
That run returned 15 passes and six failures out of 21. Two new red controls
exposed missing partial-command readback and insufficient reader checks.
The other four failures identified the absent CLI surface. Changes addressing
the two new controls have not yet been verified.
The next selector adds a stalled-close control. Its browser, context, page,
route, navigation and evaluation methods are synthetic functions. The fake
close returns an unresolved promise; no browser, SDK, worker or listener is
started. The only real wait is the bounded Node cleanup timer.
The selector returned 18 passes and six failures out of 24. The partial
command, reader-hardening and stalled-close controls passed. All six
remaining failures concern the absent CLI surface. This remains red.
The CLI import closure adds Node crypto, filesystem, path, URL and performance
leaves, the previously audited first-party leaves, and the directly declared
Acorn parser. Acorn's selected ESM file has no import, require, worker,
network or eval edge in the inspected source. The selector calls only its
parser with inert synthetic strings. Synthetic CLI tests inject a record
function. The real source loader, private store, browser import and launch
branches are not called. The native Node resolver guard remains active.
The selector then returned 24 passes and zero failures. This is an interim
green, not acceptance completion. The actual first-party import closure,
response-source binding, global deadline accounting and final scoped lint
still need controls and verification.
New controls check raw response bodies and source hashes, route field
multiplicity, late-resource settlement and global deadlines. One also reads
only the allowed first-party control closure, package lock and Acorn parser
source to check the actual module set. It does not read manifests, private
inputs or SDK originals and does not call the browser branch.
The expanded selector returned 25 passes and one failure out of 26. The
failure at `test/meta-native-sampling-case.test.js:289` showed that the
reader accepted a packet without validating retained response evidence.
Response hashes, route fields, resource settlement and deadline checks were
added after that red. They still need a confirming run.
The confirming selector passed all 26 tests. Further controls now check
measurement origin/path drift and verify the generated entry import against
the exact six-role multiset. They use only synthetic URLs and source strings.
That selector returned 26 passes and two failures out of 28. One failure
showed that a different measurement origin or path was still admitted. The
other showed the missing entry-closure verifier. The roster now selects one
exact measurement URL and checks the generated entry before launch; these
changes still need verification.
The confirming selector passed all 28 tests. A new partial-effect control
uses an in-memory synthetic request and fake route, page and context methods.
It calls the recorder without opening a socket or evaluating page code.
That selector returned 28 passes and one failure out of 29. The failure at
`test/meta-native-sampling-case.test.js:459` showed that immediate context
closure lost known command effects. The stop path now requests bounded
first-party progress before closing. This change still needs verification.
The confirming selector passed all 29 tests. New controls require the reader
to derive a missing late measurement and to label the synthetic result and the
limited queue-time-only falsifier explicitly.
That selector returned 27 passes and two failures out of 29. The reader did
not distinguish a missing late measurement or publish the bounded falsifier.
Both checks were added after red. A further control distinguishes an uncreated
late positive from an uncreated early condition.
The next selector returned 28 passes and one failure. The late
`condition-not-created` record was not classified as `missing-positive`.
That branch was changed; the following control also checks the recorder's
expected incomplete-roster marker for an absent late measurement.
The next selector returned 28 passes and one failure at the new
incomplete-roster assertion. The reader was changed to allow that one marker
only for a missing late measurement. A new synthetic control also checks that
an uncreated condition cannot hide failed API cleanup.
The selector returned 28 passes and one failure at the new API cleanup
assertion. API settlement is now reported separately from unknown process and
profile cleanup. The reader also checks cleanup before condition categories.
These changes still need verification.
The confirming selector passed all 29 tests. The next control uses a
memory-only filesystem double to check exclusive directory, marker, packet
and readback behavior. It creates no real private files.
The selector returned 29 passes and one failure because the synthetic store
seam was absent. The store now accepts a memory-only test double and checks
directory ownership and file modes after exclusive creation. The change still
needs verification.
The confirming selector passed all 30 tests. New synthetic controls check
that CSP admits only the selected measurement origin and that non-synthetic
reader evidence requires an independently supplied readback deadline marker.
The selector returned 29 passes and three failures out of 32. It exposed
an overbroad CSP, missing retained-CSP verification and missing independent
readback timing. A further memory-only control checks hard-link substitution
of the private packet.
The next selector returned 28 passes and four failures out of 32. The fourth
failure showed that packet readback accepted a synthetic hard-link
substitution. The CSP, readback marker and exclusive-file checks were changed
after red; verification is pending.
The confirming selector passed all 32 tests. Scoped ESLint then found six
errors, including an undefined readiness-timeout rejection callback. The next
control uses only a fake document, script element and timer queue to witness
that bug. It does not load or evaluate the script.
The selector returned 32 passes and one failure at
`test/meta-native-sampling-case.test.js:259`, with `reject is not defined`.
The readiness callback and the other scoped lint findings were corrected.
The confirming selector passed all 33 tests and scoped ESLint passed. New
synthetic controls check request-versus-PageView chronology, the bounded
observation interval and refusal of a pre-existing bootstrap. The fake
document never fetches or evaluates the script element.
The selector returned 32 passes and two failures out of 34. It exposed an
accepted pre-existing `_fbq` and missing request/observation chronology
validation. An additional synthetic mutation checks raw wire-field order and
multiplicity.
The next selector returned 32 passes and three failures out of 35, including
the new raw-field mutation. The page now refuses either existing bootstrap
alias, and the recorder and reader retain and check request and observation
chronology plus raw field order. These changes still need verification.
The confirming selector passed all 35 tests and scoped ESLint passed. A new
synthetic-only control checks preparation of exact future bindings without
granting permission, creating a case or launching a browser.
The selector returned 35 passes and one failure because that private proposal
seam was absent. The new proposal binds the source, original roles, inputs,
route multiset, CSP and effect ceilings while leaving owner permission false.
It performs no filesystem or browser operation.
The confirming selector passed all 36 tests and scoped ESLint passed. New
synthetic controls check the exact bridge charge and shared retained budget
through readback, not just individual ceiling fields.
The selector returned 34 passes and two failures out of 36. It exposed an
unchecked bridge charge and an unchecked retained-budget value at readback.
Both checks and conservative binding/record charging were added after red.
The confirming selector passed all 36 tests and scoped ESLint passed. A new
memory-only control changes packet bytes between publication and readback.
The selector returned 35 passes and one failure at the changed-packet
assertion. Built-in readback now compares the exclusive write's digest with
the bytes it reads. The digest is drift evidence, not permission.
The confirming selector passed all 36 tests and scoped ESLint passed. A final
bounded regression uses `test/meta-pageview-source-loader.test.js`. Its imports
are Vitest, Node crypto and the audited loader. It supplies in-memory synthetic
role bytes and an in-memory `readOriginal` function. It does not open a
private original, import a browser package or start a listener.
A further memory-only mutation changes the owned parent directory identity
between publication and readback. It does not touch the real filesystem.
That selector returned 35 passes and one failure at the changed-parent
assertion. Parent device and inode are now checked on subsequent accesses.
A new synthetic field control also covers names that collide with object
prototype properties. It first failed on the missing grouping function while
36 other controls passed. Grouping now uses a null-prototype object. The
bounded request journal is also retained in the private record. The next
synthetic check mutated that journal independently from the request rows. It
returned one failure and 37 passes, exposing a false favorable result. The
reader now compares every journal entry against its retained request row.
A further fake-handle test issues 65 synthetic route callbacks to inspect
whether the limit-triggering request has a bounded witness. That run had two
failures and 37 passes. The triggering request had no witness. Separately,
the existing late-wire-mismatch fixture needed its journal updated to match
its intentionally changed URL. Capture now reserves a bounded failure
witness and records the first unretained request and a count. Additional
unretained details are explicitly unavailable. An independent-reader
mutation checks that an overflow witness cannot support a favorable result.
That mutation produced one failure and 38 passes. The reader now rejects
an overflow witness before deriving a captured relation.

The preceding bounded checks passed: the owning selector ran 39 tests; the synthetic
pinned-source loader regression ran five. Scoped ESLint reported no errors.
The workflow helper regenerated the status board with only the new 060-21
row. The tracked diff whitespace check passed. No browser, SDK, original
private input, native operation, actual binding or automatic successor was
used or scheduled. Independent source and reconciliation reviews remain open.

### Partial-publication blocker and continuation

At the freeze, capture and private publication shared an unreserved
remaining-byte budget. If capture exhausted that budget after issuing effects,
`store.write` can reject the partial packet. The exclusive attempt marker
remains, but it does not preserve the issued-effect record. A new synthetic
memory-filesystem control exercises this exact failure; it is a diagnostic
negative for the raw unreserved store, not proof that the preservation
criterion passes.

The final owning selector passed 40/40, including that gap-reproducing
negative. The synthetic loader regression passed 5/5. Scoped ESLint and both
tracked and untracked whitespace checks passed. At that freeze the source-test
completion item remained open.

The same retained writer resumed within AC8 and AC9. A new Node-only control
uses the existing memory filesystem and synthetic commands and request. It
exhausts the capture budget, then requires private publication, built-in
readback, exact partial effects and aggregate accounting within 8 MiB. It
does not use browser handles, SDK bytes or actual private files. It is run
before the budget and publication seam exists.
The selector returned 40 passes and one failure at the new regression:
`createNativeSamplingBudget is not a function`. A second fake-handle test
now checks that already issued commands survive capture exhaustion before
the partial bridge. Publication accounting also checks serialization,
packet write and readback separately.
The next selector returned 40 passes and two failures. The new preservation
regression reached the existing store and failed at
`rig/meta-pageview-private-file.mjs:56` with `capture-size-limit`; therefore
readback and the actual partial-effect assertion were not reached. The
partial-bridge control still failed on the absent budget seam.
After the initial budget partition and partial-bridge changes, the selector
passed 42/42. The partial-bridge fixture now also publishes its actual
fake-handle record and reads it back. Two added memory-only controls check
publication failure and work-cutoff independence of the hard-deadline read.
That selector returned 43 passes and one failure: a canceled work signal
incorrectly canceled private readback. The publication seam now uses its own
hard-deadline signal and the selector passed 44/44. A further synthetic
event-storm control checks that repeated errors cannot grow an unbounded
partial record outside the protected publication allowance.
That selector returned 44 passes and one failure: 1,000 repeated fake page
errors were retained. Error categories are now deduplicated and the selector
passed 45/45. One further memory-only check stresses escaped synthetic request
headers and reads the retained journal back under the shared limit.
That check passed as part of 46/46. A synthetic 256 KiB inert local response
now checks whether the reserve leaves reasonable capacity when the rest of
the 8 MiB budget is unused. It is never executed as code.
That selector returned 46 passes and one failure: the initial partition
rejected the synthetic response despite ample remaining budget. The
conservative capture factor is being reduced and the escaped-header and
partial-readback negatives remain in the selector.
The confirming selector passed 47/47. A further fake-route control supplies
an oversized synthetic method string, then requires bounded request
metadata, actual issued commands and private readback. The string is never
sent to a network or evaluated.
The selector returned 47 passes and one failure: oversized uncharged method
metadata made publication fail. Capture now stops with a bounded witness
for an oversized method or resource type. The confirming selector passed
48/48. A memory-only stress control now combines the maximum synthetic header
multiplicity with a near-limit partial bridge.
That selector returned 48 passes and one failure: the multiplicity exceeded
the packet reserve. Request headers now charge their per-entry structure
before the unchanged recorder retains them; unavailable header data is not
silently treated as absent. The confirming selector passed 49/49. A final
fake-response check verifies that request identity remains paired through
the accounting wrapper.

The confirming selector passed 50/50. The continuation partitions the
remaining shared 8 MiB after preflight, before browser admission. A bounded
capture allowance protects a 512 KiB partial bridge and packet publication
and readback. The allowance is conservative and may stop capture before the
overall ceiling. Serialization, packet bytes and readback are separately
charged; the returned usage includes all pools. Unknown oversized method or
resource metadata gets a bounded witness, not an unbounded retained value.
Publication or readback failure returns `publication-failed`. The source
does not promise publication after an arbitrary filesystem or hard-deadline
failure. The raw-store diagnostic stays in the test as historical evidence.
No new imports or runner setup were added in the continuation. Its additional
fake route, response, header, deadline and filesystem controls use the audited
Node selector and do not load a browser package or evaluate vendor bytes.

Final continuation checks: the owning selector passed 50/50 and the synthetic
pinned-source loader selector passed 5/5. Scoped ESLint and tracked and
untracked whitespace checks passed. The added controls use synthetic
platform objects, inert bytes and the memory-only filesystem. No browser,
SDK, private original, actual admission or automatic successor was used.

## Compliance correction audit (UNINDEXED)

The fresh independent compliance verdict is `needs-changes`. It identifies
work-cutoff cancellation, terminal partial-effect validation, cross-context
lifecycle chronology and chronology-control masking gaps. The same writer
added regression tests before changing implementation. The tests use fake
platform handles, synthetic source strings, Node timers and an in-memory
page host. Callback source is inspected as text, never evaluated. No browser
package, real browser, SDK, original private input, listener or worker is used.
The existing Node/Vitest setup and import guard are unchanged. Final
source-check completion remains open until the corrected selector and scoped
checks actually pass.

The first selector returned 49 passes and nine failures. Five terminal
mutations and the extra-early-context mutation incorrectly returned
`missing-positive`; overlapping lifecycles incorrectly returned the observed
relation. Two test-construction faults also appeared: one chronology mutation
changed serialized size, and the new timeout controls were accidentally
nested in an existing test. Those fixture faults were corrected before the
next red run; neither is attributed to source behavior.
The corrected selector returned 53 passes and nine failures. In addition
to the seven reader failures, the work-timeout control observed no stop flag
and the late route was fulfilled rather than aborted. Both actual
late-acquisition disposal controls and the size-preserving chronology
controls passed in that red run.
The first implementation check returned 60 passes and two failures. Both
were old terminal fixtures whose changed status had not been charged into
the bridge size; their sizes were corrected. Additional synthetic mutations
now test a terminal label that contradicts otherwise completed evidence and
a missing-positive label before any PageView.
Those two controls failed with `missing-positive` on the next 62/64 run.
Terminal classification now requires evidence of the missing or uncreated
condition, and the synthetic runner no longer accepts a bare label. The
confirming selector passed 64/64. Terminal mutations were then strengthened
to start from a genuinely evidenced condition, and an independent synthetic
service-overlap control was added.
That selector returned 68 passes and one failure: the synthetic service path
reported a relation for overlapping lifecycles. Both reader and synthetic
runner now use the same sequential check. A further fake-handle test checks
that a stalled stop evaluation does not postpone context closure.
That selector returned 69 passes and one failure: a delayed stop evaluation
allowed a synthetic event before closure. Stop evaluation and context close
now start concurrently, with the stop request queued first. The confirming
selector passed 70/70. Two further partial-record controls check for an
after-event capture without a PageView and unexpected chronology keys.
Those controls returned 70 passes and two failures. The reader now rejects
unknown chronology keys and inconsistent capture/command chronology; the
confirming selector passed 72/72. Two new partial-record controls check
the unobserved measurement roster and inconsistent incomplete-roster errors.
The first roster selector exposed one failure; after correcting its fixture
to omit the measurement from the late record, both controls failed in the
72/74 run. The reader now independently validates the complete bound roster
and exact incomplete-roster error. The confirming selector passed 74/74.
Two further fake-page controls test a first-party work-cutoff signal before
navigation and late readiness after that cutoff. They neither alter timing
APIs nor execute any vendor code.
That selector returned 74 passes and two failures: late readiness still
issued a synthetic PageView and the fake context received no cutoff. The
page now checks a first-party cutoff value before installation and each
command, without replacing a timing API; context setup supplies the value
before navigation. The confirming selector passed 76/76. A further control
checks a deadline crossing between consent and init. Two document-state
controls also check whether an already complete document can be classified
from retained raw state rather than a trusted terminal label.
Those controls returned 77 passes and two failures. The page now records
its initial document readiness, and the reader derives the no-scheduling
terminal from `complete` plus the absence of commands and timing captures.
The confirming selector passed 79/79. A further mutation tests whether a
completed capture can falsely claim that same initial state.
That mutation returned one failure with 79 passes. The reader now rejects
commands or captures that contradict a complete initial document state.

Checks at that correction: the owning Node-only selector passed 80/80, the
synthetic pinned-loader selector passed 5/5, scoped ESLint passed, and tracked
and untracked whitespace checks passed. Lifecycle stamps and the first-party
work-cutoff signal add no browser package import or API override. A same-millisecond
close/start epoch tie is conservatively rejected rather than promoted to a
wire relation. The independent compliance rerun found the partial-measurement
issue below. Further reviews were pending at that checkpoint. No browser, SDK, private
original, actual admission or successor operation was performed or scheduled.

## Partial-measurement compliance correction (UNINDEXED)

The fresh compliance rerun cleared the cutoff, context ordering and
chronology/late-acquisition findings. It retained one partial-measurement
blocker. Before changing the reader, the same writer added the reviewer's
otherwise-consistent fake-record mutation: a measurement and its matching
journal entry replace the configuration row in a five-row uncreated early
control. Commands, observation, bridge charge and all other data are
unchanged. The audited Node/Vitest selector, import guard and synthetic-only
execution closure remain unchanged. No browser, SDK, original private input,
listener or worker is used.

The initial red selector returned 80 passes and one failure: the expected
`invalid-evidence` was `condition-not-created`. Additional partial controls
kept the matching request journal, URL fields, observation and bridge charge
consistent while testing malformed or duplicate `id`, `ev` and `plt`, request
time, and a missing observation. The same selector then returned 81 passes
and 17 failures. These failures returned `missing-positive` or
`condition-not-created` instead of `invalid-evidence`. A valid partial
measurement, including a different but numeric `plt`, stayed in the
incomplete category. Both red runs preceded the reader correction.

The reader now checks every retained measurement against the sole PageView
command, event timing, observation interval, issued time and exact `id`,
`ev` and numeric `plt`, even when other roster rows are absent. The complete
roster path uses the same measurement validator. No missing row is treated as
an observed row, and a valid partial wire value does not establish a wire
relationship. Additional controls cover an extra PageView and unavailable
event timing with bridge size recomputed.

Source-only checks at that correction:
- `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`:
  100 passed, zero failed.
- `./node_modules/.bin/vitest run test/meta-pageview-source-loader.test.js`:
  five passed, zero failed.
- Scoped ESLint on the four native source files and owning test: passed.
- Tracked and untracked whitespace checks: passed.

These are synthetic source checks, not native qualification. At that
checkpoint the slice was claimed and `IN_PROGRESS`; review was pending. No browser
package, native SDK, private original, real admission or live operation was
used or scheduled.

## Pending-header refusal craft correction (UNINDEXED)

The independent craft review found that an unknown or duplicate route could
remain active until the recorder's asynchronous header collection settled.
Before changing the browser source, the same writer added synthetic pending-
header controls for both refusal paths. They release fake SDK readiness
without resolving headers and check command issuance, retained partial
effects and cleanup reporting. The existing Node selector, import guard and
synthetic-only execution closure are unchanged.

Before the fix, the owning selector returned 100 passes and two failures.
For both unrostered and duplicate requests, headers had started but remained
pending; the synthetic context was not closed, the stop flag was absent and
one PageView was issued after readiness was released. The expected result
was a closed context, an active stop flag and zero PageViews.

The synchronous roster decision now initiates the existing stop and context
close before returning the refusal to the unchanged recorder. The recorder
still retains the issued request and attempts its normal abort and journal
work. The first confirming selector passed 101/101 after removing the
redundant roster-length test, which passed inert bytes to a function that
did not consume them. Separate controls then held the synthetic abort open
for both refusal paths. Final controls passed without resolving headers or
abort, retained the partial request and earlier commands, and reported
unsettled route cleanup as a timeout. No shared recorder was changed.

The craft review also noted the protected capture, emergency bridge and
publication/readback reserve as a strength. That reserve and the shared
8 MiB ceiling are unchanged.

Source-only checks at that correction:
- `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`:
  103 passed, zero failed.
- `./node_modules/.bin/vitest run test/meta-pageview-source-loader.test.js`:
  five passed, zero failed.
- Scoped ESLint on the four native source files and owning test: passed.
- Tracked and untracked whitespace checks: passed.

These controls do not establish native qualification. At that checkpoint
fresh compliance, craft and architecture reviews were pending and the slice
was `IN_PROGRESS`. No browser, SDK, private original, real admission or live
operation was used or scheduled.

## Late-fulfillment test-quality correction (UNINDEXED)

The fresh compliance review cleared the capacity representation and earlier
guards, but found that the late-fulfillment assertion inspected a detached
snapshot. The same writer strengthened that existing synthetic control
to await the actual route task and observe encoding of the inert
configuration buffer. A temporary guard-removal mutation checked whether
the assertion detects late retained-response materialization. The selector,
import guard and synthetic-only execution closure are unchanged.

The control now retains and awaits the actual fake route task. It spies on
base64 conversion of the same inert configuration buffer passed to the
recorder, rather than relying on the copied request snapshot. It also checks
that releasing the pending fulfillment does not change retained accounting.

The targeted command was
`./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js -t 'publishes referenced source and partial effects after pending fulfillment'`.
With the guard intact, it passed one test. The writer
temporarily removed only `if (loan.released) throw new Error("route-failure")`
from the fulfillment continuation. The targeted selector then failed one
test at the base64 spy assertion: one synthetic configuration conversion
occurred after release. Restoring that exact guard made the targeted selector
pass one test again. The browser source SHA-256 before and after the
temporary mutation was identical. This test proves the guard prevents late
retained-response materialization in the synthetic recorder path. It does
not prove cancellation of underlying browser I/O.

Source-only checks at that correction:
- `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`:
  119 passed, zero failed.
- `./node_modules/.bin/vitest run test/meta-pageview-source-loader.test.js`:
  five passed, zero failed.
- Scoped ESLint on the four native source files and owning test: passed.
- Tracked and untracked whitespace checks: passed.

No production behavior changed in this correction. At that checkpoint the
slice was `IN_PROGRESS` and ordered independent reviews were pending. No
browser, SDK, private original, real admission or live
operation was used or scheduled.

## Two-context capacity architecture correction (UNINDEXED)

The independent architecture review found that the capture partition cannot
fit even one mandatory pinned runtime response. Before changing allocation or
representation, the writer added a two-context synthetic full-roster test.
It uses inert bytes of the public closed-slice sizes, actual first-party
closure and preflight charges, fake platform handles and memory-only private
storage. It does not read or evaluate any original SDK bytes.

The public closed 060-19 slice reports 435,104 runtime, 379,575
configuration and 5,518 request bytes. The actual private manifest and input
lengths are not published there; the control uses small synthetic JSON for
those two files and charges their actual synthetic lengths. An initial test
setup omitted the measurement URL and failed with `Invalid URL`; that was
corrected before the behavioral red. The corrected selector returned
115 passes and one failure: the 435,104-byte inert runtime response was
`unavailable` instead of `available`. The recorder's required base64 charge
for it is 580,140 bytes. No implementation had changed at that point.

A separate preflight control then showed 474,339 bytes charged for a closure
whose retained page and metadata were 7,763 bytes. The two-test selector
returned 115 passes and two failures. Source-read charges may be released
only after discarded file buffers are no longer retained; the returned
page and closure metadata remain charged.

The source-aware allocation now reserves a separate allowance for known
bound response bodies, without letting ordinary capture consume that
allowance. A fulfilled response is checked against its bound source and
retained as a reference. Publication materializes each referenced source
once; the independent reader verifies every reference, byte value and role
hash. The source buffers, temporary response charge, retained source table,
serialization, exclusive write and readback all remain charged. A guard
prevents late retained-response materialization after a temporary loan is
released; it does not prove cancellation of underlying browser I/O. One bounded
case-wide failure witness covers the terminal operation: a failed late
control does not start the early context.

The prior 512 KiB emergency bridge reserve and conservative partial packet
reserve remain. Source-aware controls also exhaust ordinary capture after a
retained response, and hold a later fulfillment pending through cleanup and
publication. Both preserve the available partial effects and source bytes.
Missing, changed or cross-role source references are refused by readback.
An added accounting assertion exposed 427 uncharged generated document and
entry bytes: 117 passed and one failed. Charging those retained bytes made
the source-aware partial controls pass. Publication and readback still fail
explicitly on filesystem or hard-deadline failure.

One synthetic accounting sample used actual current closure and first-party
lengths. The retained preflight charge was 838,067 bytes, including two
7,763-byte retained closure records and the 820,197 public-sized original
inputs. Its synthetic manifest and input were 483 and 67 bytes; their actual
private lengths remain unknown. The generated document was 84 bytes, late
entry 171 bytes, early entry 172 bytes and page module 6,236 bytes. The
case-wide flexible capture allowance was 41,439 bytes and the deduplicated
source-table allowance was 1,095,128 bytes. The two full records consumed
868,703 bytes total before publication in that sample. The exclusive packet
was 1,116,823 bytes; its source table plus three separately charged packet
copies brought total retained accounting to 5,314,300 bytes, below
8,388,608. Exact packet and allowance figures can vary with source lengths,
synthetic metadata and timestamps. A deliberately failing one-test metrics
assertion obtained this sample and was removed after measurement.

The first implementation run exposed a body-size accounting exception, then
an insufficient per-context witness allocation. Both were corrected. A
subsequent readback fixture omitted real-binding readback accounting; its
arguments were corrected. The original source-only admission still grants no
permission or reservation, and native sampling, cache, referrer, vendor and
parity claims remain unresolved.

Source-only checks at that correction:
- `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`:
  119 passed, zero failed.
- `./node_modules/.bin/vitest run test/meta-pageview-source-loader.test.js`:
  five passed, zero failed.
- Scoped ESLint on the four native source files and owning test: passed.
- Tracked and untracked whitespace checks: passed.

At that checkpoint the slice was `IN_PROGRESS` and changed source required
fresh independent compliance, craft and architecture reviews. No browser, SDK,
private original, real admission or live operation was used or scheduled.

## Metadata and recorder refusal correction (UNINDEXED)

The independent compliance rerun cleared ordinary roster refusal but found
that a metadata or capture-budget refusal waited for abort before stopping.
The same writer audited the finite request callback and added synthetic
pending-abort tests before changing implementation. The Node selector and
its browser-import guard remain unchanged. The controls use only fake handles
and inert byte strings.

The first selector red was 103 passed and five failed. The extended callback
audit then produced 103 passed and eight failed before implementation.
Oversized metadata, capture reservation, request wrapping, recorder
reservation, unavailable body or headers, response reservation, and an
unexpected WebSocket all allowed one synthetic PageView before stop. The
metadata and capture tests held abort pending and exercised the preserved
overflow witness path. The WebSocket test held close pending.

The first correction passed 111/111. A further header-resolution audit then
added three controls with fulfillment held pending. Rejected, malformed and
capture-budget-exhausted asynchronous headers each allowed one PageView
before stop: 111 passed and three failed. These controls ran before the
header-path correction.

The finite callback audit and correction cover these branches:

- Expired work, invalid or oversized request metadata, request count and
  capture-reservation failure retain the bounded overflow witness and start
  stop before abort. The pending abort participates in bounded route cleanup.
- A request-wrapper or unexpected recorder invocation failure starts stop
  before its abort. An already observed request stays in the issued journal.
- Unknown, duplicate or already stopped roster decisions and synchronous
  recorder errors start stop before the recorder's abort or journal waits.
  The allowed single measurement abort is not itself a failure.
- Recorder request/response reservation and other recorder abort failures
  start stop in the wrapped abort before awaiting the underlying route.
  Existing work-deadline and recorder-error checks prevent fulfillment.
- Missing, rejected, malformed, oversized or unchargeable header arrays
  start stop when their failure becomes observable, including while
  fulfillment is pending. A header promise that has not resolved cannot yet
  establish a header error. Later recorder collection failures are checked
  as soon as the recorder returns, without another callback-controlled wait.
- Unexpected WebSockets start stop before awaiting socket close. Response,
  worker and page error observers and work timeout retain their immediate
  stop paths.

The pending-header, stalled-abort, stalled-fulfillment and stalled-WebSocket
controls retain the preceding commands and available request or overflow
evidence. Pending route work is reported as timeout, not settled. These
checks do not establish OS, process or profile containment. No shared
recorder, protected publication reserve, deadline or 8 MiB limit changed.

Source-only checks at that correction:
- `./node_modules/.bin/vitest run test/meta-native-sampling-case.test.js`:
  115 passed, zero failed.
- `./node_modules/.bin/vitest run test/meta-pageview-source-loader.test.js`:
  five passed, zero failed.
- Scoped ESLint on the four native source files and owning test: passed.
- Tracked and untracked whitespace checks: passed.

At that checkpoint the slice was `IN_PROGRESS` for fresh independent
compliance, craft and architecture review. No browser, SDK, private original, live admission or
operation was used or scheduled.
