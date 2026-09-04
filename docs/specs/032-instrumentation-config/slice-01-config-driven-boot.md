---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # introduces a new PUBLIC authoring surface (`boot(config)` + the project config shape).
frame_review: true  # core bet: one config can express heterogeneous connectors without losing GA4's rich wiring.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication

**Goal:** a single exported **`boot(config)`** takes a project JSON config declaring **which connectors + their
ids/endpoints + consent + payload governance**, and boots each declared connector — collapsing the three
near-identical pixel-vendor boot functions into one config-driven dispatch, threading top-level
consent/governance to every connector, and keeping the existing per-connector boots working (back-compat). The
"few lines + a rich JSON config" authoring ergonomic, pre-1.0.

**DoR:**
- ✅ The 5 boot functions + their `createAirlock` dispatch shapes are understood
  ([`adapters/eds/index.js`](../../../adapters/eds/index.js), read this session).
- ✅ The pixel-vendor config factories (`createMetaPixelConfig` etc.) + `*_EGRESS_PURPOSES` are the seed of a
  config-driven model (same file / `connectors/pixel/vendors/`).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The core, load-bearing bet this slice proves:** a JSON config entry can express each connector's setup, and
  `boot(config)` can dispatch it, **without losing GA4's richer wiring** — the ga4 entry must still reach the
  host-side `_ga` cookie sourcing, the pre-`createAirlock` consent fold, and the UC-2/UC-3 capture listeners
  (`wireInteractions`/`wireExposure`/`wireBlocks`). The honest design: the config **selects + parameterizes**
  connectors (the config carries ids/endpoints/consent/governance), while GA4's built-in capture stays built-in;
  the config does not re-express capture. Grounded that the *pixel* entries are pure parameterization (they already
  are — `createXxxConfig` + `createAirlock`); UNPROVEN that the *ga4* entry stays byte-equivalent to
  `bootEdsAnalytics` when driven from config — AC1/AC4 are its proof.
- **Back-compat is a property of reuse, not reimplementation:** the config path should route through the SAME
  per-connector logic the existing boots use (extract shared helpers; do not fork the logic), so the existing
  functions + the config path cannot drift. Assumption until AC3/AC4 witness identical wiring.

**Acceptance Criteria:**

1. **A config-driven `boot(config)` entry.** A new exported `boot(config)` accepts a project config of shape
   `{ connectors: [ {type, …}, … ], consent?, consentStrict?, payloadDenylist? }` and boots each declared
   connector, returning a per-connector (or composite) handle over the same public write surface
   (`push`/`getState`/`setConsent`/`dispose`/…). Observable: `boot({ connectors: [{ type: "ga4", … }] })` boots GA4
   equivalently to `bootEdsAnalytics()` — `window.airlock` set, the UC-2 interaction path wired, a beacon fires.
2. **The pixel-vendor boot duplication is collapsed into config dispatch.** A config entry
   `{ type: "pixel", vendor: "meta"|"linkedin"|"bing", …ids, endpoint? }` dispatches to the right vendor config
   factory + `createAirlock({ connector: "pixel", … })` + the vendor's egress purposes — replacing the three
   near-identical `bootMetaPixel`/`bootLinkedInInsight`/`bootBingUet` bodies with ONE parameterized path (a
   vendor registry / table, not three copies). The three functions are kept but now **delegate** to it (or are thin
   wrappers). Observable: a `boot({connectors:[{type:"pixel",vendor:"meta",pixelId:X}]})` produces the SAME
   `createAirlock` inputs (connector `"pixel"`, the Meta connector config, `META_EGRESS_PURPOSES` under the
   `consent ? … : []` gate) that `bootMetaPixel({pixelId:X})` produces — asserted equal, all three vendors.
3. **Top-level consent + payload governance thread to every connector.** The config's `consent`/`consentStrict`/
   `payloadDenylist` are applied to each connector's `createAirlock` with the SAME gating the per-function `opts`
   use today (e.g. `egressPurposes` gated on `consent` being present; the GA4 storage-consent fold preserved).
   Observable: a config with a consent vector yields per-connector `egressPurposes`/gating byte-identical to
   passing the same vector to the per-function boots; an absent vector keeps the legacy always-dispatch behavior.
4. **End-to-end + back-compat.** A test/rig boots a **multi-connector** config (e.g. GA4 + a pixel) via
   `boot(config)` and asserts each declared connector boots and its beacon path fires; and the existing per-function
   boots + the full suite stay green (the testbed/rigs are unaffected). Observable: the config-driven multi-connector
   boot test passes; `npm test` + the existing rigs stay green (no regression).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions — modulo any pre-existing, out-of-scope failure).
- [ ] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [ ] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC2's "same inputs as
      the per-vendor boot" equivalence and AC3's consent-gating parity.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred during implementation.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene (spec 025-01): if this slice closes the spec, compress the Active-specs entry; note the new
      `boot(config)` authoring surface where instrumentation is documented.

**Anti-horizontal-phasing check:** after this slice lands, a developer can boot airlock's supported connectors from
a single JSON config object (a few lines) and see the declared connectors' beacons fire — the config-driven
authoring ergonomic, end-to-end, not intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

_TODO (implementer): the shared-helper extraction shape; whether the old boot functions delegate or stay wrappers;
GA4-from-config equivalence findings; reviewer findings folded in; deviations; plan adherence._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | _TODO: the documented config story lands in 032-02; note here if any snippet was touched._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/product-vision.md` | `no-op` | _TODO: checked — config surface serves UC-2 (analytics instrumentation), no new UC._ |
| `docs/architecture.md` | `no-op` | _TODO: check for public-surface drift; update if `boot(config)` is architecture-worthy (arch pass)._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: primer hygiene checked._ |
| `docs/inbox.md` | `no-op` | _TODO._ |
| `docs/refinement-todo.md` | `no-op` | _TODO: note the deferred declarative-capture + the alloy-in-config question if surfaced._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: note if the config-surface decision warranted an ADR._ |
| `adapters/eds/index.js` / new config module | `updated` | _TODO: the `boot(config)` dispatcher + the collapsed pixel path + shared helpers._ |
