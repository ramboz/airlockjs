---
status: Accepted
dependencies: [adr-0045, adr-0047]
last_verified: 2026-11-05
frame_review: true
---

# ADR-0048: Google case-owned reject guard until manual cleanup

Keep one Google case's loopback endpoint reserved and rejecting after capture
until the owner confirms manual cleanup. This allows a local guard to outlive
the 60-second capture. It does not extend forwarding or prove helper exit;
crash, logout and release behavior still require qualification.

## Status

Accepted (2026-11-05)

## Context

The owner permits one case-owned local reject guard until manual cleanup.

The Google capture controller relayed a new direct answer at approximately
2026-11-05 20:37 Pacific. Its exact earlier question was:

> The remaining issue is that surviving Chrome helpers could reconnect if their local proxy port is reused. The firewall proposal is not ready, so I won’t change your Mac’s firewall.
>
> A possible no-admin alternative is a small, case-owned background guard that keeps that one local port reserved and rejects traffic until you confirm manual cleanup. It would remain after the 60-second capture; its crash/logout behavior still needs review and testing, so this is not yet a proven fix. May I implement and qualify that approach, without a new runner, administrator access or firewall changes?

The owner selected:

> Allow the local guard until manual cleanup (Recommended)

This is a new direct owner answer, unlike the earlier coordinator-answered
design proposal. It changes only the prohibition on inferring permission
for an unbounded guardian in [ADR-0047](adr-0047-google-manual-residual-cleanup.md)
rule 4 and its corresponding kill criterion. That Accepted history remains
unchanged. All its other requirements still apply, including independent
stop, unknown/manual helpers, observed root exit and honest incomplete output.

The source experiment and non-executing firewall proposal are integrated
at `52099de77757a32fdef987a44c6c2abb89b4b40b`. A different, normally trusted
same-name certificate received CONNECT in the Node model after port release.
No exclusive Chrome endpoint binding was established. Firewall access and
host-state changes are not approved.

Apple's [launch_activate_socket](https://developer.apple.com/documentation/xpc/launch_activate_socket)
returns the descriptors registered for a named job socket.
The installed `launch(3)` and `launchd.plist(5)` document launchd-held
resources while a service is absent and explicit socket node/family/protocol
configuration. The installed `launchctl(1)` distinguishes `user/<uid>` from
GUI/login domains and says a user domain may exist independently of a
logged-in user. Apple's [job guide](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
describes socket registration before service start and termination of login
agents at logout. These facts identify a candidate, not qualified current
logout, domain-removal or crash behavior.

## Decision Options Considered

### Option A: Release the endpoint after root exit
- **Pros:** Leaves no retained local job.
- **Cons:** The owner accepts possible surviving helpers, and root exit does
  not remove their socket permission. Replacement listeners remain unqualified.

### Option B: Retain a temporary case-owned reject endpoint
- **Pros:** Matches the direct answer without new privileges or environment.
  Socket activation could separate endpoint custody from guard-service life.
- **Cons:** Requires actual acquisition, endpoint identity, restart, deadline,
  logout/unload and explicit release evidence. Retained resources need a
  private recovery handoff and may remain until manual cleanup.

### Option C: Change the Mac firewall or use a new runner
- **Pros:** Could offer different enforcement mechanisms.
- **Cons:** Outside the direct approval. The firewall proposal is not ready;
  no privileged operation or alternate runner is selected.

## Recommended Decision

Select B for one bounded Google-only implementation/qualification packet.
This accepts the lifetime exception, not the unproved launchd mechanism.

1. Reserve only the exact case-owned loopback TCP endpoint. Acquire and
   independently verify it before any browser can obtain its permission.
   Never release/rebind it during capture-to-reject handoff. Require
   exclusive acquisition: a collision, wildcard/foreign address, unexpected
   descriptor or unknown ownership is a refusal, not an available endpoint.
