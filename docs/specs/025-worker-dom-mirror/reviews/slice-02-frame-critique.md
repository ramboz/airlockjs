---
slice: 025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 3 rounds)
reviewed_at: 2026-09-02T23:37:00Z
prompt_source: review.py frame-critique
---

Frame-critique (025-02 — the worker-dom mirror core, pre-implementation) — PASS on the 3rd revision. Two deep,
grounded catches that would otherwise have surfaced as wasted implementation:

- v1 FAIL: the frame scoped only the worker→main mutation FLUSH and omitted the main→worker EVENT-FORWARDING
  channel the 025-01 proof fixture structurally needs — its storm fires only inside a worker-side click listener,
  driven by a main-thread button click that @ampproject/worker-dom forwarded main→worker for free (why 025-01 got
  8ms). Without the channel, AC5 measures a false green (workCompleted=0, flat INP — 025-01's stall signature).
  Also: safety was denylist-shaped (inherently incomplete for a real-DOM write surface).
- v2 FAIL: bidirectional channel + a workCompleted stall-guard + an allowlist-shaped safety policy all resolved,
  BUT a deeper measurement confound in AC5 (the load-bearing AC): the async round-trip (click T0 → off-thread
  compute → apply in a LATER task T1) DECOUPLES the apply from the click's task, so the within-storm click-p75
  measures "heavy compute moved off-thread" — NOT "the frame-budgeted APPLY is INP-safe under a heavy burst"
  (ADR-0014's actual central bet). The fixture's apply is light (~400 style writes); the advertised re-tank kill
  signal was unfireable.
- v3 PASS: AC5 SPLIT — 5a (click-p75 honestly relabeled the compute-off-thread plumbing metric, explicitly NOT
  attributing the apply's cost, workCompleted-guarded) + 5b (a genuinely HEAVY apply stream driven through the
  coordinator and measured OVER THE APPLY WINDOW via a Long Tasks observer / chunk-boundary, asserting no
  over-budget task under frame-budgeting vs one long task ~= total when applied naively — the falsifiable
  contrast that makes AC4 falsifiable and the re-tank signal fireable). Grounded: 023 already proved chunk+yield
  keeps a heavy burst INP-safe, so 025-02's narrow job is proving the apply is WIRED through it (not re-proving
  the scheduler); the genuinely-heavy REAL apply (Prism 148KB innerHTML) is 025-03. The style-value guard is a
  minimal token check (escape-bypassable), honestly disclosed in AC7 with airtight value-level sanitization
  deferred to 025-03. Frame sound; the single residual is bounded + disclosed, not load-bearing.
