# Follow-up goal: Adobe downstream reporting and attribution

**Nonblocking, owner-approved 2026-10-12**
([ADR-0032](../decisions/adr-0032-airlock-boundary-acceptance.md)).

Airlock's primary acceptance gate is actual governed request/response/rendering conformance.
This goal covers the downstream product pipeline when an adopter needs more assurance,
not a prerequisite for every implementation or performance test.

## Existing evidence

[R-012](../research/R-012-adobe-first-compatibility.md) records one ordinary Analytics
page view and custom-link occurrence in the original headed interval, and a native Target
seven-day export with two cumulative Scoped displays in owner-confirmed Development.
Those counts remain valid; they do not prove every product, click goal or per-run attribution.
The SDK/wire/host facts and downstream facts stay separately classified.

## Trigger and scope

Start when a concrete adopter requires ingestion/reporting/attribution evidence, a
downstream discrepancy could reveal a request defect, or product configuration changes
need qualification. [Spec 056](../specs/056-adobe-product-workflow-validation/spec.md)
owns refinement and execution. No timeline or staffed export schedule is promised now.

Possible scenarios: per-run Target display/click goal deltas and duplicate attribution;
Analytics commerce/session behavior; AJO campaign outcomes; CJA ingestion/connections/data
views; RTCDP profile/audience/activation results. Scope each product independently.

Before executing, choose supported observations and real configuration/permission scope,
finite windows, operator availability, cost and cleanup. Prefer supported API methods where
available; manual reports may supplement them without guessed endpoints, UI-key substitution,
shared preset changes or report resets. Do not reopen the stopped configuration-API diagnosis
without a new concrete need and owner authorization.

## Honest completion

Report exact product/resource/environment/window/counting bindings and actual observations.
Unknown receipt is unknown, not zero/loss or a pass. No exactly-once or general product
validation from SDK boot/HTTP success/cumulative totals. Preserve original captures and
never resend old SDK events merely to force a counter.

This goal adds no resource, ingestion, role, production-publication or release authority.
