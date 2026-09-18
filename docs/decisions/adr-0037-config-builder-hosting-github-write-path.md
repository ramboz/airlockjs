---
status: Proposed
dependencies: [adr-0036]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0037: Config builder hosting and write path: static schema-driven app, GitHub PRs as the backend

## Status

Proposed (2026-09-18)

## Context

The config builder is a UI that lets a site owner pick connectors from airlock's library, configure each against the pinned
schema, and land the generated per-site tree in the site's GitHub repository. The maintainer's one firm requirement is
GitHub integration: the config must be pushed to the repo directly, via a personal access token or similar. Four candidate
homes were on the table: an Adobe I/O App Builder app, an EDS sheet plus a sidekick or Document Authoring extension, an app in
the unified shell on experience.adobe.com, and a fully Adobe-disconnected static site.

Facts that shape the choice:

- **The config is already form-generatable.** `contracts/instrumentation-config.schema.json` is a JSON Schema draft 2020-12
  discriminated union on `type`, every field carries a description, and `contracts/fixtures/` holds golden and negative
  vectors. With [ADR-0036](./adr-0036-per-site-composition.md)'s manifests, the connector library is machine-readable too.
- **Generation needs no server.** ADR-0036 makes the generator a pure function of config, dist version and manifests, so a
  browser can produce the site tree without a backend.
- **The config is a security policy, not content.** It carries the consent purpose map, `consentStrict`, the payload
  denylist and the OneTrust group mapping. Airlock's value is governed egress, so config changes belong behind the same
  gate as code: a reviewable pull request with a validation check.
- **Config is consumed before paint.** The eager reserve at `probes/eds-testbed/scripts/scripts.js:184` reads the config
  before `body.appear`. A runtime fetch of config from a sheet endpoint would put a request on the critical path of a
  runtime whose pitch is TBT.
- **Airlock is vendor-neutral.** Its connectors are mostly non-Adobe vendors and the adoption doc
  (`docs/adoption/rewire-a-container.md`) is deliberately vendor-neutral. An Adobe IMS identity as the entry ticket would
  exclude adopters the runtime is built for.
- **EDS sites have no deploy-time build.** Whatever the builder produces must be committed files.

## Decision Options Considered

### Option A: Adobe I/O App Builder
- **Pros:** Hosted; IMS auth for free; Runtime actions could hold a GitHub secret server-side so users never handle a token.
- **Cons:** IMS gates every user behind an Adobe org, against the vendor-neutral positioning; App Builder ceremony for what
  is a form plus GitHub API calls; couples an open runtime to an Adobe-internal hosting ecosystem. Its one distinct
  benefit, a place to hold a token-exchange secret, is available from any small serverless host.

### Option B: EDS sheet plus sidekick or DA extension (config as content)
- **Pros:** Authors already live there; no new identity.
- **Cons:** A nested discriminated union with maps flattens badly into rows. Config would be fetched at runtime, on the
  critical path. The egress policy would be editable like page content with no review gate. It does not push to GitHub, the
  one stated requirement. Sidekick and DA plugins are URLs, so this surface is obtainable later by embedding Option D.

### Option C: Unified shell app on experience.adobe.com
- **Pros:** Discoverable for Adobe customers; org-scoped.
- **Cons:** Highest ceremony (shell onboarding, entitlement, listing); IMS-mandatory; declares airlock an Adobe product
  before its config surface is frozen. A shell app is essentially an iframe of a web app, so it is a distribution wrapper
  that can be added later.

### Option D: Static schema-driven app with GitHub as the backend
- **Pros:** Matches the config-is-a-repo-file model; zero backend when the browser talks to `api.github.com` directly; the
  form is generated from the pinned schema; hostable on GitHub Pages or on aem.live itself; vendor-neutral; embeddable in
  a sidekick, DA or shell wrapper later because those are URLs.
- **Cons:** Token handling is the weak point: a personal access token in the browser must be scoped and stored carefully,
  and removing it entirely needs a small token-exchange backend. No identity beyond the git author, which is also the audit
  trail.

