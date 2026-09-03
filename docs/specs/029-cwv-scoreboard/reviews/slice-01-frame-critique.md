---
slice: 029-01 — the INP scoreboard artifact
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T21:49:35Z
prompt_source: review.py frame-critique 029 'INP scoreboard' + deliverables
---

**Verdict: PASS** (adversarial pass returned **NEEDS-CHANGES**; all must-fixes applied → frame now sound).

The frame-critique confirmed the "honest triple, not naive-vs-worker overclaim" framing is grounded and survives
attack from both directions (product-vision.md:65 + spec 003 + cwv-budget.mjs's deliberate deferred-vs-worker
design) — settled, not reopened; likewise the cwv-budget/nasty-tag reuse (a small extension, not a rewrite) and
advisory routing. It caught a layer down:

**Catch #1 — "durable artifact" was INVERTED.** AC2 wrote to `rig/out/`, which is **gitignored** (.gitignore:47)
— ephemeral, per-machine, the opposite of durable; meanwhile the punchline is already durable as committed prose.
**Fixed:** the durable output is now a **committed `docs/scoreboard.md`** in tolerance-band + provenance language;
`rig/out/` is re-cast as the regenerable per-run cache. AC2 split accordingly.

**Catch #2 — the fast arms are SINGLE-SAMPLE noise; a committed exact "19×" would drift.** `harness.html:40`
`durationThreshold: 16` drops sub-16ms interactions, so deferred/worker `inp_p75` come from ONE cold first-input.
**Demonstrated by re-probe (2026-09-03):** naive p75=152/61-interactions (robust), deferred p75=0/1, worker
p75=8/1. **Fixed:** the artifact reports the fast arms as **at/below the 16ms Event-Timing floor** (interactions
count disclosed), NEVER a precise "8ms"; the headline is a band (`~150ms → sub-16ms floor; ~19× vs naive; ties
deferred`). AC3 now makes floor-awareness + no-false-precision checkable.

**Catch #3 — the "152/8/8 reproduce" DoR was asserted, not shown.** **Fixed:** ran the three-arm probe; the
actual observed triple (152/61, 0/1, 8/1) is now in the DoR + spec Assumptions.

The re-probe strengthened the framing: airlock's interactions are literally BELOW the INP measurement floor —
tying a competently-deferred main thread — a stronger + more honest story than a false-precise "8ms". Frame sound
→ PASS to implement.
