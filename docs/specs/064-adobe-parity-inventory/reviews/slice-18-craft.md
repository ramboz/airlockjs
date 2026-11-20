---
slice: 064-18 — B2: Egress bridge
pass: craft
round: 2
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:35:00Z
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

## Round 2

**Verdict: pass. 0 blocking findings, 3 non-blocking.**

- **C2 — fixed.** Every keepalive request (beacon or `init.keepalive === true`) reserves from
  `createKeepaliveTracker` (`core/wrapped-sdk-host.js:566-572`), the same 067-06 helper as
  `core/airlock.js:299`. Past the quota it is one plain fetch, no retry, no second budget check.
  The tracker is released on every path: a sync throw from `dispatch` (`:576-579`), and resolve or
  reject via `.finally` (`:582`). On timeout the bytes stay reserved until the real fetch settles,
  which matches what the browser still holds in flight. Tests: a 70 KiB keepalive fetch and three
  concurrent 30 KiB beacons, including the release on settle (`test/egress-bridge-seam.test.js:128-157`).
  Both would fail on the round-1 code.
- **C1 — fixed.** Only the `.catch` path sets `networkError` (`core/wrapped-sdk-host.js:599`);
  ceiling, config-integrity, consent and timeout replies do not. The chamber throws `TypeError`
  only on that flag (`connectors/alloy/alloy-chamber.worker.js:378-382`). Pinned hermetically
  (`test/egress-bridge-seam.test.js:160-178`) and on the wire (`test/adobe-b2-egress.test.js:99-111`).
- **Stale reply after release: safe.** `respond` is single-shot (`settled`), and the `.then` returns
  early once settled, so a late dispatch after a timeout neither replies twice nor runs the handle check.
- **C6 — fixed.** `alloy-chamber.worker.js:37`, `connector.js:263` and `adapters/eds/index.js:1780`
  now describe the bridged `sendBeacon` and the stock endpoint list.
- **Google/Meta seams: unchanged.** The tracker path only runs when `m.beacon` or `init.keepalive`
  is set, and only the Alloy chamber posts `intercepted-fetch`. Full real-Chromium suite green
  (2954 passed).

New findings:

- **C7 — Low — `core/wrapped-sdk-host.js:587, 599`.** The `.catch` also catches a throw from the
  host's `onDiagnostic` sink inside `checkHandleTypes` (and inside the continuation's consent
  re-check). That would be flagged `networkError` after the request already went out, so Alloy
  would retry it on the other host. Only a throwing host sink triggers it. Guard the diagnose call
  or set the flag only on a `dispatch` rejection.
- **C8 — Low — `core/wrapped-sdk-host.js:223`.** The tracker is one per host, so Alloy's keepalive
  bytes and a `createAirlock` instance's bytes on the same page are counted apart, while the browser
  quota is shared. Same per-instance model as 067-06, and the host option lets a caller pass one in.
  Worth a line when this goes upstream.
- **C9 — Low — `core/wrapped-sdk-host.js:563-564`.** The older comment above the new one still says
  only "a beacon ... goes without keepalive"; the next line already says every keepalive request.
  Merge the two.

C3, C4, C5 and the `r0Origin` nit are carried in the slice notes as listed.
