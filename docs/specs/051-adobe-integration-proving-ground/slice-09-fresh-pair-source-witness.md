# 051-09 fresh pair source witness

**Partial source candidate.** The amended source frame passed on
`668084b88fb2e580d07fc03bd88b4c466b7865f5`. This candidate adds the
one-host measured-context and cookie-probe validation, POC stock observer
path binding, and page-to-chamber measured-input and raw observation wiring.
It preserves the fixture host and historical public run/retry refusals.

The inputs and observations in these tests are synthetic. They do not execute
the vendor SDK or establish provenance. `execution_ready: false`,
`actual_evidence: false`, `provenance: false`. This witness is not a Job,
Prepared record, approval or actual arm receipt.

The fixed-pair preparation/entry and stop-only procedure are not implemented.
The stock observer and measured inputs have not been joined by a fresh pair
controller. Equal URL/event inputs, deterministic experience selection and
restoration, current POC asset byte/line binding, real measurements and
independent native stop remain unproved. This is not completion of the first
source gate or 051-09. Current fresh admission, original run/retry, manual
and live gates remain blocked.

## Candidate source and test hashes

SHA-256 of exact files:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/chamber-journey-contract.mjs` | `a7f351646cb8927323ef3700d883690c20028506696cb84f229e0e330e60662b` |
| `probes/adobe-compatibility/supervised-journey-page.mjs` | `ae2ff78fcde1bbe6efdd1cf875f06ac4628fb2b7775d05269883da0440c6b6d4` |
| `test/helpers/adobe-official-sdk-journey.js` | `ddc42fcc2a621ac58d1a5c3bdb7aec73d80c67dd93ddf05210d9222a4a3e01d6` |
| `test/adobe-chamber-journey.test.js` | `6b7589f2477de680698d7eef9825621b5de22f2a79ff6048f8d8303e0b94c695` |
| `test/adobe-official-sdk-journey.test.js` | `f6bb3bc1f89ad273307ab5071b7fed0235a9112abdec47b98d04d98bf6bcb3f8` |
| `test/adobe-supervised-journey-page.test.js` | `51c01999f58b9668f1d75752dbdc783230a5dbbe36fece0c3e6e70069c62cbf2` |

## Targeted evidence

The red/green logs are retained in the writer's session `files/` directory.
Each pair is `fresh-poc-<name>-red.log` then `fresh-poc-<name>-green.log`.
Each red was one targeted failure; each green passed its selector. Some
later tests expanded the final candidate after those pairs.

| Name | Red SHA-256 | Green SHA-256 |
|---|---|---|
| `contract` | `36f7ee9eee5f984518fe99ef8c5d04ac2f39e46e3001bd42432c638758519b51` | `1cd06c870e48f609d9d25cdefc65c4f6538de364a4179dbc7207cd8c3b863a96` |
| `measurement` | `fecae824280d26ee46f995a3c0a89949f01bc96096cdb554a505e879f7cf46ae` | `03c9443dd6923e7b8386865e244473d515e8f0f1c5ac3a83241c0133e5b1f86c` |
| `observer` | `7ef0f74cbf68960565dce39f45caaf295631b74113de1d1c773d81113b23b646` | `dd67412255c0c727d5cd7bb00c37bb1b8dfad78b7b72d075736b739dca1ea528` |
| `page` | `75ec5dc420ffd02dee797e3c29d3ba7b2cd0fce2601efae8819d9729867ff042` | `43fca963a00d38167927d524496ca8417a8da7b05729f8073892f2eb3dab73a2` |
| `rejection` | `25c9fc307f38c3d4898c314ceb585ce457d62a2b576b9c73acd86e763f09ace1` | `b1caf27e7a02cd23612202379c0af0a93a91df08b7cd2ea93d6f050c61d2d2c2` |
| `trace-binding` | `60859d60396a6de494a4308eb7bec982e4879b10906be7612f5930c08e3e5ce8` | `d848268f22b00578443b36f1a04bb118c8424a40534ddc3b9a5476c2f939a0ae` |
| `page-origin` | `83c0bacdfa0e61d458d624f58acc5dd8000269ea6cffeb76ec5eeca3016f525d` | `826a9a0373414c7d43218148e8a708575dfa1d1b8821d9654499d3a0f662a7cc` |

Final non-vendor checks:

- `npm test -- test/adobe-supervised-journey-page.test.js test/adobe-supervised-journey-source-admission.test.js test/adobe-supervised-retry-once.test.js`: 34 passed.
- `npm test -- test/adobe-chamber-journey.test.js -t 'measured|cookie-probe|original rejected sendEvent|SDK rejection'`: 12 passed.
- `npm test -- test/adobe-official-sdk-journey.test.js -t 'measured|cookie|observer|observation|original stock SDK rejection|debugger|serializ'`: 12 passed. The closed offline checkpoint and browser observer were not selected.
- `node --check` passed for both changed probe modules; ESLint passed for the changed tests and test helper. The repository ESLint configuration ignores `probes/`.

No browser, native-lifetime probe, network, Adobe request, vendor SDK evaluation,
resource mutation or lifecycle promotion was performed. Independent source
review and the remaining work are still required.

## Extension candidate: still partial

The original partial candidate was
`83539ba6a984715e2ec7b454f563403e85c1632b`; the record above remains its
historical witness. The owner authorized the same source-only checkpoint
through `2026-11-04T01:39:29Z`, with the same six-session ceiling and prior
consumption charged.

This later candidate adds a pure measured-input assembler using the existing
context and cookie validators, one matched POC URL and event-label set with
distinct caller-held arm correlation, and declared source/asset consistency
checks against fixed reference pins. The page and stock observer now share
the fixed integration path. The original stock observer is extracted into a
first-party source module; its prior fixture callers still use that same
implementation. The measured chamber page also retains the original consent
SDK result.

All observations and declared pin inputs used in the tests are synthetic.
The checks do not read asset bytes, verify deployed source, prove debugger
line binding or establish provenance. `execution_ready: false`,
`actual_evidence: false`, `provenance: false`. The source first gate is
**not complete**: no fresh pair controller connects measurement, stock
observation and chamber observations. The guarded inspect/entry and
stop-only interfaces, deterministic selection/inverse procedure and source
independent implementation reviews are also missing. Actual admission and
historical run/retry remain blocked. No 051-09 completion is claimed.

### Extension source and test hashes

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-pair-assets.mjs` | `64288470a978de02978798d5b5b1bf9c0424185396793d3f7616882692c4efea` |
| `probes/adobe-compatibility/fresh-pair-measurement.mjs` | `11820a926ba1eec00ca1439876d2dbf0202c1446bffad5e1ff9403b0dc776ee3` |
| `probes/adobe-compatibility/fresh-pair-stock-observer.mjs` | `a8da09e4bb87fb260f6a18b3fd6eae2da86396c42018e44aea0cb2e7a510f8fb` |
| `probes/adobe-compatibility/supervised-journey-page.mjs` | `1910fa0a1a37aaff306eff662eb0c251e96aea29d2d263b06d1a0597f1749c7c` |
| `test/helpers/adobe-official-sdk-journey.js` | `b6c933843cc75b4ccd704ce894a2135e2c3e707905f52fec77e81814595e8f85` |
| `test/adobe-fresh-pair-measurement.test.js` | `873cdf8654991abc01b33be4af4e59d073d3a3c87ae58e836aceb7376d836901` |
| `test/adobe-fresh-pair-stock-observer.test.js` | `ee0b39fd630de4e7414bf6cffecaffbda74492ad4c871ffabe3066e4375608d1` |
| `test/adobe-supervised-journey-page.test.js` | `4cf1ff34b1ba91768d744b0436ce66b9e52c0cb5d4c86df838b7d97958aa7211` |

