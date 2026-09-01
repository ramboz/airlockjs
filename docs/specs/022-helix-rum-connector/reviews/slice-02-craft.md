---
slice: 022-02 — error checkpoints + sampling-rate fidelity
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T16:09:45Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (022-02) — PASS (orchestrator-scrutinized). resolveWeight is correct: explicit numeric weight wins (pinned by test), else rate name via RATE_WEIGHTS with a hasOwnProperty guard (no prototype pollution), else medium(100) — mirrors aem.js:34's own fallback. RATE_WEIGHTS matches aem.js:27-34 literally. errorFields WHITELISTS {source,target} off the params/payload bridge rather than sampleRUM's wholesale ...pingData spread — this is BETTER (hygiene by construction preserved) AND exact parity (error's errData IS {source,target}); graceful on a malformed error event (undefined keys drop under JSON.stringify → the 5-field body). mapToRum's top branch is a literal untouched 5-key return (byte-unchanged, AC3); only error appends. isSelected/weight/id fixed once (022-01) so an unselected page is silent for BOTH top and error — proven from one instance. No over-engineering.
