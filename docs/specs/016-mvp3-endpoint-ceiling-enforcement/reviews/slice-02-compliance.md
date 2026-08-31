---
slice: 016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR archetype)
pass: compliance
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T01:02:11Z
prompt_source: independent Opus review of Sonnet implementer diffs (016-02)
---

## Compliance review — 016-02 — PASS
- No live identifiers (synthetic 11111111/99999999 datastreams); real Adobe hostnames are public infra. The
  endpoint-ceiling + disclosure diagnostics name only origin+path / a deviation label, never a user identifier.
- The tenant-coverage gap is NAMED (AC4), test-pinned as OBSERVABLE (AC6e — the disclosure diagnostic), and
  guarded (single-origin floor → gap dormant in the shipped config); not opened silently. Floor breadth +
  second-origin tenant-keying honestly deferred to a chamber-egress probe (ADR-0006 Kill #2), tracked in
  refinement-todo. 015 standalone unweakened (test (f)). No core→rig import.
No compliance findings.
