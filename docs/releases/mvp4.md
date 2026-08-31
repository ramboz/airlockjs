# Release Plan: MVP4 — The Core AEM Stack (governed alloy + RUM)

## Status

`committed`

**Committed 2026-08-31** (maintainer: "commit as is") — kept as **one 2-week box** (not split into
`alloy-governance` | `helix-rum + fruit`). Appetite fixed at 2 weeks; scope flexes per the cutline. The bet:
the core of any AEM stack — GA4 + **governed** alloy + `helix-rum` — running in airlock, de-risked by
front-loading the alloy XDM-governance feasibility probe. First slice: that probe.

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- **The maintainer's framing (2026-08-31):** the *core of any AEM / Adobe site* is **GA4 + Adobe Experience
  Cloud (alloy) + RUM.** Get those three running **and governed** in airlock and you cover the core of any
  AEM stack. GA4 is done (governed, MVP1–3). The other two have gaps:
  - **alloy is isolated but not *governed*.** MVP2 wrapped it; MVP3 gave it endpoint-ceiling + config-integrity
    + confinement — but its **payload + consent governance was deliberately split** (probe-gated: stripping /
    consent-injecting a *vendor-built XDM body* is fragile — [ADR-0012](../decisions/adr-0012-payload-governance.md)
    Split, ADR-0007 alloy residual). So the security/compliance thesis is only *half* true for the archetype
    (a stock untrusted vendor SDK) that most needs it.
  - **RUM is unhosted.** `helix-rum-js` — Adobe/AEM's sampled RUM, on **every EDS page** already (`sampleRUM`
    in `aem.js`) — is the third core piece and airlock doesn't yet host it ([R-007](../research/R-007-real-prod-stack-breadth.md)).
  - **Low-hanging production residuals** from MVP1–3 "need to be closed" (see Cutline).
- **Why now:** MVP3 built the governance machinery and [R-007](../research/R-007-real-prod-stack-breadth.md)
  measured the real stack. The core is **one governance-completion + one connector + a handful of closures**
  away.

## Appetite

- **2 weeks (fixed — small-batch).** Time is fixed; **scope flexes to fit.**
  - **Fixed core (must land):** the **alloy XDM-governance feasibility probe** (Risk-First, *front-loaded* —
    it tells us by mid-box whether a deep strip is feasible), a **governed-or-read-minimized alloy outcome**,
    and the **`helix-rum` connector**.
  - **Variable scope (gives first if the box tightens):** the *depth* of the alloy payload strip (probe finds
    XDM-strip hard → ship **read-minimization + the existing confinement**, defer the deep strip); *which*
    low-hanging-fruit items close (the **dispose/idempotent-boot guard** is the must-close; the eslint scope +
    protocol pin flex).
  - **Note:** MVP4 is the most ambitious 2-week box. If you'd rather split it, it cleaves cleanly into
    **`alloy-governance`** | **`helix-rum + fruit`** (two 2-week boxes). Kept as one here, de-risked by
    front-loading the probe.

## Solution Outline

- **Host the `helix-rum-js` connector.** Bring Adobe's sampled RUM into airlock as a connector (wrapped-SDK /
  beacon shape). On EDS, decide **feed / replace / coexist** with the `sampleRUM` already on the page.
  (Airlock *being* the RUM layer — the subsume path — is deferred to MVP5; MVP4 **hosts** it.)
- **Finish alloy governance.** Lead with a **feasibility probe** (à la MVP3's live-Alloy re-probe): can the
  vendor-built XDM body be governed — sensitive-field strip + XDM consent injection — **without breaking it**?
  Then bind airlock's *existing* governance (the MVP3 payload denylist + purpose-vector consent) at alloy's
  wrapped-SDK seam ([`core/wrapped-sdk-host.js`](../../core/wrapped-sdk-host.js), the deferred *second
  placement*). If the probe finds strip-at-seal infeasible, **fall back honestly to read-minimization** +
  the confinement/config-integrity already in place.
- **Close the low-hanging fruit** — the tracked, genuinely-quick production residuals (below).

## Risks / Rabbit Holes

- **Alloy XDM governance is genuinely fragile** — the reason MVP3 split it. The vendor builds the XDM body
  inside the chamber; a blind strip / consent-inject can break its structure. The Risk-First probe must settle
  feasibility **before** committing the governance scope; the honest fallback is read-minimization (which the
  confinement already partly provides). Alloy's **XDM `consent` shape** is a different mechanism than GA4's MP
  `consent` field — the ADR-0007 seam is vendor-neutral but the alloy driver is new.
- **`helix-rum` coexistence on EDS.** `sampleRUM` is already on the page; hosting `helix-rum` in airlock must
  decide feed/replace/coexist **without double-counting RUM** or breaking the AEM RUM pipeline.
- **"Low-hanging fruit" scope creep.** The residual list is long — cut it to the genuinely-quick, must-close
  items; don't let it balloon into a governance/consent-completion project (that's MVP5+).

## No-Gos

- **Not the inspector / airlock-as-RUM-layer / value-proof** — those are MVP5. MVP4 *hosts* `helix-rum`; it
  does not *subsume* RUM.
- **Don't break the existing EDS `sampleRUM` pipeline.**
- **Don't force alloy governance if the probe says infeasible** — fall back honestly to read-minimization;
  never ship a strip that breaks alloy.
