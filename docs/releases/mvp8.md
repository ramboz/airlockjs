# Release Plan: MVP8 — Ad-Conversion Offloading

> **New plan, 2026-09-07 ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E2).** The
> reframe made "adoptable with confirmed parity" the 1.0 bar, and the reference site's TBT is dominated by three ad
> runtimes (Meta `fbevents.js`, Google Ads `gtag.js`, Floodlight). MVP7 proves the parity harness + Meta Pixel + GA4;
> MVP8 offloads the **ad-conversion** tags that carry most of the cited TBT — the hardest, highest-value half of the
> rewire — plus the consent-input driver the reference site's CMP needs.

## Status

`committed`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

**Committed 2026-09-11 (explicit owner decision).** Ships as **v0.8.0**; sequenced after MVP7 (v0.7.0). The R-009 gate is
**cleared for the page-load family** — R-009(b)/(c) grounded the Ads/Floodlight page-load pings on a redacted
`erp.intuit.com` capture (governed GET beacons carrying Consent Mode v2; `ad_storage`-denied = seal-hold). First
committed connector: **[spec 044 — Google Ads (AW)](../specs/044-google-ads-connector/spec.md)** (DRAFT); Floodlight +
the OneTrust consent-input driver follow. The **conversion-ping proper** (enhanced-match hashes) and **console-level
attribution** remain MVP9; the **cross-site DMP sync** is E10 — none blocks the page-load connector scope.

## Problem / Baseline

- **The TBT that motivates the whole rewire lives in the ad-conversion tags.** On the reference site the three ad
  runtimes account for roughly two-thirds of martech TBT (the owner's 2026-09-05 report: 601.5 → 204 ms with them
  removed; R-010 will repo-record an indicative bound in MVP7). GA4 and Meta Pixel (MVP7) are the analytics anchor and
  the first parity proof; **Google Ads and Floodlight are where the CWV win actually is** — and they are the hardest,
  because a conversion ping is not just a beacon: it carries consent state, click identifiers, and linker/attribution
  semantics.
- **airlock has no Google Ads or Floodlight connector**, and the conversion-fidelity question is unproven: can an
  `gtag` AW conversion ping / a Floodlight DC activity ping be reproduced off-thread with **attribution parity** —
  Consent Mode v2, `gclid`/`_gcl_au`/`_gcl_aw`/`_gcl_dc`, linker, `wbraid`/`gbraid`, and the cross-site-cookie transport
  the container's tag rides? MVP7's R-009(b)/(c) answers the lab-observable half; the live attribution half is MVP9.
- **The reference site's consent is OneTrust-owned**, mapped to Google Consent Mode v2 in the customer's Tealium
  profile. airlock **consumes** a consent vector via ADR-0007's consent-input seam, which today ships only the
  host-callback driver — the concrete **OneTrust consent-input driver** is named but unbuilt (R-007 §4).

## Appetite

- **2-week small-batch box (proposed), scope gated on R-009.** Time fixed; scope flexes.
  - **Fixed core (if R-009 says the pings are reproducible):** the **Google Ads** + **Floodlight** connectors (with the
    E10 credentialed-transport decision applied), parity-confirmed by the MVP7 harness on redacted captures; the
    **OneTrust consent-input driver**.
  - **Variable / gives first:** the vendor-breadth tail; **Segment** (a generic CDP connector — R-007's host-vs-replace
    fork stays open, not forced this box).

## Solution Outline

- **Google Ads + Floodlight connectors**, shaped by R-009(b)'s findings — the conversion-ping wire shape, Consent Mode
  v2 handling (including the `ad_storage`-denied path: hold at the seal vs cookieless send, per ADR-0007's
  reshape-and-send model), click-identifier capture, and the E10 credentialed transport where R-009(c) shows attribution
  rides the cross-site cookie. Parity-confirmed by the MVP7 harness.
- **The OneTrust consent-input driver** (ADR-0007's seam) — airlock consumes OneTrust's resolved consent vector; it does
  not host OneTrust. The concrete first CMP driver against the seam that today ships only the host-callback.
- **Segment (variable/later)** — Twilio Segment is a *generic* vendor (a CDP with `analytics.js` / an HTTP tracking
  API), a legitimate connector target — but it is not a top TBT offender on the reference site (the cost is the
  customer-custom ECS chain around it, which is out of scope by R2), so it is not on the 1.0 critical path. R-007's
  host-vs-replace question stays open.

## Risks / Rabbit Holes

- **Conversion pings may not reach attribution parity off-thread.** If R-009(b)/(c) or the E10 decision shows Consent
  Mode / linker semantics that require the vendor runtime on the main thread — or E10 is rejected and the
  cookies-allowed-cohort divergence is material — the 1.0 rewire set does not silently shrink; the owner re-decides the
  bar (ADR-0018 kill criteria). **Do not build these connectors until R-009 grounds them.**
- **The `ad_storage`-denied path is subtle.** The reference profile enforces Consent Mode v2, so the container emits
  cookieless denied-state pings; airlock's connector must match that behaviour (hold vs cookieless send), not just the
  granted-state ping.
- **Segment scope creep.** Segment is tempting as "one connector, many destinations," but host-vs-replace is a genuine
  product decision (R-007) and off the 1.0 path — keep it variable.

## No-Gos

- **No customer-custom tags** (ADR-0018 R2) — the reference site's ECS/TrackStar/UX-Fabric chain (which feeds Segment)
  is validation-only, never a shipped connector or gate. A *generic* Segment connector is legitimate scope; the
  customer's enrichment chain on top of it is not.
- **No identity resolution / first-party cookie store** (vision no-go) — the connectors govern the vendors' *own*
  identifiers and cookies; airlock builds no identity.
- **No live vendor identifiers** — synthetic / redacted only (ADR-0018 R5).
- **No architecturally-excluded classes** (session-replay, live-chat, heatmap).

## JIG Handoff

- Gated on **R-009** (MVP7 risk-first, ADR-0018 E6) — connector scope is set by what the spike proves reproducible.
- New specs: **Google Ads connector**, **Floodlight connector** (both after R-009; apply the E10 transport decision),
  the **OneTrust consent-input driver** (ADR-0007 seam; ADR-0018 E7).
- Segment: a research/spec decision (host vs replace) only if pulled from variable into scope.

## Release-Check Criteria

- Google Ads + Floodlight conversion pings are **rewired off-thread with attribution parity** confirmed by the MVP7
  harness (on redacted captures) — or the scope is honestly cut per the ADR-0018 kill criteria, never by redefining
  parity.
- The **OneTrust consent-input driver** feeds the seal correctly (granted / denied / Consent Mode v2 states), verified
  against the reference profile's consent behaviour.
- **CWV preserved / improved** on the offloaded tags; **no live identifiers**; **no customer-custom tag** shipped.
- No regression to MVP1–7 (the stable-core contract, GA4/Meta/alloy/RUM connectors, the parity harness).

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Shaped 2026-09-07 (ADR-0018 Emergent E2) — "Ad-Conversion Offloading", ships as v0.8.0, scope gated on R-009._
