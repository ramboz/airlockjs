---
status: IN_PROGRESS
skill: jig:spec-workflow
use_cases: [UC-2, UC-7]
---

# Spec 069: Airlock martech library (ADR-0065)

> Implements [ADR-0065](../../decisions/adr-0065-airlock-martech-library.md) (Proposed 2026-11-21; slices are built only after the owner accepts it).
> Pinned inputs: `aem-martech` 1aa3dee3 `src/index.js` (Apache-2.0), Alloy 2.31.1, the frozen S10 corpus. Definition of done: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md).
> Lives on `vendor-adobe` with the Alloy connector work.

## 0. Summary for the owner

**What changes.** A new module, `adapters/eds/martech.js`, gives Adobe EDS sites the `aem-martech` calls (`initMartech`, `martechEager`, `martechLazy`, `martechDelayed`, `updateUserConsent`, `sendEvent` and the rest) on top of the Airlock `bootAlloy` handle. Alloy runs in the chamber. No `window.alloy` exists.

**Why it matters.** The stock `aem-martech` needs a page-global `alloy` and loads Alloy on the main thread. The owner declined shipping that global (2026-11-20). This library is the product path for Adobe sites that today use `aem-martech`.

**Main tradeoff.** Source-compatible at the export level, not a drop-in for code that calls `window.alloy` directly. `martechDelayed` does not load Launch containers.

**What needs you.** Acceptance of the ADR. The owner already picked Option A for the data layer; the one open choice (an explicit `installAdobeDataLayerProxy()` method, not a config flag) is stated in the ADR.

## 1. Scope

In scope: the library, Airlock's generic data layer (no ACDL, no `adobeDataLayer` by default) with an opt-in `adobeDataLayer` migration proxy, the three handle additions it needs (`handle.sendEvent`, `handle.applyPropositions({ viewName })`, a settling `handle.setAdobeConsent`), the S10 differential's third arm, the docs.

Out of scope: Launch container loading, a package split, freezing the library under ADR-0017, any `core/` change, any ADR-0063 allowlist change.

## 2. Decomposition

| Slice | One line |
|---|---|
| [069-01](slice-01-handle-results.md) | The handle returns what stock returns: `sendEvent` result, the hook's `xdm`, a throwing hook, `applyPropositions({ viewName })`, a settling `setAdobeConsent` |
| [069-02](slice-02-generic-data-layer.md) | Airlock's generic data layer, no ACDL and no `adobeDataLayer` by default (`push({ event, ...params })`, `getState`, state pushes; O(1) validate-and-append), plus an opt-in `adobeDataLayer` migration proxy and the dispositions for what ACDL gave that cannot cross the airlock |
| [069-03](slice-03-martech-library.md) | `adapters/eds/martech.js`: the 14 `aem-martech` exports on the handle, no page global, proven against the recording and the stock run |
| [069-04](slice-04-proxy-trap-free-detection.md) | Overflow of 069-02 AC2: trap-free rejection of a pushed `Proxy`, or the residual three-trap exposure accepted with its threat model |
| [069-05](slice-05-library-display-flows.md) | Required for 069-03 AC6 (owner, 2026-11-23): real-Chromium personalization-off, late-display and synthetic-offer flows of the library |

Order: 069-01, 069-02, then 069-03 (the library uses both). 069-04 is an overflow of 069-02 and does not block 069-03. 069-05 was built against the reviewed library and gates 069-03's DONE.

Status: 069-01 DONE (2026-11-22); 069-02 DONE (2026-11-22, AC2's Proxy-trap clause moved to 069-04); 069-03 DONE and 069-05 DONE (2026-11-23, flipped together after 069-05's three reviews were saved and the owner accepted AC8); 069-04 READY_FOR_IMPLEMENTATION.

## 3. Boundaries

- Slice 064-31 (wrapper parity) was re-scoped against ADR-0065: AC2, AC3, AC5 and AC8 moved to 069-01, AC6 and AC7 to 069-03, AC1 dropped. See its file.
- Slices 064-32 and 064-33 are untouched.
