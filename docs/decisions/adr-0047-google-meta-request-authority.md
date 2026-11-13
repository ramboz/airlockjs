---
status: Accepted
dependencies: [adr-0017, adr-0040, adr-0046]
last_verified: 2026-11-02
frame_review: true
---

# ADR-0047: Google and Meta request integrity and egress authority

Give one trusted first-party worker authority to interpret commands and build
requests. Keep live consent, destination checks and privileged operations on
the host. This avoids a second runtime mapper, but leaves mapper correctness
with reviewed code and independent native evaluation.

## Status

Partially superseded by [ADR-0061](./adr-0061-definition-of-done-vendor-compatibility.md) (2026-11-12): standing approval for test-only runs only.

Accepted (2026-11-02)

The owner approved Option C with Option D's browser admission and independent
evaluation requirements on 2026-11-02. This selects the trusted first-party
mapper boundary, not malicious-mapper resistance.
[Independent Jig frame critique](reviews/adr-0047-frame-critique.md) passed
the proposed premise. [Source/contract architecture review](reviews/adr-0047-arch.md)
passed the conditional standalone fit. Production boundary fit, native/browser
evidence and numerical limits remain open implementation gates.
The number is local/provisional until integration checks it against trunk.
Implementation remains paused; no test, browser or live authority follows.

## Context

Google and Meta need an explicit request-construction authority.

[R-016](../research/R-016-google-meta-request-authority.md) records the source
investigation at `7fe4aac0306dbc1407e22612e3b9f62e4c612c77`. Retained fake-worker
tests expect altered mediated requests to reach mock transports:
`test/google-ads-prototype-request-correlation.test.js:23-72` and
`test/meta-prototype-request-correlation.test.js:50-95`. Some Google modes
reconstruct expected fields on main (`adapters/google-ads-prototype.js:58-145`).
No tests were executed in R-016. These sources establish a local correlation
gap, not a production exploit or native incompatibility.

The host's endpoint ceiling intentionally ignores query/fragment
(`core/endpoint-ceiling.js:71-137`), so it cannot bind a Pixel ID or event value.
The first-party mappers already retain command state and construct requests
off-thread (`connectors/google-ads/conversion-prototype.js:99-163,236-265`;
`connectors/meta-pixel/pageview-prototype.js:101-164,197-237`). Their fixed worker
entries provide a smaller candidate construction authority than a second
state machine.

