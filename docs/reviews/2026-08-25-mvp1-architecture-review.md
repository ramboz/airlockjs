# Architecture Review: Airlock MVP1 runtime

> Reviewer pass: `arch-review`, 2026-08-25. Drive-order step 3.
> Inputs: [product-vision.md](../product-vision.md), [architecture.md](../architecture.md)
> (AD-1..AD-9, five contract surfaces, OQ1..OQ8), [refinement-todo.md](../refinement-todo.md),
> [conventions.md](../conventions.md), [workflow.md](../workflow.md),
> [lightweight-decisions.md](../decisions/lightweight-decisions.md).
> Three load-bearing facts were verified against primary sources (Fetch Standard, MDN,
> GA4 Measurement Protocol docs, Adobe Experience League). See the Verification appendix.

## Summary

The core thesis holds up. Capture-and-drain across a worker boundary is the right primitive
for INP, and treating the datalayer, performance, and supply-chain problems as one boundary
is a genuine insight, not a slogan. The design is ready to move forward, with revisions. Three
things need a decision before implementation: egress cannot live entirely behind the airlock
(the last beacon is main-thread-only), the two controls that make the security story real are
still undefined, and the connector contract will misfit the second archetype unless it is
shaped now for what a wrapped SDK needs. None of these is rework. They are clarifications the
design is better for making before the first spec, not after.

## Perspectives selected

Technical Soundness, Reliability & Failure Modes, Security & Trust Boundaries,
Scalability & Performance (read as CWV/INP, not RPS), Product & Consumer Impact,
AI-Native Maintainability. Skipped: Operational Complexity (this is a client library with no
ops team; the relevant parts fold into AI-Native), LLM/AI Systems (the runtime is not an LLM
system), Migration (greenfield; the drop-in compat angle folds into Product).

## Strengths

- **The one-boundary framing is real.** The main thread captures and enqueues, and a cheap
  synchronous projection fold keeps reads correct while mapping and egress move off-thread.
  That single move genuinely pays out in INP, datalayer sanity, and egress control at once.
  It is not three features wearing a trench coat.
- **Event-sourcing the datalayer resolves a known caveat honestly.** The append-only log plus
  synchronous projection is the fix for `patchDatalayer`'s async-read problem, stated plainly
  in AD-3 and the Data model section. Synchronous readers see current state, processing still
  goes off-thread.
- **Reusing `aem-cwv-helper` de-risks two hard parts.** The scheduling taxonomy becomes the
  drain scheduler and the diagnostics become the oracle. Promoting last-resort patches to
  structural design is the right call, and it means the timing primitives are already proven.
- **AD-4 is correctly justified and survives fact-checking.** Avoiding SharedArrayBuffer and
  COOP/COEP to keep third-party embeds working is sound. The Partytown analysis that motivates
  it is accurate (see Verification, C).
- **Oracle-strength routing is the best idea in the plan.** Routing GA4 to servo-unattended
  (strong external oracle) and above-the-fold personalization to jig-supervised plus human
  visual review (wide proxy-gap) is exactly right, and almost nobody writes this down.
- **The risk-retirement framing is honest.** The design names its own load-bearing uncertainty
  and puts the spike that retires it first. That is the correct shape for an AI-native build.
- **The failure edges were considered, not hand-waved.** Clarifications Q1 (chamber crash
  isolation), Q2 (seal retention to unload), and Q3 (keepalive-cap overflow) show the edges got
  attention before review.

## Findings

### Risks (things that could go wrong)

**R1. The INP win lives in the tail, so the spike has to measure the tail.**
The worker's advantage over a competent main-thread version (like `patchDatalayer` plus
`runWhenIdle`) is not the median interaction on a quiet page. In both designs the interaction
handler does the same cheap work: append a descriptor, fold the projection. The difference
shows up on the interactions that land *while deferred work is running*. A main-thread idle
callback that is executing when the user taps blocks that tap until it yields. The worker never
does. So the delta is a p95/p99 effect under interaction load, not a single-click effect. If
the scoreboard measures one click on an idle page, the delta will look small and understate the
thesis, and the go/no-go verdict will be made on the wrong number. Two mitigations, both for the
spike: drive an interaction storm (rapid repeated input while events are draining), and chunk
the drain's `postMessage` serialization with a yield between chunks. Structured-clone of a large
batch is itself main-thread work; an unchunked drain that fires just before an interaction
reintroduces the exact jank the design removes.
*Perspective: Technical Soundness / Performance. Severity: Significant.*

**R2. Egress cannot live entirely behind the airlock. The last beacon is main-thread-only.**
The thesis one-liner says the main thread only captures and enqueues, and all egress happens
behind the airlock. That cannot hold for the final beacon of a session, which is usually the
most important one (an outbound click, the closing pageview). Verified against the Page
Lifecycle guidance and the HTML spec: `visibilitychange` to `hidden`, `pagehide`, and `unload`
fire on the main thread only. A dedicated worker never receives them, and it is torn down with
its document. In-flight keepalive requests are best-effort after teardown, not guaranteed (there
is a ~30s cap and a documented Chromium non-send case). So a pure capture-and-enqueue main
thread drops the session's last beacon. Egress is therefore a split responsibility: the worker
owns normal-path egress, and the main thread must own or synchronously trigger the end-of-session
flush at `visibilitychange` to `hidden`. This is solvable and does not sink the design, but it
changes the invariant and it touches OQ2 (cycle semantics) and the spike. A related correctness
point: the 64 KiB keepalive limit is an *aggregate* budget across all in-flight keepalive
requests, not per-request, and Chrome adds count caps (255 total, 9 per renderer). Funneling
every connector's egress through one worker shares that single budget. A session-end burst
silently exceeds it, and the failure is a `TypeError` indistinguishable from a network outage,
so the runtime cannot confirm what actually sent. Clarification Q3 (chunk under the cap, emit
sequentially) is the right instinct but must bound the *concurrent in-flight* total, not just
per-cycle size.
*Perspective: Reliability & Failure Modes. Severity: Significant.*

**R3. The connector contract, pinned in MVP1 against GA4, will misfit the wrapped-SDK archetype
unless it is shaped now for what a wrapped SDK needs.**
AD-7 says completing both archetypes proves the connector abstraction generalizes, and drive-order
step 5 pins the connector and capability contracts before implementation, specifically so a break
against a pinned contract reads as a tooling failure and not spec ambiguity. The risk is that GA4
is a stateless, DOM-free, async-pure beacon, and the second archetype (Alloy in a chamber) is
none of those. Verified against Adobe docs: Alloy reads and writes first-party cookies through a
synchronous `document.cookie` wrapper (up to seven `kndctr_*` / `AMCV_*` / `demdex` cookies for
identity, cluster routing, and consent), uses `sessionStorage` (which does not exist in worker
scope), and dereferences `window` and `document` at module load. Its auto-context collection is
disableable (`context:[]` plus host-supplied XDM), and its personalization has an official
headless mode (`renderDecisions:false` returns propositions as data for the host to apply), so
those are soft. The hard blocker is *synchronous* cookie and storage access, which an async
message-passing bridge cannot serve inline. If MVP1 freezes the capability contract on
"async-only, no synchronous host calls," Alloy does not fit without a `SharedArrayBuffer` and
Atomics escape hatch (which re-introduces the COOP/COEP that AD-4 rejects) or an in-worker
sync-cache with async write-back. The practical consequence: the MVP1 contract must make three
things first-class now, or it will be the wrong shape later. (a) Async context and identity
injection, so `context:[]` plus host XDM replaces ambient collection. (b) Mediated cookie and
storage get/set as an explicit capability, with the sync-versus-async semantics decided, not
assumed away. (c) Personalization as "return decisions as data, host applies," never "the
connector mutates the DOM." This also surfaces a real AD-4 versus AD-7 tension: the wrapped-SDK
archetype may need synchronous cross-thread reads, and the sync-cache shim is the path that
preserves AD-4. That shim should be validated, ideally by booting the Alloy bundle in a worker
against a shimmed global to find exactly where it first needs a synchronous cookie, before the
capability contract locks.
*Perspective: Technical Soundness / AI-Native Maintainability. Severity: Significant.*

### Gaps (things the proposal does not address)

**G1. UC-1's no-flicker apply is unspecified, and it sits outside the airlock.**
Above-the-fold personalization without flicker needs a synchronous, pre-paint, main-thread DOM
change. You cannot round-trip to a worker before first paint without either blocking paint (an
LCP hit) or showing default content and repainting (the flicker UC-1 forbids). Clarification Q4
already puts the eager-window decisioning on the main thread as the local driver, so the
decide-and-apply for UC-1 runs outside the boundary and only the exposure report crosses the
airlock. That is a defensible choice. The gap is that the design specifies `reserveSpace` and
`insertAfterInteraction` for *late-injected* content (the anti-CLS case), but the *eager swap*
(hide the original until the decision lands, or mutate before paint, the way aem-experimentation
does it) is a different DOM operation with different timing, and it is not specified. As written,
one of the three demo items is largely orthogonal to the thesis it demonstrates, and its core
property (no flicker) is delivered by main-thread code the airlock does not provide. The docs
should say so, and should specify the eager-swap mechanism.
*Perspective: Technical Soundness. Severity: Significant.*

**G2. The two controls that make the security story real are still undefined, and both need a
stated default-deny, host-owned stance.**
The whole security value proposition is that a connector can read only declared data and emit
only to declared endpoints. Two controls enforce that, and both are parked in open questions.
The projection snapshot boundary (OQ4) decides what a connector can read per event; if the
snapshot ever carries form-field values or PII that landed in the projection, a compromised
connector (a real threat at MVP2, when it wraps vendor code) exfiltrates it to its allowlisted
endpoint. The seal's endpoint allowlist decides where a connector can send; if a connector
declares its own endpoints, a compromised connector declares `evil.com` and the seal provides no
supply-chain protection. For a capability-security system these are the whole game, and they
should be stated as principles in the design, not left to OQ resolution: the projection snapshot
defaults to empty and the connector declares the fields it needs against a host policy, and the
endpoint allowlist is host-owned and immutable from the connector side. The direction of the
default is the security property. State it.
*Perspective: Security & Trust Boundaries. Severity: Significant.*

**G3. "Chamber" promises more isolation than MVP1 delivers.**
The vocabulary sells per-connector isolation: a broken tag cannot sink the page, and one
compromised tag cannot read another's data. OQ1 leans to a plain Web Worker for MVP1. A plain
worker is a single shared sandbox. With one first-party connector (GA4) that is fine, and
clarification Q1's "isolate the failing chamber" holds for thrown exceptions caught at the
dispatch boundary. It does not hold for a connector that blocks the worker's event loop or
exhausts its memory, and it does not give per-connector confidentiality. True per-connector
isolation arrives only with per-connector workers or a WASM sandbox, which the design defers to
MVP2. The security story the vision sells to the compliance and security buyer is therefore an
MVP2-and-later property, not an MVP1 property. That is a fine sequencing choice. It should be
stated honestly so the isolation claim and the MVP1 reality do not drift.
*Perspective: Security & Trust Boundaries / honest capability. Severity: Significant.*

**G4. The oracle infrastructure is not in the stack, and the GA4 oracle needs a hermetic
complement.**
Two of the three named oracle components need a browser, not vitest. `cwv_budget` (Lighthouse)
and the flicker oracle (OQ6) require browser automation (Lighthouse CI, Playwright or Puppeteer),
which the tech stack does not yet name. Refinement-todo already flags CI as unconfigured and notes
it is required before servo can run the GA4 conformance oracle. That whole harness is a
precondition for any servo-unattended loop, so it sits on the critical path before autonomous
implementation, not after. Separately, the GA4 oracle itself is weaker than the plan assumes.
Verified against the GA4 docs: `/debug/mp/collect` validates naming and schema rules but accepts
arbitrary custom event names by design, so a typo'd event name (`purchse`) passes clean and then
silently drops in production. It also does not authenticate the `api_secret`, and it is a live
external call with no documented rate limit. So an empty `validationMessages` array is a weak
pass. For the variant-race that step 9 justifies on oracle strength, a variant could win by
emitting a structurally valid but semantically wrong payload. `ga4_mp_conformance` should be a
two-part oracle: a local golden fixture that pins the exact expected event name and parameter set
and asserts the built payload against it (hermetic, closes the typo gap), plus the debug endpoint
used only to gate on the *presence* of validation errors, kept non-blocking or cached so CI does
not depend on a third-party network call.
*Perspective: AI-Native Maintainability. Severity: Significant.*

