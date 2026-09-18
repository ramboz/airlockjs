# Release Plan: Config Builder & Per-Site Composition

> **New plan, 2026-09-18.** Post-1.0 in spirit (the inbox already parks the container translator as "1.1"), but it
> restructures the stable core's composition model, so the maintainer may choose to land the runtime half before the 1.0
> freeze. Sequencing against the MVP9 → v1.0.0 cut is an open question below. Decisions are locked in
> [ADR-0036](../decisions/adr-0036-per-site-composition.md) (per-site composition) and
> [ADR-0037](../decisions/adr-0037-config-builder-hosting-github-write-path.md) (builder hosting + write path), both
> Proposed pending frame-critique and owner acceptance.

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

Version: **TBD**. MVP10 (personalization) holds v1.1.0, so this is a v1.2 candidate if sequenced after it; the runtime half (scope 1) may instead land as a 0.x slice before the 1.0 freeze. The `MVPn ↔ v0.n.0` convention ends at 1.0.

## Problem / Baseline

- **Current baseline:** an adopter vendors the whole `dist-vX.Y.Z` tree by git subtree (ADR-0015): one 159 KB `eds.js`
  that statically imports every connector's main-thread glue, plus all eight chamber workers, regardless of which
  connectors the site's config uses. Config is a hand-written JSON object set on an inline `window.__airlockConfig` global
  before `scripts.js`; the only schema validation runs in the dev harness. The connector library exists as four hand-synced
  lists (schema `oneOf`, `KNOWN_CONNECTOR_TYPES`, `WORKER_ENTRIES`, `DIST_ARTIFACTS`) with no per-connector manifest.
- **Problem this release addresses:** (1) a customer not using GA4 should not have GA4 code shipped to their repo; the
  shipped tree must be composed per site. (2) A site owner or marketer needs a UI to pick connectors from the library,
  configure each, and generate the site's build, with the result pushed to the site's GitHub repo directly.
- **Why now:** the config surface is explicitly experimental with its freeze parked as a follow-on ADR
  ([refinement-todo](../refinement-todo.md) § Spec 032). A per-site generator and a UI must be built against a frozen
  surface, so this release is the freeze's trigger, and doing it before adopters accumulate on the inline-global form is
  cheaper than after.

## Appetite

- **Time or attention this release is worth:** TBD (maintainer to set).
- **Fixed constraints:** GitHub integration is required (config lands in the site repo via a PAT or similar); no Adobe IMS
  identity as an entry ticket; the stable core's frozen surface (ADR-0017) stays backward-compatible.
- **Variable scope:** the embedding surfaces (sidekick, DA, unified shell), the GitHub App upgrade, marketer-editable
  overrides, and the container-translator import side all flex out first.

## Solution Outline

- **Proposed shape:** one manifest per connector becomes the single source of truth; `boot(config, { connectors })`
  injects a registry; a pure generator turns (config, dist version, manifests) into a per-site file set; a CLI, a static
  schema-driven builder app and a site-side validation Action all call that generator. The builder writes via GitHub PRs,
  never direct pushes (ADR-0036, ADR-0037).
- **Main user-facing path:** open the builder, pick connectors, fill each connector's form and the consent map, point it at
  a repo with a fine-grained token, review the generated tree, open the PR, merge after the validation check passes, and
  the site boots with only those connectors.
- **Important non-goals:** a backend service; config-as-content in a sheet; a plugin system beyond the manifest; new
  runtime capabilities.

### Vertical Scopes (delivery order)

Ordered thinnest-demoable-path-first. Each scope must deliver end-to-end,
demoable value on its own (not "just the data model" / "just the parser").