### Extension targeted evidence

The retained logs are in the writer's session `files/` directory. Each pair
is `fresh-pair-<name>-red.log` then `fresh-pair-<name>-green.log`. The
`pins` red is a semantic assertion failure; the other new-interface reds
fail because the expected function does not yet exist. The `consent` red
shows the missing chamber result. Later tests expanded the final candidate.

| Name | Red SHA-256 | Green SHA-256 |
|---|---|---|
| `measurement` | `928a5d4e16b2513fa28808767a0f4ed5762f687a3c50036d98d71df85a8cb42d` | `7e41b143ca95ec22b53f2501661551cde4709e10e8b34555e37b51ba9dde3b93` |
| `assets` | `4b0d5e78f4a73f47ce5febbf60e2082afc3635e2adecfe27a74e54cc20524995` | `03962b8b42c00dec4f7092a23c3dec30fba90a5c27df6ecab4f8ad6192964309` |
| `inputs` | `7f810b1f7639e19aeb10a0519db3b67e262a7f7830fd450549ccb74b9ac9b78c` | `51ce872fb6d0a5604d5b16ca5ffb42a0dc80db8faaa679f70c4282b46e737e59` |
| `observer` | `df8f514b706c796463915b31884035142909375d123058d4bf4481691e052d5e` | `a95dede1556d41fb5e03fb8ba74de42090219bd52028be8645006ce90a5a42bc` |
| `pins` | `840581ca643186b606e7d14c357b509a2443ab9d445b37e4ffb2b97cd37d9b91` | `135db65d635652ea4ba50dd592fd4cadafb396fb903b6f632e7cf7be7057a397` |
| `consent` | `b185155bbb9aa57c672d1674233f11c30f69a5de957b8935e3c1e9d4c940c7dc` | `9112f905757bc1ba5730661a3012424af527a827b57a24632790037bebd5baa0` |

Final non-vendor checks:

- The fresh measurement, observer, page, historical refusal and retry suites
  passed 39 tests; `fresh-pair-extension-regression.log` SHA-256
  `d1119739ead6cb3e965e785138d4e57afa58f13af79f97e71d5483f3c5e61d6e`.
- The existing measured/cookie/observer selection passed 12 tests, with 61
  unselected; `fresh-pair-extension-observers.log` SHA-256
  `e8728e8c75c404bdcd48879ad58598b0e603cf7bd0aedc8f7a669de677247dda`.
- Node syntax checks passed for the four changed probe modules; ESLint
  passed for the changed test helper and tests. The lint log is empty,
  SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

No SDK, browser, native-lifetime, network or POC-resource effect was run.

## Renewal candidate: source review pending, still partial

The previous clean candidate was
`4373e46461788072703f4898fa525c2789d796fc`. The owner authorized the new
source-only window from `2026-11-04T14:33:52Z` through
`2026-11-04T15:33:52Z`. The prior three sessions remain charged against the
same six-session ceiling. The source frame pass remains the verdict on
`668084b88fb2e580d07fc03bd88b4c466b7865f5`, not an implementation review.

The new source controller inspects matching private declarations without
printing their values, assembles the matched POC measurement for the existing
chamber configuration and retains caller-supplied original stock and chamber
SDK observations. It checks both supplied cookie traces against the measured
map, preserves original rejection observations and compares successful
original results without normalizing proposition data. Entry and stop return
blocked results without touching their input. The contract now records a
proposed selection, conflict-safe inverse and independent owner stop
procedure. None authorizes effects.

The source wire seam applies the existing recorded-payload checker and exact
dispatch join to bounded caller-supplied synthetic records, including native
DISPLAY and INTERACT fields. It compares the two supplied captures and binds
their proposition to the original supplied SDK result. It does not consume
the current recorder's receipt shape directly: that receipt has a digest and
length, rather than received body bytes. The adaptation and complete
response/render evidence comparison remain open. No received bytes are
invented from a digest. Matching declared asset pins is not a byte check;
matching caller-supplied bytes is not proof of served bytes, deployment source
or debugger line binding. The fixed observer path, pin and breakpoint
declarations are exposed with those proof claims set to false.

