---
status: DRAFT
kind: spike
dependencies: [011-01, 011-02]
last_verified:
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
   `rig/out/`) tabulates all four threats — concurrent two-chamber write,
   credentialed `Set-Cookie`, main-thread write, second-tab write — with each
   one's measured verdict (coherent / stale-then-reconciles / permanently
   divergent) and window.
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
- [ ] ACs 1–4 pass; the go/no-go is defensible from the recorded scoreboard (a
      reader can trace the conclusion to the four measured verdicts).
- [ ] The ADR is `Status: Accepted` (per this repo's direct-to-main ADR flow)
      and linked from OQ9 + the ADR index.
- [ ] Spike-light review on the measurement synthesis; the ADR itself carries
      `frame_review: true` and goes through `/jig:adr-workflow`'s own review
      (ADRs are always frame-reviewed).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Primer hygiene: this slice **closes spec 011** — compress the Active-specs
      entry per spec 025 and migrate the load-bearing coherency verdict to the
      status-board Notes column.

**Findings:** _Filled during IN_PROGRESS — the scoreboard._

**Outcome:** _Set at DONE — `ADR-NNNN created; OQ9 coherency axis resolved`._

**Anti-horizontal-phasing check:** after this slice, MVP2 has its precondition
answered — the step-5 capability contract can be frozen (or MVP2 re-shaped)
against a recorded, evidence-backed decision. Observable value: the
**contract-freeze gate** is lifted. (The per-connector isolation upgrade still
waits on the deferred, contract-freeze-constrained B-vs-C decision — that item is
narrowed and carried forward, not lifted here.)

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | _TODO: OQ9 marked RESOLVED with ADR link._ |
| `docs/decisions/README.md` / ADR index | `updated` | _TODO: new resolving ADR indexed._ |
| `docs/decisions/adr-0001-*.md` | `updated` | _TODO: cross-link to the new ADR — its deferred coherency axis is now resolved (ADR-0001 made no forward reservation; the coupling it recorded is amended)._ |
| `docs/architecture.md` | `updated` | _TODO: MVP2 isolation model + sync-access mechanism reflected, if the go path lands one._ |
| `docs/releases/mvp2.md` | `no-op` | _TODO: check whether the go/no-go changes the release plan's cutline/no-gos._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`; Notes carries the coherency verdict._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | _TODO: spec 011 closed — compress Active-specs entry._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
