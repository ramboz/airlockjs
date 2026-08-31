---
slice: 020-02 — implement alloy consent enforcement (seam drop + setConsent) + the optional payload strip
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T17:35:37Z
prompt_source: review.py arch
substrate: non-interactive
---

# Arch — 020-02. VERDICT: pass. The two-lever trust model is correct + MACHINE-VERIFIED: the seam drop is the
enforcement (tested against a fake chamber with no setConsent — a compromised chamber forging collect:y is
still held); setConsent is a genuine complement (correct vendor behavior + cookie propagation), never relied
on. strict:true hardcoding correct (no valid non-strict value for alloy). Ordering ceiling->config-integrity
->consent sound (overridden dispatches still consent-gated). Boundaries clean; warn-level matches GA4's seal.
Nits folded: fail-loud warn on consent-without-egressPurposes (the misconfiguration footgun). Follow-ons
tracked: pending->hold+flush (the pending-window data-loss question — maintainer's call); the dynamic-import
residual bounds the trust claim (pre-existing). ADR-0012/0007 supersession sound -> ADR-0013.
