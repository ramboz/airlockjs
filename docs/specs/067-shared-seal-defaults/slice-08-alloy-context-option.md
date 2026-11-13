---
status: DRAFT
dependencies: [067-07, 067-09, 067-10]
last_verified: 2026-11-13
---

## Slice 067-08: Alloy `context` defaults to the stock list

**Goal:** The Alloy connector's `context` option defaults to stock `[web, device, environment, placeContext]` and is fed by the 067-07 channel. A site narrows it. The code default `context = []` goes away.

**DoR:**
- ✅ ADR-0062 point 2 and its Assumptions. The stock default is verified from source: `@adobe/alloy@2.31.1`, `packages/core/src/components/Context/index.js:32-36,53`. The check against the pinned bytes stays with 064 inventory.
- 067-07 is done.
- Boundary with 064-17 (spec 067 section 4): this slice ships the option, the wiring and a minimal mapping from channel groups to Alloy's `context` input. Per-field fidelity against the pinned 2.31.1 bytes, the apex probe and recorded before-state seeding stay with 064-17.

**Acceptance Criteria:**

1. `connectors/alloy/connector.js` no longer defaults `context = []`. The default is `["web", "device", "environment", "placeContext"]`. The chamber `configure()` receives the list the site chose, or the stock list.
2. A site narrows the list with the existing `context` option. A reduced list yields only those groups (its own tested state). The site-facing doc comment at `:60` and `:95` is updated.
3. The chamber feeds Alloy's context collection from the 067-07 channel, not from fabricated shims, for the groups listed. An unset channel yields no fabricated values.
4. A test proves the default configure call carries the stock list and a narrowed call carries the narrowed list.
5. `toXdm` forwards the site-supplied `xdm` as stock does. The 2-field mapping becomes an opt-in (ADR-0062's table, ADR-0013:24-30 row). A test pins the default (full `xdm` forwarded) and the opt-in (2-field).
6. The credentials denylist still applies to what the connector sends (067-09 pins it).
7. The slice states in its notes what it does not do: no claim of byte parity with the pinned Alloy 2.31.1 output. That is 064-17.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- ADR-0013's status line from 067-01 already marks the "read-minimized" claim superseded. This slice updates the code comments that repeat it.

**Consumers:** Adobe 064-17 and 064-18 onward (vendor-adobe). Not used by Google or Meta.

**Anti-horizontal-phasing check:** Vertical: option, channel feed and a real Alloy configure in the chamber rig.
