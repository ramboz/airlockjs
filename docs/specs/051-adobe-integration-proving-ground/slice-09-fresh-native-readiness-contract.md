# 051-09 fresh native readiness contract

> **Historical source-frame contract.** On 2026-11-05 the owner refused
> ADR-0051 as the wrong artifact and granted execution and configuration
> changes within the owned POC. Its proposed acceptance, human challenge,
> and separate execution-permission receipts below are no longer current
> requirements. The [native source interface](slice-09-native-source-interface.md)
> describes the current bounded controller and operational controls. The
> earlier source reviews apply only to their recorded checkpoints, not the
> subsequent authority correction. Other technical conditions in this
> historical document must not be read as proof of a completed native run.

This checkpoint prepares source for one foreground native-control path and
a separately invocable stop request. Closure depends on the live foreground
producer. Any future blank browser controls need separate gates and a new
finite allocation. This checkpoint admits no browser, SDK or Adobe effect.

**Status: proposed amendment, source implementation in progress.** The owner chose the personal
attestation direction for source-only work at `2026-11-04T23:21:49.600Z`
and approved the browser-manifest and owned-descriptor cleanup directions
at `2026-11-05T00:50:41.283Z`. The latter choice does not accept this exact
schema or decision. The current frame PASS at `2026-11-05T01:59:57Z`
reviewed `b3fba2770ad11a1889477cdd60ccff24cf1f7906`. The `needs-changes`
verdict on `8e13c7333ffc8c6f29905a6bc4f187aff8e05c81`, earlier clearing
PASS and semantic clarification, the `01:36:15.250Z` producer-phase
adverse verdict, first-read records and browser-bundle records remain
historical. Jig does not detect semantic staleness automatically; this
frame PASS is not implementation review or owner acceptance. No native effect is
authorized until source safety reviews, explicit owner acceptance of the
exact reviewed [ADR-0051](../../decisions/adr-0051-fresh-native-only-admission.md),
a separately approved finite physical allocation and actual owner readiness.
The source-only approval is not any of those gates.

## Authority and scope

The earlier approved plan is `fresh-native-readiness-plan.md`, SHA-256
`42ad9313e9c98b04716ec6ce414fa6e2660eb9d8cfb4545d3f80dca8c68b478e`.
The owner's exact response, "yes, I approve it", was recorded at
`2026-11-04T21:40:25.228Z`. Its window ended at
`2026-11-04T23:10:25.228Z`; its unused `0/2` native allowance is closed.
At `2026-11-04T23:21:49.600Z`, the owner said "I give you my approval" to
the complete source-only continuation, whose proposal section has SHA-256
`6d5bd1f8f467ffacd3075fc606d3b1a7ffc1c3ca8098718b7cabed1f26e76331`.
Its 90-minute window ended at `2026-11-05T00:51:49.600Z`. At
`2026-11-05T00:59:12.813Z`, the owner approved a new source-only
continuation and delegated extensions as needed for this same source scope.
Its initial 90-minute progress checkpoint is
`2026-11-05T02:29:12.813Z`. The continuation is work allocation and
direction approval, not a job, prepared state, owner presence, decision
acceptance, cleanup allocation or physical release.

The earlier starting source checkpoint was
`55d557642a1f365bfbafef5fea03e5cfedc15e68` on `fresh-pair-source`;
the earlier reviewed executable source is
`649a85f6375aaaa6a56028df37b6df203c9289d6`. The prior source-only
continuation started from `3ecfcc0fc468363365e722e6c6c67b98d81852e3`;
this continuation starts from `27978b45aeee75733ae72163c8105270e4169699`.
Fourteen prior source-track and three earlier readiness-document sessions
remain charged. At most five additional independent Sol reviewers are
available, one each for frame, compliance, craft, architecture and
reconciliation; the source-track maximum is nineteen. Same-task backedges
reuse the reviewer. The writer creates no sessions. No old time, physical
case, request or spending allowance is reset.

Only the existing 051-09 work is in scope. Historical public `run` and
retry remain refused, their private internals and old roots remain protected,
and `enterFreshPair` and `stopFreshPair` are not live authority. ADR-0045 is
conditional; ADR-0050 preserves historical C FAIL and UNKNOWNs. Proposed
ADR-0059/0043 and accepted or closed records stay unchanged. Full 051-09
remains IN_PROGRESS. No SDK, browser rendering, EDS-adoption or release
claim follows from this checkpoint.

## Source seams and limits

