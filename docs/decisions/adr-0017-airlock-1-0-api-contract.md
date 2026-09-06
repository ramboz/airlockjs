---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0017: The airlock 1.0 public API contract (frozen surface + experimental carve-out)

## Status

Proposed (2026-09-05)

## Context

airlock has reached MVP6. MVP1–5 built and proved a set of surfaces; adopters now need to know — precisely — which
of them are **stable enough to rely on at 1.0**, and which are still moving. Without that line drawn, either every
internal change risks silently breaking an integrator, or fear of that freezes healthy iteration on the young parts.

The framing already exists in `docs/architecture.md` (§ "Five surfaces, in priority order"): a prioritized contract
set, with the instrumentation-config surface explicitly held PRE-1.0 ("the MVP6 1.0 API pin owns freezing it"). This
ADR is the moment that intent becomes a recorded, enforced commitment. It is scoped by two owner decisions (2026-09-05):
**(1)** the multi-connector instrumentation-config surface stays **experimental** for 1.0 (it is recent — 033/034 — and
still settling); **(2)** this pins the **API** (this ADR + contract-stability guards), NOT a v1.0.0 release cut (a
separate later step).

A capstone freeze also demands the frozen files be internally consistent: over 30+ specs the contract docs accreted
MVP-relative "deferred / provisional / not yet built" staging language, much of it now stale (the referenced open
questions resolved, the surfaces shipped). Freezing a file that still self-disclaims "provisional" would ship a
self-contradictory contract.

## Decision Options Considered

### Option A: Freeze the whole surface, including the instrumentation-config schema
- **Pros:** strongest adopter guarantee — the primary multi-connector integration surface (`window.__airlockConfig`)
  is committed too.
- **Cons:** over-commits a young, still-settling surface (alloy personalization config landed in 033/034 and carries
  an open config-surface residual). A premature freeze here would either block healthy iteration or force an early
  major-version break. Rejected per owner decision (1).

### Option B: Ship no 1.0 pin — leave stability informal until everything settles
- **Pros:** maximum freedom to change anything.
- **Cons:** adopters have nothing to rely on; every refactor is a latent break; the MVP6 capstone goal (a credible 1.0
  surface) is unmet. Rejected.

### Option C (chosen): Freeze the stable core; carve out the experimental parts explicitly; enforce + record
- Freeze the surfaces MVP1–5 proved (the five documented contracts + the adopter boot layer), enforced by
  contract-stability guards; carve out — by name — the parts that are genuinely still moving (the config schema, the
  per-connector handle variance, `composite.accepts`, host-internal `reconcile`, and the two still-open questions OQ3
  and multi-chamber sync-coherence). Reconcile every frozen file to present-tense-as-of-1.0 first.
- **Pros:** adopters get a precise, enforced "rely on this" line; healthy iteration continues on the labeled-experimental
  parts; a break of the frozen surface fails a test rather than surprising an integrator.
- **Cons:** the line must be drawn carefully (what is genuinely stable vs still moving), and the frozen files must be
  made internally consistent first (the staging-language reconciliation). Accepted — this is the honest 1.0 posture.

## Recommended Decision

Adopt **Option C**. The airlock 1.0 public API contract is:

**FROZEN at 1.0 — adopters may rely on these; a change requires a superseding ADR + a major-version break:**
1. **GA4 Measurement Protocol** — the wire beacon shape (`contracts/ga4-mp-request.schema.json` + `contracts/ga4-mp.md`).
2. **The `push()` API** (`contracts/push-api.md`) — `push()` / `pushCritical()` are synchronous, **return nothing**, and
   drop-not-throw on malformed input (ADR-0002 O(1) hot path; ADR-0004 unload-critical fast path).
