# Spec Status Board

> Status: Draft (wizard-generated)
>
> Current state of all specs for airlock. Update after each slice transition.
>
> A leading 🔬 in the Slice column flags slices marked `kind: spike` in
> their frontmatter — timeboxed investigation, not feature work. The
> marker is recomputed from each slice's `kind:` field on every regen
> by `workflow.py status-board`; it is never stored separately in this
> file.
>
> Related: [Bug Status Board](../bugs/README.md). Check both boards before
> folding reported defects into spec acceptance criteria.

| Spec | Slice | Status | Notes |
|------|-------|--------|-------|
| [001-adopt-jig](001-adopt-jig/spec.md) | 001-01 — bootstrap | **DONE** | worked example; review boxes satisfied by deterministic completion check |
| [002-first-spec](002-first-spec/spec.md) | 002-01 — replace-me | UNKNOWN | replace with your first real spec — run `/jig:spec-workflow` |
| [003-risk-retirement-spike](003-risk-retirement-spike/spec.md) | 🔬 003-01 — baseline + measurement rig | **DONE** |  |
| [003-risk-retirement-spike](003-risk-retirement-spike/spec.md) | 🔬 003-02 — the airlock worker path | **DONE** |  |
| [003-risk-retirement-spike](003-risk-retirement-spike/spec.md) | 🔬 003-03 — scoreboard + the answer | **DONE** |  |
| [004-uc2-ga4-eds](004-uc2-ga4-eds/spec.md) | 🔬 004-01 — Worker + Trusted Types under the EDS CSP | **DONE** |  |
| [004-uc2-ga4-eds](004-uc2-ga4-eds/spec.md) | 004-02 — bundle + lazy-phase boot + `push()` contract | **DONE** |  |
| [004-uc2-ga4-eds](004-uc2-ga4-eds/spec.md) | 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability) | **DONE** |  |
| [004-uc2-ga4-eds](004-uc2-ga4-eds/spec.md) | 004-04 — end-to-end GA4 + before/after Lighthouse | **DONE** |  |
| [005-uc1-pzn-exposure](005-uc1-pzn-exposure/spec.md) | 005-01 — exposure capture → GA4 + no-flicker invariant | **DONE** |  |
| [006-uc3-block-decoration](006-uc3-block-decoration/spec.md) | 006-01 — block instrumenter → `view_block` GA4 | **DONE** |  |
| [007-servo-oracle-ci](007-servo-oracle-ci/spec.md) | 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement) | **DONE** |  |
| [007-servo-oracle-ci](007-servo-oracle-ci/spec.md) | 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05) | **DONE** |  |
| [007-servo-oracle-ci](007-servo-oracle-ci/spec.md) | 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing) | **DONE** |  |
| [007-servo-oracle-ci](007-servo-oracle-ci/spec.md) | 007-04 — hermetic CI on GitHub Actions (vitest + contracts) | **DONE** |  |
| [007-servo-oracle-ci](007-servo-oracle-ci/spec.md) | 007-05 — browser CI (Playwright rigs + Lighthouse CI) | **DONE** |  |
| [008-ga4-purchase-conversion](008-ga4-purchase-conversion/spec.md) | 008-01 — purchase-conversion validation in the GA4 connector | **DONE** |  |
| [009-chamber-throw-isolation](009-chamber-throw-isolation/spec.md) | 009-01 — per-descriptor isolation in the chamber | **DONE** |  |
| [009-chamber-throw-isolation](009-chamber-throw-isolation/spec.md) | 009-02 — chamber failure observability (surface drops + crashes) | **DONE** |  |
| [010-ga4-purchase-conformance](010-ga4-purchase-conformance/spec.md) | 010-01 — purchase schema shape + golden + validator coverage | **DONE** |  |
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-01 — coherency rig + concurrent two-chamber writes | **DONE** |  |
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-02 — out-of-band write coherency | **DONE** |  |
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-03 — coherency scoreboard + resolving ADR | **DONE** | **OQ9 coherency axis → [ADR-0008](../decisions/adr-0008-oq9-coherency-sync-access.md): conditional GO** — retired by broker-side async mint coalescing (no SAB); wire-protocol (GA4) ready, wrapped-SDK (Alloy) freeze-held on vendor-`fetch` interception + XDM mint-recognition; B-vs-C unconstrained. Result analytical, not rig-measured. |
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-04 — async-mint coalescing needs broker-proxied egress (the OQ9 mechanism + its condition) | ABANDONED |  |
| [012-mvp2-alloy-chamber](012-mvp2-alloy-chamber/spec.md) | 012-01 — wrapped-SDK host + alloy boots + one Analytics event | **DONE** |  |
| [012-mvp2-alloy-chamber](012-mvp2-alloy-chamber/spec.md) | 012-02 — concurrent-chamber mint coalescing (lift ADR-0008's hold) | **DONE** |  |
| [012-mvp2-alloy-chamber](012-mvp2-alloy-chamber/spec.md) | 012-03 — Target personalization, decisions-as-data (headless) | **DONE** |  |
| [012-mvp2-alloy-chamber](012-mvp2-alloy-chamber/spec.md) | 012-04 — manifest declaration-shape + alloy behaviour characterization | **DONE** |  |
| [013-mvp3-live-alloy-reprobe](013-mvp3-live-alloy-reprobe/spec.md) | 🔬 013-01 — real Edge round-trip + mint-recognizability | **DONE** |  |
| [013-mvp3-live-alloy-reprobe](013-mvp3-live-alloy-reprobe/spec.md) | 🔬 013-02 — egress-breadth fan-out | **DONE** |  |
| [013-mvp3-live-alloy-reprobe](013-mvp3-live-alloy-reprobe/spec.md) | 🔬 013-03 — config-integrity / same-host-tenant re-routing | **DONE** |  |
| [014-mvp3-wrapped-sdk-core-integration](014-mvp3-wrapped-sdk-core-integration/spec.md) | 014-01 — round-trip egress + generic hosting in core (alloy driver) | DRAFT |  |
| [014-mvp3-wrapped-sdk-core-integration](014-mvp3-wrapped-sdk-core-integration/spec.md) | 014-02 — concurrent-chamber coalescing in core | DRAFT |  |
| [014-mvp3-wrapped-sdk-core-integration](014-mvp3-wrapped-sdk-core-integration/spec.md) | 014-03 — converge connector-hosting (GA4 retrofit) | DRAFT |  |

## Abandoned slices

> Slices permanently dropped, with a stated reason. This is distinct from Deferred (parked, resumable) — re-open by transitioning to DRAFT.

| Spec | Slice | Abandonment reason |
|------|-------|---------------------|
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-04 — async-mint coalescing needs broker-proxied egress (the OQ9 mechanism + its condition) |  |

## Richer-skill selection audit (spec 096-05)

Advisory (ADR-0040 auditability — never blocks). Regenerated from `reviews/slice-*.md` `substrate:` fields.

- **0** pass(es) recorded `not-shown` (selection step did not run — the kill-criterion-1 defect signal).
- **31** pass(es) recorded `non-interactive` (declared no-orchestrator / CI).
- **8** shown-and-declined anomaly(ies) (a high-confidence richer skill was shown and not applied):
  - `011-mvp2-coherency-probe/slice-03-craft.md` — applied `pr-review`; declined: scout-pr-review
  - `012-mvp2-alloy-chamber/slice-01-arch.md` — applied `none`; declined: arch-review
  - `012-mvp2-alloy-chamber/slice-01-craft.md` — applied `pr-review`; declined: scout-pr-review
  - `012-mvp2-alloy-chamber/slice-02-arch.md` — applied `none`; declined: arch-review
  - `012-mvp2-alloy-chamber/slice-02-craft.md` — applied `pr-review`; declined: scout-pr-review
  - `012-mvp2-alloy-chamber/slice-03-arch.md` — applied `none`; declined: arch-review
  - `012-mvp2-alloy-chamber/slice-03-craft.md` — applied `pr-review`; declined: scout-pr-review
  - `012-mvp2-alloy-chamber/slice-04-craft.md` — applied `pr-review`; declined: scout-pr-review
