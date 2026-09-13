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

> **Frame-critique folded (2026-09-12, `reviews/slice-02-frame-critique.md`, needs-changes).** The denied=hold frame (A1)
> is solidly grounded (same R-009 §(b) as the shipped 044-02); the exposed gap was an un-surfaced dependency — the "1:1
> mirror of 044-02 / reuse 046-01's mapper" claim is contingent on 046-01's OPEN §A2 endpoint pick, and the granted-flush
> has an endpoint-ceiling break if that pick is the `;`-delimited `activity` form. Added as A2 below; AC1/AC2 qualified.

**Goal:** Make the Floodlight connector **opt into** the core seal's `holdOnDenied` mode (spec 045-01 /
[ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) Option E), so under `ad_storage`-denied the DC
beacon **holds at the seal** (buffers + re-maps + flushes on a later grant) instead of sending — matching the reference
container's captured behavior (R-009 §(b): the container fully held the Floodlight family under reject-all). A grounded,
per-connector opt-in mirroring 044-02, over whatever wire encoder 046-01/§A2 lands on.

**The load-bearing claim (grounded 2026-09-11).** The denied re-capture (Playwright `OneTrust.RejectAll()` → reload,
R-009 §(b)) collapsed ad-family egress **23 → 2**; Floodlight fired **nothing** ("none — fully held",
`R-009:171,175-181`), identical to Google Ads. So DC's parity-correct denied behavior is **hold** (buffer, re-map on
grant), not a cookieless send.

**DoR:**
- ✅ 046-01 shipped the DC beacon (granted path) + `manifest.purposes.egress: ["ad_storage"]`, AND decided the §A2
  endpoint + wire encoding (this slice's re-map + flush re-check depend on it).
- ✅ 045-01 provides the mechanism (`holdOnDenied` opt-in + re-map-on-grant), landed and proven for AW (044-02).
- ✅ Grounded (R-009 §(b)): the container held the DC family under `ad_storage`-denied.

**Acceptance Criteria:**

1. **DC opts into `holdOnDenied` AND supplies the re-map inputs (over 046-01's wire encoder).** The floodlight connector's
   airlock instance is configured `holdOnDenied: true`; `handle` attaches its source `event` to the ready `EgressRequest`
   (the 045-01 additive `EgressRequest.event` channel), and a `createFloodlightRemap(event, consent)` re-sources `auiddc`
   under granted `ad_storage` + re-encodes `gcs`/`gcd`/`npa` from the passed consent, reusing 046-01's mapper (whatever
   wire encoder §A2 landed on — `appendParam`/`&` if `ccm/collect`, or the new `;`-delimited encoder if `activity`),
   mirroring `createGoogleAdsRemap`.
2. **DC egress holds under `ad_storage`-denied, then RE-MAPS on grant (not a stale re-send), and the flush actually
   egresses.** With `holdOnDenied: true` + `ad_storage` denied (or pending), the DC beacon buffers at the seal (no egress;
   inspector records the hold); on a later `setConsent({ ad_storage: "granted" })` it flushes RE-MAPPED under the
   now-granted consent — carrying **granted** `gcs`/`gcd`/`npa` (NOT the stale under-denial `gcs=G100`/`npa=1` a verbatim
   re-send would fire) and re-sourcing `auiddc`. **The flush must pass `core/endpoint-ceiling.js`'s re-check:** if 046-01's
   endpoint is the `;`-delimited `activity` form, the per-request `ord` cachebuster in the pathname must not defeat the
   ceiling match (else the flush is held, never sent — the exact non-parity hold-until-granted prevents). 046-01 AC5 owns
   the ceiling-safe declaration; this AC asserts the flush egresses. Granted-from-the-start → 046-01's beacon fires
   unchanged.
3. **No cookieless DC fallback (parity).** The connector emits exactly one beacon shape (046-01's); under denial the seal
   **holds** it — no separate cookieless DC variant (contrast GA4's analytics path). Asserted against R-009 §(b) (the
   container held; it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover granted→fires / denied→held / pending→held /
   grant→**re-mapped-and-egressed** (granted `gcs`/`gcd`/`npa` + fresh `auiddc` in-test with a synthetic cookie; NOT the
   stale payload; and the flush is not held by the ceiling), and the no-cookieless-fallback assertion. No arch pass (reuses
   045-01's mechanism; `arch_review: false`).

**DoD:**
- All ACs met; full suite green; the denied-hold + grant-flush (egressed, not held) witnessed by tests.
- Compliance + craft passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` **mechanism** itself — 045-01.
- The endpoint + wire-encoding pick — 046-01 (§A2); this slice consumes it.
- The true conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (denied = hold, grounded).** The container held the Floodlight family under `ad_storage`-denied (R-009 §(b), 23→2).
*Risk if wrong:* a different adopter profile that cookieless-sends DC under denial would opt out (leave `holdOnDenied`
unset) or need a per-profile override — a named future variant per ADR-0023 A2; this slice grounds the reference profile.

**A2 (the "1:1 mirror" is contingent on 046-01's §A2 endpoint pick — folded from the 046-02 frame-critique).** This slice's
re-map + granted-flush reuse of 046-01's mapper is settled ONLY once 046-01 resolves its OPEN endpoint/wire decision. If
that lands on the `;`-delimited `activity` form: (a) the re-map mirrors `createGoogleAdsRemap` in shape but rides a NEW
`;`-delimited encoder, not `appendParam`; and (b) the granted-flush must clear `core/endpoint-ceiling.js`'s origin+pathname
re-check despite the `ord` cachebuster in the pathname — a real break AW's fixed-pathname `ccm/collect` never faced. *Risk
if unhandled:* the flush is held at the seal instead of sent — silent non-delivery, the precise non-parity
hold-until-granted exists to prevent. Sequencing mitigates: 046-01 hits the granted-path ceiling case first (046-01 AC5).

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 046 rolls up when both slices are DONE; regenerate the board.
