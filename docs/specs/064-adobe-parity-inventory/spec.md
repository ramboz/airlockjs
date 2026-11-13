---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-2, UC-7, UC-8, UC-10]
---

# Spec 064: Adobe parity inventory (Alloy 2.31.1)

> Frozen inventory and capture plan. Written 2026-11. Pinned to Alloy 2.31.1.
> Definition of done: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md). Not re-opened here.
> Adoption path: [ADR-0038](../../decisions/adr-0038-reframe-onto-adobe-first-compatibility.md). Acceptance boundary: [ADR-0039](../../decisions/adr-0039-airlock-boundary-acceptance.md), partly superseded by ADR-0061.
> Sister specs: 065 (Google inventory) and 066 (Meta inventory) are reserved. This spec creates no 067+ specs; build work is an ordered slice list (section 8).

## 0. Summary for the owner

This spec turns "Adobe compatibility" into a list we can build against. It pins Alloy 2.31.1, lists every behavior we owe, and plans one capture session that records the real tag so each slice can be proven against recordings.

No captures, live vendor calls or production probes run until you approve it. Three read-only or tooling tasks (T1, T2, B0) may start before.

It also retires the old plan. Specs 052 to 057 were unsliced outlines. Spec 051 carried a stock baseline and an 8-hour spike that ADR-0061 makes unnecessary. Section 7 closes or reframes each one, and section 8 gives three pre-capture tasks, the capture session, and twelve slices (B1 to B12), each sized for one fresh session.

The main tradeoff is front-loading. We spend one capture session before any slice. In exchange, every slice has fixtures, and the pilot (capture session plus slice B1) tells us if the corpus was complete.

Decisions I need from you are in section 11. There are seven (D1 to D7).

## 1. Scope and frozen inventory rules

