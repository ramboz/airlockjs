---
slice: 064-17 — B1: Environment snapshot and storage seeding (pilot)
pass: craft
round: 1
verdict: needs-changes
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T15:55:00Z
prompt_source: review prompt, slice 064-17 (commit 37373e33)
---

# 064-17 craft — Round 1

**Verdict: needs-changes. 1 blocking finding (K1), 5 non-blocking.**

Scope: `adapters/eds/index.js` (`probeApexDomain`, `sendStockContext`, `init`),
`connectors/alloy/{alloy-chamber.worker.js,stock-shim.js,sync-cookie-cache.js}`,
`core/stock-context.js`, `rig/adobe-b1-replay.mjs`, `rig/b1-chamber-entry.js`, the 4 touched test
files, and `.github/workflows/ci.yml`.

## What holds

- **Public-repo hygiene.** No secrets, tokens or local paths. The only account IDs are the public
  org `908936ED5D35CC220A495CD4@AdobeOrg` and datastream `23190fa7-…c297`
  (`rig/adobe-b1-replay.mjs:103-104`), which D9 allows. The bundle comes from the public CDN and is
  SHA-256 pinned (`:18-20`, `:42`). The cache dir `rig/out/` is git-ignored (`.gitignore:52`). Paths
  are built from `import.meta.url`.
- **The chamber is really unmodified.** `rig/b1-chamber-entry.js` only wraps `postMessage` (a tee)
  and adds a `rig-command` listener. Nothing reaches production bundles.
- **The sync-cookie-cache apex check** rejects a Domain outside the measured apex *before* the
  write-back (`sync-cookie-cache.js:58`), so a rejected probe write never reaches the main thread.
  With no apex, behaviour is unchanged, and that is tested (`test/alloy-sync-cookie-cache.test.js:105-109`).
- **Denylist and seal invariants.** Host fields still go through `collectStockContext` with
  `payloadDenylist` and the built-in list (`adapters/eds/index.js:1822-1826`), so a site can still
  denylist `hostname`. The seal ceiling is unchanged. The replay compares the pre-seal tee, and the
  slice says so (note line 45).
- **Stock fidelity fixes are real and sourced:** an empty referrer is a value
  (`core/stock-context.js:60-61`, `stock-shim.js:34`), and the viewport comes from
  `documentElement.clientWidth/Height` (`core/stock-context.js:82-85`, `stock-shim.js:49-50`).
- The CI step sits only in `browser-oracle`, behind `AIRLOCK_REAL_CHROMIUM=1` (`ci.yml:97-102`).

## Findings

### K1 — blocking: the main-thread apex probe bypasses the site's cookie-grant narrowing

`probeApexDomain()` (`adapters/eds/index.js:1568-1583`, called at `:1838`) writes
`com.adobe.alloy.getTld` straight to the real `document.cookie`. It runs on every boot, before
`init`, and before any consent. That cookie name is a governed entry in `ALLOY_COOKIE_NAMES`
(`connectors/alloy/connector.js:44`), under the 035-01/067-05 write-side gate (`grantedCookieNames`
plus `cookieGrantNarrowing`, `adapters/eds/index.js:1781-1785`). When a site narrows its grant to
exclude the probe, the chamber's own probe write is held at the write-back seam, but this new
main-thread write still lands. The site's explicit opt-in narrowing (ADR-0062 point 3, "a site can
narrow, never widen") is not honoured for this cookie. Nothing tests or documents it.

Two things are fine: consent-wise it is consistent, because `functional` is not a `*_storage`
purpose and pending is not a denial (`core/wrapped-sdk-host.js:234-243`), and stock Alloy also
probes before consent. So "before consent" is a parity match, not the defect.

Fix: probe only when `resolveCookieGrant(ALLOY_COOKIE_NAMES, cookieGrantNarrowing).names` still
grants `com.adobe.alloy.getTld`. Otherwise send no `apex`, which keeps the old accept-all
behaviour. Add one `eds-boot-alloy` test where a narrowed grant leaves `document.cookie` untouched
and `init` carries no `apex`. State the "main-thread probe before consent = stock" choice in the
slice notes.

### K2 — non-blocking (owner call): the host-root `href` fallback sends a made-up page URL

`applyStockContextToShims` sets `location.href = origin + "/"` whenever `href` is empty
(`stock-shim.js:93-97`). This has two effects:

