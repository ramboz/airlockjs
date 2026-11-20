---
status: DONE
dependencies: [064-17, 067-03, 067-06]
last_verified: 2026-11-20
---

## Slice 064-18 — B2: Egress bridge

**Goal:** Every request the tag makes leaves through the capability bridge with the recorded shape: fetch init, interact versus collect, edge domain versus demdex, location-hint path, response headers and error shapes.

**DoR:**
- ✅ B1 done.

**Acceptance Criteria:**

1. The fetch init (`credentials: include`, `cache: no-cache`, `referrerPolicy`) is carried through the bridge, not dropped.
2. `sendBeacon` is routed or denied with a visible diagnostic; ID-sync and URL-destination pixels and script or iframe loads are either bridged or tagged with a reason.
3. Edge domain kind (first-party versus Adobe) is honored and `x-adobe-edge` is read.
4. An unknown handle type raises a visible error, using the known-types list in spec 064 section 2.2.
5. The default egress allowlist covers every destination in spec 064 section 2.2 (ADR-0062 exceptions: the consent hold and the credentials denylist stay; fixtures supply the recorded consent state). The hold-and-flush behavior comes from 067-03 and the no-drop limits from 067-06 (spec 067 s8 check 11).
6. Fixtures S0, S3, S6 (request and transport shape only; consent command behavior is B3), S8 and S11 compare clean through real chamber dispatch.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes (2026-11-20)

**Done.** Init (cache, credentials, referrerPolicy, keepalive) is whitelisted by `sanitizeFetchInit` and carried as `req.init` to `caps.egress.dispatch`; all response headers return to the chamber (`x-adobe-edge`, `Retry-After`). `sendBeacon` now routes as a keepalive POST through the seal (held visibly). IMG/SCRIPT/IFRAME loads post `unbridged-load` and get a `warn` diagnostic with a reason. Status 0 throws `TypeError` in the chamber (Alloy's demdex-to-edge fallback keys on it). Allowlist = `ALLOY_STOCK_ENDPOINTS` (incl. `{hint}` segment) plus `allowlistForEdgeDomain(host)`; `bootAlloy({edgeDomain})` pins a first-party host. Unknown `handle` types emit an `unknown-handle` error diagnostic (`knownHandleTypes`, 10 known). Tests: `test/egress-bridge-seam.test.js` (hermetic) and `test/adobe-b2-egress.test.js` (real Chromium, browser-oracle step). S0, S3, S6 (transport), S8, S11 compare clean.

**For 064-19 (B3):** the `knownHandleTypes` option and diagnostic exist; the replay harness has `respond(req,i)`, `extraHosts`, and returns `responses` and `diagnostics`; rig commands `rig:sendBeacon`, `rig:loadElement`.

**For 064-22 (B6):** ID-sync and URL-destination pixels, the Advertising iframe and blob message iframes are tagged (`pixel-not-bridged`, `script-not-bridged`, `iframe-not-bridged`), not bridged. Bridging is yours. Assurance is not exercised.

**Extra captures needed: 1** (first-party CNAME edge domain; see spec 064 end).

**Carried:** 067-03 residual (seeded stale "in" consent cookie with pending page consent drops instead of holding); hold path untouched.

**Upstream to main later:** the additive, opt-in changes in `core/endpoint-ceiling.js` (`{hint}`), `core/egress.js`, `core/wrapped-sdk-host.js`. Google/Meta behaviour unchanged (full suite green).

**Review rounds:** see `reviews/slice-18-*.md`.
