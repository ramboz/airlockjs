---
slice: 014-01 — round-trip egress + generic hosting in core (alloy driver)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T17:33:12Z
prompt_source: review.py craft docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-01 <deliverables>
substrate: non-interactive
---

## Craft review — slice 014-01 — **pass** (nits hardened)
Two highest-value premises hold: the AC6 timeout race is provably safe (`settled` guarantees
single-post; `clearTimeout` on both settle paths; microtask/macrotask ordering correct; the
`Promise.resolve().then(dispatch)` wrapper routes a sync throw into `.catch`), and the extraction is
byte-faithful (no reconcile step or default dropped — only relocated to the transport-agnostic
boundary). Tests non-vacuous + bounded (AC6 mirrors alloy-coalescing-broker.test.js). Nits applied:
- **[4] single-slot driveEvent clobber (silent-hang footgun) → FIXED** — re-entry now REJECTS with a
  guard + a regression test.
- **[nit] throwing cookie sink → FIXED** — `caps.cookies.reconcile` wrapped in try/catch.
- **[2] timer-hygiene unasserted → FIXED** — the near-timeout test now waits past timeoutMs + asserts
  exactly one post; **[3] rejecting-dispatch test bounded** (`}, 2000`).
- **[nit] error-path statusText** (`String(err.message||err)` vs `String(err)`) — left (cleaner + the
  test expects it); noted in the deviation log.