2. Keep the existing absolute 60-second capture, admission and forwarding
   limits. After stop, expiry or controller/producer loss, cancel upstream
   work and reject locally without forwarding. Retention cannot rearm a
   lease, create another event, reset counters or admit native source.
   Crash/restart must default to rejection and cannot replay a live grant.
3. Use a temporary, uniquely named, owner-only per-user job only if its
   supported lifetime and endpoint custody qualify. No persistent login
   installation, system-domain change, unrelated service action, host-wide
   inspection or new custody framework. A private case directory and
   synthetic loopback control job may be created and removed explicitly.
4. Prove service/controller/browser-loss behavior with actual owned handles,
   attempted same-endpoint replacement and independent receiver evidence.
   Cover startup/acquisition failures, queued connections, repeated service
   failure, restart, expiry and explicit job removal. Source docs and
   sampled absence alone cannot establish no reuse gap.
5. Do not log out the shared Mac or remove a user/GUI domain to test lifetime.
   Distinguish an exact synthetic job-removal control from actual logout.
   If safe supported logout/domain-loss behavior remains unproved, report
   that concrete gate and keep current-browser/native admission closed.
   No assumption that logout kills every helper may replace evidence.
6. Retain the reject guard beyond capture until explicit manual-cleanup
   confirmation. No timer removes it. Release only the verified case job/
   descriptors, with private identity-bound recovery evidence; a fixture
   cleanup surrogate cannot release a real case's resources. Output failure
   leaves an honest unknown/incomplete result and no automatic release.
7. Preserve `descendant_cleanup: unknown_manual` and
   `complete_descendant_cleanup: false`. Successful port custody or the
   owner's cleanup report is not complete descendant proof. Keep observed
   root exit and profile disposition separately labelled.
8. No firewall/PF operations, sudo or alternate identity, trust-store or
   everyday-profile access, new runner, Meta expansion, extra original slot/
   retry or public send follows. All permission/review provenance, original
   canonical reservation, native lease, current source/setup/receiving/
   coordination/window and final-egress checks remain prerequisites.
9. Runtime implementation/corrections use explicitly pinned
   `gpt-6.1-terra`; independent Jig reviews use explicitly pinned
   `gpt-6.1-sol`. Ordinary tests are browser-free. Any later current-Chrome
   control requires its own reviewed fixed finite source/safety scope.

## Consequences

**Becomes easier:**
- The owner-approved path can retain one reject endpoint rather than prove
  complete helper exit or release an unqualified port.

**Becomes harder:**
- A case resource can persist after the capture and needs explicit manual
  release, with failures and private recovery handles retained.
- Socket activation is platform-specific. A successful service-crash control
  would not alone prove logout, domain-loss or whole-route confinement.

## Assumptions

- Unverified: the installed per-user launchd interface can acquire and retain
  the exact listener through controller/service loss without a replacement
  opportunity. SDK-free controls must falsify this before browser work.
- Unverified: the selected domain supplies adequate logout/domain-loss
  custody for possible surviving helpers. The manual's independence wording
  is not a guarantee of lifetime or complete process cleanup.
- Unverified: the final finite native transport can compose with retained
  custody without an admission/restart/descriptor gap. This packet cannot
  clear that condition by implementing a reject-only prototype.

## Kill criteria

- Another listener can acquire the admitted endpoint while helpers could
  still use it, or guard restart permits post-stop forwarding.
- The design needs privileges, a permanent login job, broader endpoint
  ownership or a new runner to satisfy its loss conditions.
- Logout/unload safety requires a claim of complete helper exit without
  evidence, or explicit cleanup can release another case's resource.
- Required private identity/completion evidence is unavailable or incomplete.

## Open questions

The owner's guard-lifetime choice is answered. Endpoint acquisition,
deadline/composition and supported loss/release behavior remain technical
qualification gates. A concrete failing control stops this packet without
another broad mechanism search or generic permission loop.
