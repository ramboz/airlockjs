---
slice: 036-01 — live CWV before/after harness (two-URL) + procedure
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (4 rounds: mechanism r1, missed-entrypoint r2, discriminant r3, pass r4)
reviewed_at: 2026-09-05T21:21:22Z
prompt_source: review.py frame-critique docs/specs/036-real-site-validation-harness/spec.md 036-01 <spec> <slice>
---

VERDICT: pass (round 4)

## Frame-critique trail (4 rounds — converging)

frame_review:true fired because the harness's entire value is the soundness of its before/after. Four
adversarial rounds, each catching a real, narrowing premise error:

- **r1 — needs-changes (mechanism).** The recommended two-deployment before/after (two .aem.page branch
  previews) is UNSOUND against lh-eds's ~50ms TBT / 0.01 CLS band: two deployments carry a FIXED
  between-deployment bias (cold-vs-warm CDN, edge PoP, hostname routing) plausibly 10-100x the band, and
  lh-eds's interleaving cancels only time-varying drift against ONE server, not a fixed two-host offset.
  → Retargeted: PRIMARY = a query-gated toggle on ONE deployment (same URL, ?airlock=1 ON vs plain OFF,
  holding cache/edge/content constant); two-deployment demoted to a band-withheld fallback.

- **r2 — needs-changes (missed entrypoint).** "LCP Δ≈0 by construction" holds only when all airlock work
  is post-LCP. Spec 033-03 added an EAGER personalization reserve at scripts.js:184 that runs
  pre-body.appear (pre-LCP), which the r1 gate (lazy :246 only) missed. → Gate covers BOTH entrypoints
  (:184 + :246, OFF = bare page); band profile-scoped; Fork B made profile-aware.

- **r3 — needs-changes (discriminant).** The profile split was cut on placements, but the eager
  entrypoint gates on window.__airlockConfig PRESENCE — and alloy-analytics-only MUST set __airlockConfig
  (no non-config alloy path), so it fires the pre-appear import(reserve-personalization.js) too (empty
  placements skip only the DOM box; the import cost is already paid pre-LCP). So alloy-analytics-only was
  mis-bucketed into the by-construction tight band. → Re-cut on __airlockConfig PRESENCE: no config (GA4)
  = LCP Δ≈0 by construction + tight band; ANY config (all alloy) = MEASURED LCP. Also corrected a loose
  variant-b.html citation (no __airlockConfig fixture exists — must be authored).

- **r4 — PASS.** All three r3 source facts verified precisely against scripts.js:184/:196/:246/:251/:252,
  reserve-personalization.js:54, and the boot(config)-requires-__airlockConfig path. The discriminant is
  cut on the correct axis; the load-bearing forks A/A′/B are grounded in source, not asserted; no
  remaining premise error that would misdirect implementation.

## Frame (as ratified)

Build a repeatable live-EDS CWV before/after harness reusing lh-eds's Lighthouse-interleave/median/
delta/band engine. PRIMARY: query-gated single-deployment toggle (?airlock=1 ON vs plain bare-page OFF),
the gate covering BOTH airlock entrypoints (eager :184 + lazy :246) on the operator's throwaway
validation branch. Band discriminated on __airlockConfig presence: GA4-only = LCP Δ≈0 by construction +
tight band; any alloy config = MEASURED LCP (validating 033-03's lightweight-eager-import bet live), CLS
held (analytics) or held/improved (personalization), TBT≤50ms throughout. Two-deployment = band-withheld
fallback. Proven against the local testbed (faithful analog for GA4-only; an authored __airlockConfig
fixture extends it to the alloy profiles), the live run being the operator's creds-gated step. Procedure
adds a cache-parity pre-check + names __airlockOwnsRum as a distinct post-LCP toggle axis.

## Non-blocking notes applied at pass
- Citation precision: boot() is gated :246, imported :251, invoked :252 (was cited :246/:251) — fixed.
- __airlockOwnsRum (scripts.js:270 → post-appear bootHelixRum :272) named as a distinct toggle axis in
  the procedure (post-LCP, rides the TBT band; RUM-replace boot-health is 036-02's territory).