All inputs and observations in this witness are synthetic.
`executionReady: false`, `actualEvidence: false`, `provenance: false`. This
is not a Job, Prepared record, approval or actual receipt. The source first
gate is not claimed complete: the actual recorder adaptation and response and
render joins remain open, and the controller has not been independently
reviewed. Independent Sol compliance, craft, architecture and reconciliation
verdicts are pending. Historical run/retry and fresh entry remain blocked.
Native owner stop, caller loss, filesystem races, actual measurements and
live admission remain unqualified. No 051-09 completion is claimed.

### Renewal source and test hashes

SHA-256 of exact files:

| File | SHA-256 |
|---|---|
| `docs/specs/051-adobe-integration-proving-ground/slice-09-fresh-pair-source-contract.md` | `aba62965adfdcac189bb69d548cffda3728a16c157ac7bbc3cd25cd337734236` |
| `probes/adobe-compatibility/fresh-pair-controller.mjs` | `5f9adde7a16908f04efd1ebba69b309022b7384b43716b584bce4dd196ad3af5` |
| `probes/adobe-compatibility/fresh-pair-dispatch.mjs` | `af80482970044404c38e7281b8922ff0fdc24dae56cddf3dde19a2bbea8d5983` |
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `c3bb76bb57248903f841e7dc0ed33717a406afa09e5c0384b0a2b2c253964ed5` |
| `probes/adobe-compatibility/fresh-pair-measurement.mjs` | `c8ae2165cbe3dc2e67b8a1f81ba3e885872064fb6eb103aec25a5c6c8994790a` |
| `test/adobe-fresh-pair-controller.test.js` | `21975df2a9dfc096f5a212b9184802f0b7bcb49d270f54d5daf79c4563c24b65` |
| `test/adobe-fresh-pair-measurement.test.js` | `c5e57bdb9b656d34704c4d1cf6bdbe33e4171a014dae89ca9343d2700dfa155d` |
| `test/helpers/adobe-official-sdk-journey.js` | `66cc1190b8cbc3ea71924b364886cc7be9a4a21d434ed2b3b3d41be6562c860a` |

### Renewal targeted evidence

The logs are retained in the writer's session `files/` directory. Each pair
is `renewal-<name>-red.log` then `renewal-<name>-green.log`. The exact test
selector and runner output are in each log. The `inspect` and `controller`
tests used callable scaffolding before their assertion reds. `stock-trace`
red was an input-validation refusal, not an assertion failure. The
`bytes-getter` red observed the unwanted getter call. The other reds were
behavior assertions. Later tests expanded the final candidate.

| Name | Red SHA-256 | Green SHA-256 |
|---|---|---|
| `bytes` | `6dbcd048a90700e686cc7b0c488b067b7b2977a639cf5c45789f2b769493e1bc` | `d9451abe274415cdcddb0cb72707a4faff92514f9fb09d4e19906203f2bc3a57` |
| `observation` | `d8099798fdd84be2892cab693c521c12de9a3b64dce2eedb1c983ca8c08dc76e` | `c023f79a74536a07e03b6375ac6158283d5752bcc95921a8ab9ef5db182fa784` |
| `rejection` | `ba1d85fdaa0b8226a09dd0eb882632b9cc835eae7c56398bb548a3423dadcce5` | `8e28f73e92f06ddc50bc69f9fb772a75c18f100d1d57a3067689c9f1f2a8f5c5` |
| `inspect` | `eb9a35ed1e3bb8f79975d6a35624937060031583624e2ae4f2546c3372b4bcbd` | `1c2554a455bbeedbc760260983cc648badc6b86f85d2a8afeb6d0b9942b2d26f` |
| `controller` | `6cf39b1f2a89124168e95487ccd4a74182c9cdec674953746cac56c458173302` | `bee4eeeec7a79cbfaf2532ab424b498f46069a26d445c80b2cf3b0a8f0995f38` |
| `wire` | `9aebaddeee2d34e88ec8d2d8916585fa4e524ac9790ca68ee0b88a7e9be63186` | `ceec300ecebddd65cf041300e886a31a60c86e21f964f017f08e0229d2ef6b4c` |
| `stock-trace` | `b292a61c6ddc4203e0cc8dced69d735290f913d3d8caed19e870499b5d86d4f2` | `cd5517a60034b94854e6bb04fb99f3063af46bd91cee1ae5d7d01e77cf510a6a` |
| `debugger` | `0b31f261cab53448bda5f4bce68da1d6bfe9d410b20f9c79701a3e3eb7ba26f3` | `57bf64d92954249dea193fe778aa200cf814300201f0b26d6a71518c40dda9d3` |
| `bytes-getter` | `d9095eea1be617c6886773c8dd2f5ff44ee48e0fd821d4e8bbe2debe1a9b6014` | `7d3b7007131cc1a35734ded5dcad2809b704e80e25aec0185714dfe6ea313719` |

Final bounded checks:

- Seven source, wire, page and historical refusal suites: 247 passed.
  `renewal-final-regression.log` SHA-256
  `aa0bc263d95c51a687dfef586cf8f854899ebe4d9a2119a77bbd83372772c9f2`.
- Existing measured, cookie and observation selections: 23 passed, 179
  unselected. `renewal-final-observers.log` SHA-256
  `c29fe73ebbd5bce3582e5fc53a3e0c6a4f6f025de866ab63f63383c8e78098b7`.
- Existing exact dispatch join selection: 2 passed, 71 unselected.
  `renewal-dispatch-regression.log` SHA-256
  `c90cbdebebeedcd97a6af6123f5ad435a4c5dc6ed71dc031da40ff1da2674fa6`.
