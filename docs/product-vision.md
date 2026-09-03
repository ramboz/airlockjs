> Status: Draft (wizard-generated)

# Product Vision — Airlock

> **Codename: Airlock.** Repo / package slug: `airlockjs` (bare `airlock` is taken on npm; the codename stays clean regardless of the published string). Connector namespace: `airlock/ga4`, `airlock/alloy`.
>
> The name carries both halves of the thesis at once: an airlock is *fault-isolation* (one side depressurizing doesn't kill the other — a broken tag must not sink the page) and *mediated egress* (nothing crosses without cycling through the chamber — the capability boundary). It gives the system a consistent vocabulary: the mediated boundary is **the airlock**; a connector runs in a **chamber**; a batch crossing to the worker is a **cycle** / **lock-through**; consent and allowlist gating is **the seal** ("held at the seal" = queued pending consent).
>
> These sections are pre-seeded from a design conversation on 2026-08-25 and authored to the `jig:vision-elicitation` 10-section contract. Treat them as a first elicitation pass: run `/jig:clarify` and `/jig:analyze` against them, then `/jig:arch-review` the companion `architecture.md`. Reconcile the H2 preamble against your `scaffold-init` template if it differs; the H2 section set matches the vision template.

## Identity

<!-- elicited: 2026-08-25 / status: filled -->

Airlock is a capability-secured, off-main-thread martech runtime for edge and static sites (AEM Edge Delivery Services first; Astro, Vercel, Jamstack next). Tags stop being ambient-authority scripts injected into the page context and become **sandboxed consumers of a typed event stream that can only emit declared events to declared endpoints** — each running in an isolated chamber, reaching the network only by cycling through the airlock. It installs as drop-in ES modules (no worker infrastructure or edge account required for the common case), is Core-Web-Vitals-first by construction, and treats the datalayer, performance, and supply-chain-security problems as a single architectural boundary rather than three features.

## Target users

<!-- elicited: 2026-08-25 / status: filled -->

Primary: EDS / Jamstack developers and agencies who must guarantee 100 Lighthouse and passing CWV to clients, and whose performance story currently collapses the moment martech is added. Secondary: performance- and security-conscious martech engineers who own tag stacks and datalayers and are tired of fighting GTM/Launch/Tealium for INP and TBT. Tertiary (buyer, not user): compliance and security stakeholders who care about supply-chain / formjacking exposure in the tag layer — a concern no current TMS addresses.

## Core problem

<!-- elicited: 2026-08-25 / status: filled -->

Martech is the dominant source of CWV regression and a live supply-chain risk, and today's tools address neither structurally. The synchronous `dataLayer.push` fan-out runs tag work inside the interaction, wrecking INP/TBT; blocking client-side decisioning gates LCP; late-injected content causes CLS. Simultaneously, every tag runs in the page with ambient DOM and cookie access, so a single compromised tag can read form fields and exfiltrate data (Magecart / formjacking). Existing tag managers optimize *when* code loads; none change *where* it executes or *what* it is allowed to touch. That "where/what" is the unaddressed layer.

## Competitive landscape

<!-- elicited: 2026-08-25 / status: filled -->

GTM / Adobe Launch / Tealium: main-thread, ambient-authority, optimize load timing only. Partytown: proved worker-hosted third-party scripts, but transparent DOM proxying needs synchronous access, forcing blocking SW round-trips or SharedArrayBuffer+COOP/COEP, which breaks common embeds. Cloudflare Zaraz: runs tools off-page at the edge, but is Cloudflare-locked and opaque. adobe-rnd/aem-martech: decomposes the Launch monolith into phased eager/lazy/delayed loading and is prerender-aware — validates the wedge — but is Adobe-only, entirely main-thread, and has no isolation story. adobe/aem-experimentation: client-side decide-and-apply in the eager window achieves no-flicker personalization without an anti-flicker snippet — proves the pattern — but is coupled to Adobe analytics reporting. The gap Airlock fills: an open, portable, off-main-thread, capability-isolated, vendor-neutral runtime shaped for the fast-static ecosystems.

## Scope

<!-- elicited: 2026-08-25 / status: filled -->

In scope: the runtime substrate (main-thread capture-and-enqueue, worker-side drain/mapping/egress); the event-log-plus-projection datalayer; the worker connector runtime (chambers); capability-mediated DOM injection and egress; EDS three-phase integration; two connector archetypes (GA4 wire-protocol, alloy/Target wrapped-SDK); CWV-safe content injection; consent gating at the seal; and first-class diagnostics/inspector.

Out of scope (explicit no-gos for the first releases): session replay / full DOM-mutation streaming (antagonistic to "no DOM access"); identity resolution and a first-party cookie store; the service-worker egress chokepoint (MVP uses direct keepalive; SW is a later progressive enhancement); edge decision/egress *drivers* (the seams exist from day one, the drivers come later); non-EDS framework adapters.

## Use cases

<!-- elicited: 2026-08-25 / status: filled -->

The three recurrent customer requests every EDS project faces, which together form the MVP demo. Each carries a stable, append-only `UC-N` id that specs reference via `use_cases:` frontmatter (never renumber or reuse one):

1. **UC-1 · A/B test or personalization above the fold, without flicker** — a site owner can run an above-the-fold experiment or personalization with no flicker. Decision applied in the eager window before paint (in-house decisioning for MVP1, à la aem-experimentation); exposure reported through the runtime.
2. **UC-2 · Analytics with a custom event** — a developer can capture a page interaction and report it to analytics. Mapped off-thread in its chamber, emitted to GA4 via the Measurement Protocol.
3. **UC-3 · Automatic block-decoration instrumentation for EDS** — an EDS developer gets instrumentation without touching markup. It hangs off block `decorate()` rather than markup — no `data-track-*` clutter, associations held in WeakMaps.

Implicit success criterion (not a use case — it's the oracle): prove all three land at ~zero CWV cost, shown on a before/after Lighthouse + field-metric scoreboard. That scoreboard is also the servo oracle; its measurement contract (INP threshold, Lighthouse score) is tracked as OQ6.

## Stack

<!-- elicited: 2026-08-25 / status: filled -->

Vanilla ES modules with no framework dependency in the runtime core; Web Workers for the connector runtime; `fetch(url, { keepalive: true })` for egress (works from workers, unlike `sendBeacon`); `PerformanceObserver` for diagnostics. Reuse the scheduling taxonomy and diagnostics from `ramboz/aem-cwv-helper` (the `yieldToMain`/`runWhenIdle`/`runBeforePaint` primitives become the drain scheduler; `observeSlowInteractions`/`observeLayoutShifts` become the inspector and the oracle). Tests in vitest. External contract: GA4 Measurement Protocol (validatable via the `/debug/mp/collect` endpoint). A minimal vendor-neutral event schema is left to *emerge* from the GA4 mapping rather than pinned as an MVP1 contract — that commit-now-vs-emergent call stays open as OQ3. Deliberately **no** SharedArrayBuffer / COOP-COEP in the MVP, to avoid breaking third-party embeds.

## Design principles & constraints

<!-- elicited: 2026-08-25 / status: filled -->

One boundary, three payoffs — CWV, datalayer sanity, and security are a single architectural move (the main thread captures, enqueues, and folds a *cheap* synchronous projection so reads stay correct; all interpretation, mapping, and egress happen behind the airlock), not three separate line items. The projection fold is the one piece of main-thread work on the interaction path, so it must stay O(1)-cheap — that constraint is what makes the runtime **INP-safe by construction**: measured (spec 003, 2026-08-26) at ~19× better INP p75 than the common naive multi-tracker stack (152ms → 8ms), *matching* even a competently `requestIdleCallback`-deferred main thread while requiring none of the deferral discipline that baseline must get right by hand. The honest positioning is INP-safe-by-construction + wins-the-common-case + wins-heavy/indivisible-load + per-tracker isolation — **not** a blanket "beats a competent main thread on INP" (a well-deferred main thread ties it at GA4 loads). Append-only event log is the source of truth; state is a synchronous projection derived from it (event-sourcing applied to the datalayer), which is what lets synchronous reads stay correct while processing goes off-thread. Capability-mediated: connectors have no ambient DOM or egress; the only injection path routes through CWV-safe helpers (`reserveSpace` / `insertAfterInteraction`), so third-party content injection is layout-stable by construction. Egress is held at the seal until consent and allowlist checks pass — but capture and enqueue never wait, so the isolation is cheap, not a bottleneck. Memory-lean: `Map` for keyed state, `WeakMap` for element associations, no DOM clutter. Drop-in-JS portability is the default; edge is an optional swappable driver, never a requirement. Measure before optimizing — diagnostics are first-class, not bolted on. Contracts are pinned as external artifacts before the loop runs (anti-drift).

## How new work enters

<!-- elicited: 2026-08-25 / status: filled -->

shaper shapes release-sized bets (appetite, cutline, no-gos, risk retirement) → jig authors specs and vertical slices → servo drives unattended loops where the oracle is strong, jig stays supervised where it is weak. Routing is by oracle strength: GA4 conformance is externally validatable (servo-unattended, variant-race justified); flicker is perceptual with a wide proxy-gap (jig-supervised with human visual review). Every connector target is pinned as an external contract before implementation via `/jig:contracts`.

## Open questions

<!-- elicited: 2026-08-25 / status: filled -->

Product-level unknowns (architecture-level ones live in `architecture.md`): whether to commit to a vendor-neutral event schema in MVP1 or let it emerge from the GA4 mapping and generalize after MVP2 (leaning emergent/minimal); how far the inspector goes in MVP1 versus later (**resolved — spec 028 / MVP5**: a read-layer over the 009-02 stream + per-beacon chains + a drop-in local panel); and the distribution channel for the EDS audience (git subtree, matching the aem-martech/aem-experimentation convention, versus npm).

**Name — settled 2026-08-25.** Codename **Airlock**, chosen for carrying both fault-isolation and mediated-egress in one legible metaphor, and for yielding a consistent system vocabulary (airlock / chamber / cycle / seal). Repo and package slug **airlockjs** (bare `airlock` is unavailable on npm and the name has prior art in a few security/proxy products — a distinguisher or scope is expected). One watch-out for the README: "airlock" can connote *slow/sequential*; the rebuttal is built in — only egress is held at the seal, capture and enqueue never wait.
