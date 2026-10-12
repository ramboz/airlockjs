---
status: RECONCILED
dependencies: [051-06, adr-0032]
last_verified: 2026-10-12
kind: feature
frame_review: true
arch_review: false
claimed_by: adobe-adoption-goal
---

## Slice 051-07 — checking recorded stock wire semantics

**Goal:** An operator can run a secret-safe local checker on recorded final SDK payloads
and find collection/routing/proposition-reference errors before using them as a stock baseline.

This is a usable evidence-inspection path under ADR-0032, not another live run, baseline
plan/apply tool or SDK host. It does not complete 051-02 or establish chamber parity.
051-06's actual private capture contains `path`, `config_id`, parsed final JSON body,
response identity and host observations; it does **not** retain full URL/method/headers.
The checker must not invent those missing fields or claim full transport conformance.
Final dispatch/result provenance and full URL/header checks remain the collector/operator's
separate responsibility in 051-02/03.

**DoR:**
- [x] Actual pinned stock record shapes inspected structurally, without copying private values.
- [x] Existing bounded private reader/parser, Failure enums and fixed-report patterns inspected.
- [x] Closed checker contract below frame-reviewed before implementation.

**Acceptance Criteria:**
1. A local CLI accepts only `--input <private JSON path>` or static `--help`, makes no
   network/SDK/browser/resource calls, reads no credentials/environment selectors and prints
   one fixed redacted report. Input files must be regular nonsymlink owner-only files.
2. A positive capture records one grant consent, one fetch, one mapped page/DISPLAY,
   one distinct ordinary custom link and one native INTERACT, with exact expected final
   event types/values and returned proposition references. Duplicate/malformed/mismapped
   events and foreign scope/datastream/path fail with fixed categories.
3. No-offer/non-render captures contain one grant/fetch/page/custom and no notifications;
   no-offer has no returned identity/render, non-render has a returned valid identity but
   no render. No-consent permits at most one native deny-consent request and zero collection;
   empty collection means only capture absence, not proof of SDK consent enforcement.
4. Validate event order and actual payload/reference content; never accept a count-only
   record, broad normalization or caller-supplied success boolean in place of payloads.
   Check granted policy precedes collection and fetch precedes page/custom/interaction.
   Host observations are *recorded assertions*, not independently proven DOM evidence.
5. Invalid input, mismatched semantics and internal errors are distinct nonzero results.
   No sensitive echo/path/raw error, silent success default or report field copied from input.
   Tests are non-vacuous, red first, and exercise the real CLI/private-file boundary.

### Closed contract before tests

Deliver `probes/adobe-compatibility/stock-wire-check.mjs`, tests
`test/adobe-stock-wire.test.js`, and the directly related operator README section.
Use Node built-ins and existing Vitest, no dependencies/framework. Reuse `readJson(path,true)`
and `parseJson` from `contract.mjs`; its 262144-byte/depth16/duplicate/prototype-key/UTF8/
owner-file controls stay unchanged. Do not modify closed preflight contracts for this tool.

Export pure `checkStockWire(value)` and async
`runWireCli({argv, stdout, stderr})`; actual entry binds process streams/argv only.
Help must not read input or instantiate a transport. CLI exact argument handling rejects
inherited flag names, duplicates, positional values and extra flags. No env/credential/
output-path flag. Console output is only the fixed report/enum summary.
A module import performs no input/credential/network/browser work.

Input is a closed plain JSON object:
`kind:"airlock.adobe-stock.wire-capture"`, `schema_version:1`,
`sdk_pin:"alloy-2.31.1"`, `case:positive|no-offer|non-render|no-consent`,
`expected`, `host`, `proposition`, `requests`.

`expected` has exactly `datastream_id`, `decision_scope`, `page_name`, `custom_name`, `page_url`.
Nonempty bounded scalar strings have no control characters; decision scope uses the
existing dotted-scope grammar; page/custom labels differ. `page_url` is canonical HTTPS
without userinfo/fragment, at most2048 characters. No arbitrary loader/network use.
`host` is exactly `{rendered:boolean,clicked:boolean}`. `proposition` is null or exactly
`{id,scope,scopeDetails}`; id is a nonempty bounded string, scope equals expected scope,
scopeDetails is bounded plain JSON with `decisionProvider:"TGT"`. Its other bounded
vendor fields/arrays may be additive; original identity must remain structurally intact.
The raw parsed body can also carry additive SDK fields; no accessor/prototype/custom-object/
symbol/cyclic/oversized/nonfinite data is accepted by the pure seam.
Pure input traversal is at most16 object/array levels,10000 nodes,262144 UTF8 JSON bytes.
Reject malicious getters without invoking them; rejected values never reach output.

