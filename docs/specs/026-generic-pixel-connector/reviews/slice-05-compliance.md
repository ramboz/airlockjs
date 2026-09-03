---
slice: 026-05 — live-shippability: the `pixel-chamber.worker.js` bundle entry + N-worker build assertion
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T02:07:05Z
prompt_source: review.py implementation
---

Compliance (026-05) — PASS. All 7 ACs met + empirically confirmed against the emitted bundle. AC1: pixel-chamber.worker.js
is a WORKER_ENTRIES/entryPoints entry, emitted. AC2: the assertion is genuinely generalized to N workers via matchAll
(captures BOTH refs from eds.js), each checked known-expected AND emitted-sibling, blob:/data: scanned over all worker
chunks. AC3: build emits all 3 siblings, refs resolve, throws on failure. AC4: non-vacuous, both failure modes present
(referenced-but-unknown + referenced-known-but-not-emitted); dropping the pixel entry throws. AC5: dom-chamber NOT
bundled, exclusion grounded + documented (only new Worker call sites are airlock.js:182-183; dom-chamber never
new Worker'd). AC6: 004-01 CSP no-blob/data enforced over all chunks. AC7: build config only, no live ids. rig:bundle
PASS (no GA4 regression). Reconciliation item: core/airlock.js:177-179 stale "not yet wired into build.mjs" comment —
falsified by this slice; fixed in the close-out (comment corrected + the trap literal removed). Both nits applied.
