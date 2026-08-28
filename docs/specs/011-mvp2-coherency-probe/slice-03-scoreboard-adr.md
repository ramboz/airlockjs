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
2. **Go/no-go recorded.** The spec records an explicit conclusion: **go** (an
   AD-4-compatible sync-access mechanism bounds the unavoidable staleness to an
   acceptable level for shared identity — name it) or **no-go** (it does not —
   trigger the Kill-criterion escalation: AD-4-exception-via-ADR /
   single-shared-worker fallback / re-shape MVP2 scope). The verdict must be
   framed as a *correctness* judgment on shared identity, not merely a window
   width (per the spec's third assumption).
3. **Resolving ADR written and accepted.** A dedicated ADR (next free number, via
   `/jig:adr-workflow`) records the decision, resolving OQ9 along the **division
   of labor** the spec's "What the probe settles" section fixes — the ADR must
   not overclaim a probe-grounded isolation verdict:
   - **(a) Sync-access mechanism** — chosen from
     [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md)'s
     named options (seed + async write-back / broker-push invalidation on
     `cookieStore` `change` / single-shared-worker; per-read marshalling ruled
     out within AD-4), **grounded in the probe's measured evidence**.
   - **(b) Per-connector isolation viability** — **probe-gated**: does any
     per-connector isolation survive (go), or must MVP2 retreat to a single
     shared worker (no-go), dropping cross-connector confidentiality.
   - **(c) Isolation model B-vs-C**, on a go — resolved on **ADR-0001's recorded
     non-coherency tradeoffs** (unmodified-stock-bundle → Option B over Option
     C's per-read marshalling), *explicitly not* on probe coherency evidence,
     which does not discriminate B from C. The ADR states this grounding
     honestly.
   The ADR supersedes ADR-0001's forward-commitment on this point and cites this
   spec's scoreboard.
4. **OQ9 marked RESOLVED.** `docs/refinement-todo.md` OQ9 is struck through /
   marked RESOLVED with a link to the new ADR, mirroring the OQ10→ADR-0004
   resolution convention.

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

**Outcome:** _Set at DONE — `ADR-NNNN created; OQ9 resolved`._

**Anti-horizontal-phasing check:** after this slice, MVP2 has its precondition
answered — the step-5 capability contract can be frozen (or MVP2 re-shaped)
against a recorded, evidence-backed decision. Observable value: the gate that
was blocking all downstream MVP2 work is lifted.

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | _TODO: OQ9 marked RESOLVED with ADR link._ |
| `docs/decisions/README.md` / ADR index | `updated` | _TODO: new resolving ADR indexed._ |
| `docs/decisions/adr-0001-*.md` | `updated` | _TODO: forward-commitment superseded / cross-linked to the new ADR._ |
| `docs/architecture.md` | `updated` | _TODO: MVP2 isolation model + sync-access mechanism reflected, if the go path lands one._ |
| `docs/releases/mvp2.md` | `no-op` | _TODO: check whether the go/no-go changes the release plan's cutline/no-gos._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`; Notes carries the coherency verdict._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | _TODO: spec 011 closed — compress Active-specs entry._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
