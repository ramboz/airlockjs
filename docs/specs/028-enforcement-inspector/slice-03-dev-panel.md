---
status: DRAFT
dependencies: [028-01, 028-02]
last_verified:
# design_review: consider — the panel ships visual design; if fidelity must be a
#                HARD gate, extract its design values into ACs + wire a servo
#                design-eval (ADR-0049). Low-stakes dev tooling likely attest-by-eye.
---

## Slice 028-03 — the drop-in dev panel

**Goal:** A lightweight, local, **drop-in-JS** panel over the query API that renders the enforcement-decision
stream (and, per 028-02, per-beacon chains) for a developer — the visible inspector. No remote/hosted trace
backend, no account (both MVP5 no-gos). Reads off the hot path — zero interaction-path cost.

**DoR:**
- ☐ 028-01 + 028-02 DONE (the query API + per-beacon correlation exist to render).
- ☐ Panel scope confirmed: a minimal data-driven panel (filter by kind/disposition/purpose; drill into a
  beacon's chain), not a full UI framework.

**Acceptance Criteria (draft — sharpened at READY):**

1. A drop-in panel renders the live enforcement-decision stream from the query API (kind / disposition /
   purpose / beacon-chain views).
2. The panel adds **zero interaction-path cost** (measured — it reads the collector off the hot path; it must
   not fold work into capture, per the MVP5 no-go).
3. Local + drop-in only — no network calls, no remote trace backend, no account requirement.
4. The panel degrades gracefully when the collector is absent (no inspector wired → no panel error).

**DoD:** _standard (see 028-01); full ACs + any design-fidelity ACs sharpened when this slice reaches READY._

**Anti-horizontal-phasing check:** after this slice a developer opens a panel and *sees* why beacons fired /
held / were gated / stripped — the vision's first-class inspector, the differentiator vs Zaraz's opacity.
