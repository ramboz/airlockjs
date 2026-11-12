# 051-09 offline official-SDK checkpoint

**Witness type:** `airlock.05109.offline-official-sdk-checkpoint`

**Current outcome:** The bounded offline checkpoint is complete: attempt 24
reports PASS for the roster, and independent compliance, craft, architecture
and final reconciliation passed for that checkpoint.

**Most recent executed source candidate:** `7e8e100f472f24e6e39c733c13ea2cd18a72fc38`

**Epoch 1 executed source candidate:** `a98eefa73cf82217196645334faad393e427a5d6`

**Execution outcome commit:** `fd467b0b34ff01d6e82fab096fd0d32fc24d68e8`

## Current checkpoint status

The coordinator subsequently allocated one more roster for the caught-error
preservation fix: **24 native, 15 rosters, 136 contexts, 828 dispatch
reservations and 84 realm probes**, with the same deadline and all attempt 23
charges retained. The append-only record is
`epoch2-cap-revision-20261103T1803.json`; no other limit, grant or per-case
expectation changed. Attempt 23 remains bound to its own source.

The worker's caught `sendEvent` rejection is now retained as the private
`cause` of its internal `sdk-rejected` error. The original SDK promise and
rejection observation remain unchanged, and the public result remains the
sanitized `sdk-rejected` code. A causal non-vendor regression observed the
original rejection as the internal cause and checked the unchanged observer
and public messages; it failed before the fix and passed afterward. The
allocation-cap regression likewise failed at the old limit and passed at 15.
The red and green logs in the session evidence directory have SHA-256
`21ff303dadce8b595353579ed37f5c2e40686cda1e4cd1d38db67615b31464ff` and
`edd896ba56a20205e290ec3ba886406dfe8cb41aa96ca089b1cf10e2bba1b148`,
respectively. The focused source suite passed 7 files and 354 tests, with 2
skipped; its log SHA-256 is
`0e4400b7e557c0ebb16313e1e05f52a97eab28c5e453697d7be977f4dcaff685`.
The fixed-profile host, contract and worker passed lint with their respective
runtime globals, as did the changed tests and helper.
The parent independently ran the final non-vendor selection on `7e8e100`:
9 files and 425 tests passed, with 2 skipped and SDK, observer and historical
opt-ins unset. Its `epoch2-final-cause-source-validation.log`, in parent
session `4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/`, has SHA-256
`d2ebcc27ad0a15f9e634e70ea5e1a0fc488f16a3cd6725325a8592e82a2aea8e`.
The parent also reports affected JavaScript and all three fixed-profile
modules passed lint with their actual runtime globals. These source checks
are not the basis for SDK acceptance.

### Repair epoch attempt 24

The frozen candidate `7e8e100f472f24e6e39c733c13ea2cd18a72fc38` ran one
complete, fresh roster. The machine witness reports **17 of 17 arms passed**:
paired stock and chamber arms for positive, no-consent, no-offer,
non-render, rejected-response, malformed-response and untrusted-interaction,
plus chamber endpoint, tenant and payload fences. No earlier arms were
stitched into this result. Both positive arms executed the pinned Alloy
bytes, observed visible synthetic-offer rendering and a trusted click; the
stock arm also served the pinned integration and reference ACDL bytes.
The result retains the raw requests, responses, receipt and SDK-result joins,
browser observations and reviewed comparisons. The endpoint and tenant
fence stimuli were controller-generated `intercepted-fetch` messages, not
SDK-originated requests. The payload fence used an SDK-generated fetch with
the controlled fixture's denylist; its admitted body reached the sink after
the denied field was stripped.

Fresh pre-SDK controls recorded the local receipt and asset match, Node
TCP/UDP/IPv6 denial with `EPERM`, browser and worker external denial with
`net::ERR_ACCESS_DENIED`, resolver failure and the owned process/descriptor
inventory. Trusted first-party preparation was separately recorded as
unconfined and its compiler stopped before runtime. Browser sandbox disabling
was restricted to the mandatory outer sandbox; this is not a production
renderer-security claim.

All case contexts and listeners closed, as did each applicable chamber
worker, the browser, companion and server. The separately tracked Node and
browser process groups were clean, with no observed orphans. This does not
qualify historical consumed-stop or race safety or change earlier UNKNOWNs.
The roster used 17 contexts and 48 SDK-or-fence attempts. There were 46
sink receipts; the two controller-generated endpoint and tenant fence
attempts were held before delivery. It pre-reserved 49 dispatch and 20
overflow-refusal slots. Cumulative charges are
**24/24 native, 15/15 rosters, 98/136 contexts, 83/84 realm probes and
828/828 dispatch reservations**. Native, roster and dispatch budgets are
exhausted; there is no reset or refund.

| Evidence in session `203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/` | SHA-256 |
|---|---|
| `epoch2-native-24.json` | `2dc9f3c45c83232a49b9393b1bd44f62b5a123e074084dc12eca1aa6fb3e500c` |
| `epoch2-native-24-result.json` | `64519521cb85f6ad7249ff288fb43d312d4e1761b4f524d61b1b98bb9be65ee4` |
| `epoch2-roster-24.log` | `1aa97c5286b1ed6c4dfd896e5a6ddce6a21a676b1185348ddb29eb85303cb899` |
| `epoch2-preparation-013.json` | `c153aa4277f208a7b45917dae7f163e11d2d783410704a5f23b395dd44c7f1c9` |
| `epoch2-preparation-013-result.json` | `5c1090c6f6af2d559202dcdb031daff917fa4875693e86dcee2182d69b05c6b3` |

The fixture SHA-256 is
`7a130f6411f1a33342029ea25ad39e18129d781f5ccb73be0045d9d6bda52107`;
policy SHA-256 is
`d0fa71724e22f3abea7e32312683bdbcc14332bec425cb664771bbe4d33e0be9`.
Exact asset, executable, source and preparation bindings remain in the
immutable attempt and result. Independent Sol compliance passed for the
bounded offline checkpoint on `29a28f8d2c8b7f82fdd4c8aa722c1c1d8a02a644`
([verbatim reviews](reviews/official-sdk-offline-compliance.md)). Independent
[craft review](reviews/official-sdk-offline-craft.md) also passed for that
checkpoint, as did [architecture review](reviews/official-sdk-offline-arch.md)
on `efa8f029ba1e5b1d279c5fa85d62a3f3010b0ebb`. Focused
[final reconciliation](reviews/official-sdk-offline-reconciliation.md)
passed on `a18b3e1eb0d0171d8da7a75f5706d6d9eac0ce5a`. Live Adobe, deployed
EDS, downstream receipt, full SDK compatibility and release readiness remain
unproved. Spec 051 and slice 051-09 remain IN_PROGRESS; live-run and retry
admission are not reopened.

### Current deviation log

The bounded harness uses real pinned stock integration and Alloy in native
browser stock and classic chamber arms, with synthetic responses and a local
sink. The event queue-time exception is limited to the reviewed comparison
copy; it does not rewrite wire bytes or prove performance parity. Endpoint
and tenant fence stimuli are controller-generated; the payload fence uses
the SDK fetch with a controlled denylist. The measured cookie probe is limited
to the owned fixture and does not establish a general cookie jar or public
suffix implementation.

The focused worker's internal caught error retains the original SDK rejection
as its cause while the public result remains sanitized. The narrow shared
cookie-cache change corrects immediate expiry without changing its API; it
does not establish general future TTL handling. The existing core, shared
host, stock-site and default connector remain exercised read-only
dependencies, not new grants or public API changes. Asset preparation was
unconfined and is not containment evidence. The browser's own sandbox was
disabled only inside the reviewed mandatory outer restriction; this does not
establish production renderer security.

