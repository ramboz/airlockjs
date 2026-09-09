---
slice: 040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:40:55Z
prompt_source: review.py frame-critique docs/specs/040-core-egress-batching/spec.md 'GA4 multi' slice-03-ga4-batch-adapter.md (round 2)
---

VERDICT: pass (round 2)

## Reasoning

The single load-bearing assumption is "faithful reproduction of the observed-accepted batch structure ⇒ no GA4
mis-ingest / silent event loss." The three round-1 problems that made the old frame's mechanism unsatisfiable are
genuinely closed and source-grounded (`_et` relocate, `_ee` inject, taxonomy-classify vs synthesize as two separable
operations). The residual risk — that GA4 accepts airlock's *synthesized* shape — is honestly demoted to a tracked n=1
limitation with a DEFERRED live-accept re-check on a controlled test property, so per reconciliation rules it is a known
residual, not a fresh flaw. The frame survives.

## Round-1 findings — all three verified closed against source

1. **`_et` relocated** — `connectors/ga4/gtag.js:286-288` confirms the single-GET emitter appends `_et` to the *query*
   (default `100`), and it is semantically per-event. The reframe to RELOCATE it per body line is source-grounded.
2. **`_ee` injected** — `_ee` appears nowhere in `mapToGtagCollect`; it cannot be "classified" from a GET and must be
   INJECTED per line. Grounded.
3. **Two separable ops (classify-by-taxonomy vs synthesize)** — present and consistent across AC1/AC4/Assumptions; the
   taxonomy (AC4) is complete over the closed emitter key set (`gtag.js:255-288` emits exactly
   v/tid/cid/sid/session-state/en/dl/dr/dt/ep.*/epn.*/gcs/gcd/_et — every key classified, no orphan).

## Specific issues (both notes, folded post-review)

- `:87` — "reproduce that shape **verbatim**" overstated the grounding: airlock relocates `_et` to EVERY line at its own
  value (default 100), whereas the sole observation carried `_et` on line 2 only (value 1). **[FOLDED: reworded to
  "reproduce that observed STRUCTURE … not a byte-verbatim copy", and the `_et` value divergence is now stated
  explicitly as part of the n=1 residual.]**
- `:57` — the DoD's "asserted byte-for-byte" fixture is the SYNTHESIZED shape (code-matches-spec-structure), not the raw
  observed capture, so it must not be read as closing the fidelity residual. **[FOLDED: DoD bullet now labels it a
  "code-matches-spec-structure" assertion and states only the deferred live-accept DebugView re-check closes the
  fidelity residual.]**

No reconciliation notes — pre-implementation frame-critique; nothing to reconcile.
