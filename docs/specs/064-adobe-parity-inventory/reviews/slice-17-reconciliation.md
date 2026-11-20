---
slice: 064-17 — B1: Environment snapshot and storage seeding (pilot)
pass: reconciliation
round: 1
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T15:55:00Z
prompt_source: review prompt, slice 064-17 (commit 37373e33)
---

# 064-17 reconciliation — Round 1

**Verdict: pass. 0 blocking findings, 6 non-blocking.**

Scope: slice notes (lines 34-45) checked against the code and fixtures; spec 064 sections 4.3,
4.11, 11 (D8) and 12; ADR-0061 point 1; ADR-0062 points 2, 3, 5 and 7; `docs/specs/README.md`;
the 067-08 and 067-03 hand-offs; and `slice-18-b2-egress-bridge.md`.

## What reconciles

- **Pilot count.** "0 extra captures" is the same in the slice note (line 39), spec 4.11
  (`spec.md:219`) and section 12 (`spec.md:534`). The two derived inputs (page title, 15 px
  scrollbar) are in the rig (`rig/adobe-b1-replay.mjs:23`, `:85`, `:108`) and both come from the
  corpus. Kill criterion not triggered.
- **D8 / ADR-0062 point 2.** The stock default `context` is fed by real values, the three named
  shims are gone, and the denylist stays on (compliance AC1).
- **ADR-0061 point 1.** The before-state is seeded before page load. The storage-coverage limit is
  disclosed in two places (slice line 44, spec 4.11).
- **067-08 hand-offs.** `location` fallback: answered (slice line 41, code `stock-shim.js:93-97`,
  replay test). Apex probe: done (line 40). The default `location` placeholder (067-08 note line
  44) is now removed, as 067-08 said 064-17 would do. The chamber's real-bundle run that 067-08
  left untested (067-08 note line 45) is now covered by the replay.
- **Host order and ceiling.** The note for 064-18 (line 45) matches the fixtures:
  `s1-*` and `s5-fresh` → `adobedc.demdex.net`, `s2-*` → `edge.adobedc.net/ee/or2/v1/interact`,
  `s5-returning` sends nothing.

## Findings

### R1 — non-blocking: the board row is stale

`docs/specs/README.md:202` still shows 064-17 as `READY_FOR_IMPLEMENTATION`. The slice frontmatter
says `IN_PROGRESS`. Update it with the jig transition helper, together with the move to DONE.

### R2 — non-blocking: the notes are dated after the commit

The slice note header (line 34) and spec section 12 (`spec.md:534`) say 2026-11-20. Commit
`37373e33` and this review are dated 2026-11-20. Correct the date.

### R3 — non-blocking: the two carried hand-offs have no owner

- **Stale consent cookie (067-03)**, slice line 43: it is carried with "still open", but no slice
  or `refinement-todo.md` entry owns it. Name the owner. The S6 consent rows sit with B2/B3
  (064-18/064-19) per section 8, and 064-18 already depends on 067-03.
- **High-entropy client hints (067-08)**, slice line 42: it says "a later slice" without naming
  one. Stock 2.31.1 only collects them with `highEntropyUserAgentHints` in `context`, so default
  parity is not affected. Still, the B1 goal line names "client hints", so name the slice that owns
  `s13-default`/`s13-vpn-ch`, or record the hand-off in `refinement-todo.md`.

### R4 — non-blocking: the context floor and the URL fallback are recorded only in the slice file

Two behaviour changes that last are written only in the slice notes:

1. With any `context`, including `[]`, `origin/protocol/host/hostname` always cross
   (craft K3). This changes the 067-08 contract that `context: []` sends nothing
   (`test/eds-boot-alloy.test.js:332-335`).
2. The host-root `href` fallback, for a denylisted `url` and for an unlisted `web` (craft K2).

ADR-0062 point 2 says "the worker no longer fakes page values", and point 3 makes context
narrowing an opt-in control. Record both as deliberate differences in ADR-0062's consequences or
in `docs/decisions/lightweight-decisions.md`, so 064-15 (B7, the compatibility report) can list
them.

### R5 — non-blocking: a connector comment is stale

`connectors/alloy/connector.js:67` says the real storage keys "are grounded with Adobe 064-17". The
slice now says the opposite: the corpus has no storage before-state, so `ALLOY_STORAGE_NAMES` stays
ungated (slice line 44). Change the comment to name the actual owner, or point to the 4.11 carried
limit.

### R6 — non-blocking: the 064-18 hand-off is not in 064-18's file

The ceiling findings for B2 (slice line 45) are the reason the replay compares the pre-seal tee.
They are a known gap against ADR-0062 point 7 ("the default allowlist covers every destination the
stock tag contacts"): today the ceiling is `[ALLOY_INTERACT_ENDPOINT]` only
(`adapters/eds/index.js` near `endpointCeiling`). `slice-18-b2-egress-bridge.md` has only
`064-17` in its dependencies (line 3) and no hand-off text. Copy the hand-off there, as 067-08 did
for this slice. Four items for 064-18:

- Bring `edge.adobedc.net/ee/<cluster>/v1/interact` and `adobedc.demdex.net/ee/v1/identity/acquire`
  within the ceiling. Then switch the S2 and S5 comparisons from the `rig-observed` tee to the
  network and assert the `getIdentity` result for `s5-fresh`.
- Make the network-header check required for every fixture that reaches the network
  (compliance C3).
- Apply ADR-0062 point 5 in the replay: supply a recorded consent state instead of
  `consentHold: false` (craft K4).
- Reuse `rig/adobe-b1-replay.mjs` rather than forking it. Its `diffBodies` and `GENERATED` table
  are the comparison 064-18 will extend.
