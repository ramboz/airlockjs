---
status: DONE
dependencies: [064-03, 064-04, 067-05, 067-07, 067-08, 067-10, 067-12]
last_verified: 2026-11-20
---

## Slice 064-17 — B1: Environment snapshot and storage seeding (pilot)

**Goal:** Location, referrer, viewport, screen, UA and client hints, the apex (getTld) probe, the `context` option, and cookie, localStorage and sessionStorage before-state reach the chamber as real host values and match the recorded corpus.

**DoR:**
- ✅ CAP done; B0 field-rule comparison landed. D8 recorded (spec 064 section 11; ADR-0062 Accepted).
- ✅ The Alloy-source rule table (B0) is available.

**Acceptance Criteria:**

1. `context` defaults to stock `[web, device, environment, placeContext]` and is fed by real host values. The hard-coded `airlock.example`, 1280x800 and `en-US` shims are gone. A reduced `context` is a site opt-in (D8, ADR-0062). The credentials denylist stays on; a field it removes is a documented difference, not a parity failure.
2. Replay feeds each fixture's recorded before-state (cookies, localStorage, sessionStorage) before the page loads (ADR-0061 point 1).
3. Fixtures S1 (with its one-factor variants), S2 and S5 compare clean through the chamber, including the exact expected differences of each variant (spec 064 section 4.3).
4. RulesEngine globals: the shim does not define `window.title/url/referrer/height/width`.
5. The count of captures needed beyond the corpus is written into spec 064 (more than 3 triggers a kill criterion).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

> 2026-11-13: depends on shared seal defaults (spec 067)
> 2026-11-13 (spec 067 s8 check 11): dependencies gain 067-05, 067-07, 067-08, 067-10 and 067-12. Removing the shim stand-ins is this slice's own job (067-08 only changed the default `context`).
> Open hand-offs from spec 067:
> - From 067-08: `location.href` is cleared while `origin` and `hostname` stay, so check whether the pinned 2.31.1 web collector falls back to the `location` object when `url` is denylisted. High-entropy client hints are not collected. The default `location` placeholder is kept when the web group is unset (apex probe).
> - From 067-03: a seeded stale Alloy consent cookie that says "in" while page consent is pending makes Alloy send, and the seam drops the event (not held).

> 2026-11-20 implementation notes (pilot):
> - **Replay harness** (`rig/adobe-b1-replay.mjs`, `rig/b1-chamber-entry.js`, `test/adobe-b1-replay.test.js`): real Chromium via Playwright, the real `bootAlloy` and the unmodified chamber worker (a rig wrapper only tees what the chamber hands the seam and lets the rig call `getIdentity`/`appendIdentityToUrl`), the pinned Alloy 2.31.1 bundle (SHA-256 checked; downloaded and cached under `rig/out/b1`, or `AIRLOCK_ALLOY_BUNDLE`). Vendor hosts are answered from the fixture, so there is no live network. The before-state (cookies, localStorage, sessionStorage) is seeded before page scripts run (AC2); URL, referrer, viewport, screen, locale, timezone and UA come from the manifest. It imports `rig/field-rules.mjs` (`matchesFormat`) for the generated fields and does not copy any comparison code. Gated by `AIRLOCK_REAL_CHROMIUM=1`; the CI step is in `browser-oracle` only.
> - **AC1.** The chamber no longer holds `airlock.example`, `en-US` or a 1280x800 screen/window. Location starts empty; `bootAlloy` always sends `origin/protocol/host/hostname` from the `web` channel (the cookie scope needs them), and when the site did not list `web` only those four cross, never URL, referrer or title. Fixes found by the replay: an empty referrer is a real value (`webReferrer.URL: ""`); Alloy reads viewport from `documentElement.clientWidth/Height`, so the shim now feeds those too (headed capture was 15 px narrower than the window setting; the replay subtracts it).
> - **AC3.** S1 base, repeats and the viewport, referrer, locale, timezone and edge-domain variants, S2 (base, repeat) and S5 fresh/returning compare clean; each variant's recorded delta from the S1 base is asserted to be exactly its spec 064 section 4.3 set (viewport: viewport and screen size; referrer: `webReferrer.URL`; locale: `Accept-Language` only; timezone: `localTimezoneOffset`, with `localTime` compared by shape). `s5-returning` makes no request and its ECID comes from the seeded cookies (the same page without the seed asks the edge).
> - **AC4.** The window shim defines none of `title/url/referrer/height/width` (nor inner/outer sizes); a source test pins it. `document.title` is a document field fed by the `web` group.
> - **AC5.** 0 extra captures (spec 064 section 4.11 and the review log). Page title and the headed scrollbar are derived from the corpus.
> - **Apex probe (067-08 hand-off).** `bootAlloy` measures the real registrable domain on the main thread with Alloy's own probe (`com.adobe.alloy.getTld`, expired at once) and sends `apex` in `init`; the chamber's sync cookie cache rejects a `Domain` outside it, as a browser rejects a public suffix. Result: `meta.state.domain` is the full host for `*.aem.page`, as recorded. Without a measured apex the cache keeps its old accept-all behaviour.
> - **`location` fallback (067-08 hand-off), answered.** Alloy 2.31.1 reads `location.href || location`. With `url` denylisted the old shim handed Alloy the location object and `sendEvent` failed inside Personalization. The shim now falls back to the host root (`https://<host>/`), the one page identity the chamber always holds. That is a documented difference from stock when a site denylists `url`, not a parity failure.
> - **Client hints (067-08 hand-off), carried.** High-entropy hints are still not collected (no `userAgentData` in the shim); the corpus fixtures s13-default and s13-vpn-ch belong to a later slice.
> - **Stale consent cookie (067-03 hand-off), carried.** Not changed here: no corpus fixture seeds an Alloy consent cookie, so replay does not exercise it. Still open: a seeded cookie saying "in" while page consent is pending makes Alloy send and the seam drops the event.
> - **Storage names.** The corpus only shows `com.adobe.alloy.<org>_AdobeOrg.consentHashes.Adobe.2.0` (localStorage) and `fonts-loaded` (sessionStorage) as after-state; no fixture has a storage before-state, so `ALLOY_STORAGE_NAMES` stayed undeclared here (no grant, chamber storage in memory; grounded later in 064-27) and storage seeding is covered by unit tests only.
> - **For 064-18 (egress bridge).** The seal's endpoint ceiling is `https://adobedc.demdex.net/ee/v1/interact` only, so it holds `edge.adobedc.net/ee/<cluster>/v1/interact` (S2, the returning profile) and `adobedc.demdex.net/ee/v1/identity/acquire` (S5; `getIdentity` fails with "held at the seal: endpoint-ceiling" and `appendIdentityToUrl` re-asks). The replay therefore compares what the chamber emitted (the `rig-observed` tee), not what the network saw; only S1 has network headers (Accept-Language and Origin match the recorded ones). Host order per CAP: fresh page views go to `adobedc.demdex.net` first, then `edge.adobedc.net`; a returning profile goes to edge only. `s5-returning` sends nothing.
> - **Review (Opus 5.5, 2 rounds, reviews/slice-17-*.md).** Round 1: compliance pass, reconciliation pass, craft needs-changes (K1: apex probe ignored a narrowed cookie grant). Round 2: K1 fixed (probe skipped when the grant omits `com.adobe.alloy.getTld`); pass. The unnarrowed main-thread probe before consent is kept: stock Alloy probes the same way.
