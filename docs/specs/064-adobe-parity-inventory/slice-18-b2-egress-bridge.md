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

**Done.** Init (cache, credentials, referrerPolicy, keepalive) is whitelisted by `sanitizeFetchInit` and carried as `req.init` to `caps.egress.dispatch`; all response headers return to the chamber (`x-adobe-edge`, `Retry-After`). `sendBeacon` now routes as a keepalive POST through the seal (held visibly). Every keepalive request (beacon or `init.keepalive`) goes through the shared 067-06 `createKeepaliveTracker` (host option `keepaliveTracker`): past the 64 KiB in-flight quota it goes out as one plain fetch, no retry, nothing dropped. IMG/SCRIPT/IFRAME loads post `unbridged-load` and get a `warn` diagnostic with a reason. A real dispatch failure (`networkError: true` from the seam) throws `TypeError` in the chamber, which Alloy's demdex-to-edge fallback keys on; a seal hold or timeout throws a plain `Error`, so a held request is held once. Allowlist = `ALLOY_STOCK_ENDPOINTS` (incl. `{hint}` segment) plus `allowlistForEdgeDomain(host)`; `bootAlloy({edgeDomain})` pins a first-party host. Unknown `handle` types emit an `unknown-handle` error diagnostic (`knownHandleTypes`, 10 known). Tests: `test/egress-bridge-seam.test.js` (hermetic) and `test/adobe-b2-egress.test.js` (real Chromium, browser-oracle step). S0, S3, S6 (transport), S8, S11 compare clean.

**For 064-19 (B3):** the `knownHandleTypes` option and diagnostic exist; the replay harness has `respond(req,i)`, `extraHosts`, and returns `responses` and `diagnostics`; rig commands `rig:sendBeacon`, `rig:loadElement`.

**For 064-22 (B6):** ID-sync and URL-destination pixels, the Advertising iframe and blob message iframes are tagged (`pixel-not-bridged`, `script-not-bridged`, `iframe-not-bridged`), not bridged. Bridging is yours. Assurance is not exercised.

**Extra captures needed: 1** (first-party CNAME edge domain; the existing CAP freeze gap DS-29 / S9-06, see spec 064 s12).

**Carried (round 1 findings, not fixed here):**
- C3: beacon bodies that are a Blob lose their `type`; ArrayBuffer/FormData stringify. Alloy sends strings today.
- C4: SCRIPT/IFRAME are tagged on `src` assignment, not on insertion, so they can over-report. IMG is exact.
- C5: the `{hint}` segment pattern also matches `v1` (`/ee/v1/v1/interact`). Harmless on Adobe hosts.
- F2: `x-adobe-edge` is proven delivered to the chamber, not that Alloy acts on it (cluster cookie or next-request hint).
- F3 (for 064-19): a hint-less `/ee/v1/collect` is not on the allowlist (only the hinted `collect`); it would be held visibly. Not in the corpus. Closed in 064-24 (source-derived allowlist entry).
- C7: a throwing host diagnostic sink would be flagged as a network failure (Alloy would retry on the other host).
- C8: the keepalive quota is counted per host instance, not across airlock instances on one page.
- Test nit: `r0Origin` in `test/adobe-b2-egress.test.js` hardcodes the capture origin; derive it from the manifest later.

**Carried:** 067-03 residual (seeded stale "in" consent cookie with pending page consent drops instead of holding); hold path untouched.

**Update (068-01, 2026-11-20):** a pending seam hold now parks (no rejection reaches Alloy, so no other-host fallback fires) instead of rejecting; denial, teardown, ring overflow and timeout still reject with status 0 (plain Error). The stale-cookie test now expects `responses: []`. The 067-03 residual is resolved by 068-01.

**Upstream to main later:** the additive, opt-in changes in `core/endpoint-ceiling.js` (`{hint}`), `core/egress.js`, `core/wrapped-sdk-host.js`. Google/Meta behaviour unchanged (full suite green).

**Review rounds:** 2 (`reviews/slice-18-*.md`). Round 2 delta: C2 keepalive quota, C1 hold vs network failure, F1 `s6-out`, doc reconciliation.
