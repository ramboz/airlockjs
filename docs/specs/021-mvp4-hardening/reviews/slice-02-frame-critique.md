---
slice: 021-02 — egress transport pin (http-downgrade), grounding-first
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T18:26:14Z
prompt_source: review.py frame-critique
---

# Frame-critique — 021-02 (egress transport pin). VERDICT: pass.
Grounded the load-bearing assumption ("an uncovered http-downgrade gap exists"): the 016 endpoint-ceiling
compares origin+pathname, and origin INCLUDES the scheme (endpoint-ceiling.js:52-59,88-95), so an http
downgrade to a declared https origin is ALREADY held wherever the ceiling is wired (GA4 airlock.js:92,195;
alloy wrapped-sdk-host.js:216). The slice's grounding-first framing is sound — it concedes the gap may be
empty (RESOLVED-BY-CONFIRMATION), so it will NOT build speculative gating. All DoR grounding verifies:
config-integrity is scheme-blind (.host, config-integrity.js:67-70,98-99); pinnedDispatchUrl preserves scheme
(:134-140 sets host, never protocol). NOTE folded: re-ranked AC1 candidates — the LEADING real gap is a
config-integrity path with NO ceiling co-wired (scheme-blind); the override re-derive is already-closed when a
ceiling co-runs (ceiling holds the http original first; override only re-derives the tenant on a
ceiling-granted origin). Reviewer: jig:reviewer (independent).
