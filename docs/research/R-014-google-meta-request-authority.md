---
status: OPEN
topic: Request integrity without main-thread mapping or an assumed Node sandbox
created: 2026-11-02
related:
  - ../releases/google-meta-work-plan.md
  - ../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md
  - ../decisions/adr-0043-google-meta-request-authority.md
  - ../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md
  - ../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md
---

# R-014: Google and Meta request authority

Give one first-party worker explicit authority to interpret commands and build
requests. Keep the host responsible for bounded operations, live consent and
destination enforcement. This avoids a second runtime mapper, at the cost of
trusting the reviewed mapper and its dependency closure for semantic correctness.

**Recommendation for review, source/design only (2026-11-02).** Recommend
ADR-0043 Option C, with Option D's browser admission and independent evaluation
obligations. No option is accepted. R-014 remains OPEN; integration owns its
final lifecycle disposition. Independent review, owner acceptance, implementation
and live authority are separate gates. The paused verifier drafts were not read
or imported.

## Question

What is the smallest request-authority design that preserves the required
data, destination and consent boundary while keeping mapping off the main
thread, and does it need an independent runtime verifier?

## Evidence and limits

Source state: `7fe4aac0306dbc1407e22612e3b9f62e4c612c77`. The following are
source observations, including assertions in retained tests. No test was run
or historical result requalified in this investigation.

| Evidence | Source at that base | What it establishes, and its limit |
|---|---|---|
| Forged Google requests | `test/google-ads-prototype-request-correlation.test.js:23-72` | Fake-worker label/value/transaction substitution, extra fields and duplicate labels are expected to reach a mock transport in default/remarketing modes. This is a characterization, not protection or native evidence. |
| Forged Meta requests | `test/meta-prototype-request-correlation.test.js:50-95` | Event, target, data, extra-field and duplicate-event substitutions have plausible settled summaries in default/multi-Pixel controls. No real network or compromised-browser proof. |
| Consent negatives remain separate | `test/google-ads-prototype-request-correlation.test.js:74-117`; `test/meta-prototype-request-correlation.test.js:97-138` | The retained assertions expect host/tag denial to prevent mock dispatch without replay. They do not specify native consent behavior. |
| Host mapping already exists | `adapters/google-ads-prototype.js:58-145,747-802` | Expected queries are rebuilt on main for selected opt-ins. These checks are mode-specific, not a complete correspondence boundary. |
| Meta checks transport results | `adapters/meta-pixel-prototype.js:57-150,565-624` | Selected modes check sequence, branch counts and host-response statuses. Matching those facts does not bind request values. |
| A retained mapper is available | `core/connector-host.js:41-90` | One factory instance owns state, initializes once and returns `ready`/`dropped`. Per-event exception isolation does not authenticate its output. |
| Actual command state is off-thread | `connectors/google-ads/conversion-prototype.js:99-163,236-265`; `connectors/meta-pixel/pageview-prototype.js:101-164,197-237` | Google scopes/config and Meta Pixel/agent/identity state construct synthetic requests. Meta init can await hashing. Imported helpers were not followed or independently assessed. |
| Worker protocol is already serialized | `connectors/google-ads/conversion-prototype.worker.js:6-104`; `connectors/meta-pixel/pageview-prototype.worker.js:5-105` | Busy/sequence guards, correlated responses, finite timers and zero/multiple-request results exist. They lack the complete versioned envelope proposed below. |
| Fixed loader and Node caveat | `adapters/google-ads-prototype.js:148-165`; `adapters/meta-pixel-prototype.js:164-181`; `rig/google-ads-conversion-prototype-node.worker.mjs:1-12`; `rig/meta-pageview-prototype-node.worker.mjs:1-15` | Fixed first-party worker entries and test bridges are visible. A test-injected chamber is not an authenticated production authority. The bridges explicitly disclaim adversarial Node isolation. |
| Existing destination and consent primitives | `core/endpoint-ceiling.js:71-137`; `core/consent.js:59-67,115-131` | Reusable origin/path checking and purpose-based verdicts. The ceiling drops query/fragment; it cannot bind Meta's Pixel ID, event data or a Google label. Consent policy is an input, not a universal strict-grant rule. |
| Existing confinement and legacy paths | `core/egress-confinement.js:47-52,109-125,167-199`; `core/confine-google-ads-chamber.js:23-29`; `core/confine-pixel-chamber.js:23-29` | First-import global shims reduce exposed APIs. Mutable properties and the loader residual preclude a general malicious-code containment claim. |
| Stable behavior is not this prototype | `core/airlock.js:456-551,778-841`; `core/egress.js:127-163`; `core/google-ads-chamber.worker.js:41-73`; `core/pixel-chamber.worker.js:58-137` | Stable paths have hold/remap, main-side critical mapping and an asynchronous identity channel. They cannot be silently inherited as a full-replacement lifecycle or rewritten here. |

