# Start prompt — Airlock (martech runtime) build kickoff

Paste this into the dedicated Claude Code project after scaffolding jig. `product-vision.md` and `architecture.md` are pre-seeded design artifacts from a 2026-08-25 brainstorm; this prompt drives the critique-then-build loop on top of them.

---

## What we're building

**Airlock** is a capability-secured, off-main-thread martech runtime for edge/static sites, EDS first. Tags become sandboxed consumers of a typed event stream that can only emit declared events to declared endpoints — each connector running in an isolated **chamber**, reaching the network only by cycling through **the airlock**. It's drop-in ES modules, CWV-first, and treats the datalayer, performance, and supply-chain-security problems as **one** architectural boundary. Full framing is in `product-vision.md`; mechanics in `architecture.md`.

Repo / package slug: **airlockjs** (bare `airlock` is taken on npm). Connector namespace: `airlock/ga4`, `airlock/alloy`. System vocabulary: **airlock** = the mediated boundary; **chamber** = a connector's sandbox; **cycle** / **lock-through** = a batch crossing to the worker; **the seal** = consent/allowlist gating ("held at the seal" = queued pending consent).

The core thesis in one line: *the main thread only captures and enqueues; all interpretation, mapping, and egress happen behind the airlock* — and that single move pays out in CWV, datalayer sanity, and security simultaneously.

## Reference inputs (read for context, do not vendor blindly)

- `github.com/ramboz/aem-cwv-helper` — **ours.** Its scheduling taxonomy (`yieldToMain`/`runWhenIdle`/`runBeforePaint`) is the drain scheduler; its diagnostics (`observeSlowInteractions`/`observeLayoutShifts`) are the inspector and the oracle; its `patchDatalayer` is the larval version of the event-log/projection split. We are promoting these from last-resort patches to structural design.
- `github.com/adobe-rnd/aem-martech` — the Adobe-locked, main-thread, no-isolation realization of ~half this thesis (phased eager/lazy/delayed, prerender-aware). Validates the wedge; steal the prerender-awareness and consent-pending default.
- `github.com/adobe/aem-experimentation` — client-side decide-and-apply in the eager window; proves no-flicker personalization without an anti-flicker snippet. MVP1 does its own in-house version of this.

## Settled decisions (proto-ADRs — see architecture.md AD-1..AD-9)

Client-first with edge as swappable drivers (two seams: decision source, egress). Capture-and-drain. Event-sourced datalayer (append-only log + synchronous projection; **not** ACDL semantics), with a `push()`-shaped compat surface on top. No SharedArrayBuffer/COOP-COEP in MVP (batched `postMessage` cycles). Capability-mediated DOM/egress; CWV-safe injection is the only DOM path; egress held at the seal. Two connector archetypes: wire-protocol (GA4) and wrapped-SDK (alloy) — **MVP1 is wire-protocol only.** EDS three-phase integration. Consent pending by default; prerender-aware egress.

## MVP1 cutline and no-gos

**Cutline (the demo):** (1) A/B or PZN above the fold without flicker — in-house decisioning in the eager window, exposure reported through the runtime; (2) analytics with a custom event to GA4 via Measurement Protocol; (3) automatic block-decoration instrumentation for EDS (WeakMap, no `data-track-*`). Plus the before/after CWV scoreboard that proves ~zero cost.

**Single external contract for MVP1: GA4 Measurement Protocol only.** Do the experimentation decisioning in-house; do **not** integrate Optimizely or any vendor experimentation API in MVP1 (the "Google stack" has no native experimentation tool since Optimize was retired, so this is a deliberate choice, not a gap). Optimizely/VWO becomes a later slice once the connector format is proven.

**No-gos (write them into the shaper release plan so the loop can't wander in):** session replay / full DOM-mutation streaming; identity resolution / first-party cookie store; the service-worker egress chokepoint (MVP uses direct keepalive; SW is a later progressive enhancement); edge decision/egress drivers (seams only in MVP); non-EDS framework adapters.

**MVP2 = the Adobe stack (Analytics + Target via alloy).** Its value is that it exercises the *other* connector archetype (wrapped-SDK — containing a vendor lib in a chamber), proving the connector abstraction generalizes across the only two shapes it needs.

## The risk-retirement bet — retire this first

Can the event-log/projection + worker boundary **beat the main-thread version on INP while emitting an MP-conformant GA4 payload, on a real EDS page, at 100 Lighthouse?** Build the smallest thing that answers this before committing the rest of the release.

## Drive order (jig / servo / shaper)

1. **Reconcile the seeded docs.** If `scaffold-init` already produced empty `product-vision.md`/`architecture.md`, merge these in; the H2/slot structure matches the vision-elicitation contract.
2. **`/jig:clarify`** then **`/jig:analyze`** on the seeded docs — surface ambiguity and cross-artifact drift while the design is still cheap to move.
3. **`/jig:arch-review`** the architecture — attack AD-1..AD-9 and the module boundaries adversarially.
4. **`/jig:adr-workflow new`** to promote the proto-ADRs; **resolve OQ1, OQ2, OQ4** (the MVP1 blockers) into decisions. My leanings are noted in each OQ; make the reviewers argue against them.
5. **`/jig:contracts`** to pin the GA4 Measurement Protocol, the connector interface, and the `push()` API as external artifacts *before* implementation. This is what keeps failure attribution clean — a break against a pinned external contract is an agent/tooling failure, not spec ambiguity. (You author both the tooling and the subject; this pinning is how you keep the stress-test legible.)
6. **shaper `shape-release`** for MVP1 — appetite = "a demo a skeptical EDS practitioner believes"; cutline and no-gos as above; the risk-retirement bet as the named risk to retire first. Then `release-slate`.
7. **SPIDR-split the risk-retirement spike as the first spec** and build it: GA4-only, capture → ring buffer → drain/cycle → chamber → MP-conformant payload → keepalive egress, with the `observeSlowInteractions` INP measurement and a Lighthouse pass as the scoreboard. Compare head-to-head against a `patchDatalayer`-style main-thread version — that's the delta that proves the thesis.
8. **Design the servo oracle components** for that spike: `ga4_mp_conformance` (validate at `/debug/mp/collect`), `cwv_budget` (Lighthouse LHS + INP threshold), `isolation_invariant` (a connector attempt to touch `document` must throw). Weight them in `oracle.sh`'s `COMPONENTS`.
9. **Route the three demo items by oracle strength** — do not run them at the same autonomy tier:
   - **GA4 custom event → servo unattended.** Strong external oracle; a `variant-race` is justified (keep the implementation that passes conformance at the lowest INP delta).
   - **EDS decoration hooks → jig supervised**, but pin the decoration→event-mapping interface as a contract first so the oracle isn't self-referential.
   - **PZN above the fold → jig supervised + human visual review.** Weakest oracle, widest proxy-gap (a variant can flash-and-repaint within a frame without registering as CLS). Run it deliberately anyway — as a stress-test of the tooling, this is the most valuable item, because it probes exactly where servo's oracle abstraction breaks down.

## Concretely, build first

The spike from step 7, nothing more: one real EDS page, a `push()`-shaped entry that appends to an event log and folds a synchronous projection, a ring-buffer drain on idle that cycles into a Worker chamber, one GA4 connector doing the MP mapping and keepalive egress off-thread, and the INP + Lighthouse scoreboard. Green here retires the whole thesis cheaply; everything else is construction.
