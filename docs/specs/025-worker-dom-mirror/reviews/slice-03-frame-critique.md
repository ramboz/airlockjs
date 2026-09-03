---
slice: 025-03 — a real tag (Prism) through the mirror: `innerHTML` + a sanitized apply, INP-measured
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-09-03T03:42:23Z
prompt_source: review.py frame-critique
---

Frame-critique (025-03 — a real tag through the mirror + innerHTML sanitized apply, pre-implementation) — FAIL →
PASS after one reframe.

- FAIL: the slice assumed "governed off-thread Prism is an INP win," but airlock's SANITIZED apply is HEAVIER on
  the main thread than naive Prism, not lighter: naive = ONE parse (el.innerHTML = itsOutput); governed =
  parse(148KB) + a whole-tree walk over every <span class="token"> (thousands, 2 attribute passes,
  sanitize-html.js:159-174) + reserialize(148KB, :214) + the real innerHTML= parse. Off-thread removes the 12KB
  INPUT tokenization but adds a round-trip over the 11.7x-larger 148KB OUTPUT — a net main-thread regression is
  plausible. AC4/AC5 measured vs an ABSOLUTE budget (INP-safe or re-tank), never vs a naive-Prism baseline → the
  dangerous third outcome (under budget yet slower than naive) would ship as a FALSE GREEN. No grounded naive
  baseline existed (025-01's "8ms" used @ampproject's own innerHTML setter, no sanitizer — it under-counts).
- Reframe: AC4 now measures governed-vs-naive against a grounded naive-Prism main-thread baseline, win condition
  governed < naive, THREE explicit outcomes — (a) win, (b) net regression (under budget yet slower than naive, the
  named false-green), (c) re-tank; (b)/(c) are valid documented Outcomes (the honest Tier-0-viability boundary for
  innerHTML-heavy tags → ADR-0014/refinement-todo). Corrected cost model. AC5 drops the click-p75 false-green (the
  apply is decoupled from the click) + the "off-thread win" claim. DoR requires building the naive baseline + notes
  the expected className mirror-completeness gap.
- PASS: the reframe's new premise (raw-ms as the currency) survives — a governed<naive ms-win provably implies an
  INP win; the only error mode is a conservative false-RED (decoupled apply colliding with no interaction). Three
  non-blocking tightenings folded: the stale DoD checkbox aligned to the 3-outcome verdict; a direct
  governed-INP-vs-naive-INP under matched cadence added to AC4 for a clean (b) verdict; a note that AC6's
  dom-chamber shippability is independent of AC4's Prism-specific outcome.
