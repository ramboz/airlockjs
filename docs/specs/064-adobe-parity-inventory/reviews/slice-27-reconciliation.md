---
slice: 064-27 — Alloy storage grant
pass: reconciliation
round: 2
verdict: pass
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompt, slice 064-27 (commits 36fc4348, 4e4b0f5d; local commits, squashed into f248bf3a)
---

# 064-27 reconciliation — Round 2

## Round 1

**Verdict: changes requested. 0 high, 2 medium, 4 low.**

Consistent: code, connector comments, refinement-todo, slice-20/22 pointers, ADR-0062 point 7, spec 067 check 8, CI step and board row.

- **R1 (medium)** `docs/architecture.md`: said Alloy declares no storage keys and that connectors declare `capabilities.storageKeys` (nothing reads it).
- **R2 (medium)** slice-22 AC2 row still said the clientId is not persisted; contradicted the Carried note.
- **R3 (low)** spec 064 slice list and table, and `docs/specs/README.md`, did not mention 064-27.
- **R4 (low)** spec 064 summary line "storage grant not needed" needed a 064-27 pointer.
- **R5 (low)** spec 064 pilot result line said storage seeding is unit-tested only; add a pointer.
- **R6 (low)** slice-17 "ungated" wording reads as open access; say "undeclared".
- **R7 (nit)** slice-27 AC1 attributed the purposes shape to both exports.

## Round 2

**Verdict: pass. 0 high, 0 medium, 3 low.**

All round-1 findings verified fixed, and the TCF key is gone everywhere except the spec 064 inventory row and the slice note explaining why it is not granted. Carried or fixed afterwards: `contracts/capability.d.ts` `storageKeys` wording (fixed: says Alloy supplies its grant through `alloyStorageGrant`); 067-12 slice forward pointer (added); slice-17 double parenthetical (merged). A spec 064 review-log entry is added with DONE. Deviations recorded in the slice notes: TCF hashes not granted, synthetic second-load state, consent through the rig command channel, real `bootAlloy` default now always seeds and writes back the stock keys.
