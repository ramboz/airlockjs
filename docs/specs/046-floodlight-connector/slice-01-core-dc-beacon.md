---
status: DRAFT
dependencies: [044-01, 038-01, adr-0019]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-01 — core DC page-load beacon off-thread (Consent-Mode + auiddc, parity-confirmed)

**Goal:** Ship a new `connectors/floodlight/` connector that reproduces the reference site's Floodlight (`DC-…`)
page-load beacon off-thread as a governed GET, granted-consent, carrying Consent Mode v2 (`gcs`/`gcd`/`npa` via the shared
`connectors/consent-mode.js` encoders) + the host-sourced first-party `auiddc` — parity-confirmed by the 038
same-protocol oracle against a redacted DC capture. Delivers: a rewired Floodlight page-load beacon reaches the vendor
off-thread with attribution parity.

**DoR:**
- ✅ 044 (Google Ads) shipped the gtag-family `ccm/collect` connector pattern + the AW redactor/descriptor
  (`rig/parity/*google-ads*`) this slice mirrors; 045 shipped the `holdOnDenied` seal 046-02 will opt into.
- ✅ The DC page-load wire shape + Consent-Mode carriage + `auiddc` are grounded at the R-009 §(b) vocabulary level
  (`docs/research/R-009-gtag-family-fidelity.md:145-150`).
- ⛔ **A committed redacted DC capture** — the field-level fixture the 038 oracle diffs against
  (`test/fixtures/parity-floodlight-*.redacted.json`, the DC analogue of `parity-google-ads-ccm.redacted.json`) — MUST
  exist before this slice's parity ACs (AC4) are testable. Captures are **local-only per R5**, so this is the gating
  prerequisite: produce locally on the `erp.intuit.com` reference page, redact identifier VALUES / preserve SHAPE, commit.

**Acceptance Criteria:**

1. **The connector emits the parity-significant DC page-load beacon as a governed GET.** `createFloodlightConnector({
   activityId /* DC-… */, ctx, endpoint }).handle({ type: "page_view", … })` returns a length-1 `EgressRequest[]`
   `{ url, method: "GET" }` (no body, no `*secret*` key) to the chosen endpoint — `ccm/collect?tid=DC-<id>&en=page_view`
   per §A2's recommendation (the query-delimited, same-protocol form) — carrying `tid`/`en`/`dl`/`dt`. A captured event of
   any other type maps to `[]` (the zero-or-one gate, mirroring the pixel/AW connectors).
2. **Consent Mode v2 carriage via the shared encoders.** `gcs`/`gcd` are emitted by the REUSED
   `connectors/consent-mode.js` encoders (byte-identical to AW/GA4), and `npa` by the encoder **extracted this slice** from
   `connectors/google-ads/connector.js` into `connectors/consent-mode.js` (Floodlight is the 3rd caller — the
   extract-on-third-caller convention, `connectors/consent-mode.js:6-8`); a pending consent vector omits `gcs`/`gcd`.
3. **`auiddc` read-when-present / omit-when-absent / NEVER minted.** The host-sourced first-party linker id is projected
   verbatim as `auiddc` when present in `ctx`, omitted entirely when absent (airlock never mints one — §A4). The read path
   reuses `connectors/google-ads/cookies.js`'s `ad_storage`-gated `_gcl_au` read (per §A4; if the capture shows a distinct
   `_gcl_dc` source, that is a deviation-logged adjustment, not a silent guess).
4. **Parity-confirmed against the redacted DC capture.** A new DC redactor + descriptor (`rig/parity/redact-floodlight.js`
   + `rig/parity/descriptors/floodlight.js`, mirroring the AW pair) drive the 038 same-protocol oracle to a PASS on the
   committed `test/fixtures/parity-floodlight-*.redacted.json`: the connector's beacon field-diffs clean against the
   captured beacon (synthetic id both sides), with non-attribution / regulatory fields (`ord`/`num` cachebuster, `dma`)
   normalised out — mirroring the AW descriptor's `normaliseDenylist`.
5. **Manifest declares egress under `ad_storage`.** `manifest.purposes.egress: ["ad_storage"]` (+ the `auiddc`-source
   cookie capability) so THE SEAL can gate the whole beacon under `ad_storage`-denial (wired in 046-02).

**DoD:**
- All ACs met; full `npx vitest run` green; parity replay (`npm run parity:floodlight`) PASS on the committed fixture.
- Compliance + craft passes recorded; **arch pass recorded** — the §A2 endpoint-shape decision (`arch_review: true`).
- Reconciliation walked.

**Out of scope (explicit):**
- The `ad_storage`-denied seal-hold — 046-02.
- Boot/worker wiring for `connectors/floodlight/` (the `adapters/eds` runtime threading) — a follow-on boot slice,
  mirroring 044-01's deferred g-ads boot (the 039→041 precedent).
- The true conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (fixture-gated grounding — folds spec §A1/§A2/§A4).** The wire shape is R-009-vocabulary-grounded; the committed
redacted fixture (DoR) is what makes AC4 field-level, and the endpoint-shape pick (spec §A2 — `ccm/collect` vs
`;`-delimited `activity`) + the `auiddc` cookie source (spec §A4 — `_gcl_au` vs `_gcl_dc`) are the two load-bearing
assumptions the arch pass + the capture confirm during this slice. *Risk if the endpoint pick is wrong:* attribution rides
only the `;`-delimited `activity` form → a new wire-encoder + oracle path (materially larger scope).

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_
