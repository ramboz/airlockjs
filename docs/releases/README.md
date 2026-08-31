# Release Slate

This slate is a compact view of release plans that matter right now. It is not
a backlog, not a roadmap, not a sprint plan, and not a second JIG status board.
JIG remains the source of truth for implementation lifecycle state.

Keep entries short. Link to release plans and, when useful, JIG specs or slices
without copying JIG lifecycle status. Remove dropped or deferred ideas once
they stop informing a current release decision.

## Candidate

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [MVP4 — Inspector & Value Proof](mvp4.md) | MVP3 shipped the enforcement teeth (endpoint ceiling, config-integrity, purpose-vector consent, payload | No JIG handoff linked. |
| [MVP5 — Adoption & 1.0 Readiness](mvp5.md) | The runtime (MVP1), both connector archetypes (MVP2), the enforcement teeth (MVP3), and — pending MVP4 — | No JIG handoff linked. |

## Committed

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |

## Shipping

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |

## Shipped

Recently shipped release plans stay here only while they inform current decisions.

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [MVP1](mvp1.md) | Martech is the dominant source of CWV regression and a live supply-chain risk, | JIG handoff: [probes/eds-testbed](../../probes/eds-testbed/), [contracts/](../../contracts/README.md) |
| [MVP2](mvp2.md) | MVP1 proves the runtime and the **wire-protocol** connector archetype (GA4, | JIG handoff: [MVP3](mvp3.md), [spec 011](../specs/011-mvp2-coherency-probe/spec.md), [spec 012](../specs/012-mvp2-alloy-chamber/spec.md) |
| [MVP3](mvp3.md) | MVP2 proves alloy isolates and runs in a chamber but deliberately leaves its I/O seams unsecured and alloy's config-driven behaviour uncharacterized. MVP3 secures the seams (ADR-0006/0007 enforcement) against alloy's real, measured behaviour — turning the declaration shape established in MVP2 into enforced least-privilege. | JIG handoff: [spec 012-04 §Findings](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) |

## Dropped

List only currently relevant dropped or no-go release plans. This section is
not an archive of every idea the project declined.

| Release plan | Why it still matters | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |
