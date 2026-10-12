---
status: DONE
dependencies: [051-07, adr-0032]
last_verified: 2026-10-12
kind: feature
frame_review: true
arch_review: false
---

## Slice 051-08 — observing browser request and response bytes

**Goal:** A test operator can attach a bounded recorder to an isolated browser page and
inspect actual SDK request URL/method/body and response bytes, without proxying or resending traffic.

This is an end-to-end test-runner observation interface, not an SDK host, authorizer or
deployment tool. The caller owns the already approved page/context and operation plan.
It deliberately adds the transport fields missing from 051-06's historical projections.
No retrospective reconstruction, automatic browser launch, vendor SDK import, credentials,
Target/repository writes or report query belongs here.
051-02 still owns live scenario execution/host provenance/performance; 051-03 still needs
actual worker comparison. Supplied mock Page events are not live network evidence.

**DoR:**
- [x] Existing stock recorder prototype and Playwright Request/Response APIs inspected.
- [x] 051-07 can validate recorded payload semantics independently of transport provenance.
- [x] Bounded observation/privacy/async completion contract below frame-reviewed.

**Acceptance Criteria:**
1. Start observing an explicit Page before its traffic; record real observed request
   URL, method, selected Content-Type, original POST text, observer timestamp and paired
   response status/text/timestamp or a fixed transport-error category. Do not call
   route/fetch/continue/fulfill, navigate, launch, retry or change headers/identity.
2. Enforce recorded Edge origin, action path, single selected configId/requestId query
   and POST JSON contract. Report unknown paths, routing drift/redirects, invalid/duplicate
   JSON and budget overflow as failure; observing alone must not claim to block dispatch.
3. Limit request/response/aggregate bytes, records and outstanding waits. Stop detaches
   listeners, drains already scheduled reads within a timeout, freezes an independent
   private snapshot and fixed public report. Late promises cannot mutate completed
   snapshots or turn a timeout into success. Explicit incomplete recording never passes.
4. Never inventory cookies, auth headers, owner browser storage or unrelated responses.
   Private raw transport content is accessible only through the returned private capture;
   public status has fixed enums/counts and no URLs/paths/selectors/payload/error strings.
   All SDK/render/chamber/downstream/full-conformance claims stay false.
5. Tests prove real HTTP receiving-sink request/response bytes in Chromium as well as
   synthetic failure races; fixtures alone are not labeled live Adobe/SDK/chamber evidence.
   End-to-end use is documented as a caller-owned approved test operation.

### Closed implementation contract before tests

Deliver `probes/adobe-compatibility/stock-wire-recorder.mjs`,
`test/adobe-stock-wire-recorder.test.js` and a related operator README section.
Node built-ins, existing Playwright/Vitest only; no package install, CLI or public runtime
contract change. Reuse `parseJson` for duplicate/prototype-key/depth validation; no change
to the closed preflight or checker modules. Export async
`startStockWireRecorder(page, options)`; importing it has no browser/network/file side effects.
The caller supplies a real Page; a tests-only fake Page can supply equivalent events
without creating a new production traffic seam.

Options are closed plain data: required `datastreamId`, optional `edgeOrigin`,
`maxRequests`, `maxRequestBytes`, `maxResponseBytes`, `maxTotalBytes`, `settleTimeoutMs`.
Defaults/ceilings are8/65536/65536/1048576/5000; positive safe integer limits may be lowered,
not raised. Reject unknown/getter/prototype/symbol fields without invoking accessors.
Datastream ID is a bounded nonempty scalar with no control/whitespace characters.
Its maximum is250 UTF8 bytes. Retained transport metadata has separate fixed scalar
ceilings: URL2048 UTF8 bytes, method32 bytes, Content-Type1024 bytes. Refused/oversized
scalars are null with `byte_limit` (no silent truncation); invalid routing is still failure.
`maxTotalBytes` and public request_bytes/response_bytes count original request body and
decoded response body bytes **only**, not URL/method/header metadata. The scalar ceilings
separately bound metadata overhead; they are not configurable or permission to log credentials.
Production origin is exactly `https://edge.adobedc.net`; default it explicitly.
Only canonical loopback HTTP origins (127.0.0.1 or localhost, optional valid port) are
also accepted for a **local receiving-sink test**, classified `loopback_sink`, not Adobe.
Other origins/userinfo/fragments/paths/schemes are refused before attaching listeners.
This origin selects observations, not permission to send a request; the recorder never sends.

