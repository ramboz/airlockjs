---
status: DONE
dependencies: [060-15, 061-01, 062-01, adr-0047]
last_verified: 2026-11-05
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-16 - Evaluate one pinned PageView against the actual worker

**Goal:** An operator obtains a case-bound comparison of one retained official
Pixel PageView and the actual replacement worker, with falsifiable differences
and source-backed fixes instead of an aggregate missing-field count.

The owner approved this bounded first-PageView packet and Jig ceremony on
2026-11-05. Local/no-send work is the first execution scope: retained source
reads, a reviewed finite local replay and candidate runs, deterministic
comparison/mutation tests, and directly evidenced experimental context fixes.
There is no SDK download, upstream vendor send, real-site load, deployment,
account change or full-programme loop.

This is a new bounded packet, not reuse of 061/062's spent run approvals,
063-01's grants or the guarded 059-18 additional slot. The old inspected-native
NO-GO path is not invoked. These observational browser controls do not establish
its physical network/ownership qualification. Existing full 060-01 readiness,
criteria and claim remain unchanged; this slice does not declare that full
journey complete.

**DoR:**
- [x] Shared base `0db5416ca4d5737c2594d4a4c2bad7ecebdac303` is clean.
- [x] The retained source owner supplied the original manifest explicitly.
- [x] Parent verified original runtime/configuration/config-request hashes,
  the reserved Pixel relationship and owned EDS domain without SDK execution.
- [x] Original 060-01 claim is preserved; no competing case is owned by the
  shared integration coordinator.
- [x] Fresh pinned Sol framing pass; normal readiness/claim uses the helper.

**Later execution gate:** local replay source and its exact operational
envelope must pass fresh review before the first retained SDK execution.
This gate is not cleared by source authoring or old receipts.

**Acceptance Criteria:**

1. Define one exact private first-PageView case using the retained SDK 2.9.426,
   original configuration and original observed configuration-request bytes.
   The public pins are runtime
   `d4487bcc9db399030b7089a15e37a6e755bed441992ced0716fb7f9a874e20d1`,
   configuration
   `b1720ebb329e506fd223f066353d977281280866d85e908dc2561a6c1161c46d`,
   and configuration request
   `17cfa580bd805177e3d2407a18a80bb9426e01f628233d47f11403b51b73ba32`.
   Bind exact source/entry hashes, installed headed Chromium 151.0.7922.34,
   document/context, command order, initial storage and consent inputs.
   Do not reconstruct a config URL, patch SDK/config, substitute epochs or
   adopt historical browser/profile/cookie state.
2. Implement a small case-specific recorder/reader/comparison using existing
   fixture, recorder and comparator mechanisms where their contract fits.
   Privately preserve the complete ordered query multimap, request URL/method/
   resourceType/body availability, logical dependency/configuration requests,
   response provenance and before/after state required for this case. Existing
   `unsupported` aggregation cannot erase private field names or values.
   Public reports contain approved field names/categories/counts only; unknown
   dynamic names and every private value stay private, not value-derived hashes.
3. Before execution, verify all supplied source bytes and explicit locators,
   allow only known local document/modules and the exact retained SDK/config
   responses, and abort every other page/worker HTTP or WebSocket attempt.
   Block service workers; use new nonpersistent contexts. No route continues
   upstream. Record aborted measurement attempts separately from locally
   fulfilled source/receiver responses. A synthetic response cannot become a
   native vendor response. Unknown/missing dependencies or an absent positive
   yield incomplete/inconclusive, not a match or automatic retry.
4. The retained native transcript contains one init and one explicit PageView.
   The replacement uses the actual serialized module worker, native SDK absent,
   the same approved application inputs and recorded case-specific local
   transport. Observe the worker, source closure, candidate SDK absence and
   command/result/request correlation rather than accept caller summary flags.
   Preserve and classify real endpoint/transport, consent, cookie and cohort
   differences; do not normalize loopback into vendor dispatch or Image into
   Fetch. No general live binding or URL-regex relaxation is introduced.
5. Establish source/data/cohort binding and candidate independence. A copied
   reference cannot qualify as a replacement. Invalid or stale hashes,
   source/cohort mismatch, empty positives, absent required state and unsupported
   response provenance fail or stay inconclusive with concrete reasons.
   Do not accept redacted sentinels, a source marker or self-reported grade as
   native correctness. Existing source/readback/whole-command provenance limits
   remain explicit rather than becoming an authentication claim.
