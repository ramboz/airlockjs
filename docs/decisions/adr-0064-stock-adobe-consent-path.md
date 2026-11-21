---
status: Proposed
dependencies: [ADR-0007, ADR-0061, ADR-0062, ADR-0063, 064-21, 064-33]
last_verified: 2026-11-20
frame_review: true
---

# ADR-0064: Stock Adobe consent path for the Alloy chamber

## Status

Proposed (2026-11-20). Waiting for the owner to accept it.

The owner asked for this path. The coordinator offered "add a stock consent path (ADR-0064 + slice 064-30), or record the set-consent body as a known difference?" and the owner answered: "Yes, add the stock consent path (ADR-0064 + 064-30) (Recommended)" (2026-11-20).

## Summary

Today a page that calls stock `setConsent` with an Adobe 2.0 object (`collect`, `marketing` with `preferred`, `personalize.content`, `share`) loses most of it. The wrapper keeps only `collect` and `personalize.content`, turns them into the ADR-0007 vector, and the chamber rebuilds a bare `collect` body from that vector. This ADR sends the whole object to Alloy, as stock does, while the seal keeps deciding egress from the vector alone. One adapter-owned call derives the vector and carries the object, so the two cannot disagree. It is not a new ADR-0063 command, so the allowlist stays at five. The main tradeoff: the chamber is untrusted, so the full object is data it may send, never a signal the seal believes.

## Context

- Today's path: `adapters/eds/alloy-bridge.js` `setConsent` -> `consentToVector` (`collect` -> `analytics_storage`, `personalize.content` -> `personalization`) -> `handle.setConsent(vector)` -> the adapter updates its live consent ref (what the seal reads) and calls `core/wrapped-sdk-host.js` `setConsent`, which posts `{ type: "setConsent", consent: vector }` and re-runs parked requests -> the chamber's `applyConsent` -> `shapeAlloyBoot` -> `shapeAlloyConsent` -> `alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val } } }] })`.
- 064-21 (S10, recorded set-consent) found two differences in the set-consent request: the body lacks `marketing`, `personalize.content` and `share`, and the host is `adobedc.demdex.net` where stock with `edgeDomain` sends `edge.adobedc.net`. The body difference is this ADR. The host is a different cause (see "Host" below).
- ADR-0062 exception (a) (the consent hold) and its 2026-11-20 amendment (after an explicit refusal the seam forwards only the connector's declared opt-out, Alloy's `privacy/set-consent` with `collect: "n"`, keeping the `consent` and `meta` body keys) are the seal's consent rules. This ADR changes neither.
- ADR-0063 gave the site a command entry for five commands and said `setConsent` stays `handle.setConsent` and `configure` stays a boot option. Its allowlist needs the owner to change.
- The chamber is untrusted. The seal (`core/wrapped-sdk-host.js`) decides from the live consent ref it holds on the main thread, never from anything the chamber says.

## Decision Options Considered

### Where the full object travels

#### Option A: a new adapter-owned handle method and chamber message (recommended)
`handle.setAdobeConsent(consent)` on the `bootAlloy` handle. The adapter derives the vector from the object, posts the object to the chamber, then applies the vector to the seal in the same synchronous call (point 3). The alloy-bridge `setConsent` calls it instead of `handle.setConsent(vector)`.
- **Pros:** The adapter owns both halves of one call, so single source holds by construction. No ADR-0063 allowlist change. No `core/` change. A direct `handle.setConsent(vector)` caller is untouched.
- **Cons:** One more public handle method and one more worker message type.

#### Option B: a sixth ADR-0063 command (`setConsent`)
- **Pros:** One entry shape.
- **Cons:** ADR-0063 point 1 sends `setConsent` to `handle.setConsent` on purpose: a command that reaches Alloy without passing the seal's ordering would let the object act before the vector. It needs an owner-approved allowlist change and a consent-aware special case in a generic channel. Rejected.

#### Option C: widen `handle.setConsent(vector)` to take the object
- **Pros:** No new method.
- **Cons:** The vector is the host's vendor-neutral consent type (ADR-0007), shared with the GA4, Meta and Google tracks through the core host. Putting an Adobe object on it leaks a vendor shape into the shared surface and tempts a second source of truth. Rejected.

