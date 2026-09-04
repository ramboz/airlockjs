---
slice: 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T23:01:54Z
prompt_source: review.py reconciliation docs/specs/032-instrumentation-config/spec.md 032-01
---

VERDICT: pass

## Assessment (independent reconciliation review, general-purpose reviewer)

Every Deviation-log structural claim is true in the working-tree code: `boot(config)` → `bootConnector` returning
`{handle,events}`, `createComposite`'s `acceptsEvent` fan-out gate, the `installOnWindow`/`bootGa4Core` extraction
(ownership in exactly two callers — index.js:486,941), `PIXEL_VENDORS`/`bootPixelConnector` + 3 delegating wrappers,
the partial-boot try/catch (index.js:923-940). All three post-review fixes present + truthfully logged, each with a
passing red→green test (fan-out gate, partial-boot, getState/stats caveat); the `*_MANIFEST_EVENTS` mirrors match
the real connector manifests. Tests: 20 new pass, 85 back-compat pass; the prism failure is genuinely pre-existing,
unrelated. Sweep dispositions every deliverable credibly (refinement-todo `updated` with the 3 named deferrals;
decisions/architecture `no-op` with 032-02 as named owner); no over-build (the gate is a seal-principle correctness
fix); principles hold.

## Minor finding (non-blocking) — ADDRESSED
- The sweep omitted a row for `docs/specs/032-instrumentation-config/spec.md` (the reframe added the
  composition-layer + per-governance-class Assumptions bullets). → **Added** the `spec.md` `updated` sweep row.
- Optional clarity noted: the "4 seeded regressions re-verified by mutation" (compliance pass) vs the DoD's 5
  witnessed red→green categories are two distinct verification passes, not a miscount.

Reviewer: general-purpose (independent). Pass: reconciliation.
