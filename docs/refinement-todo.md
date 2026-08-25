> Status: Draft (wizard-generated)
>
> Decisions the initial setup explicitly deferred. Each item has a resolution trigger.
> Resolve by writing an ADR and linking it here.

# Refinement Todo: airlock

## Architecture — design open questions (OQ1–OQ8)

> Promoted 2026-08-25 from `architecture.md` § Open questions (finding #1 of the `/jig:analyze` pass). **MVP1 blockers** must be resolved — via `/jig:arch-review` then `/jig:adr-workflow new` — before SPIDR-splitting the risk-retirement spike. Leanings are recorded so reviewers have a position to attack.

### OQ1 — Chamber isolation strength for MVP1 — ⛔ MVP1 blocker
**Deferred:** Plain Web Worker vs QuickJS-compiled-to-WASM with a capability bridge. *Leaning: plain Worker for MVP1* — the GA4 connector is first-party code with no untrusted vendor JS; hard chamber isolation becomes load-bearing only at MVP2 (running alloy).
**Resolution trigger:** Before the risk-retirement spike spec. Record via ADR; let `/jig:arch-review` attack the leaning.

### OQ2 — Event descriptor shape + cycle semantics — ⛔ MVP1 blocker
**Deferred:** Exact fields crossing the airlock, ordering guarantees, batching cadence, backpressure. This is the first architecture spec. (Failure-mode edges partly settled: keepalive-cap overflow splits into multiple cycles — architecture.md § Clarifications Q3.)
**Resolution trigger:** First architecture spec. Record via ADR before implementation.

### OQ3 — Vendor-neutral schema now vs emergent
**Deferred:** Commit to a Snowplow/Segment-style self-describing schema up front, or let it emerge from the GA4 mapping and generalize after MVP2? *Leaning: minimal/emergent* — avoid designing a schema before connectors validate it. (product-vision § Stack reconciled to this leaning, 2026-08-25.)
**Resolution trigger:** After MVP2 exercises the second connector archetype, or when a second wire-protocol connector needs shared event shapes.

### OQ4 — Projection snapshot privacy boundary — ⛔ MVP1 blocker
**Deferred:** Exactly what projection state is allowed to cross the airlock to the worker per event. Part of the boundary contract.
**Resolution trigger:** Before the risk-retirement spike spec; pin via `/jig:contracts` (capability API surface) and an ADR.

### OQ5 — Identity / first-party cookie store home
**Deferred:** A no-go for MVP1, but where it eventually lives (orchestrator, main thread) and how connectors get scoped access.
**Resolution trigger:** When identity resolution leaves the no-go list (post-MVP2).

### OQ6 — Flicker oracle design
**Deferred:** Screenshot-diff between pre- and post-decoration paint vs a CLS-after-apply proxy. A servo oracle-component question; the proxy-gap here is why the PZN demo item stays jig-supervised. This is also where the before/after CWV scoreboard (the "punchline" use case) becomes a pinned measurement surface (analyze finding #7).
**Resolution trigger:** When designing the servo oracle components for the spike (drive-order step 8).

### OQ7 — Inspector scope in MVP1
**Deferred:** How much of the "why did this beacon fire / hold at the seal / get gated" panel ships in MVP1 vs later.
**Resolution trigger:** When the diagnostics/inspector surface is specced.

### OQ8 — Distribution channel
**Deferred:** git subtree (matching aem-martech/aem-experimentation) vs npm for the EDS audience. (Repo/package slug settled: `airlockjs`.)
**Resolution trigger:** Before the first external release cut.

## Architecture — resolved at vision level (2026-08-25)

> These were wizard-deferred "no signal" items; the seeded design docs now carry the signal. Vision-level direction is set; implementation-level specifics (version pins, exact interfaces) still land with the first code spec + an ADR.

### Decision: Tech stack — RESOLVED (vision level)
**Was deferred:** No signal from the initial pitch about runtime, language, framework, or platform.
**Now:** product-vision § Stack + architecture § Tech stack specify vanilla **ES modules** (no runtime framework), **Web Workers** (batched `postMessage`, structured clone; deliberately no SharedArrayBuffer / COOP-COEP), egress via `fetch(url, { keepalive: true })`, `PerformanceObserver` for diagnostics, **vitest** for tests, **GA4 Measurement Protocol** as the external validatable contract. Reuses `ramboz/aem-cwv-helper` primitives.
**Remaining:** version pins and lint/build config — set by the first code spec (see Conventions below).

### Decision: Module boundaries — RESOLVED (vision level)
**Was deferred:** No modules yet — boundaries become explicit when the first contract is defined.
**Now:** architecture § Module boundaries + § Repository structure define the capture layer / orchestrator / worker runtime / airlock capability bridge / two seams, and the `core/` `adapters/eds/` `connectors/*` `diagnostics/` `test/` layout.
**Remaining:** formal interface contracts (connector interface, capability API, seam drivers) — pin via `/jig:contracts` before implementation (drive-order step 5).

## Conventions

### Decision: Code style and linting
**Deferred:** No signal from the initial pitch. (Still open.)
**Resolution trigger:** First spec that produces non-trivial code, or first time inconsistency causes friction.

### Decision: Testing framework — RESOLVED (vitest)
**Was deferred:** No signal from the initial pitch.
**Now:** **vitest**, per product-vision § Stack and architecture § Tech stack. Servo-scored oracle components live under `test/`.
**Remaining:** exact vitest config and the servo `oracle.sh` component wiring (`ga4_mp_conformance`, `cwv_budget`, `isolation_invariant`) — land with the spike spec (drive-order steps 7–8).

## Operations

### Decision: CI/CD setup
**Deferred:** No CI configured (scaffolded with `--no-ci`). (Still open.)
**Resolution trigger:** First spec that crosses a deploy boundary; also required before servo unattended loops can run the GA4 conformance oracle in CI (drive-order step 9, GA4 route).
