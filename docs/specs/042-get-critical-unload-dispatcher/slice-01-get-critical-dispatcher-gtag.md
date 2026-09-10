---
status: DONE
dependencies: []
last_verified: 2026-09-10
arch_review: true  # changes core/egress.js's createCriticalDispatcher module
                   # seam (a main-thread egress seam) — arch pass confirms the
                   # requestMapper DI shape + POST byte-parity, mirroring 030-01.
---

<!-- jig grounding (spec 064-02 / ADR-0020): the load-bearing claims below are
     grounded by reading core/egress.js, core/airlock.js, connectors/ga4/gtag.js,
     core/ga4-gtag-chamber.worker.js, and core/connector-host.js on 2026-09-10;
     see the parent spec's `## Assumptions` A1/A2 for the two marked residuals. -->

## Slice 042-01 — GET-critical dispatcher + ga4-gtag unload flush

**Goal:** Extend `createCriticalDispatcher` (`core/egress.js`) with a
connector-generic GET `requestMapper` path, and wire it for `ga4-gtag`, so a
gtag event still ring-resident at page-hide (or handed to `pushCritical`)
flushes as a correct `/g/collect` **GET** beacon instead of being dropped —
while the existing POST unload path (GA4-MP, helix-rum) stays byte-identical.

**DoR:**
- ✅ Grounded (parent spec § Current state): the POST-only dispatcher
  (`core/egress.js:70-88`), the steady-state GET `fetchInit`
  (`core/airlock.js:53-55,305-324`), the `workerMappedGetEgress` unload gate +
  `pushCritical` drop (`core/airlock.js:506,513-516,583-590`), the existing
  `connector === "helix-rum"` mapper-selection branch (`:188-200`), gtag's pure
  `handle` (`connectors/ga4/gtag.js`), and the chamber config threading
  (`core/ga4-gtag-chamber.worker.js`, `core/connector-host.js:70-76`).
- ✅ Frame-critique passed (`arch_review: true`, `reviews/slice-01-frame-critique.md`) — the "GET
  path is additive; the POST path is byte-unchanged; the unload path stays ceiling-bypassing by
  design" re-scope checked before code; AC5 sharpened as a result.
- ✅ Grounded at implementation: re-verify A1 (no chamber-side transform sits
  between the init message and `handle` for gtag); decide `fetchInit` sharing
  (move it to `core/egress.js`, imported by `core/airlock.js` — no cycle, since
  `egress.js` is imported *by* `airlock.js`) vs. a duplicated helper, preferring
  the shared, can't-drift shape.

**Acceptance Criteria:**

1. **`createCriticalDispatcher` accepts a `requestMapper` (EgressRequest[]) path;
   the POST path is byte-unchanged by default.** With no `requestMapper`, the
   dispatcher is byte-identical to today — the existing GA4/RUM unload tests
   stay green, and a regression test asserts the default POST per-tracker path
   (`mapper(event, ctx)` → `JSON.stringify` → `fetch(endpoints[t], {method:"POST",
   body, keepalive:true})`) is unchanged, including the keepalive budget +
   swallow-async-rejection + drop-count. With a `requestMapper` present,
   `dispatch(event)` calls `requestMapper(event) → EgressRequest[]` and issues
   one `fetch(req.url, initFor(req.method, req.body))` per request, reusing the
   **same** GET/POST init shape the steady-state seam uses (shared, not
   duplicated): GET → `{method:"GET", keepalive:true}` with **no** `body`; POST
   → `{method:"POST", body, keepalive:true}`. `stats()` counts
   `fastDispatched`/`fastDropped` on this path too.
2. **A GET request carries no body and consumes no keepalive body budget (A2);
   an empty result is a clean no-op.** A `requestMapper` returning
   `{url, method:"GET"}` dispatches a bodyless GET and leaves the aggregate
   keepalive counter (`bytesUsed()`) unchanged. A `requestMapper` returning `[]`
   (the pixel unmapped-event case the dispatcher must tolerate even though gtag
   never returns it) is a no-op — no fetch, no `fastDropped++`, no throw.
