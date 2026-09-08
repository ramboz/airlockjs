---
status: DRAFT
dependencies: [039-01, 004-03, 017-02]
last_verified:
frame_review: true
---

## Slice 039-03 — session-state reproduction + `_ga_<stream>` writer (closes OQ13-2)

**Goal:** Reproduce gtag's **session state** on the beacon — `sct` (session count), `seg` (engaged), `_fv` (first-visit),
`_ss` (session-start), `_nsi` (new-session-id) — and **become the `_ga_<stream>` session writer** (consent-gated), so
sessions persist across pages instead of minting per page. This is the stateful half ADR-0019 sized, and it closes
**OQ13-2**.

**DoR:**
- ✅ 039-01 done — the core beacon + `cid`/`sid` sourcing exist.
- ✅ The consent-gated cookie-write seam exists — `sourceGa4Ctx` already writes `_ga` under `analytics_storage`
  (`cookies.js:146`, 017-02); this slice extends it to `_ga_<stream>`.

**Acceptance Criteria:**

1. **`_ga_<stream>` writer.** The connector writes/updates the `_ga_<stream>` session cookie (its GS2 grammar), gated on
   `analytics_storage` exactly as the `_ga` write is (017-02) — reusing that seam, not a new one.
2. **Session-state fields.** The beacon carries `sct`/`seg`/`_fv`/`_ss`/`_nsi` computed from the persisted session state
   per gtag's documented rules (new session vs continuation; first visit; engagement).
3. **OQ13-2 closed.** On a gtag-free MPA, a second page load in the same session **reuses `sid`** and advances the state
   (not a fresh per-page session) — asserted by a two-page-load test; `docs/refinement-todo.md` item 2 is marked
   resolved by this slice.
4. **Same-protocol oracle over multiple pages.** A redacted multi-page `/g/collect` fixture passes the 038 oracle on the
   session-state set (or a two-load unit simulation until 038 lands).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: first page (`_fv`/`_ss`/`_nsi` set, `sct=1`), second page same session (`sid` reused, state advanced),
      and a consent-denied path (no `_ga_<stream>` write, per-page fallback).
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — introduces a new cookie-write governance surface).
- [ ] Deviation log + reconciliation sweep produced; refinement-todo item 2 (OQ13-2) struck through with a pointer here.

## Assumptions

- **gtag's session-state update rules** (when `_ss`/`_nsi` reset, how `seg` flips, `sct` increments) are inferred from
  the R-009 capture + documented gtag behavior — a wrong rule yields a beacon that diffs clean field-for-field yet
  mis-attributes sessions in the console (the console leg, MVP9). Confirmed on multi-page captures before freezing. (Why
  `frame_review: true`.)
- **Cookie-write value/attribute governance** rides the existing reconcile seam (035-01); the `_ga_<stream>` value shape
  is validated the same way `_ga` is.

**Anti-horizontal-phasing check:** After this slice a rewired GA4 no longer fragments sessions across an EDS MPA —
session continuity parity, the last gap between the gtag connector and the container's own tag.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
