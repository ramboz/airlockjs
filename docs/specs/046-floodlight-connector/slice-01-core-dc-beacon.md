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

> **Frame-critique folded (2026-09-12, `reviews/slice-01-frame-critique.md`, needs-changes).** The first draft recommended
> the query-delimited `ccm/collect?tid=DC-<id>` endpoint by analogy to AW and hard-coded it into the ACs. The critique
> showed R-009 actually enumerates DC's attribution (`auiddc`, `src`/`type`/`cat`, `u<n>`) on the **`;`-delimited
> `ad.doubleclick.net/activity`** form (`R-009:145,191`), leaving DC's `ccm/collect` row un-enumerated (`R-009:146`). The
> ACs below are re-written **endpoint-agnostic**, the endpoint+wire-encoding pick is made the slice's FIRST step (AC0,
> capture-confirmed → arch-decided), and the DoR now gates on confirming field carriage **per endpoint**. See spec §A2.

**Goal:** Ship a new `connectors/floodlight/` connector that reproduces the reference site's Floodlight (`DC-…`) page-load
beacon off-thread as a governed GET, granted-consent, carrying Consent Mode v2 (`gcs`/`gcd`/`npa` via the shared
`connectors/consent-mode.js` encoders) + the host-sourced first-party `auiddc` + the Floodlight `src`/`type`/`cat`
identity — parity-confirmed by the 038 same-protocol oracle against a redacted DC capture. Delivers: a rewired Floodlight
page-load beacon reaches the vendor off-thread with attribution parity.

**DoR:**
- ✅ 044 (Google Ads) shipped the gtag-family connector pattern + the AW redactor/descriptor (`rig/parity/*google-ads*`);
  045 shipped the `holdOnDenied` seal 046-02 will opt into.
- ✅ The DC page-load wire shape + Consent-Mode carriage + `auiddc` are grounded at the R-009 §(b) vocabulary level
  (`docs/research/R-009-gtag-family-fidelity.md:145-150`).
- ⛔ **A committed redacted DC capture that confirms, PER ENDPOINT, which page-load beacon carries the parity-significant
  attribution** — `auiddc` AND the Floodlight identity (`src`/`type`/`cat`) + Consent Mode — i.e. `;`-delimited
  `ad.doubleclick.net/activity` vs query-delimited `ccm/collect?tid=DC-…` (spec §A2). It is NOT enough that some
  `ccm/collect` request fires; the DoR is carriage of those fields on the endpoint the ACs target. Captures are
  **local-only per R5**: produce locally on the `erp.intuit.com` reference page, redact identifier VALUES / preserve
  SHAPE, commit as `test/fixtures/parity-floodlight-*.redacted.json`.

**Acceptance Criteria:**

0. **Endpoint + wire-encoding decided FIRST (§A2, arch-gated).** From the committed capture, confirm which endpoint carries
   the parity-significant attribution and record the pick + the wire encoding it implies: query-delimited (`ccm/collect` →
   reuse `appendParam`/`&` + the AW oracle/redactor) OR `;`-delimited (`ad.doubleclick.net/activity` → a NEW `;`-delimited
   encoder + a `;`-delimited redactor/descriptor + oracle support). The arch pass ratifies this before the field-level ACs
   are implemented.
1. **The connector emits the parity-significant DC page-load beacon as a governed GET to the AC0-decided endpoint.**
   `createFloodlightConnector({ activityId /* DC-… */, ctx, endpoint }).handle({ type: "page_view", … })` returns a
   length-1 `EgressRequest[]` `{ url, method: "GET" }` (no body, no `*secret*` key) carrying the container-grounded fields
   for that endpoint (`tid`/`en`/`dl`/`dt` for `ccm/collect`, or `src`/`type`/`cat`/`ord` for `activity`). A captured event
   of any other type maps to `[]` (the zero-or-one gate, mirroring the pixel/AW connectors).
