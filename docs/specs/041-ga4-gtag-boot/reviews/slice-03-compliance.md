---
slice: 041-03 — batching on the live path (coalesceGa4 wired)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T02:07:33Z
prompt_source: review.py implementation ... 'batching on the live path'
---

VERDICT: pass

## Reasoning
Slice 041-03 is exactly the one-parameter wiring it claims: `coalesceGa4` imported (`adapters/eds/index.js:46`) and
passed as `coalesce: coalesceGa4` into `bootGa4Gtag`'s `createAirlock` (`:694`) — no connector, seam, or governance
change. Both AC1 tests drive the real `createGa4GtagConnector` output through the boot-created airlock + FakeWorker and
assert fetch call-count + POST-vs-GET, so the batching test is a genuine inverse (revert → 2 GETs). The 1-event GET
passthrough (coalesceGa4 AC3) and the AC2 governance re-assertion hold; no other `createAirlock` caller (MP/pixel/RUM)
gained `coalesce`.

## Specific issues
- AC2 governance test uses an all-held cohort (0 fetches), not a mixed granted/held cohort — not blocking, and (recorded
  in the deviation log) NOT constructible for gtag: the consent verdict is cycle-uniform + gtag's endpoint is uniform, so
  a single cycle can't mix dispositions. The "held never enters a merged POST" clause is structural (Phase-1 survivors
  precede Phase-2 coalesce) + already 040-02-tested. [Rationale folded.]

## Reconciliation notes
- One-parameter addition, no deviation. DoD + deviation log + sweep now completed. [Done.]
