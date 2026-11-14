---
status: IN_PROGRESS
dependencies: [065-01]
last_verified: 2026-11-13
claimed_by: google-g0-capture-tooling
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

### Deviation log

- DoR: 064-03 is present (`rig/fixture-manifest.mjs`, `fixture-credentials.mjs`, `field-rules.mjs`, `native-tag-comparison.mjs`). Nothing in it covers the Google-specific half, so AC5 does not apply and code was written (`rig/google-capture.mjs`, `rig/google-capture.test.mjs`). The shared modules are imported, not copied.
- AC1: `recordDriftProbeA` takes the config-region locator as an injected function, because the region boundary is only known from the served bytes. `recordFieldNoise` records part B per region and request slot. Neither is tied to today's row list.
- AC2: `classifyRecordings` returns the comparator's `rules.fields` array (shared `fieldRuleShape` and `evaluateFieldRule` validate every rule) plus request classes, fixed fields and unstable fields. Seeds are a parameter, with the spec 3.2 generated and `dma` seeds as the default. A varying field with no seed is reported unstable, never defaulted. Form-body fields can only be compared as a whole (`body_utf8`), because the comparator's selectors cover query, header and body only.
- AC3 is blocked, not done. `normaliseDenylist` stays in `rig/parity/descriptors/google-ads.js`. It waits on (a) a capture session (CAP, spec 065 section 0: nothing live runs before it), (b) the freeze commit that records the per-field classes (waiting on the owner's answer to kill criterion 6 from T3), and (c) a wiring decision, because the same-protocol oracle reads a `normaliseDenylist` list and has no field-class input yet. Retiring it earlier would drop the `normalised-out` reporting without a replacement.
- AC4: reuses 059-16's `createPrivateOutput` and `CAPS` (`rig/chamber-capture.mjs`) and 059-16's `sha256` from `rig/attempt-evidence-io.mjs`. The 059-14 browser-admission adapter is not on this branch, and its fulfil-or-abort loopback path is for local no-send controls, so it does not fit a live no-abort recorder. The recorder here subscribes to page events only. `storeRecording` runs the shared manifest check and the shared credential scan unchanged, after a cookie-name allow-list check seeded from spec 3.4.
- Not built: browser launch, network and any real capture (CAP, slice 065-05).

### Reconciliation sweep

- Spec 065 sections 1, 2, 6, 7.1, 10 and 12 untouched (owner decision pending). Spec 13 notes the slice. No ADR change. No shared code duplicated from 064-03. `normaliseDenylist` retirement carried to the freeze.
