---
slice: 019-01 — input-side payload denylist governance (all crossings, GA4 E2E)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T12:59:24Z
prompt_source: review.py arch (richer-skill none)
substrate: non-interactive
---

# Arch — 019-01. VERDICT: pass (independent jig:reviewer).
Architecture sound: payload-governance.js is genuinely import-free/no-global (stricter than sanitize-html.js,
machine-guarded via the extended core-boundary it.each); governance placed in the host/policy layer
(criticalDispatchGated + governParams), egress.js stays neutral; the load-bearing non-mutation (copy-on-write
along the denied path, off-path subtrees shared) is correct + machine-proven; sendBatch collapses
drain()+flushNow() to the ONLY worker.postMessage({type:"events"}) call, foreclosing the flushNow bypass by
construction; {...d, params} drops no field mapToMp reads. Two flagged design decisions RESOLVED post-review:
(1) off-by-default DEFAULT_DENYLIST — arch flagged it for explicit author sign-off (the footgun population is
the unconfigured one); ESCALATED to the maintainer, who chose ALWAYS-ON (implemented + AC/tests updated). (2)
silent fail-open — now surfaces an error-level diagnostic. ADR-0012 §3 "alloy governed for free" drift —
CORRECTED via a dated annotation on the ADR (alloy input is a separate seam / deferred second placement).
Nit (optional, not done): findKeyCaseInsensitive rebuilds Object.keys per entry — negligible on the idle/
teardown paths, a precomputed lowercased-key set could remove the rescan. 266 tests green.
