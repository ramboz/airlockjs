# Release Plan: MVP7 — Connector Breadth (the pixel archetype)

## Status

`candidate`

**Shaped 2026-09-03 as a reconciliation** — spec 026 (the generic pixel connector) was built *ahead of the
committed MVP4→5→6 path*, and both MVP4 and MVP5 explicitly no-go "broader connector breadth (pixel/…) — that
is MVP7+." This plan gives that already-built work an honest release home so the board offers a real
**MVP5-vs-MVP7** sequencing choice. **It is `candidate`, not committed** — which release goes next is the
maintainer's call.

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- **Breadth is where the adoption leverage is, and it was deferred to "MVP7+".** MVP1–3 shipped the runtime +
  both connector archetypes + the enforcement teeth; MVP4 (committed) covers the *core AEM stack* — GA4 +
  governed alloy + `helix-rum`. Everything beyond those three vendors — the long tail of martech a real site
  actually runs — was pushed to MVP7+ ([R-007](../research/R-007-real-prod-stack-breadth.md); MVP4/MVP5
  no-gos).
- **[R-007](../research/R-007-real-prod-stack-breadth.md) named the single biggest leverage win: a generic
  *pixel* connector.** ~10 of the ~21 classified real-stack tools are GET-pixel vendors that fit **one
  config-driven archetype** — declare `{endpoint, eventMap, paramMap}`, get a governed, off-thread,
  never-reads-`ctx` GET beacon, with **zero per-vendor connector code.**
- **Spec [026](../specs/026-generic-pixel-connector/spec.md) already built that archetype — ahead of plan.**
  026-01 (Meta Pixel through the generic connector, governed + dispatched — the archetype proof), 026-02
  (LinkedIn Insight + Bing UET as **pure configs, zero connector code** — the generalization proof), 026-03
  (the `PixelVendorConfig` contract: pinned, validated, conformance-tested), 026-05 (live-shippability — the
  `pixel-chamber.worker.js` bundle entry + the N-worker build assertion). **All DONE.** The archetype is
  proven and shippable at the Node/vitest level; what remains is the identity/POST depth, real vendor breadth,
  and the authoring ergonomics.
- **Why now (or not-now):** the leverage is real and the head-start is large (4 slices banked). But it is
  **off the committed value path** — MVP4 is one residual-close from shipping and MVP5 (the inspector +
  scoreboard, the *visible* value story) is untouched. MVP7 exists so that choice is made on an honest board,
  not by continuing to build breadth off-plan.

## Appetite

- **TBD — the maintainer sets this when sequencing MVP5-vs-MVP7.**
  - **Proposed scope note (not a commitment):** likely a **2-week small-batch box** like the others — but the
    4-slice head-start means MVP7 may run *lighter* than a from-scratch box. Time fixed, scope flexes per the
    cutline.
  - **Fixed core (if committed):** a bounded **vendor-breadth set** shipped as pure configs (the archetype's
    payoff) + the **drop-in authoring ergonomics** for pixels.
  - **Variable / gives first:** the **026-04 identity/POST depth** (real-driver-gated — flexes on a live
    captured beacon being available); the *size* of the vendor-breadth set.

## Solution Outline

