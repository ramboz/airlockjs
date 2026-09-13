---
slice: 045-02 — apply hold-until-granted to alloy (via alloy's native `defaultConsent:"pending"` queue, preserving 034-01)
pass: compliance
verdict: pass
reviewer: general-purpose (jig compliance, opus)
reviewed_at: 2026-09-13T01:15:49Z
prompt_source: review.py implementation ... 045-02 <deliverables>
---

VERDICT: pass

REASONING:
All five acceptance criteria are met by the deliverables with meaningful, non-vacuous tests. The pending→`defaultConsent:"pending"` mapping is correctly the *only* behavioral change: `shapeAlloyBoot` (`connectors/alloy/consent.js:146-159`) returns byte-identical `setConsentOptions === shapeAlloyConsent(vector)` for granted/denied and both-undefined for a null vector, so granted/denied/no-vector boots are byte-unchanged. The seam is genuinely untouched — `core/wrapped-sdk-host.js` is +15/-0 (JSDoc + the additive `setConsent` handle at `:602`), the strip region `:336-402` is byte-identical, and `core/consent.js`/`core/airlock.js` are not in the change set at all. The native queue+flush is grounded by the committed creds-free rig. The coverage split the implementer flagged is adequate.

SPECIFIC ISSUES:
(none blocking)
- `connectors/alloy/alloy-chamber.worker.js:530-543` (observation, Low) — no vitest test drives the chamber-side `applyConsent` handler end-to-end (`{type:"setConsent"}` → `self.alloy("setConsent", …)`). Grounded transitively: the message boundary is tested on both sides (`test/wrapped-sdk-host.test.js` posts; `test/eds-boot-alloy.test.js` asserts the adapter posts + mutates `consentRef`), `shapeAlloyConsent` is unit-tested, and alloy's actual flush-on-`setConsent(y)` is grounded by `rig/alloy-consent-pending.mjs`. Consistent with the repo's convention of grounding worker glue via rigs. Not a defect.

Correctness deep-dive (no bug found): under pending, alloy's `sendEvent` stays queued, so the single-slot `driveEvent` stays occupied and the adapter tail chain holds later events — resolves cleanly and in order on grant, NOT the seam-hold deadlock the slice rejected (no intercepted fetch is issued under the native queue, so the `timeoutMs` timer at `:434` never arms). The adapter ordering — mutate `consentRef` (a) then `host.setConsent` (b) at `adapters/eds/index.js:1381-1382` — is load-bearing per A2 and correct.

Vacuous-test check: all new `it` blocks fail if the feature is removed. None vacuous.

RECONCILIATION NOTES (must complete before DONE; slice is IN_PROGRESS):
1. Record the approach deviation in the deviation log (AC1 requires it): the parent `spec.md:76-79` describes 045-02 as seam-side "refine pending→DROP to hold+flush"; the implementation instead uses alloy's NATIVE `defaultConsent:"pending"` queue + a host→chamber `setConsent` message. Thoroughly documented in the slice body + grounded by the rig (not undocumented drift), but the `### Deviation log` entry (pivot rationale + 2026-09-12 creds-free grounding) still needs writing.
2. ADR-0023 A1 amendment (slice close-out :122-123): A1 originally named the seam hold+flush; amend to the native-queue realization citing rig/alloy-consent-pending.mjs.
3. Spec 045 roll-up + board regen when 045-01 (DONE) + 045-02 are both DONE.

Rig runnability: rig/alloy-consent-pending.mjs depends on the gitignored probe-local bundle; exits code 2 with a clear remediation if absent — the established alloy-rig posture, creds-free (synthetic ids, stubbed Edge). Not a finding.

---
Reviewer substrate: general-purpose subagent (Opus), read-only, jig compliance rubric. Verified all ACs against deliverables + tests, the byte-unchanged seam (git diff), core-seal untouched, and a no-deadlock correctness deep-dive.
