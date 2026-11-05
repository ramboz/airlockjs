---
adr: 0047
pass: arch
verdict: pass
reviewer: jig:reviewer (explicit gpt-6.1-sol; fresh bounded arch-review)
reviewed_at: 2026-11-05T23:19:33Z
prompt_source: review.py arch-review docs/specs/059-google-ads-full-compatibility/spec.md 059-15 docs/decisions/adr-0047-google-manual-residual-cleanup.md --richer-skill arch-review at 965f4a28
---

VERDICT: pass

REASONING:
This is a bounded architecture pass for Proposed ADR-0047 at 965f4a28, applying technical-soundness, reliability, security/authority and lean-transition lenses. The owner acceptance changes only the complete-descendant-exit prerequisite for this Google reference, preserving unknown/manual cleanup and all non-excepted safety, authority and finite gates. The proposal correctly leaves guard release with residual helpers unqualified; root exit, sampled absence or broker closure alone cannot justify release. No blockers or nits were found within this documentation scope; no runtime/browser qualification follows, and full 059-15 compliance remains needs-changes.

SPECIFIC ISSUES:
- [strength][spec] docs/decisions/adr-0047-google-manual-residual-cleanup.md:79-92 — Separates accepted helper residue from complete cleanup and independently proven network stop, without inventing descendant-exit evidence.
- [strength][impl] docs/decisions/adr-0047-google-manual-residual-cleanup.md:93-104 — Requires current-source/browser guard-release qualification with surviving helpers, including port reuse and reconnects. Existing root-exit guard retention remains necessary but insufficient.
- [strength][spec] docs/decisions/adr-0047-google-manual-residual-cleanup.md:112-130 — Preserves canonical one-shot authority, physical limits, the absolute 60-second envelope, independent controls and evidence-completeness gates without adding a runner or changing production contracts.

RECONCILIATION NOTES:
Record the proposed Google-only helper-exit/manual-cleanup exception separately from unchanged full-slice criteria. Existing owner acceptance is sufficient to document that exact behavior; stop, guard release and finite completion remain technical qualification gates, not grounds for another routine approval question.