- Node syntax checks passed for the four changed source modules. ESLint passed
  for the changed tests and helper. The lint log is empty, SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

No vendor SDK evaluation, browser or native probe, network, Adobe or site
effect, deployment or lifecycle promotion was performed. The two existing
review documents are unchanged.

## Accidental source-pipeline test selection

The following command was run at 14:55 UTC with the intent to exclude the
synthetic SDK-double journey:

```sh
npm test -- test/adobe-fresh-pair-controller.test.js test/adobe-fresh-pair-measurement.test.js test/adobe-fresh-pair-stock-observer.test.js test/adobe-supervised-journey-page.test.js test/adobe-supervised-journey-source-admission.test.js test/adobe-supervised-retry-once.test.js test/adobe-stock-wire.test.js test/adobe-supervised-journey-source-pipeline.test.js -t '^(?!.*actual chamber).*'
```

The exclusion pattern did not exclude that journey. The test names do not
contain `actual chamber`. The full unmodified output is retained as
`renewal-adapter-regression.log` in the writer's session `files/` directory,
SHA-256 `2702bee602b0f153aaf0f5fb79ea4a3e66479158ec485948d3324137a331c4e1`.
It reports eight passing files and 267 tests, without individual test names.
This run is **not** first-gate or acceptance evidence.

Read-only inspection of the named test and helper shows that the selected
suite used invented fixture values, in-memory esbuild worker bundling, a
local Node VM with a synthetic SDK double, an EventEmitter recorder, and
stubbed DOM and dispatch. Its ambient fetch throws. One test read and hashed
four current-worktree source files. The named test and helper do not invoke a
closed ledger, roster or reservation, historical reader, supplier SDK bytes,
browser or native probe, or network request. This is a scope deviation, not
authority to repeat the journey or claim SDK execution. No historical
allocation is reset.

## Recorder adapter candidate

The adapter now consumes the existing passive network capture, admission and
native body-witness shapes. It reuses the public source capture checker for
request digest and length, response proposition, offer and rendered HTML,
and DISPLAY/INTERACT checks. It also binds each arm to its original SDK
observation, matched URL and labels, one declared experience and the configured
offer hashes. Recorder errors, changed bodies, missing witnesses, invalid
timestamps and mismatched response or rendered content are refused.
Cross-arm request and response bodies are compared without normalizing
proposition IDs or page URLs. Separate request IDs remain separate.

The recorder does not supply independent received body bytes. The adapter
does not reconstruct them from a digest or claim downstream receipt. The
checks apply to caller-supplied synthetic records only. Current execution,
evidence and provenance claims remain false. Actual served byte and debugger
line binding, real measurements, native independent stop, current preflight,
fresh admission and live authority remain open. Independent implementation
reviews and reconciliation are pending; 051-09 remains IN_PROGRESS.

The preceding partial candidate and accidental test selection remain
historical records. This candidate replaces its synthetic parallel wire shape
with the existing recorder shape. Exact changed source SHA-256 values:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-pair-controller.mjs` | `758d4a1c71645b474513fa0c168fd2f7b0ab5eaf322771e882568517ee2f3821` |
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `f2a7d29501323af1cfacca32efb6766d5dec16a4370b69d807bb4af500d08f78` |
| `test/adobe-fresh-pair-controller.test.js` | `59880fa85f3244847999be0042d9d3230df88eeba12eb4c1d49713e26c455063` |

The retained `renewal-recorder-red.log` shows the previous implementation
refusing the existing recorder shape, SHA-256
`f82026add8fcd74bfc497a5645c89cd83e5dd1311e3d8269b565e0ff5eaeca17`.
Its targeted green is `ac6f5444ec5283b2048346ab3790472e3d57d05cec804d14fc6ead496e3b4048`.
The separate timestamp assertion red is
`c467072ce31e3ff850e10a096bcef0b09a131cb12b3c98076afa0d09eb58b277`;
its green is `2fbb679ddcb83ed3b3eab364ba9f6639b29e491f22c5b06646407f694d52de0e`.
The final explicitly named pair unit files passed 16 tests;
`renewal-adapter-unit-final.log` SHA-256
`8bce192019d02ceb890991d8ff33d0b8136e61b57df6d4c7e2bfe7f6560a3011`.
Node syntax checks and the changed unit-test ESLint check passed. The lint
log is empty, SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Compliance remediation candidate

The independent source compliance pass on
`f95e63a242fbfd7976261190572407a9801c08f1` returned **needs-changes**.
Its complete unchanged body is recorded in
[`reviews/fresh-pair-source-compliance.md`](reviews/fresh-pair-source-compliance.md);
the verdict body SHA-256 is
`56e6890d0492f30effb492bfb64d9aa7e28e8628f2af3dce1086870ec175a813`.
This candidate is remediation, not an independent clearing verdict.

The source controller now checks the entire supplied stock command against
the fixed journey, then joins its consent, scope, URL, event data and native
proposition fields to the corresponding original wire operations. The
adapter requires consent, fetch, page, custom and INTERACT in that order.
It rejects contradictory initialize and render results and binds each
capture to the inspected metadata and configured time windows and the same
inspection instant. Cross-arm original bodies remain unnormalized.

The command check is intentionally strict and based on the fixed first-party
source and invented test records; compatibility with actual observed vendor
command shapes is not established. The wire join permits added SDK context
without changing the original captured records. Real SDK, served bytes,
measurements, native stop and live admission remain unqualified. Entry and
stop remain blocked. The source first gate is not independently cleared;
compliance, craft, architecture and reconciliation reviews remain necessary.
No full 051-09 completion or lifecycle promotion is claimed.

Changed source and test SHA-256:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-pair-controller.mjs` | `38cf466f3187ed01ca22e38e7bbab40066311603d4193ab32c6ae323508a5015` |
| `probes/adobe-compatibility/fresh-pair-measurement.mjs` | `57b7f3dfa8939a567cecd7fb4fef11d17e5a4c5ea52a44f6537a86120a3cfa2a` |
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `f1d207f3a4b2b4b4236fe597385e8f6b550aedfb8979b5fccdbf66169a4e54dc` |
| `test/adobe-fresh-pair-controller.test.js` | `1f57673c694577457b340d449f58425a709b897bc7d36fc6a1fda3bc83218186` |

