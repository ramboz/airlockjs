---
status: DRAFT
dependencies: [044-01, adr-0019]
last_verified:
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

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_
