---
status: DONE
dependencies: [051-01, 051-04, adr-0031]
last_verified: 2026-10-09
kind: feature
frame_review: true
---

## Slice 051-05 — local stock journey harness

**Goal:** An operator can execute and inspect the fixed stock page/custom/render/notification
journey locally before permitting Adobe traffic, with explicit consent, request accounting,
negative controls and honest distinction between submission and downstream receipt.

This independently useful dry-run path supplies the tested caller-visible harness needed by
051-02. It does not implement a general provisioner or certify the stock live baseline.
051-02's original ACs and live gates remain unchanged. The owner requested implementation and
execution on 2026-10-09, permitted isolated request flexibility and allowed leaving the owned
activity active unless a control/error requires pausing. No actual activation is performed here.

**DoR:**
- [x] Existing stock reference/version, public notification contracts and original ACs available.
- [x] Operator approves local code/tests within the existing overall credit ceiling.
- [x] Exact pinned stock exported function signatures checked before tests/implementation:
      `initMartech(webSDKConfig,martechConfig)`, `updateUserConsent(consent)`,
      `sendEvent(payload)`, `sendAnalyticsEvent(xdm,data,overrides)`,
      `pushEventToDataLayer(event,xdm,data,overrides)`, `martechLazy()` and `martechDelayed()`
      from the pinned reference. ACDL submission returns void, not an SDK receipt promise.
- [x] Independent frame review of the fixed local journey/evidence boundary.

### Bounded deliverables

One browser-compatible ES module `probes/adobe-compatibility/stock-harness.mjs`, a small
Node `stock-dry-run.mjs` operator command, existing README updates and
`test/adobe-stock-harness.test.js`. Reuse existing test conventions and built-in APIs;
no dependencies, runtime/core changes, copied vendor bundle, SDK fork or new service.

The module accepts a **fixed integration object** supplying the pinned stock exports needed
for initialization, consent, lazy/delayed phases, `sendEvent`, Analytics event and ACDL submission.
It validates those functions before any invocation. The real integration will be supplied by the
site wrapper in 051-02; only invented implementations are used by the local dry-run executable.
No CLI/env flag loads a caller-supplied transport/module/URL or credential. The harness never
reads credentials, writes cookies directly, controls a Target activity or reaches fetch itself.

`runStockJourney` accepts exactly the integration, fixed case (`positive`, `no-consent`,
`no-offer`, `non-render`), bounded synthetic run identifier, event index, exact page URL,
decision scope, org/datastream config, rendering interface and optional deterministic test clock.
Validate typed inputs and reject unknown keys, forbidden identifier/URL syntax and missing
required functions before calling anything. Scope/run markers never become customer identity.
The URL is a single HTTPS origin/root supplied by the future reviewed site plan; no URL changes,
redirects, scripts or arbitrary DOM selector operation are introduced here.

Event names are distinct deterministic synthetic page/custom labels, with one initial SDK
instance. Initialize pending consent; an explicit local simulated grant/deny drives SDK consent.
For no-consent, exercise denied behavior without silently omitting the attempted journey.
Any denial suppresses collection/render/display/interaction calls; record that they are blocked.
No application retries or automatic fallback instances.

For granted cases, request only the declared scope with automatic rendering/display/click
collection disabled. Qualify a returned HTML proposition by exact scope, Target provider and
expected harmless content supplied by the synthetic fixture; preserve `id/scope/scopeDetails`.
Malformed/foreign/ambiguous/non-HTML results are observable failures, never fallback success.
The injected host renderer validates and applies only this known content to its own fixed reserved
slot and returns an explicit visible-render outcome; a flag from the SDK alone is not proof.
No untrusted executable markup or general DOM capability is implemented by the harness.

Positive: wait for actual host rendering, then submit one Analytics page event carrying native
display XDM. In lazy phase, submit one distinct ACDL custom/link event for an actual host button
click; emit one separate native interaction referring to the same proposition. The host's
click interface must be awaited, not assumed. Preserve errors/order and never report a display
before confirmed rendering or interaction before a click.
No-offer: the local stub returns no proposition; the future live plan deliberately keeps the
owned activity inactive. Submit ordinary Analytics page/custom events with no proposition fields.
Non-render: obtain the qualifying proposition but deliberately do not apply it; submit ordinary
page/custom events without display/interaction notifications. All cases execute their assigned
stimuli, not vacuous assertions.

Invocation waits must be bounded by an explicit positive integer timeout no greater than
10,000 ms. On timeout/rejection, stop subsequent side effects; No timed-out continuation of this harness may start subsequent operations; already dispatched
SDK work cannot be recalled and is not claimed cancelled. Account for calls, rendering/click
status and phases. The accounting is
application submissions, **not SDK HTTP attempts, Adobe receipt, retries or exactly-once proof**.
Void-returning ACDL submission cannot expose a subsequent asynchronous SDK rejection to this
runner; do not invent that acknowledgement or count a submission as successful transmission.
Local denied-consent blocking is a harness guard, not proof of vendor-native consent behavior.

