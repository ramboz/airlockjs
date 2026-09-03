---
status: DONE
dependencies: [029-01]
last_verified: 2026-09-03
---

<!-- jig grounding (ADR-0020): lh-eds.mjs emits JSON `delta_median:{TBT_ms,CLS}`
     (+ off/on/acceptance; LCP delta ~0 by construction — lazy post-LCP boot);
     the CI `browser-oracle` job runs cwv:budget as continue-on-error + uploads
     rig/out/ (.github/workflows/ci.yml). extractTrailingJSON (cwv-budget.mjs)
     handles lh-eds's npm-build stdout banner. -->

## Slice 029-02 — the load-CWV arm + CI

**Goal:** Give the scoreboard the **load-CWV half** of the before/after (the field-INP half is 029-01): fold
`rig/lh-eds.mjs`'s off-vs-on Lighthouse **TBT / CLS** deltas (LCP ~0 by construction) into the scoreboard model +
card, and wire the scoreboard into the existing `browser-oracle` CI job as an **advisory** artifact upload (per
ADR-0005 — never a gate). So the artifact shows the full before/after the vision names: *airlock costs ~zero
page-load CWV (TBT/CLS delta ~0) AND keeps INP off the floor.*

**Opt-in (keep the fast path fast).** `rig/lh-eds.mjs` shells `npm run build` + runs Lighthouse (~minutes), so the
load-CWV arm is **opt-in via `WITH_LH=1`**; the default `npm run cwv:scoreboard` stays the fast INP-only run (with
a "run `WITH_LH=1` for the load-CWV arm" note). CI runs it `WITH_LH=1` (advisory).

**No unproven load-bearing premise** (risk-gated): lh-eds.mjs's JSON shape + the CI advisory-upload pattern are
grounded (read, above); folding is a pure function over that JSON; opt-in is a perf choice, not a premise. The
frame-critique is a formality unless a reviewer surfaces a hidden premise.

**DoR:**
- ✅ 029-01 DONE (the scoreboard model + card + `buildScoreboard`/`renderCard` exist to extend).
- ✅ Grounded: `lh-eds.mjs` emits `delta_median:{TBT_ms,CLS}` + `acceptance`; `browser-oracle` CI runs an advisory
  `continue-on-error` step + uploads `rig/out/`; `extractTrailingJSON` handles the build-banner.

**Acceptance Criteria:**

1. **`WITH_LH=1 npm run cwv:scoreboard` folds the Lighthouse off-vs-on deltas into the artifact.** A pure
   `foldLoadCwv(model, lhJson)` adds a `load_cwv` section (TBT_ms delta, CLS delta, within-band, the LCP
   ~0-by-construction note) to the model; `renderCard` renders it when present. `main()` runs `rig/lh-eds.mjs`
   only when `WITH_LH` is set, consuming its JSON **robustly** (via `extractTrailingJSON` — the npm-build stdout
   banner is worked around, not left to break the parse). A unit test feeds a fake `lhJson` (matching lh-eds's
   shape) to `foldLoadCwv` and asserts the `load_cwv` section + the card row.
2. **Default run stays INP-only + fast; load-CWV is opt-in.** Without `WITH_LH`, the model carries a
   `load_cwv: null` (or a "run WITH_LH=1" note) and does NOT spawn Lighthouse. A test asserts `foldLoadCwv` is
   only applied when the lh JSON is present, and the default model has no `load_cwv` numbers.
3. **CI: an advisory scoreboard step in `browser-oracle`.** `.github/workflows/ci.yml`'s `browser-oracle` job
   gains a `continue-on-error: true` step running the scoreboard (`INP_N=1 WITH_LH=1`, fast) whose `rig/out/`
   output is uploaded by the existing artifact step — mirroring the `cwv:budget` step. A test/grep asserts the
   step exists, is `continue-on-error`, and that `oracle.sh`'s gating `COMPONENTS` is STILL unchanged (advisory,
   not a gate).
4. **The committed `docs/scoreboard.md` notes the load-CWV arm** (TBT/CLS delta ~0 band + how to run it) so the
   durable card reflects the full before/after, in band language.
