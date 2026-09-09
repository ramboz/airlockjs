---
adr: 0021
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T17:15:21Z
prompt_source: review.py frame-critique docs/decisions/adr-0021-core-egress-batching.md (round 3)
---

Frame-critique verdict: **pass** (round 3, independent jig:reviewer, read-only, pre-commitment ADR gate). Rounds 1-2
(needs-changes) caught a load-bearing GROUNDING error: the ADR mis-cited `sendBatch` (the inbound ADR-0012 payload
denylist, main→worker) as "the egress seal / single governed exit" where coalescing would live — which would place
coalescing PRE-verdict (the smuggling path). Corrected: the egress consent seal is `egressVerdict` (core/airlock.js:254-286,
ADR-0007 point ③), immediately followed by the distinct endpoint-ceiling check (:287-299, ADR-0006/016-01), then the
`fetch` (:300). Round-3 verified all four seam labels against source and confirmed governance-preservation holds by
construction: the coalescer is specified to run AFTER both the per-request egress verdict AND the endpoint-ceiling check,
before the fetch, so neither a denied nor a ceiling-blocked event can enter a merged request.

Decision (Option C): core-egress coalescing at the shared dispatch, protocol-pluggable (per-connector `coalesce` hook,
default no-coalesce = no regression), per lock-through cycle, keyed by endpoint+verdict+credential. Justified on
request-count efficiency, EXPLICITLY NOT parity (the 038 field-level oracle can't score transport) and NOT INP/connections
(mapping already off-thread; HTTP/2 multiplexes). Two residuals correctly deferred: (1) the efficiency benefit is
unmeasured — gated by kill-criterion #1 as spec 040's FIRST slice, which gates the core-seam build itself (no dead surface
if shelved); (2) coalescing-key precision (e.g. GA4 same-tid) is Open Question #3, per-adapter in 040. 040-design note
from the reviewer: the consent verdict is cycle-uniform (closure-level vector), so the key's real separating dimension is
the ceiling/URL, not the verdict.
