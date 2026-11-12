---
slice: 051-09
pass: frame-critique
verdict: pass
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-03T17:36:01Z
reviewed_checkpoint: 0a103b016e903834bb51bf2d72fc1c0465cc8f36
scope: structured original SDK rejection observation framing only
prompt_source: coordinator-supplied independent Sol error observation frame result
proposal_sha256: 3ed9958d47bf6a313808f047967f5d7682bb32053cc7f6b9593fbc104ce6d02c
verdict_body_sha256: c10dc413a8cfe70ad9a9cc9b79b55be15c3b5486c71fb5afe1b4c31ca717028d
---

## Structured SDK rejection observation frame

The timestamp is the record time, not an asserted review completion time.
The verdict body is preserved verbatim. This is a framing pass only.

<!-- BEGIN SDK REJECTION OBSERVATION FRAME VERDICT -->
VERDICT: pass

REASONING:
The load-bearing assumption is that both arms can independently expose the original SDK rejection semantics without replacing those semantics with either diagnostic text or the sanitized host code. The grounding is concrete: attempt 20 records stock's multiline Error description/stack against chamber's sdk-rejected code; current stock observation retains only CDP description, while the worker catch discards the original sendEvent rejection (helper:1585-1594,2371-2410; chamber-journey-worker.mjs:115-117; verified attempt-20 result). The proposed structured capture repairs that observation asymmetry, retaining exact kind/name/message/extra semantic data and unchanged fulfilled-result equality, while exempting only genuine call-stack/realm formatting after actual semantics are obtained (proposal:24-49). This stays within the delegated fixed-profile/checker scope and unchanged public sanitized behavior; matching HTTP 400 or generic rejection alone still cannot pass.

Reviewed checkout SHA: 0a103b016e903834bb51bf2d72fc1c0465cc8f36; exact HEAD and clean state verified after the requested fast-forward and again after review. Reviewer: gpt-6.1-sol.
Primary proposal: /Users/ramboz/.copilot/session-state/4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/repair-epoch-2-error-observation-proposal.txt
Proposal SHA-256: 3ed9958d47bf6a313808f047967f5d7682bb32053cc7f6b9593fbc104ce6d02c
Supporting reads: docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md:1-200; slice-09-official-sdk-offline-witness.md:1-190 in that directory (currently records through attempt 19); probes/adobe-compatibility/chamber-journey-worker.mjs:1-155; test/helpers/adobe-official-sdk-journey.js:1522-1625,2350-2415; /Users/ramboz/.copilot/session-state/203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/epoch2-native-20-result.json (hash verified as a2bfafbd7ef2ce48b22a195a4b5bdfbe68b815d683e6950dbf4919e350b3a2a9; rejected-case SDK observations and joined HTTP statuses projected read-only).

SPECIFIC ISSUES:
- Incomplete or unsafe capture could make different SDK errors appear equal. Binding conditions are descriptor-safe, bounded observation of the actual original rejection, including substantive non-enumerable own fields where safely observable; unsafe, missing or unobservable semantic data must make qualification fail, not disappear from comparison (proposal:24-43). Do not reconstruct name/message from CDP description or HTTP/fixture expectations; keep the full multiline SDK message, substantive extra/cause data and non-Error values exact. The diagnostic exception applies only to a genuinely identified Error's actual call-stack/realm formatting and associated CDP presentation—not arbitrary objects or fields named stack, nor substantive custom stack data (proposal:44-49). Preserve original promises/rejection identities, operation/request/response correlation and capture-before-detach ordering; verify the separate public sdk-rejected completion remains unchanged (proposal:24-38,53-62). No concrete frame blocker was identified for this exact design; causal non-vendor rejection/mismatch/unsafe/correlation tests and actual paired evidence remain required.

