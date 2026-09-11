# Release Slate

This slate is a compact view of release plans that matter right now. It is not
a backlog, not a roadmap, not a sprint plan, and not a second JIG status board.
JIG remains the source of truth for implementation lifecycle state.

Keep entries short. Link to release plans and, when useful, JIG specs or slices
without copying JIG lifecycle status. Remove dropped or deferred ideas once
they stop informing a current release decision.

> **1.0 = MVP9's release-check** ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md), 2026-09-05 reframe): 1.0 means *adoptable with confirmed parity* — a dev rewires an intuit-class site's TBT-dominant generic vendor tags onto airlock with vendor-boundary parity. The `MVPn ↔ v0.n.0` convention continues; passing **MVP9**'s release-check cuts **v1.0.0**. ADR-0017's frozen API is now "the stable core", not "the 1.0 pin".

## Candidate

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| [MVP8 — Ad-Conversion Offloading](mvp8.md) | The TBT that motivates the rewire lives here: **Google Ads + Floodlight** connectors (gated on R-009's AW/DC findings) + the **OneTrust consent-input driver**; Segment variable/later. Ships v0.8.0 | JIG handoff: Google Ads / Floodlight connector specs + OneTrust driver (E7), gated on R-009 |
| [MVP9 — Real-Site Rewire & Adoption Path](mvp9.md) | **Passing its release-check cuts v1.0.0.** Rewire the four generic vendors on an intuit-class site (two-party, with the container owner), parity-confirmed by the harness + vendor consoles, CWV measured; the scripted adoption path. Ships v0.9.0 → **v1.0.0** | JIG handoff: real-site rewire spec, 036-instrument extension (E12), scripted adoption path (E8) |

## Committed

| Release plan | Why it matters now | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |

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
| [MVP7 — Pixel Parity & the Parity Harness](mvp7.md) | Shipped as **v0.7.0** (2026-09-11) — the vendor-generic parity harness (038) + the GA4 gtag-protocol connector (039/ADR-0019) + Meta advanced matching (026-04/ADR-0022) with `ud[external_id]` field-presence parity confirmed (038-04); the GET-critical unload dispatcher (042). Release-check met; the `v0.7.0`/`dist-v0.7.0` cut (E1) runs via `npm version minor`. Residuals carried to MVP9: signed-in `em`/`ph` capture, same-input efficacy | JIG handoff: [038](../specs/038-parity-harness/spec.md), [039](../specs/039-ga4-gtag-connector/spec.md), [026](../specs/026-generic-pixel-connector/spec.md), spec 042 |

## Dropped

List only currently relevant dropped or no-go release plans. This section is
not an archive of every idea the project declined.

| Release plan | Why it still matters | Handoff notes |
|---|---|---|
| _None yet_ | _-_ | _-_ |
