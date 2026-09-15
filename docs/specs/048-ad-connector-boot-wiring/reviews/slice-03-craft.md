---
slice: 048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)
pass: craft
verdict: pass
reviewer: jig:reviewer (craft)
reviewed_at: 2026-09-15T01:55:05Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/craft-048-03.txt
substrate: non-interactive
---

# Craft — 048-03 · VERDICT: pass (nits only)
Clean + minimal: one strip chokepoint (bootConnector destructure) + one post-createComposite subscription make "composite is sole subscriber" true by construction — strictly more robust than the identity-keyed guard the frame-critique rejected. config.onetrust→governance.consent reuses the existing threading. Tests non-vacuous (mixed-config precedence mutation-provable; both-fire flush-once). Deferred re-boot unsubscribe residual defensible (needs the 047 driver to grow an unsubscribe primitive; reaching into the guard from boot() is a worse leak; setConsent-after-dispose is main-thread/worker-free → no throw). Nit: AC1-test1 google-ads half corroborative-only (commented; the ga4 ctx.consent assertion + AC2/AC3 are load-bearing).
