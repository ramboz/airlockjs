---
status: DRAFT
dependencies: [030-02]
last_verified:
---

<!-- jig grounding (ADR-0020): sampleRUM is inline in probes/eds-testbed/scripts/aem.js
     (~:14, auto-fires `top` on load :124 via navigator.sendBeacon). The double-count is
     the honest boundary 022-01 AC3 named. "Replace" = neutralize inline sampleRUM + boot
     airlock's RUM. -->

## Slice 030-03 — the page-side replace + no double-count

**Goal:** Demonstrate the **replace** end-to-end on `probes/eds-testbed`: neutralize the inline `sampleRUM` and
boot airlock's RUM (030-01's `bootHelixRum`) as the **single** governed RUM authority, with a rig proving
**exactly one** governed beacon per checkpoint (no double-count) — the observable "sampleRUM off, airlock owns
RUM".

**DoR:**
- ☐ 030-02 DONE (bootHelixRum + the governed RUM instance exist to boot on the page).
- ☐ Grounded: where inline `sampleRUM` fires on the testbed (`aem.js`), and how to neutralize it (the integrator
  cleanup pattern — 022 scoped the `aem.js` edit as the integrator's job).

**Acceptance Criteria (draft — sharpened at READY):**

1. On the testbed, inline `sampleRUM` is neutralized (does not auto-fire its `top`/CWV beacons) and `bootHelixRum`
   boots airlock's RUM instead.
2. A rig asserts **exactly one** governed beacon per checkpoint (`top`/`error`/`cwv`) — no double-emit from
   airlock + sampleRUM; all confined to `ot.aem.live`, not consent-gated.
3. The rig proves the AEM pipeline still receives the core-checkpoint beacons (now governed), not that the
   enhancer's interaction/lifecycle set is reproduced (explicitly out of scope).
4. No live identifiers; the testbed collector is stubbed/synthetic.

**DoD:** _standard (see 030-01); full ACs sharpened when this slice reaches READY._

**Anti-horizontal-phasing check:** after this slice the testbed demonstrates airlock as the single governed RUM
authority (sampleRUM off, one beacon per checkpoint) — the observable replace.
