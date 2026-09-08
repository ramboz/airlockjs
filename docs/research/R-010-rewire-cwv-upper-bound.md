---
status: CONCLUDED
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

> **Progress — harness built 2026-09-07 (this note).** The measurement rig is implemented and green; only the live run
> remains, gated on **one input: the reference page URL** (see Method → Two gates). Built: `blockedUrlPatterns` +
> mobile-throttle support added to `rig/lh-core.mjs`'s `runLighthouseOnce` (backward-compatible — the lh-eds/lh-live
> callers are byte-identical; `test/lh-core.test.js` green, 24 tests), and a dedicated runner `rig/lh-r010.mjs`
> (`npm run lh:r010`) that reuses the lh-core median/summary/delta engine. **Run 2026-09-07 on `stage.erp.intuit.com`
> (N=5, mobile slow-4G): GO — the four vendor runtimes are ~70% of TBT (330→101 ms shipped); see Results + Conclusion.**
> Status → `CONCLUDED`.

## Question

Roughly how much Core-Web-Vitals headroom does removing the four TBT-dominant vendor runtimes (Meta `fbevents.js`,
Google Ads `gtag.js`, Floodlight, and GA4's `gtag.js`) buy on the reference intuit-class site? The owner's report cites
601.5 → 204 ms with the three ad runtimes removed; this note turns that into **repo-recorded numbers** and bounds what
the MVP9 rewire can achieve.

## Method

Implemented as `rig/lh-r010.mjs` (`npm run lh:r010`), reusing `rig/lh-core.mjs`'s median/summary/delta engine (the same
one lh-eds/lh-live use — not a parallel impl):

- **OFF vs ON on the same URL.** OFF = the shipped page; ON = the *same* URL with the four TBT-dominant vendor runtimes
  **network-blocked** via Lighthouse `blockedUrlPatterns` (added to `runLighthouseOnce` 2026-09-07; it was used by no rig
  before). Same host/cache/edge/origin → only the block varies, so the delta is meaningful (lh-eds's query-gate
  invariant). No page edit, no container-owner cooperation.
- **The four runtimes (default block set — confirm per page).** `*connect.facebook.net*` (Meta `fbevents.js`),
  `*googletagmanager.com/gtag/js*` (GA4 **and** Google Ads `gtag.js` — one runtime file, two ids), `*doubleclick.net*`
  (Floodlight `fls.` + Google Ads `googleads.g.`), `*google-analytics.com*` (GA4 collect residual). The reference site's
  exact runtime URLs live in its container (`intuit-erp/MARTECH.md`, **not in this repo**), so the set is best-effort and
  **overridable** (`BLOCK_PATTERNS=…`).
- **A recon pass grounds the set (R5 discipline).** Before any delta, one un-blocked Lighthouse pass lists which *real*
  requests the block set matches, with transfer sizes — so we confirm the patterns actually hit the four runtimes on
  *this* page rather than assuming (a speculative match would make the delta meaningless). `RECON_ONLY=1` runs just this.
- **Both container configurations:** shipped (phase-split off) and `?martech-phase-split=on` (defers Floodlight, Google
  Ads and Meta to `delayed_ready`) — configurable via `PHASE_SPLIT`.
- **Mobile-throttled** (slow-4G, 4× CPU — explicit preset), **N interleaved runs** (`LH_N`, default 5), report the median
  + the TBT/LCP/CLS/perf deltas per config (`delta_median = ON−OFF`; a negative TBT/LCP delta is headroom gained).

**Two gates before the live run:**
1. **The reference URL** — not pinned in this repo (the `intuit-erp/MARTECH.md` reference lives with the container owner).
   Needs a concrete intuit-class page that is **public and Lighthouse-loadable** (a marketing/landing page, not an
   authenticated ERP app the harness can't load).
2. **Running it against a third-party production site** — a bounded set of Lighthouse loads (N per arm × 2 arms × 2
   configs ≈ 20 page loads at N=5), read-only, no data submitted. Chrome + Lighthouse + network egress are all confirmed
   available in this environment, so once the URL is set the run produces real numbers here.

## What this bounds — and what it does not

- **Indicative, not a hard ceiling.** `blockedUrlPatterns` strips the vendors' **runtime** cost but **not** the
  container's per-template `PINIT`/`INIT` init (which the MVP9 native-exclusion after-arm also removes — see
  `intuit-erp/MARTECH.md` § Tag-template load limitation). So a *strong* result here is only an approximate ceiling on
  MVP9's achievable win; the real after-arm removes strictly more.
