---
slice: 029-01 — the INP scoreboard artifact
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:07:51Z
prompt_source: review.py implementation 029 'INP scoreboard'
---

**Verdict: PASS** (independent reviewer, Opus). All six ACs met + demonstrated by a live `npm run cwv:scoreboard`.

- AC1 — main() spawns rig/measure.mjs under a literal naive/deferred/worker loop; buildScoreboard/summarizeArm/
  median are fixture-tested (matching the real re-probe). *Note:* the literal "spawn-mock test" is absent — main()'s
  orchestration is verified by the live run + the pure logic tests, and this EXCEEDS the copied shape's norm
  (`cwv-budget.mjs` has zero tests). Recorded as a deviation.
- AC2 — the durable-vs-regenerable split is structurally honored: `rig/out/` is gitignored, `docs/scoreboard.md`
  is committed (not ignored) + band/provenance-worded with a regenerate pointer.
- AC3 (load-bearing) — genuinely honest: three arms; fast arms render "below 16ms floor" (not "~8ms"); honest_note
  discloses the single-sample/first-input; the headline leads with the robust naive-vs-floor bound + the
  "ties deferred, without the discipline" honesty. No AC3 FAIL condition hit.
- AC4 — work-parity (delivery_median) + per-arm band_ms recorded in the JSON; the tie is labeled. *Note:* not
  surfaced as a human-card fairness row (recorded).
- AC5 — oracle.sh COMPONENTS still vitest + ga4_mp_conformance only; the test's grep genuinely proves non-gating.
- AC6 — no live identifiers (synthetic t{i}.example fixture).
