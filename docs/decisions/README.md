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
- [ADR-0014: Lever-2 compat layer: a minimal airlock-owned worker-dom mirror (Tier 0)](adr-0014-worker-dom-compat-minimal-mirror.md) — airlock's performance thesis ([R-008](../research/R-008-costly-dom-martech-containment.md)) is to contain costly-DOM martech (the INP/CWV killer). (2026-09-02, Accepted)
- [ADR-0015: Distribution channel: git-subtree (EDS convention)](adr-0015-distribution-git-subtree.md) — OQ8 fixes how an EDS site consumes airlock — the gate MVP6 puts first, since everything downstream flows through it. (2026-09-04, Accepted)
- [ADR-0016: Stock alloy bundle: adopter-supplied `bundleUrl`, same-origin recommended](adr-0016-alloy-stock-bundle-site-supplied.md) — To boot **Adobe/alloy** via `boot(config)` on a *buildless* EDS site (spec 033), the classic alloy chamber worker `importScripts` the ~766 KB stock **Adobe Experience Platform Web SDK** (`@adobe/alloy`, byte-pinned per AD-7 at **v2.35.0**). (2026-09-04, Accepted)
- [ADR-0017: The airlock 1.0 public API contract (frozen surface + experimental carve-out)](adr-0017-airlock-1-0-api-contract.md) — airlock has reached MVP6. (2026-09-05, Accepted)
- [ADR-0018: Reframe: 1.0 means adoptable with confirmed parity (re-baselining the release ladder)](adr-0018-reframe-onto-adoptable-one-point-oh.md) — The owner moved airlock's definition of 1.0 on 2026-09-05 — from "the public API is frozen" to "a developer can rewire a real site's TBT-dominant tags onto airlock with confirmed parity" — and the corpus still encodes the old definition as settled truth. (2026-09-07, Accepted)
- [ADR-0019: GA4 rewire path — additive gtag-protocol connector](adr-0019-ga4-gtag-protocol-connector.md) — ADR-0018 made confirmed vendor-boundary parity the airlock 1.0 bar with GA4 as the analytics anchor, and set a GA4 kill criterion for when airlock's Measurement-Protocol egress cannot match a container's `gtag.js` tag. (2026-09-07, Accepted)
- [ADR-0020: Parity is beacon-field parity — harness-gated, drift-guarded, hard gaps owner-re-decided](adr-0020-parity-contract-anti-drift.md) — ADR-0018 made confirmed parity the 1.0 bar and defined it as "the same events, carrying the same attribution-bearing fields, reach the vendor as from the container," but it did not settle what that means *operationally* for airlock's connectors — which are **hand-built reimplementations of the vendors' wire beacons, not the vendor SDK**. (2026-09-08, Accepted)
- [ADR-0021: Core-egress batching — cross-connector coalescing](adr-0021-core-egress-batching.md) — Airlock's value proposition is a **performance best-practice** martech runtime: the main thread only captures + enqueues; mapping runs off-thread in the worker; egress is a prebuilt keepalive `fetch` dispatched on the main thread (cheap, INP-safe — grounded: `core/airlock.js:11-13`). (2026-09-09, Accepted)
- [ADR-0022: Pixel advanced-matching hashing: worker-side, main-cached for the unload path](adr-0022-pixel-advanced-matching-hashing.md) — Spec 026-04 adds Meta Pixel **advanced matching** — the hashed user-data fields (`ud[em]`/`ud[ph]`/`ud[external_id]`/…) a `/tr` beacon carries for match quality. (2026-09-10, Proposed)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
