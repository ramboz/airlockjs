---
slice: 017-01 — data-use consent reshape + the consent machinery (the grounded first point)
pass: craft
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T01:38:47Z
prompt_source: independent Opus review of Sonnet implementer diffs (017-01)
substrate: non-interactive
---

## Craft review — 017-01 — PASS
- resolveConsent: taxonomy-validated (unknown purpose → pending), case-normalized, granted/denied/else-pending
  — clean + pure. shapeMpConsent: data-use only, pending omitted, undefined when empty (→ map.js omits
  body.consent → back-compat). Both mirror the established core-module style.
- Tests genuinely assert: resolver cases (both-case granted/denied, unset+unknown → pending); shaper cases
  (single/both/none/storage-only); the reshape at mapToMp level (the shared mechanism) AND concretely at the
  sync fast path (createCriticalDispatcher + fetch spy) — a pragmatic both-sites proof without a real worker.
- Non-mutating fold ({...ctx, consent}); eds-boot's exact-ctx-equality (no-consent) still holds. 45/45
  targeted + 143/143 EDS adapter, no regression.
No craft blockers.