- **Finish the pixel archetype's depth — spec [026-04](../specs/026-generic-pixel-connector/spec.md)
  (identity / advanced-matching + POST/`ctx`-body).** This is the one genuine scope step, not a config add:
  the current archetype is **GET-only and never reads `ctx`** (the AC8 invariant that keeps a compromised
  chamber from exfiltrating identity). Advanced matching / Conversions-API-style beacons need POST bodies and
  `ctx` reads, which *break that invariant deliberately* and must be re-governed. **Real-driver-gated** — it
  needs a live captured beacon to ground the wire shape (per the ADR-0020 grounding discipline; a speculative
  POST proof already failed 026-02's frame-critique).
- **Vendor breadth — add more GET-pixel vendors as pure configs.** The archetype's whole point: each new
  vendor is a config fixture + tests, zero connector code. Cut to the highest-leverage vendors (don't
  enumerate the long tail).
- **"Drop-in is the bonus" — pixel authoring ergonomics.** The author-facing path to declare a pixel config
  and boot it on an EDS page, so breadth is *consumable*, not just *expressible*.

## Risks / Rabbit Holes

- **026-04's POST/`ctx` path breaks the clean GET-only invariant** — it is the one place identity can leak,
  so it must be re-governed, not just enabled. Real-driver-gated: without a real captured beacon it
  rabbit-holes on speculative wire-fidelity (the exact failure 026-02's frame-critique caught). Do not build
  it until a live capture grounds it.
- **Vendor-breadth list can balloon.** ~10 vendors fit; shipping all of them is not the proof. Ship a bounded
  set that demonstrates the archetype generalizes; leave the rest as trivially-addable configs.
- **Breadth without the value story is a weaker adoption pitch.** MVP7 widens *what airlock governs*; MVP5
  makes *why that matters* visible. Shipping breadth before the inspector risks "more connectors, still can't
  see the governance."

## No-Gos

- **Not the wider R-007 breadth** — **no** forms (Marketo Forms2 / formjacking), **no** Segment
  host-vs-replace, **no** OneTrust consent driver. Those are **MVP8+** ([R-007](../research/R-007-real-prod-stack-breadth.md));
  they are different patterns, not the pixel archetype.
- **No identity resolution / first-party cookie store** (standing vision no-go). 026-04 governs a vendor's
  *own* advanced-matching beacon; it does not build airlock identity.
- **No live vendor identifiers** — synthetic only (`000000000000000`, `G-DEBUGTEST0`, `evil.example`, …),
  per the standing session constraint and ADR-0020 grounding.
- **No architecturally-excluded classes** (session-replay, live-chat, heatmap) — excluded by mechanism
  (R-007), not deferred.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **The pixel archetype** — generic config-driven GET-pixel connector, governed + off-thread + never-reads-`ctx` | [spec 026](../specs/026-generic-pixel-connector/spec.md) 026-01/02/03/05 **DONE** | Already built ahead of plan; this plan homes it |
| **A bounded vendor-breadth set** — more GET pixels as pure configs (zero connector code) | R-007 (~10 vendors fit); 026-02 proved 3 (Meta/LinkedIn/Bing) | The archetype's payoff — breadth at config cost |
| **Drop-in pixel authoring ergonomics** — declare a config + boot on an EDS page | "drop-in is the bonus" (session direction) | Breadth must be consumable, not just expressible |

### Defer / Split

| Item | Evidence | Rationale |
|---|---|---|
| **026-04 identity / advanced-matching + POST/`ctx` body** | [spec 026-04](../specs/026-generic-pixel-connector/spec.md) (deferred, real-driver-gated) | Breaks the GET-only/no-`ctx` invariant; needs a live captured beacon to ground — gives first if the box tightens |
| **Wider breadth: forms (Marketo), Segment, OneTrust consent driver** | R-007 | Different patterns, not the pixel archetype — **MVP8+** |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **Capture a real pixel beacon** (a live vendor request) to ground any POST/advanced-matching wire shape | ADR-0020 grounding; 026-02 frame-critique (speculative POST failed) | Determines whether 026-04 is in-scope this box or defers |

## JIG Handoff

- Spec [026](../specs/026-generic-pixel-connector/spec.md) is the anchor: 026-01/02/03/05 **DONE**; **026-04**
  (identity/POST) deferred + real-driver-gated. Link [`connectors/pixel/`](../../connectors/pixel/).
- New slices for: the bounded vendor-breadth set, the drop-in authoring path, and — **iff** a live capture
  grounds it — 026-04.
- The `PixelVendorConfig` contract ([contracts/pixel-connector.d.ts](../../contracts/pixel-connector.d.ts))
  is already pinned (026-03); extend it, don't rewrite, if 026-04 adds a POST shape.

## Release-Check Criteria

- The pixel archetype ships **N real GET-pixel vendors as pure configs with zero per-vendor connector code**
  (N and the vendor set are the maintainer's scope call).
- An EDS author can **declare a pixel config and boot it** (drop-in ergonomics).
- **Any** POST / advanced-matching path added is grounded on a **real captured beacon** — never a speculative
  wire shape.
- **CWV preserved**; **no live identifiers** anywhere.
- No regression to the GA4 / alloy / RUM connectors or the MVP1–4 capability contracts.

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-09-03 (reconciliation — homes the off-plan spec-026 pixel work so the board offers an
honest MVP5-vs-MVP7 choice; status `candidate`, appetite **TBD** pending the maintainer's sequencing call).
The R-008 worker-dom / costly-DOM containment thread (specs 023–025, Lever 2) is a **separate, paused**
investigation — see [lightweight-decisions.md](../decisions/lightweight-decisions.md) 2026-09-03 — not part
of this breadth plan._
