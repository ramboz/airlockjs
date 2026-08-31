---
slice: 021-02 — egress transport pin (http-downgrade), grounding-first
pass: compliance
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-08-31T18:43:05Z
prompt_source: review.py compliance
---

Compliance (021-02) — PASS. Grounding-first honored: AC1 gap enumerated + recorded (a ceiling-less config-integrity path ships as a supported/tested/back-compat-locked configuration; no production alloy adapter yet — pre-existing, out of scope). Disposition-neutral reason ("outbound scheme != pinned scheme (transport downgrade)") per the 015-02 rule — rides override alerts without "held" wording. No secrets / live identifiers (the reroute rig uses a synthetic PIN + the https Edge host). Deviation from ADR-0004's egress allow-list (fix lands in config-integrity.js instead) recorded explicitly in refinement-todo + the deviation log — not silently diverged. Frame-critique recorded pass.
