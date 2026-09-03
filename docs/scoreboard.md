# airlock CWV scoreboard — the INP punchline

> The durable, committed form of the vision's punchline. Written in **tolerance bands + provenance** (not raw run
> output) so a fresh run on other hardware cannot contradict it. Regenerate the exact per-run numbers with
> `npm run cwv:scoreboard` (writes `rig/out/cwv-scoreboard.{json,md}` — gitignored, per-machine). Spec 029-01.

**Measured 2026-09-03** · synthetic **5-tracker** storm (each ~30ms of synchronous work on click, 60 clicks) ·
`rig/measure.mjs` · **advisory** (jig-supervised, NOT in `oracle.sh`'s gating composite — ADR-0005).

| arm | INP p75 | note |
|---|---|---|
| **naive** (sync multi-tracker — what most sites run) | **~150ms** | a real p75 — every interaction is well above the 16ms Event-Timing floor, so all are captured |
| **deferred** (a competently `requestIdleCallback`-deferred main thread) | **below the 16ms floor** | steady-state interactions are sub-16ms — below the INP measurement floor |
| **worker** (airlock) | **below the 16ms floor** | steady-state interactions are sub-16ms — below the INP measurement floor |

**Headline:** the naive multi-tracker stack real sites run tanks INP to **~150ms**; airlock keeps interactions
**below the 16ms INP measurement floor** — the vision's headline margin is **~19×** (the 152→8 figure), and measured
**conservatively it is at least ~9×** (naive's ~150ms vs the 16ms floor; the fast arms sit *below* the floor, so
the true margin is larger, not smaller) — while **tying a competently-deferred main thread**, *without the
deferral discipline that baseline must get right by hand.* (A fresh `npm run cwv:scoreboard` reports the floored
≥~9× lower bound, so it can never contradict this card.)

**Read this honestly (the measurement floor):** `rig/harness.html`'s Event-Timing observer uses
`durationThreshold: 16`, so the fast arms' sub-16ms steady-state interactions are **below the floor and not
captured** — only the cold `first-input` sample survives (~single-digit ms, ~1 interaction). So "below the floor"
is the honest reading for both fast arms; a precise "8ms" would be false precision on a single sample. The robust,
repeatable number is **naive's ~150ms p75** (a wall-clock spin — `baseline/naive.js` = `5 × busy(30000µs)` — so it
reproduces hardware-independently). The honest positioning airlock claims (`docs/product-vision.md` § Design
principles): **INP-safe-by-construction + wins-the-common-case (vs naive) + wins-heavy/indivisible-load + per-tracker
isolation — NOT a blanket "beats a competent main thread"** (a well-deferred one ties it).

_The RUM subsume and the realistic-customer-stack load are separate/later MVP5 work (029-03, and a separate RUM
spec); this card is the synthetic-load punchline._