3. **`core/airlock.js` wires the ga4-gtag GET critical mapper and removes its
   unload gate-out.** For `connector === "ga4-gtag"` the critical dispatcher is
   constructed with `requestMapper: createGa4GtagConnector(connectorConfig).handle`
   (mirroring the `helix-rum` branch), and `ga4-gtag` is removed from the
   `workerMappedGetEgress` unload gate so it wires `visibilitychange`/`pagehide`.
   A gtag event still ring-resident at page-hide flushes via `unloadFlush` → the
   GET dispatcher → a `keepalive` GET to `/g/collect` carrying the mapped params
   (`v`/`tid`/`cid`/`sid`/`en`/…), **never** a GA4-MP POST, never dropped.
   (`workerMappedGetEgress` still gates `pixel` until 042-02.)
4. **`pushCritical` on a ga4-gtag instance maps + GETs (no longer drops).** A
   `pushCritical({event:"page_view", …})` call maps via the same GET
   `requestMapper` and issues one `/g/collect` GET — the `workerMappedGetEgress`
   `pushCritical` drop (`core/airlock.js:583-590`) is removed for gtag.
5. **The witnessed hazard (mutation proof) + cross-path byte-parity.** A
   `page_view` pushed then flushed at a real `visibilitychange`→hidden egresses a
   `/g/collect` GET; this AC FAILS under today's gate-out (dropped, `fetch` never
   called) — forcing the gtag `requestMapper` wiring back off reds exactly this
   witness. **Parity (real, not a self-comparison — frame-critique):** the
   flushed GET URL equals the URL the WORKER path produces for the same governed
   descriptor — asserted against `createConnectorHost(createGa4GtagConnector,
   connectorConfig).routeBatch([descriptor])`'s `ready[0].url`, **NOT** a second
   call to the same main-thread `handle` (which would compare the `requestMapper`
   to itself and never red on a genuine worker-vs-main divergence). **Documented
   residual:** worker-vs-main parity holds only while `connectorConfig.ctx` is a
   **frozen boot snapshot** — a hermetic Node test cannot catch a structured-clone
   divergence a real Worker would show, and if a future slice threads live
   ctx/consent into the worker (the deferred 017-01 ctx-resend) without a matching
   main-thread refresh, the unload beacon would silently diverge. Grounded today:
   `bootGa4Gtag` builds `ctxWithConsent` once and never mutates it
   (`adapters/eds/index.js:687`); `setConsent` updates a *separate*
   `consentVector` (`core/airlock.js:160`), not the mapper's `ctx.consent`.
6. **Governance + consent preserved on the GET path.** `governParams` still
   strips denylisted params before the GET mapper (the shared
   `criticalDispatchGated` path); the live consent **verdict** still DROPs an
   un-granted `analytics_storage` at teardown (no hold at teardown — 017-03 AC4).
   The GA4-MP POST unload path, helix-rum's POST unload path, and the pixel
   drop-gate are all byte-unchanged (regression-pinned).
7. **No live identifiers** — synthetic `measurementId`/`ctx`/`endpoint`.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). The GA4-MP POST
      unload path + helix-rum POST path stay byte-unchanged.
- [x] Coverage exercises each AC: the `requestMapper` GET dispatch + empty-result
      no-op (`egress-fastpath` unit level); the real `visibilitychange`→
      `unloadFlush` gtag ring-tail GET; the `pushCritical` GET; the consent-drop
      + governance paths; the POST default-parity regression.
- [x] `test/ga4-gtag-seam.test.js`'s AC10 drop assertions (`registers NO
      visibilitychange/pagehide`, `dropped, not GA4-mis-mapped`, `pushCritical
      DROPS`) are FLIPPED to the GET-flush assertions; the GA4 POST regressions
      in that file stay green.
- [x] Each new test shown to fail when its feature is removed (force the gtag
      `requestMapper` off → the witness reds; restore).
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Arch pass (`arch_review: true`) — confirms the `requestMapper` DI shape,
      POST byte-parity, and the ceiling-bypass-by-design stance.
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated — the deferred item struck through /
      marked resolved (or narrowed to the pixel half pending 042-02); the inbox
      follow-on triaged.

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] Primer hygiene per spec 025-01 rule: this slice does NOT close the spec
      (042-02 pending), so leave the active-spec entry; check `CLAUDE.md` /
      `AGENTS.md` for no needed change.

**Anti-horizontal-phasing check:** after this slice a gtag closing-pageview /
ring-tail event actually reaches `/g/collect` at page teardown (before: silently
dropped) — the analytics "last beacon" teardown fidelity UC-2 needs, proven with
a real `visibilitychange`→hidden flush.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

- **A1 residual re-verified at implementation (per the DoR item), no drift found.** Re-read
  `connectors/ga4/gtag.js` and `core/connector-host.js`: `createGa4GtagConnector`'s `init(_caps)`
  is a literal no-op (`// no-op — see doc comment above.`), and `createConnectorHost.init(caps)`
  does nothing beyond `Promise.resolve(connector.init(caps))` once — no chamber-side reshape sits
  between the `{type:"init", ...connectorConfig}` message and `handle(event)`. `routeBatch` calls
  `connector.handle(event)` directly on the raw `{seq,type,ts,params}` descriptor with no
  intermediate transform. A1 holds as grounded; no new residual surfaced.
