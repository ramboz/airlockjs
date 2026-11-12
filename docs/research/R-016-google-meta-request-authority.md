---
status: OPEN
topic: Request integrity without main-thread mapping or an assumed Node sandbox
created: 2026-11-02
related:
  - ../releases/google-meta-work-plan.md
  - ../decisions/adr-0040-reframe-onto-full-google-meta-compatibility.md
  - ../decisions/adr-0047-google-meta-request-authority.md
  - ../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md
  - ../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md
---

# R-016: Google and Meta request authority

Give one first-party worker explicit authority to interpret commands and build
requests. Keep the host responsible for bounded operations, live consent and
destination enforcement. This avoids a second runtime mapper, at the cost of
trusting the reviewed mapper and its dependency closure for semantic correctness.

**Owner decision recorded (2026-11-02).** Accepted ADR-0047 selects Option C
with Option D's required browser admission and independent evaluation.
The owner approved trusting the first-party mapper, not malicious-mapper
resistance. R-016 remains OPEN for production fit, native/browser evidence and
numerical acceptance. Implementation and live authority remain separate gates.
The paused verifier drafts were not read or imported.

The subsequent [Bug 004](../bugs/004-shared-host-live-consent.md) correction is
DONE after a real fresh-main reproduction, witnessed red/green, independent Sol
bug/craft/security reviews and original-repro verification. It closes the
shared host's deferred capability-invocation consent gap, including injected
diagnostic callbacks. It does not enforce final wire inside an independently
asynchronous capability, implement the proposed complete private protocol or
qualify browser/native behavior. The remaining production/lifecycle and
numerical-evidence questions stay open.

The dated source/design packets below retain their original proposal and
pending-owner language as historical context. The accepted ADR and this status
paragraph govern the current decision; no missing runtime evidence is upgraded.

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

