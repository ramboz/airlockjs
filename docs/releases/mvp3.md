# Release Plan: MVP3

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.
## Problem / Baseline

- MVP2 proves alloy isolates and runs in a chamber but deliberately leaves its I/O seams unsecured and alloy's config-driven behaviour uncharacterized. MVP3 secures the seams (ADR-0006/0007 enforcement) against alloy's real, measured behaviour — turning the declaration shape established in MVP2 into enforced least-privilege.
- **MVP2 shipped as `v0.2.0` (2026-08-29)** — the precondition is met. alloy's behaviour characterization is delivered (spec 012-04 §Findings, two-axis), the declaration shape is in the contract (`endpoints` / `purposes`), and the wrapped-SDK mechanisms (fetch-interception → main-thread dispatch, mint-coalescing, `reserveSpace`) are demonstrated — but **parallel to `core/`, in rig harnesses**, and against **faithful stubs**. So MVP3 has two jobs, not one: (a) **secure the seams** (the original scope), and (b) **land the wrapped-SDK mechanisms into `core/` + validate against live Alloy** — the productionization MVP2's proof-shortcut deferred.
## Appetite

- **TBD — a user decision.** (MVP2 has now landed, so the "set when MVP2 lands" trigger has fired — this is ripe to set.) _Proposed scope shape (budget still the user's to fix):_ spend it **Risk-First** — the creds-gated live-Alloy re-probe first (it gates the wrapped-SDK contract-freeze), then as much of {seam enforcement, wrapped-SDK core-integration, the `reserveSpace` security/hardening} as the budget allows, deferring the rest honestly. Variable scope: how much ADR-0006/0007 enforcement is provable against alloy's characterized behaviour vs. deferred; whether the alloy payload-governance split proves feasible.
## Solution Outline

- Turn on the ADR-0006/0007 enforcement teeth (authoritative endpoints, payload governance, purpose-vector consent), designed against a first-class characterization of alloy's config-driven data collection and egress — not guessed. Enforcement extends, never rewrites, the MVP1/MVP2 contract (the declaration shape already exists).
## Risks / Rabbit Holes

- Payload governance is fragile for a wrapped-SDK: alloy's XDM body is vendor-built inside the chamber, so denylist/strip at the seal may break it — probe feasibility before committing (GA4 is natural; airlock builds the MP body itself).
- Server-directed egress: alloy's Edge response returns third-party ID-sync URLs (demdex / Audience Manager) a static manifest cannot enumerate — measure live-Alloy endpoint breadth (the fan-out R-004's offline probe suppressed).
- Same-host-tenant re-routing: a compromised alloy can re-point its datastreamId/edgeConfigId to an attacker's Adobe org on the *allowed* host; the host/endpoint allow-list is blind to it. Needs config-integrity + read-minimization, not destination-allowlisting.
- ADR-0007 purpose-vector consent depends on a CMP consent-input seam and the MP consent-field reshape landing at *both* mapping sites (worker mapBatch + unload fast path, OQ16).
- **Security trust boundary (from MVP2's `reserveSpace`).** The CWV-safe DOM-injection `fill` uses `innerHTML` (by-design for authored Target offers, as alloy's own `renderDecisions:true` does). `innerHTML` won't run inserted `<script>`, but `on*` handlers survive — so hosting untrusted decision HTML needs a **sanitizer via the injectable `setContent` hook + a Trusted-Types policy**. Not optional for production; it is part of the seam-enforcement scope, not a nice-to-have.
- **Core-integration divergence.** MVP2's wrapped-SDK egress (fetch-interception → main-thread dispatch, the coalescing broker, `reserveSpace`) lives in **rig harnesses parallel to `core/airlock.js`** — a deliberate proof shortcut. Wiring it into `core/` proper — with the coalescing reject-path carried over, and the request/**response** round-trip egress surface either modelled in `contracts/` or explicitly gated by the seal — is real work; leaving it parallel risks two divergent egress models (the harness's and core's).
## No-Gos

