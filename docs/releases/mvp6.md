# Release Plan: MVP6 — Stable Core & Validation Harness

> **Retitled 2026-09-07 ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)).** Was "Adoption &
> 1.0 Readiness". The owner's 2026-09-05 reframe moved the definition of 1.0 from "the public API is frozen" to
> "adoptable with confirmed parity" — so this milestone is no longer "1.0 readiness"; it is the **stable-core contract
> + the validation harness** that later milestones build the adoption proof on. 1.0 itself now lands with **MVP9**.
> Everything this plan set out to do is **done and landed**; what changed is the name and the release number (**v0.6.0**,
> not a 1.0 pin).

## Status

`shipped`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

**Shipped as `v0.6.0` (2026-09-07).** Owner ratified the re-scoped ladder (ADR-0018); all Include work is DONE and
landed on `main`, and the v0.6.0 cut (Emergent E1 — version bump → source `v0.6.0` tag + `dist-v0.6.0` tree/tag) ran.
Release-check verdict: **ship** — with the two honest caveats below (018-h de-facto closed via 033-03; the live
real-site run carried to MVP9). This is the "Stable Core & Validation Harness" milestone: the stable-core contract
(037 / ADR-0017), distribution (031), cookie-grant hardening (035), and the real-site validation harness (036) — the
instrument the adoption proof (MVP9) runs.

**Honest ship caveats (none blocking the v0.6.0 cut — the work shipped; these are scope truths carried forward):**
1. **`reserveSpace` eager-phase production wiring (018-h)** — recorded "still open" in `docs/refinement-todo.md`, but
   **de-facto closed by spec 033-03**: `reservePersonalization` (`adapters/eds/reserve-personalization.js`) is the
   synchronous eager pre-paint entrypoint called from `loadEager` and handed off to `boot(config)`. The refinement-todo
   ledger is reconciled to note this.
2. **The real-production-site run is NOT performed.** The harness + procedure shipped (spec 036, both slices), but the
   live before/after run is the operator's creds-gated step and has not been run. That release-check criterion is
   **carried to MVP9** (the real-site rewire), where it runs for real against the 1.0 rewire set. v0.6.0 is cut on what
   shipped, never on a criterion claimed met. (The named reference site runs **no Adobe Web SDK**, so the *alloy*
   real-site proof needs a different Adobe-stack site — a separate, non-1.0-gating residual; alloy is live-probed at the
   wire level by spec 013.)

## Problem / Baseline

- The runtime (MVP1), both connector archetypes (MVP2), the enforcement teeth (MVP3), the core AEM stack
  (MVP4 — governed alloy + `helix-rum`), and — pending MVP5 — the inspector are all **proven**, but airlock is
  **not yet adoptable** by a real EDS team:
  - **Distribution is unresolved (OQ8):** git-subtree (matching the aem-martech / aem-experimentation
    convention) vs npm. There is no decided way for an EDS site to *consume* airlock.
  - **Production-hardening residuals remain:** the **dispose / idempotent-boot guard** (OQ12 item 4 — a
    re-boot leaks a Worker + unload listeners and overwrites `window.airlock`); the **name-scoped cookie-grant
    wrapper** (OQ13 item 4 — `adapters/eds/cookies.js` is the raw whole-jar backing; a connector grant needs a
    default-deny name-scope + name-validation-on-set against attribute injection); **`reserveSpace`'s
    eager-phase production wiring** (spec 018 item h — the rig proves the mechanism, not the pre-paint
    production wiring); and smaller nits (the `alloy-chamber` blanket `eslint-disable` scope).
  - **The API is pre-1.0** — every release note says "not yet a stability commitment." Adoption needs a
    stability contract.
  - **airlock has never run on a real production site** — only the synthetic testbed + rigs.
- **Why now:** after MVP4 completes the core AEM stack and MVP5 makes the enforcement *visible*, the remaining
  gap to adoption is *consumption + hardening + a stable contract + a real-site validation harness.*

## Appetite

- **2 weeks (fixed — small-batch).** Time fixed; **scope flexes.**
  - **Fixed core (must land):** the **distribution decision + setup** (it gates all consumption) + the
    **name-scoped cookie-grant wrapper** (OQ13-4, security-safe) + `reserveSpace` **eager-phase production
    wiring** (018-h).
  - **Variable scope (gives first if the box tightens):** the **stable-core contract pin** (freeze only the surfaces
    MVP1–5 proved; the rest stays experimental) + the **real-production-site validation harness** (flexes on the customer
    stack being available — distribution + hardening is the floor).
  - _(The dispose/idempotent-boot guard, OQ12-4, is closed earlier as MVP4 low-hanging fruit — not repeated
    here.)_

