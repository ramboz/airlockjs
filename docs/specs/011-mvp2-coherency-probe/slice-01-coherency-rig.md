---
status: DRAFT
kind: spike
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 011-01 — coherency rig + concurrent two-chamber writes

**Goal:** A model-agnostic two-worker coherency proxy — a main-thread broker
owning the authoritative cookie jar plus two worker chambers, each with a
sync-cache + async write-back on one shared identity cookie — runs a concurrent
read-modify-write from both chambers and reports whether the two caches diverge
and how wide the incoherency window is.

**Question:** Under async write-back, do two chambers' sync-caches of a shared
identity cookie diverge when both write concurrently, and how wide is the window
during which a chamber reads a stale value?

**Time-box:** ~1 day. Build the smallest rig that opens a discriminating
staleness window on demand — the instrument the rest of the spec measures with.

**DoR:**
- ✅ [R-004](../../research/R-004-alloy-in-worker.md) (single-chamber sync-cache
  shim proven) and the `rig/` Playwright realm (`rig/isolation.mjs`,
  `rig/e2e.mjs`) exist as the pattern to extend.
- ✅ [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md)
  (mechanism survey) fixes the rig's architecture: the authoritative jar lives
  on the broker only (chambers have no cookie API), and the probe measures
  broker↔cache freshness, not a shared-memory race.
- ✅ [ADR-0001](../../decisions/adr-0001-chamber-isolation-strength.md) records
  the coupled B-vs-C + sync-access question this probe resolves.

**Acceptance Criteria:**

1. **Two-worker coherency proxy (models the worst-case Option-B topology).** A rig
   under `probes/coherency/` (or `rig/coherency.*`) stands up a main-thread
   **broker** holding the authoritative jar (the real `document.cookie`) and
   **two** worker chambers, each seeded at boot with a sync-cache of one shared
   first-party identity cookie (`AMCV_*` / `kndctr_*`-shaped value, per R-004)
   and writing back to the broker asynchronously. The two separate cross-thread
   caches are the **worst-case coherency topology** (ADR-0001 Option B); the rig
   documents that a mechanism bounding staleness here bounds it *a fortiori* for
   Option C (sandboxes sharing one realm/cache — strictly easier), which is why
   the rig need not build C — per the spec's "What the probe settles" decoupling
   argument. The rig makes **no** B-vs-C isolation choice; it measures whether
   the mechanism holds for the hardest topology.
2. **Concurrent in-band write scenario.** The rig drives a concurrent
   read-modify-write of the shared cookie from **both** chambers (each reads the
   current value synchronously from its cache, mutates it, writes back), with the
   interleaving controllable so the race is reproducible, not incidental.
3. **Coherency verdict is observable.** After the scenario, the rig reports —
   retrievable programmatically (e.g. on `window` or as JSON to `rig/out/`) —
   whether the two caches ended coherent with each other and with the
   authoritative jar, and the measured **staleness window** (time or op-count
   during which a chamber's synchronous read returned a value already superseded
   in the jar).
4. **Verdict recorded.** Running the rig yields a concrete result — divergence
   observed (with window width) or not — captured in this slice's Findings.

**DoD:**
- [ ] ACs 1–4 pass; the concurrent-write scenario is reproducible across runs
      (the staleness window is opened deterministically, not flakily).
- [ ] The rig's incoherency detector is shown capable of failing both ways: a
      coherent control run (single chamber, or synchronous write-through) reports
      *coherent*; the concurrent async-write-back run reports the divergence.
- [ ] Spike-light review: self-verified against ACs (measurement rig, not
      production runtime — mirrors spec 003's spike-light close-out;
      `JIG_REVIEW_EVIDENCE_GATE=0` noted if used for transitions).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` OQ9 annotated with the in-band finding if it
      moves the go/no-go.

**Findings:** _Filled during IN_PROGRESS._

**Outcome:** _Set at DONE — e.g. `spec 011-02 unblocked` (rig stands up; the
out-of-band threats extend it)._

**Anti-horizontal-phasing check:** after this slice, running the rig gives a
real, reproducible answer to the simplest coherency threat (two chambers writing
one cookie concurrently) — the comparison floor and the instrument the whole
probe reuses. Observable value, not intermediate state.

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | _TODO: OQ9 annotated with the in-band coherency finding, or explain why deferred to 011-03._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/architecture.md` | `no-op` | _TODO: probe rig, no module-boundary/contract change (the ADR lands in 011-03)._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: no ADR this slice (resolving ADR is 011-03)._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: checked._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
