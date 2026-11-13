---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-5, UC-6, UC-7, UC-9, UC-10]
---

# Spec 066: Meta Pixel parity inventory (fbevents.js)

> Frozen inventory and capture plan. Written 2026-11-12 on branch `vendor-meta-pixel`.
> Definition of done: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md). Not re-opened here.
> Target and framing: [ADR-0040](../../decisions/adr-0040-reframe-onto-full-google-meta-compatibility.md), partly superseded by ADR-0061.
> Sister specs: 064 (Adobe) and 065 (Google) live on their own branches. This spec creates no 067+ specs; build work is an ordered slice list (section 9).
> Structural model: spec 064 (on `vendor-adobe`).

## 0. Summary for the owner

This spec turns "full Meta Pixel compatibility" into a list we can build against. For Meta, the frozen unit is one captured fbevents.js build plus the pixel-settings states that actually change what the tag sends. We plan one capture session that records the real tag in all of those states, so every slice can be proven against recordings instead of waiting for live runs.

Nothing live runs until you approve this spec. That includes captures, calls to Meta, and any probe of production sites. Reading the bytes and notes already in the repo is fine. Tasks MT1 and MT2 are read-only, and MT0 only writes tooling, with no vendor contact.

It also retires the old plan. Specs 060 to 063 grew to 26 slice files. 14 of them are evidence preparation, one-shot grants and live sends. The 12 product journeys (060-01 to 060-12) are written but were never built. Section 8 closes or reframes each one. Section 9 gives three pre-capture tasks, the capture session, and thirteen slices (M1 to M13) that each fit one fresh session.

The main tradeoff is front-loading. We spend one capture session before any slice starts. In return, every slice has fixtures, and the pilot (capture session plus slice M1) tells us whether the corpus was complete.

Meta has one risk Adobe does not. Prior automated headless runs saw no beacon, and the only positive native beacons came from a headed browser and from your normal browser (ADR-0040:49-51, spec 060:107-115). Section 6.3 sets a time-box for the owner-only route and puts one decision to you if it runs out. Section 11 lists twelve decisions with a recommendation each. The two that need your calendar are the settings window (about 2.5 hours, placed next to the Adobe one) and the EU exit (reuse the one you agreed for Adobe).

## 1. Scope and frozen inventory rules

- Frozen unit (ADR-0061 point 3): the captured fbevents.js script build, its served `signals/config/<pixel>` bytes, and the pixel-settings states that change the tag's output (section 3). Meta is evergreen and remotely configured, so there is no version to pin up front. The pin is whatever the first drift-probe step (section 4.1) records.
- Known pins so far (private bytes, public digests):
  - runtime `d4487bcc9db399030b7089a15e37a6e755bed441992ced0716fb7f9a874e20d1` (declares 2.9.426),
  - configuration `b1720ebb329e506fd223f066353d977281280866d85e908dc2561a6c1161c46d`,
  - configuration request `17cfa580bd805177e3d2407a18a80bb9426e01f628233d47f11403b51b73ba32`
  - (spec 060-16 AC1). The retained 058-02 bytes of 2026-10-16 are the reference for the drift probe. They are not in this checkout. MT1 locates them through the private-input handles (spec 060, "Explicit private-input handles"). If they cannot be found, the probe compares against the digests above and the version string only, and says so.
  - The owner's current site declares 2.9.435 (061 slice-01, "Initial observations"). That already looks like drift. The probe measures it.
- Frozen per ADR-0061 point 3. A later discovery goes to the next version's inventory unless it breaks a row the frozen build or states already cover. A missing capture for an inventoried behavior is a gap we fill now.
- Class for every row (`mixed` and `unknown` are allowed only before the freeze and are resolved by MT1 or CAP): `worker-native` (runs in the chamber unchanged), `mediated` (needs a capability-bridge call), `host-side` (stays on the main thread), `incompatible` (stated, with reason), `live-only` (cannot be fixture-proven, tagged up front, section 4.10).
- Every row has an owning slice (section 9) or a task (MT1, MT2) for rows still being closed. A row with no owner is a defect in this spec.
- Browser scope (ADR-0061 point 9): desktop Chromium only. Firefox, WebKit/Safari, iOS and in-app browsers are out for v1.0 and listed as out in the freeze note. This replaces the cohort matrix at spec 060:166-169 and ADR-0040:223.

### 1.1 Stock-default rule (ADR-0062, pending)

Owner rule, 2026-11-13: "we want full parity, just with better controls, so we should match stock by default, always, for all tracks". ADR-0062 is Proposed on main, so this cites it as pending. Airlock's default behaviour matches stock fbevents.js. The seal, consent holds, allowlists and field strips are controls a site turns on. They never change the default output.

Effect on this spec and the M-slices:
- Every fixture comparison (ADR-0061 point 1) runs the chamber in its default configuration, with no control turned on, against stock. A reduction (stripped field, held event, allowlist) is a separate opt-in test in the slice that owns the control. It is never part of the parity comparison.
- M7 (automatic matching) and M8 (automatic events): the default follows the pixel's served settings, as stock does. Spec 060's "approved forms" and "owner-registered roots" are the opt-in restriction, not the default.
- M4 (consent): the default sends as stock does, with no hold. Stock honors `consent revoke`. An Airlock consent hold is an opt-in. See O12.
- M5 and M6: the default writes `_fbp`/`_fbc` and sends identity fields exactly as stock. Field strips are opt-in.
- M9 and M12: the default does not cap, drop or delay what stock sends. Byte limits, ring caps and lease limits in spec 060's contract table apply only when a site opts in. See O12.
- M11: the diagnostic is visible-only and changes no output, so it is already stock-compatible by default.
- SET7 and the capture plan are unchanged. The corpus records stock. Nothing in section 4 captures a control.
- Defaults inherited from 060 to 063 that this rule overrides: the pending-consent default and default-deny egress in the seal (architecture-wide, see O12), the "approved forms" default, and bounded queue and retention limits. The 061 and 062 no-send guard, the abort of the native `/tr` request and the `meta-pixel=off` site choice are test setup and a site choice, not product defaults. They stay as history.

