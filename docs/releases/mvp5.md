# Release Plan: MVP5 — Inspector & the RUM Layer (make it visible, own the observability)

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- MVP4 completed **the core AEM stack** — GA4 + **governed** alloy + a hosted `helix-rum` connector. But two
  gaps remain before the trust + value story is complete:
  - **The enforcement + governance is still invisible.** MVP3's seal/ceiling/consent/payload decisions and
    MVP4's alloy governance surface only as redacted 009-02 console/diagnostic records. A developer cannot
    see, for a given beacon, **why it fired, held at the seal, was gated, or had a field stripped.** The
    vision names **"first-class diagnostics/inspector"** as in-scope (§ Scope) + a differentiator vs Zaraz's
    opacity (§ Competitive); **OQ7** left its scope open. An enforced-and-governed-but-invisible boundary is
    hard to trust, debug, or sell.
  - **RUM is *hosted* but not *owned*.** MVP4 sandboxes `helix-rum` as a connector (the safe, generic choice).
    But airlock is **CWV-first and already measures the same CWV/INP/CLS signals off-thread** for its own
    diagnostics — so it can **subsume** the RUM layer: emit its own **governed** RUM and *replace* the hosted
    `helix-rum` where the deployment wants it ([R-007](../research/R-007-real-prod-stack-breadth.md) §5). And
    the before/after **CWV scoreboard** (the vision's punchline, OQ6) is still only an advisory rig on the
    synthetic testbed.
- **Why now:** MVP4 built the core stack + all the governance *decisions* (the inspector's raw material) and
  *hosted* RUM (the subsume's foundation). Now make it all **visible** and **own the observability layer.**

## Appetite

- **2 weeks (fixed — small-batch).** Time fixed; **scope flexes.**
  - **Fixed core (must land):** the **enforcement-decision inspector** — the visibility that de-risks adoption
    (why did this beacon fire / hold / get gated / get stripped, across GA4 + alloy).
  - **Variable scope (gives first if the box tightens):** the **airlock-as-RUM-layer** subsume (*replace*
    `helix-rum`) + the **before/after CWV scoreboard** — both ride the same diagnostics substrate; ship the
    inspector + scoreboard first, defer the RUM *replace* to a follow-on. The scoreboard's realistic-load run
    flexes on the customer stack being available.

## Solution Outline

- **An event-sourced developer inspector.** airlock already has the append-only **event log** + the
  synchronous **projection** + the **009-02 diagnostic stream** (drops, crashes, seal holds, ceiling denies,
  consent verdicts, payload strips — now including MVP4's alloy governance). Surface a queryable **"why did
  this beacon fire / hold at the seal / get gated / get stripped"** view — the vision's named inspector.
  Reuse `ramboz/aem-cwv-helper`'s `observeSlowInteractions`/`observeLayoutShifts` (§ Stack). **Zero
  interaction-path cost** (it measures INP; it cannot wreck it).
- **airlock as the RUM layer (subsume).** airlock emits its own **governed** RUM from the CWV/INP/CLS it
  already measures — resolving the MVP4 `helix-rum` *feed/replace/coexist* decision toward **replace** where
  the deployment wants one governed, off-thread RUM emitter instead of a hosted vendor tag. *"airlock replaces
  your RUM tag — off-thread, governed, and it's already measuring."*
  - ✅ **Shipped + decided (spec 030, 2026-09-03).** `bootHelixRum` boots airlock as the governed RUM authority
    (030-02); the replace is demonstrated end-to-end with **no double-count** (030-03); the decision is landed as
    **replace (core checkpoints)** with the honest boundary + the creds-gated live gate — see the
    [decision](../decisions/lightweight-decisions.md) + the adopter [`helix-rum` README](../../connectors/helix-rum/README.md).
- **The CWV scoreboard as a first-class output.** Promote the advisory `cwv_budget` oracle into a reproducible
  before/after scoreboard (airlock vs the naive multi-tracker stack — the 152ms→8ms story), ideally on a
  realistic martech load (the customer stack).

## Risks / Rabbit Holes

- **The inspector + the RUM emitter must be zero-CWV-cost *themselves*** — a diagnostics/RUM tool that adds
  main-thread cost would violate the very INP-safe-by-construction invariant they exist to demonstrate. Read
  the log/projection/diagnostic stream **off the hot path**; never fold work into capture.
- **RUM double-counting / pipeline coexistence** — if airlock emits RUM *and* the EDS `sampleRUM` is still on
  the page (or MVP4's hosted `helix-rum` is), the deployment must pick one authority or double-count. The
  subsume must own the *replace* decision cleanly.
- **Is the enforcement-decision stream already event-shaped?** Probe how much of the 009-02 surface is already
  structured, queryable records vs needs new instrumentation, before scoping the inspector's data model.
- **Inspector scope creep** — a hosted/remote trace-collection backend + UI is a rabbit hole; keep MVP5 to a
  **local, drop-in dev inspector** (data API + a lightweight panel).

## No-Gos

- The inspector / RUM emitter must **not add interaction-path cost**.
- No **session-replay / full DOM-mutation streaming** (vision no-go).
- No **remote/hosted trace backend or account requirement** (drop-in-JS default).
- **No new enforcement** — MVP5 makes MVP3/MVP4's teeth *visible* + owns RUM; it does not add teeth.
- **No broader connector breadth** (pixel/forms/Segment/OneTrust) — MVP7+ ([R-007](../research/R-007-real-prod-stack-breadth.md)).

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **Enforcement-decision inspector** — a queryable view over the event-log + 009-02 diagnostic stream ("why did this beacon fire / hold / get gated / get stripped"), + a lightweight dev panel | MVP3/MVP4 emit the decisions; vision § Scope | An enforced+governed boundary must be legible to be trusted; the differentiator vs Zaraz opacity |
| **airlock as the RUM layer (subsume)** — airlock emits its own governed RUM, resolving MVP4's `helix-rum` feed/replace toward *replace* | R-007 §5; the MVP5 diagnostics substrate | The sharpest form of "one boundary, N payoffs" — airlock proves its own CWV payoff |
| **Before/after CWV scoreboard as a first-class output** — promote `cwv_budget` from advisory | OQ6 / spec 007-03 | The vision's punchline, shown |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Hosted/remote trace-collection UI + persisted historical traces | — | Drop-in dev inspector first |
| Adoption / distribution / 1.0 | [MVP6](mvp6.md) | Productionize after observability |
| Broader connector breadth (pixel, forms, Segment, OneTrust) | [R-007](../research/R-007-real-prod-stack-breadth.md) | MVP7+ |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **Probe the 009-02 diagnostic stream** — are the enforcement decisions already emitted as structured, queryable events? | specs 009/015/016/017/019 + MVP4 alloy governance | Determines whether the inspector is a read-layer or needs new instrumentation |
| **The RUM replace-vs-coexist decision** — one RUM authority (airlock) vs alongside `sampleRUM`/`helix-rum` | R-007 §5; MVP4 `helix-rum` connector | ✅ **Resolved (spec 030): replace (core checkpoints)** — [decision](../decisions/lightweight-decisions.md) |

## JIG Handoff

- Resolve **OQ7** (inspector scope) here.
- The inspector **reads existing surfaces** (log, projection, 009-02 stream) — extend, don't rewrite. The RUM
  emitter rides the same CWV-measurement substrate. New specs for the inspector data API + panel, the RUM
  emitter (+ the `helix-rum` replace decision), and the CWV scoreboard headline.
- Pin the inspector query/record shape + the RUM-emit shape as external contracts (`/jig:contracts`).

## Release-Check Criteria

- For any egress beacon, a developer can see **why** it fired / held / was gated / had a field stripped —
  across GA4 **and** alloy.
- airlock can **emit its own governed RUM** off-thread (the airlock-as-RUM-layer), with the
  replace/coexist story clean (no double-count).
- The **before/after CWV scoreboard** is a first-class, reproducible output (airlock vs naive multi-tracker).
- The inspector + RUM emitter add **zero interaction-path cost** (measured).
- No new enforcement behaviour changed.

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-08-31 (became MVP5 when MVP4 was set to "the core AEM stack"; folds in the
airlock-as-RUM-layer subsume that MVP4's host-`helix-rum` choice deferred; after MVP3 shipped `v0.3.0`;
appetite **2 weeks (fixed, small-batch)** — inspector-first, scope-flexes)._
