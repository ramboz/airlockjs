---
status: DONE
skill:
frame_review: true
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 028: Enforcement inspector

> Reserved on 2026-09-03 via `workflow.py new`. MVP5 fixed core — the enforcement-decision inspector.

## Overview

MVP5's fixed core: make airlock's enforcement + governance **visible**. MVP3/MVP4 built the teeth (seal
holds, endpoint ceiling, consent gate, payload governance, config-integrity, ring drops, chamber crashes) but
today a developer can only see those decisions as redacted `console` output. The vision names a
**first-class diagnostics/inspector** (§ Scope; OQ7) and the differentiator vs Zaraz's opacity (§ Competitive):
for any egress beacon, *why did it fire / hold at the seal / get gated / get stripped?*

**`use_cases: []` — observability infrastructure, declined-trace (not a 4th customer use case).** The inspector
serves the cross-cutting *visibility + trust* of the existing UC-1/2/3 beacons; the vision places it under
§ Scope / OQ7, not among the three customer-request use cases. It adds no new user-facing analytics/experiment
capability of its own — it makes the already-governed beacons legible. This spec **resolves OQ7**.

**Risk-First grounding (the MVP5 probe — settled 2026-09-03, so the inspector is scoped honestly):** the
question was *are the enforcement decisions already emitted as structured, queryable events (inspector = a
read-layer) or only console output (inspector = new instrumentation)?* **Answer: read-layer.** Grounded by
enumerating every emit site (`grep 'diagnose('` across `core/`, `adapters/`, `connectors/` — 21 sites, the
complete set):

- **Every enforcement decision already emits a structured record** `{ level, kind, disposition, ...context }`.
  The `kind` set is closed and enumerated: `consent` (held/dropped/flushed/not-enforced), `endpoint-ceiling`
  (held), `payload-governance` (stripped/skipped), `config-integrity` (overridden), `dropped`, `chamber-error`,
  and the `dom-apply-*` family (refused/threw/unknown-id).
- **A DI seam for the tap already exists** — `onDiagnostic` in `core/airlock.js`, `core/wrapped-sdk-host.js`,
  and `adapters/eds/dom-apply.js`, defaulting to `consoleDiagnostic`. `core/airlock.js:32` reserves it
  verbatim: *"`onDiagnostic` (e.g. the future OQ7 inspector) to intercept the same records."* The inspector's
  data tap was designed in.
- **`onDiagnostic` is three SEPARATE constructor injectables, not one** (frame-critique correction,
  2026-09-03): `createAirlock` (`core/airlock.js:57`, 10 emit sites), `createWrappedSdkHost`
  (`core/wrapped-sdk-host.js:171`, 8 sites — **including every `config-integrity` decision** and the whole
  alloy / wrapped-SDK round-trip egress path), and `createDomApplyCoordinator` (`adapters/eds/dom-apply.js:89`,
  3 `dom-apply-*` sites). A collector wired on `createAirlock` **alone** is blind to 11 of the 21 sites — incl.
  all config-integrity — which would ship an inspector *worse* than the console baseline. So the collector is
  **one shared instance wired as the `onDiagnostic` sink on all three constructors** (still zero new
  instrumentation — three wire points, not one).