Use Page `request`, `response`, `requestfailed` events and Request object identity
for pairing. The observation window is start through the first stop invocation; events
outside it are not silently included. Request callbacks register their record/pending
read synchronously before awaiting Content-Type, so a fast response cannot precede pairing.
Only `headerValue("content-type")` is requested, never all headers or Cookie/Authorization.
Actual request bytes come from **`postDataBuffer()`**, not lossy `postData()`.
Check Buffer length before decoding with fatal UTF8, then preserve decoded text verbatim;
valid UTF8 re-encoding must reproduce the original bytes. Missing body or invalid UTF8
is `invalid_request`, never accepted replacement text. Account original bytes, not the
replacement text's length. Do not JSON-reencode the body or call `postData()` as a fallback.
Parsed JSON is for checks only, not a replacement for the captured serialized body.

Observe requests matching the selected origin. Other Adobe `.adobedc.net`/`.demdex.net`
requests are routing drift, not ignored. Non-Adobe unrelated page requests/responses are
not collected or inspected. A redirected request is a failed recording, not a second
legitimate request. Pair response by its Request instance, not URL matching.
Paths exactly match `/ee/` + optional known region + `v1/` +
`interact|collect|privacy/set-consent`, as grounded by051-07. Query has exactly one
`configId` equal to selection and one syntactically valid UUID `requestId`, no extra/
duplicate/encoded-key normalization bypass. Canonical expected scheme/origin applies.
Wrong method/body/routing/redirect events remain explicit errors even if a later request
looks correct. Never promise the recorder aborts or enforces egress; parent gates own that.

Validate request POST text as bounded UTF8 JSON object at depth16. Response status must be
200 or204; decode `response.body()` as bounded UTF8 and preserve decoded text.204 is empty,
200 must be bounded valid JSON object. Nonempty `errors`/`errorCode`/`error` envelope
signals failed recording, never success-shaped fallback. Record warnings as raw private
response data only, without asserting processing. Read body once; failure/truncation or
service-worker response (`fromServiceWorker()`) is unverified rather than fresh network
evidence. The Page API has no inspected `fromCache()` assertion: do not invent one.
The caller's fresh/no-cache context is a separate prerequisite; the recorder makes no
independent cache/producer authentication claim. Real POST sink tests supply endpoint proof.
A response for an untracked ignored request is ignored without fetching its headers/body.
Byte limits bound accepted/retained recording data, not the browser's own network buffers.
`response.body()` returns an already buffered body; do not claim this observer caps total
browser transport allocation or can cancel a dispatched download. Reads remain bounded
in caller wait and late settlement is quarantined. An oversized response fails recording.

The returned handle is `{stop}` only. `stop()` is idempotent and returns one promise
resolving `{report,capture}`. Attach only the fixed three listeners; remove exactly those
listeners (never unrelated caller listeners) before draining reads. Catch async read/event
errors into fixed categories without unhandled rejections. At most8 tracked requests with
per-field and aggregate budgets. Overflow is recorded even if storage is capped; stop
does not quietly omit an extra event. Missing/incomplete responses fail at stop.
Use a monotonic bounded timeout covering all outstanding reads; uncancellable reads
may finish later but are quarantined, with no retained extra private/public mutations.
Multiple stop calls must return the same immutable result and must not double-detach.

Private capture is fixed-key JSON:
`kind:"airlock.adobe-stock.network-capture"`, `schema_version:1`, `source`,
`started_at`, `stopped_at`, `requests`, `errors`.
Source is `adobe_origin|loopback_sink`, a classification of observed endpoint, not a
credential/SDK provenance assertion. Each stored record is exactly:
`ordinal`, `url`, `method`, `content_type`, `request_body`, `request_observed_at`,
`response_status`, `response_body`, `response_observed_at`, `error`.
Unavailable or refused fields are null, never invented empty successful values. Error is null or
a fixed category. No functions, Request objects, raw exception or unrelated header values
reach capture. Keep record order at observed request time, not promise completion.
Errors are closed enums:
`routing_mismatch|redirect_observed|request_limit|byte_limit|invalid_request|
invalid_response|request_read_failed|response_read_failed|transport_failed|
incomplete_response|settle_timeout|observer_failure`.

