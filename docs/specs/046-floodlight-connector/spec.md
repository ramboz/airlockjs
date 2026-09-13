---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 046: Floodlight (DC) conversion connector

> **MVP8 — Ad-Conversion Offloading** ([release plan](../../releases/mvp8.md), `committed` 2026-09-11). The **second**
> of the two ad-conversion connectors — Google Ads (`AW-…`) is the sibling ([spec 044](../044-google-ads-connector/spec.md),
> DONE). Grounded on **R-009 §(b)** — the reference site's Floodlight (`DC-…`) page-load egress was captured redacted
> 2026-09-11 (`docs/research/R-009-gtag-family-fidelity.md:145-150`): the pings are **governed GET beacons carrying
> Consent Mode v2 (`gcs`/`gcd`/`npa`/`dma`)**, so the connector gate
> ([ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E6) is **cleared for the page-load
> family**. Governed by the gtag-family precedent [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md)
> (additive, off-thread, speaks the container's own protocol → parity = same-protocol beacon diff); the denied path
> reuses the ad-family consent-hold seal shipped for AW
> ([ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) + [spec 045](../045-consent-hold-until-granted/spec.md)).

## Overview

A container's Floodlight tag loads `gtag.js` (`id=DC-…`) and, **on page load**, fires a remarketing / activity family of
**GET** beacons — grounded on the 2026-09-11 `erp.intuit.com` capture (R-009 §(b), redacted):

- `www.google.com/ccm/collect?tid=DC-<id>&en=page_view` (+ the server-side `ad.doubleclick.net/ccm/s/collect` mirror) —
  the **Consent-Mode collect** for the DC tag, **query-delimited** (`?a=b&c=d`), carrying the full Consent Mode v2 pair
  (`R-009:146`).
- `ad.doubleclick.net/activity;src=<adv>;type=<grp>;cat=<tag>;ord=…` — the classic Floodlight **activity** beacon,
  **`;`-delimited** (`src`/`type`/`cat`/`ord`/`num` + custom `u<n>` + `gcs`/`gcd`/`npa`/`dma`/`auiddc`) (`R-009:145`).

Every beacon carries **Consent Mode v2** (`gcs`/`gcd`/`npa`/`dma`) — **byte-identical to the carriage the GA4 gtag (spec
039) and Google Ads (spec 044) connectors already reproduce** via the shared `connectors/consent-mode.js` encoders — and
the first-party linker id as **`auiddc`** (R-009 attributes it `_gcl_au`-derived, `R-009:191-193`), **read** host-side
like `_ga`/`_gcl_au` but **read-only, never minted** (the §A4 discipline 044 established for `_gcl_au`).

This connector reproduces the **page-load DC beacon(s) off-thread** through airlock's existing governed GET egress (spec
026 pixel path), carrying Consent Mode via the **reused/extracted `connectors/consent-mode.js` encoders**, holding at the
seal under `ad_storage`-denied via the **045 `holdOnDenied` opt-in** (grounded, below), and forwarding an inbound click id
when present. Parity is a **same-protocol beacon diff** under the [038 parity harness](../038-parity-harness/spec.md) on a
redacted DC capture (ADR-0019 model — the strongest oracle, not a semantic field-map).

**The endpoint-shape decision (the arch-review focus of 046-01).** Floodlight fires TWO page-load wire shapes, and which
one carries the parity-significant attribution decides whether DC reuses AW's machinery wholesale or needs a new encoder:

- **`ccm/collect?tid=DC-<id>` (RECOMMENDED).** The query-delimited (`?a=b&c=d`) Consent-Mode collect: the SAME vocabulary
  the AW `ccm/collect` connector (044) already emits via `appendParam` + the same-protocol 038 oracle, so DC reuses the
  query builder, the encoders, and the oracle unchanged (only `tid=DC-…` + the emitted id name differ). The DC analogue of
  AW's A1 endpoint choice (044 §Overview).
- **`ad.doubleclick.net/activity;src;type;cat;ord` (REJECTED unless the capture forces it).** The classic `;`-delimited
  activity form. **No existing connector (`appendParam` query builder) or 038 oracle handles a `;`-delimited wire**, so
  targeting it would require a new DC-specific encoder + oracle support — a materially larger, non-reuse path. Deferred as
  an assumption (§A2) to confirm against a redacted DC capture: pick the endpoint the container actually relies on for
  attribution, not both.

The recommended shape (046-01, arch-review-gated): **a dedicated `connectors/floodlight/` connector that REUSES 039's
Consent-Mode encoders + 026's governed GET egress + 044's `_gcl_au` read + 045's `holdOnDenied` seal** — a gtag-family
sibling, not a fork. Rejected alternatives (named for the arch pass to test): (a) **extend the 044 google-ads connector** —
rejected: a different vendor/endpoint family (`DC-…` vs `AW-…`), and overloading it entangles two wire shapes; (b) **a
pixel vendor config (026)** — rejected: the pixel path has no Consent-Mode carriage and no seal-hold rule.

## What already exists (reuse — grounded 2026-09-12)

- **Off-thread governed GET egress** — `connectors/pixel/connector.js` proves governed GET-beacon dispatch (`{ url,
  method: "GET" }` → `core/airlock.js` method-aware dispatch); spec 026. The AW connector (044) already rides it for a
  `ccm/collect` beacon.
- **Consent Mode encoders** — `connectors/consent-mode.js`'s `encodeGcs`/`encodeGcd` emit the exact `gcs`/`gcd` the DC
  pings carry (same vocabulary on the 2026-09-11 capture, `R-009:148-150`). The module doc already names **Floodlight as
  the prospective 3rd caller** (`connectors/consent-mode.js:6-8`) → this spec triggers the extract-on-third-caller
  convention, INCLUDING lifting `encodeNpa` out of `connectors/google-ads/connector.js` (its 2nd consumer) into the shared
  module.
- **The ad-family seal (`holdOnDenied`)** — 045-01's per-instance `holdOnDenied` opt-in + re-map-on-grant
  (`core/consent.js` `egressVerdict`, `core/airlock.js`) is exactly the `ad_storage`-denied behavior DC exhibits (§A3);
  the connector opts in the SAME way AW did (044-02: `handle` attaches the source `event`; a `createFloodlightRemap`
  re-maps on grant) — it wires the seal, it does not invent one.
- **First-party identity (the READ half only)** — `connectors/google-ads/cookies.js`'s `_gcl_au` read (`ad_storage`-gated,
  read-when-present / omit-when-absent / NEVER minted) is the template for sourcing `auiddc` (§A4).