1. When a site denylists `url`, egress now carries `web.webPageDetails.URL: "https://<host>/"`
   instead of no URL. The test asserts exactly that (`test/adobe-b1-replay.test.js:114-118`).
   The site asked for the field to be removed and gets a different value, and every page reports
   as the root. That cuts against ADR-0062 point 2 ("the worker no longer fakes page values").
2. When `web` is not listed, the same fallback feeds Alloy's non-context readers of `location.href`
   (Personalization page surface `web://<host>/`, view scope, link handling). Stock Alloy with
   `web` excluded from `context` still reads the real URL there. So a reduced `context` silently
   becomes host-root decisioning, not just a smaller context block.

The fix for the crash in Personalization (`href || location` → string method on an object) is
correct. What is left is the stated difference. The slice note (line 41) records only case 1, and
only in the slice file. Fix: record both cases as a deliberate difference where they will last
(ADR-0062 consequences or `lightweight-decisions.md`). Or, as an alternative the owner should
weigh, keep the fallback for Alloy's internal reads but strip `web.webPageDetails.URL` at the seam
when `url` is denylisted.

### K3 — non-blocking: host identity now crosses even with `context: []`

`sendStockContext` used to return early for an empty list. It now always adds `web` and trims it to
`origin/protocol/host/hostname` (`adapters/eds/index.js:1820-1826`). The 067-08 assertion that
nothing crosses was rewritten (`test/eds-boot-alloy.test.js:332-335`). The reason given (cookie
scope and apex) holds, and the four fields are no more than the `Origin` header already reveals.
But "a reduced `context` is a site opt-in" now has a floor that no doc states. This is folded into
reconciliation R4. No code change.

### K4 — non-blocking: the replay turns the hold off instead of supplying the recorded consent state

The rig boots with `consentHold: false` (`rig/adobe-b1-replay.mjs:141`). ADR-0062 point 5 says a
comparison *supplies a consent state that matches the recording*. With the hold off, the seam's
consent drop and the in-chamber `setConsent` delegate are not on the compared path, so the
production default (hold, then grant) is not what was proven equal to stock. Fix: boot with a
granted vector (`consent: { analytics_storage: "granted", … }`) and keep `consentHold` at its
default. If that changes the request sequence (for example a `set-consent` call), say so in the notes.

### K5 — non-blocking: test quality

- AC4 is pinned by a regex over source lines 340-344 only (`test/alloy-stock-shim.test.js:107-118`),
  and `/en-US/` and `/\b1280\b|\b800\b/` over the whole worker are fragile (a comment trips them).
  A behavioural check in the real-Chromium run, such as a `rig-command` that reports
  `["title","url","referrer","height","width"].map(k => k in window)` inside the chamber, would
  test the real Proxy (`alloy-chamber.worker.js:361-367`) and could replace the regex.
- The `if (seen)` header check is optional (compliance C3), and the storage seed branch is never
  run with data (compliance C2).
- Seeded cookies get invented `secure: true, sameSite: "Lax"` (`rig/adobe-b1-replay.mjs:119`). The
  fixtures do not record these attributes. Harmless here, but worth a comment.

### K6 — non-blocking: probe and cache edge cases

- `document.cookie.includes("com.adobe.alloy.getTld=1")` (`adapters/eds/index.js:1576`) is a
  substring test. A leftover host-only probe cookie (for example from an interrupted stock run)
  makes the first candidate, the bare TLD, "succeed", and the cache then accepts any `*.page`
  Domain. Stock Alloy has the same weakness. A cheap hardening: write a unique value per boot.
- The cache accepts a Domain *below* the host (`y.x.aem.page` on host `x.aem.page`), which a
  browser rejects (`sync-cookie-cache.js:58`). No Alloy path does this today.

## Round 2 (author fix, 2026-11-21)

K1 fixed: `probeApexDomain` now takes the resolved grant and skips the probe (no cookie write, no `apex` in `init`) when a site's narrowed grant omits `com.adobe.alloy.getTld`. Test: `test/eds-boot-alloy.test.js` ("064-17: a narrowed cookie grant ..."). The unnarrowed probe before consent matches stock Alloy and is kept. Verdict after round 2: **pass** (K2 to K6 non-blocking, carried as listed in this file; K2's host-root fallback is the documented difference in the slice notes).
