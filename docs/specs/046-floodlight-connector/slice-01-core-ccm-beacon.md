---
status: DONE
dependencies: [044-01, adr-0019]
last_verified: 2026-09-13
frame_review: false
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-01 — core DC ccm/collect beacon off-thread (query-delimited, reuse-complete)

> **Grounded 2026-09-13** by the committed fixture `test/fixtures/parity-floodlight-ccm.redacted.json` (R-010 recon; spec
> §A1/§A2/§A4). The reuse-complete DC form: `www.google.com/ccm/collect?tid=DC-<id>&en=page_view` carries `auid` +
> `gcs`/`gcd`/`npa`/`dma` with the SAME field vocabulary as AW's `ccm/collect` (044) → reuses the `appendParam`/`&`
> builder, the 039 consent-mode encoders, the `URL.searchParams` oracle, and a redactor ~identical to `redactAwBeacon`.
> Its fixed `/ccm/collect` pathname is endpoint-ceiling-clean. The `;`-delimited `activity` form is the sibling 046-02.

**Goal:** A new `connectors/floodlight/` connector emits the DC `ccm/collect` page-load beacon off-thread as a governed
GET, granted-consent, carrying Consent Mode v2 (`gcs`/`gcd`/`npa` via the shared `connectors/consent-mode.js` encoders) +
the host-sourced `auid` — parity-confirmed by the 038 oracle against the committed ccm fixture. Delivers: a rewired DC
ccm/collect beacon reaches the vendor off-thread with consent + linker parity.

**DoR:**
- ✅ 044 shipped the gtag-family `ccm/collect` connector pattern + the AW redactor/descriptor + the 039 consent-mode
  encoders + the `_gcl_au` read this slice reuses.
- ✅ `test/fixtures/parity-floodlight-ccm.redacted.json` committed (the field-level parity target).

**Acceptance Criteria:**
1. **Emits the DC ccm/collect beacon as a governed GET.** `createFloodlightConnector({ conversionId /* DC-… */, ctx,
   endpoint }).handle({ type: "page_view", … })` returns a length-1 `EgressRequest[]` `{ url, method: "GET" }` (no body, no
   `*secret*`) to `www.google.com/ccm/collect?tid=DC-<id>&en=page_view` carrying `tid`/`en`/`dl`/`dt`; any other event →
   `[]` (the zero-or-one gate).
2. **Consent Mode via the shared encoders.** `gcs`/`gcd` from the REUSED `connectors/consent-mode.js` encoders; `npa` from
   the encoder EXTRACTED this slice out of `connectors/google-ads/connector.js` into `connectors/consent-mode.js`
   (Floodlight = the 3rd caller — extract-on-third-caller); a pending vector omits `gcs`/`gcd`.
3. **`auid` read-when-present / omit-when-absent / NEVER minted.** Projected verbatim as `auid` (the DC ccm/collect param
   name) from the host-sourced ctx, omitted when absent. The read reuses `connectors/google-ads/cookies.js`'s
   `ad_storage`-gated `_gcl_au` read verbatim (§A4: `auid`==`auiddc`==`_gcl_au`-derived).
4. **Parity-confirmed.** REUSE the AW redactor/descriptor + the `URL.searchParams` oracle to PASS on
   `test/fixtures/parity-floodlight-ccm.redacted.json` (synthetic id both sides; `rnd`/`tft`/`tfd` cachebusters + `dma`
   normalised out). `npm run parity:floodlight-ccm` green.
5. **Manifest declares egress under `ad_storage`** (+ the `_gcl_au` cookie capability) so the seal gates it (046-03). The
   fixed `/ccm/collect` pathname is ceiling-clean (no cachebuster in the path).

**DoD:**
- All ACs met; full `npx vitest run` green; `npm run parity:floodlight-ccm` PASS.
- Compliance + craft passes recorded (no arch pass — a ratified-pattern AW mirror; `arch_review: false`).
- Reconciliation walked.

**Out of scope (explicit):**
- The `;`-delimited `activity` form (Floodlight `src`/`type`/`cat`) — 046-02.
- The `ad_storage`-denied seal-hold — 046-03.
- Boot/worker wiring for `connectors/floodlight/` — a follow-on boot slice (the 039→041 precedent).
- Conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

### Deviation log (after reconciliation)

The slice as framed (a reuse-complete AW mirror) held up; all five ACs met, full suite green (1643), `parity:floodlight-ccm` PASS. Deviations decided during implementation + the compliance/craft passes (all folded):