Public report keys exactly:
`kind:"airlock.adobe-stock.network-report"`, `schema_version:1`, `source`,
`overall:recording_complete|recording_failed`, `exit_code:0|1`,
`counts:{observed_requests,stored_requests,completed_responses,request_bytes,response_bytes}`,
`errors` (the fixed unique enums), and `claims`.
Claims exactly/always false: `sdk_execution_verified`, `host_render_verified`,
`chamber_compatibility_verified`, `downstream_receipt_verified`,
`full_wire_conformance_verified`. A complete recording means every observed selected
record received its bounded paired response without errors; it does not independently
certify the Page/SDK producer or consent/capability checks. Zero requests is a complete
empty recording, not a passing negative SDK scenario.
Reject invalid options/Page methods with fixed Failure `invalid_input`, without path/raw
value echo or partial observer installation. Public report is a manual fixed projection.
Recursively freeze both outputs, with no caller-owned references.

Tests use an ephemeral loopback HTTP receiving sink, fresh Chromium and invented bodies.
The sink verifies actual POST bytes/method/path and sends a real JSON response; the recorder
must reproduce exact bytes/status with distinct provenance. No real Adobe credentials,
datastream, stock SDK or hidden interception/route fulfillment is used in this hermetic proof.
Cover reverse/out-of-order response/read completion, same-URL distinct requests, missing
body/status errors, redirects/routing drift, nonfinite/extra flags, read rejection/stalls,
byte and ninth-request caps, unsubscribe, repeated stop, late settlement and redaction.
A real sink case receiving malformed UTF8 inside a JSON string (e.g. byte0x80) must
make recording fail rather than substitute U+FFFD and claim original-byte equality.

**DoD:**
- [x] Tests genuinely red before implementation; real sink and targeted checks pass.
- [x] Compliance/craft and reconciliation recorded; accurate observation-only claims.
- [x] README shows start -> caller-owned approved traffic -> stop/private artifact handling,
  not automatic activation or forwarding.
- [x] Full051-02 deployment/case/collector provenance and051-03 chamber proof stay open.

## Assumptions

Playwright Page events and Request identity expose the complete observed traffic window
and paired bytes for the chosen test page. Real receiving-sink tests must establish this
for the installed version; externally injected fake events remain merely harness evidence.
The caller owns window/quiescence/approved context and chooses when to stop; this module
cannot independently authenticate the producer or guarantee later traffic never occurs.

### Deviation log (after reconciliation)

Implementation is complete with no public contract or authority deviation. The fixed
metadata scalar ceilings and body-only aggregate definition were clarified during TDD;
eight behavioral failures witnessed the correction, rather than silently changing the
meaning of a green suite. The receiving-sink tests are real HTTP/Chromium observations
but not Adobe SDK execution or provenance.

Compliance caught a terminal-DNS-dot classification gap: a dotted Adobe endpoint could
be silently treated as unrelated zero traffic. Five regressions genuinely failed before
normalizing the one terminal dot **only for classification**. Strict selected origin/
routing rejection and original private URL stay intact. Unrelated-host privacy remains.
Parent recommended lint caught an empty listener-rollback catch. The failed factory
is already quarantined (`finished=true`), so a cleanup error cannot be recorded through
the completed-state error helper. The catch documents that disposition and the factory
still rejects with fixed invalid_input; no successful handle/result is returned.
Final targeted366 tests and recommended lint pass.
No SDK/vendor/resource action, renderer/capability change or reporting dependency is added.

### Implementation TDD evidence (051-08, 2026-10-12)

- Entry checked: `READY_FOR_IMPLEMENTATION` and recorded frame verdict `pass`;
  `workflow.py transition … 051-08 IN_PROGRESS` succeeded before owned-file edits.
- RED before production: `npx vitest run test/adobe-stock-wire-recorder.test.js --reporter=dot`
  returned 107 failing behavioral tests. Missing-module handling supplied a no-op test fallback,
  so failures reached assertions, not import errors. AC1 expected the three installed events
  but received `[]`; closed-input tests expected rejection but received resolution.
  AC5 exercised actual installed Chromium against an ephemeral loopback HTTP sink and
  failed the report-schema assertion. No production recorder existed at this point.