No new resource or security allocation is approved here. Retain the stated 20 native/11 roster/39 context/59 realm/552 reservation charges, current 24/14/136/84/828 limits and 18:32:37Z deadline (proposal:70-73). Faithfully record the decision and attempt 20 before new effects. All 17 arms must pass on one coherent frozen candidate with fresh pre-vendor proof and later independent reviews; previous partial passes cannot be stitched (proposal:64-68). Attempt 20 remains BLOCKED. No authored files/records/commits, native/tests/SDK/browser/probes/network execution or children; this is framing only, not implementation, SDK acceptance or lifecycle promotion.
<!-- END SDK REJECTION OBSERVATION FRAME VERDICT -->

## Measured cookie probe frame

Reviewed checkpoint: `bb07d35b240652d83a463c73c460fd7dfca5b046`.
Recorded at: 2026-11-03T16:55:43Z.
Proposal SHA-256: `95905ef080af67f97618ad9a816e799800ca21947cb8538395b02ec92fdb5237`.
Verdict body SHA-256: `2ade1c6e9776540f6cfd3dcb0ddd55efefd432735c15d6d76ee039a6ac6aef38`.

The timestamp is the record time, not an asserted review completion time.
The verdict body is preserved verbatim. This is a framing pass only.

<!-- BEGIN MEASURED COOKIE PROBE FRAME VERDICT -->
VERDICT: pass

REASONING:
The load-bearing assumption is that independently measured native cookie-API outcomes can be mirrored for this exact SDK probe, rather than chosen to force the desired state-domain field. The pinned SDK's static wr code really performs suffix-domain set/read probing at bundle initialization, while the existing shared cache does not enforce Domain acceptance; the proposal therefore addresses a real API-emulation gap without patching SDK bytes or substituting serialized output. Its fresh per-context measurements, verified empty state and cleanup, required full-host acceptance, exact-signature-only behavior and capture of the SDK's own subsequent probe make this a bounded fixture API mirror—not a general cookie jar or blanket domain filter (proposal:35-63). The finite same-epoch resource amendment remains within the delegated local repair scope, with all earlier consumption retained, the same hard stop and per-case semantics, and mandatory faithful recording before effects; no concrete authority conflict was identified for this exact design.

Reviewed checkout SHA: bb07d35b240652d83a463c73c460fd7dfca5b046; exact HEAD and clean state verified after the requested fast-forward and again after review. Reviewer: gpt-6.1-sol.
Primary proposal: /Users/ramboz/.copilot/session-state/4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/repair-epoch-2-cookie-probe-proposal.txt
Proposal SHA-256: 95905ef080af67f97618ad9a816e799800ca21947cb8538395b02ec92fdb5237
Supporting files read: docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md:1-235; slice-09-official-sdk-offline-witness.md:1-135 in that directory, especially attempt 16; connectors/alloy/sync-cookie-cache.js:1-100; connectors/alloy/alloy-chamber.worker.js:224-276,424-458; /Users/ramboz/.copilot/session-state/4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/official-offline-inputs/alloy.min.js (verified SHA-256 7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8; bounded static wr/apexDomain excerpts only, not evaluated).

SPECIFIC ISSUES:
- A contaminated or result-derived map could manufacture parity while hiding different cookie behavior. Binding conditions are the proposal's independently observed exact pinned probe name/value/attributes in BOTH fresh real contexts, verified absence before and after each candidate, matching finite maps and positive full-host acceptance; an ambiguous cleanup, foreign/unbound map or unexpected actual SDK signature must block, not trigger a permissive fallback (proposal:35-60). Ignore ONLY an exact non-cleanup probe write for a browser-measured rejected candidate; accepted probes, deletion/cleanup and every other cookie operation continue through the real cache/raw-writeback/grant path, with no new probe-name grant or further shared-cache scope. Preserve default/legacy profiles and R1's four bound inputs; a no-map path cannot qualify full proof (proposal:51-63). This design leaves apex selection and all wire construction to the actual SDK, so no additional wire normalization is approved. The browser's precise rejection reason and the new map mechanism remain unproved; do not infer a particular public-suffix rule from attempt 16.

