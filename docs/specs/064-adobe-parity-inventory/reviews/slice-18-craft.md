---
slice: 064-18 — B2: Egress bridge
pass: craft
round: 1
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:40:00Z
prompt_source: review prompt, slice 064-18 (uncommitted worktree diff)
---

# 064-18 craft — Round 1

**Verdict: pass. 0 blocking findings, 6 non-blocking.**

## Google/Meta regression risk in the shared seams: low

- `core/endpoint-ceiling.js:95-145`: the `{hint}` matcher only builds when a declared endpoint
  contains `{hint}`. No GA4 or Meta endpoint does, so their exact and prefix paths are unchanged.
- `core/egress.js:100`: `sanitizeFetchInit` is new and additive.
- `core/wrapped-sdk-host.js`: `knownHandleTypes` defaults to `null` (no check); `pinnedHosts`
  equals `{pinnedHost}` without `extraHosts`, and `pinFor` returns the same pin; `init`/`beacon`
  are only set by the Alloy chamber (the only `intercepted-fetch` poster). The full real-Chromium
  suite is green (2947 passed).

## Findings

- **C1 — Medium — `connectors/alloy/alloy-chamber.worker.js:378`.** Every status-0 reply now
  rejects with `TypeError`, including "held at the seal" replies (`wrapped-sdk-host.js:366, 404,
  520, 554`). S8 shows Alloy falls back to the other domain on `TypeError`, so a held or
  consent-denied request likely gets a second try on the other host and a second hold and
  diagnostic. Nothing leaks (the retry is gated too), but it changes the noise and the request
  count. Only throw `TypeError` for real network failures, or add a test that pins the
  held-request count.
- **C2 — Medium — `core/wrapped-sdk-host.js:562-563`.** The 64 KB keepalive budget is applied
  only to beacons. A chamber `fetch` with `keepalive: true` and a larger body passes through and
  the browser rejects it, so it fails instead of being sent. That conflicts with the "nothing is
  dropped for the keepalive cap" rule. Apply the same budget check to every `init.keepalive`.
- **C3 — Low — `alloy-chamber.worker.js:294-296`.** Beacon bodies: a Blob keeps its bytes but
  loses its `type` (headers are `{}`); an `ArrayBuffer` or `FormData` becomes `"[object ...]"`.
  Alloy sends strings today, so this is latent.
- **C4 — Low — `alloy-chamber.worker.js:200-216`.** SCRIPT and IFRAME are reported on `src`
  assignment, but a real browser only loads them once inserted. That can over-report. IMG is fine.
- **C5 — Low — `core/endpoint-ceiling.js:85`.** `[a-z][a-z0-9]{1,9}` also matches `v1`, so
  `/ee/v1/v1/interact` is allowed. It is harmless on Adobe hosts, but a reserved-word exclusion or
  a comment would make that clear.
- **C6 — Low — stale comments.** `alloy-chamber.worker.js:37` still says `denySendBeacon`;
  `connector.js:16, 263` and `adapters/eds/index.js:1782` still describe a single-interact floor.

## Test quality

The tests are good. They check the wire (Chromium's network log) and not just what the chamber
emitted. The wildcard-CORS case (`test/adobe-b2-egress.test.js:93`) is a strong check that
`credentials: include` really applies. The seam test covers off-list, case-variant and
multi-segment holds (`test/egress-bridge-seam.test.js:91-94`). Gaps:
- `test/adobe-b2-egress.test.js:158`: `r0Origin` hardcodes the capture origin for the AC4 CORS
  header. Derive it from the fixture manifest.
- No test for C1 (held count) or C2 (large keepalive fetch).
