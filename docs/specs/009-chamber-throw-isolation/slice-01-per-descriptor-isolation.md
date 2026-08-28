---
status: RECONCILED
dependencies: [adr-0001]
last_verified: 2026-08-27
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
---

## Slice 009-01 — per-descriptor isolation in the chamber

**Goal:** Make a throwing `mapToMp` on one descriptor drop **only that
descriptor** — the rest of the batch still maps and is handed back to the
orchestrator, and the chamber keeps handling subsequent cycles. Closes the
core failure the 008 review found: one malformed event silently losing a whole
batch of unrelated good events.

**DoR:**
- ✅ ADR-0001 (chamber isolation) accepted — the guarantee under implementation.
- ✅ Spec 008 DONE — `mapToMp` throws on a contract-invalid `purchase` (the
  reachable throw this isolates).

**Acceptance Criteria:**

1. **A throwing descriptor drops only itself; the batch survives.** For a batch
   `[page_view, <bad purchase>, page_view]` (the bad purchase makes `mapToMp`
   throw), the chamber's returned `ready[]` contains the requests for **both**
   `page_view` descriptors (× `cfg.trackers`) and **none** for the purchase.
   Observable: `ready.length === 2 * trackers`, no purchase request present.
2. **The dropped descriptor is recorded, not vanished** (feeds 09-02). The
   chamber's reply carries a `dropped[]` naming the dropped descriptor (its
   `type` and the thrown error's message). Observable: `dropped` has one entry
   for the purchase with a reason containing e.g. `transaction_id`.
3. **The chamber survives — subsequent cycles still map.** After a batch that
   contained a throwing descriptor, a following `events` message with an
   all-valid batch maps normally (the `onmessage` handler did not die on the
   throw). Observable: the second batch's `ready[]` is complete.
4. **No change for an all-valid batch (regression guard).** An all-valid batch
   produces the same `ready[]` as before this slice, with `dropped` empty.
   Observable: byte-identical `ready` payloads; `dropped.length === 0`.

**Design notes (settled here, for arch review):**
- **Granularity = per descriptor, not per `(descriptor, tracker)`.** `mapToMp`'s
  result depends on `event + ctx`, not the tracker (spec.md A1), so a throw on a
  descriptor recurs for every tracker — catch **around the descriptor** (drop the
  event for all its trackers), not inside the tracker loop.
- **Message-protocol change is additive.** The reply goes from `{ ready }` to
  `{ ready, dropped }`. `airlock.js`'s `onmessage` reads `e.data.ready` and is
  unaffected; it starts consuming `dropped` in 09-02, so this slice does not
  touch the orchestrator's behavior.
- **Contain, don't repair.** A dropped descriptor is dropped — no defaulting or
  retry (consistent with 008's "reject, don't repair").
- **Make the handler testable (009-01 frame-critique).** `chamber.worker.js` is
  a side-effecting `self.onmessage = …` module and vitest runs in the Node env
  (no `self`/`postMessage`), so it is not importable as-is and has **no existing
  test**. Extract the batch mapping into an **exported pure function** — e.g.
  `mapBatch(batch, cfg) → { ready, dropped }` — that the tests call directly, and
  have `self.onmessage` delegate to it. This is the mechanism for AC1–AC4's
  assertions; do not test via a full real Worker.

**DoD:**
- [x] All ACs pass; full suite green (`npm test` — 131 tests, incl. the 4 new
      `chamber-isolation.test.js` covering the extracted `mapBatch`).
- [x] A test exercises a mixed batch (good/throwing/good) via `mapBatch` and
      asserts the partial `ready` + the `dropped` entry + chamber-survives-next-
      cycle; mutation-tested (removing the try/catch fails 3/4), restored via Edit.
- [x] Reviewed by `reviewer` subagent — compliance + craft + arch, all pass;
      nits folded (index, defensive reason).
- [x] Deviation log + reconciliation sweep produced under this slice heading.

**Anti-horizontal-phasing check:** After this slice, a malformed event in a
real cycle no longer takes down the batch — the airlock's core isolation
promise holds for the common (per-event) failure, observable end-to-end via the
partial `ready` a mixed batch produces.

### Deviation log (after reconciliation)

1. **Extracted a pure exported `mapBatch(batch, cfg) → { ready, dropped }`**
   from `chamber.worker.js`'s `onmessage` loop; per-descriptor try/catch (drop
   the descriptor for all its trackers, record it, continue). `self.onmessage`
   delegates to it and posts `{ ready, dropped }` (additive — `airlock.js` reads
   only `e.data.ready`). `mapToMp`/`airlock.js`/`oracle.sh`/`contracts` untouched.
2. **`typeof self !== "undefined"` guard around the `onmessage` wiring**
   (009-01 frame-critique testability fix). `chamber.worker.js` had no test
   because the side-effecting module wasn't importable in Node/vitest; the guard
   makes `mapBatch` importable while leaving real-Worker behavior unchanged
   (`self` exists there, so `onmessage` is still wired).
3. **Post-review nits folded (craft/arch):** `dropped` entries now carry an
   `index` (disambiguates two same-`type` drops in one batch — helps 09-02); the
   `reason` is defensive against a non-`Error` throw (`err && err.message != null
   ? err.message : String(err)`) so a drop is never vanished (A2). **Noted, not
   fixed:** the `mapBatch` param `cfg` shadows the module-level `let cfg` —
   harmless (the param wins in the pure function; the module `cfg` is used only
   in `onmessage`), left to avoid churn on the init path.
4. **Reconciliation notes (arch):** (a) the **unload/critical path**
   (`airlock.js` `unloadFlush` → `critical.dispatch`, `core/egress.js`) maps on
   the **main thread** and does **not** route through `mapBatch`, so a throwing
   descriptor in the unload window has undefined isolation on the critical path —
   recorded as **OQ16** ([refinement-todo](../../refinement-todo.md)). (b) The
   `{ ready, dropped }` reply is an internal data shape with no formal contract
   artifact; 09-02 decides whether the now-two-field reply warrants pinning. (c)
   AC4's test asserts structural fields rather than literal byte-identity —
   semantically adequate.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Internal runtime change; front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated at close-out (post-DONE). |
| `docs/product-vision.md` | `no-op` | No product-scope change. |
| `docs/architecture.md` | `no-op` | The Q1 chamber-isolation reconciliation is 09-02's (it owns the honest "page-containment free + diagnosability; restart deferred" wording); 09-01 alone changes no boundary/contract doc. |
| `oracle.sh` / `.servo/` | `no-op` | Untouched. |
| Primer surfaces | `no-op` | Spec 009 in flight (09-02 open); no close-out. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | **OQ16** added — unload/critical-path isolation (the seam `mapBatch` does not cover). |
| `docs/decisions/**` | `no-op` | No ADR-worthy decision; realizes ADR-0001 at the worker seam. |
| `docs/memory/**` | `no-op` | Nothing durable beyond the deviation log. |