- **No broader connector breadth** (pixel/ads connectors, forms, Segment, OneTrust) — that is MVP7+
  ([R-007](../research/R-007-real-prod-stack-breadth.md)).

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **`helix-rum-js` connector** — host Adobe's sampled RUM; EDS `sampleRUM` coexistence decided | R-007 | The third core piece of any AEM stack |
| **Alloy-side payload + consent governance** — **DELIVERED** ([spec 020](../specs/020-alloy-xdm-governance/spec.md), both slices DONE 2026-08-31; [ADR-0013](../decisions/adr-0013-alloy-consent-enforcement.md)): the Risk-First probe (020-01) found alloy's payload **already read-minimized by construction** (`toXdm` 2-field allowlist + `context:[]`) with an optional Edge-safe strip, and consent = the **`setConsent` command**, not a body field. 020-02 implements the **trusted seam-side drop** (`egressVerdict` **strict** at `core/wrapped-sdk-host.js` — a compromised chamber's un-granted egress is held at the seam, machine-verified) **+ the `setConsent` delegate** (`connectors/alloy/consent.js`, driven `configure→setConsent→sendEvent`) **+ the optional strip**. Supersedes ADR-0012's alloy-Split + resolves ADR-0007's alloy residual. **Named residuals** ([refinement-todo](../refinement-todo.md)): `pending→hold+flush` (the pending-window question); the live `setConsent(collect:n)` flow + HTML-rig wiring; the dynamic-`import()` residual bounds the seam trust claim. | ADR-0012 Split; ADR-0007 alloy residual | Turns "alloy isolated" into "alloy **governed**" — the half of the thesis MVP3 left. **GA4 + Adobe now both fully governed.** | 
| **Low-hanging fruit** — dispose/idempotent-boot guard (OQ12-4); the alloy-chamber blanket `eslint-disable` scope; config-integrity **protocol pin** (http-downgrade on the egress allow-list, ADR-0004) | refinement-todo OQ12 / 014-01 / 015-02 residuals | Genuinely-quick, must-close before real use |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Inspector / airlock-as-RUM-layer (subsume) / before-after CWV value-proof | [MVP5](mvp5.md) | Make it visible + own the RUM layer — the next milestone |
| Adoption / distribution / 1.0 | [MVP6](mvp6.md) | Productionize after the core stack is complete |
| Broader connector breadth (pixel connector, forms, Segment, OneTrust driver) | [R-007](../research/R-007-real-prod-stack-breadth.md) | MVP7+ roadmap |
| Deeper consent residuals — mid-session reshape worker-`ctx` re-send, per-purpose revoke-stop | refinement-todo 017 follow-ups | Not low-hanging; consent-completion is MVP5+ |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| **Alloy governance *depth*** — if the XDM-strip probe is infeasible, the deep payload strip defers and MVP4 ships **read-minimization + the existing confinement** as the honest alloy defense | ADR-0012 Split rationale ("strip-at-seal fragile; else rely on read-minimization + config-integrity") | The probe outcome determines the scope; the fallback is already-strong (confined + config-integrity + ceiling) |
| The body-`orgId` co-vector for alloy config-integrity (ADR-0011 residual) | refinement-todo 013-03 / ADR-0011 open residual | Fold into the alloy-governance probe if cheap; else keep tracked |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **The alloy XDM-governance feasibility probe** — the lead item (mirrors MVP3's live-Alloy re-probe): can alloy's vendor-built XDM body be governed (strip sensitive fields, inject XDM consent) without breaking it? | ADR-0012 Split; ADR-0007 | Determines the entire alloy-governance scope (strip vs read-minimization) — settle before committing |
| **`helix-rum` coexistence probe** — feed / replace / coexist with the EDS `sampleRUM` already on the page | R-007 | Avoids double-counting / breaking the AEM RUM pipeline |

## JIG Handoff

- Resolve the **alloy-governance split** here (ADR-0012's deferred second placement + ADR-0007's alloy consent
  driver), **probe-first** — the probe may conclude read-minimization, which is a design outcome to record.
- The **`helix-rum` connector** is a new connector (`airlock/rum` / `airlock/helix-rum`) — pin its manifest +
  contract (`/jig:contracts`) before implementation.
- Close the residuals: **OQ12 item 4** (dispose/idempotent-boot), the alloy-chamber **eslint scope**, and the
  config-integrity **protocol pin** (route to the ADR-0004 egress allow-list, not config-integrity's
  host+tenant surface).
- New specs for: the alloy-governance probe + implementation, the `helix-rum` connector, the low-hanging
  closures.

## Release-Check Criteria

- **The core AEM stack — GA4 + Adobe/alloy + `helix-rum` — all run in airlock.**
- **Alloy is not just isolated but *governed*:** a sensitive / unconsented field is stripped or held for alloy
  too — *or*, if the probe found strip-at-seal infeasible, alloy is **read-minimized** and the honest boundary
  is documented (never a strip that breaks alloy).
- **`helix-rum` runs in airlock without breaking the EDS `sampleRUM` pipeline** (no double-count).
- **The named low-hanging residuals are closed** (dispose/idempotent-boot guard; alloy-chamber eslint scope;
  the egress-allow-list protocol pin).
- **No regression** to the GA4 enforcement or the MVP1–3 connector/capability contracts.

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-08-31 (set by the maintainer as "the core of any AEM stack — RUM + governed alloy + the
low-hanging fruit"; the inspector/value-proof + airlock-as-RUM-layer moved to MVP5, adoption/1.0 to MVP6, the
broader breadth to MVP7+/R-007). Appetite: **2 weeks (fixed, small-batch)** — alloy-probe-first,
scope-flexes._
