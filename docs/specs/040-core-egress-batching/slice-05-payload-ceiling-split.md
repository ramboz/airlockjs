---
status: DRAFT
dependencies: [040-03]
last_verified:
frame_review: true
---

## Slice 040-05 — payload-ceiling split (per-adapter)

**Goal:** When a coalesced group would exceed a conservative ceiling in **either** dimension — total body **bytes** OR
**event count** — split the same-context group into **multiple** POSTs, each under both bounds — no event lost, none
duplicated. Resolves ADR-0021 open question #2 (payload ceiling). Per-adapter: implemented in the GA4 `coalesceGa4`
strategy (`connectors/ga4/coalesce.js`), which already returns `EgressRequest[]` — a split is a natural extension of that
shape; the 040-02 core seam needs no change.

**Blocked-on:** 040-03 (the GA4 adapter that builds the coalesced POST). Landed + DONE.

## Current state (grounded)

- `coalesceGa4` (`connectors/ga4/coalesce.js`) merges a same-context group of ≥2 GETs into **one** POST whose body is
  one `\r\n`-line per event — with NO size bound: a large enough burst produces an arbitrarily large single body.
- gtag uses POST for ≥2 events precisely because the multi-event payload would blow past practical **GET URL-length**
  limits (~2–8KB across browsers/proxies) — the switch to POST is itself the first size-driven behavior. A POST body
  has far more headroom but is not unbounded (servers/CDNs cap request bodies; GA4's own Measurement Protocol documents
  a ~130KB request-size limit for the MP endpoint — the closest DOCUMENTED GA4 byte reference, though `/g/collect`'s
  internal limit is not published).
- GA4's Measurement Protocol ALSO documents a per-request **event-count** cap (~25 events/request) — a DISTINCT
  rejection dimension, and for realistic bursts often the BINDING one: many small events stay under any byte ceiling yet
  exceed a count cap. Neither `/g/collect` limit (bytes or count) is published, so both are unobserved — a byte-only
  split would rarely fire for exactly the many-small-events burst this slice exists to keep safe.

## The decision this slice settles (why `frame_review: true`)

**Load-bearing assumption:** a **conservative, documented, self-imposed** byte ceiling is a defensible safety bound even
though gtag's actual `/g/collect` internal ceiling is UNOBSERVED (we never captured a gtag-emitted split). The
frame-critique should test: is a self-imposed ceiling honest (vs. claiming to reproduce gtag), is the chosen value
defensible (well under the documented MP ~130KB and far above any realistic single-cycle burst so it rarely triggers),
and is the split lossless?

**Acceptance Criteria:**

1. **Lossless split at the ceiling (bytes OR count).** When a same-context group would exceed EITHER the byte ceiling
   (combined body size) OR the event-count ceiling, `coalesceGa4` emits **multiple** `{ url, method: "POST", body }` —
   each under BOTH bounds (the sole exception is AC4's unsplittable single event, whose own line already exceeds the
   byte ceiling and is emitted alone — a single event cannot be split), each carrying the SAME shared query params
   (repeated per split POST — including the session-start flags `_ss`/`_fv`, see the fidelity note in Assumptions), and
   **every event in exactly one** split POST, **in cycle order** (no event dropped, none duplicated, and — critically —
   no later event backfilled into an already-closed earlier POST once an unsplittable-single-event POST was emitted
   mid-group). A test reconstructs the full event set from the split POSTs and asserts it equals the input in order.
2. **Conservative, documented ceilings (both dimensions).** TWO named constants with doc comments stating they are
   self-imposed safety bounds (NOT observed gtag limits): a BYTE ceiling chosen well under GA4's documented ~130KB MP
   request limit, and an EVENT-COUNT ceiling at/under GA4's documented ~25-events/request MP cap. Both are backstops
   (far above a realistic single-cycle burst), not routine paths; `/g/collect`'s real limits are unobserved in both
   dimensions. The values + rationale live in `connectors/ga4/coalesce.js`.
