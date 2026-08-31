---
slice: 021-01 — dispose() + idempotent-boot guard
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-08-31T18:43:05Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (021-01) — PASS. dispose() minimal + correct: named onVisibilityChange ref enables removeEventListener (the AC's load-bearing point — an anonymous listener can't be removed); `disposed` guard makes a 2nd call a no-op (no double-terminate/throw); null-safe on both a no-removeEventListener env and a Worker without .terminate. Idempotent boot = dispose-prior-then-reboot (not return-existing), so every boot yields a live runtime; single-boot path byte-unchanged (guard bites only on 2nd boot; dispose is additive). Tests: 10 new (incl. a real pagehide-fires-no-flush-after-dispose proof), 105/105 broader sweep. No over-engineering.
