---
slice: 064-18 — B2: Egress bridge
pass: compliance
round: 1
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:40:00Z
prompt_source: review prompt, slice 064-18 (uncommitted worktree diff)
---

# 064-18 compliance — Round 1

**Verdict: pass. 0 blocking findings, 3 non-blocking.**

Evidence run: `npm test` (2909 passed), `npm run lint` (clean), and
`AIRLOCK_REAL_CHROMIUM=1 npx vitest run` (144 files, 2947 passed). No servo gate script exists
(`.servo/` holds only `install.json`), so the DoD "servo gate" is read as the vitest component.

## AC by AC

| AC | Verdict | Evidence |
|---|---|---|
| 1. Fetch init carried | Met | Chamber copies the 4 fields (`alloy-chamber.worker.js:342-348`), seam whitelists them (`core/egress.js:100`, `core/wrapped-sdk-host.js:562`), adapter applies them (`adapters/eds/index.js:1714`). Real Chromium sees the recorded init and headers (`test/adobe-b2-egress.test.js:33-41`); the wildcard-CORS test (`:93`) proves `credentials: include` is applied on the wire. |
| 2. Beacon, pixels, loads | Met | `sendBeacon` routes as a flagged keepalive POST through every gate (`alloy-chamber.worker.js:285`); off-list beacon is held with a diagnostic (`test:125`). IMG/SCRIPT/IFRAME post `unbridged-load` with a reason (`alloy-chamber.worker.js:195-205`, `wrapped-sdk-host.js:602-605`). The recorded `identity:exchange` pixels are tagged (`test:153`). |
| 3. Edge domain kind, `x-adobe-edge` | Met, see F2 | Adobe edge default (`test:88`), host-set first-party domain with the same tenant pin (`test:80`, `egress-bridge-seam.test.js:96-104`). All response headers reach the chamber (`adapters/eds/index.js:1716-1718`, `test:46`). |
| 4. Unknown handle loud | Met | `unknown-handle` error diagnostic (`wrapped-sdk-host.js:274-290`); list = 8 consumed + 2 observed ignored, as s2.2 says (`connector.js:72-83`). Corpus raises none (`test:150`). |
| 5. Default allowlist | Met, see F3 | `ALLOY_STOCK_ENDPOINTS` (`connector.js:32`) covers every Adobe host+path in the corpus (checked: 9 shapes on `adobedc.demdex.net` / `edge.adobedc.net`). Consent hold and denylist untouched. |
| 6. S0, S3, S6, S8, S11 clean | Met, see F1 | S0, S3, S11 (6 fixtures, `test:24`), S6 set-consent (`test:67`), S8 blocked and non-200 (`test:99-113`). |

## Findings

- **F1 — Medium — `test/adobe-b2-egress.test.js:67`.** S6 is three states but only `s6-in` is
  pinned. I replayed `s6-out` by hand and its set-consent compares clean (URL, body, on the wire).
  `s6-pending-in` sends only set-consent, not the two queued interacts (the carried 067-03
  residual; B3 owns it). Add `s6-out` to the loop so the "S6 transport" claim is fully covered.
- **F2 — Low — `test/adobe-b2-egress.test.js:46`.** "`x-adobe-edge` is read" is proven as
  "delivered to the chamber". Nothing checks that Alloy acts on it (cluster cookie or next-request
  hint). Good enough for B2; name the gap or add one assertion.
- **F3 — Low — `connectors/alloy/connector.js:32-42`.** s2.2 lists `collect` generally, but the
  list only allows the hinted `collect`. A hint-less `/ee/v1/collect` (unload before the hint is
  known) would be held visibly, not dropped, and it is not in the corpus. Note it for B3.
