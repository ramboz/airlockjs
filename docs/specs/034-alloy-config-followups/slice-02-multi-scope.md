---
status: DONE
dependencies: [033-02, 034-01]
last_verified: 2026-09-05
arch_review: true  # extends the interact request shape + the public config placements surface to N scopes.
frame_review: true  # rests on the decisionScopes request-wiring being correct (033-03 deferred it unproven).
---

<!-- jig self-defining vocabulary (soft, forward-only). jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 034-02 — multi-scope personalization: `decisionScopes` + N placements

**Goal:** extend 033-03's **single `__view__` placement** to **N placement scopes**. 033-03 rejected a non-`__view__`
placement at validation because alloy's interact requests only `__view__` by default (`connectors/alloy/connector.js`
`sendEvent` sends no `decisionScopes`), so a declared non-`__view__` scope would silently never populate. This slice
wires `decisionScopes` into the interact (so alloy fetches every declared scope), maps each returned decision to its
placement **host-side** by scope, and opens the schema + `reservePersonalization` to N placements.

**DoR:**
- ✅ 033-03 + 034-01 landed. Multi-scope requests ride 034-01's consent-gated interact.
- ✅ Grounded (read 2026-09-05): the **six single-`__view__` sites** this slice lifts — (1) `connectors/alloy/connector.js`
  `sendEvent({renderDecisions:false, xdm})` (no `decisionScopes`) + `extractDecisions(result,{scope: decisionScope})`
  (single scope, `:171`,`:69`); (2) `adapters/eds/placements.js` `parseViewPlacement` (first `__view__`, `VIEW_SCOPE`
  import); (3) `adapters/eds/reserve-personalization.js` (reserves one `__view__` box → `{reservedPlacements:{scope:promise}}`);
  (4) `adapters/eds/index.js` `validateConnectorEntry` (rejects non-`__view__`); (5) `bootAlloy`'s `deliver` (maps the
  one `__view__` decision); (6) the schema's single-`__view__` `placements`. `extractDecisions(result,{scope:null})`
  already returns every scope present (`connectors/alloy/decisions.js`).

**Design (frame-critique 2026-09-05 — GROUNDED from alloy 2.35.0 source; no probe needed).** `sendEvent` accepts a
top-level `decisionScopes: []` (`createComponent.js:49`) — and/or `personalization.decisionScopes` — both merged +
deduped into the interact query (`createPersonalizationDetails.js:82-113`); `renderDecisions:false` does NOT gate the
fetch (`shouldFetchData()` keys off `hasScopes()`, not `renderDecisions`), so headless multi-scope decisions-as-data is
exactly expressible. Back-compat holds: `PAGE_WIDE_SCOPE === "__view__"`, so today's no-`decisionScopes` default
already fetches `__view__`. **The connector (in-chamber) learns the scopes from its config** — `bootAlloy` derives the
scope set from the boot config's `placements[].scope` and passes a `decisionScopes` config field to
`createAlloyConnector`, whose `sendEvent` requests them; the host-side scope→placement map + the `opts.placements` seam
**already exist** (`wireAlloyDecisions.deliver` at `index.js:853-877`, keyed by scope with drop+diagnose for unmatched;
`bootAlloy` reads `opts.placements`). So the new work is mainly: remove the connector's single-scope filter
(`connector.js:178` `scope:decisionScope` → `scope:null`), open the reserve (N boxes), the schema (`const:"__view__"`
→ any), and the runtime validation.

