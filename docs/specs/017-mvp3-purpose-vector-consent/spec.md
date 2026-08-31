---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 017: purpose-vector consent enforcement — the seal reads the vector, not a scalar

## Overview

MVP3's **third enforcement spec** and the **consent half** of ADR-0006's grant law
(`granted = declared ∩ host-policy ∩ consent`). Today consent is a **binary global** gate (AD-9) and,
grounded, **nothing in `core/` enforces it at all** (grep: no consent gate; the `_ga` write is
consent-ungated — OQ13 item 1). [ADR-0007](../../decisions/adr-0007-consent-purpose-model.md) decided the
model: consent is a **VECTOR of independently-grantable purposes** (the Consent Mode v2 four —
`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`, + `functional`/`personalization`),
sourced through a **consent-input seam** (a CMP driver), and enforced **per purpose** at the airlock
chokepoints. This spec builds that for the **GA4 / wire-protocol** archetype (where airlock constructs the
body and the mechanism is grounded); **alloy / wrapped-SDK consent is deferred** (the vendor builds the XDM
body — the ADR-0006 payload-governance-split concern, out of scope here).

**THREE enforcement points, not one (ADR-0007's load-bearing correction — "collapsing them into a single
seal hold is the error this ADR exists to prevent").** A *denied* purpose does not mean the same thing on
every channel; the consent vector is *consumed* at three places:
- **① The MAPPER — data-use purposes** (`ad_user_data` / `ad_personalization`): **reshape and send**, not
  hold. The GA4 connector POSTs the **Measurement Protocol** to a fixed endpoint, so the mechanism is the
  **MP `consent` body field** — and the hook **already exists** (grounded: [`map.js:74`](../../connectors/ga4/map.js)
  `if (ctx.consent) body.consent = ctx.consent`, `{ ad_user_data, ad_personalization }`). A denied data-use
  purpose sets that object DENIED and the beacon **still POSTs**. **Stated plainly (ADR-0007's named
  departure from "nothing crosses the seal unhonoured"):** this *delegates* data-use-denial to Google's
  server-side honoring — lawful + Consent-Mode-correct for GA4 (`ad_user_data` denial restricts ad *use*,
  not measurement transmission), and the only MP mechanism. `017-01`.
- **② The COOKIE/STORAGE capability — storage purposes** (`analytics_storage` / `ad_storage`): a genuine
  **deny of the write** — don't persist `_ga` / identity. But MP **requires** `client_id`
  (`contracts/ga4-mp-request.schema.json` `required: [client_id, events]`), so a storage denial touches
  **two** places: the cookie write (deny) **and** identity sourcing (mint an **ephemeral, non-persisted**
  `client_id` so the beacon still conforms). `017-02`.
- **③ The SEAL — pending / strict** : **pending** (no signal yet) → **hold** at the seal + flush-on-arrival,
  per purpose (AD-9, now per purpose); **strict / TCF no-processing regime** → **drop** (no beacon).
  `017-03`.

**Both mapping sites (grounded — but only under a pre-construction ordering, 017-01 frame-critique).** The
MP reshape (①) is `ctx`-threaded, and **both** mapping sites call the same `mapToMp(event, ctx)`: the worker
path (the chamber's `handle` → `mapToMp`, `ctx` host-sourced via `config.ctx`) **and** the synchronous unload
fast path (`core/egress.js` `createCriticalDispatcher({ ctx })` → `mapToMp(event, ctx)`). But the two sites
are **not symmetric**: the worker receives a **structured-clone snapshot** of `ctx` at `init`, while the fast
path closes over a **live reference**. So the reshape lands at both **iff `ctx.consent` is folded in BEFORE
`createAirlock({ ctx })`** — a **pre-construction** fold in `adapters/eds/index.js` (parallel to the existing
identity fold), *not* a post-construction `setConsent` handle method (which would reach only the fast-path
reference). Under that ordering it closes the OQ16 fast-path-parity gap for the *consent* reshape by
construction (one `ctx`, one `mapToMp`, no second code path); a **mid-session** change needs a worker `ctx`
re-send and is the deferred follow-up (same frozen-clone mechanism). Grounded (read both `mapToMp` sites +
the worker `init` clone).

**The consent-input seam is minimal here (a host-provided vector); CMP drivers are later.** ADR-0007's seam
accepts consent through a driver (Consent Mode `gtag`, IAB `__tcfapi`, or a host callback). This spec builds
the **host-callback driver** (the simplest — the host supplies the consent vector at boot / on update);
the Consent Mode `gtag` and TCF `__tcfapi` drivers are **named follow-ups on the same seam** (a driver swap,
not a rewrite — the ADR's AD-1 mirror).

**Not in scope:** alloy / wrapped-SDK consent (vendor-built XDM body — payload-governance split, ADR-0006);
the TCF full model + Consent Mode `gtag` drivers (later seam drivers); the end-user per-tag choice surface
(finer than purpose — ADR-0006's "user choices" horizon); the payload denylist (OQ11). This spec is the
purpose-vector consent enforcement for GA4/wire-protocol, three points, host-callback seam.

## Assumptions

<!-- Grounded 2026-08-30 by reading connectors/ga4/map.js, core/egress.js, connectors/ga4/connector.js,
     connectors/ga4/cookies.js, contracts/ga4-mp-request.schema.json, adapters/eds/index.js,
     ADR-0006/0007, architecture.md AD-9; risk-gated. -->

- **No consent enforcement exists in `core/` today; the seal's consent gate is unbuilt.** Grep-verified
  (only a comment references it). So this is the first consent enforcement — not a refinement. **Grounded.**
- **The MP reshape mechanism already exists + both sites use it.** `map.js:74` sets `body.consent = ctx.consent`
  (`{ ad_user_data, ad_personalization }`, "GRANTED"|"DENIED"); the MP schema has an **optional** `consent`
  object + **required** `client_id`; both the worker (`connectors/ga4/connector.js` `handle` → `mapToMp`) and
  the sync fast path (`core/egress.js` → `mapToMp`) call `mapToMp(event, ctx)` with host-sourced `ctx`. So
  ①'s reshape is *populate `ctx.consent`* and it lands at both sites. **Grounded.**
- **`ctx` reaches the two sites asymmetrically (017-01 frame-critique).** The worker gets a **structured-clone
  snapshot** of `ctx` at `init` (`core/airlock.js` `postMessage({type:"init", …, ctx})`); the sync path holds
  a **live reference** (`core/egress.js`'s captured `ctx`). So the consent vector → `ctx.consent` fold must
  happen **pre-construction** (in `adapters/eds/index.js`, before `createAirlock({ ctx })`) to reach both. A
  **mid-session update** needs a worker `ctx` re-send (`core/airlock.js` has only `init`/`events` messages —
  no ctx-update path today) — a **named residual** (017-01 folds consent at boot; live-update is a follow-up).
  **Grounded** (read the init clone + both `mapToMp` sites).
- **MP `consent` carries only the two data-use signals; the two storage signals are NOT MP payload fields**
  (they gate the cookie capability — ②). So the vector→enforcement split is: `{ad_user_data,
  ad_personalization}` → `ctx.consent` (①); `{analytics_storage, ad_storage}` → the cookie write gate + the
  ephemeral-id path (②). **Grounded** (ADR-0007 + the schema).
- **The Consent Mode v2 semantics are external domain knowledge** — the *transport split* (MP `consent`
  vs cookie capability) is repo-grounded, but the *semantic* detail (which signal restricts what) must be
  **verified against current Google documentation at implementation**, per ADR-0007. Listed, not asserted.
- **The manifest already declares `purposes`** (012-04) per capability/endpoint/read; a boundary sentinel
  asserts nothing gates on it yet (designed to go red on enforcement). **Grounded.**

## Decomposition

SPIDR = **Rules (R)** — per-purpose consent gating enforced at the airlock chokepoints. Split by
**denial-behaviour type** (ADR-0007's own three-point matrix — a Rules axis: the three purposes-classes
enforce *differently*): the **data-use reshape** first (① — the mechanism is grounded/exists, and it stands
up the shared consent machinery: the vector state + the host-callback seam + the grant resolver), then the
**storage deny** (②), then the **seal hold/drop** (③). Each binds a real purpose to a real chokepoint
end-to-end (a denied/pending purpose → an observable payload/write/hold change), so none is horizontal.

- **017-01 `[R]` data-use consent reshape + the consent machinery (the grounded first point)** — stand up
  the consent **vector state** in the orchestrator + a minimal **host-callback consent-input seam** + a
  **grant resolver** that maps the vector's data-use purposes into `ctx.consent`, threaded into **both**
  mapping sites (worker init `ctx` + the sync fast-path `ctx`). E2E: a denied `ad_user_data` /
  `ad_personalization` → the mapped GA4 beacon carries `consent.{…}: "DENIED"` at both sites and **still
  POSTs** (the ADR's delegate-and-send). Consent sourced at boot; mid-session update is a named follow-up.
- **017-02 `[R]` storage consent deny (cookie capability + ephemeral id)** — gate the `_ga` / identity
  **write** on `analytics_storage` (deny the persistent write when denied) **and** mint an **ephemeral,
  non-persisted** `client_id` so the MP beacon still conforms (`client_id` required). E2E: a denied
  `analytics_storage` → no persistent `_ga` write + the beacon carries an ephemeral (non-persisted) id.
  Resolves OQ13 item 1.
- **017-03 `[R]` seal hold-pending + strict-drop** — the seal reads the vector: a **pending** purpose →
  **hold** the beacon + flush-on-arrival when it grants (per purpose, AD-9-per-purpose); a declared
  **strict** regime → **drop** (no beacon). E2E: pending analytics → held; grant → flushed; strict → dropped.

## Slices

1. [017-01 — data-use consent reshape + the consent machinery](slice-01-data-use-reshape.md)
2. [017-02 — storage consent deny (cookie capability + ephemeral id)](slice-02-storage-deny.md)
3. [017-03 — seal hold-pending + strict-drop](slice-03-seal-hold-drop.md)