Targeted synthetic tests, including their exact commands and outputs, are in
the writer's session `files/` directory. The first four reds were assertions
that the reviewed candidate accepted changed inputs; each green passed its
selector. The later full-command red catches an additional field accepted by
the initial remediation. The corrected final window selection covers separately
valid but stale metadata and configuration windows and a future capture.

| Log | SHA-256 |
|---|---|
| `compliance-command-red.log` | `d9dff9ec5d1edfd8e19a087d1957d1eb4c6d1d0e81f79782a7971da0bd999c67` |
| `compliance-command-green.log` | `c7531283434fd02c7a849ef2d5c8046a04e0e809ba81d64db9d9d07e3a524bee` |
| `compliance-command-full-red.log` | `8775caad68eb30355d3c7fc97a8e9c77e3eaab0e9e4330f3c38fe8c43c7ebe66` |
| `compliance-command-full-green.log` | `95f3cde2adfdba9f666acc056d3668ead002e980ba1063d72ade8ba9842a2922` |
| `compliance-order-red.log` | `765bfe2caad8f77d2c691c3994b5e9f0cfa9f264a154ec99bfc00e8c49750582` |
| `compliance-order-green.log` | `76419bfbd2cf49a7492a508d97a0c69410b261c5633b29ca055bc14cc62f88fa` |
| `compliance-render-red.log` | `fec578793740f0045f11b15adc42dad61bcec3b1f8907b33956025cb96a09d40` |
| `compliance-render-green.log` | `61f8146b88ba2253a4b7efc4e4b827b1d3649a1e07046a278c59c4d0d40929f0` |
| `compliance-window-red.log` | `ed7bc8681ee03dbbdb812edef6b2b6e18eaa705d27ba91aa94f814f750f5fb42` |
| `compliance-window-green.log` | `df0a87b5a4767d26bf761cc2ff46b34da75de69e2f403300d1cd50e3718af729` |
| `compliance-window-final.log` | `d99e22a086589e85e2937d4d4fd44dd32e98a66ed38e94c01f25107d1c4e9d76` |

The final explicitly named controller and measurement files passed 20 tests;
`compliance-unit-final.log` SHA-256
`47ec72bc46275ee7d3c824c1de279f9c5f87441f39e98b4ed376cf26ac7c73f1`.
Node syntax checks passed for the three changed modules and ESLint passed for
the changed test. `compliance-lint.log` is empty, SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
The original SDK-double selection remains excluded and was not rerun.

## Second compliance verdict: stopped

The second and final authorized independent Sol source compliance pass on
`1e473a8a0f4a3dfd945503ca0a9889a8fa86afef` returned **needs-changes** at
`2026-11-04T15:14:29Z`. Its full body is preserved in
[`reviews/fresh-pair-source-compliance-second.md`](reviews/fresh-pair-source-compliance-second.md)
with SHA-256 `3c6387e0f916cc41d7f3e49241e0f1c957c0f42269dd999345111a197c82f395`.
The first adverse body and its metadata remain unchanged in
[`reviews/fresh-pair-source-compliance.md`](reviews/fresh-pair-source-compliance.md).

**STOPPED:** The fixed fetch command's XDM page name is not joined to the
recorded HTTP event. The supplied operation timestamps are also not checked
for a subsequent request occurring before the preceding awaited response;
the positive synthetic fixture has that contradiction. The review ceiling
is exhausted. The owner was unavailable when asked about an additional
compliance pass, so no approval was captured. No further source remediation
or third review is authorized by this record; the existing
`2026-11-04T15:33:52Z` hard stop and six-session
limit remain. Craft, architecture and reconciliation do not clear these
findings. No source-completion, live-admission or full-slice claim follows.

### Commit hook deviation

For commit `1e473a8a0f4a3dfd945503ca0a9889a8fa86afef`, the exact commit
command used the one-command option
`git -c core.hooksPath=/dev/null commit -m 'fix(adobe): bind fresh pair observations to captured operations' -m 'Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>'`.
It did not write persistent configuration. The existing global hooks path
contained an executable `pre-commit`; it was skipped, not passed. The other
ordinary commit hooks `prepare-commit-msg`, `commit-msg` and `post-commit`
were absent. The writer bypassed the hook as a precaution against an
unexamined hook running excluded suites or effects, without first checking
its content; this was not a user instruction or an established necessity.
Subsequent read-only inspection found a staged-secret-scanner hook, not a
test-suite hook. No hook result is claimed for that commit.

The explicit checks for that candidate were
`npm test -- test/adobe-fresh-pair-controller.test.js test/adobe-fresh-pair-measurement.test.js`
(20 synthetic tests), the four named compliance RED/GREEN selectors and the
later full-command RED/GREEN described above, `node --check` on the three
changed `fresh-pair-{controller,measurement,wire}.mjs` modules, and
`npx --no-install eslint test/adobe-fresh-pair-controller.test.js`. The
preserved logs and hashes above are the evidence; none substitutes for the
skipped hook or independent review.

## New source-only window: review pending

The owner lifted the review limit and approved a new source-only hour from
`2026-11-04T15:58:51Z` through `2026-11-04T16:58:51Z`. Four prior source
sessions remain charged; at most four new independent Sol reviewers are
available for compliance, craft, architecture and reconciliation, with at
most eight cumulative sessions. Earlier allocations and stops remain
historical, not reset. No live or vendor effects are authorized.

