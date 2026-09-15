---
status: Accepted
dependencies: [adr-0029]
last_verified: 2026-09-15
frame_review: true
---

# ADR-0030: Vendor-generic native-tag suppressor (airlock adoption primitive)

## Status

Accepted (2026-09-15)

## Context

[ADR-0029](./adr-0029-mvp9-developer-side-after-arm.md) decided the MVP9 after-arm is page-side: the adopter's owned EDS repo
suppresses the migrated vendors' native (container-fired) tags so airlock's off-thread equivalents can be measured against
them. This ADR settles the **mechanism and its home**: what does the suppressor block, and does airlock ship it or does each
adopter write its own?

Two grounded facts shape the answer. (1) The migrated vendors' cost is their **runtime** (`gtag.js` ~150 KB for
AW+GA4+Floodlight, `fbevents.js` ~167 KB for Meta), injected by the container as `<script>` — the repo's own perf report
attributes ~two-thirds of martech TBT to these three ad runtimes. (2) The container injects them via
`document.createElement('script')` (the adopter owns the load order), and the naive `?tealium-tags=` allowlist does NOT stop
template/runtime init (repo `MARTECH.md`). So a suppressor that only drops the vendor *beacon* would leave the TBT untouched
— it must drop the vendor *runtime script* to realize the CWV win, and the beacon as belt-and-suspenders for egress parity.

"Migrate off a tag-manager container onto airlock" is not intuit-specific — it is the **generic adoption motion** for any
airlock adopter (ADR-0018 E8's scripted adoption path). That argues for a reusable primitive rather than bespoke per-site
code.

## Decision Options Considered

### Scope — what to block

- **Beacon-only** (block the vendor's egress endpoints): simple, but the vendor runtime still downloads + evaluates, so it
  **misses the CWV/TBT win** — the whole point of the rewire. Insufficient alone.
- **Runtime + beacon** (chosen): block the vendor's `<script>` runtime injection **and** its beacon transports, matched by
  **URL/query pattern** (not host — see the granularity note below). Realizes the TBT win (no runtime download/eval) and
  suppresses the native egress so the airlock arm is the sole emitter for parity.

### Home — who ships it

- **airlock-generic adoption primitive (chosen):** airlock ships a **vendor-neutral**, config-driven suppressor; the adopter
  supplies the migrated vendors' URL/query matchers. One tested implementation, reusable across adopters, and it is the
  concrete core of ADR-0018 E8's adoption path.
- **Adopter-local bespoke:** each adopter writes its own. No new airlock surface, but non-reusable, re-invented per site, and
  it leaves the adoption story as prose rather than tooling. Rejected — it forfeits the reuse that makes the migration motion
  repeatable.

## Recommended Decision

Ship a **vendor-generic native-tag suppressor** from airlock's **adopter-facing (host/DOM) layer** — NOT `core/` (the
suppressor patches DOM script injection + host transports; `core/` carries no vendor/DOM coupling per `docs/conventions.md`'s
code-home rule). It is **config-driven and vendor-neutral**: the adopter declares the migrated vendors' matchers, and the
suppressor, installed **before** the container loads, blocks (a) the matching `<script>` runtime injections and (b) the
matching beacon transports (`<img>`/`fetch`/`sendBeacon`/`XHR`).

**URL/query-pattern granularity is first-class, not host-scoped** — host granularity is provably wrong on the reference
site: three of the four runtimes load from one host (`googletagmanager.com`, distinguished only by `?id=AW-…`/`DC-…`/`G-…`),
and airlock's own GA4 egress (`www.google-analytics.com/mp/collect`) shares a host with the container's GA4 beacon
(`…/g/collect`). So the matchers key on URL path + query (e.g. the `?id=` value, the `/g/collect` vs `/mp/collect` path), and
the suppressor **carves out airlock's own arm egress** from suppression by construction (an explicit allow-set of the booted
connectors' endpoints) so it never suppresses the replacement it exists to measure. Matchers must be tight enough to hit a
*subset* of a shared-host runtime (partial migration — e.g. migrate Ads+Floodlight, leave GA4 in the container). It is
strictly **pattern-scoped** so a non-migrated tag or the customer-custom chain is never touched, and it emits a **loud
diagnostic of every suppression** so an over-match is visible, not silent. The adopter wires it behind its own gate
(`intuit-erp`'s `?martech=airlock`) alongside `boot(config)`; airlock provides the mechanism, the adopter the matchers.

## Consequences

**Becomes easier:**
- Any adopter migrating off a container gets a tested, vendor-neutral suppressor — the after-arm becomes config, not bespoke
  code; the CWV win is capturable locally.
- The adoption path (E8) has a concrete, shipped artifact rather than a written procedure.

**Becomes harder:**
- A new airlock adopter-facing surface to maintain and keep vendor-neutral (declared matchers only; no leaking a specific
  vendor into airlock).
- Correctness rests on the adopter scoping matchers tightly at URL/query granularity: an over-broad matcher could suppress a
  non-migrated tag, a shared-host runtime the adopter meant to keep, or — the sharpest failure — airlock's *own* arm egress
  (its GA4 beacon shares a host with the container's), yielding a false parity failure. Mitigated by the built-in
  airlock-egress carve-out + the adopter's regression goldens (`intuit-erp`'s `clicktrack`/`appvars` diffs) + the loud
  per-suppression diagnostic so an over-match is visible, not silent.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The vendor runtimes are injected as interceptable `<script>` elements** (not inlined into the container bundle) —
  verified for `intuit-erp` (utag injects via `document.createElement('script')`; `gtag.js`/`fbevents.js` are separate
  network scripts per the repo's perf report + `martech.golden.json`). Generic adopters vary, but the `createElement`/append
  seam is the standard tag-manager injection path.
- **Blocking the runtime `<script>` prevents its download + eval** (the TBT source) — assumed; validated by the first trial
  slice's Lighthouse before-vs-after arm (shared with ADR-0029's kill criterion).
- **Host granularity is insufficient on this site — verified.** AW/GA4/Floodlight share `googletagmanager.com` (perf report),
  and airlock's own GA4 egress (`www.google-analytics.com/mp/collect`, `connectors/ga4/map.js` + `contracts/ga4-mp.md`)
  shares a host with the container's GA4 gtag beacon (`…/g/collect`). So URL/query matchers + the airlock-egress carve-out
  are load-bearing (a host-scoped block would suppress airlock's own arm → false parity failure), not incidental.

## Kill criteria

- **A container that injects a runtime by a non-interceptable mechanism** (inlined into the bundle, or fetched inside a
  Worker / via `importScripts` the page cannot gate) is uncoverable by a page-side suppressor — that vendor falls back to the
  profile-side after-arm ([ADR-0029](./adr-0029-mvp9-developer-side-after-arm.md) Option A) for the CWV arm.
- **If a URL/query matcher surface cannot isolate the four** — suppressing them without catching a non-migrated tag, a
  shared-host runtime meant to stay, or airlock's own arm egress (goldens/parity go red irreparably) — the generic primitive
  is too blunt for this site and the after-arm is scoped narrower or moved profile-side (ADR-0029 Option A).

## Open questions

- The exact interception technique (a `MutationObserver` on `<head>` vs a monkeypatch of `createElement`/`appendChild` vs
  both; the beacon-transport coverage set) is a spec-level implementation detail, decided when the suppressor is built.
- Whether the suppressor ships inside the `dist-vX.Y.Z` subtree (alongside `eds.js`) or as a separate adopter module is a
  packaging call for the implementing spec.
