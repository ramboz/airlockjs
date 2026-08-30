---
slice: 014-02 — concurrent-chamber coalescing in core
pass: arch
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T19:01:08Z
prompt_source: review.py arch docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-02 <deliverables>
substrate: non-interactive
---

## Arch review — slice 014-02 — **needs-changes → blocker fixed → pass**
The broker port is architecturally sound: right module, right "one broker above N per-chamber hosts"
topology (cross-chamber coalescing REQUIRES a shared point above the 014-01 dispatch), clean
composition, additive-only (no contract surface), reject-path carried faithfully, req.url preserved to
real dispatch so the seal stays gate-able.

- **[1] BLOCKER → FIXED** — core/coalescing-broker.js imported the recognizer from `../rig/` (the ONLY
  core→rig import in the repo; violates architecture.md's "core has no vendor coupling" + spec 014's
  own "no rig mirror to drift" thesis). **Fix (the reviewer's preferred option a):** made the broker
  VENDOR-NEUTRAL — `recognize`/`extractIdentity` are now INJECTED — and relocated the alloy recognizer
  to `connectors/alloy/xdm-mint.js` (10 importers repointed). core/ now imports nothing from rig/. A
  new **boundary test** (`test/core-boundary.test.js`) fails if any core→rig import returns. (A fix-time
  scope bug — `ecidOf` used the injected `extractIdentity` at module scope — was caught by the ported
  unit tests + fixed by threading it through.)

Concerns/flags LOGGED as 014-03-owned follow-ups (not gates):
- **[2]** the 012-02 rig broker (rig/alloy-coalescing-broker.js) is still live alongside the core port —
  two verbatim copies = drift hazard; retire/redirect it in 014-03 (its import was repointed so it still
  builds).
- **[3]** the broker interposes between caps.egress.dispatch and real egress — MVP3 enforcement must
  choose the seal-binding point (broker-entry gates every mint pre-coalesce vs real-egress misses
  coalesced-away mints); low severity (same-identity/endpoint), adjacent to the 014-01 arch-4 follow-up.
