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

- `ad.doubleclick.net/activity;src=<adv>;type=<grp>;cat=<tag>;ord=…` — the classic Floodlight **activity** beacon,
  **`;`-delimited** (`src`/`type`/`cat`/`ord`/`num` + custom `u<n>` + `gcs`/`gcd`/`npa`/`dma`/`auiddc`) (`R-009:145`). This
  is the form R-009 enumerates the attribution fields on.
- `www.google.com/ccm/collect?tid=DC-<id>&en=page_view` (+ the server-side `ad.doubleclick.net/ccm/s/collect` mirror) —
  the **Consent-Mode collect** for the DC tag, **query-delimited** (`?a=b&c=d`); R-009's DC row for it (`R-009:146`) is
  un-enumerated (a bare "Consent-Mode collect", no attribution vocabulary listed).

Every beacon carries **Consent Mode v2** (`gcs`/`gcd`/`npa`/`dma`) — **byte-identical to the carriage the GA4 gtag (spec
039) and Google Ads (spec 044) connectors already reproduce** via the shared `connectors/consent-mode.js` encoders — and
the first-party linker id as **`auiddc`** (R-009 attributes it `_gcl_au`-derived, `R-009:191-193`), **read** host-side
like `_ga`/`_gcl_au` but **read-only, never minted** (the §A4 discipline 044 established for `_gcl_au`).

This connector reproduces the **page-load DC beacon(s) off-thread** through airlock's existing governed GET egress (spec
026 pixel path), carrying Consent Mode via the **reused/extracted `connectors/consent-mode.js` encoders**, holding at the
seal under `ad_storage`-denied via the **045 `holdOnDenied` opt-in** (grounded, below), and forwarding an inbound click id
when present. Parity is a **same-protocol beacon diff** under the [038 parity harness](../038-parity-harness/spec.md) on a
redacted DC capture (ADR-0019 model — the strongest oracle, not a semantic field-map).

**The endpoint-shape decision (the arch-review focus of 046-01, and — per the frame-critique 2026-09-12 — the FIRST
gating step).** Floodlight fires two page-load wire shapes, and R-009's own enumeration points them in a DIFFERENT
direction than a naive AW analogy suggested:

- **`ad.doubleclick.net/activity;src;type;cat;ord` — where R-009 actually locates the attribution (the likely target).**
  The capture enumerates the Floodlight identity (`src`/`type`/`cat`) + custom `u<n>` + `auiddc` + Consent Mode
  **exclusively on this `;`-delimited activity form** (`R-009:145`), and names the linker id an "activity ping" field
  (`R-009:191`). But **no existing connector (`appendParam`+`&` query builder) or 038 oracle (`fieldsFromUrl` via
  `URL.searchParams`) handles a `;`-delimited wire** — the params ride the URL *path*, not the query — so reproducing it
  needs a **new DC-specific `;`-delimited encoder + a `;`-delimited redactor/descriptor + oracle support**, materially
  LARGER than AW's reuse.
- **`ccm/collect?tid=DC-<id>` — query-delimited and reuse-friendly, but UN-enumerated for DC.** R-009's DC `ccm/collect`
  row (`R-009:146`) lists **no** `auiddc`, no `src`/`type`/`cat`. Contrast AW, whose `ccm/collect` WAS enumerated with
  `auid` (`R-009:143`) and has a committed fixture carrying it — which is why AW's ccm/collect reuse is grounded and DC's
  is NOT. Reducing a Floodlight activity to `tid=DC-<id>&en=page_view` may not express its `src`/`type`/`cat` identity at
  all.

**The AW-analogy recommendation (ccm/collect) is therefore WITHDRAWN as ungrounded for DC** (frame-critique, 2026-09-12):
the in-repo evidence leans toward the `;`-delimited `activity` form carrying the parity-significant attribution. 046-01's
FIRST step is to produce/inspect the redacted DC capture and confirm **which endpoint actually carries `auiddc` + the
`src`/`type`/`cat` identity**, then the arch pass decides the encoder/oracle approach — BEFORE the field-level ACs are
pinned to an endpoint (§A2).

The connector shape is otherwise settled as a gtag-family sibling: **a dedicated `connectors/floodlight/` connector that
REUSES 039's Consent-Mode encoders + 026's governed GET egress + 044's `_gcl_au` read + 045's `holdOnDenied` seal** — the
only open axis is the wire encoding (§A2). Rejected alternatives (named for the arch pass to test): (a) **extend the 044
google-ads connector** — rejected: a different vendor/endpoint family (`DC-…` vs `AW-…`), and overloading it entangles two
wire shapes; (b) **a pixel vendor config (026)** — rejected: the pixel path has no Consent-Mode carriage and no seal-hold
rule.

