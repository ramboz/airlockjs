---
status: RECONCILED
kind: feature
dependencies: [004-04]
last_verified: 2026-08-27
arch_review: true
frame_review: true
design_review: false
claimed_by: claude/airlock-build-continue-f9ad85
---

## Slice 005-01 — exposure capture → GA4 + no-flicker invariant

**Goal:** on the testbed, the applied above-the-fold experiment/variant is reported
through the airlock as an MP-conformant `experiment_impression` GA4 event, and the
no-flicker structural invariant is shown to hold on the real page — closing the UC-1
demo (decisioning stays `aem-experimentation`'s; the airlock reports + proves).

**DoR:**
- ✅ 004-04 done (runtime boots bundled+lazy on the real testbed; `push()` +
  GA4 mapping + cookie ctx all work).

**Acceptance Criteria:**

1. **Exposure captured at lazy-boot from durable state.** At boot the adapter reads
   `body[data-experiment]` / `body[data-variant]`; when both are present it `push()`es
   a single `experiment_impression` event carrying `experiment_id` + `variant_id`
   (string params). No experiment applied → no event (not an empty/spurious one).
2. **Live listener for post-boot experiments.** The adapter also listens for the
   `aem:experimentation` CustomEvent (`detail.experiment` / `detail.variant`) and
   `push()`es the same event for an experiment applied AFTER boot — de-duplicated
   against the boot-time read so the same exposure is never double-counted.
3. **MP-conformant exposure payload.** The `experiment_impression` body validates
   against `contracts/ga4-mp-request.schema.json` (a golden fixture pins the event
   name + expected params). Hermetic (`ga4_mp_conformance`).
4. **No-flicker structural invariant (OQ6, structural half).** On the real testbed
   page, a rig reads `window.__flicker` and asserts the **load-bearing** ordering:
   the variant is applied before paint — the `exp-applied:<id>:<variant>` mark (and
   `body[data-experiment]`) precedes the `body:appear` mark (same-thread mark order,
   the reliable proof). Forced-challenger and forced-control both checked
   (`?experiment=hero-cta/challenger-1` / `/control`). The `paint:first-*`-never-before-
   `appear` leg is reported as **corroborating only** — paint timestamps are unreliable
   in headless/embedded browsers (R-005), so it must not be the sole gate.
5. **Exposure fires before paint; report is lazy.** The exposure (`exp-applied` mark /
   RUM) precedes `body:appear`; the airlock's `experiment_impression` `push()` occurs
   in the lazy phase (after `appear`) — analytics-is-lazy (AD-8), no paint impact.

**DoD:**
- [x] ACs 1–5 pass; unit tests cover the exposure read (present / absent / partial),
      the dedup between boot-read and live listener, and the `experiment_impression`
      conformance (schema + golden). 96/96 vitest (24 new); each new test red-first.
- [x] `npm run rig:uc1` verifies the no-flicker structural invariant (exp-applied
      mark before body:appear, load-bearing) + the conformant exposure beacon on the
      real testbed page (forced control AND challenger), reproducible.
- [x] **Human visual review (jig-supervised, OQ6 perceptual half):** the forced-
      challenger screenshot (`rig/out/uc1-challenger.png`, gitignored) shows **pure
      challenger content, no control flash** — the orchestrator reviewed it; surfaced
      to the human owner for final confirmation.
- [x] Reviewed by `reviewer` subagent: frame-critique PASS (grounded the durable
      body-dataset read in the vendored plugin source); compliance PASS; craft PASS;
      arch PASS. Evidence in `reviews/slice-01-*.md`.
- [x] Deviation log + reconciliation sweep (below); spec 005 Findings + Outcome
      filled; mvp1 release plan's UC-1 row updated.

### Deviation log

1. **`wireExposure` seam mirrors `wireInteractions`** (a small beyond-the-literal-ask
   design choice) so the boot wiring is unit-testable without a browser — consistent
   with the established adapter pattern.
2. **Review nits folded at reconciliation:**
   - **Double-wire guard added to `wireExposure`** (`doc.__airlockExposureWired`) —
     all three reviewers flagged that, unlike `wireInteractions`, a second boot would
     re-report the eager exposure (fresh `seen` Set) + stack a second listener, on the
     **measurement-critical** count. Red-first test added (96/96).
   - **AC5 laziness is now a HARD gate** in `rig/uc1.mjs` (`armPass` includes
     `exposureIsLazy`), not merely reported.
   - **Fast-bounce note names the DIFFERENTIAL bias** (arch): a worse variant bounces
     faster and loses proportionally more exposures — biases lift, not just volume.
   - Deferred (accepted): the colon-delimited dedup key (`exp:variant`) has a
     theoretical collision edge, but matches `scripts.js`'s own mark-naming convention
     and MVP1's slug ids; a minor golden/event-name test overlap is a defensible
     independent contract pin.
3. **Rig fidelity — extensionless `.html` serving:** `rig/uc1.mjs`'s static server maps
   `/variant-b` → its `.html` document (modeling `aem up`), or the forced-challenger
   variant fetch 404s and the swap silently falls back to control (the rig would lie).
   Load-bearing for AC4's challenger arm; the first rig run reproduced exactly this.
4. **Tooling slip, recovered (honest record — SECOND occurrence this session):** a
   `git checkout -- adapters/eds/index.js` used as mutation-test cleanup reverted the
   adapter to its committed 004-04 baseline, losing 005's uncommitted `index.js`
   additions (the exposure import, `wireExposure`, the boot call). Recovered by
   reconstructing them (the exact `wireExposure` body was recovered from the emitted
   bundle) + re-applying the guard fold; re-verified 96/96 + all rigs green + `git
   status` shows no unintended reverts. `exposure.js` (untracked) was unaffected. No
   lost work. (Learning: never `git checkout` for mutation restore when working-tree
   state is ahead of the committed baseline — use Edit/perl.)

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/005-uc1-pzn-exposure/spec.md` | `updated` | Findings + Outcome filled (spec 005 closes with this slice). |
| `docs/specs/README.md` | `deferred` | Generated status board; regenerated by `workflow.py status-board` at the DONE landing (currently shows 005-01 DRAFT — regenerates to DONE, mirroring the 004-xx rows). |
| `docs/releases/mvp1.md` | `updated` | UC-1 row → demo landed (exposure + no-flicker). |
| `contracts/validate.mjs` + `contracts/fixtures/` | `updated` | New `experiment_impression` golden registered in `mustPass` (validate green); no schema change. |
| `adapters/eds/index.js` + `adapters/eds/exposure.js` | `updated` | The exposure capture seam (`wireExposure` + reporter); core/ + connectors/ga4/map.js untouched. |
| `docs/architecture.md` | `no-op` | Module boundary honored (EDS-specific reads in adapters/eds; airlock reports, doesn't decide — Clarification Q4); no contract re-architecture. |
| `docs/product-vision.md` | `no-op` | Realizes UC-1 as the vision describes; no scope drift. |
| `docs/refinement-todo.md` | `no-op` | No new deferred decision (fast-bounce + page-level limits are in-spec Assumptions; OQ6 flicker oracle already tracked). |
| Primer surfaces (`CLAUDE.md`) | `no-op` | Spec 005 not in the Active-specs list; board reflects closure. |
| `docs/inbox.md` / `docs/memory/**` / ADR index | `no-op` | Nothing to park; no new term; no ADR-worthy decision (grounded in AD-8/ADR-0003/0004 + ga4-mp.md). |
| `.gitignore` / `package.json` | `updated` | Ignore generated `rig/out/`; add `rig:uc1` script (deviation-log-covered). |

**Anti-horizontal-phasing check:** after this slice, a site owner can run an
above-the-fold experiment on a real EDS page with **no flicker** and see its
**exposure reported to GA4 through the airlock** — the whole UC-1 loop, end to end.