---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified: 2026-11-13
---

## Slice 066-02: MT2, candidate settings list and completeness-probe protocol

**Goal:** The candidate pixel-settings list (spec 066 section 3) is extended from public Meta documentation and the retained config, and the completeness-probe protocol (6.1) names its exact public site list and method, so the owner's settings window (O2) and the approved probe (O4) are ready to run.

**DoR:**
- Spec 066 approved by the owner as amended (O1, 2026-11-13).
- O4 approved (dated in spec 066 10.1): crawl data first, plain-GET fallback.

**Acceptance Criteria:**

1. Section 3 lists SET1 to SET9 and any further candidate found in public Meta docs or the retained config. Each has its triggering page input and its owning M-slice. Each carries the three no-effect conditions (propagation wait, served config bytes checked, triggering input present).
2. The settings window plan states the number of states (SET1 to SET7, SET8 capped at 3, SET9, plus the restore), the one-change-per-step order, and the per-change wait. It fits the O2 answer (about 2.5 hours, same day as the Adobe window, overlapping waits).
3. The probe protocol names the public crawl-data source and, for the fallback, the public site list. It states the 60 homepage GETs cap, the one config GET per pixel found, the 30-pixel sample, the 10% threshold (4 of 30) and the metric (6.1). The site list name replaces the placeholder in 10.1.
4. The protocol is written but not run. It runs only inside 066-04 or after, using the O4 approval.
5. No network call to Meta or to any site. Reading public documents is allowed.

**DoD:**
- Sections 3, 6.1 and 10.1 of spec 066 updated with a dated note. `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** 066-04 (CAP) runs the settings window and the completeness probe from this slice's output.

**Anti-horizontal-phasing check:** A read-only planning task with a reviewable list as its end state.
