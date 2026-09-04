---
status: RECONCILED
dependencies: [032-01]
last_verified: 2026-09-04
arch_review: true  # the config JSON Schema is a public external-interface contract artifact.
frame_review: true  # alloy config-wiring is a decided deferral (its own spec); the 032-01 config shape is pinnable pre-1.0.
claimed_by: claude/mvp6-e4550f
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story

**Goal:** pin the project instrumentation config as a **validated, documented contract** — a JSON Schema (ajv, like
airlock's other pinned contracts) for the **currently-adapter-supported** connectors (GA4, the three pixel vendors,
helix-rum), with `boot(config)` doing a **lightweight runtime validation** (loud, actionable errors) that does NOT
pull ajv into the shipped bundle; and document the **"instrument airlock in a few lines + a JSON config"** story.
The schema is pinned **PRE-1.0 — explicitly NOT frozen** (the later 1.0 API pin owns that, after the real-site
validation exercises the shape).

**alloy is explicitly DEFERRED to its own spec (frame-critique correction).** alloy has **no adapter boot** today —
it is hosted only via `core/wrapped-sdk-host.js` + `connectors/alloy/*` (async stock-SDK load, `createConnectorHost`,
`alloy-chamber.worker.js`, a **different handle shape** — `handle` returns `[]`), exercised only in `rig/`/`test/`.
Wiring `{type:"alloy"}` into `boot(config)` is therefore alloy's **first-ever adapter boot — a spike-sized build**,
not a `bootConnector` switch-case, and out of scope for a config-contract slice (the parent spec's "Not a Spike"
reasoning scoped 032 to the `createAirlock`-shaped connectors). So this slice **honestly states the coverage gap**:
the shipped config contract covers GA4 + pixels + helix-rum but **NOT Adobe/alloy** — i.e. it does not yet cover
MVP6's full "GA4 + Adobe/alloy" supported subset. The alloy-config-wiring spec is recorded in
`docs/refinement-todo.md` with a resolution trigger.

**DoR:**
- ✅ 032-01 DONE — `boot(config)` + the project config shape (connectors + consent + governance) exist and boot the
  supported connectors.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The 032-01 config shape is stable enough to pin a PRE-1.0 schema.** Pinning documents + validates the current
  shape; it is explicitly iterable (the 1.0 pin freezes it). Grounded (032-01 DONE); the schema follows the shape,
  not vice versa. The shape is a **discriminated union** — `type` ∈ {`ga4`,`pixel`,`helix-rum`}, with a nested
  `vendor` ∈ {`meta`,`linkedin`,`bing`} under `pixel`, plus helix-rum's governance exemption (grounded:
  `adapters/eds/index.js` `bootConnector` ~874-897). Describable in standard JSON Schema (`oneOf`/`if-then`) — a
  non-trivial union, NOT the deferred event-routing work.
- **alloy config-wiring is DEFERRED to its own spec — decided, not open (frame-critique correction).** alloy has
  **no adapter boot**: it is hosted only via `core/wrapped-sdk-host.js` + `connectors/alloy/*` (async stock-SDK
  load, `createConnectorHost`, `alloy-chamber.worker.js`, `handle` returns `[]` — a different shape than the
  `createAirlock` connectors the composite fans to), exercised only in `rig/`/`test/` (grounded:
  `connectors/alloy/connector.js`; no `bootAlloy` in `adapters/`). Wiring `{type:"alloy"}` is alloy's **first-ever
  adapter boot — spike-sized**, out of scope here (the parent spec's "Not a Spike" scoped 032 to the
  `createAirlock`-shaped connectors). So this slice ships the contract for GA4+pixels+helix-rum and **states the gap
  plainly**: the config contract does **NOT** yet cover Adobe/alloy — half of MVP6's named "GA4 + Adobe/alloy"
  supported subset. Recorded in `docs/refinement-todo.md` with a resolution trigger (AC3).
- **Runtime validation must NOT pull ajv into the shipped bundle.** ajv is a `contracts/` **dev-dependency**
  (grounded: `contracts/package.json`), used by `npm run validate` on the schemas — it is not a runtime dep of the
  emitted `dist/`. So `boot(config)`'s runtime validation is a **lightweight hand-rolled check** (a documented
  subset of the schema), not an ajv call; the JSON Schema is the pinned *reference*, validated in the contracts
  harness (AC1/AC2).
