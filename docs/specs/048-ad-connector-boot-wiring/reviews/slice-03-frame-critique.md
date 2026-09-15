---
slice: 048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2-round)
reviewed_at: 2026-09-15T01:05:58Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/fc-048-03-v2.txt
---

# Frame-critique — 048-03 (OneTrust composite governance) · VERDICT: pass (after 1 needs-changes → re-scope)
Round 1 (needs-changes): A-precedence was INVERTED. The DRAFT rested precedence on the driver's idempotency guard, but that guard is first-writer-wins by object identity, and boot(config) builds sub-boots BEFORE createComposite — so a per-connector `onetrust` (reachable via ...rest into bootGa4Core) registers FIRST and the composite subscription no-ops, STRANDING the ad beacons (the exact failure the capstone prevents; AC3 stays green because it has no per-connector onetrust). A-fanout + A-coalesce confirmed correct.
Fix: composite-as-sole-subscriber TRUE BY CONSTRUCTION — boot(config) does NOT thread config.onetrust to sub-boots (only the derived governance.consent vector) AND strips any per-connector onetrust from a connector entry before dispatch.
Round 2 (pass): verified achievable — don't-thread is already the default (governance bundle excludes onetrust); strip is a one-line change at bootConnector's `const {type, ...rest} = entry` chokepoint (removes onetrust for ALL types → bootGa4Core's `if(onetrust)` false → no subscribe); subscribeOnetrustConsentChanges is reachable only via case "ga4"; config.onetrust is coherent as a declarative config field (sibling of consent). No new load-bearing assumption.
Residual (non-blocking, pre-existing — NOT from the re-scope): the re-boot lifecycle — unsubscribe the composite's OneTrust change subscription on dispose() before a second boot() registers a new composite. 047-02's per-connector path had the same open question; moving to the composite makes one unsubscribe-on-dispose easier. Implementer check, not a frame flaw.