**G5. Absolute capture-path and INP budgets are missing.**
The clarifications note that the INP bar is comparative only, with no absolute capture-path budget.
A comparative oracle ("beat the main-thread version") is expensive and unstable: it requires
running both versions every time and comparing two noisy distributions. Absolute budgets are
cheaper and more stable gates: a bound on the projection fold (for example under 1ms), a bound on
the capture handler, and an INP p75 target (the 200ms threshold is the obvious anchor). Pin these
with OQ6 so the spike scoreboard has a fixed target, not just a moving comparison.
*Perspective: Performance / AI-Native Maintainability. Severity: Moderate.*

**G6. Doc drift will mislead autonomous sessions.**
[conventions.md](../conventions.md) still marks Git and Testing as Deferred, but both are decided
elsewhere: Testing is vitest (in refinement-todo and both design docs), and Git is direct-to-main
plus Conventional Commits (in the decisions log and CLAUDE.md). An autonomous session that reads
conventions.md for the source of truth gets a stale answer on both. Code style is genuinely
undefined in all three docs, which matters more than usual here: undefined style means
inconsistent output across independent sessions. Reconcile the Git and Testing sections to point
at the decisions, and pin a minimal code-style baseline (formatter, lint config) before the first
code spec.
*Perspective: AI-Native Maintainability / doc hygiene. Severity: Moderate.*

**G7. Consent-mode mapping for the GA4 path is unspecified.**
AD-9 defaults consent to pending and is prerender-aware, which are good defaults. But the GA4
connector is the MVP1 external contract, and GA4 has its own Consent Mode v2 semantics
(`analytics_storage`, `ad_storage` signals) that the binary seal does not obviously map onto. For
UC-2 to be correct against a real GA4 property, the seal's consent state has to translate into the
right Consent Mode signals, not just gate the send. Specify the mapping, or scope MVP1 explicitly
to the consent-granted path and name Consent Mode as deferred.
*Perspective: Security & Trust Boundaries / Product. Severity: Moderate.*

### Trade-off challenges (decisions worth scrutinizing)

**T1. "Drop-in" push() versus "not ACDL semantics."**
The vision sells drop-in ES modules and a push()-shaped compat surface, loosely GTM/ACDL-shaped.
AD-3 says explicitly this is not ACDL semantics. Those two claims are in tension. GTM's
`dataLayer.push` triggers tag evaluation and supports `push(function(){...})`; ACDL supports
`getState()`, path-based reads, computed state, and `on()` listeners. "Loosely shaped" plus "not
ACDL semantics" means an existing dataLayer setup may not be drop-in. The challenge is not to
implement ACDL. It is to enumerate which subset of push()/dataLayer semantics MVP1 supports and
which it drops, because "drop-in" is a promise to the primary user, and right now it is unverified.
*Perspective: Product & Consumer Impact.*

**T2. Emergent schema (OQ3) inherits whatever the GA4 mapping bakes in.**
Letting the vendor-neutral schema emerge from the GA4 mapping rather than designing it up front is
reasonable and avoids premature abstraction. The thing to watch: the GA4 mapping will bake in
implicit event shapes (its field names, its type coercions, its event taxonomy), and a later
"emergent" schema inherits those as constraints whether or not they generalize. That is
acceptable if it is a conscious lock-in. It is a problem if the second connector then has to fight
GA4-shaped assumptions. Note the risk in the OQ3 resolution so the MVP2 connector work knows to
check it.
*Perspective: Data / Technical Soundness.*

**T3. Capture ring-buffer overflow policy is unspecified.**
"Capture and enqueue never wait" means that under sustained main-thread pressure with no idle, the
capture ring buffer fills and something must give. Clarification Q2 covers the *seal* buffer and
Q3 covers keepalive overflow, but the *capture* buffer's overflow policy (drop oldest, drop
newest, or grow) is an analytics-correctness decision that is currently open under OQ2. Drop-oldest
loses the earliest events of a burst; drop-newest loses the latest. Pick one deliberately and
record it.
*Perspective: Reliability & Failure Modes.*

## Out of scope, worth tracking

- **Service Worker as the eventual home for durable egress.** The egress fact-check found that a
  dedicated worker is the wrong primitive for surviving the page, and the Service Worker is the
  context designed to outlive it. This is already roadmapped as a later progressive enhancement.
  The finding reframes it from a nice-to-have into the correct long-term answer for the unload
  flush, which is worth carrying into that later slice.
