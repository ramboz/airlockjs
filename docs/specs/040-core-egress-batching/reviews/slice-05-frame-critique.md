---
slice: 040-05 — payload-ceiling split (per-adapter)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:44:17Z
prompt_source: review.py frame-critique docs/specs/040-core-egress-batching/spec.md 'payload-ceiling' slice-05-payload-ceiling-split.md (round 2)
---

VERDICT: pass (round 2)

## Reasoning

The single load-bearing assumption — a self-imposed, documented byte-OR-count ceiling is a defensible safety bound even
though `/g/collect`'s real limits are unobserved — is honestly framed as a known residual, not a parity claim: both
dimensions are flagged unpublished and grounded on the closest DOCUMENTED reference (MP ~130KB / ~25-events), explicitly
disclaiming reproduction of gtag. All three round-1 folds are genuinely closed and consistent with source: (1) the
byte-OR-count combined bound is uniform across Goal/AC1/AC2/DoD/Assumptions; (2) `_ss`/`_fv` are confirmed SHARED —
`classifyKey` (coalesce.js:38-43) marks only `en`/`_et`/`ep.`/`epn.` per-event, `appendSessionState` (gtag.js:213-219)
sets `_ss`/`_fv` off `ctx.sessionState`; (3) AC4's GET/POST split matches code — group of 1 → 039-01 GET
(coalesce.js:166-167), ≥2 → POST. Adapter-only split confirmed: core/airlock.js takes hook outputs verbatim and
re-checks only the ENDPOINT allowlist, not size.

## Specific issues (all folded post-pass)

- AC1 vs AC4 wording tension (AC1 "under BOTH bounds" vs AC4's unsplittable single event that exceeds the byte ceiling).
  **[FOLDED: AC1 now carries the AC4-edge caveat inline.]**
- "binding one" vs "backstop far above realistic bursts" framing muddle. **[FOLDED: reconciled as relative-vs-absolute
  — neither bound fires in routine use; of the two, count trips first when a pathological burst approaches the limits.]**
- Implementation note (not a frame flaw): greedy two-bound packing must not backfill a later event into an
  already-closed earlier POST once an unsplittable-single-event POST is emitted mid-group, or cycle order breaks.
  **[FOLDED: AC1 states the no-backfill rule explicitly; DoD adds a small/huge-alone/small interleaving coverage clause;
  the implementer brief will call it out.]**

No reconciliation notes — pre-implementation frame-critique.
