---
status: IN_PROGRESS
dependencies: [064-02, 064-03]
last_verified:
kind: spike
claimed_by: adobe-cap-capture-064-04
---

## Slice 064-04 — CAP: the capture session

**Goal:** Record the Adobe corpus (S0 to S13) once, per spec 064 sections 4 and 5, under ADR-0061.

**DoR:**
- ✅ D1 to D8 recorded. T2, B0 done. Owner has filled in the POC site URL and datastream ID (section 9) if the probe is used, and scheduled the settings window (D7).

**Acceptance Criteria:**

1. S0 positive control is recorded first with full fan-out and the capture mode stated.
2. Every fixture carries its full stored input state and passes the credential check.
3. Run order follows section 5.1, including the restore step and the Alloy bundle SHA check.
4. The owner's normal-browser capture (S12) is compared field by field; fixed or generated differences go to the owner before freeze.
5. Corpus size is 48 recordings: S9 states are recorded once without a repeat and the agent polls for changes (D12); S10 runs on the POC site without Launch (D10). A window past about 3 h continues in a second short sitting.

**DoD:**
- Corpus committed and frozen; the freeze note lists live-only rows and any gap.

**Anti-horizontal-phasing check:** One session producing the corpus every B-slice consumes; the pilot (CAP plus B1) proves it.

## Implementation notes: Phase A (agent-only states)

Status stays IN_PROGRESS. Phase A is done: 28 of 28 planned recordings stored under `test/fixtures/adobe-capture/` (one JSON per recording: `manifest` + `capture` + full `requests` fan-out). Session total so far 29 attempts against the kill-criterion-4 limit of 60 (one re-record, below). The owner settings window, restore step, S11, S13, S12, freeze and review are not started.

**Tooling (step 0).** The 051-08 recorder and its test were restored from `b61e42a9^` unchanged apart from the Node 22 sync-loader seam fix B0 used. Its rules (Edge-only, 8 requests, JSON-only) contradict full fan-out, so it is kept as history and the capture uses three new modules instead:
- `probes/adobe-compatibility/capture-recorder.mjs`: passive context-level recorder of every non-page-origin request plus the Alloy script (headers, body, status, response body, failure; bounds 200 requests and 1 MB per body). It SHA-256-hashes the Alloy bundle actually loaded and throws `AlloyPinError` on mismatch or absence; the driver exits 3 on it. Every recording matched the pin `7dd09409…32e8`.
- `capture-fixture.mjs`: scrubs the three withheld IDs to their labels, builds the manifest, runs `checkFixtureManifest` (vendor `adobe`) and the credential scan before anything is written. Extra capture metadata (POC SHA, source fixture, re-record reason, steps, UA) sits in a sibling `capture` block because the manifest schema is closed.
- `capture-session.mjs`: the CLI driver, one fixture per call, fresh persistent profile per fresh recording, the same profile directory reused for returning ones (the manifest names `source_fixture`). Withheld IDs are read at run time from a file outside the repo.
- Tests: `test/adobe-capture-recorder.test.js` (+ restored `test/adobe-stock-wire-recorder.test.js`).
- The 051-07 stock-wire checker has a rigid decisioning-flow schema (`case`, `expected`, `proposition`, at most 8 requests); it does not fit the S0 to S9 fixtures, so every fixture passes `checkFixtureManifest` and the credential scan, and the stock-wire checker was not applied. Applying it to S10 is open.

**POC site.** `adobe-rnd/aem-eds-airlock-poc` main `27054432f4f3248ddb6d24cf44b0bab54bf08023` (previous main `2bd8accf`):
- New strictly opt-in capture gate `?airlock-capture=v1&run=airlock064-<hex32>&state=S..&google-ads=off&meta-pixel=off` (scripts.js, `tools/airlock-stock/capture-entry.mjs`). It re-validates the public config window and loads only the SHA-pinned Alloy 2.31.1 bundle already vendored there; it sends nothing itself and the Playwright driver issues the `alloy` commands. Both `.aem.page` and `.aem.live` origins are accepted by the entry; the config's own `allowedOrigin` stays `.aem.page`. The Meta gate and the Google Ads loader are untouched.
- `runtime-config.json`: `enabled: true`, window 2026-11-19T16:20:38Z to 2026-11-25T16:21:38Z (6 days). It stays enabled for the settings window and day 2; set it back to `enabled: false` after the corpus is frozen.
- S10 reuses the existing stock gate with `case=no-offer` (a trusted Playwright click on `#airlock-stock-control`, consent granted by init script), so no new case was needed.
- The served Alloy bytes are identical to the pin on both origins (the trailing-LF note in spec 1 did not show up).

