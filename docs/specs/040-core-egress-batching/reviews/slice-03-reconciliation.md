---
slice: 040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:07:12Z
prompt_source: review.py reconciliation docs/specs/040-core-egress-batching/spec.md 'GA4 multi'
---

VERDICT: pass

## Reasoning

The deviation log's three logged deviations are all real and correctly characterized against the built code, tests, and
fixture. (1a) The `_et`-value divergence is genuine — `connectors/ga4/coalesce.js` relocates each event's own `_et`
(default `100`) to every body line, versus the n=1 capture's line-2-only `_et=1` (documented in Assumptions +
refinement-todo). (1b) The fixture uses `page_view`+`scroll` (one `ep.*`, one `epn.*`) with no consent/session in `ctx`,
and the FOLDED merged-shared-consent/session-state test exists. (1c) The mixed-`gcs` governance test is strengthened
exactly as described — both requests set an all-granted `consentDefault` so `gcd` is omitted on both, isolating `gcs` as
the sole differing shared param; and the redundant `.slice()` before `.sort()` is gone. No undocumented deviation
exists: ACs 1–4 map cleanly to `classifyKey`/`parseRequest`/`buildBodyLine`/`buildBatchPost`; the taxonomy is lean
(default-shared, no over-build); the 039-04 strikethrough is present in BOTH the SPIDR line and the Slices list. The
`core/coalescing-broker.js` non-overlap holds — it neither imports nor references `coalesceGa4`.

## Specific issues

(none blocking)

## Reconciliation notes (all folded into the sweep)

- The payload-ceiling split is homed in ADR-0021's open questions (adr-0021:150), cross-referenced from spec 040 — NOT
  in refinement-todo. **[FOLDED: sweep now states this explicitly.]**
- The 039-04 strikethrough is in BOTH the SPIDR line (039 spec.md:110) and the Slices list (:122). **[FOLDED: sweep now
  names both.]**
- `reviews/slice-03-frame-critique.md` is a framing-phase review artifact (round-2 pass) — part of the slice's own doc
  bundle. **[FOLDED: sweep now notes the review artifacts.]**

Full suite green at 91 files / 1402 tests.
