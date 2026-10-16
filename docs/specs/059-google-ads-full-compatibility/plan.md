# Plan - full Google Ads browser-tag compatibility

## First-journey readiness checkpoint - 2026-10-16

**Status: first slice READY_FOR_REVIEW (authoring) / not implementation-ready.**
The actual blocked-draft frame pass is recorded; it is not boundary-fit or live
authority approval. Source and executable local
baseline discovery are complete for the first journey. They establish a
reusable worker/boot substrate, not direct-conversion compatibility. Actual
native responses, transport/cookie behavior and calibrated C3 limits remain
required before implementation. Autopilot continuation does not silently
grant live advertising traffic, approve a Servo component or waive the DoR.

The integrated source base is `44fd386`; `READY-HERMETIC-1` is 155 passing
tests across the frozen contracts and existing Google/Meta seams.
`READY-WORKER-1` is a private, source-hashed build driven through the actual
exported EDS boots and genuine Chromium module workers. Every asset and sink
was fulfilled locally behind process IP/resolver denial; no native vendor SDK
was loaded. Google produced one legacy page-load request and zero requests for
a conversion, with two actual serialized event batches. Meta produced one
legacy PageView request. Both boot paths left their native global facade
absent. These are observed legacy boundaries, not a proposed implementation.
Private artifact handles are supplied explicitly by the coordinator; no path,
owned selector, cookie or raw payload is committed here.
The legacy probe's explicit host grant and headless cohort are not asserted
equivalent to the headed stock profile's native-default consent state. A
native command/consent transcript and host permission are separate inputs;
do not turn an unset native signal into an explicit granted wire value merely
because the operator permits a synthetic test.

| First-path requirement | Current evidence | Disposition |
|---|---|---|
| Site `gtag` entry and queue | `bootGoogleAds` returns the object-push handle at `adapters/eds/index.js:858-932`; the actual boot probe installed no `gtag`. `contracts/push-api.md` requires `{ event, ...params }`, synchronous void, not the native command/arguments queue. | New optional first-party facade is needed; do not change `push()` or send functions through structured clone. Native argument/readiness/callback behavior still needs path evidence. |
| Actual chamber execution | `core/airlock.js:328-379`, `core/google-ads-chamber.worker.js:43-76` and `core/connector-host.js:40-113`; the actual built worker returned the observed legacy output. | Reuse the first-import confinement, init-before-batch sequencing and serialized boundary. Existing FakeWorker tests alone are not this evidence. |
| Labeled direct conversion | `connectors/google-ads/connector.js:54-64,166-173` accepts only `page_view`; `READY-GAP-1` and the genuine worker both returned zero for a conversion. | New conversion/command state and full request sequence are required; the shipped subset is not a seed that already satisfies F05. |
| First/returning identity | `connectors/google-ads/cookies.js:34-106` reads existing identity and never writes it. The retained stock attempt has an `auid`; actual cookie creation/acceptance/lifetime is unproved. | Establish native-compatible client identity and scoped persistence. Never fabricate click IDs or count a preseed control as the first-visit path. |
| Governed request/response path | Wire workers call `host.init({})` (`core/google-ads-chamber.worker.js:57`). `core/airlock.js:432-433` calls `fetchInit(method, body)`, whose entire option shape is in `core/egress.js:52-54`. | Current path does not forward request headers or expose response bodies/redirect/credential policy. Do not pretend a GET-only, fire-and-forget request is the complete conversion. |
| Existing round-trip building block | `contracts/capability.d.ts:185-187,243-260` already defines mediated async dispatch with response text; its separate host is `core/wrapped-sdk-host.js:418-450`. The current EDS implementation returns only Content-Type at `adapters/eds/index.js:1606-1615`. | Investigate reuse with a **first-party** worker and narrow host policy, not loading the official SDK into production. It is not yet wired into this worker; full headers, opaque/script/image behavior and cookie semantics are not established by this type. |
| Independent candidate comparison | `rig/native-tag-comparison.mjs:403-554,690-692` validates both inputs against the supported producer schemas. Existing passes are exact native copies/local controls. | Add a case-specific chamber capture/qualification adapter with real worker and native-absence provenance. Never manufacture a native producer report for a chamber or normalize away missing SDK/configuration behavior. |
| Performance/readiness | C3 below and `docs/product-vision.md` require measured controls, not placement-only claims. The local worker probe was instrumented and is not a CWV baseline. | Measurement protocol is defined below; numeric overhead limits stay unpinned until baseline/calibration evidence exists. |

