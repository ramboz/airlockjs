---
slice: 041-02 — session-state + Consent-Mode carriage on the live path
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:03:28Z
prompt_source: review.py frame-critique docs/specs/041-ga4-gtag-boot/spec.md 'session-state' slice-02-session-consent-wiring.md (round 2)
---

VERDICT: pass (round 2)

## Reasoning

The round-1 finding is genuinely resolved. Source confirms all three load-bearing claims: `writeGa4SessionState` returns
a fresh `sessionId` + `sct` on the new-session path that can differ from the pre-write `sourceGa4Ctx` read
(`connectors/ga4/cookies.js:342-347`); it returns `null` when analytics is not granted (`:320-324`); and
`mapToGtagCollect` maps `ctx.sessionId → sid` (`gtag.js:258`) and `ctx.sessionState → sct/seg/_fv/_ss/_nsi`
(`gtag.js:261`, `appendSessionState` does not read `sessionId`) on SEPARATE destinations. Overriding `ctx.sessionId`
with the write's `sessionId` on the granted path is unconditionally correct — verified across all three writer branches:
no-op on continuation (:348-352, same sid), corrective on new-session (:342-347, fresh sid pairs with `sct+=1`),
harmless+consistent on first-visit (:334-338, sid+sct=1 from the same write). There is no granted-path case where the
pre-write sid should win; on the denied path there is no write, so `sourceGa4Ctx`'s sid stands and the seal
(`analytics_storage`) holds egress regardless. AC2's raw-vector fold is grounded (`gtag.js:231-236` — `ctx.consent` is
the raw ADR-0007 vector, not `shapeMpConsent`); the analytics gate is grounded (`cookies.js:287-289`).

## Round-1 finding — resolved

The sid/sct-coupling inconsistency (post-write `sct` bound to pre-write `sid` on new-session-at-boot) is closed: AC1 now
threads the write's `sessionId` → `ctx.sessionId` (overriding the pre-write value) alongside `sct/...` → `ctx.sessionState`,
the Current-state + an Assumption state the coupling, and the DoD adds the new-session-at-boot sid/sct-consistency guard.

## Specific issues (folded, non-blocking)

- The override is universal-on-granted (not only new-session): no-op on continuation, corrective on new-session/first-visit.
  **[FOLDED: the Assumption now states the override fires on all three granted branches; the DoD adds a continuation-boot
  coverage case (sid unchanged, `_fv`/`_ss`/`_nsi` omitted).]**
- `storageGranted` defaulting to `true` (`cookies.js:318`) is the only bypass hazard — already flagged as an
  implementation-time obligation (Assumption 2).
