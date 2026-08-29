---
status: Accepted
dependencies: [adr-0001, adr-0008]
last_verified: 2026-08-29
frame_review: true
---

# ADR-0009: MVP2 chamber isolation — Option B (dedicated Worker), ratified

## Status

Accepted (2026-08-29)

## Context

[ADR-0001](./adr-0001-chamber-isolation-strength.md) recorded the chamber
isolation-strength question (Option B, a dedicated **Web Worker** per chamber, vs
Option C, an in-worker **WASM sandbox** per connector) and **deferred** it, handing
the coupling to OQ9. [ADR-0008](./adr-0008-oq9-coherency-sync-access.md) then
resolved OQ9's **coherency** axis and found it **separable** from — i.e. it does
**not constrain** — the B-vs-C model choice, which it carried forward.

Building the first wrapped-SDK connector ([spec 012-01](../specs/012-mvp2-alloy-chamber/slice-01-host-and-boot.md))
**forces** the choice: you cannot build a chamber from an open isolation decision.
The owner decided **Option B** for the MVP2 proof scope (2026-08-29). This ADR
**ratifies** that decision and records its drivers, resolving ADR-0001's deferred
axis for MVP2 — it is a ratification of an adopted precondition, not a fresh
weighing (had it concluded "C", 012-01's built chamber would already be wrong).

**Grounding.** 012-01 builds an Option-B chamber, verified via `npm run rig:alloy`
(green in chromium, 2026-08-29; AC2–5 committed `6dbab0c` / `209b37e`): stock
unmodified `@adobe/alloy@2.35.0` boots in a **dedicated classic Worker**, driven
through the connector host, egress-confined to a single mediated `fetch`, no
SharedArrayBuffer. (012-01 is IN_PROGRESS — its remaining DoD is review + reconcile,
not the demonstration, which is committed and rig-verified.)

## Decision Options Considered

### Option B — a dedicated Web Worker per chamber
- **Pros:** Proven — stock alloy runs **unmodified** in a classic Worker (R-004,
  012-01); fault isolation per chamber (a crash cannot take the page down,
  ADR-0001); no DOM / no ambient globals; low overhead; ships today. Combined with
  the chamber's **allow-list egress confinement** (012-01 AC5), untrusted vendor
  code's network reach is confined to the mediated `fetch`.
- **Cons:** A Worker is a **shared-heap, same-language** sandbox — it does not give
  the memory-safety / capability confinement a WASM sandbox would. One residual is
  Worker-level: dynamic remote `import()` is reachable (012-01 AC5, disclosed),
  closed only by MVP3 seal enforcement + an optional `connect-src` CSP.

### Option C — an in-worker WASM sandbox per connector
- **Pros:** Stronger structural isolation of untrusted vendor code (memory safety;
  capability-scoped host calls); the egress chokepoint is a sandbox property, not a
  shim discipline.
- **Cons:** **Unproven** for the stock bundle — needs marshal-each-read for the
  vendor's synchronous host access (ADR-0001's open read-semantics question,
  carried forward by ADR-0008), and would require the 766 KB stock IIFE to run
  under a WASM/JS bridge. Heavier; not needed to prove the MVP2 generalization.

### Option D — a single shared Worker for all chambers (ADR-0001)
- Serializes but drops cross-connector confidentiality (one heap for all vendors).
  No-go for hosting mutually-untrusted connectors; not chosen.

## Recommended Decision

**Option B (a dedicated Worker per chamber) for the MVP2 proof scope; Option C /
WASM deferred to a later milestone.** Drivers:

- **Fault isolation** — a dedicated Worker isolates chamber crashes from the page
  and from other chambers (ADR-0001; the containment 012-01 exercises).
- **Bundle maturity / feasibility** — stock alloy runs **unmodified** in a classic
  Worker (R-004, 012-01). Option C's marshal-each-read for the vendor's synchronous
  host access is unproven and unnecessary for the proof.
- **Overhead** — a Worker is the low-overhead, ships-today route; a WASM bridge for
  a 766 KB stock bundle is materially heavier.
- **Egress-chokepoint completeness for untrusted code** (the driver the 012-01
  frame-critique surfaced) — hosting *untrusted* vendor code makes egress
  confinement load-bearing. Option B is adequate **because** 012-01 makes the
  mediated `fetch` the chamber's sole network-capable surface (AC5 allow-list
  posture) — not because a plain Worker is inherently safe. This is the honest
  condition under which B suffices for the proof; the residual it cannot close
  structurally (`import()`) is disclosed and gated to MVP3.

## Consequences

**Becomes easier:**
- 012-01's chamber **is** the Option-B realization; MVP2 proceeds on demonstrated
  ground rather than an open decision.
- OQ9's B-vs-C remainder is resolved for MVP2 scope, narrowing the deferred set.

**Becomes harder:**
- Option C's structural isolation (memory safety, sandbox-level egress) is
  deferred; the confinement burden it would carry structurally is carried instead
  by 012-01's allow-list posture **plus** MVP3's seal enforcement. The `import()`
  residual is a Worker-level hole a WASM sandbox would not have.

## Assumptions

- Stock `@adobe/alloy@2.35.0` boots and runs unmodified in a dedicated **classic**
  Worker, egress-confined, no SharedArrayBuffer — grounded, executed
  (`npm run rig:alloy`, 012-01, 2026-08-29).
- Dynamic remote `import()` is reachable in a chromium classic worker — grounded
  (012-01 AC5 residual probe, `disclosed-residual: reachable`).

## Kill criteria

- **A same-thread confidentiality / memory-safety breach that a WASM sandbox would
  prevent** is demonstrated against hosted untrusted vendor code — **including one
  that defeats AC5's egress confinement itself.** AC5 is *shim discipline* in a
  shared heap: a memory-safety breach can tamper with the `fetch` shim, so the
  chokepoint is only as strong as the Worker's same-language isolation, not stronger.
  Revisit Option C as a superseding ADR.
- **The `import()` residual proves exploitable** in a real CSP-less deployment
  before MVP3's seal enforcement + CSP close it — bring the CSP/enforcement forward
  or reconsider the isolation model.

## Open questions

- Option-C read-semantics (marshal-each-read / unmodified-bundle) remains deferred,
  pre-constrained (ADR-0008) — the question that reopens if Option C is revisited.
- Whether MVP3's seal enforcement + a worker `connect-src` CSP adequately close the
  `import()` residual, or whether it forces the isolation model to change.
