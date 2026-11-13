---
status: DONE
dependencies: []
last_verified: 2026-11-13
---

## Slice 064-03 — B0: capture tooling

**Goal:** Provide the manifest schema, stored-input-state check, pre-commit credential check and field-rule comparison the capture session needs.

**DoR:**
- ✅ Spec 064 approved (D1).

**Acceptance Criteria:**

1. The recorded wire checker (051-07) rejects a fixture without the full stored-input-state block.
2. A pre-commit test rejects vendor login or session cookies, tokens and VPN or proxy credentials, with positive and negative cases, and runs in `npm test`.
3. Native field-rule evaluation works in the comparator. This part is shared toolkit work landing on main and merged into vendor branches; B0 consumes it and does not fork it.

**DoD:**
- `npm test && npm run lint` and the servo gate pass.

**Anti-horizontal-phasing check:** Tooling task; each check is exercised end to end on a sample fixture.

## Implementation notes

- Shared half on main (commits 219067e5, a0af8bfa, 98694865): `rig/fixture-manifest.mjs` (manifest schema, ADR-0061 point 1), `rig/fixture-credentials.mjs` (point 5; also a repo scan of the fixture roots in `npm test`), `rig/field-rules.mjs` plus `applyFieldRules` in `rig/native-tag-comparison.mjs` (point 10; policy in `rig/native-tag-comparison.md`). One independent Opus 5.5 review ran; its three blocking findings are fixed. Not enforced by code: that each `derived_from` digest names a committed corpus fixture, and that a `volatile` field is truly unrelated to any other value (the held-out check, ADR-0061 point 7, covers both).
- AC1: `probes/adobe-compatibility/stock-wire-check.mjs` now requires a `manifest` block that passes `checkFixtureManifest` with `vendor: "adobe"`. The October consolidation had left the 051-07 checker (and `contract.mjs` and its test) only on the archive tags, so they were restored onto vendor-adobe from the pre-move commit before wiring. The sandbox-seam test was adjusted for Node 22's synchronous module loader.