- airlock's contracts are JSON Schema + ajv (`contracts/`, `npm run validate`) — **grounded**
  ([`contracts/README.md`](../../../contracts/README.md); the five pinned surfaces + `validate.mjs`).

**Acceptance Criteria:**

1. **A pinned (pre-1.0) config JSON Schema.** A JSON Schema for the project config
   (e.g. `contracts/instrumentation-config.schema.json`) describes `{ connectors: [...], consent?, consentStrict?,
   payloadDenylist? }` as the **discriminated union** it is (`type` → `ga4`/`pixel`/`helix-rum`; nested `vendor`
   under `pixel`; helix-rum's governance-free shape), via `oneOf`/`if-then`, validated by `npm run validate` (ajv,
   the contracts dev harness) with golden + negative fixtures — added alongside airlock's existing contracts. It
   carries an explicit **PRE-1.0 / not-frozen** caveat (mirroring the other contracts' status notes). Observable:
   `npm run validate` passes the golden config (one entry per supported connector) and fails a malformed one; the
   schema is listed in `contracts/README.md` with the pre-1.0 caveat.
2. **`boot(config)` validates the config at runtime, loud + actionable, WITHOUT ajv in the bundle.** A malformed
   config (unknown connector type/vendor, missing required id, wrong-typed field) is rejected with a clear error
   naming the offending field/connector — never a silent no-op or cryptic downstream throw. The check is a
   **lightweight hand-rolled validator** (extending 032-01's existing loud-throw dispatch), a documented **subset**
   of the JSON Schema — the schema stays the pinned *reference* (ajv validates it in `contracts/`, dev-only).
   Observable: `boot(<malformed>)` rejects naming the problem; a valid config boots; and **no `ajv` import reaches
   the emitted `dist/`** (a build/import assertion, so runtime validation can't smuggle the dev dep into the bundle).
3. **Breadth over the adapter-supported set + alloy's deferral recorded.** The config + schema express and boot the
   **currently-adapter-supported** connectors — `ga4`, the three `pixel` vendors, `helix-rum` — each with a golden
   fixture that validates + boots. **alloy is explicitly deferred to its own spec** (its first adapter boot is
   spike-sized — see Assumptions/Goal); this slice does NOT add a `{type:"alloy"}` entry. The deferral is recorded
   in `docs/refinement-todo.md` with a resolution trigger, and the slice/README **state plainly** that the config
   contract does not yet cover Adobe/alloy (so MVP6's "GA4 + Adobe/alloy" supported subset is only partially
   covered by the config surface until the alloy-config spec lands). Observable: a golden multi-connector config
   (ga4 + a pixel + helix-rum) validates + boots; the alloy-deferral + coverage-gap statement exist in
   refinement-todo + the README/schema.
4. **The documented "instrument in a few lines + a JSON config" story.** `README.md` (a "Configure airlock" section)
   shows the whole instrument-a-site flow: the JSON config + the two boot lines (`import { boot }` +
   `await boot(config)`), pointing at the schema as the reference, stating the pre-1.0 caveat AND the alloy coverage
   gap. Observable: the README section exists, its config example validates against the schema (no drift), and its
   boot snippet matches `boot(config)`'s actual signature.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). _(targeted files — the bare `vitest run` hangs on a
      stale nested worktree; all adapter/contracts/build tests green; the unrelated `dom-chamber-host-prism`
      failure is pre-existing.)_
- [x] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [x] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC1's negative
      fixture and AC2's malformed-config rejection.
- [x] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading. _(the `pending` rows — status board, primer — are
      close-out actions.)_
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated — the alloy config-wiring deferral (+ trigger + coverage gap) was added THIS slice (032-02), satisfying AC3's "recorded" requirement.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene (spec 025-01): this slice closes spec 032 — compress the Active-specs entry, migrate the
      config-surface invariant to the status-board Notes column, and ensure `contracts/README.md` + `README.md`
      document the config surface + its pre-1.0 status.

**Anti-horizontal-phasing check:** after this slice lands, a developer has a validated, documented JSON config
contract (with loud errors on mistakes) and a copy-pasteable few-lines-instrument story covering every supported
connector — the adoption ergonomic is real and self-serve, not intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

**Implementation summary:**
- **AC1 — schema + validation wiring.** `contracts/instrumentation-config.schema.json` (JSON Schema 2020-12) models
  the config as a discriminated union: top-level `oneOf` on connector `type` (ga4/pixel/helix-rum), a nested `oneOf`
  on pixel `vendor` (meta/linkedin/bing) each requiring its vendor id, and helix-rum's governance-free shape. Wired
  into `contracts/validate.mjs` (ajv dev harness, `npm run validate`) with 6 golden fixtures (one per connector + a
  breadth multi) and 4 negative fixtures (unknown type, unknown vendor, missing id, wrong-typed field). A row + a new
  "Pre-1.0 contracts (not frozen)" section were added to `contracts/README.md`.
- **AC2 — runtime validation, no ajv in the bundle.** `boot(config)` gained a hand-rolled `validateConfig`
  (top-level shape) + `validateConnectorEntry` (per-connector, index-scoped errors) — a documented **subset** of the
  schema, no ajv. A `build.mjs` assertion rejects any `ajv` reference in the emitted eds.js/worker chunks.
- **AC3 — breadth + alloy deferral.** The golden multi-connector config (ga4 + pixel + helix-rum) validates AND
  boots; no `{type:"alloy"}` path added. The alloy deferral + coverage gap were **recorded THIS slice (032-02)** in
  `docs/refinement-todo.md` (§ "alloy config-wiring", with a resolution trigger — added during 032-02's framing;
  032-01 only added the section's other three deferrals); the coverage gap is also stated in the schema
  `description`, `contracts/README.md`, and the root `README.md`.
- **AC4 — the "Configure airlock" story.** Root `README.md` § "Configure airlock": a schema-valid JSON config + the
  two boot lines (`import { boot }` + `await boot(config)`), pointing at the schema, with the pre-1.0 caveat + the
  alloy gap. A test asserts the README config validates against the schema (no drift) and the snippet matches
  `boot(config)`'s signature.

**Deviations / decisions:**
- **Validation placement — inline per-connector, not fully upfront.** Top-level governance is validated upfront;
  each connector is validated inside `bootConnector` (before its boot), preserving 032-01's partial-boot-cleanup
  invariant (a bad LATER connector disposes earlier-booted ones; the 032-01 "unknown type → GA4 booted-then-disposed"
  test stays green). A fully-upfront validation would have regressed that test.
- **Schema requires `connectors`; runtime tolerates its absence** — `boot()`/`boot({})` stay no-op for back-compat
  (a documented subset relaxation).
- **Pixel id required in the config path only** — the config contract requires the vendor id
  (pixelId/partnerId/tagId); the standalone `bootMetaPixel`/etc. keep their synthetic-placeholder defaults
  (rig/test back-compat, unchanged).
- **Not added as a 6th frozen contract surface** — per the pre-1.0 framing, `architecture.md` § Contract surfaces
  (the five frozen surfaces) is left unchanged; the schema is documented as a separate PRE-1.0 surface in
  `contracts/README.md`. (Flagged for the arch pass.)
- **alloy deferral recorded THIS slice (reconciliation-review correction).** The "### Decision: alloy config-wiring
  — DEFERRED" entry (+ resolution trigger + MVP6 coverage-gap consequence) was added to `docs/refinement-todo.md`
  during 032-02's framing (the frame-critique reframed alloy from a false wire-XOR-defer binary to a decided
  deferral). 032-01 had added the "Spec 032 follow-ups" *section* with its other three deferrals; the alloy entry is
  032-02's. AC3's "recorded" requirement is satisfied by this slice's entry (an earlier draft of this log misattributed
  it to 032-01 — corrected).

**Plan adherence:** all 4 ACs implemented as specified. TDD red witnessed before green — 13 failing tests for AC2/AC4
before implementation; AC1's negative fixture shown to bite by relaxing the schema; the no-ajv assertion shown to
fire by temporarily bundling ajv.

**Test-run note:** ran targeted files (the bare `npx vitest run` hangs on a stale nested worktree's oracle tests —
pre-existing, per project memory). All adapter-touching + contracts + build tests are green; the pre-existing
`dom-chamber-host-prism` prism-load failure is unrelated and untouched.

**Reviewer findings folded in (post-review).** Four passes recorded under `reviews/` — frame-critique (needs-changes
→ the alloy false-binary reframed to a decided deferral + coverage-gap statement + the ajv-not-in-bundle + the
discriminated-union scoping → pass); compliance (pass; re-verified validate + 19 tests + build + regression;
non-vacuity confirmed by relaxing the schema); arch (pass); craft (pass, after a first dispatch misfired with
tooling commentary + 0 tool-uses and was cleanly re-run). No blockers from any pass.
- **Arch [nit] FIXED — architecture.md discoverability.** `docs/architecture.md` § "Contract surfaces" now carries a
  one-line pointer to this PRE-1.0 config surface (explicitly *not* among the frozen five, its break-attribution
  differs), so a `/jig:contracts` scan sees the authoring boundary. The decision NOT to freeze it stands.
- **Optional nits logged (not fixed — non-blocking, pre-1.0):** (craft) the hand-rolled helix-rum `weight`
  type-check has no witnessed negative test/fixture (the schema catches it; `consentStrict` covers the top-level
  wrong-type case) — an extra untested branch, not an AC gap; the no-ajv guard is a `/ajv/i` substring heuristic
  (a `metafile.inputs` check would be more precise; defensible + double-covered); the alloy-absence test asserts
  fixture content vs code behavior (a drift guard); `oneOf`-on-`type` yields noisy ajv errors (harness only checks
  binary accept/reject; `if/then` would give better author-facing diagnostics if ever surfaced). (arch) an optional
  runtime-accept-set ⊆ schema-accept-set invariant test. All acceptable pre-1.0; candidates for the 1.0-pin pass.
- **Compliance no-action notes:** the AC3 boot test injects non-schema DI fields (`forceSelect`, web-vitals stubs,
  `ctx`) — legitimate headless seaming; the pristine golden is schema-validated separately, and the runtime
  validator is a lenient subset (no `additionalProperties:false`), so it accepts them by design.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | Added § "Configure airlock" — the JSON config + two boot lines (`import { boot }` / `await boot(config)`), the schema reference, the pre-1.0 caveat + alloy coverage gap (AC4). |
| `contracts/instrumentation-config.schema.json` | `added` | The pinned PRE-1.0 config JSON Schema — discriminated union (AC1). |
| `contracts/fixtures/instrumentation-config-*.{golden,negative}.json` | `added` | 6 golden (one per connector + breadth multi) + 4 negative fixtures (AC1/AC3). |
| `contracts/validate.mjs` | `updated` | Compiles the new schema + runs the golden/negative fixtures in `npm run validate` (AC1). |
| `contracts/README.md` | `updated` | New "Pre-1.0 contracts (not frozen)" section: the surface row, PRE-1.0 caveat, coverage gap (AC1/AC3). |
| `adapters/eds/index.js` | `updated` | `boot(config)` runtime validation (`validateConfig` + `validateConnectorEntry`, a hand-rolled subset) — AC2. |
| `build.mjs` | `updated` | Assertion: no `ajv` reference in any emitted chunk (AC2 — dev-dep must not ship). |
| `test/instrumentation-config-contract.test.js` | `added` | AC2 (rejection + no-ajv-in-dist), AC3 (breadth boot), AC4 (README-validates + signature). |
| `docs/refinement-todo.md` | `updated` | Added the "### Decision: alloy config-wiring — DEFERRED" entry (+ resolution trigger + MVP6 coverage-gap consequence) to the "Spec 032 follow-ups" section (032-01 had added that section's *other* three deferrals; the alloy entry is THIS slice's). Directly satisfies AC3's "recorded" requirement. |
| `docs/architecture.md` | `updated` | Per the arch-pass nit: § "Contract surfaces" now carries a one-line pointer to this PRE-1.0 config surface (explicitly NOT among the frozen five), so a `/jig:contracts` scan sees the authoring boundary. The decision not to freeze it stands. |
| `docs/specs/032-instrumentation-config/spec.md` | `updated` | The 032-02 framing edits: the alloy assumption reframed to a decided deferral + the Decomposition's deferred-list entry (status IN_PROGRESS→DONE rollup is the transition helper's, not a hand edit). |
| `docs/specs/README.md` | `pending` | Regenerated by `workflow.py status-board` at close-out (not the implementer's step). |
| `docs/product-vision.md` | `no-op` | No scope drift (authoring-surface story unchanged). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `pending` | Primer hygiene / spec-close compression at close-out. |
| `docs/inbox.md` | `no-op` | Nothing parked. |
| `docs/memory/**` | `no-op` | memory-sync is its own skill's job (not the implementer's). |
| `docs/decisions/README.md` / ADR index | `no-op` | Pinning a PRE-1.0 (explicitly not-frozen) contract did not warrant an ADR; the 1.0 pin will own the freeze decision. |
