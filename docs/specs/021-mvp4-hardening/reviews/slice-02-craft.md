---
slice: 021-02 — egress transport pin (http-downgrade), grounding-first
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-08-31T18:43:06Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (021-02) — PASS. schemeOf mirrors hostOf; normalizeScheme tolerant (https / https: / any case → null-for-empty, caller defaults). Scheme-MATCH, not https-literal (origin-aware, mirrors 014-01 reconcileForBrokerJar). Default https: closes the gap for every shipped pin with zero wiring changes; a localhost/http rig opts out via pinnedScheme:"http:". Scheme check placed after host, before tenant — no regression to existing allow verdicts (an honest https host+tenant still allows). pinnedDispatchUrl re-derives u.protocol first, so an override can't preserve a downgrade. Tests: 88/88, RED-first confirmed.
