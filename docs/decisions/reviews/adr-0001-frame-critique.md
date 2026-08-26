---
adr: 0001
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-26T00:29:03Z
prompt_source: review.py frame-critique docs/decisions/adr-0001-chamber-isolation-strength.md
---

# Frame-critique verdict — ADR-0001 (narrowed)

**Verdict: pass** (fresh-eyes adversarial re-critique of the narrowed ADR).

The single load-bearing assumption is scope: MVP1 is, and remains, exactly one
first-party self-authored connector (GA4 over the Measurement Protocol), so the
per-connector confidentiality and runaway-containment the "chamber" vocabulary
sells are worthless *to MVP1* and can wait for MVP2. The premise, the sync-cache
feasibility claim, and the MVP2 deferral were each subjected to strong attack;
each hit an honest concession, a probe-grounded claim (the reviewer read
`probes/alloy-worker/worker.js` — it really boots stock `@adobe/alloy@2.35.0`
against a synchronous cookie cache), or a legitimate tracked deferral (OQ9 is
present in refinement-todo with a real resolution trigger and a
model-agnostic-probe requirement). The frame survives.

## Residual notes (acknowledged, not blocking)

1. **MVP1 exercises the INP thesis but none of the isolation/confidentiality
   thesis** (single-tenant plain Worker demonstrates zero of "one tag cannot read
   another's data"). This is an upstream scope decision the ADR faithfully
   inherits (product-vision MVP1 scope + OQ1 leaning), converted into an explicit
   kill criterion (a second/untrusted connector escalates to B/C and resolves
   OQ9), and stated honestly (review G3). Known residual, reconciled.
2. **The OQ9-before-step-5 sequencing bet** — sibling ADR-0002 (single
   sequence-numbered log, one worker) and ADR-0003 (snapshot crosses to one
   worker; cross-chamber snapshot confidentiality depends on ADR-0001's isolation
   upgrade) are drafted on single-shared-worker premises now; if the eventual
   B-vs-C choice forces multi-channel routing or per-chamber caches those step-5
   contracts could need rework. Acknowledged and sequenced (OQ9's trigger orders
   it before the contract freeze). A residual to watch, not a block.

Reviewer: general-purpose (jig frame-critique prompt). Pass recorded 2026-08-25.
