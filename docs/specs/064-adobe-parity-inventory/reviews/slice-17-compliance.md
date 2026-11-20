---
slice: 064-17 — B1: Environment snapshot and storage seeding (pilot)
pass: compliance
round: 1
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T15:55:00Z
prompt_source: review prompt, slice 064-17 (commit 37373e33)
---

# 064-17 compliance — Round 1

**Verdict: pass. 0 blocking findings, 4 non-blocking.**

Scope: commit `37373e33` on `origin/vendor-adobe`, the slice file (ACs 1-5, DoD, notes at lines
34-45), spec 064 sections 4.3 and 4.11, and the S1, S2 and S5 fixtures under
`test/fixtures/adobe-capture/`.

Runs on Node 22.23.5:
- `npx vitest run test/alloy-stock-shim.test.js test/alloy-sync-cookie-cache.test.js test/eds-boot-alloy.test.js test/adobe-b1-replay.test.js`: 99 passed, 16 skipped (the skips are the gated replay tests).
- `AIRLOCK_REAL_CHROMIUM=1 npx vitest run test/adobe-b1-replay.test.js`: 24 passed in 6.3 s.
- `npm test`: 142 files, 2899 passed, 22 skipped. `npm run lint`: clean.

## AC and DoD results

| Item | Status | Evidence |
|---|---|---|
| AC1. Stock `context` default fed by real host values; shims gone; reduced `context` is an opt-in; denylist on | Met | `airlock.example`, `en-US` and 1280x800 are gone from the chamber (`alloy-chamber.worker.js:246-249`, `:256`, `:343-344`), and a source test pins that (`test/alloy-stock-shim.test.js:110-114`). Real values come over the 067-07 channel (`stock-shim.js:31-58`). Opt-in narrowing is tested in the replay with `context: ["web"]` (`test/adobe-b1-replay.test.js:106-112`). The denylisted `url` is shown as a documented difference (`:114-118`). Only fallback left: `userAgent … \|\| "airlock-chamber"` (`alloy-chamber.worker.js:255`), not one of the three named shims. |
| AC2. Replay seeds recorded before-state before the page loads | Met (with a coverage limit) | Cookies go through `context.addCookies` and storage through `addInitScript`, both before `page.goto` (`rig/adobe-b1-replay.mjs:116-126`, `:153`). The seed matters: `s5-returning` without the seed asks the edge (`test/adobe-b1-replay.test.js:100-103`). No fixture has a non-empty localStorage or sessionStorage before-state, so the rig's storage branch only ever runs with `{}` (C2). |
| AC3. S1 + variants, S2, S5 compare clean through the chamber, including each variant's exact difference | Met | The replay covers `s1-base`, both repeats, the viewport, referrer, locale, timezone and edge-domain variants, `s2-base` and `s2-repeat`. Each body diff is `[]` and the URL matches without `requestId` (`test/adobe-b1-replay.test.js:49-73`). S5 fresh body matches and S5 returning sends nothing and returns the recorded ECID (`:82-98`). The recorded deltas from S1 match the section 4.3 table (`:14-41`). Two gaps in the assertions: C1 and C3. |
| AC4. Shim defines no `window.title/url/referrer/height/width` | Met | `winBack` has none of these keys (`alloy-chamber.worker.js:340-360`), and the Proxy falls back to `self[p]`, which a WorkerGlobalScope does not have for these names (`:361-367`). The test only checks a slice of the source text (C4, and craft K5). |
| AC5. Extra-capture count written into spec 064 | Met | 0, in section 4.11 (`spec.md:219`) and section 12 (`spec.md:534`). That is below the kill-criterion threshold of more than 3. |
| DoD `npm test && npm run lint` | Met | See the runs above. |
| DoD servo gate | Not verified | This worktree's `.servo/` has only `install.json` and `refinement-todo.md`, with no oracle to run. This matches the 067-12 precedent (`067-shared-seal-defaults/reviews/slice-12-compliance.md:29`). |

## Findings

### C1 — non-blocking: the fresh-vs-returning difference (section 4.3) is not asserted (AC3)

Section 4.3 gives "Fresh vs returning" its own exact expected difference: ECID source,
`query.identity.fetch` and stored cookies, with no change to context fields. The delta table at
`test/adobe-b1-replay.test.js:14-22` covers only the S1 one-factor variants. I computed the recorded
S1→S2 delta with the rig's `recordedDelta`. For both `s2-base` and `s2-repeat` it is
`meta.state.entries[0..1].key/value` plus the run-id `webPageDetails.URL`, which sits inside the
allowed set, so there is no hidden parity gap. Fix: add the S2 row to the fixture-arithmetic
`describe`, so a context-field drift between fresh and returning is caught as a finding.

### C2 — non-blocking: the rig's storage seed path never runs with data (AC2)

`addInitScript` (`rig/adobe-b1-replay.mjs:121-125`) is only reached with empty `local_storage` and
`session_storage`. The slice note (line 44) and spec 4.11 (`spec.md:219`) disclose this and say
storage seeding is covered "by unit tests only". Those unit tests cover the adapter and chamber
seam (067-12), not this rig. A typo in the init script (for example the `location.origin !== origin`
guard) would go unnoticed until a later slice adds a storage fixture. Fix: one gated replay with a
synthetic `consentHashes` before-state that checks the chamber's `localStorage` shim sees it. This
needs no new capture.

### C3 — non-blocking: the locale variant's one expected difference is checked only conditionally (AC3)

For `s1-locale` the only expected difference is `Accept-Language` (section 4.3). The replay checks
it inside `if (seen) { … }` (`test/adobe-b1-replay.test.js:67-71`). If the request ever stops
reaching the routed network, for example after a ceiling change in 064-18, the locale check passes
without checking anything. All S1 fixtures go to `adobedc.demdex.net/ee/v1/interact`, which is on
the ceiling, so `seen` should be required for the S1 names.

### C4 — non-blocking: the AC4 check looks only at the first four lines of `winBack`

`test/alloy-stock-shim.test.js:107` cuts the source from `const winBack = {` to `Intl: self.Intl`,
which is lines 340-344 only. A `width:` or `title:` key added further down (`:345-360`), or set by
`applyStockContext` at runtime, would not be caught. The AC holds today. See craft K5 for the fix.