The amended cumulative limits are 24 native invocations and 136 contexts unchanged, 10 rosters, 552 SDK/fence reservations/attempts and 60 realm probes; retain all 16 native/7 roster/9 context/35 probe/276 reservation charges and the 18:32:37Z deadline (proposal:79-95). One complete 17-arm proof on one frozen candidate, fresh containment/custody and independent reviews remain mandatory (proposal:65-77). Attempt 16 and its cross-clock ordering stay BLOCKED; the later clock repair is source-only and is not validated by this review. No authored files/records/commits, native/tests/SDK/browser/probes/network execution or children. This pass resolves only the proposed framing/scope, not implementation, containment, SDK acceptance or lifecycle promotion.
<!-- END MEASURED COOKIE PROBE FRAME VERDICT -->

## Attempt 15 alignment frame

Reviewed checkpoint: `8de49445506c0a700fde0930c8b44f0b7931e323`.
Recorded at: `2026-11-03T16:23:13Z`.
Verdict body SHA-256: `1ed9e9855cf57f46a16ba3b061f0dc1c0fe26b9f9a699160ca7a3481aa16297a`.

The timestamp is the record time, not an asserted review completion time.
The verdict body is preserved verbatim. This is a framing pass only.

<!-- BEGIN ATTEMPT 15 ALIGNMENT FRAME VERDICT -->
VERDICT: pass

REASONING:
The load-bearing assumption is that these changes repair real input/cache differences rather than teach the fixture or checker to conceal them. The queue-duration rule is supported by the exact pinned SDK's Dn implementation, while measured fixed-profile context lets that same SDK perform its own collection instead of fabricating final XDM (contract:12-64; verified Alloy SHA-256 7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8, line 1, Dn). The expiry correction repairs the real cache's unconditional upsert and aligns with the frozen document.cookie-shaped synchronous API; I found no accepted freeze of the erroneous retain-expired-entry behavior in ADR-0017:60-88, capability.d.ts:77-100 or 012-01 AC3/AC6, so this exact internal correction does not require superseding that API decision. This pass admits only the three stated resolutions and the two named additional write paths, preserving raw evidence, default-path regression obligations, prior failures/charges and all containment, privacy, release and full-slice gates.

Reviewed SHA: 8de49445506c0a700fde0930c8b44f0b7931e323; exact HEAD and clean state verified after the requested fast-forward and again after review. Reviewer: gpt-6.1-sol.
Primary files: docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md:1-108 (in standing-authority context) and slice-09-official-sdk-offline-witness.md:1-258 in that directory, especially attempt 15.
Supporting reads: connectors/alloy/sync-cookie-cache.js; test/alloy-sync-cookie-cache.test.js; docs/decisions/adr-0017-airlock-1-0-api-contract.md; contracts/capability.d.ts; docs/specs/012-mvp2-alloy-chamber/slice-01-host-and-boot.md; core/wrapped-sdk-host.js:625-650; relevant fixed-profile config/worker/location and R1 input-boundary source clauses; /Users/ramboz/.copilot/session-state/4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/official-offline-inputs/alloy.min.js (hash and bounded static Dn/remove excerpts only; not evaluated).

SPECIFIC ISSUES:
- Genuine runtime alignment must remain distinguishable from manufactured equivalence. No concrete frame blocker was identified, with these binding scope conditions: queueTimeMillis differs only on paired event requests at that exact path, with presence/integer/range and observable clock bounds, all raw values/bodies retained and no performance-parity claim (contract:20-30); full checkpoint context must be complete, independently observed and matched before SDK load, while existing controlled R1/profile clients and the receipt's four bound inputs remain unchanged—any no-context legacy mode is explicitly source-only/non-full/unqualified, never supplied manufactured defaults or promoted to full checkpoint evidence (contract:43-64; slice-09-focused-chamber-journey.md:264-297,373-377). Extend writes only to connectors/alloy/sync-cookie-cache.js and test/alloy-sync-cookie-cache.test.js for immediate expired-write removal: valid Max-Age precedence, invalid-attribute handling, empty-value non-deletion, unchanged ordinary writes/API/raw callback/grants, no second/full jar or future-TTL claim (contract:66-97; cache:39-49; host:635-644). Preserve historical R-004/012 evidence; requalify changed behavior with the required regression coverage rather than claiming the old no-expiry implementation is unchanged. The two observed empty entries' specific causal write sequence remains a hypothesis, not a result of this review.

