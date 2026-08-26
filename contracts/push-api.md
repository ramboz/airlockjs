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

## The read surface

```js
airlock.getState();          // whole synchronous projection (a plain object)
airlock.getState("a.b.c");   // path read into the projection
```

- **Synchronous reads are correct.** Because `push` folds the projection
  synchronously before returning, a read immediately after a push sees that
  push (AD-3). This is the property `patchDatalayer` lacked and the event-log +
  projection split exists to provide.

## Supported subset (drop-in)

| Capability | Supported | Notes |
|---|---|---|
| Object push `push({event, ...})` | ✅ | The primary surface. |
| Synchronous `getState()` | ✅ | Whole-projection read. |
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