6. Compare the full recorded field union and request sequence. Known generated
   values need field-specific relationships grounded in source and actual state,
   not a blanket volatile exclusion. For `_fbp`, only the existing exact-name
   experimental mediated grant may be used in the candidate's local comparison;
   each side's own cookie-to-wire relation is distinct from cross-context
   literal identity or complete cookie parity. No `_fbc`, click-ID, personal
   identity or new browser identifier is invented. Preserve default-off/live
   POC restrictions and the strict host seal.
7. Implement only proven missing functional context behavior from the retained
   source/observation, under a narrow default-off experimental flag if needed.
   Trace units, timing and state to source modules/offsets before adding a
   field. Host work captures bounded primitives; interpretation/counters and
   mapping stay in the worker. Never copy SDK-version/experiment metadata,
   spoof environment flags or guess an unknown field to make comparison green.
   Exact original prototype/POC defaults and prior selectors remain passing.
   If a candidate fix would require new authority, name that boundary instead.
8. Failing controls must detect missing/extra requests, altered Pixel/event/
   values, duplicate/reordered parameters, missing source/response/state,
   copied references, redactions and unknown cohorts. Test through real worker/
   local receiver where relevant. Source self-tests may use synthetic bytes,
   but only the explicit retained source pins may enter an actual native run.
   All test fixtures remain clearly distinguished from case originals.
9. After fresh pinned Sol source/operational review, execute at most one new
   retained-native baseline context and at most two candidate contexts
   (before/after fixes), each fresh. One init/PageView per context; no native
   retry. Use a single 90-second operation ceiling including cleanup/publication,
   with at most 64 logical requests per context, URL 8192 bytes, source/body
   response 2MiB and 8MiB retained aggregate. Reserve ten seconds for cleanup.
   If source/positive execution is incomplete, preserve the failed attempt and
   do not launch another native context. Later candidate-only local unit tests
   do not authorize a fresh native baseline.
10. Preserve private case manifests/raw data exclusively in mode-0600 files
    in a new owned mode-0700 directory. Keep public output fixed/redacted;
    never commit the Pixel, raw source/capture bytes, cookies or payloads.
    Record actual SDK/worker execution, request/response/body and ordinary
    cleanup separately. Report unresolved full-wire/native/receipt/cohort
    criteria honestly; HTTP success or local field matching cannot close 060-01.
    Finish fresh pinned Sol reviews, reconciliation, normal gates and a
    canonical-branch handoff without advancing other product journeys.

**DoD:**
- [x] Case-bound evaluator and meaningful red/green/mutation controls.
- [x] Evidence-backed scoped fixes or explicit authority/semantic blockers.
- [x] Fresh pinned source and bounded operational reviews before native replay.
- [x] At most one actual no-send baseline and truthful candidate comparison,
  or a preserved exact preflight/execution blocker without retry.
- [x] Targeted regression, final review/reconciliation and committed handoff.

## Observed case - 2026-11-05

Reviewed source `2c1099d623960e855728fe58fc08c1e3cc401884` executed once,
with admission digest
`502912a38cc525dff3d0af953946b21c99548c330a99b871e7020b9e16c3e05b`.
The pinned retained SDK ran in one fresh headed Chromium 151.0.7922.34
context; the actual module worker ran in two other fresh contexts with
preparation disabled/enabled. Each produced one PageView observation.
Native measurement was aborted; candidate Fetch used the local synthetic
relay. No measurement went upstream, and no vendor response was obtained.

The native PageView contained 77 distinct query names. The candidate had nine
with the existing local `_fbp` experiment, then eleven with worker preparation.
Native and enabled-candidate `ts`/`ec` satisfy the case-specific epoch-window
and first-event-counter relationships. Literal timestamps differ; this is not
a claim of identical timing across lifecycle scenarios. Each side's own
`_fbp` cookie matches its own wire value, not the other fresh context's ID.
Both candidates' six captured context fields match their own wire values.

`iw`, `ler` and `plt` remain missing from the candidate. A further 63 native
query entries are retained privately but not classified by this packet.
These entries are not 63 independently identified missing features.
The realm difference cannot be fixed by copying a page-realm flag;
`ler` requires separate persisted-referrer authority, and `plt` needs a
reviewed host timing/sample lifecycle. Native state contains two local-storage
entries; the candidates contain none. Their meanings/values are not copied.
Endpoint, Image/Fetch, headers, response, sequence and cohort differences remain.

