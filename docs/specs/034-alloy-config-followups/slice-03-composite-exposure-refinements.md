---
status: DONE
dependencies: [033-03]
last_verified: 2026-09-05
arch_review: true  # changes the composite handle contract (accepts()) + the connector→composite emit path.
frame_review: true  # rests on the 033-03 arch-review smells being real + the cleaner shapes being sound.
---

<!-- jig self-defining vocabulary (soft, forward-only). jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 034-03 — composite/exposure refinements: `accepts(name)` + a wired emit hook

**Goal:** clean up the two composite/exposure smells the 033-03 **arch review** flagged (both backward-compatible,
bounded — refinements, not fixes), plus the related alloy-only-exposure guard:

1. **`composite.accepts(name)` replaces the `push`-returns-count overload.** 033-03 overloaded `createComposite.push`/
   `pushCritical` to RETURN the fan-out count so the exposure sink could detect an alloy-only "nowhere to land"
   (count 0). But `count===0` conflates "no connector accepted this event" with "no analytics sink" (correct only
   while GA4 is the sole `["*"]` sink), and it changes the public write-surface contract for one internal consumer.
   A scoped **`composite.accepts(name)`** predicate is the clean shape.
2. **A wired composite-emit hook decouples exposure from `window.airlock`.** 033-03 routes the `proposition_display`
   exposure through the mutable `window.airlock.push` global (late-bound in `deliver`) — a re-boot mid-session
   (`installOnWindow` disposes+replaces the singleton, 021-01) would route to a different composite than alloy booted
   under. `boot()` should wire a **composite-emit ref** into `bootAlloy` (populated after `createComposite`), so the
   exposure routes through that, not the global.
3. **alloy-only exposure telemetry — guarded + documented.** The `proposition_display` DISPLAY works standalone, but
   its EXPOSURE needs an analytics `["*"]` sink; via `accepts("proposition_display")` an alloy-only boot cleanly
   **drops + diagnoses** the exposure (documented: exposure telemetry requires an analytics connector; display still
   works).

**DoR:**
- ✅ 033-03 + 034-01/02 landed. Grounded (read 2026-09-05): `createComposite` (`adapters/eds/index.js:1160-1185`)
  fans by `acceptsEvent(c.events,name)` and its `push`/`pushCritical` **return the fan-out count** (added 033-03 for
  the exposure sink); `wireAlloyDecisions`'s exposure reporter (`:852-872`) late-binds `window.airlock.push`, guards
  absent/push-less, and checks `deliveredTo===0` for the alloy-only case; `installOnWindow` disposes+replaces
  `window.airlock` on a re-boot (021-01). **Timing:** `bootAlloy`/`bootConnector` run BEFORE `createComposite`
  assembles the connectors, so the wired emit-ref (AC2) must be a **deferred ref** `boot()` populates *after*
  `createComposite` and `bootAlloy`'s reporter closes over. **Test-rewrite scope (frame-critique):** the count-return
  is asserted directly by `test/eds-boot-alloy.test.js:689` (`window.airlock.push(...).toBe(1)`/`.toBe(0)`) and emulated
  by the composite mocks at `:718` (`push:()=>0`) + `:850-858` (`push:(evt)=>{…return n}`) — these MUST be rewritten to
  the `{accepts, emit}` shape (re-express no-loop via captured events + `accepts`), not kept. The re-boot misroute is
  GENUINELY REACHABLE (verified): a main-thread `deliver` pending on `await handlePromise` resumes AFTER `installOnWindow`
  swaps the singleton and would read the NEW composite — so AC2 is load-bearing, not gold-plating.

