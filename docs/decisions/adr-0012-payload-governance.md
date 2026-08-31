---
status: Accepted
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

# ADR-0012: Event-payload read-boundary governance (OQ11)

## Status

Accepted (2026-08-30)

## Context

Airlock exposes **two** channels through which host/site data reaches a connector inside its chamber, and
only one is governed today — this ADR governs the other, the open event-payload channel (OQ11), with a
host-owned input-side sensitive-field denylist stripped before the payload crosses into the untrusted
chamber. The two channels are:

1. **The projection snapshot** (`AirlockEvent.snapshot`) — governed by **[ADR-0003](adr-0003-projection-snapshot-privacy.md)**:
   a host-owned **default-deny allowlist**; a connector reads only the projection fields it declared in
   `manifest.reads` AND the host policy allows.
2. **The event payload** (`AirlockEvent.payload`) — the connector's **primary input**, and today **open and
   ungoverned**. Grounded: `contracts/connector.d.ts:39-44` documents `payload` as an "Open, site-defined
   shape (OQ3) … Read governance for this channel is OQ11 — pinned as pass-through for MVP1 only"; and
   `connectors/ga4/map.js:59-60` spreads `event.params` **verbatim** into the GA4 Measurement Protocol body
   (`const params = { ...(event.params || {}), … }`). So whatever a site `push()`es rides straight through
   the chamber and out to the analytics vendor.

**Why an allowlist does not work for this channel (the asymmetry with ADR-0003).** The payload is
*site-defined* — UC-2 custom events, the `push({ event, ...params })` open object, the OQ3 "emergent schema"
leaning (still unpinned: OQ3 favours minimal/emergent). A connector's `manifest.reads` cannot enumerate the
site's arbitrary custom fields, so a field-**allowlist** on the payload collapses to a wildcard
(= default-allow) — no governance at all. GA4's own manifest already declares its reads as an explicit
**wildcard** `["*"]` (spec 014-03: "a connector forwarding arbitrary developer params declares a wildcard").
This channel needs a **different** model than the projection's allowlist.

**The threat (in-model, not hypothetical).** Airlock's threat model treats the chamber as untrusted (AD-5).
Two concrete harms flow from an ungoverned payload: (a) a site accidentally `push()`es a **sensitive field**
(a raw form input — email, password, a declared-PII path) and it egresses to the analytics vendor
(a compliance/PII leak, the common real-world GA4 footgun); (b) a **compromised connector** receives, and can
exfiltrate, any field handed to it. Both are prevented by stripping the dangerous field **before** it crosses
into the chamber.

**Where the payload crosses (grounded — THREE entry points, not two).** `core/airlock.js`: `push()` builds a
descriptor `{ seq, type, ts, params }` (airlock.js:240) and enqueues it. The chamber is then fed by **three**
sites, all handing the connector its `params`:
1. the async `drain()` — `ring.splice(0,50)` → `worker.postMessage({ type:"events", batch })`
   (airlock.js:190-194);
2. **`flushNow()`** — `while (ring.length) worker.postMessage({ type:"events", batch: ring.splice(0,50) })`
   (airlock.js:310), the **identical** async batch crossing, **on the public handle**
   (adapters/eds/index.js:377) — a force-drain the worker's `onmessage` cannot distinguish from a `drain()`
   batch (ADR-0012 frame-critique — this third crossing was initially miscounted);
3. the synchronous unload/critical path (`pushCritical` + the ring-tail `unloadFlush`) maps on the main
   thread via `createCriticalDispatcher` → `mapToMp` (airlock.js:90-105, 212, 260; `core/egress.js`) — OQ16's
   sibling seam.

Because governance is **non-mutating** (below — the ring keeps raw descriptors so the local log is
unaffected), **every** ring consumer must be covered, or it ships un-stripped `params`. The two async
batch-posts (1, 2) are therefore governed at a **single shared chokepoint** they both route through (so a
future fourth consumer cannot silently bypass it), and the sync path (3) governs before `mapToMp`.

**OQ11's own text points input-side.** OQ11 (refinement-todo): *"a host-owned **sensitive-field denylist**
that strips known-dangerous fields (raw form inputs, declared PII paths) **at the boundary outside the
connector's chamber**."* Its resolution trigger: *"resolve jointly with OQ3 … Record via ADR."* This ADR is
that record.

## Decision Options Considered

### Option A: Input-side host-owned denylist at the chamber-crossing boundary (RECOMMENDED)
Strip a host-configured set of dangerous field names/paths from `descriptor.params` **before** it crosses into
the chamber — at every chamber crossing (the async batch-post shared by `drain()` + `flushNow()`, and the
synchronous critical/unload map) — so the field never enters the untrusted connector and, because the
connector builds egress from what it received, never reaches the vendor.
- **Pros:** Faithful to OQ11's text ("outside the chamber"). **Defense-in-depth**: the compromised connector
  never even receives the field (strictly stronger than stripping after the connector built the body).
  **Vendor-neutral by construction** — it governs `AirlockEvent.payload` for *any* connector archetype
  (GA4 wire-protocol AND alloy wrapped-SDK) at one host-owned seam, not per-connector. For GA4, input ≈
  egress (`mapToMp` spreads `params`), so a denied field is provably absent from the MP body **end-to-end**.
