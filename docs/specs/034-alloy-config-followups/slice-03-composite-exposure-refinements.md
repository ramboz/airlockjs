---
status: DRAFT
dependencies: [033-03]
last_verified:
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
- ✅ 033-03 landed (the exposure via `window.airlock.push`; the `push`-returns-count; the composite fan-out).
- ✅ Grounded (033-03): `createComposite` (`adapters/eds/index.js`) fans by `acceptsEvent(events,name)`; `installOnWindow`
  disposes+replaces `window.airlock`; `bootAlloy`'s `deliver` late-binds `window.airlock.push`.

**Acceptance Criteria (provisional — ratified at this slice's frame-critique):**

1. **`composite.accepts(name)`** — `createComposite` exposes an `accepts(name)` predicate (true iff some connector's
   vocabulary accepts `name`). The exposure sink uses it (not `count===0`) to decide whether an analytics sink exists.
   `push`/`pushCritical` return to their pre-033-03 contract (or the count stays but is no longer the exposure signal —
   the frame-critique picks; the goal is to stop overloading the write-surface return for this).
2. **Wired emit hook** — `boot()` populates a composite-emit ref (after `createComposite`) that `bootAlloy` uses to
   report exposures; the mutable-`window.airlock` late-bind is removed. A re-boot routes exposures to the current
   composite (no stale-singleton routing). Standalone `bootAlloy` (no composite) still drops+diagnoses (no throw).
3. **alloy-only guard** — with no analytics `["*"]` sink, `accepts("proposition_display")` is false → the exposure is
   dropped+diagnosed; a boot WITH GA4 routes it to GA4 (alloy's `["page_view"]` still ignores it — no loop).
4. **End-to-end proof** — exposure routes via the wired hook to a GA4 sink (captured); alloy-only → dropped+diagnosed
   via `accepts`; a re-boot does not misroute. The 033-03 no-loop + GA4-capture assertions stay green.

**DoD:** all ACs pass; TDD red→green; reviewed (compliance + craft + **arch** + **frame-critique**); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` exposure-hook + `accepts`/push-count +
alloy-only-exposure follow-ons **closed**; board synced.
