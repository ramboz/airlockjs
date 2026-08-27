---
slice: 007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-27T21:42:39Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

Craft — PASS (no blockers). STRENGTHS: fully event-driven handshake (AC2 fires only after the isolation message; completion waits on the chamber's {ready}) — no fixed sleeps, low flake risk on slow CI; both failure modes covered (10s timeout + worker.onerror reject -> non-zero exit, fails loudly rather than hanging); genuine throwing bare-reference form (document;) wrapped in try/catch so AC2 survives, e.name==="ReferenceError" standards-stable; non-vacuous (removing the deref flips AC1 fail). NITS: (1) [nit] teardown ran only on the happy path — a page.evaluate rejection skipped browser.close()/server.close() (process still exited non-zero, no CI hang/leak per Playwright pipe-close). ADDRESSED post-review: wrapped in try/catch/finally guaranteeing teardown on every path + a machine-readable FAIL line; rig re-run exit 0. (2) [nit] /package.json origin carrier is cosmetic — logged. RECONCILIATION: log the uc1-divergence (no build, source tree, no CSP) so future readers don't expect uc1 parity.