The proposed adapter may reuse the public
`attachSupervisedJourneyDispatchGate` (`stock-baseline-browser.mjs:393`),
`startStockMeasurements` (`stock-baseline-browser.mjs:863`),
`startStockWireRecorder` (`stock-wire-recorder.mjs:118`),
`startStockResultObserver` (`fresh-pair-stock-observer.mjs:16`) and
`checkSupervisedJourneyCapture` (`supervised-journey-operator.mjs:647`) for
a later separately authorized journey. Their existence is not proof that the blank controls
need to invoke them or that their actual SDK shapes are qualified.
`closeSupervisedBrowser` (`supervised-journey-operator.mjs:775-787`) connects
to a supplied endpoint and bounds `Browser.close` to ten seconds. It does
not by itself verify that the endpoint belongs to the current job.

The historical `operateAttended` creates a Playwright server and obtains its
process and endpoint (`supervised-journey-operator.mjs:978-987`), but also
uses old custody and management operations. Do not call or expose its private
`runArm`, `operate`, or `loadJob` paths. Do not fabricate campaign, recovery
or completion guards to call `runStockBrowserCase`. Do not add a generic
daemon, broker, scheduler, custody framework, callback or SDK proxy, second
sandbox or DOM proxy. Keep core, frozen APIs, default grants, cookie policy,
endpoint and tenant fences unchanged.

The owner permits later necessary edits to the existing Target activity.
This checkpoint permits none: no activity date/state/allocation change,
Adobe API or other network call, deployment, browser launch, context, page,
native control probe, vendor SDK acquisition/evaluation/dispatch or product
run. Existing source declarations,
manual screenshots and read-only preflight are not current operator readiness
or live admission.

## Proposed fixed commands and private binding

These are interface requirements, not commands currently available to run:

```sh
node probes/adobe-compatibility/fresh-native-control.mjs start --job "$AIRLOCK_NATIVE_JOB" --expires-at "$AIRLOCK_NATIVE_EXPIRES_AT" --hard-stop-at "$AIRLOCK_NATIVE_HARD_STOP_AT" --cleanup-until "$AIRLOCK_NATIVE_CLEANUP_UNTIL"
node probes/adobe-compatibility/fresh-native-control.mjs stop --job "$AIRLOCK_NATIVE_JOB" --hard-stop-at "$AIRLOCK_NATIVE_HARD_STOP_AT" --cleanup-until "$AIRLOCK_NATIVE_CLEANUP_UNTIL"
```

The owner starts `start` in a separate native terminal and retains the
second command in another independently usable native terminal. `--job`
identifies one private immutable case file, not a URL, executable, callback,
browser endpoint or arbitrary mode. Both commands accept only the fixed
schema and refuse unknown fields, modes and malformed values before effects.
The stop command may only record stop intent for the live foreground
producer; it cannot select a handle, create or resume work.

### Initial controller deadline and bootstrap

The trusted operator supplies the exact UTC ISO timestamps with milliseconds
as fixed command arguments in the order shown. Before the first
controller-initiated filesystem operation, parse the complete command and
timestamps without filesystem access. Check the `--job` path lexically
against the fixed worktree `secrets/fresh-native-<32 lowercase hex>/<case>/job.json`
shape and the two named cases; no other root, URL or path is accepted.
Reject malformed or duplicate arguments, non-canonical times, a cleanup
bound not strictly after the initial hard stop or more than ten seconds
later, and a START expiry after its hard stop. START's initial cutoff is
the earlier supplied expiry or hard stop; STOP's is the supplied hard stop
alone. Before each controller-initiated filesystem step and after it
settles, enforce the applicable cutoff using both wall time and the same
monotonic elapsed bound; a regressing, invalid or expired clock is UNKNOWN.
START uses its initial cutoff until the consumed-case stop-only producer
phase specified below. All other START steps retain that cutoff. File
contents never extend either supplied bound.

Before the immutable job and allocation plan have been read and matched to
the supplied times, permit only read-only custody checks and reads of that
fixed job and its derived `allocation.json`. Bound this bootstrap to 128
controller filesystem steps, at most 262144 bytes per file and 524288
bytes in total; exceeding a limit refuses. No historical path, browser
cache, reservation, lock creation, publication, browser or SDK operation is
part of this bootstrap. The job must match all supplied timestamps exactly
and its plan digest, case, owner and allocation root must match the fixed
allocation record. The plan's case-specific cleanup timestamp and approved
hard-stop bound must match the job under the normal closed-schema rules.
The STOP command does not accept or compare an initial START-expiry input.
Before a later governed operation, all ordinary decision, source, owner,
readiness and physical-allocation gates remain mandatory.

An initial timestamp is a trusted caller's consistency bound, not an
independently authenticated receipt, an approval or bearer permission.
The trusted owner and same-user coordinator are responsible for supplying
the exact previously approved future job values; malicious same-user
forgery is outside this model. If the job or plan does not bind them, stop
without extending a bound or accepting the records.

