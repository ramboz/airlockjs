---
slice: 026-01 — Meta Pixel through the generic connector, governed + dispatched (the archetype proof)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 3 rounds)
reviewed_at: 2026-09-02T21:56:13Z
prompt_source: review.py frame-critique
---

Frame-critique (026-01, pre-implementation) — PASS on the 3rd revision. Honest iteration history:

- v1 FAILED: the "rides the seam with ZERO core changes, governed end-to-end" premise was verified false in
  source — airlock's dispatch is POST-hardcoded (airlock.js:201/:363 ignore EgressRequest.method, though the
  contract defines it at connector.d.ts:63; dispatch is explicitly OQ10) and connector-selection is GA4-hardcoded
  (chamber.worker.js:46/62; airlock.js:148). A Meta /tr GET cannot ride it as framed. Also: the beacon carried no
  identity (_fbp/fbc swept under an "advanced matching" deferral by omission).
- Reframe (maintainer-ratified, lane b): 026-01 now SHIPS a real Meta /tr GET by building two bounded core seams
  (connector-selection + method-aware dispatch, resolving OQ10 for GET); "zero core changes" withdrawn; identity
  honestly scoped out (real-but-de-identified beacon).
- v2 RE-FAILED (surgical): the reframe's own new "bounded + verdict-preserving" claim was under-enumerated —
  (a) AC6 "held→flushed as GET" was un-satisfiable because the held-beacon record (airlock.js:176) drops `method`;
  (b) the unconditionally-wired GA4 critical/unload path (airlock.js:118 → egress.js:65 mapToMp, wired :277-280)
  would GA4-mis-map + POST a ring-resident pixel event to facebook.com/tr at unload — an untested egress hole.
- v3 PASS: :176 added to the method-aware set + AC6 now asserts the flushed GET end-to-end; the GA4 unload wiring
  (:277-280) made connector-conditional (minimal neutralization — :118 still constructs `critical`, no null-guards)
  + new AC10 proves no GA4-shaped POST at unload for a pixel instance; bounded-diff honestly enumerates all core
  sites (:149,:176,:201,:277-280,:363 + pixel-chamber.worker.js; :118/egress.js unchanged). All 10 ACs satisfiable
  + test-observable; every residual (map expressiveness, de-identified beacon, pixel unload-loss) disclosed +
  bounded; verdict-preservation regression-tested across verdicts + POST dispatch + unload. No load-bearing frame
  error remains. 3 optional implementer sharpenings folded into the slice (minimal neutralization; "unload-loss
  deferred" wording; explicit email denylist wiring so AC8's absence proof is a real strip).
