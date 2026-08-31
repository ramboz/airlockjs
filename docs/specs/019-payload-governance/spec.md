---
status: DONE
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 019: payload governance — a host-owned sensitive-field denylist, stripped before the chamber

## Overview

The **fourth MVP3 enforcement spec**, resolving **OQ11** by implementing **[ADR-0012](../../docs/decisions/adr-0012-payload-governance.md)**
(Accepted): the event-**payload** channel — the connector's primary input, `AirlockEvent.payload` — is today
**open and ungoverned** (`contracts/connector.d.ts:39-44`: "pinned as pass-through for MVP1 only"), and
`connectors/ga4/map.js:59-60` spreads `event.params` **verbatim** into the GA4 Measurement Protocol body. So a
site that `push()`es a sensitive field (a raw form input — email, password, a declared-PII path) egresses it
to the analytics vendor, and a compromised connector receives it — both **in-model** (AD-5: the chamber is
untrusted).

**What this spec delivers (ADR-0012 Option A).** A **host-owned, input-side sensitive-field denylist**
(`governPayload`) that strips dangerous field names / dotted paths from a captured event's `params`
**before** they cross into the chamber — so the field never enters the untrusted connector and, because the
connector builds egress from what it received, never reaches the vendor. The **primitive** is vendor-neutral;
its **placement** this slice is the **GA4 host** (`core/airlock.js`'s chamber-crossing chokepoints), where it
is **demonstrated E2E** (a denied field is provably absent from the MP body at every crossing). This is the
**payload half** of ADR-0006's host-policy least-privilege, sibling to ADR-0003's projection-snapshot
allowlist half.

**Scope-honest on alloy (019-01 frame-critique correction).** The alloy / wrapped-SDK archetype has a
**separate** main-thread input host — `core/wrapped-sdk-host.js` (its event crosses at
`wrapped-sdk-host.js:265` `chamber.postMessage({type:"event", event})`) — which is **not** `core/airlock.js`
and which **neither** of this slice's two chokepoints touches (airlock.js:107 hardcodes the GA4
`chamber.worker.js`). So alloy input is **NOT** governed "for free" by this slice: `governPayload` is reusable
there, but **binding it at the wrapped-SDK host is a deferred second placement** (a named residual, below),
not an automatic consequence. (No shipped regression today: `core/wrapped-sdk-host.js` is rig/test-only —
absent from `adapters/`.)

**Denylist, not allowlist (the OQ11/OQ3 reconciliation, from ADR-0012).** The payload is *site-defined*
(UC-2 custom events, the open `push({event, ...params})` object, OQ3's still-unpinned emergent-schema
leaning). A connector's `manifest.reads` cannot enumerate a site's arbitrary custom fields — GA4 declares
`reads: ["*"]` (014-03) — so a field-**allowlist** collapses to a wildcard (= no governance). A host-owned
**denylist** of known-dangerous fields is the model that fits an open channel; if OQ3 later pins a schema it
tightens to an allowlist at the same seam (forward-compatible).

**All THREE crossings, via TWO governance points (ADR-0012's load-bearing completeness, re-verified by its
frame-critique).** The chamber is fed `params` at three sites in `core/airlock.js`: the async `drain()`
(airlock.js:190-194) and `flushNow()` (airlock.js:310, on the public handle) — the two **async batch-posts**
— and the synchronous critical/unload path (`pushCritical` + `unloadFlush` → `createCriticalDispatcher` →
`mapToMp`). Because governance is **non-mutating** (the ring keeps raw descriptors so the local event log is
unaffected), **every** consumer must be covered. So governance lands at **two** points: **(A)** a single
governed `sendBatch(batch)` helper that both `drain()` and `flushNow()` route through (so a future fourth
async consumer cannot silently bypass it), and **(B)** the shared sync dispatcher, governed once before
`mapToMp` (covering both `pushCritical` and `unloadFlush`). Governing only one point ships exactly the hole
ADR-0012 warns about — so this is one indivisible slice, not a per-seam split.

**Always-on built-in default (maintainer decision, 2026-08-31).** The tiny high-confidence built-in set
(`password`/`ssn`/`cvv`/card-number family — fields that must **never** reach an analytics vendor) strips even
on an **unconfigured** deployment. This is a deliberate departure from the 015/016/017 opt-in pattern (whose
gates are *structural* — no endpoints → no ceiling), because a PII-stripper's footgun population is exactly
the unconfigured one, and the set is a **near-no-op for real payloads** (none legitimately carry those exact
field names). The host `payloadDenylist` **extends** the built-in set. **Back-compat (AC6) holds in
CONTENT, not as "no governance runs":** a payload carrying **none** of the denied fields is
byte-identical *and* reference-identical after governance (`governPayload` returns the original reference
when nothing is stripped), so a clean event is unchanged and the hot path keeps no needless clone.

