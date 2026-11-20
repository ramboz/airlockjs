---
slice: 064-04 — CAP: the capture session
pass: reconciliation
verdict: changes
reviewer: general-purpose claude-opus-5.5
reviewed_at: 2026-11-20T15:30:00Z
prompt_source: review prompt, slice 064-04
---

# 064-04 reconciliation

Scope: slice-04 notes vs the 46 fixtures vs spec 064 sections 5.1, 6.2, 6.3.

## What reconciles

- Counts: 46 files (S0 2, S1 8, S2/S3/S7/S8/S10 10, S4 4, S5 2, S6 3, S9 11, S11 2, S12 1, S13 2,
  restore 1) = 48 planned minus S9-07/S9-08 (slice line 106, spec 6.3).
- Attempts: 48 of 60 adds up (slice line 106).
- S9 owner-change log: every window fixture's `capture.owner_change` matches slice lines 86-98 in
  change, time and wait.
- S9 handle claims hold: 00 and 10 no decisions handle; 01 airlock decision stays; 02 airlock gone,
  `__view__` stays; 03 back; 04 no change; 05 `identity:exchange`; 12 401.
- S11 vs `s1-base`/`s3-base`, S13 default vs CH, and `restore-s1` vs `s1-base`: only per-run values
  differ (date, set-cookie, request IDs, ECID, identity cookie, URL run ID, times); `x-adobe-edge` and
  `locationHint` identical, as claimed (slice lines 98, 104, 105).
- S0 headed and headless have the same handles.

## Findings

### R1 — blocking: S12 header claim does not match the fixture

Slice line 82 says headers differ only by HTTP/2 pseudo-headers and `pragma`. `accept-language`,
`cache-control`, `sec-ch-ua`, `user-agent` and `content-length` also differ (`s12-owner.json:70-85`
vs `s1-base.json:356`). See compliance C1.

### R2 — blocking: S9-06 claim is not supported, and S9-11 has the same gap

- S9-06 (slice line 90): "response looked like S9-05", but the FPID cookie is host-only on the page
  origin (`s9-06.json:37-39`) and never reaches the Edge call (`s9-06.json:426`); the scenarios also
  differ (`fpid` vs `page-view-library`, `s9-06.json:89`, `s9-05.json:83`). See compliance C2.
- S9-11 (slice line 92, freeze note line 112): the bot rule matches `referer` containing
  `referrer.example`, but the Edge request's `referer` header is the page URL (`s9-11.json:437`);
  `referrer.example` appears only in `xdm.web.webReferrer` (`s9-11.json:447`). The bot rule was
  likely never triggered. The freeze note should say so, not only that a custom header was unavailable.

### R3 — non-blocking: attempt-count notes contradict each other

- Line 80: "30 attempts used" after both S4 active recordings; it was 31 (29 + 2).
- Line 96 says 42 after S9-12 (correct); line 99 says "43 … the earlier 42 undercounted by one".
  42 was right; 43 is 42 plus the restore (line 98 says this). Drop the "undercounted" clause.
- Line 82 "31st attempt" for S12 is already corrected at line 96 (32); fold the correction in.

### R4 — non-blocking: S11 interval is about 22 h, not 10 h

Slice line 104 and the `capture.note` in `s11-s1.json` / `s11-s3.json` say "about 10 h after the
Phase A S1/S3". Phase A S1/S3 were at about 16:25Z on 11-19; S11 at 14:44Z on 11-20, about 22 h.

### R5 — non-blocking: S4 "empty decisions payload in the second request"

Slice line 51: the second request in `s4-base` is a `decisioning.propositionDisplay` notification;
the airlock scope simply has no decision in the first response. Reword.

### R6 — non-blocking: "first Edge call goes to adobedc.demdex.net" is not universal

Slice line 107: `s10-base` (aem-martech) sends `set-consent` and later calls to `edge.adobedc.net`
first. Qualify the finding for 064-17/18 to the library-direct scenarios.

### R7 — non-blocking: S9-05 notes omit the ID-sync requests

`s9-05` also has `cm.everesttech.net` and `dpm.demdex.net` ID-sync requests after
`identity:exchange`; slice line 89 mentions only the handle. Worth one clause for the chamber egress
list.

### R8 — non-blocking: owner to confirm the Target activity IDs are fine in a public repo

Activity IDs 3258675, 3711334 and 3864223 appear in the notes (lines 78, 100, 114) and in 35 fixtures
(Target `scopeDetails`, and base64 in proposition IDs). D9 does not list them as withheld and they
are wire-visible, but the review rule allows only the org and datastream IDs. The notes also name the
org, workspace and property. Owner to confirm, or scrub and re-check.

## Not verified

- Owner-side datastream state between saves (only the logs are available).

## Resolution (round 1)

Blocking findings fixed in the follow-up commit (see slice-04 notes, "Review" line); non-blocking items are carried as listed there. Round 2 not run.
