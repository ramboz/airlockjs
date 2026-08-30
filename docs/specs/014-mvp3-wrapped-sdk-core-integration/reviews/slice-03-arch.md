---
slice: 014-03 — converge connector-hosting (GA4 retrofit)
pass: arch
verdict: pass
reviewer: self (orchestrator; subagent stalled)
reviewed_at: 2026-08-30T19:46:34Z
prompt_source: review.py arch … 014-03 (subagent reviewers stalled on a vitest hang; orchestrator completed)
substrate: non-interactive
---

## Arch review — slice 014-03 — **needs-changes → fixed → pass**
_Provenance: the independent arch subagent stalled + was stopped, but its final logged thought flagged
the real issue below; the orchestrator verified + fixed it._
- **[reads over-declaration] BLOCKER → FIXED.** The connector declared `reads: ["*"]`, justified by a
  FABRICATED ADR-0006 "wildcard" citation (no such sentence exists in ADR-0006). But `reads` is the
  PROJECTION snapshot channel (contracts/connector.d.ts:126 "Projection snapshot fields this connector
  reads (ADR-0003)"), authoritative + default-deny — a DIFFERENT channel from the event payload. GA4's
  `handle` reads the payload + host `ctx`, NEVER `event.snapshot`, so it reads ZERO projection fields.
  **Fix:** `reads: []` (+ corrected the docstring/comments/test; the fabricated citation removed). A
  `["*"]` there would have violated ADR-0003's default-deny.
- **[events wildcard] SOUND** — `events: ["*"]` is defensible: GA4 is the analytics CATCH-ALL and accepts
  arbitrary custom event names (contracts/ga4-mp.md), so enumeration is impossible; the event PAYLOAD
  crosses ungoverned (ADR-0006), declared-not-enforced. Justification corrected to say this (not the
  fabricated citation).
- **[one hosting mechanism] SOUND** — GA4-as-ConnectorFactory closes MVP2 arch-flag-3 (one hosting
  mechanism; connectors/ga4 now symmetric with connectors/alloy). The two ORCHESTRATORS (airlock.js +
  wrapped-sdk-host.js) legitimately remain, per the spec's reframed honest scope (arch-4).
- **[deviation 5] acceptable + hardened** — the async diagnostic gap is unreachable + now has a `.catch`.