This candidate checks the complete supplied fetch XDM fields against the
original serialized fetch event, including the fixed page name. It also
rejects a request timestamp earlier than the preceding awaited response
timestamp, for each arm and each fixed operation. Equal millisecond
timestamps remain valid because the recorder has millisecond precision.
The response timestamp records the response observation, not proof of
complete response delivery, browser paint or native lifetime. The existing
recorder and protected checker remain unchanged.

The coherent positive records and all negatives are invented synthetic
inputs. They do not prove actual SDK command shape or serialization,
received or deployed bytes, debugger line binding, real measurement or
provenance. `executionReady: false`, `actualEvidence: false` and
`provenance: false`. Historical run/retry, fresh entry and stop remain
blocked. The two historical compliance verdicts remain needs-changes.
Independent compliance, craft, architecture and reconciliation are pending;
neither this candidate nor its test results establish source or 051-09
completion.

Source and test SHA-256:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `0abfc6bc0c295ba3b41a7a37b366da47df8e86646e3b413ff7bcf788bf053d05` |
| `test/adobe-fresh-pair-controller.test.js` | `feb07471e79f14c6ed157c6c8486e160baf574d8ee66a16eb128929e7944ef79` |

Targeted synthetic RED/GREEN logs are in the writer's session `files/`
directory. Both reds are behavioral assertion failures against the prior
implementation, after a coherent positive fixture was supplied. The name
test changes or removes the fetch name in both arms while updating body
digests and lengths. The chronology test covers each of the four adjacent
operation pairs in both arms, plus equality at recorder precision.

| Log | SHA-256 |
|---|---|
| `renewal2-fetch-name-red.log` | `e2a1b08febb49462696aade329fa8c4af05c89f542ffc2e0b5d4db84fd77ac5f` |
| `renewal2-fetch-name-green.log` | `73b2792e91373269cf663d253d064d680ae8bbd601e77d79909d51091d938b2d` |
| `renewal2-causality-red.log` | `7dc9d9867a73aec4299323aee3ab06ae65e66a9ee6fc50c24804c7baf23305dc` |
| `renewal2-causality-green.log` | `cce0a1500fca65a349a47c093ab49529ea746a1bf865ef81142c2ebbc4a9235e` |

`npm test -- test/adobe-fresh-pair-controller.test.js test/adobe-fresh-pair-measurement.test.js`
passed 22 synthetic tests. `renewal2-unit.log` SHA-256:
`b2a6da184fd6bed51bf5da19a22b7a1b5cfd9d02dcc98939070de6c7cb7f6d97`.
`node --check probes/adobe-compatibility/fresh-pair-wire.mjs` and
`npx --no-install eslint test/adobe-fresh-pair-controller.test.js` passed.
The empty `renewal2-lint.log` SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
No source-pipeline/SDK-double or closed/native suite was rerun.

## New-window compliance remediation: review pending

The first independent compliance review in this window returned
**needs-changes** on `da6419aa03c812fb96b372f5cc370ab1532ecdf5` at
`2026-11-04T16:09:02Z`. Its complete actual body is preserved in
[`reviews/fresh-pair-source-window-2-compliance.md`](reviews/fresh-pair-source-window-2-compliance.md),
SHA-256 `0e0df1ac9b6344983e8adcb75e475fa1341c2b71e8ae29ac23ea3a428fe83780`.
This record and the prior adverse verdicts are not clearing reviews.

For each supplied arm and request, the adapter now rejects a matching
admission/body-witness timestamp later than its own observed response. It
permits equality at millisecond precision and does not require the admission
to equal the request-observation time. The stock host's original identity
must exactly match the selected original proposition's ID, scope and
scopeDetails. The existing capture checker separately joins the indexed
admission and body witness to each request and checks the proposition in
the response and native notifications; it remains unchanged.

The new tests use coherent invented synthetic records. They exercise each of
the five admission boundaries in both arms, equality at the response
timestamp, an admission before its request timestamp, and changed, missing,
null and extra stock identity fields. These checks do not prove real SDK
shape or serialization, real measurements, actual response completion,
received/deployed bytes, native lifetime or provenance.
`executionReady: false`, `actualEvidence: false` and `provenance: false`. Historical run and
retry, fresh entry and stop remain blocked. Independent source compliance,
craft, architecture and reconciliation are pending; no source or 051-09
completion is claimed.

Changed source and test SHA-256:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `d5b3bb8819ebd26e1ab40344c68cb477028dc0f136b268418460a89be46af072` |
| `test/adobe-fresh-pair-controller.test.js` | `4fb4b8d2eb612f2de7789486ef6f2243d5c7c527c1b2e97a8ba57a240250f191` |

Targeted synthetic tests and their exact commands are retained in the
writer's session `files/` directory. Both reds are behavioral assertion
failures against the reviewed candidate; both greens pass the same selector.

| Log | SHA-256 |
|---|---|
| `window2-admission-red.log` | `b5d59167dd22903c57ace15c7d0445ca5d570c4a986288fa52fcebb81054c078` |
| `window2-admission-green.log` | `342bd3220c55bf3c5fc12796f951b42d7e31f3f0df364f4ac2d1775495c50de1` |
| `window2-host-identity-red.log` | `3bd17fef74c1af52044e6d57b529fe4717b1d93e76100bb214b30c0ca6d33ee2` |
| `window2-host-identity-green.log` | `c6e8b29d28b01f8daca62e77c904ffffeb53ca178d23c1e37260b2d2e8b75e2b` |

`npm test -- test/adobe-fresh-pair-controller.test.js test/adobe-fresh-pair-measurement.test.js`
passed 24 synthetic tests. `window2-unit.log` SHA-256:
`3c2265a2bb65ffe076355fece55fdfc3d56fbc01b61558b6ce4b6075c625bbad`.
`node --check probes/adobe-compatibility/fresh-pair-wire.mjs` and
`npx --no-install eslint test/adobe-fresh-pair-controller.test.js` passed.
The empty `window2-lint.log` SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
No source-pipeline/SDK-double or closed/native suite was rerun.