2. **Consent Mode v2 carriage via the shared encoders.** The `gcs`/`gcd` field VALUES are produced by the REUSED
   `connectors/consent-mode.js` encoders (byte-identical to AW/GA4), and `npa` by the encoder **extracted this slice** from
   `connectors/google-ads/connector.js` into `connectors/consent-mode.js` (Floodlight is the 3rd caller — the
   extract-on-third-caller convention, `connectors/consent-mode.js:6-8`); a pending consent vector omits `gcs`/`gcd`. (How
   the values are laid into the URL — `&` vs `;` — follows AC0's wire-encoding pick.)
3. **`auiddc` + the Floodlight identity, read-when-present / omit-when-absent / NEVER minted.** The host-sourced
   first-party linker id is projected verbatim as `auiddc` when present in `ctx`, omitted when absent (airlock never mints
   one — §A4), and the beacon carries the Floodlight `src`/`type`/`cat` identity (config-supplied). The `auiddc` read path
   reuses `connectors/google-ads/cookies.js`'s `ad_storage`-gated `_gcl_au` read (per §A4; a distinct `_gcl_dc` source is a
   deviation-logged adjustment resolved from the same capture, not a silent guess).
4. **Parity-confirmed against the redacted DC capture.** A DC redactor + descriptor drive the 038 same-protocol oracle to
   a PASS on the committed `test/fixtures/parity-floodlight-*.redacted.json`: the connector's beacon field-diffs clean
   against the captured beacon (synthetic id both sides), non-attribution / regulatory fields (`ord`/`num` cachebuster,
   `dma`) normalised out. If AC0 picked `activity`, the redactor/descriptor/oracle are the NEW `;`-delimited variants (not
   the AW query-string pair); if `ccm/collect`, the AW pair is reused. No false-shim: the fixture is the real redacted
   capture, never authored to match airlock (ADR-0020).
5. **Manifest declares egress under `ad_storage`, and the endpoint declaration is ceiling-safe for the chosen wire.**
   `manifest.purposes.egress: ["ad_storage"]` (+ the `auiddc`-source cookie capability) so THE SEAL can gate the beacon
   under `ad_storage`-denial (wired in 046-02). If AC0 picked `activity`, the declared endpoint must still be matched by
   `core/endpoint-ceiling.js` (origin+**pathname**, `:52-59`) DESPITE the per-request `ord` cachebuster in the pathname
   (path-prefix / cachebuster-aware match) — else the granted-path beacon (and 046-02's flush) is held at the seal. This is
   the frame-critique's named downstream break; resolve it here, do not defer silently.

**DoD:**
- All ACs met; full `npx vitest run` green; parity replay (`npm run parity:floodlight`) PASS on the committed fixture.
- Compliance + craft passes recorded; **arch pass recorded** — the §A2 endpoint + wire-encoding decision
  (`arch_review: true`).
- Reconciliation walked.

**Out of scope (explicit):**
- The `ad_storage`-denied seal-hold — 046-02.
- Boot/worker wiring for `connectors/floodlight/` (the `adapters/eds` runtime threading) — a follow-on boot slice,
  mirroring 044-01's deferred g-ads boot (the 039→041 precedent).
- The true conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (endpoint + wire-encoding OPEN, leans `;`-delimited `activity` — folds spec §A1/§A2/§A4 + the 046-01 frame-critique).**
The wire shape is R-009-vocabulary-grounded but the parity-significant endpoint is undecided and the in-repo evidence
(`R-009:145,191` vs `:146`) leans toward the `;`-delimited `activity` form — which needs a NEW encoder + oracle/redactor
variant AND a ceiling declaration tolerating the `ord` cachebuster in the pathname (`core/endpoint-ceiling.js:52-59`). The
committed fixture (DoR) + the arch pass resolve the pick (AC0) before the field-level ACs bind; the `auiddc` source (§A4:
`_gcl_au` vs `_gcl_dc`) is resolved from the same capture. *Risk if the pick is wrong:* ACs written around the wrong
endpoint mis-direct implementation — which is exactly why AC0 gates first and the ACs are endpoint-agnostic.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_