The fixed Node bridges disclaim adversarial sandboxing
(`rig/google-ads-conversion-prototype-node.worker.mjs:1-12`;
`rig/meta-pageview-prototype-node.worker.mjs:1-15`). [Node workers](https://nodejs.org/api/worker_threads.html)
and [`node:vm`](https://nodejs.org/api/vm.html) do not establish the required
browser boundary. Global shims leave a loader residual
(`core/egress-confinement.js:47-52`) and are mutable (`:109-125`).
Message verification, malicious-code containment and native correctness need
separate claims and evidence.

[059-01](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md)
and [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md)
remain the product owners with unchanged criteria. The paused verifier drafts
were not inspected or adopted. R-016 remains OPEN for unresolved production fit,
native/browser evidence and numerical limits.

## Decision Options Considered

### Option A: Extend host-side expected-field checks

- **Pros:** Existing Google checks show that a small schema can be checked
  locally (`adapters/google-ads-prototype.js:90-145,779-802`).
- **Cons:** Repeats vendor serialization/state on main. Partial checks cannot
  cover the complete request/state/response sequence.
- **Disposition:** Reject as the destination architecture under ADR-0040.
  Remove existing checks only with a reviewed replacement, not by accepting this decision.

### Option B: Independently provision a trusted verifier worker

- **Pros:** Can detect a candidate worker diverging from a separately trusted
  command-to-request authority without mapping on main.
- **Cons:** Requires independent loader/port identity and the complete command,
  config, agent, identity, consent and response history. It must compare zero
  outputs, counts/order, state and full serialized requests before dispatch.
  Two heaps, duplicated private inputs and state synchronization add costs.
  A shared mapper reproduces common bugs; comparing messages cannot contain
  bypass I/O. Current branch/timeout handling shows the state to replicate
  (`connectors/meta-pixel/pageview-prototype.worker.js:15-105`;
  `connectors/google-ads/conversion-prototype.worker.js:16-104`).
- **Disposition:** Conditional alternative if the owner requires integrity
  against malicious candidate mapping code. No second worker by default.

### Option C: Give a trusted first-party mapper explicit request authority

- **Pros:** Uses the retained first-party connector instance
  (`core/connector-host.js:41-90`) and fixed worker entries
  (`adapters/google-ads-prototype.js:148-165`;
  `adapters/meta-pixel-prototype.js:164-181`). Keeps interpretation/hashing off main
  with one semantic state owner.
- **Cons:** Trusts that mapper and its dependency closure for values and
  command semantics. Protocol checks do not stop a malicious trusted mapper
  sending wrong data to an allowed recipient. Separately untrusted modules
  cannot share its realm, port or grants.
- **Disposition:** Selected by the owner for the first journeys. Required
  capability enforcement, independent evaluation and readiness remain separate.

### Option D: Use browser capability enforcement and independent evaluation

- **Pros:** Establishes the real execution/capability boundary and keeps
  independent native correctness outside the runtime mapper.
- **Cons:** Endpoint ceilings alone do not bind values
  (`core/endpoint-ceiling.js:49-63`). [CSP](https://w3c.github.io/webappsec-csp/)
  distinguishes connections, script loading and worker creation; a `fetch`
  shim or `connect-src` rule alone cannot prove loader confinement.
- **Disposition:** Required alongside C, insufficient as a construction
  authority by itself. Actual deployed-browser evidence is still absent.

## Recommended Decision

**Select C with D's required browser admission and independent evaluation.**
The owner approved this trust choice on 2026-11-02. Use one trusted first-party
authority per connector. Do not add a second verifier by default. A future
requirement to withstand malicious mapping code needs a separately reviewed
authority decision; this choice does not provide that stronger guarantee.

1. **Trust explicitly.** Host, policy source, loader and first-party mapper are
   trusted. Bind authority to the host-owned worker/port and reviewed source
   closure, never a worker-supplied identity marker. Separately untrusted code
   gets no direct authority and cannot execute in that realm. Its future
   isolation/intent boundary remains unfinished. A compromised trusted host,
   build or mapper is outside C's semantic integrity guarantee.
2. **Split runtime and evaluation obligations.** Runtime enforces grants,
   live consent/destinations and complete protocol accounting. Mapper tests
   detect command-to-byte mutations; independent evaluation must qualify
   actual browser wire/response/host effects and native value relationships.
   Shared mapper tests, counters, hashes, HTTP success and callbacks do not
   prove native equivalence, receipt, matching or attribution.
3. **Keep one serialized protocol.** Use the required relationships in
   [R-016's candidate private protocol](../research/R-016-google-meta-request-authority.md#candidate-private-protocol):
   version/instance/epoch, monotonic command and committed state revisions,
   single init/readiness acknowledgment, ordered config/agent/identity changes
   with async hashing completed before dependent events, explicit zero-output
   completion, declared bounded stage counts/branch order, correlated requests
   and host responses, and a final result reconciled to the host ledger.
   The host checks metadata/envelopes, not a duplicate vendor mapping.
4. **Fail observably.** Reject unsolicited, malformed, duplicate or wrong-order
   active messages and contradictory counts/results. Retired epochs cannot act.
   Bound init/whole-command/transport deadlines. Timeout or disposal invalidates
   pending work and settles bookkeeping once; preserve partial sends, unknown
   receipt and cleanup failures. No automatic retry, restart/replay or native
   fallback. Idempotent disposal removes listeners/timers and terminates the
   owned worker. Callback timing remains evidence-derived, not a receipt signal.
5. **Recheck at dispatch.** Immediately before every actual transport call,
   after every asynchronous wait, check current host consent/policy, actual
   destination/envelope, lifecycle and operation eligibility with no intervening
   async work or untrusted callback. Tighten admitted tag restrictions without
   waiting behind slow event processing; tag grants cannot override host policy.
   Revoke cannot recall an issued request. Later grant cannot revive invalidated
   operations. If policy requires different data-use shaping, transport
   permission cannot release stale bytes; any fresh construction must follow
   separately accepted retention/remap rules. Preserve current prototype
   no-replay and stable core hold/remap behavior separately; change neither
   here. ADR-0048 remains unchanged.
6. **Admit real browser capabilities separately.** Verify worker response policy,
   loader closure and denied ambient routes. [HTML worker policy initialization](https://html.spec.whatwg.org/multipage/workers.html#worker-processing-model),
   CSP `connect-src`/`script-src`/`worker-src` and actual-browser controls are
   distinct from trusted Node plumbing. Automatic redirects can bypass a
   JavaScript per-dispatch checkpoint; keep prototype redirect rejection.
   Native-required redirects/credentials/cookies/opaque responses need their
   own evidenced bounded transport decision before implementation.
7. **Preserve contracts and budgets.** Keep mapping/hashing/state off main,
   including these paths' unload handling. Main still snapshots inputs, clones,
   tracks bounded state and validates/fulfills operations. These costs depend
   on input/request length; proxy inspection is not hard isolation. Target
   one authority worker, one active command and one outstanding branch per
   instance, with case-pinned finite queues/bytes/graphs/deadlines. These are
   proposed structural budgets. No startup/CPU/memory/latency/CWV measurements
   or numeric acceptance limits are established. Pin the full performance
   manifest before dependent implementation. Classify private protocol changes
   against ADR-0017; any frozen-surface break needs its named superseding
   decision/version treatment, not an experimental-config excuse.

R-016's [cost comparison](../research/R-016-google-meta-request-authority.md#costs-and-proposed-budgets)
accounts for startup, input/request/response copying, heaps/state and latency.
All estimates are structural and unmeasured. C avoids the second heap and
replicated state of B, but still incurs worker startup, snapshot/clone work and
sequential response waits.

The [bounded validation proposal](../research/R-016-google-meta-request-authority.md#bounded-later-validation-proposal)
separates contract fit, local mutation/fault controls, actual browser confinement
and independent native evaluation. Its first source packet left the wrapped
host and frozen declarations for the subsequently commissioned check below. No new
worker, confinement framework, implementation or validation run is authorized.

The later [Meta-first source/contract check](../research/R-016-google-meta-request-authority.md#meta-first-source-and-contract-fit)
inspected that host and the frozen declarations. It finds conditional fit for
the standalone private protocol, an earlier-gate/actual-call consent gap and
missing owned host cleanup. It does not establish production boot/unload fit,
native compatibility or numerical performance. Owner acceptance selects the
architecture; these unverified readiness conditions remain prerequisites for
dependent implementation and are not cleared by acceptance.

## Consequences

**Becomes easier:**
- One trusted owner constructs requests without repeating vendor mapping on main.
- Transport protocol failures have a host-owned ledger and finite lifecycle.
- Native correctness and browser confinement remain independently falsifiable.

**Becomes harder:**
- A mapper compromise is an explicit residual. Supporting malicious candidate
  code requires a different authority boundary, rather than stronger wording.
- Source closure, real browser policy, native references, numerical performance
  limits and contract fit remain pre-implementation work.
- Strict branch ordering can add latency; native timing may require a later
  bounded concurrency decision with evidence.

## Assumptions

- Source-grounded: fixed first-party worker entries, retained mapper state,
  off-thread identity hashing and bounded serialized request plumbing exist
  in the cited allowlisted files. R-016 did not execute them; the later Meta
  packet followed its explicitly enumerated local static source closure.
- Owner-approved trust choice: the first-party mapper is trusted rather than
  required to resist malicious mapping code. Acceptance does not establish
  semantic correctness, browser confinement or native equivalence.
- Unverified: complete browser capability enforcement, native behavior and
  numerical performance fit can be established without a frozen-surface break.
- No measured evidence justifies B's extra startup, heap and state replication
  for the first journeys. This does not establish that its overhead is negligible
  or that C is sufficient for a stronger threat model.

## Kill criteria

- The chosen design moves vendor interpretation or unbounded mapping to main.
- A message-consistency check is presented as malicious-code containment or
  native equivalence without the corresponding evidence.
- Separately untrusted code shares the trusted authority's realm or grants,
  or an arbitrary worker is admitted as production authority.
- A stale check, implicit redirect, grant-triggered replay or automatic retry
  bypasses current policy; a core contract or consent policy changes silently.
- A verifier or confinement prerequisite grows without a named first-journey
  consumer, finite exit and separate approval.

## Open questions

- What exact private envelope fits the frozen core, and which deployed loader/
  response-policy controls can the first case establish?
- Which native response/redirect and timing requirements need a separate
  authority decision? Numerical performance limits and complete references
  remain unpinned. None is inferred from this recommendation.
