---
slice: 020-02 — implement alloy consent enforcement (seam drop + setConsent) + the optional payload strip
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T17:35:36Z
prompt_source: review.py craft
substrate: non-interactive
---

# Craft — 020-02. VERDICT: pass, no blockers. COLLECT_PURPOSES matches manifest; resolveConsent-only import;
strict:true correct; stripInterceptedXdmBody fails safe (non-JSON/no-events/non-object xdm, never throws,
ref-preserving); configure->setConsent->sendEvent ordering genuinely control-flow-enforced. Nits folded:
fail-open-at-swallow comment added (delegate fails open, seam is backstop); never-throw tests added
(non-JSON/no-events). Note-level (tracked): purpose-list mirror drift; the unreachable govern-error branch.
