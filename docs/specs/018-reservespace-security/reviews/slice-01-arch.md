---
slice: 018-01 — the active-markup sanitizer boundary
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T05:40:02Z
prompt_source: review.py arch (richer-skill none)
substrate: non-interactive
---

# Arch review — 018-01. VERDICT: pass (independent, jig:reviewer).
Module boundaries preserved (core/ import-free with injected parser; adapter imports core/ in the established
direction; no core→rig). Public contract handled (capability.d.ts comment-only; opts.sanitize correctly OFF
the public contract; contract-stability green). Security postures right: fail-closed to "", atomic sanitize+TT
(no untrusted-trusted window), genuinely-gating CI. Strengths: fail-closed posture, template recursion, gating
wire-up.
Substantive finding (non-blocking, zero blast radius): the module-global TT policy captures the FIRST caller's
sanitize → a second capability's opts.sanitize is dropped on the TT path. Unreachable today (no prod caller;
opts.sanitize test-only/non-TT; prod strictness routes through opts.setContent). APPLIED: recorded in the
deviation log. Open question — the core/ home's import-free invariant was "by inspection": APPLIED a focused
import-free machine guard in test/core-boundary.test.js (2/2 green).
