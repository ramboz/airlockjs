---
status: DONE
dependencies: [009-01]
last_verified: 2026-08-27
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
- [x] All ACs pass; full suite green (`npm test` — 139 tests, incl. the 8 new
      `chamber-observability.test.js`).
- [x] A test simulates (a) a worker `error` event → **surfaced record via the
      hook**, and (b) a reply with `dropped[]` → surfaced drop; each shown to
      fail if the surfacing is removed — the mutation removing the drop-loop + the
      onerror `diagnose` call produced **6 failures**, all on the
      **surfaced-record** call-count assertions (no assertion concerns "no
      unhandled throw"). Restored via Edit; re-verified 139/139.
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch, all pass; 2
      nits folded — field-omission negative assertion + a seam-comment reword).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `architecture.md` Q1 reconciled **honestly**: MVP1 delivers page
      containment (free, Worker boundary) + diagnosability of drops/crashes; it
      does **NOT** deliver Q1's "restart the failing chamber" verb — that stays
      deferred (OQ9). Q1 recorded as *partially* implemented, restart deferred.

**Anti-horizontal-phasing check:** After this slice, a chamber failure is no
longer silent — a per-event throw drops just the event and is reported (09-01 +
this slice), and a chamber-level crash is surfaced rather than swallowed — so an
operator can *see* a failing chamber (the precondition for the OQ9 restart work),
instead of analytics silently going dark.

### Deviation log (after reconciliation)

1. **One injectable diagnostics seam added to `createAirlock`.** A new optional
   `onDiagnostic` param (defaulting to a `consoleDiagnostic` that maps
   `level:"error"→console.error`, else `console.warn`) is the single sink for
   both AC1 and AC2 — no call site hard-codes `console`. This is the OQ7-inspector
   attach point (one place, severity differentiated within the record).
2. **AC2 (drops) — `worker.onmessage` extended additively.** The existing
   `ready`-dispatch loop is unchanged; after it, a non-empty `e.data.dropped`
   surfaces one `{ level:"warn", kind:"dropped", type, reason, index }` per drop.
   `index` is carried through from 009-01 (disambiguates two same-`type` drops) —
   extra vs. the AC's "type + reason" wording, kept as useful, not noise.
3. **AC1 (crash) — `worker.onerror` registered.** Surfaces
   `{ level:"error", kind:"chamber-error", message, filename?, lineno? }`.
   Fields degrade gracefully: `message` falls back to `String(err)`, and
   `filename`/`lineno` use spread-conditionals so a partial `ErrorEvent` yields a
   `{level,kind,message}`-minimum record, never an empty one. The comment states
   honestly that the Worker boundary — not this handler — keeps the page alive;
   the handler makes the failure *observed*.
4. **Post-review nits folded (craft):** the degradation test now also asserts the
   omitted fields are **absent** (`not.toHaveProperty("filename"/"lineno")`),
   locking the spread's omission behavior; the seam comment was reworded from a
   garbled phrase to a clean single-sink statement.
5. **Scope held (arch):** no chamber-restart logic (OQ9 deferred);
   `core/chamber.worker.js` / `connectors/` / `contracts/` / `oracle.sh`
   untouched; `ready`-dispatch behavior byte-unchanged.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Internal runtime change; front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated at close-out (post-DONE). |
| `docs/product-vision.md` | `no-op` | No product-scope change; the fault-isolation thesis is unchanged (this makes its failure *observable*). |
| `docs/architecture.md` | `updated` | **Q1 reconciled honestly** (`:123`): page-containment free (Worker boundary) + drop delivered (009-01) + now diagnosable (009-02); **restart NOT delivered**, deferred OQ9. `:61` connector-interface note updated — OQ14 **resolved** (per-descriptor catch + diagnostics seam), with the OQ16 critical-path caveat. |
| `oracle.sh` / `.servo/` | `no-op` | Untouched. |
| Primer surfaces | `deferred` | Spec 009 now fully closed (both slices DONE); no primer entry existed for spec 009 to update. |
| `docs/inbox.md` | `no-op` | Nothing to park — OQ9 (restart) already tracked; OQ16 added by 009-01. |
| `docs/refinement-todo.md` | `no-op` | OQ14 already marked resolved-via-spec-009 (009-01); OQ9 (restart) + OQ16 (critical path) already present. |
| `docs/decisions/**` | `no-op` | Realizes ADR-0001 (chamber isolation) observability at the seam; no new decision. |
| `docs/memory/**` | `no-op` | Nothing durable beyond the deviation log. |
