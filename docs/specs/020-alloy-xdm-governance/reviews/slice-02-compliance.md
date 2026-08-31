---
slice: 020-02 — implement alloy consent enforcement (seam drop + setConsent) + the optional payload strip
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T17:35:36Z
prompt_source: review.py compliance
---

# Compliance — 020-02. VERDICT: pass. All 4 ACs met. AC1 seam-drop egressVerdict strict:true (denied test
pins strict — sends under non-strict); fail-closed held + redacted purpose-only diag; consent-denied never
reaches egress; gated on egressPurposes.length. AC2 shapeAlloyConsent fail-closed (y iff both purposes
granted); driven configure->setConsent->sendEvent guarded. AC3 optional strip denylist-gated,
reference-preserving. AC4 no-consent path byte-unchanged. Non-vacuous. Nits folded: the PENDING test name
overclaimed strict (corrected); warn-vs-error diag level noted (consent hold = routine choice, matches GA4);
pending->hold+flush + live-rig tracked.