The prototype notes preserve the same limits:
`connectors/google-ads/CONVERSION-PROTOTYPE.md:139-181,890-970` and
`connectors/meta-pixel/README.md:7-12,36-60,420-503`. No private case,
unfinished verifier, production configuration or deployed response header was
available to this mission. In particular, the adapters call an imported wrapped
host, but `core/wrapped-sdk-host.js` was outside the read allowlist. Its exact
last-dispatch and cleanup behavior is unverified here. A later boundary-fit
packet must request that file before claiming the proposed checks are wired.

## Trust and guarantee split

| Actor or failure | Proposed treatment | Required guarantee |
|---|---|---|
| Host, policy source and loader | Trusted application code. Bind a connector instance to its fixed, reviewed entry and dependency closure. Keep raw commands and response bodies out of diagnostics. | The host alone grants data/operations and dispatches. Instance IDs, hashes or message fields do not authenticate code sharing the same realm. Source pinning is a deployment obligation, not a worker self-report. |
| First-party mapper and worker runtime | Explicitly trusted for command interpretation, state transitions, normalization/hashing and complete request construction. One authority per connector instance. | Runtime protocol checks catch malformed, stale, extra or contradictory operations. They do not independently recompute every vendor field. A malicious or wrong authority can still send incorrect values to an allowed recipient. |
| Separately untrusted module | Must not run in the authority's realm, receive its port, raw inputs or transport capability, or nominate a worker entry. | No direct data/egress privilege. Any later integration needs a separately reviewed isolation and typed-intent boundary. Arbitrary-module support stays unfinished; this recommendation does not remove it from the product target. |
| Accidental protocol divergence | Treat missing/duplicate messages, wrong state revisions, bad counts and timeouts as observable failures. | Host-owned accounting at runtime; semantic command-to-request mutations in independent tests/evaluation. A plausible worker summary cannot erase observed host operations. |
| Native correctness | Independently evaluate the actual browser replacement against qualified native references. | Complete wire/response/host effects and value relationships, then separate receipt/matching/attribution claims. Trusting our mapper supplies none of these. |

The product boundary assumes the trusted host and loader remain intact. It
doesn't protect against an arbitrary same-page script replacing that host, a
compromised trusted build, browser defects or browser-process resource exhaustion.
Worker fault isolation keeps ordinary connector work off main; it is not a
hard CPU/memory quota or a security boundary between modules in one realm.

### Browser and Node are different evidence