- Designing the secured seams before MVP2 has characterized alloy's real config-driven collection + egress.
- Breaking the MVP1/MVP2 connector/capability contracts — the declaration shape is established in MVP2 so enforcement is a switch-flip, not a retrofit.
- Treating the endpoint ceiling as the headline exfil defense — ADR-0004's host allow-list already covers foreign sinks; the ceiling is forward-compat + disclosure (ADR-0006 round-5 finding).
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| ADR-0006 endpoint-ceiling **enforcement** — flip `endpoints` advisory→authoritative + per-connector attribution — **GA4 wire-protocol DELIVERED** ([spec 016-01](../specs/016-mvp3-endpoint-ceiling-enforcement/slice-01-ga4-wire-protocol-ceiling.md) DONE 2026-08-30): a generic `core/endpoint-ceiling.js` (origin+pathname ∈ declared) at the async worker seam + **GA4-chamber egress-confinement** folded in (the `ready` postMessage is the sole practical egress — a compromised chamber's direct/top-level-captured `self.fetch` is denied) → real foreign-sink teeth. alloy/wrapped-SDK ceiling **DELIVERED** ([spec 016-02](../specs/016-mvp3-endpoint-ceiling-enforcement/slice-02-alloy-wrapped-sdk-floor.md) DONE 2026-08-30) — the same control at the already-confined wrapped-SDK seam, **reconciled** with 015 config-integrity (ceiling owns host+path, config-integrity owns the tenant on the interact), a single grounded interact-origin **FLOOR** (breadth + second-origin tenant-keying probe-gated, ADR-0006 Kill #2). **Spec 016 COMPLETE.** **Named residuals:** tenant-in-query re-route (deferred GA4 config-integrity), dynamic-`import()` (worker CSP), multi-chamber attribution. | Declared as scaffolding in MVP2 | Forward-compat least-privilege + disclosure (not the headline exfil defense; a ceiling has teeth only where the chamber is confined — 016-01 folds in that confinement for GA4) |
| ADR-0006 payload governance (OQ11 denylist) — **GA4 / wire-protocol** | airlock builds the MP body ([map.js](../../connectors/ga4/map.js)) | Natural and tractable where airlock constructs the payload |
| ADR-0007 purpose-vector consent **enforcement** — CMP consent-input seam + MP consent-field reshape at both mapping sites — **data-use reshape DELIVERED** ([spec 017-01](../specs/017-mvp3-purpose-vector-consent/slice-01-data-use-reshape.md) DONE 2026-08-30): the consent **vector** state (`core/consent.js`, vendor-neutral) + a pre-construction host-callback seam + the GA4 MP-`consent` shaping (`connectors/ga4/consent.js`) folded into `ctx` before `createAirlock` → a denied `ad_user_data`/`ad_personalization` sets MP `consent` DENIED at **both** mapping sites (delegate-and-send). Storage-deny (017-02) + seal-hold/strict-drop (017-03) pending. | ADR-0007 accepted | The consent half of ADR-0006's grant law |
| **Config-integrity** — connector config (datastreamId / edgeConfigId) host-owned, not chamber-mutable — **DELIVERED, spec 015 COMPLETE** ([015-01](../specs/015-mvp3-config-integrity-enforcement/slice-01-fail-closed-enforcement.md) hold + [015-02](../specs/015-mvp3-config-integrity-enforcement/slice-02-override-option.md) override, both DONE 2026-08-30; [ADR-0011](../decisions/adr-0011-config-integrity-enforcement.md)): a generic host+injected-tenant-key control in `core/wrapped-sdk-host.js`'s dispatch seam — **fail-closed HOLD** (default) + redacted 009-02 alert on any deviation (foreign host / tenant absent / pollution / mismatch), and an opt-in **override** (re-derive host+tenant + send, still alerting) for availability-preferring deployments. **Residuals (tracked, [refinement-todo](../refinement-todo.md)):** the body-`orgId` co-vector (out of the URL check surface — uncovered + silent, pending a live routing-relevance probe) and protocol-blindness (http downgrade — the egress allow-list's surface, ADR-0004). | Same-host-tenant re-routing defense (013-03, confirmed live) | The endpoint ceiling is blind to same-host re-routing; now recorded in ADR-0011 (ADR-0006 stays tenant-blind) |
| ~~**Wrapped-SDK core integration**~~ — **DELIVERED** ([spec 014](../specs/014-mvp3-wrapped-sdk-core-integration/spec.md), 3 slices DONE 2026-08-30): the round-trip egress (`core/wrapped-sdk-host.js` + the `caps.egress.dispatch` capability, [ADR-0010](../decisions/adr-0010-roundtrip-egress-capability.md)), the coalescing broker + reject-path (`core/coalescing-broker.js`, vendor-neutral), and GA4 retrofitted onto the generic host (`connectors/ga4/connector.js`) — all in `core/`, rig mirror retired | MVP2 tracked debt ([refinement-todo](../refinement-todo.md) a–e) | Done: **one hosting mechanism** in core + the round-trip egress seam MVP3 enforcement binds to (`reserveSpace` core-integration is part of the separate `reserveSpace`-security spec, f–k) |
| **`reserveSpace` security + hardening** — the `innerHTML` **sanitizer + Trusted-Types** boundary; overflow-clip; eager-phase wiring; the production-hardening nits (fetch-shim timeout, dead-man guard, eslint scope, `decisions.fetch` not-built-loudness + contract-stability pin, shared proposition accessor) | MVP2 tracked debt ([refinement-todo](../refinement-todo.md) f–k) | The `innerHTML` boundary is load-bearing for hosting untrusted vendor content |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| End-user per-tag / per-data consent choice surface | ADR-0006 "user choices" horizon | UI + persistence; post-MVP3 |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| ADR-0006 payload governance — **alloy / wrapped-SDK** | Vendor builds the XDM body; strip-at-seal fragile | Probe feasibility first; if infeasible, rely on read-minimization + config-integrity instead |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| ~~Characterize alloy's config-driven behaviour~~ — **DELIVERED** (spec [012-04 §Findings](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md), two-axis) | MVP2 output | The seam design's required input — done; the two axes (egress-breadth / collection-breadth) name what's stub-known vs. live-only |
| ~~**Live-Alloy re-probe — _the_ lead item**~~ — **DELIVERED** ([spec 013](../specs/013-mvp3-live-alloy-reprobe/spec.md), 3 slices DONE 2026-08-30) | Run live against a real Adobe datastream (was creds-gated; maintainer provided a test datastream/org) | **All 3 contract-freeze inputs measured.** (013-01) ADR-0008 **mint-recognizability kill-criterion CONFIRMED** against real Alloy → freeze **mint-axis cleared**, host-seeded fallback not needed. (013-02) real fan-out = **2 Adobe-first-party origins** (confined, roster-stable); **zero 3rd-party = LOWER BOUND** (test org has no AAM destinations, not narrowness) → endpoint-ceiling stays a **FLOOR**; a representative-AAM re-run is the production follow-up. (013-03) same-host tenant re-routing is **tenant-blind** → the required control is a **seam-side config-integrity check** (re-derive/override, fail-closed, bind-at-both-seams) — the ADR-0006 config-integrity addition; **AC1 CONFIRMED live** (real Edge accepts a re-pointed valid datastream on the identical host — honest/attacker 200, garbage 400 — tenant-blind end-to-end). |

