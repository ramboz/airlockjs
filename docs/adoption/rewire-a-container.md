# Rewire a tag-manager container onto airlock

> The **scripted adoption path** ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E8): a
> developer rewires an intuit-class site's TBT-dominant vendor tags (GA4, Google Ads, Floodlight, Meta, …) from its
> Tealium / GTM / Launch container onto airlock — **page-side, with no container-owner or container-profile change** —
> and measures the Lighthouse/TBT win plus vendor-boundary parity it delivers. This is **developer-provable**
> ([ADR-0029](../decisions/adr-0029-mvp9-developer-side-after-arm.md)): every step is in the developer's control; nothing
> here needs the tag-manager owner. The one thing it does *not* do is default the rewire for real production traffic —
> that live-attribution switch is the container owner's call (see [Limits](#limits)).

**Audience.** A developer on an EDS/Franklin (or any) site whose `<head>`/bootstrap script they can edit, whose page is
weighed down by a handful of TBT-dominant vendor tags loaded through a tag manager.

**What you get.** The four TBT-dominant vendor runtimes stop loading on the page; airlock re-emits their governed beacons
from a Web Worker (off the main thread); the rest of the container is untouched; and you have a measured before/after to
prove the win.

---

## Overview: the five steps

```
1. SURVEY   — find the vendor tags to migrate: their runtime URLs (host + ?id=) and ids.
2. SUBTREE  — vendor the airlock dist into your repo (git subtree add).
3. SUPPRESS — install airlock's native-tag suppressor BEFORE the container loads.
4. BOOT     — boot(config) the airlock connectors with the real ids + consent mapping; push page_view.
5. MEASURE  — Lighthouse before/after (TBT), the 038 parity harness, the vendor-console receipt.
```

Steps 3–4 are gated behind an opt-in query param (e.g. `?martech=airlock`) so a normal load pulls **zero** airlock code
and costs nothing. The container's tag loader still runs — airlock only neutralizes the migrated vendors' runtimes and
re-emits their equivalents; every other tag loads as before.

---

## 1. Survey — which tags, and how do they load?

Rewire only the **TBT-dominant** tags — heavy vendor *runtimes* (`gtag/js`, `fbevents.js`, …), not the whole container.
Capture the page's runtime-load waterfall (not just its beacons) so you know the exact URL/query shape to suppress. A
headless probe works (see [`rig/erp-runtime-waterfall.mjs`](../../rig/erp-runtime-waterfall.mjs) for a reference):

- Does the container load each Google vendor as its **own** `googletagmanager.com/gtag/js?id=<ID>` runtime, or one shared
  runtime? (Both happen; the matcher recipe differs.)
- What are the ids? (Analytics/Ads/Floodlight ids are usually in the container config; a **pixel id** may live only in the
  runtime tag template and must be read off the live page.)

Record, per vendor: the runtime URL host + path + the distinguishing query key (`?id=`), and the id.

## 2. Subtree — vendor the airlock dist

airlock ships a **dist-rooted** ref (`dist` branch / `dist-vX.Y.Z` tag — [spec 031](../specs/031-distribution-setup/spec.md))
whose *root* is the servable tree (`eds.js`, the suppressor, the chamber workers). Import it wholesale:

```bash
git subtree add --prefix scripts/airlock <airlock-remote> dist
# later: git subtree pull --prefix scripts/airlock <airlock-remote> dist
```

`scripts/airlock/` now holds `eds.js` (exports `boot`), `tag-suppressor.js` (exports `installTagSuppressor`), and the
`*-chamber.worker.js` files — served **same-origin** (the workers are loaded via `new Worker(new URL('./x.worker.js',
import.meta.url))`, so they must be siblings of `eds.js`).

## 3. Suppress — before the container loads

Install airlock's native-tag suppressor ([spec 049](../specs/049-native-tag-suppressor/spec.md)) **before** the tag
manager injects the vendor runtimes (on EDS, at the eager pre-container hook — the same place a data-layer trap installs).
Declare a `suppress` matcher per migrated vendor runtime, keyed on host + path + `?id=`:

```js
import { installTagSuppressor } from './airlock/tag-suppressor.js';

installTagSuppressor({
  suppress: [
    { host: 'www.googletagmanager.com', pathname: '/gtag/js', query: { id: '<ADS_ID>' } },
    { host: 'www.googletagmanager.com', pathname: '/gtag/js', query: { id: '<FLOODLIGHT_ID>' } },
    { host: 'www.googletagmanager.com', pathname: '/gtag/js', query: { id: '<GA4_ID>' } },
    { host: 'connect.facebook.net' }, // the pixel runtime (host-only is the intended over-broad case)
  ],
  onDiagnostic: (d) => console.debug('[airlock suppressed]', d.transport, d.url),
});
```