**Capture mode: headed.** S0 ran headed first, then headless, on fresh profiles. Both returned the same Edge handle set (`identity:result`, `personalization:decisions`, `locationHint:result`, `state:store`), the same Edge region header and a 200 on the same request. Neither response carries an Analytics receipt: that forward is server side and not wire-visible, so the Analytics receipt itself is not verifiable from the wire. Headed wins the tie. Recorded difference: the headless run also showed 5 `ot.aem.live` (AEM RUM) beacons, the headed run none, and the headless UA is `HeadlessChrome`. The `ot.aem.live` beacons also appear in `s1-referrer` (headed), so they look like RUM sampling and not a headless effect.

**Run decisions.**
- S1 base plus two same-day repeats, then viewport (800x600), locale (de-DE), timezone (Europe/Berlin), referrer (`https://referrer.example/start`). Edge domain kind: there is no first-party CNAME, so `s1-edge-domain` is a plain repeat on the default Adobe edge domain and records that (it is the same setup as base). Base viewport 1280x800, en-US, America/New_York.
- S2 is returning, reusing the S1 base profile (S2 base) and the S1 repeat-1 profile (S2 repeat). S5 returning reuses the S5 fresh profile.
- S4 is the no-decision shape. The airlock scope returns an empty `personalization:decisions` payload in the second request.
- S6: `out` and `in` and `pending-in` all start from `defaultConsent: pending` with two queued `sendEvent`s; `out` then `setConsent` n, `in` then `setConsent` y immediately, `pending-in` holds 3 s before `setConsent` y.
- S3 uses `xdm.eventMergeId` for the mergeId case.
- S8: `s8-blocked` aborts requests to the adobedc.net and demdex.net hosts, `s8-non200` uses a random placeholder datastream ID (Edge returns 400 `Invalid datastream ID`).
- S9-00: `edgeConfigOverrides` `enabled: false` for Target and Analytics on the sendEvent; the response has no `personalization:decisions` handle (compare S1).
- Egress is labelled `non-eea` / `default`, assumed from the owner's Pacific time zone; not independently verified from the wire.

**Re-record.** `s8-blocked` was recorded twice. The first take only aborted `edge.adobedc.net`, but the first Edge request goes to `adobedc.demdex.net`, so nothing was blocked. Its manifest carries the re-record reason.

**Findings (not quiet fixes).**
1. The first Edge request goes to `adobedc.demdex.net`, then Alloy follows the `locationHint` to `edge.adobedc.net/ee/or2/...`. Two Edge hosts per fresh page view, not one. The `demdex` host also sets a third-party `demdex` cookie, which appears in the stored cookie dumps and passes the credential check.
2. The first response on a fresh profile carries two `__view__` Target propositions (activities 3258675 and 3711334) with default-content items. This is not zero decisions, so the spec 6.2 premise that Target returns nothing needs the owner's attention before S4 is read: the airlock scope itself returns no decision, but `__view__` activities are live on this datastream.
3. `s5-returning` made no network request: with the stored ECID cookie `getIdentity` and `appendIdentityToUrl` answered from the profile.
4. Headed viewport reports an inner width of 1265 for a 1280 setting (scrollbar); headless reports 1280. The manifest viewport holds the configured size.

## Phase B notes (settings window, 2026-11-19)

Phase A passed the servo quality-gate (composite 1.0) before its push.

