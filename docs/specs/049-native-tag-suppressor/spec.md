---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 049: Native-tag suppressor

## Overview

The MVP9 developer-provable rewire ([ADR-0029](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)) needs a
**page-side after-arm**: a way for an adopter's OWNED EDS site to stop a tag-manager container from firing the migrated
vendors' tags, so airlock's off-thread equivalents can be measured against them — **without** a container-profile (Tealium)
change. [ADR-0030](../../decisions/adr-0030-native-tag-suppressor.md) decided airlock ships that mechanism as a
**vendor-generic native-tag suppressor**. This spec builds it.

**What it is.** A config-driven, adopter-facing module in airlock's **host/DOM layer** (`adapters/eds/` — NOT `core/`, which
carries no vendor/DOM coupling per `docs/conventions.md`'s code-home rule; `core/sanitize-html.js`-class host primitive).
Installed **before** the container loads, it neutralizes the migrated vendors by **URL/query matcher** (not host — see
Assumptions): it blocks (a) their runtime `<script>` injections (the TBT source — spec 044/046's perf grounding attributes
~two-thirds of the reference site's martech TBT to the three ad runtimes) and (b) their beacon transports. It **carves out
airlock's OWN arm egress** by construction (an allow-set of the booted connectors' endpoints, since airlock's GA4
`mp/collect` shares a host with the container's `g/collect`), supports **partial migration** of a shared-host runtime
(`googletagmanager.com` serves AW/GA4/Floodlight, distinguished by `?id=`), and emits a **loud per-suppression diagnostic**
so an over-match is visible, not silent. It ships as a **served dist sibling** (like `reserve-personalization.js`) so an EDS
adopter subtrees the airlock dist and imports it.

**What already exists (do NOT rebuild):** the four connectors + `boot(config)` (MVP7/MVP8), the `dist-vX.Y.Z` subtree
distribution + `build.mjs` served-sibling entry mechanism ([spec 031](../031-distribution-setup/spec.md) /
[ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md)), the Playwright real-browser rig harness pattern
(`rig/*.mjs`), and the `onDiagnostic` inspector sink ([spec 028](../028-enforcement-inspector/spec.md)) this suppressor's
diagnostic reuses. This spec is **one new adopter-facing primitive**, vendor-neutral, config-driven — no connector or core
change.

**Rejected alternative (why airlock ships it, not the adopter):** per ADR-0030, "migrate off a container onto airlock" is
the generic adoption motion for every airlock adopter, so a bespoke per-site suppressor forfeits the reuse that makes the
migration repeatable and leaves ADR-0018 E8's adoption path as prose. The suppressor is vendor-neutral (declared matchers,
no hardcoded vendor) so it never leaks a specific vendor into airlock.

## Assumptions

_Load-bearing claims about runnable surfaces; probe-grounded ones are cited, the unverified ones flagged (risk-gated per
ADR-0020)._

- **A1 — the container + vendor runtimes are injected as interceptable page-side `<script>` elements, via `createElement` +
  a DOM insertion method (the FULL insertion surface, not just `appendChild`).** Grounded for the reference adopter:
  `intuit-erp/plugins/tealium-martech/src/index.js`'s `loadUtag`/`loadScriptOnce` inject `utag.js` + the OneTrust consent
  stack via `document.createElement('script')` + `appendChild`, page-side (verified in-source, `:244-299`; the page enforces
  Trusted Types + `strict-dynamic` so injection is **only** ever via `createElement`, never `innerHTML`/`document.write` —
  `:42-45`). The **vendor runtimes** (`gtag.js`/`fbevents.js`), by contrast, are injected by utag's minified
  `utag.<uid>.js` runtime templates fetched from tiqcdn (NOT in the repo, so the exact call is unverifiable in-source); the
  standard vendor-snippet idiom is `parentNode.insertBefore(script, firstScript)`, **not** `head.appendChild`. So the
  suppressor must patch the **full DOM-insertion surface** (`appendChild` / `insertBefore` / `append` / `prepend` /
  `insertAdjacentElement` / `replaceChild`), not merely `appendChild` — else an `insertBefore`-injected gtag escapes.
  (Frame-critique 2026-09-15.) The page owns the load order, so a suppressor installed first intercepts. A runtime injected
  by a non-interceptable mechanism (inlined into the container bundle, or fetched inside a Worker / via `importScripts`) is
  the **ADR-0030 kill criterion** (that vendor falls back to the profile-side after-arm), an out-of-scope boundary.
