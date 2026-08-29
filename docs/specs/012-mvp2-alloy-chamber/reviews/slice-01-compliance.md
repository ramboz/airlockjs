---
slice: 012-01 — wrapped-SDK host + alloy boots + one Analytics event
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-29T23:48:27Z
prompt_source: review.py implementation
---

**Verdict: pass** — all six ACs verified against their deliverables; observables traced through source + the rig's assertion logic. Independent compliance reviewer (general-purpose), bounded (11 deliverable files). vitest re-confirmed locally 227/227; the chromium AC2–AC5 observables relied on the recorded `npm run rig:alloy` green + reading the full assertion set in `rig/alloy-chamber.mjs`.

- **AC1** — `createConnectorHost` instantiates once (retained), `init` idempotent via `initStarted`, `routeBatch` mirrors `mapBatch` containment. Tests prove init-once (3→1), state-carries-across-events, host-level containment. Non-vacuous.
- **AC2** — classic `new Worker` + `importScripts(bundleUrl)` then revoked; bundle sha256 pinned; `usesImportScripts && !hasDynamicImport && !hasStaticEsm`. Module/dynamic-import route not taken.
- **AC3** — `cookies.sync {readSync,writeSync}` added alongside byte-identical async `get`/`set`; `document.cookie` shim delegates to it; first read = getApexDomain probe served from cache + write-back reconciled.
- **AC4** — worker `fetch` never calls real fetch (`workerRealFetchCalls` 0); main dispatcher runs exactly one real fetch to the mint stub; unique server-assigned ECID lands in the real `AMCV_*`/`kndctr_*` jar; XDM validates. Non-vacuous.
- **AC5** — confinement withholds XHR/WebSocket/EventSource/WebTransport/Worker/caches/sendBeacon (throwing stubs), preserves mediated `fetch`, applied before configure so alloy still boots+sends; adversarial self-probe reports each unreachable; `import()` recorded as disclosed-residual without faking.
- **AC6** — `contract-stability.test.js` pins each load-bearing signature as an on-disk `toContain` literal (fails on change/removal, free on addition); GA4 suites green within the 227-pass run.

FINDINGS: (none)

**Non-blocking note:** AC4's rig checks `query.identity.fetch.includes("ECID")` rather than the exact `["ECID","CORE"]` array named in the AC prose — still covers the load-bearing identity-mint claim. Recorded in the deviation log.
