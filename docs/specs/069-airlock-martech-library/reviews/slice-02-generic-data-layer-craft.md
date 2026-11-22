---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T18:17:35Z
prompt_source: "the slice diff 75bf23c7..344134f6 (squashed into the commit that carries these files), saved at a scratch path and read by the reviewer from disk"
scope: code craft of slice 069-02 (adapters/eds/martech-datalayer.js, its hermetic and real-Chromium tests, the CI step)
---

# Slice 069-02 craft review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `needs-changes`, recorded here as `changes-requested`. "This commit" is the round-1 fix commit that carries this file. No round-2 re-review has run.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Med | Validation cost: the cycle check is path-only, so a shared-reference DAG (32 objects each pointing twice at the next) walks ~2^32 paths. | Fixed in this commit: a per-push node budget (`MAX_PUSH_NODES`); over budget the push is dropped with `datalayer-bad-push`. Test with a 2^30-path DAG; revert-checked (the test hangs without the budget). |
| 2 | Low/Med | A sparse array with a huge `length` (`a = 1e9`) loops over every index. | Fixed in this commit: array slots count against the same budget. Test; revert-checked with #1. |
| 3 | Med | `while (sendHead < sendQueue.length)` never ends if a hook pushes during the drain. | Fixed in this commit: the drain snapshots the queue length at its start and reschedules what was added after it as a new task. Test: a hook that pushes on every event does not hang and later events still process; revert-checked (hangs without the snapshot). |
| 4 | Low | `proxyCheck` reads `arr.push` outside a `try`; a throwing getter stalls the queue. | Fixed in this commit: each check runs guarded; on a throw it is removed with a `datalayer-proxy-check-threw` diagnostic. Test; revert-checked. |
| 5 | Low/Med | `sendQueue` is unbounded before `attach()`. | Fixed in this commit: capped at `MAX_HELD_EVENTS` (200, mirroring core's held-beacon ring), oldest dropped with `datalayer-held-overflow`; the deviation log records it. Test; revert-checked. |
| 6 | Low | `onEvent` gets the stored payload by reference and the forward runs after it; a rejected thenable from `onEvent` is unhandled. | Fixed in this commit: `shouldProcessEvent`, `onEvent` and the forward get copies, a rejected thenable is diagnosed. Tests; the copy test is revert-checked. |
| 7 | Nit | The `structuredClone` Proxy backstop is not explained, and its absence is not in the known limit. | Fixed in this commit: a comment at the call and a sentence in the KNOWN LIMIT note (without `structuredClone` a Proxy whose traps return plain data is accepted). |
| 8 | Low | Installing twice on one name reports our own array as foreign; a second name drops the first's drain-time detection; there is no uninstall. | Fixed in this commit: idempotent, drain checks are a list (tests, revert-checked). No uninstall: carried, the spec does not require one and the module header says so (owner: 069-03, or a later slice if the library needs it). |
| 9 | Low | `scanBlocks` puts the block class in the selector unescaped. | Fixed in this commit: `CSS.escape` when it exists, else the literal as stock does (a parity deviation, in the deviation log). Hermetic test and a real-Chromium test with `md:hero`; revert-checked. |
| 10 | Nit | Dead `seq` counter. | Fixed in this commit: removed. |
| 11 | Low | The AC9 assertion is vacuous. | Fixed in this commit: exact key list. |
| 12 | Nit | Stray whitespace in a hermetic test (`expect(    dl.getState(...)`). | Fixed in this commit. |
| 13 | Low | The real-Chromium tests use fixed sleeps. | Fixed in this commit: the stock arm is polled with `page.waitForFunction` for the expected number of sends (a run that must send nothing gets one 30 ms settle); our arm waits for the drain's macrotask instead of 60 ms. |
| 14 | Info | The CI step is fine. | No action. |
