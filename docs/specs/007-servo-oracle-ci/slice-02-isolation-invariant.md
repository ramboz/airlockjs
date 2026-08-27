---
status: DRAFT
dependencies: [adr-0001]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-02 — `isolation_invariant` oracle component (build the structural assert)

**Goal:** Build the asserting test that a connector which touches `document`
(or another DOM/ambient global) **throws** inside the chamber, and wire it as
the servo-unattended `isolation_invariant` oracle component — turning the
chamber's structural no-DOM property ([chamber.worker.js:12](../../../core/chamber.worker.js),
ADR-0001) from documented intent into an enforced, runnable invariant.

**DoR:**
- ✅ `/servo:scaffold-init` has run (spec.md A1).
- ✅ ADR-0001 (chamber isolation strength) is accepted — the invariant under
  test is the plain-Worker no-DOM boundary it pins.

**Acceptance Criteria:**

1. **A connector touching `document` throws in the chamber.** A test loads a
   deliberately-bad connector that references a DOM/ambient global
   (`document`, `window`) into the chamber execution path and asserts it
   throws (e.g. `ReferenceError`) — proving the isolation is structural, not a
   discipline. Observable: a passing assertion in `npm test`.
2. **A clean connector is unaffected.** A DOM-free connector runs to completion
   in the same path, so the test discriminates (it is not vacuously throwing on
   all input). Observable: the positive-control assertion passes.
3. **The check is wired as a gating oracle component.** `isolation_invariant`
   is registered in `oracle.sh` (and `.servo/` metadata) as a
   servo-unattended, blocking component that runs this test; a regression that
   somehow exposed `document` to the chamber would flip the oracle verdict to
   fail. Observable: the component's verdict line and exit code.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`).
- [ ] The negative-control test is shown to go green (fail-to-throw) if the
      isolation were removed — i.e. it genuinely asserts the throw, then is
      restored (mutation-tested; **use Edit/perl to restore, never
      `git checkout --`** — working-tree slice state is ahead of the committed
      baseline).
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

**Anti-horizontal-phasing check:** After this slice, the chamber's "no
connector can touch the DOM" guarantee is a runnable gate — a real regression
in isolation strength is caught automatically, not by hoping a reviewer notices.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
