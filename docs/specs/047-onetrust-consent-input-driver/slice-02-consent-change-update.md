---
status: DRAFT
dependencies: [047-01, 045-01]
last_verified:
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 047-02 — OneTrust consent-change → `handle.setConsent` (accept-flow flush)

> **Grounded 2026-09-13 (mechanism).** `handle.setConsent(v)` (017-03 AC2, `adapters/eds/index.js:456`) + the 045
> `holdOnDenied` hold/flush on the grant edge (044-02 / 046-03) — the update sink and flush behavior this slice drives — plus
> the OneTrust change-signal surface: `OneTrust.OnConsentChanged` and `OptanonWrapper` are both `function` on the reference
> site (`rig/onetrust-consent-probe.mjs`, spec §A2). RESIDUAL: that the signal *fires with the updated set on a real banner
> toggle* is unobserved (the probe did not click) — confirmed at implementation with one live toggle.

**Goal:** The OneTrust driver subscribes to OneTrust's consent-change signal (`OneTrust.OnConsentChanged`, and/or the
`OptanonWrapper()` global), re-maps the updated active groups through 047-01's contract, and calls the runtime handle's
`setConsent(vector)` — so a mid-session OneTrust change updates the seal and flushes 045-held ad beacons on the grant edge
(the "OneTrust-accept flow"). Delivers: the **live accept-flow** — the user accepts consent in the OneTrust banner and the
held Google Ads / Floodlight beacons egress.

**DoR:**
- ✅ 047-01 shipped the read + map contract + the driver module this extends.
- ✅ `handle.setConsent(v)` (017-03) + 045 `holdOnDenied` hold/flush (044-02 / 046-03) are built — the update sink + the
  flush behavior this slice drives.
- ✅ **Change-signal surface grounded (2026-09-13, `rig/onetrust-consent-probe.mjs`):** `OneTrust.OnConsentChanged` +
  `OptanonWrapper` are both present as functions (spec §A2) — the subscription seam exists.
- ◻️ (soft, non-blocking) observe one **real** consent toggle at implementation to confirm the signal delivers the updated
  group set (vs requiring a re-read) — the §A2 live-delivery residual.

**Acceptance Criteria:**

1. **Subscribes to OneTrust's consent-change signal.** The driver registers for OneTrust consent changes
   (`OneTrust.OnConsentChanged(cb)`, and/or wraps the `OptanonWrapper()` global) through an **injected subscription seam**
   (unit-testable by invoking the callback with a fixture active-group set). Idempotent + null-safe when OneTrust is absent
   (no throw, no double-subscribe). [rests on §A2]
2. **Re-maps and calls `setConsent` with the update.** On a change event the driver re-runs **047-01's** group→purpose
   mapping (no second mapping implementation) and calls `handle.setConsent(vector)` with the updated
   `Record<ConsentPurpose, …>`.
3. **The grant edge flushes held beacons (the accept-flow).** When a change grants a previously denied / pending ad purpose
   (`ad_storage` et al.), the `setConsent` call flushes the 045-held beacons (buffer → re-map → dispatch), matching
   044-02 / 046-03 — verified by a held-then-flushed assertion, not a new flush codepath.
4. **Revoke stops future egress, never un-sends.** A change that denies a purpose updates the vector so subsequent beacons
   hold / reshape per the seal; already-sent beacons are not recalled (ADR-0007: "already-sent cannot be unsent"). No throw
   on grant→deny→grant churn.
5. **No new seam, no egress in the driver.** The driver still only reads OneTrust and calls the existing `setConsent`; the
   flush / hold side effects remain the seal's (`core/airlock.js`), not the driver's.

**DoD:**
- All ACs met against a fixture change-event; full `npx vitest run` green; a held→granted→flushed integration assertion (the
  accept-flow) passes.
- Compliance + craft passes recorded (**no arch pass** — reuses 01's contract; `arch_review: false`).
- Frame-critique pass recorded (`frame_review: true` — §A2).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked. If this slice closes spec 047,
  run the close-out (compress the primer's active-spec entry; memory-sync the OneTrust-driver / consent-input pattern).

**Out of scope (explicit):**
- The initial boot read / map (**047-01**).
- New hold / flush machinery (spec 045 reused).
- `functional` / `personalization` purposes; non-EDS host adapters; `__tcfapi` / `gtag` sibling drivers.
- Re-sending or recalling already-egressed beacons.

### Deviation log (after reconciliation)

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._

### Reconciliation sweep

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._
