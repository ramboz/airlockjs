---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 045: Consent hold-until-granted for ad/personalization egress

> **Implements [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) (Proposed → to be Accepted with 045-01).**
> A cross-cutting **seal-semantics** change (MVP8), grounded on R-009 §(b): under `ad_storage`-denied the reference
> container **holds** the entire Google Ads + Floodlight family (fires nothing) while GA4 fires a **cookieless modeling**
> ping. Airlock's seal today sends *any* denied storage-purpose beacon (correct for GA4, wrong for ads). This spec adds a
> per-purpose **hold-until-granted** mode: ad/personalization egress **buffers on denied/pending and flushes on grant**
> (reusing 017-03's existing `heldBeacons`/`setConsent` machinery), while `analytics_storage` egress is unchanged.

## Overview

The seal (`core/consent.js` `egressVerdict`, `core/airlock.js` hold/flush) folds a beacon's governing `purposes.egress`
against the consent vector. Today (grounded, `core/consent.js:110-121`): pending → hold (buffer+flush), **denied → send**,
granted → send, strict → drop. ADR-0023 (**Option E — per-connector opt-in**) keeps that mechanism but lets a connector
**opt in** to hold-on-denied via a per-instance `holdOnDenied` flag (mirroring `consentStrict`), set from that
connector's **captured vendor behavior** — *fidelity, not a blanket purpose rule*:

- **g-ads (AW)** opts in → denied `ad_storage` **holds** (buffer + flush on a later grant — the OneTrust-accept flow).
  Grounded: R-009 §(b) capture (the container held AW under reject-all).
- **GA4** does **not** opt in → denied `analytics_storage` still **sends** (cookieless modeling — grounded).
- **Meta / Floodlight** are grounded-to-hold too → they opt in as **follow-ups in their own specs** (026 / the
  Floodlight spec), NOT here.
- **LinkedIn / Bing** are **not** opted in — their denied behavior is **uncaptured** (not on the reference site);
  flipping them would be an opinion, not fidelity (ADR-0023 Option D rejected). They stay on today's path until captured.

Enforcement stays **at the seal** (one mechanism); the opt-in is grounded per connector. **alloy** is a separate path
(`core/wrapped-sdk-host.js`, 045-02) — see A1.

## What already exists (reuse — grounded 2026-09-11)

- **The seal + buffer/flush** — `egressVerdict` (`core/consent.js:110`) is the verdict; `core/airlock.js:400-429` pushes
  a `hold` verdict onto `heldBeacons` (capturing `url`/`method`/`body`/`beaconId`) and `setConsent` flushes them on a
  later grant. **This slice extends the verdict, not the flush machinery** (which already does hold→flush).
- **The purposes** — ADR-0007's vector (`analytics_storage`/`ad_storage`/`ad_user_data`/`ad_personalization`) +
  alloy's `personalization`; `resolveConsent` (`core/consent.js`) is the per-purpose lookup.
- **The g-ads consumer** — spec 044's connector already declares `purposes.egress: ["ad_storage"]` (044-01), so 044-02
  becomes proving it holds via the mode, not wiring a new gate.
- **The alloy consent seam** — 034-01 (`connectors/alloy/consent.js` + the trusted seam in `core/wrapped-sdk-host.js`)
  already splits coarse consent (analytics flows / pzn stripped). 045-02 grounds how hold-until-granted composes with it.

## Assumptions

<!-- Spec 064-02 / ADR-0020 — grounding-by-probe (risk-gated). -->

**A1 (two independent enforcement paths — GROUNDED 2026-09-11).** g-ads uses the **core seal** (`core/airlock.js`
`egressVerdict` non-strict + `heldBeacons`/`setConsent` buffer+flush); **alloy** uses its OWN path
`core/wrapped-sdk-host.js` (strict `egressVerdict` + a per-purpose seam **strip** — 034-01, `:336-338`; today
**pending → DROP**, with a hold+flush refinement already **named** at `:106-109`). So the core-seal change (045-01)
**does not touch alloy and cannot regress 034-01.** Alloy's hold-until-granted (045-02) refines wrapped-sdk-host.js's
pending→drop to **hold+flush**, preserving 034-01's strip (the analytics interact still flows under
analytics-granted/pzn-denied). Residual (grounded in 045-02): whether a *personalization-only* alloy egress exists to
buffer independently, vs pzn being strip-only on the shared interact — the ADR-0023 kill criterion scopes the limit.

**A2 (ad-hold requirement — GROUNDED).** The container holds ads under `ad_storage`-denied (R-009 §(b) denied re-capture,
23→2). A different adopter profile that fires cookieless ads under denial is a named future variant, not this spec.

## Decomposition

**SPIDR — Rules first (the seal verdict), then the two connector applications.** Not a spike (the mechanism is grounded);
the value is enforcement parity. Each slice ships observable behavior verifiable by unit + the 038 parity harness.

- **045-01 (Rules — the core seal opt-in mode):** `egressVerdict` (`core/consent.js`) + `createAirlock`
  (`core/airlock.js`) gain a per-instance **`holdOnDenied`** flag (mirroring `consentStrict`): when set, a **denied**
  governing purpose → **hold** (buffer+flush) instead of send; unset (default) → today's behavior (denied→send,
  pending→hold, granted→send, strict→drop). The existing `heldBeacons`/`setConsent` flush is reused as-is. **No connector
  opts in within this slice** — GA4 stays default (send); the flag is proven by unit tests. Accepts ADR-0023.
  `arch_review: true` (seal-model change). Delivers: the opt-in hold-until-granted mechanism, connector-agnostic.
- **045-02 (Rules — alloy):** refine **`core/wrapped-sdk-host.js`**'s consent handling (the already-named `:106-109`
  follow-up) from **pending → DROP** to **hold+flush**, preserving 034-01's per-purpose strip; ground the exact alloy
  egress topology (A1). Delivers: alloy buffers under unresolved consent + flushes on grant, analytics interact still
  flows under pzn-denial.
- **[044-02](../044-google-ads-connector/slice-02-denied-seal-hold.md) (the g-ads consumer, in spec 044):** reframed to
  *prove* g-ads holds under `ad_storage`-denied via this mode (declared purpose + tests: denied→held, grant→flush, never
  a cookieless AW send). Depends on 045-01.

## Slices

- [045-01 — the seal hold-until-granted mode (egressVerdict purpose classification)](slice-01-seal-hold-mode.md)
- [045-02 — apply hold-until-granted to alloy (preserving 034-01)](slice-02-alloy-hold.md)
- (g-ads consumer: [044-02](../044-google-ads-connector/slice-02-denied-seal-hold.md), depends on 045-01)