- **OQ5 identity / first-party cookie store home.** Correctly deferred past MVP2. The Alloy
  finding (synchronous cookie access) is early evidence for where the eventual mediated cookie
  capability has to live and how connectors get scoped access.
- **OQ7 inspector scope.** Note that keepalive failures are opaque (a `TypeError` indistinguishable
  from a network error), so "why did this beacon not send" cannot be answered from the fetch result
  alone. That constrains what the inspector can honestly show.
- **OQ8 distribution (npm versus git subtree).** Sensibly deferred to the first external release.

## Completeness check

Problem, scope, and key decisions are strong and well-stated. Alternatives are recorded (the OQ
leanings, the competitive landscape). What is missing or partial and material to this proposal:
operational readiness (CI and the browser-automation oracle harness, G4); absolute non-functional
budgets (G5); the egress-split decision (R2); the two security defaults (G2); the connector and
capability contract shape for the second archetype (R3); and a versioning/evolution policy for the
connector interface and capability API, which are positioned as public extension points but have
no stated breaking-change policy yet. Data flow and component responsibilities are clear. The
transition path (MVP1 to MVP2) is named but its load-bearing feasibility (Alloy in a chamber) is
unvalidated, which R3 addresses.

## Questions for the author

1. For UC-1, what applies the above-the-fold decision before paint, and how is the original
   content hidden until the decision lands? Is that mechanism inside the airlock, or is it a
   separate eager-window main-thread path that the docs should specify on its own?
2. Who owns the endpoint allowlist, the site/host config or the connector? Is it immutable from
   the connector side? The security thesis depends on the answer.
3. For the end-of-session beacon, do you want the main thread to beacon directly at
   `visibilitychange` to `hidden`, or the worker to pre-stage ready-to-send payloads back to the
   main thread for it to flush? Both preserve the mapping-off-thread property differently.
4. Should the capability API reserve synchronous-looking host calls (cookie and storage, served by
   a sync-cache with async write-back) now, so the pinned contract can host a wrapped SDK later
   without a SharedArrayBuffer retrofit that revisits AD-4?
5. What subset of dataLayer/ACDL push() semantics counts as "drop-in" for MVP1?

## Recommended sequence before implementation

This maps onto the drive order and folds in the three verified findings.

1. **Resolve the MVP1-blocking OQs as ADRs (drive-order step 4), informed by this review.**
   - OQ1 (isolation): plain Worker for MVP1 is acceptable for GA4-only. The ADR should record that
     isolation is per-worker in MVP1, not per-connector (G3), and should name the AD-4 versus AD-7
     tension and the sync-cache path that reconciles it (R3).
   - OQ2 (event descriptor + cycle semantics): the ADR now also has to encode the split-egress
     model (R2), the concurrent in-flight keepalive budget bound (R2), and the capture ring-buffer
     overflow policy (T3).
   - OQ4 (projection snapshot privacy): the ADR states default-empty, connector-declares-needs,
     host-validated (G2).
2. **Shape the contracts (drive-order step 5) so the connector and capability API are not frozen
   wrong.** Make async context/identity injection, mediated cookie/storage get-set with decided
   sync semantics, and decisions-as-data personalization first-class (R3). Make the endpoint
   allowlist host-owned (G2). Decide the sync-host-call question before the capability API locks.
3. **Stand up the oracle harness before the first unattended loop (G4).** Lighthouse CI plus a
   browser-automation runner, and the two-part `ga4_mp_conformance` oracle (local golden fixture
   plus debug-endpoint error-presence check). Configure CI (refinement-todo already flags this).
4. **Design the spike scoreboard for the tail (R1) and to absolute budgets (G5).** Interaction-storm
   workload, chunked yield-aware drain, INP p75 and capture-path budgets, head-to-head against a
   `patchDatalayer`-style main-thread baseline.
5. **Optional thin de-risking spike, recommended: boot the Alloy bundle in a worker against a
   shimmed global.** Not the full MVP2 connector, just enough to find where Alloy first needs a
   synchronous cookie and confirm the sync-cache shim works. This retires the biggest MVP2 unknown
   and validates the capability-API sync decision before it is frozen (R3). It is bounded and
   cheap, and it is the highest-leverage research task on the board.
