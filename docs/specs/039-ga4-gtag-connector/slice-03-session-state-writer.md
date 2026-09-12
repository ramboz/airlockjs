---
status: DONE
dependencies: [039-01, 004-03, 017-02]
last_verified: 2026-09-08
frame_review: true
arch_review: true
---

## Slice 039-03 — session-state reproduction + `_ga_<stream>` writer (closes OQ13-2)

**Goal:** Reproduce gtag's **session state** on the beacon — `sct` (session count), `seg` (engaged), `_fv` (first-visit),
`_ss` (session-start), `_nsi` (new-session-id) — and **become the `_ga_<stream>` session writer** (consent-gated), so
sessions persist across pages instead of minting per page. This is the stateful half ADR-0019 sized, and it closes
**OQ13-2**.

**DoR:**
- ✅ 039-01 done — the core beacon + `cid`/`sid` sourcing exist.
- ✅ The consent GATE is reusable — `sourceGa4Ctx` already writes `_ga` under `analytics_storage` (`cookies.js:146,172`,
  017-02); this slice reuses that gate. **But the write DISCIPLINE is new work, not a seam extension:** the `_ga` write
  is create-if-absent (`cookies.js:171`, `if (rawGa == null)`) and never mutates an existing cookie; the `_ga_<stream>`
  writer must **read-modify-write every cycle** (advance `o`/`g`/`t`, apply the 30-min timeout boundary).
- ✅ The session-state transition rules are **observed live** (2026-09-08) — see
  `test/fixtures/parity-ga4-collect-multipage.redacted.json` and the spec's `## Assumptions`; this slice reproduces the
  observed GS2 state machine, it does not infer it from a single-page capture.

**Acceptance Criteria:**

1. **`_ga_<stream>` read-modify-write writer.** The connector reads the existing `_ga_<stream>` cookie, advances its GS2
   fields, and writes it back every cycle (create-if-absent for a first visit), gated on `analytics_storage` (reusing
   the 017-02 gate, `cookies.js:172`). GS2 grammar reproduced: `GS2.1.s{sid}$o{sct}$g{engaged}$t{lastHit}$j…$l…$h…`, with
   the opaque `j`/`l`/`h` sub-fields carried verbatim.
2. **Transition rules match the observed state machine** (fixture `parity-ga4-collect-multipage.redacted.json`):
   - **first visit** (no `_ga`): mint `cid`; session `o=1`, `g=0`, `s=t=now`; beacon carries `_fv`,`_ss`,`_nsi`, `sct=1`, `seg=0`.
   - **continuation** (`now − t ≤ timeout`): `s` and `o` unchanged, `g→1` once engaged, `t=now`; beacon carries `sct=o`, `seg=g`, and NO `_fv`/`_ss`/`_nsi`.
   - **new session** (`now − t > timeout`, where `timeout = config.sessionTimeoutMinutes`, default 30): `s=now`, `o+=1`, `g=0`, `t=now`; beacon carries `_ss`,`_nsi`, `sct=o(new)`, `seg=0`, and NO `_fv`.
3. **OQ13-2 closed — asserted on VALUES, not just "advanced".** A two-page-load test on a gtag-free MPA asserts the
   second load **reuses the same `sid`** AND that the resulting cookie/beacon **equals** the observed continuation values
   (same `s`/`o`, `t` advanced, `seg` engaged) — not merely "differs from a fresh per-page session". `docs/refinement-todo.md`
   item 2 is marked resolved by this slice.
