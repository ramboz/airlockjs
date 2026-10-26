---
status: IN_PROGRESS
dependencies: [060-13]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 060-14 - Exercise the SDK-free PageView in a local browser

**Goal:** A developer opens one local fixture, invokes its experimental `fbq`
entry and sees real browser module-worker dispatch, an independent local
receipt and an honest browser-only result. No production/native parity claim.

**DoR:**
- [x] 060-13 supplies the separately opt-in source adapter, worker and gap report.
- [x] The bounded browser-journey frame passes independent critique.
- [x] The concrete same-origin asset/transport implementation and test plan
      are reviewed before implementation is admitted.
- [x] One finite local execution plan names the actual browser/version,
      first-party source closure, fresh owned profile and launch/stop owner.
      Use an existing independently qualified execution path or a separately
      explicit owner-supervised plan covering interruption and cleanup; a
      successful Node example or another lane's exception cannot supply this.
- [ ] The plan fixes case/send/output/deadline limits, includes cleanup in
      that interval, and qualifies no-external-send enforcement before navigation.
      No browser may be acquired while these facts are missing.

**Acceptance Criteria:**

1. A first-party page served only on literal127.0.0.1 imports the actual
   standalone adapter and same-origin module worker. Pre-ready init and two
   explicit PageViews with different page-context snapshots traverse capture,
   real serialized worker processing, host consent checks and the existing
   literal local `/tr/` receiver. No FakeWorker, direct connector call or
   Node bridge supplies browser-execution evidence.
2. Independently record the two local arrivals and their eight exact fields,
   correlated command outcomes and browser worker execution. Init emits zero;
   pending/denied and grant-without-new-command each have zero arrivals.
   A delayed local response prevents command completion until the correlated
   response; timeout/error is visible and cannot settle another command.
3. Before any page code runs, permit only the fixed local fixture/assets and
   receiver. Independent local receiving controls demonstrate allowed,
   blocked and bypass-detected behavior for the transports this page uses.
   Enforce no external browser/worker/service-worker egress; an unknown path
   or unobservable surface fails or stays inconclusive, never silently allowed.
   No vendor runtime/configuration, remote import, cookies, production URL
   navigation, ad click, form, global suppressor change or live event occurs.
4. The native Pixel is absent: inspect the declared module graph and actual
   resource/execution evidence, not only an empty `window.fbq`. A test-owned
   `fbq` facade is explicitly labelled first-party. Actual worker confinement
   and attempt/response/arrival are separate observations; Image versus Fetch,
   third-party credentials and native response behavior remain unqualified.
5. Malformed/unsupported calls, changed Pixel/URL, removed worker, extra
   request, denied consent, substituted empty result and missing receiver
   observation cannot produce a successful local-journey report. Keep raw
   synthetic values private to test evidence; public output reports outcomes.
6. Retain actual final process/worker/server/socket/profile disposition and
   external command completion. Cleanup failures/interruption are UNKNOWN
   with an exact owned handoff; no guessed/global process cleanup, profile
   adoption, credential extraction, hidden retry or deadline renewal.
   An unclosed browser does not become a passing run because payloads arrived.
7. Reuse060-13 mapping/reporting. No identity/configuration/experimental flag
   is invented to make the old fixture match, and no shared runner framework,
   Docker/profile/custodian refactor is bundled into this slice. If an execution
   prerequisite cannot be met, return that blocker and continue only independent
   source work named in the delivery queue.
   Production boots, package/build/core/contracts and060-01/C1-C9 are unchanged.

**DoD:**
- [ ] Actual browser page-to-worker-to-local-receiver evidence and controls.
- [ ] Final owned cleanup and external command completion, or no DONE.
- [ ] Targeted Meta/prototype/contract regressions and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews recorded.
- [ ] Browser/version scope, evidence limits and delivery queue updated.

**Anti-horizontal-phasing check:** The developer runs an actual browser
PageView journey and sees a local receipt, not a new browser launcher.

## Grounding

- `adapters/meta-pixel-prototype.js` already has a fixed browser module-worker
  factory, but060-13 exercised only the Node bridge; browser fit is unproved.
- `connectors/meta-pixel/pageview-prototype.worker.js` applies confinement
  before connector imports and waits for correlated response before result.
- Existing059-14 local controls are prior evidence for their own source
  epoch/transport set, not a reusable live or new-browser qualification flag.

## Assumptions

- Unverified: the exact local fixture/module/CSP/origin arrangement preserves
  the Node-proved path in the selected real browser without a core change.
- Unverified: a current permitted execution/stop path is available. This is
  an explicit entry blocker, not work automatically admitted by this draft.

### Deviation log

Concrete fixture and foreground procedure source prepared under reviewed plan.
Owner explicitly selected supervised foreground execution for both local slices;
interruption/agent loss remains UNKNOWN, not unattended cleanup qualification.
Installed bundle156.0.8078.48 is the selected cohort, not historical155.
Source/local HTTP tests are not browser evidence. Actual execution and DoD
remain pending;060-01 full compatibility requirements stay unchanged.

### Actual supervised attempt - 2026-10-26

The fixed foreground sequence was issued once after scoped plan/source reviews.
Meta preflight failed before the product worker was created; Google acquisition
was not issued because the procedure stops after a first-vendor failure.
Native whole-command exit1/8.07 seconds is separately observed by the parent.
One exact synthetic local GET independently arrived and finished with204.
The browser observed204 but did not complete response-body verification;
`unexpected-request-failure` and sanitized `unexpected-tool-error` prevent PASS.
The root protocol cause remains unresolved; HTTP204 alone is not successful
recording, and the sanitized diagnostic is insufficient to identify that cause.

Normal owned cleanup was observed: the root browser process emitted exit/close0
without signals, its exact auto-created profile was absent, and the context,
local fixture and sockets closed. No product worker, PageView journey, SDK,
vendor request or production navigation ran. The foreground exception remains
loss-UNKNOWN, not unattended ownership qualification. The failed source and raw
private output were frozen; no automatic retry or source-model pass repaired it.
DoD stays open. Next work is the narrowly named preflight recorder diagnostic,
not another browser-holder or general harness.

### Reconciliation sweep

- updated - fixed source pages/18-module serving closure, foreground procedure
  and usage distinguish ordinary Node HTTP controls from actual browser evidence.
- updated - source review found a late-worker-failure completion race in both
  page controllers. Two new failing controls preceded current adapter-health/
  intentional-dispose checks; healthy/failure cases for both vendors pass.
- updated - operational review required actual receiver/command/resource/worker
  documents in private output, then bounded retention before attaching rejected
  raw request data. Initial findings and narrow closures remain separate scopes.
- updated - actual first preflight failed, Google was not acquired, normal exact
  cleanup observed, source originals preserved and root-cause uncertainty explicit.
- no-op - full060-01/C1-C9, existing production boots/core/contracts/build/version,
  native case/authority/history, old UNKNOWNs and vendor compatibility.
- pending - actual product browser positives/negatives and final full slice review;
  no DONE or full AC pass follows from source preparation.
