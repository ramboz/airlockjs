---
status: DRAFT
dependencies: [046-01, 045-01, adr-0023]
last_verified:
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-02 — DC opts into hold-until-granted (ad_storage-denied parity)

**Goal:** Make the Floodlight connector **opt into** the core seal's `holdOnDenied` mode (spec 045-01 /
[ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) Option E), so under `ad_storage`-denied the DC
beacon **holds at the seal** (buffers + re-maps + flushes on a later grant) instead of sending — matching the reference
container's captured behavior (R-009 §(b): the container fully held the Floodlight family under reject-all). A grounded,
per-connector opt-in, mirroring 044-02 1:1.

**The load-bearing claim (grounded 2026-09-11).** The denied re-capture (Playwright `OneTrust.RejectAll()` → reload,
R-009 §(b)) collapsed ad-family egress **23 → 2**; Floodlight (`ad.doubleclick.net/activity` + `ccm/collect`) fired
**nothing** ("none — fully held", `R-009:171,175-181`), identical to Google Ads. So DC's parity-correct denied behavior is
**hold** (buffer, re-map on grant), not a cookieless send.

**DoR:**
- ✅ 046-01 shipped the DC beacon (granted path) + `manifest.purposes.egress: ["ad_storage"]`.
- ✅ 045-01 provides the mechanism (`holdOnDenied` opt-in + re-map-on-grant), landed and proven for AW (044-02).
- ✅ Grounded (R-009 §(b)): the container held the DC family under `ad_storage`-denied.

**Acceptance Criteria:**

1. **DC opts into `holdOnDenied` AND supplies the re-map inputs.** The floodlight connector's airlock instance is
   configured `holdOnDenied: true`; `handle` attaches its source `event` to the ready `EgressRequest` (the 045-01 additive
   `EgressRequest.event` channel), and a `createFloodlightRemap(event, consent)` re-sources `auiddc` under granted
   `ad_storage` + re-encodes `gcs`/`gcd`/`npa` from the passed consent (reusing 046-01's mapper + the `_gcl_au`/`auiddc`
   read), mirroring `createGoogleAdsRemap`.
2. **DC egress holds under `ad_storage`-denied, then RE-MAPS on grant (not a stale re-send).** With `holdOnDenied: true` +
   `ad_storage` denied (or pending), the DC beacon buffers at the seal (no egress; the inspector records the hold); on a
   later `setConsent({ ad_storage: "granted" })` it flushes RE-MAPPED under the now-granted consent — the beacon carries
   **granted** `gcs`/`gcd`/`npa` (NOT the stale under-denial `gcs=G100`/`npa=1` a verbatim re-send would fire, the
   unattributable "user-declined" beacon 045-01 forbids) and re-sources `auiddc` under the now-granted `ad_storage`
   (omit-when-absent, never minted). Granted-from-the-start → 046-01's beacon fires unchanged.
3. **No cookieless DC fallback (parity).** The connector emits exactly one beacon shape (046-01's); under denial the seal
   **holds** it — no separate cookieless DC variant (contrast GA4's analytics path). Asserted against R-009 §(b) (the
   container held; it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover granted→fires / denied→held / pending→held /
   grant→**re-mapped** (the flushed beacon carries granted `gcs`/`gcd`/`npa` + a fresh `auiddc` in-test with a synthetic
   cookie; NOT the stale under-denial payload), and the no-cookieless-fallback assertion. No arch pass (reuses 045-01's
   mechanism; `arch_review: false`).

**DoD:**
- All ACs met; full suite green; the denied-hold + grant-flush witnessed by tests driving `ad_storage`-denied→granted.
- Compliance + craft passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` **mechanism** itself — 045-01.
- The true conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (denied = hold, grounded).** The container held the Floodlight family under `ad_storage`-denied (R-009 §(b), 23→2).
*Risk if wrong:* a different adopter profile that cookieless-sends DC under denial would opt out (leave `holdOnDenied`
unset) or need a per-profile override — a named future variant per ADR-0023 A2; this slice grounds the reference profile.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 046 rolls up when both slices are DONE; regenerate the board.