**Window-start baseline (read-only, owner signed in to a dedicated Playwright Chromium profile kept outside the repo; no save, activate, edit or delete click).** Org "Sites Internal", sandbox Prod. Datastream "Airlock Web Events - Test", last modified 2026-10-08 by the owner.
- Services: Adobe Analytics on, Adobe Target on. Nothing else (so AAM, AEP, Event Forwarding, Decisioning, AJO, Adobe Advertising are all off).
- Analytics: report suite = `owned test report suite`; Visitor ID namespace empty; report suite overrides empty.
- Target: property token = `owned Target property`; environment ID = `owned Target environment`; Third Party ID namespace empty; property token overrides empty.
- Geolocation and network lookup: all 15 boxes off. Device lookup: "Keep user agent and client hints headers"; lookup boxes off. IP obfuscation: None.
- First Party ID cookie: off, name empty. Third Party ID Sync: off, container ID empty, container overrides empty. Access type: Mixed Authentication. Media Analytics: off. Bot detection: IAB list off, no rules.
- Not read: the Data Prep mapping rules (the UI needs a sample-data step) and dynamic datastream configuration (DDC) rules. DS-34 stays live-only.

**Target.** Readiness activity "Airlock - Readiness Check - 20261008 - Verified" (ID 3864223, A/B Manual, workspace "Airlock - Test", property "Airlock - Adobe Compatibility (Test)", location `airlock.readiness.2e2319c8`) was Inactive and its schedule had ended 2026-10-28T03:15Z. The owner reactivated it in the UI, which Target ended at once. On the owner's instruction the agent set `endsAt` to 2026-11-30T23:59:00Z through the Target Admin API with the owner-provided OAuth server-to-server credential (kept outside the repo; no other field changed). Activities 3258675 and 3711334 could not be located from this login (all workspaces searched, ID URLs return "Something went wrong"); they are the `__view__` activities seen in every S0-S9 response. Report only; untouched.

**D3 / S4 active.** About 3 minutes after the date change the scope returned an `html-content-item` decision. `s4-active-base` and `s4-active-repeat` record that shape (30 attempts used; earlier `s4-base` and `s4-repeat` stay as the no-decision shape). The repeat reuses the base profile; its first Edge response carries the same airlock decision, and the later notification response has an empty decisions payload.

**S12 (owner normal browser, 2026-11-19).** `s12-owner` is the owner's normal Chrome: they loaded the capture page, ran `configure` and `sendEvent` from the DevTools console, and saved the Network HAR (31st attempt). Compared field by field with the agent S1 base request: the only differences are screen and viewport size, local time and offset (UTC-8), timestamp, the run ID in the URL and `queueTimeMillis`, all capture setup. Headers differ only by the HTTP/2 pseudo-headers and `pragma`; both responses are 200. The HAR has no cookies or storage, so the manifest input state is partial (see its `capture.owner_capture` note). No `getLibraryInfo` call and no page-load request in this recording. Nothing goes to the owner as a difference.

