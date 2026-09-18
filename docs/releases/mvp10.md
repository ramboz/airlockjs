# Release Plan: MVP10 — Personalization & Experimentation Runtime

> **Shaped 2026-09-18** from the maintainer's brainstorm captured in
> [R-012](../research/R-012-personalization-experimentation-runtime.md). The next big feature after 1.0: OOTB support for
> the personalization/experimentation tools EDS customers actually run — **Adobe Target** (VEC + form-based), **Adobe
> Journey Optimizer** (web visual, code-based, in-app/content cards) and **aem-experimentation** — with the decision
> **landing in the eager window for hero personalization**, lazy-loaded blocks personalized later, **no visible content
> flicker ever**, and CWV-first throughout. Decisions locked in ADR-0031/0032/0033; ADR-0034/0035 proposed pending probes.

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

**Sequenced after the v1.0.0 cut (MVP9 release-check).** Ships as **v1.1.0** — additive to the stable core
([ADR-0017](../decisions/adr-0017-airlock-1-0-api-contract.md) minor bump; the personalization surface is the experimental
carve-out today). _TBD (owner): confirm the version label; if shaped before 1.0.0 lands it would ship as 0.10.0._

## Problem / Baseline

- **Current baseline (repo @ `2bccb2c`):** airlock ships an eager pre-paint **reserve** (`reserveSpace`) and a lazy,
  post-paint `fill(html)` from an alloy chamber running the real Web SDK headless. That is **one apply verb**: Target VEC
  `dom-action` items, JSON offers and redirects are **dropped with a warning**; `insertAfterInteraction` is declared but
  rejects; aem-experimentation exposure is reported lazily (a fast bounce loses it, differentially). No VEC, mbox, AJO or
  view-change support exists anywhere in the corpus ([R-012 §1](../research/R-012-personalization-experimentation-runtime.md)).
