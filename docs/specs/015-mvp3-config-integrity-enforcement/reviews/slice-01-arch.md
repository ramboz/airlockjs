---
slice: 015-01 — fail-closed enforcement (hold + alert)
pass: arch
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-30T23:08:01Z
prompt_source: independent Opus review of Sonnet implementer diffs (015-01)
substrate: non-interactive
---

## Arch review — 015-01 (a core enforcement seam + a new ADR) — PASS

- **Boundary integrity held.** The new control lives in `core/config-integrity.js` and imports nothing
  from `rig/`; `core/wrapped-sdk-host.js` imports it as `./config-integrity.js` (core→core).
  `test/core-boundary.test.js` (no core→rig imports) stays green. The 013-03 prototype in `rig/` is
  DELETED (true relocation, AC1), not duplicated — no two-homes drift.
- **Vendor-neutrality preserved (the 014-02 precedent).** The tenant-key param name is INJECTED
  (`configId`/`measurement_id`), not hardcoded in core/; a GA4-shaped pin is exercised in-test to prove
  the control is not Adobe-specific. So the seam can serve any wrapped-SDK connector that declares its
  tenant key — the ADR-0011 §5 obligation is structurally met, not just asserted.
- **Seam is the right chokepoint.** The control binds at ADR-0010's `caps.egress.dispatch` — the single
  main-thread hop every intercepted interact crosses; the ADR frame-critique separately confirmed
  egress-confinement withholds every alternate network primitive, so a hostile chamber cannot side-step
  it. Pin is orchestrator-owned + chamber-immutable (a constructor opt), so chamber code cannot
  influence its own reference.
- **ADR-0011 Accepted + indexed**, disposition honestly scoped to the URL surface with the body-`orgId`
  co-vector as a tracked residual. No architectural debt introduced beyond that named, tracked residual
  and the (already-tracked) GA4 async-reroute deferral.

No arch findings.
