# Release Plan: MVP9 — Real-Site Rewire & Adoption Path

> **New plan, 2026-09-07 ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E3).**
> **Passing this plan's release-check IS the v1.0.0 cut.** 1.0 = adoptable with confirmed parity: MVP6 shipped the
> stable core + the harness, MVP7 proved pixel/GA4 parity + the parity harness, MVP8 offloaded the ad-conversion tags —
> MVP9 does the thing 1.0 *means*: rewire an intuit-class site's TBT-dominant generic vendor tags onto airlock, prove
> parity in the vendor consoles and the CWV win with the harness, and ship the scripted adoption path a developer
> follows to repeat it.
>
> **Reframed 2026-09-15 ([ADR-0029](../decisions/adr-0029-mvp9-developer-side-after-arm.md) +
> [ADR-0030](../decisions/adr-0030-native-tag-suppressor.md)).** The after-arm is now **page-side and
> developer-controlled** — a vendor-generic native-tag suppressor in the adopter's OWNED EDS repo, gated by
> `?martech=airlock`, not a Tealium profile change. This **splits MVP9's 1.0 bar honestly**: the **developer-provable
> subset** — the **Lighthouse/TBT win** + **event-level parity** (harness + vendor DebugView/Test-Events) + the **scripted
> adoption path** — is provable with **zero container-owner dependency** (the primary route below); the **production
> live-attribution window** is NOT developer-closable and **re-inherits ADR-0018's container-owner gate** (a query-gated
> arm collects no natural traffic, and defaulting it for real users suppresses their live conversion tracking — a
> container-owner revenue decision). So the ladder can now reach the developer-provable subset without customer
> cooperation; only the live-attribution leg still waits on the container owner.

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

**Ships as v0.9.0, and passing its release-check cuts v1.0.0.** `candidate`; sequenced after MVP8 (v0.8.0). This is the
1.0 gate — its release-check is phrased **vendor-generically** (never on a customer-custom tag, ADR-0018 R2).

## Problem / Baseline

- **Everything before MVP9 is capability; MVP9 is proof.** The stable core (MVP6), the parity harness + pixel/GA4 parity
  (MVP7), and the ad-conversion connectors (MVP8) are all built and lab-proven. But 1.0 means a developer can *actually
  adopt* airlock on a real intuit-class site for its real problem — and that has not been done. The reference site is an
  AEM EDS migration whose Lighthouse score collapses (100 → ~60) under a customer-owned Tealium container.
- **The rewire is two-party** (ADR-0018). The reference site's container is customer-owned (`ies-erp` Tealium profile):
  it owns tag delivery, the OneTrust→category mapping, and Consent Mode v2. The developer cannot produce the proof
  alone — the after-arm (the four tags natively excluded) and the vendor-console access are the **container owner's** to
  provide. This plan is gated on that cooperation, and on a genuinely available intuit-class site.
- **There is no scripted adoption path.** Even with every connector built, a developer needs a documented, repeatable
  procedure: airlock config for the four vendors, boot, capture → replay → harness run, and the container-owner
  checklist (the same-host query-gated native exclusion, the production live window, console access).

## Appetite

- **Fixed-outcome, variable-time (this is the 1.0 gate, not a timeboxed feature box).** The outcome — a real rewire,
  parity-confirmed, CWV-measured, with a scripted path — is fixed; the time flexes on container-owner cooperation and
  site availability. If cooperation cannot be obtained within the ladder's horizon, the ladder pauses at v0.9.0 and the
  owner re-decides (ADR-0018 kill criterion), rather than cutting 1.0 on synthetic or lab-only evidence.

## Solution Outline

- **Rewire the four generic vendors** (GA4, Meta Pixel, Google Ads, Floodlight) on the reference (or an equivalent
  intuit-class) site, airlock (vendored as the `dist-vX.Y.Z` subtree) emitting the equivalent governed, off-thread beacons.
  **The after-arm is page-side and developer-controlled** (ADR-0029/0030): a `?martech=airlock`-gated, vendor-generic
  native-tag suppressor in the adopter's own EDS repo drops the four vendors' runtime scripts + beacons (URL/query-scoped,
  carving out airlock's own egress) before the container loads — no Tealium profile change. **For the production
  live-attribution window only**, the profile-side native-exclusion route (same-host, query-gated rules on the production
  profile) remains the container owner's action (the live-attribution leg re-inherits ADR-0018's gate).
- **Confirm parity at both console levels** (ADR-0018): **event-level receipt** on a lab profile (Meta Events Manager /
  Test Events, GA4 DebugView + realtime, Google Ads conversion diagnostics, Floodlight verification) — developer-driven;
  and **attribution** over a **live comparison window** in production (view-through / cross-device / CM360) — the
  container owner's production ask, observable only under live traffic.
- **Measure the CWV win** with the spec-036 instrument extended to the rewire arms (E12 win semantics): the container as
  shipped (baseline 1) and its best phased configuration (baseline 2) vs the four tags excluded + airlock — the after-arm
  must bring the reference page into the CWV "good" band / back to the site's pre-martech Lighthouse band (the CWV kill
  criterion).
- **Ship the two-sided scripted adoption path + adopter docs** (E8): the developer's steps and the container-owner
  checklist.

## Risks / Rabbit Holes

