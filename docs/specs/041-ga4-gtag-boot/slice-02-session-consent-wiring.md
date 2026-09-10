---
status: DRAFT
dependencies: [041-01, 039-03, 039-05]
last_verified:
frame_review: true
arch_review: true
---

## Slice 041-02 — session-state + Consent-Mode carriage on the live path

**Goal:** Enrich the live gtag beacon (041-01 boots it with `v`/`tid`/`cid`/`sid` only) with the full 039 payload:
host-source the `_ga_<stream>` session-state (`sct`/`seg`/`_fv`/`_ss`/`_nsi`) into `ctx.sessionState`, and fold the raw
ADR-0007 consent vector into `ctx.consent` (+ `ctx.consentDefault`) so beacons carry `gcs`/`gcd`.

**Blocked-on:** 041-01 (the boot fn + connector wrapper). 039-03 (`writeGa4SessionState`) + 039-05 (`gcd` encoding). DONE.

## Current state (grounded)

- `writeGa4SessionState` (`connectors/ga4/cookies.js:313-362`) — the host-side `_ga_<stream>` read-modify-write — has
  **ZERO callers** today. It needs a concrete `streamCookieName` (host config; it cannot scan like the read-side
  `findGaStreamCookie`). **Its return `{ sessionId, sct, seg, _fv?, _ss?, _nsi? }` splits into TWO beacon destinations
  (frame-critique correction): `sessionId` → `ctx.sessionId` (the beacon's `sid`), while `sct`/`seg`/`_fv`/`_ss`/`_nsi`
  → `ctx.sessionState` (consumed by `appendSessionState`, `gtag.js:213-219`, which does NOT read `sessionId`).** These
  are COUPLED outputs of one session transition: on a new-session-at-boot (existing cookie, `now - lastHit > timeout`)
  the write mints a **fresh `sid = now` with `sct += 1`** (`cookies.js:342-347`) — so the sid it returns can DIFFER from
  the pre-write `sid` that 041-01's `sourceGa4Ctx` read (`cookies.js:188`). The beacon's `sid` and `sct` MUST come from
  the SAME (post-write) transition, or it egresses an incremented `sct` bound to a stale `sid` — an inconsistent beacon
  the 038 parity oracle would flag.
- `mapToGtagCollect` (`gtag.js:261,279,284`) reads `ctx.sessionState`, `ctx.consent`, `ctx.consentDefault` — absent
  today from 041-01's boot ctx, so live beacons omit session-state + `gcs`/`gcd` (per the connector's own back-compat
  omission rules).
- Precedent: `bootGa4Core:382,390-396,419-420` — the `storageGranted` gate → `sourceGa4Ctx` → pre-`createAirlock` ctx
  fold ordering. gtag wants the RAW consent vector (`gtag.js:100-107`), NOT `shapeMpConsent`'s output.

## The load-bearing question (why `frame_review` + `arch_review`)

`writeGa4SessionState` is a main-thread **cookie WRITE** on boot — its first-ever caller. 039-03's arch review
sanctioned this boundary (cookies are a host/orchestrator concern, host-side, the same place `sourceGa4Ctx`'s `_ga` read
lives), so wiring it applies that decision. The load-bearing questions the passes must confirm: (a) the write is gated
on `analytics_storage` grant (no cookie write without analytics consent — `writeGa4SessionState` already returns `null`
when not granted, but the host must not call it or must honor the null); (b) ordering — the session-state write + the
`ctx.consent` fold both happen BEFORE `createAirlock` (like `bootGa4Core`); (c) this is initial-boot carriage, consistent
with 041-01's boot-snapshot scope (post-boot consent-update / session-transition carriage into the worker remains the
tracked follow-up 041-01 named).

**Acceptance Criteria:**