## JIG Handoff

- Precondition: MVP2's alloy behaviour characterization + a server-directed-egress probe, before designing the secured-seam enforcement. **The characterization is delivered** — [spec 012-04 §Findings](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) tags alloy's collected-data categories + egress hosts along two axes (egress-breadth: stub vs creds-gated live-Alloy; collection-breadth: chamber-observable `context:[]` vs shimmed-away default-context), with the seam-design inputs (authoritative endpoints, payload governance, purpose-vector consent) called out. The server-directed-egress probe stays a Risk-First MVP3 item (the live-only Axis-1 breadth).
- Resolve OQ11/OQ3 (payload governance + schema) here, archetype-split: enforce for GA4/wire-protocol; probe feasibility for alloy/wrapped-SDK first.
- Enforcement specs extend (never rewrite) the MVP1/MVP2 capability contract — the declaration shape is already established.
- ADR-0006/0007 architecture stands; MVP3 re-times their enforcement. Their MVP2/MVP3 staging prose is release-plan-superseded — no superseding ADR needed (the ADRs defer sequencing to the release plan).
## Release-Check Criteria

- A compromised or misconfigured alloy cannot exfiltrate: it is confined by read-minimization + config-integrity + governed egress, verified against the characterized behaviour.
- ADR-0006 endpoint ceiling + payload governance and ADR-0007 purpose-vector consent are enforced (not just declared) for the channels MVP2's characterization proved tractable.
- No breaking change to the MVP1/MVP2 connector/capability contracts.
- **The `reserveSpace` `innerHTML` path is gated by a sanitizer + Trusted-Types** — untrusted decision content cannot inject active markup (`on*` handlers included).
- ✅ **The wrapped-SDK egress path runs through `core/`** (not a rig harness), with the coalescing reject-path in place — **MET** (spec 014, 2026-08-30): `core/wrapped-sdk-host.js` (round-trip egress) + `core/coalescing-broker.js` (reject-path carried, vendor-neutral) + GA4 on the generic host; one hosting mechanism, no rig mirror. (The seam converges *hosting*; the three egress paths — fire-and-forget, round-trip, synchronous unload — legitimately coexist per the 014 arch-4 finding, which flagged synchronous-gating as a hard sub-problem for the enforcement specs.)
- ✅ **The live-Alloy re-probe has validated (or honestly bounded)** the real Edge response, the demdex fan-out breadth, and mint-recognizability against real Alloy — **MET** ([spec 013](../specs/013-mvp3-live-alloy-reprobe/spec.md), 2026-08-30): mint-recognizability **CONFIRMED**; fan-out breadth **honestly bounded** as a lower bound (no AAM destinations in the test org); config-integrity control **grounded** (seam-side, re-derive/override). The wrapped-SDK capability contract-freeze inputs are now measured — the mint axis is cleared; the endpoint-ceiling FLOOR posture and the config-integrity requirement are the design inputs for the enforcement specs.

_Last shaped: 2026-08-30 (Risk-First lead — the live-Alloy re-probe, spec 013 — DELIVERED: mint-recognizability CONFIRMED, fan-out lower-bounded, config-integrity grounded as a seam-side re-derive/override control; enforcement scope unchanged). Prior: 2026-08-29 (refined after MVP2 shipped `v0.2.0` — added the wrapped-SDK core-integration + `reserveSpace` security/hardening scope, and named the live-Alloy re-probe as the Risk-First lead)._
