---
status: IN_PROGRESS
dependencies: [067-01]
last_verified: 2026-11-13
claimed_by: 067-09-denylist-override
---

## Slice 067-09: The credentials denylist stays on, with an explicit override

**Goal:** The ADR-0012 built-in denylist (`password`, `cvv`, `ssn`, card fields) is on by default on every track. A site removes or replaces it only with explicit config. A test pins both. This is ADR-0062 exception (b).

**DoR:**
- ✅ ADR-0062 point 4b and Owner answer 1 ("I'd keep the strip in place, we do privacy first, and allow overrides via explicit config if needed").
- Ground first (spec 067 section 2): `DEFAULT_DENYLIST` is merged with the host's `payloadDenylist` (`core/airlock.js:130-146`), and the host list can only extend it. The override does not exist today.

**Acceptance Criteria:**

1. On the default path a payload carrying a denylisted field has it stripped, with the existing `payload-governance` `warn` diagnostic. This holds for the worker batch path and the unload path, as today.
2. The override is explicit config (decision D3: a per-connector `payloadDenylistOverride` option on each track, threaded the way `payloadDenylist` is today in `adapters/eds/index.js`; `false` disables the built-in list and an array replaces it). It cannot be set by accident: a `payloadDenylist` extension alone never removes the built-in list.
3. Setting the override emits a one-time `warn` per connector diagnostic that the built-in denylist is off or replaced.
4. A test pins "on by default": an unconfigured airlock strips each built-in field on every connector path that governs payloads. A second test pins "extension never disables it". A third pins the override as its own state.
5. A field the denylist removes from a stock recording is a documented difference, never a parity failure (ADR-0062 point 5). The comparison helpers (`rig/` and test comparators on `main`) carry that note, or the slice records which helper owns it.
6. The built-in list is not changed in content here.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- `docs/architecture.md` or the ADR-0012 reference doc names the override option.

**Consumers:** Adobe 064-18 onward (vendor-adobe); Google G3 and G12; Meta D1 row.

**Anti-horizontal-phasing check:** Vertical: option, governance path, diagnostic and the three pinning tests.

**Implementation notes (2026-11-13):**
- `resolveDenylist` in `core/payload-governance.js` is the one place the effective list is built. `createAirlock` (ga4, gtag, google-ads, floodlight, pixel) and `createWrappedSdkHost` (alloy egress strip) both use it, so the override has one shape on every governed track. The alloy strip now uses the built-in list by default (it only ran on a host list before).
- `contracts/instrumentation-config.schema.json` accepts `payloadDenylistOverride` on every governed connector, with a golden fixture.
- AC5: the note lives in `rig/native-tag-comparison.md` (the rig doc owns it).
- 067-10 (input governance at the wrapped-SDK seam) should reuse `resolveDenylist` rather than rebuild the list.
