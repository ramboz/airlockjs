---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-02, 064-03]
last_verified:
kind: spike
---

## Slice 064-04 — CAP: the capture session

**Goal:** Record the Adobe corpus (S0 to S13) once, per spec 064 sections 4 and 5, under ADR-0061.

**DoR:**
- ✅ D1 to D8 recorded. T2, B0 done. Owner has filled in the POC site URL and datastream ID (section 9) if the probe is used, and scheduled the settings window (D7).

**Acceptance Criteria:**

1. S0 positive control is recorded first with full fan-out and the capture mode stated.
2. Every fixture carries its full stored input state and passes the credential check.
3. Run order follows section 5.1, including the restore step and the Alloy bundle SHA check.
4. The owner's normal-browser capture (S12) is compared field by field; fixed or generated differences go to the owner before freeze.
5. Corpus size is 48 recordings: S9 states are recorded once without a repeat and the agent polls for changes (D12); S10 runs on the POC site without Launch (D10). A window past about 3 h continues in a second short sitting.

**DoD:**
- Corpus committed and frozen; the freeze note lists live-only rows and any gap.

**Anti-horizontal-phasing check:** One session producing the corpus every B-slice consumes; the pilot (CAP plus B1) proves it.
