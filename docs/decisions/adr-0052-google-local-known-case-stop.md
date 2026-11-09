---
status: Accepted
dependencies: [adr-0050, adr-0051]
last_verified: 2026-11-09
frame_review: true
---

# ADR-0052: Known-case stop for SDK-free Google local tests

The local test must close its known requests, sockets and fixtures. It does
not have to revoke every surviving process's permission to connect locally.
Helper cleanup stays unknown/manual, and independent no-external-traffic
checks still apply.

## Status

Accepted (2026-11-09)

The parent relayed the integration owner's explicit allocation of0052 and
slug `google-local-known-case-stop` on2026-11-09 after current cross-lane
checks found no uncovered writer or competing claim. This is feature-line
numbered authoring only. It is not a main/global/remote/helper reservation,
acceptance or Chrome permission.

The local helper scaffold primitive was guarded to require that exact number
and a scaffolded project. It did not reserve, commit, fetch or push.
Formal acceptance still requires this record's actual pinned Sol frame review
and the helper record/accept/index flow.

The direct owner's exact approval question was:

> Your local-helper exception is recorded, but closing a fixture does not revoke a surviving process’s permission to make local connections. For these SDK-free tests, may I use a narrower stop condition: verify the run’s known requests, sockets and fixtures have closed, leave helper cleanup unknown/manual, and retain independent no-external-traffic checks? This would not authorize Google traffic or cookies.

The exact selected answer was:

> Use known-case stop condition (Recommended)

The original private0600/fsynced receipt is
`google-local-known-case-stop-owner-acceptance.json`, SHA-256
`30476695c601188caf28adc00988b09659dee33949702a61b9c7ba2de0a09f23`.
Its bytes remain with the accepting parent.

## Context

The owner chooses known-case closure for SDK-free local Google tests.

Accepted ADR-0051 permits unknown/manual helper cleanup while preserving
independent confinement and network-stop checks. The preceding checkpoint
left the stronger surviving-client stop/release property unqualified. Its
Node controls observed a deliberate new request to a replacement local
receiver after real fixture closure and a separate Unix-domain connection.
Those observations remain true. They establish no dispatch by closed Chrome
resources, actual helper retry, Chrome proxy or public egress.

This new choice prospectively defines the local network-stop criterion as
closure of this run's known work and resources. A surviving process's ability
to issue a new local request is not, by itself, failure of that criterion.
It is also no proof that independent no-external checks pass.

The earlier checkpoint and Accepted ADR-0051 are not rewritten or
retroactively made successful. ADR-0051 continues to govern unknown/manual
helpers. This record supplies the narrower prospective stop definition for
that local scope. Accepted ADR-0047/0048's native reference and retained-guard
rules are not imported, amended or superseded. ADR-0050's redirect and opacity
tradeoffs remain unchanged.

## Decision Options Considered

| Option | Disposition |
|---|---|
| Require permanent revocation of surviving-process local permissions | Stronger than the new owner choice. Fixture closure does not provide it, and no new custody mechanism is selected. |
| Treat root exit or a quiet sample as all cleanup or no-external proof | Rejected. Neither establishes known-case settlement, complete helpers or confinement. |
| Close known-case work/resources, accept unknown/manual helpers, retain independent no-external checks | Selected. Matches the exact new choice and keeps the remaining technical properties separate. |
| Add a runner, guardian, native proxy, retained endpoint or shared policy | Outside this bounded continuation. No new framework or policy expansion is authorized. |

## Recommended Decision

Use the known-case stop criterion only for SDK-free Google local tests on the
existing fixed foreground path.

1. Establish that the run's known requests, pending responses, tracked sockets
   and fixtures have settled or closed. Retain the actual receiver observations,
   cancellation/error outcomes, listener/socket/response state and close
   callbacks. An unresolved known request, socket, response or fixture fails
   the criterion; a producer boolean or zero-arrival sample is insufficient.
2. Preserve known browser-root ownership and observed worker/context closure,
   finite acquisition/cleanup, original deadlines and independent external
   whole-CLI completion. The new stop definition cannot excuse failure to
   close a known owned resource or supply an unknown root handle.
