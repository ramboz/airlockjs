---
status: DRAFT
dependencies: [038-01, adr-0019]
last_verified:
frame_review: true
---

## Slice 038-02 — semantic field-map oracle (GA4)

**Goal:** Extend 038-01's **classified-diff engine** with a **translation-table descriptor** (the different-protocol
case) on **GA4**: resolve the container's `/g/collect` field → airlock's egress field via the R-009 field-map, then run
the same three-bucket classification — **maps / normalised-out / dropped** (with `dropped` covering the session fields
`sct`/`seg`/`_fv`/`_ss`/`_nsi` and the Consent-Mode storage purposes that have no MP equivalent), surfacing those gaps
as first-class report output.

**DoR:**
- ✅ 038-01 done — the harness core (capture/replay/report) + the entrypoint pattern exist.
- ✅ R-009(a)'s `/g/collect` → airlock field-map exists and is capture-confirmed (2026-09-07).
- ✅ airlock GA4 replay exists — `connectors/ga4/map.js` `mapToMp(evt, ctx)` (`map.js:56-76`).

**Acceptance Criteria:**

1. **GA4 descriptor encodes the field-map.** A per-vendor descriptor carries the R-009 table: each `/g/collect` field →
   airlock field, tagged `maps | partial | none` (e.g. `cid→client_id` maps; `sid→session_id` partial; `sct`/`seg`/
   `_fv`/`_ss`/`_nsi` none; `gcs`/`gcd` partial).
2. **Field-map oracle.** Given a redacted `/g/collect` fixture + airlock's replayed egress, the oracle produces a
   **classified diff**: the mapped set (present + equal), the partials (present but lossy), and the none-set (no airlock
   equivalent) — never collapsing a `none`/`partial` into a silent pass.
3. **Gaps are first-class report output.** The GA4 report names the session-continuity gap (per-page mint / OQ13-2) and
   the Consent-Mode carriage gap explicitly, so a reader sees exactly what the current egress loses at the boundary —
   not a bare pass/fail.
4. **Re-pointable at the gtag connector.** The descriptor is parameterised by the airlock egress source, so it runs
   against the MP connector today and can re-point at ADR-0019's gtag connector (spec 039) — at which point GA4 becomes
   a **same-protocol** diff (038-01's oracle), and this field-map oracle documents the MP path's residual gaps.
5. **End-to-end entrypoint** (`parity:ga4`) → a classified GA4 parity report from a redacted `/g/collect` fixture.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage includes a fixture with a known `none`-field (asserts it is reported as a gap, not a pass) and a
      `partial` (session) field.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The field-map's completeness is the risk** — R-009(a) confirmed the map on one capture (`page_view`); other event
  types (e.g. `purchase`) may carry fields not yet mapped. Each event type's field set is confirmed on a redacted
  capture before its GA4 report is trusted. (Why `frame_review: true`.)

**Anti-horizontal-phasing check:** After this slice a developer runs the harness on a redacted `/g/collect` capture and
gets a classified GA4 parity report that names the session and consent gaps — the analytics-anchor parity check,
end-to-end.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
