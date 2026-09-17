---
slice: 050-01 — the reference-site `?martech=airlock` rewire arm
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-17T19:38:40Z
prompt_source: review.py implementation <spec> 050-01 <slice> <doc> (re-run)
---

Compliance pass — VERDICT: pass (re-run). Reviewer: read-only jig:reviewer.
Demonstration slice; airlock output = the recipe + observable outcomes (§ Validation evidence + § Deviation log); intuit-erp
wiring out of scope. Prior needs-changes (AC4 silently narrowed) RESOLVED: AC4 reframed on the 129→94 network delta + the A4
probe, named goldens (verify:martech/clicktrack/appvars/ECS-chain) honestly CARRIED (not runnable in the Chrome-Overrides arena;
localhost=dev profile) — lifted to refinement-todo § Spec 050. Independently verified: the AC3 fetch+keepalive carve-out in
shipped code (tag-suppressor.js shouldSuppressBeaconCompiled + core/egress.js fetchInit), the separable-runtime probe, and the
dist carrying tag-suppressor.js. AC2 Meta id (850485508311844) logged; DoR A1 / spec A1 reconciled (floating origin/dist cut,
airlockjs v0.8.0+dc5d5c3); the pagead/viewthroughconversion parity drop surfaced. Every AC honestly met or loudly carried —
no silent narrowing. Two minor notes fixed (softened "exactly ~35"; AC4 residual lifted). Reconciliation sweep is the open item.