Before job and plan binding is complete, a bootstrap descriptor can be closed
only while still before the initial cutoff, and only if that process obtained
and verified its identity before the cutoff. A late or unverified open is
UNKNOWN and is not closed under a retrospectively inferred authority.
After binding and validation of the separately approved future allocation
and exact decision acceptance, its cleanup bound may apply only to an
already-owned, verified descriptor under the descriptor rules below. Mere
timestamp or plan consistency does not establish that approval. A descriptor
still unverified or an unobserved close remains UNKNOWN. An
already-started OS operation can complete late; this contract does not
claim to stop it. The initial bound begins at controller code, not Node's
own startup/module loading or other trusted OS activity. Node GC and OS
completion remain unqualified.

The owner's private job is a JSON object with exactly these fields:
`kind: "airlock.05109.native-control"`, `schema_version: 1`,
`case: "owned-stop"` or `"stop-during-acquisition"`, `case_nonce` (32
lowercase hexadecimal characters), `owner_uid` (the current OS user ID),
`plan_sha256`, `source_commit`, `source_pins`, `browser_manifest_sha256`,
`platform_baseline`, `decision_sha256`,
`authority_ref`, `readiness_ref`, `issued_at`, `expires_at`,
`hard_stop_at`, `cleanup_until`, `allocation_root`, `case_seconds: 45` and
`observation_seconds: 10`. Timestamps use UTC ISO format with milliseconds;
`hard_stop_at` must be within the separately approved future physical
allocation, and expiry cannot exceed it. The source-only deadline is not a
physical allocation or a future job hard stop. `plan_sha256` binds the
separately approved future physical plan, not either expired or source-only
work allocation. `source_pins` is a closed list of exact worktree-relative
paths and SHA-256 digests covering the reviewed command and its installed
Playwright package dependencies. The separate browser manifest covers the
selected browser-owned bundle described below. `authority_ref` identifies the parent's separately retained record of
the owner's acceptance of the reviewed decision hash. `readiness_ref`
identifies that case's actual owner readiness confirmation. Both references
are private, predetermined paths under the fixed case allocation, not
bearer flags. Under this proposed model the owner and privileged same-user
coordinator are trusted to perform and faithfully record the real actions.
Software validates the records and their binding, not cryptographic human
identity or protection against a malicious same-user coordinator. That
actor can forge private records or bypass its own workflow. File ownership,
job data, a nonce or a boolean alone does not establish owner readiness.

### Browser bundle and trusted platform

The proposed job binds `browser_manifest_sha256` to the canonical digest
of a closed `browser-manifest.json` at the allocation root. Its fields are
`kind: "airlock.05109.native-browser-manifest"`, `schema_version: 1`,
`bundle: "playwright-chromium-headless-shell"`, `revision`, `platform`,
`executable` and `entries`. The digest is SHA-256 over UTF-8 compact JSON
with object keys sorted recursively and arrays kept in order, as for the
other private records. The manifest is a private, no-clobber record under
the allocation root; the separately approved physical plan binds the same
manifest digest for both cases. `revision` is the decimal
`chromium-headless-shell` revision in the pinned installed
`playwright-core/browsers.json`. `platform` is exactly `darwin-arm64` or
`darwin-x64` and must match the running process. `executable` is exactly
`chrome-headless-shell-mac-arm64/chrome-headless-shell` or
`chrome-headless-shell-mac-x64/chrome-headless-shell`, respectively,
relative to the bundle root.

The root is derived, never supplied in the job or manifest: the current
owner's OS account home, then `Library/Caches/ms-playwright/` and
`chromium_headless_shell-<revision>`. Derive the home from the current OS
account entry, not a caller-supplied path, and require `HOME` and the running
UID to match it. Reject `PLAYWRIGHT_BROWSERS_PATH`, `NODE_OPTIONS`,
`NODE_PATH` and overrides that alter Playwright's browser selection or
dynamic library loading. This does not attest what happened before Node
started. The future owner and coordinator agree the exact manifest and
digest as part of the private physical plan; computing it from local files
alone is not that approval.
The reviewed command launches only the validated executable path with the
fixed headless options; a channel or caller-supplied executable cannot
select another browser. This host-specific representation is not a general
filesystem root mapping. Missing assets or an unsupported host stop; do
not download, copy, or fall back to another browser.

