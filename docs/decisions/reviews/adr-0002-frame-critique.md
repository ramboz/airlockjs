---
adr: 0002
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-26T00:51:57Z
prompt_source: review.py frame-critique docs/decisions/adr-0002-event-descriptor-cycle-semantics.md
---

# Frame-critique verdict — ADR-0002 (narrowed; egress deferred)

**Verdict: pass** (fresh-eyes adversarial re-critique after narrowing to the
descriptor + cross-to-worker cycle + overflow, with the egress model deferred to
OQ10 and the descriptor↔egress coupling made explicit).

The keystone frame — the interaction path stays O(1) (append + synchronous
projection fold, mapping deferred) and the normal-path descriptor + cross-to-worker
cycle can be frozen now, independent of the still-open egress model, with the
descriptor↔egress coupling contained to a declared set of unload-critical event
types — is unusually well-grounded and survives attack. The O(1)-fold assumption
is conceded with a spike-triggered kill criterion; the chunk+yield claim is
verified (R1); the egress coupling is explicitly bound to OQ10 (open question +
kill criterion + resolution trigger); and the frozen normal-path descriptor
(payload-ref + snapshot-slice + monotonic seq) serves both OQ10 dispatch options,
leaving only the conceded unload window exposed.

## Residual notes (non-blocking; folded in, and carried to the spike)

1. **The drain stage participates in the delivery tension** OQ10 attributes to
   egress. Under sustained no-idle load the idle-gated drain must either overflow
   (drop-oldest discards events before they reach the worker) or fire on its
   max-latency cap and run serialization during the storm (the R1 jank). So
   "eager worker dispatch avoids the undeliverable backlog" is only partly true —
   worker egress cannot rescue events the drain never delivered. The spike's
   delivery-rate oracle must instrument the drain stage, not just worker egress.
   *Folded into OQ10's resolution trigger.*
2. **The lazy-fold escape hatch depends on an unstated invariant.** The
   O(1)-fold kill criterion's mitigation (move heavy fields to the side-table,
   fold lazily) is the same lazy fold that disqualified Option C for breaking
   AD-3 synchronous-read correctness; it is safe only if no synchronous reader
   consumes the lazily-folded fields. *Folded into the kill criterion.*

Reviewer: general-purpose (jig frame-critique prompt). Pass recorded 2026-08-25;
the two non-blocking notes above were folded into ADR-0002 (kill criterion) and
OQ10 (resolution trigger) before acceptance.
