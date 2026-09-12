---
status: DRAFT
dependencies: [044-01, 017-03]
last_verified:
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 044-02 — seal-hold under `ad_storage`-denied

**Goal:** Make the Google Ads connector **hold the AW beacon at the seal** when `ad_storage` is not granted — matching
the reference container's own grounded behavior (under denial the entire Google Ads family is suppressed; the container
does **not** do a cookieless ad send). This reuses airlock's existing seal (017-03 hold-pending / strict-drop); it wires
the gate, it does not invent one. Consent parity for the denied state, closing the `ad_storage`-denied half of the AW
page-load family.

**The load-bearing claim (grounded 2026-09-11).** The denied re-capture (Playwright `OneTrust.RejectAll()` → reload,
R-009 §(b)) collapsed the ad-family egress **23 → 2 requests**: under `gcs=G100` / `npa=1` **no** Google Ads beacon fired
(only GA4 emitted a cookieless modeling ping). So the parity-correct denied behavior for the AW connector is **seal-hold**
(emit nothing), NOT a cookieless AW send — grounded on the container, not chosen speculatively.

**DoR:**
- ✅ 044-01 built the AW beacon on the granted path; this slice adds the denied-state gate.
- ✅ Denied behavior GROUNDED (R-009 §(b) denied-consent finding): the container holds the whole ad family under
  `ad_storage`-denied.
- ✅ The mechanism exists: 017-03's seal (`ad_storage` gating egress, hold-pending / strict-drop) is the exact gate —
  the connector declares its egress purpose so the seal holds it under denial, exactly as the pixel/GA4 connectors do.

**Acceptance Criteria:**

1. **AW egress is held at the seal under `ad_storage`-denied.** With `ad_storage` = denied (or pending), the connector
   emits **no** AW beacon — the seal holds/drops it per 017-03, and the enforcement inspector (028) records the hold with
   the connector's purpose. With `ad_storage` = granted, 044-01's beacon fires unchanged (no regression).
2. **No cookieless AW send under denial (parity).** The connector does **not** fall back to a cookieless AW ping when
   `ad_storage` is denied — asserted against the grounded container behavior (R-009 §(b): the container holds, GA4-only
   cookieless-models). The cookieless-modeling behavior belongs to the GA4/analytics path (039), not this ad connector.
3. **`gcs`/`npa` reflect the denied state when the seal is (later) lifted.** If consent transitions denied→granted, the
   subsequently-emitted beacon carries the denied-then-granted Consent-Mode state via the reused 039 encoders (044-01
   AC2) — i.e. the encoder is consent-vector-driven, not pinned to granted.
4. **Behavior-preserving.** `npx vitest run` green (full suite); the seal wiring adds no main-thread interaction-path
   cost (the hold is at egress, behind the airlock — vision "held at the seal, capture never waits"). Unit tests cover
   granted-fires / denied-holds / pending-holds, and the no-cookieless-fallback assertion.

**DoD:**
- All ACs met; full `npx vitest run` green; the denied-hold is witnessed by a test driving `ad_storage`-denied and
  asserting zero AW egress + an inspector hold record.
- Compliance + craft passes recorded (no arch pass — reuses the existing seal boundary; `arch_review: false`).
- Reconciliation walked.

**Out of scope (explicit):**
- Any change to the seal mechanism itself (017-03) — this slice *wires* it, not *rebuilds* it.
- The true conversion ping / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (denied = hold, grounded).** The container holds the entire Google Ads family under `ad_storage`-denied (R-009
§(b), 23→2 re-capture). *Risk if wrong:* a profile that DID cookieless-send AW under denial would need a cookieless
adapter — but this is grounded on the reference profile, and matching the container is the parity definition. A
different adopter profile that cookieless-sends is a named future variant, not this slice.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 044 rolls up when both slices are DONE; regenerate the board.
