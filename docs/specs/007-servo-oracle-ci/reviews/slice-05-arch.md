---
slice: 007-05 — browser CI (Playwright rigs + Lighthouse CI)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-27T23:02:36Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: non-interactive
---

Arch — PASS (no load-bearing problem). The browser-oracle job faithfully realizes ADR-0005's routing: rig:isolation + rig:uc1 gate the job exit (no continue-on-error) while cwv:budget is advisory (continue-on-error) — the non-gating property is robustly located in the CI step config, not the script (which still exits 1 on a budget miss by design). Job isolation (AC3) complete: separate job, no needs:, so a chromium-install failure/browser flake cannot block the hermetic ga4_mp_conformance gate. COMPLETENESS confirmed against ADR-0005: with 07-04 + 07-05 the full oracle runs in CI exactly as routed — ga4_mp_conformance hermetic-gating (hermetic-oracle), isolation_invariant + flicker browser-gating (browser-oracle GATING), cwv_budget advisory (continue-on-error) — one route each, nothing orphaned or double-gated, none promoted to the unattended composite. uc1.mjs timeout change backward-compatible (defaults preserved, CI overrides via env). review-G4 precondition (CI exists before any servo-unattended loop) genuinely met, modulo the offline caveat (no live Actions run yet; A2 asserted, not demonstrated). NITS (artifact .json naming, implicit mkdir ordering) ADDRESSED post-review via the mkdir + tee + .txt edit; YAML re-verified valid.
