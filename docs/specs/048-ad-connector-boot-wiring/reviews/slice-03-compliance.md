---
slice: 048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)
pass: compliance
verdict: pass
reviewer: jig:reviewer (compliance)
reviewed_at: 2026-09-15T01:55:05Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/compliance-048-03.txt
---

# Compliance — 048-03 · VERDICT: pass
All 5 ACs met + non-vacuous. AC2 precedence-by-construction (strip per-connector onetrust + never-thread config.onetrust to sub-boots; sole composite subscription after createComposite) proven with a mixed-config test + strip-removal mutation (red). AC3 two-connector held→accept→both-flush→revoke through the REAL composite. AC4 2×N flush-once. AC1 derivation→governance.consent + absence byte-unchanged. AC5 no-onetrust no-subscription + direct bootGa4Core({onetrust}) unchanged + onDiagnostic fan-out. Nits (both addressed in the fix round): AC3 URL assertions now discriminate on distinct tid=AW-/tid=DC- ids; validateConfig now shape-checks onetrust. No blockers.
