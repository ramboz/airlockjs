---
slice: 016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR archetype)
pass: craft
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T01:02:12Z
prompt_source: independent Opus review of Sonnet implementer diffs (016-02)
substrate: non-interactive
---

## Craft review — 016-02 (alloy ceiling + config-integrity reconciliation) — PASS
Independent Opus review of the Sonnet implementer's diffs.
- The reconciliation is correct + thoroughly inline-commented: (A) ceiling first on all egress; (B)
  config-integrity gated `configIntegrity && (!endpointCeiling || hostOf(m.url)===pinnedHost)` — no-ceiling
  reduces to `configIntegrity` (015 standalone, inner block byte-identical, verified by diff + test (f) + the
  11 config-integrity unit tests); (C) the `unpinned-declared-origin` warn disclosure makes the tenant-gap
  observable, dormant in the single-origin shipped config.
- Tests genuinely assert the composition: undeclared held, WRONG-PATH-on-allowed-host held (the path
  confinement 015 lacks), honest allowed, attacker-tenant held, no-tenant 2nd origin allowed, the GAP case
  (attacker configId on a declared 2nd origin allowed + disclosed — proves the gap real AND surfaced),
  back-compat. 47/47 targeted + 83/83 neighborhood.
- Config-integrity.js untouched; 016-01's GA4 seam untouched. Override (015-02) still re-derives the tenant
  on the interact (host re-derive a no-op once scoped to pinnedHost).
- Accepted nit (implementer-flagged): no top-of-file docstring paragraph — inline comments are thorough.
No craft blockers.
