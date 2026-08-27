---
slice: 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-27T21:42:39Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: non-interactive
---

Arch — PASS (no load-bearing problem). The invariant is genuinely asserted, not faked: the wrapper imports the unmodified shipped chamber.worker.js, so AC1's bare-document throw and AC2's real mapToMp run in the SAME WorkerGlobalScope — asserting the airlock's placement choice, not the generic Web fact that Workers lack DOM. Bare-reference discipline correct + documented; try/catch is load-bearing (lets module eval complete so AC2 survives). No boundary inversion: rig->core one-way; oracle.sh COMPONENTS unchanged (vitest, ga4_mp_conformance only), matching the spec routing table (browser-CI gating, not hermetic). Positive control genuinely exercises shipped mapping (asserts client_id/events[0].name/session_id vs map.js). Fail-closed exit 0/1 clean for 07-05. CONCERN: [nit] browser leak on the internal-error path (no try/finally) — process still exits non-zero so CI gating unaffected; ADDRESSED post-review with a try/catch/finally guaranteeing teardown + FAIL line. OPEN QUESTION (confirmed sound scoping, not a gap): the rig fixes the realm itself, so it proves "when the chamber is loaded into a Worker, no-DOM holds in the same realm as mapToMp"; it does NOT verify the production orchestrator places the chamber in a Worker — consistent with the MVP1 scope note, deferred to MVP2/OQ1. RECONCILIATION/07-05 HANDOFF: gating contract is `npm run rig:isolation` -> exit 0/1, requires Playwright/chromium + a browser-CI runner, MUST NOT be added to oracle.sh COMPONENTS.
