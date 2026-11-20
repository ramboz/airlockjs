---
slice: 064-19 — B3: Command coverage and callbacks
pass: craft
round: 1
verdict: pass-with-findings
reviewer: independent reviewer (Claude Opus 5.5, Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:52:00Z
prompt_source: review prompt, slice 064-19 (commits 6141cc57, dd909633)
---

# 064-19 craft — Round 1

**Verdict: pass with findings. 0 high, 1 medium, 6 low.**

## Checks that hold

- **Shared seams unchanged.** No `core/*` file changed. The diff touches `adapters/eds/index.js`
  (an additive diagnostic loop, `:1650-1658`) and `rig/adobe-b1-replay.mjs` (two options). The
  connector and the wrapped-SDK host are untouched.
- **Harness reuse.** The test reuses `replayFixture`, `diffBodies`, `splitRequestUrl` and
  `loadFixture`. The `run(page)` and `event: null` extensions are small and backward compatible:
  the default `event = PAGE_VIEW` still applies when the option is omitted, and `null` skips only
  the default push (`rig/adobe-b1-replay.mjs:177`).
- **Hermetic oracle stays browser-free.** The real-Chromium block is `describe.runIf(real)`
  (`test:57`). The two hermetic tests never launch a browser; the AC2 test relies on `bootAlloy`
  rejecting at the `bundleUrl` check before `new Worker` (`adapters/eds/index.js:1663`). The
  top-level `playwright` import is a dependency already used by sibling test files. The CI step
  sits in `browser-oracle` with `AIRLOCK_REAL_CHROMIUM=1` (`.github/workflows/ci.yml:110-113`),
  matching the 064-17/18 steps.
- **No secrets or private paths.** The org ID and the `aem.page` domain are already public in
  `spec.md` and earlier reviews. No local paths.
- Tests pass: 2 hermetic, 19 real-Chromium. Lint is clean on the changed files.

## Findings

- **C1 — Medium — `adapters/eds/index.js:1651-1658`.** The diagnostic covers 3 of the 6 options
  and only for `bootAlloy` opts. It is emitted, then boot carries on, so the site still gets no
  `onBeforeEventSend` behaviour (no cancel, no strip). For a site that relied on
  `onBeforeEventSend` to remove PII, a `warn` in the console is the only signal that the PII is
  now sent. Consider failing loud (throw, as for `bundleUrl`) unless the site opts in to "ignore
  unsupported callbacks", or at least make the `reason` name `payloadDenylist` as the declarative
  equivalent the slice notes promise (`slice:34`).
- **C2 — Low — `adapters/eds/index.js:1651`.** The one-line array of tuples is hard to read and
  will grow. A small `UNSUPPORTED_CALLBACKS` list of `[name, (o) => o.x]` pairs reads better. The
  repeated `typeof opts.onDiagnostic === "function" ? ... : decisionDiagnostic` already exists as
  `warnDiagnostic` 55 lines later (`:1705`); hoist it and reuse.
- **C3 — Low — `test/adobe-b3-commands.test.js:36-43`.** Only the injected `onDiagnostic` sink is
  tested. The default console sink (the path a real site hits) is not. One `vi.spyOn(console,
  "warn")` case closes it.
- **C4 — Low — `test/adobe-b3-commands.test.js:45-55`.** The AC1 test parses `spec.md` with a
  regex, so a doc reformat (an added column, a reworded owner) fails `npm test`. It pins prose,
  not behaviour. Acceptable as a guard, but say so in a comment, and anchor the regex to the 2.1
  section so another 5-column numbered table cannot match.
- **C5 — Low — `test/adobe-b3-commands.test.js:135`.** The page-view object is written twice
  inline instead of passing `PV` as the `page.evaluate` argument. `run` is also the name of both
  the S6 factory and the S7 helper (`:169`), which shadow the `replayFixture` option name.
- **C6 — Low — `test/adobe-b3-commands.test.js:116`.** The `mc.get` wrapper (with a stray space
  before `[k]`) re-parses `adobe_mc` on every call. Parse once into an object.
- **C7 — Low — `rig/adobe-b1-replay.mjs:191`.** `results.run` shares the namespace with command
  results, so a command named `run` would be overwritten. Use a separate field (`runResult`).
