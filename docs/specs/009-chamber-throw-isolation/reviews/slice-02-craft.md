---
slice: 009-02 — chamber failure observability (surface drops + crashes)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:33:10Z
prompt_source: review.py implementation
substrate: non-interactive
---

Craft 009-02 — PASS (nits folded). Record shape consistent {level,kind,...} across both records; spread-conditional field inclusion is the right call (avoids filename:undefined). Two review nits folded post-review: (1) the degradation test now also asserts the omitted fields are ABSENT (expect(record).not.toHaveProperty("filename"/"lineno")) — locking the spread's omission behavior that was previously untested; (2) the garbled seam comment ("instead of — never in addition to") reworded to a clean single-sink statement. The drop record's `index` field is extra vs AC2's "type+reason" wording but carried from 009-01's disambiguation intent — useful, not noise.