## 2. Inventory

Every list below starts from public documents (spec 060 references P1 to P17, retrieved 2026-10-15) and the retained 2.9.426 observations. It is a floor. MT1 closes it from the retained runtime and configuration bytes (read-only, no vendor code executed). Anything the capture session finds is added before the freeze commit; after that commit the tables are frozen.

### 2.1 Commands and event data

| # | Command or surface | Initial class | Slice |
|---|---|---|---|
| 1 | Bootstrap queue, `fbq` aliases and readiness, `fbq.queue`, `fbq.loaded`, `fbq.version` | worker-native | M1 |
| 2 | `init` (pixel ID, optional user data) | mediated | M1, M6 |
| 3 | `track` PageView | mediated | M1 |
| 4 | `track` for the 17 standard events (AddPaymentInfo, AddToCart, AddToWishlist, CompleteRegistration, Contact, CustomizeProduct, Donate, FindLocation, InitiateCheckout, Lead, Purchase, Schedule, Search, StartTrial, SubmitApplication, Subscribe, ViewContent) | mediated | M2 |
| 5 | `trackCustom`, `trackSingle`, `trackSingleCustom` | mediated | M2, M3 |
| 6 | `set` (autoConfig, agent, userData, other keys MT1 finds) | worker-native | M3, M6 |
| 7 | `consent` revoke, grant, re-grant, queue retention and replay | mediated | M4 |
| 8 | `dataProcessingOptions` (empty, LDU, country and state variants) | worker-native | M4 |
| 9 | `eventID` option and `eid` | worker-native | M10 |
| 10 | Commands MT1 finds in the retained bytes that are not listed here | unknown before freeze, resolved by MT1 | MT1 |

Data vocabulary (spec 060, "Commands and event data"): `content_category`, `content_name`, `currency`, `search_string`, `content_ids`, `content_type`, `contents`, `value`, `predicted_ltv`, `num_items`, `status`, `delivery_category`, custom properties. Each gets an input-to-wire typing row from capture: omission, coercion, zero and fractions, Unicode, nesting, nonfinite, over-length, and what native does on invalid input. Owner slice: M2.

### 2.2 Other rows

| Area | Rows | Initial class | Slice |
|---|---|---|---|
| Network | Script fetch, `signals/config/<pixel>`, plugin fetches the config pulls in, `/tr` beacons, any Attribution Reporting or other fan-out request, redirects and multiplicity. Each request gets a request-level class (section 2.4) | mediated | M1 |
| Identity cookies | `_fbp` and `_fbc` writes, attributes, lifetime and refresh; `fbp`/`fbc` wire names; `fbclid` input (no click, same click, changed click) | mediated | M5 |
| Referrer and timing state | `ler` and `plt` persisted referrer and timing (ADR-0055, specs 060-18 to 060-21) | mediated | M1, M5 |
| Manual identity | `em`, `ph`, `fn`, `ln`, `external_id`, `ge`, `db`, `ct`, `st`, `zp`, `country`; raw and prehashed input; login and logout transitions | worker-native | M6 |
| Automatic matching | Form-derived `ud[...]` and the `aud`/`cud`/`ncud` encodings | host-side | M7 |
| Automatic events | Button-click, page-metadata (schema.org, Open Graph, JSON-LD) and Event Setup Tool rule events | host-side | M8 |
| Lifecycle | SPA history changes, `visibilitychange`/unload sends, transport choice (image, fetch, beacon), no-JavaScript noscript image | mixed before freeze, split by MT1 and CAP | M9 |
| Errors | Blocked script, config or `/tr`; non-200; invalid commands | worker-native | M2, M9 |
| Config provenance | Served config shape, plugin set, `signals/config` effects | mediated | M3, M11 |
| Diagnostics | Helper-style diagnostics, catalog and audience inputs (collection side only) | host-side | M12 |
| Backend | Test Events receipt, matching quality, deduplication with server events, catalog and audience results, attribution | live-only | M13 |

### 2.3 Family coverage

Each of the 20 inventory families from spec 060 has an owner. Coverage is planned ownership, not proof.

| Family | Slice | Family | Slice |
|---|---|---|---|
| F01 bootstrap, queue, init | M1 | F11 automatic events, DOM | M8 |
| F02 standard and commerce events | M2 | F12 runtime and config provenance | M1, M3, M11 |
| F03 custom data, events, conversions | M2 | F13 first-party and click continuity | M5 |
| F04 multi-pixel | M3 | F14 transport and browser | M5, M9 |
| F05 `set` and configuration | M3 | F15 SPA and lifecycle | M9 |
| F06 consent | M4 | F16 event IDs and deduplication (browser side) | M10 |
| F07 processing and privacy | M4 | F17 helper and diagnostics | M12 |
| F08 manual and prehashed matching | M6 | F18 catalog and audiences (collection side) | M2, M12 |
| F09 identity transitions | M6 | F19 invocation and errors | M2, M9 |
| F10 automatic matching | M7 | F20 performance and confinement | M9, M12 |

### 2.4 Field and request classes (ADR-0061 point 10)

Every request field is in exactly one class, and every request gets a request-level class.

| Field class | Compared by | Rule |
|---|---|---|
| fixed | exact | Same in every setup, region and day. A field that differs between setups, regions or days cannot be fixed |
| generated | its rule | Rule recorded (for example `fbp` shape and creation time) |
| input-derived | its rule | Names its source input (URL, referrer, viewport, timezone, event data, identity) |
| server-context-derived | its rule | Names its source: egress region, served config, or an earlier response |
| volatile | presence and format | Only for fields shown to have no relationship to any other value (cookie, storage, another request or a response). A timestamp or value that links to anything stays under a rule |