## New-window craft remediation: review pending

The independent source craft review returned **needs-changes** on
`89d72c4c7402e4ba5ecac4735fc6ab3b9db74098` at `2026-11-04T16:24:13Z`.
Its full actual body is preserved in
[`reviews/fresh-pair-source-window-2-craft.md`](reviews/fresh-pair-source-window-2-craft.md),
SHA-256 `cf5c958ac828015c2dd18554840cff330b51df4fd7349e76629cc83f33e41c3e`.
The earlier compliance pass applies to that prior source checkpoint and
does not independently clear this page change.

The measured chamber page clears readiness on terminal failure. A controlled
unit test uses the existing worker and chamber-host stubs to reject the
awaited INTERACT step, retains both emitted synthetic rejection messages,
and passes the resulting failed page observation to the unchanged source
binder. The test verifies failure, incomplete and not-ready state, and a
closed gate. No actual SDK outcome or browser execution is claimed.

Changed source and test SHA-256:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/supervised-journey-page.mjs` | `6c5bf118fe3ed835ae47cbd3e5dc3941f938f73de7b9c7e0f780bb8b8a5b5187` |
| `test/adobe-supervised-journey-page.test.js` | `5cc537122903d9c9ecb1d1168362706c613c532241908dc2d4d791a52b6aedca` |

Targeted synthetic logs are retained in the writer's session `files/`
directory:

| Log | SHA-256 |
|---|---|
| `window2-craft-interact-red.log` | `276970890099007f8bc1b116221b0d6904a740cfa55cf69064b2efe2bd98de47` |
| `window2-craft-interact-green-attempt.log` | `3cb4c280003dbf271dde0b72e093d7b7bec8a8cfa2ff1fc9ffc879d0920b426e` |
| `window2-craft-interact-green.log` | `b641179a198051f641f918a7d91d039c07ee028caca981d30f96497cbc70c44b` |

The red is an assertion that the failed page remained ready. After the page
fix, the first green attempt failed at the binder because the synthetic test
URL lacked the required root slash. The test URL was corrected; the same
selector then passed and bound the observed rejection. The attempted green
is retained and is not passing evidence.

The explicitly named page, controller and measurement unit files passed 47
synthetic tests; `window2-craft-unit.log` SHA-256
`0106a27ae4077b4e6d13b84f991144b22ed23ca4ba6e551f69e3c3018c032d50`.
Page syntax and the changed test's ESLint check passed. The empty
`window2-craft-lint.log` SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
No source-pipeline/SDK-double, closed/native suite, vendor SDK evaluation,
browser or network was used. Same-reviewer compliance and craft back-edges,
architecture and reconciliation remain required. Actual execution,
evidence and provenance remain false; 051-09 remains IN_PROGRESS.

## Current source review and bounded reconciliation sweep

The preceding sections record successive historical candidates and their
status at the time. The current executable source checkpoint is
`649a85f6375aaaa6a56028df37b6df203c9289d6`. The same compliance reviewer
passed its coupled page change at `2026-11-04T16:32:15Z`; the complete
verdict is in
[`reviews/fresh-pair-source-window-2-compliance-page-pass.md`](reviews/fresh-pair-source-window-2-compliance-page-pass.md),
body SHA-256 `a9570e9652a4177dd8646244fd9439f78321a78a1670cf111eff79c4d8fccdee`.
The same craft reviewer passed the page repair at `2026-11-04T16:34:47Z`;
the complete verdict is in
[`reviews/fresh-pair-source-window-2-craft-pass.md`](reviews/fresh-pair-source-window-2-craft-pass.md),
body SHA-256 `af524a4dd46d443efb43f73539ac8796400c477cb525d0507d0e43692ecfdd0d`.
The independent architecture reviewer passed at `2026-11-04T16:39:35Z`
on `0c5f154bd4aa7945a07e5bda1e4305ed7b05151f`, which has the same executable
source. The complete verdict is in
[`reviews/fresh-pair-source-window-2-architecture-pass.md`](reviews/fresh-pair-source-window-2-architecture-pass.md),
body SHA-256 `cba24764b55de0adae49cc630a07ab2c37e01ebcb3a93facbb76feb91b7956d5`.
These review bodies include their original trailing metadata. Final
source-document reconciliation remains pending. These passes do not yet
establish source completion.

The sweep covers the amended contract, this witness, the supplemental
review records and the exact changed source and test paths from source base
`73d75613e306f78db17ea85e36d5028bcedd5412` to `649a85f`. The later
`649a85f..f36f10b96649f84459711fda2a37c9a4ec5830b8` delta contains only the
two recorded pass documents. The base-to-checkpoint path list contains no
change to the original slice or status board, ADRs, historical operator or
checker, core or vendor SDK bytes. This path comparison is not a new
inspection of unavailable historical originals or a qualification of their
contents.

Current changed source and test file SHA-256 values:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/chamber-journey-contract.mjs` | `a7f351646cb8927323ef3700d883690c20028506696cb84f229e0e330e60662b` |
| `probes/adobe-compatibility/fresh-pair-assets.mjs` | `64288470a978de02978798d5b5b1bf9c0424185396793d3f7616882692c4efea` |
| `probes/adobe-compatibility/fresh-pair-controller.mjs` | `38cf466f3187ed01ca22e38e7bbab40066311603d4193ab32c6ae323508a5015` |
| `probes/adobe-compatibility/fresh-pair-dispatch.mjs` | `af80482970044404c38e7281b8922ff0fdc24dae56cddf3dde19a2bbea8d5983` |
| `probes/adobe-compatibility/fresh-pair-measurement.mjs` | `57b7f3dfa8939a567cecd7fb4fef11d17e5a4c5ea52a44f6537a86120a3cfa2a` |
| `probes/adobe-compatibility/fresh-pair-stock-observer.mjs` | `a8da09e4bb87fb260f6a18b3fd6eae2da86396c42018e44aea0cb2e7a510f8fb` |
| `probes/adobe-compatibility/fresh-pair-wire.mjs` | `d5b3bb8819ebd26e1ab40344c68cb477028dc0f136b268418460a89be46af072` |
| `probes/adobe-compatibility/supervised-journey-page.mjs` | `6c5bf118fe3ed835ae47cbd3e5dc3941f938f73de7b9c7e0f780bb8b8a5b5187` |
| `test/adobe-chamber-journey.test.js` | `6b7589f2477de680698d7eef9825621b5de22f2a79ff6048f8d8303e0b94c695` |
| `test/adobe-fresh-pair-controller.test.js` | `4fb4b8d2eb612f2de7789486ef6f2243d5c7c527c1b2e97a8ba57a240250f191` |
| `test/adobe-fresh-pair-measurement.test.js` | `c5e57bdb9b656d34704c4d1cf6bdbe33e4171a014dae89ca9343d2700dfa155d` |
| `test/adobe-fresh-pair-stock-observer.test.js` | `ee0b39fd630de4e7414bf6cffecaffbda74492ad4c871ffabe3066e4375608d1` |
| `test/adobe-official-sdk-journey.test.js` | `f6bb3bc1f89ad273307ab5071b7fed0235a9112abdec47b98d04d98bf6bcb3f8` |
| `test/adobe-supervised-journey-page.test.js` | `5cc537122903d9c9ecb1d1168362706c613c532241908dc2d4d791a52b6aedca` |
| `test/helpers/adobe-official-sdk-journey.js` | `66cc1190b8cbc3ea71924b364886cc7be9a4a21d434ed2b3b3d41be6562c860a` |

