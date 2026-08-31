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

### 5. RUM / observability — the host-vs-SUBSUME bucket (airlock's special claim)

This bucket splits by **mechanism**, and airlock has a **unique relationship** with it: airlock is
**CWV-first and ships first-class diagnostics** (MVP4's inspector + CWV scoreboard, built on
`aem-cwv-helper`'s `observeSlowInteractions`/`observeLayoutShifts`). It already *measures the exact signals*
these tools collect. So RUM is not just "can airlock host it" — **airlock is a better RUM substrate**
(off-thread, governed, already measuring). The bucket:

| Vendor | Purpose | Mechanism | Fit |
|---|---|---|---|
| **Adobe `helix-rum-js`** | Sampled RUM (CWV + interaction samples → the AEM RUM pipeline) | A lightweight **sampled-beacon** sender — NOT DOM-native. And **already shipped in the EDS `aem.js` boilerplate** (`sampleRUM`) | **HOST-or-SUBSUME** — a beacon-emitter airlock can host as a connector, OR replace: airlock already computes CWV off-thread and could **emit governed RUM beacons itself** |
| Akamai mPulse (Boomerang) | RUM | Main-thread `PerformanceObserver` + a beacon | **HOST-or-SUBSUME** — the timing-collection wants the main thread, but the signal + the beacon are exactly what airlock's diagnostics already produce |
| MS Clarity (+ more) | Heatmaps + session recording, used "for RUM" | Predominantly **session-recording / DOM-mutation capture** | **Mostly EXCLUDED by mechanism** (§6) — its RUM/analytics *use* overlaps this bucket, but its *how* is DOM-native |

**The strategic read: airlock has a real claim to *be* the RUM/observability layer, not just host it.** On EDS
this is concrete — `helix-rum-js` is already on the page, and airlock's MVP4 diagnostics measure the same
CWV/INP/CLS signals. Positioning: *"airlock replaces your RUM tag — off the main thread, governed, and it's
already measuring."* This is the sharpest form of the "one boundary, three payoffs" thesis (CWV + datalayer +
security **+ the RUM layer that proves the CWV payoff**).

### 6. Architecturally EXCLUDED by mechanism — the honest boundary (vision no-gos)

| Vendor | Purpose | Why excluded |
|---|---|---|
| FullStory | Session recording | Needs full DOM-mutation streaming → vision no-go ("session replay / full DOM-mutation streaming — antagonistic to no-DOM-access") |
| MS Clarity | Heatmaps + session recording | Same mechanism as FullStory (DOM-mutation capture) — excluded **even when a customer's intent is "RUM/analytics"** (excluded by *how*, not *why*); its lightweight-analytics slice overlaps §5 |
| LivePerson | Live chat | A DOM-rendering interactive widget → incompatible with "connectors have no ambient DOM" |
| LiveRamp | Identity resolution | Vision no-go ("identity resolution and a first-party cookie store") |

**Crucial finding: a real stack contains tools airlock excludes *by design*.** "Host 100% of the stack" is
**never** the goal — the goal is "host the governable-event-emitting majority + **honestly** exclude the
DOM-native / identity / replay ones." A tool is placed by its **mechanism**, not the customer's stated
purpose (MS Clarity used "for RUM" is still session-recording under the hood → excluded). This is a
*strength* of the positioning (airlock is opinionated about what belongs off the main thread), not a gap.

### 7. Infra — not a page martech tag

| Vendor | Purpose | Fit |
|---|---|---|
| Akamai (CDN + Bot Manager) | CDN + bot defense (`_abck`, `bm_sv`, `AKES_GEO`) | Out of scope (server-side / edge infra, not a page tag) |

## Options / pros & cons

**What the roadmap should prioritize (leverage order):**

1. **A generic `pixel`/tag connector archetype** — covers ~10 of the stack's ad/analytics pixels at once;
   generalizes the proven GA4 wire-protocol connector. Highest leverage.
