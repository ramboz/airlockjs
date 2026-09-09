---
status: DRAFT
dependencies: [040-02, 039-01]
last_verified:
frame_review: true
---

## Slice 040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)

**Goal:** Provide GA4's `coalesce` strategy for the 040-02 core seam — the first real adapter: when a lock-through cycle
carries ≥2 same-stream GA4 `/g/collect` requests, merge them into one **POST** with the shared/context params on the
query string and one `en=…` line per event in the body, exactly as the container's own `gtag.js` batches (observed
live 2026-09-08, spec 039). A single-event cycle keeps 039-01's GET. This is spec 039's deferred 039-04, now landing on
the core seam instead of inside the connector.

**Blocked-on:** 040-02 (the core seam + hook). Which is itself blocked on 040-01 GO.

**DoR:**
- ✅ 040-02 done — the core coalescing seam + the per-connector `coalesce(requests) -> EgressRequest[]` hook exist.
- ✅ 039-01 done — the single-event GA4 `/g/collect` GET beacon + field mapping exist.
- ✅ The batched-POST wire shape is live-observed (spec 039, 2026-09-08): one POST, shared params on the query string,
  `en=…&_ee=1[&_et=…]` per line in the body.

**Acceptance Criteria:**

1. **GA4 `coalesce` strategy.** Given ≥2 same-`tid` GA4 requests in one group, produce ONE `{ url, method: "POST", body }`
   where `url` carries the shared/context params (`v`/`tid`/`cid`/`sid`/session-state/`gcs`/`gcd`/…) once and `body`
   carries one `en=…` line per event (`\r\n`-separated, cycle order) — matching the observed container batch shape.
2. **Same-`tid` keying (Open Question #3).** Only same-measurement-id requests coalesce; different `tid`s never merge
   (finer than 040-02's endpoint key — GA4 needs it).
3. **Single-event unchanged.** A one-event cycle still emits the 039-01 GET (no POST, no behavior change).
4. **Shared-vs-per-event partition matches the capture.** Context/session/consent params ride the query string once;
   per-event params (`en`, `ep.`/`epn.`, `_et`, `_ee`) ride the body per line — asserted against a redacted batched-POST
   fixture / the observed shape.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a 2-event same-`tid` cycle → one POST, 2 body lines; a 1-event cycle → still GET; a mixed-`tid` cycle →
      no cross-`tid` merge; the query-vs-body partition.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced; the DEFERRED 039-04 slice is struck through with a pointer here.

## Assumptions

- **The batched-POST shape is live-observed, not inferred** (spec 039, `captures/observed-rules.md`): one POST, body
  `en=page_view&_ee=1\r\nen=<event2>&_ee=1&_et=…`. The exact per-event `_ee`/`_et` semantics under batching are carried
  as observed; a payload ceiling forcing a split is an ADR-0021 open question (its own later slice). (Why
  `frame_review: true`.)

## Anti-horizontal-phasing check

After this slice a burst of same-stream GA4 events on a rewired page reaches `/g/collect` as the one batched POST the
container's own tag would send — the request-count parity-with-cadence 039-04 sized, now on the shared core seam so the
next vendor's adapter is a small addition rather than a fork.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
