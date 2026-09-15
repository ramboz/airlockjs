---
slice: 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T19:39:12Z
prompt_source: review.py reconciliation docs/specs/049-native-tag-suppressor/spec.md runtime-
---

Reconciliation pass on slice **049-01** — reviewer `jig:reviewer`, prompt via
`review.py reconciliation docs/specs/049-native-tag-suppressor/spec.md runtime-`.

**VERDICT: pass.** Every deviation-log claim verified faithful to the shipped code/tests/build/docs, with precise line
citations: (1) the flat diagnostic (`suppressionDiagnostic` returns `{level,kind,disposition,url,matcherHost,
matcherPathname,matcherQuery}`; the flat-record invariant at `core/inspector/collector.js:53-60`); (2) all six insertion
methods individually driven with a suppressed network-0 + sentinel-absent fixture (+ the replaceChild placeholder-survival
assertion); (3) compile-once (`state.compiledSuppress/compiledAllow`, hot path never recompiles); (4) the build
self-defense (`new Worker(`-in-suppressor build failure + seeded regression test); (5) the two deferred edges tracked in
`refinement-todo.md` with resolution triggers. AC6 dist wiring real; the `architecture.md` addition is scoped to the
boundary line with no scope creep; the reconciliation sweep is honest + complete across the drift-prone doc surfaces.

**One non-blocking finding — RESOLVED post-review:** `README.md`'s served-tree enumeration was stale — it omitted
`tag-suppressor.js` (this slice's AC6 dist sibling) and pre-existingly `reserve-personalization.js`. Per the reviewer's own
recommendation ("fix or track it, don't silently carry it as no-op"), fixed the README to list both + point at
`DIST_ARTIFACTS` (`publish-dist.mjs`) as the authoritative served set; the sweep's README disposition updated `no-op` →
`updated`. (The testbed build-output copy `probes/eds-testbed/scripts/airlock/tag-suppressor.js` is a build mirror like
`dist/`, correctly not a swept doc surface.)
