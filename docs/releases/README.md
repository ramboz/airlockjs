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
| [MVP2](mvp2.md) | Prove the connector abstraction generalizes to the wrapped-SDK archetype (Adobe stack via alloy). Starts now that MVP1 is shipped. | Gated on the OQ9 coherency probe; extends the connector/capability contracts. |

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
| [MVP1](mvp1.md) | **Shipped 2026-08-28 as `v0.1.0`.** Thesis retired (INP-safe by construction, ~19× over the naive stack, ~zero CWV cost); demo trio (UC-1/2/3) landed on the EDS testbed; `ga4_mp_conformance` + isolation oracle + CI; OQ14/OQ15 closed. GA4-only, in-house decisioning. | Deferred follow-ups: OQ9 (MVP2), OQ16 (unload-path isolation), live `/debug/mp/collect` + servo release-signal wiring. Frames MVP2. |

## Dropped

List only currently relevant dropped or no-go release plans. This section is
not an archive of every idea the project declined.

| Release plan | Why it still matters | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |
