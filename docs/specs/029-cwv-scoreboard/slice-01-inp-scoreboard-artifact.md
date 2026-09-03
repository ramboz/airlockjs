---
status: DRAFT
dependencies: []
last_verified:
---

<!-- jig grounding (ADR-0020): engines are probe-backed — rig/measure.mjs runs
     naive/deferred/worker (rig/harness.html:49-53); baseline/naive.js is the real
     synchronous multi-tracker; spec 003 measured 152/8/8. The scoreboard PACKAGES
     these; it does not re-measure the physics. -->

## Slice 029-01 — the INP scoreboard artifact

**Goal:** A `rig/cwv-scoreboard.mjs` (`npm run cwv:scoreboard`) that runs the existing INP-storm driver
(`rig/measure.mjs`) under **naive / deferred / worker**, N runs each with a median + noise band and
work-completed fairness (reusing `rig/cwv-budget.mjs`'s cross-invocation discipline), and emits **one durable,
legible before/after artifact** — machine JSON + a rendered markdown card — stating the **honest triple** and the
honest headline. The vision's punchline, promoted from prose to a runnable command.

**The honest artifact (load-bearing — the frame-critique target):** it shows all THREE arms
(naive / deferred / worker), NOT naive-vs-worker alone. The headline is *"~19× vs the naive multi-tracker stack
real sites run; **ties** a competently-deferred main thread — without the deferral discipline baseline must get
right by hand."* An artifact that reports only naive→worker (omitting the deferred tie) is an overclaim and a
**FAIL** of AC3.

**DoR:**
- ✅ Engines grounded (2026-09-03): `rig/measure.mjs` runs naive/deferred/worker today; 152/8/8 reproduce.
- ✅ Shape to copy: `rig/nasty-tag.mjs` (JSON + median/band + fairness + verdict) and `rig/cwv-budget.mjs`
  (N× cross-invocation medianing).
- ☐ Frame-critique passed (spec `frame_review: true`) — the "honest triple, not naive-vs-worker overclaim"
  framing adversarially checked before implementation.

**Acceptance Criteria:**

1. **`npm run cwv:scoreboard` runs naive / deferred / worker and medians them.** The command spawns
   `rig/measure.mjs` under each of the three modes, N runs each (N configurable, default matching
   `cwv-budget.mjs`), and computes a median + a noise band per arm. Same fixture / `TRACKERS` / `WORK` across all
   three arms (apples-to-apples). A test (Node-level, mocking the measure spawn) asserts all three modes are run
   and medianed.
2. **It emits a durable artifact: machine JSON + a human markdown card.** Writes `rig/out/cwv-scoreboard.json`
   (the three arms' medians/bands + the contrast ratios + metadata: fixture, N, TRACKERS, WORK, timestamp) and a
   rendered markdown card (to stdout + `rig/out/cwv-scoreboard.md`). The JSON is valid + parseable (a test parses
   it); the card is human-legible (a test asserts it contains the three arm labels + the numbers).
3. **The artifact is HONEST — all three arms + the honest headline.** The card + JSON show naive AND deferred
   AND worker; the headline states the ~Nx win **vs naive** AND the "ties deferred (no discipline)" honesty. A
   test asserts the artifact contains the deferred arm and does NOT present a bare naive-vs-worker multiplier as
   the sole claim. (This AC is the frame-critique's honesty made checkable.)
4. **Fairness: work-completed parity + a noise band.** The scoreboard asserts/records work-completed parity
   across arms (same synthetic load actually ran in each), and the noise band flags when a contrast is within
   noise (not decisive) — reusing the `nasty-tag.mjs`/`cwv-budget.mjs` fairness pattern. A within-noise arm is
   labeled as such, never as a false win.
5. **Advisory — NOT wired into `oracle.sh`'s gating composite.** The command's exit code is advisory
   (local/CI info only), consistent with ADR-0005; a test/grep asserts `oracle.sh`'s `COMPONENTS` is unchanged
   (still `vitest` + `ga4_mp_conformance`) — the scoreboard does not become a gate.
6. **No live identifiers.** The fixture is the synthetic 5-tracker micro-fixture; no live endpoints/ids.

**DoD:**
- [ ] All ACs pass; full real-repo suite green (no regression; the scoreboard is a new rig + a Node-level test).
- [ ] Coverage exercises each AC (three-arm run + median; JSON+card emission; the honest-triple assertion;
      fairness/noise; advisory-not-gating).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by independent reviewer; compliance + craft passes (craft guards measurement FAIRNESS +
      the honest-framing).
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** after this slice, `npm run cwv:scoreboard` produces the vision's punchline as
a durable, honest artifact anyone can run + read — end-to-end value, not internal plumbing.

### Deviation log (after reconciliation)

_TODO during IN_PROGRESS._

### Reconciliation sweep

_TODO during reconciliation._