- **Problem this release addresses (maintainer's words):** "most customers will do personalization or experimentation on
  the heros for the pages, so we definitely need to land the decision in eager" — and "content flicker is the number 1
  complaint we get from them; a visible content swap is a strong no-go." Between aem-experimentation, Target and AJO,
  customers use several tools; the last two ride alloy, which already overlaps the chamber we built. aem-martech has
  partial logic (its PR #17 adds form-based mboxes via `data-mbox`) but is incomplete and single-shot.
- **Why now:** MVP9 closes the 1.0 bar (generic vendor tags rewired with parity). Personalization is the next value the
  Adobe-stack audience asks of an off-main-thread martech runtime, and the chamber + reserve + consent machinery it needs
  are already built. The physics is settled (R-012 §5): for a remote decision, "no flicker" and "no LCP cost" are only
  jointly achievable by landing the decision **before** eager — that is a runtime job, not a snippet.

## Appetite

- Time or attention this release is worth: _TBD (owner)._
- Fixed constraints: **no visible content flicker, ever** (ADR-0031); every eager hold **bounded**; the eager chunk stays
  Worker-free and build-asserted; nothing paints CLS.
- Variable scope: the number of decision **tiers** landed (head fetch → cache/prefetch → prerender → edge-injected), AJO
  depth (in-app/content cards), SPA views.

## Solution Outline

- **Proposed shape:** one **proposition contract** (alloy's shape) + one author-owned **placement registry**
  (scope/surface → selector, action, geometry, prehide selector, budget, cache policy; declared in config or discovered from
  section metadata) feeding **two appliers**: an **eager applier** (main-thread, tiny, Worker-free) that lands the hero
  decision under a **paint policy** (**no wait by default**; `async` = skeleton or `blocking` declared via page/section
  metadata or a config hook, always bounded; runtime signals — cache hit, per-URL memory — as a complement) and a **lazy
  applier** (Target VEC `dom-action` interpreter on the existing budgeted, sanitized, allowlisted DOM plumbing) that applies
  **atomically before a placement first intersects the viewport** ("visible" = user-visible, not merely rendered). Two apply
  regimes share the contract: `source` (pre-decoration swap, aem-experimentation's model, hosted unforked) and `dom`
  (post-decoration edits). The **worker alloy chamber stays the brain**:
  decisioning, identity, display/interact/suppress notifications, AJO rules engine. Decision sources are **tiered by
  latency** (edge-injected → local → inline head fetch handed to alloy via `applyResponse` → worker → per-URL cache/prefetch,
  incl. speculation rules).
- **Main user-facing path:** a developer declares placements (or section metadata), adds one eager line
  (`await airlockEager(doc)`), flips a page to `async`/`blocking` where a hero activity is live, and the marketer's
  Target/AJO hero activity lands before the hero section reveals on warm/prefetched navigations and under a bounded
  skeleton/blocking hold otherwise — never a swap. Pages with no declared wait pay nothing. Exposure/suppression flows to alloy **and** any
  analytics sink.
- **Important non-goals:** absorbing aem-experimentation's decisioning (hosted as the local provider); executing
  `customCode` offers by default; SPA route detection in the first cut.

### Vertical Scopes (delivery order)

Ordered thinnest-demoable-path-first (proposed in R-012 § Conclusion; each demoable against the existing minted-Edge rig
until a live Target/AJO property is available):

1. **VEC dom-action interpreter on the lazy path** — a Target VEC activity on a lazy block applies at `loaded` with exact
   display semantics (`renderAttempted`, `{id, scope, scopeDetails}`), no flicker, no CLS. Closes what aem-martech PR #17
   left open.
2. **Head fetch + `applyResponse` handoff** (ADR-0034 once accepted) — one `/ee/v2/interact` per page fired from `<head>`,
   ingested by the worker alloy; the hero decision is in hand at eager on a warm connection. Demo: `decision-arrival vs
   eager` delta on the testbed.
3. **Placements from section metadata + form-based/code-based apply** — a Target form-based mbox and an AJO `#fragment`
   surface land via author-declared placement (`applyPropositions`-style metadata).
4. **Eager paint policy + flag + timeout/SuppressDisplay + eager exposure capture** (ADR-0031/0032) — the hero under
   `async`/`blocking` with the metadata flag (`off` default), timeout → default + `propositionSuppressDisplay(reason:
   Timeout)` for late decisions / `pzn_decision_missing` for never-arrived ones, variant-image preload, exposure captured
   in eager (incl. aem-experimentation via its event, section-level); the **flicker-by-construction rig gate** (zero
   mutations on a placement after its first in-viewport paint).
5. **Decision cache + prefetch + prerender hold** (ADR-0035 once accepted) — per-URL cache (`off | fresh-only | stale-ok`),
   hover/pointerdown + speculation-rules prefetch, prerender as a seal hold reason; RUM subtracts `activationStart`.
6. **AJO rules engine + `insertAfterInteraction`** — in-app messages / content cards rendered post-interaction.
7. **SPA views** — re-entrant placement lifecycle + view cache.

## Risks / Rabbit Holes

- Risk: **the head-fetch race rarely wins on cold mobile** → on *declared* pages the `async`/`blocking` wait engages on
  most cold first visits; on *undeclared* pages a live activity on any `initialViewport` placement (registry attribute) is shown to nobody —
  deterministically, even when the decision arrived early (`SuppressDisplay(reason: Undeclared)`) — until the
  declaration is published (ADR-0032; a site-level activity manifest is the planned automation).
  - Why it matters: it decides whether "land in eager" is a real property or a warm-path one.
  - Retirement path: probe the `/ee/v2/interact`-vs-eager delta on the testbed under throttling **before** committing;
    cache/prefetch (scope 5) is the mitigation.
- Risk: **identity cookie not readable/ridable from an inline head fetch** (third-party edge domain vs first-party CNAME).
  - Why it matters: ADR-0034's chosen option depends on it.
  - Retirement path: same probe; fallback = eager Worker boot option (recorded in ADR-0034).
- Risk: **prerender assumptions** (worker boots in a prerendered page; held beacons flush once on activation, never on
  discard; LCP relative to `activationStart`).
  - Why it matters: ADR-0035 and scope 5 hinge on it; AD-9 claims a prerender hold that does not exist in code.
  - Retirement path: EDS-testbed prerender probe (R-012 § Open questions) before accepting ADR-0035.
- Risk: **speculative fetch side effects** — Target profile pollution, fetch-triggered AJO journeys, server-call volume.
  - Why it matters: correctness of customer reporting + licensing cost.
  - Retirement path: confirm with the Target/AJO teams; default eagerness `moderate`/`conservative`.
- Risk: **`SuppressDisplay` reporting** — alloy emits it only for in-app conflicts today; whether Target A4T surfaces it or
  merely omits the impression is unverified.
  - Why it matters: the "honest denominator" promise.
  - Retirement path: vendor confirmation; until then promise it in the data (CJA/any sink), not in Target reports.
- Risk: **declaration lag** — a VEC/AJO hero activity can launch before the page's wait declaration is published (on EDS
  the declaration is authored content — page metadata or a bulk-metadata row — so the launching persona can do it, but
  it is a step).
  - Why it matters: until declared, the activity is shown to nobody and the recorded exposure is not experiment-grade;
    a per-browser memory is ruled out as the fix (returning-visitor skew).
  - Retirement path: the loud "hero proposition on an undeclared page" diagnostic; decide whether MVP10 ships a
    reference **site-level activity manifest** job (Target Activities / AJO admin APIs → per-URL manifest, ADR-0032 A″).
- Rabbit hole: **`customCode` parity** — script-element injection breaks the capability model; reject-by-default with a
  per-activity allowlist (ADR-0033) and state the at.js gap plainly rather than chase parity.
- Rabbit hole: **edge-injected decisions (tier 0)** — needs customer edge compute; keep the applier's inline-JSON source as
  an adapter, do not build the edge worker in this release.

## No-Gos

- **No visible content swap of a placement after the user could have seen it — ever** (maintainer: "a strong no-go";
  ADR-0031). `default-first` is never a default.
- **No wait without a page-context declaration** (a site-wide placement never charges LCP to pages with no live activity);
  **no unbounded hold**: every `async`/`blocking` wait has a budget; waits yield to pending consent.
- **No body-level prehide**; hide the placement (or the smallest node that can change).
- **No `customCode` execution by default.**
- **No Worker in the eager chunk** (build assertion stays).
- **No absorbing aem-experimentation decisioning**; it is hosted as the local provider.
- **No SPA route detection** in this release (manual view API at most).
- Standing vision no-gos: no non-EDS adapters, no identity store.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Scopes 1–4 (interpreter, head fetch, placements, paint policy + flag + suppress + eager exposure) | R-012 §1–§5; ADR-0031/0032/0033 accepted | The hero use case end-to-end with the two invariants gated |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Scope 7 SPA views | no prior art in corpus; EDS is MPA-first | Needs a re-entrant placement lifecycle; not hero-critical |
| Tier 0 edge-injected decisions (the CDN worker itself) | needs customer edge compute | Applier accepts inline JSON; the edge side is an adapter for a later release |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Scope 6 AJO rules engine + `insertAfterInteraction` | DOM-free engine + a new capability | Ship after the hero path; independently demoable |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Head-fetch race + cookie probe | ADR-0034 Proposed | Decides the eager landing mechanism |
| Prerender probe | ADR-0035 Proposed; AD-9 doc/code gap | Decides scope 5 and makes AD-9 true |

## JIG Handoff

- Candidate JIG specs or slices: none existing cover this; nearest are
  [005](../specs/005-uc1-pzn-exposure/spec.md) (exposure), [033](../specs/033-alloy-config-wiring/spec.md)/[034](../specs/034-alloy-config-followups/spec.md)
  (placements + reserve), [025](../specs/025-worker-dom-mirror/spec.md) (dom-apply plumbing), [018](../specs/018-reservespace-security/spec.md)
  (injection constraints).
- New JIG work to draft: one spec per vertical scope above (scopes 1–4 in this release; 5 after the prerender probe; 6–7
  split/deferred), plus two **probe spikes** (head-fetch race + cookies; prerender) that retire ADR-0034/0035.
- Patch-ready instructions, if any: doc corrections — `docs/product-vision.md` names `insertAfterInteraction` as shipped
  (it rejects); `docs/architecture.md` AD-9 describes a prerender hold that has no implementation; alloy config README
  wording on `placements` is stale.
- Non-mutating notes: R-012 is the source of truth for the brainstorm; ADR-0031–0035 lock/propose the decisions; open
  items are tracked in [refinement-todo § Personalization runtime](../refinement-todo.md).

### Architecture appetite

A leanness ceiling jig reads before drafting specs. Appetite / no-gos /
spike pointer only — shaper never names an ADR, module boundary, mechanism,
or design; jig decides those.

- Investment posture (upper bound — "at most", never "at least"): _TBD (owner)_
- Over-investment no-gos (over-builds to refuse): _TBD (owner)_
- Spike (architectural risk to retire early): _TBD (owner) — candidates named under Risk-First above_

## Release-Check Criteria

- Before this release can ship:
  - A Target VEC hero activity and a lazy-block activity land on the EDS testbed with **zero placement mutation after
    first in-viewport paint** (rig-gated) and **|CLS Δ| ≤ 0.01** (advisory band, spec 029).
  - A page with **no declared wait** shows no LCP regression vs the no-personalization arm (advisory TBT/LCP band).
  - The hero decision is **in hand before the hero section reveals** on a warm/prefetched navigation (no hold engaged);
    under a cold load the declared policy engages and **releases within its budget**; a late decision is **suppressed, not
    swapped** (`propositionSuppressDisplay(reason: Timeout)` at the Edge seam) and a never-arrived one is counted
    (`pzn_decision_missing`); on an undeclared page an `initialViewport` placement's proposition is suppressed with reason
    `Undeclared` on every device and no `initialViewport: true` placement is ever written.
  - Display notifications carry the exact `{id, scope, scopeDetails}` of what rendered (ids-in == ids-notified on the
    minted-Edge rig); exposure also reaches a non-Adobe sink; aem-experimentation exposure is captured in eager.
  - A Target form-based mbox and an AJO code-based surface land via placement metadata.
  - `lcp_hold_ms` and the suppression rate are emitted per placement.
  - No regression to the stable core or any MVP1–9 connector; the eager chunk still asserts no `createAirlock`/`Worker`.
- Evidence to inspect: the flicker-by-construction rig, the 038-style oracle run against the minted Edge, a live
  Target/AJO property run (creds-gated; carried as a named residual if unavailable, never silently narrowed).
- Known missing signals: no servo release-signal artifact exists for this plan; release-check criteria remain advisory.
  Live Target/AJO credentials are not available in the sandbox (013 pattern).