`requests` is an array of at most8 records with exactly `path`, `config_id`, `body`.
Path is exactly `/ee/v1/{interact|collect|privacy/set-consent}` or the same with one
documented optional `or2|va6|irl1|ind1|jpn3|sgp3|aus3` segment before `v1`.
Encoded/extra paths, newer v2 and foreign config IDs fail. No origin/method/headers are
manufactured. Parsed body is plain bounded JSON. Reject SDK/datastream override keys
`configOverrides`, `edgeConfigOverrides`, `sdkConfig` wherever encountered; this fixed
capture contract permits no routing override. Detect extra collection events, not just
the expected ones amongst a larger array.

Consent request has exactly one Adobe2.0 consent object inside `body.consent`, with
`value.collect.val` `y`/`n` for case grant/deny, `personalize.content.val` matching,
`marketing.any.val:"n"` and `share.val:"n"`. Additive body/consent-value SDK fields are
allowed if bounded; conflicting policy values fail. It must contain no events.
Collection requests must not carry consent updates; they contain a nonempty `events`
array with at most4 records. Unknown/extra events fail, not ignored.

Fetch is `xdm.eventType:"decisioning.propositionFetch"`, correct expected
`xdm.web.webPageDetails.URL`, `event.query.personalization.decisionScopes` equals the
one expected scope, and no Analytics mapping or display/interaction XDM.
Ground this precise final query path from the inspected actual SDK capture before tests.
Its query is exactly `{personalization:{schemas,decisionScopes,surfaces}}`: surfaces
must be empty, and schemas must equal the seven grounded pinned-SDK strings in order:
`https://ns.adobe.com/personalization/` followed by `default-content-item`,
`html-content-item`, `json-content-item`, `redirect-item`, `ruleset-item`,
`message/in-app`, `message/content-card`. No other query or personalization selector.
All page/custom/INTERACT events must lack an event-level query; reject extra scope/surface/
enabled/view queries even if their event counts and required mapping are otherwise correct.
Body-level query may contain only the actual identity fetch shape `{identity:{fetch:["ECID"]}}`;
body meta and other bounded SDK facts are additive except the prohibited override keys.
Add mutation tests for foreign surfaces, extra fetch selectors, extra event personalization
queries and body personalization query. Bounded unknown fields are not automatically inert
where they select routing, decisions or collection semantics.
Ordinary page is `web.webpagedetails.pageViews`, exact expected XDM name/URL,
pageViews.value1 and `data.__adobe.analytics.pageName/pageURL` exact; no link mapping.
Ordinary custom is `web.webinteraction.linkClicks`, exact
`xdm.web.webInteraction.{name,type:"other",linkClicks:{value:1}}`,
`data.__adobe.analytics.{linkType:"o",linkName}` exact; no pageName/pageURL in Analytics data.
Its URL may be SDK-populated and is not automatically required absent.
Native INTERACT is `decisioning.propositionInteract` with no Analytics page/link mapping.

For positive, page carries exactly one native display flag1 and one proposition, INTERACT
carries exactly one interact flag1 and the same sole proposition.
Both id/scope/scopeDetails structurally equal the returned recorded identity. Reject
mixed/extra notification flags, extra proposition references, foreign provider or references.
The custom event carries no native decisioning notifications. Non-render/no-offer page,
custom and fetch carry none; no-consent carries no events at all.
Positive recorded host state requires rendered/clicked true; no-offer/non-render false/true;
no-consent false/false. Counts cannot replace those independently classified recorded facts.

Public report keys exactly:
`kind:"airlock.adobe-stock.wire-report"`, `schema_version:1`, `case`,
`overall`, `exit_code`, `checks`, `counts`, `claims`.
Case is the valid fixed case or `invalid`; overall is
`capture_checks_passed|capture_checks_failed|invalid_input|invalid_invocation|internal_failure`.
Checks exactly `routing`, `consent`, `collection`, `notifications`, `order` with values
`passed|failed|not_exercised`. Counts exactly `requests`, `consent_updates`, `fetch_events`,
`page_events`, `custom_events`, `display_events`, `interaction_events` (nonnegative integers).
Claims exactly and **always false**:
`actual_dispatch_verified`, `sdk_execution_verified`, `host_render_verified`,
`chamber_compatibility_verified`, `downstream_receipt_verified`, `full_wire_conformance_verified`.
A pass means this supplied capture's recorded fields satisfy the fixed predicates, not
that the checker independently witnessed network/SDK/DOM provenance.
No expected value, private identity, payload, field path, file path or exception is echoed.
Return recursively frozen report; no references/mutations of caller input.
Exit0 passes capture predicates;1 semantic mismatch;2 invocation/schema/file refusal;
3 internal unexpected failure. On nonzero, stderr prints the fixed overall enum only.
File read rejection surfaces explicitly without requiring a path in its message.