- **Parity harness** — spec 038's same-protocol oracle + the AW redactor/descriptor pair
  (`rig/parity/redact-google-ads.js`, `rig/parity/descriptors/google-ads.js`, `rig/parity/run-google-ads.mjs`) are the
  templates; a **new DC redactor + descriptor + a committed redacted DC fixture** are needed (DC has none — the AW analogue
  is `test/fixtures/parity-google-ads-ccm.redacted.json`).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

**A1 (page-load ping shape — GROUNDED at the R-009 vocabulary level; no committed fixture yet).** The DC page-load beacon
family + its Consent-Mode carriage (`gcs`/`gcd`/`npa`/`dma`) + first-party `auiddc` are grounded on a real redacted
`erp.intuit.com` capture (`R-009:145-150`). *Risk:* the raw capture is **local-only per R5** — no field-level DC fixture
is committed in-repo (unlike AW's `parity-google-ads-ccm.redacted.json`), so the exact param spellings are grounded at the
R-009 **vocabulary** level, not a committed byte-fixture. 046-01's DoR gates on producing + committing a redacted DC
capture.

**A2 (the endpoint-shape pick — OPEN; the arch-review decision).** Which page-load endpoint carries the parity-significant
attribution — the query-delimited `ccm/collect?tid=DC-…` (reuses all AW machinery) or the `;`-delimited
`ad.doubleclick.net/activity` (needs a new encoder + oracle) — is **not yet decided**; the recommendation is `ccm/collect`
(mirroring AW's A1), to be confirmed against the committed capture. *Risk if wrong:* if attribution rides ONLY the
`;`-delimited activity form, 046-01 grows a new wire-encoding path (materially larger scope) — which is exactly why the
slice is `arch_review: true`.

**A3 (denied path = seal-hold — GROUNDED 2026-09-11).** Under `ad_storage`-denied (`gcs=G100`, `npa=1`) the container
**fully held the Floodlight family** — the reject-all re-capture collapsed ad-family egress 23→2, with Floodlight
"none — fully held" (`R-009:171,175-181`), identical to Google Ads. So the connector's denied path is **seal-hold via
045's `holdOnDenied`** (emit nothing; re-map + flush on a later grant), NOT a cookieless DC send.

**A4 (the `auiddc` cookie source — ASSERTED, not field-confirmed).** R-009 attributes `auiddc` as `_gcl_au`-derived
(`R-009:191-193`), which would let DC reuse `connectors/google-ads/cookies.js` directly (only the emitted param name
`auid`→`auiddc` differs). *Risk:* if `auiddc` derives from a distinct `_gcl_dc` cookie (named only in ungrounded
checklists — `mvp8.md:33`, ADR-0018 — never observed in a capture), a new read path is needed. Confirm against the
capture. Like AW, `auiddc` is **read-when-present / omit-when-absent / never minted**; identity-**presence** parity is an
MVP9 question, shape/position parity is what the 038 oracle verifies.

**A5 (the conversion activity + DMP sync are OUT — MVP9 / E10).** The true Floodlight *conversion* activity
(enhanced-match hashes) is MVP9 (`mvp8.md:20-21`); the cross-site DMP-sync pixel (`cm.g.doubleclick.net/pixel`) is E10
(`R-009:194`, carved out as 044 §A4). This spec is the **page-load remarketing/activity family** only, which is
E10-independent.

## Decomposition

**SPIDR — Path first, then Rules.** Mirrors the ratified AW split (044): each slice ships a *more-parity-complete DC
beacon* the 038 same-protocol oracle can verify end-to-end — never an internal-only layer. Not a spike (the wire shape is
grounded at the R-009 vocabulary level; the missing piece is a committed fixture, gated in 046-01's DoR, not an open
research question). Data/Interface don't apply (one vendor, one egress channel). Heavy reuse (consent-mode encoders, 026
GET egress, 045 seal, 044 `_gcl_au` read) keeps this to two slices.

- **046-01 (happy Path)** — the **core DC page-load beacon off-thread**: a new `connectors/floodlight/` connector emits
  the parity-significant page-load beacon as governed GET, **granted-consent**, carrying `gcs`/`gcd`/`npa` via the
  **reused/extracted `connectors/consent-mode.js` encoders** and the host-sourced `auiddc`. Parity-confirmed by the 038
  oracle on a redacted DC capture (a new DC redactor + descriptor + committed fixture). **`arch_review: true`** — the
  endpoint-shape decision (§A2: `ccm/collect` reuse vs `;`-delimited activity new-encoder). DoR gates on the committed
  redacted DC fixture.
- **046-02 (Rules — the denied path)** — **DC opts into hold-until-granted**: the connector opts into 045's
  `holdOnDenied` so under `ad_storage`-denied the DC beacon holds at the seal (buffers + re-maps + flushes on grant),
  matching the container (§A3), mirroring 044-02 1:1.

## Slices

- [046-01 — core DC page-load beacon off-thread (Consent-Mode + auiddc, parity-confirmed)](slice-01-core-dc-beacon.md)
- [046-02 — DC opts into hold-until-granted (ad_storage-denied parity)](slice-02-denied-seal-hold.md)
