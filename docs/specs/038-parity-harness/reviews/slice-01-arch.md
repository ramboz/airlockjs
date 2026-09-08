---
slice: 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T16:39:44Z
prompt_source: review.py arch docs/specs/038-parity-harness/spec.md 'Meta Pixel' <deliverables>
substrate: non-interactive
---

VERDICT: **pass** (independent `jig:reviewer`, read-only). The slice stands up a clean, self-contained `rig/parity/` module; the oracle is pure, import-free, and fully descriptor-DATA-driven ("one classified-diff engine, two descriptor kinds" realized correctly), and ADR-0020's gap-map/false-shim contract is enforced verbatim. Module boundaries preserved: the harness *reads* airlock's Meta connector (never edits it — 026 stays out of scope) and derives its reverse event-map + synthetic constants from the shipped connector so the harness-side copies can't drift. Reuse-vs-duplicate calls well-judged — correctly declines to force-fit `generic-capture.js` (a ring-drain spy) or `lh-core.mjs` (a CWV engine) where they don't fit.

Non-blocking [nit] findings (→ reconciliation log):
- [nit] oracle.js:19-37 — `ParityDescriptor` typedef omits `endpoint` (report.js:38) + `deriveLogicalEvent` (run-meta.mjs:27) — both part of the de facto descriptor contract; a 2nd-vendor author reading the typedef wouldn't learn to supply them. The "widgetco" test exercises only `diffParity`, not the report/replay-derivation half. Complete the typedef.
- [nit] capture-patterns.js:18-21 — `matchesPattern` duplicates lh-r010.mjs:80-83 (importing lh-r010 triggers its import-time `process.exit(2)`, and the fn is module-private there) — a defensible-but-noted drift seam; clean home is a shared export in `rig/lh-core.mjs` (follow-up refactor, out of this slice's scope).

Strengths: `REVERSE_EVENT_MAP` + `SYNTHETIC_META_PIXEL_ID` reuse from the shipped connector = anti-drift by construction; `cd[...]` as an owned `gapMap` entry (NOT a fabricated `wireNameMap`) = exactly ADR-0020's false-shim prohibition; pure DI-testable engine with no speculative config knobs.
Open question (→ deviation log, owned by ADR-0020): the oracle silently ignores a container field neither in `attributionFields` nor `normaliseDenylist` (the intended AC3 curated-set behavior) — so an attribution field the descriptor author *forgets to curate* yields a false pass (the spec's central risk). Owned by ADR-0020's capture-refresh cadence + kill criteria; a completeness guard (every fresh-capture field must be curated-or-denylisted) is a possible future hardening. Positive deviation: correctly dis-confirmed the spec's `generic-capture.js` reuse candidate (wrote a leaner `replayPixelBeacon`).
