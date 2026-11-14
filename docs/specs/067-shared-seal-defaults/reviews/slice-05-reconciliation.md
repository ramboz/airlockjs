---
slice: 067-05: Default cookie and storage grant is the stock set
pass: reconciliation
verdict: pass
reviewer: orchestrator
reviewed_at: 2026-11-13T22:31:00Z
prompt_source: jig:slice-land
---

Matches spec 067 sections 3 and 8 (checks 5, 7, 8) and ADR-0062 point 7 / Owner answer 3. Deviations are in the slice log: AC5 split to 067-12, and a new host-side consent denial for the alloy write-back. `docs/architecture.md`, `contracts/README.md` and the config schema name `cookieGrantNarrowing`. ADR-0006 needs no change (`granted = declared ∩ allowed` still holds; narrowing only shrinks it).
