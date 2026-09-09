---
status: DRAFT
dependencies: [039-01, 004-03, 017-02]
last_verified:
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
- [ ] All ACs pass; full suite green.
- [ ] Coverage: first page (`_fv`/`_ss`/`_nsi` set, `sct=1`, `seg=0`), second page same session (`sid`+`sct` reused,
      `seg→1`, `t` advanced, no `_ss`/`_nsi`/`_fv`), a third page after a >30min gap (`sct` incremented, fresh `sid`,
      `_ss`/`_nsi` set, no `_fv`), and a consent-denied path (no `_ga_<stream>` write, per-page fallback).
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — introduces a new cookie-write governance surface).
- [ ] Deviation log + reconciliation sweep produced; refinement-todo item 2 (OQ13-2) struck through with a pointer here.

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

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
