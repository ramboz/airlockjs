---
slice: 064-27 — Alloy storage grant
pass: craft
round: 3
verdict: pass
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20T18:22:53Z
prompt_source: review prompt, slice 064-27 (commits 36fc4348, 4e4b0f5d and the round-3 fixes)
---

# 064-27 craft — Round 3

## Round 1

**Verdict: pass. 0 high, 1 medium, 5 low.**

Checks that hold: no vendor code in `core/`; `alloyStorageGrant` returns new frozen objects, never mutates the constants, falls back to the base set without an org, and turns `@` into `_` like stock; one `stockStorage` feeds host grant, purposes and boot seed; the real-Chromium test fails without the change (empty key dump, second set-consent sent, narrowed boot throws); GATING step present.

- **C1 (medium)** `test/adobe-storage-grant.test.js`: fixed sleeps (600 ms, 300 ms) decide when requests and write-backs are checked; flaky on slow CI. Wait on the request.
- **C2 (low)** Purposes rebuilt per org instead of reusing `ALLOY_STORAGE_PURPOSES`; the rebuilt arrays were not frozen.
- **C3 (low)** The stock reference arm still boots airlock on the same page (harmless, sends nothing).
- **C4 (low)** "persists nothing" only checked load 1; the diagnostic comes from load 2.
- **C5 (low)** The foreign-key check is weak (nothing writes it).
- **C6 (low)** No frozenness check on the grant results; the "nothing extra" regex duplicates the exact `toEqual`.

## Round 2

**Verdict: changes requested. 0 high, 1 medium, 2 nits.**

C1 partly fixed (load 1 polls the request); C2 fixed; C3 accepted; C4 fixed (`afterSecond` asserted); C5 and C6 accepted, carried.

- **R2-1 (medium)** The clientId tests expect a request on load 2 but only had a fixed 1000 ms settle; poll `seen[1]` when one is expected.
- **R2-2 (nit)** The load-1 poll gives up silently after 10 s; a later assertion still catches it.
- **R2-3 (nit)** `ALLOY_STORAGE_PURPOSES` still made its own arrays; use the shared `FUNCTIONAL`.

## Round 3

**Verdict: pass. 0 high, 0 medium, 0 low (one optional nit).**

R2-1 fixed: `twoLoads` takes `expectSecond`, polling `seen[1]` up to 10 s before the bounded settle; enabled only for the two clientId tests. R2-3 fixed: one frozen `FUNCTIONAL` is shared by `ALLOY_STORAGE_PURPOSES` and `alloyStorageGrant`. R2-2 accepted (a later assertion catches a missing request). Optional nit: the 1000 ms settle still runs when `expectSecond` already saw the request; it costs time only. Carried with reasons: C3 (harmless), C5 and C6 (low value).