- **`fetchInit` sharing: moved to `core/egress.js`, byte-identical.** Per the spec's own DoR
  steer, `fetchInit` now lives in `core/egress.js` (exported) and `core/airlock.js` imports it
  (`import { createCriticalDispatcher, fetchInit } from "./egress.js"`) instead of keeping a
  duplicated local copy. Function body is byte-for-byte unchanged; only its home file and the
  surrounding doc comment moved. All three original reference points — `core/airlock.js`'s
  `worker.onmessage` dispatch (:~306), its `setConsent` held-beacon flush (:~622), and the
  held-beacon record's `method` capture (:~357, which doesn't call `fetchInit` itself but exists
  to let a later flush reconstruct it) — are unaffected; no call-site changes.
- **Minor, additive guard beyond the literal design text:** `createCriticalDispatcher`'s
  `n = typeof trackers === "number" ? trackers : endpoints.length` was changed to
  `... : (endpoints ? endpoints.length : 0)`. Every existing caller always passes `endpoints`
  (byte-unchanged for them), but a `requestMapper`-only construction (the AC1/AC2 unit tests, and
  in principle any future caller that never needs the legacy POST path) legitimately omits
  `endpoints`/`trackers` entirely; without the guard, construction itself throws
  (`Cannot read properties of undefined (reading 'length')`) before `dispatch()` is ever called.
  Not called out explicitly in the slice's implementation design, but required for the AC1/AC2
  tests to run at all; flagged here rather than silently added.
