---
slice: 048-01 — bootGoogleAds + worker chamber + `{type:"google-ads"}` config type + composite membership (consent-gated)
pass: craft
verdict: pass
reviewer: jig:reviewer (craft)
reviewed_at: 2026-09-14T23:24:00Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/craft-048-01.txt
substrate: non-interactive
---

# Craft (pr-review) — 048-01 · VERDICT: pass (nits only)
Faithful ga4-gtag mirror across every axis; the seal/remap trio is threaded correctly with a real defensive `endpoint`-into-remap catch; tests non-vacuous (cross-path URL parity drift-guard; held→re-map re-sources `_gcl_au`; un-branched-boot red-on-removal).
Nits (reconciliation-log, non-blocking):
- [spec] AC2 "byte-shape-identical to bootGa4Gtag's" is inaccurate — the handle is an intentional 7-key SUPERSET (adds `pushCritical`, backed by the wired requestMapper + guarded in the composite). Correct/log.
- [impl] core/airlock.js requestMapper branches ga4-gtag+google-ads are now identical shape (2 branches, below rule-of-three). 048-02 (floodlight) is the 3rd GET-family branch → extract a connector→worker/config lookup table then (also the Worker-URL ternary + init OR-chain).