`entries` is the complete, nonempty, lexically path-sorted tree beneath
that bundle root, including directories, regular files and internal symbolic
links. Each entry has exactly `path` and `type`, where type is `"directory"`,
`"file"` or `"symlink"`; file entries also have a lowercase 64-hex `sha256`,
and symlink entries also have their exact relative `target`. Paths are
nonempty normalized slash-separated relative paths with no `.` or `..`
component, and entries are sorted by path's UTF-8 bytes. Reject duplicates,
absolute paths, special files, links that escape the bundle or form a cycle,
hard-linked files, and missing, added, changed or unreadable entries. Do not
traverse directory links as additional trees. Every directory and file is
checked for expected owner and non-writability by others. Check each
ancestor from the account home to the bundle root, reject redirected
ancestors and links there, and recheck link targets and each opened file's
identity. The exact executable is a regular executable file included in the
manifest. Hash the raw bytes of each regular file.
Enumerate the complete tree, not only known executable extensions, so helper,
framework and dynamically loaded browser-owned files are included. Bound
enumeration to 8192 entries, 4 GiB total regular-file bytes and 1 GiB per
file; exceeding a limit refuses rather than truncating the inventory. Check
the manifest digest and the complete tree before reservation and again
immediately before launch. A changed or unverifiable tree refuses; a race
after verification is not claimed to be eliminated. No caller-chosen hash
or synthetic fixture establishes actual bundle provenance. The consumed
case's STOP checks the same immutable manifest and original job/intent
binding; it does not demand that the browser files remain unchanged after
the owned process was launched as a condition of requesting that process's
stop. It still validates the reviewed command's source and decision bindings.

The pinned package's `browsers.json` and macOS headless-shell mapping are
visible in `node_modules/playwright-core/browsers.json` and
`node_modules/playwright-core/lib/coreBundle.js:32399-32409,32816-32839,32911-32922,43100-43106`;
these installed source files are not proof that the corresponding browser
bundle exists or is compatible. This proposal has not read or executed that
bundle.

`platform_baseline` is a closed object with `os: "darwin"`, `arch`
(`"arm64"` or `"x64"`), `os_release` from Node's OS release value and
`node_version` from `process.version`. The future
owner-approved physical plan binds the same baseline. START and STOP compare
it to the running OS and Node process and to the plan; mismatches refuse.
The OS kernel, system libraries and Node runtime are explicitly trusted,
not included in the browser manifest or independently authenticated by
these fields. No OS, runtime or bundle attestation against a malicious
same-user coordinator is claimed.

The separate independent-issuer alternative remains blocked: no external issuer,
verification key or receipt service has been handed off. A same-user key,
caller-chosen key or new broker is not an independent trust anchor. That
alternative is not a premise of the selected trusted-owner model.

### Proposed attestation and release

The parent retains a private acceptance record containing the owner identity,
exact reviewed decision digest, acceptance time and source of the owner's
actual acceptance. The plan approval and frame review are not that acceptance.
The parent and owner fix the complete job, including its receipt paths, and
hash it before a readiness confirmation is recorded. This avoids changing the
job after a receipt has bound its digest.

The owner personally starts the reviewed command in an external native
terminal, checks the displayed case and job digest, and types the fresh
case-specific 32-lowercase-hex-character challenge directly into that
terminal. The challenge is not a secret or proof against the trusted
same-user coordinator. A coding-session or app terminal, model-piped input
or chat message alone is not that action.
The owner confirms readiness for that exact job and challenge to the
coordinator. The coordinator records the actual confirmation and its source
without claiming direct observation of the external terminal or independent
authentication of human presence. The trusted owner's real action remains
mandatory; a receipt, model-generated confirmation or piped challenge
response does not make an action happen. If the owner has not acted or
confirmed, the case must not be released.

Before any reservation or acquisition, the foreground waits for the
parent's private readiness and release records. The readiness record binds
the owner, exact job digest, case nonce, challenge, acceptance record digest
and confirmation time. The release record binds that readiness record digest,
the same job, owner, case and decision, and its own time. The parent records
the actual source of confirmation without publishing private challenge or
handle values. Both records have closed schemas and no-clobber creation.
The parent releases only after the actual source safety reviews and every
other required gate.

At START, validate all bindings and time order, require the owner's
challenge confirmation and release to be no more than 60 seconds old at each
pre-reservation and pre-launch check, and refuse future or inconsistent
timestamps. The case is charged if a pre-launch check fails after reservation.
These records support a trusted operational attestation, not proof against
an agent able to create them. Their START freshness is not a consumed-case
STOP expiry.

The owner supplies a separate job file for each named case under the same
private `allocation_root`. Its fixed entries are `allocation.json`,
`browser-manifest.json`, `owned-stop/` and `stop-during-acquisition/`.
Each case directory contains
`job.json`, private `acceptance.json`, `readiness.json` and `release.json`,
exclusive `intent.json`, `stop.json` and `terminal.json` records as created,
plus a fixed `lock/` directory used only for the short admission transitions.
Paths are derived from the validated case and allocation root, not
command-line overrides.
`authority_ref` and `readiness_ref` identify the fixed acceptance and
readiness files; the release path is derived from the same case directory.
`allocation.json` binds owner, the approved future physical plan and decision
to the two named slots. The proposed physical plan retains its existing
closed fields and adds exactly `browser_manifest_sha256`, `platform_baseline`,
`cleanup_until` and `stop_safety_scope`. The cleanup field is a closed object
with exactly `owned-stop` and `stop-during-acquisition` keys, each carrying
that case's UTC cleanup deadline. `stop_safety_scope` must be exactly
`"same-consumed-case-to-hard-stop"` and is included in the plan digest bound
by the job. The exact future physical plan must be separately approved with
that scope, and the owner must accept the exact reviewed decision that
authorizes it. This field is a consistency binding, not approval by itself.
`intent.json` binds the immutable job digest and consumes its slot; no
deletion, missing terminal or failed attempt releases it.

The proposed local coordination uses exclusive directory creation for
`lock/`, no-clobber creation for intent and stop records, and
durable writes before releasing the lock. The process holding the lock
verifies ownership and path identity, then serializes reservation, stop
and each new context/page admission. It must not hold that lock while
waiting for browser launch to settle: the independent stop must be able to
record stop while acquisition is pending. A stop becomes effective when
`stop.json` is durably created under the lock. A later admission must
refuse; an operation already admitted before that point remains accounted
for. Acquisition settlement reacquires the lock, checks stop and either
records acquisition of the retained handle or begins the fixed late-close
path without admitting a context. Failure to acquire or safely release the
lock within the bound, including a stale lock after process loss, is UNKNOWN.
No automatic stale-lock removal or repair is authorized.

This is a proposed host-specific mechanism, not a claim that the existing
filesystem primitives already satisfy it. The implementation and review
must establish exclusive coordination without trusting mutable case files.
If durable publication, path identity or the lock protocol cannot be made
safe within this fixed scope, stop.

Use closed schemas and canonical digest verification. A plain boolean, an
inspection DTO or a caller-written approval string is not proof of owner
acceptance or presence. The parent checks the owner's actual confirmation
and releases each separately allocated future physical attempt after those
gates; it does not claim independent observation. Source mocks cannot
substitute.

The case directory and shared two-case allocation belong to the same owner.
For both commands reject symlinks in those private paths, wrong ownership, writable-by-others paths,
substitutions, changed job/source/decision digests and ambiguous state.
The separately checked browser tree permits only the internal links specified
above; that exception does not apply to private allocation paths.
Apply expiry separately for START and consumed-case STOP below.
Create private files with restrictive permissions and no-clobber semantics.
The implementation must demonstrate that intent, reservation, stop and
handle admission are serialized for these fixed commands on the selected
host. If the available first-party primitives cannot do so without an
unreviewed filesystem or custody platform, stop. This requirement does not
claim general filesystem-race safety.

Before any browser launch, durably record exclusive intent and reserve the
case in one shared allocation. Each named case is consumed at most once;
an attempted, failed, interrupted or UNKNOWN case is charged. Refuse a
duplicate, conflicting owner, unprovable accounting record or third case.
Do not refund, relabel or automatically retry. Private endpoints, nonces
and detailed handle records stay out of public output and repository files.
Public output is limited to fixed phase/disposition categories and false
live-evidence claims.

### START and consumed-case STOP authority

For START, before reservation and again immediately before launch, require
`now + 45 seconds + 10 seconds <= min(expires_at, hard_stop_at)`. If the
second check fails after reservation, the case remains charged and no
browser is launched. Subsequent admissions of a context, page or any other
new operation require `now < expires_at` and `now < hard_stop_at`; expiry
revokes further admission. Use wall-clock deadlines with a monotonic elapsed
bound, and fail closed on invalid, inconsistent or regressing time. The
case and observation limits are not renewed by another command.

For STOP, require an existing consumed `intent.json` bound to the exact
immutable job and allocation. Verify the same owner, job digest, original
accepted decision and reviewed source bindings before recording revocation.
The live foreground producer verifies its retained actual handle before
closure. A missing handle while acquisition is pending permits stop intent,
not a claim of closure; settlement within the qualification interval must
still verify ownership. Settlement after that interval grants no new handle
or browser cleanup authority.
An unverifiable binding is UNKNOWN.
STOP may record revocation and initiate bounded closure after `expires_at`
only while `now < hard_stop_at`. It may not start, resume or retry, reserve
another case, extend any expiry or perform an SDK operation.

#### Consumed-case stop-only producer phase

The START producer may enter this phase only after it has bound the original
invocation's timestamps to the immutable job and plan, validated the exact
accepted decision, separately approved finite physical and cleanup
allocation, and required owner attestation, and durably consumed that same
case's intent. Missing or unverifiable prerequisites are UNKNOWN. The phase
is restricted to that producer and case. It can wait for and observe the
separately recorded same-case STOP, including while its already-started
launch is unresolved, and coordinate closure of its retained, verified
handle. It cannot admit new START work.

