---
status: DRAFT
skill: jig:spec-workflow
use_cases: []
---

# Spec 024: worker-dom compatibility-layer feasibility (POC-B)

> **POC-B** of the performance thesis ([R-008](../../research/R-008-costly-dom-martech-containment.md)) — the
> **Lever 2** feasibility spike. POC-A (spec 023) proved Lever 1 (scheduled capability) contains a *chunkable*
> tag's INP, but only for tags **adapted** to airlock's capability. This spike asks whether airlock can contain
> an **unmodified** costly tag by running it off-thread against a **worker-dom** mirror. Its trigger ("after
> POC-A lands its scoreboard") is met.

## Overview

A single `kind: spike` slice: **is worker-dom a viable compatibility layer for airlock** — can an unmodified,
costly-DOM martech tag run in a chamber against a virtual DOM (its computation off-thread, its mutations
serialized + budgeted onto the main thread), containing INP where Lever 1 can't reach — and what is the
documented **"works / won't work"** set? Outcome: an ADR (adopt/reject worker-dom as the compat layer) or a
follow-on spec.

## Current state (grounded, 2026-09-01)

- **`@ampproject/worker-dom`** — v0.36.0, created 2018, last modified 2025-06 (semi-maintained, pre-1.0). Runs
  author JS in a Web Worker against a virtual DOM; mutations are serialized **async** to the main thread, where
  a coordinator applies them (it can throttle/prioritize by frame budget). **No SharedArrayBuffer required.**
- **`@builder.io/partytown`** — v0.10.3, last modified 2026-06 (actively maintained), the modern analog. But
  airlock already grounded it ([R-003](../../research/R-003-partytown-mechanism-check.md)): it fakes a
  **synchronous** DOM via JS Proxies — default path = **blocking** sync-XHR + a service worker (each DOM call
  round-trips), fast path = **SharedArrayBuffer + COOP/COEP**, which **[AD-4](../../architecture.md) refuses**
  (it breaks common cross-origin embeds). So Partytown's fast path is off the table for airlock, and its
  default path is slow + main-thread-heavy.
- **The sharp thesis (why worker-dom, not Partytown):** worker-dom's **async mutation-flush** is the
  AD-4-compatible mechanism (no SAB) **and** aligns with airlock's performance thesis (off-thread computation +
  budgeted main-thread mutations — the same "capture/enqueue on main, do the work behind the airlock" shape).
  Partytown's **sync proxy** neither fits AD-4 nor the thesis. So worker-dom is the candidate base this spike
  evaluates.
- **023-01** proved Lever 1 for *chunkable* work; the *monolithic-sync / unmodified* case (the majority of the
  long tail) is exactly what this Lever-2 spike is for.

## Assumptions

- **[to ground in the spike] worker-dom is AD-4-compatible** (async mutations, no SAB dependency) — confirm
  from its source/docs, not just its reputation.
- **[to ground in the spike] The load-bearing limit is the SYNC-READ boundary.** An async mirror can't answer a
  synchronous live-layout read (`getBoundingClientRect`, `offsetHeight`, reading back a just-written value) —
  so the "won't work" set is tags needing live layout/measurement, sync storage, focus, or their own
  sub-resource loads expecting a real `window`. The spike's job is to *map* that set against real martech, not
  assert it.
- **[to confirm] Does off-thread execution actually contain INP here?** worker-dom moves the *computation* off
  the main thread, but the main thread still applies the mutations — the spike must check the mutation-apply
  cost doesn't just re-tank INP (the coordinator's frame-budgeting is what should prevent it).

## Decomposition

SPIDR — **S (Spike)**: this is genuinely a *learning* activity (viability + the works/won't-work set are
unknown), the one case where S is right. A single spike slice; its Outcome names the downstream ADR/spec.

## Slices

- [024-01 — worker-dom feasibility spike](slice-01-worker-dom-spike.md)