That limit describes the first packet. The subsequently commissioned
[Meta-first source/contract check](#meta-first-source-and-contract-fit)
inspected the wrapped host and frozen declarations. It identifies the
standalone path's final-dispatch gap and cleanup limits; production integration,
actual browser behavior and numerical acceptance remain unverified.

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
| A. Extend host expected-field checks | Rebuild expected vendor requests on main, compare selected or complete fields. Existing Google code demonstrates the approach. | One worker, but repeated serialization/state rules and input-length-dependent main work. Partial checks miss omissions, duplicates and unhandled modes. Reject as the destination architecture under ADR-0040. Existing checks stay until a reviewed replacement is implemented. |
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
semantics. [ADR-0048](../decisions/adr-0048-google-ads-consent-wait.md) remains
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
   decisions. Consent waiting/retention is still ADR-0048/its vendor owners.

Shared text needed at integration, outside this child's writable scope:
the work-plan review-status, packet 2 and filed-artifact register need to
distinguish this commissioned document work from unapproved execution. Its
R-016 "planning only" and ADR-0047 "no option selected" entries should become
"recommendation prepared, awaiting independent review and owner acceptance."
The launch guide can link the integrated recommendation while preserving its
owner-selected launch/stop rules. R-016's index disposition remains the
integrator's decision; no slice becomes implementation-ready.
The architecture's broad "compromised chamber cannot reach the network directly"
claim (`docs/architecture.md:211-215`) needs its browser/loader evidence limit.
The `connect-src`-only loader comments in `core/endpoint-ceiling.js:58-63` and
`core/egress-confinement.js:47-52` need separate correction against CSP's script
and worker directives; no source correction is performed by this document mission.

## Meta-first source and contract fit

The inspected Meta init/PageView path can carry a private authority protocol
without changing the frozen connector or round-trip capability signatures.
It still needs a final transport-side consent check, complete protocol
accounting and owned host cleanup. Recommend those changes around one trusted
first-party mapper, subject to owner acceptance of that trust choice. This is
a source/design result, not an implementation-ready or native-compatible path.

**Checkpoint:** 2026-11-02, base
`bbc42581dff94ae32125cb7f25746bbb859f5586`, initially clean. This packet
inspected tracked source and the permitted documents only. No project code,
tests, browser, SDK or vendor request ran. ADR-0047 remains Proposed. The
recommendation below is conditional on its owner decision; no frozen break,
consent-policy change or later packet is commissioned.

[Independent architecture/contract review](../decisions/reviews/adr-0047-arch.md)
passed this conditional standalone source/design result. Production boundary
fit, owner trust acceptance, runtime/native evidence and numerical limits remain
open. The pass is not implementation readiness.

### Resolved source scope

The standalone adapter and its literal browser worker entry form an inspected
18-file local source closure. The table enumerates the resolved files, including
imports evaluated even when an experimental flag is off. Leaf files were read,
not inferred safe from their names or comments.

| Root or dependency edge | Inspected resolved files and evidence |
|---|---|
| Main entry and worker selection | `adapters/meta-pixel-prototype.js:1-5,153-181,628-669`; the default worker is `connectors/meta-pixel/pageview-prototype.worker.js`, selected by a literal module URL. |
| Main host and its five imports | `core/wrapped-sdk-host.js:126-130`; `core/endpoint-ceiling.js:71-134`; `core/config-integrity.js:77-211`; `core/consent.js:59-131`; `core/payload-governance.js:1-251`; `core/cookie-scope.js:1-112`. Config override, payload stripping and cookie reconciliation code is present in this closure, but Meta does not grant or enable those operations. |
| Four shared snapshot leaves | `connectors/meta-pixel/pageview-data.js:1-196`; `connectors/meta-pixel/event-options.js:1-10`; `connectors/meta-pixel/synthetic-identity.js:1-31`; `connectors/meta-pixel/agent-options.js:1-16`. Both main capture and the worker mapper import these. |
| Worker entry, confinement and generic host | `connectors/meta-pixel/pageview-prototype.worker.js:1-3`; `core/confine-pixel-chamber.js:23-29` imports `core/egress-confinement.js:1-199`; `core/connector-host.js:40-90` retains the factory instance. |
| Mapper and its other two leaves | `connectors/meta-pixel/pageview-prototype.js:1-6,45-241`; `connectors/pixel/vendors/meta.js:1-120` supplies the synthetic ID; `connectors/pixel/advanced-matching.js:1-159` supplies the off-thread hash function. No further runtime imports were found in these leaves. |

This closes the local static source question for that standalone route. It does
not close deployment or loader authority. No dynamic module load was found in
those 18 files, but JavaScript shims cannot revoke the language loader. Module
fetches, served bytes, redirects and response policy were not observed.
`forceProp` leaves properties writable/configurable and reports possible failure
(`core/egress-confinement.js:109-125`); the pixel caller does not verify its
returned record (`core/confine-pixel-chamber.js:27-29`). This is no proof of
malicious-code confinement.

The injected `chamber`, `captureContext` and `fetchImpl` remain trusted caller
dependencies, not authenticated browser implementations
(`adapters/meta-pixel-prototype.js:211-220,394-398,562-563`). Native runtime,
remote configuration, response headers, browser policy, production build/boot
and the separate fixture-style bootstrap adapter were not inspected here.
The R-015 Meta card and 060-13/14 records were read as documents, not replayed.

For comparison only, the inspected legacy surfaces add
`core/airlock.js:217-349,380-553,636-900`, `core/egress.js:1-162`,
`core/pixel-chamber.worker.js:58-140` and
`connectors/pixel/connector.js:72-153`. They are not another closed source
graph. Unfollowed legacy imports include the RUM, GA4-gtag, Google Ads and
Floodlight modules named at `core/airlock.js:26-29`, the GA4 mapper at
`core/egress.js:30`, and non-Meta worker entries at `core/airlock.js:339-349`.
They are unnecessary to establish this standalone Meta path and are not
qualified by this packet.

### Existing capture-to-result path

Runtime initialization and the caller's `fbq("init", ...)` are different
operations. The former creates the retained connector and makes the worker
ready. The latter establishes Pixel state after readiness.

| Step | Existing sequence and exact source evidence | Limit |
|---|---|---|
| 1. Capture and queue | `fbq` allocates a sequence, checks admission, snapshots args and six context fields, structured-clones them into an `AirlockEvent`, then queues it (`adapters/meta-pixel-prototype.js:462-559`). Browser context reads are at `:153-161`. | Synchronous void capture, no global fbq install. Optional snapshot helpers perform vendor-aware admission on main; reflection and cloning are length-dependent, and proxy traps can execute. No hard CPU bound or native invocation semantics follows. |
| 2. Runtime readiness | Adapter constructs the wrapped host with only egress, the literal endpoint and strict `ad_storage` (`adapters/meta-pixel-prototype.js:628-669`). Worker constructs one connector host, awaits `connector.init({})`, then posts `configured` (`connectors/meta-pixel/pageview-prototype.worker.js:101-130`). | Adapter queue waits for `ready` (`adapters/meta-pixel-prototype.js:407-427,593-597`). This is runtime initialization, not Pixel init, SDK boot or proof of native readiness. |
| 3. Serialized command | `pump` permits one drive at a time; `driveEvent` posts the event after configuration (`adapters/meta-pixel-prototype.js:407-445`; `core/wrapped-sdk-host.js:570-589`). Worker checks busy and increasing safe sequence, then awaits `routeBatch([event])` (`connectors/meta-pixel/pageview-prototype.worker.js:36-44`). | The host's own drive slot is single-entry. Sequence gaps from rejected capture calls are possible; increasing does not mean contiguous. |
| 4. Mapper state and bytes | Generic host awaits `handle` and collects requests/drops (`core/connector-host.js:40-88`). Meta retains Pixel, pending-ID, hash and agent state (`connectors/meta-pixel/pageview-prototype.js:101-164`); optional init hashing uses WebCrypto (`connectors/pixel/advanced-matching.js:115-128`). PageView constructs the eight-field GET and optional data in the worker (`connectors/meta-pixel/pageview-prototype.js:166-238`). | Successful local Pixel init returns zero requests. The synthetic identity path awaits hashing before committing that Pixel. Native init traffic, identity update/clear and complete native fields are not established. |
| 5. Mediated operation | Worker sends one numeric-ID `intercepted-fetch`, awaits its response and only then advances the next branch (`connectors/meta-pixel/pageview-prototype.worker.js:26-33,56-78`). Wrapped host checks ceiling and strict purposes (`core/wrapped-sdk-host.js:245-263,337-401`), then schedules the capability call (`:421-440`). | The host count is incremented before the injected transport is invoked. It is not a physical-dispatch or receipt ledger. No stage plan precedes the requests. |
| 6. Actual transport call | Injected adapter dispatch checks phase, literal URL, GET and absent body/headers, then calls `fetchImpl` with credentials omitted, redirects rejected and no referrer (`adapters/meta-pixel-prototype.js:382-405`). It reads at most 4096 response-stream bytes (`:185-204`). | This is local Fetch, without `keepalive`, not qualified native Image/Fetch behavior. It discards response headers and does not recheck consent at this final call. Injected transport and actual browser activity were not executed here. |
| 7. Host response and result | Wrapped host posts one correlated response under a settled flag (`core/wrapped-sdk-host.js:424-454`). Adapter forwards it (`adapters/meta-pixel-prototype.js:448-460`). Worker resolves the pending ID and derives branch outcomes, then posts its final summary (`connectors/meta-pixel/pageview-prototype.worker.js:58-99`). Host resolves the drive; adapter records it (`core/wrapped-sdk-host.js:526-532`; `adapters/meta-pixel-prototype.js:428-441`). | The mapper does not consume response content to build another stage. Stronger summary/count checks are mode-gated, not universal (`adapters/meta-pixel-prototype.js:322,567-584,610-618`). A final summary cannot prove correct bytes, native equivalence or receipt. |

### Existing guarantees versus missing relationships

Here, **EXISTING** means inspected source behavior, **MISSING** means the
candidate relationship is absent, **CONFLICT** means an existing path cannot
be cited as that guarantee, and **UNVERIFIED** means the necessary external or
execution evidence is unavailable. These labels do not report fresh test passes.

| Subject | Classification | Evidence and consequence |
|---|---|---|
| Init/readiness | EXISTING bounded pre-ready queue and one configured transition; MISSING version/instance/epoch acknowledgment and pinned grant/limit agreement; UNVERIFIED native bootstrap/init I/O. | `adapters/meta-pixel-prototype.js:293-308,407-427,593-597,641-669`; `connectors/meta-pixel/pageview-prototype.worker.js:101-130`. Runtime readiness must not imply Pixel initialization or qualified configuration. |
| Serialized state and async identity | EXISTING retained state and awaited synthetic init hash; MISSING committed revision/epoch and general atomic update/clear rules; UNVERIFIED native identity semantics. | `core/connector-host.js:40-88`; `connectors/meta-pixel/pageview-prototype.js:101-164`. No general identity update exists to qualify. Legacy eager per-field hashing is a separate, nonserialized channel (`core/pixel-chamber.worker.js:79-137`), not a ready-made replacement state barrier. |
| Explicit zero output | EXISTING initialized/updated/rejected summaries with zero requests; MISSING mandatory host reconciliation in default mode; UNVERIFIED native zero-output expectations. | `connectors/meta-pixel/pageview-prototype.worker.js:45-54`; `adapters/meta-pixel-prototype.js:57-150,322,567-584`. No returned `EgressRequest` is not proof of no capability operation. Silence is never a zero-result acknowledgment. |
| Staged request/response | EXISTING one outstanding request and bounded text response; MISSING announced stages, parent-response references and response-driven mapping; UNVERIFIED complete native graph/response visibility. | `connectors/meta-pixel/pageview-prototype.worker.js:26-33,56-99`; `adapters/meta-pixel-prototype.js:185-204,394-398`. Response status drives summary only; headers are discarded and no browser cookie/host effect is observed. |
| Correlation and branch counts | EXISTING sequence, increasing request ID and optional response/count checks; MISSING universal envelope, predeclared graph and independent host operation ledger. | `connectors/meta-pixel/pageview-prototype.worker.js:9-12,26-44`; `adapters/meta-pixel-prototype.js:448-458,567-624`. Counts do not bind Pixel/event/value semantics under the proposed trusted-mapper model. |
| Live consent after waits | CONFLICT with a final-dispatch guarantee; EXISTING earlier strict gate and optional tag-revoke generation; MISSING last-call recheck and host-policy lease invalidation. | Wrapped consent is read at `core/wrapped-sdk-host.js:337-401`, then a Promise continuation calls dispatch at `:439-440`. The adapter's `:382-398` does not read consent. A host denial between these points can therefore miss the earlier check. This is a source-derived ordering counterexample, not an executed race. |
| Revocation and no replay | EXISTING immediate admitted tag restriction and no replay of held operations; UNVERIFIED native retention/timeline rules. Host consent updates do not have the same generation barrier as tag revocation. | `adapters/meta-pixel-prototype.js:313-321,543-550,684-687`. A queued command first evaluated after a later grant is different from replaying a command already held. Do not silently decide either policy or transplant stable hold/remap (`core/airlock.js:778-856`). |
| Destination, credentials and redirects | EXISTING literal loopback GET, no supplied headers/body, credential omission and redirect error; UNVERIFIED required official transport/credentials/redirects. | `adapters/meta-pixel-prototype.js:278-284,382-398`; `core/endpoint-ceiling.js:71-134`. Origin/path matching drops query/fragment and cannot independently bind Pixel ID or data. Automatic redirect following would evade per-hop JavaScript checks. |
| Deadlines | EXISTING init/whole-command/transport timers and abort requests; MISSING one reconciled absolute deadline/epoch and cancellation of host-owned pending work. | `adapters/meta-pixel-prototype.js:352-405,416-427,641`; `core/wrapped-sdk-host.js:424-454`; `connectors/meta-pixel/pageview-prototype.worker.js:15-32`. Timers are event-loop-dependent. Host timeout does not abort its injected capability; signal cancellation does not prove no arrival. |
| Disposal | EXISTING adapter admission stop, listener removal, abort, waiter settlement, worker termination and retained cleanup error; MISSING wrapped-host close/unsubscribe/drive rejection/timer ownership. | `adapters/meta-pixel-prototype.js:164-181,346-379,689-692`; `core/wrapped-sdk-host.js:229-236,550-620`. There is no host dispose. The adapter can finish its outer wait while the host's internal drive remains unresolved; late transport callbacks still retain host state. |

### Proposed private Meta contract

Keep the fixed first-party worker as the single semantic authority. Host
validation checks structure, granted operations and observed accounting. It
does not reconstruct a second expected Meta query. A malicious mapper can
still send wrong, protocol-valid values to an allowed recipient. That risk is
outside this proposed guarantee. Independent mapper mutation evaluation,
actual browser confinement and native correctness remain separate obligations.

Use the following concrete private wrapper, removed before calling existing
host/capability interfaces. This is a design shape, not an installed API.

| Message or transition | Proposed binding |
|---|---|
| Every message | `{ protocol: 1, instance, epoch, type, ... }`, bound to the host-owned worker subscription. Host supplies fresh instance/epoch values and a fixed source/config/grant/limit record. Fields correlate messages; they do not authenticate code. Unknown types/fields, incompatible versions and active-epoch duplicates fail the instance. Retired epochs cannot act. |
| Runtime init/ready | One init, one matching ready with initial committed revision. Queue capture without dispatch until ready. A separately evidenced initialization request would require its own admitted stage before readiness; none is inferred from this local no-I/O init. Host-owned grants are the fixed declaration intersected with policy, not grants nominated by a worker manifest. |
| Command | `{ seq, expectedRevision, event }`, with strictly increasing admitted sequence, immutable captured event data and one active command. Keep `AirlockEvent` unchanged. Host may have rejected sequence numbers before admission. Worker owns interpretation and advances revision only after an atomic successful state command; events keep that revision. Hashing completes before dependent events. Uncertain partial commit terminates the epoch. |
| Plan | `{ seq, revision, stage, parentRequestId, branches: [{ ordinal, requestId, destinationRef, operationRef }] }` precedes each stage's requests, without another request-body copy or plan-ack round trip. References are unique within the epoch and bounded by the case graph. Initial synthetic init declares zero operations; the initial single-Pixel synthetic PageView declares one GET. These are local design cases, not a native graph declaration. |
| Request | `{ seq, revision, stage, ordinal, requestId, request }`; `request` retains the existing egress descriptor. Adapter validates the plan/lease, then forwards only the existing `intercepted-fetch` shape to the wrapped host. One outstanding branch. Repeated URLs from distinct commands remain distinct operations. |
| Last-call gate | Adapter's injected dispatch owns the actual transport ledger. Immediately before the captured trusted Fetch call, recheck current host/tag consent, epoch, lease, actual URL, method, credential/redirect policy and byte/deadline limits. No await or caller callback may intervene. Reuse the shared consent primitive. Denial returns the existing status-zero held response plus private reason/accounting, without transport. Do not count wrapped-host attempts as actual calls. |
| Response/stage continuation | Adapter restores the private correlation wrapper around the host-observed response and separately records held, invoked, responded, failed or unknown. Keep the existing text response descriptor inside it. A response-dependent stage is admitted only after native evidence specifies its parent and limits. If needed, wire the existing `caps.egress.dispatch` into the mapper so it can await a response inside `handle` and return `[]`; do not move response interpretation into main or add a response channel to `EgressRequest`. This wiring is not needed for the inspected one-stage case. |
| Completion | Exactly one `{ seq, previousRevision, committedRevision, disposition, stageCount, branches }`, with each branch's final state reconciled to the host ledger. Preserve planned but unsubmitted branches, denied branches and invoked-but-unobserved work explicitly. Zero operations requires zero declared and observed operations. Worker-declared counts or 2xx summaries cannot override host facts. |
| Failure/close | Init, command or transport deadline closes admission and invalidates leases/continuations. Check elapsed monotonic deadlines after waits as well as running timers. Privately close the wrapped host, reject its drive slot, clear owned timers/subscriptions, abort adapter-owned transports and terminate the worker. Settle caller waiters once and retain cleanup failure. No restart, retry, grant-triggered resurrection or receipt inference from abort. |

Preserve the current prototype's held-operation drop/no-replay behavior.
An admitted restrictive tag command must still tighten safety at capture,
before queued interpretation. Host-policy changes must invalidate affected
unsent leases immediately. A later grant cannot revive an invalidated lease.
Any change to retained-command eligibility, retention, remapping or consent
data shaping needs its own evidenced owner choice. This contract does not
accept Meta policy or resolve Google's ADR-0048.

### Frozen-contract fit and stop rules

ADR-0017 freezes behavior as well as names
(`docs/decisions/adr-0017-airlock-1-0-api-contract.md:60-95`). Its 0.x amendment
requires a named superseding ADR, minor-version break and CHANGELOG notice for
a stable-core break; the major-break rule resumes at 1.0 (`:140-146`).
Experimental config is no permission to alter those obligations.

| Proposed change | Classification against the inspected contract | Boundary |
|---|---|---|
| Version/epoch/revision/plan/ledger messages around the Meta worker | Internal/private. | Do not add required fields to `AirlockEvent`, `EgressRequest` or `routeBatch` output. `contracts/connector.d.ts:39-52,73-129,205-218`; `core/connector-host.js:55-90`. Keep `{ ready, dropped }` and the factory's `{ manifest, init, handle }`. |
| Awaited state commits and zero/multiple request returns | Existing compatible behavior; private state discipline. | `Connector.init` and `handle` already allow Promises and zero/multiple requests (`contracts/connector.d.ts:205-218`). Do not require a new connector method or turn `routeBatch` into a stream. Worker glue owns private revision acknowledgment. |
| Response-dependent mapping, only if the case requires it | Compatible wiring of an existing capability, not a new return type. | `contracts/capability.d.ts:155-187,243-260` already defines `dispatch(req) -> Promise<response>`. Gate declaration intersected with allowed policy. Keep request/response inner shapes unchanged; zero returned requests does not mean zero dispatch calls. |
| Final transport guard and private wrapped-host close | Internal/private implementation change, with a compatible additive close helper on the nonfrozen host module. | Keep `GrantedCapabilities.egress.dispatch` unchanged. Adapter owns AbortControllers; host close only cancels its own subscription, timers, deferred invocation and drive bookkeeping. Existing callers not using close retain their behavior. The frozen installed handle's `dispose` is not replaced by this helper. |
| Observable round-trip responses | Fit the existing capability for bounded observable text only; unresolved for required opaque/binary/credentialed/redirect behavior. | `EgressDriver.dispatch` has only `sent`, `sent-unknown`, `held`, not response data (`contracts/seams.d.ts:52-77`). Use the separate round-trip capability, never widen or reinterpret that seam as a response channel. New required capability fields or response semantics need explicit contract review. |
| Cookie, storage, DOM, source/configuration and transport grants | Unresolved native requirements, no additional grant selected. | Existing declarations are at `contracts/capability.d.ts:37-187`. The prototype has no cookie/DOM/storage grant and manually mirrors manifest endpoint/purpose (`connectors/meta-pixel/pageview-prototype.js:107-114`; `adapters/meta-pixel-prototype.js:628-639`). Bind that mirror to the fixed instance policy; do not let the worker widen it. Existing name-scoped cookies do not prove native cookie/credential fit. |
| Standalone fbq readiness/reporting | Private/experimental standalone seam only; production boot integration unresolved. | `adapters/meta-pixel-prototype.js:207-211,668-694` does not install `window.airlock` or global fbq. Preserve the frozen boot entrypoints and installed handle from ADR-0017 `:71-95`. Their concrete production implementation is outside this inspected graph. Do not install the prototype handle as the frozen one. |
| `push`, `pushCritical`, projection and unload | Unchanged for this proposal. Routing a fresh Meta command through an asynchronous frozen `pushCritical` would be a frozen behavioral break. | `contracts/push-api.md:17-26,33-51,109-118` requires synchronous void push, synchronous projection and critical send before return. Legacy Pixel has main-thread critical mapping (`core/airlock.js:226-288,636-681`; `core/egress.js:119-133`). Neither transplant that mapper into the proposed path nor silently replace immediate-send behavior with a worker wait. |

**Named stop:** no frozen break is required for the inspected private
init/PageView protocol. This does not establish full production fit. If
060-01 integration requires changing the installed handle, synchronous
projection, critical-send timing, connector returns or capability/seam
semantics, stop and request the specific superseding decision and version
treatment. If native transport cannot be governed under the proposed grants,
return that transport-authority choice. Neither case commissions code here.

### Smallest proposed change list

This is the conditional implementation footprint for owner/reviewer selection,
not permission to implement it or to promote 060-01 readiness.

| File | Exact proposed responsibility |
|---|---|
| `adapters/meta-pixel-prototype.js` | Own private envelope validation, fixed instance grants, bounded queue/operation ledger and the final live gate at the actual transport call. Make correlation/count checks mandatory for the selected path, independent of feature flags. Preserve structural/privacy admission; keep vendor interpretation and hashing in the worker. Current vendor-semantic snapshot decisions must be moved behind that boundary or explicitly justified as host admission policy, never inherited as native rules. Wire owned host close. |
| `connectors/meta-pixel/pageview-prototype.worker.js` | Own matching init/ready, command/revision barriers, plans, request/response correlation and one final reconciled completion. Preserve single-command/single-branch order and zero-output acknowledgment; invalidate late work on failure. No SDK loader, second authority or generic scheduler. |
| `connectors/meta-pixel/pageview-prototype.js` | Keep the sole Meta semantic state/request constructor. Make asynchronous commits atomic within that instance and support the private worker's commit barrier without changing the Connector interface. Implement only evidence-demonstrated first-case mapping gaps after their inputs are supplied. Do not add identity update/clear, extra events or response branches speculatively. |
| `core/wrapped-sdk-host.js` | Add only privately invoked lifecycle close: stop message admission/deferred capability calls, reject the outstanding drive, release its queued event/listener and cancel owned timers/late responses. Keep existing capability calls and unrelated caller behavior intact. No Meta parsing, verifier or generalized protocol framework in core. |
| `connectors/meta-pixel/README.md` | Document the selected private path, trust boundary, supported local behavior and unchanged native/browser/production limits when code is separately approved. |

Later regression owners can reuse the existing
`test/meta-pageview-prototype-adapter.test.js`,
`test/meta-pageview-prototype-worker.test.js`,
`test/meta-pageview-prototype.test.js`,
`test/meta-pageview-prototype-integration.test.js`,
`test/meta-prototype-request-correlation.test.js` and
`test/wrapped-sdk-host.test.js`, with the existing
`test/connector-host.test.js` and `test/contract-stability.test.js` protecting
the reused surfaces. Only their tracked filenames were checked in this packet;
their contents, adequacy and present results were not reassessed. A later
mission must select exact controls/commands, including denial in the
post-gate continuation gap and disposal with an unsettled host drive.
Wrong-but-well-formed mapper mutations belong to independent evaluation;
they must not be relabeled runtime-rejected without a different trust decision.
No new source file, general framework or verifier is recommended.

### Required limits, missing inputs and disposition

The structural proposal is one authority, one active command and one
outstanding branch. Numerical limits still need a case-backed manifest.
Existing local defaults are regression facts, not production acceptance.

| Manifest item | Existing source or retained input | Still needed before dependent implementation/qualification |
|---|---|---|
| Input/copy bytes and capture work | Six primitive context values, 2048-character context strings and structured clone (`adapters/meta-pixel-prototype.js:525-545`); reflective snapshot helpers (`connectors/meta-pixel/pageview-data.js:124-196`). | Accepted command/config/identity depth, keys and UTF-8 bytes; per-command and aggregate clone/retention budgets; measured main-thread admission time and rejection behavior. Character limits and accepted shapes do not bound proxy execution or heap. |
| Queue, history and waiters | Queue default 32, allowed 1-128, 256 lifetime admissions/history and 16 flush waiters (`adapters/meta-pixel-prototype.js:8,216,281-285,324-326,468-470,679-682`). | Native-supported burst/pre-ready workload, finite queue bytes/age, ledger lifetime and diagnostic bounds. Demonstrate visible overflow without silently trimming the required sequence. These defaults are not an adopter workload model. |
| Requests, responses and graph | URL limit 8192 characters, stream body limit 4096 bytes; local branches limited to one or four (`adapters/meta-pixel-prototype.js:185-204,382-398`; `connectors/meta-pixel/pageview-prototype.worker.js:56-78`). | Full first-case dependency/init/PageView/auxiliary graph, exact operation count/depth/order, URL/header/body UTF-8 and aggregate response bytes, visibility/content types and browser-owned effects. No native branch count is known here. |
| Deadlines and lifecycle | Init/command defaults 2000 ms and transport 1000 ms, configured bounds 10-10000 ms (`adapters/meta-pixel-prototype.js:217-219,281-284`). | Measured readiness/hash/queue/transport/body/whole-command and close deadlines, timeout uncertainty and no-retry rules. Fit the complete sequential graph, not each request independently. Establish browser unload requirements before choosing leases or keepalive behavior. |
| Performance and resource acceptance | R-015 Meta equivalent-input/performance gap (`docs/research/R-015-google-meta-first-journey-evidence.md:149-173`); historical local browser result is not a baseline (`docs/specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md:93-117`). | Same-input native/replacement browser/device/profile, CPU/network/cache and repetition/noise controls; numerical startup, main/worker CPU, clone cost, latency, heap and LCP/INP/CLS acceptance. Logical queue/byte limits are not process CPU/memory enforcement. No measurements or thresholds were invented here. |
| Native/browser authority inputs | R-015 Meta evidence and safety card (`docs/research/R-015-google-meta-first-journey-evidence.md:149-260`); 060/C1-C9 (`docs/specs/060-meta-pixel-full-compatibility/spec.md:135-155`). | Owner-supplied private resource handles, pinned native/config/dependency originals, equivalent consent/storage/URL/profile state, complete requests/responses/host effects and qualified positive/negative comparison. Also production entry/build/served-worker policy and actual denied-loader/ambient-route evidence. No private discovery or current live permission is inferred. |

R-015's proposed acquisition ceilings (`:218-236`) constrain a possible future
reference case. They are not measured replacement performance budgets, a
qualified owner-operated route or a renewal of a historical grant.

**Document mission: READY_FOR_OWNER_REVIEW. Implementation: blocked.**
The source path, static closure, scheduling gap and private-interface fit are
now answered for the standalone route. Actual browser confinement, native
completeness, production boot/unload fit, numerical limits and the owner trust
choice remain open. No source result satisfies 060-01/C1-C9 or accepts ADR-0047.

The owner action is to accept or reject the single trusted-mapper premise
after independent Sol review, then select the next finite packet. If resistance
to a malicious mapper is required, stop this design and reopen the authority
choice; stronger correlation is insufficient.

**Proposed NEXT packet, owner selection only:** one Meta case-and-limit
document packet under R-015/060-01. Use the existing Meta card to return a
reviewable native acquisition/observation feasibility plan and the required
input, graph and performance-limit manifest, or the exact unavailable input/
control. Proposed checkpoint: one manifest/blocker or 60 active minutes.
No browser, capture, code, new runner or successor follows from this proposal.
Missing measurements remain named prerequisites for a separately approved run.

Shared corrections belong to the coordinator. Link this section from the
work-plan register and Proposed ADR-0047 as a completed source/contract-fit
packet with unresolved production/native/budget gates; preserve both research
notes' OPEN state and every slice status. The earlier R-016 paragraph saying
the wrapped host was outside its allowlist describes the earlier packet only.
Its final-dispatch/cleanup uncertainty is now narrowed by this section, not
silently erased. The README's blanket source-only/not-browser-tested language
(`connectors/meta-pixel/README.md:3-6,34-35`) needs the historical 060-14 cohort
qualification and later-opt-in limit, not a fresh browser pass. The earlier
architecture/CSP corrections remain due. No shared text or source was edited
by this packet.

## Conclusion

The smallest justified default is an explicit trusted first-party mapping
authority, the existing mediated host boundary tightened for complete protocol
accounting, and independently established browser confinement/native evaluation.
A second runtime verifier is conditional on a stronger owner-selected threat
model. It does not repair loader bypasses or prove native correctness.

[ADR-0047](../decisions/adr-0047-google-meta-request-authority.md) records the
owner-approved C-with-D decision as Accepted with `frame_review: true`.
[Independent frame critique](../decisions/reviews/adr-0047-frame-critique.md)
passed the acceptance-ready premise; it is not production boundary fit or
native qualification.
The [Meta-first source/contract check](#meta-first-source-and-contract-fit)
adds a conditional private-interface design and concrete source findings.
R-016 remains OPEN for production boot/unload fit,
native/browser evidence and numerical limits. No further packet is commissioned
by its handoff. This source/design package changes no runtime, policy, native
claim or execution authority.