The original 45-second case and at most ten-second observation interval is
the qualification interval. Start its wall and monotonic tracking no later
than the first reservation attempt. Its end, `Q_end`, is fixed once and no
later than START expiry or the original hard stop. Earlier case or
operation-specific deadlines still apply. Neither this phase nor another
command restarts a bound. If the required control or observations are
unfinished at `Q_end`, qualification is permanently UNKNOWN, the case stays
charged and continuation is blocked. No later safety action can change the
qualification result, create a qualification observation or enable case two.
Earlier completed evidence remains historical.

Separately, the exact future owner-accepted decision and separately approved
physical plan may authorize the named same-consumed-case safety scope above.
Only that scope permits the original live producer to consume a valid
same-case STOP after `Q_end` and before the original invocation's supplied
`hard_stop_at`. It is not created by source approval, timestamps, the
descriptor exception or an expired allocation. Keep the original wall and
monotonic tracking; never use a later file value or fresh clock to extend
the hard stop. Check the applicable bound before and after each controller
step. Before `Q_end`, the existing qualification limits still apply.

The only controller filesystem operations in this phase are custody checks
and fixed reads needed to verify the same case's job, allocation, accepted
decision, owner attestation, original readiness and release, source and
immutable browser-manifest bindings, intent and STOP; acquiring, verifying,
syncing and releasing the lock at that case's fixed lock path; and exclusive
publication and sync of only the stop/closure observations and terminal
record for that case while inside the qualification interval. After `Q_end`,
allow only the separate safety records defined below, never a new
qualification or terminal record. These operations remain bounded and
serialized by the same lock protocol. Lock removal is allowed only for the
verified lock held by this process and before that operation's applicable
limit. A lock whose operation crossed its deadline is not cleared as
cleanup. Do not repair a stale lock.
Use the already-bound source and decision evidence; do not start a new
process or inspect the launched browser tree in this phase. Missing,
changed or unverifiable evidence is UNKNOWN.

Inside the qualification interval, the only permitted observation records
are `stop-observed-pending`,
`handle-acquired` for the already-started launch, `stop-observed`, and
`closure-observed`, plus the case terminal record. Do not publish readiness,
launch or other ordinary progress in this phase. A pending launch that
settles after the applicable bound is UNKNOWN and grants no late browser
cleanup. No new reservation, launch, acquisition, context, page, SDK work,
or other publication is allowed. Only previously obtained and verified
browser/context handles may be closed within the existing stop and
observation bounds; an acquired handle from the already-started launch must
be verified before any closure is attempted.

After `Q_end`, safety work requires the original validated owner, job, plan,
decision, attestation and consumed intent, plus the same producer's actual
browser-server handle already obtained and ownership-verified before
`Q_end`. A later or unverified launch settlement grants no safety authority.
After consuming a valid same-case STOP, the producer may make at most one
browser-server close attempt on that retained handle if no close was already
attempted. Bound it by the lesser of ten seconds and the remaining original
hard-stop time. No retry, new context-close call, acquisition, new producer,
context, page, SDK work or other browser operation is admitted. Missing
ownership, a prior close attempt, a lost producer, an unobserved close or a
failed bound remains UNKNOWN. No new browser or STOP effect starts at or
after the hard stop.

The only records permitted solely for this safety scope are the fixed
no-clobber `safety-stop-observed.json` and `safety-close-result.json` in the
same case directory. Both have exactly `kind`, `schema_version`,
`job_sha256`, `intent_sha256`, `stop_sha256`, `case`, `owner_uid`, `status`
and `recorded_at`. Their kinds are respectively
`"airlock.05109.native-safety-stop"` and `"airlock.05109.native-safety-close"`,
and `schema_version` is `1`. The first status is exactly
`"safety-stop-observed"`; the second is either `"safety-closed-observed"`
or `"safety-closure-unknown"`. Each binds the original job, consumed intent
and valid STOP digests and is created and synced under the fixed case lock
before the original hard stop. Digests are lowercase SHA-256, and
`recorded_at` is a UTC ISO timestamp with milliseconds strictly before the
hard stop. Case and owner must match the consumed job. A
`"safety-closed-observed"` status requires
the one close and owned root-process exit to be observed inside its bound;
it makes no claim about context or descendant closure. If that close reaches
its own bound without an observed completion, do not start a later record,
write, sync or lock removal as cleanup for it, even if hard-stop time
remains. If a record cannot be safely completed in time, do not retry or
publish it late. A marker, close request or safety record is not a
qualification success, and absent or unproved closure stays UNKNOWN.

