---
slice: 045-03 — seal N-beacon fan-out re-map (per-beacon `remapKey`)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T17:35:17Z
prompt_source: review.py implementation ... 045-03 core/airlock.js contracts/connector.d.ts test/consent-seal.test.js
---

VERDICT: pass (compliance re-review — all 4 ACs met; the prior needs-changes reconciliation items are all addressed)

REASONING:
All four ACs met against a green suite (106 files / 1643 tests; eslint exit 0). Additive-optional EgressRequest.remapKey in the contract with the fan-out note flipped to "supported"; the seal preserves remapKey hold→flush and threads it into remap; the 2-beacon fan-out proof is non-vacuous (fails if key-threading is deleted); 1:1 backward-compat is byte-identical (pre-existing 045-01 exact-arity assertion passes unmodified). Previously-flagged items all addressed: ADR-0024 status: Accepted + "Landed shape + scope"; deviation log + reconciliation sweep written; architecture.md seal note names the remapKey fan-out; refinement-todo limit (b) struck through RESOLVED.

Findings by AC:
- AC1 (contract): met. contracts/connector.d.ts:124 adds readonly remapKey?: string (doc :105-124); the event-channel note :100-102 updated from "not yet supported" → "fan-out IS supported via remapKey"; no stale "not supported" text remains.
- AC2 (seal carries + threads): met. Hold core/airlock.js:461 records remapKey; flush :762-766 threads it. Witnessed by test/consent-seal.test.js:618-647 (key-aware remap per beacon, two distinct URLs, not-swapped/not-duplicated). Vacuous-check: deleting the 3rd-arg threading → remap returns null for both → 0 fetches → test fails. Genuinely fails if feature removed.
- AC3 (backward-compat + declined-key + ceiling): met. 2-arg shape preserved for 1:1 (verified by exact-arity assertion :361 unchanged + backward-compat test :541-558). Declined-key reuses terminal dropped (:771-781), proven per-beacon at :649-675. Ceiling re-check runs inside the per-beacon loop (:790-803).
- AC4 (behavior-preserving + accepted): met. Full suite green; eslint exit 0; ADR-0024 Accepted; frontmatter arch_review/frame_review true.

RECONCILIATION NOTES:
- Conditional 3rd-arg threading deviation already recorded in the deviation log with sound rationale — no further action.
- Forward-looking robustness note (NOT a 045-03 defect; pre-existing 045-01 loop): the flush splices heldBeacons empty before iterating (:749-750) and the remap call (:762-766) is unguarded, so a remap that THROWS on one key would lose already-spliced sibling beacons. Fan-out amplifies blast radius 1→N. Worth a try/per-beacon guard when Floodlight's createFloodlightRemap lands (046-03). Recorded in the 045-03 deviation-log sweep + carried to 046-03.

Reviewer: general-purpose subagent, compliance re-review, read-only, no implementation context; ran the full suite + eslint.