Request-level classes: `always`, `conditional` (with its rule), or `volatile`. Endpoint presence, multiplicity and redirects are part of the contract (ADR-0040 item 2).

A field not explained by another class that differs across setups, egress regions or days makes the state `unstable`. It goes to the owner, never to `volatile` by default.

Initial hypotheses, for planning only. The capture replaces them with measured classes, and nothing is classed from this table. Names seen so far: `id`, `ev`, `dl`, `rl`, `if`, `sw`, `sh`, `tz`, `fbp`, `fbc`, `eid`, `ler`, `plt`, `ud[...]`, `cd[...]`, `dpo` (specs 061 and 062; 68 native-only query occurrences were observed in 061, 31 of them with names we cannot yet interpret).

| Field | Hypothesis | Basis |
|---|---|---|
| `id`, `ev`, `eid`, `cd[...]`, `ud[...]` | input-derived | Pixel ID, command, option, event data, normalized identity then SHA-256 |
| `dl`, `rl`, `if`, `sw`, `sh`, `tz` | input-derived | Page URL, referrer, frame, screen, timezone (the 062 timezone fix) |
| `fbp` | generated | Cookie value and wire value must match; rule from repeats |
| `fbc` | input-derived | From `fbclid` and its first-seen time |
| `ler`, `plt` | generated or input-derived | ADR-0055; rule from repeats |
| build, version, release-channel stamps, experiment flags | server-context-derived, volatile only if proven unrelated | Served script and config; 061 saw experiment fields |
| counters, load timestamps | generated | Rule must tie them to the cookie or an earlier request, else volatile |
| config-derived flags and bitfields | server-context-derived | Source is the served config bytes |

## 3. Candidate settings states (ADR-0061 point 3)

Naming: SET1 to SET9 here are settings candidates. They are unrelated to spec 060's acceptance criteria C1 to C9.

The inventory freezes after the capture session has toggled each candidate. Candidates come from ADR-0061, spec 060 and the retained config. MT2 extends the list from public Meta documentation and MT1 from every flag and plugin the retained config bytes enable (the retained config carries an opted-in timezone plugin, 062 framing), before the session. The pages R-015 could not read (automatic matching, setup, cookie settings, Event Setup Tool) stay "unread" until the owner export or a read-only probe closes them.

| # | Candidate setting | Triggering page input |
|---|---|---|
| SET1 | Automatic advanced matching, on and off, and the per-field subset | A form with email, phone and name fields, submitted |
| SET2 | Automatic event collection: button click, and page metadata (schema.org, Open Graph, JSON-LD) | A clickable button with text and attributes; a page carrying the metadata |
| SET3 | First-party cookies | Any load; the `_fbp` write and its attributes |
| SET4 | Event Setup Tool rule (one owner-made rule) | The element or URL the rule matches |
| SET5 | Allowed or restricted domains | One load from an allowed host and one from a host not on the list |
| SET6 | Aggregated Event Measurement and domain verification state | Any load; the config bytes decide whether it matters |
| SET7 | Region and consent defaults, including limited data use | EEA and non-EEA loads |
| SET8 | Further flags or plugins MT1 or MT2 find, at most 3 for v1.0 | Named per item. MT1 and MT2 deliver a numbered SET8 list before CAP. Overflow goes to the next version's inventory (ADR-0061 point 3) |

Owning slices: SET9 M3 (config effects), SET1 M7, SET2 and SET4 M8, SET3 M5, SET5 and SET6 M3, SET7 M4, SET8 as named in the SET8 list. Combined state SET9: SET1, SET2 and SET3 on together (at least one combined-settings state, ADR-0061 carried check).

A candidate counts as "no effect" only if all three hold:
1. the check came after a propagation wait. Default: wait until the served config bytes change, or 30 minutes after the change, whichever comes first. The wait is recorded in the manifest;
2. the served config bytes (`signals/config/<pixel>`) were checked after the wait and compared with the base;
3. the triggering input was present in the load.

Meta's account settings changes reach `connect.facebook.net` through a CDN, so the second condition is the one most likely to fail quietly. Expected propagation time is not known yet. The first window measures it, and the worst case is stated in 5.1. A state with no config-byte change and no output change is recorded as "no effect" with those three facts attached.

## 4. Capture session plan (ADR-0061)

One session, run by agents on the standing approval for test-only scripted captures (ADR-0061 point 6). Owner sessions are only for settings changes and the normal-browser capture. Production sites and real-user data keep the old gates (section 10).

### 4.1 Drift probe first (point 10)

Nothing counts as captured before this step.

1. **Bytes.** Fetch today's `fbevents.js` and `signals/config/<test pixel>`. Script leg: compare `fbevents.js` with the retained 058-02 bytes and the pinned digest (section 1). Record size, digest, declared version and a diff of what changed. Config leg: `signals/config/<pixel>` is per pixel, and the retained config belongs to a different pixel, so a digest mismatch alone proves nothing. Compare config shape (keys, plugins, flags) with the retained config, and record the day-1 test-pixel config as the baseline for later drift. This step is a plain GET from the owner test setup and runs first.
2. **Same-day loads.** Load one state (S1 base) three times on the same day from one non-EEA exit and three times from one EEA exit. Record which request fields differ across loads and across exits.
3. **Second day.** The same loads repeat on a second calendar day (an agent-run follow-up, S15).

The first complete native beacon (4.2) comes from the loads in step 2. The ladder picks the capture mode, and the step 2 loads are re-run in full in that mode. Only those loads form the baseline. The positive control and the drift probe are one first step, and no other state counts until both are done and every observed difference is classed (2.4).

Stop rule, ADR-0061 kill criterion: if fixed fields move across most states, the served build changes during the session, or the request set varies between loads without explanation, stop and report to the owner before any slice.

### 4.2 Positive control and the escalation ladder (point 8)

The session records at least one complete native beacon with its full request and response fan-out in the exact capture setup (fresh profile, desktop Chromium, headed or headless stated in the manifest). Native requests are never aborted or intercepted-and-dropped, so the response bodies and headers are captured. (The earlier 061 and 062 pairs aborted the native `/tr` event on purpose; that is not enough for a response fixture.)

Ladder, in this order, per state class that yields no native traffic:
1. agent headless;
2. agent headed;
3. owner normal-browser try;
4. only if all three yield nothing: the state is `blocked` and reported to the owner. Never filled with synthetic data.

Known so far: headless runs loaded the script and config and sent no beacon (ADR-0040:49-51, 061 slice-01 "Initial observations"; R-014:1121-1150 classes HeadlessChrome as bot traffic). 058-02 produced a headed no-send attempted reference (spec 060:107-115). 061's headed passive loads observed two delivered `/tr` GET/image requests with HTTP 200, but Playwright returned zero-length response buffers for both, and the owner's DevTools capture had no response bodies. `/tr` is an image beacon, so an empty body is the normal case. A positive control is satisfied by the request, the status line, the response headers and a zero-length body recorded as such. A missing response observation is not enough. The ladder still runs in order, with one headless load first, because the evidence is a few runs and the loads are cheap. If headless fails and headed succeeds, headed is the capture mode and the headless difference is a recorded row. Rung 3 triggers the owner-only route (6.3).

### 4.3 Test identities, profile and credential check (point 5)

- The owned test pixel ID may be committed. It is a test account, and the ID is visible on any page that loads the tag. Only an ID the owner confirms as test-owned (decision O8).
- Capture host: the owned EDS test site and the local harness only.
- Fresh Chromium profile created for the session and never logged in to any vendor, separate from the owner's console session. One new profile per "fresh" recording, one reused profile per "returning" recording.
- Test identities for matching states: synthetic emails, phone numbers and names on a reserved domain (`@example.invalid`) and a synthetic external ID, with their hashes committed unredacted. A test `fbclid` value is a test input to both the native tag and the chamber. The chamber still never invents a click ID (060-05).
- Credential check, added before the first capture is stored. It is a repository test that scans every fixture file and manifest, so CI fails on a hit. A pre-commit hook, if present, is a convenience on top. It rejects vendor-domain login or session cookies (for example Facebook session cookies such as `c_user`, `xs`, `datr`, `sb`), bearer and API tokens, and VPN or proxy credentials in any staged fixture. It runs in `npm test`, has its own positive and negative cases, and scans request and response headers, bodies and cookie and storage dumps. `_fbp` and `_fbc` are allowed by name.
- Settings changes on the test pixel use the owner's console session. The capture profile and the console profile are never the same one.

### 4.4 Recording set per state (point 1)

Every state gets: base, same-setup repeat, and an EEA recording of the same setup (egress region is a factor for Meta everywhere). The one-factor-at-a-time variants (viewport, locale and timezone, referrer, fresh vs returning) are recorded for S1, S2 and S4 Purchase. This is a bounded deviation from ADR-0061 point 1, which asks for variants per state. The reason: these factors are page-context inputs that do not depend on the command, so one plain state and one event-bearing state give a multi-setup basis for each rule family. The deviation is owner decision O11. Egress region is recorded for every state:

| Factor | Applies | Why |
|---|---|---|
| Viewport | Yes | `sw`, `sh` and any layout-derived input |
| Locale and timezone | Yes | `tz` and `Accept-Language` |
| Referrer | Yes | `rl`, and `ler`/`plt` state |
| Fresh vs returning profile | Yes | `_fbp`, `_fbc`, referrer state (4.5) |
| Egress region (EEA vs non-EEA) | Yes, every state | Server-context fields and served config can be geo-derived |

### 4.5 Identity rules for `_fbp` and `_fbc`

- A fresh profile has no `_fbp`. The tag generates it on load. The fixture records the cookie value, its attributes and the matching wire value as `generated`, with its rule.
- A returning profile reuses the stored cookies from a named earlier fixture in the same session. Its manifest names the source fixture. The wire value is then `input-derived` from the stored cookie.
- `_fbc` appears only with `fbclid`. Cases: no click, same click, changed click, each on a fresh and a returning profile. A returning profile with a new `fbclid` is a declared case.
- A fresh recording is never compared with a returning one except as the declared one-factor variant.
- The held-out check (4.8) includes one returning-profile recording whose `_fbp` was not used to derive the rule.

### 4.6 Full stored input state (point 1)

Every fixture's manifest stores: URL and referrer, viewport, locale, timezone, egress region as a label plus an opaque exit ID (no hostnames, ports or credentials), browser name and version, headed or headless, profile kind (fresh or returning), cookies, localStorage and sessionStorage before and after, the digests of the script and config actually loaded, the capture date, and the settings state with the time and wait recorded for it. A fixture without that block is rejected by the recorded-fixture check (task MT0). Old recordings (`test/fixtures/meta-tr-pageview.redacted.json`, `test/fixtures/parity-meta-tr.redacted.json`, the 061 and 062 receipts) lack that block and are re-taken, not reused. They stay as history.

### 4.7 Unstable state

Section 2.4 applies: a field that differs across setups, regions or days and has no explanation puts the state in `unstable`. The state is reported to the owner and does not enter the frozen inventory silently.

### 4.8 Held-out check of derived rules (point 7)

Before the freeze and before any slice, every derived field rule is checked against recordings not used to derive it: the second-day drift loads plus at least one extra setup (a different viewport, locale and page path on a fresh profile). A rule that fails is rewritten, or the field is classed `volatile` only if it meets the volatile definition. If the rule fails and the corpus cannot explain why, this is kill criterion 3 (10.3).

### 4.9 Owner's normal-browser reference capture