## What already exists (reuse — grounded 2026-09-12)

- **Off-thread governed GET egress** — `connectors/pixel/connector.js` proves governed GET-beacon dispatch (`{ url,
  method: "GET" }` → `core/airlock.js` method-aware dispatch); spec 026. The AW connector (044) already rides it. Reused
  regardless of the §A2 wire encoding (both forms are GET).
- **Consent Mode encoders** — `connectors/consent-mode.js`'s `encodeGcs`/`encodeGcd` emit the exact `gcs`/`gcd` the DC
  pings carry (same vocabulary on the 2026-09-11 capture, `R-009:148-150`). The module doc already names **Floodlight as
  the prospective 3rd caller** (`connectors/consent-mode.js:6-8`) → this spec triggers the extract-on-third-caller
  convention, INCLUDING lifting `encodeNpa` out of `connectors/google-ads/connector.js` (its 2nd consumer) into the shared
  module. Reused regardless of §A2 (the encoders produce field *values*; only how they're laid into the URL differs).
- **The ad-family seal (`holdOnDenied`)** — 045-01's per-instance `holdOnDenied` opt-in + re-map-on-grant
  (`core/consent.js` `egressVerdict`, `core/airlock.js`) is exactly the `ad_storage`-denied behavior DC exhibits (§A3);
  the connector opts in the SAME way AW did (044-02). **Caveat (§A2):** the granted-flush re-check runs the re-mapped URL
  through `core/endpoint-ceiling.js` (origin+**pathname**, `:52-59`); a `;`-delimited `activity` URL carries `ord` in the
  pathname, so the ceiling declaration must be path/cachebuster-aware or the flush is held — a real downstream break to
  resolve in 046-01, not glossed.
- **First-party identity (the READ half only)** — `connectors/google-ads/cookies.js`'s `_gcl_au` read (`ad_storage`-gated,
  read-when-present / omit-when-absent / NEVER minted) is the template for sourcing `auiddc` (§A4).
- **Parity harness** — spec 038's same-protocol oracle + the AW redactor/descriptor pair
  (`rig/parity/redact-google-ads.js`, `rig/parity/descriptors/google-ads.js`, `rig/parity/run-google-ads.mjs`) are
  templates, but reuse is **conditional on §A2**: only the query-delimited `ccm/collect` target reuses them verbatim; the
  (more likely, per R-009) `;`-delimited `activity` target needs a **new `;`-delimited redactor + descriptor + oracle
  path** (the AW pair parses `URL.searchParams`, which a path-delimited beacon defeats). A committed redacted DC fixture is
  needed either way (DC has none — the AW analogue is `test/fixtures/parity-google-ads-ccm.redacted.json`).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

