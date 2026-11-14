---
slice: 067-12: Default localStorage and sessionStorage grant is the stock set
pass: craft
verdict: pass
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-14T00:20:00Z
prompt_source: jig:reviewer-agent
---

Fail. One HIGH security finding: the new write path is fail-open by default. The rest is sound. The grant resolution reuses `resolveCookieGrant`/`matchesGrantedName`, the seed is filtered on the trusted side, diagnostics carry area and key name only (tested for values), and a throwing or absent `Storage` is handled.

## Blocking

1. **HIGH — security: an untrusted chamber can write arbitrary page `localStorage`/`sessionStorage` keys on a default alloy boot.** The vendor bundle runs in the chamber global with `self.postMessage` available (`connectors/alloy/alloy-chamber.worker.js:99`, nothing withholds it). It can post `{ type: "storage-writeback", area: "localStorage", key: <any>, value: <any> }` directly, with no need for the shim. With `ALLOY_STORAGE_NAMES = null` the grant is ungated (`core/storage-scope.js:54`), so `core/wrapped-sdk-host.js:607` passes it. `bootAlloy`'s `storage.reconcile` is wired unconditionally (`adapters/eds/index.js:1666-1676`) and calls `setItem`/`removeItem` on the real page store. Before this commit no such channel existed. Today every production alloy boot gains a page-storage write (and delete) primitive: key overwrite of first-party app state, or removal of any key. The seam's own comment says "ungated only when nothing is declared". For a brand-new channel, ungated must mean closed. Fix: gate the handler on the resolved grant being active and the area being non-`null`, or wire `caps.storage.reconcile` only when `storageGrant.active`. Flip the two migration tests (`test/eds-boot-alloy-storage-default.test.js:36`, `test/wrapped-sdk-host-storage.test.js` "no stock set and no narrowing") to assert no page write.
2. **MEDIUM — a narrowing with no stock declared grants page access.** `resolveStorageGrant(null, narrowing)` returns the narrowing as the grant (`core/storage-scope.js:34-44`). It feeds the boot seed (`adapters/eds/index.js:1763`) and write-back, so a site config "narrowing" alloy to `["vendor_"]` (the new golden fixture) hands the chamber real page values. This contradicts the schema text "It can never widen the grant" (`contracts/instrumentation-config.schema.json:74`). It differs from cookies, where an ungated jar was today's real access. Fix as in compliance blocking 2.

## Non-blocking

- **MEDIUM — docs accuracy.** `docs/architecture.md:111` says a connector declares stock keys via `capabilities.storageKeys`. Nothing reads that field; alloy uses the `ALLOY_STORAGE_NAMES` export, which is not on its manifest (`connectors/alloy/connector.js:181`, `:206` carry only cookies). The same paragraph's "declares nothing keeps today's behavior: no seed, no grant" is true for the seed but not for write-back (blocking 1). Align the text with the fix.
- **LOW — `sync-storage.js` Proxy edges** (`connectors/alloy/sync-storage.js:27-30`). `p in t` walks `Object.prototype`, so `storage.constructor`/`toString`/`hasOwnProperty` read as the inherited members, and a stored key with one of those names is unreachable via property access (`getItem` still works). There are no `has`/`deleteProperty`/`ownKeys` traps, so `"k" in storage`, `delete storage.k` and `Object.keys(storage)` don't reflect the map, and `delete` emits no removal. A `__proto__` property set reaches `m.set("__proto__", …)` and emits a write-back. It is grant-filtered, so it is not exploitable. Most of this was pre-existing shim behavior; consider an `Object.create(null)` target plus the missing traps.
- **LOW — `__proto__` seed key.** `scopeSeedStorage` assigns `seed[area][key] = value` on a plain object (`core/storage-scope.js:77`). A granted key literally named `__proto__` is silently dropped (a prototype set with a string is ignored), so this is not pollution, but `Object.create(null)` would be exact.
- **LOW — test gap.** No test drives the worker's `install(cookie, storage)` path (`alloy-chamber.worker.js:373-379`) to prove that seeded shims replace `winBack.localStorage`/`sessionStorage` and that the posted message shape matches what the host destructures (`{ area, key, value }`). Shim and host are only tested separately.
- **LOW — pending consent.** Writes go through while a storage purpose is `pending` (tested). This matches the 067-05 decision to leave pending to the seal hold. Record it in the slice deviation log, as 067-05 did.
- **LOW — diagnostic `area: String(area)`** echoes an attacker-chosen area string into the diagnostic, unbounded. Clamp it or map it to `"invalid"`.


## Round 2 (reconciliation)
Blocking findings fixed in the follow-up commit: a storage area with no declared stock now grants nothing (host drops write-backs with a `storage-scope` diagnostic, so default boots never write page storage), and a narrowing with no stock set throws at boot. Migration tests flipped to assert no page write. Verdict updated to pass on that basis.
