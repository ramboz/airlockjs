---
status: DRAFT
dependencies: [044-01, 045-01, adr-0023]
last_verified:
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 044-02 — g-ads opts into hold-until-granted (denied-consent parity)

**Goal:** Make the Google Ads connector **opt into** the core seal's `holdOnDenied` mode (spec 045-01 / [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)
Option E), so under `ad_storage`-denied the AW beacon **holds at the seal** (buffers + flushes on a later grant) instead
of sending — matching the reference container's **captured** behavior (R-009 §(b): the container held the whole ad family
under reject-all). This is a **grounded, per-connector opt-in**, NOT a blanket rule: g-ads opts in *because its vendor
was captured holding*; GA4 does not (it sends cookieless); ungrounded vendors (LinkedIn/Bing) are untouched.

**The load-bearing claim (grounded 2026-09-11).** The denied re-capture (Playwright `OneTrust.RejectAll()` → reload,
R-009 §(b)) collapsed the ad-family egress **23 → 2**: under reject-all **no** Google Ads beacon fired (only GA4
cookieless-modeled). So the parity-correct denied behavior for the AW connector is **hold** (buffer, flush on grant),
grounded on the container — not chosen speculatively, and not a cookieless AW send.

**DoR:**
- ✅ 044-01 shipped the AW beacon (granted path) + the connector's `purposes.egress: ["ad_storage"]`.
- ✅ 045-01 provides the **mechanism** — the per-instance `holdOnDenied` opt-in on the core seal (denied governing
  purpose → hold+flush). This slice **sets the flag** for g-ads; it does not build the mechanism.
- ✅ Grounded (R-009 §(b)): the container held AW under `ad_storage`-denied — the opt-in is evidence-backed, not opinion.

**Acceptance Criteria:**

1. **g-ads opts into `holdOnDenied`.** The google-ads connector's airlock instance is configured `holdOnDenied: true`
   (wired at whatever boot/config seam is in scope — mirroring how `consentStrict`/`egressPurposes` are threaded; note
   044-01 deferred full boot wiring, so this AC is satisfied at the connector-config + seal level the 044-01 tests use,
   with runtime boot wiring following in the deferred boot slice). A one-line rationale cites R-009 §(b) as the grounding.
2. **AW egress holds under `ad_storage`-denied.** With `holdOnDenied: true` + `ad_storage` denied (or pending), the AW
   beacon **buffers at the seal** (no egress) and the inspector records the hold; on a later `setConsent({ ad_storage:
   "granted" })` it **flushes** (fires). With `ad_storage` granted, 044-01's beacon fires unchanged.
3. **No cookieless AW fallback (parity).** The connector emits exactly one beacon shape (044-01's ccm/collect); under
   denial the seal **holds** it — the connector does **not** produce a separate cookieless AW variant (contrast GA4's
   analytics path). Asserted against R-009 §(b) (the container held, it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover granted→fires / denied→held / pending→held /
   grant→flushed, and the no-cookieless-fallback assertion. No arch pass (reuses 045-01's mechanism; `arch_review: false`).

**DoD:**
- All ACs met; full suite green; the denied-hold + grant-flush witnessed by tests.
- Compliance + craft passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` **mechanism** itself — 045-01.
- Meta/Floodlight opt-ins (grounded follow-ups, their own specs); LinkedIn/Bing (ungrounded).
- The true conversion ping / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (denied = hold, grounded).** The container holds the Google Ads family under `ad_storage`-denied (R-009 §(b),
23→2). *Risk if wrong:* a different adopter profile that cookieless-sends AW under denial would opt out (leave
`holdOnDenied` unset) or need a per-profile override — a named future variant, per ADR-0023 A2; this slice grounds the
reference profile.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 044 rolls up when 044-02 is DONE (044-01 already DONE); regenerate the board.
