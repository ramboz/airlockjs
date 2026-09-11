---
adr: 0022
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique subagent, Opus)
reviewed_at: 2026-09-11T14:41:57Z
prompt_source: review.py frame-critique docs/decisions/adr-0022-*.md
---

VERDICT: pass

REASONING:
The single most-exposed assumption — that eager hashing closes the cold-cache teardown race well
enough to satisfy the owner's "advanced matching MUST ride the unload beacon" requirement —
survives. The frame is explicitly built to survive the exposed case: the load-bearing safety
property is OMIT-ONLY degradation ("never emits a raw identity value — 'omit' is the only reachable
miss behaviour"), which is independent of the race-window magnitude and rests on withholdFetch
confinement (verified: core/confine-pixel-chamber.js first-import; the endpoint ceiling checks
destination not param values, airlock.js:304). The ADR does not assert the window is narrow — it
schedules the residual as "must be tested" + kill-criterion #2 + a sync/main-thread fallback. A2
(sync main-thread unload) and A5 (confinement) are code-verified; A3 is capture-grounded for
external_id with an honestly-recorded PII residual. The frame survives the strongest attack.

TWO NON-BLOCKING FINDINGS — BOTH FOLDED (verdict already pass; folded for strength):
1. The em/ph identification-time race is the EXPOSED one (boot-time external_id is reliably warm;
   identification-then-navigate em/ph can be teardown-adjacent — the high-value closing PageView).
   FOLDED: kill-criterion #2 now names this profile explicitly + requires the 026-04 teardown-race
   test to exercise identification-then-immediate-navigate PII (not just boot external_id); 026-04
   AC4 updated to match.
2. The raw-identity feed channel was unnamed. FOLDED: the Decision now states raw identity feeds the
   worker on a DEDICATED channel (init / setIdentity), NOT via push()/events — bypassing the host
   payloadDenylist by design, safe because withholdFetch confines the worker; 026-04 AC2 updated
   with a test that PII fed via the identity channel is hashed even under a payloadDenylist.
