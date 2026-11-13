---
status: READY_FOR_IMPLEMENTATION
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
5. If localStorage and sessionStorage grants are not modeled on `main`, this slice adds the same name-scoped grant shape for them (read before-state, write-back), so 067-08 and 064-17 can seed them. If it is modeled, it reuses it.
6. A test vendor connector (fixture set) proves a stock name flows by default and an out-of-set name is refused. Real vendor sets are not added here.
7. Tests cover the stock-default path and the narrowed opt-in as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** Adobe 064-17 (storage seeding) and 064-18 onward (vendor-adobe); Google G4; Meta D1 row (M5 reads it through M4).

**Anti-horizontal-phasing check:** Vertical: manifest field, read filter, write-back filter and denial path for one connector.
