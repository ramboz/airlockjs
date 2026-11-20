---
slice: 064-27 — Alloy storage grant
pass: compliance
round: 2
verdict: pass
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompt, slice 064-27 (commits 36fc4348, 4e4b0f5d; local commits, squashed into f248bf3a)
---

# 064-27 compliance — Round 2

## Round 1

**Verdict: changes requested. 0 high, 1 medium, 4 low.**

Checked against the pinned `@adobe/alloy@2.31.1` source. The base set (`validation.clientId`, `instance.alloy.debug`) and the consent-hash key format match the source; click data, decisioning and push are rightly excluded.

- **M1 (medium)** `connectors/alloy/connector.js`: `IAB TCF.2.0` was granted, but the chamber's consent driver sends only `Adobe 2.0` (`connectors/alloy/consent.js:95`), so stock code in the chamber never writes it. Breaks AC1 "nothing extra". The stated reason ("the other standard setConsent accepts") was also wrong: `validateSetConsentOptions` accepts any standard.
- **L1** The chamber has no `setDebug` command; `instance.alloy.debug` is written from the `alloy_debug` URL parameter. Fix the evidence wording.
- **L2** The airlock consent arm uses the rig command channel, not `bootAlloy`'s `consent` option. Note the limitation.
- **L3** Per-org purpose arrays were not frozen.
- **L4** No gate record yet (fine while IN_PROGRESS, needed before DONE).

Public-repo check: no private paths, the org ID is already in the corpus, session and cookie values are fake, no future dates.

## Round 2

**Verdict: pass. 0 high, 0 medium, 2 nits.**

All round-1 findings re-verified: M1 fixed (only `Adobe.2.0` granted; TCF deferred until a consent path sends it, recorded in the connector JSDoc and slice notes); L1 fixed (evidence cites `alloy_debug`); L2 accepted and recorded in the slice notes; L3 fixed; L4 recorded (servo gate composite 1.0 pass, `npm test` 2937 passed, lint clean, real-Chromium tests 14/14 twice, GATING step at `ci.yml`).

Nits: `ALLOY_STORAGE_PURPOSES` still built its own frozen arrays (fixed afterwards with the shared `FUNCTIONAL`); the no-org fallback wrapper object is unfrozen (inner values frozen; no practical effect, carried).
