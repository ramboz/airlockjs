---
status: DONE
dependencies: [046-01, 038-01, adr-0025]
last_verified: 2026-09-13
frame_review: false
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-02 — core DC activity beacon off-thread (;-delimited, Floodlight-native identity)

> **Grounded 2026-09-13** by the committed fixture `test/fixtures/parity-floodlight-activity.redacted.json` (R-010 recon;
> spec §A1/§A2). The classic Floodlight form `ad.doubleclick.net/activity;src;type;cat;…auiddc` — `;`-delimited (params
> ride the URL PATH), carrying the Floodlight-native identity (`src`/`type`/`cat`) that `ccm/collect` (046-01) does NOT.
> The new-machinery half: no existing connector (`appendParam`/`&`) or 038 oracle (`URL.searchParams`) handles a
> `;`-delimited wire, and the per-request `num`/`ord` cachebuster rides the pathname (the frame-critique's ceiling break).

**Goal:** Extend `connectors/floodlight/` to also emit the DC `activity` page-load beacon off-thread as a governed GET,
granted-consent, carrying the Floodlight identity (`src`/`type`/`cat`) + Consent Mode + `auiddc` in the `;`-delimited wire
— parity-confirmed against the committed activity fixture. Delivers: full Floodlight-native page-load parity (the
`src`/`type`/`cat` activity identity reaches the vendor off-thread), completing DC page-load parity alongside 046-01.

**DoR:**
- ✅ 046-01 shipped `connectors/floodlight/` (the connector + the `_gcl_au`/`auid` read + the 039 encoders).
- ✅ `test/fixtures/parity-floodlight-activity.redacted.json` committed (the `;`-delimited parity target).

**Acceptance Criteria:**
1. **A `;`-delimited encoder emits the activity beacon as a governed GET.** A new path-delimited URL encoder
   (`core/path-matrix.js` — the `appendParam`/`&` builder handles only query params) emits
   `ad.doubleclick.net/activity;src=<id>;type=<t>;cat=<c>;…`. Airlock **honestly emits only the derivable subset**
   (ADR-0020): `src`/`type`/`cat` (config identity) + `npa`/`gcs`/`gcd` (shared consent-mode encoders) + `auiddc`
   (the `_gcl_au`-derived id). The container's other fields are accounted for by AC3 — `ord`/`num`/`dma`/`u20`/`~oref`
   normalised-out, `u10`/`u12`/`u99`/`em`/`user_data_mode`/`epver`/`dc_fmt` gap-owned (no honest source). When the
   Floodlight identity (`src`) is configured, `handle(page_view)` returns a length-2 `EgressRequest[]` `[ccm, activity]`
   (both `{ url, method: "GET" }`, source `event` attached — the per-beacon `remapKey` fan-out tag is 046-03's
   deliverable, not this slice); a `src`-less (ccm-only) connector returns length-1 `[ccm]`, byte-identical to 046-01;
   any other event → `[]`.
2. **Consent Mode + `auiddc` reuse.** `gcs`/`gcd`/`npa` reuse the shared `connectors/consent-mode.js` encoders (values
   identical to 046-01; only the URL layout differs); `auiddc` reuses 046-01's `_gcl_au` read, emitted under the `auiddc`
   param name (§A4).
3. **Parity-confirmed via a NEW `;`-delimited oracle path.** A new DC `;`-delimited redactor + descriptor + oracle support
   (the AW/039 `URL.searchParams` pair cannot parse a path-delimited wire) PASS on
   `test/fixtures/parity-floodlight-activity.redacted.json` (synthetic id both sides; `num`/`ord` cachebuster + `dma` + the
   `u20` visitor id normalised out). `npm run parity:floodlight-activity` green.
4. **The endpoint-ceiling admits the `;`-delimited pathname (the frame-critique's named break).**
   `core/endpoint-ceiling.js` must admit `ad.doubleclick.net/activity;…;num=<per-request>` DESPITE the per-request
   `num`/`ord` cachebuster in the PATH — via a **segment-anchored prefix match** keyed on the declared `/activity;src=<id>`
   prefix (opt-in when the declared path contains `;`; exact match preserved for every query-delimited endpoint) — so the
   granted beacon is NOT held at the seal. Governed by [ADR-0025](../../decisions/adr-0025-endpoint-ceiling-matrix-prefix-match.md)
   (extends ADR-0006). Manifest declares the activity endpoint under `ad_storage`.
5. **Behavior-preserving.** Full `npx vitest run` green; 046-01's ccm/collect beacon unchanged (no regression).

**DoD:**
- All ACs met; full suite green; `npm run parity:floodlight-activity` PASS.
- Compliance + craft passes recorded; **arch pass recorded** — the new `;`-delimited encoder home + the
  `core/endpoint-ceiling.js` path-match change (`arch_review: true`).
- Reconciliation walked.

**Out of scope (explicit):**
- The `ad_storage`-denied seal-hold — 046-03 (covers both forms).
- Boot/worker wiring — the follow-on boot slice.
- Conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

### Deviation log (after reconciliation)

All five ACs met; full suite 1672 green; `parity:floodlight-activity` + `parity:floodlight-ccm` PASS. New machinery + the review folds:

- **`handle()` widened length-1 → length-2, then src-guarded.** `handle(page_view)` now returns `[ccm, activity]` when the Floodlight identity (`src`) is configured; a `src`-less (ccm-only) connector returns length-1 `[ccm]` **byte-identical to 046-01** (its manifest also declares a single endpoint). The `ccm` beacon (`requests[0]`) is byte-unchanged (AC5). The unconditional-emit was a **[compliance + craft blocker/nit] fix**: pre-fix, a `src`-less connector emitted an identity-less `ad.doubleclick.net/activity;npa=…;gcs=…` junk beacon every page_view (held at the ceiling, no leak, but produced) — now gated on `src` presence, mirroring the connector's omit-when-absent identity discipline.
- **AC1 wording reconciled (both review passes).** The DRAFT AC1 listed 13 "carried" fields + "length-1"; that described the *container's* wire shape, not airlock's honest output. Reworded to: airlock emits only the 7 derivable fields (`src`/`type`/`cat`/`npa`/`gcs`/`gcd`/`auiddc`, ADR-0020 — no fabrication), the rest gap-owned/normalised (AC3); handle returns length-2 (src) / length-1 (src-less). Also corrected a stale "remapKey attached" clause I introduced — `remapKey` is **046-03's** deliverable (045-03/ADR-0024), not this slice; 046-02 attaches only `event` (matching AW 044-02).
- **New `;`-delimited machinery.** `core/path-matrix.js` (`appendMatrixParam` + `joinMatrixUrl` — a pure import-free leaf, sibling of `core/query-params.js`, now machine-enforced import-free in `test/core-boundary.test.js` per the arch nit); `fieldsFromMatrixUrl` in `rig/parity/replay.js` (the `;`-path flattener `fieldsFromUrl` can't do); a DC activity redactor + descriptor + replay + `run-floodlight-activity.mjs` + the `parity:floodlight-activity` script.
- **Endpoint-ceiling match-semantics change → [ADR-0025](../../decisions/adr-0025-endpoint-ceiling-matrix-prefix-match.md) (extends ADR-0006).** The **[arch blocker]** was a missing decision record for changing a security control; ADR-0025 records the two-mode partition (a `;`-bearing declared path opts into a segment-anchored prefix match; exact match preserved for all query-delimited endpoints), the rejected alternatives (strip-cachebuster-then-exact = fragile denylist; origin-only = too permissive), and the named residual (src-only anchor + arbitrary-trailing-`;`-segment append surface, the matrix analogue of ADR-0006 residual (i)).
- **`joinMatrixUrl` extracted [arch nit].** The `;`-URL join was duplicated (emitted URL + declared ceiling prefix — they must be byte-identical or the beacon is held); now one shared home makes the lockstep structural.
- **Field provenance (ADR-0020):** 7 reproduced (`maps`), 7 gap-owned (`expected-dropped`, each named — `u10`/`u12`/`u99` DC custom-vars, `em`/`user_data_mode`/`epver` MVP9 enhanced-match, `dc_fmt` wire-fidelity → tracked in `docs/refinement-todo.md`), 5 normalised-out (`num`/`ord` cachebusters, `u20` visitor uuid, `~oref`, `dma`). `dma` normalised-out (no `encodeDma`; geo/regulatory, not consent-derivable; matches ccm/AW). All 19 fixture fields accounted for.

### Reconciliation sweep

- **Tests / lint — updated.** Full `npx vitest run` → 107 files / 1672 passed, 0 fail; `npx eslint .` clean; `npm run parity:floodlight-activity` PASS (7 maps / 7 expected-dropped / 5 normalised-out); `npm run parity:floodlight-ccm` PASS (046-01 regression).
- **`core/endpoint-ceiling.js` — updated (governed by ADR-0025).** Opt-in segment-anchored prefix for `;`-declared paths; exact match preserved for every query-delimited endpoint (regression-pinned in `test/endpoint-ceiling.test.js`; verified no shipped endpoint constant contains `;`). Flush-time re-check (`core/airlock.js`) admits a re-mapped activity URL by construction (src-first, config-stable) — composes with 046-03.
- **`core/path-matrix.js` — new leaf; import-free enforced.** Added to `test/core-boundary.test.js`'s import-free `it.each` (the arch nit — the docstring claim is now true).
- **`docs/decisions/adr-0025-*.md` + README index — new + Accepted + indexed.**
- **`docs/refinement-todo.md` — updated.** DC activity gap-owned-fields follow-up (MVP9 custom-vars/enhanced-match/wire-fidelity) + the ADR-0025 endpoint-ceiling residuals (matrix-tail append + anchor granularity).
- **`docs/architecture.md` connector inventory — deferred to spec 046 close-out** (the `connectors/floodlight/` entry + `airlock/floodlight` namespace; the connector is complete only after 046-03). The consent-mode.js encoder-home line was already updated in 046-01.
- **`CHANGELOG.md` [Unreleased] — deferred to spec 046 close-out** (one MVP8 Floodlight feature bullet at close).
- **Boot/worker wiring — out of scope (no-op)** (like AW/ccm; end-to-end via parity + unit tests).
- **ADR trigger — satisfied** (ADR-0025 records the load-bearing ceiling match-semantics change with rejected alternatives).
- **Lightweight decisions / conventions / inbox — none** (the gap-owner names → refinement-todo).
- **Status board (`docs/specs/README.md`) — regenerated** at each transition; → DONE at close.
- **Memory-sync — deferred to session close** (the `;`-matrix wire + the segment-anchored ceiling prefix are glossary/memory candidates).
