---
slice: 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T19:31:07Z
prompt_source: review.py pr-review docs/specs/049-native-tag-suppressor/spec.md runtime- --richer-skill pr-review
substrate: non-interactive
---

Craft pass on slice **049-01** — reviewer `jig:reviewer`, richer-skill `pr-review`; two rounds.

**Round 1 (verdict needs-changes):** pure logic cleanly extracted + unit-tested; vendor-neutral grep guard genuinely
machine-enforced; the real-browser rig proves network-0 + sentinel-absent. One **[blocker]**: `prepend` + `replaceChild`
(2 of the 6 patched insertion methods) were exercised by NO test — removing either patch left both the unit suite and the
gating rig green, failing the mutate→red DoD + proving AC1's "full surface" only 4/6. Two [nit]s: `evaluateCandidate`
recompiled matchers per candidate on the hottest DOM path; the suppressor's blob/data worker-URL-scan exclusion was
comment-only (unlike the self-defended reserve sibling). Two [strength]s (the vendor-neutral grep guard; the two-loopback
hermetic rig design).

**Round 2 (verdict PASS):** all three fixes confirmed + mutually consistent across module/tests/rig/build. The harness now
drives `head.prepend(...)` and `head.replaceChild(script, placeholder)` against suppress matchers; the rig asserts network-0
+ sentinel-absent for both + a replaceChild placeholder-survival check, `expectedSuppressedUrls` now requires exactly 6
diagnostics — so all six methods pass mutation (delete either patch → rig red). NIT1 resolved: matchers compile once into
`state.compiledSuppress/compiledAllow`, hot path reads them via `shouldSuppressCompiled` (equivalence + carve-out unit
tests). NIT2 resolved: build self-defends the suppressor's scan-exclusion with a `new Worker(`-in-suppressor build failure +
seeded regression test. New [strength]s: the replaceChild placeholder-survival assertion (proves neutralize semantics, not
just network-0); the clean precompiled/uncompiled split.

Reconciliation note (for the deviation log): AC5's diagnostic shape changed nested-`matcher` → flat primitive fields to
satisfy the 028 flat-record invariant; `matcherQuery` is a display-only `&`-joined label (cosmetic edge).

**VERDICT: pass.**
