---
status: DRAFT
dependencies: [adr-0001]
last_verified:
arch_review: true
frame_review: true
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
- [ ] All ACs pass; `npm run rig:isolation` green; full suite green (`npm test`).
- [ ] The isolation assertion is shown to go green (fail-to-fail) if the DOM
      dereference were removed — i.e. it genuinely asserts the realm failure,
      then is restored (mutation-tested; **use Edit/perl to restore, never
      `git checkout --`** — working-tree slice state is ahead of the committed
      baseline).
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

**Anti-horizontal-phasing check:** After this slice, the chamber's no-DOM
guarantee is a runnable rig anyone can invoke (`npm run rig:isolation`) and
that 07-05 gates CI on — a real isolation-strength regression in a browser
realm is caught, faithfully, rather than by a Node test that never exercised
the boundary.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
