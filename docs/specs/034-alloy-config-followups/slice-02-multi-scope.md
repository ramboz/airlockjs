---
status: IN_PROGRESS
dependencies: [033-02, 034-01]
last_verified:
arch_review: true  # extends the interact request shape + the public config placements surface to N scopes.
frame_review: true  # rests on the decisionScopes request-wiring being correct (033-03 deferred it unproven).
claimed_by: claude/mvp6-e4550f
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
