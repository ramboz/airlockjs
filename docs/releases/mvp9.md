# Release Plan: MVP9 — Real-Site Rewire & Adoption Path

> **New plan, 2026-09-07 ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E3).**
> **Passing this plan's release-check IS the v1.0.0 cut.** 1.0 = adoptable with confirmed parity: MVP6 shipped the
> stable core + the harness, MVP7 proved pixel/GA4 parity + the parity harness, MVP8 offloaded the ad-conversion tags —
> MVP9 does the thing 1.0 *means*: rewire an intuit-class site's TBT-dominant generic vendor tags onto airlock, prove
> parity in the vendor consoles and the CWV win with the harness, and ship the scripted adoption path a developer
> follows to repeat it.

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
  intuit-class) site: the container stops firing them (same-host, query-gated native filter rules published to the
  production profile — the after-arm that avoids spec 036's cross-deployment confound), airlock emits the equivalent
  governed, off-thread beacons.
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

- **Container-owner cooperation is the load-bearing dependency** (ADR-0018 kill criterion). No lab profile + no console
  access + no production live window ⇒ 1.0 waits; the owner re-decides (another site, or an explicitly re-decided bar —
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

- Gated on **container-owner cooperation** + an available intuit-class site (ADR-0018 Assumptions + kill criteria).
- New specs: the **real-site rewire** (config + boot for the four vendors on the site), the **036 instrument extension**
  to the rewire arms with win semantics (ADR-0018 E12), and the **two-sided scripted adoption path + adopter docs**
  (ADR-0018 E8).
- On a passing release-check: **cut v1.0.0** (version bump + `dist-v1.0.0` tag; the literal major-break rule of ADR-0017
  resumes at 1.0.0).

## Release-Check Criteria (vendor-generic — this is the 1.0 gate)

- The four generic vendor tags (GA4, Meta Pixel, Google Ads, Floodlight) are **rewired from the container to airlock** on
  a real intuit-class site.
- **Parity confirmed** at the vendor boundary: the parity harness passes (per-protocol semantic oracle, both cookie
  cohorts) **and** the vendor consoles agree — event-level receipt (lab) **and** attribution over a live window
  (production).
- **CWV win measured** on the rewire arms (036 instrument, E12): the after-arm reaches the CWV "good" band / the site's
  pre-martech Lighthouse band, against both container baselines.
- A **documented, scripted two-sided adoption path** exists (developer steps + container-owner checklist) — a developer
  with automation skills can repeat the rewire.
- **No customer-custom tag** is a deliverable or gate; **no live identifiers** in committed artifacts.
- No regression to the stable-core contract or any MVP1–8 connector.

_No servo release-signal artifact exists for this plan yet; the release-check criteria are the 1.0 gate — desired
future evidence, not measured signals._

_Shaped 2026-09-07 (ADR-0018 Emergent E3) — "Real-Site Rewire & Adoption Path", ships as v0.9.0; passing its
release-check cuts **v1.0.0**._