- Pin: Alloy **2.31.1**, SHA-256 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`, 152,336 bytes. ACDL 3.0.1. `aem-martech` at `1aa3dee3c4791636efa9ad2994342f861c8e149b`. The reference trailing-LF difference stays disclosed.
- Frozen per ADR-0061 point 3. A later discovery goes to the next Alloy version unless it breaks a covered row. A missing capture for an inventoried behavior is a gap we fill in this session.
- Class for every row: `worker-native` (runs in the chamber unchanged), `mediated` (needs a capability-bridge call), `host-side` (stays on the main thread), `incompatible` (stated, with reason), `live-only` (cannot be fixture-proven, tagged up front).
- Each row has an owning slice (section 8). A row without an owner is a defect in this spec. An owner is a slice, or a task (T1, T2) for rows still being closed.

## 2. Inventory

### 2.1 Commands

AST discovery of the pinned bundle (R-014, "Pinned SDK command-source discovery") found 15 static names. Two further `commands` properties reference identifiers, so the list is **not closed**. Closing it is task T1 below, done by reading the pinned bundle, no vendor code executed.

| # | Command | Initial class | Slice | Notes |
|---|---|---|---|---|
| 1 | `configure` (core) | mediated | B1 | Options subset recorded; unknown options fail loudly |
| 2 | `sendEvent` | mediated | B1, B2 | XDM, data, `renderDecisions`, `decisionScopes`, `mergeId`, `edge.hostname` override |
| 3 | `applyResponse` | worker-native | B3 | Consumes a stored response |
| 4 | `getIdentity` | mediated | B4 | ECID rule in section 4.6 |
| 5 | `appendIdentityToUrl` | host-side | B4 | Needs page URL |
| 6 | `getLibraryInfo` | worker-native | B1 | Version string equals 2.31.1 |
| 7 | `setConsent` | mediated | B5 | Consent gate interaction |
| 8 | `createEventMergeId` | worker-native | B2 | |
| 9 | `getMediaAnalyticsTracker` | incompatible until proven | B9 | Media Analytics; decided in B9 |
| 10 | `applyPropositions` | host-side | B6 | DOM rendering |
| 11 | `evaluateRulesets` | worker-native | B6 | |
| 12 | `subscribeRulesetItems` | worker-native | B6 | |
| 13 | `createMediaSession` | incompatible until proven | B9 | |
| 14 | `sendMediaEvent` | incompatible until proven | B9 | |
| 15 | `sendPushSubscription` | incompatible until proven | B10 | Needs service worker and permission |
| 16 | `sendConversationEvent` | incompatible until proven | B10 | |
| 17 | `setDebug` and other core commands | worker-native | B1 | T1 enumerates the full list against the bundle and Adobe's public command list. Assurance hooks are a separate row (2.2) |
| 18 | two identifier-referenced `commands` | unknown | T1 | Must be named before freeze |

### 2.2 Other rows

| Area | Rows | Initial class | Slice |
|---|---|---|---|
| Network | `interact` / `collect` / `consent` edge endpoints, request body shape, query string, headers. Each request gets a request-level class: `always`, `conditional` (with its rule), or `volatile`. Endpoint presence, multiplicity and redirects are classed too | mediated | B1 |
| Response handling | `handle` types: `state:store`, `identity:result`, `personalization:decisions`, `locationHint:result`, `redirect`, `activation`, `consent`, others seen in capture | mixed | B3 |
| Storage | `kndctr_*` cookies, first-party ID cookie, localStorage keys, sessionStorage, cookie-cache sync (existing `sync-cookie-cache.js`) | mediated | B4 |
| Identity | ECID mint, `identityMap`, CORE namespace, `idMigrationEnabled`, third-party ID sync | mixed | B4 |
| Consent | `defaultConsent`, `in`/`out`/`pending`, IAB TCF 2.0 and `adobe`/`gpc` standards | mediated | B5 |
| Personalization | proposition types: HTML content, JSON content, DOM action set, redirect, rule set, Target activity. Rendering, flicker control, `renderDecisions`, `prehidingStyle`, click and display notifications | host-side | B6, B7 |
| Lifecycle | page view, SPA view change (`viewStart`), `onBeforeEventSend`, `onBeforeLinkClickSend`, link-click collection | mixed | B2, B8 |
| Context | `context` option (web, device, environment, placeContext), implementation details block, client hints | worker-native | B1 |
| Errors | failed network, non-200, malformed response, consent pending queue | worker-native | B3, B5 |
| Launch and `aem-martech` | `aem-martech` plugin API, ACDL 3.0.1 data-layer events, Launch extension bridge | host-side | B8 |
| Debug | Adobe Assurance hooks | live-only | B10 |

Every row gets a one-line fixture reference once the capture session finishes. Unknown rows found during capture are added to this table before the freeze commit. After that commit the table is frozen.

## 3. Adoption path (ADR-0038)

1. Investigate an Airlock-backed `aem-martech` adoption path. Slice B8 owns this. The decision output is one of: drop-in, wrapper, or not viable, with the evidence.
2. Reach full pinned Alloy.js compatibility, row by row, with the fixtures from section 5.
3. Validate Adobe workflows (spec 056 outline). Under ADR-0039 downstream reporting stays a nonblocking follow-up.
4. SDK boot alone is never product proof.

## 4. Capture session plan (ADR-0061)

One session, run by agents on the owner's standing approval for test-only scripted captures (ADR-0061 point 6). Owner sessions are only for settings changes and the normal-browser capture. Production sites and real-user data keep the old gates (section 9).

### 4.1 Positive control first (point 8)

The session starts by recording at least one complete native beacon with the exact capture setup:

- fresh profile (section 4.2), desktop Chromium, **headed or headless stated per run in the manifest**;
- full request and response fan-out: every request the tag makes (edge `interact`, `collect`, any identity sync, any Analytics receipt), with headers, body, status and response body;
- Adobe's prior finding (R-014 ~1132-1183): HeadlessChrome was classed as bot traffic and returned no Analytics receipt, while headed returned the ordinary one. So the positive control runs headed first, then headless. If they differ, headed is the capture mode and the difference is a recorded row.
- Capture mode rule: the mode whose control shows the full fan-out (including the Analytics receipt) is the capture mode. If both do, headed is used. The escalation ladder (ADR-0061 point 8: headless, headed, owner's normal browser, then `blocked`, never synthetic) applies only when a run produces no traffic or no receipt.
- If the control cannot be recorded, nothing else is captured.

Served-script drift probe (ADR-0061 point 10): not applicable to the script, because the Alloy bundle is SHA-pinned (section 1). The same-day noise floor is taken as three same-day loads of S1 (base plus two repeats) before any other state counts, then the day-2 loads in S11.

### 4.2 Test identities and profile (point 5)

- Owned test-account IDs may be committed: Adobe org ID, datastream ID, Target property, Analytics report suite, Launch property. Only IDs the owner confirms as test-owned. Nothing from a customer or production tenant.
- Reference site: the owned EDS test site and local harness only.
- Fresh Chromium profile created for this session, never logged in to any vendor, separate from the owner's console session. One new profile per "fresh" recording; one reused profile per "returning" recording.
- Pre-commit check, added before the first capture is stored: it rejects vendor login or session cookies, bearer and API tokens, Adobe IMS tokens, and VPN or proxy credentials in any staged fixture. It is a test in the repo, runs in `npm test`, and has its own positive and negative cases. It scans request headers, response headers, bodies, and stored cookie and storage dumps.
- The Edge `kndctr_*` and ECID values are test-profile values. They may be committed. Everything else in the cookie jar is checked by name against an allow-list.

### 4.3 Recording set per state (point 1)

Every state is recorded as base plus same-setup repeat. The one-factor-at-a-time (OFAT) variants are recorded for S1 only, because the factors (viewport, locale, referrer, profile kind) are context fields that do not depend on the command. Consent and datastream variants are their own states (S6, S9). Section 5 is the authoritative per-state matrix. Each recording is:

1. base;
2. same-setup repeat (same profile kind, same inputs; gives the noise floor);
3. one-factor-at-a-time variants:

| Factor | Applies to Adobe? | Why |
|---|---|---|
| Viewport | Yes | Context block carries viewport; Target decisions can key on it |
| Locale and timezone | Yes | Context block and `Accept-Language` |
| Referrer | Yes | Context block and Target audience rules |
| Fresh vs returning profile | Yes | ECID and `kndctr_*` state; see 4.6 |
| Egress region | **Probe once, expected No** | See 4.4 |
| Consent state (`in`/`out`/`pending`) | Yes (Adobe-specific) | Changes whether and what is sent |
| Datastream config state | Yes (Adobe-specific) | Section 6 |

### 4.4 Egress region

ADR-0061 includes egress region for Google and Meta because `dma` is geo-derived. Adobe has no client-side geo-derived field. The Edge Network chooses a region by anycast and `locationHint`, and the SDK stores the hint in `kndctr_*` state. So egress region is **not a recording factor** for Adobe request fields.

It might still change response fields (`locationHint:result`, Target geo audiences, Edge cluster in a response header). One check covers it: a single pair of test captures of the same state, one from the default egress and one from a second region, compared on response fields only. If any response field differs in a way the chamber would need to handle, egress region becomes a factor in the base set. This uses a VPN, so the VPN credential check (4.2) applies and the pair needs the owner to provide the second egress. If the owner does not want to provide one, the row is tagged `live-only: geo` and the gap is stated in the freeze note. That is a deliberate, owner-decided deviation from point 9's EEA-egress rule (which is a Google/Meta item), accepted when the owner answers D2.

### 4.5 Full stored input state (point 1)

Every fixture stores, in its manifest: URL and referrer, viewport, locale, timezone, egress region, browser name and version, headed or headless, profile kind (fresh or returning), and cookies, localStorage and sessionStorage **before and after** the run. A fixture without that block is rejected by the recorded wire checker (051-07 extension, slice B0).

### 4.6 ECID fresh-vs-returning rule

- A fresh profile has no ECID. The first response mints one. The fixture records the minted ECID as `server-context-derived`, not `fixed`.
- A returning profile reuses a stored ECID from a prior fixture in the same session. Its manifest names the source fixture.
- Never compare a fresh recording with a returning one except as the declared one-factor variant. The comparator treats ECID fields as `server-context-derived` on fresh and `input-derived` on returning.
- The held-out check (4.7) must include one returning-profile recording whose ECID was not used to derive the rule.

### 4.7 Held-out check of derived rules (point 7)

Every field rule we derive (for example "ECID is a 38-digit minted value", "`eventId` is a UUID", "timestamp is within N seconds") is checked against recordings not used to derive it. The held-out set is the second-day drift-probe loads plus at least one extra setup (a different viewport and locale on a fresh profile). A rule that fails the held-out set is rewritten or the field is tagged `volatile` and compared as shape only.

### 4.8 Owner's normal-browser reference capture

The owner does one capture in a normal browser of a state the agents also record. We compare it field by field with the agent recording. Any difference in a fixed or generated field goes to the owner before the freeze commit. The expected explanation is the capture setup, but it is checked, not assumed. A state is never marked `blocked` before a normal-browser try.

### 4.9 Live-only tags

Rows that need something fixtures cannot hold are tagged `live-only` now, with the reason, before capture. Initial list: downstream Analytics reporting (spec 056 follow-up), Target activity serving window (the owned activity is currently inactive; reactivating is an owner settings change), Assurance debug sessions, any geo-dependent response (4.4 if the owner declines the second egress). Live-only rows are checked once at the release check (ADR-0061 point 1).

### 4.10 Browser scope (point 9)

Desktop Chromium only for v1.0. Firefox, Safari, mobile and WebView are out and listed as out in the freeze note.

### 4.11 Pilot definition (point 7)

The pilot is the capture session plus slice B1. We report how many captures B1 needed beyond the corpus. The number is written into this spec at pilot close. If B1 needs more than three extra captures, that is a kill criterion trigger (section 10), not a quiet top-up.

The ADR's Google/Meta clean-room risk is **not** tested by this pilot, because Adobe runs the pinned open-source SDK in the chamber.

## 5. Capture corpus (what gets recorded)

| ID | State | Variants |
|---|---|---|
| S0 | Positive control, native beacon | headed, headless |
| S1 | Page view, no consent restriction, fresh | base, repeat, viewport, locale/tz, referrer |
| S2 | Page view, returning | base, repeat |
| S3 | `sendEvent` with custom XDM and `mergeId` | base, repeat |
| S4 | `sendEvent` with `decisionScopes` and `renderDecisions` | base, repeat; Target activity response (inactive: records the no-decision shape; active: owner reactivates it) |
| S5 | `getIdentity`, `appendIdentityToUrl` | fresh, returning |
| S6 | `setConsent` out, in, pending then in | each with queued events |
| S7 | Link click and SPA view change | base, repeat |
| S8 | Error shapes (blocked network, non-200) | one each, scripted |
| S9 | Datastream config states (section 6) | one per setting, plus one combined-settings state |
| S10 | Launch + `aem-martech` + ACDL page | base, repeat |
| S11 | Second-day drift probe | repeat of S1, S3 on day 2 |
| S12 | Normal-browser reference (owner) | repeat of S1 |
| S13 | Egress response-field pair (only if D2 = yes) | default egress vs second region, response fields only |

Estimated size: about 45 recordings. Kill criterion 4 fires if the session needs more than 60 recordings or more than one owner settings window.

### 5.1 Capture run order

1. Agent-only states, in this order: S0, three same-day S1 loads, S2, S3, S4 (no-decision shape), S5, S6, S7, S8, S10.
2. One owner settings window: for each S9 setting the owner changes it and says so; the agent waits the propagation time (10 minutes), records, and logs the change and time in the manifest. D3 (Target reactivation) happens in the same window. S12 is done by the owner in the same window.
3. Restore step: the owner restores the datastream to its original settings and the agent records one S1 load to confirm it matches the step 1 recordings.
4. S11 and S13 follow on day 2.
5. Every manifest records the SHA-256 of the Alloy bundle actually loaded. The session aborts on a mismatch with the pin in section 1.

## 6. Datastream and edge configuration (ADR-0061 points 10, 11 analogue)

For Google and Meta the "config" is in the page (`gtag/js?id=`, `signals/config`). For Adobe the page only carries `datastreamId` and `orgId`. The datastream is server-side. It changes responses without changing the SDK or the page.

Datastream settings that change served behavior, to be recorded as states in S9:

- Adobe Analytics enabled or not, report suite;
- Target enabled or not, property token;
- Adobe Audience Manager, Experience Platform enabled or not;
- first-party ID cookie enabled;
- request and response overrides at the datastream level (for example, forwarded fields);
- consent handling in the datastream;
- geo-lookup and device-lookup enrichment;
- Edge domain (first-party vs `edge.adobedc.net`).

Each setting is listed with its triggering page input (for example Target needs a `decisionScopes` or page-load request; consent handling needs a consent state). A setting is dispositioned "no effect" only if: (a) the check came after a stated propagation wait (default 10 minutes after the owner's change, recorded in the manifest); (b) the Adobe analogue of served config bytes was checked, meaning the full response body and the `handle` set; and (c) the triggering input was present in the request.

Rules:

- **Settings-state list.** S9 records one state per setting above that the owner can change on the owned test datastream. The owner changes settings (owner session, ADR-0061 point 6); agents record.
- **Completeness analogue.** The Google/Meta check compares our inventory against real configs. For Adobe, we compare against the datastream configuration *schema* and the set of `handle` types seen. Task T2 lists every datastream setting from Adobe's public docs and schema only (the agent has no console access; see D6 for an optional owner export of the owned datastream config) and marks each "covered by S9", "affects no wire field we send or receive", or "gap". A gap is filled now or tagged `live-only`.
- **Production probes.** Comparing against real production datastreams needs production-site or tenant access. That is **not** approved. If the owner wants it, they approve it in section 11 (D4) before it runs, with the site list.
- **Point 11 analogue.** Point 11 has no design yet even for Google and Meta. For Adobe the analogue is a visible diagnostic when a response contains a `handle` type or datastream-driven behavior outside the inventory (for example, an unknown `handle.type`). The design is deferred to the same place as Google/Meta and is a listed pilot check: B3 must surface an unknown `handle` type as a loud, visible error, never silent. Design of the user-facing form is left to the point 11 decision; this spec only requires "not silent".

## 7. Disposition of specs 051 to 057

History is kept. Each spec gets a dated rescope note and its slices get new statuses. No record is rewritten.

| Spec / slice | Today | Disposition |
|---|---|---|
| 051-01 access preflight | DONE | Stays DONE |
| 051-02 stock baseline (live reporting and process gates) | IN_PROGRESS | **Reframed.** The local stock harness and page setup are reused; S1 to S3 are re-recorded under section 4 (old recordings lack the stored-input manifest) Live reporting gates move to the live-only list. Remaining ACs closed as "superseded by ADR-0061, spec 064" |
| 051-03 SDK compatibility spike (8 hours) | DRAFT | **Abandoned.** Replaced by the capture session and B1 pilot |
| 051-04 workspace confirmation | DONE | Stays DONE |
| 051-05 local stock harness | DONE | Reused by B0 and the capture session |
| 051-06 deployed stock smoke | DONE | Reused for the owner's normal-browser capture (S12) |
| 051-07 recorded wire checker | DONE | Extended in B0 |
| 051-08 browser wire recorder | DONE | Reused as the capture driver |
| 051-09 focused chamber journey | IN_PROGRESS | **Reframed** as slice B1 plus the part of B2 that is already built. Its ~25 witness files stay as evidence |
| 051 spec | IN_PROGRESS | Closes when 051-02/03/09 are dispositioned. Goal is carried by 064 |
| 052 events and commands bridge | DRAFT outline | **Superseded** by B1, B2, B3, B9, B10 |
| 053 personalization and reporting | DRAFT outline | **Superseded** by B6, B7. Reporting goes to 056 follow-up |
| 054 `aem-martech` and Launch migration | DRAFT outline | **Superseded** by B8 |
| 055 consent, identity, delivery | DRAFT outline | **Superseded** by B4, B5 |
| 056 product workflow validation | DRAFT outline | Kept as the nonblocking follow-up (ADR-0039) |
| 057 adoption, perf, release qualification | DRAFT outline | **Reframed** as B11 and B12 (ADR-0061) |

## 8. Ordered slice list (Adobe first)

Counting rule: T1, T2 and B0 are pre-capture preparation tasks with their own completion checks (no fixture comparison, because the corpus does not exist yet, per ADR-0061 point 7). CAP is the capture session. B1 to B12 are slices. T1 and T2 are read-only (pinned bundle, public docs, owned datastream read-only view) and may start before D1. B0 writes tooling only. CAP and anything after it wait for D1. Order matters. Each slice is sized for one fresh session and ends with a recorded-fixture comparison through real chamber dispatch (ADR-0061 point 1). Each has a numbered slice file in this spec's directory once the owner approves the order. (Slice files are not written yet. This avoids freezing detail the pilot may change.)

| Slice | Goal | Depends on |
|---|---|---|
| T1 (task) | Close the command inventory from the pinned bundle (names the two open `commands`; reconciles core commands) | none |
| T2 (task) | Datastream setting list and completeness table | none |
| B0 (task) | Capture tooling: manifest schema, stored-input-state check, pre-commit secrets check, extension of the 051-07 checker, and native field-rule evaluation in the comparator (today `native_normalization_unsupported`, rig/native-tag-comparison.md lines 186-194; ADR-0061 Consequences). B1 is blocked until this lands | T1 |
| CAP | **Capture session** (section 4). One session, owner approval first | B0, T1, T2 |
| B1 | `configure`, `getLibraryInfo`, page-view `sendEvent`, context block, network shape. **Pilot slice** | CAP |
| B2 | Custom `sendEvent`, `mergeId`, `createEventMergeId`, `onBeforeEventSend` | B1 |
| B3 | Response handling and `applyResponse`; unknown `handle` type is loud; error shapes | B1 |
| B4 | Identity and storage: ECID, `getIdentity`, `appendIdentityToUrl`, cookie cache | B3 |
| B5 | Consent: `setConsent`, queued events, `defaultConsent` | B3 |
| B6 | Personalization commands: `applyPropositions`, `evaluateRulesets`, `subscribeRulesetItems` | B3, B4 |
| B7 | Proposition rendering and display/click notifications | B6 |
| B8 | `aem-martech`, ACDL, Launch bridge. Adoption path decision (ADR-0038 step 1) | B2, B5, B7 |
| B9 | Media commands (`getMediaAnalyticsTracker`, `createMediaSession`, `sendMediaEvent`): implement or mark incompatible with reason | B3 |
| B10 | Push and conversation commands (`sendPushSubscription`, `sendConversationEvent`) and debug: implement or mark incompatible with reason | B3 |
| B11 | Compatibility report and perf budget (spec 057 content) | B1 to B10 |
| B12 | Release check wiring: fixtures against live, live-only rows (ADR-0061 point 1) | B11 |

Each slice carries its own DoR and acceptance when its file is written. The existing connector (`ALLOY_EVENTS=["page_view"]`, `renderDecisions:false`) is the starting point for B1.

## 9. Production-site probes

No probe touching a production site, tenant or real-user data runs without the owner's written approval in this section, naming the site and the probe. **Approved today: none.**

## 10. Applicability of ADR-0061 carried checks and kill criteria

| Check | Applies to Adobe? | Why |
|---|---|---|
| Inventory completeness against real configs (`gtag/js?id=`, `signals/config`) | Yes, as the datastream analogue | The config is server-side. Section 6 and T2. No production probes without D4 |
| Point 11, visible diagnostic on out-of-inventory config | Yes, as an unknown-`handle` rule | Design is open for all three vendors. Adobe requires "not silent" in B3 |
| Meta owner-only capture route time-box | No | Meta-specific. Adobe's capture route is agent scripted plus one owner normal-browser capture |
| Egress region factor | Probed once (S13) if D2 = yes, expected No; otherwise `live-only: geo` | Section 4.4 |
| Clean-room risk | No | The pinned open-source SDK runs unchanged |
| Pre-commit credential check | Yes | Section 4.2 |
| Held-out rule check | Yes | Section 4.7 |
| Drift and field classes (point 10) | Yes, adapted | Alloy is versioned. Field classes are `fixed`, `generated`, `input-derived`, `server-context-derived` (a source field is named, for example the edge region or datastream), `volatile`. Request classes are in section 2.2. A field that differs across setups or days without an explanation makes the state `unstable` and goes to the owner |

Completeness metric: out-of-inventory rate = (datastream settings and observed `handle` types not covered by S9) divided by (all listed). Threshold: above 10% is a kill criterion (item 6). Value so far: not measured.

Kill criteria, from ADR-0061 plus the completeness metric:

1. The capture set cannot be acquired (including the positive control).
2. Fixed fields move across most states.
3. Derived rules fail the held-out recordings.
4. The inventory needs more states than one session can cover.
5. The release check finds fixtures drifting from live behavior.
6. The out-of-inventory rate exceeds 10%.

## 11. Decisions for the owner

D1. Approve this spec and the slice order in section 8, so the capture session can start. **Recommended: yes.**

D2. Provide a second egress region for the single geo response check (4.4)? **Recommended: no for now.** The check is cheap but needs VPN credentials. Without it the geo row is tagged `live-only`.

D3. Reactivate the owned Target activity for S4? **Recommended: yes**, as an owner settings change. Without it S4 records only the no-decision shape.

D4. Approve any production datastream comparison? **Recommended: no.** The completeness check uses Adobe's docs and the owned datastream.

D5. When you do the normal-browser capture (S12), is one state enough, or do you want two? **Recommended: one**, as ADR-0061 says.

D6. Export the owned datastream config (screenshots or JSON, test IDs only) into the repo before T2? **Recommended: yes**, it lets T2 compare against the real owned datastream. Without it, T2 uses Adobe's docs only.

D7. Commit one settings window (about 3 hours, section 5.1) for the owner steps? **Recommended: yes.**

## 12. Review log and carried findings

Review rounds are capped at three before owner review (owner decision). Findings left after round 3 are carried into the pilot as listed checks, as ADR-0061 did with round 10.

- Round 1 (independent review): 4 findings. Pre-capture items relabeled as tasks; counts fixed; B9 split into B9, B10, B11, B12. All fixed.
- Round 2 (fresh Opus reviewer): 10 findings (4 blocking). Fixed: comparator field-rule work added to B0; OFAT matrix made consistent; request-level classes and the unstable-state rule added; datastream no-effect conditions added; completeness metric, kill criterion and combined state added; normal-browser difference escalation restored; drift probe sequencing stated; ladder order unified; setDebug single owner; T1/T2 approval stated.
- Round 3 (fresh Opus reviewer): 8 findings (3 blocking). Fixed: T2 input source (docs only, optional owner export D6); capture run order, restore step and owner window added (5.1, D7); 051-02 recordings are re-taken, not reused; ECID class naming; S13 added; summary wording; kill criterion 4 bounded; bundle SHA recorded per manifest. Nothing carried open.
- Anything still open after round 3 goes to the pilot as a listed check.
- Pilot count of extra captures: _to be filled at pilot close_.

## 13. Clarifications

None open. Slice files with DoR and acceptance are written after D1, so the pilot can change them.
