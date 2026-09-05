---
status: IN_PROGRESS
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 035: Name-scoped cookie-grant hardening (OQ13-4)

> Land the MVP6 fixed-core **security** residual [OQ13 item 4](../../refinement-todo.md): the ONE live connector cookie
> grant (alloy) reaches the **whole `document.cookie` jar** on read and writes to the **real jar with the cookie name
> unvalidated + unscoped**. Before that grant is trustworthy it needs a **default-deny name-scope** (per
> `CapabilityRequest.cookies`; ADR-0006 `granted = declared ∩ allowed`) on **both halves** of the boundary + the cookie
> **name validated** (an unvalidated name is an attribute-injection surface). See the [MVP6 release plan](../../releases/mvp6.md)
> (fixed core: "name-scoped cookie-grant wrapper + name validation, security-safe").

## Overview

**Frame-critique retarget (2026-09-05).** The first draft pinned both gaps on `createCookieCapability`
(`adapters/eds/cookies.js`) — a `{get,set}` accessor — and proposed a `scopeCookieCapability(cap, grantedNames)` wrapper
over it. The frame-critique (verdict `needs-changes`, verified against source) showed that surface is **host-side only,
granted to NO connector**: its own docstring says "no connector grant flow is exercised yet, and the chamber stays
cookie-free"; the adapter uses it host-side for GA4-ctx sourcing (`index.js:391-395`) with attribute-safe literals. A
`{get,set}` wrapper there hardens a surface no connector uses. **The real, live connector-grant cookie boundary is the
alloy chamber's**, and it has two distinct gaps on two distinct code paths:

1. **Whole-jar READ leak (confidentiality).** `bootAlloy` seeds the chamber with the **entire** origin jar —
   `seedCookie = (document.cookie) || ""` (`adapters/eds/index.js:1077`) → `host.init({cookie: seedCookie})` →
   `buildCaps(seedCookie)` → `createSyncCookieCache(seedCookie)` (`alloy-chamber.worker.js:124`); the chamber's
   `readSync()` returns the **whole jar** (`connectors/alloy/sync-cookie-cache.js:35-37`), and alloy's document-cookie
   shim reads through it (`alloy-chamber.worker.js:206-214`). So a connector that declared only
   `["com.adobe.alloy.getTld","kndctr_","AMCV_","demdex","s_ecid"]` can still read `_ga`, a session cookie, an auth
   cookie — everything. ADR-0006's grant law is **unenforced for the read side**, and this leak is **live today**.
2. **Unvalidated + unscoped WRITE to the real jar (integrity + injection).** The chamber's `writeSync` posts a raw
   `name=value; attrs` string as `cookie-writeback` (`sync-cookie-cache.js:49`, `alloy-chamber.worker.js:127`); the host
   handler reconciles it (`reconcileForBrokerJar` drops `domain=`/`secure`/`samesite=` only —
   `core/wrapped-sdk-host.js:466,565-574`) and writes it **verbatim** to the real jar via
   `caps.cookies.reconcile` → `document.cookie = reconciled` (`adapters/eds/index.js:1017-1019`). The **cookie name is
   never validated** (a name like `x` carrying an injected attribute, or a newline, is written as-is) and **never
   scoped** (the untrusted chamber can persist `_ga` or any name to the real jar, not just its declared cookies). The
   chamber is UNTRUSTED (034-01), so this is a real integrity + attribute-injection surface, **live today**.

