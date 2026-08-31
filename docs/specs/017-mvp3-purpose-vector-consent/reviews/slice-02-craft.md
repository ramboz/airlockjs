---
slice: 017-02 — storage consent deny (cookie capability + ephemeral id)
pass: craft
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T02:00:26Z
prompt_source: independent Opus review (017-02)
substrate: non-interactive
---

## Craft review — 017-02 (storage consent deny) — PASS
- The gate is the READ-and-use (frame-critique fix): `!storageGranted` early-returns a fresh ephemeral
  client_id + per-page session with NO cookies.get and NO write. A test spies on jar.get → never called under
  denial (the read doesn't happen). The granted branch is byte-identical to 004-03 (pinned-value tests pass
  unmodified); the id-mint formula factored into a shared `mintEphemeralClientId()` helper — same computation.
- Back-compat default true (no consent → 004-03 persist); a provided vector enforces per-purpose. Adapter:
  `consent ? resolveConsent(consent,"analytics_storage")==="granted" : true`.
- session_id also ephemeral under denial (String(bootSeconds), not the persisted _ga_<stream>) — the
  same-altitude fix. 30/30 ga4-cookies (+7 new: granted empty/existing, denied empty/pre-existing-leak/
  two-boots-no-continuity/session-fallback), 98/98 neighborhood, no regression.
No craft blockers.
