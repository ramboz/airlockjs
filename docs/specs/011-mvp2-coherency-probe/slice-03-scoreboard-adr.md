---
status: DONE
kind: spike
dependencies: [011-01, 011-02]
last_verified: 2026-08-29
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 011-03 — coherency scoreboard + resolving ADR

**Goal:** The in-band (011-01) and out-of-band (011-02) verdicts are synthesized
into a single coherency scoreboard and a recorded go/no-go on "coherent
synchronous cross-chamber view without SharedArrayBuffer," and the dedicated ADR
that resolves OQ9 — jointly settling the MVP2 isolation model (ADR-0001 B-vs-C)
and the synchronous-host-access mechanism — is written and accepted.

**Question:** Given the measured coherency behavior across all four threats, can
MVP2's multi-chamber premise be served by an AD-4-compatible sync-access
mechanism — and which isolation model (B vs C) does the evidence point to?

**Time-box:** ~0.5 day. This slice is synthesis + decision, not new
measurement; it consumes 011-01/011-02 and produces the ADR.

**DoR:**
- ✅ 011-01 + 011-02 DONE — the four coherency verdicts (concurrent in-band +
  three out-of-band sources) are recorded with staleness windows.

**Acceptance Criteria:**

1. **Coherency scoreboard.** A single artifact (in the spec Findings and/or
   `rig/out/`) tabulates the four threats — the concurrent two-chamber **in-band** write, the
   two **positive** out-of-band sources (foreign main-thread script, second-tab),
   and the network `Set-Cookie` **negative boundary** — with each one's measured
   result: its coherency verdict (coherent / stale-then-reconciles / permanently
   divergent) and window, plus — for the identity-consuming scenarios (011-01
   AC5) — its **correctness** classification (fault vs self-heal).
