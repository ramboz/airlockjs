---
slice: 033-01 — spike: de-risk alloy adapter-boot + distribution + the composite-handle reconciliation (GO/KILL)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-05T00:21:52Z
prompt_source: review.py frame-critique docs/specs/033-alloy-config-wiring/spec.md 033-01 <slice>
---

VERDICT: pass (after one needs-changes → revision cycle)

## Assessment (independent frame-critique, jig:reviewer) — a SPIKE frame-critique

The spike is framed on the right, complete set of load-bearing unknowns, with CSP-admission of a classic
`importScripts` worker correctly installed as unknown #1 + the explicit PRIMARY KILL risk.

## The decisive catch (first pass) → FIXED
The original 4 unknowns (distribution / handle / adapter-boot / decisions+consent) were grounded, but the spike
**missed the single most-likely-to-KILL axis**: whether a *classic* `importScripts` worker + a same-origin 766 KB
bundle even LOADS/executes under the *enforced* EDS boilerplate CSP (`'strict-dynamic'`, no `worker-src`,
`require-trusted-types-for 'script'`). **004-01 proved that CSP only for a `{type:"module"}` worker** (module-specific
dynamic-import trust chain — `slice-01-worker-under-csp.md` + build.mjs's HARD CONSTRAINT); `importScripts` is NOT
covered by that chain, and every alloy rig ran CSP-less. A GO that de-risked distribution/handle/consent but never
this could green-light a build that dies on the real-site CSP (MVP6's Risk-First row).

**Addressed:** added as unknown **#1 (PRIMARY KILL risk)** with the cheapest real probe (re-run 004-01's `rig:csp`
against the *built classic alloy worker*, Trusted Types included); the four originals renumbered #2–#5; threaded
through the Question, Outcome, DoD ("each of the 5 unknowns"), and spec.md's Assumptions + Decomposition.

## Secondaries folded in (verified against the code)
- #3: `createWrappedSdkHost` exposes NO `dispose` + does NOT spawn the Worker → `bootAlloy` builds Worker
  construction + teardown itself (relevant to the 021-01 no-leak invariant).
- #5: the chamber's `{type:"decisions"}` message is NOT consumed by `createWrappedSdkHost.handleMessage` today
  (rig-only) → the decisions→`reserveSpace` path is genuinely un-built (#5 is load-bearing).
- #2: names the licensing/redistribution of shipping the stock Adobe bundle same-origin.

Reviewer: jig:reviewer (independent). Pre-investigation spike frame gate; frame_review: true. Recovery:
needs-changes → CSP-axis added as primary → pass. (Cosmetic (a)–(d)→(a)–(e) drift also fixed.)
