---
round: 2
verdict: changes-requested
reviewed_at: "2026-11-20 (time not recorded)"
prompt_source: "round 1: pushed commit 6c722fd0; round 2: pushed commit 0cbf4e16 (after af15a384)"
---

# Slice 064-24 craft review

## Round 1 (commit 6c722fd0)

Opus 5.5 `jig:reviewer`, read-only (the author saved its text, condensed). Verdict: changes-requested.

1. High: a throwing `diagnose` or `location.replace` in the settle/timer path skipped `navigate()`, leaving BODY hidden.
2. Medium: `watch.issued()` fired on `fetch()` even when `init.keepalive` was not true.
3. Medium: other propositions and several redirects kept rendering after a redirect started (stock `onlyRenderThis`).
4. Low: watches leaked when the display was never dispatched.
5. Low: a refused redirect also dropped its proposition's display.
6. Low: the after-send failure diagnostic had no scope.
7. Low: stale comment at connector.js:30 ("same three paths").
8. Low: adapter wiring only tested under real Chromium; no tests for multiple redirects, a throwing sink.

## Round 2 (commit 0cbf4e16)

Fresh Opus 5.5 `jig:reviewer`, read-only (the author saved its text, condensed). Verdict: changes-requested.

Medium: the redirect latch never reset when `location.replace` threw. Low: a missing `location.replace` left BODY hidden; same-document (`#hash`) redirect leaves BODY hidden (stock parity, record it); watches linger up to 60 s; a redirect decision with a reserved placement and html takes the box-fill path (edge). Fixes (latch reset, missing replace, hash note) went into the next commit.
