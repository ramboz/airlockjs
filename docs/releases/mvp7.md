# Release Plan: MVP7 — Pixel Parity & the Parity Harness

> **Re-scoped 2026-09-07 ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)).** Was "Connector
> Breadth (the pixel archetype)". The owner's 2026-09-05 reframe made **confirmed parity** the 1.0 bar, so MVP7's centre
> of gravity moves from *breadth* (more vendor configs) to *parity* — the vendor-generic parity harness plus proven
> beacon-level parity for the first real vendors. Breadth-as-configs and the drop-in ergonomics stay, but as *variable*
> scope. The original reconciliation framing (spec 026 built ahead of plan) is preserved below as history.

## Status

`shipping`

> **Advanced `committed` → `shipping` (owner decision, 2026-09-11).** All three fixed-core Include items are built —
> the vendor-generic parity harness (038-01/02/03), GA4 parity via the gtag-protocol connector (spec 039), and Meta
> advanced matching (026-04, GET-only). The last release-check piece — **038-04** (Meta advanced-matching
> field-presence parity) — is now **DONE** (spec 038 complete), so the release-check is **met**; the remaining step is the
> owner-gated v0.7.0 cut (E1 version-bump/dist-tag). There
> is **no E10 blocker** (see Release-Check — E10 was measured by 038-03 and deferred as need-triggered per ADR-0020).

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

**Ships as v0.7.0** (the `MVPn ↔ v0.n.0` convention). **Committed 2026-09-08** (owner decision) — both MVP7 risk-first
gates are retired with a GO: **R-009(a)** decided the GA4 protocol path
([ADR-0019](../decisions/adr-0019-ga4-gtag-protocol-connector.md), Accepted — an additive off-thread `/g/collect`
gtag-protocol connector, field-map capture-grounded on the reference page), and **R-010** measured the indicative CWV
bound as a **GO** (the four TBT-dominant vendor runtimes are ~70% of blocking time on `stage.erp.intuit.com` —
330→101 ms shipped; the CWV kill criterion is not tripped). MVP6 (v0.6.0) is the immediate predecessor.

> **History (shaped 2026-09-03 as a reconciliation).** Spec 026 (the generic pixel connector) was built *ahead of the
> committed MVP4→5→6 path*, and both MVP4 and MVP5 explicitly no-go "broader connector breadth (pixel/…) — that is
> MVP7+." This plan originally existed to give that already-built work an honest release home. ADR-0018 then re-scoped
> it around parity; the banked pixel-archetype work (026-01/02/03/05) is now the *substrate* the parity harness proves.

## Problem / Baseline

- **1.0 is "adoptable with confirmed parity" (ADR-0018), and nothing yet *confirms* parity.** airlock can emit a Meta /
  LinkedIn / Bing pixel through the generic connector (spec 026, DONE), and GA4 via the Measurement Protocol — but
  there is **no tool that proves a rewired tag reaches the vendor with the same attribution-bearing fields as the
  container's tag did**. That proof is the gate every real-site rewire (MVP9) depends on.
- **The parity question is not uniform across vendors, and the corpus does not yet answer it.** GA4 is the sharpest
  case: airlock's connector speaks the server-side **Measurement Protocol** (`/mp/collect`), while a container's GA4 tag
  loads `gtag.js` and emits `/g/collect` — a different endpoint, encoding and field vocabulary. Whether MP-only egress
  reaches **console-level** parity (sessions, engagement, attribution, Consent Mode state) is **assumed, not probed**
  (ADR-0018 Assumptions), and one divergence is already recorded open — OQ13-2 (`_ga_<stream>` session minting on an
  MPA). MP also carries an *adoption* blocker no parity check sees: it needs an `api_secret`, which airlock places in
  browser-side config.
- **Transport is part of parity.** The container's pixels fire credentialed cross-site requests carrying the vendor's
  cookie (`fr`, `IDE`); airlock's `fetch` egress omits it by construction. Whether that matters — and whether airlock
  should re-attach a purpose-gated credentialed transport — is a security-boundary decision (ADR-0018 E10) MVP7 must
  surface, not absorb.
