---
adr: 0006
pass: frame-critique
verdict: pass
reviewer: human authority (5 independent frame-critique rounds; final round needs-changes, addressed)
reviewed_at: 2026-08-28T22:32:19Z
prompt_source: review.py frame-critique docs/decisions/adr-0006-capability-manifest.md (x5 rounds)
---

# Frame-critique verdict — ADR-0006

**Verdict: pass — recorded on human authority** (the frame-critique evidence gate
is a deliberateness signal a human can clear; ADR-0020). This is **not** a clean
independent pass: across **five** independent fresh-eyes frame-critique rounds the
final verdict was `needs-changes`, and each round's finding was correct and was
incorporated. The gate is cleared here by the author's deliberate judgment that the
frame is now honest and adoptable, with residuals documented — not by a reviewer
conceding a pass.

## The five rounds (all findings incorporated)

1. **Uniform-law over-reach.** The intersection law was claimed for *every* channel
   including the open payload; ADR-0003 already governs the payload by a host-owned
   denylist. → Payload carved out as a denylist, not an intersection-law section.
2. **Vacuous-for-MVP2 + two-seam undercount.** → Two egress seams named (worker +
   `pushCritical` fast path, OQ16); attribution flagged as real plumbing.
3. **R-004 "endpoint-narrow" was a probe artifact.** The single-`fetch` result came
   from a faked/offline Edge; live Alloy does server-directed ID sync. → CDP
   endpoint breadth scoped as *unproven*, probe-gated.
4. **Disclosure claim not archetype-scoped.** The "compliance label" was asserted
   universal while it under-reports a CDP's runtime sync destinations. → Label scoped
   complete-for-fixed-endpoint, floor-only-for-CDP; CDP conjunction conceded.
5. **Endpoint ceiling double-counts ADR-0004.** The foreign-sink/Magecart defense
   credited to flipping `endpoints`→authoritative is already provided by ADR-0004's
   host-owned seal allow-list. The marginal `∩ declared` delta (per-connector
   cross-endpoint confinement) is ~zero for GA4 alone and low-value against the
   exfil threat even at 2-connector MVP2. → Reframed honestly as
   **forward-compatible least-privilege + disclosure** (the ADR-0003 justification),
   *not* present-tense GA4 hardening.

## Durable core (what actually holds)

The capability-manifest **declaration + disclosure frame**, with
declaration-as-ceiling established now for **forward-compatible least-privilege** —
the same justification accepted for ADR-0003 ("establish default-deny now to avoid a
breaking retrofit"). On that basis the frame is sound and consistent with accepted
prior art.

## Documented residuals (in the ADR — not resolved here)

- CDP (Alloy) endpoint ceiling is probe-gated on a live-Alloy endpoint-breadth
  measurement (R-004 faked the network).
- Payload-PII exfiltration (own-endpoint) is governed by the OQ11 denylist, not this
  ADR; MVP2's real exfil threat lives there.
- **Sequencing fork (open question, for the release plan):** whether MVP2 pulls the
  OQ11 payload denylist forward as its headline exfil-defense deliverable and treats
  the endpoint ceiling as forward-compat scaffolding, or sequences the ceiling first.
- Per-connector attribution is not in `EgressRequest`; wiring the ceiling at both
  egress seams is real data-flow work (couples to OQ16).

Recorded by: author on human authority, after five independent frame-critique
rounds (final round `needs-changes`, addressed).
