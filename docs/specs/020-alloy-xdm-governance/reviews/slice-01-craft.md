---
slice: 020-01 — alloy XDM-governance feasibility probe
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T16:42:08Z
prompt_source: review.py (spike close-out)
substrate: non-interactive
---

# Craft — 020-01. VERDICT: pass.
Redaction airtight (datastream env-only/never-printed; only handle[].type + counts + RFC-7807 catalog read;
synthetic PII; no fixture). The strip test is a valid Edge-safety probe; the consent characterization is
exactly grounded in alloy@2.35.0 source; the "seam-drop + delegate setConsent" conclusion is sound + non-
overreaching. Note-level residuals (folded):
1. egressVerdict's non-strict default SENDS on data-use denial (GA4 body-consent premise); alloy has no
   body-consent → a collect-denied interact must be DROPPED not sent → 020-02 needs strict-like/drop
   semantics. FOLDED into 020-02 AC1.
2. rig governedStripped() ≡ base() (add-then-delete), so baseline-vs-stripped is structurally identical
   (modulo timestamp) — the strip round-trip check is meaningful but can't fail except on gross corruption;
   a sharper sensitive-vs-stripped diff isn't computed. Minor rig note (the Edge-safety is still shown);
   tracked for a 020-02 rig refinement if the strip is built.
3. the live 200/handle-shape rests on orchestrator verification with no committed artifact (correct per the
   redaction/no-fixture discipline; 013 creds-gated precedent) — logged.
