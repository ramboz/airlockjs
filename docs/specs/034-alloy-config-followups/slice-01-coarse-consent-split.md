---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # changes the consent → interact egress gating (a governance surface, spec 017/020).
frame_review: true  # the "analytics-only interact" reshape is load-bearing + could be wrong (render vs egress).
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use; link to docs/memory/glossary.md. -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable surfaces by probe/source, else mark as assumptions. -->

## Slice 034-01 — coarse-consent split: analytics flows when only personalization is denied

**Goal:** make alloy's consent gating **per-purpose**, not all-or-nothing. Today alloy's analytics + personalization
ride the **one shared interact** gated by the strict `egressVerdict` over `["analytics_storage","personalization"]`
(`core/wrapped-sdk-host.js:310`), which HOLDS the whole interact if *either* purpose is un-granted — so the common
posture **"analytics granted, personalization denied" gets neither**. After this slice: personalization-denied +
analytics-granted sends an **analytics-only interact** (personalization suppressed at the source, gated on
`analytics_storage` alone); both-granted is unchanged (full interact + decisions); **analytics-denied still holds the
whole interact** (fail-closed — no analytics to send).

**DoR:**
- ✅ 033 landed (config-booted alloy: `bootAlloy`, the strict gate, the decisions path).
- ✅ Grounded (read 2026-09-05): the interact is one `sendEvent({renderDecisions:false, xdm})`
  (`connectors/alloy/connector.js:171-175`) — **`renderDecisions:false` suppresses only RENDER, not the personalization
  QUERY/egress**; `egressPurposes` is the STATIC `manifest.egress` (both purposes); the strict `egressVerdict` drops on
  any un-granted purpose (`core/wrapped-sdk-host.js:300-320`, `core/consent.js`); consent is a LIVE ref updated by
  `setConsent` (033-02).

**Design focus for the frame-critique (the load-bearing question):** *how* to make the interact analytics-only when
personalization is denied. Two coupled pieces:
- **Suppress the personalization egress at the source (not just render).** The reshape must stop alloy from *querying*
  personalization (so the egress genuinely carries no personalization intent), e.g. `decisionScopes: []` /
  `personalization: { sendDisplayEvent:false, decisionScopes: [] }` on `sendEvent`, or a consent-scoped `configure` —
  the slice grounds which alloy control actually omits the personalization query (renderDecisions:false alone does
  NOT). If none cleanly does, reshape falls back to "hold the whole interact" + a documented limitation (but that is
  the status quo — the slice's value is the true split).
- **Consent-conditional egress purposes.** The effective `egressPurposes` for the interact must be computed from the
  **live consent** at drive time: personalization denied → `["analytics_storage"]` (so the strict gate passes it for
  analytics); both granted → both; analytics denied → the gate holds regardless. Where this lives (the host reading
  consent per-drive, vs `bootAlloy` recomputing) is the design call.

**Acceptance Criteria (ratified at the frame-critique):**

1. **Per-purpose gate.** With `analytics_storage: granted, personalization: denied`, the alloy interact **is dispatched**
   (analytics flows) — no longer held. With `analytics_storage: denied`, the interact **is held** regardless of
   personalization (fail-closed). Both-granted → dispatched. Test asserts each of the four consent combinations.
2. **Personalization genuinely suppressed (not just un-rendered) when denied.** When personalization is denied, the
   dispatched interact carries **no personalization query** (grounded reshape: `decisionScopes:[]` or the equivalent
   alloy control the frame-critique ratifies) and **no decisions are delivered** (`caps.decisions.deliver` not called)
   — so a denied personalization purpose leaks no personalization egress, consistent with the seam's suppress-not-reshape
   rule (020-02).
3. **Both-granted unchanged.** Full interact + decisions delivered (033-02/03 behavior byte-unchanged — no regression;
   the existing 033 tests stay green).
4. **Live consent.** `setConsent` flipping personalization granted→denied (or back) changes subsequent interacts
   accordingly (the effective purposes are read per-drive from the live consent ref, not frozen at boot).
5. **End-to-end proof.** A rig/test drives the four consent combinations and asserts: dispatched-vs-held + decisions
   delivered-vs-not + (for the analytics-only case) no personalization query on the intercepted interact.

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true`] + **frame-critique**
[`frame_review: true`]); deviation log + reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy
"analytics-yes/pzn-no" follow-on **struck/closed** (or reshaped to a residual if alloy can't cleanly suppress the
query); board synced.