The [HTML worker model](https://html.spec.whatwg.org/multipage/workers.html#the-global-scope)
provides a separate global and message boundary. A worker does not receive the
page DOM, but it has platform APIs and a module loader. The current shims are
useful defense-in-depth; absence of `fetch` alone is not proof of no network,
storage or fresh-realm access.

Before browser admission, establish the actual worker policy container and
loader closure. [HTML initializes worker policy from the response](https://html.spec.whatwg.org/multipage/workers.html#worker-processing-model).
In Content Security Policy (CSP), [`connect-src`](https://w3c.github.io/webappsec-csp/#directive-connect-src)
controls data connections, [`script-src`](https://w3c.github.io/webappsec-csp/#directive-script-src)
controls script loading/execution, and [`worker-src`](https://w3c.github.io/webappsec-csp/#directive-worker-src)
controls worker creation. Page `worker-src` alone does not define the worker's
internal policy. A `connect-src` restriction alone does not close module imports.
Allowed script loads can themselves carry data; CSP is not per-command value
authorization. No concrete header recipe or deployed confinement pass is claimed.

The [Node worker API](https://nodejs.org/api/worker_threads.html) supplies
parallel execution and cloning, not the browser policy model. The fixed bridges
import Node facilities before the chamber entry. Replacing globals cannot
revoke all Node module capabilities. [`node:vm` explicitly is not a security
mechanism](https://nodejs.org/api/vm.html). No Node sandbox, process/container
framework or adversarial Node run is recommended for these trusted test bridges.

## Options A-D and recommendation

| Option | Runtime work and guarantee | Cost and disposition |
|---|---|---|
| A. Extend host expected-field checks | Rebuild expected vendor requests on main, compare selected or complete fields. Existing Google code demonstrates the approach. | One worker, but repeated serialization/state rules and input-length-dependent main work. Partial checks miss omissions, duplicates and unhandled modes. Reject as the destination architecture under ADR-0033. Existing checks stay until a reviewed replacement is implemented. |
| B. Independent trusted verifier worker | Feed an independently provisioned verifier the complete authorized command, config, identity, consent and response history. Compare the candidate's complete serialized requests, zero-output results, branch graph and state transitions before dispatch. | Two workers per connector, duplicated sensitive inputs/state, extra copies, synchronization, readiness and failure modes. A shared mapper can reproduce the same error. Only verifies the mediated channel; no containment of bypass I/O. Reserve for an owner requirement to tolerate malicious candidate mapping code. |
| C. Explicit trusted mapper authority | One fixed first-party worker owns semantics. Host accepts only that instance's bounded protocol and fulfills independently gated operations. Semantic correctness is tested rather than reimplemented on main. | One mapping/state copy, no verifier startup. Accepts mapper compromise/bugs as a residual needing supply-chain control and independent evaluation. Recommend for the first journeys, subject to owner acceptance of this trust partition. |
| D. Browser capability enforcement plus independent evaluation | Establish actual browser confinement, narrow grants and independently falsifiable native comparison. | Required alongside C. Alone, an endpoint ceiling still permits altered values or a different query-based recipient. It cannot replace a construction authority or supply native correctness at runtime. |

**Recommend C with D's admission/evaluation requirements, without B by default.**
The first-party entries already provide the construction owner; the missing
work is making that trust explicit, tightening the complete protocol and
establishing the real browser boundary. Adding a second worker before choosing
the trust requirement would preserve all those questions and duplicate state.
Calling the present workers trusted does not qualify the prototypes. Production
source binding, protocol completeness and actual browser enforcement remain
unestablished.

This is a narrower integrity claim than "arbitrary compromised mapping code
cannot alter an authorized event." If the owner requires that stronger claim,
C is insufficient. Reconsider B with an independently protected authority and
the full protocol below; do not relabel C's transport checks as semantic
verification. An untrusted plugin could instead submit bounded intents to the
trusted mapper, but its intent/data authority would need a separate decision.

## Candidate private protocol

These are required relationships for later design, not new public types or
claims about implemented behavior. Keep the current one-command-at-a-time
path. Names and wire shape remain subject to boundary-fit review.

Every message is bound to the host-owned worker/port, protocol version,
connector instance and fresh lifecycle epoch. Commands add monotonic sequence,
captured immutable arguments/context and the applicable policy/state revision.
Requests add command sequence, stage/branch ordinal, unique request ID and
parent-response reference where relevant. These are correlation keys, not secrets
or proof that an untrusted sender is honest.

| Transition | Required behavior |
|---|---|
| Initialization and readiness | `starting -> initializing -> ready`, or a redacted terminal failure. Host supplies fixed source/config provenance, granted destinations/purposes/operations and finite limits. Admit a bounded pre-ready queue; no event dispatch before a single matching ready acknowledgment. Any evidence-required initialization I/O needs its own explicitly gated stage. Readiness means runtime initialization completed, not delivery, native compatibility or future health. Duplicate init/ready and incompatible versions fail the instance. |
| Config, agent and identity changes | Serialize every admitted state command with events. Mapper owns destination-specific config, agent and identity values; host tracks only acknowledgment/revision metadata and independent policy. Hashing stays in the worker. Complete asynchronous hashing before committing that revision or processing a dependent event. Failed updates cannot leave partly committed state available to the next event; uncertain commit state terminates the epoch. Clearing/replacing identity must invalidate older async results. Unsupported semantics remain visible gaps. |
| State acknowledgments and zero requests | A command whose evaluated semantics declare no send returns exactly one correlated completion with zero declared/observed request operations and a bounded reason. This includes current synthetic state commands, not every native config/init command. A terminal completion with no declared work is distinct from a missing result. Whether a vendor command should emit zero is the trusted mapper's evaluated rule, not inferred from silence or rederived on main. |
| Request plan and branches | For a mapped stage, authority declares a bounded count and ordered branch references before its requests. Bind each reference to an allowed destination/operation reference. Host records each request once, in declared order, and checks count, parent relation, byte limits and actual transport envelope. Endpoint checks use the actual URL as well as policy metadata. Metadata does not independently bind a query-based recipient; C trusts the mapper for that relationship. |
| Responses and continuation | Return host-observed attempt/dispatch/response or denied/unavailable/failure facts under the same request ID. Response bytes are bounded data, never executable code or an unrestricted URL/callback grant. Any evidence-required continuation is a new bounded stage tied to its parent response and rechecked at dispatch. A per-case graph pins maximum depth/count; unknown branches block qualification. No speculative general fan-out API follows. |
| Ordering and completion | Preserve command order and declared causal branch order. Start with one outstanding branch. Any native-required concurrency needs an explicit evaluated order rule. Distinct admitted commands with identical URLs remain distinct; do not deduplicate by URL. Final result reconciles declared, submitted, held/denied, dispatched, settled, failed and not-attempted branches against the host ledger. A partial command is not success; a count mismatch cannot be fixed by trusting the final summary. |
| Failure and stale/duplicate replies | Malformed/unsolicited messages, active-epoch duplicates, skipped/out-of-order branches or contradictory completions fail the affected instance. Retired-epoch messages have no effects and are counted in bounded diagnostics. A previously dispatched request stays in the ledger; protocol failure cannot undo it. Mapper semantic rejection is an explicit per-command outcome when state remains valid. |
| Timeouts and cancellation | Separate finite init, whole-command and transport deadlines. On timeout, close admission, invalidate the epoch and pending continuations, settle waiters/callback bookkeeping once, and abort owned transport where possible. Record dispatched-but-unobserved outcomes as unknown. Do not retry an uncertain conversion, reuse its ID, restart/replay or treat abort as evidence that no request arrived. |
| Disposal | Idempotently stop admission, invalidate the epoch, remove listeners/timers, cancel queued operations, settle waiters, abort owned work and terminate the worker. Preserve cleanup failure instead of successful closure. No pending state update, response or callback may resume dispatch. Public callback behavior still needs native evidence; callback execution remains on host and cannot prove receipt. |

For static branches, a small plan message can precede the existing request
messages without a plan-acknowledgment round trip. It contains references/counts,
not another copy of mapped bytes. Dynamic response-dependent stages are admitted
only when the owning case establishes them. The host's finite bounds must reject
unknown/oversized work observably; they cannot silently trim a native sequence
and still claim parity.

## Live seal, revocation and replay

At **each actual transport call**, read current host policy/consent, destination
grants, lifecycle epoch and operation lease. Check the actual URL/method/credential
scope/bytes. Do this after mapping, hashing, plan handling, queue waits, earlier
responses or any other asynchronous wait. A check before an `await` is stale.
The final check and call must have no intervening asynchronous work or
untrusted callback. A mutable captured permission or worker-supplied consent
version is not the live seal.

If current policy changes the required data-use shaping, transport permission
alone cannot release stale mapped bytes. Return to the authority for fresh
construction only where separately accepted retention/remap rules permit it.
This adds no event retention or release policy.

Restrictive admitted tag commands must not wait behind an earlier slow command
to tighten the host gate. Their minimal safety restriction belongs at admission;
vendor interpretation remains in the chamber. A tag grant never overrides host
policy. Keep the existing prototype denial/no-replay behavior during this
decision work (`adapters/google-ads-prototype.js:303-318,681-689`;
`adapters/meta-pixel-prototype.js:313-321,543-550`).
Do not transplant either vendor's local rule to the other.

A revoke cannot recall a request already issued. Invalidate affected unsent
leases/continuations immediately; after any wait, re-evaluate eligibility under
the existing policy. A later grant alone must not resurrect dropped, completed,
disposed or invalidated operations. Whether eligible held events can be retained,
remapped or released is a separate policy question, not decided by a revision
counter. Stable core already holds/remaps, while these prototypes drop holds.
Neither policy is changed here.

[Google's consent reference](https://developers.google.com/tag-platform/gtagjs/reference#consent),
[basic/advanced distinction](https://developers.google.com/tag-platform/security/concepts/consent-mode)
and [asynchronous guide](https://developers.google.com/tag-platform/security/guides/consent#async)
show why strict `ad_storage` and one `500` ms example cannot define all native
semantics. [ADR-0044](../decisions/adr-0044-google-ads-consent-wait.md) remains
Proposed and unchanged. Meta retention/replay remains separately owned.

Redirects need special treatment: automatic Fetch redirect following can issue
another request without a host JavaScript checkpoint. The prototypes use
`redirect: "error"` (`adapters/google-ads-prototype.js:509-512`;
`adapters/meta-pixel-prototype.js:394-398`), so they do not prove native redirect
support. [Fetch](https://fetch.spec.whatwg.org/) also distinguishes browser-owned
credentials and response visibility. A native-required redirect/opaque response
that cannot be individually governed is a concrete transport-authority decision
before code or qualification, never permission to enable unrestricted following.

## Costs and proposed budgets

**All costs below are unmeasured.** Source inspection establishes work and copy
sites, not milliseconds, memory consumption or Core Web Vitals (CWV). HTML's
[worker guidance](https://html.spec.whatwg.org/multipage/workers.html#scope-2)
warns about startup and per-instance memory; it supplies no Airlock budget.

| Cost | A | B | Recommended C plus D |
|---|---|---|---|
| Startup | Existing worker plus host mapper imports. | A second worker and an independent ready/state barrier per connector. | One fixed long-lived worker per connector, with browser-policy admission. No verifier boot. |
| Copying | Captured inputs plus mapped requests; host reconstructs expected values. | Duplicate command/config/identity/response feeds and candidate/expected request data; exact host byte comparison is still length-dependent. | Current capture snapshot and worker structured clone, one serialized request copy back, bounded response copies. Plan metadata adds no second request-body copy. |
| Memory | Worker state plus host mapping state. | Two worker heaps, replicated identity/config and pending comparison queues. | One mapper heap; host queue, correlation ledger and bounded transport data. Logical byte bounds do not cap browser heap or process memory. |
| Latency | Host mapping adds main-thread CPU to dispatch. | Dispatch waits for both state machines; independent failure/timeout paths. | Existing sequential response path plus plan-message handling. No verifier round trip; response-dependent native branches still add waits. |

For one command with N host request operations, the current worker exchange is
one command, N requests, N responses and one result (`2 + 2N` messages), excluding
initialization and diagnostics. The candidate adds one metadata plan per mapped
stage, without an extra acknowledgment. N includes held operations; network
dispatches can be fewer. This is structural accounting, not measured latency.

Main retains bounded capture/snapshot work, queue and callback bookkeeping,
revision/count checks, URL/transport validation, live policy reads and privileged
browser fulfillment. None is free or universally O(1): snapshots and clones
scale with input bytes, URL/byte checks with request size, and proxy traps can
execute during capture. No vendor normalization, hashing, field reconstruction
or fallback mapper belongs on main, including unload for these new paths.
The legacy critical mapper is not changed by this recommendation.

**Proposed structural budgets, awaiting review:** one authority worker per
connector, one active command and one outstanding branch per instance, no
verifier/duplicate mapper, and bounded queues, byte sizes, branch graphs,
diagnostics and deadlines pinned to the first case. Existing prototype defaults
(32 queued, 256 admissions/history, 16 waiters, 2 s init/command, 1 s transport,
8192-character URL) are regression fixtures, not native limits or adopted
production budgets. A character count is not a UTF-8 byte budget.

No evidence here supports numerical startup, clone, latency, CPU, memory or
workload acceptance limits. Largest Contentful Paint (LCP), Interaction to
Next Paint (INP) and Cumulative Layout Shift (CLS) limits are also unpinned.
The owner must pin those with the
case's browser/device/CPU/cache/network controls and repetition/noise policy
before dependent implementation, as required by 059/C3 and 060/C6. Choosing
numbers in this document would not make them evidence-backed. If the sequential
path misses native timing or those limits, return that measured conflict; do
not add host mapping or parallel workers by default.

## Bounded later validation proposal

Consumer: 059-01/C1-C3 and 060-01/C1-C9. This is a proposal for separately
commissioned packets, with no execution grant from this note.

| Packet | Finite output and falsifiable controls | Limit and stop |
|---|---|---|
| Authority/contract fit | First Meta PageView's private protocol, trust statement, explicit source closure and existing-host fit. Request `core/wrapped-sdk-host.js`, `contracts/connector.d.ts`, `contracts/capability.d.ts`, `contracts/seams.d.ts` and `contracts/push-api.md` before assessing their implementations/types. Define the required performance/byte/deadline manifest; missing evidence-backed limits remain a blocker. | One source/design packet, proposed 90 active minutes or one contract/blocker for independent review. No framework or implementation. Stop on a required core break or unresolved authority choice. |
| Local protocol validation | On the accepted slice, use existing fake-transport and real first-party Node plumbing. Mutate seq/epoch/state revision, init/config/agent/identity ordering, zero-result counts, target/data/duplicate query fields, extra/missing/reordered branches, host-response statuses and completion. Inject hash rejection, init/command/response timeout, overflow, worker crash, duplicate/late reply and cleanup failure. | One approved implementation packet with exact selectors and bounds. Separate runtime-rejected protocol mutations from wrong-but-well-formed mapper output detected only by tests. Stop if that distinction cannot be preserved. Node evidence stays plumbing-only. |
| Actual browser boundary | Under a separate local browser grant, observe the real fixed worker and response CSP, module/import closure, denied ambient transport/fresh realms and governed host operations. Revoke after a controlled async pause and between branches; change destination grants; verify no stale send or grant-triggered replay. Check disposal and missing-policy failure. | One approved first-journey browser/matrix cell, positive plus named negatives, finite collection window and cleanup. No vendor/SDK acquisition is implied. Missing loader/header control blocks confinement; it does not start a sandbox project. |
| Independent native evaluation | Compare actual serialized chamber/host dispatch, complete requests/responses/host effects and controlled input/state relationships with an independently qualified positive. Detect removed/extra requests, event/target/value/identity changes, wrong order/encoding/headers/cookies, removed response branches and empty/unavailable references. Measure the complete path against the pinned performance manifest. | One separately admitted native/replacement case, finite branch/window closure. Missing native responses or state is inconclusive; a material difference is nonconformant. Receipt, matching, reporting and attribution remain separate unproved layers. |

[Meta's API reference](https://developers.facebook.com/documentation/meta-pixel/reference)
documents event/property inputs, not the complete request encoding or transport
sequence. Google's command reference documents scope precedence, not our native
qualification. Neither source can serve as an independent same-input browser
oracle. No native correctness, real-browser confinement or performance pass was
produced here.

## Decisions before code and integration handoff

1. **Authority decision:** owner accepts or rejects trusting the fixed
   first-party mapper for semantics, with separately untrusted code excluded
   from its realm and grants. A requirement to tolerate a malicious mapper
   reopens B; it cannot be met by correlation fields alone.
2. **Stable-contract decision:** boundary-fit review must classify the proposed
   private envelope and readiness/state operations against ADR-0017's frozen
   connector, capability, seam, boot/handle and synchronous void `push()` surfaces.
   The experimental config/standalone handle carve-out is not blanket permission.
   If a frozen change is required, obtain the named superseding decision and
   version treatment before implementation. This recommendation selects no break.
3. **Case readiness:** independently review the frame and authority/transport
   design, obtain owner acceptance, pin numerical performance conditions and
   complete native/evaluation inputs, then commission only the next bounded
   packet. Unresolved redirect, cookie or lifecycle privileges remain case-owned
   decisions. Consent waiting/retention is still ADR-0044/its vendor owners.

Shared text needed at integration, outside this child's writable scope:
the work-plan review-status, packet 2 and filed-artifact register need to
distinguish this commissioned document work from unapproved execution. Its
R-014 "planning only" and ADR-0043 "no option selected" entries should become
"recommendation prepared, awaiting independent review and owner acceptance."
The launch guide can link the integrated recommendation while preserving its
owner-selected launch/stop rules. R-014's index disposition remains the
integrator's decision; no slice becomes implementation-ready.
The architecture's broad "compromised chamber cannot reach the network directly"
claim (`docs/architecture.md:211-215`) needs its browser/loader evidence limit.
The `connect-src`-only loader comments in `core/endpoint-ceiling.js:58-63` and
`core/egress-confinement.js:47-52` need separate correction against CSP's script
and worker directives; no source correction is performed by this document mission.

## Conclusion

The smallest justified default is an explicit trusted first-party mapping
authority, the existing mediated host boundary tightened for complete protocol
accounting, and independently established browser confinement/native evaluation.
A second runtime verifier is conditional on a stronger owner-selected threat
model. It does not repair loader bypasses or prove native correctness.

[ADR-0043](../decisions/adr-0043-google-meta-request-authority.md) carries this
recommendation as Proposed with `frame_review: true`.
[Independent frame critique](../decisions/reviews/adr-0043-frame-critique.md)
passed the proposed premise, not owner trust acceptance or boundary fit.
R-014 remains OPEN for those decisions and the identified source/contract-fit
questions; no continuation is commissioned. This source/design package
changes no runtime, policy, native claim or execution authority.
