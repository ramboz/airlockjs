---
slice: 045-01 — the core seal `holdOnDenied` opt-in mode (egressVerdict + createAirlock)
pass: compliance
verdict: pass
reviewer: general-purpose (jig compliance, opus) — re-verify
reviewed_at: 2026-09-12T16:47:17Z
prompt_source: review.py implementation ... 045-01 <deliverables> (resumed re-verification)
---

VERDICT: pass

(Re-verification, supersedes the prior needs-changes. Reviewer independently re-read the current code + tests — not the coordinator's summary.)

REASONING:
My blocker is cleared. The held-diagnostic `reason` is now derived from the ACTUAL consent state — `deniedCause = holdOnDenied && egressPurposes.some((p) => resolveConsent(consentVector, p) === "denied")` (`core/airlock.js:468`, with `resolveConsent` imported at `:31`) — driving `stateWord` independently of `canRemap` (`:469-477`), so both mislabel directions are gone; the non-opted-in path still emits exactly `"purpose pending — held at the seal"` (`:476`, byte-unchanged). Two new tests pin the exact scenarios I flagged and are non-vacuous: `consent-seal.test.js:447` (denied+no-remap → reason names "denied" and flags the RE-SEND footgun; would read "pending" under the old canRemap-keyed code) and `:462` (pending on an opted-in re-map instance → reason names "pending"; would read "denied" under the old code). `core/consent.js` `egressVerdict` is unchanged from my prior pass (escalation intact at `:125`). All five ACs remain met with meaningful, feature-coupled tests.

The three arch-review additions are genuinely implemented (not just asserted): the declined-remap terminal `dropped` record (`airlock.js:752-762`), the re-map flush endpoint-ceiling re-check via the real `checkEndpointCeiling` (`:771-784`, imported from `core/endpoint-ceiling.js:73`), and the verbatim-flush footgun reason (`:797-798`) — each proven by a coupled test (`consent-seal.test.js:492`, `:515`, `:477`) that fails if the behavior is reverted (0 diagnostics / a fired fetch to `evil.example` / missing "VERBATIM"). The off-ceiling re-check is a real security hardening: a connector-controlled re-mapped URL can no longer egress to an undeclared origin. Could not run the suite (read-only), but the code, symbols, and test expectations are internally consistent with the reported green run (coordinator: 103 files / 1596 passed, eslint 0).

SPECIFIC ISSUES:
(none blocking)

RECONCILIATION NOTES:
- Blocker CONFIRMED cleared; SPECIFIC ISSUES #1–#3 from the prior review all remediated (reason state-derived; two reason-pinning tests added; buffering-site comment reworded accurately at `airlock.js:443-451`).
- Post-REVIEWED reconciliation items still open (not review blockers): `docs/architecture.md` still has no `holdOnDenied`/seal-mode note; deviation log + reconciliation sweep in `slice-01-seal-hold-mode.md:92-98` remain `_(pending implementation)_`; ADR-0023 close-out box `:102` unticked (the ADR itself is already `status: Accepted`). The deviation log should now also record the re-map-on-grant fold, the state-derived held reason, and the three arch-review robustness additions.
- Non-blocking forward observation: the flush-time endpoint-ceiling re-check is deliberately scoped to re-map items (`airlock.js:771` gates on `b.remap`); a verbatim RE-SEND flush still egresses the chamber-supplied URL without a flush-time ceiling check. This is pre-existing 017-03 behavior consciously preserved as byte-unchanged (out of scope here), but worth a forward note since the re-map path now closes that gap only on its own side.

---
Reviewer substrate: general-purpose subagent (Opus), read-only, jig compliance rubric — re-verification pass (resumed with prior context).