The operator command takes only `--case <fixed-case>` or `--help`, no files/credentials/network
configuration. Stdout is one versioned primitive-only JSON result with fixed keys:
`kind`, `schema_version`, `case`, `overall`, `exit_code`, `phases`, `counts`, `claims`.
`counts` contains nonnegative integers for attempted/blocked collection, page/custom/display/
interaction submissions, render and click outcomes. `claims` always states
`local_fixture_only:true`, `sdk_execution_verified:false`, `product_receipt_verified:false`,
`deployment_verified:false`, `activity_activation_performed:false`.
No private config/URL/run label/proposition/raw error/HTML is printed. Stderr uses fixed
error categories only. Case errors yield nonzero exit, malformed invocation exit 2;
help performs no reads/network. Deep-freeze results. A passing dry-run is not a ready live plan.

**Acceptance Criteria:**

1. **Usable operator path:** Real executable runs all four fixed cases and exposes their
   meaningful counts, phases and immutable evidence disclaimers; no credentials/network writes.
2. **Stock contract fidelity:** Actual pinned exported function signatures are verified and
   respected, with single initialization and correct consent/eager/lazy/custom/native fields.
3. **Real control stimuli:** No-offer and qualified/non-rendered cases exercise different
   behavior. Negative notification assertions are non-vacuous, and false render/click outcomes
   cannot become positive submissions.
4. **Bounded failure behavior:** Invalid data, foreign propositions, bad host confirmation,
   SDK/renderer/click rejection and timeout are explicitly observable, no subsequent side effects,
   retries, duplicate SDK instances or success-shaped fallbacks.
5. **Secret/evidence safety:** Primitive-only outputs never leak URLs, selectors, IDs, content,
   run markers, config or thrown objects. Synthetic success never claims live SDK/product proof.

**DoD:**
- [x] Tests witnessed failing before implementation, all fixed cases and error/control cases covered.
- [x] Targeted preflight/frozen-core regressions pass.
- [x] Independent compliance/craft and reconciliation verdicts recorded.
- [x] Docs/board/memory show local-only value and unchanged 051-02 live gate.

## Assumptions

The pinned stock export surface can express this explicit manual-render journey without invoking
its broader eager auto-display helper. This must be checked directly against the pinned source;
local stubs verify harness behavior, not whether real SDK/Edge/Target reporting accepts the events.

## Open 051-05 implementation contract — before tests

`runStockJourney(options)` uses one closed plain object: `integration`, `case`, `runId`,
`eventIndex`, `pageUrl`, `decisionScope`, `config`, `renderer`, `timeoutMs`, optional `clock`.
The integration is a closed object of the seven named functions above (select exports, not the
entire vendor namespace). Config has only nonempty, control-free `orgId` / `datastreamId`
strings, at most 100 characters; no adopter SDK override surface. Run IDs match
`airlock05105-[a-f0-9]{32}`, event indices are integers 1–1000; scopes match
`[A-Za-z0-9][A-Za-z0-9_.-]{0,99}`, excluding prototype names and `target-global-mbox`.
The page URL is canonical `https://<DNS hostname>/` only: no credentials, port, query,
fragment, alternate path or URL normalization. Timeout is required, integer 1–10000 ms.
All nested contract objects reject unknown keys, accessors and non-plain prototypes.

Renderer has exactly `render(proposition)` and `click({rendered,proposition})` functions.
It is a trusted **host fixture**, not an SDK acknowledgement. The only approved item is
`id:"synthetic-item"`, HTML-content-item schema, and
`data:{content:'<p>Local stock fixture</p><button type="button">Fixture click</button>'}`.
Require one proposition / one item, exact scope, nonempty bounded proposition ID and
`scopeDetails.decisionProvider:"TGT"`; retain the original `id/scope/scopeDetails` in native
events. Extra SDK proposition fields are ignored, not printed or executed.
Render acknowledgement must be exactly `{visible:true,content:<the known HTML>}`;
click acknowledgement exactly `{clicked:true,target:"offer-button"}` after rendering,
or `"control-button"` for the ordinary no-offer/non-render host button. No selector capability.
No-offer requires an explicit empty propositions array; positive/non-render require qualification.

Return a deeply frozen report, never an echoed input or raw exception. `overall` is a fixed
success/failure enum; exits are 0 success, 2 input/invocation, 1 journey failure, 3 internal.
Phases are fixed init/consent/eager/lazy/delayed status enums. Counts include actual init/consent,
attempted/blocked collection, fetch/page/custom/display/interaction submissions, qualification,
render/click attempts, confirmations and blocks. A bundled page display counts as one collection
submission, not a second event. Denied consent attempts all four collection operations through
the local guard (and records blocked render/click), executes lazy/delayed with automatic collection
disabled, and submits none. SDK-native denial is not proved.
Clock is a module-only closed `{setTimeout,clearTimeout}` test seam; each awaited invocation is
bounded separately. Late operation settlement cannot resume the harness. ACDL push is invoked
synchronously and must return void; count submission, not asynchronous listener completion.

