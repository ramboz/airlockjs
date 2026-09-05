---
slice: 033-03 — build: config-boot alloy (the personalization vertical) — decisions-as-data → `reserveSpace`
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique, 3 rounds)
reviewed_at: 2026-09-05T04:45:39Z
prompt_source: review.py frame-critique docs/specs/033-alloy-config-wiring/spec.md 033-03 <deliverables>
---

VERDICT: pass (after two needs-changes rounds) — frame-critique, slice 033-03 (frame_review: true)

Independent frame-critique, 3 rounds; each round re-grounded against the machinery.

**Round 1: needs-changes** — four findings: (1) the timing CRUX — `eds.js`/`boot(config)`/`bootAlloy` run in
`loadLazy` AFTER `body.appear`, so a reserve "at boot(config) time" is the post-paint FLICKER case the 012-03 rig
gates as failure; (2) AC4 consent misframed (no personalization-specific gate — the strict `egressVerdict` holds the
WHOLE shared interact if EITHER purpose denied); (3) placements multi-scope vs the connector's single `decisionScope`;
(4) exposure routing unspecified (could loop through alloy's `page_view` handle or vanish).

**Round 2: needs-changes** — reshape #1 introduced five residuals: (1) the eager entrypoint can't be `eds.js` (an
eager import pulls the full runtime → LCP regression) — needs a SEPARATE lightweight module; (2) the `window.airlock`
stash is clobbered by `installOnWindow`; (3) multi-scope request-side unwired (alloy fetches only `__view__`); (4) the
Goal still carried the old consent misframing; (5) `deliver` must guard `window.airlock` absent (standalone bootAlloy).

**Round 3 (reshape #2): PASS** — all resolved + every grounding claim verified: a separate lightweight eager module
(`reservePersonalization`) with an EXPLICIT return-value hand-off to `boot(config,{reservedPlacements})` (grounded why
window.airlock / a module-store / re-acquire-by-selector all fail); single-`__view__` scope with non-`__view__`
rejected + multi-scope deferred; Goal reconciled; the exposure guard. Three non-blocking hardening notes were folded
in (the no-lazy-fallback INVARIANT; the connector — not the adapter — `__view__`-filters; the new build.mjs entry
named); two passed to the implementer (the handle is a Promise, awaited; the prehide-timeout backstop may want a
longer per-placement value for the wrapped-SDK round-trip).

The single-`__view__` personalization vertical is sound + implementable end-to-end. Three limitations documented as
follow-ons: analytics-yes/pzn-no coarse consent; alloy-only exposure telemetry; multi-scope / `decisionScopes` wiring.

Reviewer: general-purpose (independent frame-critique, 3 rounds).
