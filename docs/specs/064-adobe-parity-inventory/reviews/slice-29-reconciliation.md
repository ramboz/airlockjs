---
slice: 064-29 — first push after applyResponse matches stock
pass: reconciliation
round: 2
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-29 (round 1: commit 9f0cb8f5; round 2: commit ec4779f5, pushed). The author saved its text.
---

# 064-29 reconciliation

## Round 1 (9f0cb8f5) — changes-requested

High: slice still READY_FOR_IMPLEMENTATION with no Findings. Medium: a warm cache spends declared placement scopes (stock has no placements); `carriesQuery` treats any non-empty surface string as a query (stock drops invalid surfaces, so a warm named view is not rendered); a push now waits for an in-flight `applyResponse`, which ADR-0063 did not record. Low: empty-string and non-string scopes; an XDM `decisioning.proposition*` push with scopes sends no query (064-20); the AC3 test watches prehiding; `carriesQuery` is a `const` declared after its caller. The reviewer read stock from memory, not from the bundle.

Disposition (ec4779f5): slice DONE with Findings; docs listed by the reviewer updated; ADR-0063 consequence added; slice 064-32 created (READY_FOR_IMPLEMENTATION, AC1 to AC4) to own the differences, to be confirmed against the pinned bundle.

## Round 2 (ec4779f5) — changes-requested

All docs consistent and dated 2026-11-20; 064-32 has concrete ACs and no open "decide whether". Issues: (1) spec s12 said "five differences" while the slice listed four, so a fifth owner was unclear; (2) the three review files were not yet committed.

Disposition: s12 now says five review findings owned by 064-32 AC1 to AC5 (AC5 added for the round 2 craft ordering finding, mapped in the slice-29 Findings); the review files are committed with this round.

verdict: changes-requested
