---
status: DONE
dependencies: []
last_verified: 2026-11-03
kind: feature
frame_review: true
---

## Slice 061-01 - Record and compare one PageView

**Goal:** An integrator records a bounded page load and gets an honest behavioral
comparison of one native init/PageView against the existing serialized Airlock
worker/host prototype.

**DoR:**
- [x] Owner approved this limited construction milestone in a fresh session.
- [x] Exact inherited HEAD and clean state are recorded in the spec.
- [x] Existing adapter, worker, integration tests and passive recorder read.
- [x] This is new observational work, not a duplicate tracked bug.
- [x] Fresh pinned Sol frame review passed before implementation.

**Acceptance Criteria:**

1. A reusable Playwright recorder observes logical requests and available
   responses, ordering/timing, browser version, errors and selected cookie/
   storage effects. A missing body, late observation or failed load is visibly
   incomplete. No guessed 200, empty body or wire-level/hidden-retry claim.
2. Approved real-site reference loads are passive: no route interception,
   response substitution, identity seeding or fake interaction. Exact URLs,
   counts and private output destinations need current owner approval before
   loading. Use a fresh isolated browser context, never a shared profile.
3. A controlled fixture supports bounded resource interception/replay of the
   explicitly pinned runtime/configuration inputs. One native init and explicit
   PageView are compared with the existing actual module worker and host. Native
   SDK execution needs separate current approval even if upstream is intercepted.
   Local development smoke uses SDK-free fixtures and labels that evidence.
4. The report compares observed event/payload behavior, request count/order,
   transport and selected storage effects. Equal redactions or missing values
   aren't equality. Meaningful mismatches, unsupported and volatile fields are
   explicit; source/capture provenance distinguishes native, replay and mocks.
   Raw private values may be compared in memory but never appear in public output.
5. Captures use a documented private redacted format. Keep credentials, tokens,
   personal data, raw cookie values and private handles out of source/logs/chat.
   Preserve availability/type/relationship evidence without copying sensitive
   body content; redaction isn't a blanket privacy or fidelity guarantee.
6. Use ordinary finite page loads, observation/body timeouts and try/finally
   cleanup. Unknown resources and errors stay visible. No current SDK downloads,
   historical case activation, generic runner/policy registry, proxy supervisor,
   isolation programme, production changes or full-parity claim.
7. A short handoff records commands, scope, results and exact remaining live
   input. Targeted tests include request/response pairing, missing bodies,
   redaction, comparison mismatches and an SDK-free localhost real-worker smoke.
   The requested native comparison must be performed before this slice is DONE.

**DoD:**
- [x] All criteria have scoped observation evidence; requested comparison performed.
- [x] Witnessed red/green unit tests and targeted browser smoke pass.
- [x] Applicable targeted lint and existing prototype regression tests pass.
- [x] Fresh pinned Sol compliance and craft reviews pass.
- [x] Deviation log and reconciliation sweep are complete.
- [x] Fresh pinned Sol reconciliation review passes.

**Anti-horizontal-phasing check:** The operator can record a page and inspect an
actionable PageView report through one small tool, rather than collecting
unconnected parser or containment components.

## Assumptions

At framing, preserved-runtime replay behavior was unobserved. The later headed
pair supplies one native event; the earlier silent attempts remain incomplete.

## Current POC approvals - 2026-11-03

The owner approved one intercepted localhost native/worker pair using the pinned
2026-10-21 resources and existing test Pixel. The native page issues one init and
one PageView in a fresh context. Only pinned resources are replayed, upstream
vendor requests are aborted, and each page is capped at 15 seconds. Redacted
receipts go to this coordinator's private session storage.

The owner separately selected `https://erp.intuit.com/` and approved two passive
loads, capped at 15 seconds each, in fresh browser contexts. No clicks,
interception, response modification or identity seeding. The site's normal
telemetry is permitted for those two loads. Redacted receipts use the same
private destination. Neither approval permits retries or another native run.

These are current POC grants. They don't reuse 059-18's historical native grant.

The owner then approved one corrected intercepted pair. It uses the preserved
domain and exact configuration request, locally fulfilled page/resources, fresh
contexts and the same one-init/one-PageView, 15-second-per-page limit. All
upstream traffic is aborted. A new receipt preserves this run separately from
the first; it doesn't grant further retries.

After confirming that their normal Intuit browser sends two PageViews, the owner
approved one visible-browser passive reference load with the same URL, fresh
context, no interaction/interception and 15-second cap. The owner also approved
one final visible-browser controlled pair with the preserved SDK/exact request,
one native init/PageView, upstream aborts and a new private receipt. No personal
browser profile, copied-request execution or further attempt is permitted.

## Initial observations - 2026-11-03

The first intercepted pair loaded both pinned resources once. It observed zero
native PageView requests and one settled request from the actual Airlock browser
worker. This is incomplete comparison evidence. Its router matched configuration
origin/path but ignored query values, so the replay doesn't establish equality
with the original configuration request. The preserved configuration's domain
differs from localhost. That is a provenance gap, not a proven cause of silence.

Both approved passive reference loads completed without interception or clicks.
They observed 104 and 100 logical requests in Chromium `151.0.7922.34`.
Neither observed a Meta PageView endpoint request. Body-read-limit/body-timeout/
response-not-observed flags remain visible in the private receipts. These two
loads aren't usable native PageView goldens and don't authorize another capture.

The corrected headless pair replayed the exact configuration request once with
zero query mismatches. It still observed zero native PageView requests and one
Airlock localhost PageView. Native wrote an `_fbp` cookie; Airlock didn't. Other
selected storage comparisons remain unavailable. This is an observed cookie
difference and incomplete event comparison, not a demonstrated cause of silence.

