---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 046: Floodlight (DC) conversion connector

> **MVP8 — Ad-Conversion Offloading** ([release plan](../../releases/mvp8.md), `committed` 2026-09-11). The **second** of
> the two ad-conversion connectors — Google Ads (`AW-…`) is the sibling ([spec 044](../044-google-ads-connector/spec.md),
> DONE). Grounded on **R-009 §(b)** + a field-level re-capture (2026-09-13, committed fixtures): the DC page-load pings are
> **governed GET beacons carrying Consent Mode v2 (`gcs`/`gcd`/`npa`/`dma`)**, cleared for the page-load family
> ([ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E6). Governed by the gtag-family precedent
> [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md); the denied path reuses the ad-family consent-hold
> seal shipped for AW ([ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) + [spec 045](../045-consent-hold-until-granted/spec.md)).

## Overview

A container's Floodlight tag loads `gtag.js` (`id=DC-…`) and, **on page load**, fires a remarketing / activity family of
**GET** beacons. The 2026-09-13 field-level capture (`erp.intuit.com`, R-010 recon, default US = granted baseline;
committed redacted fixtures) shows DC fires **TWO** page-load wire shapes, and **full parity reproduces both** (owner
decision, 2026-09-13):

- **`www.google.com/ccm/collect?tid=DC-<id>&en=page_view`** — **query-delimited** (`?a=b&c=d`), carrying `auid` +
  `gcs`/`gcd`/`npa`/`dma` with the **SAME field vocabulary as AW's `ccm/collect`** (044). The reuse-complete form
  (`test/fixtures/parity-floodlight-ccm.redacted.json`). → **slice 046-01**.
- **`ad.doubleclick.net/activity;src=<adv>;type=<grp>;cat=<tag>;…auiddc`** — **`;`-delimited** (params ride the URL
  **path**), carrying the Floodlight-native identity `src`/`type`/`cat` that `ccm/collect` does NOT
  (`test/fixtures/parity-floodlight-activity.redacted.json`). → **slice 046-02** (new machinery).

Both carry **Consent Mode v2** — byte-identical to the shared `connectors/consent-mode.js` encoders (GA4 039 / AW 044) —
and the first-party linker id (`auid` on ccm/collect, `auiddc` on activity), **read** host-side like `_ga`/`_gcl_au` but
**read-only, never minted**. This connector reproduces both DC beacons off-thread through airlock's governed GET egress
(spec 026), carries Consent Mode via the reused/extracted encoders, holds at the seal under `ad_storage`-denied via the
045 `holdOnDenied` opt-in (046-03), and forwards an inbound click id when present. Parity is a **same-protocol beacon
diff** under the [038 parity harness](../038-parity-harness/spec.md) on the redacted DC captures.

**The connector shape** is a gtag-family sibling: **a dedicated `connectors/floodlight/` connector that REUSES 039's
Consent-Mode encoders + 026's governed GET egress + 044's `_gcl_au` read + 045's `holdOnDenied` seal**. The two forms
differ only in wire encoding: `ccm/collect` reuses the `appendParam`/`&` query builder + the `URL.searchParams` oracle
verbatim (046-01); the `;`-delimited `activity` form needs a **new path-delimited encoder + oracle/redactor variant + an
`core/endpoint-ceiling.js` path-match fix** (046-02, `arch_review: true`). Rejected alternatives (arch pass): (a) **extend
the 044 google-ads connector** — different vendor/endpoint family; (b) **a pixel vendor config (026)** — no Consent-Mode
carriage, no seal-hold.

## What already exists (reuse — grounded 2026-09-13)

- **Off-thread governed GET egress** — `connectors/pixel/connector.js` (spec 026); AW (044) already rides it for
  `ccm/collect`. Reused by both forms (both are GET).
- **Consent Mode encoders** — `connectors/consent-mode.js`'s `encodeGcs`/`encodeGcd` emit the exact `gcs`/`gcd` both DC
  forms carry; the module names Floodlight as the prospective 3rd caller (`:6-8`) → this spec triggers extract-on-third-
  caller, INCLUDING lifting `encodeNpa` out of `connectors/google-ads/connector.js` (2nd consumer). The encoders produce
  field VALUES; only the URL layout (`&` vs `;`) differs between forms.
- **First-party identity (READ half only)** — `connectors/google-ads/cookies.js`'s `ad_storage`-gated `_gcl_au` read
  (read-when-present / omit-when-absent / NEVER minted) is reused directly (§A4).
- **The ad-family seal (`holdOnDenied`)** — 045-01's opt-in + re-map-on-grant (`core/consent.js`, `core/airlock.js`), the
  exact `ad_storage`-denied behavior DC exhibits (§A3); 044-02 proved the pattern. Wired in 046-03.
- **Parity harness** — spec 038's oracle + the AW redactor/descriptor pair reuse VERBATIM for the `ccm/collect` form
  (046-01); the `;`-delimited `activity` form (046-02) needs a NEW redactor + descriptor + oracle path (the AW pair parses
  `URL.searchParams`, which a path-delimited wire defeats). Both redacted fixtures are committed.

## Grounding & scope (probe-verified 2026-09-13)

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe. Every claim below is probe-verified (R-009 + the committed fixtures) or a scope statement; no UNVERIFIED assumption remains, so `## Assumptions` is None. -->

**A1 (page-load ping shapes — GROUNDED, field-level fixtures committed 2026-09-13).** Both DC page-load forms + their
Consent-Mode carriage + the linker id are grounded on a real redacted `erp.intuit.com` capture (R-009 §(b) + the
2026-09-13 re-capture); the redacted fixtures `parity-floodlight-{ccm,activity}.redacted.json` are committed (raw
local-only per R5).

**A2 (endpoint shape — RESOLVED 2026-09-13).** DC fires BOTH `ccm/collect` (query-delimited, `auid`, reuse-complete,
fixed pathname → ceiling-clean) AND `ad.doubleclick.net/activity` (`;`-delimited, Floodlight-native `src`/`type`/`cat`,
`auiddc`, needs a new encoder/oracle + a ceiling path-match fix because the `num`/`ord` cachebuster rides the pathname).
Full parity reproduces both (owner decision) — 046-01 (ccm) + 046-02 (activity).

**A3 (denied path = seal-hold — GROUNDED 2026-09-11).** Under `ad_storage`-denied (`gcs=G100`, `npa=1`) the container
**fully held the Floodlight family** — the reject-all re-capture collapsed ad-family egress 23→2 ("none — fully held",
R-009:171,175-181), identical to Google Ads. Denied path = seal-hold via 045's `holdOnDenied` (046-03), NOT cookieless.

**A4 (linker cookie source — RESOLVED 2026-09-13).** `auid` (DC ccm/collect) == `auiddc` (DC activity) == AW's `auid` ==
the SAME `_gcl_au`-derived value on the page → `_gcl_au`-derived, NOT a distinct `_gcl_dc`. DC reuses
`connectors/google-ads/cookies.js`'s `_gcl_au` read directly; only the emitted param NAME differs. Like AW, read-when-
present / omit-when-absent / never minted; identity-**presence** parity is MVP9, shape/position parity is what the 038
oracle verifies.

**A5 (conversion activity + DMP sync are OUT — MVP9 / E10).** The true Floodlight *conversion* activity (enhanced-match
hashes) is MVP9; the cross-site DMP-sync pixel (`cm.g.doubleclick.net/pixel`) is E10 (R-009:194, carved out as 044 §A4).
This spec is the **page-load remarketing/activity family** only.

## Assumptions

None.

## Decomposition

**SPIDR — Path (by wire shape), then Rules.** Each slice ships a more-parity-complete DC beacon the 038 same-protocol
oracle verifies end-to-end. Not a spike (both wire shapes are grounded + committed as fixtures). The Path splits by the two
egress shapes (cheap reuse form first, new-machinery form second); Rules (denied) last, covering both.

- **046-01 (Path — ccm/collect, reuse-complete)** — `connectors/floodlight/` emits the DC `ccm/collect` beacon
  (query-delimited, `auid` + Consent Mode), reusing the AW builder/encoders/oracle/redactor verbatim. `arch_review: false`
  (ratified-pattern mirror). Delivers: DC ccm/collect page-load parity off-thread.
- **046-02 (Path — activity, new machinery)** — the same connector also emits the `;`-delimited `activity` beacon
  (Floodlight `src`/`type`/`cat` identity + `auiddc`), via a NEW path-delimited encoder + a `;`-delimited redactor/
  descriptor/oracle + a `core/endpoint-ceiling.js` path-match fix for the cachebuster-bearing pathname. `arch_review: true`.
  Delivers: full Floodlight-native page-load parity.
- **046-03 (Rules — denied path, both forms)** — both DC beacons opt into 045's `holdOnDenied` so under `ad_storage`-denied
  they hold at the seal (buffer + re-map + flush on grant), matching the container (§A3), mirroring 044-02. Delivers:
  consent parity — under denial airlock emits no DC ping.

## Slices

- [046-01 — core DC ccm/collect beacon off-thread (query-delimited, reuse-complete)](slice-01-core-ccm-beacon.md)
- [046-02 — core DC activity beacon off-thread (;-delimited, Floodlight-native identity)](slice-02-core-activity-beacon.md)
- [046-03 — DC opts into hold-until-granted, both forms (ad_storage-denied parity)](slice-03-denied-seal-hold.md)