- **Spec [026](../specs/026-generic-pixel-connector/spec.md) already built the pixel archetype** — 026-01 (Meta Pixel,
  governed + dispatched), 026-02 (LinkedIn + Bing as **pure configs, zero connector code**), 026-03 (the
  `PixelVendorConfig` contract), 026-05 (live-shippability). **All DONE.** 026-04 (identity/advanced-matching) is now
  **DONE** — un-deferred on a redacted real capture and shipped **GET-only** (the POST/`ctx`-body shape was dropped; the
  capture is GET). Advanced matching rides a dedicated `setIdentity`/`init` side-channel that hashes in-chamber
  ([ADR-0022](../decisions/adr-0022-pixel-advanced-matching-hashing.md)); the `em`/`ph` fields are Meta-doc-grounded
  pending a signed-in capture.

## Appetite

- **2-week small-batch box (proposed).** Time fixed; scope flexes per the cutline. The 4-slice pixel head-start means
  the parity harness — not connector code — is the real build.
  - **Fixed core (if committed):** the **vendor-generic parity harness** + **Meta Pixel parity** (026-04, DONE —
    GET-only; harness confirmation via 038-04) + **GA4 parity** through the harness.
  - **Variable / gives first:** the **breadth-as-configs** set (more GET pixels) and the **drop-in authoring
    ergonomics** — both real, both cut first if the box tightens.

## Solution Outline

- **The vendor-generic parity harness** — capture (the container's beacon, with its credential/cookie context) → replay
  (airlock's beacon) → **per-protocol semantic oracle** (a same-protocol field-diff where airlock speaks the container's
  protocol; a semantic field-map where it legitimately speaks a different one, e.g. GA4 MP) → report. Vendor-generic in
  *shape*, per-protocol in its oracles. Each real site supplies its own **redacted** vendor-beacon captures as oracle
  input (ADR-0018 R5; no live identifiers, spec-013 discipline).
- **R-009 (the whole gtag-family fidelity spike) — risk-first, no code dependency, the 1.0 bar rests on it.**
  **(a) GA4:** the `/g/collect` → MP semantic field-map, session/engagement on an MPA (OQ13-2), Consent Mode state, the
  console-level check, and MP's `api_secret` fitness for a public property — decides MP-only vs an additive
  gtag-protocol GA4 connector. **(b) Google Ads + Floodlight:** conversion-ping fidelity (Consent Mode v2 incl. the
  `ad_storage`-denied path; `gclid`/`_gcl_*`, linker, `wbraid`/`gbraid`). **(c) transport:** per vendor and cookie
  cohort, which attribution rides the cross-site cookie vs first-party params → feeds the E10 credentialed-transport
  ADR.
- **R-010 (an indicative CWV bound) — risk-first, no container-owner dependency.** Lighthouse `blockedUrlPatterns` on
  the reference site (shipped + phase-split configs) turns the reported 601→204 ms into repo-recorded numbers and tells
  us whether the ladder is worth walking. Indicative, not a hard ceiling (it strips runtimes, not per-template init).
- **Meta Pixel parity — [026-04](../specs/026-generic-pixel-connector/spec.md) DONE.** Un-deferred on a redacted real
  capture and shipped **GET-only**: the POST/`ctx`-body shape was **dropped** (the capture is GET), so the archetype's
  GET-only / no-`ctx` invariant **stands**. Advanced-matching identity rides a dedicated `setIdentity`/`init`
  side-channel that bypasses `push()` governance by design to reach in-chamber hashing — only the SHA-256 hash egresses,
  still on the GET `/tr` beacon (ADR-0022). Harness confirmation of field-presence parity is 038-04.
- **Breadth-as-configs + drop-in ergonomics (variable).** More GET-pixel vendors as pure configs; the author-facing
  path to declare a pixel config and boot it on an EDS page.

## Risks / Rabbit Holes

- **GA4 parity is the sharpest unknown** — MP-vs-`gtag` is a *different protocol*, not a confirmation step. Do not
  assume MP reaches console parity; R-009(a) decides it. If it can't (or `api_secret` exposure sinks it for a public
  property), the exit is an additive gtag-protocol connector or an owner re-decision — never a redefinition of "parity".
