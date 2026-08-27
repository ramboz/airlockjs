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

## Richer-skill selection audit (spec 096-05)

Advisory (ADR-0040 auditability — never blocks). Regenerated from `reviews/slice-*.md` `substrate:` fields.

- **0** pass(es) recorded `not-shown` (selection step did not run — the kill-criterion-1 defect signal).
- **6** pass(es) recorded `non-interactive` (declared no-orchestrator / CI).
- **0** shown-and-declined anomaly(ies) (a high-confidence richer skill was shown and not applied):
