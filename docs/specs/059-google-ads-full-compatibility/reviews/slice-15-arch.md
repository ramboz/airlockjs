---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-21T00:54:35Z
prompt_source: Native capture architecture 8a1101ae-4070-43e5-ac08-748c22a86b2a source-cohort delta turn1
substrate: not-shown
applied_skill: none
---

VERDICT: pass

REASONING:
Summary: Pre-admission tooling preserves Airlock's runtime boundaries and stable core within ADR-0034's inspected-Meta exception. Strengths: The shared SDK-absent/native engine, reservation-backed private lease and fixed raw relay provide controls without becoming a general proxy framework. Concerns: No blocking architectural defect found; trusted provenance, local qualification and native acceptance stay separate, with reconciliation required. Open question: Will unexecuted SDK/collector branches fit the supported surface and finite envelope with complete originals?

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-meta-stock.mjs:340 — high confidence: reviewed guard evidence precedes execution without circular native-completeness claims; consumption/processing are evaluated afterward.
- [strength][impl] rig/inspected-meta-stock.mjs:667 — high confidence: permission binds original authority path/hash/device/inode/canonical slot; reservation precedes execution and native lease creation independently of output path.
- [strength][impl] rig/inspected-transport.mjs:145 — high confidence: fixed destination/SNI/port and default-CA validation behind a private one-use lease; local fixtures cannot select native routing or custom trust.
- [strength][impl] rig/inspected-http-wire.mjs:387 — high confidence: every physical attempt receives pre-forward count and decoded semantic checks, including hidden retries.
- [strength][impl] rig/inspected-meta-stock.mjs:380 — high confidence: complete shared source/dependency closure, referenced originals and post-exit real-expiry failure witnesses are verified.
- [nit][impl] Open slice checkpoint — high confidence: reconcile formerly pending deadline/craft wording with completed corrections and current-source evidence, preserving historical stages and the local/native distinction.

RECONCILIATION NOTES:
Record shared engine/private lease, affirmative source-authentication gate and real publication-expiry proof. Preserve initial failures and stale400-test index. No stable-core change or expansion to Google/production/nativeTLS parity is justified. Actual original-location permission, current setup/source/coordination/window bindings, reconciliation and native behavior remain outstanding. No READY/DONE, SDK/public execution, CLI activation, slot spend or downstream acceptance follows. Review was read-only with no commands/tests or observed command exit.

SOURCE-COHORT DELTA REREVIEW — 8a1101ae-4070-43e5-ac08-748c22a86b2a, turn1
VERDICT: pass
The source-pair/selection/label delta preserves the pre-admission architecture: one closed immutable matched pair is added, historical data remains, eligibility is not execution authority. Pair checks reject mixing without wider URLs/collector policy; source-body reads, review evidence, original-location and canonical-slot checks stay gated. Explicit report/capture labels avoid relabelling historical/synthetic evidence. No ADR0034 expansion or stable-core change is indicated. Preserve acquisition failure separately from its complete authenticated body; initialization-only discovery and unexecuted configuration establish no stock reference. No reviewer command/test execution or observed exit is claimed.

PARENT CURRENT-SOURCE VERIFICATION (not performed by the reviewer):
99 controller tests plus319 relay/policy/decoder/reservation regressions passed; one older browser opt-in was not run. All14 SDK-absent controller cases and11 relay cohorts passed complete current-source and child-original/finalization-failure qualification-index verification. No original event slot, live case or PageView follows.

OFFLINE MDC POLICY DELTA — 2026-10-21, 8a1101ae-4070-43e5-ac08-748c22a86b2a, turn6
VERDICT: pass

The architecture review covered only the two policy/test files. The cohort
comes from the exact matched source pair, not a caller permission switch;
historical vocabulary is not broadened. Existing URL/work limits bound the
fixed metadata shape and original-token duplicate check. No framework,
configuration surface, dependency, frozen contract or production boundary was
added. Ownership, GET/Image routing and false dispatch/source/authentication
claims remain intact. No blocker or material leanness nit was found.

This is observed-cohort eligibility coverage, not retrospective acceptance
of the actual spent/inconclusive stock case. The canonical original slot
remains nonrefundable; no retry, new namespace or candidate substitution is
permitted. Decoded metadata semantics, complete native behavior and product
outcomes remain unproved. No ADR-0034 scope expansion is indicated. No
commands/tests, networking, browser/SDK execution, edits or independent
qualification rehash were performed by the reviewer.