The owner does one capture in a normal browser of a state the agents also record (decision O7: the S1 base PageView). We compare it field by field with the agent recording. Any difference in a fixed or generated field goes to the owner before the freeze commit. The expected explanation is the capture setup, but it is checked, not assumed. A state is never marked `blocked` before a normal-browser try. The owner Test Events receipt (spec 060, "Grounded starting point" item 3) stays an owner-attributed observation, not a paired fixture.

### 4.10 Live-only tags

Rows that need something fixtures cannot hold are tagged now: Test Events receipt and delivery, matching quality, deduplication with server (Conversions API) events, catalog and audience results, attribution, Events Manager diagnostics, and any behavior only a normal browser or a registered ad-network response shows (for example Attribution Reporting registration, if capture finds it). They are checked once at the release check (ADR-0061 point 1). A row discovered live-only during capture is added here before the freeze.

### 4.11 Pilot (point 7)

The pilot is the capture session plus slice M1. We count the captures M1 needed beyond the corpus and write the number into section 12 at pilot close. Clean-room risk is real for Meta: the chamber is a reimplementation, not the pinned open-source SDK. So Meta gets its own pilot and the Adobe pilot does not stand in for it. If M1 needs more than 3 extra captures, or M2 to M4 together need more than 5, kill criterion 4 applies and we revisit the freeze unit. This is a coordinator decision, not an acceptance gate.

## 5. Capture corpus

Each state below is recorded as base, repeat and an EEA recording (4.4), with the extra S1 and S2 variants noted. Pages are served from the owned test host.

| ID | State | Notes |
|---|---|---|
| S0 | Positive control, native beacon, full fan-out | Part of S1 step 2 (4.1); ladder rung recorded |
| S1 | PageView, fresh, no consent restriction, base config | 3 same-day loads per exit (drift, 4.1), plus viewport, locale and timezone, referrer variants |
| S2 | PageView, returning profile | Reuses a named S1 profile; viewport, locale, referrer variants |
| S3 | Click ID: no click, same click, changed `fbclid` | Fresh and returning each |
| S4 | The 17 standard events, one event per load with representative data | |
| S5 | Data-vocabulary input matrix (2.1): omission, coercion, zero, fractions, Unicode, nesting, invalid | Batched in a small set of scripted loads |
| S6 | `trackCustom`, `trackSingle`, `trackSingleCustom`, two pixels (the test pixel plus the second, O9) | |
| S7 | Consent: revoke, grant, re-grant, queued commands; `dataProcessingOptions` empty, LDU, country and state variants | |
| S8 | Manual identity: each of 11 fields raw and prehashed, `set` userData, login and logout transition | Test identities (4.3) |
| S9 | Automatic matching, base account setting | Form page (SET1 trigger) |
| S10 | Automatic events, base setting: button click, page metadata | |
| S11 | Lifecycle: SPA history change, unload send, transport choice, JavaScript disabled (noscript image) | |
| S12 | Errors: script blocked, config blocked, `/tr` blocked, non-200, invalid commands | |
| S13 | Event ID: `eventID` on browser events | Browser side only |
| S14 | One state per settings candidate SET1 to SET8, plus the combined state SET9 | Owner window (5.1) |
| S15 | Second-day drift loads | Repeat of S1 and S4 Purchase on day 2, both exits |
| S16 | Normal-browser reference (owner) | One state: S1 base |
| S17 | Restore confirmation | One S1 load after settings are restored; must match the day-1 base |
| S18 | Held-out extra setup | Different viewport, locale, page path, fresh profile, plus one returning-profile recording whose `_fbp` was not used to derive any rule (4.5) |

Size estimate, by state (base, repeat and EEA = 3 each unless noted): S1 about 15 (3 loads x 2 exits, plus 3 variants x 3 recordings), S2 12 (same three variants), S3 18, S4 about 60 (17 events x 3, plus 3 Purchase variants x 3), S5 12, S6 12, S7 30, S8 72, S9 to S13 about 60, S14 24 to 33 (8 to 11 states), S15 8, S16 1, S17 1, S18 6. Total about 330. Agent-scripted, so the cost is exit time and disk, not owner time. Kill criterion 4 fires above 450 recordings, which is the estimate plus about 35%.

### 5.1 Capture run order

1. Drift probe (4.1) with the positive control, including EEA exit and non-EEA exit.
2. Agent-only states with base account settings: S2 to S13, then S18.
3. One owner settings window, about 2.5 hours (decision O2). The owner makes one settings change per step: revert the previous candidate and flip the next in the same save, so each recorded state is exactly one factor from the base. Then the owner says so. The agent waits per candidate for the config bytes to change (or 30 minutes), checks the served config, and records. The owner is only needed for the changes and for S16, so the owner can step away between changes when waits are long. Arithmetic: SET1 to SET7 is 7 states, SET8 adds 0 to 3, SET9 adds 1, so 8 to 11 states. With the restore that is 9 to 12 settings changes, and one wait each, because revert and flip share one change. If every wait hits 30 minutes, the agent portion takes up to 6 hours. The owner portion stays about 2.5 hours, because flips are made in sequence and waits overlap with recording and with the Adobe window. If propagation is slow, the owner presence is still one sitting. A second sitting is a scheduling event, not a kill.
4. Restore step: the owner restores every setting. The agent waits for the config bytes to match the day-1 bytes and records S17. It must match the S1 base.
5. S15 follows on day 2. The freeze commit follows S15, the held-out check and the owner normal-browser comparison.
6. Every manifest records the SHA-256 of the script and config actually loaded. A digest change inside a settings window is expected only when the config digest follows a setting. A script-build change during the session aborts it (4.1 stop rule).

## 6. Carried checks (ADR-0061)

### 6.1 Inventory completeness against real configs

Before the freeze, compare the candidate inventory with the config shapes and setting combinations public sites actually serve (`connect.facebook.net/signals/config/<pixel>`).

