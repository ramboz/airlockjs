---
adr: 0009
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-29T23:39:31Z
prompt_source: review.py frame-critique
---

**Verdict: pass** — one adversarial frame-critique round (independent general-purpose reviewer); all five load-bearing premises sound or honestly hedged.

- **[1] Adequate-because-AC5-confines-egress — sound, not over-claimed.** The ADR scopes "adequate" to the MVP2 proof scope, names the Worker a "shared-heap, same-language sandbox" lacking WASM's memory-safety, and states B suffices *because* AC5 makes the mediated `fetch` the sole network surface — not because a plain Worker is inherently safe. Memory-safety is disclaimed, not claimed.
- **[2] Ratify-not-decide — intellectually honest.** Four merit-based drivers (fault isolation, bundle maturity grounded in executed R-004, WASM-bridge overhead for the 766 KB IIFE, egress-chokepoint completeness), a real weighing of Option C, and a *deferral* (not foreclosure) with kill-criteria. The reserve-ADR → build-ACs → record-ADR ordering matches a genuine ratification of an owner precondition.
- **[3] Deferring Option C — sound for proof scope.** The proof needs egress-confinement + fault-isolation (delivered), not memory-safety; C's structural isolation is deferred to a later milestone + MVP3 seal enforcement, with appropriate reactive kill-criteria.
- **[4] Grounding real.** Claims trace to executed R-004 (CONCLUDED) + committed 012-01 AC2–5; `import()` is disclosed as *reachable/unclosed*, not solved. Nothing asserted as proven that wasn't built.
- **[5] Correct relation to ADR-0001/0008.** RESOLVES ADR-0001's deferred B-vs-C axis via a new dependency-linked ADR (ADR-0001 not edited/superseded); faithful to ADR-0008's "coherency axis separable / does not constrain B-vs-C"; preserves the still-deferred read-semantics.

**Two non-blocking tightenings the reviewer named — both applied before acceptance:**
- (a) The kill-criterion no longer implies AC5's shim-based egress confinement is immune to the shared-heap gap: it now states a memory-safety breach can defeat the `fetch` shim itself, so the chokepoint is only as strong as the Worker's same-language isolation.
- (b) The Grounding paragraph now points concretely at the recorded `rig:alloy` run (green, 2026-08-29; AC2–5 commits) and notes 012-01's IN_PROGRESS remainder is review + reconcile, not the demonstration.

Recorded by: author, after one independent frame-critique round (pass), with the two named tightenings applied.
