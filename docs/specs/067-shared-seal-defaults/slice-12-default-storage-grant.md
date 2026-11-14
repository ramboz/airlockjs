---
status: DONE
dependencies: [067-05]
last_verified: 2026-11-13
---

## Slice 067-12: Default localStorage and sessionStorage grant is the stock set

**Goal:** A connector's default storage grant is the localStorage and sessionStorage keys its stock tag reads and writes. Sites narrow it with explicit config. This is the storage half of ADR-0062 point 7, split out of 067-05 (AC5) because no storage seam exists on `main`.

**DoR:**
- ✅ ADR-0062 point 7 and Owner answer 3. 067-05 (cookie grant: `resolveCookieGrant`, `cookiePurposes`, the `cookie-consent` denial) is the shape to mirror.
- Ground first: where the chamber would read and write storage (the alloy chamber worker has no storage shim today) and how the boot seed would cross the airlock, as the cookie seed does.

**Acceptance Criteria:**

1. A connector manifest declares the stock storage set per area (`localStorage`, `sessionStorage`): exact keys and `prefix_` entries, same match rule as cookies. The default grant is that set, read and write.
2. A site narrows the grant to a subset with explicit config; a narrowing outside the stock set fails loud. The narrowing is its own tested state.
3. Keys outside the grant are refused on read (seed) and write-back (fail closed). Writes are also dropped while a storage purpose the key serves is explicitly denied.
4. A caller that declares nothing keeps today's behavior (spec 067 check 8), pinned by a migration test.
5. A test vendor fixture set proves a stock key flows by default and an out-of-set key is refused. Real vendor sets arrive with 064/065/066.
6. Tests cover the stock-default path and the narrowed opt-in as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** 067-08 (Alloy context) and Adobe 064-17 (storage seeding, on vendor-adobe).

**Anti-horizontal-phasing check:** Vertical: manifest field, seed filter, write-back filter and denial path for one connector.

### Deviation log

- Alloy declares no stock storage set yet (`ALLOY_STORAGE_NAMES = null`; real keys arrive with Adobe 064-17). The stock-default path is proven with a mocked test vendor set (`vendor_`, `vtld`, `vsid`), as the slice allowed.
- An area with no declared stock grants nothing: the host drops `storage-writeback` and the chamber storage stays in memory, as today. A narrowing with no stock set throws at boot (nothing to narrow). Independent review round 1 found the first draft fail-open here; fixed.
- New seam: chamber `storage-writeback` message, `init.storage` seed (only when a grant is active), `caps.storage.reconcile` sink, and a `storageGrantNarrowing` config key with schema and golden fixture.

### Reconciliation sweep

- `docs/architecture.md` ("Storage grant defaults to the stock set"), `contracts/README.md`, `contracts/capability.d.ts`, `contracts/connector.d.ts` and `contracts/instrumentation-config.schema.json` updated.
- Reviews: `reviews/slice-12-compliance.md`, `slice-12-craft.md`, `slice-12-reconciliation.md`. All ACs 1-6 met; check 8 pinned by `test/wrapped-sdk-host-storage.test.js` and `test/eds-boot-alloy-storage-default.test.js`.