**Live-Alloy caveat (the analogue of 034-01's `defaultPersonalizationEnabled`).** On a cache-uninitialized event,
real alloy's `shouldRequestDefaultPersonalization()` auto-adds `__view__` to the query EVEN when only named scopes are
configured (`createPersonalizationDetails.js:130-136`) → an extra `__view__` proposition. This is a **benign
drop+diagnose** (unmatched scope → no fill, no spurious exposure, since `report()` is post-fill) — but to avoid it,
`sendEvent` sets `personalization:{ defaultPersonalizationEnabled:false }` when **no `__view__` placement** is
configured. Not observable in the rig (the injected `config.alloy` bypasses this real-alloy path), so it is documented
as a **live-Alloy caveat**.

**Acceptance Criteria (provisional — ratified/refined at this slice's frame-critique):**

1. **`decisionScopes` on the interact (REQUEST grounded; per-scope RESPONSE rig-proven + live-deferred).** `bootAlloy`
   derives the scope set from the config's `placements[].scope` and passes it to `createAlloyConnector`; the connector's
   `sendEvent` carries **all** configured scopes (source-grounded that the request carries them). Whether the Edge
   returns a proposition *per* scope is server/Target behavior — **rig-proven** (a stub returning per-scope
   propositions) + **live-Alloy deferred** (creds-gated, 013 pattern), NOT client-groundable. The connector delivers
   **all** returned scopes (`extractDecisions(result,{scope:null})`), not a single filtered scope. **Absent placements
   → `__view__` default, byte-unchanged** (033-03); NOTE the EXISTING single-`__view__` configured case now sends an
   explicit `decisionScopes:["__view__"]` (vs today's none) — any 033-03 test asserting the exact `sendEvent` options
   is updated. When no `__view__` placement is configured, set `defaultPersonalizationEnabled:false` (the live-Alloy
   caveat above).
2. **Host-side scope→placement map.** The adapter delivers **all scopes** (`extractDecisions(result,{scope:null})`)
   and fills each decision's placement by matching `scope` → the reserved box (per 033-03's recorded design). A scope
   with no configured placement, or a placement with no returned decision, is dropped/revealed benignly (033-03 rules).
3. **Schema opens to N placements + duplicate-scope rejection.** `contracts/instrumentation-config.schema.json` allows
   multiple `placements` entries with arbitrary (non-`__view__`) scopes; the 033-03 single-`__view__` restriction +
   non-`__view__` rejection is lifted (+ golden fixture with 2 scopes; a negative fixture). `minHeight`/selector
   validation (034/033) still applies per placement. **Duplicate scopes are REJECTED at validation** (both the reserved
   map at `reserve-personalization.js` and the deliver map at `index.js:857` are keyed by `scope`, so two placements
   sharing a scope would silently collapse last-wins) — a duplicate is diagnosed, not silently dropped.
4. **Eager reserve of N boxes.** `reservePersonalization` reserves each configured placement box (pre-paint) + hands
   off the N handles; the lazy fill maps by scope. The no-flicker invariant (reserve<appear) holds for every box.
5. **End-to-end proof.** A config with 2 placements (`__view__` + a named scope) → both scopes fetched (one interact
   with `decisionScopes`) → both boxes filled by scope → both exposures reported. Reuse/extend the 033-03 rig.

**DoD:** all ACs pass; TDD red→green; reviewed (compliance + craft + **arch** + **frame-critique**); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` multi-scope follow-on **closed**; board synced.

## Close-out

Implemented red→green; compliance + craft + arch reviews PASSED (no blockers — doc/leanness nits, addressed below);
frame-critique was done at authoring (`frame_review: true`). The three close-out doc fixes (stale `wireAlloyDecisions`
docstring, the duplicate-scope fixture/label note, this close-out) carry NO code-logic change — `npm test` / `node
contracts/validate.mjs` / `npm run lint` stayed green.

### Deviation log

1. **`decisionScopes` derivation unions `Object.keys(reserved)` beyond `placements[].scope`.** AC1 said "derives the scope
   set from the config's `placements[].scope`". `deriveDecisionScopes` (`adapters/eds/index.js`) additionally unions the
   handed-off reserved-map keys as a FALLBACK, so a standalone `bootAlloy` given only `reservedPlacements` (no
   `placements`) still requests those scopes. Placements drive when present (order-preserving, deduped); additive
   robustness, no behavior change for the config-boot path. Reviewed — accepted.
2. **Schema duplicate-scope check is COARSE; the runtime validator is the load-bearing guard.** Standard JSON Schema
   (draft 2020-12) cannot express "unique by the `scope` sub-property", so the schema uses `uniqueItems: true` (catches
   byte-identical entries only) and the negative fixture is two identical placements. The real guard — rejecting two
   placements sharing a `scope` even with DIFFERENT selectors (the scope-keyed reserve/deliver maps would otherwise
   collapse last-wins) — is the RUNTIME `validateConnectorEntry` via `firstDuplicateScope` (`adapters/eds/placements.js`),
   unit-tested in `test/eds-boot-alloy.test.js`. Noted in `contracts/validate.mjs`'s label + the schema description.
3. **`parseViewPlacement` → `parsePlacements` (rename + generalize, not additive).** The single-`__view__` parser was
   replaced by an N-placement/any-scope parser; the one importer (`reserve-personalization.js`) + its test were updated.
   No dual-API left behind (dead code avoided). The `probes/eds-testbed/scripts/airlock/` copy still carries the old name
   — a testbed deployment artifact, out of scope, not imported by the shipped tree (see note b).

**Review-noted follow-ons / notes (NOT fixed this slice — no blocker):**

- (a) **`config.personalization` sub-keys other than `decisionScopes` are silently inert.** The connector merges
  `personalization.decisionScopes` (faithful to alloy's own sendEvent merge) but ignores any other `personalization.*`
  sub-key. This is unreachable via `bootAlloy` (which only ever passes `decisionScopes`) and `personalization` is not an
  `alloyConnector` schema field — so no adopter config can set it. A leanness note, not a gap. Trigger: a future need to
  pass richer `personalization` options through the connector.
- (b) **Pre-034 built copies of the connector exist on disk — the rebuild-on-demand class, PRE-EXISTING, NOT a 034-02
  regression.** `rig/out/*.worker.built.js` (alloy-csp / alloy-core-host / alloy-decisions) are **git-ignored** and
  rebuilt fresh on each rig run (my `rig:alloy-multiscope` + `rig:alloy-decisions` runs rebuilt theirs from source).
  `probes/alloy-csp-spike/out/alloy-chamber.worker.built.js` is **tracked** and still carries the pre-034 connector
  (`decisionScope = VIEW_SCOPE`) — a 033-01 CSP probe spike build, not part of the shipped runtime or any active rig, not
  rebuilt by any slice since. The `probes/eds-testbed/scripts/airlock/` copies are untracked testbed deployment copies.
  None are load-bearing; all regenerate from source. Flagged for MVP6's spec-036 real-site/testbed validation harness: a
  fresh `node build.mjs` (+ rig rebuilds) must precede any validation so stale pre-034 bytes are never exercised.

### Reconciliation sweep

| Path | Change | AC / rationale |
|---|---|---|
| `connectors/alloy/connector.js` | mod | AC1 — `decisionScopes` config field, `mergeDecisionScopes`, sendEvent carries scopes + `defaultPersonalizationEnabled:false` when no `__view__`, deliver `scope:null` |
| `adapters/eds/placements.js` | mod | AC3/AC4 — `parseViewPlacement`→`parsePlacements` (N/any scope), `firstDuplicateScope` |
| `adapters/eds/reserve-personalization.js` | mod | AC4 — reserve one box per scope; duplicate→reserve-nothing (defers to loud boot reject) |
| `adapters/eds/index.js` | mod | AC1/AC2/AC3 — `deriveDecisionScopes`, config threading, `validateConnectorEntry` any-scope + duplicate reject, `wireAlloyDecisions` docstring fix |
| `contracts/instrumentation-config.schema.json` | mod | AC3 — scope `type:string minLength:1` (lifted `const:__view__`), `uniqueItems:true`, descriptions |
| `contracts/validate.mjs` | mod | AC3 — wire multiscope golden (pass) + duplicate-scope negative (fail); coarse-vs-runtime note |
| `contracts/fixtures/instrumentation-config-alloy-multiscope.golden.json` | new | AC3 — golden, 2 scopes (`__view__` + `products`) |
| `contracts/fixtures/instrumentation-config-alloy-duplicate-scope.negative.json` | new | AC3 — negative, byte-identical duplicate (schema `uniqueItems`) |
| `contracts/fixtures/instrumentation-config-alloy-nonview-scope.negative.json` | deleted | AC3 — scenario now VALID (non-`__view__` accepted) |
| `test/alloy-connector.test.js` | mod | AC1 — decisionScopes carried/deduped/merged, absent byte-unchanged, `defaultPersonalizationEnabled` |
| `test/alloy-decisions.test.js` | mod | AC1/AC2 — `extractDecisions({scope:null})` returns every scope |
| `test/reserve-personalization.test.js` | mod | AC4 — `parsePlacements`/`firstDuplicateScope`, N-box reserve, per-scope drop, duplicate→nothing |
| `test/eds-boot-alloy.test.js` | mod | AC1/AC3/AC5 — accepts N/non-`__view__`, derives scopes, rejects duplicate, multi-scope E2E (2 boxes + 2 exposures) |
| `rig/alloy-mint-stub.js` | mod | AC5 — additive `mintMultiScopeDecisionsResponse` (per-scope propositions) |
| `rig/alloy-multiscope.mjs` | new | AC1/AC5 — real-alloy browser rig: REQUEST carries both scopes; per-scope fill + exposure (stub RESPONSE) |
| `rig/alloy-multiscope-harness.html` | new | AC5 — the rig's page harness (reserve 2 boxes → fill by scope → exposures) |
| `package.json` | mod | AC5 — `rig:alloy-multiscope` script |
| `docs/refinement-todo.md` | mod | close-out — multi-scope follow-on marked RESOLVED (residual: live per-scope RESPONSE) |
| `docs/specs/034-alloy-config-followups/slice-02-multi-scope.md` | mod | close-out — this section |

No new inbox items. No `docs/conventions.md` / `docs/memory/` changes.

### Definition of Done — verification

| DoD item | Status |
|---|---|
| All ACs pass (AC1–AC5) | ✅ proving tests + rigs green (see sweep) |
| TDD red→green | ✅ 23 tests failed pre-impl, all green post-impl |
| Reviewed: compliance + craft + arch | ✅ PASSED (coordinator) |
| Reviewed: frame-critique | ✅ at authoring (`frame_review: true`) |
| Deviation log + reconciliation sweep | ✅ above |
| `docs/refinement-todo.md` multi-scope follow-on closed | ✅ RESOLVED (residual recorded) |
| Reconciliation review | ⏳ downstream (the gated RECONCILED transition) |
| Board synced | ⏳ downstream reconciliation (not in this close-out's scope) |

**Gate re-run (post close-out):** `npm test` 81 files / 1139 passed; `node contracts/validate.mjs` all pass; `npm run
lint` clean; `node build.mjs` exit 0; `rig:alloy-multiscope` PASS; `rig:alloy-decisions` (033-03) PASS. Per-scope Edge
RESPONSE is **rig-stub-proven** + REAL-alloy REQUEST rig-proven (alloy@2.35.0); **live per-scope RESPONSE NOT claimed**
(creds-gated residual, 013 pattern).
