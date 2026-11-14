---
status: DONE
dependencies: [067-01]
last_verified: 2026-11-13
---

## Slice 067-05: Default cookie and storage grant is the stock set

**Goal:** A connector's default cookie and storage grant is the set its stock tag reads and writes. Name-scoping (ADR-0006) becomes an opt-in narrowing. Consent-driven write denial still applies.

**DoR:**
- ✅ ADR-0062 point 7 and its Owner answer 3.
- Ground first: `matchesGrantedName` and `scopeSeedCookies` (`core/cookie-scope.js`) and the write-back path (`core/wrapped-sdk-host.js:516-528`). Name the declared set per connector today (for example Alloy's `kndctr_` and `demdex` family) and where storage (localStorage, sessionStorage) grants are, or are not, modeled.

**Acceptance Criteria:**

1. A connector manifest declares the stock cookie and storage set (names, `prefix_` entries, and storage keys). The default grant is that set, read and write.
2. A site narrows the grant with explicit config to a subset. The narrowing is its own tested state.
3. Names outside the stock set stay refused on read and write-back (fail closed), as today. `isValidCookieName` still rejects malformed names (header-injection and attribute-smuggling guard stays).
4. Consent-driven write denial still applies: a denied storage purpose blocks writes whatever the grant says. A test pins that a stock-set cookie is not written under denial.
5. **Moved to [067-12](slice-12-default-storage-grant.md)** (see the deviation log). localStorage and sessionStorage grants are not modeled on `main`; the new mechanism is its own slice.
6. A test vendor connector (fixture set) proves a stock name flows by default and an out-of-set name is refused. Real vendor sets are not added here.
7. Tests cover the stock-default path and the narrowed opt-in as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** Adobe 064-17 (storage seeding) and 064-18 onward (vendor-adobe); Google G4; Meta D1 row (M5 reads it through M4).

**Anti-horizontal-phasing check:** Vertical: manifest field, read filter, write-back filter and denial path for one connector.

### Reconciliation sweep

- Spec 067 checks 5, 7, 8: matched (mechanism plus test vendor set; storage split; undeclared callers pinned by a migration test).
- ADR-0062 point 7 and ADR-0006: no change needed.
- Docs updated: `docs/architecture.md`, `contracts/README.md`, config schema (`cookieGrantNarrowing`).

### Deviation log

- AC5 (the localStorage/sessionStorage grant) is split into [067-12](slice-12-default-storage-grant.md), as spec 067 check 7 allowed. Grounding found no storage seam: the alloy chamber has no storage shim, the EDS adapter reads no storage for the chamber, and no write path exists. Adding it is a new mechanism (chamber shim, seed, write-back, denial), not a variant of the cookie code. The cookie shape (`resolveCookieGrant`, `cookiePurposes`) is built to be reused by it.
- AC4 on the alloy track needed a new host-side check: before this slice the wrapped-SDK write-back had no consent gate at all (only GA4's `storageGranted` gated writes). The host now takes `cookiePurposes` and drops a write while a storage purpose (`*_storage`) its cookie serves is explicitly denied. Pending is left to the seal hold (067-02/067-03).
- Real vendor sets are not added here (spec 067 check 5): alloy's existing `ALLOY_COOKIE_NAMES` already is the stock set; the test vendor fixture (`vendor_`, `vsid`, `vtld`) proves the mechanism.