- **What is genuinely missing** (the inspector's real work): (1) no **collector** — records are console-backed
  by default, nothing captures them into a queryable buffer (enumerated: `grep` for any
  sink/subscriber/buffer/collector finds only the `onDiagnostic` injection points, none). (2) No **query
  surface**. (3) No **panel**. (4) Records carry `disposition` + rich context (`purpose`, `destination`,
  `reason`, `field`, `index`) but **not the originating event/beacon identity** — so grouping the full
  fire→hold→flush / strip chain for *one specific beacon* needs a small correlation-id enrichment, not a
  rearchitecture.

So the inspector is a **read-layer over an existing, already-structured stream** — one shared collector tapped
at all three `onDiagnostic` seams — plus a modest per-beacon correlation enrichment and a local panel. This is
the de-risk MVP5's Risk-First called for.

## Assumptions

- **One shared collector wired on all THREE `onDiagnostic` injectables captures every enforcement decision.**
  Grounded by the 21-site enumeration split across `createAirlock` (10), `createWrappedSdkHost` (8 — incl. all
  `config-integrity`), `createDomApplyCoordinator` (3). The frame-critique (2026-09-03) **corrected the original
  single-seam framing**: a `createAirlock`-only collector is blind to 11 sites incl. config-integrity, so
  slice-01 wires all three. **Worker residual — verified BENIGN, not a gap:** `core/chamber.worker.js` calls
  `diagnose()` **zero** times; it emits `{ready, dropped}` via `postMessage` (→ the `dropped` record at
  `airlock.js:268`) and crashes cross via `worker.onerror` (`airlock.js:280`), so drops + crashes already
  reach a main-thread collector.
- **Per-beacon correlation is a small, non-invasive enrichment — and it is BEACON-keyed, not event-type-keyed**
  (grounded 2026-09-03, pre-draft — mirrors 028-01's three-seam catch). The worker maps events → bare
  `EgressRequest{url,method,body}` (`core/chamber.worker.js`'s `{ready, dropped}` shape), so the originating
  push() **event type is stripped** before airlock's ready-path emit sites; it survives only on `dropped`
  (`d.type`). The correlation ref that IS in scope: airlock's `heldBeacons` (`airlock.js:234`) carried into the
  `setConsent` flush (`:450-461`) — the held→flushed chain; and `createWrappedSdkHost`'s existing intercepted-fetch
  `m.id` at its `config-integrity`/`consent`/`ceiling` emits. So slice-02 correlates by a synthetic per-beacon id
  (+ destination), threaded where the beacon identity already lives — NOT the event type, and NOT the
  `dom-apply-*` sites (a DOM mutation, not an egress beacon). The enrichment is additive (an added record field),
  preserving the flat-record invariant and every existing record shape.
- **The collector + panel add zero interaction-path cost** — they read the log/stream *off* the hot path
  (`push()`/projection never touches them). This is a hard MVP5 no-go; the design must not fold any collector
  work into capture. **Frame-critique target** (a diagnostics tool that regresses INP violates the invariant
  it exists to demonstrate).

## Decomposition

SPIDR, inspector-first per the MVP5 plan (the RUM-emitter subsume + the CWV scoreboard are **separate** MVP5
specs, not slices here). Vertical, user-facing (a developer sees more each slice); Spike not needed — the
Risk-First grounding already answered the open question, so this is build, not research.

- **028-01 — the decision-stream read-layer + query (Data + Interface).** Wire a bounded in-memory
  **collector** via the existing `onDiagnostic` seam and expose a **query API** over the enforcement-decision
  stream (filter by `kind` / `disposition` / `purpose`). Pure read over the already-structured records — **zero
  new instrumentation.** Delivers, end-to-end, a queryable enforcement-decision log a developer can inspect.
  The fixed core; shippable alone.
- **028-02 — per-beacon correlation (Rules + Path).** Thread the originating event/beacon identity (event
  type + a per-beacon id) into the records at the main-thread emit sites and group by it in the collector, so
  the inspector answers the vision's actual phrasing — *"why did THIS beacon fire / hold / get gated / get
  stripped"* — as one correlated causal chain, not a flat stream. Modest enrichment; grounded-scoped by the
  slice-01 read-layer.
- **028-03 — the drop-in dev panel (Interface).** A lightweight, local, drop-in-JS **panel** over the query
  API (no remote/hosted trace backend — an MVP5 no-go). Renders the decision stream / per-beacon chains for a
  developer; reads off the hot path (zero interaction-path cost, measured).

**Anti-horizontal-phasing check:** each slice touches the developer-facing surface and delivers standalone
value — 01 is a usable queryable log, 02 adds correlated per-beacon answers, 03 adds the visual channel. Not a
collector→query→panel horizontal stack: 01 bundles tap→collect→query as one vertical thread.

## Slices

- [028-01 — the decision-stream read-layer + query](slice-01-collector-query.md)
- [028-02 — per-beacon correlation](slice-02-beacon-correlation.md)
- [028-03 — the drop-in dev panel](slice-03-dev-panel.md)