Qualification `terminal.json` and its observations are immutable. If no
terminal record was durably completed inside the qualification interval,
the outcome remains UNKNOWN without creating a late terminal record. The
safety records cannot alter an existing terminal or serve as the positive
first-case prerequisite. Public reporting continues to say qualification
UNKNOWN; safety records are private and do not publish ordinary success.

The original admission and external-terminal readiness records must be
consistent and bound to the consumed case; their freshness at START must be
verified then. Do not reapply their START-time age or admission-expiry
checks as a reason to deny this same case's STOP. In particular, the
readiness confirmation aging out after launch does not revoke the owner's
stop-only ability. STOP still checks the same owner and immutable evidence
under the trusted-operator model, not a new caller-supplied readiness flag.

No new stop, browser close or other operation begins at or after
`hard_stop_at`, apart from the narrowly authorized descriptor cleanup below.
Bound every browser close by the lesser of ten seconds and the remaining
hard-stop time; if the handle or closure cannot be established inside that
boundary, the outcome is UNKNOWN. An operation started before the deadline
and not observably complete at it remains UNKNOWN. The source tests must cover
admission expiry earlier than the hard stop, readiness aging out after
reservation, successful same-case stop before the hard stop, refusal of
new START at expiry, rejected wrong-owner/altered job/source/handle and
refusal of new stop effects at the hard stop.
Tests must also cover the producer phase before, at and after START expiry,
the original monotonic and 45+10 bounds, an UNKNOWN qualification after
`Q_end`, separately authorized same-case safety STOP before the hard stop,
missing or mismatched consumed intent, fixed safety records, no late
qualification upgrade, and refusal of new START or ordinary publication.

### Separately bounded descriptor cleanup

The proposed physical plan separately names a finite `cleanup_until` for
each case. The exact same UTC ISO timestamp with milliseconds is bound in
that case's immutable job. It must be later than `hard_stop_at` and no later than ten seconds
after it, within the owner's separately approved future cleanup allocation.
The source-only continuation and the owner's approval of this direction do
not create that allocation. Absence, invalidity or mismatch refuses before
reservation. The cleanup interval is not a new START, STOP, browser-close
or observation interval and does not extend the 45+10 case fit.

An operation's existing deadline is the earliest applicable admission,
case, observation or hard-stop bound; consumed-case STOP does not reapply
START expiry. After that operation's deadline, only the process that
already obtained and verified a file or directory handle before the deadline
may start one close on that same retained handle, and only before
`cleanup_until`. A pending open that returns after the operation's deadline
does not establish an eligible already-owned handle. Do not select a
descriptor by a caller-provided number, reopen a path, transfer ownership or
retry a close. Check both wall time and a monotonic elapsed bound; an invalid,
regressing, expired or unprovable bound prevents starting the close. A close
in flight at `cleanup_until`, a failed close, a late open, or an unverified
handle remains UNKNOWN. The process may retain unresolved handles until its
lifetime ends; it must not claim that Node garbage collection or the OS
completed closure in time.

After that operation's deadline, its descriptor cleanup cannot start a write,
sync, rename, lock removal, record, terminal publication, browser/SDK
operation or any other new effect. There is no post-deadline success
publication; a deadline-crossing case is UNKNOWN and remains charged. Do
not infer descriptor or browser closure from issuing a close request,
process loss or garbage collection. A close started inside the cleanup
interval but not observably complete before its bound is UNKNOWN. The
contract does not guarantee when an already-started OS operation completes.
This exception does not grant, or revoke, a separately valid consumed-case
STOP before the hard stop after START expiry. It does not authorize a daemon,
background cleanup service or a new process. No post-hard-stop
native/browser/SDK cleanup follows from this exception.

## Ownership and stop procedure

The foreground command validates the fixed job and attested authority, takes
exclusive intent and reserves the case before acquisition. It records
`launch-requested` before invoking the installed Playwright browser-server
launch. It retains the actual returned server handle in that foreground
producer, verifies its process and endpoint and records `handle-acquired`
bound to the job/source/decision. Only then may it publish `ready` for case
one. The separate stop command does not select or connect to a stored
endpoint. A PID alone, a file assertion or a missing handle cannot establish
ownership.

Stop first records durable stop intent for the exact case. After stop is
observed, no new SDK work, context, page or navigation may be admitted. The
implementation must serialize the stop transition with each next side-effect
admission; merely polling a marker before an asynchronous operation is not
sufficient. A stop request while launch is unresolved must be observable
without waiting for launch to finish. If launch later returns an owned
handle in time for an authorized close inside the qualification interval
and before the hard stop, the foreground closes that handle and refuses
context/page creation. If it settles too late
for an authorized close, report UNKNOWN and do not initiate a new effect.
The live producer consumes the job-bound stop request and closes its retained
actual handle within the bound. A stop command returning after writing a
marker is not evidence of closure. If the producer is gone, unresponsive or
cannot establish the handle or closure, report UNKNOWN. Neither command may
kill processes by name or act on an unverified stale PID. This stop-only
invocation is independent of the foreground terminal, but closure depends
on the producer remaining alive. The frame review must decide whether that
dependency meets the intended independent-stop scope.