**Scope + honest boundary.** GA4 / wire-protocol is enforced + demonstrated E2E. **alloy / wrapped-SDK input
is NOT governed by this slice** — its input crosses at the separate `core/wrapped-sdk-host.js` seam (above);
binding `governPayload` there is a **named deferred residual** (the same reusable primitive, a second
placement). Separately, alloy's **ambient in-chamber collection** (default device/web context, which never
flows through `AirlockEvent.payload` at all, spec 012-04 Axis-2) is **out of scope** — read-minimization's
surface, not this channel's. A field-name/path denylist is **defense-in-depth, not a complete PII defense**
(renamed fields, value-level PII in a benign-named field — ADR-0003's projection-side concern — escape a name
match). The egress-side XDM strip (ADR-0012 Option B) and an OQ3 allowlist tightening stay **deferred**.

## Assumptions

<!-- Grounded 2026-08-30 by reading connectors/ga4/map.js, contracts/connector.d.ts, core/airlock.js
     (push/drain/flushNow/criticalDispatchGated), core/egress.js, adapters/eds/index.js, ADR-0012; risk-gated. -->

- **The payload crosses at THREE sites carrying `descriptor.params` verbatim; two are async batch-posts
  routing through one `worker.postMessage`, two are sync routing through one `mapToMp`.** Grounded (ADR-0012's
  independent census, re-confirmed): `drain()` airlock.js:190-194, `flushNow()` airlock.js:310 (public handle
  adapters/eds/index.js:377), and `pushCritical`/`unloadFlush` → `criticalDispatchGated` →
  `createCriticalDispatcher` → `mapToMp` (airlock.js:90-105, 212, 260; core/egress.js). `init` (airlock.js:108,
  ctx-only) and the 017-03 `setConsent` re-`fetch` (already-mapped) are correctly NOT payload crossings.
  **Grounded.**
- **The event log and the ring share the descriptor object** (airlock.js:240-243 push the same `descriptor`
  to both), so governance MUST produce a **non-mutating** governed copy for what crosses, or it also strips
  the local main-thread log/projection. **Grounded** — an implementation obligation.
- **The runtime field is `params`, not the contract's `payload`.** `AirlockEvent.payload` (connector.d.ts:44)
  is the contract type; the runtime descriptor carries `params` (airlock.js:240); the connector-host bridges
  via `event.params || event.payload` (014-03). Governance keys on the **runtime `params`** at the crossing.
  **Grounded** (ADR-0012 Assumptions).
- **For GA4, input ≈ egress** — `mapToMp` spreads `...event.params` verbatim into `events[0].params`
  (map.js:59-60) and only *synthesizes* fields from host-owned `ctx` (session_id, client_id, consent, …). So
  a field stripped from the input `params` is provably absent from the MP body. **Grounded** (read).
- **alloy's ambient collection does not flow through `AirlockEvent.payload`** (012-04 Axis-2 — it is
  vendor-internal, collected inside the chamber), so input governance cannot reach it (named out-of-scope,
  not over-claimed). **Grounded** (012-04).
- **Which field names are "dangerous" is host/site domain knowledge** — a conservative built-in default set,
  authoritatively host-declared. Listed as an assumption, not asserted as universal.

## Decomposition

SPIDR = **Rules (R)** — a host-owned denylist rule gating what payload fields cross into a connector. **One
vertical slice**, not split: ADR-0012's "bind at all seams or it is a hole" means both governance points (the
async `sendBatch` chokepoint + the sync dispatcher) must land **together** — governing only one ships a known
egress hole (a not-actually-secure control), which is not a valid vertical slice. The slice binds a real
denied field to a real observable payload change end-to-end (a denied field absent from the GA4 MP body at
every crossing), so it is not horizontal.

- **019-01 `[R]` input-side payload denylist governance (all crossings, GA4 E2E)** — a vendor-neutral
  `governPayload(params, denylist)` (non-mutating; a conservative built-in default + host-config, threaded
  from the adapter as a `createAirlock` option); a single governed `sendBatch(batch)` chokepoint both
  `drain()` and `flushNow()` route through; the sync/critical dispatcher governed once before `mapToMp`. E2E:
  a `push({event, <denied-field>})` → the field is ABSENT from the GA4 MP body on the worker path, on a
  `flushNow`, and on the sync/unload path; a benign field passes; a caller with no denylist wired is
  byte-unchanged.

## Slices

1. [019-01 — input-side payload denylist governance (all crossings, GA4 E2E)](slice-01-payload-denylist.md)