- **Two tests strengthened past the literal spec wording, to be genuine mutation-witnesses
  (not just RED-before-any-code):** (1) the AC2 "empty result is a no-op" test also passes
  `endpoints`/`trackers` alongside `requestMapper: () => []`, so if `requestMapper` were ever
  silently ignored the fallback per-tracker POST path would fire an observable (wrong) POST
  instead of coincidentally also producing zero calls (a bare `endpoints`-less construction made
  the legacy path's own `n` collapse to 0, which passed the same assertions vacuously). (2) the
  AC6 governance test (`password` field stripped) also asserts `init.method === "GET"`, since the
  original `ep.password`-absent assertion alone would vacuously hold under a GA4-mis-mapped POST
  too (POST has no query string at all). Both changes were verified by an explicit force-off/
  restore cycle (see the "red→green demonstration" note below) before being kept.
- **AC6 consent-drop test needed `consentStrict: true`, not implied by the literal instruction
  text.** `core/consent.js`'s `egressVerdict` resolves a **non-strict** `"denied"` purpose to
  `"send"` (a storage-purpose denial is 017-02's cookie-capability concern, not a seal-level
  hold/drop — see that function's own doc comment) — only a `"pending"` purpose holds, and only
  **strict** mode drops a non-granted (denied-or-pending) purpose. So
  `consent: { analytics_storage: "denied" }` alone would actually SEND, not drop. Added
  `consentStrict: true` (matching the existing `test/consent-seal.test.js:235-250` precedent,
  "strict + denied on the sync path also drops") so the test exercises AC6's own cited authority
  (017-03 AC4, "un-granted purpose dropped — no hold at teardown") correctly. This is a
  clarification of an underspecified test config, not a change to AC6's substance — the
  `criticalDispatchGated` consent gate itself is untouched, pre-existing code.
- **Red→green demonstration (DoD item), performed and reverted, no residual toggle left in
  source.** Before implementing: all new tests in both files failed for the expected reason (a
  construction-time `TypeError` in `test/egress-fastpath.test.js`'s new describe block since
  `requestMapper`/the `n`-guard didn't exist yet; `fetch`-not-called assertions failing in
  `test/ga4-gtag-seam.test.js` since the gate/wiring were still absent). After implementing and
  going green, two additional **mutation-style** force-off passes were run and reverted: (1)
  disabling `core/egress.js`'s `requestMapper` branch reddened exactly the 4 requestMapper-
  dependent `egress-fastpath` tests (the POST-default-parity regression stayed green, as
  expected); (2) disabling `core/airlock.js`'s ga4-gtag `requestMapper` wiring (leaving the
  unload-gate change in place) reddened the 5 dispatch-dependent gtag tests while the listener-
  registration and consent-drop tests — which depend on the separate unload-gate change, not the
  requestMapper wiring — stayed green; reverting *that* and instead reverting the unload-gate
  change back to including `ga4-gtag` reddened all 7 new/flipped gtag tests (both mechanisms are
  independently witnessed). Both GA4-MP regression tests in `ga4-gtag-seam.test.js` stayed green
  throughout every toggle. No temporary code was left in the tree after this — confirmed via
  `grep -rn "TEMP: red-demonstration" core/`.
- **Out-of-scope doc staleness noted, not fixed (reconciliation candidate):** `rig/parity/
  transport-report.js` has two prose references attributing `fetchInit`'s behavior ("sets only
  `method`/`body`/`keepalive` — no `credentials`/`mode`") to "`core/airlock.js`'s `fetchInit`".
  The described *behavior* is unchanged (byte-identical function, just relocated), but the
  file-attribution is now imprecise (`fetchInit` lives in `core/egress.js`, imported by
  `core/airlock.js`). Left untouched — the file is outside this slice's declared scope
  (`core/egress.js`, `core/airlock.js`, `connectors/ga4/gtag.js`,
  `core/ga4-gtag-chamber.worker.js`, `core/connector-host.js`, and the two named test files) —
  flagging here for the reconciliation pass rather than silently drive-by editing an unrelated
  rig file.
- No ACs were edited **during implementation**. (AC5 was sharpened earlier, during the
  pre-implementation **frame-critique** — the tautological `createGa4GtagConnector(cfg).handle`
  self-comparison was replaced with the worker-`routeBatch` parity assertion + the ctx-frozen-
  snapshot bound; see the reconciliation-phase block below. The implementer built against the
  already-sharpened AC5.) No lifecycle transition was performed by the implementer (left
  `IN_PROGRESS` per the slice's own constraint); `workflow.py transition` gates REVIEWED/RECONCILED
  on recorded review evidence per ADR-0014, so the independent-review flow drives status from here.
- **`|| {}` guard on the gtag wiring (parity with the logged `n`-guard defensiveness):**
  `core/airlock.js` wires `requestMapper: createGa4GtagConnector(connectorConfig || {}).handle`,
  a defensive `|| {}` beyond AC3's literal `createGa4GtagConnector(connectorConfig).handle` —
  harmless (a `ga4-gtag` instance always carries a `connectorConfig` in practice; the guard only
  prevents a destructure-on-undefined for a raw misuse), mirroring the `n`-guard rationale.

**Reconciliation-phase additions (orchestrator, 2026-09-10):**
- **Review passes — all PASS, no blockers** (`reviews/slice-01-{frame-critique,compliance,craft,arch}.md`). Frame-critique (pre-implementation, `frame_review: true`) surfaced that AC5's original byte-parity clause was *tautological* (asserting the flushed GET against `createGa4GtagConnector(cfg).handle` — the `requestMapper` itself); AC5 was sharpened **before** implementation to assert against the WORKER `routeBatch` path, and the ctx-frozen-boot-snapshot bound was recorded in AC5 + parent-spec A1. Compliance/craft/arch each returned `pass`; every SPECIFIC ISSUE was a `[nit]`/reconciliation item (none `[blocker]`).
- **egress.js `requestMapper` GET-shaped boundary documented** (craft + arch `[nit][spec]`): added a doc-comment paragraph on `createCriticalDispatcher`'s `requestMapper` param noting the path is GET-shaped by current design, `fetchInit` still honors a POST `req.method`, and a POST-returning `requestMapper` would bypass the keepalive-budget accounting — an intentionally-unbudgeted boundary while GET is the only shape, revisit-on-first-POST-caller. Documented, **not** asserted (arch's "avoid prophylactic expansion").
- **architecture.md — BOTH stale lines fixed** (arch caught the sweep under-scoped this to only `:61`): `:18` now states gtag's ring tail is GET-flushed via the `requestMapper` (pixel-only drop-posture until 042-02); `:61`'s OQ16 clause generalized from "reusing `mapToMp` directly" to "the connector's own main-thread mapper" (mapToMp/mapToRum/gtag-`handle`), with an added note that OQ16's own throwing-mapper-not-per-event-isolated concern is unchanged by 042-01 (the GET path is not wrapped in a per-event catch either — inert only because gtag's `handle` doesn't throw; pre-existing, not a regression).
- **rig/parity/transport-report.js fetchInit attribution fixed** (`:12`, `:52`): `core/airlock.js`'s → `core/egress.js`'s `fetchInit` (behavior byte-identical, home relocated by this slice). Closes the deviation-log-flagged out-of-scope staleness.
- **Tracked residuals (carried forward, non-blocking):** (1) a future POST-returning `requestMapper` must revisit budget accounting (documented in `core/egress.js`); (2) worker-vs-main GET parity holds only while `connectorConfig.ctx` is a frozen boot snapshot — a future 017-01 ctx-resend into the worker without a matching main-thread refresh would silently diverge the unload beacon (recorded in AC5 + A1; a hermetic Node test can't witness a real-Worker structured-clone divergence). The `n`-guard (`endpoints ? … : 0`) is kept as-is (harmless; the `requestMapper` branch returns before the per-tracker loop).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Internal egress-seam generalization; no user-facing entrypoint or public-API change (the `push`/`pushCritical`/`getState`/… surface is unchanged). |
| `docs/specs/README.md` | `deferred (close-out)` | The board is regenerated by `workflow.py status-board` only at the post-DONE close-out step (unchecked above); it is currently **stale** (still shows 042-01 as DRAFT — a regen today would already show REVIEWED / spec IN_PROGRESS), and the regen lands at close-out, matching the 038-01/038-02 precedent for deferring the board regen past reconciliation. |
| `docs/product-vision.md` | `no-op` | UC-2 (analytics teardown "last beacon") is already in scope; no vision/scope drift. |
| `docs/architecture.md` | `updated` | BOTH stale lines fixed (arch pass caught the original sweep scoped only `:61`): `:18` — gtag's ring tail is now GET-flushed via the `requestMapper` (pixel-only drop-posture until 042-02); `:61` — OQ16 clause generalized from "`mapToMp` directly" to the connector's own main-thread mapper, plus a note that OQ16's throwing-mapper-isolation concern is unchanged by 042-01. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Slice does not close the spec (042-02 pending) — the CLAUDE.md hot-cache carries no gtag-unload-posture claim (verified by grep); the stale prose was in `architecture.md`, not a primer. Compress-on-close at 042-02. |
| `docs/inbox.md` | `updated` | The `:17` 030-01 `method`-option follow-on annotated **RESOLVING via spec 042**: 042-01 chose a connector-generic GET `requestMapper` over a `method` option and shipped the gtag half; pixel is 042-02. |
| `docs/refinement-todo.md` | `updated` | The GET-critical unload item's **gtag half marked RESOLVED** (042-01, with mechanism + A1/A2 grounding); the `**Deferred:**` block narrowed to `pixel` only (gate now `connector === "pixel"`), with a pixel-specific resolution trigger pointing at 042-02. |
| `docs/memory/**` | `deferred (spec-close)` | No cross-session learning beyond what the spec/slice + refinement-todo already record (the `requestMapper` pattern + the ctx-frozen-snapshot parity bound). A consolidated memory-sync is deferred to spec close (042-02 trigger) rather than run mid-spec, to avoid a duplicate entry while the same work continues. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR — additive DI within the already-resolved ADR-0004 two-path egress model; no module boundary broke and no load-bearing choice with rejected alternatives was made (arch pass: "documentation, not design"). |
| Additional live prose / generated templates touched by this slice | `updated` | `rig/parity/transport-report.js` (`:12`, `:52`) — `fetchInit` file-attribution corrected `core/airlock.js` → `core/egress.js` (behavior byte-identical, home relocated by this slice). Built adapter artifacts (`probes/eds-testbed/scripts/airlock/eds.js`) are regenerated by `npm run build`, not git-tracked. |
