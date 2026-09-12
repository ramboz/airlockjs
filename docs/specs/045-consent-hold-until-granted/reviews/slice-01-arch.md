---
slice: 045-01 — the core seal `holdOnDenied` opt-in mode (egressVerdict + createAirlock)
pass: arch
verdict: pass
reviewer: general-purpose (arch-review skill, opus) — re-verify
reviewed_at: 2026-09-12T16:47:18Z
prompt_source: review.py arch-review --richer-skill arch-review ... 045-01 <deliverables> (resumed re-verification)
substrate: not-shown
applied_skill: none
---

VERDICT: pass

(Re-verification, supersedes the prior needs-changes. Reviewer independently re-read the current code, frozen contract, docs, and tests — not the coordinator's summary.)

REASONING:
Both prior blockers are cleared. The `event` re-map channel is now an additive-optional member of the frozen `EgressRequest` (contracts/connector.d.ts:105), its producer is stated (the connector's own `handle(event)`, threaded verbatim by `createConnectorHost` at connector-host.js:76, which is genuinely pass-through), and the producer home is committed: 044-02's ACs now own attaching `event` and wiring `remap` with a grant-re-mapped-not-re-sent assertion (slice-02-denied-seal-hold.md:41). The silent-re-send footgun is now observable at both buffer time (airlock.js:474, "NO re-map wired ... will RE-SEND ... verbatim") and flush time (airlock.js:798, "flushed VERBATIM"), and it still flushes rather than dropping a legitimate consent-independent payload. All four nits landed too: the re-mapped flush URL is re-checked against the host endpoint ceiling (airlock.js:772, scoped to `b.remap`), a declined re-map emits a beaconId-chained `dropped` record (airlock.js:758), the fan-out 1:1 limit is recorded in four artifacts, and AC4 now matches the code. The core mechanism was already sound and back-compat; the gaps were contract-documentation, observability, and a trust-boundary re-check, and all three are now closed and tested.

SPECIFIC ISSUES:
- [strength][spec] contracts/connector.d.ts:105 — Blocker 1 cleared. `readonly event?: AirlockEvent` is documented as the 045-01/ADR-0023 re-map channel, additive-optional per ADR-0017, with the producer named and the 1:1 fan-out limit stated inline. The reader (airlock.js:452) is no longer against an undefined field, and 044-02 (DoR + AC1/AC2/AC4) now owns event-threading, `remap` wiring, and the re-map-not-re-send assertion.
- [strength][impl] core/airlock.js:474,798 — Blocker 2 cleared. An opted-in instance that buffers a verbatim re-send now flags the stale/non-parity footgun at both hold and flush, tested at consent-seal.test.js (held reason contains "RE-SEND"; flushed reason contains "VERBATIM"). Bonus: the held reason now derives denied-vs-pending from `resolveConsent` (airlock.js:468), fixing a latent mislabel where the reason keyed off `canRemap`.
- [strength][impl] core/airlock.js:772 — The re-mapped flush URL is re-checked via `checkEndpointCeiling(req.url, endpoints)` (gated `b.remap && ceiling.length`); an off-ceiling re-map is held, never egressed (tested). This closes the AD-5 / ADR-0006 seal-completeness gap for the connector-recomputed flush URL, while re-send keeps pre-existing 017-03 behavior.
- [strength][impl] core/airlock.js:758 — A declined re-map (no beacon) emits a terminal beaconId-chained `dropped` record instead of vanishing silently (tested).
- [strength][spec] docs/decisions/adr-0023...:59 — The "Landed shape + scope" clause now states the re-map is wired-but-inactive until a consumer supplies `remap` + `event`, names the footgun diagnostic and ceiling re-check, records the fan-out limit, and scopes the mid-session-ctx-refresh claim to the grant-flush direction. The ADR now matches what was built and the two-path model (core seal vs wrapped-sdk-host, untouched) remains coherent.

RECONCILIATION NOTES:
- One close-out item remains open by design: docs/architecture.md's seal/consent description does not yet note the `holdOnDenied` mode or the `EgressRequest.event` channel. Deferred to the post-REVIEWED reconciliation phase, which matches the slice's own close-out checklist. It should land before DONE, but it does not block the REVIEWED transition.
- The strengths above (verdict monotonicity with strict precedence, beaconId held-flushed chain across re-map, sync-path drop-at-teardown, ceiling re-check, footgun observability) belong in the deviation log as ratified design.
- Scope-limitations: static read-only re-review of the current working tree; did not run the suite, build, or lint. Coordinator reports 1596 passed / 0 fail and eslint 0; the re-map end-to-end against a real opted-in connector is still exercised only by a FakeWorker fixture here (real wiring is 044-02, now committed to own it).

---
Reviewer substrate: general-purpose subagent (Opus), read-only, richer arch-review rubric — re-verification pass (resumed with prior context).
