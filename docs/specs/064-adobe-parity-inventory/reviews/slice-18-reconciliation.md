---
slice: 064-18 — B2: Egress bridge
pass: reconciliation
round: 2
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:35:00Z
prompt_source: review prompt, slice 064-18 (uncommitted worktree diff)
---

# 064-18 reconciliation — Round 1

**Verdict: pass. 0 blocking findings, 5 non-blocking.**

## What reconciles

- **Status.** Slice front matter is `DONE` with `last_verified: 2026-11-20`, and the board row
  agrees (`docs/specs/README.md:203`).
- **Slice notes vs code.** Init whitelist, beacon route, `unbridged-load` tags, status-0
  `TypeError`, `{hint}` allowlist, `edgeDomain`, 10 known handle types, the B3 hand-off (rig
  `respond`, `extraHosts`, `responses`, `diagnostics`, `rig:sendBeacon`, `rig:loadElement`) all
  exist as described. The CI gating step is added (`.github/workflows/ci.yml:104-108`).
- **Handle-rate claim (spec s6.5, `spec.md:406`; s10, `spec.md:481`).** Recomputed from
  `test/fixtures/adobe-capture`: 46 fixtures, 6 types (`identity:result`, `state:store`,
  `locationHint:result` 59 each; `personalization:decisions` 46; `identity:exchange` 5;
  `consent:preferences` 5). 4 of the 8 consumed types are observed, plus 2 ignored ones, and 0 are
  outside the list. The claim holds.
- **Extra captures: 1** is in both the slice note and spec s13 (`spec.md:540-542`).

## Findings

- **R1 — Low — `spec.md:406`.** "200 JSON responses" reads as a count. The corpus has 64 HTTP-200
  vendor responses and 59 parseable 2xx JSON bodies. Write "59 HTTP 200 JSON responses".
- **R2 — Low — `spec.md:481`.** The handle half is "0 of 6" against the known list, but s10
  defines the metric as "not covered by S9". The two ignored types were added to the list from
  this same corpus, so the 0% follows from how the list was built. Say so in one clause. The
  combined rate (7 / 42 = 16.7%) is not stated; state it or say the halves are reported apart.
- **R3 — Low — `spec.md:67`.** The s2.2 Transport row still says the init "is dropped ...
  today", "`sendBeacon` is denied", and loads are "inert". The table is frozen, so leave it, but
  the slice note or a s12 line should say B2 changed all three.
- **R4 — Low — `docs/refinement-todo.md:646`.** It still describes the Alloy ceiling as the
  `ALLOY_INTERACT_ENDPOINT` floor with demdex breadth held. The Edge paths are now allowed and
  only the ID-sync pixel hosts stay out (tagged, not held). Update it, or point it at 064-22.
- **R5 — Low — `spec.md:522-534`.** The s12 review log has no 064-18 line yet. Add one after the
  rounds close, as was done for 064-02.

## Carried, confirmed

- 067-03 residual (a stale "in" cookie with pending page consent drops instead of holding): still
  open. `s6-pending-in` replays only set-consent, which matches the carried note.
- "Upstream to main later" for the three core files matches the low regression risk in the craft
  pass.

## Round 2

**Verdict: pass. 0 blocking findings, 3 non-blocking.**

- **R1 — fixed.** `spec.md:406` now says "59 HTTP 200 JSON responses".
- **R2 — fixed.** `spec.md:481` says the handle 0% follows from how the list was built, and states
  the combined rate (7 / 42 = 16.7%).
- **R3 — fixed.** The s12 064-18 line (`spec.md:534`) names the three s2.2 Transport facts B2
  changed and leaves the frozen table alone.
- **R4 — fixed.** `docs/refinement-todo.md:645-648` describes `ALLOY_STOCK_ENDPOINTS` and points
  ID-sync pixels at 064-22.
- **R5 — fixed.** s12 has a 064-18 line (`spec.md:534`).
- **"Extra capture needed" moved.** The s13 subsection is gone; s13 reads "None open", and s12 ties
  the first-party CNAME edge domain to the existing CAP freeze gap (DS-29, S9-06). Matches the ask.
- **Slice notes vs code.** The keepalive tracker, the `networkError` split, and the carried list
  (C3, C4, C5, F2, F3, the `r0Origin` nit, 067-03, upstream) all match the diff and this round's review.

New findings:

- **R6 — Low — `slice-18-b2-egress-bridge.md:36`.** "see spec 064 end" now points at nothing; the
  note lives in s12 (`spec.md:534`). Point it there.
- **R7 — Low — `spec.md:534`.** "6 non-blocking per pass" is off: round 1 had 3 (compliance),
  6 (craft) and 5 (reconciliation). Write "14 non-blocking across the three passes" or list them.
- **R8 — Low — `test/adobe-b2-egress.test.js:99-111` vs the carried 067-03 note.** The new test
  runs the same scenario as the 067-03 residual (stale "in" cookie, page consent pending) and calls
  it "held once". Both are true (the seam holds and rejects it; it is not replayed on grant), but a
  reader could take the test as closing 067-03. One clause in the carried note would stop that.