- **Do NOT match the consent stack** (OneTrust/CMP scripts, first-party consent CDNs). Suppressing those stalls consent →
  the container never resolves → nothing loads. Keep matchers vendor-scoped.
- **The airlock-egress carve-out is by transport, not URL.** airlock re-emits at the container's *byte-identical* beacon
  URLs (parity), so a URL allow-set can't separate the two. The suppressor exempts airlock's own egress by its transport
  signature — `fetch(url, { keepalive: true })` — unconditionally ([spec 049-02](../specs/049-native-tag-suppressor/spec.md)).
  You do **not** need an `allow` entry for airlock's endpoints.

## 4. Boot — the off-thread runtime

Boot the airlock connectors with the real ids and your consent surface, then **push the page-load event** (see the gotcha):

```js
import { boot } from './airlock/eds.js';

const handle = await boot({
  connectors: [
    { type: 'ga4-gtag',   measurementId: '<GA4_ID>' },                                  // /g/collect
    { type: 'google-ads', conversionId: '<ADS_ID>' },                                   // ccm/collect
    { type: 'floodlight', conversionId: '<FLOODLIGHT_ID>', src: '<SRC>', activityType: '<TYPE>', cat: '<CAT>' },
    { type: 'pixel', vendor: 'meta', pixelId: '<META_PIXEL_ID>' },                      // /tr
  ],
  // Map the CMP's consent groups → the purposes they grant. Real CMPs usually split analytics and
  // advertising into distinct groups — map each to only what it grants (don't grant ad purposes off an
  // analytics-only category). airlock reads OneTrust's resolved surface (window.OnetrustActiveGroups) and
  // re-derives on OptanonWrapper changes; a denied ad-consent HOLDS the ad beacons, a mid-session accept
  // FLUSHES them (the consent-gated flow).
  onetrust: { groupPurposeMap: {
    '<ANALYTICS_GROUP_ID>': ['analytics_storage'],
    '<ADVERTISING_GROUP_ID>': ['ad_storage', 'ad_user_data', 'ad_personalization'],
  } },
});

// GOTCHA: airlock's boot does NOT auto-capture a page_view — it is push-driven. Emit the page-load event
// the native vendor tags fire automatically, or nothing dispatches (`handle.stats().dispatched` stays 0):
handle.push({ event: 'page_view', page_location: location.href, page_title: document.title });
```

**Guard the install** so a failed airlock arm can never halt the page's own martech (the eager hook is usually awaited):

```js
try {
  const { installAirlockRewire } = await import('./airlock-gate.js'); // your steps 3+4, one module
  await installAirlockRewire();
} catch (e) { console.error('[airlock] rewire arm failed; native martech continues:', e); }
```

`ga4-gtag` auto-sources `client_id` from the `_ga` cookie and `session_id` from the per-stream `_ga_<stream>` cookie, so you
usually pass only `measurementId`.

## 5. Measure — prove the win

- **Lighthouse/TBT before-vs-after** — compare the container-as-shipped page vs the `?martech=airlock` page, mobile-throttled,
  median of N runs. [`rig/lh-r010.mjs`](../../rig/lh-r010.mjs) gives an **upper-bound stand-in**: it *network-blocks* the four
  vendor runtimes rather than booting airlock, so it measures the tags-**removed** ceiling and does **not** include airlock's own
  boot cost — the suppressor's main-thread patching + the worker spin-up (airlock's *runtime* is off-thread and adds no TBT, but
  its boot touches the main thread). The true airlock-**booted** net win (≤ that ceiling by that small main-thread cost) needs a
  measurement on a host where airlock actually boots against the live container, i.e. a real deploy — Chrome Overrides
  can inline the suppressor but cannot serve airlock's same-origin workers, so it measures suppression, not the booted arm.
  **Frame it as a lab TBT/Lighthouse win** — these tags are TBT-dominant and INP/LCP/CLS-neutral.
- **Beacon parity** — the [038 parity harness](../specs/038-parity-harness/spec.md) is the per-protocol semantic oracle: it
  normalizes native↔airlock shapes and confirms airlock's beacon carries the same attribution-bearing fields, **modulo each
  connector's owned identity gap-map** (e.g. the Meta connector is identity-free by construction — no `_fbp`/`fbc`/`ud[*]` —
  which the oracle scores as owned/expected-dropped, so "parity" means *protocol + non-identity fields*, not a claim airlock
  reproduces the container's identity payload).
