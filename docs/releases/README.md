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
| [MVP2](mvp2.md) | Isolation / generalization proof — **proof complete 2026-08-29: cutline delivered (specs 011 + 012, ADR-0008/0009), green end-to-end.** alloy runs unmodified in a chamber, coalesced identity, CWV-safe personalization, against unchanged contracts. Awaiting a release decision; live-Alloy re-probe + seam enforcement → MVP3. | JIG handoff: [MVP3](mvp3.md) |
| [MVP3](mvp3.md) | Secure the I/O seams — turn ADR-0006/0007 declaration into enforced least-privilege against alloy's characterized behaviour. **Risk-First lead: the creds-gated live-Alloy re-probe** (real Edge response / demdex fan-out / cluster routing); then the wrapped-SDK contract-freeze + core-integration/hardening debt. | Inputs: [012-04 characterization](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md), [refinement-todo](../refinement-todo.md). |

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

## Dropped

List only currently relevant dropped or no-go release plans. This section is
not an archive of every idea the project declined.

| Release plan | Why it still matters | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |
