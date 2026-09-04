---
slice: 030-02 — the production RUM authority
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T01:35:33Z
prompt_source: review.py implementation 030 'RUM authority'
substrate: non-interactive
---

**Verdict: PASS** (reviewer returned NEEDS-CHANGES with two AC test-coverage gaps; both closed inline + mutation-verified).
- **Gap 1 — AC2 endpoint-ceiling coupling asserted only structurally — FIXED.** The init-shape test never drove the coupling through the instance. Added a steady-state test that posts a real `{ready}` envelope whose url == the connector's own `rumUrl(base,weight)`; asserts it is ADMITTED (fetch once, to that exact URL) — the "no self-inflicted hold" property. Non-vacuous: decoupling the ceiling (`.rum/100`→`.rum/999`) reds it.
- **Gap 2 — AC4 "held if re-pointed" not exercised through bootHelixRum — FIXED.** Added a steady-state test posting a re-pointed url (`evil.example`) → HELD at the seal (fetch NOT called; endpoint-ceiling `held` diagnostic fires). The chamber cannot self-widen egress.
- **Coverage boundary (disclosed, defensible):** AC4's payload-whitelist + no-cookie clauses are inherited structurally from the DONE 022 `test/helix-rum-seam.test.js` (field-by-field against the identical `createHelixRumConnector`); bootHelixRum adds no payload shaping / wires no capability. Recorded in the sweep, not hand-waved.
- **Signature deviation recorded:** `bootHelixRum(opts)` not the spec's `(doc, opts)` — consistent with every sibling boot adapter (all opts-only); footgun acknowledged + mitigated by convention.
- **Design fact recorded:** the 030-01 unload/critical dispatcher POSTs to host-declared `endpoints[t]` with no ceiling check — page-hide confinement rests on the byte-correct host endpoint, matching GA4's existing critical path.
- 82/82 regression green; `npm run build` emits 5 same-origin workers.
