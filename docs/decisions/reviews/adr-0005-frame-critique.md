---
adr: 0005
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T22:17:50Z
prompt_source: review.py frame-critique docs/decisions/adr-0005-oracle-design.md
---

ADR-0005 frame-critique — VERDICT PASS. The frame survives its strongest attack. The most-exposed load-bearing assumption is D3's cross-invocation worker-deferred INP delta as a regression signal: the ADR imports spec 003's "the delta is the load-bearing number" (003/spec.md:55-57), but 003 validated that on a ~144ms worker-vs-naive signal, whereas D3 re-aims it at worker-vs-deferred whose true signal is ~0ms (both medians 8ms) — below the ±30ms noise-floor band. This would be fatal IF the ADR claimed to resolve that fine margin, but it does not: it scopes the detection target to the ~144ms naive-stack collapse (advisory, not gated). VERIFIED no-issue on D1: the binary-invariant residual fails LOUD (at THRESHOLD=1.0 a future fractional score makes the composite unreachable — gate never passes — not silently green), the dangerous silent-dilution path is exactly what D1 fixes vs the rejected 0.5 default; documented as Con/Consequence/Assumption/Kill criterion. VERIFIED no-issue on D2: honestly bounded to "realm placement of one pure function" with an explicit MVP2-supersession kill criterion; no over-claim of containment. Non-blocking sharpening (D3): state plainly that the advisory INP budget detects catastrophic collapse, not the fine worker-vs-deferred margin — ADDRESSED post-review: added a "What the INP budget can and cannot detect" paragraph to the ADR (still Proposed/mutable) making this explicit.