2. **A OneTrust consent-input driver** — small, high-value; makes the ADR-0007 seam real against the actual
   CMP in the stack.
3. **airlock as the RUM/observability layer** — especially on EDS, where `helix-rum-js` is already on every
   page and airlock's MVP4 diagnostics already measure the same CWV/INP/CLS signals off-thread. Host-or-subsume
   (§5 + Open questions). High strategic value: RUM becomes the proof of airlock's own CWV payoff.
4. **A governed form-capture pattern (Marketo Forms2)** — the security differentiator; the formjacking story
   made concrete.
5. **More wrapped-SDK connectors** (Marketo Munchkin, Demandbase) — the alloy archetype generalizes.

## Open questions

- **Segment is a meta-connector.** airlock could *host* Segment as a wrapped-SDK — OR airlock **is itself a
  governed fan-out engine**, so it could **replace** Segment's role (capture once, map + govern + dispatch to
  the declared destinations). Host-it vs replace-it is a genuine product decision, not obvious.
- **Should airlock *be* the RUM/observability layer (subsume), not just host it?** The RUM bucket (§5 —
  `helix-rum-js`, mPulse, and the analytics slice of Clarity/others) overlaps airlock's own MVP4 diagnostics:
  airlock already measures CWV/INP/CLS off-thread for its inspector + scoreboard. Two forks: (a) **host** each
  RUM tool as a connector (safe, generic), or (b) **subsume** — airlock emits governed RUM beacons *itself*
  ("airlock replaces your RUM tag, off-thread + governed + already measuring"), the sharper differentiator.
  On **EDS specifically** this is live: `helix-rum-js`'s `sampleRUM` is *already on the page* (in `aem.js`),
  so airlock must decide to **feed it, replace it, or coexist** — a concrete EDS integration decision, not a
  far-horizon one. Scope-creep risk if airlock over-reaches into being an RUM product; positioning win if it
  frames RUM as the proof-of-its-own-CWV-payoff.
- **Pixel archetype = the third connector archetype?** The vision named two (wire-protocol, wrapped-SDK). The
  ad-pixel cluster (gtag/image-beacon) may be a distinct-enough third archetype (fire-and-forget image/`fetch`
  beacons, minimal mapping) to warrant its own connector shape — or it may just be the wire-protocol archetype
  with a thinner mapper. Probe before committing a new archetype.
- **How many pixels share a mechanism?** Most ad pixels are `gtag`/`fbq`/`uetq`-style global-queue shims —
  do they collapse into ONE wrapped-global-queue connector, the way alloy is one wrapped-SDK? Worth measuring.

## Conclusion

_Open._ **Preliminary read: the architecture validates well at breadth.** The majority of the real martech
*tags* fit airlock's two proven archetypes (wire-protocol/pixel + wrapped-SDK) plus the forms + consent-driver
patterns; the two archetypes airlock proved (GA4 + alloy) are the two dominant real-world patterns. The honest
exclusions are **mechanism-based** — session-replay / heatmap / live-chat / identity-resolution (FullStory,
Clarity, LivePerson, LiveRamp) are vision no-gos by *how they work*, not gaps. The **RUM/observability bucket
is a strategic opportunity, not an exclusion**: airlock is CWV-first and already measures the signals, so it
can *be* the RUM layer (`helix-rum-js`/mPulse — host or subsume), which on EDS is a live integration decision
(`sampleRUM` is already on the page). The concrete roadmap the stack implies: **a generic pixel connector**
(the big leverage win), **airlock-as-RUM-layer**, **a OneTrust consent driver**, **governed form capture**,
and decisions on **Segment (host vs replace)** and the **RUM host-vs-subsume** fork.

Promoted to: n/a yet — feeds the MVP5 breadth Split + the post-MVP5 connector roadmap; promote a `pixel`
connector archetype, an RUM-layer decision (host vs subsume, EDS `sampleRUM` coexistence), and a OneTrust
consent driver to specs/ADRs when that roadmap is picked up.
