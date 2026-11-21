---
slice: 064-21 — aem-martech, ACDL and Launch (B5)
pass: compliance
round: follow-up 1
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-21 (commits 3be50885, 1a5058a3, 1f751acd; follow-up round 1 reviewed a15457ec; fixes landed in 7e466871 and the next commit, not re-reviewed)
---

# 064-21 compliance

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (high: the set-consent exception pointed to a 064-30 slice and ADR-0064 that do not exist, so it had no owner; medium: the AC3 test could not fail because the rig recorded only Edge hosts; low: slice status, missing review files). Fixed: the consent exception moved to 064-31 AC4 (a real slice and board row); `replayFixture` now returns `allHosts` and the AC3 test reads it. Round 2 changes-requested (medium: request hosts were not compared per request, so the set-consent host exception was not pinned; low: `attachAlloyBridge` header vs behaviour, silent `configure` options, `renderDecisions` forwarded). Fixed: per-request host assertions in the SYNTHETIC test; header corrected; `renderDecisions` defaults to false; 064-31 AC6 added. Round 3 changes-requested at the round cap (medium: per-event `edgeConfigOverrides` and `datasetId` are reported and dropped with no owning AC; low: the `configure` options S10 passes are inert and unnamed, an inexact ADR-0063 line-49 quote, `type` versus `xdm.eventType` precedence unchecked). Fixed after round 3 (docs and comments only): the quote is exact; 064-31 AC7 owns the overrides and `datasetId` disposition (config-pin rule, ask if it needs an ADR), the `type` precedence and the inert `configure` options. No finding is left without an owner.

## Follow-up round 1 (owner-directed: no shipped page global)

Fresh Opus 5.5 reviewer on a15457ec; verdict changes-requested (the author saved this text). This reviewer's findings only. Fixes landed in 7e466871 and were not re-reviewed (no extra round):

- `docs/architecture.md:23` lacked the product-path clause (medium): fixed in 7e466871.
- `alloy-bridge.js:2-5` header spliced into a broken sentence (low): fixed in 7e466871.
- No-global test only created the bridge, never called it (low, optional): fixed in 7e466871 (it now plants a sentinel global and runs every command).
- Note: `git diff` could not be run by the read-only reviewer; the coordinator verified `core/` and the consent mapping are unchanged.
