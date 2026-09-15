---
status: DRAFT
dependencies: [050-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 050-02 — measured Lighthouse/TBT + parity evidence + scripted adoption path

**Goal:** Turn the working `?martech=airlock` arm (050-01) into MVP9's **developer-provable release-check evidence** — the
**Lighthouse/TBT** before-vs-after win, **beacon parity** (the 038 harness + `intuit-erp`'s `martech-diff` against the
container golden), and the **event-level console receipt** — and generalize the recipe into airlock's **scripted
adoption-path doc** ([ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E8). This closes MVP9's
developer-provable subset ([mvp9.md](../../releases/mvp9.md) § Release-Check); the production live-attribution leg stays the
container-owner-gated residual ([ADR-0029](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)), out of scope.

**DoR:**
- ✅ 050-01 DONE — a working `?martech=airlock` arm on a prod-profile host (four tags suppressed, airlock emitting, tail green).
- ◻️ (A2) prod-profile host access (stage/VPN) for the before-vs-after measurement.

**Acceptance Criteria:**

1. **Lighthouse/TBT before-vs-after arm (the win, honestly framed).** On a prod-profile host, a repeatable measurement
   compares **container-as-shipped** vs **`?martech=airlock`** and reports the **TBT / Lighthouse-score** delta (the ad
   runtimes are ~two-thirds of martech TBT per the perf report). Phrased as a **lab TBT/Lighthouse win** — NOT a field
   INP/LCP/CLS claim (A3: the ad tags are TBT-dominant, INP/CLS-neutral, LCP already good). Reuses / extends the 036
   instrument (ADR-0018 E12).
2. **Beacon parity at the vendor boundary, per vendor.** For each of the four vendors, airlock's emitted beacon carries the
   **same attribution-bearing fields** the container's captured beacon does: the **038 parity harness** passes on the
   redacted captures (already covers Google Ads/Floodlight; GA4/Meta ride the same engine), AND `intuit-erp`'s
   `npm run verify:martech` shows the airlock arm's normalized vendor beacons matching the committed `martech.golden.json`
   for the four migrated vendors (the other vendors unchanged).
3. **Event-level console receipt (developer-driven, lab).** A verified checklist that airlock's four beacons are received in
   the vendors' debug/realtime surfaces — **GA4 DebugView**, **Meta Test Events**, **Google Ads** conversion/tag
   diagnostics, **Floodlight** verification — captured as the developer-provable event-level parity evidence. (No live
   attribution window — that is the ADR-0029 residual.)
4. **The scripted adoption-path doc (E8), vendor-neutral.** A new airlock guide (e.g. `docs/adoption/rewire-a-container.md`)
   documents the **repeatable developer procedure** generalized from 050-01: subtree the airlock dist → declare the migrated
   vendors' URL/query suppressor matchers (+ the airlock-egress carve-out) → `boot(config)` the connectors → measure
   (Lighthouse + parity + console receipt). Vendor-neutral (no intuit specifics in the recipe; the reference-site run is the
   worked example). Cross-linked from `mvp9.md` and `docs/adoption-readiness.md`.
5. **The developer-provable release-check is demonstrated.** The evidence (AC1–AC3) is recorded against mvp9's
   developer-provable subset (Lighthouse/TBT win + event-level parity + scripted path), with **zero container-owner
   dependency**; the production live-attribution leg is explicitly carried forward as the container-owner-gated residual (not
   silently narrowed).

**DoD:**
- [ ] ACs met; evidence (Lighthouse deltas, `verify:martech` + 038 output, console-receipt checklist) captured and attached.
- [ ] The adoption-path doc reviewed by `reviewer` subagent (compliance + craft) — it is an airlock artifact.
- [ ] Deviation log + reconciliation sweep produced under this slice heading. If this closes spec 050, run the close-out
      (compress the primer's active-spec entry; memory-sync the reference-site rewire technique + the adoption path).
- [ ] `mvp9.md` updated: the developer-provable subset marked demonstrated (evidence linked); the live-attribution residual
      restated. `docs/refinement-todo.md` updated with any residual.

**Anti-horizontal-phasing check:** after this slice, a developer has the measured Lighthouse/TBT win + per-vendor beacon
parity + event-level console receipt for the reference-site rewire, AND a repeatable, vendor-neutral guide to do it on any
container — the MVP9 developer-provable subset, proven and documented. Not intermediate state.

## Assumptions

- **A2 — prod-profile host access** (stage/VPN or production) for the before-vs-after measurement; the arena, not a
  container-owner gate.
- **A3 — Lighthouse/lab-TBT framing** (not field CWV); AC1 phrases the win accordingly.
- **Parity substrates exist** — the 038 harness already covers the ad beacons, and `intuit-erp`'s `martech-diff` +
  `martech.golden.json` are the normalized-beacon diff; this slice reuses both, adding no new oracle.

### Deviation log (after reconciliation)

_TODO at reconciliation._

### Reconciliation sweep

_TODO at reconciliation._
