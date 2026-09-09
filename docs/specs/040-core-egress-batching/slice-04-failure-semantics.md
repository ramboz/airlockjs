---
status: DONE
dependencies: [040-02]
last_verified: 2026-09-09
frame_review: true
---

## Slice 040-04 — coalesced-dispatch failure semantics + observability

**Goal:** Define and implement what happens when an egress dispatch FAILS, motivated by coalescing's concentrated
blast-radius (one failed coalesced POST loses N events, not 1). Resolves ADR-0021 open question #1 (retry/failure
semantics for a merged request).

**Blocked-on:** 040-02 (the seam that introduced the concentrated-loss blast-radius). Landed + DONE.

## Current state (grounded)

- The steady-state dispatch is best-effort keepalive with **no retry and no failure surfacing for ANY beacon**:
  `core/airlock.js` worker.onmessage does `fetch(r.url, fetchInit(...)).then(() => { dispatched++; }, () => { dispatched++; })`
  — the rejection handler does the SAME `dispatched++` as success, so a failed fetch is counted as dispatched and
  otherwise **swallowed** (no `diagnose`). This is true for the default single-beacon path (~`:344-345`) and the
  coalesced POST path (~`:372-373`) alike.
- Coalescing runs in `worker.onmessage` — the **steady-state idle-drain** path, NOT the synchronous `unloadFlush`
  (~`:436-447`, a separate path using `criticalDispatchGated` that never coalesces). So a dispatch rejection here CAN
  fire its handler (the page is alive), unlike an unload-time keepalive whose failure is genuinely unobservable.
- 040-02's "no event loss" AC is about **coalescing not dropping events into the void** (every survivor makes it into a
  batch), NOT about network delivery — delivery has always been best-effort for every beacon.

## The decision this slice settles (why `frame_review: true`)

**Load-bearing assumption:** the right hardening for a failed coalesced dispatch is **observability (surface the
failure) + an explicit no-retry policy**, NOT per-request retry/split-and-retry. Rationale to be tested by the
frame-critique:
- Retrying analytics beacons is not the runtime's contract for any other beacon; adding retry to coalesced-only
  requests makes them behave differently from every other egress, and a retry after a partially-succeeded POST risks
  **duplicate ingestion** (GA4 may have received the batch; the failure was on the response leg).
- Keepalive `fetch` is best-effort by design; the honest fix for the blast-radius increase is to make the loss
  **visible** (a perf optimization must not make failures MORE invisible than they already are), and to keep any single
  failure's blast-radius bounded (the 040-05 payload ceiling already bounds batch size by bytes — see AC3).

**Acceptance Criteria:**

1. **Egress failures are surfaced (close the swallowed-failure gap).** On a dispatch `fetch` **rejection**, emit a
   `diagnose({ level: "warn", kind: "egress-failure", destination, method })` via the existing 009-02 sink — additive:
   `dispatched++` still happens (a delivery WAS attempted). Scoped generically to the dispatch (single + coalesced),
   because scoping to coalesced-only is arbitrary and the swallowed-failure gap is real for all — a coalesced POST
   failure is simply its highest-stakes instance. A test proves a rejecting `fetch` now emits the diagnostic where it
   previously emitted nothing.
2. **No retry — documented policy.** A failed dispatch (coalesced or not) is NOT retried and NOT split-and-retried; the
   best-effort keepalive contract is preserved for every beacon. This slice records that as the chosen policy (with the
   duplicate-ingestion + consistency rationale), closing ADR-0021 OQ#1 as "accept the loss, surface it" rather than
   leaving it open. No code implements retry.
3. **Size visibility for a coalesced POST — byte-length, with precise event-count deferred (frame-critique
   resolution).** The failure diagnostic carries the POST body's **byte length** (generic — no body-structure
   assumption in core) plus `method`, so an operator sees that a *sized* batched egress failed, not just "something
   failed." **This slice does NOT surface a precise event-count**, and its motivation is calibrated accordingly: it
   closes the swallowed-failure gap and shows the loss's *size*, not its exact event tally. A precise per-POST
   event-count would need an optional `EgressRequest` metadata hint the coalesce hook sets (a `contracts/connector.d.ts`
   addition 040-02 deliberately avoided), and — critically — it only becomes well-defined once **040-05's splitting**
   exists (a group becomes multiple POSTs, each with its own count). So precise event-count observability is **deferred
   to be designed with 040-05** (or a small follow-up on its contract hint), not forced here. Byte-length is an honest
   proxy an operator can read (for GA4, ~one `\r\n` line per event), and it ships with no contract change.

**DoD:**
- [x] All ACs pass; full suite green (91 files / 1409 tests).
- [x] Coverage: a rejecting single-beacon GET emits the `egress-failure` diagnostic (was silent, no `bytes`); a
      rejecting coalesced POST emits it with the body byte-length; an empty-string POST body reports `bytes: 0`; a GET
      carrying a stray body reports NO `bytes` (method-keyed guard); `destination` is origin+path only (no query leak);
      `dispatched` is still incremented on failure (no regression); the no-retry policy is asserted (exactly ONE fetch
      call, no second attempt).
