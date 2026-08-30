---
slice: 013-02 — egress-breadth fan-out
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:29:23Z
prompt_source: spike-light compliance (combined reviewer) — 013-02
---

## Compliance review — slice 013-02 (spike-light, combined pass) — **pass**

Real-DOM main-thread reference run verified genuine (stock alloy.js in real Chromium, real
`document`+`Image()`, `renderDecisions:true`, real Edge via env creds) — it *would* surface
`<img>`-pixel syncs; not a chamber run.
- **AC4 validity floor PASS** — the zero-third-party result is recorded as a LOWER BOUND /
  test-org-config artifact in the rig verdict, Findings, Outcome, deviation log, and
  refinement-todo; the enforcement design is explicitly **barred** from reading the count as
  ceiling cardinality; never smoothed into "narrow egress."
- **AC2 three-outcome PASS** — each egress tagged confined/escaped/shim-swallowed; the
  shim-swallowed path's absence of a positive instance is disclosed ("method-validated but
  unmeasured — needs AAM destinations"), not hidden.
- **AC3 ceiling PASS** — origin cardinality (2) + roster-stable recorded; "FLOOR not map" holds.
- **HARD no-creds gate CLEARS** — no live datastream/org/ECID/demdex id in any committed file
  (git grep + id-shape scan zero hits); raw full-URL capture gitignored; creds env-only.
- **should-fix [compliance/6] → FIXED** — the 012-04 slice-04 Axis-1 table row read stale
  ("DEFERRED"); added a 013-02 backlink ("MEASURED live … LOWER BOUND"). refinement-todo already
  carried the authoritative record.