- Initial GREEN: targeted recorder/checker/contract tests passed 350/350
  (117 recorder, 197 checker, 36 stability); explicit recommended ESLint API checks
  reported zero errors/warnings. Loopback evidence is receiving-sink proof only.
- Pending caller clarification: `maxTotalBytes` is body bytes only, not aggregate
  record strings. The current implementation/tests/README include metadata in that
  budget and must be corrected. Retained URL/method/Content-Type need explicit
  scalar ceilings or approval to reuse an existing limit; implementation paused
  rather than inventing metadata defaults. No completion checkbox has been ticked.
- Resume: caller supplied the explicit body-only budget and fixed scalar ceilings
  now recorded above (ID250, URL2048, method32, Content-Type1024 UTF8 bytes).
  Before changing production, the existing aggregate test or README,
  `npx vitest run test/adobe-stock-wire-recorder.test.js -t "clarified body-only" --reporter=json`
  witnessed 8 new failures, 0 passes, 117 skipped. The four-body-byte exact-boundary
  case incorrectly failed; oversized URL/method fields remained non-null;
  the 251-byte Unicode datastream was wrongly accepted. This is behavioral RED
  against the existing implementation, not an import failure.
- Final GREEN after clarification: `npx vitest run test/adobe-stock-wire-recorder.test.js
  test/adobe-stock-wire.test.js test/contract-stability.test.js --reporter=json`
  passed 358/358 (125 recorder, 197 checker, 36 stability). The eight new regressions
  pass: a2-byte request plus2-byte response succeeds with a4-byte aggregate budget,
  fails at3 without dropping metadata; two pairs succeed at8 bytes. Tests also check
  exact scalar ceilings and one-byte/multibyte overflow, with null refused fields,
  fixed errors and accurate original body-byte counts. The outdated metadata-aggregate
  test and README were corrected only after that RED witness.
- Final explicit ESLint API using recommended rules with Node globals for the probe,
  and Node/Vitest/browser globals for its test, reported zero errors/warnings.
  A lint directive displaced by the split condition was relocated and checks rerun.
  `git diff --check` passed. No dependencies, closed checker/parser, core or private
  artifacts were changed. Real Chromium exercised only invented loopback sink traffic;
  independent implementation/reconciliation review and full051-02/03 proof remain open.
- Compliance-fix RED before production change: `npx vitest run
  test/adobe-stock-wire-recorder.test.js -t "terminal DNS dot" --reporter=json`
  returned 5 failures, 3 passes, 125 skipped. Dotted Edge, Adobe root/subdomain and
  demdex root/subdomain requests incorrectly returned `recording_complete` instead
  of `recording_failed`. Unrelated dotted-host privacy and dotted-origin input
  rejection controls already passed. These events are synthetic, not vendor traffic.
- Compliance-fix GREEN: classification alone strips the terminal DNS dot before
  Adobe-suffix detection; raw URL capture and strict routing/origin checks are
  unchanged. All five dotted Adobe cases now record `routing_mismatch`, paired
  private original bodies and accurate byte counts, with no header inventory or
  raw public data. Unrelated dotted hosts remain uninspected; dotted selected
  origins remain invalid inputs. The same targeted recorder/checker/stability
  command passed 366/366 (133/197/36); explicit recommended ESLint API reported
  zero errors/warnings. Public schemas/claims and lifecycle status are unchanged.

### Reconciliation sweep

- **Updated:** recorder,133-case test suite, related README, open051 overview/tasks/derived
  board and R-012 classify raw-byte capture, real receiving-sink proof and false provenance
  claims consistently. Parent366 targeted tests and explicit recommended lint pass.
- **No-op:** frozen core, connectors, SDK bytes, closed07 checker/parser records, original
  private captures, credential/profile/routing/Target state and conventions. No new public
  runtime boundary or package/framework warrants a new ADR or install.
- **No-op:** reporting remains the ADR-0032 nonblocking follow-up; no export schedule,
  authenticated-browser scrape or implicit traffic authorization is added.
- **Deferred:** actual SDK/context authentication, current-source/live serving plan,
  full baseline negative/performance execution and actual chamber parity remain051-02/03.
  The recorder observes; it does not enforce, retransmit or independently prove those.

### Close-out (post-DONE)

- [x] Provide the observation interface for051-02 without claiming entire baseline parity.
