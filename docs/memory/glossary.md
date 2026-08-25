# Glossary

> Status: Draft (wizard-generated)
>
> Domain terms and project-specific vocabulary for airlock. Loaded on demand
> when the hot cache (CLAUDE.md) misses. Update via `/jig:memory-sync` or when
> `jig-memory-scan` surfaces an unknown reference.
>
> When `jig-memory-scan` flags an unrecognized capitalized reference, the user
> provides the definition once and `memory-sync` writes it here. High-frequency
> terms (referenced ≥3 times in a session) are promoted to the CLAUDE.md hot cache.

<!-- Terms below, alphabetical. Format: ## TERM, followed by definition prose. -->

## airlock

The mediated boundary between the privileged main thread and the unprivileged Web Worker. Connectors reach the network, or the DOM, only by cycling through the airlock — nothing crosses without going through the capability bridge. The name carries both halves of the thesis: *fault-isolation* (a broken tag must not sink the page) and *mediated egress* (nothing leaves without passing the capability boundary).

## chamber

A single connector's sandbox inside the worker runtime. Each connector runs in its own chamber with no DOM and no ambient globals; it consumes typed events, builds a vendor payload, and requests mediated capabilities. When a chamber crashes it is isolated — dropped/restarted — while other chambers and the page keep running (see architecture.md § Clarifications Q1).

## connector

The unit of martech integration that runs inside a chamber. Two archetypes: **wire-protocol** (reimplement the beacon directly, e.g. `airlock/ga4` via the GA4 Measurement Protocol — the MVP1 shape) and **wrapped-SDK** (contain a vendor library in a chamber, e.g. `airlock/alloy` — MVP2). Registry namespace `airlock/*`.

## cycle / lock-through

Two names for one thing: a batch of events crossing the airlock from the main thread to the worker. Each drain of the ring buffer produces one cycle. Delivered by batched `postMessage` (structured clone), ordering preserved across the crossing. ("Lock-through" is the same operation described from the airlock's point of view.)

## egress

A connector's network send, fulfilled through the egress seam via `fetch(url, { keepalive: true })` from the worker. Egress is held at the seal until consent and allowlist checks pass; capture and enqueue never wait on it. Batches exceeding the ~64KB aggregate keepalive body cap are split into multiple cycles (architecture.md § Clarifications Q3).

## event descriptor

The minimal record a `push()` writes on the interaction path (type + payload-ref + timestamp). Deliberately cheap to create — this is what keeps INP low. Distinct from the event log entry it becomes. Exact shape is OQ2.

## event log

The append-only, ordered source of truth for the datalayer. Cycles to the worker in batches with ordering preserved. Paired with the state projection: a `push()` appends to the log *and* folds synchronously into the projection.

## orchestrator

The only martech code with DOM access, running on the main thread. Owns the append-only event log, the synchronous state projection, the `WeakMap` element→data associations, consent state, and the capability broker. Drains the ring buffer on idle and cycles batches to the worker.

## the seal

The consent/allowlist gate on egress. Events whose egress is blocked are "held at the seal" — queued (in a bounded ring, oldest-dropped past the cap) until consent arrives or the page unloads (architecture.md § Clarifications Q2). Consent defaults to pending; egress is prerender-aware.

## seam

A swappable driver boundary baked in from day one. Two seams: a **decision-source** seam (local | edge) and an **egress** seam (direct keepalive | service-worker chokepoint | edge-proxied). Only local variants ship in MVP; "add edge" is a driver swap, not a rewrite. MVP1's in-house decisioning ships *as* the local decision-source driver (architecture.md § Clarifications Q4).

## state projection

The current-state view derived from the event log, held in the orchestrator and read synchronously (`Map` for keyed state, `WeakMap` for element associations). A `push()` folds its event into the projection synchronously so synchronous readers see current state — this fold is on the main thread's interaction path and must stay cheap. The **projection snapshot slice** is the bounded, privacy-filtered subset that crosses the airlock to the worker per event (what may cross is OQ4).
