---
status: DONE
dependencies: []
last_verified: 2026-08-31
frame_review: false
---

## Slice 021-01 — dispose() + idempotent-boot guard

**Goal:** Make the airlock runtime **library-safe**: a `dispose()` on the handle tears down the Worker + the
global unload listeners, and `bootEdsAnalytics` is idempotent so a re-boot does not leak a Worker + listeners
+ silently overwrite `window.airlock`. Closes OQ12 item 4.

**DoR:**
- ✅ `core/airlock.js` registers `visibilitychange` + `pagehide` listeners (airlock.js:271-275) with no
  teardown; creates a Worker with no `terminate`; the returned handle has no `dispose`. **Grounded** (read).
- ✅ `bootEdsAnalytics` sets `window.airlock` unconditionally; the adapter's `__airlock*Wired` guards cover
  the listener double-wire but not the Worker / `window.airlock`. **Grounded** (read).

**Acceptance Criteria:**

1. **`createAirlock` handle gains `dispose()`.** It `removeEventListener`s the `visibilitychange` + `pagehide`
   handlers (which requires giving them **named references**, not anonymous inline fns) and calls
   `worker.terminate()`. Idempotent (a second `dispose()` is a no-op) + null-safe (no `addEventListener`/no
   Worker env → no throw). Observable: after `dispose()`, the unload listeners are gone (a `pagehide` fires no
   flush) and the Worker is terminated.
2. **`bootEdsAnalytics` is idempotent.** A second `bootEdsAnalytics` on a page that already has
   `window.airlock` **disposes the prior instance first** (or returns the existing handle) — never stacks a
   second Worker + a second set of unload listeners. Observable: two boots → one live Worker + one listener
   set; `window.airlock` is the live one.
3. **No regression to the single-boot path.** The once-per-page EDS flow is byte-unchanged (the unload flush,
   `pushCritical`, the drain still work); `dispose()` is additive; the idempotent guard only bites on a 2nd
   boot. Observable: existing `eds-boot` / `egress-fastpath` / airlock tests stay green.

**DoD:**
- [x] ACs pass. Tests: a `dispose()` test (listeners removed via a spy `removeEventListener`; `worker.terminate`
      called; idempotent; null-safe); an idempotent-boot test (2nd boot doesn't stack a Worker/listeners).
      Targeted sweep (full suite hangs): `eds-boot`, `egress-fastpath`, any `core/airlock` test.
- [x] Reviews: compliance + craft + reconciliation, recorded pass.
- [x] Deviation log + reconciliation sweep; refinement-todo **OQ12 item 4** marked RESOLVED (item 4 was the
      last-open OQ12 item — mark OQ12 complete).
- [x] **No live identifiers committed.**

**Anti-horizontal-phasing check:** a re-boot no longer leaks a Worker + unload listeners, and a host can tear
airlock down — an observable runtime-lifecycle change the library-distribution audience (OQ8/MVP6) needs, not
internal plumbing.

### Deviation log

- **None from the spec's letter.** All three ACs implemented as written: `dispose()` on the `createAirlock`
  handle (named `onVisibilityChange` ref + `removeEventListener` ×2 + `worker.terminate()`, `disposed`
  idempotency guard, null-safe on both a no-`removeEventListener` env and a `Worker` with no `.terminate`);
  `bootEdsAnalytics` idempotent via dispose-prior-then-reboot (not a return-the-existing-handle short-circuit —
  every boot still yields a live, freshly-constructed runtime); single-boot path byte-unchanged (the guard only
  bites on a 2nd boot; `dispose` is additive).
- **Env note (not a code deviation):** the targeted vitest glob also picks up a separate stale worktree's
  `test/*` copy; those ran green trivially (nothing there changed). Full `npx vitest run` deliberately not
  invoked (stale-worktree hang, per project memory).

### Reconciliation sweep

- **refinement-todo:** OQ12 item 4 marked RESOLVED (021-01); OQ12 header updated to COMPLETE (item 4 was the
  last-open item). Append-only, prior text preserved.
- **No orphaned references:** the handle's public surface gains `dispose` (documented in the adapter's
  `@returns` JSDoc + the `createAirlock` return docstring); the stale "boot is once-per-page by design … parked
  for a later slice" comment in `adapters/eds/index.js` was replaced with the idempotent-reboot description.
- **Tests:** 36/36 on the mandated sweep (`eds-boot`, `egress-fastpath`, `airlock-dispose`); 105/105 on the
  broader every-`createAirlock`-consumer sweep (added `push-contract`, `endpoint-ceiling-seam`,
  `payload-governance-seam`, `chamber-observability`, `consent-seal` as an extra regression net).
