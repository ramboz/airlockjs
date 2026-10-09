# Release Slate

This slate is a compact view of release plans that matter right now. It is not
a backlog, not a roadmap, not a sprint plan, and not a second JIG status board.
JIG remains the source of truth for implementation lifecycle state.

Keep entries short. Link to release plans and, when useful, JIG specs or slices
without copying JIG lifecycle status. Remove dropped or deferred ideas once
they stop informing a current release decision.

> **Next major release: Adobe Compatibility & Adoption -> v1.0.0**
> ([ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md), owner decision 2026-10-06).
> Investigate first, then target full pinned Alloy.js compatibility and validated Adobe Web SDK-connected
> workflows through an Airlock-backed `aem-martech` adoption path. This replaces MVP9 as the v1.0 gate;
> its third-party gaps and unclosed evidence remain open. ADR-0017's stable core remains frozen.
> Shaper is unavailable in the current authoring session; these plans retain the repository's existing
> release-plan format, with no external Shaper state or release-signal artifact claimed.

## Candidate

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [Vendor Parity & Adoption Assurance](vendor-parity-assurance.md) | Scoped reports, identity/conversion/transport fidelity and customer outcome evidence; post-Adobe candidate, no version committed | Existing 026/038-048 foundations; one observed vendor/journey at a time |
| [Granular Chamber Policy](granular-chamber-policy.md) | Per-input/capability grants, revocation and retention; candidate, with Adobe-critical dependencies pulled forward | Policy contract and lifecycle/security decision before implementation |

## Committed

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [Adobe Compatibility & Adoption](adobe-compatibility.md) | **The new v1.0 gate.** Owner-selected on 2026-10-06; begin with API-led test-environment access and a pinned SDK compatibility investigation | [R-012](../research/R-012-adobe-first-compatibility.md); [clean-session goal brief](adobe-compatibility-goal.md); bounded investigation before broad build |

## Shipping

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |

## Shipped

Recently shipped release plans stay here only while they inform current decisions.

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [MVP1](mvp1.md) | Martech is the dominant source of CWV regression and a live supply-chain risk, | JIG handoff: [probes/eds-testbed](../../probes/eds-testbed/), [contracts/](../../contracts/README.md) |
| [MVP2](mvp2.md) | MVP1 proves the runtime and the **wire-protocol** connector archetype (GA4, | JIG handoff: [MVP3](mvp3.md), [spec 011](../specs/011-mvp2-coherency-probe/spec.md), [spec 012](../specs/012-mvp2-alloy-chamber/spec.md) |
| [MVP3](mvp3.md) | MVP2 proves alloy isolates and runs in a chamber but deliberately leaves its I/O seams unsecured and alloy's config-driven behaviour uncharacterized. MVP3 secures the seams (ADR-0006/0007 enforcement) against alloy's real, measured behaviour — turning the declaration shape established in MVP2 into enforced least-privilege. | JIG handoff: [spec 012-04 §Findings](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) |
| [MVP4 — The Core AEM Stack (governed alloy + RUM)](mvp4.md) | **The maintainer's framing (2026-08-31):** the *core of any AEM / Adobe site* is **GA4 + Adobe Experience | No JIG handoff linked. |
| [MVP5 — Inspector & the RUM Layer (make it visible, own the observability)](mvp5.md) | Shipped as **v0.5.0** — the enforcement inspector (028), the before/after CWV scoreboard (029), and airlock-as-RUM-authority / the *replace* decision (030) | JIG handoff: [028](../specs/028-enforcement-inspector/spec.md), [029](../specs/029-cwv-scoreboard/spec.md), [030](../specs/030-rum-subsume/spec.md) |
| [MVP6 — Stable Core & Validation Harness](mvp6.md) | Shipped as **v0.6.0** (2026-09-07) — distribution (031), cookie-grant hardening (035), the stable-core contract (037/ADR-0017), the real-site CWV harness + subset smoke (036); the v0.6.0 version-bump/dist-tag cut (E1) ran | JIG handoff: [031](../specs/031-distribution-setup/spec.md), [035](../specs/035-cookie-grant-wrapper/spec.md), [036](../specs/036-real-site-validation-harness/spec.md), [037](../specs/037-one-point-oh-api-pin/spec.md) |
| [MVP7 — Pixel Parity & the Parity Harness](mvp7.md) | Shipped as **v0.7.0** (2026-09-11) — parity harness, GA4 gtag, Meta advanced-matching presence and GET-critical unload. Signed-in captures and matching efficacy remain with the vendor-assurance candidate | JIG handoff: [038](../specs/038-parity-harness/spec.md), [039](../specs/039-ga4-gtag-connector/spec.md), [026](../specs/026-generic-pixel-connector/spec.md), spec 042 |
| [MVP8 — Ad-Conversion Offloading](mvp8.md) | Shipped as **v0.8.0** (2026-09-14) — page-load Ads/Floodlight connectors and OneTrust composite held-to-flush. True conversion/attribution and the booted rewire win remain unclosed; now routed to vendor assurance, not prerequisites for Adobe-first v1.0 | JIG handoff: [044](../specs/044-google-ads-connector/spec.md), [046](../specs/046-floodlight-connector/spec.md), [047](../specs/047-onetrust-consent-input-driver/spec.md), [048](../specs/048-ad-connector-boot-wiring/spec.md) |

## Carried work — no longer the v1.0 gate

| Release plan | Why it remains visible | Handoff notes |
|---|---|---|
| [MVP9 — Real-Site Rewire & Adoption Path](mvp9.md) | Spec 050's demonstrated suppression/emission and indicative bound survive; booted TBT, console receipt, tail goldens, consent-transition and live attribution remain open | Candidate/parked in priority; optional v0.9.0 cut requires a separate owner action. Follow-up evidence routes to vendor assurance |

## Dropped

List only currently relevant dropped or no-go release plans. This section is
not an archive of every idea the project declined.

| Release plan | Why it still matters | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |
