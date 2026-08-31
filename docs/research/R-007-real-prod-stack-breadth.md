---
status: OPEN
topic: A real customer prod martech stack, classified by airlock-fit — the breadth-validation benchmark for "what we want to support"
created: 2026-08-31
related:
  - ../releases/mvp4.md
  - ../releases/mvp5.md
  - ../product-vision.md
---

# R-007: Real prod martech stack — the breadth-validation benchmark

> This is an **open investigation**, not a decision and not committed work. It classifies a *real* customer
> production martech stack (21 tools, from a recent EDS/site engagement) against airlock's proven archetypes,
> to validate the architecture at breadth and shape the eventual connector roadmap. It is **deliberately
> beyond current scope** (airlock hosts GA4 + Adobe/alloy today) — a north-star benchmark, per the maintainer.

## Question

Does airlock's architecture (two proven connector archetypes + capability-mediated egress + consent-at-the-seal)
actually cover a *real* production martech stack — and where is the honest boundary of "what we want to
support"?

## Sources / findings

The stack (maintainer-supplied, 2026-08-31), classified by **airlock-fit archetype**:

### 1. Wire-protocol / pixel connectors — airlock's sweet spot (declared events → declared endpoints)

| Vendor | Purpose | Fit |
|---|---|---|
| **GA4** | Web analytics (Measurement Protocol) | ✅ **SUPPORTED** (`airlock/ga4`) |
| Google Ads | Advertising / conversions (gtag, `_gcl_au`) | Wire-protocol (gtag/conversion) |
| Floodlight / CM360 | Advertising / conversions (doubleclick, DC-1996823) | Pixel |
| Meta (Facebook) Pixel | Advertising (`fbevents`, `_fbp`) | Pixel |
| LinkedIn Insight | Advertising (`px.ads.linkedin.com`) | Pixel |
| Microsoft / Bing UET | Advertising (`bat.bing.com`, `_uetsid`/`_uetvid`) | Pixel |
| Reddit Pixel | Advertising (`_rdt_uuid`) | Pixel |
| The Trade Desk | Advertising / DSP (`adsrvr.org`) | Pixel |
| Outbrain | Advertising (`__obref`) | Pixel |
| OpenAI Pixel | Advertising / analytics (`bzr.openai.com`) | Pixel |

**~10 vendors — the majority.** All are gtag/pixel-shaped (image/`fetch` beacons + a cookie or two). airlock
already does the *hardest* wire-protocol case (GA4 MP with its schema + conformance oracle). **The
highest-leverage roadmap item is a generic `pixel`/tag connector archetype** — one connector generalizing the
GA4 pattern would cover this whole cluster at once.

### 2. Wrapped-SDK connectors — the alloy archetype (stock vendor SDK in a chamber)

| Vendor | Purpose | Fit |
|---|---|---|
| **Adobe Experience Cloud** | Analytics / audiences (AMCV, `s_ecid`, `demdex`) | ✅ **PARTIALLY SUPPORTED** (`airlock/alloy` — confined + endpoint-ceiling + config-integrity; payload/consent governance is the MVP3 alloy split) |
| Marketo Munchkin | Marketing automation tracking (`_mkto_trk`) | Wrapped-SDK |
| Demandbase | ABM / firmographics | Wrapped-SDK |
| Segment | Customer data platform (`analytics.js`, `ajs_anonymous_id`) | Wrapped-SDK — **and a meta-connector** (see Open questions) |

**4 vendors.** Validates the wrapped-SDK archetype. Confirms the alloy work generalizes.

### 3. Forms / lead capture — the formjacking threat surface (airlock's security-thesis headline)

| Vendor | Purpose | Fit |
|---|---|---|
| Marketo **Forms2** | Lead-form embed + submit capture | **New pattern — high value** |

A **distinct, uniquely-airlock** pattern. Forms are the *exact* Magecart/formjacking threat the vision names
("a single compromised tag can read form fields and exfiltrate data") — the security concern "no current TMS
addresses." A **governed form-capture** pattern (capture form submits as typed events, PII-governed by the
MVP3 payload governance) is arguably the **most compelling security story** in the whole stack.

### 4. Consent management — the consent-input SEAM source (not a connector to sandbox)

| Vendor | Purpose | Fit |
|---|---|---|
| **OneTrust** | Consent management (`privacy-cdn`, `geolocation.onetrust.com`) | **Consent-input driver** (ADR-0007 seam) |

