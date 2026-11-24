---
status: DONE
tier: standard
severity: medium
claimed_by: bug-006-post-fold-oracle
regression_test: a stock arm is a pure stock page
main_repro_checked_at: 2026-11-23
main_repro_ref: origin/vendor-adobe@7fb8fae7
main_repro_result: reproduces
red_confirmed_at: 2026-11-23
green_confirmed_at: 2026-11-23
fix_class: guardrail
security_surface: false
escalated_to:
closure_schema: 1
---

# Bug 006: post-fold-oracle-stock-domain

## Symptom

`test/adobe-b5-martech.test.js` (real Chromium, GATING step of the `browser-oracle` job) failed with
`expected ['meta.state.domain'] to deeply equal []` in the library-versus-stock compare (069-03 S10 k=0..3 and
AC6), and the same diff appeared in the b4 064-24 redirect compare. The stock side's `meta.state.domain` was `""`
where the library's was the full page host. After the fold it hit about 3 of 4 CI attempts in some windows and
none for hours; it never reproduced locally on an idle machine. The 069-05 order diff seen alongside is a
separate defect: [bug 007](007-martech-event-order-vs-stock.md).

## Repro

CI only. Red attempts clustered on 2026-11-23 (about 18:04-18:46Z and 20:11-20:41Z, and again in a diagnostic
run at 22:34Z).

## Evidence

- Runner image, runner version and Chromium were identical for red and green attempts.
- Diagnostic run 45262070431 attempt 2: library `meta.state.domain` was the full page host, stock's was `""`.
- Tracer run 45278072531 attempt 2: on the stock page the chamber's `reconcile` wrote
  `com.adobe.alloy.getTld=com.adobe.alloy.getTld; path=/` into the real jar at 136 ms; stock Alloy's own apex
  probe read it back at 151 ms (its first loop test saw the cookie), so it wrote no `domain=` cookie and returned
  `""`; the chamber removed its copy at 153 ms. In green traces the chamber's write and removal finish before
  Alloy probes, and Alloy writes its own probe cookies.
- Pinned Alloy 2.31.1 probe: `for(;o<r.length&&!t.get(X);) ... return t.remove(...), n`, with `n` starting `""`.

## Hypotheses

- [x] H1 (leading, confirmed): the stock arm's page also boots the chamber, which mirrors its Alloy's probe
  cookie into the jar for about 15 ms; a stock probe inside that window returns `""`. Confirmed by the tracer capture.
- [ ] H2: the fold's 068-03 no-park path or the extra opt-out registration changed the library side's domain
  writes. Falsified: the library side's domain is the full host in every red capture; only stock's differs.
- [ ] H3: cookie or storage state shared between the sequential arms. Falsified: `replayFixture` makes a fresh
  browser context per call.
- [ ] H4: stock's domain resolution varies under load by itself. Falsified as an independent cause: it only
  varies when a chamber shares the page; a pure stock page has no such window.

## Root cause

The rig booted the airlock chamber on every page, including the arms meant to be stock. The chamber's Alloy
probes `com.adobe.alloy.getTld` and the adapter's `reconcile` mirrors that write into the real jar. When stock
Alloy's own probe on the main thread lands in the few milliseconds before the chamber's removal, stock sees the
cookie, skips its own `domain=` writes and reports an empty domain. A harness artifact: no production path puts a
stock tag and a chamber on one page. Every stock arm (b5, b4, h1, 069-01, storage-grant) booted a chamber; the
enumeration is closed by `grep -n "replayFixture(" test/` plus the helper that wraps it in each file.

## Repository closure inventory

**Equivalent / convergent logic searched:** `getTld`, `reconcile` and `document.cookie` in `adapters/eds/index.js`,
`connectors/alloy/sync-cookie-cache.js`, `rig/` and the pinned bundle; `bootAlloy` and `replayFixture(` across
`test/` and `rig/`. No existing way to make a replay page stock-only.

**Relevant history inspected:** `git log -S getTld` and `git log -S bootAlloy -- rig/`; the fold changed no apex
probe code, so the window opened only because boot timing shifted.

**Affected call sites:** every `replayFixture` stock arm in `test/adobe-b5-martech.test.js`,
`test/adobe-b4-personalization.test.js`, `test/adobe-h1-host-command.test.js`,
`test/adobe-069-01-handle-results-chromium.test.js` and `test/adobe-storage-grant.test.js`.

**Reuse decision:** extend `replayFixture` with one option rather than a per-test page; the first attempt (a
`document.cookie` filter keyed on the stack name `reconcile`, e02d67f4) was dropped because it depended on a
bundle-time function name, removed the production mirror write from library arms, and left the stock arm running a chamber.

## Fix class

guardrail (test harness)

## Fix

`replayFixture` takes `boot` (default `true`). `boot: false` serves a pure stock page: no adapter script, no
`bootAlloy`, no Worker, no chamber, no recorded steps. Every stock arm passes it; library arms are unchanged. It
throws if combined with `commands` or a non-null `event`. No oracle comparison, library code or production code changes.

## Call-site closure

**Disposition per affected site:** b5 stock arms (064-21 `run`, `runStock`, `flow`, `arm`, 069-05, AC10),
b4 stock arms (including the 064-24 redirect), h1, 069-01 and storage-grant stock arms: changed to `boot: false`.
`reload` in storage-grant no longer waits for a chamber on the stock arm. b1, b2, b3, b6 and parity tests have no
live stock arm: left alone. `core/`, adapters and connectors: left alone.

## Already tried

- A bisect: skipped, failures were time-clustered, not code-clustered.
- Pre-fix controls on scratch refs at 7fb8fae7 were green in two windows, so the CI red is window-dependent.
- First fix e02d67f4 (cookie-setter filter in the shared page script): replaced, see Reuse decision.

## Regression test

`test/adobe-b5-martech.test.js`, "bug 006: a stock arm is a pure stock page (real Chromium)": a `boot: false` page
has no `__worker`, no `AirlockEds` and requests neither `/rig/chamber.js` nor `/rig/airlock-eds.js`; the default
page boots one (positive control). Revert-checked locally against the old rig: fails with
`expected 'object' to be 'undefined'`. The CI symptom does not reproduce locally, so this test is a structural
guard and the CI sample below is the proof for the compares.

## Proof

Fix head sample (fb1ee84f; the final source 86df6daa differs only by review polish: dead stock `bootOptions`
removed, a `boot:false` guard, a positive control and the `T` timeout in the test), six scratch refs, same window as a control at
7fb8fae7:

- Fix runs 45286852280, 45286863429, 45286872434, 45286877442: fully green.
- Fix runs 45286858919 and 45286870684: red only on the 069-05 AC1/AC4 order diff (`:450`, `:481`), bug 007's. The
  `meta.state.domain` compares (b5 S10 k=0..3, AC6, b4 064-24 redirect) were green in all six, so 6 of 6.
- Control 45286882819 (7fb8fae7, no fix): green in this window, so it neither confirms nor refutes the pre-fix
  rate. Earlier pre-fix reds: 45234396848 attempt 1 and 45238356339 attempts 1 and 3, plus the diagnostic runs above.
- First fix e02d67f4: 5 runs, 45282879295, 45282898307, 45282902969, 45282909765, 45282914321, no domain mismatch.

The strict "5 consecutive green job attempts" bar is not met because bug 007 keeps the job red about 1 in 3; the
006 assertions themselves were green in every attempt on the fix head.

## Carried findings

- **Redirect request/navigate order flake in the b4 064-24 test** (low). CI run 45290811216 attempt 1 (head 0e9559c9)
  failed `adobe-b4-personalization.test.js:668` with `['request','navigate','request']` instead of
  `['request','request','navigate']`; attempt 2 was green. It is an event-order diff, not `meta.state.domain`, and the
  failing arm was not printed. Not investigated here. Owner: coordinator 24 (see also bug 007).
- **Chamber mirror visible in the page jar** (low). The chamber's `reconcile` makes Alloy's transient
  `com.adobe.alloy.getTld` probe cookie visible in the real page jar for about 15 ms; stock writes and removes it
  within one synchronous task, so no other script sees it. Owner: coordinator 24, to be decided as overflow slice 064-35. Not fixed here.
- **One unattributed local mismatch** (low). Once, in a run of five suites at fb1ee84f plus the review polish, the
  069-03 "AC1 (boot path)" compare printed `meta.state.domain` differing; 16 further local runs (some under CPU
  load) and 6 CI runs did not repeat it, and which side differed is unknown. The compare now prints both domains on
  a mismatch. Owner: coordinator 24.
- **`boot` is opt-in** (low, bug-review). A new stock arm that forgets `boot: false` brings the race back. Owner: coordinator 24, with 064-35.

## Learning

Recorded in `docs/memory/learnings.md`: "A stock arm must be a pure stock page".

## Main recheck

- 2026-11-23 - `origin/main@67daba40`: not applicable. The Adobe replay rig and the b5/b4 oracle tests
  (`rig/adobe-b1-replay.mjs`, `test/adobe-b5-martech.test.js`) exist only on vendor-adobe, so the repro cannot run on
  main. No core/ change is involved; the fix lands on vendor-adobe only.
- 2026-11-23 - `origin/vendor-adobe@7fb8fae7` -> reproduces (CI only: runs 45234396848 attempt 1, 45238356339 attempts
  1 and 3, tracer run 45278072531 attempt 2; not reproducible locally). This is the ref recorded in the front matter.
  `bug.py main-check` accepts only `reproduces` or `resolved-on-main`, and the `-> FIXING` gate needs `reproduces`,
  so the front matter carries the branch where the bug does reproduce.
- **Correction (2026-11-24):** an earlier version of this section recorded `origin/main@67daba40 -> reproduces` and
  claimed "Main carries the same rig". That was wrong: main does not have the rig. The entry above replaces it.

## Reviews

`docs/bugs/reviews/bug-006-bug-review.md` (round 1 approved, round 2 pass, on the final source) and `docs/bugs/reviews/bug-006-craft.md` (round 3 approved after fixes in c803c513 and 86df6daa). No security pass: test and rig only.

The bug-review ran twice. Round 1 ran on fb1ee84f only (reviewer agent 47169c82, 2026-11-23T23:15:45Z). Round 2 ran on the full final diff 7fb8fae7..a3b108cd (fresh reviewer agent df3970e8-f178-448a-aa86-371e1a16922c, read 2026-11-24T16:47:51Z) and returned pass. Verdict words: earlier rounds returned approved; round 2 returned the prompt-format word pass (frontmatter carries pass plus reviewer_verdict approved, per the tool vocabulary).
