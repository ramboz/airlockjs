---
status: DONE
dependencies: []
last_verified: 2026-08-31
frame_review: false
---

## Slice 021-03 — adopt ESLint + delint the alloy chamber

> **Reframed at implementation (2026-08-31).** This slice was written as "narrow the blanket
> `eslint-disable` in `connectors/alloy/alloy-chamber.worker.js`" on the DoR assumption that the repo
> **had** a linter (the AEM/Airbnb-flavoured disable comments implied one). Grounding at implementation
> found **no eslint tooling existed anywhere** (no config, no devDependency, no `npm run lint`, no CI step;
> `conventions.md` Code style read `Deferred`). The user directed **"add the linter now"**, which is the
> explicit human approval for the convention change and expands this slice to **bootstrap ESLint** — of
> which "delint the alloy chamber" is then a sub-goal.

**Goal:** Turn linting **on** for the repo (it never was) and remove the whole-file `/* eslint-disable */`
from the alloy chamber. Closes the 014-01 (d) craft residual **and** the long-`Deferred` Code-style
convention decision.

**DoR:**
- ✅ `connectors/alloy/alloy-chamber.worker.js` carries a blanket `eslint-disable` (whole-file), writable
  now (was read-only for 014-01). **Grounded** (read).
- ❌→corrected — the DoR claimed "the repo has an eslint config + an `npm` lint script (spec 007 CI)".
  **Grounding disproved it**: no `.eslintrc*`/`eslint.config.*`, no `eslint` in `package.json` /
  `package-lock.json` (nor anywhere in `git log`), no lint script, no CI lint step. The slice's own
  "confirm at implementation" caveat is what caught the false premise. **Human approval to bootstrap:**
  user direction "add the linter now".

**Acceptance Criteria:**

1. **ESLint is wired.** Flat `eslint.config.js` on the `@eslint/js` **recommended** baseline (a real-bug
   ruleset, not stylistic — chosen over AEM/Airbnb deliberately, to turn linting on without a repo-wide
   style cleanup); `eslint` + `@eslint/js` + `globals` in devDependencies; an `npm run lint` script. Globals
   are set **per environment by glob** — browser (`core`/`adapters`/`connectors`/`baseline`), worker
   (`*.worker.js` — **no** browser globals), node (`rig`/`contracts`/`*.mjs`), vitest (`test`). Vendored
   `probes/` and build output `rig/out/` (and the stale `.claude/` worktrees) are ignored, not linted.
   Observable: `npm run lint` runs; `eslint.config.js` exists.
2. **The alloy-chamber blanket disable is gone.** Remove the whole-file `/* eslint-disable */`; the file
   then lints clean under `recommended` with **no** disables at all (the blanket was pure over-suppression
   from the read-only era — only 2 trivial `no-useless-escape` needed fixing, not scoped disables).
   Observable: `git grep -c "eslint-disable" connectors/alloy/alloy-chamber.worker.js` → **0**.
3. **The repo lints GREEN + no behavioural change.** The ~20 pre-existing violations `recommended` surfaces
   (dead `catch` bindings, dead stores, unused imports/vars) are fixed **behavior-preservingly**; the one
   intentional control-char regex in `core/sanitize-html.js` gets a **scoped** `// eslint-disable-next-line
   no-control-regex` (the one justified disable). Observable: `npm run lint` → 0 problems; the affected test
   files stay green.
4. **CI gates on it.** A `Lint (eslint)` step in `.github/workflows/ci.yml`'s hermetic job (`npm run lint`).

**DoD:**
- [x] ACs 1–4 pass. `npm run lint` green (0 problems, exit 0). Affected test sweep unchanged (targeted — full
      suite hangs): 10 files / 97 tests green incl. `eds-boot`, `airlock-dispose`, `connector-host`, the 5
      delint-touched files. `git grep -c eslint-disable connectors/alloy/alloy-chamber.worker.js` → **0**.
- [x] Reviews: compliance + craft + reconciliation, recorded pass.
- [x] Deviation log (the DoR-was-false reframe; recommended-not-Airbnb choice; blanket removed-not-narrowed);
      refinement-todo **014-01 (d) eslint-scope residual** + the **Code-style-and-linting** deferred decision
      both marked RESOLVED; `conventions.md` Code style filled; lightweight-decision recorded (human-approved).
- [x] **No live identifiers committed.**

**Anti-horizontal-phasing check:** linting is on and enforced in CI, and the alloy chamber is linted again
(zero disables) — a real, CI-visible code-quality change, not internal churn. The reframe (bootstrap vs
narrow) is honest: the original premise was false and was corrected at the grounding step, not papered over.

### Deviation log

- **DoR reframe (the honest headline).** The slice's DoR asserted "the repo has an eslint config + an `npm`
  lint script (spec 007 CI)". Grounding at implementation **disproved it** — no eslint tooling had ever been
  wired. Rather than block, the user directed "add the linter now"; the slice's scope grew from "narrow a
  disable" to "bootstrap ESLint". This is the intended DoR-caveat working ("confirm at implementation").
- **`recommended`, not AEM/Airbnb.** Deliberate: the AEM/Airbnb ruleset the disable comments hail from would
  surface hundreds of stylistic findings — a repo-wide cleanup, not "turn linting on". `recommended` is a
  real-bug ruleset. The stricter ruleset stays a deferred option (conventions.md + lightweight-decision).
- **Blanket removed, not narrowed.** AC as originally written expected scoped per-rule disables; under
  `recommended` the alloy chamber needs **none** (only 2 `no-useless-escape` — hand-fixed, since
  `eslint --fix` is a no-op for that rule in eslint 10.9.1). Removing the blanket outright is the stronger
  outcome.
- **`eslint . --fix` (orchestrator) removed 6 now-inert `no-console`/`no-throw-literal` disable directives**
  (build.mjs, rig/bundle-smoke, rig/isolation, rig/uc1, test/connector-host) — `recommended` doesn't enable
  those rules, so the directives were dead. Behavior-neutral.
- **Latent issue parked (flagged, not silently fixed):** `rig/e2e.mjs:175` carried a genuinely dead
  `unloadDispatchedAt = Date.now()` store — never read after, never in the `out` report (only the derived
  `unloadDispatchedBeforeAc1Delivery` boolean is reported). Removed (behavior-preserving). The adjacent
  comment at L145 is now stale; left for the owner to decide whether an AC2b unload timestamp *should* be
  surfaced in `out`. Rig hygiene, not a product defect — no coverage lost.

### Reconciliation sweep

- **conventions.md** § Code style: filled (was `Deferred`), applied through the `JIG_CONVENTIONS_APPROVED`
  gate (human-approved change).
- **refinement-todo:** the `Code style and linting` deferred decision struck → RESOLVED; the 014-01 (d)
  blanket-eslint residual marked RESOLVED (adjacent to the 021-02 resolution).
- **lightweight-decisions.md:** new 2026-08-31 entry (recommended baseline, human approval, delivered under
  021-03).
- **inbox.md:** the resolved 021-03-BLOCKED entry dropped.
- **CI:** `.github/workflows/ci.yml` hermetic job gains a `Lint (eslint)` step.
- **Config coverage:** `eslint.config.js` ignores cover `probes/` (vendored), `rig/out/` (build output),
  `.claude/` (stale worktree), `**/*.d.ts`. `npm run lint` green; 97 tests green.
