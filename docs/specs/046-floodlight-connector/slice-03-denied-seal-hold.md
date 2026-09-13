---
status: DRAFT
dependencies: [046-01, 046-02, 045-01, adr-0023]
last_verified:
frame_review: false
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-03 — DC opts into hold-until-granted, both forms (ad_storage-denied parity)

> **Grounded:** DC's `ad_storage`-denied behavior is full seal-hold (R-009 §(b): 23→2 reject-all; "none — fully held",
> identical to Google Ads), the mechanism is spec 045's shipped `holdOnDenied` opt-in + re-map-on-grant, and 044-02 already
> proved the pattern for AW. This slice wires BOTH DC forms (046-01 ccm/collect + 046-02 activity) into it. (The prior
> frame-critique's endpoint contingency — `reviews/slice-03-frame-critique.md` — is RESOLVED: both forms are now in scope,
> built in 046-01/046-02.)

**Goal:** Both DC beacons (ccm/collect + activity) opt into the core seal's `holdOnDenied` mode so under
`ad_storage`-denied they hold at the seal (buffer + re-map + flush on a later grant) instead of sending — matching the
container (R-009 §(b)). A grounded per-connector opt-in mirroring 044-02.

**The load-bearing claim (grounded 2026-09-11):** the denied re-capture collapsed ad-family egress 23→2; Floodlight fired
nothing ("none — fully held", R-009:171,175-181). DC's parity-correct denied behavior is hold, not a cookieless send.

**DoR:**
- ✅ 046-01 + 046-02 shipped both DC beacon forms + `manifest.purposes.egress: ["ad_storage"]`.
- ✅ 045-01 provides the `holdOnDenied` mechanism (opt-in + re-map-on-grant), proven for AW (044-02).
- ✅ Grounded (R-009 §(b)): the container held the DC family under `ad_storage`-denied.

**Acceptance Criteria:**
1. **Both forms opt into `holdOnDenied` + supply re-map inputs.** The floodlight airlock instance is `holdOnDenied: true`;
   `handle` attaches the source `event` to each ready `EgressRequest` (the 045-01 additive channel), and a
   `createFloodlightRemap(event, consent)` re-sources the linker id under granted `ad_storage` + re-encodes
   `gcs`/`gcd`/`npa` from the passed consent, for BOTH the ccm/collect and the `;`-delimited activity mappers, mirroring
   `createGoogleAdsRemap`.
2. **Both DC beacons hold under denial, then RE-MAP on grant (not a stale re-send), and the flush egresses.** Denied (or
   pending) → both buffer at the seal (no egress; the inspector records the hold); on `setConsent({ ad_storage: "granted"
   })` both flush RE-MAPPED under granted consent (granted `gcs`/`gcd`/`npa`, re-sourced `auid`/`auiddc`), NOT the stale
   under-denial payload. The activity flush clears the 046-02 endpoint-ceiling path-match fix (its `;`-pathname is not held
   on flush); ccm/collect's fixed pathname is already clean. Granted-from-the-start → 046-01/046-02 beacons fire unchanged.
3. **No cookieless DC fallback (parity).** Under denial the seal holds both beacons — no cookieless DC variant. Asserted
   against R-009 §(b) (the container held; it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover, for BOTH forms, granted→fires / denied→held /
   pending→held / grant→re-mapped-and-egressed (granted consent-mode + re-sourced linker id, not the stale payload; the
   activity flush not held by the ceiling), plus the no-cookieless-fallback assertion.

**DoD:**
- All ACs met; full suite green; denied-hold + grant-flush (egressed, both forms) witnessed by tests.
- Compliance + craft passes recorded (no arch pass — reuses 045-01's mechanism; `arch_review: false`).
- Reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` mechanism itself — 045-01.
- The two beacon forms — 046-01 (ccm) / 046-02 (activity).
- Conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 046 rolls up when all three slices are DONE; regenerate the board.
