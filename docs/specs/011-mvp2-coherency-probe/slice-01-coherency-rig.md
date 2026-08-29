---
status: RECONCILED
kind: spike
dependencies: []
last_verified: 2026-08-28
frame_review: true
claimed_by: claude/chambers-io-security-5867f9
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 011-01 — coherency rig + concurrent two-chamber writes

**Goal:** A two-worker coherency proxy modelling the worst-case Option-B topology
— a main-thread broker owning the authoritative cookie jar plus two worker
chambers, each with a sync-cache + async write-back on one shared identity cookie
— runs a concurrent read-modify-write from both chambers and reports whether the
two caches diverge and how wide the incoherency window is.

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
   caches are the **worst-case *coherency* topology** (ADR-0001 Option B — its
   cross-chamber propagation is forced through an async hop); the rig documents
   that a mechanism bounding staleness here bounds it *a fortiori* for Option C
   **on the coherency axis** (C's per-connector sandboxes reach one host authority
   by synchronous in-thread capability-bridge mediation — strictly easier on the
   propagation channel), which is why the rig need not build C. The rig plainly states two scope limits
   (both handed to the 011-03 ADR, per the spec's "What the probe measures"
   section): it makes **no** B-vs-C isolation choice, and it does **not** exercise
   Option C's *read-semantics* (the WASM-sandbox marshal-each-read / unmodified-
   bundle question) — it measures coherency for the Worker topology only.
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
5. **Identity-consuming read surfaces a *correctness* fault, not just a window.**
   [Closes the spec's Assumption 3 — the go/no-go turns on correctness, not a
   latency number.] The rig models an **identity-consuming operation** off the
   cached value: a chamber reads its cached ECID/identity synchronously and
   performs an identity op (e.g. mints or attaches an identity keyed on it), so a
   *stale* read yields an observable, classifiable outcome — a **correctness
   fault** (duplicate / split identity) vs a **benign self-heal** (the stale value
   reconciles before it is consumed). The rig records that classification per
   scenario, not merely the window width. This is the instrument that 011-02's
   positive sources and 011-03's go/no-go reuse; without it the go/no-go rests on
   window width alone, which the spec's Assumption 3 says is insufficient.

**DoD:**
- [x] ACs 1–5 pass; the concurrent-write scenario is reproducible across runs
      (the staleness window is opened deterministically, not flakily).
- [x] The rig's incoherency detector is shown capable of failing both ways: a
      coherent control run (single chamber, or synchronous write-through) reports
      *coherent*; the concurrent async-write-back run reports the divergence.
- [x] The identity-consuming read (AC5) is shown classifying both outcomes: a
      stale read that causes a duplicate/split identity is recorded as a **fault**,
      and a stale read that reconciles before consumption as a **self-heal** — so
      the scoreboard carries correctness verdicts, not just window widths.
