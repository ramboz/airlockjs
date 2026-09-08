---
status: DONE
dependencies: [038-01, adr-0019, adr-0020]
last_verified: 2026-09-08
frame_review: true
arch_review: true
---

## Slice 038-02 — semantic field-map oracle (GA4)

**Goal:** Extend 038-01's **classified-diff engine + gap map** with a **translation-table descriptor** (the
different-protocol case) on **GA4**: the descriptor resolves a container `/g/collect` field → airlock's *flattened*
egress field via the R-009 field-map, then the *same* 038-01 engine runs its three-bucket classification (`maps` /
`normalised-out` / `dropped`) with GA4's **gap map** (owner: spec 039, ADR-0020 commitment 1) declaring the fields
airlock's MP egress does not carry. So the GA4 oracle is **green on those owned gaps and red on an un-owned regression**,
and they flip to `maps` when 039's gtag connector lands.

**Reuse, don't re-model.** This slice adds a **GA4 descriptor + a flatten adapter + a `ctx`-sourcing rule**, not a new
oracle. The `maps`/`normalised-out`/`dropped`/`expected-dropped`/`gap-closed`/`divergent` buckets and the gap-map
verdict are 038-01's, unchanged (the pre-reframe `partial`/`none` vocabulary is retired).

**Bounded to `page_view`-shaped events (frame-critique 2026-09-08).** R-009 confirmed the map on a `page_view` capture.
`/g/collect` **ecommerce** packs items as `pr<n>=id~nm~pr…` delimited strings that restructure into airlock's `items[]`
**array** — **not** a scalar name→name relation, so it is **not** representable in a scalar `wireNameMap` and is **out of
scope for 038-02**. `purchase`/ecommerce parity needs a *structured* translation (a future descriptor extension, not "add
a row") and is a named follow-up.

**DoR:**
- ✅ 038-01 **DONE** — the classified-diff + gap-map engine (`rig/parity/oracle.js`), the report, the entrypoint pattern,
  and the two-field-set input contract (airlock side substitutable) all exist.
- ✅ R-009(a)'s `/g/collect` → airlock field-map, capture-confirmed on a `page_view` (2026-09-07).
- ✅ airlock GA4 replay exists — `connectors/ga4/map.js` `mapToMp(evt, ctx)` (`map.js:56-76`): a **POST-JSON MP body**
  `{client_id, events:[{name, params}], consent?}` — a *different protocol/shape* from the container's GET `/g/collect`;
  its identity/session/engagement come from the passed **`ctx`** (`map.js:63-65`), not from `evt`.
- ✅ airlock GA4 identity sourcing exists — `connectors/ga4/cookies.js` `sourceGa4Ctx` reads `cid`/`sid` from the
  `_ga`/`_ga_<stream>` cookies (`cookies.js:146`).

**Acceptance Criteria:**

1. **`ctx` comes from the shared cookie context, NOT a beacon back-feed (the decisive identity/session rule).**
   `mapToMp` reads `ctx.clientId`/`ctx.sessionId` unconditionally (`map.js:63-64`); in the harness (no live cookies — R5)
   these are harness-supplied, and **that choice, not airlock's fidelity, decides the identity-core verdict.** The
   harness sources `ctx` the way airlock genuinely would: airlock's own `sourceGa4Ctx` reads the **redacted
   `_ga`/`_ga_<stream>` cookie context carried in the fixture** (the same cookies the container's gtag read). So `cid`/
   `sid` classify `maps` because airlock and the container read the **same first-party cookie** (the real R-009 coupling)
   — **never** by comparing the beacon's `cid` to itself (a tautological false-green on the very identity fields the
   harness checks). A fixture WITHOUT the `_ga_<stream>` context exercises the OQ13-2 per-page-mint path → `sid` residual
   (AC5).
2. **GA4 descriptor = the R-009 translation table + the GA4 gap map, keyed to the FLATTENED airlock field-set.** A
   `ParityDescriptor` (038-01's shape) whose `wireNameMap` maps each `/g/collect` field → the **flattened** airlock key
   AC3's adapter produces — `tid`→`measurement_id` (the destination property; airlock's is surfaced from the collect-URL
   query, AC3 — so sending to the *wrong* property is a caught `divergent`, not a false `dropped`), `cid`→`client_id`,
   `en`→`event_name`, `dl`/`dr`/`dt`→`page_location`/`page_referrer`/`page_title`, `sid`→`session_id`, and **one
   enumerated row per observed event param** (`ep.<k>`/`epn.<k>`→`<k>` is *shorthand* — `wireNameMap` is a static
   `Record<string,string>`, so each concrete `k` seen in the capture is its own row, **never** a wildcard-strip); whose
   `gapMap` declares the no-MP-equivalent fields
   (`sct`/`seg`/`_fv`/`_ss`/`_nsi`, and the Consent-Mode `gcs`/`gcd` signal) owned by **spec 039**; and whose
   `normaliseDenylist` covers both `/g/collect`'s nondeterministic fields (`_p`/`_z`/`_s`/`_dbg`/cache-busters) **and
   runtime-measured values airlock cannot/should not reproduce** — notably **`_et`** (`map.js:65` defaults
   `engagement_time_msec` to `100`, so its *field* maps but its *value* is not a parity check → `normalised-out`, **not**
   `maps`).
3. **The oracle is 038-01's `diffParity`, fed the GA4 descriptor + a flatten adapter.** A **flatten adapter** turns
   airlock's MP egress into the flat `{field: value}` shape `diffParity` compares: the body's `client_id` + a derived
   `event_name` + one entry per `params.<k>`, **plus the `measurement_id` from the collect-URL query** (`mpUrl`,
   `map.js:79-85` — the destination property lives in the URL, not the body, so surfacing it keeps `tid`→`measurement_id`
   checkable rather than a false `dropped`). Mirrors 038-01 parsing the pixel GET URL. The `wireNameMap` RHS (AC2) is
   keyed to this adapter's output, so a name→name lookup never falsely `dropped`s a present field. Classification is the
   *same* engine: `cid`/`sid` (shared-cookie-sourced) + event params → `maps`; `_et` → `normalised-out`; `sct`/`seg`/…,
   `gcs`/`gcd` → `dropped`→`expected-dropped` (owned 039); a translated field present-but-value-divergent → `divergent`.
   **No new bucket.**
4. **Gaps are first-class report output.** The GA4 report names the **Consent-Mode carriage gap** (`gcs`/`gcd` have no
   MP-body equivalent — `connectors/ga4/consent.js` carries only `ad_user_data`/`ad_personalization`) as owned
   `expected-dropped` entries, so a reader sees exactly what MP-only egress loses at the boundary.
5. **Session continuity is a scope RESIDUAL, not a per-field bucket.** A single-event `/g/collect` capture's `sid` may be
   *present and equal* (→ `maps`, via AC1's shared cookie) even though MP-only mints a fresh session per page (OQ13-2) —
   the **loss is across pages**, which a single-beacon field-diff cannot see, exactly like 038-01's `fr` residual. So
   cross-page continuity is **owned by ADR-0020 / spec 039** (the gtag connector becomes the `_ga_<stream>` writer) and
   surfaced as a **report residual note**, never asserted as a green `sid` `maps` claim of full parity nor forced red.
6. **Re-pointable at the gtag connector (038-01's substitutable airlock input).** The oracle takes airlock's egress
   field-set as input, so it runs against `mapToMp` today and re-points at 039's `/g/collect` gtag connector when it
   lands — at which point GA4 is a **same-protocol** diff (`wireNameMap` collapses toward identity, the gap map empties
   as owners land), and this descriptor documents the MP path's residual gaps.
7. **End-to-end entrypoint** (`npm run parity:ga4`) → a classified GA4 parity report from a redacted `/g/collect`
   fixture, exiting non-zero on any divergent field or any field dropped outside the gap map.

**DoD:**
- [x] All ACs pass; full suite green (no regressions).
- [x] Coverage: a fixture WITH a redacted `_ga`/`_ga_<stream>` context → `cid`/`sid` `maps` (AC1, non-tautological — the
      test asserts the beacon `cid` is NOT fed into `ctx`); a `dropped`+owned field (`sct`) → `expected-dropped` green;
      an un-owned drop → red; a divergent-value field → red; `_et` → `normalised-out` (not divergent); the Consent-Mode
      gap reported; the session-continuity residual note present; the `mapToMp`-replay path and a supplied-field-set path.
- [x] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [x] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: the flatten adapter + the
      `ctx`-sourcing rule + the translation-table descriptor extend the descriptor/oracle input contract).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Event-TYPE completeness (add a row) vs event-KIND representational limit (out of scope).** R-009 confirmed the map on
  `page_view`. Other *page/event*-shaped types may carry `/g/collect` fields not yet in `wireNameMap` — confirmed per
  redacted capture, added as rows. But **ecommerce** (`pr<n>=…~…` → `items[]`) is a *structural* restructuring, not a
  scalar name→name relation — **not** a missing row, a representational limit, out of 038-02 (named above). Conflating
  the two is the risk. (Why `frame_review: true`.)
- **`ctx`-sourcing is the load-bearing modelling choice** (AC1): identity/session map because airlock and the container
  read the same `_ga`/`_ga_<stream>`, reproduced by feeding airlock's `sourceGa4Ctx` the fixture's cookie context — never
  by back-feeding the beacon's own `cid`/`sid` (tautological). `_et`/engagement is host-supplied runtime, so
  `normalised-out`, not a value-parity check.
- **The flatten adapter is the airlock half of the different-protocol translation** — `mapToMp`'s nested POST-JSON body →
  a flat field-set whose keys the `wireNameMap` RHS targets; the two are co-designed so a name-lookup miss can't
  masquerade as `dropped`.

**Anti-horizontal-phasing check:** After this slice a developer runs `npm run parity:ga4` on a redacted `page_view`
`/g/collect` capture and gets a classified GA4 parity report — the mapped identity/param set (shared-cookie-sourced, not
tautological), the owned `expected-dropped` gaps (session fields, Consent Mode) named with their 039 owner, `_et`
normalised-out, and the session-continuity residual note — the analytics-anchor parity check, end-to-end, on the *same*
engine 038-01 landed.

### Deviation log (after reconciliation)

**Shape (as built).** `rig/parity/`: `descriptors/ga4.js` (the GA4 `ParityDescriptor` — R-009 `wireNameMap` translation
table incl. `tid`→`measurement_id` + enumerated `ep.`/`epn.` rows, `gapMap` owned by 039, `_et` in `normaliseDenylist`),
`ga4-ctx.js` (AC1 ctx-sourcing via the *unmodified* `connectors/ga4/cookies.js` `sourceGa4Ctx`), `ga4-egress.js` (the
flatten adapter surfacing `measurement_id` from the collect URL), `ga4-replay.js` (the shared replay pipeline — added at
reconciliation, below), `report-ga4.js` (a thin wrapper over the *unmodified* `report.js` adding the residual note),
`run-ga4.mjs` (`npm run parity:ga4`); `test/parity-ga4.test.js` (18 tests); `test/fixtures/parity-ga4-collect.redacted.json`
(synthetic, real-shaped); `docs/inbox.md` (ecommerce follow-up). Verdicts: frame-critique pass (2 rounds), compliance /
craft / arch all pass.

1. **Reuse, no fork.** The 038-01 engine (`oracle.js`) + generic report (`report.js`) + `verdictExitCode` are reused
   **unmodified** (grep-confirmed single definitions, 0 GA4 refs); `sourceGa4Ctx` reused unmodified behind a capability
   shim. The GA4-specific seams (descriptor, `ga4-ctx`, `ga4-egress` flatten) are genuinely necessary because GA4 is a
   *different protocol* than the container (POST `/mp/collect` vs GET `/g/collect`).
2. **Decisive AC1 modelling (frame-critique):** `ctx` is sourced from the fixture's `_ga`/`_ga_<stream>`, never the
   beacon's own `cid`/`sid` (a tautological false-green) — enforced structurally and proven by the "different cookie
   wins" test.
3. **Review nits folded (this reconciliation):** **(a)** the craft "primary" nit — factored the
   ctx→`mapToMp`→`mpUrl`→flatten pipeline that `run-ga4.mjs` and the test duplicated into a shared **`ga4-replay.js`
   `replayGa4Egress`** (mirrors 038-01's `replay.js`), so the CLI + tests share one path and **`emitted` is derived, not
   hardcoded**; removed 4 now-unused test imports. **(b)** widened the shared `ParityDescriptor.deriveLogicalEvent`
   typedef to `Record<string, string|number>` (arch + craft — a 1-line JSDoc alignment; 038-02 is the first numeric-param
   consumer). **(c)** captured the ecommerce/`purchase` scope-out in `docs/inbox.md` (compliance). 18/18 parity tests +
   full suite 1304 green, ESLint clean.
4. **Deferred / logged (non-blocking):** `report-ga4.js`'s per-vendor wrapper → a generic `residualNotes` descriptor
   field rendered by the shared report (arch — a **post-slice** consistency refactor that would touch the DONE
   `report.js`; kept the thin wrapper for now, no duplication); naming unevenness (`report-ga4` vs `ga4-ctx`/`ga4-egress`)
   and the unread `fixture.endpoint` provenance field (cosmetic); the AC4 Consent-Mode gap is asserted at `diffParity`
   level and reaches the report transitively (compliance — functionally met, no dedicated report-output assertion); an
   un-enumerated custom `ep.<k>`/`epn.<k>` param is silently skipped (inherited 038-01 curated-set behavior, documented).
5. **Flagged to owner, NOT amended:** ADR-0020 (Accepted, immutable) kill-criterion #1's parenthetical "(038-02 models
   `partial`)" is now stale — 038-02 retires `partial` for the residual framing. The ADR's *substance* still holds
   (038-02's session-continuity residual is an instance of "field present/equal yet semantics diverge"). Amending a
   closed record needs owner approval (reconciliation rule); surfaced, not written.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | rig-level validation tooling; no front-door change. |
| `docs/specs/README.md` | `deferred` (close-out) | regenerated by `workflow.py status-board` **after** the `→ DONE` transition; the board correctly still shows pre-`DONE` here. |
| `rig/parity/oracle.js` | `updated` | 1-line JSDoc typedef widening (`deriveLogicalEvent` params → `string\|number`) to reflect 038-02's numeric-param consumer — a live-code inline fix (ADR-0010); engine behaviour unchanged. |
| `docs/product-vision.md` | `no-op` | no behavior/scope drift — parity is already the co-equal success criterion. |
| `docs/architecture.md` | `no-op` | `rig/parity/` is dev/validation tooling; no runtime module boundary; arch review confirmed clean reuse. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / templates | `no-op` | 038 still in flight (slice 02 of 3; 038-03 DRAFT). |
| `docs/inbox.md` | `updated` | GA4 ecommerce/`purchase` structural-translation scope-out parked as a tracked follow-up. |
| `docs/refinement-todo.md` | `no-op` (for 038-02) | its Spec-038/ADR-0020 section is the prior E10 item; 038-02 adds no new deferral beyond the deviation-log follow-ups. |
| `docs/memory/**` | `no-op` | the parity vocabulary lives in ADR-0020 + spec 038; the reference-page operational fact is already in auto-memory. |
| `docs/decisions/README.md` / ADR index | `no-op` | no new ADR; ADR-0020's stale `partial` parenthetical is **flagged to the owner** (deviation log #5), not amended (immutable record, needs approval). |
| `connectors/**` | `no-op` (intentional) | reused unmodified (`map.js`/`cookies.js`/`consent.js`); no connector touched. |
| `package.json` | `updated` | added the `parity:ga4` entrypoint (AC7). |