No new epoch or allowance: retain 15/24 native, 6/8 roster, 7/136 contexts, 29/48 realm probes and 207/392 reservations, the 18:32:37Z deadline, fresh pre-vendor proof and one complete pinned-candidate roster (contract:99-108). Attempt 15 remains DIVERGENT; matching SDK results/positive arms are not a full pass. No authored files/records/commits, source/SDK/browser/native/tests/probes/network execution or children; this is framing/specific-path scope only, not implementation acceptance or SDK readiness.
<!-- END ATTEMPT 15 ALIGNMENT FRAME VERDICT -->

## Repair browser fixture frame

Reviewed checkpoint: `13250eb5e4c151604b3eb6970688a51b15a1e5d1`.
Recorded at: `2026-11-03T15:18:28Z`.
Proposal SHA-256: `dd2fd60d48570694ed2060daabe3b329a56aa5bfbccd48298640c1e5652f393e`.

The timestamp is the record time, not an asserted review completion time.
The verdict body is preserved verbatim. This is a framing pass only.

<!-- BEGIN REPAIR BROWSER FIXTURE FRAME VERDICT -->
VERDICT: pass

REASONING:
The load-bearing assumption is that removing Chromium's additional inner sandbox can leave the independently inherited outer OS restriction and Airlock's actual governed boundary intact for this narrowly claimed offline functional experiment. This is not equivalent to normal Chromium renderer isolation: the proposal explicitly relinquishes that assurance, preserves the exact outer network/process/descriptor restriction and all Airlock controls, requires identical pinned fixtures in both arms, and demands fresh actual containment proof before SDK load (proposal:45-75; standing contract:25-64; ADR-0039:59-95). I accept the fixture-specific interpretation of “no unsandboxed fallback” as prohibiting an unrestricted process-tree fallback, not requiring a second nested Seatbelt layer; no outer-policy removal, loosening or production security claim follows. The resource adjustment is a finite amendment under the standing harness grant—not a reset—with the same epoch stop, retained charges, cumulative pre-effect accounting and unchanged per-case acceptance; the writer must record it and the fixture interpretation before further effects (proposal:77-99).

Reviewed checkout SHA: 13250eb5e4c151604b3eb6970688a51b15a1e5d1; exact HEAD and clean state verified after the requested fast-forward and again after review. Reviewer: gpt-6.1-sol.
Primary proposal: /Users/ramboz/.copilot/session-state/4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/repair-epoch-2-browser-fixture-proposal.txt
Proposal SHA-256: dd2fd60d48570694ed2060daabe3b329a56aa5bfbccd48298640c1e5652f393e
Supporting files read: docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md:1-110; slice-09-official-sdk-offline-witness.md:1-220 in that directory; test/helpers/adobe-official-sdk-journey.js:34-88,895-948 (policy/launch premises only); docs/decisions/adr-0039-airlock-boundary-acceptance.md:54-100; /Users/ramboz/.copilot/session-state/203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/epoch2-native-09.json.

SPECIFIC ISSUES:
- The unchanged outer restriction will actually cover the browser and every relevant descendant, transport and descriptor after chromiumSandbox:false — still unproved. An inner-sandbox failure/control and a successful changed launch cannot establish that property or prove Chromium's exact failure cause. The proposal confronts this gap with frozen argv/environment/binaries/policy, fresh Node/browser/worker negatives and local receipt, descendant/descriptor evidence, and mandatory stop on missing enforcement or escape (proposal:39-75); normal production renderer isolation remains explicitly out of claim. No concrete blocking conflict was identified for that limited fixture. The proposed totals are 24 native invocations, 8 roster attempts, 136 contexts, 392 SDK/fence attempts and 48 realm probes, including the already charged 11 invocations/2 rosters/2 contexts/5 probes/0 SDK attempts; the original 14:32:37Z–18:32:37Z window and one coherent complete pinned-candidate proof remain mandatory (proposal:35-37,74-90). No cross-version stitching, wildcard exception, live authority or full-slice promotion follows.

