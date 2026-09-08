---
status: DRAFT
dependencies: [adr-0018, adr-0020]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)

**Goal:** Ship the vendor-generic parity-harness pipeline (capture → replay → oracle → report) with its **classified-diff
oracle** (maps / normalised-out / **dropped**) **plus the ADR-0020 gap map**, proven end-to-end on **Meta Pixel** as a
**two-way regression guard**: it goes **green** when only the owned, known gaps (`_fbp`/`fbc`/`ud`) are dropped, and
**red** when an *un-owned* attribution field regresses — and those owned gaps flip to `maps` when their owners land (Meta
`_fbp`/`fbc` → the chamber cookie-capability follow-up; `ud[...]` → 026-04, per ADR-0020 commitment 1).

**A 038-01 `pass` means _beacon-field_ parity, not full Meta parity.** The dominant Meta identity is the `fr` cross-site
**cookie** (transport), which no URL+params oracle can see (ADR-0018:56); it is ADR-0020 / E10's, surfaced by 038-03.
This oracle judges the beacon's fields only.

**DoR:**
- ✅ spec 026 Meta Pixel connector exists — `createPixelConnector(config).handle(evt)` returns **`[{ url, method: "GET"
  }]`** (an array; `[]` for an unmapped event — `connector.js:149`) to the Meta `/tr` beacon; `meta.js:10-14` projects
  `id`/`ev` + non-PII standard params, **omitting** `_fbp`/`fbc`/`ud[...]` by construction.
- ⚠️ **Capture front-end needs a beacon-endpoint pattern (grounded correction 2026-09-08).** `rig/lh-r010.mjs`'s recon
  matches vendor **runtime loaders** (`*connect.facebook.net*` = `fbevents.js`), **not** the `/tr` beacon
  (`www.facebook.com/tr`) — so this slice adds the beacon endpoint to the capture pattern set and confirms, on the
  capture, both the **identity fields** (`_fbp`/`fbc`/`ud`) **and the event-data wire names** (Meta's
  `cd[value]`/`cd[currency]` vs airlock's bare `value`/`currency` — a probable `meta.js` wire-fidelity gap). A
  non-wire-faithful `meta.js` is **owned** at the capture: a descriptor wire-name map **only if Meta accepts both
  spellings**, otherwise a **gap-map entry (026 wire-fidelity)** or a **026 fix** — never a descriptor "map" of a
  spelling Meta won't ingest (that is a false pass, ADR-0020), and never a silent `dropped`.
- ✅ ADR-0020 (accepted) — the parity contract this slice's oracle enforces: per-field classification + the gap map.

**Acceptance Criteria:**

1. **Redaction → real-shaped fixture.** A capture/redaction step turns a container Meta `/tr` beacon into a **redacted,
   real-*shaped* fixture** (R5 / ADR-0020: live captures are local-only and uncommittable — the committed fixture carries
   the real field *vocabulary* with synthetic values). A test asserts **no live-identifier shapes** (pixel id,
   `_fbp`/`fbc`, `ud[...]`/hashed match) survive.
2. **Oracle input contract — two beacon field-sets, airlock side substitutable.** The oracle takes the **container**
   field-set (from the fixture) and the **airlock** field-set. The airlock side is **substitutable**: normally produced
   by replay — `createPixelConnector(metaConfig).handle(evt)` → **`[0]`** (`[]` = "airlock emits nothing", a reportable
   result) — but the oracle also accepts a **supplied** airlock-beacon fixture, so the owners-landed case (AC4c) is
   testable without editing the identity-free connector. The capture→logical-event derivation lives in the descriptor
   (AC7).
3. **Classified-diff oracle + the gap map.** Over the **container's curated attribution-bearing set** (not every wire
   field), the oracle classifies each field **maps** (present in airlock's beacon, equal after normalisation) /
   **normalised-out** (excluded — nondeterministic *and* deterministic-non-attribution: cache-buster, timestamp, `rdp`,
   `v`, `dl`, ordering) / **dropped** (attribution-bearing, container-sent, absent from airlock's set). The per-vendor
   descriptor declares a **gap map** (owned-dropped fields + owners, ADR-0020 commitment 1). **Verdict: `pass` = no
   divergent field AND no field dropped _outside_ the gap map.** A gap-map field that is `dropped` = **expected-dropped**
   (green); a `dropped` field **not** in the gap map = a **regression** (red); a gap-map field seen as `maps` =
   **gap-closed** (green + report flag "owner landed — remove from gap map").
4. **Two-way regression guard (keystone) — three fixtures prove it guards:**
   **(a)** the real-shaped Meta fixture: `_fbp`/`fbc`/`ud` are in the gap map → **green (expected-dropped)**, the report
   lists them as owned gaps; **(b)** a fixture dropping an **un-owned** field (e.g. `currency`) → **red** — the
   airlock-side regression the guard exists to catch, *not* drowned under the identity gaps; **(c)** a supplied
   owners-landed airlock field-set carrying `_fbp`/`fbc` → those classify **`maps`** (gap-closed). Without the gap map, an
   identity-free-by-construction connector would exit non-zero for the whole MVP7→1.0 window and could never alarm on (b).
5. **Report.** JSON verdict (mirroring `lh-r010`'s shape): `pass`, or the classified diff naming each field's bucket
   (`maps`/`normalised-out`/`dropped`/`expected-dropped`/`gap-closed`) + (for divergent) its two values — no live
   identifiers in the output.
6. **End-to-end entrypoint.** `npm run parity:meta` runs fixture → replay → oracle → report and **exits non-zero on any
   divergent field or any field dropped outside the gap map** (green when only owned gaps are dropped).
7. **Vendor-generic by construction.** The Meta specifics — the curated attribution-bearing set, the field-name
   translation, the capture→logical-event derivation, the normalise-denylist, **and the gap map** — live in a
   **per-vendor descriptor**, not the pipeline; a second GET-pixel vendor is a new descriptor + fixture, zero pipeline
   change (proven by a second descriptor in a test).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage: redaction test (AC1); the three AC4 fixtures — **(a)** expected-dropped → green, **(b)** un-owned drop →
      red, **(c)** owners-landed → `maps`; a divergent-value fixture; a second GET-vendor descriptor (AC7).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: new rig module boundary + the
      vendor-descriptor public shape, incl. the gap-map contract).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The reference set is the container's, curated, grounded on a redacted capture** (ADR-0020) — never from airlock's
  `meta.js` (identity-free, so it would hide the `dropped` fields the oracle exists to catch). Getting the curated set,
  the gap map, or a classification wrong yields a false pass or a saturated-red gate; the frame-critique targets it.
  (Why `frame_review: true`.)
- **The gap map is the load-bearing new concept** (ADR-0020 commitment 1): it is what lets an identity-free connector
  pass on known gaps while still catching an un-owned regression. `_fbp`/`fbc`/`ud[...]` are its initial Meta entries;
  browser `fbevents.js` sends `ud[...]` on the **GET** query string, so the gap is in the beacon this oracle judges.
- **Scope residual (known, ADR-0020):** a 038-01 `pass` is **beacon-field** parity, not full Meta parity — the `fr`
  cross-site cookie is invisible to this oracle and is ADR-0020 / E10's, surfaced by 038-03. The report must not let a
  future all-`maps` pass be read as full Meta parity.

**Anti-horizontal-phasing check:** After this slice a developer runs one command against a redacted real-shaped Meta
capture and gets a classified parity verdict that is **green on the owned gaps and red on an un-owned regression** — a
working two-way regression guard for Meta beacon-field parity, end-to-end.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