### Candidate boundary, not an approved API

Prefer an opt-in per-vendor facade/boot and first-party chamber over changing
the shipped subset in place. Keep native command interpretation, mapping and
response interpretation off-thread; keep capture/serialization, browser-owned
transport/cookies and application callbacks narrowly mediated on the host.
The event-payload and standalone boot/config carve-outs in ADR-0017 are useful
investigation seams, not blanket authority to widen a frozen type or grant.

No stable-core contradiction has been proved. The existing async dispatch
surface is a candidate, but actual native transport/response data must decide
whether it suffices. In particular, a native measurement Script must not become
ambient main-thread vendor-code execution, and an Image's opaque observation
must not be reported as fabricated HTTP 200. Any necessary frozen-contract
change gets its own specific owner decision and superseding record.

### Proposed native capture envelope - approval required

This is a request for **two bounded paired journeys: four live cases maximum**,
not permission already granted or an executable live plan before its guard
reviews/controls pass. Each vendor has one stock case followed by one
conditional SDK-absent chamber case. The chamber slot cannot be used until its
reference, C2/C3, boundary, implementation and independent-evaluation gates
actually pass. An unused conditional slot is not another stock retry.

| Boundary | Proposed limit / required condition |
|---|---|
| Resources | Only the privately supplied owned Google Secondary Purchase action and owned Meta test Pixel; fresh isolated profiles, synthetic document/input, no Intuit/customer traffic or authenticated personal profile. Fresh read-only setup confirmation must establish the Google action is still Secondary and the owned selectors/settings are unchanged. |
| Execution | Stock uses pinned retained official bytes and generated owned-origin fixture provenance, no silent CDN/download fallback, browser spoofing or filter disabling. Candidate uses first-party code with the official SDK absent. One bounded no-send preflight precedes each live case. |
| Google commands | One stock initialization/config sequence plus **one** deliberate synthetic USD 1 purchase command; later, at most one equivalent eligible chamber sequence/purchase. **Two purchase commands maximum**, with distinct new transaction IDs and exact per-run input-to-wire checks, never a common redaction/identity token hiding a wrong ID. Include native page/config/remarketing/companion and response-linked requests. One command is not one HTTP request or one accepted backend conversion. No payment or campaign/billing mutation is proposed. |
| Meta commands | One stock initialization plus **one** PageView; later, at most one equivalent eligible chamber initialization/PageView. **Two PageView commands maximum**. No form values, enhanced matching, custom conversions, fabricated ad clicks, campaign, billing or account mutations. |
| Admission caps | At most 20 Google or 8 Meta real vendor HTTPS requests **per case**, including redirect/follow-up hops: 40 Google / 16 Meta maximum across both pairs. At most 64 total observed requests per case. Reserve admission before dispatch. These are stop ceilings, not predicted complete cardinalities. |
| Data / clock | 2 KiB request URLs, 64 KiB request bodies/headers, 2 MiB per response, 8 MiB retained aggregate bytes, and one absolute 60-second case budget through settlement/owned cleanup/output. Exceeding any limit is inconclusive, never a truncated pass. |
| One-shot authority | Reserve each slot before execution; no coordinator retry, repeat conversion, fallback event or automatic scope expansion after a failed/incomplete case. A failed stock case blocks the dependent chamber slot. Preserve actual admission/spend history and cleanup. |
| Coordination | Honor the Adobe coordinator's EDS source-push hold and arrange a nonoverlapping browser/measurement window. No shared-site source push, default-tag change or deployment is proposed. Current source pin must be explicit, not assumed after another session changes it. |
| Guard qualification | Before any live SDK admission, independently review and witness receiving-sink positive/enforced/bypass, redirect and marker-loss controls for the exact allowed surface. Existing loopback/no-send qualification alone is not a live SDK guard. Unsupported targets, transports, missing bodies or unknown destinations stop before further dispatch. |
| Ownership / privacy | Private raw originals, final browser headers/cookie attachment/blocking, response bytes/Set-Cookie/redirect/fanout relationships and completion receipt; only categories/counts in public output. All product/attribution/full-support claims remain separate. |

