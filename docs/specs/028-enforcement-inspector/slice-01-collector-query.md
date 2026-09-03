---
status: DONE
dependencies: []
last_verified: 2026-09-03
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

**Goal:** A bounded in-memory **collector**, wired as **one shared instance on all three `onDiagnostic` seams**
(`createAirlock`, `createWrappedSdkHost`, `createDomApplyCoordinator` — the frame-critique correction, so
`config-integrity` and the whole alloy/wrapped-SDK path are not blind spots), captures every
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
- ✅ Collector bound + query filter surface confirmed: ring capacity **default 500** (drop-oldest,
  caller-overridable via `createInspectorCollector({ capacity })`); query filters `kind` / `disposition` /
  `purpose` (AND). (AC2/AC3.)

**Acceptance Criteria:**

1. **One shared collector captures records from all three `onDiagnostic` seams.** A new inspector collector
   (e.g. `core/inspector/collector.js` — `createInspectorCollector()` returning `{ onDiagnostic, query, ... }`),
   its single `onDiagnostic` function injected as the sink on **`createAirlock`, `createWrappedSdkHost`, AND
   `createDomApplyCoordinator`** (three wire points into one instance), captures every emitted record into a
   queryable buffer. A beacon that is **held** (consent pending), **dropped** (strict/unload), **held at the
   ceiling**, has its datastream **config-integrity**-held/overridden, or has a field **stripped** produces the
   corresponding record — observed via the query API, not merely via `console`. Exercised against real emit
   paths for **all three hosts**: `consent` / `endpoint-ceiling` / `payload-governance` / `dropped`
   (`airlock.js`), **`config-integrity`** and the wrapped-SDK `consent`/`endpoint-ceiling` (`wrapped-sdk-host.js`),
   and the **`dom-apply-*`** family (`dom-apply.js`). A `createAirlock`-only wiring — blind to `config-integrity`
   (one of the named teeth) — is explicitly a FAIL of this AC.
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
- [x] All ACs pass; full real-repo test suite green (**70 files / 918 tests**, worktree excluded; 13 new). No
      regression to the host suites — purely additive `core/inspector/`, no host file modified.
- [x] Test coverage exercises each AC with a fixture — **real** emit-path records for consent / endpoint-ceiling /
      dropped / **config-integrity** (wrapped-sdk-host) / **payload-governance** (a real `governParams` strip via
      `pushCritical`) / dom-apply-unknown-id.
- [x] Each new test shown to fail when its feature is removed — a capture-disable mutation turned **8/13 red**
      (the 4 survivors correctly don't depend on capture); restored.
- [x] Reviewed by independent reviewer (prompt built by `review.py implementation`); **compliance PASS + craft PASS**.
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] No decisions deferred (the shallow-copy/flat-record follow-up is an `inbox` parked item, not a decision).

**Anti-horizontal-phasing check:** after this slice, a developer can query the live enforcement-decision stream
("every held/gated/stripped/dropped beacon this session") — a usable inspector read-layer, shippable on its
own. Not intermediate state for slice-02.

### Deviation log (after reconciliation)

1. **The three-seam correction (frame-critique, load-bearing).** The slice was drafted assuming "one collector
   wired on `createAirlock`." The pre-implementation frame-critique caught that `onDiagnostic` is **three
   separate constructor injectables** — a `createAirlock`-only collector is blind to 11 of 21 emit sites,
   including **every `config-integrity` decision** (which emits from `createWrappedSdkHost` alone). The Goal,
   AC1, spec § Overview/§ Assumptions, and slice-02's scope were corrected to **one shared collector on all
   three constructors**, and AC1's tests drive real `config-integrity` from wrapped-sdk-host as the
   blind-spot-closed proof. The residual the spec *originally* flagged (worker-side `diagnose()` going
   console-only) was verified **benign** — `core/chamber.worker.js` calls `diagnose()` zero times; drops cross
   via `postMessage`→`airlock.js:268`, crashes via `worker.onerror`→`airlock.js:280`.
2. **Real `payload-governance` emit added (compliance-review follow-up).** Initial coverage used a synthetic
   unit record; the DoD asked for a real emit path. Added a test driving a real `governParams` strip via
   `handle.pushCritical({ payloadDenylist:["email"] })` — asserts the field NAME lands and the value never does.
3. **Flat-record invariant made explicit (craft-review follow-up).** The buffer isolation is a *shallow* copy;
   the reviewer noted this is sufficient only because every 009-02 record is flat (primitive values). Added a
   `FLAT-RECORD INVARIANT` comment in `collector.js` stating the assumption + the deep-copy trigger, and an
   `inbox` follow-up — turning a latent gap into a deliberate, documented choice.
4. **AC4 strengthened non-vacuously.** Added a paired control (the same wired instance captures a real
   `endpoint-ceiling` → `size()===1`) so the clean-dispatch `size()===0` proves "clean path emitted nothing,"
   not "collector unwired."
5. **New leaf module, purely additive.** `core/inspector/collector.js` is a new directory + module wired by the
   caller (and the tests) via the pre-existing `onDiagnostic` seam; **no host file was modified** — which is
   what makes the AC5 "additive, no existing behaviour changed" claim hold by construction. `arch_review` was
   left off: no existing module boundary or public contract changed (the seam pre-existed); the queryable
   record/query shape is a new *read* surface, revisited if slice-02/03 pin it as an external contract.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Project front door untouched — an internal diagnostics read-layer, no user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (028-01 → DONE). |
| `docs/product-vision.md` | `no-op` | The inspector **resolves OQ7**, but OQ7 lives in § Open questions and the spec is not yet complete (02/03 pending) — the vision OQ7 update is deferred to spec close (per the 025-01 primer-hygiene-on-spec-close rule). No use-case / scope drift from this slice. |
| `docs/architecture.md` | `no-op` | Additive new leaf module (`core/inspector/`); no existing module boundary or public contract changed — the `onDiagnostic` seam pre-existed (`airlock.js:32` reserved it for exactly this). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Slice-01 does not close the spec (02/03 DRAFT) — primer hygiene deferred to spec close. |
| `docs/inbox.md` | `updated` | Parked the shallow-copy/flat-record deep-copy follow-up (craft-review note). |
| `docs/refinement-todo.md` | `no-op` | No deferred *decision* — the follow-up is an inbox parked observation, not a decision. |
| `docs/memory/**` | `no-op` | Nothing cross-session worth capturing beyond the spec/reviews themselves. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched (the frame-critique corrected the frame; ADR-0014's discipline unaffected). |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** The slice delivers its
anti-horizontal value (a developer can query the live enforcement-decision stream from one instance across all
three seams); the frame-critique's load-bearing correction is folded in and proven by the config-integrity test;
both gating passes are PASS; the one forward-looking risk (nested-record deep-copy) is documented + parked, not
silently dropped. No orphans. Ready RECONCILED → DONE.