### Who derives the vector

#### Option A: the adapter derives it from the same object, inside the same call (recommended)
No caller-supplied vector alongside the object, so they cannot disagree.

#### Option B: the caller passes both
Rejected: a caller could pass `collect: "n"` next to a vector granting analytics. A test would have to guard what the type already could not allow.

## Recommended Decision

Adopt Option A in both tables. The mechanics:

1. **Single source.** `handle.setAdobeConsent(consent)` is the only place that turns an Adobe 2.0 object into a vector, using one function the bridge also exports (`consentToVector`). The Adobe entry is the one with `standard: "Adobe"` (any version, as today); the vector comes from it; `collect.val === "y"` gives `analytics_storage: "granted"`, anything else denied; `personalize.content` gives `personalization` the same way; a purpose the object omits is not in the vector. The method takes the object only, so there is no second argument to disagree with (a stray extra argument is ignored). The bridge's `setConsent` calls only this method, and falls back to `handle.setConsent(vector)` when the handle has no such method (a composite or another handle), so consent is never lost.
2. **When the whole object is sent.** The page's object goes to Alloy as given only when the adapter can read it with certainty: exactly one Adobe entry, it has `version: "2.0"`, it is the first entry of the array, it carries `collect` (an object whose `val` is exactly `"y"` or `"n"`), any `personalize.content` `val` is exactly `"y"` or `"n"`, and the whole object is plain JSON data (checked before anything is posted, as the chamber checks commands, so a function or Proxy cannot make `postMessage` throw and lose the consent). Any other shape (a TCF entry first, two Adobe entries, a version other than 2.0, no `collect`, a `val` such as `"yes"`, non-plain data) takes the vector-shaped fallback: the chamber drives Alloy from the vector as today, and the adapter emits a `consent-object-fallback` diagnostic; no `adobeConsent` message is posted on this path. The fallback keeps the 068 opt-out working (its match reads `consent[0].value.collect.val`) and means Alloy never holds an "in" state the seal's vector denies. Other entries after the first (for example TCF) travel with the object. An array with no Adobe entry carrying `collect` or `personalize.content` sends nothing and emits the existing `unsupported-consent` diagnostic (the bridge's `onDiagnostic`).
3. **Order, in one synchronous call.** With a live consent ref (when `consentRef` is null, a `consentHold:false` boot with no consent, `setAdobeConsent` does nothing, exactly as `handle.setConsent` does today), the adapter (a) posts `{ type: "adobeConsent", consent }` to the chamber, then (b) updates the live ref and calls the core host's `setConsent(vector)`, which posts the vector message and re-runs parked requests against the new ref. Messages to the worker arrive in order, and the main thread finishes the whole call before it handles any chamber fetch, so the seal holds the new vector before any request the object can cause. The chamber keeps the object from (a) and the very next vector message (b) uses it: `applyConsent` makes one Alloy `setConsent` call carrying the object in place of the shaped options, then drops it. A vector message that arrives with no waiting object (a direct `handle.setConsent`, a CMP `onChange`) drives Alloy from the shaped options as today, and an object that was not used is dropped after the next vector message either way.
4. **Held events are released by the vector only.** Parked requests are re-run by the core host's `setConsent(vector)`, as today. The object message neither changes the ref nor re-runs anything. If the chamber (untrusted) ignores or alters the object, the seal still decides each request from the ref.
5. **Pending and partial states.** The object is used only where today's shaped call would drive Alloy, that is, where `analytics_storage` resolves granted or denied (the chamber keeps its retained vector and calls the same `shapeAlloyBoot` mapping). Under a still-pending `analytics_storage` the chamber does not call Alloy and drops the object, so Alloy's native `defaultConsent: "pending"` queue keeps holding. An object with only `personalize.content` never reaches Alloy as an object (it has no `collect`, point 2): the vector-shaped fallback runs, so the opt-out match and the seal stay consistent. This differs from stock for that unusual call and is reported by the diagnostic.
   If Alloy rejects the object call, the chamber retries once with the vector-shaped options from `shapeAlloyBoot` and posts a diagnostic, so a grant still flushes Alloy's queue and a refusal is still recorded. Slice 064-33's expected-consent registration accepts both the object and the vector-shaped consent for such a call, so the retried refusal still forwards. A partial object (for example `collect` only, or with `marketing` or `share` left out) leaves the earlier purposes in the vector, because the ref is merged as today; Alloy receives only what the page sent, as stock does.
6. **The chamber cannot widen egress with the object.** The seal runs on every request the chamber makes, including the set-consent. Under an explicit refusal only the ADR-0062 amendment's opt-out leaves: the `consent` and `meta` keys of the `collect: "n"` set-consent. The full object sits inside `consent`, so it leaves as stock sends it. Known remaining risk: the seam forwards that `consent` subtree without comparing it to the object the page gave, so an untrusted chamber could put other data under it. That gap exists from 068-02 and this ADR does not widen the set of requests, but it now routes the page's richer object through it. Closing it needs a `core/` check and is owned by slice 064-33, which also names the unchecked `meta` key.
7. **Host.** The set-consent host difference is not caused by the consent path. Alloy 2.31.1 sends a request that uses the third-party identity domain to `adobedc.demdex.net` when `thirdPartyCookiesEnabled` is on (stock's default) and the browser supports third-party cookies by default, and to the configured edge domain otherwise. In S10 the first such request is the set-consent. The page sets the option to `false`; Airlock's boot has no such option today, so Alloy falls back to its default. This slice adds a boolean `thirdPartyCookiesEnabled` boot option that the adapter passes to Alloy's `configure` unchanged. It is a host option that mirrors the page's; the page's own `configure` value is not read (064-31 AC6 reports a conflict). Both `edge.adobedc.net` and `adobedc.demdex.net` are already in the endpoint ceiling and the tenant pin (`ALLOY_STOCK_ENDPOINTS`), so no egress allowlist changes and the seal's allowed hosts do not change. `idMigrationEnabled` stays with 064-31 AC1.
8. **Relation to ADR-0062 and ADR-0007.** The ADR-0007 vector stays the only consent input to the seal and to the chamber's boot and pending posture. Exception (a) is unchanged: the hold, the pending state and the 068 opt-out behave as before. A default boot (no `setConsent` call) takes the boot path, which this ADR does not touch.
9. **The promise.** Stock `setConsent` resolves after Alloy has accepted the consent. `setAdobeConsent` stays fire-and-forget like `handle.setConsent`. Settling with Alloy's own outcome is a separate difference, owned by 064-31 AC8.

### Relation to ADR-0063

`handle.command` and its five-command allowlist are unchanged. `setAdobeConsent` is not a command: it has no result, it must run in order with the seal update, and it is not allowed through the generic channel. ADR-0063's note that `setConsent` maps to `handle.setConsent` is refined for the wrapper only: the wrapper uses `handle.setAdobeConsent`.

### Relation to ADR-0061

The slice proves the body against the recorded S10 set-consent and the stock-vs-airlock differential with the exceptions removed (ADR-0061). The seal-wins and ordering behaviour are hermetic tests.

## Consequences

**Becomes easier:**
- A page using stock `setConsent` sends stock's body, including `marketing`, `share` and `personalize.content`, so Adobe's record matches the page's own.
- Consent can't silently diverge: one call produces the vector and the body.

**Becomes harder:**
- One more public handle method. A site that calls `handle.setConsent(vector)` directly still gets only the vector-shaped body (unchanged).
- The chamber has a second path into Alloy's `setConsent`. A reviewer must check it never reaches the seal as a signal.
- A page object the adapter cannot read with certainty (point 2) takes the vector-shaped body, so some unusual objects still differ from stock. Each is reported by a diagnostic.
- A composite or non-Alloy handle, and a direct `handle.setConsent(vector)` caller, keep the vector-shaped body.
- `consentToVector` now selects the Adobe entry by the rule in point 1 (first match as today; the object is sent only under point 2), and the `CONSENT_GAP` comment in `alloy-bridge.js` is updated.
- The opt-out forward still trusts the chamber's `consent` subtree (point 6, 064-33).

**Not changed:**
- `core/wrapped-sdk-host.js`, the ADR-0063 allowlist, the endpoint ceiling, the consent hold and the 068 opt-out.
- Shape of the consent object beyond Adobe 2.0: other standards are not forwarded alone (point 2).

## Open questions

None for the owner.
