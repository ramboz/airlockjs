---
status: DRAFT
dependencies: [015-01]
last_verified:
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 015-02 — hold-and-alert observability

**Goal:** Make a config-integrity deviation **observed**, not silently corrected. 015-01's override
neutralizes a re-route by forcing the host datastream — but a silent correction hides an active
attack. This slice surfaces every deviation (**override applied** on a mismatch, or **held** on
absent/duplicate) through the existing **009-02 diagnostics seam** (`onDiagnostic`, the single
severity-differentiated sink `core/airlock.js` already routes chamber drops/errors through), so the
operator (and the future OQ7 inspector) can see that a chamber tried to re-point its datastream.

**DoR:**
- ✅ [015-01] DONE — the config-integrity check + override are wired into the dispatch seam; the
  `checkConfigIntegrity` verdict (`hold` / the deviation reason) is computed at the seam.
- ✅ The diagnostics seam exists: `core/airlock.js`'s `onDiagnostic` / `consoleDiagnostic` (009-02) —
  a `{ level, kind, … }` record sink, severity-differentiated (warn vs error). The wrapped-SDK host
  path can reach the same injected sink.

**Acceptance Criteria:**

1. **A deviation emits a diagnostic.** When the seam **overrides** a mismatched `configId` or **holds**
   an absent/duplicate one, a diagnostic record is emitted through the `onDiagnostic` sink —
   `{ kind: "config-integrity", … }` naming the deviation (override-applied vs held) + its reason
   (mismatch / pollution / absent), **without** the raw identifier values (the pinned/attacker
   datastreams are not logged — redaction discipline, 013-01). Observable: a re-pointed chamber
   produces exactly one config-integrity diagnostic per deviating dispatch.
2. **The honest path is silent.** A matching `configId` (allow) emits **no** config-integrity
   diagnostic — the seam only speaks on a deviation. Observable: no diagnostic on the honest path.
3. **Severity is correct.** An **override** (corrected + sent) is a lower severity than a **hold**
   (blocked) — mirror 009-02's warn-vs-error differentiation (a re-route *attempt* corrected is
   `warn`; a fail-closed hold is `warn`/`error` per the seam's judgement). Observable: the diagnostic
   `level` distinguishes override from hold.

**DoD:**
- [ ] ACs 1–3 pass — a re-pointed chamber emits a config-integrity diagnostic (override / held); the
      honest path is silent; no raw identifiers in the record.
- [ ] **No regression** — 015-01's enforcement + the full suite stay green.
- [ ] Reviews: compliance + craft recorded pass (spike-light — observability wiring; no new arch seam).
- [ ] Deviation log + reconciliation sweep; `docs/refinement-todo.md` OQ7 (inspector) noted as fed by
      this diagnostic.
- [ ] **No live identifiers committed** — the diagnostic redacts the datastream values.

**Anti-horizontal-phasing check:** after this slice, a config-integrity re-route attempt is
**operator-visible** (a diagnostic), not a silent correction — the "held at the seal" story is real.
Observable value: a re-pointed chamber surfaces a diagnostic naming the deviation.
