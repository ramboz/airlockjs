---
status: READY_FOR_IMPLEMENTATION
dependencies: [065-01]
last_verified: 2026-11-13
---

## Slice 065-04: G0: Google-specific capture tooling

**Goal:** Add only the Google-specific part of the capture tooling. The shared half (manifest schema, stored-input check, credential check, native-side comparator rules and the policy amendment) is built on main by Adobe's B0 (064-03). Do not build it here; point at it and use it.

**DoR:**
- T1 done (the credential allow-list seed).
- Shared half (064-03) on main, merged into this branch. If it has not landed, this slice waits and the owner is told in the report.

**Acceptance Criteria:**

1. The drift-probe recorder exists: part A bytes (library region length and SHA-256, config region recorded) and part B field noise per region (4.1).
2. The field and request classifier output is produced in the shape the shared manifest schema expects.
3. `normaliseDenylist` in `rig/parity/descriptors/google-ads.js` is retired in favor of the frozen per-field classes, once those exist; until then the slice records what blocks it.
4. A capture driver reuses 059-14 and 059-16 pieces where they fit and reuses the shared credential check unchanged.
5. If nothing Google-specific is left after reading 064-03, the slice records that and closes with no code.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- No shared tooling is duplicated from 064-03.

**Source:** spec 065 section 9 and the owner answers in section 12.
