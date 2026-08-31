---
status: DRAFT
dependencies: [022-01]
last_verified: 2026-08-31
frame_review: false
---

## Slice 022-02 — full checkpoint surface + sampling fidelity

> Detailed after 022-01 grounds the A/B hosting mechanism (the enhancer's checkpoint set + whether it hosts
> in a chamber or is reproduced natively decides this slice's shape).

**Goal:** Make airlock's governed RUM a **complete** stand-in for `sampleRUM` + `helix-rum-enhancer`, so
removing the page copy (022-03) loses **no** signal: the `error` checkpoints (the 3 window listeners —
`error` / `unhandledrejection` / `securitypolicyviolation`), the CWV/interaction (enhancer) checkpoints, and
**sampling-rate fidelity** (`weight` / `isSelected` — airlock emits only for selected page-loads, matching
the grounded rates). Payload governance applies to the identity surface (`id`, `referer`).

**DoR (provisional — firm up post-022-01):**
- ⚠️ Depends on 022-01's A/B decision + the grounded enhancer checkpoint set.
- The core governed-beacon path (022-01) is the vehicle each additional checkpoint rides.

**Acceptance Criteria:** _TBD — enumerate the checkpoint set from 022-01's enhancer grounding; each rides the
022-01 governed path; sampling parity is observable (selected → emit, unselected → silent); `id`/`referer`
governance is applied._
