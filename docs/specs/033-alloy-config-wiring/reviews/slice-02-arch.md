---
slice: 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`
pass: arch
verdict: pass
reviewer: general-purpose (independent arch review, 2 rounds)
reviewed_at: 2026-09-05T02:45:57Z
prompt_source: review.py arch docs/specs/033-alloy-config-wiring/spec.md 033-02 <deliverables>
substrate: non-interactive
---

VERDICT: pass (after one needs-changes round) — architecture, slice 033-02 (arch_review: true)

Independent arch reviewer, 2 rounds; the second TRACED the reconciled seam + ran the tests.

**First pass: needs-changes** — Deviation #1 (bootAlloy omitting `configIntegrity` + `endpointCeiling`) was a
genuine 1.0 security-posture regression, not sound scoping: a config-booted alloy egressed with only a consent
gate, so a compromised adopter bundle (which ADR-0016 permits cross-origin/untrusted) could re-tenant the interact
to an attacker's Adobe org and the seam never bit (confirmed-live threat, 013-03; controls DONE in 015/016-02). The
implementer's "static ceiling can't enumerate" rationale was silent on config-integrity (pins the tenant — no
enumeration) and conflated 016-02's creds-gated ceiling BREADTH with its wireable interact FLOOR.

**Fix + re-verify: pass.** Both blockers genuinely resolved:
- **configIntegrity** — an EFFECTIVE pin: `pinnedHost = hostOf(ALLOY_INTERACT_ENDPOINT)="adobedc.demdex.net"`
  (correct `.host` form — avoids the full-URL trap that would scope config-integrity out of every request),
  `tenantKey="configId"`, `pinnedTenant = the now-REQUIRED datastreamId`, `disposition:"hold"`. The reviewer traced
  the reconciled seam + ran the test: a re-tenant interact (honest host+path, attacker configId) → ceiling passes,
  config-integrity HOLDS (`held===1`, `ceilingHeld===0`, fetch NOT called; diag `configId != host-pinned tenant`).
  The proving test is discriminating (a silently-passing pin would fail it). No no-op traps.
- **endpointCeiling** — the grounded FLOOR `[ALLOY_INTERACT_ENDPOINT]`: honest interact passes, off-floor HELD
  (`ceilingHeld===1`, diag `not in declared endpoints`). The un-grounded server-directed breadth is held+surfaced
  fail-closed per 016-02 AC3/AC5, breadth-grounding correctly scoped as the creds-gated live-Alloy follow-on.
- **Documented** — slice Close-out/Deviation log records omission→flag→fix; refinement-todo parks the follow-ons;
  datastreamId required across schema/validation/fixtures.

Round-1 STRENGTHS stand: the N-sequential-event host extension is minimal + invariant-preserving (per-event seam
gating intact, single-slot re-entry guard intact, blast radius alloy-only); the `{type:"alloy"}` composite
integration is coherent with 032 (governance threading, page_view-only fan-out, strict-consent-regardless-of-
consentStrict per 020-02). `pushCritical`-at-unload is an acceptable, now-tracked follow-on (inherent to alloy's
async round-trip).

Reviewer: general-purpose (independent arch review, 2 rounds).
