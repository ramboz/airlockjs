---
slice: 028-01 — the decision-stream read-layer + query
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:23:48Z
prompt_source: review.py implementation 028 'read-layer' + deliverables
---

**Verdict: PASS** (independent reviewer, Opus).

All six ACs met against **real** emit paths, verified concretely by the reviewer:
- **AC1** — one shared collector wired as `onDiagnostic` on the REAL `createAirlock` / `createWrappedSdkHost` /
  `createDomApplyCoordinator` (only the external boundaries — Worker/fetch/chamber/doc — stubbed, via the same
  hermetic harnesses the per-host suites use). Real enforcement logic runs (ceiling check, consent verdict,
  `checkConfigIntegrity`, op resolution). **`config-integrity` — the frame-critique's blind spot, emitting from
  `wrapped-sdk-host` ALONE — is genuinely driven and asserted** (with an explicit "a createAirlock-only collector
  would show ZERO" control), not faked. The named FAIL condition is affirmatively excluded.
- **AC2/AC3/AC6** — query filters (kind/disposition/purpose AND, emission order, returned copies), bounded
  drop-oldest O(1) ring (default 500 + override validation), no PII amplification (exact key-set assertion).
- **AC4** — non-vacuous: a clean in-allowlist dispatch touches `fetch` but not the collector (`size()===0`), with a
  paired control firing a real `endpoint-ceiling` on the SAME instance (`size()===1`) — so `size:0` means "clean
  path emitted nothing," not "collector unwired."
- **AC5** — console default preserved (a real config-integrity hold reaches `consoleDiagnostic` when no collector
  injected).
- **DoD payload-governance line now satisfied** — the original coverage used a synthetic unit record; a **real**
  `governParams` strip (via `handle.pushCritical` with `payloadDenylist:["email"]`) was added, asserting the field
  NAME lands and the value never does.

Grounding (ADR-0020): synthetic identifiers only (all-1s/all-9s datastream UUIDs, synthetic clientId/sessionId,
inert `example`/`demdex.net` pin strings) — no live identifiers. Purely additive (`core/inspector/` + one test; no
host file modified — supports the AC5 additive / no-existing-test-change claim). Principle-aligned (INP-safe off
the projection-fold hot path, memory-lean bounded ring, diagnostics first-class, no PII amplification).

No blocking issues.