Read-only frame review only: no authored records/source, commits, native/tests/browser/SDK/probes/network execution or children. This pass resolves framing/fixture interpretation only, not containment, implementation acceptance or SDK readiness.
<!-- END REPAIR BROWSER FIXTURE FRAME VERDICT -->

## Repair epoch frame

Reviewed checkpoint: `c3b4f055b51cf609a37dd0945c1316294aaf390f`.
Recorded at: `2026-11-03T14:41:07Z`.

The timestamp is when this result was recorded; the exact review completion
time was not supplied. This frame pass does not establish containment,
implementation conformance or SDK acceptance.

<!-- BEGIN REPAIR EPOCH FRAME VERDICT -->
VERDICT: pass

REASONING:
The load-bearing assumption is that routine harness/checker and narrowly owned local-startup repairs can proceed under standing authority without converting repeated attempts into broader network/process permission or stitched acceptance evidence. The new owner grant supports that repair work, while the amendment confines it to the existing source seams, exact owned IPC and attested executables, causal non-vendor diagnosis, and fresh before-vendor containment proof for every changed policy (contract:3-64). Its separate 14:32:37Z–18:32:37Z epoch, 12-native-invocation cap, four-roster/68-context/196-dispatch/12-realm-probe ceilings, pre-effect charging and immutable records make retries finite rather than refunds or an open-ended platform project (contract:7-18,66-99). No concrete blocking conflict was identified: routine corrections inside this boundary need no repeated owner question or frame pass, but cannot lower the oracle, erase failed attempts, bypass later independent reviews or clear full-slice/live gates.

Reviewed SHA: c3b4f055b51cf609a37dd0945c1316294aaf390f; exact HEAD and clean state verified after the requested fast-forward and again after review. Reviewer: gpt-6.1-sol.
Reviewed files: docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md (standing repair amendment, authority, caps, evidence requirements and assumptions in context); docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-witness.md (current authority/status and relevant historical stopped outcomes). No implementation/conformance review was performed.

SPECIFIC ISSUES:
- Local-startup permission changes can remain strictly owned and externally contained while producing one coherent complete proof on one pinned candidate — still unproved. SingletonSocket EPERM does not identify its responsible rule; the contract correctly requires at least two competing hypotheses and bounded causal non-vendor probes, and does not permit blanket Unix/network/process allowances (contract:25-64). Each changed policy requires new realm/descriptor/descendant/local-receipt proof; prior-policy or cross-version successes cannot be stitched into a passing candidate. Preserve the source/policy/fixture bindings, complete stock/chamber controls, original/admitted/received-byte joins and native render/trust evidence (contract:80-99,331-345,444-469). The witness correctly keeps a98eefa execution distinct from unexecuted 13fd5dd, with overall compliance still FAIL and records-only reconciliation not SDK or containment proof (witness:5-43,45-72). These are mandatory execution/acceptance obligations, not facts established by this framing pass.

No authored files/records/commits, source/SDK/browser/native/test/probe/network execution, children or lifecycle promotion were performed. Old epoch charges, Node probe 1, R1/C/quarantine, Target UNKNOWN and live/full-SDK/EDS/release gates remain intact.
<!-- END REPAIR EPOCH FRAME VERDICT -->

## Compile-error amendment frame

Reviewed checkpoint: `ffda51d2e54eeff40aa1b705a864d827ddec65d0`.
Recorded at: 2026-11-03T05:23:46Z.
Prompt source: coordinator-supplied independent Sol compile-error amendment frame result.

The exact reviewed HEAD was clean before and after the read-only review.
The reviewer examined the subordinate contract's compile-error resource
amendment in context, offline witness lines 146-236, helper lines 1-110 for
the fixed executable and policy premise only, and the read-only peer native
invocation record for policy and executable identities. The metadata timestamp
is the current UTC time when this result was recorded.

VERDICT: pass

