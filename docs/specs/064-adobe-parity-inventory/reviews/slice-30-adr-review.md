---
slice: 064-30 — stock Adobe consent path (ADR-0064)
pass: adr-and-slice-review
round: 3
verdict: changes-requested
reviewer: independent reviewer (jig:reviewer sub-agent, Opus 5.5)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for ADR-0064, slice 064-30 and slice 064-33 (uncommitted worktree docs, before the Phase 1 commit); each round's text was saved by the author
---

# ADR-0064 / 064-30 / 064-33 review

Three rounds, the cap. Round 3 still returned changes-requested (1 medium, 3 low). Every finding was fixed in the same commit; round 3's fixes were not re-reviewed because the cap was reached, so the owner and the Phase 2 reviews should check them.

## Round 1 — changes-requested (13 findings: 1 high, 8 medium, 4 low)

All fixed before round 2: object-first order in one synchronous call; a held object used only by the next vector message; a readable-shape rule with a fallback and diagnostic; mixed arrays and the 068 opt-out match; pending and partial states; `thirdPartyCookiesEnabled` stated as a boot option to add; the unchecked opt-out `consent` forward (carried to new slice 064-33); version check, merge rule, bridge fallback, `consentRef`, diagnostic sink, and testability of AC2(a) and (d).

## Round 2 — changes-requested (5 medium, 3 low)

All fixed before round 3: one Adobe-entry rule in ADR and slice; plain-data check before posting; one retry with vector-shaped options when Alloy rejects the object; an object without `collect` takes the fallback; 064-33 registers the expected on-wire consent through a vendor-neutral host method and names `meta`; cross-references and `consentRef` wording corrected; composite-handle and `consentToVector` reconciliation notes added to the ADR.

## Round 3 — changes-requested (1 medium, 3 low)

1. Medium — the retry after a rejected object puts the vector-shaped consent on the wire, which 064-33 would hold. Fixed: 064-33 registers both values when the object is sent, and the retried refusal is an AC3 case.
2. Low — ADR Option A had the order reversed. Fixed.
3. Low — slice-30 AC7 "exactly once" ignored the retry. Fixed.
4. Low — the fallback path posting no `adobeConsent` message was not stated. Fixed in ADR point 2 and AC5.

## Remaining known differences from stock (carried)

- Objects the adapter cannot read with certainty (including `personalize.content` only) take the vector-shaped body. Reported by a diagnostic; owned by 064-30.
- `setAdobeConsent` is fire-and-forget; the promise outcome is owned by 064-31 AC8.
- The opt-out forward does not check its `consent` and `meta` keys until 064-33; that slice changes `core/` and needs an ADR-0062 amendment note (or a new ADR, which the owner decides).
