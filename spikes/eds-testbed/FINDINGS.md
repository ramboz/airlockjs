# Spike: EDS no-flicker eager swap — findings + local testbed

Date: 2026-08-25. Grounds UC-1 (above-the-fold experiment/personalization without flicker),
review finding G1 (the eager-swap mechanism was unspecified), and OQ6 (flicker oracle).
Sources read at pinned revisions: `adobe/aem-boilerplate` @ `d75bfd2`,
`adobe/aem-experimentation` v2.0.0 @ `1079f96`, `adobe-rnd/aem-martech` @ HEAD (2026-08-25).
Verified live on the local testbed in this directory.

## The mechanism, precisely

**EDS needs no anti-flicker snippet because the page is born hidden.** The boilerplate ships
`body { display: none }` in `styles/styles.css`, flipped by `body.appear { display: block }`.
`scripts.js#loadEager` runs the whole eager phase while the body is hidden, and calls
`document.body.classList.add('appear')` only after decoration. First paint physically cannot
happen before `appear`, so **any DOM mutation made inside the eager window is flicker-free by
construction**. That is the entire trick. The "anti-flicker snippet" other stacks inject (hide
body via inline style, unhide on decision timeout) is structural here.

**The plugin wiring** (aem-experimentation v2 README contract):
- `scripts/experiment-loader.js` is a cheap gate: it checks for experiment/campaign/audience
  metadata and only then dynamic-imports the plugin. Pages without experiments never load it.
- `scripts.js` calls `await runExperimentation(doc, config)` **early in `loadEager()`**,
  before `decorateMain` and before `appear`. The await is load-bearing: the swap must settle
  inside the hidden window.
- `head.html` adds `<link rel="modulepreload" href="/scripts/experiment-loader.js">` so the
  gate module is warm.

**The swap itself** (`replaceInner`, plugin `src/index.js:323`): `fetch` the variant page's
URL, parse the response with `DOMParser` (guarantees no script execution from variant
content), select its `main` (page-level) or `main > div` (section-level), and assign
`el.innerHTML = newEl.innerHTML`. Control = the current page's own content; variants are
plain published pages listed in metadata.

**Experiment declaration** (manifest-less "instant experiment"):
`<meta name="experiment" content="<id>">` +
`<meta name="experiment-variants" content="/variant-b">` (legacy name
`instant-experiment` still read). Percentage splits auto-infer to equal shares. Variant ids
are `control`, `challenger-1`, `challenger-2`, ...

**Selection and persistence**: a forced variant via `?experiment=<id>/<variant>` wins
(preview/QA path); otherwise the bundled UED engine (`ued.js#evaluateDecisionPolicy`) picks
by allocation percentage. The selection persists in `sessionStorage` by default
(configurable `storage`). Experiments can be date-windowed (`startDate`/`endDate`) and
consent-gated per experiment (`requiresConsent` → localStorage-backed consent check).

**Exposure reporting**: after applying, the plugin fires a RUM checkpoint
`sampleRUM('experiment', { source: <id>, target: <variant> })` and dispatches an
`aem:experimentation` CustomEvent on `document`. The RUM call is wrapped in
`onPageActivation()`: if `document.prerendering`, it defers to the `prerenderingchange`
event. **This is AD-9's prerender-aware reporting in the wild** (aem-martech uses the
identical pattern for its events).

## Live verification (this testbed)

Setup: boilerplate files + plugin copied per the subtree layout, two local mock documents
(`index.html` control, `variant-b.html` challenger) in EDS pipeline shape, served by
`aem up` on port 3111. A passive probe (`window.__flicker`) records performance marks;
it changes no behavior.

Measured timeline with `?experiment=hero-cta/challenger-1` (representative run, ms since
navigation):

| t (ms) | event |
|---|---|
| 67.2 | `scripts.js` module starts |
| 67.6 | `runExperimentation` starts (inside `loadEager`, body hidden) |
| 78.0 | RUM exposure checkpoint fires (`experiment` / `hero-cta` / `challenger-1`) |
| 78.4 | variant applied (`aem:experimentation` event; `main.innerHTML` now variant B) |
| 79.5 | `body.classList.add('appear')` — page becomes paintable |
| later | `first-paint` / `first-contentful-paint` |

The DOM at paint time carried the challenger H1 and
`body[data-experiment=hero-cta][data-variant=challenger-1]`. The full plugin cost in the
eager window (gate import + plugin import + variant fetch + parse + swap) was **~11-19ms
across runs against a same-host server**; on a real CDN the variant fetch is the dominant
term. The forced-**control** branch measured **~5-6ms** (no variant fetch), with the
exposure checkpoint still firing (`target: control`) — control exposures are reported too,
as experiment semantics require. Two probe caveats: absolute paint timestamps in the
embedded browser pane are unreliable (occluded tabs composite lazily), so the load-bearing
evidence is the *ordering* (swap → `appear`, and paint gated on `appear` by
`body{display:none}` — first paint structurally cannot show control content); and the
same-host fetch flatters the cost.

## What this settles for Airlock

1. **UC-1's apply mechanism is now specified** (closes review G1's "unspecified" half):
   above-the-fold no-flicker = *swap inside the hidden eager window before `appear`*. It is
   main-thread, synchronous-ish (one awaited fetch), and completes before first paint. It
   does not need `reserveSpace`/`insertAfterInteraction` (those remain the *late-injection*
   path); the docs should describe both DOM paths distinctly.
2. **The airlock boundary placement is confirmed**: decide-and-apply for the eager window
   cannot round-trip through a worker without delaying `appear` (holding paint hostage to a
   `postMessage` cycle). MVP1's in-house decisioning should run on the main thread behind
   the AD-1 decision-source seam, exactly as clarification Q4 already records, and report
   exposure through the runtime (the event crosses the airlock; the apply does not).
3. **The eager window has a hard budget**: everything before `appear` delays FCP/LCP 1:1.
   The plugin's ~19ms local cost is the floor; a remote decision source pays network RTT
   inside that window. This gives OQ6/G5 a concrete measurable: `appear`-delay attributable
   to decisioning (marks are already in place in this testbed).
4. **The flicker oracle has a structural invariant to assert** (OQ6): variant content must
   be in the DOM *at* `body:appear` (assertable via the probe marks + a DOM check at the
   `appear` mark), and `first-paint` must not precede `appear`. That is cheaper and sharper
   than screenshot-diffing for the "structural" half; screenshot-diff remains for the
   perceptual half (post-appear repaints).
5. **Exposure dedup matters for the runtime**: the plugin fires exposure on every page load
   (RUM samples it); an Airlock exposure event should carry the experiment/variant ids and
   let the connector/endpoint side decide dedup semantics.
6. **Consent + prerender patterns confirmed** in both reference repos: consent-gated
   experiments default-off until consent, and reporting defers to `prerenderingchange`
   (AD-9's two halves, both already practiced in our reference code).
7. **Trusted Types is now in the boilerplate CSP** (`require-trusted-types-for 'script'`),
   and `scripts.js` registers a `default` policy the innerHTML swap flows through. The
   airlock's mediated DOM-injection capability must be Trusted-Types-compatible (route
   through the page's default policy or its own). The head.html CSP has **no `worker-src`**;
   `script-src` governs worker creation — same-origin `new Worker('/...js')` under
   `'strict-dynamic' + nonce` needs an explicit check in the runtime spike (flagged in the
   review as the no-Worker/CSP fallback question).

## Testbed usage

```bash
cd spikes/eds-testbed
npm install
```

`aem up` requires the project to be a git repo root (an EDS site is one repo; this testbed
is a subdirectory of airlockjs). Workaround for local runs: copy the testbed to a scratch
dir, `git init` + commit + add any GitHub-shaped `origin`, then run
`aem up --no-open --port 3111` there (`npm run up`). Unresolved local paths reverse-proxy to
the `origin`-derived `*.aem.page` host, so keep all referenced assets local. Force variants
with `?experiment=hero-cta/challenger-1` (or `/control`); read `window.__flicker` for the
mark timeline; `body.dataset.experiment/variant` shows the applied state.

This page doubles as the "one real EDS page" for the risk-retirement spike: the INP
scoreboard work adds the Airlock runtime + a `patchDatalayer`-style baseline to this same
testbed.

## Caveats

- Local same-host fetch flatters the eager-window cost; measure with CDN latency (or
  throttling) before quoting numbers.
- The mock documents are hand-authored pipeline-shaped HTML, not real pipeline output;
  fidelity is good enough for mechanism/timing work, not for content-edge-cases.
- `aem up`'s reverse proxy targets a real remote; anything not present locally is fetched
  from the `origin`-derived `*.aem.page` host (in this run, nav and footer came from the
  live `aem-boilerplate` site — a useful demonstration of the local-first/remote-fallback
  behavior; fully-offline runs would 404 those instead, harmlessly).
- On localhost the lazy phase loads the plugin's simulation panel (an authoring aid that
  shows a "Sign in required" overlay); it runs after `appear` and does not affect the
  eager-window measurements.
- RUM exposure goes through sampling (`SAMPLE_PAGEVIEWS_AT`); the probe wraps `sampleRUM`
  so the checkpoint is observed regardless of sampling.
