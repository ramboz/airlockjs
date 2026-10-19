---
status: IN_PROGRESS
dependencies: [059-13]
last_verified:
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
- [ ] Witnessed red-to-green tests; hermetic and actual-browser commands pass
      with complete private receipts and exact source/cohort pins.
- [ ] Actual frame, compliance, craft, architecture and reconciliation reviews
      clear; initial failures remain in history.
- [ ] Guide and active plan explain scope, required live-policy/setup follow-up
      and actual observed unsupported/gap outcomes. No first-feature DoR waiver.
- [ ] The four approved native/chamber case slots remain unspent by this slice.

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

Pending implementation.

### Reconciliation sweep

Pending implementation.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; native/live-policy, setup, C2/C3 and both
      first-feature gates remain separate.
