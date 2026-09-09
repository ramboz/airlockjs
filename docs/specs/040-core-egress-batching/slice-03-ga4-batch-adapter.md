---
status: IN_PROGRESS
dependencies: [040-02, 039-01]
last_verified:
frame_review: true
claimed_by: claude/spec-039-jigceremony-d53c78
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

1. **GA4 `coalesce` strategy — parse the built GET URLs, then SYNTHESIZE gtag's batch POST (not a pure re-partition).**
   Given ≥2 requests in one same-context group (AC2), produce ONE `{ url, method: "POST", body }`: `url` carries the
   SHARED params (`v`/`tid`/`cid`/`sid`/session-state/`dl`/`dr`/`dt`/`gcs`/`gcd`) once; `body` carries one line per event
   (`\r\n`-separated, cycle order), each line the event's PER-EVENT params — `en`, `ep.*`, `epn.*`, the **relocated**
   `_et` (see AC4: the single-GET emitter puts `_et` on the query, but it is semantically per-event and moves to the body
   line), and the **injected** `_ee` batch marker (absent from single GETs; reproduced per gtag's observed batch
   convention) — matching the observed 2026-09-08 batch shape byte-for-byte (redacted fixture). This is a deliberate
   wire-format SYNTHESIS driven by parsing the GETs + gtag's batch convention, NOT a mechanical move of query params into
   the body.
2. **Coalesce only requests that share the ENTIRE shared-context param set — `tid` first, but NOT `tid` alone (OQ#3 +
   039-04's cross-page `dl` risk).** The shared/context params ride the query string ONCE, so two requests may merge only
   if EVERY shared param is identical: `tid` (measurement id — the primary differentiator; different `tid`s never merge),
   AND `cid`/`sid`/session-state (`sct`/`seg`/`_fv`/`_ss`/`_nsi`)/`dl`/`dr`/`dt`/`gcs`/`gcd`. This is deliberately finer
   than 040-02's origin+path endpoint key (all `/g/collect` requests share origin+path, so the core hands this hook ONE
   group) — AND finer than "same `tid`": 039-04's deferral explicitly flagged that a cross-page cycle (differing `dl`)
   merged under one shared query would **mis-attribute** the second event. Requests differing in any shared param form
   SEPARATE POSTs (or stay the 039-01 GET if alone in their context group).
3. **Single-event unchanged.** A one-event cycle still emits the 039-01 GET (no POST, no behavior change).
4. **Partition by a KNOWN param-key TAXONOMY, not by "which section of the single-GET it sat in" (frame-critique
   correction).** Classification is by a fixed key taxonomy over the closed set the 039-01 emitter can produce
   (`connectors/ga4/gtag.js:251-292`): PER-EVENT = {`en`, `ep.*`, `epn.*`, `_et`}; SHARED = {`v`, `tid`, `cid`, `sid`,
   session-state `sct`/`seg`/`_fv`/`_ss`/`_nsi`, `dl`, `dr`, `dt`, `gcs`, `gcd`}. Two subtleties the naive "re-partition
   the query" model got wrong: **(a) `_et`** is emitted by the single GET on the QUERY string (default `100`,
   `gtag.js:286-288`) but is semantically PER-EVENT — it must be RELOCATED to each body line, NOT stamped once on the
   shared query; **(b) `_ee`** is NEVER emitted by a single GET — it is a batch marker that must be INJECTED per line,
   reproducing gtag's observed convention (synthesis, not re-partition). Asserted against a new redacted batched-POST
   fixture of the observed shape.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] A NEW redacted fixture encodes the SYNTHESIZED batch shape (shared params on the query; per-line `en`/per-event
      params + injected `_ee=1` + per-event relocated `_et`); the coalesce output is asserted byte-for-byte against it.
      NOTE: this is a **code-matches-spec-structure** assertion (the fixture is airlock's synthesized shape, not the raw
      R5-local observed capture) — it does NOT close the GA4-accepts-our-shape fidelity residual; only the deferred
      live-accept DebugView re-check does.
- [ ] Coverage: a 2-event same-context cycle → one POST, 2 body lines; a 1-event cycle → still the 039-01 GET; a
      mixed-`tid` cycle AND a mixed-`dl` (same-`tid`, different page) cycle → NO merge (separate POSTs/GETs); the
      query-vs-body partition; **`_et` lands per-line (not once on the shared query)**; **`_ee=1` is injected per line**.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced; the DEFERRED 039-04 slice is struck through with a pointer here.
