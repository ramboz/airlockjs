---
slice: 026-02 — more vendors as configs: the archetype generalises across real GET pixels
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-09-03T01:17:41Z
prompt_source: review.py implementation
---

Compliance (026-02) — NEEDS-CHANGES → PASS after remediation. The code deliverables are strong: AC1/AC2/AC3/AC5/AC6
met with non-vacuous tests; the generality thesis proven by a real table-driven test running the SAME
createPixelConnector across Meta+LinkedIn+Bing purely by config; ZERO connector/core code (both git diffs empty,
orchestrator-confirmed). LinkedIn (no event-name key) expressed as pure config via the interpreter's existing
null-omit rule (eventMap: {page_view: null}) — a real generality stress, no code escape. NEEDS-CHANGES was:
(1) AC4 "what varies" write-up + deviation log + reconciliation sweep missing — now authored (7-axis config-contract
write-up, sharpest: eventMap value = string|null, promoted to 026-03; all DoD boxes ticked); (2) [Medium] the
no-vendor-string grep's comment-stripper ate string-literal URLs, so a hardcoded vendor endpoint in connector.js
CODE could evade it — fixed to strip block + full-line comments only (fail-closed); (3) [Medium] bing.js prose
overstated grounding ("well-documented") vs the moderate-confidence inbox disclosure — softened + ADR-0020 pointer.
Craft nit (LinkedIn selective-strip) also fixed. No live identifiers (synthetic ids; fetch-spy). Frame-critique
re-pass recorded. All resolved; the slice fully meets its spec.
