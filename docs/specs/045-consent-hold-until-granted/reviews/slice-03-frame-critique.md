---
slice: 045-03 — seal N-beacon fan-out re-map (per-beacon `remapKey`)
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T16:57:52Z
prompt_source: review.py frame-critique docs/specs/045-consent-hold-until-granted/spec.md 045-03 slice-03-fanout-remap.md adr-0024
---

VERDICT: pass (pre-implementation frame-critique; scope notes folded into ADR-0024 before this record)

REASONING:
The load-bearing assumption — each fan-out beacon is independently reconstructable at flush from (event, consent, remapKey) + live host ctx, with no cross-beacon coordinated state — holds. Verified against source: cited seal lines accurate (airlock.js:452/454 hold, :747 flush, :752-762 declined-dropped, :771-784 ceiling re-check; connector.d.ts:100-103 limit). `remap` is a single per-instance fn (airlock.js:81) so one key-aware remap is wireable and the 3rd-arg extension is a real seam. remapKey survives worker→main with no extra edit site (structured clone; connector-host.js:76 pushes whole req; airlock.js:356 reads data.ready with no allowlist; the shipped `event` channel from 044-02 is the precedent). Backward-compat byte-identical by construction. Floodlight forms are independently reconstructable (§A4 shared id from _gcl_au; only differentiator is a random num/ord cachebuster). Frame is unusually well-grounded for a frame_review:true artifact.

SPECIFIC ISSUES (all folded into ADR-0024 before recording):
- [folded] ADR "Becomes easier" over-claimed generality ("any N-beacon fan-out"). Option B only serves INDEPENDENTLY-RECONSTRUCTABLE fan-outs; a vendor needing a coordinated non-derivable cross-beacon value (server-assigned batch/dedup id echoed across all; mutually-exclusive sequence numbers) can't be reproduced by N isolated remap calls and the seal can't detect the inconsistency. → ADR generality tempered + a "coordinated fan-outs are out of scope (re-open)" Open question added.
- [folded] The "declined re-map → dropped" mitigation covers only a MISSING key (remap returns nothing); a COLLIDING key returns a valid WRONG form for both with no diagnostic. → ADR "Becomes harder" corrected to name both failure modes (observable declined vs silent collision; collision is 046-03's authoring burden).
- [note, correctly scoped] The synthetic FakeWorker proof injects `ready` directly and won't witness the worker→main crossing of remapKey — verified safe by the `event` precedent; flagged, not blocking (045-03 is mechanism + synthetic proof only).

Reviewer: general-purpose subagent, frame-critique pass, read-only, no authoring context; ground-truthed against core/airlock.js, contracts/connector.d.ts, connector-host.js, and the 044/045-01 re-map usage.