## Owner-supplied positive reference - 2026-11-03

The owner supplied two DevTools request descriptions from their normal Intuit
browser. Both declare PageView, SDK `2.9.435` and the Tealium agent, with identical
document URL and blank event referrer. Their timestamps are 3 ms apart, `ec`
changes from 0 to 1, and two experiment entries change. Each has a reported HTTP
200 status, with response bodies unavailable to the owner.

This is owner-supplied evidence, not recorder-attested originals. The copied
Fetch descriptions don't establish native Fetch transport, command count,
hidden retries, the reason for two sends or vendor ingestion. Identity/cookie
values and browser fingerprint numbers are neither replayed nor copied into
source. Agent/region, identity/cookie relationships, timing metadata and
experiment fields are explicit comparison gaps for the small prototype.
Headless silence doesn't establish the site's normal behavior.

## Observed headed result - 2026-11-03

The newly approved passive load observed two GET/image PageViews with HTTP 200.
Playwright returned available zero-length response buffers for both. That
observation is distinct from the owner's unavailable response bodies. The
recorder listened for about 5.64 seconds, then settled bodies for 3 seconds.
Other request failures, body timeouts and missing observations remain in the
receipt. Several field names are still `unsupported` in this immutable capture,
which predates the safe-name expansion.

The final approved controlled pair observed one native PageView and one
PageView from the actual Airlock module worker. Native runtime and exact
configuration request each replayed once. Native used GET/image; its upstream
request was deliberately aborted, so its response is unavailable. Airlock used
GET/fetch and received a synthetic localhost 204.

Seven common fields matched in the transient in-memory comparison: `ev`, `id`,
`dl`, `rl`, `if`, `sw`, `sh`. `tz` differed. The report records 68 native-only
query occurrences absent from Airlock, including cookie/timing/SDK metadata,
experiment fields and 31 occurrences with unsupported names. Native wrote an
`_fbp` cookie; Airlock didn't. Other selected storage comparisons are unavailable.
No private values were reconstructed from redacted receipts.

The pinned runtime declares `2.9.426`; the owner's separate current-site
description declares `2.9.435`. Chromium was `151.0.7922.34`. This is an
intercepted pinned-source comparison, not equality with the current live site's
configuration, integration, identity or two-request behavior.

The original headed report mislabeled query-field differences as request order.
The immutable receipt is preserved. A hash-bound private supplement corrects
relative request order to `not-applicable` for one selected event on each side.
Final code also reports multiple-request order as `unverifiable`; it doesn't
compare query-parameter order.

Private receipts: `meta-061-headed-reference.json`,
`meta-061-headed-controlled-pair.json`, `meta-061-headed-order-correction.json`
and `meta-061-owner-reference-sanitized.json`. Earlier receipts remain preserved.
No further live approval is needed for this completed observation milestone;
none of its grants authorize another run.

### Deviation log

- The first localhost replay matched configuration origin/path only. Source
  inspection exposed that provenance gap; exact full-request matching and a
  locally fulfilled virtual origin replaced it without changing pinned bytes.
  The first result wasn't overwritten or relabeled.
- Headless runs were silent. Separately approved headed observations supplied
  the useful positive reference. Mode and actual listening time are explicit;
  detached body settling isn't counted as active observation.
- Parent reproduced a false match when both comparator inputs lacked values.
  The witnessed regression now returns `unverifiable`, preserving raw string
  comparisons without equating two redactions or missing values.
- Fresh compliance found the query-order/request-order conflation. Its focused
  regression went from two failed and one passed to three passed. A private
  correction supplements the original report without another browser run.
- Safe standard field names and bounded experiment indices are retained;
  values and arbitrary private-looking names remain redacted. Older receipts
  preserve their narrower name inventory.
- The native event is deliberately aborted, and the worker response is
  synthetic. Cookie, transport, timezone and metadata gaps are observations,
  not implementation fixes, delivery proof or full compatibility.
- All implementation used one isolated Terra child. Sol owned the frame,
  reviews and reconciliation. No old runner, isolation system, production
  change, accepted-record amendment or automatic successor was introduced.

### Reconciliation sweep

| Surface | Disposition |
|---|---|
| Recorder/fixture/report and tests | Updated only the bounded new rig surfaces and tests. All 140 targeted POC/prototype checks pass; changed-file ESLint passes. |
| Private receipts and validation | Preserved original attempts, headed positives and hash-bound order correction. New receipts are mode 0600; raw values aren't retained or committed. |
| Usage, work plan and spec | Updated commands, approved scope, source/browser epochs, observed gaps and no further execution permission. |
| Stable core, production adapter and full 059/060 records | No-op. No source/API or full-assurance criterion changed; 059-18 remains DEFERRED. |
| Architecture/accepted decisions/conventions | No-op. Reference-only tool uses existing module boundaries; no production capability, architectural decision or contributor rule changed. |
| Inbox/refinement and primers | Related historical/full-qualification residuals stay open. A bounded guide pointer is added; no old record is amended or closed by this POC. |
| Memory/coverage | No new durable memory item. Memory summary/team opt-out checked; coverage has zero gaps/dangling links and nine unchanged advisory unanchored specs. |
| Leanness | One recorder, one fixed fixture and one comparison. No supervisor, policy registry, containment programme or broader vendor rollout. |
| Reviews/lifecycle | First compliance findings preserved in git; corrected pinned Sol compliance/craft and final reconciliation pass. Normal evidence-gated completion applies only to 061. |

### Close-out (post-DONE)

- [x] Derived board regenerated and checked.
- [x] Scope/result handoff and private receipt provenance preserved.
