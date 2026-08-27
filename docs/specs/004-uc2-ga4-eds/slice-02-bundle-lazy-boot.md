---
status: DRAFT
dependencies: [004-01]
last_verified:
# arch_review: true  # touches the push() public contract — set at READY if the
#                    # reconciliation changes the pinned push-api.md surface.
---

## Slice 004-02 — bundle + lazy-phase boot + `push()` contract

**Goal:** the airlock GA4 runtime, **bundled into one module** (esbuild) and booted
in `scripts.js#loadLazy` (AD-8: analytics is lazy), runs on the real testbed page
after `body.appear`, and a `push({ event, ...params })` call in the **pinned
contract shape** flows an event through to the worker.

**DoR:**
- ✅ 004-01 done (worker runs under the EDS CSP, or its accommodation is applied).

**Acceptance Criteria:**

1. **Bundled.** A build step (esbuild) emits a single-file runtime bundle from
   `core/` + `connectors/ga4/` (no multi-module load chain); the worker chunk is
   emitted such that `new Worker` resolves it under the 004-01 CSP verdict.
2. **Lazy-phase boot.** The runtime is initialized from `loadLazy` (after `appear`),
   not eager — verified by ordering against the `window.__flicker` marks
   (`body:appear` precedes runtime init).
3. **`push()` reconciled to the contract.** The public write surface accepts
   `push({ event: "name", ...params })` (pinned [push-api.md](../../../contracts/push-api.md)),
   synchronous, O(1), folding the projection so a synchronous `getState()` after a
   push reflects it (AD-3). The spike's `{ type, params }` shape is migrated or
   adapted; the golden `mapToMp` still receives `{ type, params }` internally.
4. **Event reaches the worker.** A `push` on the real page results in a cycle to the
   worker (observable via the returned mapped request or a per-stage counter).

**DoD:**
- [ ] ACs 1–4 pass; unit tests cover the `push()` contract-shape adaptation
      (event-name key → internal type; params pass-through) and its synchronous
      read-after-push (AD-3).
- [ ] Each new test shown capable of failing.
- [ ] Reviewed by `reviewer` subagent; implementation review passed.
- [ ] Deviation log + reconciliation sweep; refinement-todo updated if the push
      reconciliation surfaces a contract question (coupled to OQ3/OQ11).

**Anti-horizontal-phasing check:** after this slice, a developer can call the
drop-in `push({ event, ... })` on a real EDS page and the event is captured and
cycled off-thread, bundled and lazy-loaded — the real capture path, end to end
minus identity + egress (the next two slices).
