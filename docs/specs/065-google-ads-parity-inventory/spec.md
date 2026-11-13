---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-4, UC-5, UC-6, UC-7, UC-8, UC-9, UC-10, UC-11, UC-13, UC-14]
---

# Spec 065: Google Ads parity inventory (gtag.js)

> Frozen inventory and capture plan. Written 2026-11. Frozen unit: the captured gtag.js script build plus the account-settings states that change the tag's output (ADR-0061 point 3).
> Definition of done: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md). Not re-opened here.
> Target: [ADR-0040](../../decisions/adr-0040-reframe-onto-full-google-meta-compatibility.md), partly superseded by ADR-0061. Request authority: [ADR-0047](../../decisions/adr-0047-google-meta-request-authority.md).
> Sister specs: 064 (Adobe inventory, on `vendor-adobe`) and 066 (Meta inventory). This spec creates no new numbered specs; build work is an ordered slice list (section 9).
> Evidence it starts from: [R-015](../../research/R-015-google-meta-first-journey-evidence.md) (retained loader, owned test setup), [R-016](../../research/R-016-google-meta-request-authority.md), the [Google descriptor](../../../rig/parity/descriptors/google-ads.js).

## 0. Summary for the owner

This spec turns "full Google Ads compatibility" into a finite list we can build against. It plans one capture session that records the real gtag.js tag, so every slice can be proven against recordings instead of waiting on live runs.

Nothing live runs until you approve it: no captures, no Google calls, no production probes. Two read-only tasks and one tooling task may start before.

It also retires spec 059 as a plan. Section 8 closes or reframes every 059 slice. Section 9 replaces them with three pre-capture tasks, the capture session, and 14 slices (G1 to G14), each sized for one fresh session.

The main tradeoff is the same as Adobe's: we pay for one capture session before any slice. Google is harder in one way. Its tag is evergreen and remotely configured, and we reimplement it instead of running Google's code. So the session starts with a drift probe, and the pilot (capture session plus G1) has to show that our field rules are right, not only that the corpus is complete.

The decisions I need from you are in section 12, each with a recommendation. The big four: the EU exit, one settings window of about 3 hours (next to the Adobe one), whether the completeness probe may look at real sites' configs, and how to handle reading a customer's served config in production.

## 1. Scope and frozen inventory rules

- **Frozen unit (ADR-0061 point 3).** gtag.js is not versioned. The unit is the script build we capture (SHA-256 and byte length of every served `gtag/js?id=` response, recorded per manifest) plus the settings states in section 6. The retained loader (443,549 bytes, digest-checked 2026-11-05, R-015:37) is the baseline for the drift probe, not the pin. The pin is whatever the drift probe records on capture day.
- **Frozen after the capture session.** A later discovery goes to the next version's inventory unless it breaks a row the frozen build or states already cover; then it is fixed in the current version. A missing capture for an inventoried behavior is a gap we fill now.
- **Row classes:** `worker-native` (runs in the chamber unchanged), `mediated` (needs a capability-bridge call), `host-side` (stays on the main thread), `incompatible` (stated, with reason), `live-only` (cannot be fixture-proven, tagged up front, 4.9).
- **Browser scope (point 9).** Desktop Chromium only. Firefox, Safari/WebKit, mobile and in-app browsers go to the next version. This replaces 059's scenario floor C2 for browsers and cohorts. EEA egress stays in v1.0.
- **No synthetic fixtures.** The synthetic and "real-shaped" fixtures (`test/fixtures/parity-google-ads-ccm.redacted.json`, the 059-19 prototype) are not evidence of parity. They stay as unit-test inputs.
- Each row has an owning slice (section 9). A row without an owner is a defect in this spec. An owner is a slice, or task T1 or T2 for rows still being closed.

## 2. Inventory

Seeded from 059's 28 families (F01 to F28), the Google descriptor and R-015. Two inputs are private handles, not in Git: the retained loader, and the native smoke ledger (12 request ordinals, 62 query names). T1 reads them in place. If either is missing, T1 falls back to Google's public docs and says so.

### 2.1 Commands, config keys and parameters

| # | Row | Initial class | Slice | Notes |
|---|---|---|---|---|
| 1 | `js`, `config` (Ads destination `AW-…`), queue and argument semantics (F01) | mediated | G2 | Repeated `config`, reentrancy, `send_page_view` handling |
| 2 | `event` incl. `conversion` (F05), `send_to`, groups, destination precedence (F02) | mediated | G1, G2 | Label, value, currency, `transaction_id` |
| 3 | `get`, `event_callback`, `event_timeout` (F03) | mediated | G2 | Callback timing is a host effect |
| 4 | `set` (global and scoped params) | worker-native | G2 | Precedence rules from capture |
| 5 | `consent` (`default`, `update`, `wait_for_update`, regions, the consent types) (F16 to F19) | mediated | G3 | Basic zero-send and advanced cookieless modes both owed |
| 6 | Click IDs and cookies: `gclid`, `gbraid`, `wbraid`, `_gcl_au`, `_gcl_aw`, `_gcl_gs` and any others the loader writes (F20) | mediated | G4 | Rules in 3.3 |
| 7 | Cross-domain `linker` and form decoration, `url_passthrough`, `ads_data_redaction` (F21, F22) | host-side | G4 | Needs an owned peer domain (D7) |
| 8 | Standard and dynamic remarketing events, business-vertical item schemas (F07, F08) | mediated | G5 | |
| 9 | Cart data, custom variables, new-customer acquisition, counting and duplicate behavior (F06, F09 to F11) | mediated | G6 | |
| 10 | Manual enhanced data via `set user_data` (raw and prehashed) (F12) | worker-native | G7 | Normalization and hashing in the chamber |
| 11 | Automatic detection, selector and JS-variable collection, lead forms (F13 to F15) | host-side | G8 | Bounded extraction, no arbitrary evaluation |
| 12 | Website calls: `phone_conversion_number` lookup, number swap (F23) | host-side | G9 | Needs an eligible call resource (D8) |
| 13 | Remote config handling, transport, credentials, redirects, retries, lifecycle (`pagehide`, bfcache) (F24, F26, F27) | mediated | G10 | |
| 14 | Multiple destinations and GA4/GTM coexistence (F25) | host-side | G12 | We do not reimplement GA4 or GTM |
| 15 | Cookie customization (`cookie_domain`, `cookie_prefix`, `cookie_expires`, `cookie_update`, `cookie_flags`) | mediated | G4 | Page-side inputs, agent-run |
| 16 | Anything else the loader exposes that T1 finds | unknown | T1 | Must be named before the freeze |

### 2.2 Requests (request-level classes)

Every request the tag makes gets a request-level class (ADR-0061 point 10): `always`, `conditional` (with its rule) or `volatile`. Endpoint presence, multiplicity and redirects are part of the class. The seed list is from the descriptor, R-015 and spec 059. The capture session fills in the classes and they freeze with the inventory.

| Request | Seed class | Notes |
|---|---|---|
| `gtag/js?id=` loader and served config | acquisition | Not replaced as a request. Its served bytes are the config source (3.1) |
| `www.google.com/ccm/collect` page-load beacon | conditional | Present in the R-009 capture. Rule to be derived: consent state, config |
| Primary labeled conversion request | always (for a conversion) | Its response carries a fetch URL that points at the secondary request |
| Secondary labeled request | conditional | Absent in the retained smoke. The rule is unknown today |
| `viewthroughconversion` and `rmkt` mirrors | conditional | Two bodies were unavailable in the smoke |
| `ccm/form-data` (enhanced conversions) | conditional | Depends on the enhanced-conversions state |
| `cm.g.doubleclick.net/pixel` (cookie match) | conditional | Credentialed and cross-site. Never captured here |
| Any request not in this list | unknown | Added before the freeze, not after |

Fan-out completeness was left open at ADR-0040:224. The positive control (4.1) plus every state's full request list closes it for the frozen corpus.

## 3. Field classes and identity

### 3.1 Classes

Every request field gets exactly one class (ADR-0061 point 10), recorded in the freeze commit:

- **fixed:** same in every recording, compared exactly;
- **generated, with its rule** (for example a cachebuster);
- **input-derived, with its source input and rule** (page URL, config, consent state, landing URL, cookie);
- **server-context-derived, with its source** (egress region, served config bytes, a prior response);
- **volatile:** build or version stamps and experiment fields, and only fields shown to have no relationship to any other value (cookie, storage, another request, a response). Compared for presence and format only.

A field that differs across setups, egress regions or days cannot be classed fixed. If no other class explains it, the state is **unstable** and goes to the owner. A timestamp or value that links to anything stays checked by rule (ADR-0040 item 3).

### 3.2 Seed table (from the descriptor and the R-009 capture)

Seed classes only. The drift probe and the corpus confirm or change them.

| Field | Seed class | Seed rule or source |
|---|---|---|
| `tid` | input-derived | Destination from the page `config` |
| `en` | input-derived | Event name |
| `dl`, `dt` | input-derived | Page URL, title |
| `auid` | generated on a fresh profile, input-derived on a returning one | 3.3 |
| `gcs`, `gcd`, `npa` | input-derived | Consent state. Observed `G111`, `13r3r3r3r5l1`, `0` for granted |
| `dma` | server-context-derived | Source: egress region (R-009:141-149; descriptor lines 34-40) |
| `rnd` | generated | Cachebuster with an embedded timestamp. The native `rnd` differs from `auid` (R-015 ledger note) |
| `rcb`, `tft`, `tfd`, `_p`, `fst`, `random` | generated, pending | Counters, dispatch timestamps and cachebusters. Rule from capture |
| Build or experiment stamps (for example a `gtm` stamp, if present) | volatile candidate | Volatile only after the drift probe shows no link to any other value |

The descriptor's `normaliseDenylist` (`dma`, `rnd`, `rcb`, `tft`, `tfd`, `_p`, `fst`, `random`) is **not** evidence of volatility. It was a comparison shortcut. Under point 10 each of those fields is re-classed from recordings. T1 lists the remaining query names (the ledger has 62) here before the freeze.

### 3.3 Identity rules: `gclid` and `auid` (point 1)

- **Test click IDs.** Click-ID inputs are invented test tokens appended to the landing URL (`gclid`, `gbraid`, `wbraid`). No real ad click is used, and none is needed because the tag does not validate them on the client. Downstream attribution of a test click is `live-only` (4.9).
- **`gclid`, fresh profile:** the landing URL is the input. The tag writes a click-ID cookie and the conversion request carries the value. Class: input-derived, with the cookie format and timestamp rule taken from the recordings.
- **`gclid`, returning profile:** the value comes from the stored cookie, not the URL. The manifest names the source fixture. A returning recording with a different URL `gclid` is a separate state (the cookie-update case).
- **`auid`, fresh profile:** minted by the tag from the `_gcl_au` cookie it creates. Class: generated, rule = format plus relation to the cookie.
- **`auid`, returning profile:** read from the stored `_gcl_au`. Class: input-derived.
- A fresh recording is never compared with a returning one except as the declared one-factor variant.
- The held-out check (4.5) includes at least one returning-profile recording whose cookie values were not used to derive the rule.

## 4. Capture session plan (ADR-0061)

One session, run by agents on the standing approval for test-only scripted captures (point 6). Owner sessions are only for settings changes and the normal-browser capture. Production sites and real-user data keep the old gates (section 11).

### 4.1 Drift probe and positive control first (points 8 and 10)

Order, before any state counts:

1. **Drift probe, part A (bytes only).** Fetch today's served `gtag/js?id=<owned test AW id>` and compare it with the retained loader: length (443,549 bytes retained), SHA-256 against the private manifest digest, and a diff of what moved if they differ. Record both digests. If the served script differs, the retained bytes can no longer be used to derive rules (ADR-0040 item 1). Today's bytes become the frozen unit and the diff is reported.
2. **Positive control.** Record at least one complete native beacon with its full request and response fan-out in the exact capture setup: fresh profile, desktop Chromium, headed or headless stated in the manifest. Run it headed and headless. The mode whose control shows the full fan-out is the capture mode, headed if both do. The ladder (headless, headed, owner normal browser, then `blocked`, never synthetic) applies to any state that yields no native traffic. Headless was classed as bot traffic for Adobe (R-014:1121-1150), so the control compares fan-out and response bodies for differences. No user-agent spoofing is used. If no control can be recorded, nothing else is captured.
3. **Drift probe, part B (field noise floor).** Load one state (S1 base) three times on the same day from a non-EEA exit and three times from an EEA exit. Record which request fields differ, per field and per region. This is the first input to the field classes.

The part-B loads are probe loads, not corpus states, so they sit after the control without breaking the rule that no state counts before it.

### 4.2 Test identities and profile (point 5)

