---
status: OPEN
topic: How airlock contains costly-DOM martech (the INP/CWV thesis) — the three levers, and the worker-dom-compat / govern+schedule strategy
created: 2026-09-01
related:
  - ./R-007-real-prod-stack-breadth.md
  - ../specs/022-helix-rum-connector/spec.md
  - ../product-vision.md
  - ../decisions/lightweight-decisions.md
---

# R-008: Containing costly-DOM martech — airlock's performance thesis

> **Open investigation**, not a decision and not committed work. It captures the 2026-09-01 brainstorm on
> airlock's *performance* half — how the runtime contains martech tags that do expensive main-thread DOM work
> (the real INP/CWV killer) — and the strategic direction (worker-dom compat layer short-term; govern+schedule
> connectors, community-driven, as the end-state). It frames a **nasty-tag POC** (its own spec) and the
> post-MVP4 roadmap. Prompted by the realisation (spec 022) that RUM proved the *governance* half but is the
> wrong vehicle for the *performance* half — a well-coded tag stays well-coded; the thesis is about the
> badly-coded one.

## Question

The DOM lives on the main thread, so a tag that reads/writes it can't simply be moved to a worker. How does
airlock contain a tag that does expensive DOM work (a 150ms `querySelectorAll` + layout thrash on every
interaction) so it doesn't wreck INP/CWV — without airlock having to rewrite every tag in the world?

## Context — the hard constraint

airlock's chamber model isolates a connector's **mapping + egress** (pure data + network) off-thread cleanly
(GA4, alloy). But DOM **capture** (reading the page) and **injection** (writing it) are main-thread-bound. So
airlock can't eliminate main-thread DOM work; it can only do one of three things to it: **move the expensive
computation off-thread, mediate + schedule the access, or budget + contain the cost.** Those are the levers.

A tag airlock *rewrites* as a connector (no ambient DOM, expresses intent through the capability API) is
already contained. The hard case is the **unmodified third-party tag** that calls `document` directly — the
majority of the martech long tail, whose vendors won't rewrite for airlock.

## The three levers

- **Lever 1 — Capability-mediated + *scheduled* DOM.** The tag expresses DOM intent through airlock's
  capability API (today: `reserveSpace`/`insertAfterInteraction`); airlock **owns the execution** and
  schedules it — batches reads (kills layout thrash), defers writes to `runWhenIdle`/`runBeforePaint`, chunks
  and `yieldToMain` between units, CLS-reserves, sanitizes. Uncontrolled synchronous work becomes budgeted
  work off the interaction path. **Have:** chambers, the injection capability, the `aem-cwv-helper` scheduler
  primitives. **Gap:** the capability surface only covers injection (needs reads + richer writes); and the tag
  must be connector-shaped. **This is the ideal end-state** — but it can't be airlock's alone to build for the
  whole ecosystem (see Strategy).
- **Lever 2 — Worker-DOM mirror (à la AMP `@ampproject/worker-dom`).** Run the **unmodified** tag in a chamber
  against a *virtual* DOM; its traversal/computation runs genuinely off-thread; only the resulting
  **mutations** are serialized to the main thread, where an airlock coordinator applies them on a frame budget
  (through the existing sanitizer + CLS reserve). The only lever that gets the *expensive computation itself*
  off the main thread for an unmodified tag. **Honest limits:** complex; breaks on tags needing *live* layout
  reads (`getBoundingClientRect`, focus, measuring), synchronous storage, or that load their own sub-resources
  expecting a real `window`. Not a transparent drop-in — **some tags will just not work in it.**
- **Lever 3 — Budget + circuit-breaker + inspector.** Measure each tag's main-thread cost (long-task +
  layout-shift attribution via `PerformanceObserver`), enforce a per-tag INP/TBT budget, throttle/trip a tag
  that blows it, and surface "tag X cost you 80ms INP" in the inspector. Doesn't make a bad tag fast; it
  **contains the blast radius + makes the cost visible.** Also the **measurement instrument** that proves any
  of this works (the before/after CWV scoreboard is exactly this).

## Strategy (maintainer direction, 2026-09-01)

- **Govern+schedule connectors (Lever 1) are the ideal END-STATE — but community-driven.** airlock can't
  rewrite every tag, and vendors won't do it themselves. So the properly-governed connector ecosystem grows
  **community-driven**, over time, tag by tag.
- **Worker-dom (Lever 2) is the short-term COMPATIBILITY / migration LAYER — explicitly not the final state.**
  It lowers the migration barrier: an unmodified tag *can* run in a chamber today, off-thread, with its
  limitations **clearly documented** (some tags won't work). It buys breadth while the governed-connector
  ecosystem matures. It is a bridge, not the destination.
- **Budget + inspector (Lever 3) is the governance floor + the proof instrument** under both.

## POC — proving the performance thesis (its own spec, next)

RUM was the wrong vehicle (the enhancer is well-coded; hosting it as-is proves nothing). The POC that proves
the point: a **deliberately-nasty synthetic tag** (a connector that does a heavy synchronous DOM traversal +
mutation on every interaction), then the **before/after CWV scoreboard** — naive main-thread INP tanks; the
same tag through airlock's **scheduled capability path (Lever 1)** keeps INP flat; **Lever 3** turns the win
into a number, not a vibe. Worker-dom (Lever 2) is framed as the follow-on spike (unmodified-tag containment),
not this POC's scope.

## Open questions

- **Lever 1's read capability.** Injection is built; the batched/snapshot-backed *read* capability (so a
  connector reads page state without a synchronous main-thread traversal) is unbuilt — shape it in the POC.
- **Worker-dom feasibility + limits.** Which real martech patterns survive a worker-dom mirror, and which are
  in the documented "won't work" set? Needs its own spike (probe `@ampproject/worker-dom` or a minimal mirror).
- **Budget/circuit-breaker semantics.** What's the per-tag INP/TBT budget, and what does "trip" do (defer,
  throttle, kill)? Does killing a tag mid-mutation leave the DOM half-written?
- **The nasty-tag fixture.** What's the most representative "bad tag" shape to synthesize (heavy
  `querySelectorAll` + write? layout-thrash read/write interleave? a big `innerHTML`?) — pick the one that
  most cleanly demonstrates containment.

## Hand-offs

- **Feeds a spec now:** the nasty-tag before/after-CWV POC (Lever 1 + Lever 3). ← next action.
- **Feeds a spike later:** worker-dom compatibility-layer feasibility (Lever 2).
- **Promotes to an ADR** once airlock commits to building the worker-dom compat layer and/or the
  govern+schedule DOM-capability surface as a product bet (the strategy above is the pre-ADR open phase).
- **Recasts spec 022:** RUM is the governance exemplar; its full-parity/cutover (022-03/05) are deferred to
  this strategy (worker-dom / community connector), not native reproduction.
