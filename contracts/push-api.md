# Contract: the `push()`-shaped datalayer API

Pinned drive-order step 5. The drop-in compatibility surface (product-vision
Identity, contract surface 2). Loosely GTM/ACDL-shaped, sitting on the
event-log + synchronous-projection split (AD-3). This doc pins **which
semantics are drop-in and which are deliberately dropped** (arch-review finding
T1), so "drop-in" is a defined promise, not a hope.

Event envelope: [push-event.schema.json](push-event.schema.json).

## The write surface

```js
airlock.push(event);   // GTM-shaped: event is an object with an `event` name key
```

- **Synchronous, returns nothing meaningful.** `push` appends the event to the
  append-only log, folds the synchronous projection (O(1)), and enqueues for the
  worker, then returns. It does **not** return the new queue length (GTM does)
  and it does **not** return a Promise (ACDL does). The hot path is O(1) by
  contract (ADR-0002); callers must not depend on a return value.
- **Object push only.** `push({ event: "name", ...params })`.
- **Malformed push is dropped, not thrown.** A missing / empty / non-string `event`
  name (violating [push-event.schema.json](push-event.schema.json)'s required,
  `minLength: 1` `event`) is dropped with a `console.warn` — never an exception. The
  interaction path must stay O(1) and must not break the page on a bad caller.

### Unload-critical writes — `pushCritical()`

```js
airlock.pushCritical(event);   // same `{ event, ...params }` shape as push()
```

The main-thread synchronous **fast path** for the unload window ([ADR-0004](../docs/decisions/adr-0004-egress-dispatch-delivery.md)).

- **Same envelope as `push()`.** `pushCritical({ event: "name", ...params })` — the
  reserved `event` key is the GA4 event name, every other key is a param. Malformed
  input is dropped + warned, never thrown (as with `push()`).
- **Synchronous, fire-and-forget.** It maps on the MAIN thread and issues the send
  immediately via `fetch(url, { keepalive: true })`, so the request is *issued
  before the call returns* and survives page teardown. It returns nothing.
- **The canonical last-beacon path.** Call it only from a handler firing inside the
  unload window — an outbound-link click, a `pagehide` / `beforeunload` closing
  `page_view` — where an async worker round-trip cannot complete before the page is
  gone (ADR-0004 § Context). Steady-state events MUST use `push()`: the fast path
  maps synchronously, which is INP-unsafe by design and only justified when the page
  is going away.
- **Bypasses the log AND the projection.** Unlike `push()`, `pushCritical()` does
  **not** append to the event log or fold the synchronous projection — it is
  sent-but-unrecorded. A `getState()` after a `pushCritical()` does **not** reflect
  it; the read-after-write guarantee below is `push()`'s alone.
- **Subject to the aggregate keepalive budget.** The unload burst shares the browser
  `keepalive` body cap (~64 KiB in Chrome). Past budget, sends are **dropped and
  counted** (declared unload-critical types first) rather than silently failing —
  so an over-budget end-of-session degrades predictably (ADR-0004 § Keepalive budget).

> **Caller rule — `push()` XOR `pushCritical()` per logical event.** Route each
> logical event through exactly ONE of the two surfaces, never both. The runtime's
> own routing is single-sender by construction (a `push()` event is in-ring XOR
> handed-to-worker; a `pushCritical()` event touches neither the ring nor the
> worker), but the **cross-API** contract is unenforced and fails **silently**:
> firing both for one event double-counts it (the `pushCritical` sends now; the
> ring's `push` copy is then re-sent by the `visibilitychange` ring-tail flush) —
> no exception, no dropped-count, just an inflated metric (ADR-0004 § Consequences).
> An adapter that owns both sites avoids this by giving them **distinct event
> names** (the EDS adapter's `cta_engage` via `push` vs. `outbound_click` /
> `page_view` via `pushCritical`); a site mixing a hand-rolled generic tracker with
> the adapter's fast path is the realistic trigger for the double-count.

## The read surface

```js
airlock.getState();          // whole synchronous projection (a plain object)
airlock.getState("a.b.c");   // path read into the projection
```

- **Synchronous reads are correct.** Because `push` folds the projection
  synchronously before returning, a read immediately after a push sees that
  push (AD-3). This is the property `patchDatalayer` lacked and the event-log +
  projection split exists to provide. (Note: `pushCritical` does **not** fold the
  projection, so there is no read-after-`pushCritical` — see the write surface.)
- **`getState()` returns the LIVE projection by reference, not a deep clone.** The
  no-argument read hands back the orchestrator's own projection object (a dotted
  path read returns the value at that path). Callers must treat it as **read-only**:
  mutating the returned object writes through to runtime state. This is consistent
  with the 🟡 "not an ACDL-computed deep clone" row below.

## Supported subset (drop-in)

| Capability | Supported | Notes |
|---|---|---|
| Object push `push({event, ...})` | ✅ | The primary surface. |
| Unload-critical push `pushCritical({event, ...})` | ✅ | Synchronous main-thread fast path — the last-beacon route (ADR-0004). Bypasses the log/projection; `push()` XOR `pushCritical()` per logical event. |
| Synchronous `getState()` | ✅ | Whole-projection read (returns the live projection by reference). |
| Synchronous path read `getState("a.b")` | ✅ | Dotted path into the projection. |
| Event routing by `event` name | ✅ | Connectors declare the events they map. |
| Arbitrary custom params on an event | ✅ | Pass-through (OQ3 emergent schema). |

## Deliberately dropped / deferred (NOT drop-in)

| GTM / ACDL feature | Status | Rationale |
|---|---|---|
| Function push `push(function(){…})` (gtag `arguments` pattern) | ❌ dropped | Executes caller code inside the datalayer; incompatible with the capture-and-drain model (AD-2). Use a connector, not an inline callback. |
| ACDL computed/merged state semantics | ❌ dropped for MVP1 | AD-3 is event-sourcing, **not** ACDL merge semantics. The projection fold is our own reducer, not ACDL's deep-merge. |
| ACDL event listeners `addEventListener` / `.on()` | ⏸ deferred | A subscribe-to-projection-changes surface may come later; not MVP1. |
| ACDL `getState()` returning a deep clone with ACDL's guarantees | 🟡 partial | We expose `getState()`, but the returned shape is our projection, not an ACDL-computed state object. |
| Pushing PII / form-field values in event params | ⚠️ ungoverned (MVP1) | The payload read boundary for connectors is OQ11 (coupled to OQ3); for MVP1 (first-party GA4) it passes through. Do not rely on payload minimization until OQ11 lands. |

## Compatibility note

A site with an existing `window.dataLayer` GTM setup is **not** automatically
drop-in: the object-push shape matches, but function-push and any GTM
container/trigger logic do not. Airlock replaces the tag-management layer; it
does not emulate GTM's container runtime. The "drop-in" claim is scoped to the
object-push write surface plus synchronous reads, per the table above.
