---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified: 2026-11-13
---

## Slice 065-02: T2: Candidate settings list from Google's public docs

**Goal:** List the candidate account settings from Google's public docs and a read-only probe, page-side or console-side, each with its triggering page input, and the completeness table skeleton, including the combined state.

**DoR:**
- Spec 065 approved (D1). Section 6 holds the current candidate list: enhanced conversions and user-provided data, cross-domain and linker, first-party cookies.
- Docs reading only. No console change and no account access.

**Acceptance Criteria:**

1. Each candidate has a trigger (page or console), its triggering page input, and the three no-effect conditions (propagation wait, served config bytes checked, triggering input present).
2. At least one combined-settings state is defined (S15).
3. The D8 features (enhanced conversions including leads, website calls with an eligible call resource, new-customer acquisition) are listed as console checks for the settings window. Anything absent becomes `blocked: account-ineligible`.
4. The completeness table skeleton (7.1) is written. New rows count against kill criterion 4.

**DoD:**
- Spec 065 section 6 updated and the review log notes the change.
- `npm run lint` passes. Spec lint passes.

**Source:** spec 065 section 9 and the owner answers in section 12.
