# Release Plan: MVP3

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.
## Problem / Baseline

- MVP2 proves alloy isolates and runs in a chamber but deliberately leaves its I/O seams unsecured and alloy's config-driven behaviour uncharacterized. MVP3 secures the seams (ADR-0006/0007 enforcement) against alloy's real, measured behaviour — turning the declaration shape established in MVP2 into enforced least-privilege.
## Appetite

- TBD — set when MVP2 lands. Variable scope: how much ADR-0006/0007 enforcement is provable against alloy's characterized behaviour vs. honestly deferred.
## Solution Outline

- Turn on the ADR-0006/0007 enforcement teeth (authoritative endpoints, payload governance, purpose-vector consent), designed against a first-class characterization of alloy's config-driven data collection and egress — not guessed. Enforcement extends, never rewrites, the MVP1/MVP2 contract (the declaration shape already exists).
## Risks / Rabbit Holes

- Payload governance is fragile for a wrapped-SDK: alloy's XDM body is vendor-built inside the chamber, so denylist/strip at the seal may break it — probe feasibility before committing (GA4 is natural; airlock builds the MP body itself).
- Server-directed egress: alloy's Edge response returns third-party ID-sync URLs (demdex / Audience Manager) a static manifest cannot enumerate — measure live-Alloy endpoint breadth (the fan-out R-004's offline probe suppressed).
- Same-host-tenant re-routing: a compromised alloy can re-point its datastreamId/edgeConfigId to an attacker's Adobe org on the *allowed* host; the host/endpoint allow-list is blind to it. Needs config-integrity + read-minimization, not destination-allowlisting.
- ADR-0007 purpose-vector consent depends on a CMP consent-input seam and the MP consent-field reshape landing at *both* mapping sites (worker mapBatch + unload fast path, OQ16).
## No-Gos

- Designing the secured seams before MVP2 has characterized alloy's real config-driven collection + egress.
- Breaking the MVP1/MVP2 connector/capability contracts — the declaration shape is established in MVP2 so enforcement is a switch-flip, not a retrofit.
- Treating the endpoint ceiling as the headline exfil defense — ADR-0004's host allow-list already covers foreign sinks; the ceiling is forward-compat + disclosure (ADR-0006 round-5 finding).
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| ADR-0006 endpoint-ceiling **enforcement** — flip `endpoints` advisory→authoritative + per-connector attribution at both egress seams (OQ16) | Declared as scaffolding in MVP2 | Forward-compat least-privilege + disclosure (not the headline exfil defense) |
| ADR-0006 payload governance (OQ11 denylist) — **GA4 / wire-protocol** | airlock builds the MP body ([map.js](../../connectors/ga4/map.js)) | Natural and tractable where airlock constructs the payload |
| ADR-0007 purpose-vector consent **enforcement** — CMP consent-input seam + MP consent-field reshape at both mapping sites | ADR-0007 accepted | The consent half of ADR-0006's grant law |
| **Config-integrity** — connector config (datastreamId / edgeConfigId) host-owned, not chamber-mutable | Same-host-tenant re-routing defense (brainstorm) | The endpoint ceiling is blind to same-host re-routing; not yet in ADR-0006 |

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
| Characterize alloy's config-driven behaviour — auto-collected data (context, ECID) + egress hosts (datastreamId / edge domain) | MVP2 output; R-004 partial | The seam design's required input — enforcement can't be designed without it |
| Server-directed-egress probe (demdex / Audience-Manager sync) + same-host-tenant re-routing test | Unprobed — R-004 faked the network | Endpoint-ceiling & host-allow-list validity for alloy both hinge on it |

## JIG Handoff

- Precondition: MVP2's alloy behaviour characterization + a server-directed-egress probe, before designing the secured-seam enforcement. **The characterization is delivered** — [spec 012-04 §Findings](../specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) tags alloy's collected-data categories + egress hosts along two axes (egress-breadth: stub vs creds-gated live-Alloy; collection-breadth: chamber-observable `context:[]` vs shimmed-away default-context), with the seam-design inputs (authoritative endpoints, payload governance, purpose-vector consent) called out. The server-directed-egress probe stays a Risk-First MVP3 item (the live-only Axis-1 breadth).
- Resolve OQ11/OQ3 (payload governance + schema) here, archetype-split: enforce for GA4/wire-protocol; probe feasibility for alloy/wrapped-SDK first.
- Enforcement specs extend (never rewrite) the MVP1/MVP2 capability contract — the declaration shape is already established.
- ADR-0006/0007 architecture stands; MVP3 re-times their enforcement. Their MVP2/MVP3 staging prose is release-plan-superseded — no superseding ADR needed (the ADRs defer sequencing to the release plan).
## Release-Check Criteria

- A compromised or misconfigured alloy cannot exfiltrate: it is confined by read-minimization + config-integrity + governed egress, verified against the characterized behaviour.
- ADR-0006 endpoint ceiling + payload governance and ADR-0007 purpose-vector consent are enforced (not just declared) for the channels MVP2's characterization proved tractable.
- No breaking change to the MVP1/MVP2 connector/capability contracts.

_Last shaped: 2026-08-28_