airlock **consumes** OneTrust's consent vector; it does not host it. This **names the concrete first CMP
driver** for ADR-0007's consent-input seam (which today ships only the host-callback driver, with `gtag`/TCF
named as follow-ups) — a direct roadmap item: a **OneTrust consent-input driver**.

### 5. Architecturally EXCLUDED by design — the honest boundary (vision no-gos)

| Vendor | Purpose | Why excluded |
|---|---|---|
| FullStory | Session recording | Needs full DOM-mutation streaming → vision no-go ("session replay / full DOM-mutation streaming — antagonistic to no-DOM-access") |
| LivePerson | Live chat | A DOM-rendering interactive widget → incompatible with "connectors have no ambient DOM" |
| LiveRamp | Identity resolution | Vision no-go ("identity resolution and a first-party cookie store") |
| Akamai mPulse (Boomerang) | Real-user monitoring | Needs main-thread `PerformanceObserver` + timing — **partial-fit at best, and overlaps airlock's OWN diagnostics** (see Open questions) |

**Crucial finding: a real stack contains tools airlock excludes *by design*.** "Host 100% of the stack" is
**never** the goal — the goal is "host the governable-event-emitting majority + **honestly** exclude the
DOM-native / identity / replay ones." This is a *strength* of the positioning (airlock is opinionated about
what belongs off the main thread), not a gap.

### 6. Infra — not a page martech tag

| Vendor | Purpose | Fit |
|---|---|---|
| Akamai (CDN + Bot Manager) | CDN + bot defense (`_abck`, `bm_sv`, `AKES_GEO`) | Out of scope (server-side / edge infra, not a page tag) |

## Options / pros & cons

**What the roadmap should prioritize (leverage order):**

1. **A generic `pixel`/tag connector archetype** — covers ~10 of the stack's ad/analytics pixels at once;
   generalizes the proven GA4 wire-protocol connector. Highest leverage.
2. **A OneTrust consent-input driver** — small, high-value; makes the ADR-0007 seam real against the actual
   CMP in the stack.
3. **A governed form-capture pattern (Marketo Forms2)** — the security differentiator; the formjacking story
   made concrete.
4. **More wrapped-SDK connectors** (Marketo Munchkin, Demandbase) — the alloy archetype generalizes.

## Open questions

- **Segment is a meta-connector.** airlock could *host* Segment as a wrapped-SDK — OR airlock **is itself a
  governed fan-out engine**, so it could **replace** Segment's role (capture once, map + govern + dispatch to
  the declared destinations). Host-it vs replace-it is a genuine product decision, not obvious.
- **mPulse (RUM) overlaps airlock's own diagnostics/inspector (MVP4).** airlock already observes slow
  interactions + layout shifts (`aem-cwv-helper`) for its inspector + CWV scoreboard. Does airlock **subsume**
  the RUM role rather than host mPulse? A potential differentiator (one fewer tag), or a scope creep.
- **Pixel archetype = the third connector archetype?** The vision named two (wire-protocol, wrapped-SDK). The
  ad-pixel cluster (gtag/image-beacon) may be a distinct-enough third archetype (fire-and-forget image/`fetch`
  beacons, minimal mapping) to warrant its own connector shape — or it may just be the wire-protocol archetype
  with a thinner mapper. Probe before committing a new archetype.
- **How many pixels share a mechanism?** Most ad pixels are `gtag`/`fbq`/`uetq`-style global-queue shims —
  do they collapse into ONE wrapped-global-queue connector, the way alloy is one wrapped-SDK? Worth measuring.

## Conclusion

_Open._ **Preliminary read: the architecture validates well at breadth.** ~14 of ~19 real martech *tags* fit
airlock's two proven archetypes plus the forms + consent-driver patterns; the two archetypes airlock proved
(GA4 + alloy) are the two dominant real-world patterns. The honest exclusions (replay / chat / identity /
RUM) are vision no-gos, not gaps. The concrete roadmap the stack implies: **a generic pixel connector** (the
big win), **a OneTrust consent driver**, **governed form capture**, and a decision on **Segment (host vs
replace)** and **mPulse (host vs subsume)**.

Promoted to: n/a yet — feeds the MVP5 breadth Split + the post-MVP5 connector roadmap; promote a `pixel`
connector archetype and a OneTrust consent driver to specs when that roadmap is picked up.
