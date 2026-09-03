---
slice: 028-02 — per-beacon correlation
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:37:43Z
prompt_source: review.py frame-critique 028 'correlation' + deliverables
---

**Verdict: PASS** (adversarial pass returned **NEEDS-CHANGES**; all must-fixes applied → frame now sound).

The frame-critique confirmed the frame's three grounded claims survive attack — the held→flush "same id" WORKS
(the flush is a per-beacon `for (const b of flushing)` loop at `airlock.js:450-461`, not a wholesale splice-and-
merge); `wrapped-sdk-host`'s `m.id` is in scope + unique-per-fetch; and the event-type-stripped / beacon-keyed
re-scope is CORRECT (ready items are bare `EgressRequest`, type survives only on `dropped`). But it caught one
**load-bearing field-only bug**:

**The catch:** a beacon id must be unique at **COLLECTOR** scope, not instance scope. The collector is one shared
sink across all instances (028-01); every natural id-minter is an instance-local closure counter
(`airlock.js:139` `seq`, `alloy-chamber af-N`), so two co-wired instances (a GA4 airlock + a Meta-pixel airlock →
one collector) both mint `1,2,3…` and `query({ beaconId })` silently conflates their chains. Invisible to
single-source AC tests; fails exactly in the multi-tag topology the inspector exists for; the "mutate→red" DoD
would be vacuous. `+destination` does not rescue it (GA4 → one endpoint; two same-tracker instances → identical
destination).

**Must-fixes applied (2026-09-03):**
1. Beacon id is now **collector-unique**: `<instanceTag>#<local>` where `instanceTag` is a short random tag minted
   once per host construction (airlock's `seq`, wrapped-sdk-host's `m.id` as `<local>`). AC5 reworded — "synthetic
   per-beacon counter" (instance-local) replaced with the namespaced scheme.
2. **New AC4** — a two-source non-conflation control: two instances → one collector mint different ids;
   `query({ beaconId })` returns only one instance's records; **must go red under an instance-local id**.
3. "+destination disambiguates" **dropped**: destination is display context only; AC5 requires non-conflation to
   hold even when destinations are byte-identical.
4. **Secondary reframe applied** — Goal + anti-horizontal-phasing now say "**reconstruct** a governed beacon's
   decision chain" (the id links records to one beacon, not to the `push()` the developer has in mind).
5. **Minor** — `collector.js` flat-record invariant now enumerates `beaconId`.

Concessions the reviewer granted (not reopened): held→flush id survival, `m.id` scope/uniqueness, event-type-
stripped framing. Frame now sound → PASS to implement.