**S9 log (UTC times; each fixture's `capture.owner_change` holds the change, time and wait).** The driver gained `--owner-change/--change-at/--waited` and the `fpid` and `combined` scenarios. Propagation was polled with a direct Edge probe outside the corpus (not counted as attempts). Window went past 3 h (owner kept going; not a kill).
- S9-01 (19:23): Target environment ID switched to another existing one. No response change in 12 min of polling; recorded anyway (`s9-01`). The airlock decision stays.
- S9-02 (19:51): Target property token cleared. The airlock decision disappeared after about 61 s; the two `__view__` decisions stayed (`s9-02`).
- S9-03 (20:27): property token and environment ID restored. The owner had not added Audience Manager (it was not on the datastream), so this recording covers the Target restore only; the airlock decision returned after about 61 s.
- S9-04 (20:33): Audience Manager service on plus cookie and URL destinations on, in one save (DS-10, DS-11, DS-12 share this recording). No response change in 10 min; recorded (`s9-04`).
- S9-05 (22:28): Third Party ID Sync on, container ID 0. An `identity:exchange` handle appeared after about 61 s (`s9-05`).
- S9-06 (23:34): First Party ID cookie on, name `airlock064_fpid`. Fixed 10 min wait; response looked like S9-05 (`s9-06`, scenario `fpid`).
- S9-07, S9-08: skipped. The owner has no second Target environment, report suite, namespace, AEP dataset/schema or Event Forwarding property, and the OAuth credential cannot create them. Rows stay unverified.
- S9-11 (about 23:52, combined): Analytics and Target third-party namespaces set to `airlock064ns`; all Geo, Network and Device boxes on; IP obfuscation strongest; bot rule `referer` contains `referrer.example` (the UI offers no custom header). Overrides lists, Data Prep and Event Forwarding were not flipped. Waited 12 min; recorded with `--variant referrer` (`s9-11`).
- S9-10 (00:07, 11-20): Target service off. The decisions handle vanished after about 61 s (`s9-10`).
- S9-09 (00:09): Analytics service off. Fixed 10 min wait (`s9-09`).
- S9-12 (00:20): Access Type "Authenticated only". Waited 10 min. The unauthenticated sendEvent failed as expected (`s9-12`).
- Attempt count: 42 after S9-12 (corrected after the Phase B check). Earlier notes calling S12 the "31st attempt" are off by one; the running total after S12 was 32.
- Datastream was NOT yet restored at this point; restore follows.
- Restore (02:11 on 11-20): the owner restored every datastream setting to the baseline; the Target activity stays active to 2026-11-30 (owner choice). Waited 10 min, recorded `restore-s1` (attempt 43 of 60: 42 fixtures plus one Phase A re-record). Its response handles match `s1-base` (identity, personalization decisions, locationHint, state:store).
- Phase B totals: 43 attempts of 60 (the earlier 42 undercounted by one). Phase B stops here; day 2 (S11, S13) is next. The servo quality-gate ran for Phase A (composite 1.0) and for Phase B (see commit).
- Unexpected, for the record: activities 3258675 and 3711334 could not be located from this login; the readiness activity needed its end date extended through the Admin API (OAuth server-to-server credential, owner-directed); S9-03 restored only Target because Audience Manager was never on the datastream.

## Phase C notes: day 2 (2026-11-20) and freeze

- **S11** (owner chose to run day 2 now; UTC 2026-11-20, about 10 h after the Phase A S1/S3): `s11-s1` and `s11-s3`, each with a `capture.note` saying so. Compared with `s1-base` and `s3-base` (request, response body, response headers): only per-run values differ (page URL run id, timestamps and local time, request id, `x-request-id`, `date`, generated ECID and `demdex` cookie, the identity cookie payload). No drift in status, handle types, cluster (OR2) or location hint.
- **S13** (egress): the owner's VPN was already on (Basel, CH) when I first recorded, which I caught from a neutral IP check (CH, Basel-City). That run is kept as `s13-vpn-ch` (egress `non-eea`, exit `vpn-ch-basel`; CH is not in the EEA; the manifest region field only allows `eea|non-eea`). With the VPN off a neutral check showed US, California; `s13-default` (exit `default-us-ca`) was recorded then. The first default attempt reused the profile directory of the earlier run, so it carried state (7 requests); it was discarded and re-recorded with a fresh profile (the driver does not detect a reused profile dir as returning; finding for tooling). Neutral probe, both egresses: Edge `locationHint` `or2:1800`, `x-adobe-edge: OR2;9`. Response fields compared: no differences except per-run values. Nothing for the chamber to handle; no stop. The owner turned the VPN off afterwards. No VPN credentials were seen or stored.
- **Counts**: 46 fixtures against AC5's 48 (48 minus S9-07 and S9-08, which were skipped per spec). Attempts: 48 of the kill-criterion-4 limit of 60 (43 after Phase B, S11 x2, S13 x3 including the mislabelled and the stale-profile runs).
- **Finding for 064-17 and 064-18:** the first Edge call goes to `adobedc.demdex.net/ee/v1/interact` and later calls (with state) go to `edge.adobedc.net/ee/<cluster>/v1/...`. A returning profile used `edge.adobedc.net` only. The chamber must handle both hosts; the Analytics receipt is not wire-visible.

### Freeze note: live-only rows and gaps

- S9-07 and S9-08 unverified: no owner test values (second Target environment, report suite, namespace, AEP dataset and schema, Event Forwarding property). Rows stay "no effect (C)" unverified.
- S9-11 partial: no overrides lists, Data Prep or Event Forwarding flips; the bot rule used `referer` because the UI has no custom header.
- DS-34 and Data Prep not read.
- The Analytics receipt is not wire-visible; only Edge responses are recorded.
- Target activities 3258675 and 3711334 are not visible from the owner's login (their `__view__` decisions appear while the property is on).
- S12 `s12-owner` is a partial input state (owner HAR, demdex interact call only; no pin).
- S9-03 restored Target only, because Audience Manager was never on the datastream.
- S13 result: no response-field differences between the US default and CH VPN exits.
