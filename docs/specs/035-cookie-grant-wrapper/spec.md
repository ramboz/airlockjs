---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 035: Name-scoped cookie-grant wrapper (OQ13-4)

> Land the MVP6 fixed-core **security** residual [OQ13 item 4](../../refinement-todo.md): `adapters/eds/cookies.js` is
> the **RAW whole-jar** host cookie backing. Before a connector's cookie grant is trustworthy it needs a **default-deny
> name-scope** (per `CapabilityRequest.cookies`) + the cookie **name validated on set** (an unvalidated name is an
> attribute-injection surface). See the [MVP6 release plan](../../releases/mvp6.md) (fixed core: "name-scoped
> cookie-grant wrapper + name validation, security-safe").

## Overview

`createCookieCapability` (`adapters/eds/cookies.js`) implements `GrantedCapabilities.cookies` over `document.cookie`.
Two security gaps (arch review 004-03, tracked as OQ13-4):

1. **No name-scope (whole-jar).** `get(name)`/`set(name,…)` reach ANY cookie. `CapabilityRequest.cookies` (a connector's
   *declared* cookie names — GA4 `["_ga","_ga_"]`, alloy `["com.adobe.alloy.getTld","kndctr_","AMCV_","demdex","s_ecid"]`)
   is not enforced, so a connector granted `_ga` could read/write `kndctr_` etc. ADR-0006's grant law
   (`granted = declared ∩ allowed`) is unenforced for cookies.
2. **Name used verbatim on set (attribute-injection surface).** `set` does `${name}=…`; the value is percent-encoded
   (safe) but the NAME is not validated — a name like `x; domain=evil.com` or one with a newline injects cookie
   attributes. (The current host callers use attribute-safe literals `_ga`/`_ga_<stream>`, so this is latent — but the
   primitive is unsafe the moment an arbitrary granted name reaches it.)

Both are **security hardening a real grant must not ship without** — the MVP6 no-go "the cookie-grant wrapper touches
the identity/cookie boundary; the name-validation-on-set must be right."

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Grounded (read 2026-09-05): `createCookieCapability(document)` = whole-jar async get/set, **name verbatim on set**
  (`adapters/eds/cookies.js`); used HOST-side for GA4-ctx sourcing (`adapters/eds/index.js:392` — not a connector grant).
  The **alloy chamber** builds its OWN cookie caps over a **seeded cache** (`createSyncCookieCache(seedCookie)`,
  `connectors/alloy/alloy-chamber.worker.js:121-145`) with async write-back via `caps.cookies.reconcile`
  (`core/wrapped-sdk-host.js:466-470` → `reconcileForBrokerJar`). Connector cookie declarations are exact + PREFIX
  (`kndctr_`, `AMCV_`, `_ga_`). `CapabilityRequest.cookies: readonly string[]` (`contracts/capability.d.ts:33`);
  ADR-0006 `granted = declared ∩ allowed` (`core/consent.js`).
- **The frame-critique must ground WHICH surfaces the wrapper scopes + the exact-vs-prefix semantics** (NOT asserted
  here): (a) the host accessor `createCookieCapability`; (b) the **seedCookie** the host hands the chamber (scoped to the
  connector's declared names, so the chamber's cache never holds the whole jar); (c) the **reconcile write-back**
  (a connector may only write its declared names; the written name validated). Whether all three, and whether the
  `SecurityError`→graceful-null-identity rider (OQ13-4) is in-scope, is the frame-critique's to ratify.

## Decomposition

**SPIDR — Rules, no spike** (the grant law + the name grammar are Rules over an existing surface; 004-03/017-02
already built the cookie machinery). One cohesive security-hardening slice — the name-scope and the name-validation are
the two halves of "make a cookie grant safe" and share the wrapper. (If the frame-critique finds the multi-surface
application too large, it splits validation from scope; the default is one slice.)

## Slices

- [035-01 — the name-scoped, name-validated cookie-grant wrapper (default-deny per `CapabilityRequest.cookies` + name-validation-on-set)](slice-01-name-scoped-wrapper.md)
