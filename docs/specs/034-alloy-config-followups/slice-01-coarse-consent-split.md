---
status: IN_PROGRESS
dependencies: []
last_verified:
arch_review: true  # changes the consent → interact egress gating (a governance surface, spec 017/020).
frame_review: true  # the "analytics-only interact" reshape is load-bearing + could be wrong (render vs egress).
claimed_by: claude/mvp6-e4550f
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

**Design (frame-critique 2026-09-05 — TRUSTED SEAM-SIDE; the chamber-side reshape was rejected).** The frame-critique
traced alloy 2.35.0: the personalization query is built by `fetchDataHandler`'s `mergeQuery` only when
`shouldRequestDefaultPersonalization()` is true, and `personalization:{ defaultPersonalizationEnabled:false }` (NOT
`decisionScopes:[]`, which is already the default, and NOT `sendDisplayEvent:false`) suppresses it. So alloy CAN emit
an analytics-only interact — the premise holds. **But the suppression must NOT be chamber-side:** the chamber is
untrusted (ADR-0016 bundle) and is notified of consent only ONCE at boot (no mid-session re-delegate), so a chamber-side
reshape + a relaxed main-thread gate would (a) LEAK `query.personalization` under an analytics-only gate after a
granted→denied flip, and (b) invert the seam's "does NOT trust the chamber" invariant (020-02). Also alloy's own
`setConsent` collapses both purposes to one y/n (`connectors/alloy/consent.js` — pzn-denied kills analytics collection
too), so the split cannot ride it.

**Therefore: do it at the TRUSTED SEAM, driven by the live `consentRef`, per intercepted interact.** In
`core/wrapped-sdk-host.js`'s intercepted-fetch path (where `configIntegrity`/`endpointCeiling`/`egressVerdict` already
run): when `personalization` is un-granted but `analytics_storage` is granted, **strip `query.personalization` from
the intercepted interact body** (a body surgery distinct from the existing `stripInterceptedXdmBody` XDM strip) and
gate the now-analytics-only interact on `["analytics_storage"]` — both driven by the SAME live `consentRef` the seam
already reads, so AC4 needs no chamber re-notify. The chamber may still *build* the query (harmless — the seam removes
it; Edge then returns no decisions, so `deliver` no-ops). A chamber-side `defaultPersonalizationEnabled:false` to avoid
the wasted build is an optional optimization → a named follow-on, NOT the enforcement.

**Grounding the strip is Edge-safe:** the stripped shape (analytics XDM + `query.identity.fetch`, no
`query.personalization`) is exactly what alloy itself sends with personalization off (012-04 / an analytics-only
config) — a valid analytics interact, not a malformed body. A live-Edge confirmation is a **creds-gated residual**
(like 013); the hermetic proof asserts the stripped body's shape.

**Acceptance Criteria (ratified at the frame-critique — trusted seam-side):**

1. **Per-purpose gate (seam-side).** With `analytics_storage:granted, personalization:denied`, the interact **is
   dispatched** (analytics flows). With `analytics_storage:denied`, the interact **is held** regardless of
   personalization (fail-closed). Both-granted → dispatched. Test asserts each of the four combinations (on a FRESH
   boot each — alloy's `shouldRequestDefaultPersonalization` fires only on the first cache-uninitialized interact).
2. **Personalization suppressed at the TRUSTED SEAM when denied.** The seam strips `query.personalization` from the
   intercepted interact body (driven by the live `consentRef`) so the egress carries no personalization query — a
   compromised chamber cannot leak it (the seam removes it; NOT chamber-trust). **PATH PRECISION (grounded — required):
   `query.personalization` is written PER-EVENT (`alloy-core createEvent.js` → `events[i].query.personalization`),
   while the ECID `query.identity.fetch` is TOP-LEVEL (`query.identity.fetch`).** So the strip MUST iterate
   `parsed.events[]` and `delete evt.query.personalization` (and delete an emptied `evt.query` to byte-match alloy's
   native-off shape) — NOT a top-level `parsed.query.personalization`, which never exists (a naive top-level delete is
   a silent no-op that ships a LEAK while a wrong-path test stays green). Reuse the per-event scaffold of the existing
   `stripInterceptedXdmBody` (`core/wrapped-sdk-host.js:558`, which already iterates `parsed.events[]` — operate on
   `evt.query` instead of `evt.xdm`). No decisions are delivered (Edge sees no query → none returned).
3. **Both-granted unchanged.** No strip, gate on both, full interact + decisions delivered — 033-02/03 byte-unchanged,
   existing 033 tests green (no regression).
4. **Live consent, no chamber re-notify.** `setConsent` flipping personalization granted↔denied changes the NEXT
   interact's strip+gate (the seam reads the live `consentRef` per-interact) — no mid-session chamber re-delegate
   needed (that INFEASIBILITY was the frame-critique's core finding; seam-side sidesteps it).
5. **End-to-end proof.** A rig/test drives the four consent combinations (fresh boot each) and asserts: dispatched-vs-held
   + decisions delivered-vs-not + (analytics-only case) **no `events[].query.personalization`** in the intercepted
   body AND the top-level `query.identity.fetch` (+ the analytics XDM) retained.
6. **Differential Edge-safe proof (grounds the "= alloy's own analytics-off interact" claim, creds-free).** A hermetic
   test asserts that an interact built with personalization ON then seam-stripped **deep-equals** the interact alloy
   builds natively with `defaultPersonalizationEnabled:false` — both produced from the installed `@adobe/alloy@2.35.0`
   bundle. This grounds Edge-safety without creds and catches the emptied-`evt.query` cleanup a shape-only assertion
   would miss. (Live-Edge confirmation remains a creds-gated residual, 013 pattern.)

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true`] + **frame-critique**
[`frame_review: true`]); deviation log + reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy
"analytics-yes/pzn-no" follow-on **struck/closed** (or reshaped to a residual if alloy can't cleanly suppress the
query); board synced.
