---
status: Accepted
dependencies: []
last_verified: 2026-09-04
frame_review: true
---

# ADR-0015: Distribution channel: git-subtree (EDS convention)

## Status

Accepted (2026-09-04)

## Context

OQ8 fixes how an EDS site consumes airlock — the gate MVP6 puts first, since everything downstream flows
through it. airlock is proven on the synthetic testbed but **not yet consumable** by a real site; the vision has
carried the channel question open since 2026-08-25 — *git subtree, matching the aem-martech/aem-experimentation
convention, versus npm* ([product-vision § Unknowns](../product-vision.md); [architecture OQ8](../architecture.md)).
The slug `airlockjs` is settled. MVP6 ("Adoption & 1.0 Readiness") makes this its **risk-first** item because the
real-production-site validation and the 1.0 stability pin's versioning both consume through whatever is decided here.

Two facts about how airlock is built and served constrain the choice more than taste does:

1. **airlock is not a single importable module — it is a built N+1-artifact tree.** [`build.mjs`](../../build.mjs)
   (esbuild) emits one adapter entry (`eds.js`) plus one **sibling** chamber-worker bundle per connector
   (`chamber.worker.js`, `pixel-chamber.worker.js`, `dom-chamber.worker.js`, `helix-rum-chamber.worker.js`).
   `createAirlock` spawns a worker by a *same-directory sibling specifier* (`new Worker(new URL('./chamber.worker.js', …))`),
   so all N workers must exist as siblings in the served tree or a real page 404s them (build.mjs enforces this).
2. **Every worker MUST be a same-origin file URL — never `blob:`/`data:`** (the 004-01 CSP verdict; build.mjs
   asserts it on every build). This keeps the runtime inside the retired-risk CSP envelope the EDS boilerplate proved.

The EDS audience is **buildless at the site level** and pulls shared code via **git subtree** (the
aem-martech / aem-experimentation convention the vision names). The testbed already consumes airlock the way a real
site would: it dynamically imports the **built** `${hlx.codeBasePath}/scripts/airlock/eds.js`, served same-origin
from the site's own tree ([`probes/eds-testbed/scripts/scripts.js`](../../probes/eds-testbed/scripts/scripts.js)).
The vision's own promise is "installs as drop-in ES modules (no worker infrastructure or edge account required for
the common case)."

## Decision Options Considered

### Option A (CHOSEN): git subtree of ready-to-serve built artifacts
- **Pros:** matches the EDS audience's existing convention (aem-martech/aem-experimentation) and muscle memory;
  lands `eds.js` + the sibling `*.worker.js` bundles **directly into the site's served, same-origin tree** — exactly
  what the 004-01 same-origin-file-worker constraint requires, satisfied *by construction* rather than depending on
  the consumer's toolchain; **buildless for the consumer** (no node/esbuild/bundler step on the site) — the vision's
  drop-in promise; vendored code is auditable in the consumer's own repo (a governance-runtime virtue).
- **Cons:** git subtree has **no semver, no dependency resolution** — updates are a manual `git subtree pull`, and a
  vendored snapshot silently drifts from upstream; the 1.0 stability pin has no package-version home (needs a
  tag/VERSION-marker convention instead); airlock must publish a **served-artifact layout decoupled from
  `probes/eds-testbed/`** (the build currently emits into the testbed) — new work MVP6 must do.

### Option B: npm package (`airlockjs`), consumed via the site's bundler
- **Pros:** real semver + dependency resolution; the natural versioning home for the 1.0 pin; the idiomatic channel
  for the **non-EDS bundler ecosystems** the vision targets next (Astro/Vercel/Jamstack); one canonical source, no
  vendored drift.
- **Cons:** the **idiomatic** npm form (`npm i` + the site's bundler) **assumes a build step airlock's EDS-first
  audience does not have** — it inverts the buildless drop-in promise — and it hands worker emission + **same-origin
  serving to the consumer's bundler**, where the 004-01 envelope *requires* same-origin file workers (a bundler that
  inlines `new Worker(new URL(...))` as a `blob:`/`data:` URL, or resolves it to a `node_modules`/CDN path, leaves
  that envelope): npm shifts a load-bearing **CSP invariant onto every consumer's toolchain config**. *(A
  non-idiomatic npm mode — ship the pre-built dist and reference it same-origin without re-bundling — would preserve
  the invariant, but it still assumes the site can place + serve the files itself and is no longer the buildless
  drop-in, so it does not rescue the EDS-first case.)* Cuts against the EDS convention. **Deferred, not rejected** —
  see the decision.

## Recommended Decision

Adopt **git subtree of ready-to-serve built artifacts** as airlock's **primary distribution channel for the
EDS-first 1.0 release**. Concretely:

1. **Subtree ships built, same-origin-ready artifacts — the consumer runs no build.** The distribution surface is a
   served-artifact tree (`eds.js` + every sibling `*.worker.js`) the site pulls into its own scripts tree and
   references directly, same-origin — the shape the testbed already consumes. This satisfies the 004-01
   same-origin-file-worker constraint *by construction* and keeps the drop-in promise.
2. **npm is deferred, not rejected — it is the planned *second* channel.** The "for now" is load-bearing: when the
   first **bundler-based** (non-EDS) adopter arrives, `airlockjs` on npm is the idiomatic channel for *that* audience
   and the natural home for semver. Keeping it open (rather than committing to it now) avoids inverting the buildless
   promise for the audience we actually have first.
