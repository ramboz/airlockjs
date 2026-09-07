---
status: OPEN
topic: An indicative CWV bound for the intuit-class rewire — the shipped page vs the same URL with the four vendor runtimes network-blocked
created: 2026-09-07
related:
  - ../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md
  - ../releases/mvp7.md
  - ../releases/mvp9.md
---

# R-010: the rewire's indicative CWV bound

> This is an **open investigation**, not a decision and not committed work. It is a **MVP7 risk-first** measurement
> ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E11) that needs **no container-owner
> cooperation**, so it can run before the two-party MVP9 rewire — it tells us early whether the whole ladder is worth
> walking.

## Question

Roughly how much Core-Web-Vitals headroom does removing the four TBT-dominant vendor runtimes (Meta `fbevents.js`,
Google Ads `gtag.js`, Floodlight, and GA4's `gtag.js`) buy on the reference intuit-class site? The owner's report cites
601.5 → 204 ms with the three ad runtimes removed; this note turns that into **repo-recorded numbers** and bounds what
the MVP9 rewire can achieve.

## Method

- Lighthouse runs of the shipped page (`erp.intuit.com` or an equivalent intuit-class page) **vs the same URL with the
  four vendor runtimes network-blocked** via Lighthouse `blockedUrlPatterns` — a one-line `settings` addition to
  `rig/lh-core.mjs` (grounded 2026-09-07: `blockedUrlPatterns` is used by no rig today).
- Both container configurations: shipped (phase-split off) and `?martech-phase-split=on` (which defers Floodlight,
  Google Ads and Meta to `delayed_ready`).
- Mobile-throttled, N runs, report the median + the TBT/LCP/CLS deltas (reuse `rig/lh-core.mjs`'s median/band engine).

## What this bounds — and what it does not

- **Indicative, not a hard ceiling.** `blockedUrlPatterns` strips the vendors' **runtime** cost but **not** the
  container's per-template `PINIT`/`INIT` init (which the MVP9 native-exclusion after-arm also removes — see
  `intuit-erp/MARTECH.md` § Tag-template load limitation). So a *strong* result here is only an approximate ceiling on
  MVP9's achievable win; the real after-arm removes strictly more.
- **A modest result is the earliest, cheapest trip of the CWV kill criterion** (ADR-0018): if blocking the four
  runtimes barely moves TBT/CWV because the container's fixed cost (utag core, remaining template init, the customer's
  ECS chain, OneTrust — all out of 1.0 scope by R2) dominates, the ladder's premise is weak and the owner re-decides
  before MVP8/MVP9 are built.

## Open questions

- What is the actual repo-recorded TBT/CWV delta, on each configuration?
- Does it corroborate the owner's 601.5 → 204 ms figure (and under which configuration was that measured)?

## Conclusion

_Open._ Promoted to: — (feeds MVP7's go/no-go on the ladder + MVP9's win semantics, ADR-0018 E12).
