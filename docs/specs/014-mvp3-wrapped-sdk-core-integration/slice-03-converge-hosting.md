---
status: DONE
dependencies: [014-01]
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-03 — converge connector-hosting (GA4 retrofit)

**Goal:** Retrofit **GA4** onto the generic `core/connector-host.js` so both connectors — the
wrapped-SDK alloy (014-01) and the wire-protocol GA4 (MVP1) — are hosted **one** way, and converge /
retire the GA4-hardcoded `core/chamber.worker.js` path (`core/airlock.js` hardcodes
`new Worker(new URL("./chamber.worker.js", …))` importing GA4's `mapToMp` directly). After it there is
**one connector-HOSTING path** in core, not two that calcify — closing the MVP2 arch flag 3 debt.

**Honest scope (014-01 arch-4).** This converges the *hosting*, **not** the egress paths — THREE
legitimately coexist and are **not** folded into one: (i) GA4 **fire-and-forget** `ready` dispatch,
(ii) the wrapped-SDK **round-trip** dispatch (014-01), and (iii) `core/egress.js`'s **synchronous
unload fast path** (GA4-only, which an async `dispatch(req) → Promise` structurally **cannot** serve,
and which needs `keepalive` that `EgressDispatchRequest` lacks). The MVP3 enforcement seam binds to the
**steady-state dispatch** (i + ii); the unload fast path stays a **separate synchronous path** a later
enforcement spec handles on its own terms (unload-time — no interaction to protect — reusing the
byte-identical `mapToMp`). **⚠ Named for that enforcement spec (frame-critique [4]):** "no interaction
to protect" justifies sync *mapping* (INP) but says nothing about *gating* — the sync unload egress
(`core/egress.js`'s `fetch(endpoints[t])`) **bypasses the manifest + the seal**, and being synchronous
**cannot call an async seal-gate**. So MVP3's endpoint/consent enforcement inherits a genuinely hard
**synchronous-gating** sub-problem here — flagged now so it isn't discovered late. So the deliverable
is "one hosting path + a clearly-bounded set of egress paths," not the over-claim "all egress at one
seam."

**DoR:**
- ✅ [014-01] DONE — `core/airlock.js` can host a connector via `createConnectorHost` in a real
  chamber (the generic path is wired into core, proven with alloy).
- ✅ GA4 exists to retrofit: [`connectors/ga4/map.js`](../../connectors/ga4/map.js) (`mapToMp`),
  [`core/chamber.worker.js`](../../core/chamber.worker.js) (the hardcoded host), and the GA4 test
  suite (`test/ga4-*.test.js`, `test/egress-fastpath.test.js`, `test/oracle-ga4.test.js`).

**Acceptance Criteria:**

1. **GA4 hosted via the generic host.** GA4 is expressed as a `ConnectorFactory` (manifest → factory
   → init → `handle`) and hosted through `createConnectorHost` — **not** the hardcoded `mapToMp`
   import in `core/chamber.worker.js`. Observable: GA4 events route through `routeBatch` →
   `ready: EgressRequest[]`, the same host alloy uses. **Impedances to bridge (frame-critique):**
   (a) author a **GA4 manifest** (`connectors/ga4/` is only `map.js` + `cookies.js` today — no
   manifest exists); (b) `mapToMp` reads `event.params`, but the contract's `AirlockEvent` is
   `{payload, snapshot}` — so the generic GA4 worker feeds `handle` the legacy `{type, params}`
   descriptor (the same `event.params || event.payload` bridge alloy already uses), leaving `mapToMp`
   **untouched** (AC2 byte-identity); (c) the per-tracker `busy(workFactor)` loop is re-homed into
   `handle` (no byte impact).
2. **Fire-and-forget egress intact.** GA4's `ready` requests are dispatched by `core/airlock.js` on
   the main thread via `fetch(..., {keepalive})` (ADR-0004) — the wire-protocol model is unchanged;
   the round-trip surface (014-01) is used only by wrapped-SDK connectors. Observable: GA4 egress is
   byte-identical to MVP1 (`mapToMp` output unchanged). **Note (frame-critique):** `routeBatch` / the
   host's `init` are async (vs `mapBatch`'s sync path) — the generic worker glue must sequence
   **init-before-events** (trivial for GA4's sync `mapToMp`, which resolves in a microtask before the
   next message macrotask; the `{ready, dropped}` return shape is identical to `mapBatch`, so
   `airlock.js`'s `onmessage`/`drain`/`ring`/`projection` stay **untouched** — only the Worker URL +
   init payload change).
3. **OQ10 unload fast path preserved AS A SEPARATE synchronous path (arch-4).** The synchronous
   main-thread `pushCritical` + the `visibilitychange`/`pagehide` ring-tail flush still map via the
   pure `mapToMp` (byte-identical), never entering the worker — and are **explicitly NOT** folded into
   the async `caps.egress.dispatch` seam (it can't serve a synchronous keepalive path). Observable:
   `test/egress-fastpath.test.js` green; no double-send; the unload path remains synchronous.
4. **One hosting MECHANISM (not one orchestrator).** The GA4-hardcoded `core/chamber.worker.js`
   mapping path is **retired** — GA4's chamber now hosts its connector via `createConnectorHost`, the
   **same mechanism** alloy's chamber uses, so no two divergent hosting mechanisms remain. Observable:
   **both connectors' chambers** host via `createConnectorHost`. **Frame-critique [1] — do NOT
   over-read:** `core/airlock.js` **stays the GA4 orchestrator** (egress path (i): the fire-and-forget
   `onmessage` fetch + `unloadFlush`), and alloy stays orchestrated by the **separate**
   `core/wrapped-sdk-host.js` (014-01). "One hosting path" = one hosting *mechanism inside the
   chambers*, **not** one orchestrator — alloy is **not** routed through `airlock.js`.
5. **No GA4 regression (UC-2).** Every GA4 test — mapping, cookies, purchase, conformance, the oracle
   gate — stays green; the MVP1/MVP2 connector/capability contract is unbroken (mvp3.md No-Gos).
   Observable: the full GA4 suite + `test/oracle-ga4.test.js` pass.

**DoD:**
- [x] ACs 1–5 pass — GA4 (UC-2) runs through the generic host, full suite + oracle green.
- [x] Reviews: compliance + craft + **arch** (connector-hosting convergence is an architecture
      change) + reconciliation, recorded pass. *(Independent subagent reviewers stalled on a `vitest`
      hang and were stopped; the orchestrator completed the review — it caught the `reads: ["*"]→[]`
      arch fix + the deviation-5 `.catch`. See the `reviews/slice-03-*.md` evidence + Reconciliation sweep.)*
- [x] Deviation log + reconciliation sweep; `docs/refinement-todo.md` (c) updated (two hosting paths
      converged); `architecture.md` module-boundary note reconciled if the hosting boundary moved.
- [x] **No breaking change** to the MVP1/MVP2 connector/capability contracts — `contracts/` diffs are
      additive; `test/contract-stability.test.js` green.
- [x] **Retire the duplicate 012-02 rig broker (arch-2 follow-up).** `rig/alloy-coalescing-broker.js`
      is a verbatim copy of `core/coalescing-broker.js` (the drift hazard spec 014 exists to kill) —
      redirect its test/harness at `core/coalescing-broker.js` (injecting the alloy recognizer) or
      delete it, so exactly one broker remains. **Gate (frame-critique [5]):** this is an ALLOY
      artifact orthogonal to GA4 hosting — keep it ONLY as a **mechanical** verbatim-copy delete +
      test/harness redirect. **Split it into its own cleanup the moment the redirect proves
      non-mechanical** — an unrelated alloy test-rewire must not block a GA4-green slice.
      **Done — proved mechanical**: the only diff between the two brokers was the
      `recognize`/`extractIdentity` injection core's broker already required (014-02 made it
      vendor-neutral); redirecting the three consumers was an import swap + threading two
      already-imported functions through, no logic changes. See Deviation log.

### Deviation log

_2026-08-30._
- **`core/airlock.js` needed ZERO changes (stronger than AC2's anticipated "Worker URL + init
  payload" edit).** `core/chamber.worker.js` is rewritten **in place** (same filename) rather than
  added as a new sibling worker: `build.mjs`, `rig/isolation.mjs` / `rig/isolation-probe.worker.js`,
  and `adapters/eds/index.js`'s own header comment all hardcode the `./chamber.worker.js` sibling
  specifier (same-origin-file CSP posture — 004-01), so keeping the filename avoided an unrelated
  rename cascade. The new chamber also accepts the EXACT SAME `{trackers, workFactor, endpoints,
  ctx}` init-payload shape `core/airlock.js` already sent (no reason to reshape it — the generic
  host's `config` param is just handed the same fields `cfg` used to carry). Net: `git diff
  core/airlock.js` is empty, not a 2-line change — verified, not asserted (see Reconciliation sweep).
- **`core/chamber.worker.js` now exports nothing** (the old `mapBatch(batch, cfg)` is retired, not
  kept as a compat shim). Mirrors `connectors/alloy/alloy-chamber.worker.js`'s existing shape — pure
  worker-side glue, no exported pure function — because the pure logic it used to uniquely hold now
  lives in `core/connector-host.js` (`routeBatch`, already Node-tested) and the new
  `connectors/ga4/connector.js` (`createGa4Connector`, newly Node-tested). The 009-01 rationale for
  `mapBatch`'s export ("testable in Node because the side-effecting module wasn't importable") is
  satisfied at the new layer instead, so no compat export was needed.
- **`test/chamber-isolation.test.js` PORTED, not left broken.** It imported `mapBatch` directly; since
  that export is retired, the test now builds a host via
  `createConnectorHost(createGa4Connector, cfg)` and calls the async `routeBatch` instead — same
  fixtures, same ADR-0001 per-descriptor-containment assertions, now async. Mirrors how
  `test/alloy-coalescing-broker.test.js` → `test/coalescing-broker-core.test.js` was ported in 014-02.
- **GA4 manifest — `events: ["*"]`, `reads: []` (CORRECTED by arch-review).** The first cut declared
  BOTH `events` and `reads` as `["*"]` on a **fabricated** ADR-0006 "wildcard" citation (no such
  sentence exists in ADR-0006). Corrected: `events: ["*"]` is defensible (GA4 is the analytics
  CATCH-ALL accepting arbitrary custom event names, `contracts/ga4-mp.md`; enumeration impossible; the
  event PAYLOAD crosses ungoverned per ADR-0006). But `reads` is the **PROJECTION snapshot channel**
  (`contracts/connector.d.ts:126`, ADR-0003 default-deny) — a DIFFERENT thing from the payload — and
  GA4's `handle` reads the payload + host `ctx`, **never `event.snapshot`**, so it reads ZERO projection
  fields → **`reads: []`** (a `["*"]` there would have violated ADR-0003's default-deny). Declared, not
  enforced (MVP3 grant-resolver food).
- **Deviation 5 hardened (post-review).** The new async worker glue's `routeBatch` `.then` chain gained
  a `.catch` so a top-level (malformed-batch) rejection surfaces a batch-level `dropped` diagnostic
  through the 009-02 seam instead of a silent unhandled rejection — matching the old sync `mapBatch`'s
  throw-to-`worker.onerror` observability. Unreachable in practice (airlock.js always posts an array).
- **New `connectors/ga4/connector.js#init` is a genuinely synchronous no-op**, not an `async`
  function — GA4 is a wire-protocol connector with no SDK to boot and nothing async to do;
  `contracts/connector.d.ts`'s `init` return type (`void | Promise<void>`) explicitly permits this,
  and `createConnectorHost`'s own `init` wraps whichever shape a connector returns.
  `connectors/ga4/connector.js#handle` is likewise synchronous (mirrors `mapToMp`'s own purity) — a
  `mapToMp` throw propagates synchronously out of `handle`, caught by `routeBatch`'s per-event
  try/catch exactly as `mapBatch`'s per-descriptor try/catch used to catch it.
- **Minor, narrow, accepted residual:** because `routeBatch` (unlike the old sync `mapBatch`) is an
  `async` function, an *unexpected* top-level throw inside it (not a per-event throw — those are
  still contained identically) becomes a REJECTED promise rather than a synchronous throw. A
  synchronous top-level throw from the old `mapBatch` would have surfaced through the worker's
  `error` event (`core/airlock.js`'s existing `worker.onerror` 009-02 diagnostic path); an unhandled
  promise rejection does not fire that same event. This is unreachable in practice — `core/airlock.js`
  always sends a proper array as `batch` (`ring.splice(0, 50)`) — and out of this slice's scope
  (wiring `self.onunhandledrejection` diagnostics would be new hardening, not a rewire); flagged here
  for honesty, not as a blocker.

### Reconciliation sweep

`core/egress.js` and `connectors/ga4/map.js` are byte-identical (`git diff` empty — AC2/AC3
byte-identity holds). `core/airlock.js` is byte-identical (empty diff — see Deviation log; AC2/AC4
"onmessage/drain/ring/projection/unloadFlush untouched" holds trivially). GA4 now hosts through
`core/connector-host.js` exactly like alloy (AC1/AC4) via new `connectors/ga4/connector.js` +
rewritten `core/chamber.worker.js`; alloy stays on `core/wrapped-sdk-host.js`, not routed through
`core/airlock.js` (AC4 frame-critique [1] honored). OQ10's unload fast path stays the separate
synchronous path through `core/egress.js`, untouched, never entering the worker (AC3) — the
synchronous-gating sub-problem the slice named for a later enforcement spec is UNCHANGED (still open,
not addressed here, as scoped). Full suite green: 500/500 (`npx vitest run`, includes
`test/oracle-ga4.test.js`'s 3 oracle-gate tests and the new `test/ga4-connector.test.js` + re-ported
`test/chamber-isolation.test.js`). `test/contract-stability.test.js` green (24 tests, untouched — no
contract signature changed). Verified beyond unit tests: `npm run build` (esbuild bundle-layout
assertions pass — the worker sibling-file specifier resolves unchanged), `npm run rig:e2e` (PASS —
the real UC-2 testbed page, real click, both the worker-cycle beacon and the pushCritical/ring-tail-
flush fast-path beacons deliver, identity flows cookie→ctx→payload, under the boilerplate CSP), `npm
run rig:isolation` (PASS — the chamber's no-DOM realm invariant holds and the real wire protocol
produces the exact expected MP-shaped output). DoD arch-2 (rig-broker retirement) proved mechanical,
done (not deferred) — `rig/alloy-coalescing-broker.js` deleted; `test/alloy-coalescing-broker.test.js`
+ `rig/alloy-coalescing.mjs` + `rig/alloy-coalescing-harness.html` redirected onto
`core/coalescing-broker.js`, injecting `connectors/alloy/xdm-mint.js`'s recognizer like
`test/coalescing-broker-core.test.js` already does. `docs/refinement-todo.md` (c) marked resolved;
`architecture.md`'s Contract-surfaces §3 note (naming the retired `chamber.worker.js` `mapBatch`)
reconciled to name `core/connector-host.js`'s `routeBatch`. No live identifiers introduced (new
placeholder endpoints/ids only, matching existing fixture conventions). **Reviews (this pass):**
compliance + craft + arch + reconciliation recorded **pass** — the independent subagent reviewers
stalled on a `vitest` hang (the stale nested worktree's shell-out oracle test) and were stopped; the
orchestrator completed the review, and it caught a real issue: the arch pass's `reads: ["*"] → []` fix
(projection default-deny) + the deviation-5 `.catch` hardening, both applied above. Full suite
re-verified green (500) after the fixes. `docs/adoption-readiness.md` / glossary updates were not
needed (no new vocabulary).

**Anti-horizontal-phasing check:** after this slice, GA4 (UC-2) runs through the same generic host as
alloy — one connector-hosting path in core, not two. Observable value: the GA4 analytics scenario,
re-hosted, all tests green.
