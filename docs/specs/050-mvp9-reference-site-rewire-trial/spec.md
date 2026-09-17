---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 050: MVP9 reference-site rewire trial (validation + adoption path)

## Overview

This spec produces MVP9's **developer-provable** evidence ([ADR-0029](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)):
rewire an intuit-class reference site's four TBT-dominant vendor tags (GA4, Meta Pixel, Google Ads, Floodlight) from its
Tealium container onto airlock — **page-side, with no container-owner / Tealium-profile change** — and measure the
**Lighthouse/TBT win** + **event-level parity** it delivers. It is airlock's [ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)
E8 **scripted adoption path** made concrete + validated against a real site.

**Cross-repo shape (read this first).** Two repos, both the developer's:

- **airlock** (this jig project) owns + reviews the reusable deliverables: the **native-tag suppressor**
  ([spec 049](../049-native-tag-suppressor/spec.md), the page-side after-arm), the **`dist-vX.Y.Z` subtree**
  ([spec 031](../031-distribution-setup/spec.md)), the **parity harness** ([spec 038](../038-parity-harness/spec.md)), and
  the **scripted adoption-path doc** (a new airlock guide) + the **reference-site validation evidence** this spec produces.
- **intuit-erp** (the reference adopter's EDS/Franklin repo — NOT jig-scaffolded, so it carries no jig spec) is where the
  **application** lands: a `?martech=airlock` gate that subtrees the airlock dist, installs the suppressor with the four
  vendors' matchers, and `boot(config)`s the four connectors. This spec **directs** that wiring (grounded with intuit-erp
  file references) and treats it as the adopter-side application of the adoption path — it is not reviewed as airlock code;
  the airlock-reviewed artifacts are the adoption-path doc + the validation evidence.

**What already exists (do NOT rebuild):** the four connectors + `boot(config)` (MVP7/MVP8, DONE); the parity harness (038)
already covering the ad beacons (`test/parity-google-ads.test.js`, `parity-floodlight-*.redacted.json`); intuit-erp's OWN
capture→diff harness (`scripts/diff/martech-diff.mjs` + `martech.golden.json`, run via `npm run verify:martech`) and its
`clicktrack`/`appvars` regression goldens; intuit-erp's query-gate idiom (`?martech=off`/`=local`) the `?martech=airlock`
gate extends. This spec is **application + measurement + documentation**, not new connector or runtime behavior.

**The four vendor IDs (probe-confirmed live on `erp.intuit.com` via `npm run rig:erp-waterfall`):** GA4 `G-GCCMSJL6CT`,
Google Ads `AW-1030811807`, Floodlight `DC-1996823` — each observed on its OWN separable `gtag/js?id=…` runtime, all in-repo;
the **Meta numeric pixel id** lives only in the runtime `utag.21.js` template (confirmed loading from the
`intuit/ies-erp/prod` container) and is extracted from the live container during 050-01.

## Assumptions

_Load-bearing claims; probe-grounded ones cited, unverified ones flagged (risk-gated per ADR-0020)._

- **A1 (satisfied 2026-09-16) — spec 049's suppressor is built + carried in a cut airlock dist.** 049 is DONE; a floating
  `origin/dist` was cut (`airlockjs v0.8.0+dc5d5c3`) carrying `tag-suppressor.js` as a served sibling (049-01 AC6). 050-01's
  demo used a local-build copy of that dist; a production adopter `git subtree add`s `origin/dist` (spec 031).
- **A2 — the four-vendor prod Tealium profile resolves on `erp.intuit.com`** (ADR-0029, grounded:
  `intuit-erp/plugins/tealium-martech/src/index.js`'s `resolveEnvironment` maps that host to `prod`; localhost + AEM previews
  resolve to the `dev` profile, and no query-string escalates). **Probe-confirmed** (`rig:erp-waterfall`): the profile path is
  `utag/intuit/ies-erp/prod` and production `erp.intuit.com` is **public** — reachable in-sandbox headless, **no VPN, no
  container-owner**. So the **measurement arena** is public production `erp.intuit.com` (stage is VPN-gated *and* dead since
  2026-09-11), not localhost — the developer-provable claim holds without any org or container-owner gate.
- **A3 — the win is a Lighthouse/lab-TBT win, not a field-CWV improvement** (ADR-0029): the reference ad tags are
  TBT-dominant and INP/CLS-neutral, LCP already ~1.4 s. 050-02 phrases the win honestly.
