---
status: IN_PROGRESS
dependencies: [051-01, 051-04, 051-05, adr-0031]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: adobe-adoption-goal
---

## Slice 051-06 — deployed stock smoke journey

**Goal:** An operator can deploy a strictly opt-in pinned stock integration on the dedicated EDS
reference page and run one bounded real page/custom-event journey, observing actual vendor
submission and downstream Analytics status without labelling it complete Target/product parity.

This is a caller-visible deployment/journey path, not another local mock or an SDK bridge.
051-02 retains every original stock baseline AC, negative/performance case and Target report gate.
This slice supplies the first real attempt and reusable page entrypoint, not their blanket acceptance.

### Authority and concrete plan

The owner authorized the dedicated reference site, exact existing Adobe fixtures, opt-in code,
bounded synthetic tests, ordinary reviewed decisions, under the unchanged <10,000-credit ceiling.
Extra audience/eligibility markers are not required. Preserve the owner's Page Delivery settings.
The owner permits the owned activity to remain active after successful tests; a failure or required
no-offer control stops traffic and may require pausing. No production release/publication or new
resource creation, SDK fork, customer-data processing or general network authority.

The owner explicitly reconfirmed unchanged dedicated routing at 2026-10-09T23:00:50.457Z.
This is a **new manual configuration confirmation**, not new screenshots or an API readback.
Original screenshot observations and expired reports remain immutable historical evidence.
For this stage, the orchestrator may create new private assessment envelopes with that confirmation
time, referencing the originals and current exact selector/credential/resource readbacks. The
24-hour validity starts at the new confirmation, never at normalization or run time. The selected
profile confirmation remains independently fresh and bound. No guessed selectors or silently
extended old expiry. The resulting real preflight must pass all required checks before traffic.

Approved repository: `adobe-rnd/aem-eds-airlock-poc`, its `main` code ref and preview homepage.
The orchestrator will use a new isolated checkout **inside this session's workspace**, re-read
remote SHA and clean status, and preserve unrelated code. One exact conditional edit in
`scripts/scripts.js` loads the new browser module only for root URL
`?airlock-stock=v1&case=positive|no-offer|non-render|no-consent&run=<synthetic-id>&consent=decline`.
Unknown/duplicate/extra keys, wrong origin/path, expired or disabled public config load no SDK.
Ordinary eager/lazy/delayed code and original consent-check remain unchanged; no head changes.
No-martech/default behavior does not preload vendor assets. New assets live under
`tools/airlock-stock/`; runtime selectors are explicitly public org/datastream/custom scope only.
No suite/company/activity/property/workspace/environment IDs, bearer credentials or API keys
are bundled. Actual private values go only to the authorized reference test-site runtime config,
not this repository's fixtures/reports/docs.

Pin `aem-martech` at `1aa3dee3c4791636efa9ad2994342f861c8e149b`, its ACDL/attribution, and
official unmodified Alloy 2.31.1 SHA-256
`7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`.
The official artifact's trailing LF difference remains documented. Use the pinned module's
real exported signatures and no `martechEager` auto-display helper. Import official vendor
assets only after exact opt-in, current window and explicit synthetic consent action.

First deploy config disabled; verify served JS/config/vendor hashes/content types and real
browser/CSP before enabling. Non-force compare-and-push to the exact reference main, no tags
or .aem.live publish. Exact touched paths/base/diff and their original hashes are privately
journaled before mutation; a forward config-disable commit is the normal stop. Foreign concurrent
changes are never overwritten. Owner runtime is not enabled by a failed readback.

First `no-offer` visit while the exact activity remains saved/inactive; one real same-scope fetch,
one distinct page and custom event, no proposition/display/interaction assumed. For a positive
attempt, only after reviewed prerequisites: fresh exact activity/offer checks and narrow **state/
schedule** endpoints. Do not PUT the whole activity or metrics, so the owner Page Delivery edit
is never replayed/overwritten. Snapshot current state/schedule privately; schedule one bounded
test interval (at most one hour), approve and read back. No property/environment/default edits.
Current offer contents and goals are reused unchanged; no goal creation or offer overwrite.
If the Page Delivery change prevents delivery, record missing decision and stop rather than
changing the owner's rule.

The site's browser module accepts exact config and host-created reserved slot. Fetch only the
approved scope with automatic display/render/click collection off. Validate one TGT HTML
proposition, exact scope and known harmless content hash established from the current owned
offers. Strip/reject active tags, handlers, URLs and unexpected structure before touching DOM.
Actual connected/visible rendered content precedes native DISPLAY. A real browser click sends
one distinct custom link through lazy ACDL and one native INTERACT retaining id/scope/scopeDetails.
No render/no offer means no display/interact. The current display goal is count-once; there is
no interaction goal yet, so interaction submission is not called a downstream click outcome.

The smoke module may return bounded in-memory raw synthetic correlation data to the isolated
runner; console/stdout/public committed output exposes only fixed status/counts. Capture no
auth headers, unrelated cookies, owner login state or broad HAR. Existing Playwright fresh
contexts only. Denied-consent branch records actual blocked attempts/local guard vs vendor
behavior separately. Maximum one visit per case, 16 Adobe browser requests overall, no application
resends. Stop on unexpected routing, budget excess, active content, errors or duplicate page hits.
Phase wrappers/timeouts are bounded; ACDL returns void and its downstream result is observed
through report queries, not an invented promise.

Downstream Analytics: exact page/custom labels from an invented run ID, separate
`variables/page` + `metrics/pageviews` and `variables/customlink` + `metrics/occurrences` ranked
MATCH queries, original approved suite timezone, fixed traffic interval. No SDK labels contain
customer/resource identity. Record actual matched rows and observed count; absent after finite
wait means unverified, not fabricated success or loss. Observe at 0/5/15/30/60/120-minute offsets;
do not resend to force receipt. Manual Target native exports can be requested only after traffic;
submission/DOM/Edge response remain different evidence columns from downstream Target outcomes.
Do not mark broad baseline DONE from this partial journey.

### Implementation deliverables and entry

Tests-first implementation and passing independent compliance, craft and architecture reviews
are mandatory **before any live deployment, Target mutation or SDK traffic**, including the
initial no-offer visit. The exact private deployment/stage plan is also reviewed before applying.
Reconciliation and DONE occur after recording real results, never in place of those pre-live gates.

`probes/adobe-compatibility/stock-site.mjs`: fixed browser-compatible entry with exported
validation/journey functions for tests and explicit site wrapper integration. No Node/credential
dependency or arbitrary external importer. The runner constructs its module URL from the
fixed same-origin relative vendor path, not from JSON. Only minimal helpers if clarity requires.
`test/adobe-stock-site.test.js`: meaningful real browser DOM/SDK-stub and refusal/payload/order
tests using existing runner/tools; no private fixtures. Parent-controlled deploy/SDK/operator
scripts live privately until a reusable reviewed CLI contract warrants a committed tool.
Documentation must distinguish tested stubs from real subsequent stock execution.

**DoR:**
- [x] Pinned stock exports, local control logic and exact-suite report queries grounded.
- [x] Owner live execution and fresh unchanged-routing confirmation available.
- [x] Independent frame review of renewal evidence, deployment scope and partial-proof boundary.
- [x] Synthetic input/DOM/SDK fixtures prepared in `test/fixtures/adobe-stock-site.json`;
      actual assertions are written first by the implementer.

**Acceptance Criteria:**
1. The strictly opt-in entry deploys and serves exact pinned assets/config on the authorized site;
   normal/default/invalid visits load no stock SDK and preserve original page behavior.
2. Tests witness real failure before implementation for config/window/input refusal, safe DOM
   qualification, consent/case stimuli, correct stock signatures, native payload order and
   duplicate/error/budget stopping. No fake render or assumed click.
3. The operator can execute the scoped real attempt under a reviewed private plan, with current
   ready preflight, owner settings preserved, exact state/schedule and serving window recorded.
   Failed delivery or receipt remains explicit, with no live success inferred from fixtures.
4. Record actual Analytics query outcome status and separately classified Target decision/render/
   notification/report evidence. At least the real journey is attempted; mandatory inability to
   establish scope/served bytes/consent stops before traffic and leaves this criterion unfinished.
5. Operator stop disables test code and reports actual activity state. Successful active finish
   is permitted only with its explicit bounded schedule; failures pause the activity as needed.
   No resource deletion, whole-activity replay, production publication or hidden cleanup failure.

**DoD:**
- [x] Code tests red-to-green and targeted preflight/frozen-core checks pass.
- [ ] Frame, compliance, craft, architecture and reconciliation evidence recorded.
- [ ] Real deployment/journey status, limitations and exact remaining 051-02 obligations recorded.
- [ ] Clean persistent handoff; private selectors/captures never committed.

