---
status: RECONCILED
dependencies: [059-13]
last_verified: 2026-10-19
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 059-14 - Browser admission and original-byte capture controls

**Goal:** An operator runs a fixed first-party browser qualification and can see
whether actual pre-dispatch admission, complete original-byte recording and
cleanup agree with real receiving sinks. This connects 059-13 to a real browser
before spending any of the owner's separately approved native/chamber cases.
It is not either product replacement or a generic browser automation service.

**DoR:**
- [x] 059-13 is DONE, with actual local receiver controls and recorded reviews.
- [x] The owner explicitly approved the conditional four-case envelope on
      2026-10-19; actual native execution still needs full guard, fresh setup and
      coordination. All four live case slots are unspent.
- [x] Adobe released the control20 hold: it reports control20 never executed.
      Its retained-source verification is not live remote/account readback.
- [x] Existing no-send references remain unchanged. Their OS-denied
      fulfill-or-abort launch path is not loosened into a live execution mode.
- [x] Node 24.10.0, Chrome 155.0.8059.80, macOS 27.0.1 / Darwin 27.0.0 were
      checked before implementation. No profile or native SDK was started.

**Acceptance Criteria:**

1. **Fixed local executable.** Add a browser admission/capture adapter and a
   fixed loopback-only qualification entry. Use a fresh owned browser context,
   explicit fixed Chrome executable, a separate process policy allowing only
   loopback IP for this qualification and denying known macOS resolver
   routes. Do not modify the existing native launcher/policy or add a live,
   arbitrary-URL, arbitrary-code or arbitrary-proxy CLI mode. The module may
   expose its adapter for a future separately reviewed executor, but must not
   claim native/live readiness from these local runs.
2. **Before-dispatch gate.** Install interception before fixture navigation.
   Each admitted root-page HTTP request, including every redirect hop, passes
   through 059-13 exactly once before continuation. Only a fixed generated
   local fixture is fulfilled, and only literal loopback scope entries can
   continue. Unknown destinations, changed selectors/ownership markers, wrong
   methods/transports and invalid parents stop and latch failure before any
   further continuation. Admission counters must reflect browser observations,
   not a separate sender's predeclared count. No broad host allowlist,
   synthetic success on error, guard removal during active execution or
   unreviewed native-SDK bytes are allowed.
3. **Original request/response evidence.** Retain the actual observed URL,
   method, transport/resource, ordered query, original request bytes (including
   binary bodies), final available headers/cookies, response status, duplicate
   headers/Set-Cookie, response bytes, redirect edges and initiator metadata.
   Keep body/header availability states explicit; missing required bytes,
   extra-info evidence or pairing cannot be an empty-body/default success.
   Respect 059-13 byte/count caps and never label a truncated body complete.
   HTTP-framed empty responses are distinct from unreadable responses. An
   opaque Image load is not independently fabricated HTTP success. Compare
   retained request/response bytes to the receiving sink, not just hash-shaped
   presence. Sink framing and browser observation must agree.
4. **Bounded settlement and supported surface.** The absolute deadline includes
   browser launch, observations, asynchronous reads, settlement, owned cleanup
   and output. Stop admitting on first failure/deadline and drain accepted work
   with interception still installed. Close the owned context before detaching
   guards and verify process exit. Unsupported popups/frames/workers/service
   workers/WebSockets and unexpected targets must not get a successful result;
   block before use where supported, otherwise stop and report an explicit
   evidence gap. Do not claim complete containment for an unwitnessed surface.
5. **Falsifiable real-browser matrix.** Exercise actual Fetch GET/POST,
   XMLHttpRequest, Image, Beacon, external Script, redirect and fanout paths
   with real local receiving sinks. Witness positive arrivals, enforced-denial
   zero arrivals and a deliberate bypass arm with nonzero arrivals, plus
   redirect re-admission, ownership-marker loss, duplicate-query/order,
   binary-POST, final cookie/header, duplicate response-header, missing-body,
   late-read/deadline, byte-limit and unsupported-surface controls.
   Tests that substitute a fake page/session alone cannot qualify the adapter.
   Every expected negative is linked to a passing matched positive and fails
   for its intended reason, not merely because an unrelated timeout occurred.
6. **Private durable output and actual completion.** Refuse existing output
   paths and unsafe permissions/symlinks; write raw receipts privately and
   public summaries with only fixed categories/counts. A success-shaped
   snapshot written before failed cleanup/output is not successful command
   completion. Record actual final exit and owned-resource closure. No raw
   cookies, payloads, authority paths, IDs or native code enter Git/chat.
   Retain all false vendor/compatibility/outcome claims; use
   `local_browser_admission` as the evidence layer, not `native_attempt`,
   `live_guard_qualified` or real chamber producer provenance.

**DoD:**
- [x] Witnessed red-to-green tests; hermetic and actual-browser commands pass
      with complete private receipts and exact source/cohort pins.