- **A4 (RISK-GATED, probe-de-risked) — blocking the four vendor runtimes does not collapse the untouched tags or the custom
  ECS chain.** The suppressor is pattern-scoped (049) and the `clicktrack`/`appvars` goldens guard the rest; the probe
  (`rig:erp-waterfall`) de-risks this — the three Google vendors load on their own separable `gtag/js?id=<AW|DC|G>` runtimes,
  distinct from the container's other ~13 `utag.N.js` templates, so per-`?id=` suppression cannot drag a non-migrated tag.
  The page-side interaction on THIS live container is still validated in 050-01 (goldens stay green under `?martech=airlock`)
  before the win is claimed — the ADR-0030 kill criterion for this site.

## Decomposition

**SPIDR — Path axis (get the rewire arm working end-to-end, then measure + generalize).** No Spike: the mechanism is decided
(049 suppressor + `boot(config)`); the unknowns (Meta id extraction, goldens-stay-green under the live container) are
grounded inside 050-01, whose deliverable is the working arm. Both slices are vertical: each delivers observable
reference-site value (a working suppressed+rewired arm; then the measured win + parity evidence + the repeatable guide),
never a config-only or doc-only horizontal shard.

- **050-01 (Path — the reference-site `?martech=airlock` rewire arm):** apply the adoption path to intuit-erp — subtree the
  airlock dist, add a `?martech=airlock` gate that installs the suppressor with the four vendors' URL/query matchers and
  `boot(config)`s the four connectors (real IDs; Meta id extracted from the live container). Observable: on a
  `?martech=airlock` load of a prod-profile host, the four container tags are suppressed and airlock emits the four
  equivalents, while the untouched tail + ECS chain stay green (the `clicktrack`/`appvars` goldens). Depends on A1.
- **050-02 (Path — the measured win + parity evidence + the scripted adoption path):** produce the developer-provable
  release-check evidence — the **Lighthouse/TBT** before-vs-after arm (container-as-shipped vs `?martech=airlock`), the
  **beacon parity** (the 038 harness + intuit-erp's `martech-diff` against the golden: airlock's four beacons carry the same
  attribution-bearing fields), and the **event-level console receipt** checklist (GA4 DebugView / Meta Test Events / Google
  Ads / Floodlight diagnostics) — and finalize the **scripted adoption-path doc** (E8) generalized from 050-01. Depends on
  050-01 + A2 (prod-profile host access).

## Slices

- [050-01 — the reference-site `?martech=airlock` rewire arm](slice-01-reference-site-rewire-arm.md)
- [050-02 — measured Lighthouse/TBT + parity evidence + scripted adoption path](slice-02-validation-and-adoption-path.md)

## Out of scope

- **The production live-attribution window** — the container-owner-gated MVP9 residual (ADR-0029): no `?martech=airlock` arm
  defaulted for real-user production traffic (that would suppress real users' conversions — the container owner's call).
- **Vendors beyond the four generic** — LinkedIn / Bing are trivially addable (airlock has the connectors) but are not the
  1.0 gate; the customer-custom ECS/TrackStar/Segment chain is **never** suppressed or shipped (ADR-0018 R2).
- **Scaffolding intuit-erp with jig** — the adopter wiring lands in intuit-erp under its own conventions; this airlock spec
  directs it, it does not impose jig on the customer repo.
- **The suppressor mechanism itself** — spec 049 (this spec consumes it).

## References

- [ADR-0029 — MVP9 after-arm is page-side and developer-controlled](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)
- [ADR-0030 — Vendor-generic native-tag suppressor](../../decisions/adr-0030-native-tag-suppressor.md)
- [spec 049 — native-tag suppressor](../049-native-tag-suppressor/spec.md) (the page-side after-arm this trial consumes)
- [releases/mvp9.md](../../releases/mvp9.md) (§ Release-Check — the developer-provable subset this spec proves)
- [spec 038 — parity harness](../038-parity-harness/spec.md) (the per-protocol semantic oracle for beacon parity)
- [spec 031 — distribution setup](../031-distribution-setup/spec.md) (the `git subtree` dist the adopter consumes)
- intuit-erp: `plugins/tealium-martech/src/index.js` (`loadUtag` / `resolveEnvironment` / the `?martech=` idiom),
  `scripts/diff/martech-diff.mjs` + `martech.golden.json` (`npm run verify:martech`), `MARTECH.md`.
