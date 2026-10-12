---
status: READY_FOR_REVIEW
dependencies: [051-01, 051-04, 051-06, adr-0031, adr-0032]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: adobe-adoption-goal
---

## Slice 051-02 — reproducible stock wire baseline

**Goal:** An integrator can reproduce pinned stock Adobe journeys and compare actual
outbound requests, responses, rendering, negative controls and performance with the chamber arm.

**Owner-approved reframe — 2026-10-12:** [ADR-0032](../../decisions/adr-0032-airlock-boundary-acceptance.md)
replaces mandatory downstream report receipts with boundary conformance. Reporting/attribution
is a nonblocking [056 follow-up](../056-adobe-product-workflow-validation/spec.md).
The original eight criteria's deployment, repeatability, event/notification correctness,
controls, isolation, cleanup and performance scope survives. Criteria 3/4 now measure
actual wire/response/host behavior rather than waiting for vendor report processing.
The former fifteen-export, fourteen-hour polling plan is retired, not an Adobe requirement.
Prior draft/history is preserved in Git at `c9008a6` and the dated [R-012](../../research/R-012-adobe-first-compatibility.md)
record; closed 051-01/04/05/06 and their evidence are unchanged.

### Established inputs versus remaining work

051-06 is DONE. It supplies deployed pinned assets, real stock no-offer/positive attempts,
safe offer rendering/trusted click, private native request bodies and independent disabled stop.
The new headed positive has ordinary Analytics page/custom count one each in its original
interval. The native seven-day Target export has two cumulative Scoped displays in
owner-confirmed Development; it does not establish a per-run delta or click-goal outcome.
These observations are reusable evidence, not completion of the operator/control/performance
contract below. 051-03 chamber experiments have not run.

The owner authorized continuation beyond the original 10,000-credit stop. The historical
overrun remains recorded, with actual usage tracked; the eight-active-hour 051-03 cap remains.
The owner permits a successful bounded activity to finish approved with test code disabled.
Failure/control pauses still apply. No resource, profile, routing, ingestion or publication
authority is added by this reframe.

**DoR:**
- [x] Reviewed preparation utility and initial stock pins/response/rendering path exist.
- [x] Owner approved the boundary acceptance change; ADR-0032 is accepted.
- [ ] Revised frame and exact wire-comparison/operator contract independently reviewed.
- [ ] Versioned private inputs, approved fixture projections and all applicable source freshness verified.
- [ ] Exact stock cases, endpoint/payload/result rules, finite observation limits and performance instrumentation frozen.
- [ ] Preparation/traffic/stop plan approved for only the needed owned resources and reference paths.

**Acceptance Criteria:**
1. **Plan before apply.** A no-mutation inspection/plan lists exact resource reuse, proposed
   changes, effects, approvals, costs and private journal location. Apply refuses unbound plans.
2. **Repeatable scoped resources.** Reuse only the approved owned fixtures; verify ownership,
   current content/state and pins, refuse collisions/drift, and retain IDs privately.
   Unsupported administration remains explicit/manual, not silently bypassed.
3. **Pinned collection wire and return path.** Actual official SDK page/custom requests
   carry the expected final XDM, Adobe data, identity/consent and selected routing. Verify
   request dispatch and result/error behavior with a receiving endpoint and live approved
   Adobe positive. Neither pre-serialization input nor HTTP success alone satisfies this.
4. **Pinned Target round trip.** Fetch the real owned proposition, render safely in the
   reserved slot, and verify native DISPLAY/INTERACT on actual wire with returned
   id/scope/scopeDetails and real render/trusted-click ordering. No-render emits neither;
   GA4 exposure is not a substitute. Goal provisioning/report counts are not required.
5. **Negative controls.** Real SDK no-consent/no-offer/non-render cases establish absence
   of forbidden egress/notifications and explicit returned outcomes within the chosen
   finite window. Positive sensitivity makes those assertions non-vacuous. Distinguish
   host guards from SDK-native denial; record failures/retries rather than hiding them.
6. **Independent isolation.** Verify suite/datastream and Target environment/workspace/
   property bindings separately from AEP sandbox choice. Only authorized test resources.
7. **Private evidence and independent stop.** Captures/IDs stay local, public reports use
   fixed safe fields, and the dry-run cleanup names exact owned operations. Independently
   disable the site and perform applicable pause/compare-controlled inverse on failure;
   disclose unknown writes, conflicts and incomplete cleanup. No deletion/reset/replay.
8. **Measured baseline.** Record stock versus no-martech observations under equivalent
   conditions, including eager wait/rendering and main-thread work, sample failures/noise.
   No Airlock improvement, field CWV or release performance band is inferred from this stock baseline.

### Implementation contract

Use one fixed-scenario Node ESM operator `probes/adobe-compatibility/stock-baseline.mjs`
with existing Playwright/Vitest; reuse the reviewed stock-site/harness and preflight
validators where their contracts fit. No new SDK host, framework, arbitrary script/URL
loader, production provisioner or frozen-core/connector change belongs here.
Private parent helpers from 051-06 are prior art, not silently accepted public tooling.
Tests first, followed by compliance/craft/architecture and exact operational plan review.

