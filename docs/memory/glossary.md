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

## customer-custom tag

A tag that is a specific customer's own logic (e.g. an in-house event-enrichment or click-tracking chain like the reference site's ECS/TrackStar/UX-Fabric chain), as opposed to a generic third-party vendor tag. Per ADR-0018, customer-custom tags are validation-only inputs — never a shipped airlock connector, deliverable, or release gate.

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

## parity (vendor-boundary)

The property that, after a tag is rewired from its tag-manager container to airlock, the same events with the same attribution-bearing fields reach the vendor as before. Confirmed by a per-vendor oracle (a same-protocol beacon diff where airlock speaks the container's protocol, or a semantic field-map where it legitimately speaks a different one, e.g. GA4 Measurement Protocol) and by the vendor's console. ADR-0018 makes it a co-equal 1.0 success criterion alongside the CWV scoreboard.

## parity harness

The vendor-generic capture → replay → oracle → report tool (MVP7) that confirms vendor-boundary parity for a rewired tag, with per-protocol oracles and the request's credential/cookie context captured and replayed. The release deliverable; each real site supplies its own redacted vendor-beacon captures as its oracle input.

## rewire

Moving a vendor tag's execution from a main-thread tag-manager container (Tealium / GTM / Adobe Launch) to an airlock connector: the container stops firing the tag, airlock emits the equivalent governed, off-thread beacon. The 1.0 adoption motion (ADR-0018).

## the seal

The consent/allowlist gate on egress. Events whose egress is blocked are "held at the seal" — queued (in a bounded ring, oldest-dropped past the cap) until consent arrives or the page unloads (architecture.md § Clarifications Q2). Consent defaults to pending; egress is prerender-aware.

## seam

A swappable driver boundary baked in from day one. Two seams: a **decision-source** seam (local | edge) and an **egress** seam (direct keepalive | service-worker chokepoint | edge-proxied). Only local variants ship in MVP; "add edge" is a driver swap, not a rewrite. MVP1's in-house decisioning ships *as* the local decision-source driver (architecture.md § Clarifications Q4).

## stable core

Airlock's frozen public API surface (the five contract surfaces + the adopter boot layer) pinned by ADR-0017 / spec 037-01. Since ADR-0018 it is called "the stable core" rather than "the 1.0 API": it is the contract airlock ships *on*, while "1.0" now denotes the adoption bar (adoptable with confirmed parity), cut at MVP9.

## state projection

The current-state view derived from the event log, held in the orchestrator and read synchronously (`Map` for keyed state, `WeakMap` for element associations). A `push()` folds its event into the projection synchronously so synchronous readers see current state — this fold is on the main thread's interaction path and must stay cheap. The **projection snapshot slice** is the bounded, privacy-filtered subset that crosses the airlock to the worker per event (what may cross is OQ4).

## tag-manager container

A main-thread tag-management runtime (Tealium iQ, Google Tag Manager, Adobe Launch) that loads and fires vendor tags on the page. The thing airlock rewires tags *out of*; on the reference site it is a customer-owned Tealium profile, which is why the 1.0 rewire is a two-party effort (developer + container owner).

## advanced matching
Meta/Facebook Pixel feature that attaches hashed first-party identifiers (ud[external_id], ud[em]/ph/fn/ln/db/ge/ct/st/zp/country — SHA-256 hex of Meta-normalized values) to /tr beacons to raise match rates. In airlock (spec 026-04, ADR-0022): raw PII feeds via a dedicated setIdentity/init channel that bypasses payload governance BY DESIGN to reach in-chamber hashing; the confined worker normalizes + SHA-256-hashes eagerly, posts only the hex back, and merges ud[...] onto every steady-state /tr beacon; the main thread additionally holds a hash-only identityCache read synchronously so the spec-042 GET-critical unload beacon carries it too. Only hashes ever egress (degrade-to-omit, never raw, if a field is unhashed at teardown). See connectors/pixel/advanced-matching.js.

## presence parity
The 038 harness parity claim for a hashed/opaque identity field (Meta ud[external_id], any per-user SHA-256) where byte-value comparison is meaningless: parity = the field is PRESENT and WELL-FORMED on airlock, wherever the container beacon carries it — NOT value-equal. Confirmed via redact-both-sides: run BOTH beacons through redactMetaBeacon so per-user hashes collapse to the shared SYNTHETIC_HASH sentinel, and the value-equality oracle (diffParity) sees equal sentinels -> maps; paired with a raw-side well-formedness guard (64-hex) so redaction cannot mask a malformed/empty value. Distinct from value parity (deterministic fields id/ev/cd[...]) and from same-input EFFICACY (did airlock hash the same input the container did — an MVP9 rewire/adoption residual, ADR-0020 kill-criterion #1). See rig/parity/descriptors/meta.js + spec 038-04. Related: [[advanced matching]].
