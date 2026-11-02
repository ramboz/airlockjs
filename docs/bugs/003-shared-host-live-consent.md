---
status: FIXING
tier: gnarly
severity: medium
claimed_by: shared-host-live-consent
regression_test: "test/wrapped-sdk-host.test.js::revocation before the deferred capability call holds without replay"
main_repro_checked_at: 2026-11-02
main_repro_ref: origin/main@a4008d5ddb8f10b459500921bf974a064de2beca
main_repro_result: reproduces
red_confirmed_at: 2026-11-02
green_confirmed_at:
fix_class: structural_fix
security_surface: true
escalated_to:
closure_schema: 1
---

# Bug 003: shared-host-live-consent

## Symptom

The wrapped host can invoke its injected dispatch capability after governing
consent is revoked between its early check and its deferred call. The owner
is [014-01](../specs/014-mvp3-wrapped-sdk-core-integration/spec.md), with
consent and split behavior in [020-02](../specs/020-alloy-xdm-governance/spec.md)
and [034-01](../specs/034-alloy-config-followups/spec.md). This follows the
source-only finding in [R-014](../research/R-014-google-meta-request-authority.md).

## Repro

At `ebec3fc9cf25ef09af018edbe422e55b4a7e52cc`, a standalone Node
assert probe imports the real host, emits a synthetic intercepted request
through a fake chamber, revokes `analytics_storage` synchronously, and waits
for the fake capability and correlated response. It expects no call. The
observed result is one fake call and status 200; the assertion exits 1.
No network transport is present. The private session artifact holds the
probe and exact command.

## Evidence

- The host reads consent before `Promise.resolve().then(...)` invokes
  `caps.egress.dispatch`. The fake chamber invokes the message handler
  synchronously, so the caller can revoke before that continuation runs.
- The fake capability increments a counter and returns a synthetic response;
  its invocation shows the earlier approval was used after revocation.
- The Meta and Google prototype adapters expose live consent through getters;
  the Alloy adapter mutates a live consent object. The host checks a configured
  governing purpose with `egressVerdict`; the generic airlock has distinct
  non-strict and strict policy behavior.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [x] H1 (leading): the host checks live consent before deferring the call
  and does not check it again. The source order and fake-capability repro
  confirm the stale approval.
- [ ] H2: the capability is invoked synchronously before revocation, so the
  observed result is already-issued work. The probe revokes before the
  microtask runs and still records one call, falsifying this explanation.

## Root cause

The consent gate and the injected capability invocation are separated by a
Promise continuation. Changes to the live vector during that gap are not
re-evaluated. This is a host scheduling defect, not proof about a downstream
transport or vendor behavior.

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:** Searched `egressVerdict`,
`resolveConsent`, `strict`, `cookieless`, `createWrappedSdkHost`, and
`caps.egress.dispatch` in core and adapters. `core/airlock.js` has separate
strict and non-strict seal policies. `core/consent.js` provides the shared
purpose predicate. Differently named or external callers are not excluded by
these searches.

**Relevant history inspected:** `git log -S 'caps.egress.dispatch'` and
`git blame` on the host show the original wrapped-host path in `6604f2b`,
strict consent gate in `9d94206`, and personalization split in `9d0f25e`.

**Affected call sites:** `adapters/eds/index.js` constructs the Alloy host;
`adapters/google-ads-prototype.js` and `adapters/meta-pixel-prototype.js`
construct prototype hosts with live consent getters. Tests and the
coalescing broker also use the capability seam. External users are unknown.

**Reuse decision:** Keep the host's existing predicate and split behavior.
Do not transplant the generic seal's different denial semantics or introduce
a capability.

## Fix class

`structural_fix`: reapply the existing host consent decision at the deferred
capability boundary and count only calls admitted there.

## Fix

The host runs the same purpose decision again inside the deferred callback.
If the split now applies, it removes the existing per-event personalization
query before calling the capability. It checks again after the injected strip
diagnostic, which can itself change consent. A held request gets the existing
status-zero response and one consent-held diagnostic; it is not replayed.
`mainDispatch` now counts at capability invocation rather than before the
microtask, so a newly held request is not counted as dispatched.

This cannot cancel already-issued work or enforce authorization inside an
independently asynchronous capability. It does not change policy grants,
endpoint admission, vendor semantics, or public contracts.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:** The Alloy host, Google prototype, and Meta
prototype retain their wiring and use the shared host's recheck. Their focused
adapter tests pass. The host tests cover consent, endpoint and integrity
holds, correlation, response, timeout and split behavior. The coalescing
tests pass with the same capability seam. Generic `core/airlock.js` keeps its
own strict and cookieless policy unchanged. No external consumer inventory is
claimed; the recheck applies to configured host purposes.

## Already tried

The initial fake-capability repro observed one call after revocation, before
any host source change. No browser, SDK, real endpoint or private case ran.

## Regression test

`test/wrapped-sdk-host.test.js::revocation before the deferred capability call holds without replay`
uses a synthetic request and fake capability. The workflow must witness it
fail before the host change.

## Proof

The workflow's `FIXING` transition witnessed the named regression red. An
explicit run reported 1 failed, 74 skipped before the fix. After the fix,
the same selector passed (1 passed, 79 skipped). The original fake probe
reported zero capability calls, a consent-held status-zero response, and
zero dispatch count. The regression also checks later grant without replay,
already-issued work, the split, and diagnostic-triggered revocation.

The focused command below passed 8 files and 237 tests:

```sh
npm test -- --reporter=dot test/wrapped-sdk-host.test.js test/alloy-consent.test.js test/eds-boot-alloy.test.js test/egress-coalescing.test.js test/google-ads-prototype-request-correlation.test.js test/google-ads-conversion-prototype-adapter.test.js test/meta-prototype-request-correlation.test.js test/meta-pageview-prototype-adapter.test.js
```

Focused ESLint passed on both changed JavaScript files using the isolated
locked tools and a byte-identical copy of the repository config. `git diff
--check` passed. These are local fake-transport tests, not browser, native
SDK, final-wire, delivery or performance evidence. Exact private paths and
probe commands are retained in the session artifacts.

The bug remains `FIXING`. Independent bug, craft and security review,
`REVIEWED`, original-repro attestation for `VERIFIED`, and final closure
remain for the coordinator. The derived bug board needs regeneration there.

## Learning

## Main recheck

- 2026-11-02 - `origin/main@a4008d5ddb8f10b459500921bf974a064de2beca` -> reproduces: Node fake-chamber consent-repro.mjs against fresh main core/wrapped-sdk-host.js: revoked before continuation; one fake dispatch, status 200, assertion exit 1. No network.
