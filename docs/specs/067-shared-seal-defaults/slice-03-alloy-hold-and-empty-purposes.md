---
status: DRAFT
dependencies: [067-02]
last_verified: 2026-11-13
---

## Slice 067-03: Alloy holds and flushes, and an empty `egressPurposes` holds and warns

**Goal:** Alloy follows the shared consent hold. With no consent input, or an empty `egressPurposes`, Alloy sends nothing and warns. With consent pending, Alloy holds and flushes on grant instead of dropping.

**DoR:**
- ✅ ADR-0062 point 4 follow-ups (ADR-0013:84, ADR-0023:71-73, spec 045-02).
- Ground first (spec 067 section 8, check 2). Alloy has two layers: the chamber-native `defaultConsent:"pending"` queue (spec 045-02), and the TRUSTED seam strict drop in `core/wrapped-sdk-host.js:325-341`. Run `rig/alloy-consent-pending.mjs` and read both, then list the cases that still send or drop:
  - no consent vector: `defaultConsent` is not set, so Alloy sends;
  - consent vector wired with empty `egressPurposes`: the seam is OFF, with a diagnostic (`:205-215`);
  - pending with `egressPurposes`: the seam drops and Alloy's own queue holds.

**Acceptance Criteria:**

1. No consent vector: the chamber configures Alloy to hold (`defaultConsent:"pending"`) and the host emits the 067-02 no-consent-input warning. Nothing reaches the wire before an explicit grant. The 067-02 override turns this off.
2. A consent vector with empty `egressPurposes` holds and warns, and no longer sends. The existing "seam gate is OFF" diagnostic is replaced by the hold-and-warn path.
3. Pending consent holds and flushes on grant. If the seam strict drop can still lose an interact that Alloy's own queue would have held, the seam becomes the backstop only and drops nothing that Alloy queued, or the slice documents why the drop is unreachable and pins that with a test.
4. A grant flushes the queued `sendEvent`s with the full round trip preserved (decisions, identity, consent cookie), as `rig/alloy-consent-pending.mjs` proves for the existing path.
5. 034-01's per-purpose strip is preserved: analytics granted with personalization denied still flows, personalization stripped.
6. Tests cover the stock-default path (consent granted: stock output unchanged) and each hold case as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- The ADR-0013 status line from 067-01 already says these clauses are amended (ADR-0023 is deliberately untouched, per ADR-0062). This slice adds a one-line pointer to the code.

**Consumers:** Adobe 064-18 onward (vendor-adobe). Not used by Google or Meta (Alloy only).

**Anti-horizontal-phasing check:** Vertical: connector config, seam gate and rig proof for the three cases.
