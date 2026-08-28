---
status: DRAFT
dependencies: [adr-0001]
last_verified:
arch_review: true
frame_review: true
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
- [ ] All ACs pass; full suite green (`npm test`). *(The worker `onmessage`
      handler is currently untested — only `mapToMp` and the egress fast path
      are — so "no regression" here means the extracted `mapBatch` is newly
      covered and nothing else breaks, not that pre-existing worker tests stay
      green.)*
- [ ] A test exercises a mixed batch (good/throwing/good) via the extracted
      `mapBatch` and asserts the partial `ready` + the `dropped` entry +
      chamber-survives-next-cycle; shown to fail if the try/catch is removed
      (mutation-tested; restore via Edit, never `git checkout --`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.

**Anti-horizontal-phasing check:** After this slice, a malformed event in a
real cycle no longer takes down the batch — the airlock's core isolation
promise holds for the common (per-event) failure, observable end-to-end via the
partial `ready` a mixed batch produces.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation._