- **Container-owner cooperation is the load-bearing dependency — but now ONLY for the live-attribution leg** (ADR-0029
  narrows ADR-0018's two-party dependency). The developer-provable subset (Lighthouse/TBT win + event-level lab parity +
  scripted path) no longer waits on the owner — it runs off the page-side `?martech=airlock` after-arm. For the live window:
  no console access + no live cohort ⇒ that leg waits; the owner re-decides (another site, or an explicitly re-decided bar —
  e.g. event-level receipt as the 1.0 gate with attribution carried as a named post-cut residual). **Never** a silent
  narrowing to oracle-only or lab-only.
- **Attribution is only observable live.** A lab spike cannot stand in for the production window; a divergence the lab
  couldn't see withholds 1.0.
- **The CWV win may be modest** if the container's fixed cost (utag core, remaining template init, the customer's ECS
  chain, OneTrust — all out of scope by R2) dominates. R-010 (MVP7) gives an early indicative bound; the CWV kill
  criterion makes a modest result visible, not absorbable.
- **The reference site runs no Adobe Web SDK**, so this rewire proves the four generic vendors, not alloy; alloy's
  real-site proof is a separate, non-1.0-gating residual on an Adobe-stack site.

## No-Gos

- **No customer-custom tag as a release deliverable or gate** (ADR-0018 R2) — the reference site's ECS/TrackStar/UX-Fabric
  chain + its 161-beacon golden sample are **validation-only** (a regression guard that the rewire left the untouched
  custom chain intact), never shipped and never a 1.0 gate. The release-check is phrased vendor-generically.
- **No cutting 1.0 on synthetic, lab-only, or oracle-only evidence** — the vendor consoles under live traffic are
  required (or the bar is explicitly re-decided by the owner).
- **No live vendor identifiers in committed fixtures** — real captures stay local + redacted (ADR-0018 R5).
- **No non-EDS adapters, no SW chokepoint, no identity store** (standing vision no-gos) — 1.0 is EDS-first.

## JIG Handoff

- **Developer-provable subset gated only on an available intuit-class site** (the developer's own `intuit-erp` repo);
  **container-owner cooperation gates only the live-attribution leg** (ADR-0029/0030 narrow ADR-0018's dependency).
- Specs authored (DRAFT, 2026-09-15): **[spec 049 — native-tag suppressor](../specs/049-native-tag-suppressor/spec.md)**
  (ADR-0030 — the vendor-generic, config-driven, URL/query-scoped page-side after-arm, shipped in the dist) and
  **[spec 050 — MVP9 reference-site rewire trial](../specs/050-mvp9-reference-site-rewire-trial/spec.md)** (the
  `?martech=airlock` application on `intuit-erp` + the Lighthouse/TBT + parity + event-level validation + the scripted
  adoption path E8, folding in the 036-instrument extension E12). 050 depends on 049 built + a dist cut, and on prod-Tealium-
  profile host access (stage/VPN) for the measurement.
- On a passing release-check: **cut v1.0.0** (version bump + `dist-v1.0.0` tag; the literal major-break rule of ADR-0017
  resumes at 1.0.0).

## Release-Check Criteria (vendor-generic — this is the 1.0 gate)

**Developer-provable subset — NO container-owner dependency (ADR-0029/0030); the primary local route:**

- The four generic vendor tags (GA4, Meta Pixel, Google Ads, Floodlight) are **rewired from the container to airlock** on a
  real intuit-class site, the after-arm achieved page-side via the `?martech=airlock` suppressor — **no Tealium profile
  change**.
- **Parity confirmed at the vendor boundary (event-level, lab):** the parity harness passes (per-protocol semantic oracle,
  both cookie cohorts) **and** event-level receipt agrees in the vendor consoles' lab/debug surfaces (GA4 DebugView, Meta
  Test Events, Google Ads / Floodlight diagnostics) — all developer-driven.
- **Lighthouse/TBT win measured** on the rewire arms (036 instrument, E12): the after-arm restores the site's
  TBT/Lighthouse band against both container baselines. (A lab TBT/Lighthouse win — the reference site's ad tags are
  TBT-dominant and INP/CLS-neutral, LCP already good, so **no** field INP/LCP/CLS improvement is claimed — ADR-0029.)
- A **documented, scripted adoption path** exists (developer steps) — the `?martech=airlock` gate + airlock config + the
  diff run ARE the repeatable procedure.

**Container-owner-gated — the live-attribution leg (re-inherits [ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md); carried until the container owner engages):**

- **Attribution over a live production window** (view-through / cross-device / CM360) confirmed in the vendor consoles under
  live traffic. **Not developer-closable** — defaulting the arm for real users suppresses their live conversion tracking (a
  container-owner revenue decision); revisited with the container owner after the developer-provable subset passes. Per
  ADR-0018's own kill criterion the owner may re-decide the 1.0 bar here (event-level receipt as the gate, attribution a
  named post-cut residual) — **never** a silent narrowing to lab-only.

**Throughout:**

- **No customer-custom tag** is a deliverable or gate; **no live identifiers** in committed artifacts.
- No regression to the stable-core contract or any MVP1–8 connector.

_No servo release-signal artifact exists for this plan yet; the release-check criteria are the 1.0 gate — desired
future evidence, not measured signals._

_Shaped 2026-09-07 (ADR-0018 Emergent E3) — "Real-Site Rewire & Adoption Path", ships as v0.9.0; passing its
release-check cuts **v1.0.0**._
