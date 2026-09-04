---
status: DRAFT
dependencies: [032-01]
last_verified:
arch_review: true  # the config JSON Schema is a public external-interface contract artifact.
frame_review: true  # bet: the 032-01 config shape is stable enough to pin (pre-1.0), and alloy fits-or-defers cleanly.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story

**Goal:** pin the project instrumentation config as a **validated, documented contract** — a JSON Schema (ajv, like
airlock's other pinned contracts) that `boot(config)` validates against with loud, actionable errors; confirm the
config covers the full supported connector set (and resolve alloy's status); and document the **"instrument airlock
in a few lines + a JSON config"** story. The schema is pinned **PRE-1.0 — explicitly NOT frozen** (the later 1.0
API pin owns that, after the real-site validation exercises the shape).

**DoR:**
- ✅ 032-01 DONE — `boot(config)` + the project config shape (connectors + consent + governance) exist and boot the
  supported connectors.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The 032-01 config shape is stable enough to pin a PRE-1.0 schema.** Pinning documents + validates the current
  shape; it is explicitly iterable (the 1.0 pin freezes it). Grounded once 032-01 lands; the schema follows the
  shape, not vice versa.
- **alloy (the wrapped-SDK connector) boots via a different core path than the adapter boot functions** (specs
  012/014 — no `adapters/eds/` `bootAlloy`). Whether it is expressible in the same config shape is the open
  question this slice resolves: either add a `{type:"alloy", …}` entry that dispatches to alloy's host path, OR
  document it as a **stated deferral** (with the reason) so the schema's connector set is honest about coverage.
  Marked, not assumed — AC3 decides.
- airlock's contracts are JSON Schema + ajv (`contracts/`, `npm run validate`) — **grounded**
  ([`contracts/README.md`](../../../contracts/README.md); the five pinned surfaces + `validate.mjs`).

**Acceptance Criteria:**

1. **A pinned (pre-1.0) config JSON Schema.** A JSON Schema for the project config
   (e.g. `contracts/instrumentation-config.schema.json`) describes `{ connectors: [...], consent?, consentStrict?,
   payloadDenylist? }` and the per-connector entry shapes, validated by `npm run validate` (ajv) with golden +
   negative fixtures — added alongside airlock's existing contracts. It carries an explicit **PRE-1.0 / not-frozen**
   caveat (mirroring the other contracts' status notes). Observable: `npm run validate` passes the golden config
   and fails a malformed one; the schema is listed in `contracts/README.md` with the pre-1.0 caveat.
2. **`boot(config)` validates the config, failing loud + actionable.** A malformed config (unknown connector type,
   missing required id, wrong-typed field) is rejected with a clear, actionable error naming the offending
   field/connector — never a silent no-op or a cryptic downstream throw. Observable: `boot(<malformed>)` throws (or
   returns a rejected result) with a message naming the problem; a valid config boots.
3. **Breadth + the alloy decision.** The config expresses the full adapter-supported connector set — `ga4`, the
   three `pixel` vendors, and `helix-rum` — each with a golden fixture. **alloy is resolved**: either a
   `{type:"alloy", …}` entry that dispatches to its host path (with a golden fixture), OR a documented deferral in
   the schema + `docs/refinement-todo.md` stating why (its boot path differs) and its resolution trigger.
   Observable: a golden config exercising every supported connector validates + (for the wired ones) boots; alloy's
   status is explicit in the schema/docs.
4. **The documented "instrument in a few lines + a JSON config" story.** `README.md` (a "Configure airlock" section)
   shows the whole instrument-a-site flow: the JSON config + the two boot lines (`import { boot }` +
   `await boot(config)`), pointing at the schema as the reference, and stating the pre-1.0 caveat. Observable: the
   README section exists, its config example validates against the schema (no drift), and its boot snippet matches
   `boot(config)`'s actual signature.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [ ] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC1's negative
      fixture and AC2's malformed-config rejection.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred during implementation (e.g. an alloy deferral).

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

_TODO (implementer): the schema artifact choice + validation wiring; the alloy decision (wired vs deferred + why);
reviewer findings folded in; deviations; plan adherence._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | _TODO: the "Configure airlock" few-lines + JSON config story (AC4)._ |
| `contracts/` (+ `contracts/README.md`) | `updated` | _TODO: the pinned pre-1.0 config schema + fixtures + the README surface row._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/product-vision.md` | `no-op` | _TODO: checked for scope drift._ |
| `docs/architecture.md` | `no-op` | _TODO: check the Contract surfaces list — add/point to the config schema if warranted (arch pass)._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: primer hygiene; spec-close compression._ |
| `docs/inbox.md` | `no-op` | _TODO._ |
| `docs/refinement-todo.md` | `no-op` | _TODO: mark `updated` IF alloy (or declarative capture) is recorded as a deferral here._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: note if pinning the config contract warranted an ADR._ |
| `adapters/eds/` config module / `contracts/` | `updated` | _TODO: the validation hook + schema._ |