**DoD:**
- [x] Witnessed tests first, meaningful mutations/refusals, targeted frozen-core tests pass.
- [x] Independently recorded compliance/craft and reconciliation; no invented live proof.
- [x] Parent verifies checker on a private projection of the already recorded positive
  payloads without reconstructing missing URL/method/header evidence or resending SDK events.
- [x] README distinguishes capture validation from full boundary acceptance; close only051-07.

## Assumptions

The inspected final fetch payload's personalization path and the fixed recorded scenario
shape accurately represent the pinned SDK's one-page/custom/Target cases. Source/capture
inspection and tests ground this, not a universal inventory for all Alloy commands.
The tool's supplied expected/host/proposition fields are trusted observer input; it cannot
establish their independent provenance. False claims are explicitly denied in every report.

### Deviation log (after reconciliation)

No implementation/contract deviations. Test-harness-only eval/ESM-spy issues were corrected
without changing production seams. Frame review required exact additional-personalization
selector checks before tests; those negative mutations remain in the implementation.
No new SDK traffic, capability, credential hook or report gate is introduced.

The parent ran the real CLI on a private projection of the immutable headed-positive capture:
all five recorded-field checks passed, counts5 requests and one consent/fetch/page/custom/
display/interact each. Original request bodies/path/config fields and returned identity
were preserved; missing URL/method/headers were not invented. The source/projection/checker
hashes and fixed result are private. All six independent-provenance/full-wire claims are
false even for this actual recorded input. This is not new live SDK or chamber execution.

### Implementation / TDD witness

- Entry verified: `READY_FOR_IMPLEMENTATION`, recorded frame `pass`, Accepted ADR-0032.
  Workflow helper transitioned this standalone slice to `IN_PROGRESS` before edits.
- Tests first: `vitest run test/adobe-stock-wire.test.js --reporter=json` witnessed
  **0 passed / 180 failed** before the production module existed. Defined assertions
  failed (including `expected undefined to be type of 'function'` at test line 123);
  import-only collection failure is not the witness. Fixtures are invented only.
- Follow-up TDD mutations witnessed **182 passed / 15 failed (197 total)** before
  tightening known SDK containers, stray XDM counters and pure CLI argv classification.
  The failing semantic assertions were `expected 0 to be 1`, not environment failures.
- Green: `vitest run test/adobe-stock-wire.test.js test/contract-stability.test.js
  test/adobe-stock-harness.test.js --reporter=json` — **366 passed / 0 failed**:
  checker197, frozen-core36, prior harness133. No full suite was run.
- ESLint API with existing recommended rules and explicit Node/Vitest globals for the
  ignored probe/test paths: **2 files, 0 errors, 0 warnings**. No tool installation.
- Owned deliverables: `probes/adobe-compatibility/stock-wire-check.mjs`,
  `test/adobe-stock-wire.test.js`, and the new recorded-checker operator README section.
  Pure reports are recursively frozen, input-independent and always deny all six
  provenance/full-wire claims. CLI returns exits0/1/2/3 with fixed JSON/enum output.
- Implementation deviations: none; two test-harness environment issues (eval syntax
  and spying on a built-in ESM namespace) were corrected without production seams.
  No private source, SDK/browser, network, resource mutation, dependency, core or
  closed-record changes. **At implementer handoff**, parent private-projection verification
  and reviews were outstanding and the slice was IN_PROGRESS. The later verified result
  and recorded passes supersede that implementation-time status, not the TDD evidence.

### Reconciliation sweep

- **Updated:** checker,197-case suite, operator README, open051 index/tasks/board and R-012
  distinguish recorded-field checking from full wire/result/host and chamber acceptance.
  Parent targeted verification passes366 tests and recommended lint has zero findings.
- **No-op:** frozen runtime/core/connector/vendor bytes, credentials, closed preflight/smoke
  records, original captures and product/report configuration. No new dependency/public
  runtime boundary, convention, decision content or out-of-spec product/UI choice.
- **No-op:** inbox broader Adobe compatibility and reporting follow-up remain where owned;
  memory already records ADR-0032 and the native/report evidence distinctions.
- **Deferred:** full URL/method/header collector, SDK/response/host provenance, real negative
  baseline/performance and actual chamber support belong to051-02/03, not this validator.
  No acceptance gate is satisfied by a success-shaped synthesized capture.

### Close-out (post-DONE)

- [x] Give051-02 the recorded-field checker without treating it as a complete live baseline.
