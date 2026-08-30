---
slice: 015-01 — fail-closed enforcement (hold + alert)
pass: craft
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-30T23:08:01Z
prompt_source: independent Opus review of Sonnet implementer diffs (015-01)
substrate: non-interactive
---

## Craft review — 015-01 — PASS

- **Fail-closed order is correct and deliberate.** `checkConfigIntegrity` checks incomplete-pin →
  host → tenant(absent/pollution/mismatch) in that order; every non-ok branch returns `hold`. An
  incomplete pin (misconfiguration) holds rather than silently allowing — the right default for a
  security control.
- **Seam placement is correct.** The gate sits at the very top of `dispatchInterceptedFetch`, BEFORE
  `state.mainDispatch.count += 1` and before `caps.egress.dispatch` — so a held dispatch neither
  counts as a real dispatch nor performs any egress. The hold settles the chamber's pending fetch via
  a `status:0` response, mirroring the existing AC6 timeout error-shape, so `sendEvent` rejects
  instead of hanging (consistent with the module's established reject surface).
- **Back-compat is clean + tested.** `configIntegrity = null` default → the gate is entirely skipped;
  a dedicated test proves a host built without the opt dispatches an attacker-tenant URL exactly as
  014-01 always did. The two rig harnesses that construct the host without the opt are unaffected.
- **Comments match the module's (high) density + idiom;** the new core module ports 013-03's rationale
  forward and documents the two generalizations (injected key, added host check) with ADR citations.
- **Tests genuinely assert** (not smoke): dispatch-count, diagnostic shape (`toMatchObject`), reject
  status, and `held` counter per case; the E2E cases drive the REAL `createWrappedSdkHost`, not a stub.
- Minor, acceptable: `pinnedDispatchUrl` preserves the URL scheme when re-deriving the host (host is
  pinned, scheme is not) — a negligible residual since the host check already confines the destination;
  it is 015-02's surface anyway.

No craft findings that block.
