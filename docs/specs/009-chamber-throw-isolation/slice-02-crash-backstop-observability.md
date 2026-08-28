---
status: DRAFT
dependencies: [009-01]
last_verified:
arch_review: true
frame_review: true
---

## Slice 009-02 — chamber failure observability (surface drops + crashes)

> **Reframed 2026-08-27 (009-02 frame-critique).** The Web Worker boundary
> **already** isolates the page from an uncaught worker error — `worker.onerror`
> is not what keeps the page alive (it does so registered or not); an
> unregistered handler means the error is *unobserved*, not that the page breaks.
> So this slice's real, new deliverable is **observability/diagnosability**, not
> page-containment (which is free) and not chamber *restart* (Q1's actual verb,
> still deferred to OQ9). Reframed accordingly.

**Goal:** Make chamber failures **visible instead of silently swallowed** — both
(a) a chamber-level worker `error` (one that escapes 09-01's per-descriptor
guard) and (b) the per-descriptor `dropped[]` descriptors 09-01 reports — by
routing them through a single diagnostics seam on the orchestrator. So a dead
chamber or a dropped malformed event is *diagnosable* (spec.md A2), not
invisible.

**DoR:**
- ✅ 009-01 DONE — the chamber returns `{ ready, dropped }` and survives a
  per-descriptor throw.

**Acceptance Criteria:**

1. **A chamber-level worker error is SURFACED (not swallowed).**
   [airlock.js](../../../core/airlock.js) registers `worker.onerror`; when the
   worker emits an `error` event (a failure that is NOT a caught per-descriptor
   throw — e.g. a worker-module load error or an internal bug), the orchestrator
   **surfaces it** via the diagnostics hook. Observable: a simulated worker
   `error` event produces a surfaced error record via the hook. (The page
   staying alive is *not* the assertion — the Worker boundary already guarantees
   that; the assertion is that the failure is now **observed**.)
2. **Dropped descriptors are surfaced from the reply.** On a reply carrying a
   non-empty `dropped[]` (from 09-01), the orchestrator surfaces each drop (its
   `type` + reason) via the same diagnostics hook — so a dropped malformed event
   is diagnosable. Observable: a reply with a dropped purchase produces a
   surfaced drop record naming `purchase` + the reason.
3. **No surfacing noise on the happy path.** An all-valid reply (`dropped`
   empty) and a healthy worker produce **no** diagnostics output. Observable:
   nothing emitted for a clean cycle.

**Design notes (settled here, for arch review):**
- **What MVP1 delivers on architecture.md Q1, stated honestly:** *page
  containment* (free — the Worker boundary) **+ diagnosability** (this slice).
  It does **NOT** deliver Q1's "**restart** just the failing chamber" — a single
  crashed chamber leaves analytics silently dead until reload, and restart is a
  larger multi-chamber concern (OQ9). This slice makes that state *observable*
  rather than silent; the reconciliation records Q1 as *partially* implemented,
  not done.
- **One diagnostics seam.** Both the per-descriptor drops (AC2) and the
  chamber-level error (AC1) route through a single, injectable surfacing point (a
  hook defaulting to `console`, warn for a drop vs error for a crash — severity
  differentiated within one seam), so the future OQ7 inspector has one place to
  attach.

**DoD:**
- [ ] All ACs pass; full suite green (`npm test`).
- [ ] A test simulates (a) a worker `error` event → **surfaced record via the
      hook**, and (b) a reply with `dropped[]` → surfaced drop; each shown to
      fail if the surfacing is removed — the mutation test hangs on the
      **surfaced-record** assertion, NOT on "no unhandled main-thread throw"
      (which is trivially true via the Worker boundary). Restore via Edit, never
      `git checkout --`.
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `architecture.md` Q1 reconciled **honestly**: MVP1 delivers page
      containment (free, Worker boundary) + diagnosability of drops/crashes; it
      does **NOT** deliver Q1's "restart the failing chamber" verb — that stays
      deferred (OQ9). Do not imply Q1 is fully implemented.

**Anti-horizontal-phasing check:** After this slice, a chamber failure is no
longer silent — a per-event throw drops just the event and is reported (09-01 +
this slice), and a chamber-level crash is surfaced rather than swallowed — so an
operator can *see* a failing chamber (the precondition for the OQ9 restart work),
instead of analytics silently going dark.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation._
