---
status: DRAFT
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 013: live-Alloy re-probe — validate MVP2's stub-based proof against real Adobe Edge

## Overview

[MVP2](../../releases/mvp2.md) shipped (`v0.2.0`) the wrapped-SDK generalization proof —
but against **faithful stubs**: the minting-Edge stub server-assigned an ECID, the
decisions stub returned propositions, and the fan-out was suppressed. That is a legitimate
*proof*, and it is honestly labelled as one. This spec is **[MVP3](../../releases/mvp3.md)'s
Risk-First lead**: run stock `@adobe/alloy@2.35.0` against a **real Adobe Edge** (a real
datastream + IMS org) to **validate — or honestly bound —** what the stubs assumed, and
so **unblock the wrapped-SDK capability contract-freeze and the seam-enforcement design**.

**What is expected to hold — re-confirmed, not re-invented:** the interact *request* body is
genuine, unmodified-alloy XDM (012-01/012-02 drove real alloy; only the *network* was faked),
so **request-side mint-recognition is _expected_ to hold** (same stock bundle) — and is
cheaply **re-confirmed live** (013-01 AC2), since a real datastream's consent / provisioning
can add request fields the stub never exercised. The load-bearing *new* validation is the
**live-only** half the stubs could not touch: the real Edge **response** shape, the
server-directed **egress fan-out**, and **config-integrity** under a real org.

**Why Risk-First.** [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md)'s
kill-criterion is explicit: *re-probe mint-recognizability against real Alloy before the
freeze*. And the endpoint-ceiling + host-allow-list enforcement MVP3 designs cannot be
designed against a fan-out no one has measured (R-004's offline probe suppressed it). If a
probe here **fails** (e.g. the real Edge response is not mint-recognizable, or the fan-out
is un-enumerable, or config is chamber-mutable), it re-shapes MVP3 — better learned now
than after the enforcement seams are built.

**Outcome (spike).** Each slice concludes by **recording** what real Alloy does — a
resolving ADR and/or refinement-todo updates that either **confirm** the stub-based
mechanisms hold live (→ unblock the contract-freeze) or **name the gap + the fallback**
(e.g. host-seeded identity if mint-recognition fails; service-worker chokepoint if the
fan-out escapes confinement). No production seam is built here — this is the measurement
that the enforcement specs depend on.

## Assumptions

<!-- Grounded 2026-08-29 by the MVP2 deliverables (specs 011/012) + R-004 + ADR-0008; risk-gated. -->

- **MVP2 proved against stubs, with a genuine request side.** The minting-Edge + decisions
  stubs faked the *network*; alloy itself, its XDM request, its sync-cookie use, and the
  interception/coalescing/`reserveSpace` mechanisms are real (specs 011/012). Grounded
  (`rig/alloy-*.mjs`, `connectors/alloy/`).
- **⛔ HARD EXTERNAL DEPENDENCY — credentials (scoped).** Implementing this spec needs a
  **real Adobe Experience Platform datastream + IMS org** (a `datastreamId` + `orgId` with
  Edge + Analytics + Target provisioned). Drafting is unblocked; **each slice's live-traffic
  ACs are credential-gated** (a DoR blocker) — but the highest-value evidence (013-01's
  response-shape mint-recognition, the ADR-0008 kill-criterion) is **captured once, then
  replayed creds-free** against the existing extractor as a durable fixture, so it does not
  need standing creds. This is a scoped access gate, not a code gate.
- **ADR-0008 kill-criterion is open against real Alloy.** Mint-recognizability was validated
  on the alloy *request* XDM (012-02), not the real Edge *response*. Grounded (ADR-0008
  Kill-criteria).
- **The egress fan-out is unmeasured.** R-004 faked the Edge response, suppressing the
  server-directed demdex / ID-sync URLs the real response directs. The endpoint-ceiling
  enforcement (MVP3) cannot be designed without it. Grounded (R-004 "left open"; 012-04
  §Findings Axis-1 marks it live-only). **Two measurement-validity constraints (013-02):**
  (a) the classic partner sync is a DOM-`<img>` pixel the *no-DOM chamber swallows invisibly*,
  so the true fan-out needs a **real-DOM main-thread reference run**, not a chamber-only run;
  (b) fan-out breadth tracks the org's Audience-Manager third-party-destination config — a
  fresh test org may fire ~zero syncs, so a null result is a **lower bound**, never evidence
  of narrow egress.
- **This runs live traffic to a real Adobe org.** It emits real Analytics/identity calls —
  use a **test/dev datastream + org**, never production, and treat captured identifiers as
  sensitive (do not commit them). Grounded (operational).

## Decomposition

SPIDR = **Spike (S)** — the one case where S is right, not a last resort: this is a
timeboxed **learning** activity (*does real Alloy behave as MVP2's stubs assumed?*), and
none of Path / Interface / Data / Rules apply because the answer is unknown until measured.
Each slice is `kind: spike`, **nested in this spec** (never a standalone `docs/spikes/`),
and each concludes with a **downstream artifact** (a resolving ADR or a refinement-todo
update) that the MVP3 enforcement + contract-freeze specs consume — the anti-pattern this
avoids is "research, then build one big enforcement slab."

Split by **probe axis** (each is one live question, independently credential-gated):

- **013-01 `[S]` real Edge round-trip + mint-recognizability** — boot alloy against a real
  datastream; capture the real `interact` **response**; verify the real (server-assigned)
  ECID round-trips into the jar, and that the broker's XDM mint-recognition + coalescing
  hold against **real** Alloy. Clears ADR-0008's **mint-axis** kill-criterion (necessary,
  **not sufficient** — the full contract-freeze also awaits 013-02/03).
- **013-02 `[S]` egress-breadth fan-out** — capture the server-directed demdex / ID-sync
  URLs the real Edge response directs (the fan-out the stub suppressed). Answers whether the
  endpoint-ceiling / host-allow-list can enumerate real Alloy's egress — the enforcement
  design's required input.
- **013-03 `[S]` config-integrity / same-host-tenant re-routing** — test whether a
  compromised chamber can re-point `datastreamId` / `orgId` to an attacker's Adobe org on
  the *allowed* host (which destination-allowlisting is blind to). Grounds the
  config-integrity requirement MVP3 enforces.

## Slices

1. [013-01 — real Edge round-trip + mint-recognizability](slice-01-edge-roundtrip.md)
2. [013-02 — egress-breadth fan-out](slice-02-egress-fanout.md)
3. [013-03 — config-integrity / same-host-tenant re-routing](slice-03-config-integrity.md)
