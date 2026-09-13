---
status: DRAFT
dependencies: [046-01, 038-01]
last_verified:
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
1. **A `;`-delimited encoder emits the activity beacon as a governed GET.** A new path-delimited URL encoder (the
   `appendParam`/`&` builder handles only query params) emits
   `ad.doubleclick.net/activity;src=<id>;type=<t>;cat=<c>;…` carrying `src`/`type`/`cat`/`ord`/`npa`/`auiddc`/`u10`/`u12`/
   `gcs`/`gcd`/`dma`/`em`/`user_data_mode` as PATH-delimited segments; a length-1 `EgressRequest[]` `{ url, method: "GET" }`;
   any other event → `[]`.
2. **Consent Mode + `auiddc` reuse.** `gcs`/`gcd`/`npa` reuse the shared `connectors/consent-mode.js` encoders (values
   identical to 046-01; only the URL layout differs); `auiddc` reuses 046-01's `_gcl_au` read, emitted under the `auiddc`
   param name (§A4).
3. **Parity-confirmed via a NEW `;`-delimited oracle path.** A new DC `;`-delimited redactor + descriptor + oracle support
   (the AW/039 `URL.searchParams` pair cannot parse a path-delimited wire) PASS on
   `test/fixtures/parity-floodlight-activity.redacted.json` (synthetic id both sides; `num`/`ord` cachebuster + `dma` + the
   `u20` visitor id normalised out). `npm run parity:floodlight-activity` green.
4. **The endpoint-ceiling admits the `;`-delimited pathname (the frame-critique's named break).**
   `core/endpoint-ceiling.js` (origin+pathname match, `:52-59`) must admit `ad.doubleclick.net/activity;…;num=<per-request>`
   DESPITE the per-request `num`/`ord` cachebuster in the PATH — via a path-prefix / cachebuster-aware match keyed on the
   declared `/activity;src=<id>` prefix — so the granted beacon is NOT held at the seal. Manifest declares the activity
   endpoint under `ad_storage`.
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

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_