Both are **security hardening a real grant must not ship without** — the MVP6 no-go "the cookie-grant wrapper touches the
identity/cookie boundary; the name-validation-on-set must be right." Both enforcement points are **host-side / on the
trusted seam** (the seed is filtered before it crosses to the worker; the write-back is validated + scoped on the host
as it comes back from the untrusted chamber) — consistent with 034-01's trusted-seam principle (never trust the chamber
to scope itself).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **Grounded (read 2026-09-05, verified at the frame-critique):**
  - `createCookieCapability(document)` is a whole-jar `{get,set}` (`adapters/eds/cookies.js`), used **HOST-side** for
    GA4-ctx sourcing (`index.js:391-395`) — its docstring states no connector is granted it; the GA4 connector is
    "cookie-free … unwired" (`connectors/ga4/connector.js`). ⇒ NOT the live grant surface (a `{get,set}` wrapper is a
    **named follow-on** for whenever a connector is actually granted it, not this slice).
  - The alloy chamber's async `get`/`set` are "present for SHAPE (unused by alloy)"; alloy reads/writes
    `document.cookie` through the chamber shim → `caps.cookies.sync.readSync/writeSync` (`alloy-chamber.worker.js:130-131,
    206-224`). The caps are built **inside the worker** (`buildCaps`, `:124-145`) — beyond a host-side `{get,set}`
    wrapper's reach; the enforceable seams are the **seed in** and the **write-back out**.
  - READ path: `index.js:1077` seeds the whole `document.cookie`; `readSync()` returns the whole jar
    (`sync-cookie-cache.js:35-37`).
  - WRITE path: `writeSync` → `cookie-writeback` → `reconcileForBrokerJar` (drops domain/secure/samesite,
    keeps `name=value` verbatim) → `caps.cookies.reconcile` → `document.cookie = reconciled` (`wrapped-sdk-host.js:466`,
    `index.js:1017-1019`).
  - Declarations mix exact + PREFIX. **alloy** (`connector.js:117`) declares `["com.adobe.alloy.getTld", "kndctr_",
    "AMCV_", "demdex", "s_ecid"]` — `kndctr_`/`AMCV_` are prefixes, the other three exact; it declares **no `_ga_`**
    (that is a GA4 cookie: GA4 declares `_ga` exact + `_ga_` prefix). `CapabilityRequest.cookies: readonly string[]`
    (`contracts/capability.d.ts:33`) — **no prefix marker in the type**.
    ADR-0006 `granted = declared ∩ allowed` (`core/consent.js`) — the grant *law*, but **silent on the enforcement
    *shape***, so the shape is this spec's to design (not a settled residual).
- **Seam threading (verified at the frame-critique re-run 2026-09-05 — corrects the first draft's two wrong hints):**
  the declared set is **NOT reachable on main today** (`index.js:38` imports only `ALLOY_INTERACT_ENDPOINT`;
  `createAlloyConnector` + its `capabilities.cookies` manifest — `connector.js:67,113` — is worker-only), so the
  single-source-of-truth needs a **static `ALLOY_COOKIE_NAMES` export from `connector.js`** (mirroring
  `ALLOY_INTERACT_ENDPOINT`) imported by both the worker manifest and main-thread `bootAlloy`. And the write-back
  handler enforces off the **`createWrappedSdkHost({…})` construction closure** (`wrapped-sdk-host.js:464-471`), NOT
  `host.init` (which only `postMessage`s into the untrusted chamber, `:499-501`) — so the scope set is a
  `createWrappedSdkHost` option alongside `configIntegrity`/`endpointCeiling` (`index.js:1046-1063`).
- **The frame-critique must ground the remaining load-bearing specifics** (NOT asserted here): (a) the
  **exact-vs-prefix match rule** over a `readonly string[]` with no prefix marker; (b) the **name-validation grammar**
  (RFC 6265 token) + throw-vs-drop; (c) whether a **scoped seed still round-trips alloy** (alloy reads only its own
  declared names + the getTld probe cookie it writes itself, so a declared-name-scoped seed SHOULD preserve function —
  but this is the no-regression hypothesis the slice must PROVE, not assume); (d) whether the
  `SecurityError`→graceful-null-identity rider is in-scope.

## Decomposition

**SPIDR — Rules, no spike** (the grant law + the name grammar are Rules over existing surfaces; 004-03/012-01/017-02
already built the cookie machinery). One cohesive security-hardening slice: the **read-scope** (seed filter) and the
**write-scope + name-validation** (write-back reconcile) are the two halves of "make the alloy cookie grant safe" and
share the granted-name set, the exact/prefix match rule, and the name-validator. (If the frame-critique finds the
two-surface application too large, it splits read-scope from write-scope+validation; the default is one slice, since a
half-scoped grant — read closed, write open, or vice versa — is an awkward, misleading intermediate.)

## Slices

- [035-01 — name-scope + name-validate the live alloy cookie grant (seed-read filter + write-back scope/validation, default-deny per `CapabilityRequest.cookies`)](slice-01-name-scoped-wrapper.md)
