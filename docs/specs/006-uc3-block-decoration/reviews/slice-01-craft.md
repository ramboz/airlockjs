---
slice: 006-01 — block instrumenter → `view_block` GA4
pass: craft
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-27T16:52:27Z
prompt_source: review.py craft docs/specs/006-uc3-block-decoration/spec.md instrument <deliverables>
substrate: non-interactive
---

# 006-01 craft — VERDICT: pass

All ACs met / boundary sound / craft clean (per pass). 119/119 tests; rig:uc3 PASS all
gates (no view_block before scroll; one conformant promo after scroll; no re-fire on
scroll-back; no teaser; NO chrome — view_block_beacons_seen=["promo"]). The frame-critique
main-scoping fix is proven load-bearing: header/footer chrome blocks ARE decorated (404s
seen) yet fire no view_block. WeakMap association (module-private, no data-track written —
setAttribute-spy tested); connectors/ga4/map.js absorbed view_block unchanged (generalization
proof); golden pins the payload (ga4_mp_conformance). Contract table honored exactly (no
event the table doesn't list).
Nits folded at reconciliation: the view gate now has an explicit intersectionRatio>=0.5
guard (craft — isIntersecting is geometric per the IO spec, not a ratio threshold; the
50% floor is now self-documenting + mutation-tested via a new decoupled-mock test);
architecture.md clarifies WeakMap ownership (orchestrator = projection/cross-airlock;
adapter = transient module-local lookup, e.g. blocks.js block_name — arch review). Deferred
(deviation log, tied to the parked once-per-page boot / OQ12 item 4): the module-global
metaMap vs per-boot Set lifetime asymmetry + the guard-flag-placement sibling inconsistency.
