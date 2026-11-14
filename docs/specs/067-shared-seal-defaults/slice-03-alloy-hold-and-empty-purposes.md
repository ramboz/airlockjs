---
status: DONE
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

1. No consent vector: the chamber configures Alloy to hold (`defaultConsent:"pending"`) and the host emits the 067-02 no-consent-input warning. Nothing reaches the wire before an explicit grant. The per-connector `consentHold: false` override from 067-02 (D2) turns this off for Alloy.
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

## Notes

**Grounding (spec section 8 check 2).** `rig/alloy-consent-pending.mjs` passes against real Alloy: pending queues the `sendEvent` (0 interacts), `setConsent(y)` plus a set-consent round trip flushes it (1 interact, resolved). Cases, before this slice:

| # | Case | Chamber layer | Seam layer (`core/wrapped-sdk-host.js`) | Result |
|---|---|---|---|---|
| 1 | no consent vector | `shapeAlloyBoot(null)` sets no `defaultConsent` | `egressPurposes: []`, gate off | **sends** |
| 2 | vector, empty `egressPurposes` | pending queue if analytics pending | seam OFF + `not-enforced` warning | granted/denied Alloy self-gating only; seam never drops |
| 3 | vector + purposes, pending | Alloy queue holds | strict drop (never reached by a queued event) | holds, flushes on grant |
| 4 | vector + purposes, denied | `setConsent(n)` self-suppress | strict drop | nothing sent |
| 5 | `setConsent` with no boot consent | adapter no-op (`consentRef` null) | none | cannot grant |

**What shipped.** `bootAlloy` starts the live consent ref `{}` (every purpose pending) unless a vector is passed or `consentHold: false`; the chamber therefore configures `defaultConsent:"pending"` and the existing 045-02 flush path does the rest (cases 1 and 5 now hold and can be granted). The first event with no consent input emits 02's `no consent input wired` warning once. `consentHold: false` with no vector leaves the ref null (hold off, `hold-off` warning at boot); a vector wins. `createWrappedSdkHost` takes `consentHold`: a vector with empty `egressPurposes` now holds on `analytics_storage` and emits `empty-purposes` once, replacing `not-enforced` (case 2); `consentHold: false` keeps the old off state with a `hold-off` warning. `MAX_HELD_BEACONS` is exported from `core/airlock.js` and bounds the events waiting behind Alloy's queue while consent is not granted (never when granted). Tests: `test/alloy-consent-hold.test.js` (models the chamber glue with the real `shapeAlloyBoot`) and the host tests; the round-trip suites opt out with `consentHold: false`. AC5 (per-purpose strip) is covered unchanged by the 034-01 tests in `test/eds-boot-alloy.test.js`.

**AC3 decision (documented, pinned).** The seam strict drop is a backstop. Anything Alloy queued never reaches the seam before a grant, and the adapter updates the live ref before driving Alloy's `setConsent`, so the flush passes as granted. What can still reach the seam pending is an interact Alloy did not queue (a compromised chamber, or Alloy sending on a stale consent cookie it was seeded with); dropping that is the seam's job. A test pins this.

**Residual.** `kndctr_` seeds include Alloy's consent cookie; a stale "in" cookie makes Alloy send on a pending page and the seam drops it (not held). Clearing the seeded consent cookie while consent is pending would turn that into a queue hold; follow-up if live checks show it.

### Deviation log

- **No-input start equals an explicit pending vector.** `bootAlloy` passes `{}`; `resolveConsent` treats an unset purpose as pending, so `shapeAlloyBoot({})` gives the same `defaultConsent:"pending"` the grounding rig exercises (AC4 round trip, rig run above).
- **Empty-purposes hold keys on `analytics_storage` only** (Alloy's one collect purpose).
- **Effective cap is `MAX_HELD_BEACONS` + the one event inside Alloy's own queue.**
- **Round-trip suites opt out with `consentHold:false`;** the no-input hold is covered by the modeled-chamber test, the real-Alloy proof is the rig.

### Reconciliation sweep

Review round 1 (Opus 5.5): two mediums (missing ADR-0013 code pointer, AC4 evidence for the no-input path) and lows (exact cap count); fixed. See `reviews/slice-03-*.md`.
