# 051-09 supervised operator: controlled-source qualification

The fixed operator/page/additive gate now passes the controlled-source
qualification below. It is **not live-admitted**. This does not complete AC6/7
or advance051-09 beyond IN_PROGRESS. The original active-time allowance was
spent; the owner approved the bounded source-only extension recorded below.
Earlier incomplete checkpoints and findings are retained as history.

## Scope and evidence

The [operator contract](slice-09-supervised-operator-contract.md) passed scoped
frame review after correcting private-evidence versus executing-source custody.
Accepted ADR-0045 and the completed routing increment remain unchanged.

Source implementation ran2026-10-26T23:13:55Z–23:42:25Z, **1710 seconds**,
inside its30-minute checkpoint. Parent/author overlap is charged once. The
configured Jig implementer made no edits because its READY-only check conflicted
with the workflow's already-claimed IN_PROGRESS continuation. The retained
contract author continued with the same TDD and independent-review requirements;
no lifecycle rewind, false completion or plugin change was used.

Seven noted RED-to-GREEN cycles covered budget arithmetic, source/private-file
custody, shared page cap, stock phase order, additive worker gate, inspect
non-effects and ambiguous inverse state. The private command/failure witness
retains the original counts and tooling-selection error. These are controlled
unit/fixture observations, not native or vendor evidence.

At the checkpoint, five selected suites passed252 tests, including16 new tests.
The parent subsequently selected those suites plus the unchanged connector,
decisions and boot regressions: **338 tests passed across eight files**.
The page also compiled in memory with its fixed adopter-owned vendor import
external; no SDK was acquired/evaluated or deployment artifact produced.

## Exact checkpoint source epoch

| Source | SHA256 |
|---|---|
| `supervised-journey-operator.mjs` | `278827453512eece411263c92b325ce17f53184021964021efcb503cbafbae9f` |
| `supervised-journey-page.mjs` | `949232f5ab4409ce6ee04e5270da08077a0f466121c917994c61d6043b518e0a` |
| `stock-baseline-browser.mjs` | `23544fc3d96d9f05d21e13384cef0d77d3db3e14ded8b5ea3f037503115f2443` |

These paths are under `probes/adobe-compatibility/`. They describe this
checkpoint, not a future implementation epoch or a served-byte observation.

## Explicit unfinished work

The integrated controlled valid-job graph, READY-before-consumption ordering,
complete14-call flow, both capture joins and independently invoked shared
eight-call stop are not yet witnessed. Full private proof-envelope bindings,
signal cleanup and native asset/body boundary coverage remain open. Passing
the current units does not close these gaps.

The test-only continuation added an admission fixture, but its invented SDK
bytes correctly failed the fixed official SHA256 guard:253 tests passed and
the new positive expectation was RED. Neither captures nor independent stop
was reached. The prepared graph beyond that boundary was also unpopulated;
this is not merely a missing-SDK-file problem.

The parent retained that failed checkpoint and converted the invalid input
into an explicitly **negative source-admission test**, now named
`test/adobe-supervised-journey-source-admission.test.js`. It asserts refusal
before runtime import/network; no hash mock, predicate bypass or skipped
positive criterion was introduced. The whole positive witness remains open.

Independent source compliance returned **needs-changes** on that production
epoch: root-normalization field mismatch; concurrent journal sequence
allocation; journal-read failure aborting independent safety branches; missing
whole-window fit/activation recheck; lost post-READY EOF monitoring; unbounded
browser-session creation; and discarded/fabricated response headers. A bounded
causal correction checkpoint then ran285.393 seconds with new RED-to-GREEN
boundary regressions. Independent correction review verified six original
findings fixed, but EOF monitoring still misses a paused readable: the test
manually emits `end` rather than exercising actual EOF consumption.

Craft found another blocker: a poisoned journal's rejection in the catch or
finalization path can bypass `stopPair` after APPROVE and skip reserved Target
safety cleanup. Architecture found the bounded module split appropriate but
retained those blockers. **Compliance, craft and architecture all remain
needs-changes; there is no new source pass.**

Final frozen source differs from the initial table only for:

| Source | SHA256 |
|---|---|
| `supervised-journey-operator.mjs` | `f5d0d1eb715deb9ebb32558f7278092ce73cffc9f4bfe58618ab840d130005cb` |
| `supervised-journey-page.mjs` | `c677c2116f2d4b13412e2c4c4342a1955afc01ed7eb37bc2dfabea4492609f91` |

The parent observed **347 passing controlled tests in ten files** and clean
recommended-rule lint on eight changed source/test files. Explicit browser
globals cover serialized Playwright page callbacks and controlled window
fixtures; no repository lint configuration was changed. Those passes do not
supersede the independent blockers or missing integrated proof.

Coding stops at this incomplete checkpoint within the original time allowance:
remaining work cannot safely be completed and re-reviewed before its limit.
Continuing needs an explicit bounded extension, not an automatic reminder.
No commit, push or lifecycle advance is claimed for this unqualified source.

## Approved POC extension — 2026-10-27

The owner approved the pending30-minute **source-only** extension and explicitly
prohibited unrelated side work without approval. Active work resumed at15:12:25Z;
the original spent allowance was not reset. No live execution followed.

The paused-input finding now has a real PassThrough regression: after readline
pauses the input, unread terminal data followed by EOF previously left the loss
callback uncalled. The witnessed RED became GREEN after the monitor retained
consumption across pauses and removed its listeners on release.

Two further witnessed REDs exercised the unchanged private orchestration with
controlled IO: post-APPROVE journal write and close failures both skipped the
independent cleanup callback. Guaranteed outer finalization now attempts that
separately reserved inverse while preserving journal uncertainty. These narrow
failure-path tests do not stand in for public valid-job admission.

At15:18:08Z the parent observed350 controlled tests across eleven files and
clean recommended-rule lint on nine source/test files. Scoped independent
compliance, craft and architecture subsequently passed these two corrections.
They did not evaluate a complete public valid-job graph, both captures or
independently invoked stop. That controlled proof is still being completed;
source qualification and actual AC6/7 remain open.

### Complete controlled qualification

The public-entry fixture now validates the complete closed private job without
replacing crypto, source/evidence validators or scope/resource/budget checks.
It exercises actual `inspect/run/stop`, fourteen normal management operations,
sequential stock/chamber contexts, the actual additive gate, normal-page
observer, native-body handoff, recorder and wire checker, and the sole shared
eight-call safety inverse. The three cases cover ordinary completion,
post-APPROVE journal fsync failure still reaching SAVE, and independent public
stop owning cleanup while the original run lock remains present.

The official152336-byte SDK is opaque, hash-verified input, **not evaluated**.
Browser/SDK/HTTP/TTY/clock responses are controlled stand-ins. Page source is
bundled/pinned, not browser-executed by this fixture; focused page tests remain
separate. No result here establishes real rendering, native trust, supplier
serialization, Adobe receipt, native process custody or deployed bytes.

The integration suite is explicitly opt-in because it requires already-present,
ignored local SDK/head assets. Both suite and all asset-reading hooks are
gated. Missing/wrong opted-in assets fail; nothing is fetched or substituted.
Ordinary CI visibly skips these three cases and cannot claim their evidence.

```sh
AIRLOCK_05109_INTEGRATION=1 node node_modules/vitest/vitest.mjs run \
  test/adobe-supervised-journey-integration.test.js
```

The parent independently observed353 passing tests across twelve selected
files with the opt-in enabled, and separately verified3PASS opted-in versus
3SKIP by default. Recommended lint remains clean. Independent compliance
confirmed the full controlled fixture, then cleared the explicit hook-gating
correction. Scoped craft and architecture also pass on the unchanged source.
These are source-increment passes, not full-slice REVIEWED/DONE.

At that qualification checkpoint source was operator`0c65b049420f1687c0c7caa57e333038499b6c4bf1f7909bcd1f8e12239058e9`,
page`c677c2116f2d4b13412e2c4c4342a1955afc01ed7eb37bc2dfabea4492609f91`,
and unchanged helper`23544fc3d96d9f05d21e13384cef0d77d3db3e14ded8b5ea3f037503115f2443`.
Final integration test hash:
`50aa39bc7f4c1c0a5992374e72bc6bc6e8cbf8392c375769368ed46b992878cb`.

**Remaining POC step:** one actual matched stock/chamber journey after fresh
setup/preflight, exact prepared/served/source/job/cumulative-cost evidence,
independent native operator presence and exact-run approval. No new runner
project is required or authorized. Source qualification does not supply those
live facts, create reservations or grant resource operations.

### Actual preparation budget check — 2026-10-27

The later approved read-only preparation verified unchanged retained hashes and
accounting locally. The actual original cleanup reservation is14 calls, not
the synthetic8 used by a passing budget fixture: `stock-baseline.mjs:1737`
preserves64+14 under80, with independent site/Target safety branches. Adding
the new8-call prefix requires86. `supervisedBudget` refused that lower bound
with `budget-exhausted` before any HTTP or credential load. No original
reservation was dropped and no cap was silently raised. Source qualification
was never an actual affordability claim; the cleanup-only decision is pending.