REASONING: The load-bearing assumption is that replacing the rejected numeric SBPL host spelling can preserve the exact loopback-only policy, rather than broaden access to obtain a successful launch. The recorded pre-Node parser failure supports classifying the proposed literal Node exit command as one additional, explicitly charged non-vendor syntax/process-entry control, followed only on success by at most one fixed checkpoint invocation—not an SDK retry, refunded invocation or new platform (contract:172-208; witness:146-178). The source premise is correct: fixed Node executable already in PROCESS_PATHS, /usr/bin/true not(helper:34-58); amendment preserves exact-policy freezing, no widening, before-vendor enforcement proof, originalclock/roster and hardstop on next nativefailure.

SPECIFIC ISSUES: Compiler-required localhost spelling will preserve exactly intendedloopbackaddress/port/protocolsemantics — stillunproved. Amendment prohibitswildcard/private-subnet/process/protocolwidening, requires samefrozenpolicy for bothnewcommands, treatscompilesuccess as syntax/processentryonly; real localreceipt, forbiddenrealmchecks and complete descriptor/descendantcoverage stillprecede vendorloading(contract:194-230). This addresses syntacticallyaccepted but broader/ineffectivepolicy. No concreteblockingconflict found in finiteamendment. Original/admitted/received obligations intact(:232-246),04:02Z–08:02Zstop(:23-32),17contexts49SDKfenceattempts3tripwires(:187-190,286-302). Historicalfailedinvocation remainsconsumed/charged/BLOCKED; no conversion of it orunitresults into containment/readiness.

The reviewer authored no files, records or commits, and performed no source,
SDK, browser, native, test or network execution, child work or lifecycle
promotion. This scoped frame pass does not attest implementation conformance
or containment, reopen historical/live admission or clear full-slice gates.

## Native containment amendment frame history

Reviewed checkpoint: `c5fd63b7f9b1805eaaaf1d477e1e4a227e9016b0`.
Recorded at: 2026-11-03T04:26:04Z.
Prompt source: coordinator-supplied independent Sol native-amendment frame result.

The exact reviewed HEAD was clean before and after the read-only review. The
reviewer read the subordinate contract and native amendment, and
`slice-09-official-sdk-offline-witness.md` as a stopped observation. The
recorded-at timestamp above is the UTC time when this result was recorded.
The reviewer authored no files, records or commits, and performed no source or
SDK execution, tests, browser, network or Adobe operations. This scoped frame
pass does not qualify containment or implementation, restore operational
admission or promote the full slice.

VERDICT: pass

REASONING: The load-bearing assumption is that a fixed native macOS restriction can contain the actual Node/browser descendant tree, including acquisition-time descriptor risks, while allowing only the required loopback traffic. This amendment survives the no-new-platform/exact-allowlist constraint because it limits the alternative to one fixed test invocation in the already allowed helper, with no arbitrary executable/profile interface, service, dependency, additional connector sandbox, unsandboxed fallback or repeated infrastructure remediation (slice-09-official-sdk-offline-contract.md:89-97,134-167). It does not establish that the mechanism works: manuals and the reported /usr/bin/true exit remain invocation-only evidence, and actual containment/custody/local-receipt proof must precede vendor loading; inability to meet that burden stops the attempt rather than widening its scope.

SPECIFIC ISSUES: The native restriction will cover every relevant external network path and inherited/acquired descriptor in the real process tree — this remains the primary unverified assumption, not a resolved readiness fact. The contract now explicitly requires a frozen policy, descendant coverage, denial including UDP/DNS/IPv6, descriptor custody, real local receipt and three bounded pre-vendor probes, while stating those probes alone are insufficient to establish all-class coverage (contract:141-167). Those requirements directly confront the strongest acquisition-time/inheritance failure mode without granting a new platform. No concrete blocking conflict was identified in the amendment. Earlier witness remains BLOCKED with zero contexts/attempts(witness:4-12,48-65);17contexts/49attempts, prior spending/fullslice/livegates unchanged(contract:23-30,223-239,294-300,326-331).

## Payload correction re-review history