The Google allowlist must be case/method/transport/selector scoped to the
observed owned conversion paths, viewthrough/remarketing paths and owned
`ccm/collect` requests. **`ad.doubleclick.net/ccm/s/collect` needs explicit
case-scoped companion authority:** run-local AUID correlation was previously
accepted only as evidence about an **aborted attempt**, not independent ownership
authentication or permission to send. No broad host wildcard is proposed.
Response-supplied/redirect URLs require an observed parent and exact approved
destination/relationship; losing an ownership marker never grants wider scope.

A case passes only if all required native branches and final observations are
complete. A spent but inconclusive case remains inconclusive; this approval
would not waive missing evidence. The owner's historical one-conversion grant,
read-only source-download grant and unpaired receipts do not authorize this run.

Stock reference execution is distinct from the replacement: the isolated
reference may run the pinned official SDK and approved native response Scripts
to observe their behavior. Production chamber code must not gain ambient
main-thread vendor execution by copying that permission. If the proposed live
guard cannot enforce its declared surface, approval does not authorize a
weakened fallback; stop or consume explicitly supplied complete retained
captures instead. Merely supplying URLs/statuses or redacted/body-less HAR
records does not close response/cookie/redirect evidence.

### Evaluation and performance protocol

1. Preserve no-tag, pinned stock, and SDK-absent chamber fixtures with matched
   input, storage/consent, browser/CPU/network/cache, DOM and interaction workload.
   First/returning state must be native-only versus chamber-only, not a hidden
   stock bootstrap seeding the replacement. An instrumented flat synthetic
   fixture is diagnostic only; it cannot establish adopted-page CWV.
2. Capture original sequences, final browser-controlled evidence and host effects;
   compare action/value/currency/transaction and identity relations before
   privacy. Explicitly account for replaced executable acquisition without
   deleting required configuration, matching or response behavior.
   Live Google cases use distinct new transaction IDs to avoid an accidental
   duplicate submission; each must exactly equal its own predeclared input.
   Identical-input replay/negative controls remain offline. Any cross-case
   input-aware qualification needs its own reviewed path rule; the existing
   exact-copy comparator is not permission to normalize protected `oid` values.
3. After a complete stock capture, use byte-pinned, clearly labeled local
   response replay for repeated **offline** calibration where appropriate.
   Replayed bytes/timing are not fresh vendor responses or reporting evidence.
   No-tag/native/chamber samples and observer overhead/noise remain separate.
4. Pin the existing good-band CWV obligation and measured numerical deltas,
   main-thread/clone/startup/queue/callback/navigation/retention limits in a
   private acceptance manifest before implementation. No guessed numeric
   performance limit or synthetic-worker result closes C3.
5. Require actual serialized worker/capture/seal/dispatch and native absence;
   remove the worker, drop/duplicate/change a request, alter identity/consent,
   truncate a response and remove a redirect/fanout edge as witnessed failures.
   A generic existing GA4 oracle or copied-reference pass is not the goal oracle.
6. Only after these prerequisites and slice reviews can a finite implementation
   mission and goal-specific Servo readiness/suitability proposal be prepared.
   No `.servo` approval is created or approved by this checkpoint.

## Current posture

### Offline implementation continuation

[059-13](slice-13-validation-admission.md) is DONE: the
[network-agnostic admission component](../../../rig/first-journey-admission.md)
has 150 local tests, real receiver/bypass controls and actual independent
frame/compliance/craft/reconciliation passes. The initial durability finding is
preserved, not erased. This is one-shot exact request admission, not full
SDK/browser guard qualification. No native SDK execution, vendor traffic or
first-journey implementation readiness was claimed. Complete native wire,
C2/C3, full guard and fresh explicit live authority remain required.

