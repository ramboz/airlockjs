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
> this spec only produces the vector that drives it. Drafted 2026-09-13 **without a live OneTrust probe** — the OneTrust
> runtime surface is UNVERIFIED (`## Assumptions`), grounded as a 047-01 DoR.

## Overview

The OneTrust consent-input driver is the **first concrete driver** on ADR-0007's consent-input seam. ADR-0007 pins consent
as a per-purpose **vector** (`core/consent.js`'s `CONSENT_PURPOSES` — the Consent Mode v2 four `analytics_storage` /
`ad_storage` / `ad_user_data` / `ad_personalization`, plus `functional` / `personalization`) fed IN through a driver —
"Consent Mode `gtag`, IAB `__tcfapi`, or a host callback" (ADR-0007 `:98-101`) — and the runtime today ships only the
**host-callback** path: the `consent` boot param folded pre-construction in `adapters/eds/index.js` plus the
`handle.setConsent(vector)` mid-session update (spec 017). This driver is the code that **produces** that vector from
OneTrust and calls that update — **another source onto the same seam, not a new seam**
(`docs/refinement-todo.md:273-277`).

It is a **main-thread input driver**. OneTrust runs on the main thread and the seam is pre-construction on the main thread,
so the driver reads OneTrust's resolved consent there, maps OneTrust's **site-defined consent groups → the purpose vector**
via a **host-provided category→purpose map**, and hands the runtime only the resolved vector (ADR-0003 minimal snapshot). It
runs **no chamber, opens no worker, performs no egress** — it feeds the seal, which then gates egress exactly as it already
does: denied / pending ad purposes hold (045's `holdOnDenied`), and a later OneTrust grant flushes them (the
"OneTrust-accept flow").

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
  "pinned with the seam." This spec pins the **OneTrust facet**: the group→purpose mapping shape + the OneTrust source
  surface (047-01, `arch_review: true` — likely a new ADR or an ADR-0007 amendment).

## Assumptions

<!-- No live OneTrust probe was run before drafting; the OneTrust runtime surface below is external domain knowledge, not
     repo-grounded (ADR-0020 §1 — grounding-by-probe). Grounding these is a 047-01 DoR. Per ADR-0052, the "which surface is
     canonical" claim is a *selection among* known OneTrust APIs, not an enumeration that no other surface exists. -->

**A1 (OneTrust exposes resolved consent client-side — UNVERIFIED).** The driver assumes OneTrust's resolved consent is
readable on the page via its documented runtime surface — the active-group set (`window.OnetrustActiveGroups` and/or the
`OptanonConsent` cookie's `groups=` list) — and that groups map to a small set of site-defined categories. **Not probed** on
`erp.intuit.com`: some deployments resolve consent server-side or gate the globals behind loader timing. *Grounding: 047-01
DoR — a live redacted OneTrust capture, local-only per R5.*

**A2 (a change signal fires on consent update — UNVERIFIED).** 047-02 assumes OneTrust emits a change event the driver can
subscribe to (`OneTrust.OnConsentChanged(cb)` and/or the `OptanonWrapper()` global) delivering the updated active groups.
Not probed; verify which fires on this deployment and whether it carries the new state or requires a re-read.

**A3 (category→purpose mapping is site-specific ⇒ host-provided — design GROUNDED, values UNVERIFIED).** OneTrust category
IDs are site-defined, and R-007 §4 records that the reference site maps OneTrust categories → Consent Mode v2 in its Tealium
profile — so the *mapping is inherently site-specific*, and the driver takes it as **host config** (a
`{ <groupId>: ConsentPurpose[] }` map) rather than hardcoding intuit's IDs. The *design* (host-provided map) is decided; the
*concrete intuit mapping values* are UNVERIFIED (Tealium-profile-internal) and are a 047-01 DoR to capture.

**A4 (OneTrust "not yet resolved" ⇒ pending — design choice resting on A1/A2).** The intended mapping is: group present in
the active set ⇒ its purposes `granted`; a mapped group absent while OneTrust *is resolved* ⇒ `denied`; OneTrust not
loaded / not yet resolved ⇒ the purpose is **omitted** (→ `resolveConsent` pending → the seal holds), matching core's
fail-to-pending. This depends on A1's "is OneTrust resolved yet" being cleanly detectable; if it is not, the boot-time
verdict for that pre-resolution window is an open sub-question for 047-01's arch pass.

## Decomposition

**SPIDR — Path (by consent-lifecycle phase).** The driver's value is "OneTrust's resolved consent reaches the seam as a
purpose vector," and the two paths through that story are the **initial** read (page load) and the **change** (mid-session).
Initial-at-boot first — it feeds the pre-construction `consent` param and is the larger, contract-defining piece; change
second — it reuses 01's mapping and adds the subscription + `setConsent`. **Not a spike:** the seam, the taxonomy, and the
egress hold/flush are all built and grounded; the only unknown is OneTrust's own surface, a bounded integration grounding (a
047-01 DoR), not a design-blocking research question. `functional` / `personalization` purposes and non-EDS host adapters are
out of scope (MVP8 is ad-conversion — the Consent Mode v2 four).

- **047-01 (Path — initial consent at boot)** — a OneTrust consent-input driver module reads OneTrust's resolved active
  groups at boot, maps them (host-provided category→purpose map) to the `core/consent.js` vector over the Consent Mode v2
  four, and feeds the `adapters/eds/index.js` `consent` boot param. Defines the driver module + the group→purpose mapping
  contract + the OneTrust source surface. `arch_review: true` (new module boundary + pins ADR-0007's open seam facet —
  candidate ADR); `frame_review: true` (rests on A1 / A3 / A4). Delivers: on page load the seal starts from OneTrust's actual
  consent — granted ad purposes send, denied / pending hold.
- **047-02 (Path — mid-session consent change)** — the same driver subscribes to OneTrust's consent-change signal, re-maps
  through 01's contract, and calls `handle.setConsent(vector)`, flushing 045-held beacons on the grant edge (the
  "OneTrust-accept flow"). `arch_review: false` (reuses 01's contract; no new boundary); `frame_review: true` (rests on A2).
  Delivers: accepting / changing consent in the OneTrust banner mid-session releases held ad beacons — the live accept-flow.

## Slices

- [047-01 — OneTrust boot consent vector → the seam's `consent` param](slice-01-boot-consent-vector.md)
- [047-02 — OneTrust consent-change → `handle.setConsent` (accept-flow flush)](slice-02-consent-change-update.md)