- [x] Spike-light review: self-verified against ACs (measurement rig, not
      production runtime — mirrors spec 003's spike-light close-out). Compliance +
      craft passes both recorded `verdict: pass` (`reviews/slice-01-*.md`).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` OQ9 annotated with the in-band finding.

**Findings:**

**Instrument built** (throwaway measurement rig, not runtime — lineage of
`probes/`, extends the `rig/` Playwright realm):
- `rig/coherency.mjs` — the Node rig. Serves the repo tree, drives the harness in
  chromium, self-verifies the fails-both-ways property, writes the scoreboard to
  `rig/out/coherency.json`, exits non-zero if the detector fails to discriminate.
- `rig/coherency-harness.html` — the main-thread **broker**. Owns the authoritative
  jar as a **real first-party `AMCV_TESTORG` cookie** (an `AMCV_*`-shaped
  `MCMID|<ECID>` value, per R-004) in `document.cookie`; creates **two real
  dedicated Worker chambers**; drives a scripted, fully sequenced interleaving.
- `rig/coherency-chamber.worker.js` — a real dedicated Worker chamber. No cookie
  API (R-006 F1); holds one synchronous **cache** in module scope, seeded at boot,
  written back async.
- `rig/coherency-model.mjs` — the deterministic pure core (cache/jar coherence,
  the identity RMW mint-vs-attach, the fault classifier, the staleness-window
  computation, the broker orchestration, the three scenario scripts). Shared
  unmodified by the real Worker **and** the vitest suite.
- `test/coherency-model.test.js` — 22 vitest cases pinning the pure logic + the
  three scenarios hermetically (in-memory chambers, same step logic), including a
  byte-identical two-run determinism check.
- Run: **`npm run rig:coherency`** (wired into `package.json` beside the other
  `rig:*` scripts). Exit 0 = detector discriminated and failed both ways.

**Measured coherency scoreboard** (`rig/out/coherency.json`; reproducible —
byte-identical across two consecutive browser runs, and the in-memory mirror is
byte-identical across runs in vitest). Seed = `MCMID|` (empty-ECID new visitor):

| Scenario (mechanism) | caches ended | jar (real cookie) | coherent? | ECIDs minted | **AC5 correctness** | staleness window |
|---|---|---|---|---|---|---|
| **concurrent-async-writeback** (seed + async write-back, R-006 opt A) | c1=`MCMID\|ECID-c1`, c2=`MCMID\|ECID-c2` | `MCMID\|ECID-c2` (ECID-c1 **lost**) | **NO** (caches disagree, and c1 disagrees with jar) | **2 distinct** (ECID-c1, ECID-c2) | **FAULT — split / duplicate identity** | c2 held the superseded empty value 1 op then **consumed** it into a duplicate mint; c1 holds superseded `ECID-c1` from the last op to end — **open, never reconciled in-page** (`reconciledWithinRun=false`, the lost-update signature) |
| **single-chamber** (control) | c1=`MCMID\|ECID-c1` | `MCMID\|ECID-c1` | YES | 1 | **coherent** (no divergence) | none (`staleReadOccurred=false`) |
| **broker-push** (broker-push invalidation on change, R-006 opt B; control) | c1=c2=`MCMID\|ECID-c1` | `MCMID\|ECID-c1` | YES | 1 | **SELF-HEAL** (benign) | c2 sync-read the stale empty value (window = 2 ops), but broker-push invalidation reconciled it **before** the identity op consumed it → c2 attached the existing ECID instead of minting a duplicate (`reconciledWithinRun=true`) |

**Verdict (in-band coherency axis).** Under the MVP1 seed + async-write-back shim
generalized to two chambers, the two sync-caches **do diverge** under a concurrent
read-modify-write, and — the load-bearing result, per Assumption 3 / AC5 — the
divergence is a **correctness fault, not a benign latency window**: both chambers
read the empty seed, both **mint an ECID**, producing a **duplicate / split
identity** and a lost update in the jar. This is the canonical Adobe identity
fault (two ECIDs for one visitor), reproduced deterministically. Broker-push
invalidation (R-006 opt B) closes it: the same stale read **self-heals** (the
chamber attaches the reconciled ECID rather than minting), and the single-chamber
control is trivially coherent — so the detector **fails both ways** (fault on the
divergent run, coherent/self-heal on both controls), and the authoritative jar
demonstrably lived in the real `document.cookie` on every run. No
SharedArrayBuffer / COOP-COEP (AD-4).

**Window width ≠ correctness (validates Assumption 3 directly).** The measured
numbers make the point the go/no-go rests on: the coherent **broker-push control
has the *wider* staleness window (2 ops)** while the **faulting concurrent run has
the *narrower* one (1 op)**. A narrower window is the fault; a wider window
self-heals. So the correctness verdict — *did a stale read get consumed into a
duplicate identity before it reconciled?* — is the load-bearing signal, exactly as
Assumption 3 requires; window width alone would have mis-ranked these two runs.

**Scope limits stated (handed to the 011-03 ADR).** The rig makes **no** ADR-0001
B-vs-C isolation choice and does **not** exercise Option C's WASM read-semantics
(marshal-each-read / unmodified-bundle); it measures coherency for the Worker
(Option B) topology only. Per the spec's framing this in-band divergence is a
**B-specific discriminator** (the single-thread models event-loop-serialize the
reads) — a real *input* to the deferred model choice, not a premise-threatening
no-go; that interpretation is 011-03's, not asserted here.

**Outcome:** _Set at DONE — e.g. `spec 011-02 unblocked` (rig stands up; the
out-of-band threats extend it)._

**Anti-horizontal-phasing check:** after this slice, running the rig gives a
real, reproducible answer to the simplest coherency threat (two chambers writing
one cookie concurrently) — the comparison floor and the instrument the whole
probe reuses. Observable value, not intermediate state.

### Deviation log (after reconciliation)

The implementation matched the acceptance criteria; the deviations are conformant
choices and over-delivery, not scope changes:

1. **AC3 staleness window measured in op-count, not wall-clock.** AC3 explicitly
   permits "time *or* op-count"; op-count chosen for determinism (byte-identical
   scoreboards). Conformant.
2. **Both coherent controls implemented** (single-chamber *and* broker-push
   write-through). The DoD's fails-both-ways clause needs only one coherent control,
   but the AC5 clause ("shown classifying both outcomes … self-heal") requires a
   *self-heal* scenario, which only broker-push provides — so this is
   required-and-also-strengthening, not pure over-delivery. It is also what makes
   the window-width ≠ correctness result measurable (broker-push control's *wider*
   window vs the fault's narrower one).
3. **AC1 location `rig/coherency.*` chosen** (AC1 offered `probes/coherency/` *or*
   `rig/coherency.*`) — extends the existing `rig/` Playwright realm for consistency
   with `rig/isolation.mjs` et al. Allowed option.
4. **`rig/out/coherency.json` is gitignored** (a regenerated measurement artifact,
   like the rest of `rig/out/`). AC3's "JSON to `rig/out/`" is satisfied at runtime;
   the durable recorded verdict lives in the Findings (AC4). Decision: keep it
   gitignored — a re-derivable probe output, not source.
5. **Two craft nits logged forward to 011-02** (latent traps, not defects here —
   both confirmed benign: the compliance reviewer re-ran the rig, byte-identical):
   (a) `coherence()` treats an *absent* cache as "agrees" — tighten to treat a
   missing cache as incoherent when 011-02 adds out-of-band writers that can leave a
   cache absent; (b) the "byte-identical across two *browser* runs" claim is a manual
   observation (only the in-memory determinism is machine-enforced) — 011-02 could
   make it executable by re-running the browser scenarios once.
6. **Rule-of-three refactor tracked forward (craft review):** the static-server
   block (http server + MIME map + `startsWith(ROOT)` guard) is now duplicated
   across `rig/coherency.mjs`, `rig/isolation.mjs`, and `rig/e2e.mjs`. A shared
   `rig/serve.mjs` helper is worth extracting; out of scope for this slice
   (prophylactic here), parked for a future rig-hygiene pass.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | OQ9 annotated with the in-band coherency finding: concurrent RMW under seed+async-write-back diverges into a reproducible split-identity **fault**; broker-push invalidation self-heals it; window-width ≠ correctness. Recorded as a B-specific discriminator input to the deferred model choice — the full go/no-go is 011-03's. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board`. |
| `docs/architecture.md` | `no-op` | Throwaway probe rig; no module-boundary/contract change (the resolving ADR lands in 011-03). |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR this slice (resolving OQ9 ADR is 011-03). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Checked — spec 011 is not closed (011-02/03 remain), so the Active-specs entry stays as-is. |
| `docs/memory/**` | `no-op` | The load-bearing learning (window-width ≠ correctness; broker-push self-heals the split-identity fault) is captured in the Findings and feeds the 011-03 scoreboard/ADR — repo-recorded; no separate memory file needed. |