Adobe's 2026-10-16 cleanup handoff released its EDS source-push hold after
verified site/Target/schedule cleanup. It reported a clean config-only forward
revision; that report is not an independent live-head readback here.
Coordination is still required before any future source change or measurement
window. No source push or vendor measurement is queued by this checkpoint.

This is an **authoring packet**, not implementation approval.
ADR-0033 is Accepted for the owner's target; 058 has implemented local controls
and selected Meta/new Google attempted references, with broader
native/comparison/readiness gates open. 059-01 is READY_FOR_REVIEW; the other
eleven slices remain DRAFT.
The parent owns formal frame/architecture/compliance/craft/reconciliation review,
authority/index integration, shared 058, code discovery and trunk collision checks.
No native event, account mutation, shared-site deployment or runtime code work
is authorized by this packet.

### Original authoring grant (historical)

The original preparation ceiling was approximately 25,000 AI credits **total across parent
and both vendor sessions**, not per child, plus four active hours. Phase start
is 2026-10-15T23:34:47Z; conservative wall stop is 2026-10-16T03:34:47Z.
Finish sooner when coherent. No hard automatic credit meter is exposed to this
session; do not claim the written ceiling is mechanically enforced. Report
actual local visibility and use parent checkpoints instead of inventing usage.
That grant cannot fund a full implementation/live-event loop by implication.
The later autopilot objective authorizes continued ordinary repository work
toward the first journeys where their DoR permits it; it is not a new numeric
credit allocation, finite live-send grant or self-approved Servo loop.

## Ordered readiness and implementation plan

1. ADR-0033's frame review and acceptance are recorded; the live vision now
   separates general identity services from required vendor-cookie continuity.
   This does not satisfy implementation/evidence gates. Do not edit Accepted
   histories or reuse Adobe reporting exceptions.
2. Qualify 058-01 local receiving sink, guard, marker-loss branches, bounded
   capture drain and unreadable-body/error outcomes. Consume shared 058-02
   containment and Google-specific 058-04 for the exact native
   runtime/configuration/browser/scenario, then 058-03 value-preserving
   sequence/negative controls. Complete response/dispatch evidence remains a
   separate gate; consume each named layer.
3. Parent freezes C2 browser/cohort/critical interaction coverage and C3 numeric
   performance/host-latency/retention limits from evidence before 059-01 can
   become implementable. Reference and comparator may not generate each other's
   expected values from the replacement.
4. Parent investigates actual current code through the authorized semantic index
   and targeted citations. For 059-01, prove a bounded transport/response design
   fits ADR-0017 or obtain the requisite case-specific decision before code.
   No unverified current connector capability is a design dependency.
5. With new finite implementation authority, deliver 059-01's owned conversion
   from adopter entry through real isolated worker and governed complete response
   branches, diagnostics and independent evidence. No native fallback or mapper-
   only proxy for execution. Further owned dispatch needs its own finite grant.
6. Deliver command routing/callbacks (02), consent (03), then identity/linking
   (04). These establish the input/state/navigation contract consumed by audience
   and rich-order paths. Full basic **and** advanced behavior is already required.
7. Deliver audiences/dynamic verticals (05) and rich purchases/count/custom/
   acquisition (06) using the common state contract. Deliver manual enhanced
   matching (07), then selector/automatic/lead collection (08). Call forwarding
   (09) consumes scoped identity, consent, callback and response behavior.
8. Deliver remote automatic collection and browser/lifecycle qualification (10)
   with branch-complete references. Then deliver mixed native GA4/GTM adoption
   and explicit rollback (11), and the portfolio-level adoption decision (12).
   Numeric performance qualification is continuous, not postponed to 12.

## Dependency rationale

