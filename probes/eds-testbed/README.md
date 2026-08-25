# Probe: EDS testbed (no-flicker eager swap)

Executable probe for
[R-005](../../docs/research/R-005-eds-no-flicker-eager-swap.md) — **findings
live in the note**; this directory is the harness, and it doubles as the
"one real EDS page" for the risk-retirement spike (the INP scoreboard work
adds the Airlock runtime and a `patchDatalayer`-style baseline here).

## What's in it

- `aem-boilerplate` template files @ `d75bfd2` (`scripts/aem.js`, styles,
  404) with `scripts/scripts.js` wired for experimentation per the
  `adobe/aem-experimentation` v2 README contract, plus a passive timing
  probe (`window.__flicker`, performance marks only — no behavior change).
- `plugins/experimentation/` — aem-experimentation v2.0.0 @ `1079f96`
  (subtree-equivalent copy of `src/`).
- Local mock documents standing in for pipeline-published content:
  [index.html](index.html) (control, carries the experiment metadata) and
  [variant-b.html](variant-b.html) (challenger).

## Run

```bash
npm install
```

`aem up` requires the project to be a **git repo root** (an EDS site is one
repo; this probe is a subdirectory of airlockjs). Workaround: copy the dir to
a scratch location, `git init` + commit + add any GitHub-shaped `origin`,
then:

```bash
npm run up   # aem up --no-open --port 3111
```

Unresolved local paths reverse-proxy to the `origin`-derived `*.aem.page`
host (nav/footer come from the live boilerplate site); keep referenced assets
local for offline determinism.

## Drive it

- Force variants: `?experiment=hero-cta/challenger-1` or
  `?experiment=hero-cta/control`.
- Read `window.__flicker.events` for the mark timeline
  (`experimentation:start` → `exp-applied:*` → `body:appear`), and
  `window.__flicker.rum` for the exposure checkpoint.
- Applied state: `body[data-experiment]` / `body[data-variant]`.
- On localhost the lazy phase loads the plugin's simulation panel (an
  authoring aid showing a "Sign in required" overlay); it runs after
  `appear` and does not affect eager-window measurements.
