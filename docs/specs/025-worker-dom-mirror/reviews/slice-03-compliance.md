---
slice: 025-03 — a real tag (Prism) through the mirror: `innerHTML` + a sanitized apply, INP-measured
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T04:45:41Z
prompt_source: review.py compliance docs/specs/025-worker-dom-mirror/spec.md 'real tag'
---

**Verdict: PASS.**

Compliance pass over slice 025-03 (real tag Prism + sanitized `innerHTML` apply) against jig authoring
conventions and the slice's own DoR/AC/DoD contract.

- **Grounding (ADR-0020 §1–§2):** load-bearing claims are probe-backed. The AC4 net-regression numbers
  (naive p75 = 11.5ms, governed p75 = 24.1ms) are orchestrator-re-run, not asserted. The AC7
  backpressure grounded-deferral cites RUN evidence (20k-el 100000/100000 no stall; Prism 15/15 @ 20ms
  no drops), not a hand-wave. The "sanitize round-trip eats the off-thread win" causal claim is grounded
  in the input-vs-output size asymmetry (12KB in / 148KB out) that the rig actually exercises.
- **No live identifiers:** the fixture + rig use synthetic/benign content only; the XSS probes use
  `xssFired`-sentinel patterns, never a live endpoint. `@ampproject/worker-dom` stays devDep-only.
- **Immutability (ADR-0014):** the adverse AC4 Outcome is promoted to `docs/refinement-todo.md`; the
  Accepted ADR-0014 body is recorded-against, NOT amended. Correct per the immutability rule.
- **DoD evidence:** every box is checked with concrete evidence (numbers, suite 1045 pass/84 files, lint
  clean, build emits the 4th sibling). The Deviation log + Reconciliation sweep are present and complete.

**Nit (non-blocking):** the AC4 verdict machinery keys off the *median* while the headline cites *p75*.
They agree (governed ~2× at both statistics), so the net-regression verdict is robust either way — but a
future reader skimming the rig code vs the prose sees two different percentiles. A `GAP≈150ms` piling run
to observe click-p75 convergence is a named follow-up, not owed here. Does not change the verdict.
