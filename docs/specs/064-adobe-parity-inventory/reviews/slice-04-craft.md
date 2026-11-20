---
slice: 064-04 — CAP: the capture session
pass: craft
verdict: changes
reviewer: general-purpose claude-opus-5.5
reviewed_at: 2026-11-20T15:30:00Z
prompt_source: review prompt, slice 064-04
---

# 064-04 craft

Scope: `probes/adobe-compatibility/capture-session.mjs`, `capture-recorder.mjs`, `capture-fixture.mjs`,
`test/adobe-capture-recorder.test.js`, the 46 fixtures, and the S12 HAR conversion.

## What holds

- The recorder excludes the Alloy body, hashes it and checks the pin; request count and body size are
  bounded. Tests cover fan-out, bounds, pin mismatch and absence, step failure, scrubbing, credential
  rejection and invalid manifests. They pass.
- `node rig/fixture-credentials.mjs test/fixtures/adobe-capture` exits 0; all 46 manifests pass
  `checkFixtureManifest`.
- Secret scan of fixtures and the slice commit history: the only `@AdobeOrg` value is the public org
  ID; the only configId values are the public datastream and the test-made placeholder in
  `s8-non200`. No bearer, authorization or report-suite tokens; no local paths. The 401 text in
  `s9-12` is the Edge error message only.
- Fresh fixtures have empty `storage_before`; returning ones (`s2-*`, `s4-active-repeat`,
  `s5-returning`) carry the expected 4 cookies.

## Findings

### K1 — blocking: the withheld-ID scrub fails open (public repo safety, ADR-0061 point 5)

`capture-session.mjs:139-141` returns `{}` when `AIRLOCK_PRIVATE_IDS` is unset or unreadable, so the
scrub silently does nothing. The credential check catches tokens and cookies, not report-suite IDs,
property tokens or other withheld labels. All 46 fixtures show a scrub count of 0, so the review
cannot tell whether the file was loaded. Fix: throw when the variable is unset or the file fails to
parse, record in the manifest that the withheld list was loaded (count of keys, not values), and add
a test for the missing-file path.

### K2 — non-blocking: profile directory reused across re-records

`capture-session.mjs:150` builds the profile path from the fixture ID, so a re-record of the same ID
starts with the old state. This produced the stale `s13-default` take that was labelled fresh
(slice line 105). Fix: refuse a non-empty directory for a fresh profile, or wipe it.

### K3 — non-blocking: defaults that hide input state

- `capture-session.mjs:24` defaults profiles to a shared `/tmp` path.
- Egress silently defaults to `non-eea` / `default`; slice line 56 admits it is assumed.
- `capture-session.mjs:195` records `page.url()` at the end, not the load URL (S7, see compliance C3).

### K4 — non-blocking: step results are lost or ignored

`queue` (`capture-session.mjs:44-49`) returns nothing, so `step("queue", ...)` logs `queue:-`; the
second `queue` call at lines 84, 90 and 96 is outside `step`. A failed step does not stop the fixture
write. Record the queued results and refuse to write a fixture after a failed step unless the scenario
expects it.

### K5 — non-blocking: storage snapshots are asymmetric

`storage_before` localStorage covers every origin, `storage_after` only the page origin;
`sessionStorage` before is hard-coded `{}`. Snapshot both with the same scope.

### K6 — non-blocking: S10 URL is stale and contradicts the init script

`capture-session.mjs:154` uses `consent=decline` and the run prefix `airlock05102-` from spec 051,
while the init script grants consent (`set-consent` sends `collect: y` in `s10-base`). Use a 064
prefix and a consent value that matches the scenario.

### K7 — non-blocking: S12 HAR conversion is not reproducible

There is no committed converter; `s12-owner.json` was assembled by hand from the owner's HAR. The
fixture has `requests[0].seq = 0` (others start at 1), `browser.name: chrome` (others `chromium`),
scenario `page-view-library` without a `getLibraryInfo` call, and the HAR cookie / `set-cookie`
stripping is not noted. Commit the converter or document the conversion steps in `capture.owner_capture`.

### K8 — non-blocking: no driver test; argument parsing is fragile

The driver has no test. Its argument parser takes the next token as the value, so a value starting
with `--` is read as a flag. A small parse test plus the K1 test would cover the risky paths.

## Not verified

- Withheld values themselves (the private file was not available); leak checks are pattern-based.
- The driver was not re-run against the live page.

## Resolution (round 1)

Blocking findings fixed in the follow-up commit (see slice-04 notes, "Review" line); non-blocking items are carried as listed there. Round 2 not run.
