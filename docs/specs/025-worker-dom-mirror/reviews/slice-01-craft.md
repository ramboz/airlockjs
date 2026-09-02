---
slice: 025-01 — Tier-0 mechanism de-risk gate (GO / KILL) + GA4 adoption litmus
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-02T19:02:47Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (025-01 spike) — PASS (orchestrator-scrutinized; the central number independently RE-RUN, not trusted). AC1 is an honest measurement: worker-dom upgradeElement runs the tag off-thread; the MAIN-THREAD INP is measured via 023's verbatim raw Event-Timing method; workCompleted (6000/6000) observable. I re-ran rig:wd-nasty-tag myself → apply p75=8ms (band [8,8]), 6000/6000, no errors — reproduced. The inert-sync-read caveat is disclosed + grounded from source: 8ms is an honest "does a batched write-heavy mutation stream stay INP-safe on apply" (exactly bet #1), NOT a same-total-cost replay of naive's forced-reflow 200ms — correctly flagged so it isn't over-read. The 20000-el stall is honestly classified as worker-backpressure (INP stayed flat), NOT a re-tank. AC2 (Prism) is a REAL qualifying tag (grounded zero-sync-read across the bundle; real tokenization innerHTML 12,718->148,558), one lib-completeness gap (matches) axis-classified + one-line-stubbed — not a mirage; the population-SIZE-open is honest (one example, not a census). AC3 (GA4) is well-root-caused (screen + sendBeacon absent in the Worker global = model-inherent; cookie = lib-fixable) — MORE specific + better-grounded than 024's blanket "sub-resource" prediction (which was only partly right: script fetch + cross-origin importScripts actually work). The GO is honestly bounded — mechanism proven, martech-value open. No over-claim.