**A1 (page-load ping shape — GROUNDED at the R-009 vocabulary level; no committed fixture yet).** The DC page-load beacon
family + its Consent-Mode carriage (`gcs`/`gcd`/`npa`/`dma`) + first-party `auiddc` are grounded on a real redacted
`erp.intuit.com` capture (`R-009:145-150`). *Risk:* the raw capture is **local-only per R5** — no field-level DC fixture
is committed in-repo (unlike AW's `parity-google-ads-ccm.redacted.json`), so the exact param spellings are grounded at the
R-009 **vocabulary** level, not a committed byte-fixture. 046-01's DoR gates on producing + committing a redacted DC
capture.

**A2 (the endpoint-shape + wire-encoding pick — OPEN; the arch-review decision; frame-critique-sharpened 2026-09-12).**
Which page-load endpoint carries the parity-significant attribution is NOT decided, and — correcting this spec's first
draft — the in-repo grounding (R-009) actually leans toward the `;`-delimited `ad.doubleclick.net/activity` form, NOT the
query-delimited `ccm/collect`: R-009 enumerates `auiddc` + `src`/`type`/`cat` + `u<n>` only on `activity`
(`R-009:145,191`) and leaves DC's `ccm/collect` row un-enumerated (`R-009:146`). *Consequence if `activity` is the target
(likely):* (i) the connector needs a **new `;`-delimited encoder** — the `appendParam`+`&` builder, the `URL.searchParams`
oracle, and the AW redactor/descriptor all assume query params, so all need `;`-delimited variants (materially larger than
AW's reuse); (ii) the `ord`/`num` cachebuster rides the URL *path*, so `core/endpoint-ceiling.js`'s origin+**pathname**
match (`:52-59`) will not match a per-request-varying `/activity;…;ord=<n>` against a declared endpoint unless the ceiling
declaration is path-prefix / cachebuster-aware — a real downstream break (load-bearing for BOTH slices' seal flush).
*Risk if `ccm/collect` after all:* it may not carry the `src`/`type`/`cat` identity that makes a beacon "Floodlight", so
an ACs-around-`ccm/collect` connector could be attribution-thin or false-green. The committed capture (DoR) resolves this
by confirming field carriage **per endpoint**; the arch pass owns the encoder/oracle approach. This assumption is why
046-01 is `arch_review: true` and why its ACs are written endpoint-agnostic (the pick is a slice sub-step, not a premise).

**A3 (denied path = seal-hold — GROUNDED 2026-09-11).** Under `ad_storage`-denied (`gcs=G100`, `npa=1`) the container
**fully held the Floodlight family** — the reject-all re-capture collapsed ad-family egress 23→2, with Floodlight
"none — fully held" (`R-009:171,175-181`), identical to Google Ads. So the connector's denied path is **seal-hold via
045's `holdOnDenied`** (emit nothing; re-map + flush on a later grant), NOT a cookieless DC send.

**A4 (the `auiddc` cookie source — ASSERTED, not field-confirmed).** R-009 attributes `auiddc` as `_gcl_au`-derived
(`R-009:191-193`), which would let DC reuse `connectors/google-ads/cookies.js` directly (only the emitted param name
`auid`→`auiddc` differs). *Risk:* if `auiddc` derives from a distinct `_gcl_dc` cookie (named only in ungrounded
checklists — `mvp8.md:33`, ADR-0018 — never observed in a capture), a new read path is needed. Confirm against the same
capture that resolves §A2. Like AW, `auiddc` is **read-when-present / omit-when-absent / never minted**;
identity-**presence** parity is an MVP9 question, shape/position parity is what the 038 oracle verifies.

**A5 (the conversion activity + DMP sync are OUT — MVP9 / E10).** The true Floodlight *conversion* activity
(enhanced-match hashes) is MVP9 (`mvp8.md:20-21`); the cross-site DMP-sync pixel (`cm.g.doubleclick.net/pixel`) is E10
(`R-009:194`, carved out as 044 §A4). This spec is the **page-load remarketing/activity family** only, which is
E10-independent.

## Decomposition

**SPIDR — Path first, then Rules.** Mirrors the ratified AW split (044): each slice ships a *more-parity-complete DC
beacon* the 038 same-protocol oracle can verify end-to-end — never an internal-only layer. Not a spike (the wire shape is
grounded at the R-009 vocabulary level; the missing pieces are a committed fixture + the §A2 endpoint pick, both gated
inside 046-01, not an open research question). Data/Interface don't apply (one vendor, one egress channel). Reuse
(consent-mode encoders, 026 GET egress, 045 seal, 044 `_gcl_au` read) keeps this to two slices — but note (§A2) the wire
encoder + oracle may be NEW, not reused, if the capture confirms the `;`-delimited `activity` form.

- **046-01 (happy Path)** — the **core DC page-load beacon off-thread**: a new `connectors/floodlight/` connector emits
  the parity-significant page-load beacon as governed GET, **granted-consent**, carrying `gcs`/`gcd`/`npa` via the
  **reused/extracted `connectors/consent-mode.js` encoders** and the host-sourced `auiddc`. **The endpoint + wire-encoding
  pick (§A2) is the slice's FIRST step** — confirmed against the committed redacted DC capture, then arch-decided — before
  the field-level ACs bind to an endpoint. Parity-confirmed by the 038 oracle (extended to the chosen wire shape) on the
  redacted DC capture. **`arch_review: true`** — §A2. DoR gates on the committed redacted DC fixture.
- **046-02 (Rules — the denied path)** — **DC opts into hold-until-granted**: the connector opts into 045's
  `holdOnDenied` so under `ad_storage`-denied the DC beacon holds at the seal (buffers + re-maps + flushes on grant),
  matching the container (§A3), mirroring 044-02 — **contingent on 046-01's §A2 pick** (the re-map + the granted-flush
  endpoint-ceiling re-check both depend on the wire shape).

## Slices

- [046-01 — core DC page-load beacon off-thread (Consent-Mode + auiddc, parity-confirmed)](slice-01-core-dc-beacon.md)
- [046-02 — DC opts into hold-until-granted (ad_storage-denied parity)](slice-02-denied-seal-hold.md)
