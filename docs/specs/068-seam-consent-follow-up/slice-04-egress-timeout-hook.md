---
status: DONE
dependencies: [068-03]
last_verified: 2026-11-24
---

## Slice 068-04: The host tells the caller when its own timeout answered a pending dispatch

**Goal:** When `timeoutMs` answers the chamber with a failure while `caps.egress.dispatch` is still pending, the caller can learn it, so bookkeeping tied to that request (064-34 on `vendor-adobe`: the consent generation it consumed) can follow the failure the SDK saw. Found by the 064-34 round-4 review (2026-11-24); the owner approved the core hook and a further review round (direct message 2026-11-25T00:22:58.254Z: "I'd say I approve the core hook and round 5").

**Contract.** `caps.egress.onTimeout?: (req: object) => void`, optional. When the host's timeout fires while a dispatch it started is still unsettled, the host calls it once with the very `req` object it passed to `dispatch`, then posts the `status:0` answer. It is never called when the dispatch settles first, never for a request held at the seal (no dispatch started), and a throwing hook is swallowed so the chamber still gets its answer. Core knows nothing about what the caller does with it.

**Acceptance Criteria:**

1. A pending dispatch that hits `timeoutMs` calls `onTimeout` once with the same object `dispatch` received, and the chamber still gets the `status:0` timed-out answer. Hermetic test.
2. A dispatch that settles before the timeout never calls `onTimeout`. A throwing `onTimeout` does not stop the timeout answer. Hermetic tests.
3. `test/wrapped-sdk-host.test.js` and `test/core-boundary.test.js` stay green; the hook carries no vendor shape.

**Out of scope:** any use of the hook (064-34 on `vendor-adobe` consumes it); aborting the late fetch; changing `timeoutMs`.

**DoD:** `npm test && npm run lint` and servo gate pass; reviews are the 064-34 final-round reviews of the complete diff including this hook (records in 064-34's `reviews/slice-34-*.md`); CHANGELOG entry.

**Anti-horizontal-phasing check:** Vertical: a never-settling dispatch through the host timeout to the caller's hook and the chamber's answer.

### Deviation log

None against the contract. The slice was added mid-campaign (found by the 064-34 round-4 review, owner-approved 2026-11-25); the `dispatched` pre-dispatch guard stays untested because the window is unreachable.

### Reconciliation sweep

Reconciled: the 068 spec.md row and status, CHANGELOG, slice-04 Findings, 064-34's slice and spec rows, the ADR-0062 Corrections entry (the hook is named there), and the status board. Core lands on main first; vendor-adobe folds it by plain merge.

## Findings (2026-11-24)

Tests: "068-04: onTimeout gets the dispatched req once ..." and "068-04: a throwing onTimeout still lets the timeout answer reach the chamber" (`test/wrapped-sdk-host.test.js`). Mutation: never calling the hook fails the first test; the pre-dispatch guard (`dispatched`) is defensive and has no test, because the timer is armed and the dispatch starts in one microtask chain.

AC3: `test/core-boundary.test.js` stays green (the hook is `(req: object) => void`, no vendor fields). AC2's settles-first case is the second half of the AC1 test. Status is DONE: the 064-34 round-6 reviews passed (compliance b272f382 read 2026-11-25T00:37:38.083Z, craft b9759af7 .085Z, reconciliation 73fffbd2 .065Z). It landed on main first as ccfe8eae (CI run 45519860876, success), then folded by plain merge into vendor-adobe 70312872 (45520434462), vendor-google-ads aa41b73d (45521838422) and vendor-meta-pixel e2da22c1 (45521865556), all green. Carried residuals and their owners (including no failed-retry parity claim for the airlock arm, owner: Building coordinator) are in the 064-34 slice.