- [x] Actual frame, compliance, craft, architecture and reconciliation reviews
      clear; initial failures remain in history.
- [x] Guide and active plan explain scope, required live-policy/setup follow-up
      and actual observed unsupported/gap outcomes. No first-feature DoR waiver.
- [x] The four approved native/chamber case slots remain unspent by this slice.

**Anti-horizontal-phasing check:** An operator gets a real browser/sink-backed
admission and original-byte capture verdict through an executable local
journey, not just a pure gate or report schema.

## Assumptions

- Unverified: the pinned browser exposes the complete final headers and original
  binary request/response bytes needed by all fixed matrix transports.
  Qualify this with actual browser/sink comparison; unsupported or unreadable
  cases remain inconclusive rather than rewriting the required evidence.
- Unverified: a separately confined local browser and pre-navigation interception
  can cover the fixed matrix without creating an unguarded redirect/target
  window. Actual bypass/redirect/surface controls decide the claim.

### Deviation log (after reconciliation)

- Delivered the fixed local browser module/tests/operator guide and separate
  loopback-only launcher/policy; no runtime, frozen contract or dependency
  change. The existing no-send native policy/launcher remain unchanged.
- Three missing-module tests failed before implementation. Early local matrix
  failure exposed an incidental favicon; the generated fixture now declares a
  local inline favicon rather than ignoring unknown requests. All diagnostics
  remain private; no failed run became a qualified receipt by relabeling.
- A real binary POST/307 probe retained exact request and final-response bytes,
  final cookies and duplicate header evidence. Playwright, Fetch body capture
  and Network streaming did not expose the nonempty intermediate body. The
  qualifier stops this branch before its target; no empty/replayed surrogate
  is used. HTTP-framed empty redirects are a distinct positive.
- Initial independent compliance findings are preserved in `c667631`.
  Corrections retain fulfilled fixture originals, use observed redirect parent
  IDs, keep guards through context-close retry, sync files/directories/parent
  entries, pin admission/Playwright identity and distinguish producer results
  from independently observed actual CLI exit. Publication-failure controls
  prove a provisional zero report with no completion is not success.
- Matching unsupported-surface bypasses execute their actual frame/popup/
  worker/service-worker/WebSocket path, not a generic Fetch positive. Chrome's
  local-network-access denial initially blocked the WebSocket positive itself.
  Both guarded/bypass synthetic contexts now grant this permission only to
  their fresh literal-loopback origin; no browser security flag, vendor origin
  permission or persistent profile is changed.
- The original confined observer's unbounded losing wait was diagnosed and
  replaced with an explicit finite cutoff; failed close keeps ownership and
  guard hooks for retry. Owned WebSocket-upgrade sockets are explicitly closed.
  Stopped diagnostics are not treated as successful command completion.
- A genuine remaining transport-control confound is preserved in `4b0afd6`:
  Script GET previously mismatched a Fetch POST method. A witnessed failing
  regression now requires identical URL, GET method and empty body before
  testing the Script-versus-Fetch/XHR mismatch; corrected control passes.
- Final validation: 378 passing tests in one actual-browser-enabled run,
  focused ESLint and whitespace checks. Eight additional retained actual-exit
  command witnesses include complete cleanup and source/digest linkage.
  Frame/compliance/craft/architecture passes are real; reconciliation is separate.
- No original AC is removed. Live exact-route policy, fresh owned setup,
  headed/native-default/C2/C3 and actual chamber evaluation remain open;
  final-header checks after dispatch are not universal pre-dispatch wire caps.

### Reconciliation sweep

- **Updated:** five rig deliverables; this slice, active Google spec/plan and
  dated first-product resumption note; Meta plan/first-product resumption note;
  `CLAUDE.md`; actual review evidence and the derived status board.
- **Updated memory:** record the nonempty-redirect observation gap, scoped local
  permission and requirement for genuinely matched positive controls.
- **No-op:** runtime/core/connectors/adapters/contracts/test/build/dependency
  trees, runtime version, Accepted/closed records, architecture boundaries,
  root README, product vision, conventions and ADR index. No production module
  boundary or load-bearing production decision changes; arch review agrees.
- **No-op inbox/refinement:** existing vendor first-journey prerequisites retain
  the remaining work; do not duplicate them as a newly completed feature.
- **Deferred, not waived:** the coordinator must supply reviewed native exact
  route/response policy, fresh owned setup and a coordinated measurement window
  before a stock case; C2/C3/implementation/evaluation gate every candidate.
  The owner approval is received, not re-requested, and all four slots remain
  unreserved/unspent. Source/measurement coordination remains required after
  Adobe's actual control20 hold release.
- **Leanness:** fixed first-party fixtures/controls, no arbitrary-URL, proxy,
  SDK, generalized executable or production-config mode. Existing admission
  logic is reused; no new package, rollout flag or global setting is added.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; native/live-policy, setup, C2/C3 and both
      first-feature gates remain separate.
