---
slice: 017-01 — data-use consent reshape + the consent machinery (the grounded first point)
pass: arch
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T01:38:47Z
prompt_source: independent Opus review of Sonnet implementer diffs (017-01)
substrate: non-interactive
---

## Arch review — 017-01 (new core consent seam + resolver + pre-construction ctx fold) — PASS
Independent Opus review of the Sonnet diffs.
- Vendor boundary clean: core/consent.js (CONSENT_PURPOSES + resolveConsent) has ZERO imports — no GA4/MP
  specifics; the MP-consent shaping (GRANTED/DENIED, the two data-use purposes) lives in
  connectors/ga4/consent.js (connector→core only). test/core-boundary green. The 016 vendor-injection
  precedent applied to consent.
- The pre-construction ORDERING (frame-critique) is honored: the fold computes ctxWithConsent BEFORE
  createAirlock({ctx: ctxWithConsent}) (adjacent statements), so the worker's init structured-clone AND the
  sync path's live ctx reference both carry consent. No post-construction setConsent handle — the mid-session
  update (which needs a worker ctx re-send) is correctly deferred + tracked.
- map.js UNTOUCHED (the body.consent=ctx.consent hook pre-existed) — 017-01 is purely additive. No new
  egress/seam code path; the reshape rides the existing mapToMp(ctx) both sites already share.
- Scope discipline: only the two DATA-USE purposes map to MP consent (storage is 017-02's cookie gate);
  pending omitted (not fail-safe DENIED — 017-03's seal-hold concern). The delegate-and-send posture
  (beacon still POSTs with consent DENIED) is ADR-0007's named departure, honestly documented.
No arch findings.
