---
slice: 033-01 — spike: de-risk alloy adapter-boot + distribution + the composite-handle reconciliation (GO/KILL)
pass: craft
verdict: pass
reviewer: general-purpose (spike investigation review — grounding + soundness)
reviewed_at: 2026-09-05T00:47:27Z
prompt_source: review.py (spike findings review) docs/specs/033-alloy-config-wiring/spec.md 033-01
substrate: non-interactive
---

VERDICT: pass — SPIKE investigation review (grounding + soundness; a spike ships no production code, so one
independent review covers both the compliance lens (Findings grounded) and the craft lens (probes real + reasoning
sound + Outcome honest)).

## Assessment (independent, general-purpose reviewer — re-ran all 3 probes)

The investigation is sound, grounded, and honest; the **GO** is earned.

- **#1 (PRIMARY KILL) fully earned by 3 re-run probes with a working negative control:** classic worker
  **construction admitted** under the enforced boilerplate CSP; `importScripts` **blocked by Trusted Types** (the
  `TrustedScriptURL` error), NOT `strict-dynamic`; **admitted after a worker-realm TT policy** (default AND named;
  same + cross origin). The **shipped `alloy-chamber.worker.js` provably fails today** for exactly that reason
  (`fatal{phase:"load"}`, TrustedScriptURL error at the `:377` `importScripts`). `worker-src` escalations change
  nothing. The negative control (un-nonced inline script blocked) proves the CSP is genuinely enforced.
- **#2–#5 grounded, no overclaim:** single-slot `driveEvent` + re-entry guard; `createWrappedSdkHost` has no
  `dispose` + doesn't spawn the Worker; `{type:"decisions"}` genuinely un-consumed by `handleMessage`; strict
  `egressVerdict` required; `build.mjs` single `esm` call + `core/`-strip out-namer (breaks for `connectors/alloy/`).
  Design leans appropriately hedged.
- **Outcome (GO) decisive; residuals flagged not hidden:** the restrictive-`trusted-types`-directive live-host risk
  + the ship-vs-site-supplies licensing ADR.
- **Scope-clean:** probes under `probes/alloy-csp-spike/` only; no shipped-runtime / board / STATUS changes.

SPECIFIC ISSUES: (none)

Reviewer: general-purpose (independent), re-ran probe.mjs/probe2.mjs/probe3.mjs. Recorded as both compliance
(grounding) and craft (investigation soundness) for this kind:spike slice.
