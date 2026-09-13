---
status: CONCLUDED
topic: Per-vendor TBT attribution + an INP arm for the reference-site offenders — which tags dominate blocking, and does flipping them move INP?
created: 2026-09-12
related:
  - ../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md
  - ../releases/mvp8.md
  - ../releases/mvp9.md
  - ./R-008-costly-dom-martech-containment.md
  - ./R-010-rewire-cwv-upper-bound.md
---

# R-011: per-vendor TBT attribution + the INP null result for the reference-site offenders

> This is an **open investigation**, not a decision and not committed work. It extends
> [R-010](R-010-rewire-cwv-upper-bound.md) (the *aggregate* CWV bound) two ways — (1) a **per-vendor** TBT split so we
> know *which* offenders to prioritise, and (2) an **INP** arm that tests R-008's interaction-latency half directly on
> the reference page. Like R-010 it needs **no container-owner cooperation** (network-block proxy for a flip), so it runs
> before the two-party MVP9 rewire.

> **Run 2026-09-12 on `erp.intuit.com`** (N=5 interleaved, mobile slow-4G / 4× CPU). `stage.erp.intuit.com` is dead as
> of 2026-09-11; the live public page is `erp.intuit.com`. Status → `CONCLUDED`.

## Question

Prompted by the maintainer's hypothesis: *instrument the reference site, flip the few big offenders, and see the impact
on INP.* Two sub-questions:

1. **Per-vendor TBT** — R-010 showed the four vendor runtimes are ~70% of blocking time *in aggregate*; **which** of them
   dominate? (The answer decides connector priority.)
2. **INP** — does flipping the offenders actually improve **INP**, or is their damage confined to load-time (TBT)?

## Method

- **Per-vendor TBT.** Reused `rig/lh-r010.mjs`'s engine (`rig/lh-core.mjs` `runLighthouseOnce` + median/summary/delta)
  via a local attribution wrapper: **one shared OFF baseline** (shipped page) vs per-vendor and aggregate **ON** arms,
  N=5 interleaved, mobile slow-4G / 4× CPU. Per-vendor isolation is possible because — recon-confirmed — each product
  loads its **own** `gtag.js` bundle (Floodlight `id=DC-…` ≈142 KB, Google Ads `id=AW-…` ≈151 KB, GA4 `id=G-…` ≈154 KB;
  Meta `fbevents.js` + `signals/config` ≈166 KB), so they are network-blockable independently rather than as one file.
- **INP.** A Playwright trusted-click storm on the live page (Chromium, mobile viewport + CDP 4× CPU), offenders toggled
  per arm via `page.route` abort on the same URL substrings. Measured with an **unfloored** probe (a capture-phase click
  listener + double `requestAnimationFrame` from `event.timeStamp` to next paint) because Event-Timing's
  `durationThreshold` floors at 16 ms and would drop the fast interactions. **Navigation is hard-blocked** (`route.abort`
  on main-frame navigation requests after initial load) — a necessary fix after learning that a clicked link's *same-host*
  navigation silently resets the observer *and* re-runs the init script (v1 read 0 interactions for this reason). The
  stimulus is a controlled click on a safe inert point; the martech tags attach *delegated document-level* click
  listeners, so their per-click cost is still exercised under an identical stimulus across arms.
- **Environment / discipline.** `erp.intuit.com` is public and Lighthouse-loadable, reachable via Bash-launched Chromium
  (it is blocked in the in-app browser pane by org policy). Captures are **LOCAL ONLY**; no live vendor identifiers are
  recorded here (ADR-0018 R5 / redaction discipline) — IDs are truncated (`id=DC-…`, `src=…`, `G-…`).

## What this bounds — and what it does not

- **Indicative, not a hard ceiling (ADR-0018 E11).** Network-blocking strips each vendor's **runtime** cost, not the
  container's per-template `PINIT`/`INIT` init that a true Tealium native exclusion also removes — so the real per-tag
  win is **≥** these numbers.
- **Per-vendor deltas are NON-additive.** With one runtime gone the others still saturate the main thread, so the
  single-tag deltas *overstate* — the **combined** figure is the honest "flip all of them" result, and it is smaller than
  the sum of the parts.
- **The INP arm is a controlled-stimulus lab measure**, not field INP and not a worst-case CTA interaction (see Open
  questions).

