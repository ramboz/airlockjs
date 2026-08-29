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
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-02 — out-of-band write coherency | REVIEWED (claude/chambers-io-security…) |  |
| [011-mvp2-coherency-probe](011-mvp2-coherency-probe/spec.md) | 🔬 011-03 — coherency scoreboard + resolving ADR | READY_FOR_REVIEW (claude/airlock-mvp2-coheren…) |  |

## Richer-skill selection audit (spec 096-05)

Advisory (ADR-0040 auditability — never blocks). Regenerated from `reviews/slice-*.md` `substrate:` fields.

- **0** pass(es) recorded `not-shown` (selection step did not run — the kill-criterion-1 defect signal).
- **28** pass(es) recorded `non-interactive` (declared no-orchestrator / CI).
- **0** shown-and-declined anomaly(ies) (a high-confidence richer skill was shown and not applied):
