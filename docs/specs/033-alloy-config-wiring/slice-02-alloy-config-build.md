---
status: DEFERRED
dependencies: [033-01]
last_verified:
arch_review: true  # extends the public boot(config) surface + the config schema to a new (wrapped-SDK) connector.
frame_review: true  # rests on the spike's GO design being sound; re-framed once the spike lands.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

## Slice 033-02 — build: wire `{type:"alloy"}` into `boot(config)` + the config schema + the proof

**Resolution trigger:** 033-01 (the feasibility spike) returns **GO** with a concrete design. If the spike returns
**reshape** or **KILL**, this slice is re-drafted (re-open via DRAFT) or ABANDONED per the spike's Outcome — do NOT
advance it out of DEFERRED without the spike's GO (that is the whole point of the spike-first structure).

**Goal (provisional — the spike's design refines it):** make `boot({ connectors: [{ type: "alloy", … }] })` boot
Adobe/alloy through the wrapped-SDK path — a `bootAlloy` adapter producing a composite-compatible handle, the alloy
chamber worker + its stock-SDK load distributed/served same-origin, `{type:"alloy"}` added to the config schema
(extending 032-02's), a golden fixture, and an end-to-end proof (boot → one `sendEvent` → intercepted interact
dispatched, decisions delivered) — closing MVP6's "GA4 + Adobe/alloy" supported-subset gap in the config surface.

**Provisional Acceptance Criteria (the spike's GO design supersedes this sketch):**

1. **`bootAlloy` adapter** wrapping `createWrappedSdkHost` + the served alloy chamber worker + the stock-SDK load,
   returning a composite-compatible handle (per the spike's handle-reconciliation design).
2. **`{type:"alloy"}` in `boot(config)`** dispatching to `bootAlloy`, with the config's consent/governance threaded
   per alloy's governance class (analytics_storage + personalization + ad_storage; the seam `egressVerdict(strict)`
   gate), and decisions-as-data delivered per the spike's design.
3. **Distribution** per the spike's decision — the classic alloy worker as a served `dist` artifact + the stock
   bundle either shipped/served or a documented site-supplied prerequisite; the same-origin invariant preserved.
4. **The config schema** (`contracts/instrumentation-config.schema.json`) gains the `alloy` connector branch (a
   golden fixture) + the README coverage-gap statement is updated to reflect alloy now covered.
5. **End-to-end proof** — a rig/test boots alloy from a config and the intercepted interact is dispatched (+ ECID
   write-back / decisions delivery as the spike's design specifies).

**DoD:** (standard — filled when this slice is re-opened per the spike GO.) All ACs pass; TDD red→green; reviewed
(compliance + craft + **arch**, since `arch_review: true`; **frame-critique**); deviation log + reconciliation sweep;
reconciliation review; refinement-todo updated (the alloy coverage gap CLOSED once this lands).

_This slice is intentionally a sketch. 033-01's Findings/Outcome make it concrete (or reshape/abandon it) — the
DEFERRED state + the resolution trigger enforce that the build waits on the spike's evidence._
