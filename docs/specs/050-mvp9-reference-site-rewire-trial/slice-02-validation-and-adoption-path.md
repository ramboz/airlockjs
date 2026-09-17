---
status: DONE
dependencies: [050-01]
last_verified: 2026-09-17
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
- ◻️ 050-01 — the `?martech=airlock` arm is validated (suppress on prod + emit on the branch + TBT bound measured), but 050-01
  is IN_PROGRESS, not yet DONE; 050-02's **DONE** is gated on 050-01 reaching DONE (the `dependencies:` check).
- ◻️ (A2) prod-profile host access — public `erp.intuit.com` (no VPN, no container-owner; `rig:erp-waterfall`) for the before-vs-after measurement.

**Acceptance Criteria:**

1. **Lighthouse/TBT before-vs-after arm (the win, honestly framed).** On the public prod-profile host `erp.intuit.com`, a
   repeatable measurement compares **container-as-shipped** vs **`?martech=airlock`** and reports the **TBT / Lighthouse-score**
   delta. **The "after" arm is airlock-BOOTED, not tags-removed** — it carries the worker + four connector chambers + the
   main-thread suppressor intercepting script insertion on the ~14-template container — so the net win is **bounded above by
   the R-011 suppression ceiling (−389 ms / −63% TBT from removing the three ad tags) and may be materially smaller**; the
   measurement captures airlock's own in-config main-thread cost rather than assuming it negligible. Phrased as a **lab
   TBT/Lighthouse win** — NOT a field INP/LCP/CLS claim (A3: the ad tags are TBT-dominant, INP/CLS-neutral, LCP already good;
   R-011 found the INP effect null). Reuses / extends the 036 instrument (ADR-0018 E12).