- Committable test IDs: the owned Google Ads conversion ID and action label, plus any further owned test IDs the owner confirms. They are visible on any page that loads the tag. Nothing from a customer or production account.
- Reference page: the owned EDS test homepage and a local harness only. The homepage loads native Meta by default, so Google captures use `meta-pixel=off` (R-015) or a Meta-free fixture. Any native GA4 or GTM on a page is part of the page input and is stated in the manifest.
- A fresh Chromium profile never signed in to Google, separate from any console session. A new profile for each "fresh" recording, one reused profile for each "returning" recording. The owner's normal-browser capture (4.6) also uses a fresh, never-signed-in profile, because a signed-in Chrome sends Google account cookies to `google.com` endpoints.
- **Pre-commit credential check.** Added before the first capture is stored, runs in `npm test`, with positive and negative cases. It rejects in any staged fixture (request and response headers, bodies, cookie and storage dumps): Google login or session cookies (for example `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-*PSID`, `LSID`), `Authorization` headers, OAuth or bearer tokens, and VPN or proxy credentials. Cookies are checked by name against an allow-list: the tag's own `_gcl_*` and `_ga*` cookies and the ad-network cookies G0 enumerates from the control. An unlisted name fails the commit.

### 4.3 Recording set per state (point 1)

Each state is recorded as base plus a same-setup repeat. Egress region is a factor for every Google state, because `dma` is geo-derived, so each state's base and repeat are recorded from both a non-EEA and an EEA exit. The other factors are context fields that do not depend on the command. They are recorded as one-factor-at-a-time (OFAT) variants of the base on S1 and S2, which carry the page-load and conversion field families. If an OFAT factor changes any field there, that factor extends to every other state that carries the field (escalation rule), and the manifest records it.

| Factor | Applies | Where |
|---|---|---|
| Egress region (EEA and non-EEA) | Yes | Every state, base and repeat |
| Viewport | Yes | OFAT on S1, S2 |
| Locale and timezone | Yes | OFAT on S1, S2 |
| Referrer | Yes | OFAT on S1, S2 |
| Fresh vs returning profile | Yes | OFAT on S1, S2. S3 carries both |
| Consent state | Yes (Google-specific) | Its own states (S4) |
| Account settings state | Yes (Google-specific) | Section 6 |

### 4.4 Full stored input state (point 1)

Every fixture stores in its manifest: URL and referrer, viewport, locale, timezone, egress region, browser name and version, headed or headless, profile kind, the script digest actually loaded, and cookies, localStorage and sessionStorage before and after. A fixture without that block is rejected by the checker (G0). Offline replay feeds exactly those inputs to the chamber.

### 4.5 Held-out check of derived rules (point 7)

Every derived field rule is checked against recordings not used to derive it: the day-2 drift-probe loads, plus at least one extra setup (a different viewport and locale on a fresh profile, from a third egress where the owner's exit allows). A rule that fails is rewritten, or the field is classed volatile only if it then meets the volatile definition. If the corpus cannot explain a failure, stop and report (kill criterion 3).

### 4.6 Owner's normal-browser reference capture

The owner records one normal-browser capture of a state agents also record (recommended: S2, non-EEA, fresh profile), in a fresh never-signed-in profile. It is compared with the agent recording field by field. A difference in a fixed or generated field goes to the owner before the freeze commit. The expected explanation is the capture setup, and it is checked, not assumed. A state is never marked `blocked` before a normal-browser try.

### 4.7 Run order and owner window

1. Preflight: credential check green, manifest checker green, test IDs confirmed.
2. Drift probe A, positive control, drift probe B (4.1), then the agent-only states S1 to S14 (section 5). Page-side settings (cookie options, linker, `user_data`, consent) are agent-run.
3. **One owner settings window** (about 3 hours in one sitting, hard cap 4) for the console-side candidates in section 6. For each one the owner changes the setting and says so. The agent polls the served config bytes, waits, records, and logs the change and times in the manifest. The normal-browser capture (S17) happens in this window. Then one combined-settings state.
4. **Restore step.** The owner restores the account to its original settings and the agent records one S2 load to confirm it matches the step-2 recordings.
5. Day 2 (agent): repeat the drift probe, S1 and S2 from both exits, the held-out check, and any top-ups that need no settings change.
6. Every manifest records the script digest actually loaded. If the digest changes between states, the session stops, reruns drift probes A and B, and reports. If fixed fields moved, kill criterion 2 applies.

The owner window can sit next to the Adobe window (spec 064, D7) and reuse the same EU exit (D2), so the owner gives one block of time.

### 4.8 Egress

Two exits: a non-EEA exit (the owner's default) and an EEA exit the owner provides or approves. VPN or proxy credentials never enter Git, and the credential check applies. The EEA exit is in an EEA country, not the UK or Switzerland, because `dma` follows the DMA scope. If the EU exit is unavailable, states with a `dma` or server-context difference are tagged `live-only: geo` and the gap goes in the freeze note.

### 4.9 Live-only tags

Tagged now, with reason, and checked once at the release check: conversion counting and attribution in the Ads UI (including whether a test click is attributed); enhanced-conversions matching; remarketing list membership; cookie-match (`cm.g.doubleclick.net`) effects if only visible downstream; website-call forwarding beyond the lookup response; cookie lifetimes beyond the `Set-Cookie` and storage values we record; any geo-dependent response from an egress we could not use.

### 4.10 Pilot (point 7)

The pilot is the capture session plus slice G1. We count the captures G1 needed beyond the corpus and write that number into section 13 at pilot close. More than 3 extra captures is a kill criterion trigger (section 10), not a quiet top-up. Google is a clean-room reimplementation, so this pilot tests the risk the Adobe pilot skips. Its extra check is the held-out rule test (4.5).

## 5. Capture corpus

Estimated size: about 105 recordings, under the 150 bound in section 10.

| ID | State | Variants |
|---|---|---|
| S0 | Positive control, native beacon | headed, headless |
| P0 | Drift probe A (bytes) and B (3 same-day loads of S1, per region) | day 1 and day 2 |
| S1 | Page load, `config` only, granted consent, direct, fresh | base, repeat, both egresses, OFAT |
| S2 | Owned direct conversion: `conversion` with label, value, currency, `transaction_id` (the 059-01 case) | base, repeat, both egresses, OFAT |
| S3 | Click-ID landing, then returning visit (cookie reuse, cookie update) | fresh, returning, both egresses |
| S4 | Consent: default denied then update granted; advanced cookieless; `wait_for_update`; revoke | each, both egresses |
| S5 | Remarketing and dynamic remarketing events with items | base, repeat, both egresses |
| S6 | Rich purchase: cart data, custom variables, new customer, duplicate transaction | base, repeat, both egresses |
| S7 | Manual `user_data` (raw, prehashed) | base, repeat, both egresses |
| S8 | Automatic detection and lead form submit | base, repeat, both egresses |
| S9 | Website call lookup and swap | base, repeat, both egresses |
| S10 | Cross-domain link and form decoration to the owned peer; `url_passthrough` | base, repeat, both egresses |
| S11 | Page-side config: cookie options, `send_page_view:false`, `ads_data_redaction` | one each |
| S12 | Multiple destinations, `send_to`, native GA4 present | base, repeat |
| S13 | Lifecycle: click navigation with callback, `pagehide`, bfcache | one each |
| S14 | Errors: blocked network, non-200, malformed config response | one each, scripted |
| S15 | Account settings states (section 6), one per console-side candidate, plus one combined state | per setting, non-EEA plus one EEA |
| S16 | Day-2 repeat of S1 and S2, held-out extra setup | both egresses |
| S17 | Normal-browser reference (owner) | repeat of S2 |

## 6. Settings states (ADR-0061 point 3)

The inventory freezes after the session toggles each candidate. T2 lists candidates from Google's public docs and marks each page-side or console-side. Initial candidates, each with its triggering page input:

| Candidate | Side | Triggering page input |
|---|---|---|
| Enhanced conversions, off / automatic (tag) / manual (2026 unified settings) | console | A form field with an email or phone value, or a manual `user_data` set, then a conversion event |
| Enhanced conversions for leads | console | A lead form submit with an email field |
| Automatic detection and exclusions | console | A form with detectable fields, plus an excluded field |
| First-party cookie and conversion-linking settings | console and page | Landing with a click ID, then a conversion |
| Cross-domain `linker` | page | A link and a form pointing at the owned peer domain |
| Cookie options (`cookie_*`) | page | Any load that writes `_gcl_*` |
| Remarketing and data-segment collection | console | A remarketing event with items |
| New-customer acquisition | console | A conversion with the new-customer parameter |
| Conversion action properties (count, value mode, window) | console | A conversion fired twice with the same `transaction_id` |
| Website calls | console | A page with a phone number the tag can swap |
| Combined | console | One state with every candidate that changed served bytes |

A candidate counts as **no effect** only if all three conditions hold (point 3):

- (a) The check came after a stated propagation wait. Default: poll the served config bytes every 2 minutes up to 20 minutes after the owner's change, then one more 20-minute poll if still unchanged. The times go in the manifest.
- (b) The served config bytes were checked: a fetch of `gtag/js?id=<test id>` before and after, compared by digest and by the config region, plus the set of requests recorded.
- (c) The triggering input was present in the page.

A candidate whose bytes change only after the window closes is a gap to fill now. It costs one short owner follow-up (D3). A page-side candidate is run by agents on the standing approval and needs no window.

## 7. Completeness check and production config (ADR-0061 carried checks)

### 7.1 Completeness against real configs

Before the freeze we compare the candidate inventory with the `gtag/js?id=` configs public sites actually serve. This probe touches production, so it is owner decision D4 and does not run before approval.

- **Sample:** at least 50 distinct Ads/gtag configs. First choice, if the data covers it: public crawl data (for example the HTTP Archive response bodies), which touches no site. Second choice: single GETs of `gtag/js?id=<id>` for ids found on an owner-approved list of public pages, with no page JavaScript executed, no cookies, no consent clicks, and a rate limit.
- **Feature:** one distinct config key or setting value the tag reads.
- **Metrics:** feature-level out-of-inventory rate = features seen in the sample that no section 6 state or section 2 row covers, divided by all distinct features seen. Site-level rate = sites with at least one uncovered feature, divided by sites sampled.
- **Combined settings:** S15 includes one combined state. The probe also reports, for information only, the share of sampled sites whose settings combination our combined state does not cover.
- **Kill criterion:** feature-level rate above 10%, or site-level rate above 25%, means the inventory is not finite enough to freeze. Value so far: not measured.

### 7.2 Point 11: reading a customer's served config in production

Today the only config path is adopter-supplied `boot(config)`. The chamber never reads the customer's served `gtag/js`, so it cannot see a setting that changed upstream. This is unresolved for all three vendors, so this spec proposes a slice and an explicit scope decision (D5):

- **G11, out-of-inventory diagnostic.** (a) The chamber checks the adopter's `boot(config)` against the frozen inventory and shows a visible diagnostic for a key or shape outside it, or a server-context field with a value not seen in the corpus. Never a silent drop, never an auto-disable (ADR-0040 item 8). (b) A build-time or CI check, run by the adopter, fetches the adopter's own served `gtag/js?id=`, compares its config region with the frozen inventory and reports any mismatch. It reads the customer's own config in their pipeline, never in a visitor's browser.
- **Out of v1.0 unless D5 says otherwise:** a runtime read of the served config by the shipped chamber. It needs a new mediated host-fetch capability and a parser of Google's script in production.

### 7.3 Meta-only time-box

Not applicable. It covers the case where only the owner's normal browser yields Meta traffic. Google's route is agent-scripted. If a Google state yields no native traffic, the ladder in 4.1 applies and an unresolved state is reported to the owner as blocked. It is not time-boxed, and nothing here changes point 7.

## 8. Disposition of spec 059

History is kept. Spec 059 gets a dated rescope note and each slice a new status. No record is rewritten. Code from 059-13 to 059-21 stays and is reused.

| 059 item | Today | Disposition |
|---|---|---|
| 059-01 owned direct conversion | READY_FOR_REVIEW | **ABANDONED**, replaced by G1 (pilot). Its criteria are inputs to G1's slice file |
| 059-02 command routing and callbacks | DRAFT | **ABANDONED**, replaced by G2 |
| 059-03 consent journeys | DRAFT | **ABANDONED**, replaced by G3 |
| 059-04 identity and linker | DRAFT | **ABANDONED**, replaced by G4 |
| 059-05 remarketing | DRAFT | **ABANDONED**, replaced by G5 |
| 059-06 rich purchases | DRAFT | **ABANDONED**, replaced by G6 |
| 059-07 manual enhanced | DRAFT | **ABANDONED**, replaced by G7 |
| 059-08 automatic and leads | DRAFT | **ABANDONED**, replaced by G8 |
| 059-09 website calls | DRAFT | **ABANDONED**, replaced by G9 |
| 059-10 remote rules and lifecycle | DRAFT | **ABANDONED**, replaced by G10 and G11 |
| 059-11 mixed-tag and rollback | DRAFT | **ABANDONED**, replaced by G12 |
| 059-12 portfolio qualification | DRAFT | **ABANDONED**, replaced by G13 and G14 |
| 059-13, 059-14, 059-16, 059-17 | DONE | Stay DONE. 059-14's capture controls are reusable by G0 where they fit |
| 059-15 native stock capture | IN_PROGRESS | **ABANDONED.** Per-case admission and the isolation candidate are replaced by ADR-0061 point 6 and the capture session. The code stays and is reused only where it helps G0 |
| 059-18 additional Meta authority | DEFERRED | Stays. Meta is spec 066's |
| 059-19, 059-20, 059-21 | DONE | Stay DONE. Starting points for G1 and G2 |
| 059 spec, plan, tasks | IN_PROGRESS | Closed by rescope note. This spec carries the goal. The old plan is history |
| Blocking register B1 to B8 | open | B1 to B4: replaced by the capture session and G13. B5: pushed into the slice specs (the stable-core contract still binds). B6: D8. B7: closed by T1, T2 and the corpus. B8: live-only (4.9) |
| Retained 12-request smoke ledger | private | Not used as fixtures. It lacks the stored-input manifest and the script digest. It stays a field-vocabulary cross-check for T1 |

## 9. Ordered slice list

T1, T2 and G0 are pre-capture tasks with their own completion checks. They need no fixture comparison, because the corpus does not exist yet (point 7). T1 and T2 are read-only. CAP and everything after it wait for D1. Each slice is sized for one fresh session and ends with a recorded-fixture comparison through real chamber dispatch (point 1). Slice files with DoR and acceptance are written after D1, so the pilot can still change them.

| Slice | Goal | Depends on |
|---|---|---|
| T1 (task) | Close the surface from the retained loader and the 12-request ledger: command, config, parameter and endpoint lists, and all 62 query names for the field table. No vendor code runs | none |
| T2 (task) | Candidate-settings list from Google's public docs, page-side or console-side, with triggers, and the completeness table skeleton | none |
| G0 (task) | Capture tooling. **Shared, lands on main once (Adobe task B0):** manifest schema, stored-input-state check, pre-commit credential check, and native-side field rules in the comparator (today `native_normalization_unsupported`, rig/native-tag-comparison.md:186-194). **Google part, built here:** the drift-probe recorder, the field and request classifier output, and a capture driver that reuses 059-14 and 059-16 pieces where they fit. This branch does not build the shared comparator rules. G1 and every later field slice wait for them on main | T1 |
| CAP | **Capture session** (section 4). One session, owner approval first | G0, T1, T2, D1 to D3 |
| G1 | Owned direct conversion on a fresh profile: `config`, page-load beacon, labeled conversion and its fan-out. **Pilot slice**, replaces 059-01 | CAP |
| G2 | Commands and callbacks: `config`, `set`, `get`, `event_callback`, destinations and `send_to` | G1 |
| G3 | Consent: `consent` default, update, wait, regions, revoke; basic and advanced | G1 |
| G4 | Identity and storage: click IDs, `_gcl_*`, returning profile, cookie options, linker, `url_passthrough` | G1, G3 |
| G5 | Remarketing and dynamic remarketing | G2 |
| G6 | Rich purchases and counting | G2 |
| G7 | Manual enhanced matching | G2, G3 |
| G8 | Automatic detection and lead forms | G7 |
| G9 | Website calls | G3 |
| G10 | Remote config handling, transport, redirects, retries, lifecycle | G2, G3 |
| G11 | Out-of-inventory diagnostic (point 11, 7.2) | G10 |
| G12 | Multiple destinations, native GA4 and GTM coexistence, rollback | G2, G4 |
| G13 | Compatibility report and performance budget (the 059 C3 numbers, pinned from measured controls) | G1 to G12 |
| G14 | Release check wiring: fixtures against live, live-only rows, chamber next to native in one setup and one egress not in the corpus (point 10) | G13 |

Existing starting points under `connectors/google-ads/`: `bootstrap-command.js`, `conversion-prototype.js`, `consent-commands.js`, `cookies.js`, `purchase-cart-items.js`, `remarketing-control.js`, `view-items.js`, `manual-response.js`. A slice that cannot be finished in one fresh session splits when its own file is written.

## 10. Applicability of ADR-0061 carried checks and kill criteria

| Check | Applies to Google? | Where |
|---|---|---|
| Completeness against real `gtag/js?id=` configs, with threshold | Yes | 7.1, D4 |
| Point 11, production config reading | Yes | 7.2, D5, slice G11 |
| Meta owner-only capture time-box | No | 7.3 |
| Drift probe first (point 10) | Yes | 4.1 |
| Egress region as a factor | Yes, on every state | 4.3, D2 |
| Pre-commit credential check | Yes | 4.2 |
| Held-out rule check | Yes | 4.5 |
| Clean-room risk | Yes | 4.10 |
| Comparator native-side field rules | Yes, as a dependency | G0 |

Kill criteria (from ADR-0061, bounded numerically here):

1. A capture set cannot be acquired, including the positive control: stop. Slices never close on synthetic fixtures.
2. The drift probe or same-day loads show fixed fields moving across most states (more than half), the served build changes fixed fields during the session, or the request set varies between loads without explanation: stop and report before any slice.
3. Derived rules fail the held-out recordings and the corpus cannot explain why: stop and report before any slice.
4. The inventory needs more than 150 recordings, more than one owner settings window plus one follow-up of at most 30 minutes, or follow-up captures keep adding missing states after the pilot (more than 3 extra for G1): revisit the freeze unit.
5. A release check finds fixtures no longer match live behavior across several rows: revisit the freeze unit and the refresh cadence.
6. The completeness probe (7.1) finds a feature-level rate above 10% or a site-level rate above 25%: revisit the freeze unit before freezing.

## 11. Production-site probes

No probe touching a production site, tenant or real-user data runs without the owner's written approval in this section, naming the site and the probe. **Approved: none yet.** The completeness probe (7.1) needs D4. The owned test homepage and test account are not production for this purpose.

## 12. Decisions for the owner

I recommend approving all of these as written. Each is yours to change.

- **D1. Spec and slice order.** Approve this spec, the 059 closure in section 8 and the slice order in section 9. Recommended: yes. It makes every slice finishable offline.
- **D2. EU exit.** Provide or approve one EEA exit for agent runs on day 1 and day 2. Recommended: reuse the second egress you already agreed to give Adobe, as long as it is in an EEA country. Google needs it on every state, so it has to stay up for both days.
- **D3. Settings window.** One sitting of about 3 hours, hard cap 4, for the console-side toggles in section 6. Recommended: put it right next to the Adobe window on the same day and let the propagation waits overlap. Allow one short follow-up (30 minutes at most) if a setting lands after the window closes.
- **D4. Completeness probe on real configs.** Recommended: yes, with public crawl data first, so no site is touched. If that does not cover enough configs, I come back to you with a list of public pages for single GETs. Thresholds are in 7.1.
- **D5. Reading a customer's config in production.** Recommended: ship the diagnostic slice G11 with the `boot(config)` check and the adopter's own build-time check, and leave a runtime read of the served script to the next version. The cost: a setting changed upstream shows up at the adopter's next check, not live.
- **D6. Meta time-box.** Not applicable to Google (7.3). Nothing to decide.
- **D7. Peer domain for the linker.** Confirm you own a second domain I can use for cross-domain states. Recommended: yes. If not, the S10 captures are marked `blocked: no peer domain` and listed in the freeze note.
- **D8. Console features on the test account.** Confirm which of these exist and can be toggled: enhanced conversions (including for leads), website calls with an eligible call resource, new-customer acquisition. Recommended: tell me which exist, and I mark the rest `blocked: account-ineligible` with the reason.
- **D9. Normal-browser state.** One state: S2 on the non-EEA exit, in a fresh profile never signed in to Google. Recommended: yes.
- **D10. 059-15 tooling.** Close it as abandoned and keep the code for reuse. Recommended: yes. Per-case admission is replaced by ADR-0061 point 6.

## 13. Review log and carried findings

Review rounds are capped at three before owner review. Findings left after round 3 go into the pilot as listed checks.

- Round 1: _pending_.
- Pilot count of extra captures: _to be filled at pilot close_.

## 14. Clarifications

None open. Slice files with DoR and acceptance are written after D1, so the pilot can change them.