- [x] Each new-feature test shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` (compliance + craft — both PASS).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Observability + no-retry is the right hardening (the frame's load-bearing bet).** See "The decision this slice
  settles" — retry risks duplicate ingestion and breaks the uniform best-effort contract; the honest hardening is to
  make the (already-tolerated) loss visible. If the frame-critique finds the blast-radius severe enough to warrant a
  count cap or retry, re-frame here.
- **A steady-state dispatch rejection is observable** — coalescing runs on the idle-drain `worker.onmessage` path, not
  the unload path, so the `.then(_, err)` rejection handler fires while the page is alive (grounded: `core/airlock.js`
  dispatch vs. the separate synchronous `unloadFlush`). A failure diagnostic is therefore feasible; this slice does not
  attempt to surface unload-time keepalive failures (genuinely unobservable).
- **No separate max-events-per-batch count cap — and NOT because bytes bound count.** A count cap is considered and
  declined, but the earlier "byte ceiling transitively bounds event count" reasoning was imprecise (frame-critique
  correction): a byte ceiling does NOT bound event count — many small events fit under it. The count cap is declined
  because, given the no-retry + accept-the-loss-with-observability policy, a second bounding knob does not change the
  outcome (the events still egress or are visibly lost); 040-05's byte ceiling caps each POST's SIZE (the
  delivery-risk dimension — "will the server reject this POST"), which is the property that actually matters. Event-count
  blast-radius is made VISIBLE (deferred precise count per AC3), not capped.

## Anti-horizontal-phasing check

After this slice, an operator watching the 009-02 diagnostics sink SEES a failed egress (single or batched) that was
previously swallowed — a user-facing observability behavior on the real dispatch path, not an internal-only change. The
no-retry policy is a documented, tested contract, not silent.

### Deviation log (after reconciliation)

Implemented in `core/airlock.js` (a shared `dispatch(req)` closure + a module-level `EGRESS_TEXT_ENCODER`) +
`test/egress-coalescing.test.js` (7 new tests). No contract change; no other file's behavior altered. Deviations and
review-driven fold-ins:

1. **The `setConsent` held-beacon flush was NOT covered — deliberate, tracked scope boundary (both reviewers).** A third
   steady-state dispatch site (`core/airlock.js` ~`:604`, the held→flushed path) still swallows fetch failures. Both
   compliance and craft ruled this **AC1-compliant as written** (AC1 scoped to "single + coalesced", i.e. the two
   `worker.onmessage` sites; the flush never coalesces; the `dispatch` closure is local to `worker.onmessage` so
   covering it needs hoisting) but a real residual against the slice's "close the swallowed-failure gap" goal. Recorded
   as a named follow-up in `docs/refinement-todo.md` (Spec 040-04 follow-up), not left silent.
2. **`bytes` guard keyed off METHOD, not body-presence (craft + compliance nit; folded).** The initial guard was
   `req.body != null`; a GET carrying a stray body would report `bytes` for a payload `fetchInit` never sends. Changed
   to `req.method !== "GET" && req.body != null` to match the "POST-only" comment and `fetchInit`'s own GET/POST
   asymmetry; a test pins that a GET-with-stray-body reports no `bytes`.
3. **Per-failure `new TextEncoder()` hoisted to a module-level `EGRESS_TEXT_ENCODER` (craft nit; folded).**
   `TextEncoder.encode()` is stateless, so one shared instance is safe.
4. **Added an empty-string-body test (`bytes: 0`, craft optional-coverage note; folded).**
5. **ADR-0021 OQ#1 closed (compliance requirement for AC2).** AC2 promised to "close ADR-0021 OQ#1", but the ADR still
   listed it open. ADR-0021's Open questions now strikes OQ#1 as **RESOLVED by 040-04** ("accept the loss, surface it",
   with the duplicate-ingestion/uniform-contract rationale). OQ#3 (coalescing-key precision) was also struck as resolved
   by 040-03; OQ#2 (payload ceiling) remains, owned by 040-05.

**No deviation from:** the two ACs' substance (surface failures additively; no retry; byte-length-only, no contract
change), the origin+path-only destination (privacy), or the no-retry policy.

### Reconciliation sweep

- **ADR-0021** amended: OQ#1 (retry/failure) struck RESOLVED → 040-04; OQ#3 (key precision) struck RESOLVED → 040-03;
  OQ#2 (payload ceiling) left open → 040-05.
- **`docs/refinement-todo.md`:** added the Spec 040-04 follow-up (the `setConsent` flush-site failure-observability
  parity, with the hoist-`dispatch` resolution trigger).
- **`docs/inbox.md`:** nothing new to park — the flush-site residual is captured in refinement-todo above.
- **Deferred / carried forward:** precise per-POST event-count in the failure diagnostic (AC3) — deferred to be designed
  with 040-05's splitting (where per-POST counts arise) via an optional `EgressRequest` hint, or a small follow-up; the
  byte-length floor ships now.
- **Full suite:** 91 files / 1409 tests green.
