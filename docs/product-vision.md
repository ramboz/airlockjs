> Status: Living document — reflects work shipped through v0.8.0 (MVP8).

# Product Vision — Airlock

> **Codename: Airlock.** Repo / package slug: `airlockjs` (bare `airlock` is taken on npm; the codename stays clean regardless of the published string). Connector namespace: `airlock/<vendor>` (e.g. `airlock/ga4`, `airlock/pixel/meta`, `airlock/google-ads`, `airlock/floodlight`).
>
> The name carries both halves of the thesis at once: an airlock is *fault-isolation* (one side depressurizing doesn't kill the other — a broken tag must not sink the page) and *mediated egress* (nothing crosses without cycling through the chamber — the capability boundary). It gives the system a consistent vocabulary: the mediated boundary is **the airlock**; a connector runs in a **chamber**; a batch crossing to the worker is a **cycle** / **lock-through**; consent and allowlist gating is **the seal** ("held at the seal" = queued pending consent).
>
> **Where we are (2026-09-14).** This vision has been through clarify / analyze / arch-review and is maintained against shipped work. As of **v0.8.0 (MVP8)** the runtime substrate, the event-log-plus-projection datalayer, the worker chamber runtime, CWV-safe content injection, and consent gating at the seal all ship — with connectors for GA4 (Measurement-Protocol **and** gtag `/g/collect`), a generic pixel (Meta / LinkedIn / Bing), Google Ads, Floodlight, and helix-rum, plus a wrapped-SDK alloy chamber and a OneTrust consent-input driver. **1.0 = adoptable with confirmed parity** ([ADR-0018](decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)) — cut when a real intuit-class site's TBT-dominant vendor tags are rewired from its Tealium/GTM/Launch container onto airlock with vendor-boundary parity (MVP9). See [the release slate](releases/README.md).

## Identity

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:68d4bb5b04e1 -->

Airlock is a capability-secured, off-main-thread martech runtime for edge and static sites (AEM Edge Delivery Services first; Astro, Vercel and Jamstack a post-1.0 direction, not committed). Tags stop being ambient-authority scripts injected into the page context and become **sandboxed consumers of a typed event stream that can only emit declared events to declared endpoints** — each running in an isolated chamber, reaching the network only by cycling through the airlock. It installs as drop-in ES modules (no worker infrastructure or edge account required for the common case), is Core-Web-Vitals-first by construction, and treats the datalayer, performance, and supply-chain-security problems as a single architectural boundary rather than three features.

## Target users

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:adec9c95eec2 -->

Primary: EDS / Jamstack developers and agencies who must guarantee 100 Lighthouse and passing CWV to clients, and whose performance story currently collapses the moment martech is added. Secondary: performance- and security-conscious martech engineers who own tag stacks and datalayers and are tired of fighting GTM/Launch/Tealium for INP and TBT. Tertiary (buyer, not user): compliance and security stakeholders who care about supply-chain / formjacking exposure in the tag layer — a concern no current TMS addresses.

## Core problem

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:1b22462941b8 -->

Martech is the dominant source of CWV regression and a live supply-chain risk, and today's tools address neither structurally. The synchronous `dataLayer.push` fan-out runs tag work inside the interaction, wrecking INP/TBT; blocking client-side decisioning gates LCP; late-injected content causes CLS. Simultaneously, every tag runs in the page with ambient DOM and cookie access, so a single compromised tag can read form fields and exfiltrate data (Magecart / formjacking). Existing tag managers optimize *when* code loads; none change *where* it executes or *what* it is allowed to touch. That "where/what" is the unaddressed layer.

## Competitive landscape

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:d5a841d17bd4 -->

GTM / Adobe Launch / Tealium: main-thread, ambient-authority, optimize load timing only. Partytown: proved worker-hosted third-party scripts, but transparent DOM proxying needs synchronous access, forcing blocking SW round-trips or SharedArrayBuffer+COOP/COEP, which breaks common embeds. Cloudflare Zaraz: runs tools off-page at the edge, but is Cloudflare-locked and opaque. adobe-rnd/aem-martech: decomposes the Launch monolith into phased eager/lazy/delayed loading and is prerender-aware — validates the wedge — but is Adobe-only, entirely main-thread, and has no isolation story. adobe/aem-experimentation: client-side decide-and-apply in the eager window achieves no-flicker personalization without an anti-flicker snippet — proves the pattern — but is coupled to Adobe analytics reporting. The gap Airlock fills: an open, portable, off-main-thread, capability-isolated, vendor-neutral runtime shaped for the fast-static ecosystems.

## Scope

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:9ea6772ed8ad -->

In scope: the runtime substrate (main-thread capture-and-enqueue, worker-side drain/mapping/egress); the event-log-plus-projection datalayer; the worker connector runtime (chambers); capability-mediated DOM injection and egress; EDS three-phase integration; both connector archetypes — wire-protocol (GA4, generic pixel, Google Ads, Floodlight) and wrapped-SDK (alloy) — plus the helix-rum RUM authority; CWV-safe content injection; consent gating at the seal; and first-class diagnostics/inspector.

Out of scope (explicit no-gos for the first releases): session replay / full DOM-mutation streaming (antagonistic to "no DOM access"); identity resolution and a first-party cookie store (airlock reads existing vendor cookies read-only, but never mints identity or keeps its own cookie store); the service-worker egress chokepoint (MVP uses direct keepalive; SW is a later progressive enhancement); edge decision/egress *drivers* (the seams exist from day one, the drivers come later); non-EDS framework adapters (a post-1.0 direction; EDS is the only supported adapter through 1.0).

**The adoption direction, post-1.0 ([ADR-0018](decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)).** The 1.0 rewire (MVP9) is a *manual, two-party, documented* procedure — a developer, working with the container owner, moves the TBT-dominant generic vendor tags onto airlock. The longer-horizon simplifier is a **container translator**: take a Tealium / GTM / Adobe Launch container as input and auto-translate it to an airlock config (self-hosting + rewrapped loading of the individual tags). It is explicitly **not a first-release deliverable** — it is post-1.0 (1.1), bounded by connector coverage; parked with its decomposition in [docs/inbox.md](inbox.md).

## Use cases

<!-- elicited: 2026-10-06 / status: filled / hash: sha256:b9144bb991eb -->

The catalog covers customer measurement scenarios **and integrator/operator workflows** (owner-confirmed,
2026-10-06). UC-1 through UC-3 retain their original MVP-demo identities; the later entries capture goals
supported by the implementation built since then. Each carries a stable, append-only `UC-N` id that specs
reference via `use_cases:` frontmatter: never renumber or reuse one.

Entries use the machine-resolvable `- UC-N: [actor] can [goal]` form. The linked specs identify implementation
evidence, not a blanket claim that every production adoption outcome is proven. Slice completion counts
remain separate from the live-validation gates and residuals below. Worker chambers, batching, isolation,
and unload handling are supporting mechanisms or guarantees, not additional use cases.

### Original MVP scenarios

- UC-1: A site owner can personalize above-the-fold content without flicker or layout shifts.
  - Local A/B decisioning and Adobe decisions-as-data; eager-window application, multiple placements,
    and exposure reporting. [005](specs/005-uc1-pzn-exposure/spec.md),
    [033](specs/033-alloy-config-wiring/spec.md), [034](specs/034-alloy-config-followups/spec.md).
- UC-2: A developer can report meaningful site interactions to analytics.
  - Custom events and GA4 purchases, with off-thread mapping through Measurement Protocol or browser-compatible
    gtag reporting; Adobe/alloy covers its declared analytics subset, not every GA4 event.
    [004](specs/004-uc2-ga4-eds/spec.md), [008](specs/008-ga4-purchase-conversion/spec.md),
    [033](specs/033-alloy-config-wiring/spec.md), [039](specs/039-ga4-gtag-connector/spec.md),
    [041](specs/041-ga4-gtag-boot/spec.md).
- UC-3: An EDS developer can measure block engagement without modifying content markup.
  - Decoration-linked block-view events; no `data-track-*` clutter, with adapter-owned element associations
    held in WeakMaps. [006](specs/006-uc3-block-decoration/spec.md).

### Additional customer goals

- UC-4: A site developer can migrate supported vendors onto airlock while leaving the rest of the tag-manager container intact.
  - Selective native-tag suppression and replacement emission are demonstrated.
    [049](specs/049-native-tag-suppressor/spec.md), [050](specs/050-mvp9-reference-site-rewire-trial/spec.md),
    [adoption path](adoption/rewire-a-container.md). Deployment-backed performance proof, untouched-tail
    regression goldens, the real-site deny-to-accept flow, and vendor-console attribution evidence remain
    named residuals; this is not automatic container translation.
- UC-5: A marketing engineer can send supported advertising beacons without loading the corresponding native vendor runtime.
  - Meta/LinkedIn/Bing pixels and Google Ads/Floodlight connectors.
    [026](specs/026-generic-pixel-connector/spec.md), [044](specs/044-google-ads-connector/spec.md),
    [046](specs/046-floodlight-connector/spec.md), [048](specs/048-ad-connector-boot-wiring/spec.md).
    Ads/Floodlight cover the declared page-load beacon families, not complete conversion or attribution parity.
- UC-6: A site owner can apply visitor consent choices across configured measurement and personalization services.
  - Purpose-specific enforcement, OneTrust boot/change integration, held-ad-beacon release, and analytics
    continuing when personalization is denied. [017](specs/017-mvp3-purpose-vector-consent/spec.md),
    [034](specs/034-alloy-config-followups/spec.md), [045](specs/045-consent-hold-until-granted/spec.md),
    [047](specs/047-onetrust-consent-input-driver/spec.md), [048](specs/048-ad-connector-boot-wiring/spec.md).
    Consent behavior is vendor- and purpose-specific, not a blanket "denied means no transmission" rule;
    core RUM is a distinct, non-consent-gated governance class.
- UC-7: A site owner can restrict the information and destinations available to configured connectors.
  - Sensitive-field filtering, endpoint ceilings, scoped cookie grants, and configuration-integrity
    enforcement. [015](specs/015-mvp3-config-integrity-enforcement/spec.md),
    [016](specs/016-mvp3-endpoint-ceiling-enforcement/spec.md), [019](specs/019-payload-governance/spec.md),
    [020](specs/020-alloy-xdm-governance/spec.md), [035](specs/035-cookie-grant-wrapper/spec.md).
    These are bounded controls with explicit per-surface residuals, not a blanket PII-prevention guarantee.

### Developer and operator workflows

- UC-8: An integrator can select and configure supported services through one site-owned configuration.
  - Composite `boot(config)` and shared event submission.
    [032](specs/032-instrumentation-config/spec.md), [033](specs/033-alloy-config-wiring/spec.md),
    [041](specs/041-ga4-gtag-boot/spec.md), [048](specs/048-ad-connector-boot-wiring/spec.md).
    Arbitrary declarative event-capture rules are not implemented.
- UC-9: A developer can inspect why a beacon was held, dropped, or stripped.
  - Queryable diagnostics, per-beacon correlation, and a local inspector panel.
    [028](specs/028-enforcement-inspector/spec.md). This is not a hosted trace backend or a claim that
    every failure path has diagnostic coverage.
- UC-10: An integrator can compare replacement beacons against captured native-vendor traffic.
  - Classified field-level parity reports with explicitly owned gaps.
    [038](specs/038-parity-harness/spec.md), [050](specs/050-mvp9-reference-site-rewire-trial/spec.md).
    Harness success does not establish vendor-console receipt, advanced-matching efficacy, or live attribution.
- UC-11: A developer can measure a configuration's performance impact against explicit baselines.
  - Before/after harnesses and the naive/deferred/worker scoreboard.
    [029](specs/029-cwv-scoreboard/spec.md), [036](specs/036-real-site-validation-harness/spec.md),
    [050](specs/050-mvp9-reference-site-rewire-trial/spec.md).
    The reference-site tags-removed TBT bound is not an airlock-booted result or a field-CWV improvement.
- UC-12: A site operator can collect page-load, error, and Core Web Vitals signals through airlock.
  - Governed core RUM checkpoints, including page-hide metrics.
    [022](specs/022-helix-rum-connector/spec.md), [030](specs/030-rum-subsume/spec.md).
    Full enhancer replacement and live-collector acceptance are not proven; production cutover retains
    the [live wire-shape gate](../connectors/helix-rum/README.md#before-a-real-production-cutover--the-creds-gated-live-gate).
- UC-13: An integrator can deploy a pinned release on a buildless EDS site without introducing a site build pipeline.
  - Ready-to-serve, same-origin distribution.
    [031](specs/031-distribution-setup/spec.md). EDS is the supported adapter; npm distribution and
    non-EDS adapters remain deferred.
- UC-14: An integrator can move a vendored installation to a known release without editing generated runtime files.
  - Tagged distribution and the demonstrated subtree update path.
    [031](specs/031-distribution-setup/spec.md). The generated tree is overwritten by release updates,
    not hand-maintained as source.

### Success criteria and reporting

The performance success criterion remains separate from UC-11's **ability to measure**: the adopted page stays
in the Core-Web-Vitals **good** band (absolute INP / LCP / CLS thresholds), with airlock's own overhead ~zero,
shown on a before/after Lighthouse + field-metric scoreboard. The concrete good-band thresholds are pinned
as OQ6; the proof that a rewire brings an intuit-class page back into the good band is MVP9. That scoreboard
also supports the servo oracle.

**Co-equal success criterion — parity (added 2026-09-07, [ADR-0018](decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)).** The CWV scoreboard is only half the 1.0 bar. The other half is **parity at the vendor boundary**: when a real site rewires a vendor tag (GA4, Meta Pixel, Google Ads, Floodlight) from its tag-manager container onto airlock, the same events with the same attribution-bearing fields must reach the vendor as before — confirmed by a vendor-generic **parity harness** (per-protocol semantic oracle) and the vendor consoles. CWV without parity is a demo; parity without CWV is a port. 1.0 (adoptable with confirmed parity) is cut when a real intuit-class rewire proves both — see [the release slate](releases/README.md) and R-007, now the 1.0 benchmark.

UC-10's comparison workflow does not itself satisfy that release criterion.
`workflow.py progress --project-dir .` reports linked slice progress;
`workflow.py coverage --project-dir .` checks catalog/spec references. Both are advisory:
unanchored scaffolding, abandoned work, and internal mechanisms need not be assigned a use case merely to
make the counts look complete. Neither command replaces the live gates in [MVP9's release-check](releases/mvp9.md#release-check-criteria-vendor-generic--this-is-the-10-gate).

## Stack

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:c5107195c33a -->

Vanilla ES modules with no framework dependency in the runtime core; Web Workers for the connector runtime; `fetch(url, { keepalive: true })` for egress (works from workers, unlike `sendBeacon`); `PerformanceObserver` for diagnostics. Reuse the scheduling taxonomy and diagnostics from `ramboz/aem-cwv-helper` (the `yieldToMain`/`runWhenIdle`/`runBeforePaint` primitives become the drain scheduler; `observeSlowInteractions`/`observeLayoutShifts` become the inspector and the oracle). Tests in vitest. External contract: GA4 Measurement Protocol (validatable via the `/debug/mp/collect` endpoint). A minimal vendor-neutral event schema is left to *emerge* from the GA4 mapping rather than pinned as an MVP1 contract — that commit-now-vs-emergent call stays open as OQ3. Deliberately **no** SharedArrayBuffer / COOP-COEP in the MVP, to avoid breaking third-party embeds.

## Design principles & constraints

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:cd3a3ca43cba -->

The runtime is shaped by a few load-bearing principles:

- **One boundary, three payoffs.** CWV, datalayer sanity, and security are a single architectural move, not three line items: the main thread captures, enqueues, and folds a *cheap* synchronous projection so reads stay correct, and all interpretation, mapping, and egress happen behind the airlock.
- **INP-safe by construction.** The projection fold is the one piece of main-thread work on the interaction path, so it stays O(1)-cheap. Measured (spec 003, 2026-08-26) at ~19× better INP p75 than the common naive multi-tracker stack (152ms → 8ms), matching even a competently `requestIdleCallback`-deferred main thread without the deferral discipline that baseline must get right by hand. Honest positioning: INP-safe-by-construction, wins the common case, wins heavy/indivisible load, per-tracker isolation. **Not** a blanket "beats a competent main thread on INP" (a well-deferred one ties it at GA4 loads).
- **Event-sourced datalayer.** The append-only event log is the source of truth; state is a synchronous projection derived from it, which lets synchronous reads stay correct while processing goes off-thread.
- **Capability-mediated.** Connectors have no ambient DOM or egress. The only injection path routes through the CWV-safe helpers (`reserveSpace` / `insertAfterInteraction`), so third-party content injection is layout-stable by construction.
- **Cheap isolation.** Egress is held at the seal until consent and allowlist checks pass, but capture and enqueue never wait, so the isolation is cheap, not a bottleneck.
- **Memory-lean.** `Map` for keyed state, `WeakMap` for element associations, no DOM clutter.
- **Portable by default.** Drop-in JS is the default; edge is an optional swappable driver, never a requirement.
- **Measure before optimizing.** Diagnostics are first-class, not bolted on.
- **Anti-drift.** Contracts are pinned as external artifacts before the loop runs.

## How new work enters

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:9ab63af66b65 -->

shaper shapes release-sized bets (appetite, cutline, no-gos, risk retirement) → jig authors specs and vertical slices → servo drives unattended loops where the oracle is strong, jig stays supervised where it is weak. Routing is by oracle strength: GA4 conformance is externally validatable (servo-unattended, variant-race justified); flicker is perceptual with a wide proxy-gap (jig-supervised with human visual review). Every connector target is pinned as an external contract before implementation via `/jig:contracts`.

## Open questions

<!-- elicited: 2026-09-16 / status: filled / hash: sha256:de7880eac73b -->

Product-level unknowns (architecture-level ones live in `architecture.md`): whether to commit to a vendor-neutral event schema in MVP1 or let it emerge from the GA4 mapping and generalize after MVP2 (leaning emergent/minimal); how far the inspector goes in MVP1 versus later (**resolved — spec 028 / MVP5**: a read-layer over the 009-02 stream + per-beacon chains + a drop-in local panel); and the distribution channel for the EDS audience (**resolved — [ADR-0015](decisions/adr-0015-distribution-git-subtree.md), MVP6**: git subtree of ready-to-serve artifacts at `scripts/airlock/`; npm deferred as the future bundler-audience channel).

**Name — settled 2026-08-25.** Codename **Airlock**, chosen for carrying both fault-isolation and mediated-egress in one legible metaphor, and for yielding a consistent system vocabulary (airlock / chamber / cycle / seal). Repo and package slug **airlockjs** (bare `airlock` is unavailable on npm and the name has prior art in a few security/proxy products — a distinguisher or scope is expected). One watch-out for the README: "airlock" can connote *slow/sequential*; the rebuttal is built in — only egress is held at the seal, capture and enqueue never wait.

## Clarifications

_Pass 1 — 2026-09-16, via `/jig:clarify`. A six-category ambiguity scan adapted to this vision doc (the Acceptance-Criteria-Testability and Dependencies-&-Blockers categories are n/a for a project-vision doc)._

### Q1: Non-EDS framework support — Identity lists Astro / Vercel / Jamstack as "next", but Scope lists "non-EDS framework adapters" as out of scope. What is the real status?
_(category: Scope & Boundaries)_
_(provenance: [grounded: § Identity + § Scope])_

Post-1.0 direction, not committed. EDS is the only supported adapter through 1.0; Astro / Vercel / Jamstack are a directional "next", not a dated deliverable.

### Q2: The success criterion "~zero CWV cost" leaves the concrete INP / Lighthouse threshold open (OQ6). How should the measurable bar read?
_(category: Non-functional Requirements)_
_(provenance: [judgment])_

Absolute Core-Web-Vitals "good"-band targets are the bar — the adopted page stays in the CWV good band, not merely "airlock adds ~zero cost". Concrete thresholds to be pinned; this moves OQ6 toward an absolute target rather than a relative before/after delta.

### Q3: The fault-isolation thesis covers "a broken tag must not sink the page." What is the declared behavior if airlock ITSELF fails to boot?
_(category: Edge Cases & Failure Modes)_
_(provenance: [grounded: README.md § guarded boot])_

Fail-safe: a guarded boot, so a load/boot failure never breaks the page — analytics is simply absent (optionally surfaced to a health check). No fallback to loading the native vendor tags.

### Q4: Scope excludes "identity resolution and a first-party cookie store", yet connectors read existing `_ga` / `_gcl_au` cookies read-only. How should the boundary read?
_(category: Scope & Boundaries)_
_(provenance: [grounded: connectors/ga4/cookies.js + Google Ads / Floodlight specs])_

airlock may READ existing vendor cookies read-only, but never MINTS identity or maintains its own cookie store. The out-of-scope line means "no identity resolution, no first-party cookie store" — not "touches no cookies".

### Coverage summary

| Category | Status |
|---|---|
| Scope & Boundaries | Resolved (Q1, Q4) |
| Acceptance Criteria Testability | Skipped — n/a to a vision doc |
| Dependencies & Blockers | Clear |
| Non-functional Requirements | Resolved (Q2) |
| Edge Cases & Failure Modes | Resolved (Q3) |
| Terminology Consistency | Clear |
