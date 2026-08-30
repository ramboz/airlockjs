---
slice: 013-03 — config-integrity / same-host-tenant re-routing
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:36:07Z
prompt_source: spike-light craft (combined reviewer) — 013-03
substrate: non-interactive
---

## Craft review — slice 013-03 (spike-light, combined pass) — **needs-changes → all applied → pass**

- **[craft/1] PASS (the sharpest)** — the demonstration is SUBSTANTIVE, not circular: the AC2 test
  asserts the re-pointed URL's host is unchanged (allow-list blind), and the bypass test proves
  boot-time host-ownership is evadable while the seam catches it. The load-bearing spike value —
  control LOCATION = seam, and WHY the allow-list misses it — is genuinely established.
- **[craft/3+2 should-fix → FIXED] parse-and-compare was evadable.** A check that TRUSTS the hostile
  chamber's own URL can be dodged by parameter pollution (`?configId=<honest>&configId=<attacker>` →
  `.get()` returns the first). **Fixed:** the detector now uses `getAll` (pollution-aware) and an
  **OVERRIDE** posture (`pinnedDispatchUrl` re-derives the dispatch URL from the host pin, discarding
  the chamber's value). The recorded requirement now says "re-derive/override, not parse-and-compare."
- **[craft/2 should-fix → FIXED] fail-OPEN on absent configId.** Was `allow` on a missing configId.
  **Fixed:** fails CLOSED — absent / duplicated / mismatched all HOLD. New tests cover pollution +
  absence + override (4 → 7 tests).
- **[craft/2 should-fix → RECORDED] orgId/body co-vector.** The check pins the datastream (routing);
  the orgId (body) is identity-namespacing, a residual — now recorded as a carry-forward (close via
  read-minimization / body inspection if routing-relevant).
- **[craft/4 nit → FIXED]** the unused `catch (e)` binding is now `catch {}`.

### Net
Compliance was clean; craft's needs-changes was entirely about the demonstrated control's shape
(evadable parse-and-compare, fail-open, orgId residual). All applied: fail-closed + pollution-aware +
override, with the ADR-0006 design lessons recorded so they reach the addition, not just the stub.
