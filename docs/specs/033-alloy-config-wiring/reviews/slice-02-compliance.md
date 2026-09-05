---
slice: 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`
pass: compliance
verdict: pass
reviewer: general-purpose (independent compliance, 2 rounds)
reviewed_at: 2026-09-05T02:45:56Z
prompt_source: review.py compliance docs/specs/033-alloy-config-wiring/spec.md 033-02 <deliverables>
---

VERDICT: pass (after one needs-changes round) — compliance, slice 033-02

Independent compliance reviewer re-ran the full suite + rig + build + contracts each round.

**First pass: needs-changes** — 5 of 6 ACs met with real (non-vacuous) tests, but **AC2's explicit cap
list was violated**: `bootAlloy` wired only consent + payloadDenylist, omitting `configIntegrity` +
`endpointCeiling` (both accepted+enforced by `createWrappedSdkHost` per 015-01/016-02/ADR-0011), with no
reconciling deviation log — so alloy's Edge interact ran at the seam with no endpoint ceiling + no tenant pin.

**Fix + re-verify: pass.** `bootAlloy` now wires BOTH caps into `createWrappedSdkHost`
(`adapters/eds/index.js:879-909`) using real exports (`hostOf` @ `core/config-integrity.js:88`,
`ALLOY_INTERACT_ENDPOINT` @ `connectors/alloy/connector.js:15`): `configIntegrity` =
`{pinnedHost:"adobedc.demdex.net", tenantKey:"configId", pinnedTenant:<datastreamId>, disposition:"hold"}`,
`endpointCeiling` = `[ALLOY_INTERACT_ENDPOINT]`. The 3 new security tests are non-vacuous — they drive
re-tenant (attacker configId) + off-floor URLs through the REAL seam and assert distinct counters
(`state.held` vs `state.ceilingHeld`); removing either cap zeroes its counter + times out. `datastreamId`
required at all 3 layers (schema `anyOf` + `validateConnectorEntry` + negative fixture; `contracts/validate.mjs`
rejects missing). Deviation documented in the slice close-out. Full suite green (80 files, 1071 tests); AC1 CSP
browser proof (rig:alloy-csp) PASS.

AC coverage confirmed: AC1 (CSP fix + real rig proof), AC2 (host N-events + caps), AC3 (dispatch+validation),
AC4 (5th dist entry, same-origin, no blob/data/ajv, in DIST_ARTIFACTS), AC5 (schema+fixtures), AC6 (e2e + 2nd
page_view). Residuals correctly scoped as documented follow-ons (breadth-grounding, pushCritical unload, override).

Reviewer: general-purpose (independent compliance, 2 rounds).
