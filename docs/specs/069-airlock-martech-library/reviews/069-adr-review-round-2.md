---
round: 2
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-21T20:04:45Z
prompt_source: ADR-0065 and slices 069-01, 069-02 (then the data-layer bridge, now the generic data layer), 069-03 (the library, formerly 069-02) and the re-scoped 064-31 as drafted before commit 84499749 on vendor-adobe (squashed into 84499749, which adds this file; after 1abe1670). The reviewer read the files from disk, not a diff.
scope: ADR-0065 revised for no ACDL, slices 069-01 to 069-03, 064-31 re-scope
---

# ADR-0065 and slice review (round 2)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`: the revision removed ACDL and kept the numbering consistent, but its cost claims overstated the design and some differences had no owning AC. The author fixed every finding in the same docs commit; no re-review has run, so the verdict above stays the reviewer's.

1. **High, fixed.** "O(1)" versus a deep merge per push (O(pushed object)), heavier than core's `projection[type] = descriptor`. Fixed: `push` is validate-and-append only; the state folds lazily at `getState()`, at send, or in the drain (ADR point 5, 069-02 AC2 and AC3, with a visit-counter test that `push` does no fold).
2. **High, fixed.** The eager-phase fallback (stock shallow merge, event entries excluded) had no owning AC. Fixed: 069-02 AC5 compares an eager-phase `sendEvent` body with the stock run's and records the difference.
3. **Medium, fixed.** Two table rows each claimed to be "the one stock difference". Reworded to "a stock difference".
4. **Medium, fixed.** Getters, `Proxy` traps and cycles could run page code or overflow the stack in `push`. 069-02 AC2 now validates own data properties only, rejects `Proxy`, accessors and non-plain prototypes, bounds depth, with a test for each.
5. **Medium, fixed.** Drain scheduling was unspecified (a microtask would not help INP). 069-02 AC2 pins a separate task, with a task-boundary probe, and the order against direct `sendEvent` calls.
6. **Medium, fixed.** When the consumer attaches, and the `analytics: false` case. 069-02 AC4 attaches in the lazy phase only when `analytics` is true, replays held events, with both tested against the stock run.
7. **Medium, fixed.** A foreign ACDL loading after install, and whether `push` still appends. 069-02 AC1 states that `push` still appends, and detects a replaced `push` at the next drain with a diagnostic (hermetic test).
8. **Medium, fixed.** The send-time merge shared nested objects with the live state. 069-02 AC3 hands the hook a `structuredClone`, with a test, and the per-send O(state) cost is stated and measured.
9. **Low, fixed.** No AC for a data-layer event under pending consent, or for extra keys in a push. 069-02 AC4 ignores keys other than `event`, `xdm`, `data` and `configOverrides` (tested) and defers consent to 069-03 AC3.
10. **Low, fixed.** The "no ACDL request in the journey" assertion belonged to 069-03. 069-02 AC1 is scoped to the bridge side; 069-03 AC5 owns the journey.
11. **Low, fixed.** Option B's "seal never sees the state" con was weak and Option A's "move later" claim was uneven. Both reworded.
12. **Low, fixed.** Why the bridge is not core's `airlock.push` log: one sentence added to ADR point 5 and the 069-02 Goal.
