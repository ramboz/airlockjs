---
slice: 048-02 — bootFloodlight + worker chamber + `{type:"floodlight"}` config type + composite membership (consent-gated)
pass: craft
verdict: pass
reviewer: jig:reviewer (craft)
reviewed_at: 2026-09-15T00:45:55Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/craft-048-02.txt
substrate: non-interactive
---

# Craft (pr-review) — 048-02 · VERDICT: pass (nits only)
High-fidelity mirror of the 048-01 google-ads chamber+boot with two genuinely-necessary, well-documented deviations driven by floodlight's config carrying a field literally named `type`: (a) boot/config field renamed `activityType` (translated internally); (b) bespoke nested chamber init `{type:"init", connectorConfig}` (vs the shared spread) so the native `type` can't clobber the `type:"init"` discriminant. Both fixes target distinct boundaries + are asserted. deriveActivityCeilingEndpoint is a clean drift-avoidance extraction (shared by manifest + boot ceiling). Rule-of-three extraction DECLINED with load-bearing reasoning (build.mjs literal-`new Worker` scan + 4 non-uniform per-connector cases). Tests non-vacuous (spread-shape regression guard; two-element ceiling admits both forms; held→grant re-map, 2 fetches, gcd parity).
Nits (reconciliation-log, non-blocking): (1) floodlight-chamber.worker.js header overclaims "byte-for-byte mirror" though the init branch deviates — reword. (2) validator accepts activityType/cat without src → silent no activity beacon; a loud warning would close the footgun (log as hardening residual).
Design-choice note: keeping the connector's internal `type` (vs renaming end-to-end) is defensible — it maps 1:1 to the `;`-matrix wire param `type=`; the rename was pushed only to the reserved boot/config boundary.