- **`encodeNpa` extracted on its 2nd caller, not the 3rd.** AC2's shorthand said "Floodlight = the 3rd caller"; for `npa` Floodlight is the 2nd consumer (AW was the sole prior). Extracted under the conventions' explicit allowance (`docs/conventions.md` § Code — "a genuine reuse MAY extract on the 2nd caller when a 3rd is imminent; record the call"); rationale recorded in the `connectors/consent-mode.js` module doc-comment. Behavior byte-identical (GA4-gtag + AW consumers green unmodified).
- **New per-vendor redactor/descriptor modules, not literal "reuse VERBATIM."** The spec's "reuse the AW redactor/descriptor VERBATIM" was realized as NEW mirrored modules (`rig/parity/redact-floodlight-ccm.js`, `descriptors/floodlight-ccm.js`), matching the established per-vendor-module pattern (AW's redactor is itself separate from Meta's). Reused VERBATIM (imported): `oracle.js` `diffParity`, `replay.js` `fieldsFromUrl`, `core/query-params.js` `appendParam`, the `connectors/consent-mode.js` encoders, and `connectors/google-ads/cookies.js` `sourceGoogleAdsCtx`.
- **Forward-shipped the 045-01 `EgressRequest.event` re-map channel.** `handle()` attaches the source `event` to the ready beacon (the additive 045-01 channel) here in 046-01, whereas its consumer — the seal-hold — is **two slices later** in 046-03 (046-02 sits between). It is additive and inert here (stripped before dispatch; only read once a `remap` is wired in 046-03). This differs from AW, which attached its `event` inside its *own* consumer slice **044-02** (commit 534d2ec), not ahead of it; Floodlight forward-ships harmlessly because the connector is one module built across 046-01/02/03.
- **Cross-slice edit to DONE spec 044 (behavior-preserving).** The `encodeNpa` extraction removed the local definition from `connectors/google-ads/connector.js` and repointed its import to `connectors/consent-mode.js` (+ updated the encoder-home assertion in `test/google-ads.test.js`). Sanctioned by the extract-on-Nth-caller convention; 044's runtime behavior is byte-identical and its behavioral assertions pass unchanged (though `test/google-ads.test.js` itself WAS modified — the import repoint + a new encoder-home meta-test — so it is "updated," not "unmodified"). No 044 record amendment needed.
- **Comment-accuracy fixes during review (compliance + craft).** Corrected stale/imprecise doc comments the extraction touched: the `connectors/google-ads/connector.js` consent-block `npa`-home note + its module-header gtag-carriage over-scope; the `redact-floodlight-ccm.js` rule-of-three claim (the `scrubUrlIdentifiers` FUNCTION is now a 3rd byte-identical copy — `CLICK_ID_PARAMS` matches AW, Meta differs); and the now-stale "2 callers, not 3" note in `redact-google-ads.js`.
- **Deferred cleanup (tracked):** the now-rule-of-three `scrubUrlIdentifiers` helper extraction (touches the 038 Meta + 044 AW redactors) is recorded in `docs/refinement-todo.md` (§ Spec 038 follow-ups), deferred out of 046-01 to keep its reuse-complete scope from widening into two DONE specs.

### Reconciliation sweep

- **Tests / lint — updated.** Full `npx vitest run` → 106 files / 1643 passed, 0 fail (incl. 14 new `test/floodlight.test.js` + 8 new `test/parity-floodlight-ccm.test.js` cases); `npx eslint .` clean. `npm run parity:floodlight-ccm` exits 0 (verdict `pass`, 8 fields map / 7 normalised-out).
- **`encodeNpa` single-home — updated.** Defined once in `connectors/consent-mode.js`; imported by `connectors/google-ads/connector.js` + `connectors/floodlight/connector.js`; the encoder-home assertion in `test/google-ads.test.js` updated.
- **AW default behavior — no-op (byte-identical).** `test/google-ads-seal.test.js` + `test/parity-google-ads.test.js` pass **unmodified**; `test/google-ads.test.js` was **modified** (encodeNpa import repoint + a new encoder-home meta-test) but AW's behavioral assertions are unchanged.
- **`docs/architecture.md` — partially updated.** The `connectors/consent-mode.js` encoder-home line IS updated now (`gcs`/`gcd` → `gcs`/`gcd`/`npa`; reusers + `floodlight`) — per the 044-01 precedent of updating it at the extraction, since that fact is complete as of 046-01 and would otherwise misstate the shared module through 046-02/03. The `connectors/floodlight/` connector-inventory entry + the `airlock/floodlight` registry namespace are deferred to spec 046 close-out (incomplete until 046-02 activity + 046-03 seal-hold), per compress-on-close-out.
- **`docs/specs/README.md` (status board) — regenerated.** The 046-01 row + a shown-and-declined craft-anomaly line were regenerated (`workflow.py status-board`); re-run at each transition + at close so the row tracks the frontmatter.
- **`CHANGELOG.md` [Unreleased] — deferred to spec 046 close-out.** The Floodlight connector is one MVP8 feature bullet, added when the spec closes (the CHANGELOG is per-feature, not per-slice).
- **`docs/refinement-todo.md` — updated.** Added the `scrubUrlIdentifiers` rule-of-three extraction follow-up (§ Spec 038 follow-ups).
- **Boot/worker wiring — out of scope (no-op).** Like AW (044), `connectors/floodlight/` has no `adapters/eds` registration; end-to-end proof is via the parity replay + unit tests (a boot slice is the 039→041 precedent).
- **ADR trigger — none.** 046-01 is a reuse mirror of the ratified gtag-family pattern (ADR-0019); no new load-bearing decision. (The fan-out re-map decision is ADR-0024 / slice 045-03, separate.)
- **Lightweight decisions / conventions / inbox — none.** No UI/strings/visual choices; no convention change; nothing to park.
- **Memory-sync — deferred to spec close** (the Floodlight connector pattern + the DC ccm/activity wire-shape split is worth a glossary/memory note once the connector is complete).