**Acceptance Criteria (ratified at this slice's frame-critique):**

1. **`composite.accepts(name)` replaces the count-overload.** `createComposite` exposes an `accepts(name)` predicate
   (true iff some connector's vocabulary `acceptsEvent(name)`). The exposure sink uses `accepts("proposition_display")`
   — NOT `push`'s `count===0` — to decide whether an analytics sink exists (fixing the "no connector accepted" vs "no
   analytics sink" conflation). `push`/`pushCritical` **revert to void** (safety-checked: the ONLY production reader of
   the 033-03 count is the exposure sink; `accepts` now serves the detection). The `:689` count-return TEST assertion
   is rewritten (not kept) — it is exactly what this AC removes.
2. **Wired emit-ref replaces the `window.airlock` late-bind.** `boot()` populates a **deferred composite-emit ref**
   (after `createComposite`; `bootAlloy`'s reporter closes over it) — `{ accepts, emit }` bound to THE composite this
   alloy booted under — and `bootAlloy` reports exposures through it, not the mutable `window.airlock` global (fixing
   the reachable re-boot misroute). **Interface pin:** `decisions-exposure.js`'s `createPropositionExposureReporter`
   KEEPS its `{ push }` handle contract (unchanged); the adaptation lives in `wireAlloyDecisions`, which builds the
   reporter's `push` to (a) gate on the deferred ref's `accepts("proposition_display")` → drop+diagnose if false, else
   (b) `emit` via the ref. Standalone `bootAlloy` (no composite wired) still drops+diagnoses (no throw).
3. **alloy-only guard** — with no analytics `["*"]` sink, `accepts("proposition_display")` is false → the exposure is
   dropped+diagnosed; a boot WITH GA4 routes it to GA4 (alloy's `["page_view"]` still ignores it — no loop).
4. **End-to-end proof** — exposure routes via the wired emit-ref to a GA4 sink (captured); alloy-only → dropped+diagnosed
   via `accepts`; a re-boot does not misroute. The 033-03 no-loop + GA4-capture **behavior** is preserved — but its
   count-return assertions are **re-expressed** (via captured events + `accepts`), not "kept green" (the count-return
   is exactly what AC1 removes).

**DoD:** all ACs pass; TDD red→green; reviewed (compliance + craft + **arch** + **frame-critique**); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` exposure-hook + `accepts`/push-count +
alloy-only-exposure follow-ons **closed**; board synced.

## Close-out

### Deviation log

**Implementer stall + orchestrator completion (process note — transparency).** The implementer subagent completed
`createComposite`'s `accepts(name)` + the `push`/`pushCritical` void-revert, `wireAlloyDecisions`'s emit-ref reporter,
and ALL tests (the rewritten `:689`/`:718`/`:850-858` count-return assertions + the new `accepts` unit /
`re-boot no-misroute` / alloy-only-drop / standalone-drop tests), then **stalled** (watchdog, 600s no-progress) at the
final wiring. The **orchestrator finished the last two wiring edits**: (1) `bootAlloy` passes `compositeEmit` to
`wireAlloyDecisions` (`index.js` ~:1036); (2) `boot()` creates the deferred `{accepts,emit}` ref, threads it through
`bootConnector`→`bootAlloy`, and populates it (bound to the assembled composite: `accepts→composite.accepts`,
`emit→composite.push`) after `createComposite`. The orchestrator-authored wiring is included in the compliance/craft/arch
review scope below.

**Design deviations (all deliberate, review-blessed at frame-critique):**
1. **`push`/`pushCritical` reverted to void** (dropped the 033-03 count-return) — safety-checked at frame-critique: the
   ONLY production reader of the count was the exposure sink, now served by `accepts`.
2. **Deferred emit-ref** (created empty in `boot()`, populated after `createComposite`; `bootAlloy`'s reporter reads it
   lazily at deliver-time) — required by the timing (`bootAlloy` runs before `createComposite`), and load-bearing (fixes
   the GENUINELY-reachable re-boot misroute, proven by the `re-boot no-misroute` test).
3. **`decisions-exposure.js` UNCHANGED** — the interface pin held: `createPropositionExposureReporter` keeps its
   `{ push }` handle contract; the `accepts`-gate + `emit`-routing adaptation lives entirely in `wireAlloyDecisions`.

**Review-flagged follow-ons (compliance + craft + arch all PASS; these are non-blocking, tracked in refinement-todo):**
- **(arch #1) Disposed-composite exposure is a silent drop, not diagnosed.** On the rare mid-session re-boot, the
  deferred ref stays bound to the ORIGINAL composite (correct — no cross-session misroute), but that composite is now
  disposed; `accepts("proposition_display")` still returns true (its `connectors[]` still lists GA4), so an in-flight
  exposure passes the gate and `emit`→`push` lands in a terminated-worker ring (verified non-throwing) — vanishing
  WITHOUT a diagnostic (unlike the standalone-boot drop). Acceptable fail-safe (drop, never misroute); consider nulling
  the ref on `dispose` so it drops+diagnoses consistently. This disposed path is untested (the re-boot test binds
  `emit` to a live array).
- **(arch #2 — relevant to the 037 1.0 pin) `accepts(name)` widens the `window.airlock` surface.** It is a new
  read-method on the installed composite handle, but consumed ONLY internally via the deferred ref — absent from
  push-api.md. The 1.0 API pin (spec 037) must decide: document `accepts` as public, or keep it off the installed
  handle (bind the ref to a local predicate). Flagged for 037's surface-freeze.
- **(arch #3 / craft) leanness nits (no action):** `bootConnector` now takes 5 positional args (last two alloy-only —
  consistent with the pre-existing `reservedPlacements` pattern; an options object would read truer); the
  `compositeEmit` name over-emphasizes `emit` (also carries `accepts`); the reporter's no-ref drop reason would
  mislabel a (unreachable) pre-population ref as "a standalone bootAlloy" (cosmetic — that path never fires in
  `boot(config)`).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `adapters/eds/index.js` | `updated` | `createComposite`: `accepts(name)` predicate + `push`/`pushCritical` void-revert; `boot()`: the deferred `{accepts,emit}` ref (threaded `bootConnector`→`bootAlloy`, populated post-`createComposite`); `wireAlloyDecisions`: the reporter routes via the ref (accepts-gate → emit), `window.airlock` late-bind removed. |
| `test/eds-boot-alloy.test.js` | `updated` | Rewrote the `:689` count-return assertion (no-loop via captured events + `accepts`) + the count-return composite mocks; added the `re-boot no-misroute`, `accepts`-gated no-loop, alloy-only-drop, standalone-drop tests. |
| `test/eds-boot-config.test.js` | `updated` | `composite.accepts(name)` unit test (GA4 `["*"]` catch-all + helix-rum checkpoints). |
| `docs/refinement-todo.md` | `updated` | exposure-hook + `accepts`/push-count follow-ons **RESOLVED**; alloy-only-exposure **guarded** (drop+diagnose via `accepts`), with the dedicated-sink deeper follow-on as the residual. |
| `adapters/eds/decisions-exposure.js` | `no-op` | interface pin held — the reporter's `{ push }` contract is unchanged; adaptation is in `wireAlloyDecisions`. |
| `docs/specs/README.md` (board) | `deferred` | the 034-03 row flips to **DONE** at the DONE transition (close-out). |

### Definition of Done — verification
- [x] All ACs pass; **TDD red→green** (the implementer's RED-first tests + the orchestrator-completed wiring turning them green). `npm test`: **81 files, 1142 tests** (034-02 1139 → +3). `node build.mjs` OK; `node contracts/validate.mjs` all pass; `npm run lint` clean.
- [x] `accepts(name)` replaces the count-overload (`push` void); the deferred emit-ref replaces the `window.airlock` late-bind (re-boot no-misroute proven); alloy-only drop+diagnose via `accepts`; the 033-03 no-loop + GA4-capture behavior preserved (re-expressed via captured events + `accepts`).
- [x] Reviewed: **frame-critique** pass; compliance + craft + arch recorded at REVIEWED. Deviation log + reconciliation sweep produced; reconciliation review passed. refinement-todo closed/guarded; board synced.