Pinned public `src/index.js` was read directly before tests (2026-10-09): signatures, lazy ACDL
listener and empty delayed Launch list agree with DoR. Use top-level `decisionScopes` for the
Alloy 2.31.1 manual fetch (not the newer nested option). Skip `martechEager` and retain the known
auto-display gap. No vendor file is copied or executed.

## Implementation / TDD witness — 2026-10-09

Confirmed READY_FOR_IMPLEMENTATION before edits, then used the workflow helper to transition
051-05 to IN_PROGRESS. The closed detail contract above was recorded before authoring tests.
No review verdict, live evidence or original routing observation time was changed.

- Red: `npm test -- test/adobe-stock-harness.test.js` — **133 failed**, before either production
  module existed. CLI assertions saw exit 1 instead of 0/2; module assertions reported
  `runStockJourney is not a function`.
- Initial implementation: 106 passed / 27 failed. Fixed test instrumentation (Node 22's ESM
  loader needs its two exact public module reads; overwritten negative mock implementations
  must themselves record actual calls). These fixes did not alter negative fixtures or repair
  their SDK/host data. One remaining static help case-sensitivity mismatch was corrected.
- Green: one combined `npm test -- test/adobe-stock-harness.test.js
  test/adobe-preflight-cli.test.js test/adobe-preflight-transport.test.js
  test/adobe-preflight-evidence.test.js test/adobe-workspace-evidence.test.js
  test/contract-stability.test.js` — **588 passed / 0 failed**, six files.
- Full default `npm test` — **2470 passed / 0 failed**, 126 files.
- `npx eslint test/adobe-stock-harness.test.js`, manual ESLint recommended with browser globals
  for the harness and Node globals for the CLI (probes are ignored by repository lint), and
  both `node --check` probes passed. A control-character regex lint finding was refactored
  after tests were green, without changing the validation policy.

Real subprocess tests execute all four cases, help and malformed invocation with capability
tripwires. Module tests record exact argument signatures, stock-like setConsent/sendEvent
submission mapping, host acknowledgements, no-offer/non-render stimuli, denial attempts,
malformed/foreign/duplicate propositions, every awaited operation's timeout and late settlement,
fixed failures and deep freezing. ACDL is synchronously submitted, never awaited as a vendor receipt.
All outcomes remain synthetic; no vendor SDK was loaded and no live operation was attempted.

### Deviation log (after reconciliation)

No scope or acceptance deviation. The previously underspecified closed details were selected
and documented before tests as requested. Test instrumentation corrections above are recorded
explicitly; no new dependency, helper file, SDK instance, service or live provisioner was added.

Implemented local harness/CLI/tests and operator README only, plus open 051-05 plan/task notes.
Independent compliance/craft/reconciliation passed; board/memory handoff completed. The helper
derived this local slice DONE without changing 051-02's live status or source timestamps.
No SDK, activation, deployment or downstream receipt claimed. Nothing new requires an inbox spec;
the known eager-helper fidelity gap and downstream observation gates already belong to 051-02/03.

### Reconciliation sweep

Ownership is the workspace diff against integrated `origin/main` at `cda3878`, not the helper's
stale local-main history. Earlier 051-01/04 and reframe paths in its inventory are inherited and
explicitly excluded; their closed records and previous dispositions are unchanged.

| Disposition | Paths |
|---|---|
| `updated` | `probes/adobe-compatibility/{stock-harness.mjs,stock-dry-run.mjs,README.md}`: fixed local journey, invented integrations, safe reports and limitations. |
| `updated` | `test/adobe-stock-harness.test.js`: actual CLI/module refusal/order/control/timeout cases and real initial red witness. |
| `updated` | This slice, `051/{spec.md,plan.md,tasks.md}`, `reviews/slice-05-*.md`: checked signatures, implementation and real independent verdicts, not live acceptance. |
| `updated` | `slice-02-test-baseline.md`: owner active-finish permission and control/error pause reasons; local code is not its deployment/mutation/receipt harness. |
| `updated` | R-012, primer and board: local milestone and current stale-evidence refusal, not current readiness inferred from the historical v2 pass. |
| `updated` | Derived board/trace audit and bounded memory learning for void ACDL/local-only accounting; pre-existing orphan links untouched. |
| `preserved/no-op` | Runtime/core/vendor bundles, frozen contracts, accepted ADRs, conventions, dependency manifests and closed 051-01/04. Original live/product gates survive. |

Leanness: two bounded modules and one test file, no network client, provisioner, credentials or
deployment abstraction. No new inbox item. Independent reconciliation passed;
no actual SDK, activation, deployment, Target receipt or browser performance result inferred.
Board regeneration/audit passed. Use-case audit remains zero gaps/zero dangling/nine pre-existing
orphans, with no invented links. Memory helper persisted the void ACDL/local-accounting limits;
the existing team opt-out was honored. Closed records and original freshness were not modified.

### Close-out (post-DONE)

- [x] Keep the completed local harness separate from unexecuted stock live proof.
