---
status: ABANDONED
dependencies: [064-07]
last_verified:
---

## Slice 064-08 — B4: identity and storage

**Goal:** ECID, `getIdentity`, `appendIdentityToUrl` and the cookie cache match the corpus (S2, S5), with the fresh-vs-returning rule.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. S5 compares clean for fresh and returning profiles.
2. Storage before and after states match the recorded manifests.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: command to storage to wire.

**Abandoned 2026-11-13:** Regrouped into new B1 and B3 (064-17, 064-19). See spec 064 section 8.