Reviewed checkpoint: `36175f8252e05393247740ceb41e7e9d394b9d13`.
Recorded at: 2026-11-03T04:16:07Z.
Prompt source: `python3 "$JIG_ROOT/skills/independent-review/review.py" frame-critique docs/specs/051-adobe-integration-proving-ground/spec.md 051-09 docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md`.

The exact reviewed HEAD was clean before and after the read-only re-review.
Targets were the subordinate offline contract and its appended 051-09 pointer
at lines 379-388. Supporting source was rechecked at
`core/wrapped-sdk-host.js:401-450` and
`test/adobe-chamber-journey.test.js:774-808`; earlier supporting context is not
execution evidence. No files, records or commits were authored by the reviewer,
and no source or SDK execution, tests, browser, network or Adobe operations
occurred. This scoped pass does not complete later reviews, reopen operational
admission or qualify AC6/7. Its recorded-at timestamp above is the UTC time
when this re-review was recorded.

VERDICT: pass

REASONING: The highest-risk premise is that existing facilities can contain browser, worker and Node egress and preserve original → governed → received byte evidence without changes to protected dependencies. The original blocker is resolved, not waived: the corrected payload control requires strip-and-dispatch and preservation of unrelated content (slice-09-official-sdk-offline-contract.md:111-118,155-163,181-186,222-229), matching core/wrapped-sdk-host.js:411-440 and test/adobe-chamber-journey.test.js:794-805. The frame survives as a bounded, falsifiable offline experiment, not proof of execution readiness: containment, provenance, complete case coverage, native rendering/input, exact byte joins and the source allowlist remain mandatory stop/pass conditions, while full-slice and live gates remain open.

SPECIFIC ISSUES: Existing facilities can support the complete contained offline journey within the exact allowlist — still unverified, not established by this frame pass. Page interception or worker shims alone must not be substituted for before-vendor containment of every required realm; the contract explicitly rejects that substitution and stops if adequate containment needs a new platform (:98-109,263-268). No remaining concrete frame blocker was identified after reconciling corrected payload semantics. 17contexts/49attempts, bounded observations, original/admitted/received joins and no full-slice promotion remain intact(:165-186,222-242).

## Initial review history

Reviewed checkpoint: `e4958381c7f80e376f17172c706a0839dc676d66`.
Review day: 2026-11-02; precise time was not supplied.

Initial independent frame result for the equivalent parent candidate. The
reviewed tree was clean before and after, with the two offline
contract/pointer paths only. The generated prompt is stored in the
coordinator's `files/offline-frame-prompt.txt`. The reviewer ran
no tests, SDK, browser, network or writes. This is not a full-slice verdict and
does not replace the canonical old C FAIL or any R1 review.

VERDICT: needs-changes

REASONING: The load-bearing assumption is that the complete mandatory roster can exercise the existing governed seams without changing protected dependencies or their semantics. The payload-negative case contradicts the current implementation: that fence strips denied fields and dispatches the remaining request, rather than refusing the request. This is a concrete obstacle to the checkpoint’s completion bar, not merely an unverified SDK assumption; the limited claims and preserved historical gates are otherwise appropriately separated.

SPECIFIC ISSUES: The existing payload fence can refuse the required denied-payload attempt before sink delivery without changing its behavior — this assumption is false. The contract requires precisely that refusal and prohibits altering the fence to stage the attempt (slice-09-official-sdk-offline-contract.md:149), while protecting the shared host/core from edits (:86-91). In core/wrapped-sdk-host.js:411-440, payload governance instead strips fields, increments dispatch accounting and calls caps.egress.dispatch; the profile’s diagnostic callback only increments an observation counter (probes/adobe-compatibility/chamber-journey-host.mjs:136). The existing regression explicitly expects consent plus a dispatched, stripped fetch (test/adobe-chamber-journey.test.js:794-805). Therefore this mandatory control cannot pass as written using the unchanged fence. Reconcile the contract with the actual strip-and-dispatch semantics, or obtain separate review/authority for the necessary policy change; adding a test-only sink rejection would not prove refusal by the existing fence. This finding does not authorize implementation or relax any full-slice gate.
