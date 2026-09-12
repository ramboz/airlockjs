---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 044: Google Ads (AW) conversion connector

> **MVP8 — Ad-Conversion Offloading** ([release plan](../../releases/mvp8.md), `committed` 2026-09-11). The first of the
> two ad-conversion connectors (Floodlight/DC is a sibling spec). Grounded on **R-009(b)/(c)** — the reference site's
> Google Ads (`AW-…`) page-load egress was captured redacted 2026-09-11 (`docs/research/R-009-gtag-family-fidelity.md`
> §(b)/(c)): the pings are **governed GET beacons carrying Consent Mode v2 (`gcs`/`gcd`)**, so the connector gate
> ([ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E6) is **cleared for the page-load
> family**. Governed by the gtag-family precedent [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md)
> (additive, off-thread, speaks the container's own protocol → parity = same-protocol beacon diff).

## Overview

A container's Google Ads tag loads `gtag.js` (`id=AW-…`) and, **on page load**, fires a remarketing / conversion-linker
family of **GET** beacons — grounded on the 2026-09-11 `erp.intuit.com` capture (R-009 §(b), redacted):

- `googleads.g.doubleclick.net/pagead/viewthroughconversion/<AW-id>/` — the remarketing / view-through beacon
  (`en=page_view`/`gtag.config`, `data=event%3D…`).
- `www.google.com/rmkt/collect/<AW-id>/` — a parallel remarketing collect (mirror; `fmt=8`).
- `www.google.com/ccm/collect?tid=AW-<id>&en=page_view` — the Consent-Mode collect for the AW tag.
- `www.google.com/ccm/form-data/<AW-id>` — the enhanced-conversions channel (`ec_mode=c`, `em=tv.1` typed-value flags;
  **no raw PII** on a page-load — the hashed match egresses only on a conversion event).

Every beacon carries **Consent Mode v2** (`gcs=G111` granted / `gcs=G100` denied, `gcd`, `npa`, `dma`) — **byte-identical
to the carriage the GA4 gtag connector already reproduces** (spec 039), and the first-party linker id (`_gcl_au` →
`auid` query param), **read** host-side like `_ga` — but **read-only, never minted** (unlike `_ga`→`cid`), because
`_gcl_au` is written by the linker runtime airlock replaces (§A5).

This connector reproduces the **page-load AW beacon(s) off-thread** through airlock's existing governed GET egress (spec
026 pixel path), carrying Consent Mode via the **reused 039 encoders**, holding at the seal under `ad_storage`-denied
(grounded, below), and forwarding inbound click identifiers (`gclid`/`wbraid`/`gbraid`) when present in the landing URL.
Parity is a **same-protocol beacon diff** under the [038 parity harness](../038-parity-harness/spec.md) on a redacted
AW capture (ADR-0019 model — the strongest oracle, not a semantic field-map).

**The connector-shape decision (the arch-review focus of 044-01).** Google Ads sits **between** the two connector shapes
airlock already ships: it is more than a plain GET pixel config (spec 026 — Meta/LinkedIn/Bing) because it carries
gtag-family **Consent Mode** and a seal-hold consent rule, but it is **less stateful** than the GA4 gtag connector (spec
039) — the page-load AW ping carries **no GA4-style session state** (`sid`/`sct`/`seg`), only Consent Mode + `auid`.
The recommended shape (044-01, arch-review-gated): **a dedicated `connectors/google-ads/` connector that REUSES 039's
Consent-Mode encoders + 026's governed GET egress** — a gtag-family sibling, not a fork of either. Rejected alternatives
(named for the arch pass to test): (a) a **pixel vendor config** (026) — rejected because the pixel path has no
Consent-Mode carriage and the AW event fans out to multiple endpoints; (b) **extending the 039 gtag connector** —
rejected because AW is a different vendor/endpoint family with no `_ga_<stream>` session semantics, so overloading 039
would entangle two unrelated wire shapes.

## What already exists (reuse — grounded 2026-09-11)

- **Off-thread governed GET egress** — the pixel connector (`connectors/pixel/connector.js`) proves governed GET-beacon
  dispatch from the worker (`{ url, method: "GET" }` → `core/airlock.js` egress); spec 026.
- **Consent Mode encoders** — spec 039's `gcs` state encoder (039-02) and `gcd` defaults encoder (039-05) already emit
  the exact `gcs`/`gcd` the AW pings carry (verified identical on the 2026-09-11 capture). **Reuse, not re-author** —
  this is the single biggest reuse win and the reason Google Ads is cheap after GA4 gtag.
- **The seal** — hold-pending / strict-drop (017-03) is exactly the `ad_storage`-denied behavior the container exhibits
  (below); the connector wires the seal, it does not invent a new gate.
- **First-party identity sourcing (the READ half only)** — the `_ga` *read* path (`connectors/ga4/cookies.js`,
  consent-gated 017-02) is the template for reading `_gcl_au`→`auid`. The **mint-when-absent** half is deliberately NOT
  reused: airlock owns an arbitrary `_ga` client id, but it must **never fabricate** a `_gcl_au` (a real Google-Ads
  click signal) — read-when-present / omit-when-absent (§A5).
- **Parity harness** — spec 038's same-protocol oracle + redact pipeline (`rig/parity/`) verifies the beacon diff; a new
  AW redactor is needed (Ads has none yet — Meta/GA4 only).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

**A1 (page-load ping shape — GROUNDED, capture-confirmed 2026-09-11).** The AW page-load beacon family + its Consent-Mode
carriage (`gcs`/`gcd`/`npa`) + first-party `auid` are grounded on a real redacted `erp.intuit.com` capture (R-009 §(b)).
*Risk:* the exact **subset** of the four page-load endpoints that carries attribution *value* (vs redundant remarketing
mirrors — `viewthroughconversion` vs `rmkt/collect` appear to be mirror pairs) is not yet decided; 044-01 grounds the
parity-significant subset against the 038 oracle, not by assuming all four matter.

**A2 (denied path = seal-hold — GROUNDED 2026-09-11).** Under `ad_storage`-denied (`gcs=G100`, `npa=1`) the container
**holds the entire Google Ads family** — the denied re-capture collapsed ad-family egress 23→2 (only GA4 cookieless-models;
no AW ping fired). So the connector's denied path is **seal-hold**, matching the container + airlock's 017-03 seal — not a
cookieless ad send. See R-009 §(b) denied-consent finding.

**A3 (the conversion ping proper is OUT of this spec — MVP9).** The true AW *conversion* ping (fired on a conversion
event, carrying enhanced-match hashes) is not reproducible from a page-load capture; it is MVP9 / a conversion-page
capture. This spec is the **page-load remarketing/linker family** only. Console-level attribution parity is likewise MVP9.

**A4 (the cross-site DMP-sync pixel is OUT — E10).** `cm.g.doubleclick.net/pixel` (a third-party cookie-match) rides
cross-site cookies and belongs to the **E10 credentialed-transport ADR**, not this connector's first-party GET wire.

**A5 (the `_gcl_au`-writer gap — NAMED; folded from the 044-01 frame-critique 2026-09-11).** `_gcl_au` is written by the
Google conversion-linker (the container tag airlock replaces — **zero** `_gcl_au` writers in airlock), so on a rewired,
container-removed page a pure read yields **no `auid`**. `auid` is therefore **read-when-present / omit-when-absent /
never minted** (a fabricated remarketing key is garbage, unlike an arbitrary `_ga` cid). The "who writes `_gcl_au`
post-rewire, and is airlock ever justified minting one?" question is a **named residual** (`docs/refinement-todo.md`,
MVP9-triggered) — the strict analogue of GA4's `_ga_<stream>` gap (OQ13-2). *Consequence:* identity-**presence** parity
(a real remarketing key reaching the vendor on a rewired page) is an MVP9 question; this spec claims `auid`
**shape/position** parity only, which the 038 oracle (synthetic `auid` both sides) can actually verify.

