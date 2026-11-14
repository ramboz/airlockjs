---
slice: 067-04: Default egress allowlist is the stock destination set
pass: reconciliation
verdict: pass
reviewer: orchestrator
reviewed_at: 2026-11-14T00:15:00Z
prompt_source: jig:slice-land
---

Matches spec 067 sections 3 and 8 (checks 5, 8) and ADR-0062 point 7. Deviations are in the slice log. `docs/architecture.md` and `contracts/connector.d.ts` name `stockEndpoints`/`endpointNarrowing`. ADR-0006 needs no change.