Record request, acquisition, stop, closure and terminal observations with
their ordering and case binding. A successful `Browser.close` request alone
is not proof of recursive descendant closure. A lost process, unresolved
acquisition, timeout, unprovable handle, conflicting record or failed
closure is UNKNOWN. Stop further attempts on the first unsafe or UNKNOWN
outcome. No source test claims that caller loss, filesystem races or native
process lifetime are generally solved.

## Fixed physical controls

No case is released in the current source-only window. For a future case,
the parent releases only after an explicitly approved finite physical
allocation, actual source frame, compliance, craft and architecture safety
passes, exact decision acceptance, reviewed source/command hashes, and the
real owner's personal external-terminal action and readiness confirmation.
The parent verifies enough time remains for the full 45-second case and
ten-second observation allowance before the earlier of admission expiry
and that future allocation's hard stop. No physical control starts earlier.

Both cases permit at most one owned browser-server launch, one isolated blank
context and one blank page. Use only installed local dependencies; missing
Playwright or browser binaries stop without downloads. Use a fresh test
profile, no owner login profile or extensions, and a minimal explicit
browser environment without credential variables. Configure page networking
default-denied before a page can issue requests; no external navigation is
permitted. Unexpected observed egress stops the checkpoint. Record what the
page/CDP controls observe without claiming host-wide network isolation.
Contexts are closed and never reused for a future stock/chamber run.

1. **Owned acquisition and independent stop.** Record the acquired live
   server/process handle and owned endpoint, establish one isolated blank
   context and page, then publish ready. The owner invokes the separate stop
   command. Record that stop preceded closure and the bounded observation of
   the owned root and context. If ownership or closure cannot be established,
   report UNKNOWN, not a pass.
2. **Stop during acquisition.** Record the launch request and the owner's
   separate stop request while the actual launch promise is still unresolved.
   Observe its real settlement. A late returned handle must be closed within
   the qualification interval and hard stop and before context/page creation;
   no SDK admission is possible. If launch already
   settled when stop arrives, or a late handle cannot be proved and closed,
   this case is not demonstrated. Do not retry. A delayed synthetic
   publication or a source mock is not proof that native acquisition was
   pending. This case is allowed only after the parent verifies the first
   control was positively observed and releases continuation.

Each case has a 45-second bound and at most ten seconds of post-action
observation. The implementation must account for the bounded close within
the outer deadline and report timeouts as UNKNOWN. These controls do not
prove that every descendant has exited or that future stock/chamber contexts
would behave identically.

## Source acceptance and later gates

After the new actual frame pass, use causal targeted tests
with first-party process/browser-control mocks for strict input and expiry,
exclusive reservation, missing or inconsistent admission, source/owner
binding, ready-after-owned handle, independent stop ordering, missing or
substituted handle, terminal failure and late-acquisition cleanup. Tests
cannot establish protection from consistent forgeries by the trusted
same-user coordinator. Do not execute an SDK double journey, source-pipeline
suite, closed native/realm/repair allocator or vendor SDK.
Use synthetic temporary bundle trees and controlled filesystem/clock
doubles to test exact manifest binding and complete inventory, file and link
substitution, unexpected or missing entries, wrong revision/platform,
root or environment redirection, limits and changed bytes between checks.
Also test the descriptor-only exception at the operation and cleanup
boundaries, already-owned identity, failed or late opens and closes, no
retry, and no new publication after deadline. Those tests do not establish
real cache provenance, OS completion, GC timing or a physical allocation.
Test the first controller step before/at/after the initial cutoff, strict
argument shape and job/plan equality, bounded bootstrap reads, late and
unverified handles, and STOP after START expiry without an expiry argument.
Run focused syntax and lint checks. Preserve red/green evidence and actual
review bodies in new native-specific records.

Compliance, craft and architecture safety passes precede physical probes.
After both cases, the existing compliance reviewer must assess actual native
criteria; coupled source changes require the appropriate existing reviewer
back-edge. Final reconciliation records exact checkpoints, observations,
spending, deviations and remaining UNKNOWNs. Source-only passes cannot be
labelled native qualification.

Live work remains separate: an accepted fresh live policy, exact owner
allocation and run window, current full preflight and source/served pins,
deterministic experience selection and reversible baseline, actual operator
readiness and independent native stop. Manual setup observations are not a
substitute. `executionReady`, `actualEvidence` and `provenance` remain false
for the source inspection and these blank probes. No historical C FAIL or
old UNKNOWN is repaired here.