- **Console receipt** — confirm airlock's beacons arrive in the vendors' debug surfaces (GA4 DebugView, Meta Test Events,
  Google Ads / Floodlight diagnostics). This needs vendor-console access for those properties (an org-class grant) — or run
  it against your **own test properties**, in which case it proves *protocol conformance*, not the site's attribution parity.
  Record which you used. **Meta gotcha:** a pixel that only fires on consent-accept / a tracked interaction emits no `/tr` on a
  bare no-interaction load — drive it (accept consent, fire the tracked event) before reading the Meta receipt, or you record a
  silent pixel.

---

## The zero-deploy developer proof (Chrome Local Overrides)

You can prove the suppress-side on the **real production host** without deploying anything and without the container owner,
using Chrome DevTools **Local Overrides**:

1. Enable Sources → Overrides on the prod host.
2. Override the one bootstrap file the host already serves (e.g. `scripts.js`) to install the suppressor on `?martech=airlock`.
   **Chrome will not serve *new-path* files on an SPA/app-shell host** (they return the app-shell `text/html`), so *inline*
   the suppressor into that one overridable file rather than adding `airlock-gate.js` + the dist as separate override files.
3. Load `<host>/?martech=airlock` vs `<host>/`: the migrated runtimes are gone on the airlock arm, present on the native arm —
   captured in a real browser, with the site's real consent + container.

This is what makes the suppression developer-provable end-to-end; the off-thread re-emit is shown on a deployed preview branch
(the emit half needs airlock's workers served same-origin, which a real deploy provides and Overrides cannot).

## Limits

- **No production live-attribution switch.** Defaulting `?martech=airlock` for real users would suppress their conversions —
  the container owner's call. This path proves the mechanism + the win; flipping it on for production traffic is the residual
  ([ADR-0029](../decisions/adr-0029-mvp9-developer-side-after-arm.md)).
- **Lab, not field.** The measured win is Lighthouse/TBT (lab). It is not a field INP/LCP/CLS claim — for these tags those are
  neutral.
- **The customer-custom chain is never migrated.** Only the generic, connector-backed vendors are rewired; a bespoke
  ECS/TrackStar/Segment chain is left entirely to the container ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) R2).

---

## Worked example — `erp.intuit.com` (the reference-site trial, [spec 050](../specs/050-mvp9-reference-site-rewire-trial/spec.md))

The four TBT-dominant tags on the intuit-erp Tealium container (`intuit/ies-erp/prod`): GA4 `G-GCCMSJL6CT`, Google Ads
`AW-1030811807`, Floodlight `DC-1996823` (each a separate `gtag/js?id=` runtime), and the Meta pixel `fbevents.js`. Wired via
a `?martech=airlock` gate; validated 2026-09-16 in an authenticated browser:

- **Suppress (real prod, Chrome Overrides).** Same host, granted consent: native `/` fires all four runtimes + their beacons
  (129 resources); `?martech=airlock` suppresses **all four + their beacons**, the ~14-template tail intact (94 resources).
  (airlock re-emits the GA4/Ads/Floodlight/Meta beacons but not Google Ads' `pagead/viewthroughconversion` leg — the one
  deliberate parity drop, out of connector scope.)
- **Re-emit (deployed preview branch).** airlock fires all four governed beacons: GA4 `/g/collect`, Google Ads + Floodlight
  `www.google.com/ccm/collect`, Floodlight `ad.doubleclick.net/activity`, Meta `/tr`. Boots clean under strict CSP + Trusted Types.
- **The win (`lh:r010`, mobile slow-4G, median of 5).** Blocking the four runtimes drops **TBT 487 ms → 127 ms (−360 ms,
  −74%)** and lifts the Lighthouse score **86 → 96**; LCP (~1.4 s) and CLS unchanged — a clean lab TBT win, INP/LCP/CLS-neutral.
  This is the tags-**removed** upper bound (`lh:r010` network-block, not the airlock-booted arm); the booted net win is ≤ this by
  airlock's own small main-thread boot cost, which a deployed booted-arm measurement would quantify (carried).
- **Parity.** The 038 harness passes for all four vendors (102 tests).

## References

- [ADR-0029 — MVP9 after-arm is page-side and developer-controlled](../decisions/adr-0029-mvp9-developer-side-after-arm.md)
- [ADR-0030 — vendor-generic native-tag suppressor](../decisions/adr-0030-native-tag-suppressor.md)
- [spec 049 — native-tag suppressor](../specs/049-native-tag-suppressor/spec.md) · [spec 031 — distribution setup](../specs/031-distribution-setup/spec.md) · [spec 038 — parity harness](../specs/038-parity-harness/spec.md)
- [spec 050 — reference-site rewire trial](../specs/050-mvp9-reference-site-rewire-trial/spec.md) (the worked example) · [releases/mvp9.md](../releases/mvp9.md)
