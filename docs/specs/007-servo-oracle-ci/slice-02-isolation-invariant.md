---
status: RECONCILED
dependencies: [adr-0001]
last_verified: 2026-08-27
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)

> **Reframed 2026-08-27 (07-02 frame-critique).** The original plan — a
> hermetic Node/vitest test that a connector touching `document` throws — is
> **vacuous**: Node has no `document` regardless of the chamber, so the throw
> would happen even with the airlock removed, and MVP1's chamber statically
> imports one pure function ([chamber.worker.js](../../../core/chamber.worker.js)
> `import { mapToMp }`) with no arbitrary-connector-loading seam. The chamber's
> no-DOM guarantee is a **browser-Worker realm property**, so a *faithful*
> assert must run in a real Worker, not Node. This slice is reclassified from
> hermetic/servo-unattended to a **real-Worker browser rig**, gated in browser
> CI (07-05) — not a `COMPONENTS` entry in `oracle.sh`.

**Goal:** Build a runnable **real-Worker** rig that proves the chamber's no-DOM
isolation is a realm property — code that dereferences `document`/`window`
fails inside an actual browser Worker, while the chamber's real message path
(pure mapping) runs to completion. Deliver it as a rig (e.g.
`rig/isolation.mjs`, `npm run rig:isolation`) that 07-05 wires into browser CI
as a **gating** check.

**DoR:**
- ✅ `/servo:scaffold-init` has run (spec.md A1).
- ✅ ADR-0001 (chamber isolation strength) is accepted — the invariant under
  test is the plain-Worker no-DOM boundary it pins.
- ✅ The existing browser rigs run locally (`npm run rig:uc1`) — this rig
  reuses the Playwright/chromium + local-`http.createServer` harness *pattern*
  ([rig/uc1.mjs](../../../rig/uc1.mjs)), but **diverges** from uc1's setup: it
  needs **no `npm run build`** and does not serve a testbed root. Instead it
  serves the repo **source tree** (`core/` + `connectors/`) with a JS MIME type
  and loads a small **wrapper entry module** (`rig/isolation-probe.worker.js`)
  as the `{type:"module"}` Worker — the wrapper `import`s the unmodified
  `chamber.worker.js` (see AC1), which with its one import
  (`connectors/ga4/map.js`, a pure ES module) is loadable unbundled, so no
  esbuild two-entry step is required (07-02 re-review, attack (a) confirmed).

**Acceptance Criteria:**

1. **A BARE `document`/`window` reference throws `ReferenceError` — in the
   chamber's own realm.** The mechanism (07-02 re-review): a small **wrapper
   entry module** — e.g. `rig/isolation-probe.worker.js`, loaded as the
   `{type:"module"}` Worker — `import`s the **unmodified**
   `core/chamber.worker.js` (so the shipped chamber's `self.onmessage` registers
   for AC2's mapping) and then makes a **bare, unqualified** reference to
   `document` (or `window`) in the shared `WorkerGlobalScope`, asserting it
   throws `ReferenceError`. Because all ES modules loaded into one Worker share
   a single global realm, the throw runs in the **exact realm that runs
   `mapToMp`** — with **no edit to the shipped chamber** (the two broken
   alternatives — editing `chamber.worker.js`, or loading it directly with
   nowhere to inject — are both avoided). Two constraints are load-bearing:
   - **Bare reference, not `typeof`/`self.document`.** A bare `document` throws
     `ReferenceError` in Worker scope but *not* on a DOM-bearing main thread —
     so it is realm-**discriminating**. `typeof document` / `self.document`
     yields `undefined` even in Node, which is realm-**independent** and would
     re-import the vacuousness this reframe exists to kill. The assertion MUST
     be the throwing bare-reference form; the `undefined` form is forbidden.
   - **Same realm as the chamber.** The dereference must run in the realm that
     actually runs `mapToMp`, so the pass line reads "the realm that ran the
     chamber is the realm where `document` throws" — asserting the airlock's
     placement choice, not merely "some Worker lacks DOM."

   Observable: the rig prints a pass line and exits `0`.
2. **The chamber's real path runs to completion in that same realm.** The
   chamber's actual message path (the pure `mapToMp` mapping over a sample
   event, init → events → `{ready}`) runs in **that same Worker** and produces
   its expected MP-shaped output — so the rig discriminates (it is not vacuously
   failing on all Worker code) and it exercises the *shipped* chamber in the
   *same realm* AC1 probes, not an invented seam. Observable: the positive-control
   assertion passes in the same run.
3. **The assert is a gating browser check, not a hermetic oracle component.**
   The rig exits non-zero on an isolation failure (like [rig/uc1.mjs](../../../rig/uc1.mjs)),
   so 07-05 can gate CI on it. It is **not** registered in `oracle.sh`'s
   `COMPONENTS` array (it is not hermetic/servo-unattended; spec.md routing
   table). Observable: `npm run rig:isolation` exit code; `oracle.sh` is
   unchanged by this slice.

