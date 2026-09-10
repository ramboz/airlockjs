---
status: DONE
dependencies: [042-01]
last_verified: 2026-09-10
frame_review: true  # shares the parent spec's A1/A2 (frame-review-needed → true);
                    # the load-bearing assumption is the pixel analog of 042-01's
                    # A1 — strictly SIMPLER (pixel reads no ctx). Critiqued anyway
                    # for a complete audit trail across both slices.
# arch_review: reuses 042-01's already-arch-reviewed requestMapper seam; this
#              slice adds a consumer branch + retires a dead boolean — no new
#              module boundary or contract. Left off.
---

<!-- jig grounding (spec 064-02 / ADR-0020): grounded by reading
     connectors/pixel/connector.js, core/pixel-chamber.worker.js, and
     test/pixel-seam.test.js on 2026-09-10. -->

## Slice 042-02 — generalize the GET-critical unload flush to pixel

**Goal:** Wire 042-01's GET `requestMapper` path for the `pixel` connector, so a
pixel event still ring-resident at page-hide (or handed to `pushCritical`)
flushes as a correct vendor GET beacon (Meta/LinkedIn/Bing `/tr`) instead of
being dropped — and retire the now-empty `workerMappedGetEgress` gate.

**DoR:**
- ✅ 042-01 DONE — the `createCriticalDispatcher` `requestMapper` GET path + the
  gtag wiring pattern (`requestMapper: createGa4GtagConnector(cfg).handle`, the
  gate-removal, the `pushCritical` un-gate) it mirrors.
- ✅ Grounded: pixel's `handle` returns zero-or-one GET `EgressRequest`
  (`connectors/pixel/connector.js:125-150` — `[]` for an unmapped `event.type`),
  covered by 042-01 AC2's empty-result tolerance; pixel's main-thread
  `connectorConfig` shape (`{endpoint, eventMap, paramMap, …}`) matches
  `createPixelConnector`'s config; the current pixel drop assertions live in
  `test/pixel-seam.test.js:366-431`.