| Slice | Lifecycle dependencies | Reason |
|---|---|---|
| 059-01 | adr-0017, adr-0033, 058-01/02/03/04 | Stable-core authority, accepted target and exact local/native/comparison evidence before the first conversion path; attempted reference is not full response closure. |
| 059-02 | 059-01 | Extend a working end-to-end owned route to complete queue/routing/callback semantics, not a parser-only milestone. |
| 059-03 | 059-02 | Consent commands/updates need the verified queue/callback and dispatch contract. |
| 059-04 | 059-03 | Identity/linker operations depend on precise consent capture/use/revocation boundaries. |
| 059-05 | 059-04 | Audience journeys require persistent/cross-page identity and consent behavior. |
| 059-06 | 059-04 | Repeated/rich purchases require value, order, callback and returning identity correctness; no dependency on dynamic-ad serving. |
| 059-07 | 059-06 | Enhanced purchase data must join the correct complete order/counting path. |
| 059-08 | 059-07 | Automatic/selector/lead acquisition consumes the verified normalization/privacy/manual precedence contract. |
| 059-09 | 059-04 | Call lookup/cache/rendering depends on consent, callback and scoped state; no artificial dependency on commerce feeds. |
| 059-10 | 059-04 | Remote automatic events and browser/lifecycle variants depend on the common command/consent/identity path. |
| 059-11 | 059-02, 059-03, 059-04, 059-10 | Migration must preserve shared commands/consent/linker ownership and pinned remote behavior. |
| 059-12 | 059-05/06/07/08/09/10/11 | Full adoption claim consumes every complete customer path, not only the latest green subset. |

Named dependencies do not replace per-slice DoR account, evidence, performance,
architecture and authorization checks. Experimental API work remains unchosen
until inspected and reviewed. An authority conflict blocks its dependent path;
it is not a reason to silently exclude the feature.

## Reference and measurement procedure

For each owning slice, maintain a private scenario manifest with family/case ID,
positive native pin, account/terms/feed prerequisites, inputs and effective state,
actual/native-absent chamber execution provenance, expected observation surface,
finite window, path-specific nondeterminism rules, necessary product outcomes,
negative mutations and evidence retention. Commit only sanitized case IDs,
results and scope metadata.

The existing smoke is one partial positive, not a full 058 reference. Recover
missing historical outcomes only from authorized retained data. Parent local
qualification must distinguish our allowlist denial from native outcomes and
unavailable bodies from empty ones; it may not authorize a whole host after a
marker disappears. A response-supplied URL is neither automatic egress authority
nor a proof that its branch completed.

No-serving API test accounts can assist configuration work but cannot prove
collector acceptance, serving conversion metrics, matching or attribution.
Use explicit resource handles, no credential discovery. Do not request repeated
sends, fabricated clicks, periodic exports or a new account merely to make a
draft appear ready. Parent chooses the least-mutating authorized evidence route.

## Candidate mediated design boundaries

These are requirements to evaluate, **not approved APIs**:

- Destination/method/credential/redirect-scoped dispatch with response data,
  finite budgets, audit correlation and consent checks; no ambient worker network.
- Key/origin/domain/path/lifetime/purpose-scoped vendor storage operations;
  no generic identity store or arbitrary cookie jar.
- Narrow fresh linker decoration at navigation/form time, preserving handlers,
  fields and allowed domains without a late worker race or an unrestricted DOM proxy.
- Consent-gated typed extraction and bounded automatic-detection work; no eval,
  arbitrary global-variable traversal, or unbounded main-thread page scan.
- Typed response-derived phone text/tel updates and callback handles; no raw
  script/HTML execution or serialization of arbitrary callback code.

Hashing/mapping stays in the isolated chamber where feasible under the reviewed
contract; host-only browser effects stay minimal. If a concrete case cannot meet
security, CWV or the frozen API, present that one evidenced contradiction to the
owner. Full-versus-subset and basic-versus-advanced support are not open choices.

## Review and validation plan

For this authoring turn, run only read-only `frame-review-needed` to derive
flags, the existing read-only `spec_lint.py` on this folder, and
`git diff --check`; then commit this folder only. No lifecycle transition,
review verdict artifact, status-board regeneration, source test/build, .servo
change or push belongs to this grant.

Before implementation, parent formal review focuses on family/scenario completeness,
the first slice's concrete readiness, vertical independence, frozen-core authority,
non-vacuous references/mutations, browser credential/response fidelity and truthful
outcome/performance boundaries. During later implementation, each slice needs
witnessed red-to-green controls, targeted existing tests, applicable lint and
independent required reviews. Never mark those future tasks complete now.