## Assumptions

EDS can serve the exact same-origin module/assets from the new code paths; actual browser/CSP
checks will establish this after disabled deployment, before traffic. The owner Page Delivery
configuration may affect custom-scope delivery; the attempt observes it rather than guessing
or overwriting the rule. Adobe report latency/outcomes are not inferred from API access.

### Browser contract selected before tests

`isOptIn(url, allowedOrigin)` is a pure boolean predicate: canonical HTTPS origin/root,
no fragment/userinfo/port, exactly four canonical query keys (any order), fixed version/case,
`airlock05102-[a-f0-9]{32}`, and literal `consent=decline`. Use it in the root bootstrap
**before fetching public config or importing this entry**; the entry rechecks it.
`validateConfig(config, nowMs)` returns a boolean for the exact fixture keys, enabled/current
UTC window, literal custom scope, bounded org/datastream strings, one or two unique lowercase
SHA-256 offer hashes, and `vendorPin:"alloy-2.31.1"`. Optional `publicAssetPins` is a closed
object containing only `aemMartech`, `alloy`, `acdl`, each matching the pins above.
Unknown/accessor/prototype fields fail closed. Disabled config is not eligible.

`createStockEntry({config, runnerConsent, slot?, loadIntegration?, clock?})` returns a
synchronous entry with `eager()`, `lazy()`, `delayed()`, boolean `ready`, immutable sanitized
`result` snapshots and **private-only** `getObservation()`. Consent is explicitly `"grant"`
for the three collection cases or `"deny"` for no-consent, independently of URL decline.
The URL is always the actual browser location, not an option. Loader and
`clock:{now,setTimeout,clearTimeout}` are module-only test seams, never JSON/URL settings.
The default loader imports only `./vendor/aem-martech/index.js`, in eager after eligibility.
It selects the seven real stock exports, never SDK rendering/selector helpers.
Only one eligible entry per fresh page can initialize. The host may supply an empty connected
DIV slot; otherwise the entry creates its own. It reserves 320×180, uses parsed/imported safe
nodes (no innerHTML assignment), and creates its own control button outside vendor content.
Only simple div/p/button/span markup without attributes except button `type="button"` and
span-only `data-airlock-readiness="[A-Za-z0-9_-]{1,100}"` is accepted. The inert readiness
attribute is removed from parsed nodes before DOM import. Original bytes must pass browser
SHA-256 qualification; active/foreign/ambiguous content fails before DOM insertion.
Connected visible DOM after a paint precedes DISPLAY. Lazy sets ready only after ACDL loads
and awaits one trusted browser button click; synthetic dispatch/click does not qualify.
Non-render/no-offer use the same ordinary control without notifications.

Each phase is single-use and ordered eager→lazy→delayed, at most 10 seconds, with a 30-second
journey deadline capped by the enabled window. Failure, repeat/out-of-order phases, timeout,
or expiry stop subsequent module effects; already dispatched SDK work cannot be recalled.
Denied collection records four attempted/locally guarded operations and actual stock consent
denial, not vendor enforcement proof. Counts mean submissions, including rejecting calls;
void ACDL cannot acknowledge its asynchronous listener. Public result contains only fixed
category/case/phase enums, counts and false downstream/deployment claims. Observation retains
private synthetic page/custom labels, raw decision response, original identity and exact
qualified/rendered HTML in memory for the isolated runner, never console/public output.
Application submission counts are not the 16-request browser budget: the parent runner
must count actual vendor requests/retries and stop/close the page at that live ceiling.

### Implementation facts / TDD witness — 2026-10-09

Workflow helper confirmed READY_FOR_IMPLEMENTATION and transitioned this slice to IN_PROGRESS
before edits. The detail contract above preceded tests. Initial attempted red was **not a valid
behavior witness**: Vitest rewrote a browser callback's dynamic import to a server-only helper.
Discarded the first module draft, corrected browser module-script injection and synthetic routes
(fragment-stripping and wrong-origin fixture serving), then reran **with no module present**:
59 failed / 0 passed, including `isOptIn/createStockEntry is not a function` and the missing-export
assertion. Reimplemented only after that valid red witness. This instrumentation correction is
explicitly recorded rather than presenting the first harness error as acceptance evidence.

