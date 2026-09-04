---
slice: 030-02 — the production RUM authority
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T01:35:32Z
prompt_source: review.py implementation 030 'RUM authority'
---

**Verdict: PASS** (reviewer returned NEEDS-CHANGES scoped to test coverage, not AC-compliance; the implementation was judged correct + additive-only, and the flagged coverage was closed inline — see craft).
- AC1 — `core/helix-rum-chamber.worker.js` first-imports `core/confine-helix-rum-chamber.js` (withheld fetch) + hosts `createHelixRumConnector`; `core/airlock.js`'s selection seam gains the `connector:"helix-rum"` branch; `build.mjs` emits the **5th** same-origin sibling. GA4/pixel/dom verified byte-unchanged (additive-only diffs). Non-vacuous (chamber-selection-string mutation reds it).
- AC2 — `bootHelixRum` = `createAirlock({connector:"helix-rum", egressPurposes:[], endpoints:[rumUrl(base,weight)], …})`; the host ceiling byte-matches the connector's resolved endpoint. Coupling now driven through a steady-state `{ready}` test (admitted at the ceiling), mutation-verified (ceiling decouple → red).
- AC3 — `top` on load + 3 error listeners + `startCwvCapture` on the real `web-vitals/attribution` (DI seam); a page-hide INP egresses in RUM shape (checkpoint/weight, non-zero `t`) via 030-01's dispatcher. Tested through the real `visibilitychange`→`unloadFlush` path.
- AC4 — confined (re-pointed beacon HELD at the seal) + not-consent-gated (`egressPurposes:[]`; admitted with no `setConsent`). AC5 — synthetic ephemeral per-page id; endpoint `ot.aem.live`; `web-vitals` a runtime lib.
