> Status: Draft (wizard-generated)
>
> Decisions the initial setup explicitly deferred. Each item has a resolution trigger.
> Resolve by writing an ADR and linking it here.

# Refinement Todo: airlock

## Architecture — design open questions (OQ1–OQ8)

> Promoted 2026-08-25 from `architecture.md` § Open questions (finding #1 of the `/jig:analyze` pass). **MVP1 blockers** must be resolved — via `/jig:arch-review` then `/jig:adr-workflow new` — before SPIDR-splitting the risk-retirement spike. Leanings are recorded so reviewers have a position to attack.

### ~~OQ1 — Chamber isolation strength for MVP1 — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Plain Web Worker vs QuickJS-compiled-to-WASM with a capability bridge. *Leaning: plain Worker for MVP1* — the GA4 connector is first-party code with no untrusted vendor JS; hard chamber isolation becomes load-bearing only at MVP2 (running alloy).~~
**Resolution trigger:** Before the risk-retirement spike spec. Record via ADR; let `/jig:arch-review` attack the leaning.
**Resolved by:** [ADR-0001: Chamber isolation strength for MVP1](decisions/adr-0001-chamber-isolation-strength.md).

### ~~OQ2 — Event descriptor shape + cycle semantics — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Exact fields crossing the airlock, ordering guarantees, batching cadence, backpressure. This is the first architecture spec. (Failure-mode edges partly settled: keepalive-cap overflow splits into multiple cycles — architecture.md § Clarifications Q3.)~~
**Resolution trigger:** First architecture spec. Record via ADR before implementation.
**Resolved by:** [ADR-0002: Event descriptor shape and cycle semantics](decisions/adr-0002-event-descriptor-cycle-semantics.md).

### OQ3 — Vendor-neutral schema now vs emergent
**Deferred:** Commit to a Snowplow/Segment-style self-describing schema up front, or let it emerge from the GA4 mapping and generalize after MVP2? *Leaning: minimal/emergent* — avoid designing a schema before connectors validate it. (product-vision § Stack reconciled to this leaning, 2026-08-25.)
**Resolution trigger:** After MVP2 exercises the second connector archetype, or when a second wire-protocol connector needs shared event shapes.

### ~~OQ4 — Projection snapshot privacy boundary — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Exactly what projection state is allowed to cross the airlock to the worker per event. Part of the boundary contract.~~
**Resolution trigger:** Before the risk-retirement spike spec; pin via `/jig:contracts` (capability API surface) and an ADR.
**Resolved by:** [ADR-0003: Projection snapshot read boundary](decisions/adr-0003-projection-snapshot-privacy.md).

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

### OQ9 — MVP2 chamber isolation model + synchronous-host-access mechanism (coupled)
**Deferred:** The per-connector isolation model for MVP2 (worker-per-chamber vs QuickJS/WASM sandbox) and the synchronous cookie/storage access mechanism it requires are one coupled decision. R-004 grounded sync-access feasibility only in the plain-Worker single-realm model (host globals by reference); both MVP2 models break that precondition — separate-thread caches cannot share a synchronous cookie view without SharedArrayBuffer + Atomics (AD-4-forbidden); a WASM sandbox must marshal each read, losing the unmodified-stock-bundle property. Also unresolved: out-of-band-write staleness (a credentialed fetch `Set-Cookie`, a second tab, or a main-thread write leaving the worker's synchronous view stale). The MVP1 single-connector case (GA4 `client_id`) is served by a simple per-worker sync-cache; the multi-chamber case is not grounded. Promoted from [ADR-0001](decisions/adr-0001-chamber-isolation-strength.md) (its exposed forward-commitment).
**Resolution trigger:** Before the step-5 capability contract freezes. Settle via a **model-agnostic** coherency probe (e.g. a two-worker proxy exercising concurrent and out-of-band cookie writes) that does not presuppose the deferred B-vs-C model; then record via ADR.

### OQ10 — Egress dispatch and delivery model (incl. last-beacon)
**Deferred:** [ADR-0002](decisions/adr-0002-event-descriptor-cycle-semantics.md) deliberately stops at the worker boundary; the whole egress model is one coupled decision adversarial review showed cannot be settled by argument. It spans **dispatch location** (worker-side eager and off the INP path but needing a two-sender dedup/ack and a consent snapshot, vs orchestrator-side main-thread and capability-mediated but requiring idle-gating), **delivery under interaction-storm load** (idle-gated main-thread dispatch stalls and builds an undeliverable backlog; eager worker dispatch avoids it), the **aggregate 64 KiB keepalive budget** (Chrome 255/9 caps) that limits the end-of-session flush, and the **unload / last-beacon path**. The canonical last beacon — an outbound click or closing pageview generated *within* the unload window — cannot complete an async worker round-trip to be mapped before the page is torn down, so it is absent from the un-sent requests the unload flush dispatches. Rescuing it needs a main-thread **synchronous mapping fast path** for a declared set of unload-critical event types, which cuts against "mapping stays worker-side" and must honor ADR-0003's out-of-chamber minimization. Shared by egress Option B too (it also maps in the worker), so the Option-B fallback does not retire it.
**Resolution trigger:** With the risk-retirement spike, which must measure the INP-versus-delivery tension directly (an INP oracle alone is insufficient; a delivery-rate oracle is needed). The delivery-rate oracle must instrument the **drain stage** too, not just worker egress: the idle-gated main→worker drain (frozen in ADR-0002) itself caps delivery under no-idle load — it either drops-oldest before events reach the worker, or fires on its max-latency cap and runs structured-clone serialization during the storm — so worker-side egress cannot rescue events the drain never delivered, and a number measuring only egress would attribute drain-induced loss to the wrong stage. Record in a dedicated egress ADR. Load-bearing for UC-2 analytics correctness.

### OQ11 — Event-payload read-boundary governance
**Deferred:** [ADR-0003](decisions/adr-0003-projection-snapshot-privacy.md) governs the projection-snapshot read channel (default-deny allowlist). The event-payload channel (the connector's primary input) is open and site-defined — UC-2 custom events, `push()` open object, OQ3 emergent schema — so a field-allowlist collapses to a wildcard (= default-allow). It needs a different model: a host-owned **sensitive-field denylist** that strips known-dangerous fields (raw form inputs, declared PII paths) at the boundary outside the connector's chamber, optionally tightened to an allowlist if OQ3 pins a schema.
**Resolution trigger:** With the connector interface contract at drive-order step 5; resolve jointly with **OQ3** (schema pin vs emergent). Record via ADR.

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
