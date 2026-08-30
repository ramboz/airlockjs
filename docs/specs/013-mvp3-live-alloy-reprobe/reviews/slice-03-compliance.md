---
slice: 013-03 — config-integrity / same-host-tenant re-routing
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:36:06Z
prompt_source: spike-light compliance (combined reviewer) — 013-03
---

## Compliance review — slice 013-03 (spike-light, combined pass) — **pass**

- **AC2 chamber-mutable, grounded** — verified in real source: `connector.js` `getAlloy()("configure",
  {datastreamId, orgId})` resolves the chamber's `self.alloy` global; `connector-host.js`
  `factory(config)` closure-captures once → disciplines only honest code; the alloy runtime is a
  chamber global, so compromised code can re-configure or bypass it. Stub models this faithfully.
- **AC3 at the correct seam** — main-thread dispatch (ADR-0004, where the seal lives); catches BOTH
  re-configure and bypass-craft vectors. Host-owned-boot shown necessary-but-not-sufficient via the
  bypass test.
- **AC1 honestly deferred** — a simulated tenant is correctly rejected as question-begging; the slice
  goes DONE on the corrected DoD's creds-free core.
- **Threat sound** — same-host/different-datastream re-routing is tenant-blind vs ADR-0004/0006 (seal
  keys on host/path; datastream rides as the `configId` param, outside it). configId-routes-tenant
  grounded by 013-01's live probe.
- **HARD no-creds gate CLEARS** — synthetic `1111…`/`9999…` only; grep confirms no real
  datastream/org id in rig, test, or slice.
- **refinement-todo + ADR-0006 gap** recorded; the "bind at BOTH seams" (OQ16) obligation is carried
  forward per the review nit.
