# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for airlock. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: Chamber isolation strength for MVP1](adr-0001-chamber-isolation-strength.md) — The worker runtime hosts each connector in a "chamber." The project vocabulary sells two guarantees: fault isolation (a broken tag cannot sink the page) and confidentiality (one tag cannot read another's data or reach the network except through the airlock). (2026-08-25, Accepted)
- [ADR-0002: Event descriptor shape and cycle semantics](adr-0002-event-descriptor-cycle-semantics.md) — This decision defines the event descriptor, the append-only event log, and the cycle semantics by which batches cross the airlock to the worker (OQ2). (2026-08-25, Proposed)
- [ADR-0003: Projection snapshot read boundary](adr-0003-projection-snapshot-privacy.md) — A connector reads across two channels, and the security thesis holds only if both are governed. (2026-08-25, Proposed)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