- Sample: at least 30 distinct pixel IDs, from up to 60 homepage GETs. At 30 samples the 10% threshold is 4 configs (more than 3 out-of-inventory fails). Method: one plain HTTP GET per site of a public homepage chosen from a public site list (no JavaScript executed, no interaction, no cookies), extract the pixel ID from the HTML, then one GET of its `signals/config/<pixel>` bytes. Ten of the sampled configs are fetched from both the EEA and the non-EEA exit.
- Metric: out-of-inventory rate = (sampled configs with at least one flag, plugin or setting shape not covered by an inventory state) divided by (all sampled configs). Value so far: not measured.
- Threshold: above 10% is kill criterion 6. Include at least one combined-settings state (SET9). Sampled shapes that are not covered are filled now (a new S14 state, the owner window permitting) or the freeze unit is revisited.
- This probe touches production sites, so it is an owner decision (O4) and does not run before approval. Reading a public site's served config does not change anything on that site.

### 6.2 Point 11: reading a customer's served config in production

ADR-0061 point 11 has no design. Today the only config path is adopter-supplied `boot(config)`. Proposal: slice M11 makes the chamber read the served `signals/config/<pixel>` through the mediated egress seam at boot, compare its shape with the frozen inventory's shape list, and surface a visible diagnostic when the config has a flag, plugin or shape outside the inventory, or a server-context field takes a value not seen in the corpus. It never silently drops data or auto-disables collection (ADR-0040 item 8). The alternative is an explicit v1.0 scope decision that production reads only adopter-supplied config. Decision O5 asks the owner to pick one. Recommendation in section 11.

### 6.3 Owner-only capture route (Meta)

If only the owner's normal browser yields Meta traffic (ladder rung 3 reached for the positive control or most states):

- Time-box: 10 calendar days from the start of the capture session, and at most 3 owner capture sittings of 45 minutes. Recommended; the owner may change it (O6).
- When the time-box runs out, Meta work stops. We do not keep the session open.
- At that point one decision goes to the owner: may slices start on the states already captured? Allowing it would change ADR-0061 point 7 (a vendor's capture session runs before any of that vendor's slices start). Default if the owner does not answer: no.
- States never captured are reported as `blocked`, with the ladder log. They are not filled with synthetic data (kill criterion 1).

## 7. Dependency: comparator native-side field rules

The comparator treats native values as exact. It marks native-side rules `native_normalization_unsupported` (`rig/native-tag-comparison.md:186-194`; ADR-0061 Consequences). Meta slices need rules of the kinds in 2.4 (generated, input-derived, server-context-derived) on native inputs, so no Meta field slice can close without it.

This is shared toolkit work that lands on main: it is the comparator part of Adobe task B0 (spec 064, section 8). We do not build it on this branch. Meta M1 and every later slice wait for it. The capture session does not: it only records. If B0 is not on main when CAP closes, we report that to the owner, captures stay done, and slices stay blocked until it lands. MT0 (below) consumes whatever the shared work has landed, merges main when it arrives, and does not fork the comparator.

## 8. Disposition of specs 060 to 063

History is kept. Specs 060 and 063 get a dated rescope note at its top, and its slices get new statuses where allowed. No record is rewritten. This disposition has already been applied on this branch (rescope notes added 2026-11-12, status board regenerated). The Today column shows the state after that. Still outstanding: the 063-01 claim holder closes that slice, and the owner answers O10.

| Spec or slice | Today | Disposition |
|---|---|---|
| 060 spec | DONE (rolled up once 060-01 to 060-12 were abandoned) | Rescope note added. The goal is carried by 066 and the M-slices. Spec 060's binding acceptance criteria C1 to C9 (060:139-151, not the settings candidates of section 3) stay as the source for slice acceptance criteria |
| 060-01 first PageView | ABANDONED | Abandoned and reframed as slice M1 (pilot). Its claim is released |
| 060-02 to 060-12 | ABANDONED | Abandoned. Each is superseded by an M-slice (table below). Their acceptance wording is reused when the M-slice file is written |
| 060-13 to 060-21 | DONE | Stay DONE. They are the existing prototype, the retained pins, the referrer and timing work (ADR-0055) and the sampling discriminant. Their code is the starting point for M1 and M5 |
| 061 spec and 061-01 | DONE | Stay DONE. Their recordings lack the stored-input manifest, so S1 is re-taken |
| 062 spec and 062-01 | DONE | Stay DONE. The timezone and `_fbp` behavior is reused by M1 and M5 |
| 063-01 once PageView | IN_PROGRESS (meta-live-delivery) | Rescope note only. A live Test Events readback is a live-only row checked at the release check (4.10). Its claim holder closes the slice. This spec does not change the claim |
| 063-02, 063-03 | DONE | Stay DONE |
| 063 spec | IN_PROGRESS (063-01 open) | Rescope note added. Closes when 063-01 is closed |

Mapping of the abandoned journeys:

| 060 journey | M-slice |
|---|---|
| 060-01 bootstrap and first PageView | M1 |
| 060-02 event and commerce data | M2 |
| 060-03 route and configure multiple pixels | M3 |
| 060-04 consent and processing choices | M4 |
| 060-05 anonymous and click continuity | M5 |
| 060-06 explicit identity through account changes | M6 |
| 060-07 approved forms, automatic | M7 |
| 060-08 code-less events and metadata | M8 |
| 060-09 navigation, exit and no-JavaScript | M9 |
| 060-10 browser and server events | M10 |
| 060-11 diagnose connected collection | M12 |
| 060-12 cut over, roll back, maintain assurance | M12, M13 |

## 9. Ordered slice list (Meta)

Counting rule: MT1, MT2 and MT0 are pre-capture tasks with their own completion checks (no fixture comparison, because the corpus does not exist yet, ADR-0061 point 7). CAP is the capture session. M1 to M13 are slices. MT1 and MT2 are read-only (retained bytes and public documents) and may start before approval. MT0 writes tooling only and may also start before approval. CAP and everything after it wait for approval (O1). Each slice is sized for one fresh session and ends with a recorded-fixture comparison through real chamber dispatch (ADR-0061 point 1). Slice files with acceptance criteria are written after approval so the pilot can still change them.