- First authoritative green: 59 browser tests passed. Added four bounded metadata/contract/error/
  drift tests; additive scopeDetails JSON arrays witnessed the precise failure
  `expected 'invalid_proposition' to be 'pending'` before allowing bounded plain JSON arrays.
  Final new suite: **63 passed / 0 failed**.
- Targeted new + local 051-05 + four preflight/workspace suites + frozen-core:
  **651 passed / 0 failed**, seven files.
- Full default suite: **2533 passed / 0 failed**, 127 files.
- New test ESLint, explicit recommended/browser-global lint for the ignored probe, and module
  syntax check passed. Corrected one test call-layout lint error; no lint configuration changed.

Implementation is `probes/adobe-compatibility/stock-site.mjs`, with real Chromium DOM/crypto/
trusted-click SDK-stub tests in `test/adobe-stock-site.test.js` and operator README. Public-source
inspection reconfirmed the exact pinned export signatures, void ACDL, and official Alloy 2.31.1
hash/support for `clickCollectionEnabled` and `autoCollectPropositionInteractions`.
No vendor SDK was executed, private file read, credential access, live call, deploy/commit/push,
Target mutation, review artifact, memory update or closed-slice edit occurred.

Only the code-validation DoD box is complete. AC1 deployment/served pins, AC3 real attempt,
AC4 Analytics/Target outcome classification and AC5 actual stop remain parent-owned and **open**.
Independent implementation/architecture/private-plan reviews precede live work. Verify the
root eager placement while preserving original page code: hidden body/slot cannot earn DISPLAY.
Actual browser-request budget enforcement and private downstream queries remain runner obligations.

### Pre-live compliance corrections / TDD witness — 2026-10-09

Independent compliance identified two blockers; added two real Chromium regressions **before**
changing implementation. Red: **2 failed / 63 skipped**. Bare trailing `#` wrongly returned
eligible (`expected true to be false`, test line 150). A visible slot with a CSS-hidden offer
DIV wrongly completed eager (`expected 'pending' to be 'render_unconfirmed'`, test line 177).

The URL predicate now rejects the raw fragment delimiter, including when `URL.hash` is empty;
the README's pre-import/pre-config guard mirrors this. Visibility now recursively checks every
offer descendant's computed visibility/opacity/display, hidden flag and dimensions before
render confirmation or page/DISPLAY submission. The CSS regression exercises immediate and
nested hidden/transparent descendants plus nested display:none; all yield zero render-confirmed,
page and DISPLAY counts. No public API, payload, pin, timeout or privacy boundary changed.

Green: **65 browser tests**, **653 targeted stock/preflight/frozen-core tests** (seven files),
and **2535 full-default tests** (127 files), all passing with zero failures. Regression-test
ESLint, explicit recommended/browser-global probe lint and module syntax check also pass.
No new dependency, live operation, private access, mutation/commit, agent or review artifact.
Slice remains IN_PROGRESS; independent re-review and all live gates remain parent-owned.

### Clipping correction / TDD witness — 2026-10-09

Independent review found positive dimensions/styles could still earn DISPLAY for an offer
translated completely below the 180px overflow-hidden slot. Added a Chromium negative and a
partially visible nested-content control before implementation. Red: **1 failed / 1 passed /
65 skipped**; `expected 'pending' to be 'render_unconfirmed'` at test line 210 for
`#airlock-stock-slot > div { transform:translateY(200px) }`.

Every offer element's rectangle now has to retain a positive intersection with the viewport
and all applicable ancestor client clipping boxes, independently by overflow axis
(`hidden`, `clip`, `auto`, `scroll`). The reserved slot box is mandatory. Borders/scrollbars
are excluded; axis scaling is accounted for in viewport coordinates. Partial rectangle
visibility remains eligible; no pixel-perfect or occlusion claim, markup expansion or API change.
Regression covers the slot, all four clipping overflow values on an outer ancestor, and
off-viewport translated content: each retains positive dimensions but yields zero render-
confirmed/page/DISPLAY counts. Allowed partly visible nested div/p content still completes.

Green: **67 browser tests / 655 targeted stock/preflight/frozen-core tests**, seven files,
zero failures. Test ESLint, recommended/browser-global probe lint and syntax passed.
The previous full-default run passed **2535 tests**; per owner's follow-up, no redundant full
run after this targeted green. Parent owns the separate wrapper deadline/head corrections.
No live/private operations, dependencies, commits, review artifacts or state promotion.

### Default browser timer correction — 2026-10-09