- [ ] The n=1 batch-marker residual + the deferred live-accept re-validation are recorded (assumptions above + a
      `docs/refinement-todo.md` entry).

## Assumptions

- **The batched-POST shape is live-observed, not inferred** (spec 039; the committed grounding is the observed rule
  documented at `docs/specs/039-ga4-gtag-connector/slice-04-batched-post-transport.md:27-28` from the 2026-09-08 capture
  — raw captures are R5 local-only per ADR-0018/ADR-0020, so the committed evidence is that behavioral rule plus a
  redacted fixture this slice adds): one POST, body `en=page_view&_ee=1\r\nen=<event2>&_ee=1&_et=…`, shared/context
  params on the query string. The exact per-event `_ee`/`_et` semantics under batching are carried as observed; a
  payload ceiling forcing a split is an ADR-0021 open question (its own later slice). (Why `frame_review: true`.)
- **The hook parses built GET URLs + SYNTHESIZES gtag's batch body — two separable operations (frame-critique
  correction).** The 040-02 seam hands `coalesce` a group of built `{ url, method: "GET" }` beacons (not events), so the
  GA4 strategy (1) PARSES each URL's query, (2) uses a fixed key TAXONOMY (AC4) to sort params into shared vs per-event,
  and (3) emits gtag's batch POST. **(2) is genuinely key-derivable** over the closed 039-01 key set
  (`connectors/ga4/gtag.js:251-292`) — this survives. **(3) is NOT a pure re-partition**: `_et` is relocated from the
  query to per-event body lines, and `_ee` is INJECTED (it is in no single GET). Conflating (2) and (3) — the original
  frame's error — makes AC4 unsatisfiable, because `_et` sits on the single-GET query yet must land per-line and `_ee`
  has nothing to "classify."
- **The batch-body marker semantics (`_ee=1` per line; `_et` per-event) are grounded on a SINGLE capture (n=1) — a
  tracked residual, not a silent assumption.** The 2026-09-08 observation
  (`docs/specs/039-ga4-gtag-connector/slice-04-batched-post-transport.md:28`) is the only batch sample:
  `en=page_view&_ee=1\r\nen=<e2>&_ee=1&_et=1`. We reproduce that observed **structure** (shared params on the query;
  per-line `en` + per-event params + injected `_ee=1`; per-event `_et` on the body line) because it is gtag's OWN
  traffic, which GA4 demonstrably accepted — faithful reproduction of an observed-accepted structure is the best
  available grounding and is NOT the "invent an untested wire form → silent event loss" failure spec 040 forbids
  (`docs/specs/040-core-egress-batching/spec.md`). It is **not a byte-verbatim copy of the one capture**, and knowingly
  diverges in the `_et` VALUE dimension: the sole observation carried `_et` on line 2 ONLY (value `1`), whereas airlock —
  which has no per-event engagement-time source — carries each event's own `_et` per line (its existing single-GET
  model, default `100`, `gtag.js:287`). The residuals we cannot close from n=1 — whether `_ee` is ever conditional (as
  `_ss`/`_fv` are on a session continuation, `gtag.js:207-209`), whether `_et`'s line-1 absence / value matters to GA4
  ingest — are recorded as **known limitations**, and the proper closing validation is a **live-accept re-check** (a
  synthesized 2-event POST that GA4 DebugView confirms ingests as 2 events).
  That re-check is DEFERRED: it egresses fabricated events to a live GA4 property and so needs a GA4 test property WE
  control (never Intuit's stage property) — tracked as a follow-up, not done in this slice.
- **Session-state is one per-cycle snapshot (a 039-03 property), so it never blocks a merge but is a known value
  simplification.** A real gtag batch may vary `_ss`/`_fv`/`seg` per hit within one flush; airlock threads ONE
  `ctx.sessionState` snapshot per cycle (039-03), so all a cycle's built GET URLs carry identical session-state and AC2
  merges them. This is airlock's existing model, not a new divergence introduced here; noted so the batch's fixed shared
  session-state is understood as intended, not a bug.

## Anti-horizontal-phasing check

After this slice a burst of same-stream GA4 events on a rewired page reaches `/g/collect` as the one batched POST the
container's own tag would send — the request-count parity-with-cadence 039-04 sized, now on the shared core seam so the
next vendor's adapter is a small addition rather than a fork.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