1. **Developer CLI walking skeleton.** `airlockjs init` reads a config file and emits a per-site tree (generated entry,
   committed config, only the selected connectors' artifacts, boot snippet) that boots on the eds-testbed with the 038
   parity harness green. Demoable outcome: a GA4-only config produces a tree with zero Meta, Ads, Floodlight or alloy bytes,
   grep-provable. Carries the manifest, the registry boot, the output-layout decision from R-013 and the compatibility
   `eds.js`.
2. **Builder app to PR.** A static schema-driven app generates the same tree from a form and opens a pull request on a
   target GitHub repo with a fine-grained token; the repo's validation Action passes on the PR. Demoable outcome: pick GA4
   plus Meta, fill ids and the consent map, open the PR, merge, the site boots with those two connectors.
3. **Upgrade loop.** From the app or the CLI, bump the pinned dist version on an existing adopter and open the upgrade PR;
   the Action re-validates the config against the new pinned schema. Demoable outcome: the eds-testbed migrates from the
   inline global to the generated entry in one PR with no behaviour change (Lighthouse tight band holds).

## Risks / Rabbit Holes

- **Chunked dist versus the CSP envelope (R-013).**
  - Why it matters: if a pre-chunked dist cannot pass the blob/data/ajv scans and the sibling assertion, or per-connector
    glue is a small share of `eds.js`, "generator as file selection" is false and generation needs esbuild somewhere.
  - Retirement path: run the [R-013](../research/R-013-per-site-chunked-dist-feasibility.md) probe before drafting the
    scope-1 spec; ADR-0036 is written to hold under either outcome.
- **Breaking existing adopters.** The eds-testbed and the spec-050 erp.intuit.com rewire use the inline global.
  - Retirement path: the full-registry `eds.js` stays as the compatibility entry; scope 3 proves the migration.
- **Token handling blocks adoption.** A fine-grained PAT is friction and a secret in the browser.
  - Retirement path: session-only storage, single-repo scope, `api.github.com`-only egress; the GitHub App backend is the
    named upgrade with a trigger.
- **Building the UI on a moving schema.** The config surface is not frozen.
  - Retirement path: ADR-0036's acceptance is the freeze; scope 2 does not start before it.
- **Persona mismatch.** "Marketer" may be a site owner with review, since the config is the egress policy.
  - Retirement path: the scope-2 spec's clarify pass settles the persona before the form is designed.
- **Scope creep into the container translator.** The import side is tempting once a form exists.
  - Retirement path: explicit no-go below; it stays in the inbox until this release ships.

## No-Gos

- This release will not read config from an EDS sheet or any runtime endpoint; config is a committed repo file.
- This release will not require an Adobe IMS identity or ship as an App Builder or unified-shell app; those are later
  wrappers around the same URL.
- This release will not push directly to a site's default branch; every write is a pull request.
- This release will not build a backend service; a GitHub App token exchange is a deferred, triggered upgrade.
- This release will not build the container translator, a marketer-overrides layer, or support non-GitHub hosts.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Per-connector manifest + registry boot + compatibility `eds.js` | ADR-0036 | The composition model everything else depends on; also the parked config-surface freeze |
| Pure generator + `airlockjs init` CLI | ADR-0036, scope 1 | Thinnest demoable path; the 1.0 developer persona's deliverable |
| Static schema-driven builder app with PR write path (fine-grained PAT) | ADR-0037, scope 2 | The user-facing ask |
| Site-side validation Action against the pinned schema | ADR-0037 | The merge gate that makes the PR model honest |
| Upgrade loop + eds-testbed migration | scope 3 | Proves existing adopters are not stranded |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Sidekick / DA / unified-shell embedding | ADR-0037 § Recommended Decision | Distribution wrappers around the same URL; no architecture impact |
| GitHub App token-exchange backend | ADR-0037 § Kill criteria | Triggered by the first adopter blocked by PAT handling |
| Marketer-editable overrides layer | ADR-0037 § Open questions | Depends on the persona decision and a shipped base config |
| Container translator (import side) | [inbox](../inbox.md) 2026-09-07 | Post-1.0 / 1.1 item in its own right |
| Non-GitHub hosts | ADR-0037 § Consequences | No second provider asked for |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Runtime half (scope 1) from UI half (scopes 2 and 3) | ADR-0036 vs ADR-0037 | Scope 1 may land before the v1.0.0 cut; the UI need not |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| R-013 chunked-dist feasibility probe | [R-013](../research/R-013-per-site-chunked-dist-feasibility.md) | Decides the generator's output layout before the scope-1 spec is drafted |

## JIG Handoff

- **Candidate JIG specs or slices:** existing context in [032](../specs/032-instrumentation-config/spec.md) (config
  surface), [031](../specs/031-distribution-setup/spec.md) (dist publishing), [037](../specs/037-one-point-oh-api-pin/spec.md)
  (stable core), [038](../specs/038-parity-harness/spec.md) (the oracle for generated trees).
- **New JIG work to draft:** (1) per-site composition spec (manifest, registry boot, output layout per R-013, generator,
  CLI, compatibility entry); (2) config builder app spec (schema-driven form, GitHub PR write path, PAT handling, hosting);
  (3) site-side validation Action and upgrade loop (may fold into 2).
- **Patch-ready instructions, if any:** none; run R-013 first.
- **Non-mutating notes:** ADR-0036 resolves the "config-surface freeze" follow-on parked under refinement-todo § Spec 032;
  run `adr.py resolve-todo` after acceptance. The 2026-09-07 container-translator inbox entry is the natural import-side
  follow-on and stays parked.

### Architecture appetite

A leanness ceiling jig reads before drafting specs. Appetite / no-gos /
spike pointer only — shaper never names an ADR, module boundary, mechanism,
or design; jig decides those. This is the prospective half; jig's
leanness/YAGNI review lens is the retrospective complement, enforced at jig
review — not here.

- Investment posture (upper bound — "at most", never "at least"): at most one declarative connector description, one
  generator, one static form app, and one CI check; nothing that runs as a service.
- Over-investment no-gos (over-builds to refuse): a plugin or extension system beyond what the connector description
  needs; a bespoke form framework; a persistence layer other than the site repo; multi-provider abstractions before a
  second provider exists.
- Spike (architectural risk to retire early): R-013.

## Release-Check Criteria

- Before this release can ship:
  - A config with no `ga4` entry produces a site tree containing no GA4 bytes; likewise for every other connector type
    (grep-provable over the generated tree, for each golden in `contracts/fixtures/`).
  - The 038 parity harness is green on generated trees for the multi-connector golden.
  - A PR opened from the builder with a fine-grained PAT merges after the validation Action passes, on a repo the maintainer
    does not own.
  - The eds-testbed migrated to the generated entry holds the Lighthouse tight band against the inline-global baseline.
- Evidence to inspect: the generated-tree grep report, the 038 run, the merged PR and its Action log, the `lh:r010`
  before/after.
- Known missing signals: no servo signals were found; release-check criteria remain advisory.