| Slice | Goal | Depends on |
|---|---|---|
| MT1 (task) | Close the command, field and request inventory from the retained runtime and config bytes; list every flag and plugin the config enables; locate the 058-02 retained bytes | none |
| MT2 (task) | Candidate settings list (section 3) from public docs; completeness-probe protocol and site list (6.1) | none |
| MT0 (task) | Capture tooling: manifest schema and stored-input check, credential check as a repository test (4.3), no-abort native recorder with response capture, headed and headless modes, EEA exit routing. Consumes the shared comparator rules from main | MT1 |
| CAP | **Capture session** (section 4). Owner approval first | MT0, MT1, MT2, O1, O2, O3, O6, O7, O8, O9, O11 (O4 gates 6.1 and O5 gates M11, not CAP) |
| M1 | Bootstrap, queue, `init`, PageView, network shape, `ler`/`plt`, served-config reading for the pilot state. **Pilot slice** | CAP, comparator rules |
| M2 | Standard events, data vocabulary, custom events, invalid input, catalog data (collection side) | M1 |
| M3 | Multi-pixel routing, `set`, config effects of the settings in S14 | M1 |
| M4 | Consent and data processing options, queue retention and replay | M1 |
| M5 | `_fbp`, `_fbc`, `fbclid`, first-party cookie setting (SET3), transport credentials | M1, M4 |
| M6 | Manual identity matching: raw and prehashed fields, login and logout | M5 |
| M7 | Automatic matching (SET1) | M6 |
| M8 | Automatic events and page metadata (SET2, SET4) | M2 |
| M9 | SPA, unload, transport choice, no-JavaScript, error paths | M2, M5 |
| M10 | `eventID`/`eid` browser side; server-event correlation fields | M2 |
| M11 | Point 11: served-config reading in production, out-of-inventory diagnostic. Needs owner decision O5 | M3, M7, M8 |
| M12 | Diagnostics, compatibility report, performance and confinement budget (specs 060-11, part of 060-12) | M1 to M10 |
| M13 | Release check wiring: fixtures against live, live-only rows (4.10), one setup and egress location not in the corpus, the per-field drift policy of ADR-0061 point 10 (fixed, generated, input-derived or server-context mismatch fixed in the current version; volatile no action; new fields and never-seen endpoints to the next version), cutover and rollback | M12 |

The existing prototype (`connectors/meta-pixel/pageview-prototype.js`, `adapters/meta-pixel-prototype.js`, `adapters/meta-pixel-owned-poc.js`) is the starting point for M1. The generic pixel connector (`connectors/pixel/vendors/meta.js`, spec 026) is not the target: this inventory covers fbevents.js behavior, which that connector does not.

## 10. Production-site probes and kill criteria

### 10.1 Production-site probes

No probe touching a production site, tenant or real-user data runs without the owner's written approval in this section, naming the site list and the probe. At review time none is approved. The completeness probe (6.1) needs that approval (O4). The Meta test pixel and the owned test site are not production for this purpose. Placeholders the owner fills in:

- Owned test pixel ID: `<OWNER TO CONFIRM>`
- Owned capture host URL: `<OWNER TO FILL IN>`
- Second owned test pixel ID for multi-pixel states (O9): `<OWNER TO FILL IN, or "none, use a never-created ID">`

No capture and no probe run while any of these is a placeholder.

### 10.2 Applicability of ADR-0061 carried checks

| Check | Applies to Meta? | Where |
|---|---|---|
| Inventory completeness against real `signals/config` configs, numeric threshold, combined state | Yes | 6.1 |
| Point 11 design | Yes | 6.2, M11, O5 |
| Owner-only capture route time-box | Yes | 6.3, O6 |
| Egress region as a factor | Yes, every state | 4.4 |
| Clean-room risk | Yes, own pilot | 4.11 |
| Credential check as a repository test | Yes | 4.3 |
| Held-out rule check | Yes | 4.8 |
| Drift and field classes (point 10) | Yes | 2.4, 4.1 |
| Release-check clause of point 10 (out-of-corpus setup and location, drift policy) | Yes | M13 |

### 10.3 Kill criteria

From ADR-0061, with numbers added where it left the choice open:

1. The capture set cannot be acquired, including the positive control or any state blocked after ladder rung 3 and the owner-only time-box (6.3). Stop. Slices never close on synthetic fixtures.
2. The drift probe or the same-day loads show fixed fields moving across more than half of the recorded states, the served `fbevents.js` build changes during the session (judged on the script, not on a per-pixel config digest), or the request set varies between same-setup loads without explanation. Stop and report to the owner before any slice.
3. The held-out recordings fail more than 10% of derived rules, and the corpus cannot explain why. Stop and report to the owner before any slice. Below that figure, any single unexplained held-out failure blocks its own row until it is explained, the rule is rewritten, or the field legitimately classes as volatile.
4. The inventory needs more than 450 recordings, or follow-up captures keep adding missing states after the pilot (M1 needs more than 3 extra, or M2 to M4 together more than 5). Revisit the freeze unit.
5. A release check finds fixtures no longer match live behavior on 3 or more rows. Revisit the freeze unit and the refresh rate.
6. The out-of-inventory rate (6.1) exceeds 10%.

## 11. Decisions for the owner

All are open. The recommendation comes first in each.

