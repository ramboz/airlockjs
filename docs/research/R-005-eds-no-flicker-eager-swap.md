---
status: CONCLUDED
topic: EDS no-flicker eager-swap mechanism, timing, and integration contract
created: 2026-08-25
related:
  - ../reviews/2026-08-25-mvp1-architecture-review.md
  - ../refinement-todo.md
  - ../../probes/eds-testbed/
---

# R-005: EDS no-flicker eager swap

## Question

Exactly how does aem-experimentation apply an above-the-fold decision before
paint without flicker, and where in the EDS three-phase sequence does it sit?
This is the mechanism UC-1 needs and the architecture left unspecified
(arch-review G1), and it shapes the OQ6 flicker oracle.

## Sources / findings

Sources read at pinned revisions: `adobe/aem-boilerplate` @ `d75bfd2`,
`adobe/aem-experimentation` v2.0.0 @ `1079f96`, `adobe-rnd/aem-martech` @ HEAD
(2026-08-25). Verified live on the executed probe
([probes/eds-testbed](../../probes/eds-testbed/)).

### The mechanism, precisely

- **EDS needs no anti-flicker snippet because the page is born hidden.** The
  boilerplate ships `body { display: none }` in `styles/styles.css`, flipped
  by `body.appear { display: block }`. `scripts.js#loadEager` runs the whole
  eager phase while the body is hidden and calls
  `document.body.classList.add('appear')` only after decoration. First paint
  physically cannot happen before `appear`, so **any DOM mutation inside the
  eager window is flicker-free by construction**.
- **Plugin wiring** (v2 README contract): `scripts/experiment-loader.js` is a
  cheap gate (metadata check → dynamic-import the plugin only when
  experiments exist); `scripts.js` calls
  `await runExperimentation(doc, config)` **early in `loadEager()`**, before
  `decorateMain` and before `appear`; `head.html` modulepreloads the loader.
- **The swap** (`replaceInner`, plugin `src/index.js:323`): `fetch` the
  variant page, parse with `DOMParser` (no script execution), select its
  `main` (page-level) or `main > div` (section-level), assign
  `el.innerHTML = newEl.innerHTML`. Control = current page's own content.
- **Declaration** (manifest-less "instant experiment"):
  `<meta name="experiment" content="<id>">` +
  `<meta name="experiment-variants" content="/variant-b">`; splits
  auto-infer equal shares; variant ids `control`, `challenger-1`, ...
- **Selection/persistence**: forced variant via `?experiment=<id>/<variant>`
  wins; otherwise the bundled UED engine picks by allocation; persisted in
  `sessionStorage` by default; optional date-window and per-experiment
  consent gating.
- **Exposure reporting**: `sampleRUM('experiment', {source: id, target:
  variant})` + an `aem:experimentation` CustomEvent, wrapped in
  `onPageActivation()` — deferring to `prerenderingchange` when
  `document.prerendering`. **AD-9's prerender-aware reporting in the wild**
  (aem-martech uses the identical pattern).

### Live measurements (probe)

Representative forced-challenger run (ms since navigation): module start
67.2 → `runExperimentation` start 67.6 → RUM exposure 78.0 → variant applied
78.4 → `body:appear` 79.5 → paint after `appear`. Plugin cost in the eager
window: **~11–19ms** same-host (variant fetch dominates; a CDN pays RTT
inside the paint window). Forced-control: **~5–6ms** (no variant fetch),
exposure still fires with `target: control`. The DOM at paint carried the
challenger H1 + `body[data-experiment][data-variant]`. Probe caveats:
absolute paint timestamps in the embedded browser pane are unreliable
(occluded tabs composite lazily) — the load-bearing evidence is the ordering
(swap → `appear`, paint gated on `appear` structurally); same-host fetch
flatters the cost.

## Open questions

- Real-CDN eager-window cost (measure with throttling before quoting).
- Exposure dedup semantics for the Airlock exposure event (the plugin fires
  on every load; RUM samples it).
- ~~`new Worker()` compatibility with the boilerplate CSP
  (`script-src 'nonce-aem' 'strict-dynamic'`, **no `worker-src`**) — the
  runtime spike must check this explicitly.~~ **ANSWERED 2026-08-26 (spec
  [004-01](../specs/004-uc2-ga4-eds/slice-01-worker-under-csp.md)):** a same-origin
  module worker **runs** under the unmodified boilerplate CSP + Trusted Types — no
  `worker-src` accommodation needed. Verified with a negative control proving the
  CSP is enforced (`npm run rig:csp`).

## Conclusion

What this settles for Airlock:

1. **UC-1's apply mechanism is specified** (closes the mechanism half of
   review G1): swap inside the hidden eager window before `appear` —
   main-thread, one awaited fetch, complete before first paint. Distinct from
   the late-injection path (`reserveSpace`/`insertAfterInteraction`); the
   docs should describe both DOM paths separately.
2. **Boundary placement confirmed**: eager decide-and-apply cannot round-trip
   through a worker without delaying `appear` (holding paint hostage).
   Clarification Q4's placement stands; only the exposure event crosses the
   airlock.
3. **The eager window has a hard budget**: everything before `appear` delays
   FCP/LCP 1:1 (~11–19ms local floor; remote decisioning pays RTT in-window).
   Gives OQ6/G5 a concrete measurable.
4. **OQ6 gets a structural flicker invariant**: variant content in the DOM
   *at* `body:appear`, and `first-paint` never before `appear` — cheaper and
   sharper than screenshot-diff for the structural half (screenshots remain
   for perceptual post-appear repaints). Probe marks already exist in the
   testbed.
5. **Trusted Types is now in the boilerplate** (`require-trusted-types-for
   'script'` + a `default` policy in scripts.js that the innerHTML swap flows
   through): the airlock's mediated DOM-injection capability must be
   TT-compatible.
6. The testbed doubles as the **"one real EDS page" for the risk-retirement
   spike** — the INP scoreboard work adds the Airlock runtime and a
   `patchDatalayer`-style baseline to this same page.

Promoted to: UC-1 mechanism requirement for the upcoming spike spec
(arch-review G1); OQ6 flicker-oracle design
([refinement-todo](../refinement-todo.md) § OQ6, drive-order step 8).
