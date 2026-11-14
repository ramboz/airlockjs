---
slice: 067-12: Default localStorage and sessionStorage grant is the stock set
pass: compliance
verdict: pass
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-14T00:20:00Z
prompt_source: jig:reviewer-agent
---

Reviewed commit `4ee71063` against the slice ACs, spec 067 §8 checks 5, 7 and 8, and ADR-0062 point 7. `npm test` (2479 passed, 4 skipped) and `npm run lint` pass. The servo quality gate was not run in this pass.

Verdict is fail. The undeclared-caller migration (AC4, check 8) pins a widening instead of today's behavior.

## Blocking

1. **HIGH — AC4 / check 8: the "today's behavior" migration test pins new page-storage write access.** Before this commit the alloy chamber's storage was in-memory only. No `storage-writeback` message existed (`git show HEAD~1:connectors/alloy/alloy-chamber.worker.js`, old `makeStorage`). Now, with nothing declared (`ALLOY_STORAGE_NAMES = null`, `connectors/alloy/connector.js`), `storageKeyGranted` treats a `null` area as "grants everything" (`core/storage-scope.js:54`). The host seam then forwards any chamber `storage-writeback` to the page sink (`core/wrapped-sdk-host.js:600-615`), and `bootAlloy` writes it to real `localStorage`/`sessionStorage` (`adapters/eds/index.js:1669`). `test/eds-boot-alloy-storage-default.test.js:36` ("a storage write-back is applied ungated") and `test/wrapped-sdk-host-storage.test.js` (migration `describe`, "no stock set and no narrowing ... writes `anything`") lock this widening in as the migration contract. Check 8 says "tightening, not widening, for undeclared callers". For storage, today's behavior is no page read and no page write, not ungated. Fix: when the grant is inactive (or an area is `null`), refuse or ignore `storage-writeback`. Then rewrite the migration tests to pin that no page write happens.
2. **MEDIUM — AC2: with no stock declared, a narrowing grants access instead of narrowing it.** `resolveStorageGrant(null, { localStorage: ["x"] })` makes the area active with `["x"]` (`core/storage-scope.js:34-44`). `bootAlloy` then seeds real page values for `x` into the chamber (`adapters/eds/index.js:1763`) and lets write-backs for `x` through. Today alloy has no page-storage access at all, so this "narrowing" widens access. Nothing fails loud, even though every entry sits outside the (empty) stock set. `test/eds-boot-alloy-storage-default.test.js:44` and `test/storage-scope.test.js:49` pin it. The golden `contracts/fixtures/instrumentation-config-alloy-storage-narrowing.golden.json` would grant alloy `vendor_*` page reads in production. Fix: with no stock declared, a narrowing should throw (outside the stock set) or stay a no-op that grants nothing.

## Per-criterion

| criterion | status | evidence | gap |
|---|---|---|---|
| AC1 manifest declares stock set per area; default = that set, read+write | PARTIAL | `ALLOY_STORAGE_NAMES`/`ALLOY_STORAGE_PURPOSES` exports (`connectors/alloy/connector.js`); `resolveStorageGrant` (`core/storage-scope.js:27-45`); `CapabilityRequest.storageKeys` (`contracts/capability.d.ts:63`) | The alloy **manifest** does not declare it: `capabilities` carries `cookies: ALLOY_COOKIE_NAMES` (`connector.js:181`) and `purposes.cookies` (`:206`), but no `storageKeys`/`purposes.storage`. Nothing reads `storageKeys`. LOW while the set is `null`. |
| AC2 narrow to subset; out-of-set fails loud; own tested state | PARTIAL | Throws on out-of-stock (`storage-scope.js:39-41`); tests `storage-scope.test.js` "out-of-stock", `eds-boot-alloy-storage.test.js` "fails loud at boot", `wrapped-sdk-host-storage.test.js` narrowed `describe` | Blocking 2 (no-stock narrowing widens) |
| AC3 refused on seed and write-back; denied purpose drops write | MET (declared stock) | Seed: `scopeSeedStorage` (`storage-scope.js:66-81`), `adapters/eds/index.js:1762-1764`; write: `wrapped-sdk-host.js:607-612`; denial: `storageWriteDenied` (`:233-241`); tests in `wrapped-sdk-host-storage.test.js` and `eds-boot-alloy-storage.test.js` | Fails open when nothing is declared (blocking 1) |
| AC4 declare-nothing keeps today's behavior, migration test | **NOT MET** | Init message unchanged (`eds-boot-alloy-storage-default.test.js` first case, passes) | Blocking 1 |
| AC5 test vendor fixture: stock key flows, out-of-set refused | MET | `eds-boot-alloy-storage.test.js` mocked `ALLOY_STORAGE_*` ("stock write-back reaches ... out-of-set does not"); `wrapped-sdk-host-storage.test.js` | No chamber-level test drives `install()` → `post("storage-writeback")` (`alloy-chamber.worker.js:377`); only the shim and host are unit-tested |
| AC6 stock-default and narrowed opt-in as separate states | MET | Separate `describe` blocks in `wrapped-sdk-host-storage.test.js`, `eds-boot-alloy-storage.test.js` | — |
| DoD `npm test && npm run lint` + servo gate | PARTIAL | Both green locally | Servo quality gate not verified |
| Check 5 (real sets arrive with 064/065/066) | MET | `ALLOY_STORAGE_NAMES = null`, test vendor fixture only | — |
| Check 7 (storage grant split out of 067-05) | MET | New `core/storage-scope.js`, slice is the split | — |
| Check 8 (tightening, not widening; migration pinned) | **NOT MET** | — | Blocking 1 and 2 |
| ADR-0062 point 7 (stock default, opt-in narrowing, consent write denial) | MET in mechanism | As AC1-3 | Undeclared-default semantics (blocking 1) |


## Round 2 (reconciliation)
Blocking findings fixed in the follow-up commit: a storage area with no declared stock now grants nothing (host drops write-backs with a `storage-scope` diagnostic, so default boots never write page storage), and a narrowing with no stock set throws at boot. Migration tests flipped to assert no page write. Verdict updated to pass on that basis.