2. **Beacon parity at the vendor boundary, per vendor — on the 038 harness.** For each of the four vendors, airlock's emitted
   beacon carries the **same attribution-bearing fields (modulo each connector's OWNED identity gap-map)** the container's
   captured native beacon does, judged by the **038 parity harness** — the per-protocol semantic oracle that normalizes
   native↔airlock shapes (already covers Google Ads `ccm/collect` + Floodlight `activity`/`ccm`; GA4/Meta ride the same
   engine). For **Meta** the gap is explicit: airlock's pixel connector is identity-free by construction (omits `_fbp`/`fbc`,
   `ud[em]/[ph]`; 038-04 re-owns `ud[em]/ph` to a signed-in follow-up), which the 038 oracle scores as owned/expected-dropped —
   so "parity" here means *protocol + non-identity fields*, not a claim airlock reproduces the container's identity payload.
   **The `martech.golden.json` diff is NOT the per-vendor oracle for the four** — that golden captures the container's *native*
   beacons and guards the **untouched** chain (050-01 AC4 runs `verify:martech` *minus* the four migrated vendors); reusing it
   *for* the four would need the same native↔airlock normalization the 038 harness already provides, so parity for the four
   rests on 038, not a silent second oracle. (If `intuit-erp`'s `martech-diff.mjs` is later shown to normalize native↔airlock
   for a vendor, it may *corroborate* 038 — verify its actual behavior before claiming it, don't assume it.)
3. **Event-level console receipt (developer-driven, lab).** A verified checklist that airlock's four beacons are received in
   the vendors' debug/realtime surfaces — **GA4 DebugView**, **Meta Test Events**, **Google Ads** conversion/tag
   diagnostics, **Floodlight** verification — captured as the developer-provable event-level parity evidence. **Access
   grounding (keeps AC5 honest):** this receipt needs the vendor consoles for the four properties; it is developer-provable
   because the developer holds that vendor-console access — OR runs the receipt against the developer's OWN test properties, in
   which case it proves *protocol conformance*, not intuit-attribution parity (state which was used). **Meta caveat
   (probe-observed):** `fbevents.js` loads but the container fired **no `/tr`** on a no-interaction load
   (`rig:erp-waterfall`), so the Meta receipt requires driving the pixel to actually fire (consent-accept / the tracked
   interaction) before it can be verified — don't record a Meta receipt off a load where the native pixel itself was silent.
   (No live attribution window — that is the ADR-0029 residual.)
4. **The scripted adoption-path doc (E8), vendor-neutral.** A new airlock guide (e.g. `docs/adoption/rewire-a-container.md`)
   documents the **repeatable developer procedure** generalized from 050-01: subtree the airlock dist → declare the migrated
   vendors' URL/query suppressor matchers (+ the airlock-egress carve-out) → `boot(config)` the connectors → measure
   (Lighthouse + parity + console receipt). Vendor-neutral (no intuit specifics in the recipe; the reference-site run is the
   worked example). Cross-linked from `mvp9.md` and `docs/adoption-readiness.md`.
5. **The developer-provable release-check is demonstrated.** The evidence (AC1–AC3) is recorded against mvp9's
   developer-provable subset (Lighthouse/TBT win + event-level parity + scripted path). **Zero container-owner dependency holds
   for the page-side suppress+emit+measure** (public `erp.intuit.com`, no Tealium container owner, no VPN). The **event-level
   receipt (AC3) is the one caveated leg**: consoles for the four *live* properties (GA4 `G-GCCMSJL6CT`, Ads `AW-1030811807`,
   Floodlight `DC-1996823`, the Meta pixel) are intuit's vendor accounts — an org-class grant, not intrinsically the
   developer's; the genuinely zero-dependency branch is the developer's OWN test properties, which prove *protocol conformance*,
   not intuit-attribution parity. Record which branch AC3 used, and if test-properties, mark the receipt as
   conformance-not-parity (no silent narrowing). The production live-attribution leg stays the container-owner-gated residual.

**DoD:**
- [ ] ACs met; evidence (Lighthouse deltas, `verify:martech` + 038 output, console-receipt checklist) captured and attached.
- [ ] The adoption-path doc reviewed by `reviewer` subagent (compliance + craft) — it is an airlock artifact.
- [ ] Deviation log + reconciliation sweep produced under this slice heading. If this closes spec 050, run the close-out
      (compress the primer's active-spec entry; memory-sync the reference-site rewire technique + the adoption path).
- [x] `mvp9.md` updated: the developer-provable subset marked demonstrated (evidence linked); the live-attribution residual
      restated. `docs/refinement-todo.md` updated with any residual.

**Anti-horizontal-phasing check:** after this slice, a developer has the measured Lighthouse/TBT win + per-vendor beacon
parity + event-level console receipt for the reference-site rewire, AND a repeatable, vendor-neutral guide to do it on any
container — the MVP9 developer-provable subset, proven and documented. Not intermediate state.

## Assumptions

- **A2 — prod-profile host access (public).** Production `erp.intuit.com` is public (no VPN, no container-owner); the arena,
  not a container-owner gate.
- **A3 — Lighthouse/lab-TBT framing** (not field CWV); AC1 phrases the win accordingly, bounded above by the R-011 −63% TBT
  suppression ceiling (the airlock-booted "after" arm can only be ≤ that).
- **Parity substrate — the 038 harness is the per-vendor oracle.** The 038 parity harness normalizes native↔airlock for the
  ad beacons (GA4/Meta ride the same engine); this slice rests per-vendor parity on it. `intuit-erp`'s `martech.golden.json`
  is a *native-beacon regression guard on the untouched tail*, NOT the per-vendor oracle for the four migrated vendors — so no
  silent second oracle (see AC2).

## Validation evidence (in-progress — 2026-09-17)

- **AC1 — Lighthouse/TBT ◻️ indicative bound measured; booted-arm carried.** `lh:r010` on `erp.intuit.com`, mobile slow-4G,
  median of 5: **TBT 487→127 ms (−360 ms, −74%)**, Lighthouse score 86→96, LCP/CLS flat — a lab TBT win, INP/LCP/CLS-neutral
  (full table + recon in [050-01 § Validation evidence](slice-01-reference-site-rewire-arm.md)). **Deviation from AC1's method:**
  this is `lh:r010`'s tags-**removed** network-block, NOT the airlock-**booted** after-arm AC1 specifies — airlock's own small
  main-thread boot cost (suppressor patching + worker spin-up) is not included, so the booted net win is ≤ this (the −74% exceeds the R-011 suppression
  ceiling because `lh:r010` blocks a wider set than R-011's 3 ad tags). A true booted before/after needs a deploy where airlock's
  workers run against the live container (the prod Chrome-Override inlines only the suppressor; the aem.live branch is
  auth-gated + dev-profile, no native four) — **carried** as a residual, logged in the deviation log at reconciliation.
- **AC2 — beacon parity ✅ (038 harness).** `vitest run test/parity-*.test.js` → **102 tests pass** across GA4, Google Ads,
  Floodlight (ccm + activity), Meta (+ advanced-matching), the oracle, and transport. Meta is identity-free by construction
  (owned/expected-dropped by the oracle) — parity = protocol + non-identity fields. `martech.golden.json` is NOT used as the
  per-vendor oracle (it guards the untouched tail).
- **AC3 — event-level console receipt ◻️ carried.** airlock's four beacons are receipt-shaped-correct per the 038 oracle, but
  the actual vendor-console receipt (GA4 DebugView / Meta Test Events / Ads / Floodlight) needs the developer's console access
  for the live properties (an org-class grant) OR the developer's own test properties (→ protocol conformance, not
  intuit-attribution parity). Carried as a named residual (not a silent narrowing), per AC5 + mvp9.md. Meta caveat: `/tr` is
  consent/interaction-gated.
- **AC4 — scripted adoption-path doc ✅.** [docs/adoption/rewire-a-container.md](../../adoption/rewire-a-container.md),
  vendor-neutral (5-step recipe + the zero-deploy Chrome-Overrides proof + limits), with the erp.intuit.com run as the worked
  example. Cross-linked from [mvp9.md](../../releases/mvp9.md) and [adoption-readiness.md](../../adoption-readiness.md).
- **AC5 — developer-provable release-check ✅ recorded.** [mvp9.md](../../releases/mvp9.md) § Release-Check marks the subset
  demonstrated (evidence linked); the event-level receipt + the container-owner-gated live-attribution leg restated as named
  residuals.

### Deviation log (after reconciliation)

- **AC1 measured as an indicative tags-REMOVED bound, not the airlock-BOOTED after-arm (method substitution).** AC1 specifies an
  airlock-booted after-arm (worker + 4 chambers + suppressor) that captures airlock's own main-thread cost "rather than assuming
  it negligible." The measurement delivered is `lh:r010`'s network-block of the four runtimes (tags-removed) → −360 ms TBT
  (487→127), which does **not** include airlock's own (off-main-thread) main-thread cost — the booted net win is ≤ this (the
  −74% exceeds R-011's ceiling because `lh:r010` blocks a wider set than R-011's 3 ad tags). **Why not booted:** on prod, Chrome
  Overrides can inline the suppressor but cannot serve airlock's same-origin workers, so airlock does not boot; the deployed
  aem.live branch boots airlock but is auth-gated (headless Lighthouse cannot reach) + dev-profile (no native four to compare
  against). A true booted before/after needs a real deploy to a prod-profile host — **carried** as a named residual
  (`refinement-todo.md` § Spec 050). Every surface (doc, `mvp9.md`, slice evidence) now states this as an indicative bound, not
  the booted win.
- **AC3 event-level console receipt carried (not met).** Run against neither the live vendor properties (org-class console
  access) nor the developer's own test properties (the zero-dependency conformance branch). airlock's beacons are
  receipt-shaped-correct per the 038 oracle (AC2, 102 tests pass), but the vendor-console receipt itself is a named residual
  (AC5's "no silent narrowing"); Meta `/tr` is additionally consent/interaction-gated.
- **The `intuit-erp` wiring is not an airlock-reviewed artifact** (ADR-0029 / spec framing) — it lives in the adopter repo; the
  airlock-reviewed deliverables here are the adoption-path doc + the release-check evidence.

### Reconciliation sweep

- **`docs/releases/mvp9.md`** — updated: developer-provable subset marked demonstrated (evidence linked); the three residuals
  (airlock-booted TBT, vendor-console receipt, live-attribution) restated in both summary framings + detail bullets.
- **`docs/refinement-todo.md` § Spec 050** — updated: the 050-02 arena/method entry, the AC1 indicative-bound framing, and the
  two carried residuals.
- **`docs/adoption/rewire-a-container.md`** — created (AC4), cross-linked from `mvp9.md` + `adoption-readiness.md`.
- **`docs/adoption-readiness.md`** — updated: a disambiguating pointer (adopting *jig* vs adopting *airlock*) → the rewire doc.
- **`docs/specs/README.md` (generated status board)** — regenerated (`workflow.py status-board`) to reflect 050-02 REVIEWED /
  050-01 IN_PROGRESS.
- **Architecture / module boundaries / contracts** — no-op: doc + evidence only; no airlock source or contract change (the
  intuit-erp wiring is the adopter's, not airlock code).
- **Glossary / conventions / ADRs** — no-op: no new terms/rules; the developer-provable demo technique is a *method* (captured
  in the doc + memory), not a load-bearing architecture decision with rejected alternatives → no ADR.
- **Memory** — updated: 3 learnings (`memory.py`) + the cross-session `spec050-rewire-live-validated-prod-override` note.
- **Inbox** — swept; nothing resolved by this slice.
- **Carried residuals** — AC1 airlock-booted TBT (deploy-gated) + AC3 console receipt (vendor-console-gated), both named in
  `refinement-todo.md` § Spec 050; not silently narrowed.
- **Primer hygiene / close-out** — deferred: spec 050 is not yet closed (050-01 is IN_PROGRESS; 050-02 DONE is gated on it).
