---
slice: 011-02 — out-of-band write coherency
pass: compliance
verdict: pass
reviewer: general-purpose (jig independent-review pass)
reviewed_at: 2026-08-29T03:33:20Z
prompt_source: review.py implementation docs/specs/011-mvp2-coherency-probe/spec.md 011-02
---

# Compliance review — slice 011-02

**Verdict: pass.** All four acceptance criteria met and independently verified:
`npm test` 173/173 (34 model tests); `npm run rig:coherency` exits 0 with all 11
`fails_both_ways` discrimination gates true.

- **AC1** (foreign main-thread script) + **AC2** (second tab): driven
  deterministically; both degrade to `document.cookie`-polling detection after the
  `cookieStore` `change` listener (validated via `cookieStore.set()`, latency 0ms)
  did not fire for `document.cookie` writes — the explicitly-permitted DoD
  kill-criteria outcome, not a failure.
- **AC3**: both negative boundaries hold (same-origin `Set-Cookie` writes a
  different cell, header proven unreadable per R-006 F4; cross-site demdex never
  reaches the customer jar).
- **AC4**: per-source scoreboard programmatically retrievable in
  `rig/out/coherency.json`.
- Tests non-vacuous (hand-traced both oob scenarios, `jarIdentityHistory`, the
  detection+propagation-lag decomposition; the absent-cache nit fix pinned by
  dedicated cases).

## Nit (robustness, non-blocking → reconciliation)
- `rig/coherency.mjs:290-292` `crossSiteNegativeHolds` gates on
  `identityCellMutated===false && demdexInCustomerJar===false` but not
  `crossSite.routed===true` — if `page.route` ever stopped intercepting, the
  cross-site negative boundary would pass *vacuously*. `routed:true` this run
  (robustness gap, not a current failure). → add `routed===true` to the gate.

## Reconciliation notes
- Record the AC2 deviation (second same-origin *page* in one shared context, not
  literal Playwright multi-context — the more-correct model; separate contexts have
  isolated jars).
- Deviation log + reconciliation sweep + OQ9 sweep-row disposition + status-board
  regen still `_TODO_` → complete at RECONCILED.

Reviewer: general-purpose (jig independent-review pass).