- **A modest result is the earliest, cheapest trip of the CWV kill criterion** (ADR-0018): if blocking the four
  runtimes barely moves TBT/CWV because the container's fixed cost (utag core, remaining template init, the customer's
  ECS chain, OneTrust — all out of 1.0 scope by R2) dominates, the ladder's premise is weak and the owner re-decides
  before MVP8/MVP9 are built.

## Results (2026-09-07 — `stage.erp.intuit.com`, N=5 interleaved, mobile slow-4G / 4× CPU)

The recon confirmed the block set hits the real runtimes on this page (Meta `fbevents.js` + `signals/config`, GA4
`gtag/js?id=G-…`, Google Ads `gtag/js?id=AW-…`, Floodlight `gtag/js?id=DC-…` + `ad.doubleclick.net/activity`) with no
false matches. Aggregate medians (no live identifiers recorded — ADR-0018 R5 / ADR-0020):

| Config | Arm | Perf | LCP (ms) | TBT (ms) | CLS |
|---|---|---|---|---|---|
| **shipped** | OFF (as shipped) | 88 | 1504 | **330** | 0.008 |
| **shipped** | ON (4 runtimes blocked) | 98 | 1389 | **101** | 0.007 |
| **shipped Δ (ON−OFF)** | | **+10** | −115 | **−229 (−69%)** | −0.001 |
| **phase-split=on** | OFF | 92 | 1392 | **344** | 0.007 |
| **phase-split=on** | ON (blocked) | 98 | 1391 | **92** | 0.007 |
| **phase-split Δ (ON−OFF)** | | +6 | −1 | **−252 (−73%)** | 0 |

- **TBT is the whole story.** The four vendor runtimes are **~70% of the page's blocking time** (shipped 330→101 ms;
  phase-split 344→92 ms). Removing them lifts the Lighthouse perf score to **98** (from 88 shipped / 92 phased) and the
  blocked-arm TBT (~90–100 ms) sits comfortably in the "good" band. LCP improves modestly on shipped (−115 ms), flat on
  phased; CLS is already negligible.
- **Phase-split is not a TBT substitute for the rewire.** `?martech-phase-split=on`'s OFF-arm TBT (344 ms) ≈ the shipped
  OFF-arm (330 ms) — on this measurement the container's own best phased config did **not** reduce load-time blocking
  (the deferred tags still execute within the mobile trace window, or the stage deployment doesn't honor the param —
  worth confirming). Blocking the runtimes helps equally in both arms, so the win comes from *removing* the runtimes,
  not from phasing them. This is exactly the "what airlock buys beyond what the container can already do" baseline
  ADR-0018 asks the MVP9 win to report against.

## Open questions

- ~~What is the actual repo-recorded TBT/CWV delta, on each configuration?~~ **Answered above.**
- **Owner's 601.5 → 204 ms figure** — *direction* corroborated (the vendor runtimes are the dominant TBT source, ~70%
  here), but not the *absolute* numbers: this run is mobile slow-4G / 4× CPU; the configuration and throttle behind the
  owner's report are unrecorded, so the two aren't directly comparable. A like-for-like reproduction would need the
  owner's throttle profile.
- **Does phase-split actually defer on the stage deployment**, or is the param inert there? (Secondary — doesn't change
  the go/no-go.)

## Conclusion

**GO — the ladder is worth walking.** Removing the four TBT-dominant vendor runtimes cuts the reference page's blocking
time by ~70% (−229 ms shipped, −252 ms phased) and lifts Lighthouse performance to 98. This is a **large** headroom, not
a modest one, and the residual blocked-arm TBT (~90–100 ms — the container core + out-of-scope tags, R2) does **not**
dominate — so ADR-0018's **CWV kill criterion is not tripped**. The premise behind MVP7→MVP9 holds on real, repo-recorded
numbers.

**Indicative, not a hard ceiling (E11).** `blockedUrlPatterns` strips the vendors' *runtime* cost but not the
container's per-template `PINIT`/`INIT` init, which MVP9's native tag-exclusion also removes — so the true MVP9 win is
**≥** this, and the ~90–100 ms blocked-arm TBT is an approximate *floor*, not the achievable minimum.

_Measured — the MVP7 risk-first go/no-go is answered (GO)._ Promoted to: — (feeds MVP7's go-decision + MVP9's win
semantics and before/after baselines, ADR-0018 E12; MVP9 re-measures the true rewire win on the native-exclusion arm).