1. **Session-state carriage — and `sid` reconciliation (frame-critique correction).** `bootGa4Gtag` calls
   `writeGa4SessionState(...)` (with the host-configured `streamCookieName`, the cookie capability, gated on
   `analytics_storage` grant) BEFORE `createAirlock` and threads its return into `connectorConfig.ctx` on **both**
   destinations: `sct`/`seg`/`_fv`/`_ss`/`_nsi` → `ctx.sessionState`, AND the returned `sessionId` → `ctx.sessionId`
   **overriding** the pre-write `sid` 041-01 sourced via `sourceGa4Ctx`. The write is the AUTHORITATIVE session source
   once it advances the transition, so `sid` and `sct` on the emitted beacon come from the SAME (post-write) transition.
   A boot with analytics granted → the beacon carries `sct`/`seg` (+ `_fv`/`_ss`/`_nsi` per the transition) with a
   consistent `sid`, per 039-03's rules; analytics NOT granted → no cookie write (`writeGa4SessionState` returns null),
   no session-state fields, and `ctx.sessionId` stays 041-01's `sourceGa4Ctx` value (039-03 back-compat).
2. **Consent-Mode carriage.** `bootGa4Gtag` folds the raw ADR-0007 consent vector into `connectorConfig.ctx.consent`
   (and `ctx.consentDefault` from host config) — NOT `shapeMpConsent`'s output. A boot with a consent vector → the live
   beacon carries `gcs` (039-02) and `gcd` (039-05, for the denied-all default); a pending/absent vector → omitted per
   the connector's existing rules.
3. **The seal is unchanged.** The main-thread egress seal still governs on `analytics_storage` (041-01's
   `egressPurposes`); this slice only enriches `connectorConfig.ctx` — it does not change the seal verdict.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: analytics-granted boot → beacon carries session-state + `gcs`/`gcd`; **a NEW-session-at-boot (existing
      `_ga_<stream>` cookie, `now - lastHit > timeout`) → the beacon's `sid` == the write's fresh `sessionId` AND `sct`
      is the incremented value from the SAME transition (NOT the stale `sourceGa4Ctx` sid — the sid/sct-consistency
      guard)**; analytics-denied boot → no cookie write, no session-state, `ctx.sessionId` stays the `sourceGa4Ctx`
      value, seal behavior unchanged; a **continuation boot (existing cookie within timeout)** → `sid` unchanged
      (override is a no-op), `_fv`/`_ss`/`_nsi` omitted per 039-03; the `streamCookieName` is threaded from host config;
      the raw (not `shapeMpConsent`) vector reaches `ctx.consent`. Each new-feature test fails on revert.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — first caller of the host-side `_ga_<stream>`
      cookie write).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Initial-boot carriage only (consistent with 041-01's boot-snapshot frame).** This slice sources session-state +
  consent ONCE at boot; live post-boot updates into the worker connector remain the tracked follow-up 041-01 named. If
  the frame-critique finds a first beacon needs mid-flight session-state (e.g. a session transition during the same page
  load), re-frame.
- **`writeGa4SessionState`'s analytics gate is honored, not bypassed** (grounded: `cookies.js` returns `null` when not
  granted; the host must not write a cookie without analytics consent — an ADR-0007 posture). Confirmed at implementation.
- **`sid` and session-state are ONE coupled transition, not two independent sources (frame-critique correction).**
  041-01 sources `sid` via `sourceGa4Ctx` (a pre-write read); this slice's `writeGa4SessionState` may advance the
  session (new-session-at-boot → fresh `sid` + `sct += 1`), so its returned `sessionId` MUST override 041-01's `sid` on
  the analytics-granted path — otherwise the beacon carries `sct` from the post-write transition and `sid` from the
  pre-write read, an inconsistent beacon the 038 oracle flags. The override is **unconditional on the granted path**
  (frame-critique round 2, verified across all three writer branches): a **no-op on continuation** (the write returns
  the same `sid`), **corrective on new-session** (fresh `sid` pairs with `sct += 1`), and **harmless+consistent on
  first-visit** (`sid`+`sct=1` from the same write). There is no granted-path case where the pre-write `sid` should win.
  On the analytics-denied path there is no write, so 041-01's `sourceGa4Ctx` `sid` stands (no session-state to mismatch).

## Anti-horizontal-phasing check

After this slice the live gtag beacon carries the SAME `cid`/`sid`/session-state/`gcs`/`gcd` payload the container's own
gtag would send (spec 039's field parity), end-to-end on a real page — not a boot-time skeleton.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