5. **No live identifiers**; the LH arm runs the synthetic `probes/eds-testbed`.

**DoD:**
- [x] All ACs pass; full real-repo suite green (**950**, worktree excluded; 5 new). Additive to the 029-01 rig +
      a CI step + a docs note. `LH_N=1 WITH_LH=1 npm run cwv:scoreboard` verified end-to-end (folded load_cwv).
- [x] Coverage exercises each AC (foldLoadCwv section + card row; opt-in default null; the CI-step grep binding
      continue-on-error to THIS step; oracle.sh-unchanged; the docs note).
- [x] Each new test shown to fail when its feature is removed — a foldLoadCwv TBT mutation redded the fold test;
      the CI-grep + oracle-unchanged tests are non-vacuous by construction (reviewer confirmed).
- [x] Reviewed by independent reviewer; **compliance PASS + craft PASS** (craft NEEDS-CHANGES → all 3 fixed).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] `docs/inbox.md` updated — the lh-eds stdout-banner source-fix is now tracked (029-02 added a 2nd consumer).

**Anti-horizontal-phasing check:** after this slice the scoreboard shows the FULL before/after (INP floor + load
CWV) and is visible in CI as an advisory artifact — the complete punchline surface.

### Deviation log (after reconciliation)

1. **Opt-in load-CWV (perf).** `rig/lh-eds.mjs` is slow (build + Lighthouse), so the arm is `WITH_LH`-gated; the
   default `npm run cwv:scoreboard` stays the fast INP-only run. `foldLoadCwv(model, lhJson)` is a pure fold (the
   test feeds a fake lh JSON); `main()` spawns lh-eds only under `WITH_LH`, consuming its JSON via a copy of
   `cwv-budget.mjs`'s `extractTrailingJSON` (verified behaviorally identical by the reviewer).
2. **Craft review NEEDS-CHANGES → all fixed inline.** (a) **CI `LH_N=1` pin** — the advisory step left `LH_N`
   default (5), but the `cwv:budget` step already runs a full `LH_N=5` sweep; a second 10-run sweep risked the
   job-level 30-min timeout (which `continue-on-error` does NOT cover). Pinned `LH_N=1`. (b) **The lh-eds banner
   follow-up is now genuinely tracked** — `docs/inbox.md` gained the source-fix entry (build output → stderr), and
   the rig comment points at it (029-02 added a SECOND banner-work-around consumer). (c) **`within_band` null →
   "band unknown"** in the card (was "OVER band", misleading on malformed input).
3. **CI wiring verified structurally, not by a CI run.** The advisory step + the existing `rig/out/` upload are
   asserted by a `ci.yml` grep (the `continue-on-error` binds to this step); the local `WITH_LH=1` run proves the
   command it invokes works. The GitHub Actions run itself validates on push.
4. **Additive.** No runtime code touched — a new pure fn + main() branch in the 029-01 rig, a CI step, a docs
   note, an inbox entry.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (029-02 → DONE). |
| `docs/product-vision.md` | `no-op` | No behavior/scope drift (the scoreboard validates the vision). |
| `docs/architecture.md` | `no-op` | No module boundary — a rig extension + a CI step. |
| `.github/workflows/ci.yml` | `updated` | Advisory `browser-oracle` scoreboard step (LH_N=1, continue-on-error). |
| `docs/scoreboard.md` | `updated` | The committed card gained the load-CWV arm note. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Slice does not close the spec (029-03 pending); primer hygiene at spec close. |
| `docs/inbox.md` | `updated` | The lh-eds stdout-banner source-fix follow-up (now a 2-consumer wart). |
| `docs/refinement-todo.md` | `no-op` | No deferred decision — craft fixes applied inline; the banner fix is an inbox parked item. |
| `docs/memory/**` / `docs/decisions/**` | `no-op` | Nothing cross-session; routing rides ADR-0005. |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** 029-02 gives the scoreboard the
load-CWV half (opt-in, folded from lh-eds) + an advisory CI step; the craft review's job-timeout risk (`LH_N=1`),
tracking gap (inbox), and null-mapping nit are all fixed; verified end-to-end. Additive, 950 suite green. No
orphans. Ready RECONCILED → DONE.
