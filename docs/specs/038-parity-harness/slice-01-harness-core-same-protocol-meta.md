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
oracle** (maps / normalised-out / **dropped**), proven end-to-end on **Meta Pixel** from a redacted fixture. Meta is the
sharpest first vendor because airlock's connector is **identity-free by construction**, so the oracle's honest result on
a Meta beacon is a first-class **`dropped` identity gap** (`_fbp`/`fbc`/`ud`) — this slice's value is that the harness
**reports that gap** as a **regression guard**: it holds those fields at `dropped` until their owners land (Meta
`_fbp`/`fbc` → the chamber cookie-capability follow-up; `ud[...]` → 026-04, per ADR-0020 commitment 1), at which point a
correct connector flips them to `maps`.

**A 038-01 `pass` means _beacon-field_ parity, not full Meta parity.** The dominant Meta identity is the `fr` cross-site
**cookie** (transport), which no URL+params oracle can see (ADR-0018:56); it is ADR-0020 / E10's, surfaced by 038-03.
This oracle judges the beacon's fields only.

**DoR:**
- ✅ spec 026 Meta Pixel connector exists — `createPixelConnector(config).handle(evt)` returns **`[{ url, method: "GET"
  }]`** (an array; `[]` for an unmapped event — `connector.js:149`) to the Meta `/tr` beacon; `meta.js:10-14` projects
  `id`/`ev` + non-PII standard params, **omitting** `_fbp`/`fbc`/`ud[...]` by construction.
- ⚠️ **Capture front-end needs a beacon-endpoint pattern (grounded correction 2026-09-08).** `rig/lh-r010.mjs`'s recon
  matches vendor **runtime loaders** (`*connect.facebook.net*` = `fbevents.js`), **not** the `/tr` beacon
  (`www.facebook.com/tr`) — so this slice must add the beacon endpoint to the capture pattern set and confirm the
  reference `/tr` GET carries `_fbp`/`fbc`/`ud`. (Capture reuse is real; the *Meta beacon* pattern is new.)
- ✅ ADR-0018 §"What parity means" + ADR-0020: the attribution-bearing set is the **container's**, `_fbp`/`fbc` count.

**Acceptance Criteria:**

1. **Redaction → real-shaped fixture.** A capture/redaction step turns a container Meta `/tr` beacon into a
   **redacted, real-*shaped* fixture** (R5 / ADR-0020: live captures are local-only and uncommittable — the committed
   fixture carries the real field *vocabulary* with synthetic values). A test asserts **no live-identifier shapes**
   (pixel id, `_fbp`/`fbc`, `ud[...]`/hashed match) survive.
2. **Replay.** Given the fixture's logical event, the harness runs `createPixelConnector(metaConfig).handle(evt)`,
   **indexes the returned array** (`[0]`; an empty `[]` = "airlock emits nothing" — itself a reportable result), and
   captures airlock's Meta beacon URL. The **capture→logical-event derivation** (turning a container beacon back into
   the event airlock replays) is part of the per-vendor descriptor (AC7), not ad-hoc.
3. **Classified-diff oracle.** Over the **container's curated attribution-bearing set** (not every wire field), the
   oracle classifies each field **maps** (present in airlock's beacon, equal after normalisation) / **normalised-out**
   (excluded — nondeterministic *and* deterministic-but-non-attribution: cache-buster, timestamp, `rdp`, `v`, `dl`,
   ordering) / **dropped** (attribution-bearing, container-sent, not emitted by airlock). A `pass` requires **no dropped
   and no divergent** attribution-bearing field; `dropped` is never folded into `normalised-out`.
4. **Reports the designed-in identity gap (keystone).** Against the redacted real-shaped Meta fixture, the oracle
   **reports `_fbp`/`fbc` (and `ud[...]` when present) as a first-class `dropped` gap — NOT a pass** — and names their
   owners (cookie-capability follow-up / 026-04, ADR-0020 commitment 1). A companion fixture where those fields **are**
   present in airlock's beacon (simulating the owners landed) returns them as **`maps`** — proving the oracle is a
   two-way regression guard, not a hardcoded "Meta always fails".
5. **Report.** JSON verdict (mirroring `lh-r010`'s shape): `pass`, or the classified diff naming each field's bucket +
   (for `maps`/divergent) its two values — no live identifiers in the output.
6. **End-to-end entrypoint.** A rig entrypoint (`npm run parity:meta`) runs fixture → replay → oracle → report and
   **exits non-zero on any `dropped` or divergent attribution-bearing field**.
7. **Vendor-generic by construction.** The Meta specifics — the curated attribution-bearing set, the field-name
   translation, the capture→logical-event derivation, the normalise-denylist — live in a **per-vendor descriptor**, not
   the pipeline; a second GET-pixel vendor is a new descriptor + fixture, zero pipeline change (proven by a second
   descriptor in a test).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage: redaction test (AC1); a **clean-maps** fixture → `pass`; the **dropped-identity** fixture → a `dropped`
      gap not a false pass (AC4); the **owners-landed** fixture → `maps` (AC4); a divergent-value fixture; a second
      GET-vendor descriptor (AC7).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: new rig module boundary + the
      vendor-descriptor public shape).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The reference set is the container's, curated, and grounded on a redacted capture** (ADR-0020) — never from airlock's
  `meta.js` (identity-free, so it would hide the `dropped` fields the oracle exists to catch). Getting the curated set or
  a classification wrong yields a false pass; the frame-critique targets it. (Why `frame_review: true`.)
- **`_fbp`/`fbc`/`ud[...]` are airlock-dropped by design**, owned per ADR-0020 commitment 1; browser `fbevents.js` sends
  `ud[...]` on the **GET** query string (not a separate POST), so the gap is visible in the beacon this oracle judges.
- **Scope residual (known, ADR-0020):** a 038-01 `pass` is **beacon-field** parity, not full Meta parity — the `fr`
  cross-site cookie (the dominant Meta identity) is invisible to this oracle and is ADR-0020 / E10's, surfaced by 038-03.
  The report must not let a future `_fbp`/`fbc`/`ud`-`maps` pass be read as full Meta parity.

**Anti-horizontal-phasing check:** After this slice a developer runs one command against a redacted real-shaped Meta
capture and gets a classified parity verdict — including the named `_fbp`/`fbc`/`ud` **`dropped` gap** and, on the
owners-landed fixture, those fields as **`maps`** — a working regression guard for Meta beacon-field parity, end-to-end.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