Operations are `plan`, `prepare`, `verify`, `run`, `observe`, `restore`; `--help` is static.
Each planned operation binds input/source/report/code hashes, exact selectors, current
owned baseline, allowed paths/endpoints and write projections, stage expiry and inverse.
A real preparation `ready` report is necessary but not mutation/deployment authority.
Observe reads only this run's capture and performs no SDK resend or activation.
Restore has an explicit dry-run list and no resource-deletion command.
Refuse unknown flags, duplicate keys, bad schemas, foreign paths, missing evidence and
concurrent execution. Exclusive owner-only journals are created before writes.
Input/report/lock schema must be fixed before implementation, not invented at apply time.

#### Scope, pins and configuration

- Reuse the exact dedicated preview, suite, datastream, Target property/workspace/
  Development environment, known A/B activity and two offers in private state.
  Platform/Profile, AJO, Audience Manager and event forwarding stay disabled for this run.
  Configuration API diagnosis is stopped; reviewed manual routing evidence is valid.
- Use unmodified Alloy **2.31.1** SHA-256
  `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`,
  pinned `aem-martech` `1aa3dee3c4791636efa9ad2994342f861c8e149b` and ACDL **3.0.1**
  `c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c`.
  The reference Alloy file lacks the official trailing LF; do not call them byte-identical.
  Keep original license and separately record source/decoded served-byte provenance.
- Renew only genuinely supplied owner observations. Never relabel historical screenshots,
  approval or configuration evidence with run time. Read exact current fixture/offer hashes.
- Preserve Page Delivery, goals, offer contents and original site consent behavior.
  No click-goal or audience creation is needed to assert native notification wire.
  Date/state changes and config enable windows remain exact reviewed operations.
  Do not round-trip a whole activity to change goals or erase unseen owner settings.
- Default/invalid/disabled page visits load no SDK. Stock opt-in remains root-only,
  explicit runner grant/deny and canonical case/run query, no automatic consent grant.
  Extend the existing wrapper for measurement only through reviewed tests; no normal-page drift.

#### Wire oracle and evidence rules

Freeze a closed request/result inventory from pinned SDK source, actual stock captures
and scenario requirements before implementation. Match exact allowed scheme/host,
method and action path, including **only source-grounded regional variants**; bind
org/datastream/decision scope and deny extra/duplicate routing keys. No arbitrary server URL.

Record request bodies at **dispatch**, after SDK serialization and trusted policy,
plus receiving-endpoint evidence and status/response/result/error/order. A local receiving
sink verifies real bytes and count; stub fulfillment alone is not live Adobe acceptance.
Positive Adobe access/response is exercised on the approved fixtures without relying on
vendor report exports. Record a successful protocol response's relevant returned data
and any explicit error envelope; do not ignore server rejection because reports are optional.

Produce a stock evidence artifact 051-03 can compare against, with:
- Exact raw private request/response and corresponding input, fixture and SDK pin.
- Path-specific semantic assertions for XDM types, page/custom mapping, notifications,
  consent, tenant/identity, duplicates/retries and ordering.
- An explicit normalization table: paths, reasons and consistency checks for SDK request IDs,
  timestamps and per-context synthetic identity. Independently generated identities need
  semantic/continuity checks, not cross-arm equality. No wildcard identifier stripping.
  Proposition references must link to each arm's returned identity; routing/event content
  cannot be normalized away. Normalizations remain unverified until tested.
- Separate classifications for real stock execution, worker execution, stub/local-sink
  assertions, live protocol responses and optional downstream observations.

The existing 051-06 sends decisions with top-level `decisionScopes`, disables automatic
display/click collection and bundles DISPLAY with the page after qualified visible rendering.
Custom link is ordinary `__adobe.analytics.linkType:"o"`/`linkName`, without page mapping;
ACDL returns void, not a transmission acknowledgment. Native INTERACT is a separate request
after the trusted click, preserving proposition identity. No SDK renderer with broad selectors.
An incompatible existing helper is fixed/tested or reported blocked, never used as a false oracle.

#### Cases, timing and limits

Retain all five scenario groups: no-consent, no-offer, qualified-but-not-rendered, functional
positives, and stock/no-martech measurement. One fresh context each for the three controls,
three functional positives and five interleaved stock/no-martech measurement pairs:
maximum **16 contexts**, 11 stock installations and 10 consent-granted contexts.
Already captured 051-06 evidence may ground predicates/pins, not pass unexecuted controls.

No-offer uses the exact scope while the known activity is inactive in the approved
active-only environment; never invent a foreign scope. Non-render must actually fetch
and qualify the owned offer while avoiding DOM insertion and native notifications.
Consent-negative distinguishes init/consent-only calls from collection, including actual
SDK rejection/guard behavior. Add positive/negative oracle mutation tests so removed
notification/route/consent checks cannot leave the suite green.