- **Cons:** Does not reach data a wrapped-SDK collects **ambiently inside** the chamber (alloy's default
  device/web context, which never came through `AirlockEvent.payload`) — that is read-minimization /
  config-integrity's surface, not this channel's. A field-name/path denylist is **defense-in-depth, not a
  complete PII defense** (renamed fields, deeply-nested or value-level PII in a benign-named field escape a
  name match — value-level sanitization of *declared* fields is ADR-0003's projection-side concern).

### Option B: Egress-side strip at the seal (the built body)
Strip dangerous fields from the **already-built** egress body at the seal, before dispatch (the release-plan
wording — "airlock builds the MP body, `map.js`").
- **Pros:** For GA4, airlock owns the body, so a strip there is feasible; catches a field the connector
  *added* itself (not just forwarded).
- **Cons:** For the **wrapped-SDK** archetype the body is **vendor-built XDM** inside the chamber — a
  blind strip-at-seal can break the vendor payload's structure (the release-plan Risk: "denylist/strip at the
  seal may break it"), so it is fragile and archetype-specific. Strictly **weaker** than Option A for the
  common case: the compromised connector already received the field. Rejected as the *primary* model; the
  GA4-body-specific egress strip and the alloy-XDM egress strip are retained as **deferred, additive**
  follow-ups on top of Option A (not the load-bearing control).

### Option C: Payload allowlist (tighten once OQ3 pins a schema)
Replace the open payload with a host/connector allowlist of permitted fields.
- **Pros:** Strongest — default-deny on the payload too, symmetric with ADR-0003.
- **Cons:** Presupposes **OQ3 pins a schema**; today OQ3 is *emergent/minimal* and the payload is
  deliberately open (site-defined custom events). An allowlist on an open channel collapses to a wildcard.
  Deferred to an OQ3 resolution; named as the future tightening path (this ADR keeps the denylist model
  **forward-compatible** with it — a denylist over an open channel becomes an allowlist over a pinned one
  without moving the seam).

## Recommended Decision

**Option A** — a **host-owned, input-side sensitive-field denylist** applied at the chamber-crossing
boundary, resolving OQ11 jointly with OQ3 (emergent-schema-compatible):

1. **Model — denylist, not allowlist.** The host declares a set of dangerous field names / dotted paths
   (`password`, `cvv`, credit-card / SSN patterns, declared-PII paths, raw form-input names, …) plus a
   conservative built-in default. A shipped default that is **extended**, never silently relied on — the
   security-MUST posture (CLAUDE.md): defense-in-depth, not a guarantee.
2. **Placement — main-thread, host-owned, at TWO governance points covering all four call sites.** A
   vendor-neutral `governPayload(params)` runs on the main thread, before `params` crosses into a connector.
   The four params-crossing call sites collapse into **two** governance points:
   - **(A) the async batch chokepoint** — the two async posts (`drain()` airlock.js:194 + `flushNow()`
     airlock.js:310) both route through a **single governed `sendBatch(batch)` helper**, extracted from the
     shared `worker.postMessage({ type:"events", batch })`, governing each batched descriptor there
     (**non-mutating** — a governed copy crosses; the local main-thread event log keeps the full descriptor,
     which is never egressed);
   - **(B) the shared sync dispatcher** — the two synchronous call sites (`pushCritical` airlock.js:260 +
     the ring-tail `unloadFlush` airlock.js:212) both flow through the **single**
     `criticalDispatchGated`→`critical.dispatch`→`mapToMp` path, so governing **once** before that `mapToMp`
     covers both.

   Governance is a `createAirlock` option threaded from the adapter (parallel to `endpoints` / `consent` /
   `egressPurposes`). The single-exit shape at each point is the load-bearing move: with a non-mutating ring,
   scattering the strip per-call-site is exactly how the `flushNow` hole arose — one governed exit per point
   closes it by construction.
3. **Archetype scope.** **Enforced + demonstrated E2E for GA4 / wire-protocol** (a denied field is absent
   from the MP body at both mapping sites). **alloy / wrapped-SDK input is governed by the same boundary for
   free** (it is vendor-neutral), but alloy's **ambient in-chamber collection** is explicitly **out of scope**
   (read-minimization's job), and the alloy **egress-side XDM strip** (Option B for the vendor body) stays
   **deferred / probe-first** (the release-plan Split item).
4. **Honest boundary.** A field-name/path denylist neutralizes the **named** dangerous fields; it does not
   catch renamed fields, value-level PII in benign-named fields (ADR-0003's projection-side value governance),
   or ambient in-chamber collection. Stated, not over-claimed.

This composes with ADR-0006's grant law (`granted = declared ∩ host-policy ∩ consent`) as the **payload
half** of host-policy least-privilege, sibling to ADR-0003's projection half.

## Consequences

**Becomes easier:**
- A GA4 deployment can keep sensitive site fields (raw form inputs, PII) out of the analytics vendor by host
  config, at one seam, without touching connector code — the common real-world GA4 PII footgun gets a
  host-owned control.
- The control is vendor-neutral, so a future connector inherits payload governance without bespoke work.
- Forward-compatible with an OQ3 schema pin: the same seam tightens denylist→allowlist without relocation.

**Becomes harder:**
- **All three** chamber entry points (`drain()`, `flushNow()`, the sync critical/unload dispatcher) must be
  governed or the control has a hole — a spec-level obligation (mirrors config-integrity/consent's "bind at
  both seams", here **three** sites). The single `sendBatch` chokepoint discharges the two async ones; the
  reconciliation must confirm the sync path is covered too.
- A denylist needs curation; a too-aggressive default could strip a legitimately-named field (the opt-out /
  host-config path must exist), a too-lax one misses a renamed sensitive field (defense-in-depth, not
  complete — must be stated so nobody treats it as a full PII guarantee).
- Governing a copy at the `sendBatch` chokepoint adds a per-batch clone on the (idle-time, off-INP) async
  path — negligible, but it must be **non-mutating** so the local log/projection are unaffected.

## Assumptions

<!-- Grounded 2026-08-30 by reading connectors/ga4/map.js, contracts/connector.d.ts,
     core/airlock.js (push/drain/critical), adapters/eds/index.js, refinement-todo OQ11/OQ3; risk-gated. -->

- **The payload crosses at THREE sites, carrying `descriptor.params` verbatim.** Grounded:
  core/airlock.js:190-194 (`drain()` batch), **airlock.js:310 (`flushNow()`, the identical async batch-post,
  on the public handle adapters/eds/index.js:377)**, the `criticalDispatchGated`/`createCriticalDispatcher`
  path (airlock.js:90-105, `core/egress.js`), and map.js:59-60 (`...event.params`). **Grounded** (read).
- **The runtime descriptor field is `params`, not `payload`.** The contract type is `AirlockEvent.payload`
  (connector.d.ts:44) but the runtime descriptor carries `params` (airlock.js:240); the connector-host
  bridges them via `event.params || event.payload` (spec 014-03). Governance keys on the **runtime `params`**
  at the crossing — a spec author must not key it on a `payload` property the descriptor does not carry.
  **Grounded** (read) — a naming reconciliation, stated so it is not a trap.
- **The main-thread event log shares the descriptor object with the ring** (airlock.js:240-243 push the same
  `descriptor` to `log` and `ring`), so governance must produce a **non-mutating** governed copy for the
  batch, or it would also strip the local log/projection. **Grounded** (read) — an implementation obligation,
  not a blocker.
- **The payload channel is open/emergent (OQ3 unpinned), so an allowlist is not viable now.** Grounded:
  connector.d.ts:39-44 + GA4's wildcard `reads: ["*"]` (spec 014-03). **Grounded.**
- **alloy's ambient collection does not flow through `AirlockEvent.payload`** — it is collected inside the
  chamber from the vendor's own context (spec 012-04 Axis-2: default device/web context is *not*
  chamber-observable-through-the-airlock; it is vendor-internal). So input governance cannot reach it; that
  is read-minimization's surface. **Grounded** (012-04 characterization) — the boundary is named, not
  over-claimed.
- **Which specific field names are "dangerous" is host/site domain knowledge, not repo-grounded.** The
  built-in default denylist is a conservative starting set; the authoritative list is host-declared. Listed
  as an assumption, not asserted as a universal.

## Kill criteria

- **If OQ3 pins a payload schema**, the denylist should tighten to an allowlist (Option C) at the same seam —
  this ADR's denylist becomes the transitional model, not the terminal one.
- **If any of the three crossings cannot be governed** with the same `governPayload` (e.g. a teardown-timing
  constraint makes a clone unsafe on the sync/unload path), the all-seams guarantee fails and the model must
  be reconsidered (a hole on any path would silently egress a sensitive field — the `flushNow` miscount is
  the cautionary case).
- **If a real deployment needs value-level PII governance** (PII inside a benign-named field), a field-name
  denylist is insufficient and the control must extend to value inspection (ADR-0003's value-sanitization
  model) — the denylist is then necessary-but-not-sufficient.

## Open questions

- **Default denylist contents + match semantics** (exact-name vs pattern vs dotted-path for nested objects;
  case sensitivity) — a spec-level design detail (spec 019).
- **Whether the main-thread log/projection should also be governed** (minimal-retention deployments) or stay
  full (local, never egressed — the default here). Deferred to a host-policy option.
- **The GA4-body-specific and alloy-XDM egress-side strips (Option B)** — additive follow-ups; the alloy one
  is probe-first (release-plan Split). Not attempted in the OQ11-resolving spec.
- **Interaction with `pushCritical`'s log/projection bypass** (OQ12 item 4) — the sync path already bypasses
  the log; governance there is purely pre-`mapToMp`.
