---
status: DONE
dependencies: []
last_verified: 2026-11-14
---

## Slice 064-02 — T2: datastream setting list and completeness table

**Goal:** List every datastream setting that can change served behavior, with its triggering page input and a disposition, so S9 covers them.

**DoR:**
- ✅ Spec 064 approved (D1) and the owner has exported the test datastream config into the repo (D6).

**Acceptance Criteria:**

1. Each setting has a triggering input and a disposition: covered by S9, no effect (with the three conditions in spec 064 section 6), or gap.
2. The public command list is reconciled against the 17 commands read from the pinned source (2 core, 15 component). Any difference is a row or an explicit non-row.
3. The out-of-inventory rate is computed and compared with the 10% threshold.

**DoD:**
- Table committed in spec 064 section 6. No production probe run except under section 9.

**Anti-horizontal-phasing check:** Preparation task; delivers a complete table the capture session consumes.

### Deviation log

- DoR item (full export of the test datastream config): not met as written. The owner sent a summary on 2026-11-14 instead (datastream ID and name, Analytics report suite, Target property and environment). The coordinator decided the summary is the D6 input and the DoR is met by it. The repo is public: per owner decision D9 only the org ID and datastream ID are committed; the report suite, Target property and environment are labels. Every other setting value is `confirm at window start`. POC site URL and edge domain default were added from the POC repo.
- Findings, all reported and none acted on by changing scope: public docs say datastream changes take up to 35 minutes to propagate (spec assumes 10); out-of-inventory rate 7/36 = 19.4%, above 10% (kill criterion 6); S9 brings the corpus to 61 recordings, above 60 (kill criterion 4), and the window exceeds one ~3 h session at a 10-minute wait.

### Reconciliation sweep

- AC1: spec 064 section 6.1 (36 rows, each with trigger, disposition, owned-value label), 6.2 (ordered window checklist), explicit non-rows. Met.
- AC2: section 6.4 (14 public vs 17 source; 3 source-only commands, 0 the other way). Met.
- AC3: section 6.5 and section 10 (7/36 = 19.4% vs 10%; trips, scope unchanged). Met.
- Counts updated consistently: S9 row and estimate in section 5 (61 recordings), section 10 value. D1 to D8 untouched.
- Review round 1 (needs-changes, 2 blocking) fixed: S9-03 now restores the Target changes; owner inputs for S9-11 listed; DS-36 counted as covered by the S1 edge-domain variant. Round 2 is in reviews/.