## Results (2026-09-12 — `erp.intuit.com`, N=5 interleaved, mobile slow-4G / 4× CPU)

### TBT attribution — shipped baseline TBT ≈ **621 ms**, perf **83**

| Flipped off (network-blocked) | TBT ON (ms) | Δ TBT vs shipped | Perf |
|---|---|---|---|
| Meta (`fbevents.js`) | 532 | **−89 (−14%)** | 84 |
| Google Ads (`id=AW-…` + `googleads.g.doubleclick.net`) | 329 | **−292 (−47%)** | 85 |
| Floodlight (`id=DC-…` + `ad.doubleclick.net/activity`) | 311 | **−310 (−50%)** | 91 |
| GA4 (`id=G-…` + `/g/collect`) — *noisy* | 422 | −199 (−32%) | — |
| **Three ad tags together** (Meta + Google Ads + Floodlight) | **232** | **−389 (−63%)** | 95 |
| All four | 191 | −430 (−69%) | 96 |

- **Floodlight and Google Ads dominate** (~−310 and ~−292 each); **Meta is the lightest** (~−89). Priority order for a
  rewire is Floodlight → Google Ads → Meta.
- The **three-ad combined** delta (−389 ms, −63%) lands almost exactly on the site owner's own 601.5 → 204 ms analysis —
  an independent cross-check. Adding GA4 reaches −430 ms (−69%).
- LCP is unaffected (the tags load post-LCP); large LCP values in individual runs were load-stall noise, and the GA4
  arm's perf column is unreliable for the same reason — TBT stayed robust throughout.

### INP — controlled trusted-click storm (per-interaction latency, ms)

| Arm | p75 | p98 | max |
|---|---|---|---|
| shipped | 11 | 38 | 52 |
| three ad tags blocked | 11 | 19 | 29 |
| all four blocked | 12 | 27 | 30 |

- **p75 is flat (~11–12 ms) across all arms**; the p98/max differences are noise (high per-run variance, non-monotonic
  across arms). There is **no INP penalty attributable to the offenders**. Interaction latency on this page is already
  deep in the "good" band (<200 ms) with or without them.

## Open questions

- **Worst-case / real-CTA INP.** The controlled stimulus exercises the tags' delegated listeners on their cheap bail
  path. A storm on *real* CTAs/menus (where e.g. Meta's button-click autotracking does real work) was **not** run: doing
  it against **live production** fires real conversions/leads and pollutes analytics (and the environment's safety
  classifier blocks it, correctly). The reproducible path is to run that variant against a **local dev** instance, or to
  read **field INP** (below).
- **Field INP is the real-world truth.** helix-rum and Intuit o11y already collect field INP on the site; if there is a
  specific slow interaction in the wild, this lab storm would not have hit it. That's the authoritative source for "is
  INP even a problem here."
- **GA4 arm noise.** 3/5 GA4 runs stalled on load (network variance); its TBT delta (−199) is directional only.

## Conclusion

**The "flip the offenders → INP impact" hypothesis does not hold for `erp.intuit.com`.** Flipping the ad offenders is a
**large, clean TBT/load win** (−389 ms / −63% for the three ad tags; −430 ms / −69% including GA4; perf 83 → 95/96) but an
**INP no-op** (p75 flat ~11 ms). Their cost is *boot* (parse/eval/init of ~600 KB of `gtag`/`fbevents`), not
per-interaction — so on this site the airlock case is a **TBT/CWV-load** story, exactly what ADR-0018's before/after
proof measures, not an interaction-latency one.

**Strategic upshot — this validates the MVP8 priority from the outside.** The two heaviest offenders (Floodlight, Google
Ads) are precisely the **two connectors not yet built (MVP8)**; the shipped connectors (Meta, GA4) cover only the light
end. So realising the compelling win on a real rewire is gated on **MVP8** (Floodlight + Google Ads connectors) → then the
**MVP9** two-party rewire. A useful dev-side next step that needs no container owner: build and parity-validate those
connectors against the real ad-ping captures this run already produced (LOCAL ONLY).

_Measured._ Promoted to: — (feeds **MVP8** Floodlight / Google-Ads connector prioritisation — [spec 044](../specs/044-google-ads-connector/spec.md) and the Floodlight connector — and MVP9's before/after win semantics, ADR-0018 E12; sibling to [R-010](R-010-rewire-cwv-upper-bound.md)).
