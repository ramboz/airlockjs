---
status: IN_PROGRESS
dependencies: [068-03]
last_verified: 2026-11-24
---

## Slice 068-04: The host tells the caller when its own timeout answered a pending dispatch

**Goal:** When `timeoutMs` answers the chamber with a failure while `caps.egress.dispatch` is still pending, the caller can learn it, so bookkeeping tied to that request (064-34 on `vendor-adobe`: the consent generation it consumed) can follow the failure the SDK saw. Found by the 064-34 round-4 review (2026-11-24); the owner approved the core hook and a further review round the same day.

**Contract.** `caps.egress.onTimeout?: (req: object) => void`, optional. When the host's timeout fires while a dispatch it started is still unsettled, the host calls it once with the very `req` object it passed to `dispatch`, then posts the `status:0` answer. It is never called when the dispatch settles first, never for a request held at the seal (no dispatch started), and a throwing hook is swallowed so the chamber still gets its answer. Core knows nothing about what the caller does with it.

**Acceptance Criteria:**

1. A pending dispatch that hits `timeoutMs` calls `onTimeout` once with the same object `dispatch` received, and the chamber still gets the `status:0` timed-out answer. Hermetic test.
2. A dispatch that settles before the timeout never calls `onTimeout`. A throwing `onTimeout` does not stop the timeout answer. Hermetic tests.
3. `test/wrapped-sdk-host.test.js` and `test/core-boundary.test.js` stay green; the hook carries no vendor shape.

**Out of scope:** any use of the hook (064-34 on `vendor-adobe` consumes it); aborting the late fetch; changing `timeoutMs`.

**DoD:** `npm test && npm run lint` and servo gate pass; reviews recorded with the 064-34 round 5; CHANGELOG entry.

**Anti-horizontal-phasing check:** Vertical: a never-settling dispatch through the host timeout to the caller's hook and the chamber's answer.

## Findings (2026-11-24)

Tests: "068-04: onTimeout gets the dispatched req once ..." and "068-04: a throwing onTimeout still lets the timeout answer reach the chamber" (`test/wrapped-sdk-host.test.js`). Mutation: never calling the hook fails the first test; the pre-dispatch guard (`dispatched`) is defensive and has no test, because the timer is armed and the dispatch starts in one microtask chain.