## Solution Outline

- Decide + implement **distribution** (OQ8) — the consumption channel for the EDS audience (git-subtree à la
  aem-martech, and/or npm), so a site can drop airlock in.
- Land the **remaining production-hardening residuals**: name-scoped cookie-grant wrapper + name validation
  (OQ13-4), `reserveSpace` eager-phase production wiring (018-h). _(The dispose/idempotent-boot guard, OQ12-4,
  and the alloy-chamber eslint scope are closed earlier as MVP4 low-hanging fruit.)_
- Commit a **stable-core contract** — the connector interface + capability API + `push()` surface + the seam drivers
  + the adopter boot layer, pinned as stable (the surfaces MVP1–5 proved) and enforced by contract-stability guards.
- Ship the **real-production-site validation harness + procedure** (CWV before/after + supported-subset smoke) — the
  instrument the adoption proof (MVP9) will run.

## Risks / Rabbit Holes

- **Distribution choice (subtree vs npm) shapes the whole consumption story** — a rabbit hole if litigated
  forever; decide early with the EDS convention as the default.
- **Real-site integration surfaces unknowns the testbed hides** (real CSP, real theme, real martech
  interactions). The customer stack is the ideal substrate but is **beyond current connector support** (GA4 +
  Adobe/alloy today), so the MVP6 harness proves "airlock hosts the **supported subset** on a real page + CWV
  preserved," **not** "airlock hosts the whole stack." Full-stack breadth is the **1.0 benchmark** — see
  [R-007](../research/R-007-real-prod-stack-breadth.md), now owned by MVP7–9 (ADR-0018).
