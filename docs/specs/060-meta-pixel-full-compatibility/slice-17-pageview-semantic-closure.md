---
status: DONE
dependencies: [060-16, adr-0047]
last_verified: 2026-11-05
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-17 - Classify retained PageView data and add governed timing

**Goal:** An operator can account for the retained PageView's unresolved fields
and exercise source-backed page-timing data through the actual worker, without
copying SDK metadata or treating an offline result as native qualification.

The owner instructed autonomous continuation after the next-step recommendation
on 2026-11-05. This packet is offline: read the retained case/source, implement
a default-off timing experiment, run SDK-free controls and follow Jig. It
permits no SDK/browser execution, acquisition, new capture, upstream measurement,
site/account/deployment action, loading optimization or successor programme.
060-16's operation remains spent. Original 060-01 ownership/criteria, 059-18's
guarded-native NO-GO and earlier receipt qualifications remain unchanged.

**DoR:**
- [x] Local and canonical base are clean `391f8da9`.
- [x] Canonical coordinator reports no owned/provisional 060-17 or in-flight edit.
- [x] Local tracked allocation contains no 060-17; original 060-01 claim is untouched.
- [x] The retained case and exact runtime/configuration/request locators exist.
- [x] Fresh pinned Sol framing pass; normal readiness/claim uses the helper.

**Acceptance Criteria:**

1. Account for all 63 unclassified names in the retained native PageView's
   77-name roster. Bind the input to the original 060-16 case and the exact
   retained SDK 2.9.426 runtime/configuration/request pins, not a reconstructed
   URL, another epoch or a new capture. Each entry receives a source-backed
   functional/generated/SDK-metadata/capability-required disposition, or an
   explicit unresolved disposition with a concrete next step. A token match
   alone is not semantic proof and classification never excludes a difference
   from the full compatibility criteria.
2. Keep raw names, values, identifiers, private paths and payloads out of public
   output. Private mapping lives in exclusively created 0600 files in a new
   owned 0700 directory. Public rows use stable native indices, categories and
   source-role/module/UTF-16 offset citations only. Coverage checks detect
   missing, duplicate, invented or stale rows and wrong source pins. Default
   discovery is hermetic; explicit private validation cannot silently skip.
3. Add a narrow default-off `experimentalPageViewPerformance` option through
   the adapter, connector and serialized worker. It may add `plt` only to the
   local PageView experiment. Both live/owned constructors reject it, as they
   reject other experiments. Preserve exact existing default contexts/requests,
   strict ad_storage, other vendors and stable core/contracts/production boots.
4. With the option enabled, the host captures only a bounded set of raw
   performance-API availability and timing primitives. It does not subtract,
   cache, interpret or construct `plt`. Snapshot/clone the explicitly admitted
   primitives, rejecting malformed/accessor/object/inherited data through the
   current rejection path. Absent APIs or absent timing are distinguishable
   from capture failures. Flag-off performs no new timing capture.
5. In the worker, use the first modern navigation entry's
   `domContentLoadedEventEnd - startTime`. Use legacy
   `timing.domContentLoadedEventEnd - navigationStart` only when the modern API
   is unavailable, not when it returns no entry. Emit only a positive finite
   result without integer rounding. Sample at successful local initialization,
   retry at PageView preparation while no positive value is cached, then retain
   the first positive result for that connector/page. Invalid inputs reject
   explicitly; legitimate unavailable/nonpositive timing omits `plt`.
6. Preserve the sampling limitation: replacement initialization/command capture
   is not demonstrated equivalent to native configuration-plugin installation.
   The retained 060-16 case has no raw navigation-timing observation to prove
   its native `plt` relationship. Controlled arithmetic/cache/worker results
   must not qualify that relationship or rewrite the old diagnostic. Keep
   `iw` as a realm constraint and `ler` as a separate storage-authority gap;
   do not copy native values, SDK version/experiments, cookies or new identity.
7. Prove the new path with SDK-free red/green tests and the actual serialized
   Node worker plus local receiver. Cover modern/legacy selection, empty modern
   entry, nonpositive-to-positive retry, positive caching, fractional values,
   malformed/capture failure, denied consent/no receiver arrival, default and
   live/owned rejection, and meaningful semantic/coverage mutations. No browser
   or SDK is executed by tests or discovery.
8. Preserve the old case originals and its frozen execution/reader source.
   Changed source must not weaken old source-closure admission just to reread
   that case. Use the retained frozen reader for its existing validation;
   any new offline classification/evaluation stays distinct from a replay.
   Root oracle thresholds/default components/Meta blocker-only gate and proposed
   evidence-plan/rubric approvals remain unchanged; full parity stays false.
9. Finish fresh pinned Sol compliance, craft and architecture reviews,
   reconciliation, committed normal lifecycle/board and canonical feature-line
   handoff. No PR/main operation or automatic next journey is commissioned.