2. **Go/no-go recorded — split by axis.** The scoreboard yields an explicit
   conclusion on the **coherency** axis, framed as a *correctness* judgment on
   shared identity (not merely a window width — per the spec's third assumption):
   **go** (broker-push invalidation bounds staleness acceptably for the worst-case
   B topology); **out-of-band no-go** (model-independent → stop-and-re-shape
   trigger: AD-4-exception-via-ADR or re-shape MVP2 scope); or **in-band-only
   no-go** (B-specific → not a stop-and-re-shape; a recorded input that
   discriminates the deferred model toward a single-thread model, C or D).
3. **Resolving ADR written and accepted.** A dedicated ADR (next free number, via
   `/jig:adr-workflow`) interprets the scoreboard onto OQ9. It must claim **only
   what the probe measured** (the coherency axis) and route the rest honestly:
   - **(a) Coherency mechanism** — chosen from
     [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md)'s
     named options (seed + async write-back / broker-push invalidation on
     `cookieStore` `change` / single-shared-worker; per-read marshalling ruled
     out within AD-4), **grounded in the probe's evidence** and proven for the
     worst-case B topology, so a go transfers to C **on coherency**.
   - **(b) Contract freeze as a constraint** — on a go, the ADR may freeze the
     step-5 capability contract on the **sync-read cookie shape**, recording that
     the freeze is an **explicit constraint on** the deferred B-vs-C choice (it
     tilts against a C that cannot honor sync-reads with an unmodified bundle) —
     *not* a clean decoupling.
   - **(c) Read-semantics tension reconciled, not asserted** — the ADR resolves
     the still-open Option-C read-semantics question (ADR-0001's marshal-each-read
     / unmodified-bundle vs R-006's addendum counter), which the probe did **not**
     measure. If unresolved, it stays an explicit open question the freeze
     pre-constrains — never papered over.
   - **(d) B-vs-C: deferred but pre-constrained** — the ADR carries the model
     choice forward on isolation-strength grounds (fault isolation,
     confidentiality/containment of untrusted vendor code, overhead, bundle
     maturity — the drivers ADR-0001 left open), **plus** the coherency inputs the
     probe *did* produce (an in-band no-go discriminates toward a single-thread
     model) **plus** the contract-freeze constraint from (b). It is **not**
     attributed to ADR-0001 (which decided none of it) and **not** claimed as
     unconstrained.
   The ADR resolves the coherency axis ADR-0001 deferred (ADR-0001 made *no*
   forward reservation — it recorded the coupling and handed it to OQ9), amends
   OQ9's coupled-decision premise, and cites this spec's scoreboard.
4. **OQ9 resolved on the coherency axis; remainder carried forward.**
   `docs/refinement-todo.md` OQ9 is updated with a link to the new ADR (mirroring
   OQ10→ADR-0004): the **coherency/sync-access half is RESOLVED**; OQ9's "one
   coupled decision" premise is **amended** (the probe found the coherency axis
   separable from the model choice); and the **isolation-model + read-semantics
   remainder** is carried forward as a new, narrower, contract-freeze-constrained
   deferred item (not left silently open, not marked resolved).

**DoD:**
- [x] ACs 1–4 pass; the go/no-go is defensible from the recorded scoreboard (a
      reader can trace the conclusion to the four measured verdicts). *Compliance
      review: pass (no findings).*
- [x] The ADR is `Status: Accepted` (per this repo's direct-to-main ADR flow)
      and linked from OQ9 + the ADR index. *ADR-0008 Accepted 2026-08-29.*
- [x] Spike-light review on the measurement synthesis; the ADR itself carries
      `frame_review: true` and goes through `/jig:adr-workflow`'s own review
      (ADRs are always frame-reviewed). *Compliance + craft recorded pass;
      ADR-0008 frame-critique recorded (owner authority, 7-round history).*
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Primer hygiene: this slice **closes spec 011**. Active-specs compression is
      a **no-op** (spec 011 was never in the `CLAUDE.md` primer — only 001 is);
      the load-bearing coherency verdict is migrated to the status-board Notes
      column at regen.

**Findings:** the coherency scoreboard + the go/no-go, synthesized from 011-01
(in-band) and 011-02 (out-of-band). Full data: `rig/out/coherency.json`, reproducible
byte-identical.

**Coherency scoreboard** (every threat, its coherency verdict + window, and — for
the identity-consuming scenarios — its correctness classification):

| Threat (axis) | mechanism | coherent? | window | **correctness** |
|---|---|---|---|---|
| Concurrent two-chamber RMW (in-band) | seed + async write-back (A) | no (caches diverge) | 1 op, unreconciled | **FAULT — split identity** (ECID-c1 + ECID-c2) |
| — control | single chamber | yes | none | coherent |
| — control | broker-push invalidation (B) | yes | 2 ops | **self-heal** (reconciled before consumption) |
| Foreign main-thread script (out-of-band) | seed + async (A) | no | 2 ops, unreconciled | **FAULT — split identity** (ECID-foreign + ECID-c1) |
| — same source | broker-push on polling (B) | yes | detection 2 + propagation 1 = 3 | **self-heal** |
| Second same-origin tab (out-of-band) | source-independent (same as foreign) | — | — | same correctness; **detected via `document.cookie` polling** |
| Network `Set-Cookie`, same-origin (negative boundary) | — | identity cell untouched | — | **does not reach the cell** (a *different* cell written; `Set-Cookie` header unreadable, R-006 F4) |
| Network `Set-Cookie`, cross-site demdex (negative boundary) | — | identity cell untouched | — | **does not reach the cell** (Adobe's domain / CHIPS-partitioned) |

> **Reading the `(B)` self-heal rows.** The two `broker-push invalidation (B) → self-heal`
> rows are the **measured synchronous-mint** result — 011-01 modeled minting as an atomic
> *local* generate. For the **async** mint (the real server-assigned ECID round-trip,
> R-004), broker-push **value**-invalidation does **not** self-heal (it cannot un-mint an
> already-emitted ECID), and the fault is **model-independent**, not B-specific. The async
> case is retired instead by broker-side request **coalescing** (below). See the go/no-go,
> [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md), and the 011-01
> synchronous-vs-async reconciliation **held for owner approval (issue #125)** — 011-01 is
> DONE and is not rewritten here.

**Go/no-go — split by axis: GO, conditional (for the wrapped-SDK archetype).**
[Converged through seven ADR-0008 frame-critique rounds; 011-04 was abandoned once the
mechanism was established analytically.] The async concurrent-first-mint fault (two
chambers both read empty and both mint → two ECIDs → split identity) is
**model-independent**, and is retired by **broker-side async request coalescing** — the
single-threaded broker holds the second concurrent identity-mint and returns the
first's ECID (async, no SAB). Seed+async and broker-push **value**-invalidation are
ruled out (fault / cannot un-mint an emitted ECID). The condition is egress-visibility
of the mint: **wire-protocol connectors (GA4)** are already broker-visible (the
orchestrator dispatches egress on the main thread — ADR-0004); the **wrapped-SDK
archetype (Alloy)** issues its own opaque worker-side `fetch` (AD-7 / R-004), so the GO
is **conditional on** chamber-side interception of that `fetch` into the orchestrator's
existing dispatch **plus** parsing the vendor's XDM `interact` to recognize the identity
mint. So the coherency axis is a **GO**, the **step-5 contract-freeze gate is HELD** for
the wrapped-SDK until that mechanism is designed, and this axis does **not** constrain
B-vs-C. `Set-Cookie` negative boundaries hold. Recorded in
[ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md).

**Outcome:** `ADR-0008 created + accepted; OQ9 coherency/sync-access axis resolved (conditional GO); 011-04 abandoned (mechanism established analytically).`

**Anti-horizontal-phasing check:** after this slice, MVP2 has its precondition
answered — the step-5 capability contract can be frozen (or MVP2 re-shaped)
against a recorded, evidence-backed decision. Observable value: the
**contract-freeze gate** is lifted. (The per-connector isolation upgrade still
waits on the deferred, contract-freeze-constrained B-vs-C decision — that item is
narrowed and carried forward, not lifted here.)

### Deviation log (after reconciliation)

- **The verdict shape diverged from AC2's three anticipated outcomes.** AC2 pre-drew
  three shapes — go via **broker-push value-invalidation**; out-of-band **no-go**;
  in-band-only **B-specific** no-go. The converged answer is a **fourth** shape:
  **conditional GO**, retired by broker-side async request **coalescing** (not
  value-invalidation), **model-independent** (not B-specific), **conditional** (for the
  wrapped-SDK archetype) on vendor-`fetch` interception + XDM mint-recognition. Cause:
  the ADR frame-critique surfaced that the rig modeled a **synchronous** mint while real
  ECID minting is an **async** Edge round-trip (R-004) — the fault, and its fix, live at
  the mint `fetch`, not at write-back.
- **011-04 inserted, then abandoned.** A measurement slice (011-04) was inserted to model
  the async mint, then **abandoned** (2026-08-29) once seven ADR-0008 frame-critique
  rounds established the mechanism analytically: the deterministic single-threaded op-model
  cannot *measure* a race the broker serializes away, so a rig would only restate the
  analysis. 011-03's `dependencies` were reverted to `[011-01, 011-02]`; spec.md's slice
  list marks 011-04 ABANDONED.
- **The result is analytical, not rig-measured** — disclosed in the go/no-go note, the
  scoreboard's `(B)`-row bridge, and ADR-0008 (Context / Assumptions / kill-criteria).
  This is an honest weakening from "measured" to "structural argument," forced by the
  critique process; the kill-criteria name what a real-Alloy re-probe must falsify before
  the freeze.
- **011-01's synchronous-mint "B-specific" finding is NOT reconciled unilaterally.** It is
  surfaced for owner approval (issue #125); 011-01 is DONE and untouched.
- **ADR-0001 gets no back-edit** (immutability — Nygard): ADR-0008 does not supersede it
  (it resolves a deferred axis, it does not replace the isolation-strength decision), so
  the planned sweep "cross-link ADR-0001 → ADR-0008" is a **no-op**; the link is one-way
  (ADR-0008 → ADR-0001).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | OQ9 coherency/sync-access axis marked **RESOLVED** with the ADR-0008 link; the "one coupled decision" premise amended to *separable*; B-vs-C + read-semantics + the wrapped-SDK interception mechanism + the 011-01 reconciliation carried forward. |
| `docs/decisions/adr-0008-*.md` | `created` | The resolving ADR — authored, frame-critique recorded (owner authority; 7-round history), **Accepted** 2026-08-29. |
| `docs/decisions/README.md` / ADR index | `updated` | Regenerated (`adr.py index`); ADR-0008 indexed. |
| `docs/decisions/adr-0001-*.md` | `no-op` | **Immutability (Nygard).** ADR-0008 does not supersede ADR-0001 — it resolves a deferred axis, it does not replace the isolation-strength decision — so no back-edit / back-link. The reference is one-way: ADR-0008 → ADR-0001. (Supersedes the sweep's original planned `updated`.) |
| `docs/architecture.md` | `deferred → applied` | **Canon conflict surfaced.** ADR-0008 flags the Tech-stack "egress from the worker" line as a superseded wizard draft that contradicts **accepted** ADR-0004 (main-thread dispatch). Owner-gated at slice close, so surfaced not rewritten *in this slice*; **applied 2026-08-29 in the owner-approved follow-up** — the Tech-stack line **and** AD-2 reconciled to ADR-0004 ("Option C": worker maps, orchestrator dispatches on the main thread). The MVP2 isolation model + sync-access mechanism remains **contract-freeze-held** (nothing new lands in architecture.md there). |
| `docs/specs/011-…/slice-01-coherency-rig.md` | `deferred → applied` | 011-01's synchronous-mint **"B-specific"** finding vs the async **model-independent** result — surfaced for owner approval (issue #125) at slice close; **amendment applied 2026-08-29 in the owner-approved follow-up** (a dated, additive note scoping the B-specific reading to the synchronous mint; the measurement stands, only its forward interpretation is superseded for the async case). |
| `docs/specs/011-…/slice-04-async-mint.md` | `updated` | Marked **ABANDONED** (2026-08-29) with rationale; the mechanism was established analytically by ADR-0008's critique process, so the demonstration rig would only restate it. |
| `docs/specs/011-…/spec.md` | `updated` | Slices list: item 3's stale "Depends on 011-04" removed; item 4 (011-04) marked **ABANDONED** with the analytical-supersession rationale + ADR-0008 link. |
| `docs/releases/mvp2.md` | `no-op` | The conditional GO is consistent with MVP2's already-narrowed scope (isolation + wrapped-SDK proof); the freeze-held wrapped-SDK coalescing/interception mechanism is a recorded **downstream** constraint (step-5 / MVP3), not a cutline change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board`; Notes carries the coherency verdict. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 011 was never added to the `CLAUDE.md` Active-specs primer (only 001 is listed) — nothing to compress; the load-bearing verdict rides the status-board Notes + OQ9 + ADR-0008. |
| `docs/memory/**` | `no-op` | No new cross-session memory beyond what ADR-0008 + OQ9 + the status board already record. |