**Scope note (MVP1 vs MVP2).** This asserts the *realm* guarantee for the
chamber as it ships in MVP1 (one pure first-party mapping function). The
stronger "an **arbitrary/untrusted** connector that touches the DOM is
contained" guarantee is load-bearing only when a chamber runs untrusted vendor
JS (alloy / wrapped-SDK archetype, OQ1 / ADR-0001) — that is an MVP2 concern
and is explicitly out of scope here; there is no arbitrary-connector seam to
exercise in MVP1.

**DoD:**
- [x] All ACs pass; `npm run rig:isolation` green (exit 0: AC1 `ReferenceError`
      + AC2 mapping); full suite green (`npm test` — 119 tests).
- [x] The isolation assertion is shown to go green (fail-to-fail) if the DOM
      dereference were removed (probe `document;` → `self;` → rig exits 1), then
      restored via Edit (never `git checkout --`).
- [x] Reviewed by `reviewer` subagent (compliance pass + craft pass + arch pass;
      the shared teardown nit was fixed post-review).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] No decision deferred; `oracle.sh`/`.servo/` deliberately untouched (AC3).

**Anti-horizontal-phasing check:** After this slice, the chamber's no-DOM
guarantee is a runnable rig anyone can invoke (`npm run rig:isolation`) and
that 07-05 gates CI on — a real isolation-strength regression in a browser
realm is caught, faithfully, rather than by a Node test that never exercised
the boundary.

### Deviation log (after reconciliation)

The original ACs are preserved above. What changed / notable choices:

1. **Rig diverges from `rig/uc1.mjs` by design.** `rig/isolation.mjs` serves the
   repo **source tree** (`core/` + `connectors/` + `rig/`) with a JS MIME via
   `http.createServer` and loads the wrapper as a `{type:"module"}` Worker with
   **no `npm run build`** and **no CSP header** — unlike uc1, which builds and
   serves a testbed root. Future readers should not expect uc1 parity; the
   divergence is what makes the rig exercise the unbundled shipped chamber
   directly.
2. **Teardown hardened post-review (craft + arch nit, fixed).** The first cut
   called `browser.close()`/`server.close()` only on the happy path; a
   `page.evaluate` rejection (10s timeout / worker error) skipped them (process
   still exited non-zero — no CI hang, Playwright's pipe-close reaps chromium —
   but a dangling browser leaked). Wrapped the `page.evaluate` in
   `try/catch/finally` so teardown runs on every path, plus a machine-readable
   `FAIL — <message>` JSON line on the error path. Re-verified: `npm run
   rig:isolation` still exits 0.
3. **`/package.json` as the same-origin carrier (cosmetic).** The page navigates
   to the served `/package.json` purely to establish the origin the module
   Worker fetches against — no HTML testbed needed, none of its content read.
   A served empty HTML / `data:` URL would read marginally cleaner; kept as-is
   (harmless, file guaranteed present at root).
4. **MVP1 scope boundary (confirmed, not a gap).** The rig constructs the Worker
   itself, so it proves "when the chamber is loaded into a Worker, the no-DOM
   property holds in the same realm as `mapToMp`." It does **not** verify that
   the production orchestrator places the chamber in a Worker (that wiring lives
   elsewhere) — consistent with the MVP1 scope note; arbitrary/untrusted-connector
   isolation is deferred to MVP2 (OQ1 / ADR-0001).
5. **07-05 handoff.** The gating contract is `npm run rig:isolation` → exit 0
   (pass) / 1 (fail); it requires Playwright/chromium and a browser-CI runner
   (not hermetic) and **must not** be added to `oracle.sh` `COMPONENTS`. 07-05
   already lists `rig:isolation` among its gating browser checks (its DoR +
   AC1/AC2).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Adds a browser rig; project front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated by `workflow.py status-board` as the **final close-out step** (post-`DONE`), per the standard slice-close sequence (RECONCILED → commit → DONE → regen). It legitimately lags the slice status until then — do not read the mid-close lag as drift. |
| `docs/product-vision.md` | `no-op` | No product-scope/behavior change. |
| `docs/architecture.md` | `no-op` | No module-boundary/public-contract change; the rig depends on `core/` one-way and does not alter the chamber. The isolation-routing (browser-CI, not servo-unattended) is recorded in the spec routing table + the 07-03 oracle-design ADR, not an architecture.md edit. |
| `oracle.sh` / `.servo/` | `no-op` | Deliberately untouched (AC3) — isolation is a browser-CI gate, not a hermetic `COMPONENTS` entry. Verified `git diff --stat oracle.sh .servo/` empty. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 still in flight (03/04/05 open); no close-out compression. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` / `.servo/refinement-todo.md` | `no-op` | No new deferral; nothing resolved by this slice. |
| `docs/specs/007-servo-oracle-ci/slice-05-ci-browser.md` | `no-op` | Already lists `rig:isolation` as a gating browser check (its DoR + AC1/AC2 from the earlier reframe); no edit owed. |
| `docs/decisions/**` / ADR index | `no-op` | No ADR-worthy decision here; the isolation reclassification was already routed to the 07-03 oracle-design ADR. |
| `docs/memory/**` | `no-op` | The module-Worker-shared-realm technique is captured in this slice + reviews; not separately memory-worthy. |
