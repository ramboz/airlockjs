---
slice: 040-05 — payload-ceiling split (per-adapter)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T22:10:33Z
prompt_source: review.py reconciliation docs/specs/040-core-egress-batching/spec.md 'payload-ceiling'
---

VERDICT: pass

## Reasoning

The deviation log and reconciliation sweep are honest and substantively complete against what was built. All four
logged deviations/decisions are real and correctly characterized in `connectors/ga4/coalesce.js`: (a) post-split
singleton → single-line POST (≥2 branch iterates `splitIntoPostGroups` chunks through `buildBatchPost`; a size-1 chunk
yields a single-line POST; a genuine group-of-1 stays a GET); (b) byte ceiling body-only (`byteLength` on the joined
body / the line, never url); (c) measured==emitted via the shared `buildBodyLine`+`\r\n` join, docstring fixed to
">=1 chunk"; (d) the O(n²) re-encode deliberately kept. ADR-0021 OQ#2 is genuinely struck RESOLVED → 040-05, and all
three OQs (OQ#1→040-04, OQ#2→040-05, OQ#3→040-03) are struck, so "no open questions left" is TRUE. Built behavior matches
ACs 1–4 (greedy byte-OR-count split, lossless/cycle-order/no-backfill, unsplittable-single edge, under-both-ceilings
one-POST preservation, adapter-only). The `core/coalescing-broker.js` non-overlap holds (coalesce.js has no imports; only
a docstring disclaimer).

## Specific issues (folded)

- Deviation log said "7 new tests" but 9 `it` blocks were added (7 new-feature + 2 AC3-preservation guards). The "7" is
  defensible as new-feature tests (matches the DoD's "7 all failed on revert"), but undercounts the total.
  **[FOLDED: log now reads "7 new-feature tests + 2 AC3-preservation regression guards = 9 new `it` blocks".]**

## Reconciliation notes (folded)

- The two new non-parity residuals (post-split singleton-as-POST; `_ss`/`_fv` repeated per split POST) were folded under
  the existing 040-03 deferred live-accept DebugView entry rather than a new line — a defensible same-class disposition.
  **[FOLDED: added an explicit "Also covered by this same re-check (040-05 residuals)" pointer under that
  refinement-todo entry, so the coverage is self-evident.]**