6. **Reconcile the docs (G6).** Point conventions.md Git and Testing at their decisions; pin a
   minimal code-style baseline.

## Verdict

**Ready to proceed:** With revisions.
**Reasoning:** The thesis is sound and worth building; before the first spec, resolve the
egress split, the two security defaults, and the connector-contract shape, and design the spike to
measure the tail, because these are cheap to fix now and expensive to unwind after a contract is
pinned.

For a deeper dedicated security pass on the trust boundary, the projection snapshot boundary, and
the seal, consider invoking `/adobe-security-foundations`.

---

## Verification appendix (primary-source fact-checks, 2026-08-25)

**A. Worker egress and the unload path (Fetch Standard, MDN, Chrome Page Lifecycle, HTML spec).**
`fetch(..., {keepalive:true})` is supported in dedicated workers. `navigator.sendBeacon` is not on
`WorkerNavigator` and was never implemented, so the doc's claim that keepalive works from workers
"unlike sendBeacon" is accurate, keep it. The 64 KiB keepalive body limit is an aggregate budget
across all in-flight keepalive requests in the fetch group, not per-request; exceeding it returns
a network error that surfaces as a `TypeError` indistinguishable from a real failure. Chrome adds
caps of 255 total and 9 per-renderer in-flight keepalive requests. Unload-detection events
(`visibilitychange`, `pagehide`, `unload`) fire on the main thread only; a dedicated worker never
receives them and is terminated with its document. In-flight keepalive requests are best-effort
after teardown, not guaranteed (a ~30s cap and a documented Chromium non-send case). The
recommended last-moment pattern is main-thread-owned: send at `visibilitychange` to `hidden`.
Feeds R2.

**B. GA4 Measurement Protocol validation (GA4 developer docs).**
Endpoint confirmed: `https://www.google-analytics.com/debug/mp/collect` (EU: `region1`). It
validates naming and schema rules (`NAME_RESERVED`, `NAME_INVALID`, `VALUE_OUT_OF_BOUNDS`,
`NAME_DUPLICATED`, and others) and returns `{validationMessages: [...]}`, empty on pass. It does
not catch unknown or typo'd custom event names (arbitrary custom events are valid by design), does
not authenticate the `api_secret` or measurement id, and publishes no rate limit for the debug
path. Sound as a structural and naming check (a non-empty array is a real defect), not sound as a
semantic "will this ingest correctly" oracle. Feeds G4.

**C. Partytown mechanism (Partytown docs).**
The AD-4 justification is accurate: Partytown forwards DOM access from the worker synchronously,
the default path is a service-worker-intercepted synchronous XHR, and the fast path uses
SharedArrayBuffer and Atomics, which requires cross-origin isolation (COOP/COEP) and breaks
cross-origin embeds under `COEP: require-corp`. One wording nuance for the doc: the service worker
is the default and SAB is the optional fast path with a main-thread fallback, so "forces" slightly
overstates it. The decision to avoid SAB/COOP-COEP stands. Feeds the AD-4 note under Strengths.

**D. Alloy (Adobe Experience Platform Web SDK) in a no-DOM chamber (Adobe Experience League,
adobe/alloy).**
Verdict: feasible with shims, but the strict literal "no DOM, no ambient globals, async-only"
reading is infeasible for the stock bundle. Alloy dereferences `window`/`document` at module load,
reads and writes first-party cookies through a synchronous `document.cookie` wrapper (identity,
cluster routing, consent, TLD probe), and uses `sessionStorage` (absent in worker scope).
Auto-context collection is disableable (`context:[]` plus host XDM). Personalization has an
official headless mode (`renderDecisions:false` returns propositions as data). A credentialed
worker `fetch` to the datastream does carry first-party cookies via the shared cookie jar, but
Alloy's own code still needs synchronous `document.cookie`. No public prior art runs Alloy in a
real DOM-less worker; Partytown, the only OMT-martech prior art, fakes a synchronous DOM rather
than removing it. The load-bearing blocker is synchronous cookie/storage access; the reconciling
path that preserves AD-4 is an in-worker sync-cache with async write-back, which should be
validated by a boot spike before the capability contract locks. Feeds R3.