3. **Under-ceiling unchanged (040-03 preserved).** A group under BOTH ceilings still produces exactly ONE POST
   byte-for-byte identical to 040-03; a single-event group still emits the 039-01 GET. No behavior change off the split
   path.
4. **An unsplittable single event is emitted alone (documented edge).** Within a splitting group, an event whose OWN
   body line already exceeds the byte ceiling cannot be split further — it is emitted as its own single-line POST (the
   ceiling governs MERGING, not single-event size); documented, not silently dropped. NOTE: a truly *lone* event (a
   context group of 1) still emits the 039-01 **GET** per AC3 — never a POST — and its GET-URL size is a pre-existing
   039-01 / browser-URL-limit concern OUTSIDE this slice's (POST-body) frame.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a group whose combined body exceeds the BYTE ceiling → N split POSTs, each under it, union of body
      lines == input events (order preserved); a group exceeding the EVENT-COUNT ceiling (many small events, low bytes)
      → split by count; an under-both-ceilings group → ONE POST (040-03 fixture still byte-for-byte); a single
      over-byte-ceiling event → its own unsplit single-line POST; a lone event → still the 039-01 GET; the shared query
      (incl. `_ss`/`_fv`) is repeated on each split POST; and a **small / huge-alone / small interleaving** (an
      unsplittable event mid-group) preserves cycle order across the split POSTs (no backfill into a closed POST).
- [ ] Each new-feature test shown to fail when its feature is removed (e.g. removing the split → one over-ceiling body;
      removing the count clause → a high-count low-byte burst stays one POST).
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Self-imposed conservative ceilings (bytes AND count) are honest and sufficient (the frame's load-bearing bet).**
  gtag's real `/g/collect` limits are unobserved in BOTH dimensions; airlock does not claim to reproduce gtag's split
  thresholds, only to stay safely under documented MP upper bounds — ~130KB (bytes) and ~25 events/request (count) —
  with values far above ROUTINE traffic (in normal operation neither bound fires — this is a backstop, not a routine
  path). The split protects the ABNORMAL/pathological burst; and covering BOTH dimensions matters because WHEN a burst
  does grow large enough to approach the limits, the COUNT cap trips FIRST (many small events reach ~25 well before
  ~130KB), so a byte-only split would miss exactly that case (frame-critique correction — "binding first" is relative
  between the two bounds, not a claim that either fires in routine use). The split policy is airlock's, not a parity
  claim — consistent with spec 040's perf-not-parity framing.
- **Session-start flags repeat across split POSTs (a tracked non-parity fidelity residual).** `_ss` (session start) /
  `_fv` (first visit) are classified SHARED (they ride `ctx.sessionState`), so AC1's shared-query repetition duplicates
  them onto each split POST — whereas gtag emits `_ss=1`/`_fv=1` only ONCE per session. This is non-parity BY DESIGN, on
  the rare backstop (split) path only, and the same class as 040-03's already-tracked n=1 fidelity residual — recorded
  here, closed (if ever) by the same deferred live-accept GA4 DebugView re-check. It is NOT a correctness bug: no event
  is lost or duplicated, and the flags are booleans GA4 tolerates on repeated hits.
- **The split is the adapter's job, not the core's.** The 040-02 seam takes the hook's `EgressRequest[]` verbatim (and
  re-checks each output's ENDPOINT ceiling — a different, allowlist check); the SIZE split is purely internal to
  `coalesceGa4`. No `core/airlock.js` change.
- **Each split POST is an independent best-effort dispatch** — a split multiplies the number of POSTs, so 040-04's
  failure-observability applies per split POST (one split failing loses only its own events). The two hardening slices
  compose: the ceiling bounds each POST's blast-radius by bytes; 040-04 surfaces any POST's failure.

## Anti-horizontal-phasing check

After this slice a pathological same-stream burst on a rewired page reaches `/g/collect` as several bounded POSTs
instead of one over-byte or over-count (likely-rejected) body — the coalescing feature stays safe under load end-to-end
across BOTH rejection dimensions, a user-facing reliability behavior on the real egress path.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