3. **The connector interface** (`contracts/connector.d.ts`) — `ConnectorFactory → { manifest, init, handle }`,
   `ConnectorManifest`, `AirlockEvent`, `EgressRequest` (+ `core/connector-host.js`'s `routeBatch → { ready, dropped }`).
4. **The capability API** (`contracts/capability.d.ts`) — `CapabilityRequest` / `GrantedCapabilities` and the ADR-0006
   grant law `granted = declared ∩ allowed` (ADR-0007 purpose-dimensioned; ADR-0010 the `egress.dispatch` round-trip).
5. **The seam drivers** (`contracts/seams.d.ts`) — `DecisionSourceDriver` / `EgressDriver` and their request/result
   types. **Honestly recorded: frozen as proven-for-one** — no second implementation per driver type has been written,
   so second-implementer fitness is unvalidated at 1.0.
6. **The adopter boot layer** — the two entrypoints that install `window.airlock` (`bootEdsAnalytics()` and
   `boot(config)`) and the installed **handle shape** `{ push, pushCritical, setConsent, getState, flushNow, stats,
   dispose }`. `boot(config)`'s freeze covers the ENTRYPOINT (it exists and returns the frozen handle) — **NOT** the
   shape of its `config` argument (see the carve-out).

**EXPERIMENTAL — explicitly NOT frozen at 1.0 (may change without a major break):**
- The **instrumentation-config schema** (`window.__airlockConfig` / the `config` argument to `boot(config)` —
  `connectors[]`, per-`type` fields, `placements`, …). Recent, still settling; a later minor freezes what survives.
- The **standalone per-connector boot handles** beyond the two that install `window.airlock` — their shapes vary by
  design (pixels lack `pushCritical`, alloy lacks `flushNow`, helix-rum adds `sampled`).
- **`composite.accepts(name)`** — an internal fan-out detail, kept OFF the installed `window.airlock` handle (the alloy
  exposure reporter routes through an internal predicate, not the public handle).
- The **host-internal `cookies.reconcile`** and its 035 name-scope coupling — host-wired, not a connector-facing grant.
- **OQ3** (the event-payload schema): `AirlockEvent.payload` is frozen as a `Readonly<Record<string, unknown>>`
  pass-through container, but its **shape/schema is not frozen**.
- **Multi-chamber sync-coherence**: the single-chamber synchronous cookie surface (`sync.readSync/writeSync`) is frozen;
  cross-chamber coherence of that cache is not.

**The three rulings this ADR lands (were open going in):** `composite.accepts` is **internal** (off the frozen handle);
`cookies.reconcile` stays **host-internal + unfrozen** (so no fail-open scope-coupling contract ships); composite
read-namespacing / `sampled` surfacing are **not frozen** (they ride the experimental config/handle layer).

**Prerequisite:** before the guards are added, every frozen file is reconciled to present-tense-as-of-1.0 — the stale
now-resolved staging language (OQ7 spec-028, OQ9 sync-surface 012-01, OQ10 ADR-0004, OQ11 ADR-0012/019-01,
decisions-as-data 012-03, and the "seal is unbuilt / MVP3 enforcement" family — the seal shipped + enforces via
017-03/020-02/022) is stripped/reworded; only the labeled carve-outs above remain as "not frozen" notes.

## Consequences

**Becomes easier:**
- An adopter can build against the frozen surface and trust it across minor versions; a regression to it fails a
  contract-stability test in CI rather than surfacing as a broken integration.
- Iteration on the labeled-experimental parts (the config schema especially) continues without a stability-promise
  overhang.

**Becomes harder:**
- Changing a frozen surface now costs a superseding ADR + a major-version break — deliberately.
- The experimental/frozen line must be kept honest as the young parts settle (each later freeze extends this contract
  via a follow-on ADR, not silent drift).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Grounded (read 2026-09-05): the five surfaces + the config carve-out (`docs/architecture.md`); the boot entrypoints,
  `installOnWindow`, and the two `window.airlock` handle shapes (`adapters/eds/index.js`); `push()`/`pushCritical()`→void
  (`contracts/push-api.md`; the 034-03 void-revert); the resolved status of the referenced open questions (OQ7 spec 028;
  OQ9 sync-surface 012-01; OQ10 ADR-0004; OQ11 ADR-0012/019-01; decisions-as-data 012-03; the seal 017-03/020-02/022 —
  all confirmed in `docs/refinement-todo.md`); OQ3 + multi-chamber coherence genuinely still open (`refinement-todo`).
- The frozen surfaces are proven on the synthetic testbed + rigs (MVP1–5); real-production-site validation is the
  operator's creds-gated run (spec 036) — see Kill criteria.

## Kill criteria

- If spec 036's real-site validation (or early real adoption) shows a frozen surface is wrong or unworkable, it is
  corrected via a **major-version break + a superseding ADR** — never a silent change to a surface this ADR froze.
- If the `seams.d.ts` interface fails its first *second* implementation (a real second decision-source or egress
  driver), that surface's freeze is revisited (it was frozen proven-for-one).

## Open questions

- When does the instrumentation-config schema freeze (which of its parts survive to be pinned in a later minor)?
- OQ3 (a pinned event-payload schema) and multi-chamber sync-coherence remain open; each, when resolved, extends this
  contract via a follow-on ADR.
- The v1.0.0 release cut (version bump + tag + dist publish) — deliberately deferred by owner decision; a separate step.
