---
status: DRAFT
dependencies: [009-01]
last_verified:
arch_review: true
frame_review: true
---

## Slice 009-02 — chamber-crash backstop + drop observability

**Goal:** Close the two remaining halves of the isolation guarantee that sit on
the **orchestrator**: (a) a `worker.onerror` backstop so a chamber-level error —
one that escapes 09-01's per-descriptor guard — is **surfaced, not swallowed**,
and the page is unaffected; and (b) surface the `dropped[]` descriptors 09-01
reports, so a dropped malformed event is **diagnosable** (spec.md A2), not
silent.

**DoR:**
- ✅ 009-01 DONE — the chamber returns `{ ready, dropped }` and survives a
  per-descriptor throw.

**Acceptance Criteria:**

1. **A chamber-level error is surfaced, page unaffected.** [airlock.js](../../../core/airlock.js)
   registers `worker.onerror`. When the worker emits an `error` event (a failure
   that is NOT a caught per-descriptor throw — e.g. a worker-module load error or
   an internal bug), the orchestrator surfaces it (a diagnostics hook /
   `console.error`) and the **main-thread path keeps working** — the page does
   not break and the orchestrator can still accept `push()`es. Observable: a
   simulated worker `error` event does not throw unhandled on the main thread;
   the surfaced error is observable via the hook.
2. **Dropped descriptors are surfaced from the reply.** On a reply carrying a
   non-empty `dropped[]` (from 09-01), the orchestrator surfaces each drop (its
   `type` + reason) via the same diagnostics hook / a `console.warn` — so a
   dropped malformed event is diagnosable. Observable: a reply with a dropped
   purchase produces a surfaced drop record naming `purchase` + the reason.
3. **No surfacing noise on the happy path.** An all-valid reply (`dropped`
   empty) and a healthy worker produce **no** error/warn output. Observable: no
   diagnostics emitted for a clean cycle.

**Design notes (settled here, for arch review):**
- **MVP1 backstop = surface + page-unaffected, not auto-restart.** Recreating
  the Worker on `onerror` (full "restart the failing chamber") is a larger,
  multi-chamber concern (OQ9) — MVP1 has one first-party chamber, so the
  load-bearing guarantee is *the page is unaffected and the failure is
  diagnosable*. Chamber **restart** is explicitly deferred (noted in the
  reconciliation sweep / OQ9), not silently skipped.
- **One diagnostics seam.** Both the per-descriptor drops (AC2) and the
  chamber-level error (AC1) route through a single, injectable surfacing point
  (a hook defaulting to `console`), so the future OQ7 inspector has one place to
  attach.

**DoD:**
- [ ] All ACs pass; full suite green (`npm test`).
- [ ] A test simulates (a) a worker `error` event → surfaced + no unhandled
      main-thread throw, and (b) a reply with `dropped[]` → surfaced drop;
      shown to fail if the `onerror`/drop-surfacing is removed (mutation-tested;
      restore via Edit, never `git checkout --`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `architecture.md` Q1 reconciled: the chamber-isolation guarantee is now
      implemented for the single-chamber case; multi-chamber restart tracked to
      OQ9.

**Anti-horizontal-phasing check:** After this slice, the full ADR-0001 isolation
guarantee holds for MVP1's single chamber — a per-event throw drops just the
event (09-01), a chamber-level failure is contained and surfaced (this slice),
and both are diagnosable — so `architecture.md` Q1 is implemented, not just
stated.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation._