**DoD:**
- [x] Bound complete 63-row disposition map with honest unresolved entries.
- [x] Default-off timing path and meaningful SDK-free actual-worker controls.
- [x] Explicit native sampling/storage/realm and full-parity limitations.
- [x] Fresh reviews, reconciliation, normal gates and committed handoff.

## Grounding

The source trace for the pinned configuration's `websiteperformance` plugin is
at C:L172, UTF-16 offsets 206577-207356 (zero-based, half-open). It samples on
installation, retries on an opted-in event while null, caches a positive value,
and does not round. Its private native opt-in is not portable authorization;
the new local flag is a separate explicit experimental choice.

`adapters/meta-pixel-prototype.js:158-166,669-684` shows bounded host context
capture/snapshot. `connectors/meta-pixel/pageview-prototype.js:69-76,257-280`
validates/makes the current worker request; the 060-16 preparation experiment
is prior art for flag plumbing, default preservation and live-binding rejection.
The existing `_fbp` grant does not admit persisted-referrer storage.

## Assumptions

The retained sources can establish useful dispositions for some of the 63
unclassified names. Untraceable entries remain unresolved rather than becoming
metadata exclusions or guessed feature implementations.

Raw timing captured at replacement command admission can support a useful
local arithmetic/cache experiment. Its equivalence to native installation and
event sampling remains unproven without a later separately admitted reference.

### Deviation log

The adapter and worker connector each validate the timing snapshot at the
airlock boundary. The two vendor-specific copies follow the third-caller
extraction rule and avoid adding a runtime asset to fixed serving rosters.
Duration selection, subtraction and caching remain in the worker connector.

The [source-cited index map](pageview-disposition.json) accounts for 63
unclassified positions: 60 SDK metadata, two capability-dependent inputs and
one generated lifecycle timestamp. These dispositions do not exclude any
field from full compatibility. The 52 experiment-result positions are
metadata, not 52 independently proven functional features. The retained case
does not establish the corresponding random choices, exposure lifecycle or
causal inputs. The map contains no private names or values.

`experimentalPageViewPerformance` is default-off and unavailable to live and
owned bindings. It captures raw availability/timing scalars at command
admission; the worker selects, subtracts, rejects nonpositive results and
caches the first positive sample. Initialization and PageView retries are
local controls, not evidence that native installation and replacement command
admission occur at equivalent times. The old case captured no raw navigation
timings, so its native `plt` relationship remains unproven. `iw` remains a
realm constraint; `ler` remains a distinct storage-authority gap.

The classification verifier checks exact retained-case and source pins and
the 77-position roster separately from the frozen old-case reader. Explicit
private validation requires the original inputs and an exclusively created
private mapping directory; it never replays the case or weakens old closure
admission. The frozen reader remains the authority for old-case validation.
From the implementation checkout, run
`node rig/meta-pageview-disposition.mjs --verify-private --manifest <manifest> --input <input> --capture <case> --reference <owner-reference> --private-dir secrets/<new-directory>`
with the original paths and the explicit owner-prepared reference supplied
privately. The reference is a trusted grader input, not an authentication
mechanism or an expected-hash object supplied by the candidate. The verifier
requires the designated sibling reference file, checks its owner, mode and
parent, and opens it without following a final symlink. The output directory
must not already exist. The verifier writes a mode-0600 index-to-name mapping
in that mode-0700 directory and reports counts without names or paths.
The configured check matched all 52 retained experiment entries to distinct
source records among 58 configured records, including each row's exact
declaration range. Six source records did not appear in the retained query.
The earlier frozen reader separately returned no evidence errors. Neither
result proves the missing causal inputs or changes the old diagnostic.
That check used the earlier verifier. The revised verifier also passed with
the protected owner reference and original locators: 63 rows, with 52 distinct
experiment matches among 58 configured records. This is a separate offline
check, not authentication or qualification.
The verifier uses the already locked Acorn development dependency to parse the
pinned source without executing it. Acorn is now declared directly; no package
was acquired or installed.

An overly broad initial regression selection inadvertently invoked the
SDK-free virtual browser smoke, contrary to this packet's no-browser boundary.
It actually launched a browser and returned `page-incomplete` and
`pageview-not-observed` (Vitest exit 1, original shell 4623).
The selected source path is SDK-free and does not invoke the native-case
runner, but actual route/traffic counters were not retained. The underlying
page failure, browser PID/profile and whether a context was created are
UNKNOWN. Browser/server close calls returned; there is no independent
process-exit/profile-removal receipt. This is not cleanup, network or native
qualification evidence, and later green tests do not erase the failed run.

The local fixture omitted a module required by the page and worker import
closure, even with timing disabled. A Node-only fixture check reproduced the
missing resource; an initial fix added that path to the fixture. The separate
fixed local-journeys fixture also omitted the module. The current source
removes the extra module dependency instead and restores the original first
fixture roster. Node-only checks cover both fixed closures. The missing module
is consistent with the earlier `page-incomplete` result, but the lost browser
trace cannot establish it as the exclusive cause. It does not resolve the
incident or establish browser cleanup or traffic.