### Option E: CLI only
- **Pros:** Cheapest; the 1.0 target user is a developer.
- **Cons:** Not the marketer-facing tool asked for. Kept as the first vertical scope of the release, not as the UI decision.

## Recommended Decision

Build the config builder as **Option D**: a static, schema-driven single-page app with GitHub as its only backend.

- **Form generation.** The connector picker and per-connector forms are generated from the manifests (ADR-0036) and the
  pinned JSON Schema, extended with UI hints (ordering, grouping, secret-versus-plain fields) as schema annotations rather
  than a parallel UI definition.
- **Write path is a pull request, never a direct push.** The app creates a branch, commits the generated file set through
  the Git Trees and Contents APIs, and opens a PR against the site's default branch. A site-side GitHub Action validates the
  committed config against the pinned schema (the existing `contracts/validate.mjs` Ajv path) and is the merge gate.
- **Authentication starts with a fine-grained personal access token** scoped to the one target repository with Contents and
  Pull Requests write permission. The token is held in session storage only, is sent to `api.github.com` only, and is never
  logged, persisted or transmitted elsewhere. **The upgrade path is a GitHub App** with a minimal token-exchange backend;
  its trigger is the first adopter for whom PAT handling blocks adoption.
- **Hosting** is a static host, GitHub Pages or aem.live, with a strict CSP and XSS-safe rendering (the
  `core/inspector/panel.js` createElement precedent).
- **Embedding surfaces are wrappers, not architecture.** The same URL may be mounted as a sidekick plugin, a DA extension or
  a unified-shell app later. Option B as a source of truth and Options A and C as foundations are rejected. Adobe I/O
  Runtime remains a candidate for the token-exchange backend only.

## Consequences

**Becomes easier:**
- Any airlock adopter with a GitHub repo can use the builder; no Adobe identity is required.
- Every config change is a reviewed, validated PR; the git log is the audit trail for the egress policy.
- One build serves the standalone app and every later embedding surface.
- The UI, the CLI and the Action share ADR-0036's generator, so their output cannot diverge.

**Becomes harder:**
- Token handling is on the adopter: creating a fine-grained PAT is friction, and the app must treat it as a secret at every
  step.
- Non-GitHub hosts (GitLab, Bitbucket, Azure DevOps) are out of scope until a second provider is asked for.
- The schema must be frozen before the UI is built; churn in the schema is churn in the UI.
- Adobe-customer discoverability waits for the shell wrapper.

## Assumptions

- **`api.github.com` accepts browser-originated calls with a token in the Authorization header.** Citation: GitHub REST
  API documentation on CORS; not probed here. Spike in the UI spec's first slice.
- **Fine-grained PATs can be scoped to a single repository with Contents and Pull Requests write.** Citation: GitHub docs
  on fine-grained personal access tokens; not probed here.
- **A draft 2020-12 `oneOf`-on-`type` schema renders acceptably in an off-the-shelf schema-form library.** Unverified;
  the UI spec's first slice spikes this against the goldens in `contracts/fixtures/`.
- **Sidekick, DA and unified-shell surfaces can host an arbitrary URL.** Assumed from their plugin models; verified only
  when an embedding scope is picked up.

## Kill criteria

- If the first adopters refuse PAT handling, the GitHub App backend is pulled forward; the static app and PR model stand.
- If the config surface cannot be frozen (ADR-0036's freeze fails), the UI is paused rather than built on a moving schema.
- If a schema-form library cannot render the discriminated union without a parallel hand-written form per connector, the
  form-generation claim is false and the UI's cost model is re-shaped.

## Open questions

- Who the builder's user is: the 1.0 target user is a developer, and the config is a security policy, so "marketer" may
  mean a site owner with review, with marketer-editable overrides as a later layer. Settle in the UI spec's clarify pass.
- Which schema-form library, or a hand-rolled renderer over the manifest.
- GitHub Pages versus aem.live as the host.
- Whether the container translator parked in [inbox](../inbox.md) (2026-09-07) becomes the builder's import side.
- Behaviour when the target repo has no branch protection: still a PR, or an opt-in direct commit.
