---
status: IN_PROGRESS
dependencies: [033-03]
last_verified:
arch_review: true  # changes the composite handle contract (accepts()) + the connector→composite emit path.
frame_review: true  # rests on the 033-03 arch-review smells being real + the cleaner shapes being sound.
claimed_by: claude/mvp6-e4550f
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