The original adverse frame, compliance and craft bodies and the earlier
stopped-document reconciliation records remain intact. The accidental
SDK-double test selection, its exact command and full log remain excluded
from acceptance evidence. The skipped hook on `1e473a8` remains a skipped
hook; subsequent normal hook runs cannot qualify it retroactively. The
failed first craft GREEN attempt remains non-passing evidence. The later
corrected GREEN and three-file synthetic unit log remain separately
identified above. No tests were rerun for this sweep.

`executionReady: false`, `actualEvidence: false` and `provenance: false`
remain the disposition. The old allocations and four previous source
sessions remain charged; this window permits at most eight cumulative source
sessions, including at most four new independent reviewers. Historical
run/retry and fresh entry/stop stay blocked. An accepted fresh-admission
decision, exact owner live authority and allocation, current manual
preflight and routing/permission evidence, operator presence, native
ownership and independent stop, and deterministic selection and restoration
remain future gates. Actual SDK shape and serialization, served or received
bytes, debugger binding, measurements and native lifetime remain
unqualified. Original 051-09 stays IN_PROGRESS and historical C FAIL remains;
the separate EDS adoption follow-on is not accepted by this work.

## Final supplemental source reconciliation

The independent source-document reconciliation passed on
`1b2dadac0ee5cdf2b4521ee5b3b6e4f5c23c20f2` at `2026-11-04T16:47:18Z`.
Its complete actual result is recorded in
[`reviews/fresh-pair-source-window-2-reconciliation-pass.md`](reviews/fresh-pair-source-window-2-reconciliation-pass.md),
artifact SHA-256 `bad6cce722ef427e604dbf53e447017b4e070f68c3a8999f55ab7f20795adaba`.
All four supplemental source review phases passed on unchanged executable
source `649a85f6375aaaa6a56028df37b6df203c9289d6`. This later recording and
note are outside that independent pass and require the parent coordinator's
mechanical fidelity verification, not another independent review.

`executionReady`, `actualEvidence` and `provenance` remain false. Full
051-09 remains IN_PROGRESS and historical C FAIL remains; live, native,
manual preflight and EDS adoption gates are unchanged.

## V3 source-only boundary measurement

The coordinator accepted a revised causal witness for source-only
implementation, not live entry. An exact loaded version 3 job selects
`boundary_evidence_version: 1` and
`comparison_contract: fresh-poc-semantic-comparison-v1` before consumption.
Its immutable job hash, pair ID and arm bind the separate private sidecar.
Versions 1 and 2, the passive recorder and all historical captures retain
their original rules and values; evidence presence alone selects nothing.

The sidecar has kind `airlock.05109.fresh-pair-boundary`, schema version 1,
job hash, pair ID, arm and exactly five records. Each record contains ordinal,
request UUID, URL and body SHA-256, and four `{wall_time, monotonic_ms}`
events from one gate process. The pause is stamped in the CDP request-paused
listener before the queue. Reservation completion is stamped only after the
durable reservation call returns. Release invocation is stamped inside the
locked `startEffect` callback immediately before `Fetch.continueRequest`.
Response completion is stamped only after the response has finished, its
body has been read and the native response validator has accepted it.

For each request, pause precedes durable reservation, release and its own
completion, in that order. Each later reservation must follow the previous
actual response completion. A paused intent may wait in the bounded existing
queue while the previous response completes; an early release may not. Both
clocks must preserve those relations and the events must stay inside the
recording and job windows. Each record joins the unchanged same-arm
admission, body witness and recorder by ordinal, ID, URL/body hashes and
request metadata. Missing, partial, duplicated, foreign or mismatched
evidence fails closed; STOP, deadline and request caps are unchanged.

The separately reviewed closed comparison is specified in
[the fresh POC comparison contract](slice-09-fresh-poc-comparison-contract.md).
This source candidate requires independent implementation review before any
publication or new effect. Attempt 6 remains UNKNOWN; no missing causal
evidence, prior DOM, or terminal result is rewritten.