- **026-04 identity handling (resolved GET-only)** — the POST/`ctx` path was **dropped**, so the GET-only invariant
  held. Identity does not leak: it rides a hash-only `setIdentity`/`init` side-channel under the chamber's egress
  confinement (ADR-0022), so only the SHA-256 hash reaches the GET `/tr` beacon. The real captured beacon
  (`meta-tr-pageview.redacted.json`) grounded the shape, avoiding the speculative-wire-fidelity rabbit hole 026-02's
  frame-critique warned of.
- **The parity oracle must be semantic, never raw URL equality** — vendor hits carry nondeterministic fields; the
  reference site's own diff tool already refuses raw URL comparison. Every per-vendor oracle normalizes to the
  attribution-bearing field set.
- **Breadth without the harness is the old trap.** Shipping more configs does not prove parity; the harness does. Keep
  breadth variable.

## No-Gos

- **No customer-custom tags as release scope** (ADR-0018 R2) — the reference site's ECS/TrackStar/UX-Fabric chain and
  its golden sample are **validation-only** inputs, never a shipped connector or a hard gate.
- **Not the wider R-007 breadth this box** — **no** Google Ads / Floodlight connectors (those are **MVP8**, gated on the
  AW/DC half of R-009), **no** OneTrust consent driver (MVP8), **no** forms (Marketo Forms2), **no** Segment
  host-vs-replace (variable/later — R-007's fork stays open).
- **No identity resolution / first-party cookie store** (standing vision no-go). 026-04 governs a vendor's *own*
  advanced-matching beacon; it does not build airlock identity.
- **No live vendor identifiers** — synthetic / redacted only (`000000000000000`, `G-DEBUGTEST0`, …), per the standing
  session constraint and ADR-0020 grounding (ADR-0018 R5).
- **No architecturally-excluded classes** (session-replay, live-chat, heatmap) — excluded by mechanism (R-007).

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **The vendor-generic parity harness** — capture → replay → per-protocol semantic oracle → report; credential context captured + replayed | ADR-0018 (parity definition, E5) | The 1.0 gate every rewire depends on |
| **R-009 (whole) — risk-first** the gtag-family fidelity spike (GA4 MP-vs-gtag incl. `api_secret`; Ads/Floodlight ping fidelity; transport per cohort) | ADR-0018 E6; OQ13-2; `connectors/ga4/map.js` | The bar rests on it; no code dependency, so it runs first |
| **R-010 — risk-first** the indicative CWV bound on the reference site (`blockedUrlPatterns`) | ADR-0018 E11 | Repo-records the win's rough size before the ladder is walked; no container-owner needed |
| **Meta Pixel parity** — 026-04 DONE (identity/advanced-matching, GET-only; POST dropped), grounded on a redacted real capture; harness field-presence confirmation is 038-04 (**DONE** 2026-09-11) | [spec 026-04](../specs/026-generic-pixel-connector/spec.md) | The first real vendor proven at parity |
| **GA4 parity** through the harness (MP-only, or an additive gtag-protocol connector if R-009(a) demands) | ADR-0018 (GA4 kill criterion) | The analytics anchor |

### Defer / Variable

| Item | Evidence | Rationale |
|---|---|---|
| **Breadth-as-configs** — more GET-pixel vendors as pure configs | R-007 (~10 vendors fit); 026-02 proved 3 | The archetype's payoff — but breadth doesn't prove parity; gives first |
| **Drop-in pixel authoring ergonomics** | "drop-in is the bonus" (session direction) | Consumable, not just expressible — variable |
| **Google Ads / Floodlight connectors, OneTrust consent driver, Segment, forms** | R-007; ADR-0018 ladder | **MVP8+** — different patterns / gated on R-009's AW/DC findings |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **R-009 (a) GA4 MP-vs-gtag parity + `api_secret` fitness** | ADR-0018 E6, GA4 kill criterion | Decides whether GA4 — the parity anchor — is rewirable at all, and how. **→ DONE: [ADR-0019](../decisions/adr-0019-ga4-gtag-protocol-connector.md) (additive gtag-protocol connector); field-map capture-grounded (2026-09-07)** |
| **R-010 indicative CWV bound** | ADR-0018 E11 | Decides whether the whole ladder is worth walking. **→ DONE: GO** (2026-09-07 — 4 runtimes ≈ 70% of TBT on the reference page; kill criterion not tripped) |
| **Capture a real (redacted) pixel beacon** to ground 026-04's advanced-matching shape | ADR-0020 grounding; 026-02 frame-critique | **→ DONE:** captured (`test/fixtures/meta-tr-pageview.redacted.json`); outcome — **POST out of scope, GET-only shipped**; `ud[external_id]` grounded, `em`/`ph` doc-grounded pending a signed-in capture |

## JIG Handoff

- New research notes: **R-009** (gtag-family fidelity, three parts) and **R-010** (indicative CWV bound) — both
  MVP7 risk-first (ADR-0018 E6, E11).
- New spec: **the parity harness** (ADR-0018 E5) — vendor-generic capture/replay/oracle/report, redacted fixtures.
- **026-04 DONE** (ADR-0018 E4) — grounded on a redacted real capture; shipped **GET-only** (POST dropped) via a
  dedicated `setIdentity`/`init` side-channel ([ADR-0022](../decisions/adr-0022-pixel-advanced-matching-hashing.md)),
  leaving `PixelVendorConfig` ([contracts/pixel-connector.d.ts](../../contracts/pixel-connector.d.ts)) identity-agnostic
  (advanced matching lives outside the type). Harness confirmation is 038-04.
- **E10 credentialed transport — deferred, not an ADR gate.** 038-03 **measured** the transport gap per cohort; the E10
  credentialed-egress decision is parked as a **need-triggered** refinement-todo ([ADR-0020](../decisions/adr-0020-parity-contract-anti-drift.md)
  commitment 3, owner call 2026-09-08), opened only when a real parity need surfaces. No E10 ADR is required for v0.7.0.

## Release-Check Criteria

- The parity harness confirms **GA4 and Meta Pixel reach vendor-boundary field parity** on redacted real captures
  (per-protocol semantic oracle): GA4 via the gtag-protocol connector (spec 039); the Meta GET/`cd[...]` shape via
  026-06 + 038; and Meta advanced-matching **`ud[external_id]` field-presence** parity via **038-04** (**DONE** 2026-09-11
  — spec 038 complete). **Named, non-blocking residuals:** the signed-in `ud[em]`/`ph` capture (Meta-doc-grounded
  today) and same-`external_id`-**input efficacy** (an MVP9 rewire/adoption property, ADR-0020 kill-criterion #1) — the
  harness confirms field presence, not that airlock's identity input equals the container's.
- **GA4's protocol question is decided** (MP-only reaches parity, or an additive gtag-protocol connector ships) —
  never by redefining "parity". **→ Decided: additive gtag-protocol connector (ADR-0019), shipped (spec 039).**
- The **E10 credentialed-transport gap is visible, not absorbed** — 038-03 measured it per cohort and it is parked as a
  **need-triggered** deferral (ADR-0020 commitment 3), not a v0.7.0 ADR gate.
- **R-010 gives a repo-recorded indicative CWV bound**; a modest result trips the CWV kill criterion (ADR-0018).
- **No customer-custom tag** is a release deliverable or gate; **no live identifiers** anywhere.
- No regression to the GA4 / alloy / RUM connectors or the stable-core contract (MVP1–6).

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-09-03 (reconciliation — homed the off-plan spec-026 pixel work). Re-scoped 2026-09-07 (ADR-0018):
"Pixel Parity & the Parity Harness", ships as v0.7.0; parity is the centre, breadth is variable. Reconciled + advanced
to `shipping` 2026-09-11: all fixed-core Include items built (026-04 GET-only DONE, POST dropped; E10 deferred, not an
ADR gate); 038-04 confirms Meta advanced-matching field-presence parity as the last release-check piece before the cut._
