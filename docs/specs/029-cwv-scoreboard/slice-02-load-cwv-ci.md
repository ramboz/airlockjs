---
status: DRAFT
dependencies: [029-01]
last_verified:
---

## Slice 029-02 — the load-CWV arm + CI

**Goal:** Fold the off-vs-on Lighthouse before/after (`rig/lh-eds.mjs` — runtime OFF vs ON airlock, median
TBT/CLS/LCP deltas on the real EDS testbed) into the scoreboard, so the artifact shows the **full** before/after
the vision names — the field-INP half (029-01) plus the load-CWV half — and wire it into the existing
`browser-oracle` CI job as an **advisory** artifact upload (per ADR-0005, never a gate).

**DoR:**
- ☐ 029-01 DONE (the scoreboard command + artifact exist to extend).
- ☐ Grounded: `rig/lh-eds.mjs` already emits JSON (off/on median deltas); the `browser-oracle` CI job
  (`.github/workflows/ci.yml`) already runs Playwright/LH + uploads `rig/out/` artifacts.

**Acceptance Criteria (draft — sharpened at READY):**

1. The scoreboard artifact gains a load-CWV section from `lh-eds.mjs` (TBT/CLS/LCP off-vs-on deltas) alongside
   the 029-01 INP triple — one combined before/after artifact.
2. Wired into the `browser-oracle` CI job as an advisory upload (`continue-on-error`, artifact to `rig/out/`),
   consistent with `cwv-report.txt` — NOT added to `oracle.sh`'s gating `COMPONENTS`.
3. Fix the `lh-eds.mjs` stdout-banner hygiene wart (the `npm run build` banner leaking into stdout) if the
   scoreboard consumes its JSON (else the JSON parse is fragile).
4. No live identifiers; the LH arm runs the synthetic EDS testbed.

**DoD:** _standard (see 029-01); full ACs sharpened when this slice reaches READY._

**Anti-horizontal-phasing check:** after this slice the scoreboard shows the full before/after (INP + load CWV)
and is visible in CI as an advisory artifact — the complete punchline surface.
