---
status: DRAFT
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
- [ ] ACs pass. Tests: a `dispose()` test (listeners removed via a spy `removeEventListener`; `worker.terminate`
      called; idempotent; null-safe); an idempotent-boot test (2nd boot doesn't stack a Worker/listeners).
      Targeted sweep (full suite hangs): `eds-boot`, `egress-fastpath`, any `core/airlock` test.
- [ ] Reviews: compliance + craft + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; refinement-todo **OQ12 item 4** marked RESOLVED (item 4 was the
      last-open OQ12 item — mark OQ12 complete).
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** a re-boot no longer leaks a Worker + unload listeners, and a host can tear
airlock down — an observable runtime-lifecycle change the library-distribution audience (OQ8/MVP6) needs, not
internal plumbing.
