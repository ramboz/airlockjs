---
slice: 040-05 — payload-ceiling split (per-adapter)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T22:06:24Z
prompt_source: review.py implementation ... 'payload-ceiling' connectors/ga4/coalesce.js test/ga4-coalesce.test.js
---

VERDICT: pass

## Reasoning

All four ACs are met by `connectors/ga4/coalesce.js` and exercised by non-vacuous tests. The greedy packer
(`splitIntoPostGroups`, :200-233) walks in cycle order, checks both ceilings independently (`fitsCount`/`fitsBytes`),
closes chunks without backfill, and handles the unsplittable-oversized-single edge; the ≥2 branch iterates chunks while
the group-of-1 branch still emits the GET. Both split dimensions have fail-on-revert coverage (byte + count), the
040-03 fixture test is unchanged and still asserts one byte-for-byte POST, and every DoD coverage bullet maps to a test.

## Ruling on the two flagged points

1. **Post-split singleton → single-line POST is AC-compliant.** AC3's "single event → GET" and AC4's NOTE are scoped to
   a *context group of 1* in the INPUT (`group.items.length === 1`). A small event isolated by an oversized neighbor is
   a member of a ≥2 context group, which AC1 says must emit "multiple POSTs… every event in exactly one split POST." A
   GET would violate AC1 and require the forbidden backfill/reorder. Consistent.
2. **Body-only byte measurement is AC-compliant.** Matches AC1's explicit "combined body size" and AC2's doc comment;
   the self-imposed 60000 body ceiling leaves a >70KB margin under the ~130KB whole-request limit, comfortably absorbing
   the repeated shared query. Not a bug.

## Specific issues

- None blocking.

## Reconciliation notes (addressed)

- Deviation log / reconciliation sweep were `_TBD`, DoD unchecked. **[FOLDED: both written, DoD ticked.]**
- The slice claims to resolve ADR-0021 OQ#2 — confirm the ADR is actually marked resolved. **[FOLDED: ADR-0021 OQ#2
  struck RESOLVED → 040-05; ADR-0021 now has no open questions left.]**
- Body-only measurement recorded as an accepted in-frame decision (>70KB margin under ~130KB).
