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

airlock ships as a **ready-to-serve built tree** published to a **dist-rooted ref** whose **root**
is exactly the servable artifacts. Each release is pinned as a **`dist-vX.Y.Z` tag** (the semver
substitute git subtree lacks); pull a **tag**, not the floating `dist` branch:

```
eds.js                        # the adapter entry (import + boot from here)
chamber.worker.js             # GA4 chamber (default connector)
pixel-chamber.worker.js       # pixel connector
dom-chamber.worker.js         # worker-dom mirror connector
helix-rum-chamber.worker.js   # helix-rum (RUM authority) connector
VERSION                       # a tagged release: "airlockjs vX.Y.Z" (== the dist-vX.Y.Z tag) — the vendored snapshot marker
```

Your site pulls that tree into its own served scripts directory and references it
**same-origin** — the shape the 004-01 CSP verdict requires (every worker a same-origin
**file** URL, never `blob:`/`data:`), satisfied by construction.

### 1. Vendor the built tree with `git subtree add`

**Served-path convention:** land the tree at **`scripts/airlock/`** under your site's code
base path (its served root), so the runtime resolves `scripts/airlock/eds.js` and its sibling
`scripts/airlock/*.worker.js` same-origin.

Add the tree from a **`dist-vX.Y.Z` release tag** — **never `main`**. `git subtree add --prefix`
pulls the ref's **root tree**, and `main`'s root is airlock's *source project* (`build.mjs`,
`core/`, tests), not the built artifacts; only a dist-rooted ref's root is the servable tree.
Pin a **tag** (not the floating `dist` branch) so your vendored snapshot is a known release.

```sh
# one-time: register the airlock remote
git remote add airlock git@github.com:ramboz/airlockjs.git

# vendor the built tree at scripts/airlock/ from a dist-vX.Y.Z release tag (NOT main, NOT the dist branch)
git subtree add --prefix scripts/airlock airlock dist-vX.Y.Z --squash
```

This commits `scripts/airlock/eds.js` + the four sibling `*.worker.js` bundles + `VERSION`
(`airlockjs vX.Y.Z`, matching the tag) into your repo.

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
`git subtree add` of a `dist-vX.Y.Z` tag onto a clean EDS checkout → serve → boot (beacon fires,
CWV preserved) — is `npm run rig:subtree` (`WITH_CWV=1` adds the Lighthouse arm).

### 3. Update to a newer release with `git subtree pull`

The vendored tree is a **generated release** — an opaque esbuild bundle, **overwritten wholesale**,
**not** a mergeable source tree. To move to a newer release, `git subtree pull` the newer
`dist-vX.Y.Z` **tag** with `--squash`:

```sh
# update the vendored tree to a newer release tag (overwrites it wholesale)
git subtree pull --prefix scripts/airlock airlock dist-vX.Y.Z --squash
```

`--squash` is **required**: each release is published as an unrelated root commit, so a non-`--squash`
pull fails with `refusing to merge unrelated histories`. **Never hand-edit the vendored tree** under
`scripts/airlock/` — a local edit to a generated bundle makes the next pull **merge-hostile** (a
bundle-diff conflict a buildless site cannot resolve). Treat it as read-only vendored output: to
change airlock's behavior, configure it at the boot site, not by editing the vendored files. The
update path — `git subtree add` a `dist-vA` tag, `git subtree pull` `dist-vB`, and re-boot cleanly,
plus the seeded hand-edit conflict that proves the no-hand-edit discipline — is proven by
`npm run rig:subtree`.

## Maintaining the distribution (airlock maintainers)

The distribution is a **generated release**, produced from source — not hand-edited:

```sh
npm run build:dist                                   # emit dist/ (eds.js + the four *.worker.js siblings)
npm run publish:dist -- --target origin --release    # tag dist-vX.Y.Z (from package.json) + reconcile VERSION to it
npm run publish:dist -- --target origin              # OR: update the floating `dist` branch (marker carries +short-sha)
```

- `npm run build:dist` runs the same same-origin-file-worker build assertions as `npm run
  build` (a dropped/renamed worker sibling fails the **build**), emitting into `dist/` instead
  of the testbed tree.
- `npm run publish:dist` builds the dist-rooted commit in a throwaway staging repo and pushes it to
  the target's **`dist` branch**. Without `--release` the `VERSION` marker is `package.json` version
  + the source short-SHA (`airlockjs vX.Y.Z+<sha>` — a floating "latest" between releases). With
  **`--release`** the marker is instead the pinned `airlockjs vX.Y.Z` (no sha), and the same
  dist-rooted commit is **also tagged `dist-vX.Y.Z`** (from `package.json`'s version) and the tag
  pushed — so the tag's `VERSION` equals the tag by construction. That tag is the authoritative pin
  consumers `git subtree add`/`pull` (there is no semver; the tag is the version). **Release tags are
  immutable:** the tag is pushed **without force**, so re-running `--release` on an un-bumped version
  **fails loudly** (`! [rejected] … already exists`) rather than silently relocating a published
  release — **bump `package.json`'s version for each release.** (A deliberate re-cut opts in with
  `--force-tag`; the floating `dist` branch, by contrast, is always re-pushable.) A `--target` is
  **required** (no `origin` default) so a re-run cannot push by accident. It accepts a remote
  **name** (`--target origin`, resolved to its URL), a remote **URL**
  (`--target git@github.com:ramboz/airlockjs.git`), or a local bare-repo **path** (what the rig uses
  for a hermetic proof).

### Cutting a release (the dist tag is automatic)

A source release (`vX.Y.Z`) and its distribution cut (`dist-vX.Y.Z`) share one version. The
`postversion` hook wires them together, so **`npm version` cuts the dist tag for you**:

```sh
# 1. update docs/releases/* + CHANGELOG.md for the new version, commit them.
npm version X.Y.Z    # bumps package.json + commits + creates the vX.Y.Z source tag,
                     # then postversion → `npm run release:dist` (build:dist + publish
                     # --target origin --release): pushes the dist branch + the immutable
                     # dist-vX.Y.Z tag to origin. AUTOMATIC — no separate dist step to forget.
git push --follow-tags   # 2. publish the source commit + the vX.Y.Z tag.
```

- **`npm run release:dist`** = `build:dist && publish:dist --target origin --release` — the same
  cut, runnable standalone (e.g. to publish `dist-v0.5.0` retroactively for the current version).
- **Heads-up:** `postversion` reaches the network — `npm version` now **pushes the dist branch + tag
  to `origin`**. The source commit + `vX.Y.Z` tag stay your explicit `git push --follow-tags` (step 2),
  so briefly `dist-vX.Y.Z` is on origin before the source tag; the push in step 2 catches it up.
- The dist tag is **immutable** (above): if `npm version` re-runs a version already released, the dist
  push fails loudly — bump the version, don't reuse it.

## Development

- `npm test` — vitest unit + integration suites.
- `npm run lint` — ESLint (real-bug ruleset; CI gates on it).
- `npm run build` — bundle the runtime into the EDS testbed (`probes/eds-testbed/`) for the rigs.
- `npm run rig:*` — Playwright/chromium proof rigs (see `package.json`).

See [docs/workflow.md](docs/workflow.md) for the spec-driven workflow and
[docs/conventions.md](docs/conventions.md) for coding rules.