- ✅ Grounded at implementation: confirm no pixel-specific main-thread config
  massaging is needed beyond `createPixelConnector(connectorConfig).handle`
  (bootPixelConnector passes `connectorConfig` verbatim). Confirmed:
  `adapters/eds/index.js:766-777`'s `bootPixelConnector` passes `connectorConfig`
  (from the vendor's `createConfig(ids)`) straight into `createAirlock({...,
  connector: "pixel", connectorConfig, ...})` with no reshape — see the
  Deviation log below.

**Acceptance Criteria:**

1. **`core/airlock.js` wires the pixel GET critical mapper and removes its unload
   gate-out.** For `connector === "pixel"` the critical dispatcher is
   constructed with `requestMapper: createPixelConnector(connectorConfig).handle`,
   and `pixel` is removed from the unload gate so it wires
   `visibilitychange`/`pagehide`. A pixel event still ring-resident at page-hide
   flushes via `unloadFlush` → the GET dispatcher → a `keepalive` GET to the
   vendor endpoint (Meta `/tr`), never a GA4-MP POST, never dropped.
2. **`pushCritical` on a pixel instance maps + GETs (no longer drops).** Same
   un-gating as gtag in 042-01.
3. **An unmapped pixel event at teardown is a clean no-op.** A pixel event whose
   `type` is absent from `eventMap` maps to `[]` → no fetch, no drop-count, no
   throw (pixel's zero-or-one gate + the 042-01 dispatcher empty-result
   tolerance).
4. **The now-empty `workerMappedGetEgress` gate is retired honestly.** With both
   GET connectors wired, no connector is gated out of the unload path; the
   `workerMappedGetEgress` boolean + its `pushCritical` drop-block are removed
   (the wiring conditional collapses to `if (typeof addEventListener ===
   "function")`), leaving a short comment recording the invariant a future
   worker-mapped connector must satisfy (supply a POST `mapper` or a GET
   `requestMapper`, else its teardown tail mis-maps). No dead boolean, no
   speculative guard.
5. **The witnessed hazard (mutation proof) + cross-path byte-parity.** A Meta
   pixel event (a mapped `eventMap` type) pushed then flushed at a real
   `visibilitychange`→hidden egresses a `/tr` GET; this AC FAILS under today's
   gate-out (dropped). Forcing the pixel `requestMapper` wiring off reds exactly
   this witness. **Parity (mirrors 042-01 AC5 — real, not a self-comparison):**
   the flushed GET URL equals the URL the WORKER path produces for the same
   descriptor — asserted against `createConnectorHost(createPixelConnector,
   connectorConfig).routeBatch([descriptor])`'s `ready[0].url`, NOT a second call
   to the same main-thread `handle`. Pixel is the SIMPLER parity case than gtag:
   its `handle` reads **no** `ctx` (only the declarative `{endpoint, eventMap,
   paramMap}` config, passed verbatim by `bootPixelConnector`), so there is **no**
   gtag-style ctx-frozen-snapshot bound — parity holds unconditionally on the
   shared config, with no consent/identity freshness caveat.
6. **Regression parity.** The GA4-MP POST unload path, helix-rum's POST unload
   path, and gtag's 042-01 GET path are all byte-unchanged; the pixel steady-
   state (worker `onmessage`) GET path is unaffected.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Coverage exercises each AC: the pixel ring-tail `/tr` GET at real
      `visibilitychange`→hidden; the `pushCritical` GET; the unmapped-event
      no-op; the retired-gate assertion (pixel now wires both listeners).
- [x] `test/pixel-seam.test.js`'s drop assertions (`registers NO
      visibilitychange/pagehide`, `dropped, not GA4-mis-mapped`) are FLIPPED to
      the GET-flush assertions; the GA4 POST regression in that file stays green.
- [x] Each new test shown to fail when its feature is removed (force the pixel
      `requestMapper` off → the witness reds; restore).
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated — the deferred GET-critical item struck
      through / marked RESOLVED (both connectors now flush); primer + inbox swept.

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] Primer hygiene per spec 025-01 rule: this slice CLOSES spec 042 (both
      slices DONE) — compress the active-spec entry; migrate any load-bearing
      invariant (the "every worker-mapped connector needs a critical mapper"
      rule) to the status board Notes column or memory; check `CLAUDE.md` /
      `AGENTS.md`.

**Anti-horizontal-phasing check:** after this slice a Meta/LinkedIn/Bing pixel
event reaches its vendor `/tr` endpoint at page teardown (before: dropped) —
ad-vendor teardown parity, proven with a real `visibilitychange`→hidden flush.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

- **DoR open box confirmed, no massaging needed.** Re-read `adapters/eds/index.js`'s
  `bootPixelConnector` (`:766-777`): it passes `connectorConfig` (built by the vendor's
  `createConfig(ids)`, e.g. `createMetaPixelConfig`) straight into `createAirlock({..., connector:
  "pixel", connectorConfig, ...})` with no reshape — the same object `createPixelConnector`
  interprets on the worker side via `core/pixel-chamber.worker.js`'s `createConnectorHost`. No
  pixel-specific main-thread config massaging exists or was needed.
- **Implementation is a literal mirror of 042-01's gtag wiring, generalized to pixel — no
  substantive deviation from the slice's own "Implementation design" section.** `core/airlock.js`
  gained one import (`createPixelConnector`), one `requestMapper` branch in the `critical`
  dispatcher construction (`connector === "pixel" ? { requestMapper:
  createPixelConnector(connectorConfig || {}).handle } : {}`, mirroring the `ga4-gtag` branch's own
  `|| {}` defensive guard — harmless in practice, a pixel instance always carries a
  `connectorConfig`), and the three `workerMappedGetEgress` removals AC4 named (the `const`
  definition, the `!workerMappedGetEgress &&` in the unload-wiring `if`, and the `pushCritical`
  drop-block) — with a short comment at the unload-wiring site recording the invariant a future
  worker-mapped connector must satisfy (a POST `mapper` or a GET `requestMapper`, else its teardown
  tail mis-maps through the default `mapToMp`), as AC4 requires.
- **A fourth, PURELY-textual `workerMappedGetEgress` reference updated beyond AC4's literal "three
  functional uses" enumeration.** The helix-rum branch's own doc comment (just above the `critical`
  dispatcher construction) said "The unload WIRING gate (`!workerMappedGetEgress`, below...) still
  includes helix-rum" — not a functional use (helix-rum's own behavior is untouched either way), but
  it would have gone stale/misleading (referencing a now-deleted identifier) had it been left as-is.
  Reworded to describe the wiring as unconditional post-042-02, without changing the substance of
  the claim (helix-rum was always wired, still is). Flagged here since AC4's text named only three
  sites; this is a fourth, comment-only touch-up for accuracy, not a fourth functional removal.
- **Red→green demonstration (DoD item), performed and reverted, no residual toggle left in
  source.** Before implementing: 5 of the 6 new/flipped tests in `test/pixel-seam.test.js` failed
  against the pre-042-02 `core/airlock.js` (confirmed by `git stash`-ing the implementation edit,
  running the suite, then restoring) — the sixth (AC3's unmapped-event no-op) passed vacuously
  under the OLD code too, since a drop and a no-op are observationally identical to `fetchMock`
  alone. After implementing and going green (95 files / 1484 tests, +3 net over the 1481 baseline),
  two **independent** mutation-style force-off passes were run and reverted to give AC3's no-op
  test — and every other new/flipped test — a real, non-vacuous witness: (1) forcing the pixel
  `requestMapper` branch off (`connector === "pixel" && false`) while leaving the gate retired
  reddened exactly the 5 dispatch-dependent tests (ring-tail flush, `pushCritical` GET, AC3's
  no-op — it reds here because an unmapped event then falls through to the default `mapToMp` and
  fires an unwanted POST — both AC5 tests), while the listener-registration test and both GA4
  regressions stayed green; (2) separately restoring the OLD gate (`connector === "pixel"` blocking
  the unload-wiring `if`) while leaving `requestMapper` wired reddened the listener-registration
  test and both AC5 tests (the wiring gate blocks `visibilitychange`/`pagehide` registration
  entirely), while `pushCritical` (a separate entry point the wiring gate never touched), AC3's
  no-op (vacuously — no listener fires), and both GA4 regressions stayed green. The two mechanisms
  (gate retirement vs. `requestMapper` wiring) are therefore independently witnessed, mirroring
  042-01's own two-mechanism mutation-witness practice. No temporary code was left in the tree after
  this — confirmed via `grep -rn "TEMP: red-demonstration\|TEMP_redDemoGate" core/`.
- **Behavior-preservation confirmed for every other connector, as the task's own counterfactual
  predicted.** GA4-MP (default POST), helix-rum (POST), gtag (042-01's GET `requestMapper`), and
  `dom` were all already on the wired side of the old gate (`!workerMappedGetEgress` was `true` for
  them, since the gate was `connector === "pixel"` alone) — collapsing the conditional to
  `if (typeof addEventListener === "function")` is a no-op for them; only `pixel` gains wiring. Full
  suite green with no changes needed in any other connector's own seam test file
  (`ga4-gtag-seam.test.js`, `rum-unload-dispatcher.test.js`, the GA4/dom seam suites) confirms this
  by construction, not just by assertion.
- **Out-of-scope doc staleness noted, not fixed (reconciliation candidate, compounds an existing
  042-01 residual).** `adapters/eds/index.js`'s `bootGa4Gtag` JSDoc (`:536-558`) still describes the
  (now fully retired) `workerMappedGetEgress` boolean by name and frames gtag's mis-map closure
  relative to a still-existing pixel-drop posture ("This mis-map is CLOSED for `ga4-gtag`, exactly
  as for pixel" / "KNOWN RESIDUAL... the SAME follow-up pixel already defers") — stale since 042-01
  (never reconciled there either; that slice's own sweep touched `docs/architecture.md`/
  `docs/inbox.md`/`docs/refinement-todo.md`, not this file) and now doubly stale after 042-02 retires
  the gate entirely. Left untouched — `adapters/eds/index.js` is outside this slice's declared scope
  (`core/airlock.js`, `test/pixel-seam.test.js`) — flagging here for the reconciliation pass rather
  than silently drive-by editing an unrelated adapter file's doc comment.
- **No ACs were edited during implementation.** (AC5 was already sharpened with the cross-path-
  parity clause before I started, during the pre-implementation frame-critique pass —
  `reviews/slice-02-frame-critique.md`, `verdict: pass` — which also flagged the "feed both paths
  the same governed params" test-construction note this implementation's AC5 tests follow, using a
  clean `"lead"` descriptor with no denylisted fields.) No lifecycle transition was performed by the
  implementer (left `IN_PROGRESS` per the slice's own constraint); `workflow.py transition` gates
  REVIEWED/RECONCILED on recorded review evidence per ADR-0014, so the independent-review flow
  drives status from here.

**Reconciliation-phase additions (orchestrator, 2026-09-10 — this slice CLOSES spec 042):**
- **Review passes — all PASS, no blockers** (`reviews/slice-02-{frame-critique,compliance,craft}.md`; no arch pass — `arch_review` off, consumer wiring on 042-01's already-arch-reviewed seam). Frame-critique confirmed the pixel-A1 analog is *strictly stronger* than gtag's (pixel reads no `ctx` → no ctx-frozen-snapshot bound). Two craft/compliance `[nit]`s are log-only: the `|| {}` guard (consistent with the reviewed 042-01 gtag branch — and, the craft pass noted, with the pre-existing `...(connectorConfig || {})` at `core/airlock.js:269`); and the AC5 fixture's dependence on `value`/`currency`/`content_name` staying out of `DEFAULT_DENYLIST` (disclosed in-test, mirrors 042-01 AC5).
- **adapters/eds/index.js — BOTH stale JSDocs fixed** (craft + compliance flagged `bootGa4Gtag`; its sibling was equally stale): `bootGa4Gtag` (`:536-558`) and `bootPixelConnector` (`:810-816`) both described the retired `workerMappedGetEgress` gate + a drop-at-teardown/`mapToMp`-mis-map posture as *current*. Rewritten: both boots still deliberately omit `pushCritical` + capture wiring (a **scope** choice — minimal analytics/pixel boot), but the ring tail now flushes CORRECTLY as a GET (gtag `/g/collect` via 042-01, pixel `/tr` via 042-02) and the mis-map/drop rationale is retired. The residual truth (no `pushCritical` on either boot handle) is preserved.
- **architecture.md `:18`** — pixel now flushes its `/tr` ring tail via `createPixelConnector(connectorConfig).handle`, and the `workerMappedGetEgress` drop-gate is retired (both connectors supply their own critical mapper). (`:61`'s OQ16 clause was already generalized in 042-01.)
- **refinement-todo.md** — the GET-critical unload item struck through / **RESOLVED (spec 042, both slices)**; the gtag-resolved + pixel-deferred blocks collapsed into one resolution note.
- **inbox.md `:17`** — the 030-01 `method`-option follow-on marked **RESOLVED** (both connectors flush GET; gate retired).
- **CLAUDE.md — verified NO stale prose (grep clean).** The implementer's placeholder sweep row *assumed* a stale "ring tail dropped at teardown; GET-critical flush deferred" note in `CLAUDE.md`; there is none (`grep -niE "workerMappedGetEgress|ring tail|GET-critical|teardown" CLAUDE.md` → empty). The stale prose lived in `architecture.md`/`adapters` (fixed above), not a primer. Spec 042 was never added to `CLAUDE.md`'s active-specs section (a new spec landing directly), so no compress-on-close is needed either. `AGENTS.md` checked — no reference.
- **Full suite re-run green (1484) + eslint clean** after all reconciliation edits (the `adapters/eds/index.js` edits are JSDoc-only; no behavior touched).
- **Status board Notes (pending close-out)** — the invariant ("every worker-mapped connector supplies its own critical mapper") is migrated to the 042 Notes column at the post-DONE close-out step (preserved across regen); not yet done at reconciliation time, consistent with the `docs/specs/README.md → deferred (close-out)` sweep row.
- **Folded the two non-blocking reconciliation-review notes** (`reviews/slice-02-reconciliation.md`, verdict `pass`): (1) extended `architecture.md:61`'s OQ16 mapper enumeration to name **pixel** (042-02) alongside ga4-gtag (042-01) — the `:18` update had named pixel but the `:61` enumeration was left under-inclusive; (2) reworded the Status-board-Notes bullet above to pending tense.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Internal egress-seam wiring; no user-facing entrypoint / public-API change. |
| `docs/specs/README.md` | `deferred (close-out)` | Board regenerated by `workflow.py status-board` only at the post-DONE close-out step (unchecked above); currently stale (a regen now would show 042-02 REVIEWED / spec IN_PROGRESS). Same precedent as 042-01. |
| `docs/product-vision.md` | `no-op` | UC-2 already in scope; no vision/scope drift. |
| `docs/architecture.md` | `updated` | `:18` — pixel now flushes its `/tr` ring tail via `createPixelConnector(connectorConfig).handle` and the `workerMappedGetEgress` drop-gate is retired (both connectors supply their own critical mapper). `:61` OQ16 clause was already generalized by 042-01. |
| `adapters/eds/index.js` (JSDoc) | `updated` | BOTH stale JSDocs fixed (craft + compliance flagged `bootGa4Gtag`; its sibling `bootPixelConnector` was equally stale): `:536-558` + `:810-816` no longer describe the retired gate / drop-at-teardown / `mapToMp`-mis-map posture as current; the residual truth (neither boot exposes `pushCritical`, a scope choice) is preserved. JSDoc-only — suite + eslint re-verified green. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | **CLAUDE.md verified clean by grep** — no gtag/pixel unload-posture prose (the implementer's placeholder row wrongly assumed a stale note; the stale prose was in `architecture.md`/`adapters`, now fixed). Spec 042 was never in CLAUDE.md's active-specs section, so no compress-on-close needed; `AGENTS.md` has no reference. |
| `docs/inbox.md` | `updated` | The `:17` 030-01 `method`-option follow-on marked **RESOLVED** (both connectors flush GET; gate retired). |
| `docs/refinement-todo.md` | `updated` | The GET-critical unload item struck through / **RESOLVED (spec 042, both slices)**; gtag-resolved + pixel-deferred blocks collapsed into one resolution note. |
| `docs/memory/**` (jig) | `no-op` | Durable learnings captured in the reconciled artifacts (refinement-todo RESOLVED, architecture.md `:18`, the `core/airlock.js` invariant comment, both slice records); no new glossary DOMAIN term (`requestMapper` is an implementation detail, not domain vocabulary). |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR — additive DI consumer wiring within the already-resolved ADR-0004 two-path model; arch pass (042-01) confirmed "documentation, not design". |
| Built / generated artifacts | `no-op` | Built adapter artifacts (`probes/eds-testbed/scripts/airlock/eds.js`) are regenerated by `npm run build`, not git-tracked. |