3. Keep `descendant_cleanup: unknown_manual`,
   `complete_descendant_cleanup: false` and agent-loss cleanup UNKNOWN unless
   independently established. Neither known-case success, root exit nor manual
   recovery proves every helper exited. Retain private exact owned handles and
   unresolved profile dispositions without scanning unrelated processes,
   killing by name, touching everyday profiles or deleting unverified paths.
4. Do not require permanent revocation of a surviving process's local
   connection permissions as this local packet's stop predicate. The old
   deliberately reissued Node request remains a counterexample to that stronger
   property. It is not automatically a failure of known-case closure.
   No exclusive endpoint custody or permanent client-revocation claim follows.
5. Retain independent no-external-traffic checks on the actual fixed path.
   Review its exact launcher/policy, source, browser cohort, request/WebSocket
   guards and independent receiver preflight. Existing source/Node evidence
   must be distinguished from actual current-browser observations. Unix-domain
   reachability or same-port replacement alone neither proves external egress
   nor clears those checks. A concrete failed current no-external check stops
   the packet.
6. Before acquisition, deliver the framed/accepted decision, current source
   and Node evidence, exact cohort hashes, known-case safety assessment and
   one concrete finite diagnostic plan to the parent for affirmative admission.
   Actual per-run guards, browser-version and independent preflight checks
   must pass before product cases. The owner answer is not unconditional
   launch permission, and historical source witnesses are not transferred.
7. Preserve one root, at most eight fixture/context pairs and workers,
   256 observed requests,24 measurement attempts,100s work and120s total
   including cleanup/publication. No retry, expanded window or alternate
   mechanism is implied. The original source/Node prerequisite checkpoint
   keeps its2026-11-10T00:31:27.370Z ceiling.
8. Retain strict observer/CSP, required-readable-primary, completed-request
   and body-verification gates. Opaque runtime HTTP remains unknown.
   Recorder evidence never supplies runtime response data. Minimal bounded
   error-path instrumentation may retain actually observed runtime/observer/
   failure/teardown ordering, but must label snapshots and unavailable data
   honestly, respect the existing budgets and avoid cross-clock causal claims.
9. No vendor/official SDK, public Google request, cookie, credential, real
   destination/label, native/chamber case, original slot/authority mutation,
   production/core/frozen contract, Meta, dependency/build/oracle, native/shared
   policy, account/deployment/system-trust or network-settings change follows.

## Consequences

The existing local path can be assessed against the work it owns and can
observe, without adding process custody. It provides no permanent local
permission revocation and no complete descendant or loss-cleanup proof.
Known-case closure and independent confinement still need their own evidence.

Historical Chrome abort causation stays unresolved. The controlled observer
ordering repair does not establish that old cause. No native bytes, CORS,
cookies, initialization, callbacks, calibrated performance, Google receipt or
full conversion follows from a local pass. Full059-01 remains
READY_FOR_REVIEW/non-clearing and059-15 remains IN_PROGRESS.

## Assumptions

- Unverified: all known current-case resources and failure paths can close
  and publish truthful evidence inside the unchanged finite envelope.
- Unverified: the exact current browser/source passes the existing independent
  no-external, observer and CSP controls. Owner risk acceptance is not evidence
  that any of those checks passed.

## Kill criteria

- A known request/socket/response/fixture or owned root/worker/context fails
  closure, or independent completion is unavailable.
- A current no-external or strict observer/CSP check fails and is relabelled
  as accepted helper uncertainty.
- A result claims complete helpers, agent-loss cleanup, permanent local
  revocation, actual unobserved runtime events or public/native qualification.
- The packet requires an unapproved framework, policy expansion, scope or
  time extension, or starts without affirmative parent admission.

## Open questions

The local stop-definition choice is answered. Current-source instrumentation,
known-case closure, independent no-external checks and parent admission remain
technical work. Do not repeat the owner question or reinstate the stronger
permanent-revocation criterion under another name.
