---
slice: 030-04 — the scoped-replace boundary + the decision landed
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T02:16:23Z
prompt_source: review.py implementation 030 'boundary'
---

**Verdict: PASS** (docs-only slice — the gate is the HONESTY + ACCURACY of the boundary/contract).
- AC1 — the decision is landed in `docs/decisions/lightweight-decisions.md` (2026-09-03 "helix-rum adoption: replace (core checkpoints)"): replace is the recommended default; feed/coexist remain; resolves the MVP4 feed/replace/coexist item; **builds on, does not supersede** the 2026-09-01 governance exemplar (the Scope now also distinguishes this core-checkpoint replace from the deferred FULL-parity cutover 022-03/05, so "replace" can't be misread).
- AC2 — `connectors/helix-rum/README.md` created: the honest boundary (replace covers `top`/`error`/`cwv`; NOT the interaction/lifecycle set → deferred to worker-dom compat / community connector) is a prominent top-level section with an explicit "if you need those, do NOT replace."
- AC3 — the creds-gated live gate ("never verified live"; the 030-03 rig network-STUBS `ot.aem.live`) is named in BOTH the decision and the README's "before a real cutover" section; in-repo demo explicitly distinguished from a live cutover. Not oversold ("page-side demonstrated, not live-verified").
- AC4 — the `sampleRUM`→`bootHelixRum` drop-in path is documented and independently **verified byte-accurate** against `aem.js` (the sendPing guard), `index.html` (the flag-before-aem.js), and `adapters/eds/index.js` (the bootHelixRum signature + inert-handle return); `forceSelect` disclosed as testbed-only.
- AC5 — primer hygiene applied (mvp5 bullet + JIG row; mvp4 forward-pointer; inbox R-007 struck through + resolved; status board flipped at close).
- No broken cross-doc links; no oversold claim; no contradiction with the prior RUM decisions.