The owner then approved86 at2026-10-27T15:50:12.978Z. Only the supplemental
operator's cleanup-call guard changed80→86; original ledger/limits and every
other cap remain unchanged. The actual14-call original reservation now forms
the unit and full integration fixtures. Witnessed TDD:1RED/9pass under80,
then GREEN under86;87 is refused through either remaining work or preparation.
Scoped frame, compliance, craft and architecture pass for this narrow delta.
Current operator SHA256:
`9125c43720b1ca6d997b546a0a3d1f8fda5aed5f6f87ed67f3cef69564bee509`.
This budget decision does not confirm unchanged setup or authorize live work.

## Actual native attempt — pre-browser failure

The replacement native command genuinely recorded READY and consumed its full
two-context/ten-request upper bounds on2026-10-28. It then returned UNKNOWN
before authentication HTTP, Target operations or browser creation. The normal
journal has no HTTP intent; cleanup authentication also failed locally. Its
separately permitted credential-free site check verified the disabled config;
Target/schedule and broader cleanup observations remain UNKNOWN.

Offline replay of the exact bound input reproduces a deadline mismatch:
inspection evaluates scope through the serving end, while management
authentication evaluates through the later cleanup deadline. Input authority
expired exactly at that deadline, but the validator requires expiry strictly
later. The former passes and the latter returns`stale_evidence` before dispatch.
The exact native credential handle separately validates. This is a local
admission/producer inconsistency, not an Adobe SDK execution failure.

A separate source inspection found required browser config proof is never
requested by the supervised adapter while ordinary site boot is disabled.
That is another pre-dispatch defect, but it was not reached and must not be
misreported as this attempt's cause. No fix or live retry is claimed.
The later safety withholding preserved the approval artifact after the claim
and failure already occurred; it did not prevent or cause that consumption.
All consumed upper bounds remain charged despite zero browser/SDK acquisitions.

### Local correction checkpoint — controlled only

The two fixes now have witnessed regressions in the existing051-09 ownership:
actual public inspect previously admitted authority expiring exactly at cleanup
stop, and the old integration navigation stand-in silently emitted a config
fetch that production never made. Tests now remove that invented navigation
observation and require the operator's explicit browser fetch before SDK work.
Seven RED failures preceded the changes;243 tests across eleven selected
files subsequently passed.

Fresh admission checks scope through full cleanup stop, without weakening the
shared strict-expiry validator. The fixed browser helper fetches only the
literal disabled config path, checks original bytes/hash/status/media and
enabled:false, and provides the normal-page observation in both arms.
The helper was placed before orchestration to preserve the unchanged
post-approval finalization regression's source boundary; no existing guard was
weakened. New source SHA256:
`d36afcb1122901d9798efbaa3dce87309369a53464ea7990341707918aee6b77`.

Scoped independent compliance, craft and architecture passed this correction;
the parent also observed focused lint clean. No fresh-main/fix lifecycle or live
verification claim is made for a separate numbered bug. This is completion of
the already-active unlanded proving code, not another owner or runner project.
No new HTTP, activity change, browser, SDK, claim refund or retry followed.
Any future producer must put cleanup stop strictly before its authority expiry;
the failed job/input and consumed reservation remain immutable.

### Single-retry accounting increment — 2026-10-28

