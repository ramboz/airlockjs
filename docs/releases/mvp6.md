# Release Plan: MVP6 — Adoption & 1.0 Readiness

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

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
  gap to adoption is *consumption + hardening + stability + a real-site proof.*

## Appetite

- **2 weeks (fixed — small-batch).** Time fixed; **scope flexes.**
  - **Fixed core (must land):** the **distribution decision + setup** (it gates all consumption) + the
    **name-scoped cookie-grant wrapper** (OQ13-4, security-safe) + `reserveSpace` **eager-phase production
    wiring** (018-h).
  - **Variable scope (gives first if the box tightens):** the **1.0 API pin** (freeze only the surfaces
    MVP1–5 proved; the rest stays pre-1.0) + the **real-production-site validation** (flexes on the customer
    stack being available — distribution + hardening is the floor).
  - _(The dispose/idempotent-boot guard, OQ12-4, is closed earlier as MVP4 low-hanging fruit — not repeated
    here.)_

## Solution Outline

- Decide + implement **distribution** (OQ8) — the consumption channel for the EDS audience (git-subtree à la
  aem-martech, and/or npm), so a site can drop airlock in.
- Land the **remaining production-hardening residuals**: name-scoped cookie-grant wrapper + name validation
  (OQ13-4), `reserveSpace` eager-phase production wiring (018-h). _(The dispose/idempotent-boot guard, OQ12-4,
  and the alloy-chamber eslint scope are closed earlier as MVP4 low-hanging fruit.)_
- Commit a **1.0 API stability contract** — the connector interface + capability API + `push()` surface,
  pinned as stable (the surfaces MVP1–4 proved).
- **Validate on a real production site** (the customer prod stack) with CWV preserved — the adoption proof.

## Risks / Rabbit Holes

- **Distribution choice (subtree vs npm) shapes the whole consumption story** — a rabbit hole if litigated
  forever; decide early with the EDS convention as the default.
- **Real-site integration surfaces unknowns the testbed hides** (real CSP, real theme, real martech
  interactions). The customer stack is the ideal substrate but is **beyond current connector support** (GA4 +
  Adobe/alloy today), so the adoption proof is "airlock hosts the **supported subset** on a real page + CWV
  preserved," **not** "airlock hosts the whole stack." Full-stack breadth is the long-term target — see
  [R-007 the real-prod-stack breadth benchmark](../research/R-007-real-prod-stack-breadth.md).
- **1.0 is a real commitment** — freezing the API before it is settled locks in mistakes. Freeze only the
  surfaces MVP1–4 proved stable; keep the rest pre-1.0.
- **The cookie-grant wrapper touches the identity/cookie boundary (OQ13)** — a security-sensitive surface; the
  name-validation-on-set (attribute-injection defense) must be right.

## No-Gos

- No **1.0 stability commitment before the API is actually settled** (don't freeze prematurely).
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
| **Distribution decision + setup** (OQ8: git-subtree and/or npm) | OQ8; aem-martech convention | A site cannot adopt what it cannot consume |
| **Remaining production-hardening residuals** — name-scoped cookie-grant wrapper + name-validation (OQ13-4), `reserveSpace` eager-phase production wiring (018-h) _(dispose guard + eslint scope closed in MVP4)_ | refinement-todo OQ13; spec 018 item h | Security-safe, production-wired |
| **1.0 API stability pin** — connector interface + capability API + `push()` surface | contracts/; every release note's pre-1.0 caveat | Adoption needs a stability contract |
| **Real-production-site validation** — supported subset (GA4 + Adobe/alloy) on a real page, CWV preserved | Customer prod stack (R-007) | The adoption proof: airlock runs on a real site at ~zero CWV cost |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Non-EDS adapters (Astro / Vercel / Jamstack) | vision § Identity ("next") / § Scope no-go | Post-1.0 portability breadth |
| Service-worker egress chokepoint; edge decision/egress drivers | vision § Scope | Later progressive enhancement; the seams exist, the drivers come later |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| **Hosting the customer's *full* prod martech stack** — beyond current connectors | [R-007](../research/R-007-real-prod-stack-breadth.md) | A **breadth-validation target** that scopes the eventual connector roadmap (the pixel archetype, Segment, Marketo Forms, the OneTrust consent driver), NOT an MVP6 commit — and some tools (session-replay, live-chat, identity-resolution) are **architecturally excluded by design** (vision no-gos), so "100% of the stack" is never the goal |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| **The distribution decision** (it gates consumption) | OQ8 | Everything downstream consumes through it |
| **A real-site dry-run** — does airlock's supported subset run cleanly on the customer site's real page/CSP/theme, CWV preserved? | Customer stack (R-007) | Surfaces the real-integration unknowns before the 1.0 pin |

## JIG Handoff

- Resolve **OQ8** (distribution) + **OQ12 item 4** (dispose/idempotent-boot) + **OQ13 item 4** (name-scoped
  cookie-grant wrapper) + **spec 018 item h** (`reserveSpace` eager-phase wiring) here.
  - **OQ8 RESOLVED (2026-09-04)** → [ADR-0015: git-subtree of ready-to-serve built artifacts](../decisions/adr-0015-distribution-git-subtree.md)
    (npm deferred, not rejected). Next: the distribution-**setup** spec (served-artifact layout decoupled from the
    testbed + documented `git subtree add`/`pull`), whose first proof is subtree-onto-a-clean-EDS-checkout → boot,
    CWV preserved.
- Pin the **1.0 API surface** as an external contract (`/jig:contracts`) — the connector interface, capability
  API, `push()` surface.
- New specs for distribution, the hardening residuals, the 1.0 pin, and the real-site validation.

## Release-Check Criteria

- An EDS site can **install + boot airlock via the decided distribution channel** (drop-in, no edge account
  for the common case).
- A **second boot does not leak** a Worker / listeners (dispose/idempotent-boot guard) — library-safe.
- A connector cookie grant is **name-scoped + name-validated** (no raw whole-jar access; no attribute
  injection).
- `reserveSpace` is **wired into the EDS eager pre-paint phase in production** (not just rig-demonstrated).
- The API carries a documented **1.0 stability commitment** for its frozen surfaces.
- A **real production site runs airlock's supported connectors with CWV preserved** (before/after — the MVP5
  scoreboard on a real page).

_No servo release-signal artifact exists for this plan yet; the release-check criteria are desired future
evidence, not measured signals._

_Last shaped: 2026-08-31 (renumbered MVP5→MVP6 when MVP4 became "the core AEM stack" and MVP5 became the
inspector/value-proof; after MVP3 shipped `v0.3.0`; appetite **2 weeks (fixed, small-batch)** — distribution-first, scope-flexes)._
