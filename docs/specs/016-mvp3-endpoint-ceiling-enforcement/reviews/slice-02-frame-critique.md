---
slice: 016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR archetype)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T00:21:50Z
prompt_source: review.py frame-critique 016-02 (two rounds)
---

## Frame-critique — 016-02 (alloy: ceiling + config-integrity reconciliation) — TWO ROUNDS → all applied → pass

**Round 1 (needs-changes):** config-integrity (015) is a single-HOST gate, not tenant-only, so composing a
set-based ceiling naively ("both run on every egress, both must pass") is incoherent (holds a legit 2nd
declared origin; "absent tenant key → hold" wrongly holds non-interact requests). **Applied:** reconcile the
axes — ceiling owns host+path (all egress); config-integrity's tenant check scoped to the interact
(pinnedHost), a composition-seam behavior gated on ceiling presence (015 code unchanged, standalone tests
green).

**Round 2 re-critique — verified the reconciliation RESOLVED the incoherence** (foreign hosts held by the
ceiling; override coherent; 015 standalone green), but found a NEW load-bearing gap: scoping config-integrity
to a single pinnedHost means a DECLARED non-pinnedHost origin gets ceiling host+path checking but NO tenant
check — and if it's configId-keyed (e.g. edge.adobedc.net, un-grounded) an operator declaring it reopens the
013-03 re-route, unheld+unalerted. AC5(d)'s test used a no-tenant-key 2nd origin, hiding the risky case.
Plus: a false DoR (016-01 asserted DONE — it's DRAFT), and the floor (1 origin) sits below 013-02's measured
lower bound (2), the un-grounded caution applying equally to the interact origin. **Applied:** (i) enforce a
SINGLE grounded interact-origin floor (= pinnedHost → the gap cannot arise in the shipped config); (ii) do
NOT tell operators to blindly declare a 2nd origin — a tenant-keyed 2nd origin needs the multi-tenant-pin
model (config-integrity extended to a host→tenant set), a named deferred follow-up; (iii) AC5(e) now tests
the GAP with a tenant-keyed 2nd origin + asserts it's surfaced/flagged, never silent; (iv) fixed the DoR to
a sequencing dependency; (v) the chamber-grounded egress probe (ADR-0006 Kill #2) must PRECEDE expanding the
declared set — named, and the held-legit-edge drift cost stated honestly.

### Net
The ceiling adds PATH confinement over 015's host-only check + a clean host+path / tenant axis split; the
alloy egress BREADTH + 2nd-origin tenant-keying are genuinely probe-gated (per ADR-0006's own kill
criterion) and honestly deferred, with the tenant-coverage gap named + test-pinned rather than opened.