4. **Same-protocol oracle over the observed multi-page fixture.** The writer's cookie/beacon sequence across the three
   regimes matches `parity-ga4-collect-multipage.redacted.json` field-for-field (the fixture encodes the live-observed
   VALUES, so this is a parity assertion against real gtag behavior — not a self-referential simulation of the
   connector's own inferred rules). Wired into the 038 same-protocol oracle where available; a direct fixture assertion
   otherwise.

**DoD:**
- [x] All ACs pass; full suite green (89 files / 1365 tests, independently re-run).
- [x] Coverage: first page (`_fv`/`_ss`/`_nsi` set, `sct=1`, `seg=0`), second page same session (`sid`+`sct` reused,
      `seg→1`, `t` advanced, no `_ss`/`_nsi`/`_fv`), a third page after a >30min gap (`sct` incremented, fresh `sid`,
      `_ss`/`_nsi` set, no `_fv`), and a consent-denied path (no `_ga_<stream>` write, per-page fallback). (11 tests.)
- [x] Each new test shown to fail when its feature is removed (implementer verified by removal; all three reviews confirmed).
- [x] Reviewed by `reviewer` (compliance + craft + arch — all pass; evidence in `reviews/slice-03-*.md`).
- [x] Deviation log + reconciliation sweep produced; refinement-todo item 2 (OQ13-2) marked Resolved with a pointer here.

## Assumptions

- **The session-boundary rules are observed, not inferred (2026-09-08).** That `_ss`/`_nsi` appear at session start,
  that `sct` increments on a new session, and that `sid` is reused within a session were all directly observed by driving
  `_ga_<stream>` transitions across reloads on the reference page. **Residuals:**
  - The **timeout length is the documented GA4 default (30 min), one-point-confirmed** — a forced 33-min-old `t`
    produced a new session; continuations were observed at ≤5 min. The exact boundary is bracketed ~[5 min, 33 min] and
    "30 min" is the documented default filling the gap.
  - The GA4 **session timeout is a per-property Admin setting** (default 30 min, **configurable**). The writer therefore
    takes the timeout as **config (`config.sessionTimeoutMinutes`, default 30)**, not a hardcoded constant, or it would
    diverge on a rewire target that customized it (the exact `sct`/`_ss`/`_nsi` parity this slice promises). The
    reference page only confirms the default case.
  - The exact `seg`-engagement **threshold** — observed to flip `0→1` on the 2nd pageview, but whether the trigger is
    2 pageviews vs >10 s vs a conversion is documented, not timed; a wrong threshold mis-attributes *engaged*-session
    counts (not session counts) in the console.
  - The GS2 `j`/`l`/`h` sub-fields were constant (`j60`/`l0`/`h0`) across all observations and are carried verbatim as
    opaque, not authored. (Why `frame_review: true`.)
- **Cookie-write value/attribute governance** rides the existing reconcile seam (035-01); the `_ga_<stream>` value shape
  is validated the same way `_ga` is.

**Anti-horizontal-phasing check:** After this slice a rewired GA4 no longer fragments sessions across an EDS MPA —
session continuity parity, the last gap between the gtag connector and the container's own tag.

### Deviation log (after reconciliation)

- **Module-boundary reversal (supersedes 039-01's recorded "resolved intent").** 039-01's deviation log intended 039-03 to
  grow `createGa4GtagConnector` into a capability-holding `init(caps)` Connector. Instead the read-modify-write writer
  `writeGa4SessionState` lives **host-side in `connectors/ga4/cookies.js`** (host-called, exactly like `sourceGa4Ctx`), and
  `gtag.js` stays a **pure mapper** that only projects `ctx.sessionState` onto the beacon. **Rationale:** cookies are a
  main-thread/orchestrator concern (`architecture.md` OQ5 — the orchestrator is the only DOM/cookie writer); the arch pass
  judged this boundary "arguably better" than the `init(caps)` intent (a caps-holding connector would push cookie mutation
  into the chamber layer and duplicate consent resolution). The writer reuses the identical `capability.d.ts` cookie
  accessor + the identical 017-02 `storageGranted` gate, adding genuinely new mutate-every-cycle discipline.
- **Two 039-01 commitments, resolved/retained.** (a) The `createGa4GtagConnector` factory name still implies a full
  `Connector` but returns `{ handle }` — **retained** (already shipped in DONE+landed 039-01/02; the module doc now clearly
  frames it as the pure-mapping half + the config/ctx-threading choice, disambiguating the name; a rename of landed code
  isn't worth the churn). (b) The module-doc "separate wrapper" line is now accurate — it describes the future host-wiring
  `Connector` wrapper (mirroring `connectors/ga4/connector.js`↔`map.js`) as correctly deferred.
- **Host-wiring contract deferred (for the future wrapper slice).** No production caller invokes `writeGa4SessionState`
  yet. The host MUST (i) override `ctx.sessionId` with the writer's returned `sessionId` — else per-page sessions silently
  return and defeat OQ13-2 (contract-by-doc; no composing helper pins it), and (ii) derive `streamCookieName` from the
  measurement id (the writer takes it as config, it does not scan `document.cookie` like `sourceGa4Ctx`). A single
  host-side composing helper is worth it when wiring lands. Also carries the 039-02 raw-vector requirement (gate on the raw
  `analytics_storage` signal, not the shaped MP object).
- **`GS2_TAIL_DEFAULT` by-reference → per-call copy.** All three review passes flagged the module-level mutable array
  assigned by reference to `next.tail` on a first visit. Fixed at reconciliation (`[...GS2_TAIL_DEFAULT]`) — latent
  cross-invocation corruption guard; full suite re-run green (89 files / 1365 tests).
- **Nits → later sweep (non-blocking):** `createGa4GtagConnector` config typedef omits `sessionState?` (JSDoc drift);
  `parseGa4SessionState` re-implements the GS2-body-scan idiom from `parseGaSessionId` (differing return shapes + GS1
  support justify two fns; extract a shared `parseGs2Body` on a 3rd caller per the extract-on-third-caller convention); a malformed-but-present
  `_ga_<stream>` is treated as a first visit (opposite of `sourceGa4Ctx`'s never-overwrite-malformed `_ga` — fine for the
  sole-writer gtag-free MPA target, a rationale comment would close the asymmetry).
- **Engagement heuristic (documented residual).** The continuation branch flips `engaged→1` on every continuation
  (equating "2nd pageview" with engaged) — the slice's own documented `seg`-threshold residual (documented-not-timed); a
  future capture can confirm/correct the exact threshold. Mis-attributes *engaged*-session counts only, never session
  identity.
- **AC5 legacy-fixture is projection-only (honest, disclosed).** The AC5 block over `parity-ga4-collect.redacted.json`
  threads that fixture's own `sct/seg/_fv/_ss/_nsi` into `ctx.sessionState` rather than running `writeGa4SessionState`,
  because that 038 fixture encodes a physically-impossible transition combo (`_fv+_ss+_nsi` together with `seg=1`) and its
  cookies are pinned by `test/parity-ga4.test.js`. The writer's real transition math is oracle/assertion-checked against
  the purpose-built `parity-ga4-collect-multipage.redacted.json`.

### Reconciliation sweep

- **`connectors/ga4/cookies.js`**: **updated** — `writeGa4SessionState` (host-called read-modify-write writer) + the GS2
  `parseGa4SessionState`/`formatGa4SessionCookieValue` parser/formatter + the per-call tail-default copy. `sourceGa4Ctx`'s
  own return shape untouched.
- **`connectors/ga4/gtag.js`**: **updated** — `appendSessionState` projects `ctx.sessionState` onto the beacon; module doc
  clarified. Return shape / 039-01/02 behavior unchanged.
- **`rig/parity/descriptors/ga4-gtag.js`**: **updated** — session-state gap rows (`sct/seg/_fv/_ss/_nsi`) removed (now
  classify `maps`); `gcd` (039-05) is the sole remaining owned gap.
- **`test/ga4-gtag.test.js`**: **updated** — 11 new writer/transition tests against the multi-page fixture; legacy AC5
  replay adjusted for the shrunk gap map.
- **`test/fixtures/parity-ga4-collect-multipage.redacted.json`**: **added (in 039-03's re-frame)** — the field-for-field
  ground truth AC3/AC4 assert against (first-visit / continuation / new-session), encoding the live-observed GS2 values.
- **`docs/refinement-todo.md`**: **updated** — OQ13 item 2 (OQ13-2) struck through / marked Resolved (039-03) with the
  host-wiring deferral noted.
- **`docs/architecture.md`**: **updated at spec close-out** — added the gtag connector (`connectors/ga4/gtag.js`) + the
  host-called `writeGa4SessionState` cookie-write governance surface to the module inventory (this slice closes spec 039:
  039-01/02/03 DONE, 039-04/05 DEFERRED → spec rolls up DONE, so the 039-01/02-deferred architecture write lands here).
- **Frozen MP surface** (`connectors/ga4/map.js`, `contracts/ga4-mp*`): **no-op** — untouched (golden-hash guard passes).
- **`test/fixtures/parity-ga4-collect.redacted.json`**: **no-op / deferred** — NOT edited (pinned by 038's
  `test/parity-ga4.test.js`); its known session-state inconsistency remains the DONE-spec-038 owner-approval item flagged
  in 039-01's sweep.
- **ADR trigger**: **no new ADR** — the cookie-write governance surface implements ADR-0019 + reuses the 017-02
  consent-gate model; the host-side-writer boundary follows the established `map.js`/`connector.js` + `sourceGa4Ctx`
  pattern (documented above), not a load-bearing choice with rejected alternatives.
- **Glossary / CLAUDE.md primer**: **no-op** — spec 039 is not tracked in the CLAUDE.md active-specs list; no always-loaded
  per-slice invariant to migrate.
