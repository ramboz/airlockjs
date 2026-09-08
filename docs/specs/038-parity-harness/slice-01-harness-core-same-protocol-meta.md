---
status: RECONCILED
dependencies: [adr-0018, adr-0020]
last_verified: 2026-09-08
frame_review: true
arch_review: true
claimed_by: claude/mvp7-db84f1
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
- [x] All ACs pass; full test suite green (no regressions).
- [x] Coverage: redaction test (AC1); the three AC4 fixtures — **(a)** expected-dropped → green, **(b)** un-owned drop →
      red, **(c)** owners-landed → `maps`; a divergent-value fixture; a second GET-vendor descriptor (AC7).
- [x] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [x] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: new rig module boundary + the
      vendor-descriptor public shape, incl. the gap-map contract).
- [x] Deviation log + reconciliation sweep produced.

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

**Shape (as built).** `rig/parity/` — `oracle.js` (pure, DI, vendor-agnostic classified-diff + gap-map
engine), `descriptors/meta.js` (the Meta `ParityDescriptor` — curated container set, gap map, capture→logical-event
derivation), `replay.js`, `redact.js`, `capture-patterns.js`, `report.js`, `run-meta.mjs`; `test/parity-oracle.test.js`
+ `test/parity-meta.test.js` (28 tests); `test/fixtures/parity-meta-tr.redacted.json` (synthetic, real-shaped);
`package.json` `parity:meta`; `docs/inbox.md` (the 026 wire-fidelity gap parked). Verdicts: frame-critique pass (5
rounds), compliance/craft/arch all pass.

1. **Reuse calls.** `generic-capture.js` was named a reuse candidate in the spec's Assumptions but **dis-confirmed** at
   build (it is a push→ring→flush spy, not a `handle()`+URL-parse) — a leaner `replayPixelBeacon` was written instead
   (the honest, leaner call). `lh-core.mjs` (a CWV engine) has nothing the parity oracle can reuse — not force-fit.
2. **`cd[...]` wire-fidelity (the ceremony's byproduct).** Meta's documented `/tr` namespaces event data as `cd[...]`;
   airlock's `meta.js` emits **bare** `value`/`currency` (`meta.js:74-81`). Modelled as **owned `gapMap` entries ("026
   wire-fidelity")**, never a `wireNameMap` "map" of a spelling Meta may not ingest (the false-shim ADR-0020 forbids).
   `connectors/**` was **not** touched (026 out of scope); the 026 fix is parked in `docs/inbox.md`.
3. **AC4(b) example deviation.** The AC's parenthetical said drop "`currency`" as the un-owned field; but `cd[currency]`
   is an owned gap-map entry, so `id` (a genuinely un-owned field that maps today) is used instead — a correct reading
   of the AC's intent (confirmed by all three reviewers).
4. **Review nits folded (this reconciliation):** completed the public `ParityDescriptor` typedef with `endpoint` +
   `deriveLogicalEvent` (arch + craft nit); **hardened `redact.js`** to scrub `fbclid`/click-ids from URL-valued fields
   (`dl`/`dr`) + softened the docstring + added a regression test — a real R5 hole (a live `fbclid` in `dl` is the id
   `fbc` encodes) to close before any real local capture (craft nit); made the vacuous `emitted` assertion use the real
   replay result (compliance nit). 28/28 parity tests green, ESLint clean.
5. **Deferred / logged (not fixed — non-blocking):** the `wireNameMap` branch is delivered but untested (identity
   fallback; a non-empty map lands with the first vendor that needs one); `matchesPattern` is copied from
   `rig/lh-r010.mjs` (importing it runs its import-time `process.exit(2)`) — the **2nd copy** of the glob matcher;
   extracting it into `lh-core.mjs` is a follow-up (out of this slice's scope — it would touch lh-r010); the
   **completeness-guard open question** (a container field the descriptor author forgets to
   curate yields a false pass — the spec's central risk) is **owned by ADR-0020's capture-refresh cadence + kill
   criteria**, with a per-capture curated-or-denylisted guard as a possible future hardening.

### Reconciliation sweep

_Scope: this sweep covers **038-01's own changes only**. The branch (`claude/mvp7-db84f1`) also carries prior MVP7 units
— ADR-0019 / ADR-0020 (+ their reviews), R-009 / R-010, `docs/releases/{README,mvp7}.md`, spec 039, and
`rig/lh-core.mjs` / `rig/lh-r010.mjs` (spec 036 / R-010) — each reconciled in its own unit; they are **not** 038-01
deliverables._

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | rig-level validation tooling; no project-front-door change. |
| `docs/specs/README.md` | `deferred` (close-out) | the board is regenerated by `workflow.py status-board` **after** the `→ DONE` transition (a post-DONE close-out step); the slice is `REVIEWED` → `RECONCILED` here, so the board correctly still shows the pre-`DONE` state. |
| `docs/product-vision.md` | `no-op` | no behavior/scope drift — parity is already the co-equal success criterion (added 2026-09-07). |
| `docs/architecture.md` | `no-op` | `rig/parity/` is dev/validation tooling (like `rig/lh-*`), not a runtime module boundary; `ParityDescriptor` is an internal rig contract, not an external interface (`contracts/`). Arch review confirmed the boundary is clean. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / templates | `no-op` | 038 still in flight (slice 01 of 3); Active-specs entry stays until close-out. |
| `docs/inbox.md` | `updated` | the **026 wire-fidelity** gap (airlock's `meta.js` emits bare `value` vs Meta's documented `cd[...]`) parked as a real-driver-gated follow-up. |
| `docs/refinement-todo.md` | `no-op` (for 038-01) | its "Spec 038 / ADR-0020 follow-ups" section is prior ADR-0020 work (the E10 credentialed-transport item), **not** this slice's; 038-01 adds no new deferral beyond the deviation-log follow-ups (the `matchesPattern`→`lh-core` extraction; the completeness-guard, owned by ADR-0020). |
| `docs/memory/**` | `no-op` | the parity vocabulary (classified-diff oracle, gap map, beacon-field parity, expected-dropped/gap-closed) is defined in the linked **ADR-0020 + spec 038** (hot-cache-reachable); no separate glossary entry earns its keep, and no dead-end learning to persist (the `cd[...]` finding is in `docs/inbox.md`). Glossary/hot-cache primer hygiene deferred to spec close-out (038 still in flight). |
| `package.json` | `updated` | added the `parity:meta` entrypoint (AC6) — a real 038-01 deliverable. |
| spec 038 `spec.md` / `slice-02` / `slice-03` | `updated` | spec-authoring scaffolding — the 5-round frame-critique reframe (classified-diff + gap-map) + the gap-map alignment carried into the sibling slices; disclosed in the frame-critique review + this slice's history. |
| `docs/decisions/README.md` / ADR index | `no-op` (for 038-01) | its only change was the ADR-index regen when ADR-0019/0020 landed (prior units); 038-01 introduces no ADR. |
| `connectors/**` | `no-op` (intentional) | the `cd[...]` gap is **owned, not fixed** here (026 out of this slice's scope); no connector touched — confirmed by all three reviewers. |
