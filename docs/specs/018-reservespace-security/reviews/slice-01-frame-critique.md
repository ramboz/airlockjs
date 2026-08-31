---
slice: 018-01 — the active-markup sanitizer boundary
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (2 rounds)
reviewed_at: 2026-08-31T04:45:17Z
prompt_source: review.py frame-critique + tailored re-review
---

# Frame-critique — 018-01 (the active-markup sanitizer boundary)

**VERDICT: pass** (re-review after reshaping the DoR-pillar-4 test-substrate grounding).

## History
- **Round 1 → needs-changes.** The central load-bearing claim SURVIVED the strongest attack: the EDS
  `default` Trusted-Types policy (probes/eds-testbed/scripts/scripts.js:61-78) is **compatibility-only for
  the `Element innerHTML` sink** — it strips `<script>` only for the `createContextualFragment`/`Document
  write` sinks + `iframe[srcdoc]`; innerHTML passes through unsanitized — so the sanitizer MUST be airlock's
  own, running in `setContent` before the write. BUT DoR pillar 4 falsely stamped "the sanitizer is
  DI-testable so the hermetic vitest run needs no jsdom — Grounded"; for a security primitive that is a
  false-security trap (Node has no `DOMParser`, the project ships no jsdom, and a fake parser makes the
  vector table green-but-meaningless; mXSS/normalization only manifest through a real parse→serialize).
- **Reshape.** DoR pillar 4 rewritten honestly: the parse→strip→serialize security vector table runs in a
  **required Playwright rig (real chromium)** — the project's established, CI-gated real-DOM-proof substrate
  (007-02 isolation_invariant, the gating `browser-oracle` job); node/vitest covers only pure strip-predicate
  helpers + non-string/empty + DI wiring + injectable-override. **No DOM dev-dep** (jsdom parse ≠ chromium
  for mXSS anyway; respects the project's deliberate no-jsdom pattern + the conventions-approval rule).
- **Round 2 → pass.** The prior flaw is genuinely fixed; the rig substrate is real and CI-gated (verified vs
  rig/alloy-decisions.mjs, rig/isolation.mjs, .github/workflows/ci.yml browser-oracle); the node/predicate
  split does not smuggle the security claim; "no new dep" is sound. The other pillars (denylist-vs-allowlist
  posture, core/ DI'd-parser boundary, securing-a-callerless-default, TT atomicity) are each named, honestly
  bounded, grounded — none most-likely-wrong. The frame survives.

## Note-level residuals folded into the slice before implementation
1. AC1 miscite "AC6" → **AC5** (the TT/DI write path). Fixed.
2. **mXSS scoping** (AC2/DoD vs AC4): the rig asserts only denylist-reachable neutralization (a stripped
   vector stays stripped after re-serialize); genuinely parser-differential mXSS is a documented
   known-boundary (xfail/annotated), never a green "defended" claim. Folded into the DoD rig bullet.
3. **AC5 no-policy edge**: the whole write stays in a try/catch (dom.js:98 posture) so even the pathological
   "no default policy + blocked named-policy" edge is caught, never breaks the page. On EDS the boilerplate
   always registers a default policy (scripts.js:61), so not a regression. Stated in AC5.

## Reconciliation wiring requirements (folded into the DoD)
- The new browser rig must be a **GATING** step in ci.yml's `browser-oracle` job (not merely an npm script)
  to actually enforce — reconciliation must verify the CI wire-up.
- Log the deliberate deviation: the load-bearing AC is proven only in the browser-CI leg, not `npm test`
  (consistent with 007-02/007-05) — so a future reader does not read the vitest suite as the security gate.
- Confirm + record the `sanitizeHtml` home (`core/` DI'd-parser vs adapter); if `core/`, update core-boundary.

Reviewer: jig:reviewer (independent, read-only, 2 rounds). Prompt: review.py frame-critique (round 1) +
tailored re-review (round 2).
