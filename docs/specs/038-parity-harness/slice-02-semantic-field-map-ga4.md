---
status: DRAFT
dependencies: [038-01, adr-0019, adr-0020]
last_verified:
frame_review: true
arch_review: true
---

## Slice 038-02 — semantic field-map oracle (GA4)

**Goal:** Extend 038-01's **classified-diff engine + gap map** with a **translation-table descriptor** (the
different-protocol case) on **GA4**: the descriptor resolves a container `/g/collect` field → airlock's egress field via
the R-009 field-map, then the *same* 038-01 engine runs its three-bucket classification (`maps` / `normalised-out` /
`dropped`) with GA4's **gap map** (owner: spec 039, ADR-0020 commitment 1) declaring the fields airlock's egress does not
carry. So the GA4 oracle is **green on those owned gaps and red on an un-owned regression**, and they flip to `maps`
when 039's gtag connector lands.

**Reuse, don't re-model.** This slice adds a **GA4 descriptor + a translation-resolution step**, not a new oracle. The
`maps`/`normalised-out`/`dropped`/`expected-dropped`/`gap-closed`/`divergent` buckets and the gap-map verdict are
038-01's, unchanged. (The pre-reframe `partial`/`none` vocabulary is retired — see Assumptions for how "present but
lossy" resolves.)

**DoR:**
- ✅ 038-01 **DONE** — the classified-diff + gap-map engine (`rig/parity/oracle.js`), the report, the entrypoint pattern,
  and the two-field-set input contract (airlock side substitutable) all exist.
- ✅ R-009(a)'s `/g/collect` → airlock field-map exists and is capture-confirmed (2026-09-07): `cid→client_id`,
  `en→events[].name`, `ep.*/epn.*→params`, `_et→engagement_time_msec`, `dl/dr/dt→page_location/referrer/title`;
  no-MP-equivalent: `sct`/`seg`/`_fv`/`_ss`/`_nsi`; consent: `gcs`/`gcd` vs MP's 2-purpose `consent` object.
- ✅ airlock GA4 replay exists — `connectors/ga4/map.js` `mapToMp(evt, ctx)` (`map.js:56-76`), a POST-JSON MP body (a
  *different* protocol/shape from the container's GET `/g/collect`).

**Acceptance Criteria:**

1. **GA4 descriptor = the R-009 translation table + the GA4 gap map.** A per-vendor `ParityDescriptor` (038-01's shape)
   whose **`wireNameMap` carries the full R-009 `/g/collect`→airlock field translation** (e.g. `cid`→`client_id`,
   `ep.<k>`/`epn.<k>`→the event param, `dl`→`page_location`), whose **`gapMap`** declares the no-airlock-equivalent fields
   (`sct`/`seg`/`_fv`/`_ss`/`_nsi`, and the Consent-Mode storage-purpose signal) owned by **spec 039**, and whose
   `normaliseDenylist` covers `/g/collect`'s nondeterministic fields (`_p`, `_z`, `_s`, `_dbg`, cache-busters).
2. **The oracle is 038-01's `diffParity`, fed the GA4 descriptor.** Container field-set (from a redacted `/g/collect`
   fixture) + airlock field-set (from `mapToMp`, flattened) → the **same** classified-diff verdict. A container field
   whose translated target is absent from airlock's set → `dropped`; in the gap map → `expected-dropped` (green); not in
   it → a regression (red). A translated field present but value-divergent → `divergent` (red). **No new bucket, no
   `partial`.**
3. **Gaps are first-class report output.** The GA4 report names the **Consent-Mode carriage gap** (`gcs`/`gcd` have no
   MP-body equivalent — `connectors/ga4/consent.js` carries only `ad_user_data`/`ad_personalization`) as owned
   `expected-dropped` entries, and carries a **scope-residual note** for **session continuity** (see AC-residual below) —
   so a reader sees exactly what MP-only egress loses at the boundary, not a bare pass/fail.
4. **Session continuity is a scope RESIDUAL, not a per-field bucket** (the frame-critique's target). A single-event
   `/g/collect` capture's `sid` may be *present and equal* (→ `maps`) even though MP-only mints a fresh session per page
   (OQ13-2) — the **loss is across pages**, which a single-beacon field-diff cannot see, exactly like 038-01's `fr`
   cross-site-cookie residual. So cross-page session continuity is **owned by ADR-0020 / spec 039** (the gtag connector
   becomes the `_ga_<stream>` writer) and surfaced as a **report residual note**, NOT asserted as a green `maps` on `sid`
   nor forced red. The oracle judges the single captured beacon's fields.
5. **Re-pointable at the gtag connector (AC2's substitutable airlock input).** The oracle takes airlock's egress
   field-set as input (038-01's substitutable contract), so it runs against `mapToMp` today and re-points at 039's
   `/g/collect` gtag connector when it lands — at which point GA4 is a **same-protocol** diff (`wireNameMap` collapses to
   identity, the gap map empties as owners land), and this field-map descriptor documents the MP path's residual gaps.
6. **End-to-end entrypoint** (`npm run parity:ga4`) → a classified GA4 parity report from a redacted `/g/collect`
   fixture, exiting non-zero on any divergent field or any field dropped outside the gap map.

**DoD:**
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Coverage: a fixture with a `dropped`+owned field (`sct`) → `expected-dropped` green; an un-owned drop → red; a
      divergent-value field → red; the Consent-Mode gap reported; the session-continuity residual note present; a
      `mapToMp`-replay path and a supplied-field-set path (AC5).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: the translation-table descriptor +
      the flatten-`mapToMp`-to-a-field-set adapter extend the descriptor/oracle input contract).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The field-map's completeness is the risk** — R-009(a) confirmed the map on one capture (`page_view`); other event
  types (e.g. `purchase`) may carry `/g/collect` fields not yet in the translation table. Each event type's field set is
  confirmed on a redacted capture before its GA4 report is trusted. (Why `frame_review: true`.)
- **"Present but lossy" resolves to the engine's existing buckets, not a new `partial`.** A translated field present in
  both with an equal value is `maps`; present but unequal is `divergent`; absent from airlock's set is `dropped`
  (→ `expected-dropped` when owned). The one genuinely-different case — a value that is *field-equal on one beacon* yet
  *semantically lossy across beacons* (session continuity) — is a **scope residual** (AC4), owned by ADR-0020/039, not a
  bucket; ADR-0020's kill-criterion #1 already names the "field present/equal yet semantics diverge" case.
- **Flattening MP to a field-set.** `mapToMp` returns a nested POST-JSON body (`{client_id, events:[{name, params}]}`);
  the descriptor's egress adapter flattens it to the flat `{field: value}` shape `diffParity` compares (mirrors how
  038-01 parses the pixel GET URL to a field-set). This adapter is the different-protocol translation's airlock half.

**Anti-horizontal-phasing check:** After this slice a developer runs `npm run parity:ga4` on a redacted `/g/collect`
capture and gets a classified GA4 parity report — the mapped set, the owned `expected-dropped` gaps (session fields,
Consent Mode) named with their 039 owner, and the session-continuity residual note — the analytics-anchor parity check,
end-to-end, on the *same* engine 038-01 landed.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