There is **no reporting-derived three-hour spacing or fourteen-hour minimum**.
Stage transitions await actual cleanup, isolated contexts, reviewed configuration
propagation and complete wire/response capture, not report-counter polling.
Only one reviewed stage runs at a time; new traffic cannot follow unknown cleanup.
Fresh source authority and allowed resource/serving windows still bound the whole stage.
No traffic retries/warm-ups or resends to manufacture outcomes.

Keep at most a one-hour known activity serving interval and disable test config after
traffic. Preserve 30-second module/10-second phase limits from the smoke; bound wrapper,
browser watch, settling/quiescence and request counts before readiness.
Observe for at least the declared module/journey and post-settlement interval; prove
no forbidden dispatch in that finite window, never indefinite vendor nonprocessing.
Unknown/late activity, unsupported callback or unmeasurable effect remains unverified.

Whole-baseline Adobe request ceiling remains **64**; count actual dispatches including
SDK retries and consent-only calls, refusing the next request before dispatch.
Freeze smaller per-case limits and total metadata/byte/browser/watchdog budgets in the
exact plan; do not replenish the whole limit across stages. Unexpected egress or duplicates
stop that case. Metadata reads are bounded/no redirects, credentials never sent to page URLs.

#### Performance and safe disposition

Record OS/browser/SDK versions and code/config hashes, 1365x768 viewport, device scale 1,
fresh contexts/cold cache, no extensions/service workers/prerender. Existing intended lab
conditions are four-fold CPU slowdown and network 1.6 Mbps down/750 Kbps up/150 ms latency.
Use five interleaved no-martech/stock pairs with the same page/slot/content and equal
instrumentation. Trace navigation, eager wait/rendering, ACDL loading, interaction and
ten seconds after it. SDK/notification correctness remains mandatory for stock samples;
report completion is not. Keep failed samples rather than replacing slow runs.

Report samples, median/range, LCP/CLS, long-task count/time, main-thread scripting,
decision wait, rendering and interaction/Event Timing where available.
Label any trace-derived blocking-time definition/interval; do not call it Lighthouse TBT,
population INP or field CWV. Worker startup/clone belong to 051-03, not invented zero values.

Compare current resource/ref hashes immediately before writes and inverse. Use non-force
forward commits only for exact reference paths. Disable and applicable activity pause/inverse
are independent attempts in an enclosing failure scope, including activation/readback failure.
Foreign later changes are preserved and reported incomplete; no blind old-snapshot restore.
Success may retain approved activity with an explicit bounded end and disabled config.
API-approved after the interval ends is not currently serving. Stop transient processes.

Public output is a fixed versioned `airlock.adobe-stock.report` with safe operation/status/
checks/counts/classifications; no selectors, URLs, correlation IDs, request bodies, tokens
or arbitrary exceptions. Exit zero proves only applicable operation checks, not baseline
or release acceptance. Fix output enums/private schemas in the tests before implementation.

### Downstream reporting follow-up

Existing ordinary Analytics and native cumulative Target counts remain valid at their
recorded scope. Optional report observations can diagnose protocol defects but are **not**
traffic-stage prerequisites, operator staffing requirements or pass criteria.
No mandatory pre/60/120 exports, counter-stability assertions, click-goal configuration,
report-source API work or polling for every performance sample. Spec 056 retains
per-run attribution/product-reporting work for a concrete future need.
No claim of vendor ingestion/exactly-once/product validation follows from wire conformance.

**DoD:**
- [ ] Fixed operator/private schemas and wire oracle independently reviewed; tests witnessed red/green.
- [ ] Original scope as owner-reframed AC1-8 met with evidence-layer classifications and real controls.
- [ ] Actual stock performance data and unknowns available for 051-03; no invented acceptance bands.
- [ ] Compliance/craft/architecture and reconciliation recorded; exact live plan reviewed before traffic.
- [ ] Evidence/stop handoff persistent; no secrets, broad authority, release/tag/version change.

## Assumptions

Version-pinned wire normalization and finite request/result/host checks can discriminate
the assigned stock/chamber semantics. They are testable requirements, not yet a working
oracle. Scenario-specific SDK identity/retry behavior and measurement noise must be
grounded before finalizing comparisons. Existing stock proof does not establish chamber parity.

### Deviation log (after reconciliation)

The open draft is re-baselined by the owner's 2026-10-12 approval and ADR-0032.
Reporting assurance is explicitly deferred, not silently declared passed. Prior failed
attempts and reporting observations remain in R-012/closed 051-06. Implementation has not
begun under this revised contract; no acceptance box or live authority is inferred.

### Reconciliation sweep

Revised frame review is required because the acceptance boundary changed. Open 051/052-057,
release/goal/live guidance point to ADR-0032; closed records and prior review verdicts remain
history. No documentation change restores a stopped SDK run or renews private evidence.

### Close-out (post-DONE)

- [ ] Give 051-03 a real comparable stock artifact/conditions and explicit limitations.
- [ ] Preserve optional downstream-reporting follow-up without blocking the boundary gate.