- **A2 (RISK-GATED, resolved in 049-01) — the interception technique can PREVENT the runtime load, not merely observe it.**
  A `<script src>`'s fetch begins at DOM insertion; a `MutationObserver` callback runs as a microtask *after* insertion, so
  the exact technique (a `createElement`/`appendChild`/`insertBefore` monkeypatch that refuses/neuters a matching node at
  insertion, vs an observer that removes it before eval) must be **chosen + validated in a real-browser rig** that a blocked
  runtime never downloads/evaluates (a network-0 assertion under the reference site's CSP: Trusted Types + `strict-dynamic`).
  This is the load-bearing unknown 049-01 grounds; the CWV-win claim rests on it.
- **A3 — the airlock-egress carve-out is load-bearing, not incidental.** airlock's own GA4 egress
  (`www.google-analytics.com/mp/collect`, `connectors/ga4/map.js`) shares a host with the container's GA4 beacon
  (`…/g/collect`), and AW/GA4/Floodlight share `googletagmanager.com`. So a host-scoped block would suppress airlock's own
  arm; the matcher surface is URL/path/query and the booted connectors' endpoints are an explicit allow-set that wins over an
  over-broad adopter matcher (ADR-0030).

## Decomposition

**SPIDR — Path axis (the CWV-win happy path first, the direct-beacon edge later).** No Spike as a standalone slice: the
mechanism is known (page-side script-injection interception owned by the adopter); the one real unknown (A2 — which
interception technique reliably *prevents* the load) is grounded **inside** 049-01 against a real-browser rig, because the
slice that answers it also ships the runtime suppressor (the implementation IS the slice — a standalone spike would conclude
"now build it"). Both slices are vertical: each delivers an adopter-usable, dist-shipped increment that suppresses a real
container tag class end-to-end, never a mechanism-only or config-only horizontal shard.

- **049-01 (Path — runtime-`<script>` suppression, the CWV-win core):** the config-driven, URL/query-matcher suppressor that
  blocks the migrated vendors' runtime `<script>` injections before the container loads, with the airlock-egress carve-out +
  the per-suppression diagnostic, shipped as a served dist sibling. Grounds A2 in a real-browser rig (blocked runtime =
  network-0, the reference CSP). For the four trial vendors (all `gtag.js`/`fbevents.js`) this also suppresses their native
  beacons — no runtime, no beacon — so it is the complete after-arm for runtime-based tags. Partial migration (suppress a
  `?id=` subset of a shared-host runtime) is an AC here (it falls out of the URL/query matcher).
- **049-02 (Path — direct-beacon-transport suppression, egress-parity completeness):** extend the same matchers to the
  **beacon transports** (`<img>`/`fetch`/`sendBeacon`/`XHR`) for the case runtime-blocking misses — a container template that
  fires a bare pixel or a direct `sendBeacon` without a heavy runtime (generic-adopter coverage). Belt-and-suspenders on
  049-01 so airlock's arm is the sole emitter for parity, still carving out airlock's own egress.

## Slices

- [049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)](slice-01-runtime-script-suppression.md)
- [049-02 — direct-beacon-transport suppression (egress-parity completeness)](slice-02-beacon-transport-suppression.md)

## Out of scope

- **The adopter-side trial wiring** — the `?martech=airlock` gate, the `boot(config)` for the four vendors with the real
  IDs, and the CWV/parity measurement — lives in the **`intuit-erp` trial spec** (a separate repo, ADR-0029), which *consumes*
  this primitive. This spec ships the vendor-neutral mechanism only.
- **The production live-attribution window** — the container-owner-gated MVP9 residual (ADR-0029); no suppressor deployed to
  real-user production traffic here.
- **Non-`<script>`/beacon injection vectors** — a runtime inlined into the container bundle, or fetched inside a Worker /
  `importScripts` — the ADR-0030 kill criterion (profile-side fallback for that vendor), not covered.
- **Specific vendor matchers** — the suppressor is vendor-neutral; the adopter declares the matchers (no hardcoded vendor,
  ADR-0018 R2).
- **Growing the vision `## Use cases`** — this is adoption tooling for the already-scoped MVP9 rewire; `use_cases: []`.

## References

- [ADR-0029 — MVP9 after-arm is page-side and developer-controlled](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)
- [ADR-0030 — Vendor-generic native-tag suppressor](../../decisions/adr-0030-native-tag-suppressor.md) (the decision this spec implements)
- [ADR-0018 — reframe onto adoptable 1.0](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) (E8 adoption path)
- [releases/mvp9.md](../../releases/mvp9.md) (the developer-provable rewire trial)
- [spec 031 — distribution setup](../031-distribution-setup/spec.md) / [ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md) (the dist served-sibling mechanism)
- [spec 028 — enforcement inspector](../028-enforcement-inspector/spec.md) (the `onDiagnostic` sink the diagnostic reuses)
