---
status: DRAFT
dependencies: [039-01]
last_verified:
frame_review: true
---

## Slice 039-02 — Consent Mode carriage (gcs/gcd)

**Goal:** Encode **Consent Mode** state onto the `/g/collect` beacon — `gcs` (state string, e.g. `G111`) + `gcd`
(defaults) — from the host consent vector, closing the MP path's consent-carriage gap (MP's `consent` object cannot
express storage purposes or drive modeling; the gtag beacon can).

**DoR:**
- ✅ 039-01 done — the core beacon exists.
- ✅ The vendor-neutral consent resolver exists — `core/consent.js` `resolveConsent` (reused by `connectors/ga4/consent.js`).

**Acceptance Criteria:**

1. **A `gcs`/`gcd` encoder** maps the host consent vector (`analytics_storage`, `ad_storage`, `ad_user_data`,
   `ad_personalization`) to the Consent-Mode `gcs` state string and `gcd` defaults string.
2. **The beacon carries `gcs`/`gcd`** when consent is signaled. `pending` follows the existing discipline
   (`connectors/ga4/consent.js`): omit rather than fail-safe-deny — never send a misleading state for a purpose the host
   never decided.
3. **A `granted` vs `denied` vector produces the documented `gcs` difference** (e.g. `G111` vs the denied variant),
   asserted against a redacted fixture's `gcs`/`gcd` (or a unit vector→string table until 038 lands).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: granted, denied, and pending (omitted) vectors.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The `gcs`/`gcd` digit semantics** are reproduced from the R-009 capture (`gcs=G111`, `gcd=13r3r3r3r5l1`) + documented
  Consent Mode v2; the exact per-digit mapping is confirmed on captures spanning consent states before it is frozen.
  (Why `frame_review: true`.)

**Anti-horizontal-phasing check:** After this slice the rewired GA4 beacon carries Consent-Mode state, so a
consent-governed page reaches GA4 with the same consent signal the container sent — consent parity, end-to-end.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
