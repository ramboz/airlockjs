---
slice: 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-27T22:22:52Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: non-interactive
---

Arch — PASS (no load-bearing problem). The advisory/gating decoupling is enforced STRUCTURALLY: cwv_budget never in oracle.sh COMPONENTS (=vitest, ga4_mp_conformance), invoked by no gating path, header + final line restate the exit code never feeds the composite. ADR-0005 faithfully records D1/D2/D3 with rejected alternatives, honestly scoped ("catastrophic collapse, not the fine margin" is the right honesty for a ±30ms band over a 0-8ms signal); nothing load-bearing stranded only in code comments. Reuse boundary correct (orchestrates existing rigs via execFileSync, no reimplementation). NITS: (1)[nit] refinement-todo.md:95 stale line still lists cwv_budget+isolation_invariant as "oracle.sh component wiring" — contradicts ADR-0005 D2/D3 (both routed OUT of COMPONENTS); doc-level leak vector -> FIXED in reconciliation. (2)[nit] lh-eds.mjs:44 execSync npm run build stdio:inherit leaks the build banner into stdout (why cwv-budget needs extractTrailingJSON) — flag lh-eds stdout hygiene for future cleanup so the helper can be retired; logged (out of this slice's core scope). (3)[nit] dead start<0 guard -> FIXED. RECONCILIATION: 07-05 handoff caveat — cwv-budget.mjs exits 1 when over-budget, so the 07-05 CI stage MUST be report-only/continue-on-error (the non-gating property lives in the CI stage config, not the script) -> slice-05 updated to call this out. architecture.md:65 still groups the three as "oracle components" (partially superseded by ADR-0005 routing) -> added a one-line ADR-0005 pointer.
