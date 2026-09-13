---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 047: OneTrust consent-input driver

> **MVP8 — Ad-Conversion Offloading** ([release plan](../../releases/mvp8.md), `committed` 2026-09-11). The **input** side of
> MVP8's consent story: the concrete **first CMP driver** onto ADR-0007's consent-input seam
> ([ADR-0007](../../decisions/adr-0007-consent-purpose-model.md)), authorized as the
> [ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E7 handoff item (R-007 §4). The reference
> site (`erp.intuit.com`) is OneTrust-owned, mapped to Google Consent Mode v2 in the customer's Tealium profile; airlock
> **consumes** OneTrust's resolved consent vector — it does not host OneTrust. The **egress** half — hold-until-granted +
> flush-on-accept (the "OneTrust-accept flow") — already shipped for the ad family
> ([ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) + [spec 045](../045-consent-hold-until-granted/spec.md));
> this spec only produces the vector that drives it. **Grounded 2026-09-13** by a live read-only probe of the reference
> site's OneTrust surface (`rig/onetrust-consent-probe.mjs`; raw capture local-only per R5) — see `## Grounding`; residual
> unknowns in `## Assumptions`.

## Overview

The OneTrust consent-input driver is the **first concrete driver** on ADR-0007's consent-input seam. ADR-0007 pins consent
as a per-purpose **vector** (`core/consent.js`'s `CONSENT_PURPOSES` — the Consent Mode v2 four `analytics_storage` /
`ad_storage` / `ad_user_data` / `ad_personalization`, plus `functional` / `personalization`) fed IN through a driver —
"Consent Mode `gtag`, IAB `__tcfapi`, or a host callback" (ADR-0007 `:98-101`) — and the runtime today ships only the
**host-callback** path: the `consent` boot param folded pre-construction in `adapters/eds/index.js` plus the
`handle.setConsent(vector)` mid-session update (spec 017). This driver is the code that **produces** that vector from
OneTrust and calls that update — **another source onto the same seam, not a new seam** (`docs/refinement-todo.md:273-277`).

It is a **main-thread input driver**. OneTrust runs on the main thread and the seam is pre-construction on the main thread,
so the driver reads OneTrust's resolved consent there and maps it to the purpose vector — **either** from OneTrust's own
group set via a host-provided group→purpose map, **or** from the already-resolved Consent Mode v2 signals OneTrust/Tealium
publish on the page (the live probe found *both* surfaces present; which is canonical is 047-01's arch decision — see
`## Grounding` §A3) — handing the runtime only the resolved vector (ADR-0003 minimal snapshot). It runs **no chamber, opens
no worker, performs no egress** — it feeds the seal, which then gates egress exactly as it already does: denied / pending ad
purposes hold (045's `holdOnDenied`), and a later OneTrust grant flushes them (the "OneTrust-accept flow").

Two entry points, two slices (SPIDR **Path**): the **initial** consent state at boot (feeds the `consent` boot param —
047-01) and the **mid-session** consent change (calls `handle.setConsent` on OneTrust's change signal — 047-02).

## What already exists (reuse — grounded 2026-09-13)

- **The consent-input seam (host-callback driver).** `adapters/eds/index.js` — `bootGa4Core({ consent })` folds a
  host-supplied ADR-0007 vector pre-construction (`:331-334`, the load-bearing 017-01 ordering) and gates `egressPurposes`
  on `consent` being wired at all (`:442-448`); the returned `handle.setConsent(v)` merges a mid-session update and flushes
  granted-held beacons (`:456`, 017-03 AC2 → `core/airlock.js`'s `setConsent`). The OneTrust driver PRODUCES the vector this
  seam consumes; **the seam is unchanged**.
- **The vendor-neutral purpose vector + resolver.** `core/consent.js` — `CONSENT_PURPOSES` (`:33`) is the exact taxonomy the
  driver targets; `resolveConsent` (`:59`) is **fail-to-pending** (an absent purpose = "no signal yet", never a silent deny
  or allow), which the driver mirrors: a purpose it cannot resolve from OneTrust is **omitted**, not forced. Consumed
  vendor-neutrally — the driver writes no GA4 / MP specifics.
- **The seal hold/flush + the ad-family `holdOnDenied` ("OneTrust-accept flow").** `egressVerdict` (`core/consent.js:115`)
  + `core/airlock.js`'s held-beacon buffer; 045-01's per-connector `holdOnDenied` opt-in escalates a *denied* ad purpose to
  **hold**, flushing on the grant edge (`core/consent.js:121-125`). This is the egress behavior the driver's grant event
  triggers — already built (spec 045 / ADR-0023); 044-02 / 046-03 proved it for Google Ads / Floodlight.
- **ADR-0007's seam contract (the OPEN part this spec pins).** ADR-0007 Open questions (`:227-240`) leave the consent-input
  seam contract **unpinned** — which surface (`gtag` / `__tcfapi` / host callback) and where the regime is declared,
  "pinned with the seam." This spec pins the **OneTrust facet**: the source surface + group→purpose mapping shape (047-01,
  `arch_review: true` — likely a new ADR or an ADR-0007 amendment).

## Grounding (live probe, 2026-09-13)

<!-- Grounded by a read-only live inspection of erp.intuit.com's OneTrust surface via
     rig/onetrust-consent-probe.mjs (no banner interaction — the probe never accepts/rejects consent).
     Raw capture is local-only per R5; only structural, non-PII facts appear below. The headless session
     was PARTIALLY DEGRADED (a 403 + null geolocation left the resolved active-group set incomplete vs the
     Consent Mode signals the page published) — resolved-set claims are hedged accordingly. -->

**A1 (OneTrust exposes resolved consent client-side — GROUNDED).** At boot the page exposes `window.OneTrust` (object),
`OnetrustActiveGroups` / `OptanonActiveGroups` (populated), `OneTrust.GetDomainData()` (the full group model), and the
`OptanonConsent` cookie (`groups=…`). `consentModel: "opt-out"`; the stack is Tealium-managed (`utag` profile
`intuit/ies-erp/…`) and the ad-linker cookies the sibling connectors read are present (`_gcl_au`, `_ga`, `_fbp`,
`_uetsid`). The surface exists and is populated — A1 confirmed.

**A2 (a change signal exists — mechanism GROUNDED, live delivery RESIDUAL).** `OneTrust.OnConsentChanged` and
`OptanonWrapper` are both `function`. The subscription seam 047-02 needs exists; that it *fires with the updated group set on
a real banner interaction* is unobserved (the probe did not click) — a residual (`## Assumptions`).

**A3 (source surface + mapping — REFRAMED by the probe; TWO grounded surfaces → 047-01's arch decision).** The site uses a
**custom, non-standard OneTrust taxonomy** (bare-numeric + `C00NN` + a `BG…` branch), **not** the vanilla C0001–C0004 the
first draft assumed. From `GetDomainData()` the Consent-Mode-relevant groups are: `3` Analytics & Customization →
`analytics_storage`; `4` Advertising (Targeting) → `ad_storage`; `41` Advertising (User Data) → `ad_user_data`; `42`
Advertising (Personalization) → `ad_personalization` (non-CM groups: `1` Essential [always active], `2` Performance/
Functionality, `5` Social, branch `BG394` "Allow Information Sharing", `C0018`/`C0024` survey/CRM). **Separately**, the
OneTrust→Consent Mode v2 mapping is *already resolved on the page*: the dataLayer carries
`gtag('consent','default',{all denied})` then `…'update',{all granted})`, and `google_tag_data.ics` holds the four signals
in airlock's **exact vocabulary**. So there are two candidate source surfaces:
  - **(a) OneTrust's own groups + a host-provided group→purpose map** (seed values grounded above). The true "OneTrust
    driver"; reads OneTrust's intent directly; requires the site-specific map (which is site-owned config, as R-007 records
    it living in Tealium today).
  - **(b) The already-resolved Consent Mode v2 signals** (`gtag` / `google_tag_data.ics`) — no map, already in airlock's
    vocabulary, but this is really ADR-0007's *Consent Mode `gtag` driver*, not OneTrust's own surface.
  **Probe caveat:** in the degraded session `OnetrustActiveGroups` (`,1,BG394,4,`) was **incomplete** vs both the granted CM
  signals and `GetDomainData().Groups[].Status` (`3` / `41` / `42` = active) — so option (a) must read
  `GetDomainData().Groups[].Status`, **not** the `OnetrustActiveGroups` string alone. **Recommendation (arch-pass call):**
  option (a) as the spec's "OneTrust driver" (title/MVP8-faithful, no gtag-internals coupling), with option (b) recorded as
  the sibling gtag-CM driver ADR-0007 also names — decided (and likely ADR'd) in 047-01.

**A4 (resolution model — GROUNDED).** Opt-out, US-default-granted: pre-interaction the four CM signals were UPDATED to
granted (the opt-out default *is* the resolved state; "resolved" ≠ "user clicked"). Resolution is network-gated, though —
the `403` + `geolocation: null` degraded it — so **"OneTrust present but not yet fully resolved" is a real state**; the
driver keeps core's fail-to-pending for it (omit → seal holds), never fail-to-granted.

## Assumptions

- **Live change-event delivery (A2 residual).** That `OnConsentChanged` / `OptanonWrapper` fire with the updated set when
  the user actually changes consent — grounded at 047-02 implementation (observe one real toggle), not asserted now.
- **Clean (non-degraded) resolved active-group set (A1/A3 residual).** A non-headless re-capture to confirm the *full*
  resolved group set and the chosen source surface's completeness (the degraded run's 403 left `OnetrustActiveGroups`
  partial) — a 047-01 implementation check, not a design blocker.

## Decomposition

**SPIDR — Path (by consent-lifecycle phase).** The driver's value is "OneTrust's resolved consent reaches the seam as a
purpose vector," and the two paths through that story are the **initial** read (page load) and the **change** (mid-session).
Initial-at-boot first — it feeds the pre-construction `consent` param and carries the source-surface + mapping contract;
change second — it reuses 01's contract and adds the subscription + `setConsent`. **Not a spike:** the seam, the taxonomy,
the egress hold/flush, *and now the OneTrust surface itself* are grounded (`## Grounding`); the open item is a bounded arch
choice (which source surface), not open-ended research. `functional` / `personalization` purposes and non-EDS host adapters
are out of scope (MVP8 is ad-conversion — the Consent Mode v2 four).

- **047-01 (Path — initial consent at boot)** — a OneTrust consent-input driver module reads OneTrust's resolved consent at
  boot **from the arch-chosen source** (§A3: (a) `GetDomainData().Groups[].Status` + a host group→purpose map, or (b) the
  resolved CM v2 signals), maps to the `core/consent.js` vector over the Consent Mode v2 four, and feeds the
  `adapters/eds/index.js` `consent` boot param. Defines the driver module + the source surface + the mapping contract.
  `arch_review: true` (new module boundary + pins ADR-0007's open seam facet — the (a)/(b) source decision, a candidate
  ADR); `frame_review: true` (rests on the A1/A2 non-degraded / delivery residuals). Delivers: on page load the seal starts
  from OneTrust's actual consent — granted ad purposes send, denied / pending hold.
- **047-02 (Path — mid-session consent change)** — the same driver subscribes to OneTrust's consent-change signal
  (`OnConsentChanged` / `OptanonWrapper`, mechanism grounded §A2), re-maps through 01's contract, and calls
  `handle.setConsent(vector)`, flushing 045-held beacons on the grant edge (the "OneTrust-accept flow"). `arch_review: false`
  (reuses 01's contract; no new boundary); `frame_review: true` (rests on the A2 live-delivery residual). Delivers:
  accepting / changing consent in the OneTrust banner mid-session releases held ad beacons — the live accept-flow.

## Slices

- [047-01 — OneTrust boot consent vector → the seam's `consent` param](slice-01-boot-consent-vector.md)
- [047-02 — OneTrust consent-change → `handle.setConsent` (accept-flow flush)](slice-02-consent-change-update.md)
