---
status: Accepted
dependencies: [ADR-0063, 064-32]
see_also: [bug-007]
last_verified: 2026-11-25
frame_review: true
---

# ADR-0066: Chamber result follows bridge requests

## Status

Accepted (2026-11-25). The owner granted acceptance directly after a passing frame critique. The gate keeps its existing 250 ms cap, and a fetch parked at the core consent seam stays pending until that cap. ADR-0063 is Accepted and stays byte-unchanged. This ADR cites it and narrows nothing in it.

## Summary

A redirect navigation must not leave while a push the page already made is still on its way to the wire. Rounds 1 to 8 of slice 064-32 tried to match each request to its push by event type, body and timing. All eight failed final review. This ADR proposes to stop matching. The chamber posts its `result` and `fatal` messages behind every bridge request reserved during that event's drive. The adapter gate then waits for each pending push to settle.

## Context

The navigation gate of slice 064-32 must not let a redirect leave while a push the page already made is still on its way to the wire, and eight attribution-based attempts failed review.

- 064-32 AC5b (owner-amended, round 5) asks for stock's order of a push against the redirect display of an earlier `applyResponse`. The bounded no-loss guarantee is that a push made before the navigation decision has its request issued, or settles without one, before the page navigates, within a 250 ms cap.
- No AC asks for the request's origin identity. That requirement entered through the round 7 and round 8 repair briefs. Rounds 7 and 8 failed on it as a mechanism, and the static counterexamples were never reproduced as a browser loss.
- The gap is in the chamber. `sendBeacon` with a Blob body takes its bridge slot synchronously and posts `intercepted-fetch` only after `data.text()` resolves (`connectors/alloy/alloy-chamber.worker.js:308-328`, `reserveBridgeSlot` at 295-299). `drive()` posts `result` and `fatal` directly, outside the bridge queue (610-620). So a beacon can reach the host after the `result` of the event that made it.
- The host handles messages in arrival order. An `intercepted-fetch` runs its seal checks, then dispatches to `caps.egress.dispatch` in a microtask (`core/wrapped-sdk-host.js:629-667`, `handleMessage` 687-806). A `result` resolves the drive (783-790).
- Bug 007 already makes beacon and `fetch` posts keep the tag's call order through the bridge queue (`postInOrder`, `reserveBridgeSlot`). It does not cover `result` or `fatal`.
- Today's gate attributes a request to a pending entry in `adapters/eds/index.js` (`ownsRequest`, `notifyFetchIssued`, and a 250 ms retire timer for documentUnloading entries). Rounds 7 and 8 reviews showed it can credit another entry when event types match or are absent.

## Decision Options Considered

### Option A: drive-token correlation
Tag every `intercepted-fetch` and `result` with a drive id and carry it through the core into the request given to `caps.egress.dispatch`.
- **Pros:** exact origin for every request, including late ones.
- **Cons:** changes the chamber to core to adapter message contract and the `caps.egress.dispatch` request shape, which is a security-relevant surface and needs its own owner decision. It adds no guarantee that option B lacks for the stock guarantee that matters here.

### Option B: bridge ordering plus a settlement-only gate (recommended)
The chamber posts `result` and `fatal` through `postInOrder`, so they trail every slot reserved during that drive. The adapter gate waits for each pending push entry to settle (result, fatal, throw), be dropped by the consent ring, or be disposed. It no longer attributes requests.
- **Pros:** no message type or field changes. With no pending slot, `postInOrder` runs synchronously, so today's order is unchanged. It extends bug 007's invariant by one step. It removes the attribution code that failed eight reviews.
- **Cons:** depends on assumptions A1 to A3 below. A request that Alloy issues after its event has settled is outside the guarantee. The gate waits for settlement, so it does not release early on a push's own egress.

### Option C: keep event-type and body attribution
- **Pros:** no chamber change.
- **Cons:** it credits by arrival or by shared type, so another entry can release a push (rounds 7 and 8). Rejected.

A vendor per-event id in the request body was also considered. It is unverified in the pinned 2.31.1 body and must not become an AC.

## Recommended Decision

Option B, scoped as follows.

1. In `drive()`, post `result` and `fatal` with `postInOrder`.
2. In the adapter, retire a `pendingIssue` entry only when its own run settles, the consent ring drops it, or `dispose` runs. Remove `ownsRequest` matching, the `notifyFetchIssued` crediting and the documentUnloading retire timer.
3. Keep the existing gate shape: a one-macrotask snapshot of the pending entries, then `Promise.all` over them, capped at `NAVIGATION_GATE_MS = 250`.

Kept as they are: stock's display-before-navigation intent; stock-dependent push ordering; display draining during a gate wait; the `redirectWaitMs` renderer timeout path, which navigates without the gate; the snapshot, so a push made after the gate looked is not waited for; query and cache behavior; and every seal, consent, allowlist, tenant, ceiling and config-integrity check and the serialized dispatch.

A push that completes without a request (a consent ring drop, an Alloy rejection or a fatal) settles before the cap. A fetch parked at the core consent seam is different: the core keeps the chamber's fetch pending (`core/wrapped-sdk-host.js:352-356`), so its `sendEvent` does not resolve, the entry does not settle, and the gate releases at the 250 ms cap. No request reaches the wire in that case, so the bounded no-loss guarantee holds. A parked beacon may complete; no claim is made about every transport. This ADR adds no park signal, synthetic response or timeout.

No silent bodyless beacon fallback. If a delayed, rejected or stalled Blob body falsifies the guarantee, the work stops with evidence. Dropping a body or adding a new timeout is a changed behavior and needs a new decision.

## Consequences

**Becomes easier:**
- The gate has no identity heuristic to review.
- Same-type and untyped overlap cannot credit the wrong entry, because nothing is credited.
- The bridge order covers `result` and `fatal` as well as `fetch` and beacons.

**Becomes harder:**
- A stalled body read would hold `result` behind its reserved slot (see A2).
- The gate releases on settlement or the cap, never on a push's own egress.
- A request issued after its event settled (for example a vendor retry) can still reach the wire after a navigation. It is a recorded residual. A late request must not credit a newer entry, and the regression contract keeps a negative test for that.

## Assumptions

None of these is asserted as fact. Each has a witness and a kill criterion.

- **A1.** Stock Alloy 2.31.1 calls `sendBeacon` or `fetch` for an event, and for any request it starts for that event, before that `sendEvent` promise resolves. The pinned bundle is not cached in this worktree, so this is not read. Witness: test T4 in the slice. A single successful run does not enumerate every Alloy path.
- **A2.** The chamber's Blob body read (`data.text()`) settles, by fulfilling or rejecting, for the bodies Alloy passes. If it never settles, the reserved slot holds `result` and stalls the pump. Witness: T8.
- **A3.** The host dispatches or holds each `intercepted-fetch` before it handles the next message (`core/wrapped-sdk-host.js:629-667`, `687-806`, read at this head). Witness: T4 end to end.

## Kill criteria

- T4 shows a request posted after its event's `result`: A1 fails. Stop and return option A to the owner.
- T8 shows a body read that does not settle, or a stalled pump, or cannot show settlement: A2 fails. Stop with evidence. No fallback is authorized here.
- Any need to change a message type, a message field or the `caps.egress.dispatch` request shape: stop, that is option A.

## Open questions

- Whether the owner wants to grant a one-line append-only pointer in ADR-0063. Not assumed. Without it, ADR-0063 stays unchanged and this ADR stands alone.
- The ADR number is provisional. Verify there is no collision on origin before any landing.
