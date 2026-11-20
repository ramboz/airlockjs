---
slice: 064-04 — CAP: the capture session
pass: compliance
verdict: changes
reviewer: general-purpose claude-opus-5.5
reviewed_at: 2026-11-20T15:30:00Z
prompt_source: review prompt, slice 064-04
---

# 064-04 compliance

Scope: spec 064 sections 1, 2.3, 4, 5, 5.1, 6.2, 6.3, 9, 11; ADR-0061 points 1, 3, 5-8, 10;
slice-04 file (AC1-5, DoD, notes); 46 fixtures under `test/fixtures/adobe-capture/`; driver
`probes/adobe-compatibility/capture-session.mjs`, recorder and fixture assembly.

## AC and DoD results

| Item | Status | Evidence |
|---|---|---|
| AC1. Run order of 5.1 | Met (one carried caveat) | Phase A 11-19 from 16:24Z, window S9-01..06, 11, 10, 09, 12 (19:35Z to 00:30Z), restore 02:21Z on 11-20, S11/S13 14:44-14:51Z on 11-20 (`manifest.captured_at` in each fixture). S9 order matches 6.2. S9-00 ran in Phase A (finding C5). |
| AC2. Each fixture states its input state and the Alloy pin | Partly met | 46/46 pass `checkFixtureManifest`; 45/46 have `alloy_loads` with sha256 `7dd09409…32e8` and 152,336 bytes. S7 input URL wrong (C3); S12 pin assumed (C4). |
| AC3. Settings-window owner changes logged | Met | `capture.owner_change` (change, at, waited) on S9-01..06, 09..12 and `restore-s1`; times agree with slice notes lines 86-98. |
| AC4. S12 compared field by field, differences to owner | Not met | Header comparison is wrong and a fixed-rule-related difference was not sent to the owner (C1). |
| AC5. 48 planned, attempts within 60 | Met | 46 files = 48 minus S9-07/S9-08 skipped per 6.3; attempts 48 of 60 (29 Phase A + 2 S4 active + S12 + 10 S9 + restore + 2 S11 + 3 S13). |
| DoD: corpus committed, freeze note lists live-only rows and gaps | Partly met | Freeze note at slice lines 109-119 omits the S9-06 and S9-11 trigger gaps (C2). |
| DoD: credential check | Met | `node rig/fixture-credentials.mjs test/fixtures/adobe-capture` exits 0. Only org `908936ED5D35CC220A495CD4@AdobeOrg` and datastream `23190fa7-9e6b-4250-b87b-abcdc8ebc297` appear as account IDs (plus the test-made placeholder datastream in `s8-non200`). |
| DoD: tests | Met | `test/adobe-capture-recorder.test.js` and `rig/fixture-checks.test.mjs` pass. `test/adobe-stock-wire-recorder.test.js` passes on Node 22 (CI pin); one test fails on local Node 24 (pre-existing, not this slice). |

## Findings

### C1 — blocking: S12 comparison misreports header differences (AC4, spec 4.8)

Slice line 82 says headers "differ only by the HTTP/2 pseudo-headers and `pragma`" and "Nothing goes
to the owner". The fixtures show more:

- `accept-language`: `en-US` (`s1-base.json:356`) vs the owner's multi-locale list (`s12-owner.json:70`).
- `cache-control`: `no-cache` on the owner request (`s12-owner.json:71`) vs `max-age=0` on the agent
  request. This sits next to the fixed Fetch-init `cache: no-cache` rule in spec 2.3, so it is a fixed
  or generated difference that AC4 says must go to the owner.
- `sec-ch-ua` and `user-agent`: Chromium 151 (agent) vs Chrome 156 (`s12-owner.json:85`).
- `content-length` differs; the HAR response has no `set-cookie`.

Body differences (screen, viewport, offset, time, run ID, `queueTimeMillis`) are as claimed.
Fix: rewrite the S12 comparison and either send the `cache-control` and UA differences to the owner
or record why they are capture setup.

### C2 — blocking: S9-06 trigger never reached the Edge; freeze note silent (DoD, ADR-0061 point 3)

`airlock064_fpid` is a host-only cookie on the `.aem.page` origin (`s9-06.json:37-39`). The interact
call goes to `adobedc.demdex.net` (`s9-06.json:426`) and carries no FPID cookie; the FPID value
appears in no request. Without a first-party CNAME, DS-29 is not exercised. Slice line 90 reports
"response looked like S9-05", but S9-06 used scenario `fpid` (`s9-06.json:89`) and S9-05 used
`page-view-library` (`s9-05.json:83`), so that is not like-for-like. The freeze note (lines 109-119)
does not list DS-29 as unexercised. Fix: add DS-29 to the freeze-note gaps and keep its row unverified.

### C3 — non-blocking: S7 input URL is the post-pushState URL (AC2)

`s7-base.json:8` and `s7-repeat.json:8` record `/?spa-view=2`, not the load URL with the capture
parameters. Cause: `capture-session.mjs:195` uses `page.url()` at manifest time. The input state is
therefore not reproducible from the manifest alone. Fix the two manifests or note the load URL.

### C4 — non-blocking: S12 manifest asserts measured values that were assumed (spec 5.1 step 5)

`s12-owner.json:25-27` claims `profile_kind: fresh` and the pin hash, but `alloy_loads` is empty
(`s12-owner.json:50`) and `capture.owner_capture.note` says the pin was not measured. Freeze note
line 116 states "no pin", which is correct; the manifest fields should say the same (or carry an
explicit `assumed` marker).

### C5 — non-blocking (carried): spec 5.1 step 1 does not list S9-00

S9-00 was recorded in Phase A (`s9-00.json` `captured_at` 2026-11-19T16:27Z), which 6.2 allows but 5.1
step 1 omits. Align 5.1 or note it.

### C6 — non-blocking: freeze note omits scope out-lists

The freeze note does not restate the 4.10 browser-scope out-list (Firefox, Safari, mobile) or the
4.9 live-only rows beyond those listed. Add one line each, or link the spec rows.

## Not verified

- Edge propagation timing was not re-probed; owner-change waits are taken from the logs.
- The withheld-ID file was not available to this review, so absence of withheld values is checked by
  pattern scans only (see craft pass).

## Resolution (round 1)

Blocking findings fixed in the follow-up commit (see slice-04 notes, "Review" line); non-blocking items are carried as listed there. Round 2 not run.