Independent readback revalidated the source/input/record bindings and returned
no evidence errors. The result remains **inconclusive**, with all full-parity/
060-01 flags false. The private originals occupy 1,938,340 bytes, with exclusive
0700 directory/0600 files. Ordinary cleanup completed, with zero late/failed/
pending handles reported; the actual `browser-profile` and residual directories
were checked absent. These observations are not physical-containment proof.
The one native/two candidate operation is spent; no retry or successor follows.

Private originals and readback are indexed in this session's
`meta-pageview-060-16-case`; the redacted summary is
`meta-case-observed-summary.json`. Parent regression observed 379 SDK-free
tests across 32 files passing, with no skips. Final observed compliance and
reconciliation remain separate from the pre-execution source passes.

## Grounding

`rig/meta-behavioral-replay.mjs:16-52` already follows the explicit manifest's
preserved original roles and fixed hashes; its route and execution boundary is
`:63-137`. Its selected-field comparison and receipt cannot establish a full
reference. `rig/meta-behavioral-recorder.mjs:18-25,58-76` aggregates unknown
query names; the new private capture must not inherit that loss.
`adapters/meta-pixel-bootstrap-prototype.js:50-111` provides prior art for
fixture-style queued commands without installing a production facade.
062 records the existing local exact `_fbp` grant and its limited evidence.
No prior approval is renewed by citing these mechanisms.

## Assumptions

The pinned pair can still emit one PageView in a fresh headed installed
browser under the exact preserved config request and local/no-send routes.
If it cannot, the result stays incomplete rather than altering the SDK,
config URL, browser evidence or run budget.

The bounded source trace can establish some functional PageView context
semantics without new cookie/DOM/storage capabilities. Unverified fields or
authority needs remain named gaps and are not synthesized.

### Deviation log

- Prepared both candidate variants from the pinned static trace before the
  reviewed operation; no source fix was authored between its contexts.
- Source review found reserved-Pixel initialization, private capture,
  provenance/readback, correlation, deadline/budget and test-boundary defects.
  Remediation added real-entry and private-file mutation controls before SDK
  execution. A later review caught dependency-index pairing hiding measurement
  values; ordered measurement pairing now supplements full-sequence comparison.
- An unconditional refusal incorrectly demanded universal OS/heap guarantees.
  Fresh review corrected that interpretation without weakening operational
  limits or the separate 059-18 physical-qualification gate.
- Craft N1's failure-path context undercount was fixed and reviewed before the
  operation. Context counts now reflect observed creation, not publication.
- Initial cleanup verification checked the literal `profile`; follow-up used
  the actual `browser-profile` name and checked zero residual directories.
  The original case files were not edited to correct this verification.
- No extra storage/identifier authority or guessed SDK metadata was added.
  The remaining field, state, transport and cohort gaps are explicit outcomes.

### Reconciliation sweep

- **Updated:** owning slice, plan/tasks, operator guide, architecture's
  experimental-prototype note and shared work-plan result. Review history
  distinguishes source admission from later observed compliance.
- **No-op:** original 060-01 claim/criteria, closed 058/061/062/063 records,
  059-18 guarded-native NO-GO, earlier spent grants and receipt qualifications.
- **No-op:** core/contracts, production/EDS boots, live/owned binding limits,
  other vendors, site/account/deployment and performance optimization.
- **No-op:** oracle default/Meta profile, threshold, proposed evidence plans
  and rubric approvals. This unqualified local case supplies no full-parity
  completion executor or actual native-response truth.
- **No-op:** inbox and conventions; no in-scope parked item or contributor rule
  was resolved. Existing ADR-0047 covers the mapper boundary; architecture
  review found no new ADR-sized decision.
- **Deferred:** complete native/cohort/consent/cookie/response qualification,
  remaining field semantics and capabilities belong to their original full
  journey owners. This slice starts no successor or general keeper project.
- **Leanness:** case-specific capture and readback reuse the current prototype
  and local receiver; no general runner, stable-core abstraction or backend.
- **Advisory coverage:** no use-case gaps/dangling links; nine pre-existing
  orphan specs are outside this packet.
- **Memory-sync:** triaged the source-epoch findings into this owning record
  rather than a global rule. No new domain term or non-spec decision was
  identified. Summary/team-check completed; the existing people opt-out remains.

### Close-out (post-DONE)

- [x] Regenerate/check the board and return the immutable shared-branch handoff.
