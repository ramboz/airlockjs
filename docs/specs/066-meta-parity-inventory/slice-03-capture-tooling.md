---
status: READY_FOR_IMPLEMENTATION
dependencies: [066-01]
last_verified: 2026-11-13
---

## Slice 066-03: MT0, Meta capture tooling on top of the shared 064-03 tooling

**Goal:** The Meta capture session has what it needs. The shared half (manifest schema, stored-input check, credential check, native-side comparator rules) is built on main by the Adobe B0 child (064-03). This slice points at it and adds only the Meta-specific configuration. If nothing Meta-specific is left once 064-03 lands, the slice closes with that finding.

**DoR:**
- Spec 066 approved by the owner as amended (O1, 2026-11-13).
- The shared tooling is on main (since 98694865) and `vendor-meta-pixel` contains it: `rig/fixture-manifest.mjs`, `rig/fixture-credentials.mjs`, `rig/field-rules.mjs`, `rig/native-tag-comparison.mjs` and the policy in `rig/native-tag-comparison.md`. Checked at start. This line replaces the earlier stale note that 064-03 was not on main (corrected 2026-11-13).
- 066-01 is done, so the field and request lists exist.

**Acceptance Criteria:**

1. The Meta capture run uses the shared manifest schema, stored-input check, credential check (4.3, as a repository test) and native-side comparator rules from main. No copy of them is made on this branch.
2. Meta-specific pieces exist: a no-abort native recorder that records full request and response fan-out (never aborting or dropping native requests, 4.2), headed and headless modes, EEA egress routing recorded as a label plus an opaque ID, and the fixture/manifest layout for corpus S0 to S18 (section 5).
3. The credential check runs over a seeded bad fixture and fails it, and passes a clean one.
4. No vendor contact and no capture. Tooling and its tests only.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass. Tests for AC 2 and 3 are in the repository.
- Spec 066 section 7 notes what the shared tooling supplied and what was added here.

**Consumers:** 066-04 (CAP).

**Anti-horizontal-phasing check:** This is capture-session tooling, a pre-capture task with its own completion check (ADR-0061 point 7). The first slice (M1) exercises it end to end.
