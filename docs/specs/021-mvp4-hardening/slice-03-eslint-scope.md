---
status: DRAFT
dependencies: []
last_verified: 2026-08-31
frame_review: false
---

## Slice 021-03 — narrow the alloy-chamber eslint-disable

**Goal:** Restore linting to `connectors/alloy/alloy-chamber.worker.js` — the blanket `eslint-disable`
(untouched since 014-01, when the file was read-only) is over-broad; narrow it to the specific rules the
vendor-shim / classic-worker-globals code genuinely needs, so the rest of the file is linted again. Closes the
014-01 (d) craft residual.

**DoR:**
- ✅ `connectors/alloy/alloy-chamber.worker.js` carries a blanket `eslint-disable` (whole-file); it is now
  writable (was read-only for 014-01). **Grounded** (read).
- ✅ The repo has an eslint config + an `npm` lint script (spec 007 CI). **Grounded** (confirm the exact
  script + config at implementation).

**Acceptance Criteria:**

1. **Replace the blanket disable with scoped disables.** Remove the whole-file `eslint-disable`; run the
   linter; for each genuine violation in the vendor-shim / worker-globals code (e.g. `no-restricted-globals`,
   `no-param-reassign` on the alloy monkey-patches, `no-underscore-dangle`), add a **targeted** per-rule /
   per-line / per-block disable with a one-line justification. The rest of the file lints clean.
2. **`npm` lint passes** on the file with only the scoped, justified disables; no new lint errors elsewhere.
   Observable: `git grep -c "eslint-disable" connectors/alloy/alloy-chamber.worker.js` drops from the blanket
   one to a small set of scoped, commented disables.
3. **No behavioural change.** Pure lint-scope + comments; the chamber's runtime behaviour + all alloy tests
   are byte-identical. Observable: the alloy/coalescing/decisions tests stay green unchanged.

**DoD:**
- [ ] ACs pass. `npm run lint` (or the exact script) green on the file. Targeted alloy test sweep unchanged
      (`alloy-*` — named files; full suite hangs).
- [ ] Reviews: craft + reconciliation, recorded pass (a lint-scope change — compliance is light).
- [ ] Deviation log; refinement-todo **014-01 (d) eslint-scope residual** marked RESOLVED.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** the alloy chamber code is linted again (only the genuinely-needed rules
disabled, each justified) — a real code-quality change visible in CI, not internal churn.