- **O1. Approve this spec and the slice order.** Recommended: yes. Nothing live runs before this, and one yes unblocks CAP. MT0 writes tooling only and may start earlier, like MT1 and MT2.
- **O2. Settings window length.** Recommended: one sitting of about 2.5 hours, right after the Adobe window. The waits dominate: 8 to 11 candidate states and a restore, each with a config-propagation wait of up to 30 minutes (9 to 12 waits, up to 6 hours of agent time in the worst case). I can overlap waits with the Adobe window, since they sit in different consoles, so the two vendors need much less than the sum of both. If you can only give 2 hours, S14 candidates SET6 and SET8 move to a second short window.
- **O3. EU exit.** Recommended: reuse the exit you agreed for Adobe (a second egress region). Meta needs it for more of the session than Adobe, because every state gets an EEA recording, so the exit has to stay up for the agent part of the capture (several hours, not one pair of captures). If the exit is a VPN, the credential check (4.3) covers it.
- **O4. Completeness probe on public sites.** Recommended: approve up to 60 plain homepage GETs (one request each, no JavaScript, no interaction), enough to reach 30 distinct pixel IDs because many homepages load the pixel through a tag manager and show none. Add one GET of each found pixel's config, from the public site list we name in the spec. It tells us the out-of-inventory rate. If you'd rather not touch third-party sites, the fallback is the owned test pixel only, and we say the metric was not measured. Then the kill criterion has nothing to trigger on.
- **O5. Point 11.** (Checked against ADR-0062 pending: the diagnostic changes no output, so it is stock by default.) Recommended: slice M11, with the chamber reading the served config at boot and showing a visible diagnostic. ADR-0061 says the shipped chamber reads each customer's live config, and the diagnostic is the only guard when assurance is stale. The alternative is an explicit v1.0 scope decision that production only reads adopter-supplied config, which is cheaper and leaves a gap you accept.
- **O6. Owner-only route.** Recommended: time-box of 10 calendar days and at most 3 sittings of 45 minutes. If it runs out, Meta stops, and the question comes back to you: may slices start on states already captured? Recommended answer when asked: no, unless a majority of the S1 to S8 states were captured and the drift check passed, then yes for those. That would change ADR-0061 point 7 for Meta, so your call at the time.
- **O7. Normal-browser reference state.** Recommended: the S1 base PageView, the simplest state we also record from an agent, so a difference is easy to read.
- **O8. Test pixel.** Recommended: confirm that the dedicated test pixel is test-owned and its ID may be committed, and that it is not attached to a live ad account. State the owned capture host URL (10.1).
- **O9. Second pixel for multi-pixel states.** Recommended: a second owned test pixel. If you don't have one, use a never-created ID and accept that the config for it is whatever Meta returns.
- **O10. State of 063-01.** Recommended: the claim holder closes it with the rescope note, and the live readback becomes a release-check row. No action from you beyond a yes.
- **O11. Variant scope.** Recommended: accept the bounded deviation in 4.4 (one-factor variants for S1, S2 and S4 Purchase, egress region for every state). Full variants for every state would multiply the corpus by about 4 and add little, since those factors do not depend on the command. If you want a different set, say which. A yes is recorded as a dated amendment line under ADR-0061 point 1.
- **O12. Defaults that cannot simply align to stock.** The seal's default today is consent pending and egress blocked until allowed (architecture.md, Clarifications Q2), and spec 060 sets bounded queues, byte limits and "approved" forms and roots. Under the new rule these must become opt-in. Changing them touches shared code and the other vendors' tracks, so it is your call. Recommended: yes for Meta now. Meta slices default to stock (no hold, no cap, form and metadata observation per served settings). The consent hold, allowlist, field strips and caps become site opt-ins, and the shared seal default is changed in a separate cross-vendor slice on main under ADR-0062. Until that slice lands, M4 and M7 to M9 wait for it, or run with the Meta chamber's own default override.

## 12. Review log and carried findings

Review rounds are capped at three before owner review (owner decision). Each is a fresh independent Opus reviewer that reads only this spec, ADR-0061 and the cited sources. Findings left after round 3 go into the pilot as listed checks.

- Round 1 (Opus, 2026-11-12): 6 major, 7 minor. Fixed: settings-window arithmetic and the kill criterion no longer tied to one window (5.1, 10.3); C8 capped at 3 with a pre-CAP list; recording count derived per state, cap raised to 450; one-factor variants widened to S1, S2 and S4 Purchase and declared as a deviation (O11); drift probe split into script leg and config leg because configs are per pixel; section 8 Today column updated to applied state; section 0 slice counts; candidate settings got owning slices; sample size reconciled (60 homepage GETs for 30 pixel IDs, threshold is 4 configs); single unexplained held-out failure blocks its row; drift loads re-run in the ladder-selected mode; MT0 may start before approval; credential check is a repository test.
- Round 2 (Opus, 2026-11-12): 3 major, 5 minor. Fixed: settings candidates renamed SET1 to SET9 to avoid clashing with spec 060's C1 to C9 acceptance criteria; positive-control rule for image beacons with empty bodies, and 058-02 and 061 attribution corrected; window arithmetic restated (up to 10 candidates, 12 waits, 6 hours agent time); CAP gated on O11; release-check clause of point 10 added to M13 and 10.2; `mixed`/`unknown` allowed only before freeze; credential check wording unified; S1 and S4 recording counts reconciled.
- Round 3 (Opus, 2026-11-12): 2 major, 9 minor. Fixed: one settings change per step (revert and flip together) so states stay one-factor; one derivation of state and wait counts used in 3, S14, 5.1 and O2; SET9 owner; CAP no longer gated on O4 and O5; returning-profile held-out recording in S18; MT0 named in the summary; rescope-note sentence narrowed to 060 and 063; exit recorded as label plus opaque ID; O11 yes becomes an ADR-0061 amendment line; B0 fallback in section 7; citations corrected. Nothing open carried to the pilot.
- 2026-11-13, owner rule (ADR-0062, pending): section 1.1 added, O12 added, O5 annotated. No review round, by instruction.
- Pilot count of extra captures: _to be filled at pilot close_.

## 13. Clarifications

None open. Slice files with acceptance criteria are written after approval, so the pilot can change them.