The [reviewed contract](slice-09-official-sdk-offline-contract.md) records
the [host-qualified containment option](slice-09-official-sdk-offline-contract.md#host-qualified-containment-option),
[measured cookie probe](slice-09-official-sdk-offline-contract.md#reviewed-measured-fixture-cookie-probe),
[context and queue-time resolutions](slice-09-official-sdk-offline-contract.md#reviewed-resolution-of-attempt-15-differences),
[original rejection semantics](slice-09-official-sdk-offline-contract.md#reviewed-original-sdk-rejection-observation),
and [phase-aware supplier handling](slice-09-official-sdk-offline-contract.md#coordinator-revalidation-allocation-2026-11-03).
Attempt 24 binds the internal caught-error cause and observed rejection to
the fresh runtime, not to earlier proof.

The coordinator extended **review and record work only** through
`2026-11-03T19:02:37Z` if needed. The source/native stop remains
`2026-11-03T18:32:37Z`, and all native, roster and dispatch capacity is
already exhausted. This extension supplies no source change, SDK execution,
new live operation, refund or reset authority.

### Current reconciliation sweep

This sweep accounts for the exact checkpoint delta from
`a1a2ef0629f6fc4d625672a33e054b9008e9ff68` to the current recorded work;
it does not use a `main...HEAD` comparison or include unrelated inherited
work. The [historical blocked sweep](#historical-blocked-checkpoint-documentation)
below remains a separate record of the earlier stop.

| Exact checkpoint paths | Current disposition |
|---|---|
| `connectors/alloy/alloy-chamber.worker.js` | Updated only in the fixed-profile path for the measured cookie-probe behavior; legacy connector grants remain unchanged. |
| `connectors/alloy/sync-cookie-cache.js` | Updated under the reviewed narrow exception to correct immediately expired entries. This changes previously incorrect shared internal behavior, including where the cache is used by default; it does not add a general jar, future TTL model, API or grant. |
| `docs/specs/051-adobe-integration-proving-ground/reviews/official-sdk-offline-compliance.md` and `docs/specs/051-adobe-integration-proving-ground/reviews/official-sdk-offline-craft.md` | Recorded actual independent bounded offline PASS bodies; prior compliance FAIL bodies remain historical. |
| `docs/specs/051-adobe-integration-proving-ground/reviews/official-sdk-offline-arch.md` | Recorded the actual independent bounded offline architecture PASS body; no ADR or public-contract promotion follows. |
| `docs/specs/051-adobe-integration-proving-ground/reviews/official-sdk-offline-frame.md` | Recorded the independent framing decisions and their scope; framing is not runtime acceptance. |
| `docs/specs/051-adobe-integration-proving-ground/reviews/official-sdk-offline-reconciliation.md` | Preserved the historical blocked-record review and the bounded needs-changes verdict, and recorded the focused final PASS for the README correction. |
| `docs/specs/051-adobe-integration-proving-ground/slice-09-focused-chamber-journey.md` | Appended offline authority without changing full slice status or the R1 source-only contract. |
| `docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-contract.md` and `docs/specs/051-adobe-integration-proving-ground/slice-09-official-sdk-offline-witness.md` | Updated bounded authority, comparisons, allocations, observations, deviations and evidence; earlier outcomes and charges remain. |
| `probes/adobe-compatibility/README.md` | Updated the operator-facing bounded outcome and remaining review and live gates. |
| `probes/adobe-compatibility/chamber-journey-contract.mjs`, `probes/adobe-compatibility/chamber-journey-host.mjs` and `probes/adobe-compatibility/chamber-journey-worker.mjs` | Updated fixed-profile validation, governed host observations, SDK-native context and original-rejection observation; public completion stays sanitized. |
| `test/adobe-chamber-journey.test.js` and `test/alloy-sync-cookie-cache.test.js` | Added directly coupled non-vendor regressions for the fixed profile and narrowly scoped expiry correction. |
| `test/adobe-official-sdk-journey.test.js`, `test/fixtures/adobe-official-sdk-journey.json` and `test/helpers/adobe-official-sdk-journey.js` | Added the finite opt-in fixture, precharged host-qualified runner, raw evidence and bounded comparison tests. Supplier bytes remain external and uncommitted. |

Protected core, shared host, stock entry, default connector grants, vendor
trees, package/lock/config and old R1 evidence are **no-op or explicitly
excluded** from this checkpoint delta, except for the separately named shared
cache correction above. No ADR or convention change is proposed:
[ADR-0039](../../decisions/adr-0039-airlock-boundary-acceptance.md) and
[ADR-0050](../../decisions/adr-0050-evidence-independent-05109-source-checkpoint.md)
retain their existing boundaries. The remaining debt is explicit: full slice
acceptance and the live Adobe, deployed EDS, downstream, full SDK and release
goals are still open. No new ADR acceptance or product-release decision
follows from this checkpoint.

The witness and probe guide preserve earlier blocked and divergent outcomes,
all charges and historical UNKNOWNs. The independent compliance, craft,
architecture and focused reconciliation records cover only the bounded offline
checkpoint. This sweep is not a full-slice lifecycle transition. Old C FAIL, R1
source-only limitations, withdrawal of operational new-run and historical
retry admission, and Target cleanup UNKNOWN remain unchanged.

The independent reconciliation review of `b054986` found one stale
probe-README sentence that still said the offline observability additions
had not completed implementation reviews. That sentence has been corrected
to reflect the three scoped PASS results. The
[focused independent re-review](reviews/official-sdk-offline-reconciliation.md)
passed on `a18b3e1`; the prior needs-changes verdict remains recorded.
The correction does not change source or runtime evidence.

### Repair epoch attempt 23

The frozen candidate `826f1c48dfaaf76b8f31be9be4d6f7ed90801be4` ran one
complete roster. The machine witness reports **17 of 17 arms passed**:
paired stock and chamber arms for positive, no-consent, no-offer,
non-render, rejected-response, malformed-response and untrusted-interaction,
plus chamber endpoint, tenant and payload fences. These are all from this
attempt, not stitched from earlier attempts.

Both positive arms executed the pinned Alloy bytes, observed the synthetic
offer visibly rendered and recorded a browser-trusted click. The stock arm
also served the pinned `aem-martech` and reference ACDL bytes. The raw record
retains request and response bodies, receipt hashes, SDK outcomes, browser
observations and the reviewed comparison data. The endpoint and tenant
controls used controller-generated `intercepted-fetch` messages, not
SDK-originated requests. The payload control used an SDK-generated fetch
with the controlled fixture's denylist, and its stripped admitted body
reached the sink. These controls passed on the governed path. The exact event
queue-time exception remains a bounded comparison rule, not a wire rewrite or
performance-parity claim.

Before SDK execution, the local receipt and asset matched; Node TCP, UDP and
IPv6 tripwires returned `EPERM`; the browser and worker external requests
returned `net::ERR_ACCESS_DENIED`; and the resolver control failed with
`net::ERR_NAME_NOT_RESOLVED`. The process and descriptor observations are
retained in the attempt result. Playwright's browser sandbox was disabled
only under the mandatory outer restriction; this is not a production browser
sandbox claim. Trusted asset preparation was separately recorded as
unconfined, with the compiler stopped before the runtime attempt.

All 17 case contexts and listeners closed; each applicable chamber worker
closed. The browser, companion and server closed. Both the owned Node group
and separately tracked browser group were observed clean, with no orphaned
descendants observed. This does not qualify historical consumed-stop or race
safety, or change any earlier UNKNOWN teardown.

This attempt used 17 contexts and 48 SDK-or-fence attempts. There were 46
sink receipts; the two controller-generated endpoint and tenant fence
attempts were held before delivery. It pre-reserved 49 dispatch slots and
20 overflow-refusal slots. Cumulative charges
were **23/24 native, 14/14 rosters, 81/136 contexts, 77/84 realm probes and
759/828 dispatch reservations** under the limit then in force. Nothing was
refunded.

| Evidence in session `203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/` | SHA-256 |
|---|---|
| `epoch2-native-23.json` | `fef921af0f4bfa70748222852bdc4f6ec13ddf9916358ef75d7845282799c9af` |
| `epoch2-native-23-result.json` | `32e3ed08817564f04e3461102ac5fc3f2460ff52e297d6e9e17fd11f90d82e5b` |
| `epoch2-roster-23.log` | `13f2ae126d1696667573afd91db3e35a04b3fe0c37d10b9783161ae0a76de0c2` |
| `epoch2-preparation-012.json` | `7b872936b19e3f8630e0b1027a9c2ba6f35f8d87dc2e2f436737ef2f139f73d3` |
| `epoch2-preparation-012-result.json` | `2209e50003285d64609701d4ea5dbe520abd4dc72a8a3545d4253b46225be9c8` |

Fixture SHA-256 is
`7a130f6411f1a33342029ea25ad39e18129d781f5ccb73be0045d9d6bda52107`;
runtime policy SHA-256 is
`d0fa71724e22f3abea7e32312683bdbcc14332bec425cb664771bbe4d33e0be9`.
The pinned asset hashes and exact source, executable, dependency,
preparation and process bindings are in the immutable attempt and result.

At the attempt 23 record, the result was a bounded offline machine-witness
outcome, not an independent review verdict. Live Adobe, deployed EDS,
downstream receipt, full SDK compatibility and release readiness remain unproved; spec
051 and slice 051-09 remain IN_PROGRESS. No live-run or retry admission is
reopened.

### Repair epoch attempt 22

The frozen candidate `e9039693b5313fc88c80824de54ed9726afc1e04`
completed fresh pre-SDK controls. Fourteen stock/chamber arms through the
untrusted-interaction control passed. Both rejected-response and
malformed-response pairs independently captured and compared the original
SDK Error name, full multiline message and semantic extras; the synthetic
responses and operation/receipt joins matched. Both native lazy stacks were
unobserved, and the stock CDP description remains in the raw record. This
observation does not prove the cause of attempt 21's failure.

The endpoint-fence case was **BLOCKED** by `fence-dispatch-mismatch`: the
actual governed seam held the undeclared `/ee/v1/collect`, counted one
ceiling hold, recorded the attempted original, and did not dispatch it to
the sink. The check also requires the actual reason. The core emitted a
110-character reason, while the probe host retained only strings of at most
100 characters, so the recorded diagnostic lacked that reason. The tenant
and payload cases were not attempted. The endpoint observation is not a
completed case or a roster pass.

All attempted contexts, workers and listeners closed; browser and server
closed and both owned process groups were clean.

| Evidence in session `203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/` | SHA-256 |
|---|---|
| `epoch2-native-22.json` | `16921dc2b3a3655a1c23de574f7d76f2d2e3c8a0e0040de8f927ef0a7581e495` |
| `epoch2-native-22-result.json` | `690a62a1cce7106bb82bfa84355c4de1c936fcded306c436e70a7a9245ab876d` |
| `epoch2-roster-22.log` | `2df850a3f1fa7104e90b962401d89df582ce01f44b7acea8941632c6aa4afb69` |
| `epoch2-preparation-011.json` | `ad0f8a114e07c911e628f7ca4e0d8ebef60da46e52d335b5d06ce38559d2ad33` |
| `epoch2-preparation-011-result.json` | `92e1baab89c0200e1dbdfa24777b2c5d8955aa39d332b0bc6695f4d2a11455e9` |

At this stop cumulative charges were **22 native, 13 rosters, 64 contexts,
71 realm probes and 690 dispatch reservations**. One roster remains under
the current cumulative limit. No charge is refunded.

### Repair epoch attempt 21

The frozen candidate `958c3508d367ae3e2dc8bc00ba6e05313c3cb5e5`
completed fresh pre-SDK controls. Positive, no-consent, no-offer and
non-render arms passed individual checks; positive, no-offer and non-render
pairs compared. The stock rejected-response reached the actual SDK and
synthetic 400, but the new descriptor-safe observer returned
`sdk-rejection-unobservable`. The actual CDP rejection and raw description
were retained; the original observation failure was not detailed enough to
identify the cause. The paired chamber and remaining arms did not execute.
This attempt is **BLOCKED**, not a partial pass.

The fixture Node/V8 exposes a lazy intrinsic Error-stack accessor shared by
fresh Errors. A source-only regression now recognizes that exact same-realm
native accessor without invoking it; a different accessor remains
unobservable. This is a hypothesis for attempt 21, not proof of its cause.
The next candidate also retains raw CDP property and observer responses to
make any repeated failure diagnosable without reconstructing the error.

All attempted contexts, workers and listeners closed; the paired preflight
context, browser and server closed, and both owned process groups were clean.
The stock observer reported the same observation fault during cleanup; this
is a failed observer, not evidence that the SDK rejection matched.

| Evidence in session `203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/` | SHA-256 |
|---|---|
| `epoch2-native-21.json` | `17c7b87d354e02cacd8a9a83d09dbb1a8cd784ff64fe5c5baf342c9431d74957` |
| `epoch2-native-21-result.json` | `569fb34db4fa3846f62270c801410d9818ae3e18bf68663f58389454db940e11` |
| `epoch2-roster-21.log` | `1e8acf1016b4e5d4980913e3d8f570ec62cb650765931e63ef96f20f2c5aeaf0` |
| `epoch2-preparation-010.json` | `3ca58cff1c95cff366ea055b08b73190775fe744a55445bbb4334097b659a195` |
| `epoch2-preparation-010-result.json` | `eac3b626ab0a7875f1c05e055b318d9664130b85acad428bb679b8df5809918d` |

The cumulative charges are now **21 native, 12 rosters, 49 contexts,
65 realm probes and 621 dispatch reservations**. Prior charges remain;
there is no refund, new epoch or extension of the hard stop.

The independent Sol [rejection-observation frame](reviews/official-sdk-offline-frame.md)
passed at reviewed source `0a103b016e903834bb51bf2d72fc1c0465cc8f36` for
the exact proposal SHA-256
`3ed9958d47bf6a313808f047967f5d7682bb32053cc7f6b9593fbc104ce6d02c`.
It permits a bounded observation repair under the standing grant, not a
retrospective pass for attempt 20 or runtime acceptance. Original promise
and host outcomes, substantive error data and raw diagnostic evidence remain
distinct. The cumulative 20 native / 11 roster / 39 context / 59 realm /
552 dispatch charges, unchanged limits and hard stop remain in force.

The coordinator's [revalidation allocation](slice-09-official-sdk-offline-contract.md#coordinator-revalidation-allocation-2026-11-03)
increases the same epoch's roster, dispatch and realm limits to 14, 828 and
84 respectively. Native and context limits remain 24 and 136. Attempt 19's
19/10/29/483/53 charges remain, with no reset or refund. The unchanged hard
stop is `2026-11-03T18:32:37Z`. This allocation is not a review verdict or
an acceptance of attempt 19.

The candidate records each stock phase invocation and checks it against the
stock entry's phase result. It requires the pinned integration and Alloy
bytes in every executed stock case; ACDL is required for completed lazy
phases and the observed running lazy phase. Eager-rejection cases may stop
before lazy only with the recorded failed phase, rejected SDK outcome and
no subsequent render, click or notification. Every observed supplier asset
is checked against its size and SHA-256 pin. A source-only missing/malformed
phase or missing/changed required asset fails. This does not pass attempt 19.

| Evidence | SHA-256 |
|---|---|
| `epoch2-cap-revision-20261103T1716.json` | `a3081bb678160e0386de4e19ebcf5e0be08ea3ec3c97e2f5afefc2cf2ebb9083` |
| `epoch2-revalidation-caps-red.log` | `e1796f137182cdcb5982d70f99b63ec87f37999b544d152c34133753ca767dfc` |
| `epoch2-revalidation-caps-green.log` | `55bb08658010d51b25d75dac91d97c23b7178fdad874388c2696ca2ac810d96e` |
| `epoch2-phase-assets-red.log` | `2c4cc944fc856f682fa01aa87c2d324d9ab81175a6b1c447f85b83235bd86a74` |
| `epoch2-phase-assets-green.log` | `d2d4860e2767458dd361ed91bc50c8c0f1f4b42f11d7367712f01d49c1526bd8` |
| `epoch2-phase-guard-red.log` | `77fe9c55ff467fbf4de4bcb2c7aa7843e5002ba67534a34ad7aa24aaee93b7bc` |
| `epoch2-phase-guard-green.log` | `0afc48f23709eeddcad95a9de411b936e922b2503f0b428c089a4e3b31aa5524` |
| `epoch2-phase-candidate-final.log` | `e48a6baebad07956b712cb074bd932c13d6121cd4ffd0027c0a6690cd6c86b1f` |

### Repair epoch attempt 20

The frozen phase-aware candidate `0a103b016e903834bb51bf2d72fc1c0465cc8f36`
passed fresh pre-SDK containment and custody controls under the unchanged
policy. Its preparation record and result are `epoch2-preparation-009.json`
(SHA-256 `5a3dd818498d87636dac2c53ed718a10e22c6a49c4d6822357ab41e9483ecfa8`)
and `epoch2-preparation-009-result.json`
(SHA-256 `52dee75d5dd10eb310b803868421bb5ca76ba6aa6067f3c233493a931935df85`).
The positive, no-consent, no-offer and non-render arms passed individual
checks; the positive, no-offer and non-render pairs passed comparison.
Stock rejected-response then passed its phase-aware case check without
requesting ACDL.

The paired chamber rejected-response remains **BLOCKED** at
`arm-sdk-result-divergent:2`. Both arms joined the same synthetic HTTP 400
response and observed an SDK rejection. The stock debugger recorded the
Error description including its stack; the existing chamber profile catches
the SDK error and exposes only `sdk-rejected`. The actual raw chamber error
was not captured, so this is not evidence that the SDK error details match.
The response and both different observed values are retained unchanged.
No rejection-detail normalization or retrospective pass is claimed.

All attempted contexts, listeners and chamber workers, the browser and server
reported closed; both owned process groups were clean. Seven arms remain
unexecuted. Cumulative charges are **20/24 native, 11/14 rosters,
39/136 contexts, 59/84 realm probes and 552/828 dispatch reservations**.
All earlier outcomes remain unchanged.

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-20.json` | `e20a73e52fbffffdd3ae41e2031662968ae48ca1945feedcee707521598c5d74` |
| `epoch2-native-20-result.json` | `a2bfafbd7ef2ce48b22a195a4b5bdfbe68b815d683e6950dbf4919e350b3a2a9` |
| `epoch2-roster-20.log` | `c308a9b31f5b55171c1c8ea4080d26f93287061e9a951322de98481285bb49b6` |

The [measured cookie-probe frame](reviews/official-sdk-offline-frame.md)
passed at `bb07d35b240652d83a463c73c460fd7dfca5b046`. Its
[conditions and revised cumulative limits](slice-09-official-sdk-offline-contract.md#reviewed-measured-fixture-cookie-probe)
are active under the standing grant. This does not pass attempt 16, validate
the later clock repair, or establish SDK acceptance or containment.

The measured-probe source candidate measures the two exact SDK cookie probes in each
owned fixture context, checks cleanup and matching observations, and passes the
bounded map only into the fixed profile. The profile suppresses only a matching
measured rejection; other writes still use the real cache. Stock observation
delegates cookie operations to the browser's native accessor. Both arms record
actual SDK probe writes and read-back; the consent-guarded chamber arm must
instead show no SDK probe. These source checks do not establish that the real
browser will produce a qualifying map or that the complete roster passes.

The cap, profile and measurement tests were run red then green without vendor
execution. The final source selection passed 313 tests with two opt-in tests
skipped. Session evidence:

| Evidence | SHA-256 |
|---|---|
| `epoch2-cookie-caps-red.log` | `34c089ceaecf1d5ae0ae453b502512c830a46bb0840a1251fb20bef21aa2047b` |
| `epoch2-cookie-caps-green.log` | `118f4af9972aa548d8a03865d825fa4287e5555104fc1891044d05f560b2feff` |
| `epoch2-cookie-probe-profile-red.log` | `dd1209cd45c21d02231353bff000687381b7a2337a7a908bbfa0ecfe34061c4e` |
| `epoch2-cookie-probe-profile-green.log` | `595f892592a415da7d2113264647f6a2081dd42f9c54c78b68a65261cfa4591e` |
| `epoch2-cookie-measurement-red.log` | `ddaf53ac56f6a20013cb01d5cab386816bb6ab9927c85fc24560f5f9a2a397e9` |
| `epoch2-cookie-measurement-green.log` | `60798e9fb1c92e2b49a288d18ee6927805bee837b678f09b51d3d1a0b7f17b6c` |
| `epoch2-cookie-candidate-unit-final.log` | `de412a232e3b23ee86535a6084837baa46a7854fcb51b82ecdff0ba5d8911be1` |

### Repair epoch attempt 19: roster cap stop

The frozen candidate `a13f7140584394fc3b142fecc0cba8309f62b360`
ran under policy SHA-256
`d0fa71724e22f3abea7e32312683bdbcc14332bec425cb664771bbe4d33e0be9`.
Its separately recorded trusted preparation is `epoch2-preparation-008.json`
(SHA-256 `3fa21ef3f7d04369a7ec8be809b9b804318d001eddfe2ddcb97ec6cc373eb538`);
its result is `epoch2-preparation-008-result.json`
(SHA-256 `91ada5ee628d590e4b3d52f3c86d0154a158f758ba346ab7fd40a8ad9af73faf`).
The native record binds the source, compiler output, supplier bytes, executable
hashes, exact browser argv and policy. The reviewed headless-shell fixture
used `chromiumSandbox: false` inside the outer restriction; this is not a
production renderer-security claim.

Fresh local receipt and asset checks succeeded. Node TCP, UDP and IPv6 probes
reported `EPERM`; browser and worker external requests reported
`ERR_ACCESS_DENIED`, and the resolver reported `ERR_NAME_NOT_RESOLVED`.
The attempt recorded process and descriptor custody before SDK execution.
These controls cover this attested fixture and host, not arbitrary future
code or historical consumed-stop/race safety.

Eight arms passed their case checks: positive, no-consent, no-offer and
non-render in each arm. The positive, no-offer and non-render pairs passed
their functional comparisons. The positive arms each delivered five SDK
requests, visibly rendered the offer, captured a trusted click and recorded
native DISPLAY and INTERACT. The stock and chamber SDK probe traces matched
their fresh browser-measured maps. The SDK selected the full admitted host;
the raw domain was not rewritten. These observations belong only to this
attempt and do not establish the complete checkpoint.

The next arm, stock rejected-response, was **BLOCKED** by
`supplier-or-bundle-not-served`. The record shows the pinned integration and
Alloy served, the SDK consent request resolved, and the synthetic 400 fetch
response produced an SDK rejection. The stock eager phase failed as intended
and lazy was not started; this case did not request ACDL. The pinned
integration loads ACDL in `martechLazy` (`aem-martech-index.js` lines
312–313 and 797–800), while the checker currently requires ACDL in every
non-consent stock case. The remaining eight arms are unexecuted. This is a
concrete checker/fixture alignment issue, not permission to claim success or
waive the pinned stock journey.

Every attempted context, listener and chamber worker, the reserved companion,
browser and server reported closed. Both owned process groups were clean.
The cumulative ledger is **19/24 native, 10/10 rosters, 29/136 contexts,
53/60 realm probes and 483/552 dispatch reservations** under the limits then
in force. The roster cap stopped execution until the later coordinator
allocation recorded above. Nothing is refunded, and earlier attempts remain unchanged. Independent Sol
compliance, craft, architecture and reconciliation reviews remain open.

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-19.json` | `4f22dfa6ab366a1b6c776e66410676147469046c1eaf75f16de05c1a27d10eb9` |
| `epoch2-native-19-result.json` | `323664b167c127320ebbe78e71177852b74e0de357d73f93117fa82e7177e221` |
| `epoch2-roster-19.log` | `d2cd3b51fbb22288bb9b19b741d3847761588746ed284a4a509835d3ff8da0e9` |

### Repair epoch attempt 18

The frozen candidate `b35a7cf6d906385d2011214c2f13d6e064c1663a`
ran fresh containment and custody controls. The positive stock and chamber
arms each sent five SDK requests, recorded a visible render and trusted
click, and passed their paired comparison. Their actual SDK probe traces
matched the independent browser measurements: `aem.page` was rejected, the
full host accepted, and the cleanup left no probe. Both no-consent arms and
both no-offer arms also passed their individual checks; the no-offer pair
passed its comparison.

The roster remains **BLOCKED** at stock non-render. Its asynchronous
data-layer custom call returned before its fourth expected request entered
the route. The runner had already marked the case finished, so that request
was recorded as `unexpected-blocked`, not delivered; its SDK outcome was
rejected. The original observation and all 69 reservations remain charged.
This is not evidence that the full roster passed.

The follow-up source repair waits for the actual admitted custom delivery in
the relevant stock cases before marking the case finished. It uses the
existing phase and case deadlines and leaves request ceilings and late
refusals intact; the stock SDK result must still be observed and checked.
Source-level tests witness that the wait does not complete early and that an
expired case fails. Attempt 18 is not reclassified. All attempted contexts
and listeners, the chamber workers, companion, browser and server reported
closed; both owned process groups were clean.

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-18.json` | `23d00332653032e133441054518ae336cde3e53a3aed1925558c5a0ef53f1a41` |
| `epoch2-native-18-result.json` | `95e00c4e94fc4bb2e9da68d9a29dbac37831b8fd19608a445bcdc7a09da7afcf` |
| `epoch2-roster-18.log` | `8f679cb653131bf53ace91ac498a38652513e6237cb18c623741cca65eaef830` |
| `epoch2-custom-delivery-red.log` | `95f8ef61e361d4937b60efdc71e46ac7c85be4914576c6312f2ec169fffd7f1b` |
| `epoch2-custom-delivery-green.log` | `4fa2683d46403cb5a2a58e369223ff9d9ca057cc8dc78c199ee84f9b4b85aa96` |
| `epoch2-delivery-candidate-unit.log` | `a39350c424f27cd90cd65a68880e788cfe3da780654bb462c9e801d14e25ef7c` |

The cumulative charges after attempt 18 are 18 native invocations, 9 rosters,
19 contexts, 47 realm probes and 414 dispatch reservations. No charge is
refunded.

### Repair epoch attempt 17

The frozen candidate `e2be2ea50769252012e3de4185d8466bda0cdafb`
completed fresh controls and independently measured matching cookie maps in
the positive stock and companion contexts: `aem.page` was rejected and the
full fixture host accepted; each measurement reported clean before and after.
The stock SDK sent five requests and returned five resolved results. The
stock site reported its render and click, but the independent click observation
was empty. The attempt stopped as **BLOCKED** before chamber execution:
the stock SDK cookie trace was missing.

The cause is in the candidate's observer wiring: `item.arm` was passed to
the click array push instead of the `page.evaluate` call. Consequently the
stock cookie observer did not install, and the click listener referenced an
unavailable closure. The follow-up source repair passes the arm to the page
evaluation and tests the actual observer function in an isolated non-vendor
context. It does not retroactively qualify attempt 17 or prove the browser
observer. The stock and companion contexts, listeners, browser and server
reported closed, and both owned process groups were clean.

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-17.json` | `7d39723a1eecdc2fd41fc08264d765c4a0cadb6757a6113a2395de1c9c96d3ca` |
| `epoch2-native-17-result.json` | `aa92cdb41ca8abb04fb701ca910483e8d00b42537e80a1fe617cd006c0928637` |
| `epoch2-roster-17.log` | `cf4b0e74396990a64ca7ca304294fe156df03d1ec66b616f0c803945e746e40a` |
| `epoch2-observer-binding-red.log` | `dffebf3789769b2b4aeeea82389e40cb6c5504cc394080851a0a26543509d6c5` |
| `epoch2-observer-binding-green.log` | `cb6c24057cb38dfbad7bc0622098ef744f27aad2cc9db2190d42e4f7d7a2c79c` |
| `epoch2-observer-candidate-unit.log` | `7b36287cde4bbce1dc813724ba806ee542b0f3c33c57d56fffe1deb696fcd2da` |

The cumulative charges after attempt 17 are 17 native invocations, 8 rosters,
11 contexts, 41 realm probes and 345 dispatch reservations. No charge is
refunded.

The [attempt 15 resolutions](slice-09-official-sdk-offline-contract.md#reviewed-resolution-of-attempt-15-differences)
passed independent Sol frame review at `8de49445506c0a700fde0930c8b44f0b7931e323`.
The narrow queue-time comparison rule, fixed-profile input and context
alignment, and scoped internal cookie-cache correction are active under the
standing grant and binding review conditions. This is not implementation or
containment acceptance. Attempt 15 remains DIVERGENT, with its raw records and
cumulative charges unchanged.

The alignment candidate adds the reviewed event queue-time comparison, paired
pre-SDK fixture-context observations, SDK-native context collection and
immediate cookie-expiry handling. The source-only profile remains available
without context and cannot qualify the full checkpoint. The payload-fence
fixture now uses the stock fetch name `airlock-stock-v1` as its denied marker,
so that case still checks the same field on the actual aligned fetch. Fixture
SHA-256: `7a130f6411f1a33342029ea25ad39e18129d781f5ccb73be0045d9d6bda52107`.

The cookie, queue-time and context changes each had source-level failing tests
before their fixes. Logs are retained under the session's `files/` directory:

| Evidence | SHA-256 |
|---|---|
| `epoch2-cookie-expiry-red.log` | `475aba9b07793dc39fcd1e72263d588f409903983ec71f592a6793c71e72177a` |
| `epoch2-cookie-expiry-green.log` | `db3b07ecde790a2e84bdb7812f8838fab2984c0abb864139ffd78cb2011d54c3` |
| `epoch2-queue-red.log` | `98da6472fd6cb5c2277742cc7984447c25bb2bb6d3c330b9fe0a193278a34657` |
| `epoch2-queue-green.log` | `107452a734c40b88e55387356b70333b1ca877bd8f3ed956c498497e50f18764` |
| `epoch2-context-red.log` | `b9063b2db8d511a2e03f72e152b195645f9303671d957d22ac11fee12d1226b1` |
| `epoch2-context-green.log` | `0550bc6c4e4854e4bb793a2c5bd5f692bfa567294a6715d902fb0bd258e35ff7` |
| `epoch2-context-pair-red.log` | `671b7a4bfa024ea46e775e115234cd1efd792e6d42ad5f8c99267bb1cffd05cf` |
| `epoch2-context-pair-green.log` | `e5c5a1986e3a4e1f76ac22b4fc396341916c9fbe254e3d2474b338d703ac4eb6` |
| `epoch2-alignment-source-regressions-final.log` | `dac02d0957b29b6913b24b5f567093c5c951aa84d3205bed327902348ee86525` |

The final source selection passed 307 tests with two opt-in tests skipped.
It covers the cookie cache, legacy connector and EDS source paths, the fixed
profile, the offline checker and frozen contracts. These checks do not prove
native containment, SDK acceptance or production behavior. The historical
R-004 and R-014 records retain their original scope; the cache no longer
has R-004's exact no-expiry behavior.

### Repair epoch attempt 16

The frozen candidate `87b6b7d65585a0eb72ef257f34568e9373315c37` ran
under policy SHA-256
`d0fa71724e22f3abea7e32312683bdbcc14332bec425cb664771bbe4d33e0be9`.
Its preparation record is `epoch2-preparation-005.json`, SHA-256
`cd316b19ee64756a0f81aaa0be56b4dade69b8f5f7d4a428dfd0ba30866cfe18`;
the preparation result is `epoch2-preparation-005-result.json`, SHA-256
`943d125effa9d0d1c85a8b3e025cdce6c77b8da153a279c5ad84167ec01a9412`.
The fixed genuine Chromium headless shell used the reviewed fixture option
inside the outer restriction. The immutable attempt record contains the
exact argv, executables and asset hashes.

The Node TCP, UDP and IPv6 probes reported `EPERM`; the browser and worker
external requests reported `ERR_ACCESS_DENIED`; resolver and local receipt
checks passed. Process and descriptor observations were recorded before
SDK evaluation. The positive stock and chamber contexts independently
reported the same controlled page context before the stock SDK loaded.
Both arms sent five SDK requests, visibly rendered the offer, recorded a
trusted click and returned five matching SDK results. The stock case passed.
The chamber case remained BLOCKED: its click observation was
`1793723600974.3` browser-epoch milliseconds and its request observation was
`1793723600974` integer Node-epoch milliseconds. These two observations do
not prove their order at that resolution. Contexts, worker, listeners,
browser and server reported closed; both owned process groups were clean.

The raw bodies also differ in `meta.state.domain` on all five requests.
Stock reported `main--stock-fixture--fixture-owner.aem.page`, and the
chamber reported `aem.page`. The pinned SDK's static `wr` function at byte
43770 tests progressively longer cookie domains through a set/read probe.
The synchronous cache accepts a write without checking its Domain attribute.
That explains why the first candidate can appear accepted in the chamber.
The individual browser probe writes and their rejection reason were not
captured in attempt 16. The domain difference is not normalized and remains
unresolved.

The subsequent source candidate records the chamber's worker-message
observation on the same browser clock as paint and click. Its checker joins
that observation to the exact original request before comparing order. The
prior attempt did not capture this clock and is not retroactively passed.
Source-level red/green evidence and the expanded regression run are below.
No new native attempt has used this clock repair.

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-16.json` | `ee565cf912ad4e457a5b719b79b8677031cffc76bb93a854bc6b0676d5da4250` |
| `epoch2-native-16-result.json` | `e2dae7a8a51f93da7781cebab7439803032cc5cdf5404104eb8c34b2ee7b63d0` |
| `epoch2-roster-16.log` | `20b140ea69e7c02f99ddd1d99b5704062911b07832737e4157ced9a888f5de3f` |
| `epoch2-clock-join-red.log` | `9b0e2f0cff06563fd983d4de4aadfb3bbdd403d840586e44b60841f31625b7ce` |
| `epoch2-clock-join-green.log` | `29b270cdb8aca2bd530ccfe709ca62ddaa18954b571d0f1f552e9181729a8505` |
| `epoch2-clock-source-regressions.log` | `78bd5102dee89b5c2026d7dfe82f18d46970206144e4b92d5f37813310c6bda5` |

At attempt 16 the cumulative charges were 16 native invocations, 7 rosters,
9 contexts, 35 realm probes and 276 dispatch reservations. The later reviewed
limits are 24, 10, 136, 60 and 552 respectively, with no refunded charges.
Prior attempt 15 remains DIVERGENT and is not combined with this result.

The owner has since granted routine offline harness and checker fixes. The
[repair epoch amendment](slice-09-official-sdk-offline-contract.md#repair-epoch-authority-amendment)
defines a separate `2026-11-03T14:32:37Z`-`18:32:37Z` window and bounded
diagnostics and retries. Independent Sol passed the repair frame at
`c3b4f055b51cf609a37dd0945c1316294aaf390f`. That pass covers the frame,
not containment or implementation acceptance.

The independent Sol [browser fixture frame](reviews/official-sdk-offline-frame.md)
passed at reviewed checkpoint `13250eb5e4c151604b3eb6970688a51b15a1e5d1`.
It permits the standard `chromiumSandbox: false` fixture option only under the
unchanged mandatory outer restriction, and adjusts the cumulative repair
limits without changing the clock or refunding any charge. The
[current authority](slice-09-official-sdk-offline-contract.md#repair-epoch-browser-fixture-and-resource-adjustment)
records the boundary. This frame pass does not prove containment or SDK
execution and does not claim normal Chromium renderer isolation.

Source candidate `2ce192d69aba7f0917bfdba58032ab83915c0277` adds the reviewed
limits and fixed browser option. It also records trusted local bundle
preparation separately from a confined runtime attempt, tracks the browser's
separate process group, checks the observed process/descriptor inventory,
and reserves overflow refusal separately from the 49 expected dispatch slots.
The 20-slot overflow reservation uses the largest five-slot case and the
pinned SDK's four-attempt retry path as a finite sizing basis; it is not
proof that unknown SDK behavior fits that bound. Exceeding it records
`UNKNOWN` and blocks the run. No reservation is refunded.

Playwright starts Chromium in a separate process group; this does not change
the inherited outer sandbox. A clean Node group alone does not establish
browser closure. The candidate captures the fixed browser launch and checks
its group separately, without killing by name or assuming a still-present
group belongs to the attempt. At that source checkpoint its named-host
resolver rule and process/descriptor and realm checks had not run natively.

Source-only compatibility at 2ce192d passed 255 tests and skipped two across
the four focused files. The log
`files/epoch2-preflight-source-compatibility.log` has SHA-256
`91f78ac442be000b912526cc5fcfb9da62d49a1583c08aba458b971391c81a85`.
This does not change the prior observed native outcomes or establish
containment, SDK execution or acceptance.

The combined attempt at `474c478c1d52c5e730bde51b7057dd50d5cf060e` was
native invocation 12. It observed the local synthetic asset and sink
receipts; Node TCP, UDP and IPv6 controls returned `EPERM`; the browser and
worker controls returned `ERR_ACCESS_DENIED`; and the fixed localhost
resolver control returned `ERR_NAME_NOT_RESOLVED`. Chromium's actual launch
included `--no-sandbox` under the unchanged outer policy. Its owned browser
group and the Node group were separately observed closed, as were the
context, browser and server.

The attempt stopped before SDK loading at `unix-descriptor-unattested`.
The failing descriptor was not identified in that result. The initial Node
stdio descriptors were reported as Unix-typed; the follow-on source change
compares those three known stdio identities with the initial observation and
records a specific descriptor on any later refusal. This attempt was not a
containment pass, and no supplier asset was served by attempt 12.

The immutable attempt files `files/epoch2-native-12.json` and
`files/epoch2-native-12-result.json` have SHA-256
`695db50786590f7f3738b3570df96d8a4fe9d5bc52bcc03a6a0a76fdcba391ca` and
`d2a57753bb64b08e2b388767da1af720dc3fa4ac14520d33f3990c32750c10ab`.
The separate trusted preparation record and result
`files/epoch2-preparation-001.json` and `files/epoch2-preparation-001-result.json`
have SHA-256 `6de936a685b76e0159e4b70941d9cb0a8fd5091829a13623fe7328b0f25de03d`
and `883a09aeb91273fa491cba5aaf3acf8f5ff43ba0815d89a55e4e5fb5c604f641`.
Preparation is not confined-runtime or SDK evidence.

### Repair epoch: attempt 13

Native invocation 13 ran source `0860b5ab310bb8d5954049c99890d99cf783cba3`.
The Node TCP, UDP and IPv6 controls returned `EPERM`; browser and worker
negative controls returned `ERR_ACCESS_DENIED`; and the resolver control
returned `ERR_NAME_NOT_RESOLVED`. The local synthetic asset and sink receipts
matched. The observed process and descriptor inventory passed the checker
then in use. That checker accepted anonymous Unix peers without binding them
to the fixed process and pipe handles. Attempt 13 therefore did **not**
establish the required descriptor custody or a containment pass. No external
escape was observed; that observation is not proof of containment.

The pinned stock SDK executed and sent one consent POST. Its original,
admitted and synthetic sink request bytes matched at 328 bytes and SHA-256
`157711b7f3bb26dad021ba3e609aed74be06fb3c8fa7325f52112f73f982de2f`.
The synthetic 200 response was `{"handle":[]}` with SHA-256
`4a94513e1a04e5a17acfc968bc45be4f02d07d3b9c9f755565eed56516af3f4d`.
The recorder observed one request and one completed response. The first
stock case then reported `eager-timeout`; its observer reported
`sdk-result-observer-timeout`. The case listener and context teardown were
recorded as UNKNOWN. The outer context, browser and server later reported
closed, and the separately observed browser and Node groups were clean.
These later closures do not change the case-level UNKNOWN or establish a
successful arm.

Attempt 13 charged 49 expected and 20 overflow-refusal dispatch reservations,
including the one observed SDK request. Cumulative repair-epoch charges are
13 of 24 native invocations, 4 of 8 roster attempts, 4 of 136 contexts,
17 of 48 realm probes, and 69 of 392 dispatch reservations. No reservation
was refunded. No complete arm passed. The pinned SDK's consent handling and
the empty synthetic response are a diagnosis hypothesis, not an established
cause of the timeout.

The following source candidate binds Node's browser pipes to the actual
Playwright spawn handles and inspector pipes to its `lsof` spawn handles.
It checks the fixed browser stdio roles, inherited child stdio identities,
process ownership, parent and group observations. An unmatched Unix peer
blocks the run. The browser launch time is observed at spawn, not obtained
as an independent OS process-start timestamp for each descendant. The
checker does not claim reciprocal kernel-pointer verification or cover
arbitrary future processes. It also adds bounded observer teardown and
diagnostics, and origin-specific synthetic CORS response headers. Attempt 14
ran these changes as recorded below.

The four-file non-vendor compatibility selection for this candidate passed
260 tests with two skipped. Its log
`files/epoch2-custody-compatibility.log` has SHA-256
`7d2ff0e34a7989a69fa2ec937d86226bb3a7622579748cd60868d6547d5b1cd7`.
This is a source check, not a containment or SDK acceptance result.

The attempt files in `files/` have these SHA-256 values:

| Evidence | SHA-256 |
|---|---|
| `epoch2-native-13.json` | `0e09a9f98aad4118a3461257dd0bcdda269ca6327dbee1695fa9e1119c4ec094` |
| `epoch2-native-13-result.json` | `c8557b549b80891b5e397eee86cc59f60713df4a9272358772c9dfe80d8fff51` |
| `epoch2-preparation-002.json` | `27e34739cc93a7279293c128f98576bb5928e2093f8a488aacfc4b47cb090c7a` |
| `epoch2-preparation-002-result.json` | `535f8870c68aa895b58eb36af18dda3fd0984db0d581175f88b5425e022c47b1` |
| `epoch2-roster-13.log` | `ec4386b834c17f497c4d6bbeacba73ed1eca8100e507eff777c18a57aa7307cd` |

### Repair epoch: attempt 14

Native invocation 14 ran source `5763d3fd76cbc2635aca2fcc0eeaf04a475e54a4`
under the same fixed outer policy. The local asset and receipt matched; the
Node TCP, UDP and IPv6 controls returned `EPERM`; the browser and worker
controls returned `ERR_ACCESS_DENIED`; and the resolver control returned
`ERR_NAME_NOT_RESOLVED`. The observed fixed process inventory, owner and
registered browser and inspector pipe checks passed before SDK execution.
This is bounded evidence for that fixture and host, not a universal proof
of process or descriptor behavior.

The stock SDK sent one consent POST. Its original, admitted and sink bytes
matched the 328-byte hash recorded for attempt 13, and the synthetic response
was again `{"handle":[]}`. The consent command resolved with `{}`. The next
`decisioning.propositionFetch` SDK result remained pending, and the
synthetic consent cookie was absent when observed. The case reported
`eager-timeout`, and the observer reported `sdk-result-observer-timeout`.
The case listener and context, outer browser and server all reported closed;
the browser and Node groups were observed clean. No complete arm passed.

The pinned SDK writes `state:store` response payloads to its cookie jar and
reads the organization consent cookie after `setConsent`. The existing
`rig/alloy-consent-pending.mjs` also records that an empty synthetic consent
response does not flush pending consent. The following fixture revision
provides a synthetic `state:store` consent value selected from the actual
SDK request (`general=in` for `y`, `general=out` for `n`); a denied case
cannot receive a grant. Its fixture SHA-256 is
`dbbf958eaa6bc08b0fbd545ef86e36cb23e7c99565c360e9a5809a31f0ed9e08`.
The revised fixture was first executed in attempt 15, recorded below. Attempt
14 supports the diagnosis, but the cause of the earlier attempt 13 timeout remains unproved.
No host pregrant or SDK modification is involved.

After attempt 14 the repair epoch has charged 14 of 24 native invocations,
5 of 8 roster attempts, 5 of 136 contexts, 23 of 48 realm probes and 138 of
392 dispatch reservations. Two SDK requests were observed across attempts
13 and 14; the remaining reserved slots were not observed requests.

| Evidence in `files/` | SHA-256 |
|---|---|
| `epoch2-native-14.json` | `1b4000c4616c6fa7c5a785a6863a7393aae2fa19e225001f45a7e0af13e306c5` |
| `epoch2-native-14-result.json` | `1b0a07ad59f4ef9438f5d47a2791966cdc9d3e7f96d3cf9eaf45eb2ad496bbfe` |
| `epoch2-preparation-003.json` | `386cfe60ea03e8f6e502e09989de21dbc197566cd9d8f5e62869a981c77b2985` |
| `epoch2-preparation-003-result.json` | `dc1b9029415b395a99efb26a6dac1b27d00c35538666605adf8b8be5cb4829ac` |
| `epoch2-roster-14.log` | `d5e75120726bb0f1214da8bd040d4dee05f8a480ba723c165f3665069720c5cf` |
| `epoch2-consent-state-red.log` | `dd302a63c914e7396a8ab4a0533d8bd0894f367cb70aded4194c11b0bc026641` |
| `epoch2-consent-state-green.log` | `137e8dd9d21350e47adfffb135c8f6132730e897fed39ce9ce1af85fcc1b2234` |

### Repair epoch: attempt 15

Native invocation 15 ran source `a39e9041d4e358d55b49b06d5d6cf912a0083536`
with fixture SHA-256
`dbbf958eaa6bc08b0fbd545ef86e36cb23e7c99565c360e9a5809a31f0ed9e08`.
The fixed pre-vendor controls and registered process/descriptor checks ran
again before SDK loading. The stock SDK stored `general=in`, completed the
positive stock sequence and sent five requests: consent, fetch, page with
DISPLAY, custom and INTERACT. The stock checker returned zero. The chamber
also executed five corresponding SDK requests, with resolved command results.
All five corresponding SDK-result values matched exactly. Both arms recorded
a visible synthetic offer and a trusted click.

The paired comparison returned `arm-request-divergent:1`. Stock's consent
request contained collect, personalization, marketing and share preferences;
the chamber request contained collect only. The stock request used the
synthetic page domain and had no state entries; the chamber used
`airlock.example` and carried two empty cookie entries. Later requests also
differed in fetch page naming and browser context fields. The SDK-generated
`/meta/queueTimeMillis` values differed across the arms. This field is not
among the reviewed normalization locations, so comparison remains blocked
pending fresh review. The captured differences were not stripped or
reclassified as equivalent. The stock arm passed its local checks, but the
chamber pair did not pass and the remaining 15 arms were unexecuted.

Both case contexts and listeners, the chamber worker, the outer browser and
server reported closed. The separate Node and browser groups were observed
clean. This attempt does not establish a general process or descriptor
guarantee, live Adobe behavior, deployed EDS, downstream receipt, full SDK
compatibility or release readiness.

Cumulative repair charges are 15 of 24 native invocations, 6 of 8 roster
attempts, 7 of 136 contexts, 29 of 48 realm probes and 207 of 392 dispatch
reservations. The 12 observed SDK requests across attempts 13 through 15
are included within those reservations. No reservation was refunded.

After attempt 15, the fixed profile was changed to send the same explicit
synthetic consent purposes as the stock integration and to derive its
location from the already admitted `pageUrl`. The existing consent,
endpoint, tenant and cookie gates remain in place. The legacy profile keeps
its prior location. These changes have source-only regression coverage and
have not run in a new native attempt. The shared sync-cookie cache retains
expired writes as empty entries; that behavior is not filtered out of the
comparison. A narrowly scoped shared-cache correction and the unlisted
queue-time difference are pending review.

| Evidence in `files/` | SHA-256 |
|---|---|
| `epoch2-native-15.json` | `a8e3a96cc858f9a9d843a49d35b4f8ce8aedd7970136955582a5b9322f66ad8c` |
| `epoch2-native-15-result.json` | `fe50f562ee51763f613e52e4da5a0a4a4c974912a0e6f27c641894c3aa2c8d68` |
| `epoch2-preparation-004.json` | `02391b1c07dd5fa32a47118b4073ce477b3c97ca1d44db8a549fd5c04df68fe3` |
| `epoch2-preparation-004-result.json` | `545855b22958f1a914c07d817f329cc1680eb606f4c76261917c4270c7f840c0` |
| `epoch2-roster-15.log` | `2217482ee052fe9cf16f286ffc99611e94baee00754f91ae25090e91bcf26787` |
| `epoch2-consent-compatibility.log` | `8c4037ce79c6dd040f8064475ae04c5647140d58b92f1af248a2f0d2fb43bc79` |
| `epoch2-purpose-vector-behavior-red.log` | `b2c04dd8ae671f69fcf49455461d7c07eb39ef37a524f7aa6dc16bc17db84268` |
| `epoch2-purpose-vector-green.log` | `9d596ade8510715b8676120c9445137ddaaa150aeb81fcb85fc6d7e128ddb10d` |
| `epoch2-profile-location-red.log` | `e18974ef43fda36713119a379bfe04ffeb0dbf7775f2cb800f2dc46a9ceadc94` |
| `epoch2-profile-location-green.log` | `110e8a024a20009d8ae32daab790374c33a40cd4405d9c8c4221ef423d3e7ea9` |
| `epoch2-profile-input-compatibility.log` | `8aea3f9fee55c192f6e003f17e46d9f5f8a01fd56c080f6a2d0e0c6d1e44e329` |
| `epoch2-profile-existing-alloy-source-regression.log` | `38e2bee7e6c767f2f6ac5668bc0b3e061c44e3538bf5018083f3932373647806` |

### Repair epoch: headless context still blocked

The revision-matched Chromium headless shell launched under the fixed network
denial. It reports `151.0.7922.34`; its executable SHA-256 is
`7687bff7cb2db075f250e6d5848bbc8838cac3802ac3952a899c574f8eccab45`.
The full Chrome application failure remains recorded below. A headless-shell
startup is not a render or input proof.

Two confined checkpoint attempts created positive stock contexts, then
`newPage` failed with `Target crashed`. The second attempt captured Chromium
stderr: `sandbox initialization failed: Operation not permitted`, followed
by GPU process exit 5. The same attempt received the synthetic local marker
and asset and observed `EPERM` on Node TCP, UDP send and IPv6 bind controls.
A separate bind to `127.0.0.2:43187` also returned `EPERM`. These are
individual observations. They do not prove all `localhost` semantics, DNS,
the complete descendant tree or descriptor custody.

The fixture directory contained the headless-shell Mach-O executable and four
executable dylibs. No renderer or utility helper executable was found in that
directory. A fixed nested-sandbox control used separately attested Node and
`/usr/bin/sandbox-exec` paths under the same network-denial structure. Its
inner application exited 71 with `sandbox_apply: Operation not permitted`.
This reproduces a nested-application failure, but does not establish the
specific cause of Chromium's error. It used a diagnostic policy and is not
qualification of the checkpoint policy. Chromium's own sandbox was not
disabled.

At attempt 12 the repair epoch had charged **12 of 24 native invocations**, including both
the outer and inner nested control, **3 of 8 roster attempts**, **3 of 136
contexts**, **11 of 48 realm probes**, and **0 of 392 SDK/fence attempts**.
The original allocations were 12 native, 4 roster, 68 contexts, 12 realm
probes and 196 SDK/fence attempts; the adjustment did not reset them.
Earlier roster attempts stopped in pre-vendor setup. No case arm had executed
the official SDK or served a supplier asset at that point. Attempt 12 did run
the browser and worker tripwires recorded above. Contexts, browsers and servers reported closed;
the owned process groups were observed clean. This is not a general proof of
descendant teardown or inherited-descriptor custody.

The source at this historical stage retained a fail-closed coverage guard before SDK loading.
After the native attempts, `0d2d202` added pre-effect charges for subsequent
context creation. `39c1bc7` adds a conservative plan to reserve the 49
fixed case dispatch slots before vendor execution. `e55deb8` rejects malformed
roster ceilings before creating reservations; `d5285cf` enforces both ends
of the repair window before admission. These changes have
non-vendor tests only. Reservations are charges, not observed dispatches.
At that stage handling an unexpected request beyond a case ceiling remained
unresolved; the later 20-slot reservation is described above. No independent
implementation review of this repair candidate has been performed.
Compliance remains FAIL, craft and required architecture
reviews remain unrun, and the earlier records-only reconciliation PASS did
not advance the slice. The old C FAIL, R1 retractions and quarantine, Target
cleanup UNKNOWN, live/EDS/downstream and full-SDK gates, and slice/spec
IN_PROGRESS remain unchanged.

The records below are in session
`203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/`. Each native attempt has a
separately numbered precharge and result; #11 is the reserved inner call.
The #08 and #09 results contain the complete captured checkpoint output and
frozen assets, policy, fixture and executable identities.

| Native sequence | Precharge SHA-256 | Result SHA-256 |
|---|---|---|
| 01 | `d9d03d9dee195efee8fa646f57145ae383521cf652de4f92fcfe41d2edd6bb29` | `0e91b1f9eb143a1d826a0f3c53d87c9a8336e6f076b16fa9f90ab0090d8d7e9e` |
| 02 | `f84429dc23f919d9679294ea2552b99df57758f8bc46a4c563f5a0de59239f0d` | `1d7216b5cae8a04edc287e3d16ee40c13cc1584317dae15814bf0e96076923f4` |
| 03 | `1a1c04ceca33796384c629c5fe0a097b3b1c964e467f43e5b2683b689a1c32e3` | `8ac195f387253e605da0408bd669e783ef6c5f6544f48b012c9780ee344b0a24` |
| 04 | `18077b9b60ec55c85df6420608c16c72e2a1a165c0486264c2832cf993ec0b81` | `f4b819a0b92058bacbed617d75733219f72e34445ea615a4691d34d59c2cb4b1` |
| 05 | `9ecbdbea835a84d986801a9019119133331bb00de67ae3ee14194f978ffc4f31` | `3c1720a271d084ca62da8641f452d1ce4faf966ffedecd5cd395cdbdbb2be567` |
| 06 | `60ec557ef8df206a1f05a46e6cc2fcdc11e1e51cd9415bc3aa4f72fa2e2b0e8e` | `31bc612ff640eb68b31bab9830ad5e9d9a6029b430035bee6bbc9c227c59f4cf` |
| 07 | `9295eb231ac72039d790fb381348ef67a53377087875986200f38d388cd86562` | `a1b373097f6554f6e4781d5f4551757cee706abcf2e781cb6d695bc030fa40ff` |
| 08 | `2c56d988430b7817dad31cdee6f5795a9b4486e6e7a65399a4d39e1f1dcbdc57` | `4218b1cfeba0bfa4951fa853d277863c19286449e4adc40a5ee8d7e83b480015` |
| 09 | `a2b12f87161e6c3fce2ceac1a0667192a5f9aa6e4ec70bb21f4b79d3767e8c83` | `fe64bd213a710e151d2d1844c439aa92bb2a9ed4e28c2e39b43eac190d302502` |
| 10 | `53a2715bbf3bc925c7cec184fba47ae41300ce1ae4974524b022315f2e181234` | `edc72c0a06b0ddb550b52c9d17fb969de0f25af12ba645f5a485a84856b5a4aa` |
| 11 | `95b63bd9d81b52d03996d94c038b15f47ded73fbc43ddcbf6da2fdf25dc43ba0` | `a5618b202cff0ce3f9e8a7d9a501980ed1c766fd4c8cfe8e10401e4c2790d9f5` |

The source candidates for #08, #09 and #10-11 are respectively
`0f57d3c49e3ec75bc5d6c27123e6d6ff84695083`,
`a45f3227ef21737139bc91e7c0fe94d3f3bb2531` and
`97dc29429bf89acc2875dbbc44f01074c723a75e`. The checkpoint policy
SHA-256 for #08 and #09 is
`d0fa71724e22f3abea7e32312683bdbcc14332bec425cb664771bbe4d33e0be9`.
The diagnostic's own policy and its exact executable and source hashes are in
#10. Supplier inputs were rechecked against their existing pins; matching
input hashes do not claim served-byte or SDK execution evidence.

The non-vendor source tests include witnessed red/green checks for the repair
clock, charge-record binding, loopback outcome classification, the two-slot
nested reservation, context precharge ordering, fixed-roster dispatch
reservation, roster validation and window admission. Their source hashes and
logs are respectively `epoch2-clock-*`, `epoch2-ledger-*`, `epoch2-loopback-*`,
`epoch2-nested-*`, `epoch2-context-*`, `epoch2-dispatch-*`, `epoch2-roster-*`
and `epoch2-admission-*` in the session files. The final helper selection passed
32 tests and skipped
2, with all four offline and historical opt-ins unset. These tests do not
prove the native boundary or official SDK behavior.

## Historical epoch: prior stop and oracle review

The corrected confined attempt received a 27-byte local sink marker and an
88-byte non-vendor asset with the expected bytes. The Node forbidden
connection returned `EPERM`, consuming 1 of 3 pre-vendor tripwires. Chromium
exited 21 before a browser context was created: its `SingletonSocket` bind
returned `EPERM` and `ProcessSingleton` failed. The specific responsible rule
was not established. Playwright reported `kill EPERM`, then observed process
exit and reported temporary-directory cleanup. That is not proof of general
recursive process closure.

At the epoch 1 stop, all 17 case arms were unexecuted: 0 of 17 contexts and
0 of 49 SDK/fence attempts. No official SDK was evaluated and no supplier
bytes were served to either arm. Exact `localhost` semantics and all-network-class, descriptor and
descendant coverage are not qualified. The owned process group was observed
clean and the local server closed; those observations do not fill the missing
containment proof.

At the epoch 1 stop, the owner was unavailable for the proposed local-socket
exception and extra attempt, so no additional attempt was granted then.
That epoch closed at `2026-11-03T08:02:00Z`; its native calls remain charged
and Target cleanup is UNKNOWN. The new grant does not refund the prior
charges or establish the responsible rule. The sections below preserve the
results and hashes of each historical epoch; their time-specific status is
not the current authority.

### Post-execution oracle remediation

The independent Sol [compliance review](reviews/official-sdk-offline-compliance.md)
failed on `fd467b0b34ff01d6e82fab096fd0d32fc24d68e8`. In addition to the
unmet execution gate, it identified three source-oracle defects. The original
review body is preserved verbatim; its SHA-256 is
`3005576adea736bbf909f9f45f266e3b3aca766d63afb8660a09256e24bdd92f`.
The review record's timestamp is when it was recorded; the review's exact
completion time was not supplied.

The independent Sol re-review of
`b5c68eba7a416fdec707916d600fbaeb4c48d144` also returned **FAIL** because
the actual contained SDK journey and controls remain unexecuted. It found the
three original source findings resolved in code and found no additional
high- or medium-confidence introduced defect in the bounded remediation diff.
This is not a source-only PASS or SDK acceptance. The re-review body is
preserved verbatim with SHA-256
`cf560b6848112387f05ca1b609178fa8d8a31b350b7b9f6d7430b2c6b7a946d9`;
its timestamp is the record time, not an asserted review completion time.

The source `13fd5dd` was changed **after** the epoch 1 native execution. It
records request admission before waiting for a sink response, compares the
complete tagged SDK result for each operation separately from HTTP responses,
and checks independent paint and application observations on response errors.
The source `13fd5dd` was not executed natively in that epoch. Those native
observations belong to `a98eefa`; the later repair-epoch observations are
recorded above. The source checks do not establish checkpoint acceptance.

The final helper SHA-256 is
`245a256923835b3c5e91d57fb0e1391e8fd136c9d4eee1687107bae3cbb96373`;
the final test SHA-256 is
`aa63082224d3f382745d37af63572edf202ff4e887b991f43f832384532e80b0`.
With both offline and both historical opt-ins unset, the final synthetic
selection passed 20 tests and skipped 2; targeted lint passed. The red
assertions and subsequent green tests use supplied records and a deferred
synthetic sink, not the SDK or a browser. Evidence is in session
`203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/`:

| Evidence | SHA-256 |
|---|---|
| `oracle-ordering-red-hashes.txt` | `ceaf368757fc5911e40e7432c2900e08ebb0570e1d489e92f14ec2831747ff55` |
| `oracle-ordering-red.log` | `ea2bcf129aa777798caff5bc19e57814379b0eee3adb2df5d5ecfa833bcd55c0` |
| `oracle-ordering-green.log` | `029c3102d637db5f91742646b565250fe78a3965bbbe9f66cacc87199e2344c9` |
| `oracle-sdk-results-red-hashes.txt` | `813e66ef08b335ad9437f3681c08b0536657430d6aef77874d524f5e636fe07e` |
| `oracle-sdk-results-red.log` | `358f064ec1e8bbdbd0024ab8b473e931836c1175c477ef88d761ba7b5210beda` |
| `oracle-sdk-results-green.log` | `ce5d09fd42eec9d6b358bbd071d3236b264f88b1e546433e25af9a5748474d75` |
| `oracle-error-paint-red-hashes.txt` | `8c8c6686c4b26661d43a3920e863da9701287325edc0714676a220d68d91dfa4` |
| `oracle-error-paint-red.log` | `1c44cada9898974e6f13e5aecaf0cadb3572cd7273efc676878c2479cbed06fe` |
| `oracle-error-paint-green.log` | `8a575397dcc9bb9634441d5eca5bb08da68d0fcfe0dca5909155f188604e39e9` |
| `oracle-remediation-final-nonvendor.log` | `2c6bf6adc8d70819984343e62263c1df4dd8c6006e6a23ec53bacb0e9e8a6877` |

The coordinator separately validated source `13fd5dd` at `b5c68eba`, with all
four offline and historical opt-ins unset. The official-helper, stock-site,
chamber and frozen-contract selection passed 235 tests with 2 skipped across
4 files. Both changed JavaScript files passed ESLint. The coordinator's
`offline-oracle-fixes-coordinator-validation.log` SHA-256 is
`08f20657fa392be3491cb081734a59c23c12cf0b3003230fcd944be50430a953`.
A separate four-file existing-source/default-Alloy selection passed 106 tests;
`offline-existing-alloy-source-regression.log` SHA-256 is
`2cff67e8ff9483f504be0a81891280cf460ce1fd6feec1ee9cee94d86fa730a4`.
Both logs are in session `4b3fc3b8-0059-4963-92b3-d96528eef1c6/files/`.
These source and compatibility checks do not establish an R1 re-review,
official SDK execution, containment or any lifecycle transition.

## Historical epoch: initial containment stop

**Outcome at that time:** BLOCKED before containment tripwires or vendor execution.

**Source baseline:** `ab021b434864fea1abf823c7d449696a4b58cd4b`

The required clean HEAD was verified before work. No implementation candidate
was created. The reviewed contract requires an external-egress boundary for
Node, browser pages, classic workers, and browser-created targets before vendor
evaluation. I could not establish that boundary using the existing browser and
test facilities. The contract says to stop if adequate containment needs a new
platform, and explicitly says page routing or worker shims alone are insufficient.
I did not add an infrastructure platform or try vendor code.

The existing stock test routes page requests in
`test/adobe-stock-site.test.js:36-53`. The loopback recorder test uses Chromium
background-networking switches and blocks service workers in
`test/adobe-stock-wire-recorder.test.js:749-753`. The recorder itself describes
its scope as passive page observation in
`probes/adobe-compatibility/stock-wire-recorder.mjs:1`. These facilities do not
establish the required Node and browser-created-target network denial. The
supervised operator's Chromium sandbox and service-worker setting
(`probes/adobe-compatibility/supervised-journey-operator.mjs:980-999`) are not
evidence of the specified loopback-only boundary either. `/usr/bin/sandbox-exec`
exists on this host, but its presence is not proof of such a boundary and it was
not used as a substitute for the permitted existing browser/test facilities.
This is a readiness blocker, not a finding that containment is impossible.

### Input checks

The read-only handoff's `provenance.json` has SHA-256
`25e8baeee5b9f65e10b757ee3c5aea4059bb4502888a5d2debc108e48f6f3c48`.
Its source and license assertions remain coordinator-supplied. I independently
hashed the supplied files and computed the two reference Git blob identities:

| Input | Bytes | SHA-256 | Git blob SHA-1 |
|---|---:|---|---|
| Alloy 2.31.1 | 152336 | `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8` | Not checked |
| `aem-martech` index | 32421 | `e26eeb5ff4b54355e7170c4d7556bfc5d6198a2bbbf32525b62301367c2a032f` | `90f01c57db6569b815ccbb7f9b10e07835b41a02` |
| Reference ACDL | 6281 | `c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c` | `189d841faa0d4e99fa61f9c2c13f9bd998ac47fe` |

No asset was served, so served-byte equality and final-byte checks for the two
arms are unproved. The reference ACDL was not replaced with the different npm
distribution. No supplier bytes were committed.

### Roster and evidence

All case arms are **unexecuted**, with zero contexts and zero SDK or fence
attempts consumed:

| Case | Unexecuted contexts |
|---|---:|
| Positive sensitivity | 2 |
| No consent | 2 |
| No offer | 2 |
| Non-render | 2 |
| Rejected response | 2 |
| Malformed response | 2 |
| Untrusted interaction | 2 |
| Endpoint and tenant fences | 2 |
| Payload fence | 1 |

The browser, worker and Node pre-vendor containment attempts were also not
run. No SDK, browser, worker, sink, listener, or server was started in this
checkpoint, so there were no owned runtime resources to tear down. No offline
dispatch, render, click, byte join, sensitivity, or absence assertion was
observed. There are no red/green test logs: no behavioral test or source change
was written after the blocker was identified.

The contract SHA-256 is
`ac49a44d65d35aa985f5e14f362d15b12aaea2af20d1fae43b311659d7768e66`.
The recorded frame review SHA-256 is
`3b4e8075dbe49c875a9117d284e0d0f5c035333dd233c220f3d423b7d3eef573`.
Those hashes identify the framing and do not imply an execution pass.
The clean source baseline test hashes are:

- `test/adobe-stock-site.test.js`: `bf4f20d7ee48d2fb9a3f08eae2ee5e317944d5153f2a3bed7efb9067fa7b0298`
- `test/adobe-chamber-journey.test.js`: `cfeb50c99eccb719126c4bf652c0594dd41c6718ce8d08e567c0641d0518ff8e`
- `test/adobe-stock-wire-recorder.test.js`: `94fbe86ec8f072c0845ad7287e99bd2b7bca4c0b49ef2037a03faa8295317d4e`

Conservative wall accounting started at `2026-11-03T04:02:00Z`. The stop
decision was recorded at `2026-11-03T04:19:17Z`, approximately 17 minutes
17 seconds later. The separate four-hour cap was not exhausted; prior
spending and reservations remain charged. Target cleanup remains UNKNOWN.

**Unproved claims:** official SDK execution in either arm, live Adobe
acceptance, deployed EDS adoption, downstream receipt, full SDK compatibility,
and release readiness. The slice and spec remain IN_PROGRESS; this outcome does
not reopen live admission or historical retries.

## Historical epoch: resumption after the native-facility frame

The reviewed parent `e70324c929df5a80290112016af240dd4c1f0542` was merged
without changing its tree. The resulting source baseline was
`c3b0718a463ce631e29690dc2631a237b26cf7c3`. The native-facility frame is a
framing pass, not containment evidence.

**Outcome at that time: INCOMPLETE, not an execution pass.** I implemented only
explicit byte-pin checks and an unchanged-body original/admission/receipt join,
at candidate `1276697ed2c61a90ceb736d74c2ca9e961468fd5`. The join is not a
complete wire oracle: it rejects changed bodies and therefore cannot qualify
the payload-strip control. The full fixed runner, case fixture, native
confinement policy, descriptor custody, tripwires, response joins, render and
interaction observations are not implemented. I could not establish the
required containment boundary or complete the runner in this resumption, so I
did not risk a vendor load. No claim is made that the reviewed native facility
is impossible to use.

I verified the three supplied files again through an explicit input directory
and their exact byte and blob pins. This did not verify bytes served in either
arm. No fixture or inventory was frozen, and no sandbox invocation, pre-vendor
tripwire, official SDK case or fence attempt was executed in this resumption.
The roster remains 0 of 17 contexts and 0 of 49 SDK/fence attempts; every case
in the table above is unexecuted. No checkpoint browser, worker or sink was
started. The existing stock-site regression suite did start and close its own
non-vendor Chromium contexts using its established stub integration. It is not
a roster attempt or containment proof.

The focused regression run passed 4 files and 214 tests, including the 3 new
non-vendor checks; targeted ESLint passed. Both witnessed red runs failed on
behavioral assertions, then passed after implementation. The session evidence
files and SHA-256 values are:

| File in session `files/` | SHA-256 |
|---|---|
| `offline-red.log` | `da44e203f43e5a0135304ea0563ed4715d50998db32a7b91ee263aa2e5e92e50` |
| `offline-green.log` | `4511ddfd54d0c717d772f8629c89d174bb78d9aba33ed21acee1b0d679a278cf` |
| `offline-red-source-hashes.txt` | `922e725a1d47699bcc37a7a777a522aa33a624f466394c32549d784f1757b794` |
| `offline-input-red.log` | `84b6d47f0ac10a910702e92eeb56fad803686eef6a4adda2e3e5dabd580eb9ed` |
| `offline-input-green.log` | `eb5d55b2d5fb278140af41ede78e2653692d3e776551350fb8098cb5d236ca6d` |
| `offline-input-red-source-hashes.txt` | `68f4d0ee3252e109f2aee56050061943cdbd3cf976b9794d99f5f7ccea38e46f` |
| `offline-current-tests.log` | `2426d5da95030310b05550f81340872d7e41f6ad0302a3541121affb1ba4f7a0` |

Candidate test SHA-256:
`f352cd15fbad126f8b7278a07b2cd8d9a59b772d04e67e98d9fb4b80b39adb2d`.
Candidate helper SHA-256:
`eef4e49e93219858bc482448e55c818d7b9c43a9f088542f69cffc711c4dbd55`.
The hash lists preserve the exact pre-fix test and helper for each red run.
This source candidate is partial and is not ready for checkpoint acceptance or
the later independent implementation reviews.

Conservative wall accounting from `2026-11-03T04:02:00Z` reached approximately
34 minutes at `2026-11-03T04:36:00Z`. Prior spending remains charged, Target
cleanup remains UNKNOWN, and no live or historical retry authority is implied.

## Historical epoch: native policy rejected

**Outcome: BLOCKED before the confined child started.** The source candidate
was committed as `2b4195a17163fac0e312ae02c6034dac19f2d9a1`. This epoch
supersedes the preceding partial implementation status, not its historical
record. The current contract SHA-256 is
`f9259be8da90a718bc36c2131fe4bf4187764b24d0a956648ec58c4a0e84d38f`.

The one fixed native invocation exited 65. Its stderr was:

```text
sandbox-exec: host must be * or localhost in network address

Backtrace:
<input string>:4:22:
    (local tcp4 "127.0.0.1:43187")
```

The policy was rejected at parsing, before the confined Node child emitted any
output. The control input reported `EPIPE` after the sandbox process exited.
The invocation did not time out or exceed the output limit; no orphaned
descendants were observed and its owned process group was clean. No checkpoint
server, browser, worker or listener started, so no such resource needed
teardown. This result is an incompatibility of the executed policy as written,
not proof that the native facility or another policy cannot work. The
contract's one-alternative stop rule prevents another attempt here.

The local asset and sink receipt were **not** proved. Node, browser and worker
tripwires were all **unexecuted**, and no external-egress claim is made. Every
case arm in the roster above remains **unexecuted**: 0 of 17 contexts and
0 of 49 SDK/fence attempts consumed, with no case passed. No supplier asset was
served to either arm and no official SDK was evaluated. The output fixture
and compiled chamber bundles were prepared and hashed before the native
invocation; those hashes are not served-byte evidence.

The source candidate contains the fixed invocation, inventory and roster,
non-vendor observation machinery, and directly coupled fixed-profile evidence
changes. Its frozen fixture SHA-256 is
`8037d079051130da29891ab16655699f13ac8cc6de57ae26c50f7bcb5f12e133`;
the exact inline policy SHA-256 is
`c81cd1b7f87e2b77395b22f8a9e63bea52e6dcd2618d30faf93a7cb26dc6c4cc`.
The fixed window is `2026-11-03T04:02:00Z` through
`2026-11-03T08:02:00Z`. The actual invocation was recorded before launch.
The supplier files were independently rehashed to the input values above; the
handoff provenance file remains coordinator-supplied. Its SHA-256 is
`25e8baeee5b9f65e10b757ee3c5aea4059bb4502888a5d2debc108e48f6f3c48`.

| Candidate source | SHA-256 |
|---|---|
| `test/helpers/adobe-official-sdk-journey.js` | `8835c1adfe3fe73b005e03279aae0b691bde23a04ba63bb128847b0395416d83` |
| `test/adobe-official-sdk-journey.test.js` | `64442eff9e45037993bb2b12dfc055535a4290e3bb187960cbcfa09019ed5987` |
| `test/adobe-chamber-journey.test.js` | `d2d09c003dbd448a105865919a32bbc4f78128b93d0225e1cc955314449c067a` |
| `probes/adobe-compatibility/chamber-journey-host.mjs` | `f6f74a10e28a1d41c7e5ca9b6148edd6d86e1ec54222bc4133d3c68620d54139` |
| `probes/adobe-compatibility/chamber-journey-worker.mjs` | `da4cda03ee4f763acf123074ee24bc616094efa1c09ead62e78ea89477b0c994` |
| `connectors/alloy/alloy-chamber.worker.js` | `6ced788f1cc914bc6594c0b659b5a94e021bd6431a3cddb605b954207664715d` |

Targeted lint passed. The focused non-vendor suite passed 4 files and 223 tests,
with the actual checkpoint and synthetic observer tests skipped. A separate
synthetic observer test passed. The selected checkpoint test failed on the
native exit code and was not a passing SDK test. Red/green logs and the
pre-fix source hash lists are retained in the session `files/` directory:

| Evidence | Red SHA-256 | Green SHA-256 | Pre-fix hash-list SHA-256 |
|---|---|---|---|
| `offline-policy` | `325f4f05144f546479027d30af36ed4cfe206d4adcba69af121529c3cd06d85b` | `50f5b48ad3735515ffe23cbc6d86dcaa45f58e3003e2945c9135fcd79fc1ab05` | `2e94affa057786acec3e681164b8dc3a9ac13662c2023cd1ebf5ce0115fd9924` |
| `offline-payload` | `b742e7f8bea826aeee13035992bb037f78b5234cce9dbb56628c90b45c8a13cc` | `d367c448094119ef4ddefaf2ae3350c81f0f923786d52e5560ba37a646e09e78` | `dc0b5b5d650dec5ad6c81d48ad356dc6f138fbdb70125ab532cc30cd8a4889a6` |
| `offline-consent` | `7a53c633dd001c6afe8ffc93ab263c02c4c560999b907609283c0830b49b5952` | `177e377e5746468d56ab348270904c6bbd9c3297f4d58389a604ed67cd0a6525` | `d4713ff52d61d48490ee0dec2453c9fff376c7490224393a929c1f7bdfd2b4ef` |
| `offline-diagnostic` | `2d1f95aa350f7985f1eb60dbe115ddbc32a9d808dabda944535017726d69ef3b` | `196baf6edca4768b6ba196b0c4b779de4e6c6e306dab3d3e5bd59d6d61d0aee0` | `7a5062b3e02b153dce70a2d50bee407387c68691af5b95d0fb711461582bbcd4` |
| `offline-beacon` | `c169b2598165ed21430c6eb60c98bf28d659eb7ba86d56cc56877adac9d47377` | `d68b523bedd9fa888736c749d38fc98501d22822f217a95a0aa3bd8c7f877b3e` | `18bef1d2bc411361702431be9db5483a89c25bcdcfc77936fd502aba8529dae5` |
| `offline-json` | `9fc9fe4e620a21fa1fb4df07fda9b87c6a49ca565f6773701eba16a9145c75c1` | `2db41756dca6b2387a07c19d404397f6a491378bdc9fd9694fd8f4a98f151d7c` | `afa36241868395dab8dbb1226c7e3682aa608320ea00ebb7d37ce6a5017c52e2` |

The red and green files use the suffixes `-red.log` and `-green.log`.
Pre-fix lists use `-red-hashes.txt`, except
`offline-policy-red-source-hashes.txt`. Earlier red/green evidence remains in
the preceding epoch.

| Additional session artifact | SHA-256 |
|---|---|
| `official-sdk-native-invocation.json` | `14a6e5fffc6b67beaf5c845e38e7aa84e8de0a97da9df55f872bfb995c604b70` |
| `official-sdk-execution.json` | `c69019ce0b48f8fdb54da44ab542de4f6554017fdb259c41650b8970b8075e25` |
| `official-sdk-checkpoint.log` | `e71b7f295966a7abe481ad39d81dfa5d553c8ccafa7a3f517cf2ac7b59bd5fc7` |
| `offline-final-focused.log` | `2a1a9ee7afb7e052a851393c5bd3b02edfc3d6e97952e430515d6fbd0f321cdb` |
| `offline-observer-green.log` | `9598429733f585bd07795c0c693a968c259975420c9c390e90fa67f10bbc8ca4` |

The execution artifact contains the frozen asset, executable and dependency
hashes, stdout, stderr and process-group result. Conservative wall accounting
reached approximately 1 hour 12 minutes at `2026-11-03T05:14:27Z`; prior
spending remains charged and Target cleanup remains UNKNOWN. Official SDK
execution, governed dispatch, render and interaction, live Adobe acceptance,
deployed EDS adoption, downstream receipt, full SDK compatibility and release
readiness remain unproved. The slice and spec remain IN_PROGRESS.

## Historical epoch: reviewed syntax correction and browser launch

**Outcome: BLOCKED before browser and worker tripwires or SDK evaluation.**
The clean reviewed amendment `16830d7618a49a46c979c5d1086d8aa13115b35c`
was fast-forwarded into this worktree. The corrected source candidate is
`a98eefa73cf82217196645334faad393e427a5d6`. The previous rejected-policy
epoch remains above and its native invocation remains consumed.

The only policy host spelling change was `127.0.0.1` to `localhost` in the
three fixed TCP4 rules for port 43187. No process allowlist, port or protocol
was widened. The corrected inline policy SHA-256 is
`89344a36ce60d2fafab296671d494d7a54084868ed82d80bba20346eec66f1c4`.
Its exact contents, fixed commands, input inventory, executable hashes and
previous-attempt references were frozen before execution. The original source
and test hashes and the behavioral red and green syntax assertions are
preserved below. Compiler acceptance does not prove what `localhost` matches or
establish containment.

The one permitted compile-only invocation ran the already allowed Node binary
with literal arguments `-e`, `process.exit(0)` under that exact policy. It
exited 0 with empty stdout and stderr, no observed orphaned descendants and a
clean owned process group. Its Node SHA-256 was
`a45751fbfe88440bebff63cd44814e4ed6deb642bc3e3c4a14c4f8ae0ed9e019`.
This proves only syntax and process entry.

The one permitted corrected checkpoint invocation then entered Node. Its
initial descriptor snapshot recorded named standard I/O at 0-2 and no
IPv4, IPv6, Unix or system descriptors above 2; the remaining observed
descriptors were pipes, queues and a character device. The
confined Node process received a 27-byte local sink marker and its 88-byte
local test page matched the frozen asset hash. Its single forbidden Node
connection returned `EPERM`.

Chromium launched but exited 21 before a browser context was created. The
launcher's error reports `Failed to bind()` its profile `SingletonSocket` with
`Operation not permitted (1)`, followed by failure to create a
`ProcessSingleton`. Playwright also reported `kill EPERM`, then observed the
process exit and reported temporary-directory cleanup. The checkpoint process
returned its BLOCKED witness with exit 0; its owned process group was observed
clean and no orphaned descendants were observed. The local server closed; no
browser context or worker was started. The socket failure occurred under the
corrected policy, but this record does not assign it to a particular sandbox
rule. No policy change or second launch was attempted in that epoch.

The Node tripwire consumed 1 of the 3 separately bounded tripwires. Browser
and worker tripwires were unexecuted at that stop. All 17 case arms were
unexecuted: 0 of 17 contexts and 0 of 49 SDK/fence attempts, none passed. No supplier
asset was served to either arm and no official SDK was evaluated. The fixed
Node local receipt is not an SDK dispatch. Descendant and all-network-class
containment, including the semantic scope of `localhost`, remain unproved.
The historical coordinator `/usr/bin/true` probe, original exit-65 invocation,
new compile-only command and new checkpoint invocation are all charged; no
clock or roster was reset.

Targeted lint passed. The focused non-vendor suite passed 4 files and 223
tests, with 2 skipped. The selected checkpoint test failed on the actual
BLOCKED witness. All paths below are in session
`203fccd8-9c78-4ed0-ab75-1b28ab06f998/files/`:

| Evidence | SHA-256 |
|---|---|
| `offline-syntax-red-source-hashes.txt` | `0218c9473446d241ddd7e4c9fc46e253414f43379c6077948119682fb1a70423` |
| `offline-syntax-red.log` | `24fe0bc7f3210ac1d65b6f4eecf6a52a6bd54109ef260572e3aca0688efaf70e` |
| `offline-syntax-green.log` | `e51ff29f7e945184b6968cdd552f3d88ff594f43e9f1a6857a5f7c4174351ee1` |
| `offline-syntax-final-focused.log` | `8582aa7bea195ab4082f64faf6b17b08b2471483d23961d039506a6ce9b49ab7` |
| `official-sdk-native-correction-02.json` | `8da0cf94469b296a2db33a715a7f4e9a630347dde96c046e8d11577b207b4148` |
| `official-sdk-native-correction-02-compile.json` | `fc02212da904e5cb5f0cabc0656694387369c9c431b8ab7f40dfd0b2386ba989` |
| `official-sdk-native-correction-02-checkpoint.json` | `184e47dacc0f78001bb6277208cbe88ca29e148e2958b390da260153e0b0b525` |
| `official-sdk-execution-02.json` | `465a60b309ed01b5f4a536ca006fa935afb104080c5dc8858bcc3514d71f5835` |
| `official-sdk-correction-02.log` | `beb7e69200b5e0d82ad4c579f5f315fa87324f144435970fdfe2176172078211` |

Candidate helper SHA-256:
`b7cd1675fdae6fecb35b50fc372613fb5b6f0bc70b8c9828bc9b94a42e6034d9`;
candidate test SHA-256:
`9417f4548937e0ca1a2d933ff9b20db23dcc74aae2db5d1c3cf7a507f79b538c`;
fixture SHA-256 remains
`8037d079051130da29891ab16655699f13ac8cc6de57ae26c50f7bcb5f12e133`.
The original supplied asset bytes and Git blob identities were reverified,
but their served-byte provenance remains unproved. The complete process
output, descriptors, local receipt and case states are in the execution
artifact. Conservative wall accounting reached approximately 1 hour 26
minutes at `2026-11-03T05:27:46Z`. Prior spending remains charged, Target
cleanup remains UNKNOWN, and all live, downstream and release claims remain
unproved. The slice and spec remain IN_PROGRESS.

## Historical blocked checkpoint documentation

### Deviation log

This log covers the blocked offline checkpoint only. The source candidate adds
a fixed test harness and fixture, plus probe-specific consent-result,
diagnostic and withheld-beacon observations. These observations do not replace
SDK results or permit ambient egress. The default connector path and frozen
core were not changed.

The first native policy failed to parse before Node started. The reviewed
correction changed the fixed host spelling and added one compile-only control
before one further checkpoint invocation. Chromium then failed to start under
that policy. The mandatory stock/chamber sequence and controls did not run, so
checkpoint acceptance is incomplete. The earlier C FAIL and the R1 source-only
boundary remain in place; neither is converted into official SDK evidence.
Historical retry and new live-run admission remain withdrawn.
After the failed compliance review, the three identified oracle defects were
remediated in the source candidate with synthetic regressions. This did not
change the policy or remedy the observed Chromium blocker. The independent
re-review found ordering, complete SDK-result comparison and error-path
render observation resolved in source. Actual acceptance remains unmet.

### Reconciliation sweep

These are dispositions for documenting the blocked checkpoint, not a
`RECONCILED` or `DONE` transition:

| Surface | Disposition |
|---|---|
| Offline witness | Updated with the current stop, historical epochs, independent FAILs and source-finding dispositions. |
| Probe README | Updated with the blocked state and re-review outcome; the safe selection is limited to the synthetic oracle test. |
| Architecture | No change for this blocked milestone. The bounded observation additions do not establish a new product capability or module boundary; independent architecture review remains required. |
| Spec and slice status | No transition. Both remain IN_PROGRESS and acceptance remains open. |
| Release | No promotion. Live Adobe, deployed EDS, downstream receipt and full SDK compatibility remain unproved. |
| Frozen core, defaults, conventions and ADRs | No change. |

The independent Sol compliance reviews of `fd467b0` and `b5c68eba` failed.
Craft and required architecture reviews have not been performed because the
compliance gate failed. Code-health and design reviews are not required
according to the coordinator's helper results; targeted lint and unit tests
are not independent review passes. The independent
[reconciliation review](reviews/official-sdk-offline-reconciliation.md)
passed for blocked-record faithfulness on `b5b1fa3bedbf6bcd98daa0b29b2fc20beff29dc5`.
It does not clear compliance or implementation acceptance, establish SDK or
containment behavior, transition the slice to RECONCILED or DONE, or itself
authorize further execution.

The coordinator independently ran the four-file non-vendor selection at
`a98eefa73cf82217196645334faad393e427a5d6`, with both offline opt-ins and both
historical opt-ins unset: 223 passed and 2 skipped. The coordinator's
`offline-final-nonvendor-validation.log` SHA-256 is
`b08dd760cd58be8fe66636304f0bbb54fed0eb5593bdcad4a6186f01d42802b0`.
That validation does not qualify the official SDK checkpoint.