3. **MVP6 owns the setup work this decision implies** — a served-artifact layout decoupled from
   `probes/eds-testbed/`, a documented `git subtree add`/`pull` install + served-path convention, and a versioning
   marker (subtree has no semver) that the 1.0 pin can reference.

This is the **primary channel for the EDS audience**, not a claim that npm is wrong forever — the honest scope is
"subtree-first for the buildless EDS 1.0; npm when the bundler audience arrives."

## Consequences

**Becomes easier:**
- A real EDS site can consume airlock the way it already consumes aem-martech/aem-experimentation — buildless,
  same-origin, convention-matching — which unblocks MVP6's real-production-site validation.
- The same-origin-file-worker invariant (004-01) is preserved **by construction**, not delegated to a consumer's
  bundler config.

**Becomes harder:**
- No semver: consumers update by `git subtree pull` and a vendored copy can drift; the 1.0 stability pin needs a
  tag/VERSION-marker convention rather than a package version.
- airlock would subtree **generated esbuild bundles**, not the hand-authored *source* aem-martech/aem-experimentation
  vendor — opaque generated output makes `git subtree pull` **more merge-hostile** (a buildless consumer cannot
  resolve a bundle-diff conflict), so the no-semver/drift risk bites harder than a straight convention-transfer
  implies. This argues for treating the served-artifact tree as a **generated release** the consumer overwrites
  wholesale (a tagged snapshot), not a mergeable source tree.
- airlock must maintain a **served-artifact distribution layout separate from the testbed build target** — the build
  currently emits into `probes/eds-testbed/scripts/airlock/`.
- Two channels eventually (subtree + npm) means two consumption stories to keep working and documented.

## Assumptions

- The build emits N+1 **self-contained, same-origin sibling** bundles and forbids `blob:`/`data:` workers —
  **grounded** (read [`build.mjs`](../../build.mjs); asserted on every build).
- The testbed consumes airlock as a real site would: dynamic import of the **built** same-origin
  `scripts/airlock/eds.js` — **grounded** ([`probes/eds-testbed/scripts/scripts.js`](../../probes/eds-testbed/scripts/scripts.js)).
- The same-origin-file-worker requirement is load-bearing CSP, not preference — **grounded** (004-01 verdict, cited
  in build.mjs).
- The EDS audience is buildless and uses the git-subtree convention (aem-martech/aem-experimentation) — **cited from
  the project's own vision/architecture framing**, not independently re-probed against those repos; if a real EDS
  site in fact runs a bundler, Option B's cons weaken.
- A consumer bundler *may* inline `new Worker(new URL(...))` as a `blob:` URL or resolve it off-origin — stated as
  the **risk npm shifts onto the consumer**, calibrated as bundler-config-dependent, not universal.
- **The same-origin-worker constraint is not, by itself, an npm-blocker.** It is a constraint *every* channel must
  meet: subtree meets it by construction, the idiomatic bundler-npm path risks breaking it, and a prebuilt-dist-over-npm
  could meet it too. So the real subtree-vs-npm discriminator is the **buildless-audience + convention** premise
  above — the CSP fact specifically disfavors the *idiomatic bundler* npm path, not npm categorically. If the
  buildless premise falls, this decision reduces to convention/preference, and npm's cons weaken accordingly.
- **The distribution *mechanism* is asserted, not yet probed end-to-end.** The testbed grounds airlock's *runtime
  consumption shape* (same-origin dynamic import of the built `eds.js`) but reaches it by **direct build-emit into
  `probes/eds-testbed/`** ([`build.mjs`](../../build.mjs) `OUTDIR`), **not** a `git subtree` pull → serve → boot. That
  a subtree of built artifacts actually installs, serves, and boots on a real EDS checkout is the MVP6 setup spec's
  job to prove (see Open questions), not evidenced here.

## Kill criteria

- The EDS ecosystem moves to a **site-level build** as the norm (or the first real adopter is a bundler-based non-EDS
  stack) **before** EDS traction — then npm should be promoted from deferred second channel to primary sooner than
  planned.
- Subtree **update friction / drift** (no semver) proves unacceptable for consumers tracking the 1.0 line —
  reconsider an npm-primary or dual-primary posture.
- The served-artifact subtree layout **cannot be cleanly decoupled** from the testbed build without duplicating build
  logic — revisit whether a published (npm/CDN) artifact is the lower-maintenance surface.

## Open questions

- The exact **served-artifact layout** and where the build emits it (a first-class `dist/`-style tree vs continuing
  to target the testbed path) — the MVP6 distribution-setup spec defines it.
- The **install/update UX**: the documented `git subtree add`/`pull` commands, the served-path convention, and how a
  consumer pins/updates a version without semver (a git tag + a VERSION marker?). The setup spec's **first proof**
  should be the mechanism itself — `git subtree add`/`pull` onto a clean EDS checkout, then boot with CWV preserved —
  since that path is asserted, not yet probed (see Assumptions).
- Whether the 1.0 release **also** publishes `airlockjs` to npm for the non-EDS audience, or holds npm until the
  first bundler adopter is real.
- How the **1.0 API stability pin** (MVP6) references a subtree'd version — the versioning-marker convention subtree
  lacks.