Parent reported a stopped first attempt with zero initialization/consent/fetch/Adobe requests
and verified forward-disabled config. Reproduced independently with invented config, actual
imported ModuleNamespace stub exports and default Trusted Types policy, **no injected clock**:
red `expected 'Illegal invocation' to be undefined`, test line 302. Native Window timers were
stored on the clock object then called with that object as receiver; setTimeout failed before
init, and finally clearTimeout threw outside the fixed report boundary. Tests with injected
clock wrappers concealed the production-only fault. Default timer arrows now explicitly call
`window.setTimeout` and `window.clearTimeout`; no error suppression or contract change.
The regression also exercises an intentionally rejecting stub init with production timers,
expecting `integration_rejected` without a thrown exception. No vendor SDK executes.
Targeted green: **68 browser / 656 combined tests**, zero failures; test lint/syntax passed.
This fixes the reproduced timer fault, not proof of any subsequent live SDK or product outcome.
Parent owns disabled-site disposition and new reviews before another attempt.

### Deviation log (after reconciliation)

Approved inert-span correction: parent reported current owned hash-matching HTML was a readiness
span, rejected by the div/p/button-only whitelist. Synthetic regression witnessed red
`invalid_proposition` instead of `pending` (test line 133) before allowing only inert spans and
the bounded double-quoted readiness attribute, stripped before DOM import. Attribute/content
values are invented; no private HTML, identifiers, SDK/live calls or deployment accessed.
Unapproved hashes and unsafe/unknown/empty/oversized/URL-valued attributes still fail closed.
Original HTML remains private in-memory evidence, not the sanitized DOM serialization.
This is a narrow requested contract correction, not downstream receipt or live success proof.
Green: **70 browser / 658 targeted tests**, zero failures. Test lint, module syntax and diff
checks passed. No repeated full suite; code changes require renewed independent review.

**Subsequent real execution:** Required pre-live compliance/craft/architecture and corrective
supplements passed before every deployment/retry. Actual no-offer ran the official SDK with four
Adobe requests, no proposition/render/notifications. Corrected positive ran five requests, one
owned hash-matching TGT offer visibly rendered, one page/DISPLAY, trusted-click custom and native
INTERACT. Two earlier failed-positive requests are included in the total11/16. Real DOM/
submission is distinct from downstream outcome; exact Analytics rows remain unobserved during
scheduled finite waiting, and owner native Target report confirmation is pending.

Actual public test config is disabled/served-byte verified; the activity remains approved as
the owner permits until its bounded end 2026-10-10T01:19:24Z. No whole-activity/metric/offer
replay or Page Delivery alteration. Temporary isolated clone cleaned after verified remote
persistence; private baselines/captures/pins retained. Reconciliation remains pending.
Instrumentation/red-witness correction is recorded above; no acceptance/scope reduction, new
dependency, vendor fork, general framework or resource operation. Nothing new requires an inbox
spec. Do not infer deployment/receipt/reviews or complete 051-02 from these passing stub tests.

### Reconciliation sweep

Owned paths: `stock-site.mjs`, `adobe-stock-site.test.js`, synthetic fixture, operator README,
this slice/06 verdicts, open051 overview/plan/tasks, R-012, primer and derived board. Updated
current actual deployment/journey/stop evidence, retaining failed attempts and all code TDD.
Inherited reframe/01/04/05 records/accepted ADRs/core/contracts/conventions are deliberately
excluded from this stage's edits; original stock/product gates remain unchanged. Reference
repo source/vendor deployment is separately committed, not vendor code inside Airlock.
Wrapper automation nit is retained: committed tests exercise module; parent manual intercept
tests cover only selected exact-wrapper default/disabled/stall behavior, not every failure.
No synthetic or HTTP success is promoted to downstream receipt; finite waiting remains separate.

**Final observation/budget handoff:** Both exact-suite page/custom report checks still returned
no matched rows at their completed 120-minute checkpoints. Receipt is not observed within the
window, not proven lost; no SDK events were resent. Target report counts remain unverified.
The observation helper exited, site code remains disabled, and retained bounded activity
approval's serving interval has ended. Recorded usage reached approximately10,123 credits,
exceeding the requested ceiling in delayed accounting; no more implementation/diagnosis starts.
This slice remains IN_PROGRESS, with final reconciliation and full baseline/product gates open.

### Close-out (post-DONE)

- [ ] Keep partial live stock evidence separate from complete baseline/product qualification.
