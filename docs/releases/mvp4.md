# Release Plan: MVP4 — Inspector & Value Proof

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- MVP3 shipped the enforcement teeth (endpoint ceiling, config-integrity, purpose-vector consent, payload
  governance, `reserveSpace` sanitizer — all landed, `v0.3.0`) — but **every enforcement decision is
  invisible.** It surfaces only as a redacted 009-02 console/diagnostic record. A developer cannot see, for a
  given beacon, **why it fired, held at the seal, was gated by the ceiling, or had a field stripped.** An
  enforced-but-invisible boundary is hard to trust, debug, or sell.
- The vision names **"first-class diagnostics/inspector"** as **in scope** (product-vision § Scope) and a
  **differentiator vs Cloudflare Zaraz's opacity** (§ Competitive landscape). **OQ7** ("inspector scope in
  MVP1 vs later") is still open — this is where it lands.
- Separately, the headline **value proof** — the before/after CWV scoreboard, the vision's *punchline* and the
  servo oracle (OQ6) — exists only as an **advisory `cwv_budget` rig on the synthetic testbed**. It has never
  been made a first-class, reproducible output on a realistic martech load. "Measure before optimizing —
  diagnostics are first-class" is a stated design principle; today they are bolted-on.
- **Why now:** MVP3 built all the enforcement *decisions* (seal holds, ceiling denies, consent verdicts,
  payload strips) — the raw material for an inspector now **exists as events**. This is the moment to surface
  them, before adoption (MVP5) needs them.

## Appetite

- **TBD — a user decision** (ripe to set now that MVP3 shipped). _Proposed scope shape (budget still the
  user's to fix):_ this is a **make-visible** release, not new enforcement — spend it **inspector-first**: the
  enforcement-decision inspector over the *existing* event-log + 009-02 diagnostic stream, then the CWV
  scoreboard as a first-class output. Variable scope: how rich the inspector goes (a data API + console panel
  vs a visual overlay), and whether the CWV proof runs on the synthetic testbed only or the **real customer
  prod stack** (Risk-First, below).

## Solution Outline

- **An event-sourced developer inspector.** airlock already has the append-only **event log** + the
  synchronous **projection** + the **009-02 diagnostic stream** (drops, crashes, seal holds, ceiling denies,
  consent verdicts, payload strips — emitted across specs 009/015/016/017/019). Surface a queryable **"why did
  this beacon fire / hold at the seal / get gated / get stripped"** view over that existing stream — the
  vision's named inspector. Reuse `ramboz/aem-cwv-helper`'s `observeSlowInteractions`/`observeLayoutShifts`
  (per § Stack) as the perf-diagnostic substrate. Local + drop-in, dev-facing.
- **The CWV scoreboard as a first-class output.** Promote the advisory `cwv_budget` oracle into a
  **reproducible before/after scoreboard** (airlock vs the naive multi-tracker stack — the measured 152ms→8ms
  INP p75 story), the vision's punchline, ideally on a realistic martech load (the customer stack), not just
  the synthetic testbed.

## Risks / Rabbit Holes

- **The inspector must be zero-CWV-cost *itself*.** A diagnostics tool that adds main-thread / interaction
  cost would violate the very *INP-safe-by-construction* invariant it exists to demonstrate. It must read the
  log/projection/diagnostic stream **off the hot path** — never fold work into capture.
- **Is the enforcement-decision stream already event-shaped?** Probe how much of the 009-02 diagnostic surface
  is already emitted as *structured, queryable* records vs needs new instrumentation, before scoping the
  inspector's data model.
- **The CWV proof is only credible under a *realistic* load.** The synthetic testbed under-represents a real
  stack. The customer prod stack is the ideal substrate — but airlock hosts only GA4 + alloy today, so the
  proof is "the **supported subset** on a real page + CWV preserved," not "the whole stack" (full-stack
  hosting is a long-term breadth target — see MVP5 Split + the roadmap note).
- **Inspector scope creep.** A hosted/remote trace-collection backend + UI is a rabbit hole — keep MVP4 to a
  **local, drop-in dev inspector** (data API + a lightweight panel).

## No-Gos

- The inspector must **not add interaction-path cost** — it measures INP; it cannot wreck it. No synchronous
  work on capture.
- No **session-replay / full DOM-mutation streaming** (vision no-go — antagonistic to "no DOM access").
- No **remote/hosted trace backend or account requirement** (drop-in-JS portability default).
- **Not new enforcement.** MVP4 makes MVP3's teeth *visible*; it does not add teeth. Alloy-governance-symmetry
  (payload/consent enforcement for the wrapped-SDK) stays a separate, probe-gated item.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **Enforcement-decision inspector** — a queryable view over the event-log + 009-02 diagnostic stream answering "why did this beacon fire / hold / get gated / get stripped," + a lightweight dev panel | MVP3 emits the decisions; product-vision § Scope names the inspector | An enforced boundary must be legible to be trusted; the named differentiator vs Zaraz opacity |
| **Before/after CWV scoreboard as a first-class output** — promote `cwv_budget` from advisory to a reproducible airlock-vs-naive scoreboard | OQ6 / spec 007-03; the 152ms→8ms measurement | The vision's punchline (the value proof), shown — not bolted-on |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Hosted/remote trace-collection UI + persisted historical traces across sessions | — | Backend + account; drop-in dev inspector first |
| A production end-user-facing surface | — | Dev-facing inspector is the MVP4 scope |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| The CWV proof **on the real customer prod stack** (vs the synthetic testbed) | Customer offered a recent real prod martech stack | Do the testbed proof for sure; the real-stack run is a stretch gated on the stack being available + the supported-subset caveat |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **Probe the 009-02 diagnostic stream** — confirm the enforcement decisions (holds/denies/verdicts/strips) are already emitted as structured, queryable events (the inspector's data source) | specs 009/015/016/017/019 | Determines whether the inspector is a read-layer over existing events or needs new instrumentation |
| **Secure the CWV-proof substrate** — the customer prod stack, if pulled | Customer offer | A realistic martech load makes the before/after credible |

## JIG Handoff

- Resolve **OQ7** (inspector scope) here — MVP4 is where the inspector lands.
- The inspector **reads existing surfaces** (the append-only log, the O(1) projection, the 009-02 diagnostic
  stream) — extend, do not rewrite. New specs for the inspector data API + panel + the CWV scoreboard headline.
- Pin the inspector's query/record shape as an external contract (`/jig:contracts`) before implementation, per
  the anti-drift principle.

## Release-Check Criteria

- For any egress beacon, a developer can see **why** it fired / held at the seal / was gated by the ceiling /
  had a field stripped — the enforcement is legible, not just enforced.
- The **before/after CWV scoreboard** is a first-class, reproducible output (airlock vs naive multi-tracker) —
  the vision's punchline, shown.
- The inspector adds **zero interaction-path cost** (the INP-safe-by-construction invariant holds with the
  inspector active — measured).
- No new enforcement behaviour changed (MVP4 is visibility, not teeth).

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-08-31 (shaped alongside MVP5, after MVP3 shipped `v0.3.0`; appetite TBD — proposed
inspector-first shape)._
