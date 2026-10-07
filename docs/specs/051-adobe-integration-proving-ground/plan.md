# Plan: Adobe integration proving ground

> DRAFT authoring plan, not permission to call Adobe APIs or provision resources.
> The slice files carry acceptance criteria and readiness gates.

## Work order and prerequisites

| Slice | Start with | Stop before |
|---|---|---|
| 051-01 | Official read-only API/auth inventory and synthetic CLI/report/error fixtures | Any live call without approved credentials/scope; every mutation |
| 051-02 | Recent ready preflight, owner-approved resource plan, pins and receipt methods | Unverified isolation, unsupported API assumptions, production publication |
| 051-03 | Stock baseline and owner-approved 8-hour proposed spike budget | Broad public SDK implementation, control weakening, automatic release-scope revision |

The offline public-surface inventory can be prepared while arranging access, but its live
comparison and final handoff still depend on the baseline. A ready utility is not a ready test org.

## Expected deliverables

- Operator-facing probe utilities and a README under `probes/adobe-compatibility/`.
- Hermetic tests using existing Vitest patterns under `test/`; no new tooling before a demonstrated need.
- Local-only resource/capture state in an owner-approved ignored location; sanitized reference
  fixtures and evidence summaries only in committed files.
- R-012 access/baseline/compatibility findings with source pins, experiment provenance and blockers.
- A pinned SDK/scenario inventory assigning ownership to portfolio specs 052-057.

Paths are planned, not existing deliverables. Select exact commands, report fields and test names
in each implementation plan from verified supported APIs.

## Validation strategy

Use small fixture-driven command tests for access, refusal, redaction, pagination and idempotency.
Witness their failure when the relevant behavior is removed. Use the approved test domain/resources
for live positive and negative stock/chamber journeys; record bounded outcome-observation windows.
Distinguish network success, event receipt, report outcome and blocked evidence in every report.

The investigation proposes numeric performance/delivery limits from a recorded baseline; owner
approval and dependent spec refinement occur before broad implementation. No existing thresholds
or stable-core guarantees are relaxed by this plan.

## Review and reconciliation

Derive frame-review flags through Jig. Before any slice becomes READY_FOR_IMPLEMENTATION,
resolve its DoR and required frame critique. Implementation follows TDD and the repository's
compliance/craft/optional architecture/reconciliation gates.
No implementation/review verdict is represented as passed by this authoring document.
