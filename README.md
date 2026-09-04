# airlockjs

Capability-secured, off-main-thread martech runtime for edge/static sites (Adobe Edge
Delivery Services first). The main thread only captures and enqueues; all mapping and
egress happen behind the airlock, in isolated worker "chambers". See
[docs/product-vision.md](docs/product-vision.md) for the vision and
[docs/architecture.md](docs/architecture.md) for the module boundaries.

> Pre-1.0 — surfaces (including the distribution layout below) may change until the 1.0
> API-stability pin. Distribution is **git-subtree of ready-to-serve built artifacts**
> ([ADR-0015](docs/decisions/adr-0015-distribution-git-subtree.md)); npm is a deferred
> second channel for the future bundler audience.

## Install into an EDS site (git subtree, no build step)

airlock ships as a **ready-to-serve built tree** on a dedicated **`dist` branch** whose
**root** is exactly the servable artifacts:

```
eds.js                        # the adapter entry (import + boot from here)
chamber.worker.js             # GA4 chamber (default connector)
pixel-chamber.worker.js       # pixel connector
dom-chamber.worker.js         # worker-dom mirror connector
helix-rum-chamber.worker.js   # helix-rum (RUM authority) connector
VERSION                       # e.g. "airlockjs v0.5.0+<short-sha>" — the vendored snapshot marker
```

Your site pulls that tree into its own served scripts directory and references it
**same-origin** — the shape the 004-01 CSP verdict requires (every worker a same-origin
**file** URL, never `blob:`/`data:`), satisfied by construction.

### 1. Vendor the built tree with `git subtree add`

**Served-path convention:** land the tree at **`scripts/airlock/`** under your site's code
base path (its served root), so the runtime resolves `scripts/airlock/eds.js` and its sibling
`scripts/airlock/*.worker.js` same-origin.

Add the tree from airlock's **`dist` ref** — **never `main`**. `git subtree add --prefix`
pulls the ref's **root tree**, and `main`'s root is airlock's *source project* (`build.mjs`,
`core/`, tests), not the built artifacts; only the `dist` branch's root is the servable tree.

```sh
# one-time: register the airlock remote
git remote add airlock git@github.com:ramboz/airlockjs.git

# vendor the built tree at scripts/airlock/ from the dist ref (NOT main)
git subtree add --prefix scripts/airlock airlock dist --squash
```

This commits `scripts/airlock/eds.js` + the four sibling `*.worker.js` bundles + `VERSION`
into your repo. (Updating a vendored snapshot with `git subtree pull` — treating it as a
generated release you overwrite wholesale — is spec 031-02.)

### 2. Boot airlock (two lines, in your lazy phase)

In your `scripts.js` **lazy** phase (after `body.appear` — analytics is lazy, post-LCP), boot
airlock with the two documented lines:

```js
const { bootEdsAnalytics } = await import(`${window.hlx.codeBasePath}/scripts/airlock/eds.js`);
await bootEdsAnalytics();
```

Guard the boot so a load/boot failure never breaks the page (a rejected boot is caught,
optionally surfaced via a flag for observability):

```js
try {
  const { bootEdsAnalytics } = await import(`${window.hlx.codeBasePath}/scripts/airlock/eds.js`);
  await bootEdsAnalytics();
} catch (e) {
  window.__airlockBootFailed = String(e); // page unaffected; visible to a health check
}
```

That is the whole install: no node/esbuild/bundler step on the site. The end-to-end proof —
`git subtree add` of the `dist` ref onto a clean EDS checkout → serve → boot (beacon fires,
CWV preserved) — is `npm run rig:subtree` (`WITH_CWV=1` adds the Lighthouse arm).

## Maintaining the distribution (airlock maintainers)

The `dist` branch is a **generated release**, produced from source — not hand-edited:

```sh
npm run build:dist                          # emit dist/ (eds.js + the four *.worker.js siblings)
npm run publish:dist -- --target origin      # commit dist/ + VERSION to the dist-rooted `dist` branch on origin
```

- `npm run build:dist` runs the same same-origin-file-worker build assertions as `npm run
  build` (a dropped/renamed worker sibling fails the **build**), emitting into `dist/` instead
  of the testbed tree.
- `npm run publish:dist` builds the dist-rooted commit in a throwaway staging repo and pushes
  it to the target's `dist` branch (root = the artifacts + a `VERSION` marker stamped from
  `package.json` version + the source short-SHA). A `--target` is **required** (no `origin`
  default) so a re-run cannot push by accident. It accepts a remote **name** (`--target origin`,
  resolved to its URL), a remote **URL** (`--target git@github.com:ramboz/airlockjs.git`), or a
  local bare-repo **path** (what the rig uses for a hermetic proof).

## Development

- `npm test` — vitest unit + integration suites.
- `npm run lint` — ESLint (real-bug ruleset; CI gates on it).
- `npm run build` — bundle the runtime into the EDS testbed (`probes/eds-testbed/`) for the rigs.
- `npm run rig:*` — Playwright/chromium proof rigs (see `package.json`).

See [docs/workflow.md](docs/workflow.md) for the spec-driven workflow and
[docs/conventions.md](docs/conventions.md) for coding rules.
