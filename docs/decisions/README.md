# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for airlock. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: Chamber isolation strength for MVP1](adr-0001-chamber-isolation-strength.md) — The worker runtime hosts each connector in a "chamber." The project vocabulary sells two guarantees: fault isolation (a broken tag cannot sink the page) and confidentiality (one tag cannot read another's data or reach the network except through the airlock). (2026-08-25, Accepted)
- [ADR-0002: Event descriptor shape and cycle semantics](adr-0002-event-descriptor-cycle-semantics.md) — This decision defines the event descriptor, the append-only event log, the cycle by which batches cross the airlock *to* the worker, and the capture ring-buffer overflow policy (OQ2). (2026-08-25, Accepted)
- [ADR-0003: Projection snapshot read boundary](adr-0003-projection-snapshot-privacy.md) — A connector reads across two channels, and the security thesis holds only if both are governed. (2026-08-25, Accepted)
- [ADR-0004: Egress dispatch and delivery model](adr-0004-egress-dispatch-delivery.md) — [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md) fixed the event descriptor, the append-only log, and the cycle that carries batches *to* the worker — and deliberately stopped at the worker boundary, deferring the entire **egress** model (dispatch location, delivery under interaction-storm load, the aggregate keepalive budget, and the unload / last-beacon path) to [OQ10](../refinement-todo.md). (2026-08-26, Accepted)
- [ADR-0005: Servo oracle design: AND-gate, isolation routing, and flicker (OQ6)](adr-0005-oracle-design.md) — Spec 007 (drive-order steps 8–9) wires the three servo oracle components named in [architecture.md:65](../architecture.md) and stands up CI, so a servo-unattended loop has a runnable truth-source. (2026-08-27, Accepted)
- [ADR-0006: Capability manifest: authoritative, consent-gated I/O declaration](adr-0006-capability-manifest.md) — The connector manifest already exists as a pinned contract, but it governs a connector's inputs and outputs asymmetrically, and only the input half is load-bearing. (2026-08-28, Accepted)
- [ADR-0007: Purpose-dimensioned consent for per-capability grants](adr-0007-consent-purpose-model.md) — Airlock gates egress on a single global consent state, which cannot express the per-purpose granularity that both privacy law and GA4's own Consent Mode v2 signals assume. (2026-08-28, Accepted)
- [ADR-0008: OQ9 coherency axis — broker-side mint coalescing, conditional on vendor-fetch interception](adr-0008-oq9-coherency-sync-access.md) — OQ9 coupled two axes into one deferred decision: cross-thread **coherency** (can a chamber's synchronous cookie cache stay fresh without SharedArrayBuffer, AD-4-forbidden) and, for [ADR-0001](./adr-0001-chamber-isolation-strength.md) Option C, **read-semantics** (a WASM sandbox may have to marshal each read). (2026-08-29, Accepted)
- [ADR-0009: MVP2 chamber isolation — Option B (dedicated Worker), ratified](adr-0009-mvp2-isolation-option-b.md) — [ADR-0001](./adr-0001-chamber-isolation-strength.md) recorded the chamber isolation-strength question (Option B, a dedicated **Web Worker** per chamber, vs Option C, an in-worker **WASM sandbox** per connector) and **deferred** it, handing the coupling to OQ9. (2026-08-29, Accepted)
- [ADR-0010: Wrapped-SDK round-trip egress as a declared-and-gated capability](adr-0010-roundtrip-egress-capability.md) — MVP1's egress is **fire-and-forget**: a connector's `handle(event)` returns `EgressRequest[]`, and the orchestrator `fetch`-dispatches each on the main thread (ADR-0004) without reading the response. (2026-08-30, Accepted)
- [ADR-0011: Config-integrity enforcement — host + tenant pin, fail-closed hold](adr-0011-config-integrity-enforcement.md) — The airlock seal keys egress on endpoint **host/path** — ADR-0004's host allow-list and ADR-0006's endpoint ceiling both gate on *where* (which host, which path) a request goes. (2026-08-30, Accepted)
- [ADR-0012: Event-payload read-boundary governance (OQ11)](adr-0012-payload-governance.md) — Airlock exposes **two** channels through which host/site data reaches a connector inside its chamber, and only one is governed today — this ADR governs the other, the open event-payload channel (OQ11), with a host-owned input-side sensitive-field denylist stripped before the payload crosses into the untrusted chamber. (2026-08-30, Accepted)
- [ADR-0013: Alloy consent enforcement: trusted seam-drop + setConsent delegate](adr-0013-alloy-consent-enforcement.md) — Airlock enforces ADR-0007 purpose-vector consent for the GA4 / wire-protocol archetype (spec 017), but the **alloy / wrapped-SDK** archetype was left ungoverned for consent + payload: [ADR-0012](adr-0012-payload-governance.md) deliberately **split** alloy payload governance as *probe-first fragile* (the vendor builds the XDM body inside the chamber, so a strip/inject at the seal was feared to break it), and ADR-0007's alloy consent enforcement stayed an open residual. (2026-08-31, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