## Decomposition

**SPIDR — Path first, then Rules.** Each slice ships a *more-parity-complete AW beacon* the 038 same-protocol oracle can
verify end-to-end — never an internal-only layer. Not a spike (the wire shape is grounded); Data/Interface don't apply
(one vendor, one egress channel). The heavy reuse (039 Consent-Mode encoders, 026 GET egress) keeps this to two slices.

- **044-01 (happy Path)** — the **core AW page-load beacon off-thread**: a new `connectors/google-ads/` connector emits
  the parity-significant page-load remarketing/linker beacon(s) as governed GET, **granted-consent**, carrying
  `gcs`/`gcd` via the **reused 039 encoders** and the host-sourced `_gcl_au`→`auid`, forwarding an inbound
  `gclid`/`wbraid`/`gbraid` when present. Parity-confirmed by the 038 oracle on a redacted AW capture (a new AW redactor).
  **`arch_review: true`** — the connector-shape decision (new connector reusing gtag+pixel machinery, vs pixel-config, vs
  039-extension). Delivers: a rewired Google Ads page-load beacon reaches the vendor off-thread with attribution parity.
- **044-02 (Rules — the denied path)** — **seal-hold under `ad_storage`-denied**: the connector holds the AW beacon at
  the seal when `ad_storage` is not granted (grounded parity with the container, A2), reusing 017-03. Delivers: consent
  parity — under denial airlock emits no AW ping, exactly as the container does.

## Slices

- [044-01 — core AW page-load beacon off-thread (Consent-Mode + auid, parity-confirmed)](slice-01-core-aw-beacon.md)
- [044-02 — seal-hold under ad_storage-denied](slice-02-denied-seal-hold.md)