The owner approved one accounted retry under the limits in the
[operator contract](slice-09-supervised-operator-contract.md#one-accounted-retry--owner-approval-2026-10-28).
The prior pair remains charged and its Target cleanup remains UNKNOWN.
The approved increment is source-only until the separately required fresh
setup, exact job, native READY and independent stop gates are satisfied.

The existing slice was already claimed IN_PROGRESS; the Jig implementer again
declined its READY-only entry gate without editing. The author continued the
bounded increment without rewinding the lifecycle. Controlled tests first
failed for retry arithmetic, retained provenance and one-use admission; the
implementation now binds the old claim/job/terminal/journals, carries both
pair reservations, enforces the approved cumulative ceilings, and uses an
exclusive durable marker for the one additional retry. The marker is created
only after native READY, never by inspect or tests using controlled filesystem
stand-ins. There is no automatic retry. On a running host a failed or partial
claim remains an exclusive blocker, but if file/directory sync fails or the
host crashes, persistence of that marker is UNKNOWN. No external effect occurs
before both syncs succeed; the native prompt directs the owner not to restart
even if the marker is absent. This does not qualify crash recovery.

An opt-in controlled integration uses retained local evidence with mocked
filesystem, HTTP, browser and terminal. It exercises job admission, both
synthetic arms, full cumulative reservation, claim-write and sync failures,
refusal of a second attempt, and an independent stop after loss of a prior
journal. Stop still depends on the new case's protected claim, source pins and
other required job evidence; this is not a general cleanup-availability claim.
It is not a live vendor, browser, Target-cleanup or product receipt.
Scoped compliance review passed after correction of the independent stop's
historical-journal dependency and clarification of the supervised no-restart
boundary. The reviewer did not execute tests or verify live evidence. The
author observed177 controlled tests passing across12 files and focused lint
clean. The owner supplied the craft reviewer’s pass in chat after its agent
result became unavailable. Its nonblocking nit is that the public-entry retry
integration currently depends on opt-in private local fixtures. Both reviews
are source-only; neither establishes live success. A separate bounded
architecture review also passed with the same fixture-coverage nit and a note
that source-epoch changes constrain old stop paths. These three passes do not
establish live readiness. Current operator SHA256:
`4c29d8e61ce46032319a90907c7b8b09e5f187d147a56c4eab04274453cb047b`.
The exact operator contract SHA256:
`b14318fdc9dd67fa057509332269565f8e31b92d357c112c61083865dff10327`.

An independent review identified that an older job's pinned operator hash no
longer matches the amended source, including for stop. The earlier failed case
has already used its stop lock and is not reopened. The contract now records
the source-epoch limitation instead of promising older-job stop availability.
No currently running case was reported in this session when this increment
began; this does not establish global quiet or historical cleanup.

No actual prepared exact job, complete cumulative affordability, current setup
and all twelve preflight checks, served proof or native operator presence is
established. No browser/SDK/vendor/backend/Docker/deployment operation, original
ledger change, context or request reservation followed. **Do not execute the
unqualified operator.**

The owner subsequently confirmed that the selected fixtures, routing,
permissions and disabled site configuration were unchanged. This is an owner
statement, not an independent configuration readback or a completed preflight.
The owner was unavailable when asked about remaining present for the native run
and independent stop. The exact retry preparation and job remain unprepared;
the historical producer scripts use expired windows and cannot be replayed.

## C partial source stop — 2026-11-02

C stopped at the unqualified source checkpoint
`341aa6f060b70b3318f38a317dc5036b4b07193c`. It contains a fixed-original
reader increment, not the approved integrated outcome. The actual
preparation producer, original output manifest, independent three-digest
handoff, assembler and producer-to-real-inspector witness are absent.
Full 051-09 AC6/7 and completion remain open.

The writer observed the targeted prior-pair mismatch RED and then GREEN,
and at 22:07 UTC observed the selected deterministic and controlled opt-in
regressions passing. A later coordinator run at 22:23 UTC, with both
existing opt-in flags applied to its 20-suite selection, reported 27 failed,
1,223 passed and 10 skipped across four failing and sixteen passing files.
The failures principally reported missing historical originals. These are
different timestamped observations, not a later pass or proof that the
earlier run did not occur. The prior stop-loss fixture removed only the
historical stop journal from its in-memory map; it did not demonstrate loss
of the entire prior-job/claim/terminal/journal set.

Both execution surfaces subsequently observed the named historical worktree
`automatic-succotash` itself absent. Its private originals and fixture inputs
are therefore unavailable at the required paths. The cause is not
established; neither the controlled tests nor any other actor has been
shown responsible. Owner-directed custody and provenance recovery is
required before source execution or further validation. Do not recreate the
worktree, original evidence or consumption namespace as an implicit retry.

A fresh independent Sol compliance review **failed** on the exact frozen
source checkpoint; see the [record](reviews/slice-09-compliance.md).
In addition to the missing integrated path, it identified a conditional
parent-alias race at retry-marker creation, digest coercion before rejection,
assertion-thin role cases, and non-opt-in tests dependent on private originals.
These findings are not evidence of what happened to the historical worktree.
The source is not qualified; craft, architecture and reconciliation for this
increment have not cleared. Existing historical passes remain epoch-scoped.

The protected W consumption namespace still requires no reset or relocation
while the allowance is unresolved; any move needs the reviewed handoff in
ADR-0049. Current source/deployment qualification, timing, authentic
authority, live supervision and historical UNKNOWN cleanup remain open.
No new live operation, reservation, lifecycle transition or full-slice
completion is claimed.

## Replacement R1 source checkpoint — 2026-11-03

[ADR-0050](../../decisions/adr-0050-evidence-independent-05109-source-checkpoint.md)
supersedes ADR-0049's executable original-read premise. The approved
[R1 bar](slice-09-focused-chamber-journey.md#replacement-r1-source-only-contract-and-completion-bar)
does not convert this C FAIL into a pass. The original-backed preparation,
handoff and assembler remain unimplemented; originals remain unavailable,
and old charges and UNKNOWNs remain. The completed R1 source checkpoint and its
scoped reviews are described in the [bounded witness](slice-09-replacement-source-witness.md).
