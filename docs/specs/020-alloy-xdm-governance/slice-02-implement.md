---
status: DRAFT
dependencies: [020-01]
last_verified: 2026-08-31
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 020-02 — implement alloy consent enforcement (seam drop + setConsent) + the optional payload strip

**Goal:** Implement the alloy governance that [020-01](slice-01-feasibility-probe.md) found feasible — turning
"alloy isolated" into "alloy **governed**", the airlock-thesis-consistent way. The probe's verdict:
**consent is the real work, via TWO complementary levers, and payload is already-minimal + an optional
Edge-safe strip.** Unblocked by 020-01's Outcome.

**DoR:**
- ✅ [020-01] DONE — verdict: both halves feasible. Consent = the `setConsent` command (in→send /
  out→never-send / pending→queue) + a separate `privacy/set-consent` Edge call; payload already read-minimized
  by `toXdm` + `context:[]`; a seam field-strip is **Edge-safe** (live-confirmed).
- ✅ 017-03's `egressVerdict` (`core/consent.js`) exists — the vendor-neutral seal logic (send/hold/drop per
  the purpose vector) already used for GA4's async seal. **Grounded** (017-03).
- ✅ The seam is `core/wrapped-sdk-host.js` `dispatchInterceptedFetch`, where endpoint-ceiling + config-integrity
  already bind; the consent vector can thread into the chamber `init` like other ctx. **Grounded** (020-01).

**Acceptance Criteria (to be finalized when picked up — the probe fixed the approach):**

1. **Seam-side egress drop (the TRUSTED enforcement — does NOT trust the chamber).** At
   `dispatchInterceptedFetch`, apply the ADR-0007 `egressVerdict` (`core/consent.js`) to alloy's intercepted
   interact: a **denied/pending** governing purpose → **hold/drop at the seal** (never dispatched), surfaced
   (009-02). **Semantics catch (020-01 craft review — load-bearing):** `egressVerdict`'s *non-strict default*
   returns **send** on a *data-use* denial (that path is premised on GA4 carrying `consent:denied` in the MP
   body — delegate-and-send). **alloy has NO body-consent field**, so a collect-**denied** interact would leak
   if sent — it must be **suppressed (dropped)**, not sent. So the alloy seam maps a denied/pending `collect`
   purpose → **DROP** (strict-like semantics, e.g. `egressVerdict(…, { strict:true })` or an explicit
   drop-on-denied for alloy), NOT the GA4 send-on-data-use-denial default. Observable: consent-denied → the
   alloy interact does NOT reach Edge (independent of alloy's own `setConsent` gate — so a compromised chamber
   is still held).
2. **Drive `setConsent` in the chamber alloy-boot glue (the idiomatic DELEGATE).** Map the ADR-0007 vector →
   Adobe 2.0 consent shape (`{ consent:[{ standard:"Adobe", version:"2.0", value:{ collect:{ val } } }] }`);
   the chamber glue does `configure → setConsent(mapped) → sendEvent` (the vector crosses in at `init`). So
   alloy self-gates + propagates the `kndctr_<orgId>_consent` cookie — correct vendor behavior, complementing
   the seam drop (defense-in-depth). Observable: with consent denied, alloy self-suppresses (a live
   `setConsent(collect:n)` flow shows no interact) AND the seam would drop it anyway.
3. **Optional thin defense-in-depth payload strip (Edge-safe, low-cost).** If a host denylist is wired, apply
   `governPayload` to `events[].xdm` at the seam (parse→strip→re-serialize — 020-01 confirmed Edge-safe +
   round-trip-preserving). Non-load-bearing (the body is already minimal), so gate it on a denylist being
   present, byte-unchanged otherwise.
4. **No regression** — the GA4 seal (017-03), endpoint-ceiling (016), config-integrity (015), and the alloy
   round-trip (012/014) stay green; the no-consent path is byte-unchanged.

**DoD (to finalize):**
- [ ] ACs pass — the alloy seam-drop (egressVerdict-parity with GA4) + the chamber `setConsent` drive + the
      optional strip; targeted tests + a live `setConsent(collect:n)` chamber-rig confirmation (013 infra).
- [ ] Reviews (compliance + craft + arch — the untrusted-chamber seam-enforce-vs-delegate design + the
      egressVerdict reuse) + reconciliation.
- [ ] **Supersede ADR-0012's alloy-Split disposition** (and ADR-0007's alloy residual) — record that alloy
      consent is *feasible* via seam-drop + `setConsent`, not the feared fragile strip-at-seal; an ADR update
      at 020's close.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** a consent-denied alloy event is held/dropped at the seal (trusted seam
enforcement) AND self-suppressed by alloy (idiomatic delegate) — an end-to-end, user-observable governance
change on the alloy archetype, completing "the core AEM stack, governed" (MVP4).