The earlier local source commit contains private-record fingerprints in its
history. Removing them from the current source does not remove them from that
commit. This local draft lineage must remain unpublished. The owner separately
approved B with "Yes, I approve B": create a clean delivery commit from the safe
`391f8da9` base, exclude private fingerprints, and preserve the earlier local
history unpublished rather than rewriting it. Clean-lineage verification and
the remaining normal gates are still required before integration.

The approved clean delivery starts at `7e854b1b`, whose sole parent is the
safe `391f8da9` base. Its tracked tree was byte-identical to the corrected
draft at creation. Independent ancestry checks exclude the earlier private
draft commit, while confirming that the old local branch and commits still
exist unchanged. All 19 changed blobs and the new commit message were checked
in memory for the four private-record fingerprints; none matched. The
approved patch was also checked against the actual Pixel and captured cookie
values without printing them. No old history was rewritten or published.

The two later Servo integration skips were caused by unset `SERVO_ROOT`,
not passing qualification. The owner was initially unavailable; no acceptance
was inferred from that unavailability. On 2026-11-05 at 16:40:16 -08:00,
the owner replied "Yes, accept A." This accepts the documented cleanup/traffic
uncertainty for offline continuation and close-out. It does not verify cleanup,
erase the failed run, retroactively authorize that launch or permit another
browser/SDK/live/diagnostic run. The separate clean Git delivery decision B was
then explicitly approved as recorded above; it grants no history rewrite or
new runtime execution.
No browser retry, new diagnostic job or broad process scan is authorized.
The original output remains referenced in the implementer tool transcript;
the parent's later shell read recovered only exit 1, not the original output.

### Reconciliation sweep

Parent independently ran only the two explicitly inspected, browser-free
owning files: 26 tests passed, with no skips. Protected-reference verification
matched all 63 rows and 52 distinct experiment records among 58 declarations.
An in-memory scan of the 17 changed current files found no private fingerprint
literals. These results do not remove fingerprints from earlier Git history.
Fresh static remediation review supports the source corrections but recorded
`needs-changes` while both incident and lineage handling were unresolved.
The subsequent owner decisions accept A's incident residual and B's clean
delivery approach. Corrected-tree compliance, craft and architecture reviews
pass, but those content passes alone do not release the earlier draft lineage.
The clean commit and ancestry proof are now recorded above. Final clean-lineage
compliance/reconciliation and normal delivery gates remain separate steps.

The final fixture correction removes the extra runtime asset and keeps the
two validators inline under the rule-of-three convention. The existing Meta,
shared local-browser and foreground fixture files match the canonical base
byte-for-byte. Parent independently observed all 28 tests in the three audited
Node-only files pass, plus the single existing Node-HTTP import-closure guard.
Its other 11 tests were deselected by the explicit selector, not qualified.
No browser smoke was rerun.

An unpublished corrected-tree patch against the clean `391f8da9` base is
preserved privately as `meta-gap-sanitized-delivery.patch`; an in-memory check
found none of the four private-record fingerprints in that patch. Preparing
it does not apply/re-author a commit, clear old history, authorize publication
or resolve the incident. It is an alternative for later owner-directed history
handling, not an integration handoff.

**Updated:** owning record, public field map, operator guide, architecture's
experimental note, current plan/tasks and shared work-plan result. Review
records distinguish corrected-tree content from clean delivery. Owner A accepts
the recorded uncertainty; B authorizes only the new clean delivery approach.

**No-op:** closed records, original 060-01 claim/criteria, 059-18 guarded-native
NO-GO, 060-16 originals/frozen reader and spent operations. Old audit history
remains local and unpublished; its unsafe lineage is not the delivery source.

**No-op:** core/contracts, production boots, other vendor behavior, oracle
defaults/threshold/Meta blocker-only gate, proposed plan/rubric approvals,
site/account/deployment and performance optimization. No loading optimization,
new SDK/browser/live run or automatic successor is part of close-out.

**No-op:** inbox/conventions; no unrelated parked item or contributor rule
changed. Existing ADR-0017/0043 cover this private payload/trusted-mapper
extension. Architecture review found no new ADR-sized boundary decision.

**Leanness:** two inline validators follow the existing rule of three; no
extra runtime asset, generic runner, keeper or capability abstraction remains.

**Deferred:** native timing causality, realm/storage/deprecation-label/metadata
capabilities, actual native responses and full journey qualification retain
their original owners and gates. Classification does not exclude fields.

**Memory-sync:** case-specific roles, counts and failed approaches remain in
this owning record rather than a new global rule. Summary/team-check completed;
the existing people opt-out remains. Advisory coverage has no use-case gaps
or dangling links; nine pre-existing orphan specs are outside this packet.

Final clean-delivery compliance and reconciliation passed. Normal lifecycle,
board and immutable canonical handoff complete the delivery, not native/full
Pixel qualification. Closed records, spent grants,
full-journey ownership and qualification, live integration, performance
optimization and other vendors stay unchanged.

### Close-out (post-DONE)

- [x] Regenerate/check the board and return the immutable canonical handoff.