- **A stable-core freeze is a real commitment** — freezing the API before it is settled locks in mistakes. Freeze only
  the surfaces MVP1–5 proved stable; keep the rest experimental (ADR-0017's carve-out).
- **The cookie-grant wrapper touches the identity/cookie boundary (OQ13)** — a security-sensitive surface; the
  name-validation-on-set (attribute-injection defense) must be right.

## No-Gos

- No **stable-core freeze before the API is actually settled** (don't freeze prematurely — ADR-0017 froze only the
  proven surfaces).
- No **non-EDS framework adapters** yet (Astro/Vercel/Jamstack are post-1.0 breadth — vision § Scope no-go for
  first releases).
- No **service-worker egress chokepoint / edge account requirement** (drop-in-JS default; SW is a later
  progressive enhancement).
- No **identity resolution / first-party cookie store** (vision no-go) — the cookie-grant wrapper *scopes
  existing mediated access*, it does not build identity.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| **Distribution decision + setup** (OQ8: git-subtree and/or npm) | OQ8; aem-martech convention; **SHIPPED** — [spec 031](../specs/031-distribution-setup/spec.md) / [ADR-0015](../decisions/adr-0015-distribution-git-subtree.md) | A site cannot adopt what it cannot consume |
| **Remaining production-hardening residuals** — name-scoped cookie-grant wrapper + name-validation (OQ13-4), `reserveSpace` eager-phase production wiring (018-h) _(dispose guard + eslint scope closed in MVP4)_ | refinement-todo OQ13; spec 018 item h; **SHIPPED** — cookie-grant [spec 035](../specs/035-cookie-grant-wrapper/spec.md); 018-h de-facto closed by 033-03's `reservePersonalization` | Security-safe, production-wired |
| **Stable-core contract pin** — connector interface + capability API + `push()` surface + seam drivers + adopter boot layer | contracts/; every release note's pre-1.0 caveat; **SHIPPED** (2026-09-05) — [spec 037-01](../specs/037-one-point-oh-api-pin/slice-01-api-pin.md) / [ADR-0017](../decisions/adr-0017-airlock-1-0-api-contract.md): the five contract surfaces + the adopter boot layer are frozen + enforced (`test/contract-stability.test.js`); the config schema stays an explicit experimental carve-out. **The v0.6.0 cut (version-bump/tag/dist) is Emergent E1, owner-gated** — the API is pinned; the release cut is the pending outward-facing step | Adoption needs a stability contract |
| **Real-production-site validation harness** — supported subset (GA4 + Adobe/alloy) on a real page, CWV preserved | Customer prod stack (R-007); **harness + procedure SHIPPED** (spec 036, both slices): [docs/real-site-validation.md](../real-site-validation.md) — `rig/lh-live.mjs` (036-01, CWV before/after) + `rig/subset-smoke.mjs` (036-02, supported-subset presence/conformance + the named live residuals checklist); **the live run is the operator's creds-gated step — carried to MVP9** (the real-site rewire) | The instrument the adoption proof runs |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Non-EDS adapters (Astro / Vercel / Jamstack) | vision § Identity ("next") / § Scope no-go | Post-1.0 portability breadth |
| Service-worker egress chokepoint; edge decision/egress drivers | vision § Scope | Later progressive enhancement; the seams exist, the drivers come later |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| **Hosting the customer's *full* prod martech stack** — beyond current connectors | [R-007](../research/R-007-real-prod-stack-breadth.md) | **Promoted to the 1.0 benchmark** (ADR-0018), owned by MVP7 (pixel parity + the parity harness), MVP8 (ad-conversion offloading), MVP9 (the real-site rewire). Some tools (session-replay, live-chat, identity-resolution) are **architecturally excluded by design** (vision no-gos), so "100% of the stack" is never the goal |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **The distribution decision** (it gates consumption) | OQ8 | Everything downstream consumes through it |
| **A real-site dry-run** — does airlock's supported subset run cleanly on the customer site's real page/CSP/theme, CWV preserved? | Customer stack (R-007) | Surfaces the real-integration unknowns before the stable-core pin |

## JIG Handoff

- Resolve **OQ8** (distribution) + **OQ12 item 4** (dispose/idempotent-boot) + **OQ13 item 4** (name-scoped
  cookie-grant wrapper) + **spec 018 item h** (`reserveSpace` eager-phase wiring) here.
  - **OQ8 RESOLVED (2026-09-04)** → [ADR-0015: git-subtree of ready-to-serve built artifacts](../decisions/adr-0015-distribution-git-subtree.md)
    (npm deferred, not rejected). Next: the distribution-**setup** spec (served-artifact layout decoupled from the
    testbed + documented `git subtree add`/`pull`), whose first proof is subtree-onto-a-clean-EDS-checkout → boot,
    CWV preserved. **SHIPPED — spec 031.**
- Pin the **stable-core API surface** as an external contract (`/jig:contracts`) — the connector interface, capability
  API, `push()` surface.
  - **RESOLVED (2026-09-05)** → [spec 037-01](../specs/037-one-point-oh-api-pin/slice-01-api-pin.md) /
    [ADR-0017](../decisions/adr-0017-airlock-1-0-api-contract.md): the five documented contract surfaces + the adopter
    boot layer are frozen, with contract-stability guards enforcing them; the instrumentation-config schema stays an
    explicit, unguarded experimental carve-out. The v0.6.0 cut is Emergent E1 (ADR-0018), owner-gated.
- New specs for distribution (031), the hardening residuals (035), the stable-core pin (037), and the real-site
  validation harness (036) — **all DONE**.

## Release-Check Criteria

- An EDS site can **install + boot airlock via the decided distribution channel** (drop-in, no edge account
  for the common case). ✅ (spec 031, `rig:subtree`)
- A **second boot does not leak** a Worker / listeners (dispose/idempotent-boot guard) — library-safe. ✅ (MVP4)
- A connector cookie grant is **name-scoped + name-validated** (no raw whole-jar access; no attribute
  injection). ✅ (spec 035)
- `reserveSpace` is **wired into the EDS eager pre-paint phase in production** (not just rig-demonstrated). ✅
  (via 033-03 `reservePersonalization`)
- The API carries a documented **stable-core contract** for its frozen surfaces. ✅ (spec 037 / ADR-0017)
- A **real production site runs airlock's supported connectors with CWV preserved** (before/after) — **the harness +
  procedure shipped (spec 036); the live run is NOT performed and is carried to MVP9** (the real-site rewire). ⏳

_No servo release-signal artifact exists for this plan yet; the release-check criteria are measured where marked ✅ and
carried where marked ⏳._

_Last shaped: 2026-08-31 (renumbered MVP5→MVP6 when MVP4 became "the core AEM stack" and MVP5 became the
inspector/value-proof; after MVP3 shipped `v0.3.0`; appetite **2 weeks (fixed, small-batch)** — distribution-first,
scope-flexes). Retitled + re-scoped 2026-09-07 (ADR-0018): "Stable Core & Validation Harness", ships as v0.6.0._
