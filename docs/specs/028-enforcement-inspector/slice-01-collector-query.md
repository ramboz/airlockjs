---
status: DRAFT
dependencies: []
last_verified:
# arch_review: true  # the collector is a new read-surface over the onDiagnostic
#                    # seam; if slice-01 pins a queryable record/query shape as a
#                    # public contract, flip this on for the arch-review pass.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (ADR-0020): claims about runnable surfaces are probe-backed
     (the 21 diagnose() emit sites + the onDiagnostic seam, enumerated in spec.md
     § Overview) or marked as assumptions in spec.md § Assumptions. -->

## Slice 028-01 — the decision-stream read-layer + query

**Goal:** A bounded in-memory **collector**, wired as the existing `onDiagnostic` sink, captures every
enforcement-decision record (`{ level, kind, disposition, ...context }`) the runtime already emits, and a
**query API** lets a developer retrieve + filter the enforcement-decision stream (by `kind` / `disposition` /
`purpose`). Pure read over the already-structured 009-02 records — zero new instrumentation, zero
interaction-path cost. End-to-end value: a developer can ask *"show me every beacon held at the seal / gated /
stripped / dropped this session"* and get a real answer instead of scrolling console noise.

**DoR:**
- ✅ The `onDiagnostic` DI seam exists in `core/airlock.js`, `core/wrapped-sdk-host.js`, and
  `adapters/eds/dom-apply.js`, defaulting to `consoleDiagnostic` (grounded — spec.md § Overview, 21 emit
  sites enumerated).
- ✅ Risk-First grounding recorded (inspector = read-layer): spec.md § Overview.
- ✅ Frame-critique passed (spec carries `frame_review: true`) — the read-layer premise, the worker-forwarding
  residual, and the zero-INP-cost claim adversarially checked before implementation.
- ☐ Collector bound (ring capacity) + the query filter surface confirmed (proposed in AC3/AC2 below).

**Acceptance Criteria:**

1. **The collector captures records via `onDiagnostic`.** A new inspector collector (e.g.
   `core/inspector/collector.js` — `createInspectorCollector()` returning `{ onDiagnostic, query, ... }`),
   injected as the `onDiagnostic` sink on `createAirlock`, captures every emitted record into a queryable
   buffer. A beacon that is **held** (consent pending), **dropped** (strict/unload), **held at the ceiling**,
   or has a field **stripped** produces the corresponding record in the collector — observed via the query
   API, not merely via `console`. Exercised against real emit paths for `consent`, `endpoint-ceiling`,
   `payload-governance`, and `dropped`.
2. **The query API filters by `kind` / `disposition` / `purpose`.** `query({ kind: "consent" })` returns only
   consent records; `query({ disposition: "held" })` only holds; multiple keys AND together; an empty/absent
   filter returns the full stream in **emission order**. Records are returned as plain data (a copy or
   read-only view — a caller mutating a result never corrupts the buffer).
3. **The buffer is bounded — no unbounded growth.** The collector caps at a documented capacity `N`
   (drop-oldest ring); inserting the `N+1`-th record evicts the oldest; insert is **O(1)**. A test drives
   `> N` records and asserts the cap holds and the newest survive.
4. **Zero interaction-path cost.** Wiring the inspector does **not** change the capture / `push()` / projection
   code path (it is byte-identical with vs without the collector injected — the collector is only ever reached
   through `onDiagnostic`, off the hot path). Observable: a regression test pins that `push()` + the projection
   fold never call the collector, and the collector's own work is O(1) append.
5. **Console default preserved (additive, back-compat).** With no collector injected, `onDiagnostic` still
   defaults to `consoleDiagnostic` — existing 009-02 behaviour byte-identical. The inspector is purely
   additive; no existing test changes behaviour.
6. **No PII amplification.** The collector stores the **same redacted records** the 009-02 stream already
   emits — it adds no un-redacted context. A stripped field's *value* is never captured (the
   `payload-governance` record carries the field *name* only, per its existing shape); the collector must not
   widen that. A test feeds a `payload-governance stripped` record and asserts no stripped value is retained.

**DoD:**
- [ ] All ACs pass; full real-repo test suite green (no regressions; the stale `.claude/worktrees/*` copy is
      excluded — known noise, see spec 025 memory).
- [ ] Implementer test coverage exercises each AC with at least one fixture (real emit-path records for
      consent/ceiling/payload-governance/dropped).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` subagent (prompt built by `review.py`); compliance + craft passes.
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced under this slice heading; reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** after this slice, a developer can query the live enforcement-decision stream
("every held/gated/stripped/dropped beacon this session") — a usable inspector read-layer, shippable on its
own. Not intermediate state for slice-02.

### Deviation log (after reconciliation)

_TODO during IN_PROGRESS._

### Reconciliation sweep

_TODO during reconciliation._
