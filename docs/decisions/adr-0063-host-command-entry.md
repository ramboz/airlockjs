---
status: Accepted
dependencies: [ADR-0060, ADR-0061, ADR-0062, 064-19, 064-20]
last_verified: 2026-11-20
frame_review: true
---

# ADR-0063: Host command entry for the Alloy chamber

## Status

Accepted (2026-11-20). The owner answered the allowlist question: "Yes, accept with the five commands, leave evaluateRulesets out (Recommended)". `evaluateRulesets` stays out and rig-reachable only.

The owner had approved writing this ADR and slice 064-26 before 064-21 starts ("Yes, add a command entry (ADR + slice) before 064-21 (Recommended)", 2026-11-20).

## Summary

Before this change a site could not call `getIdentity`, `appendIdentityToUrl`, `applyResponse`, `getLibraryInfo` or `createEventMergeId`. They run inside the Alloy chamber, but only the test rig can reach them. This ADR adds one method to the `bootAlloy` handle: `handle.command(name, options)`. It returns a promise and accepts only a fixed list of five commands. Options and results are plain data. Nothing else changes: `sendEvent` still goes through `push`, consent still goes through `setConsent`, and the consent hold and seal apply as they do today. The main tradeoff: this is a new, permanent public surface, so the list is kept small and each entry needs stock-vs-airlock evidence. The owner answered the one question: `evaluateRulesets` stays out (see Status).

## Context

- Before this ADR, the handle returned by `bootAlloy` (adapters/eds/index.js) exposes `push`, `pushCritical`, `setConsent`, `getState`, `stats`, `dispose`, plus the 064-20 `applyPropositions` and `subscribeRulesetItems`. The production chamber worker accepts only `init`, `event`, `stock-context`, `setConsent`, `intercepted-fetch-response` and `probe-egress` messages (connectors/alloy/alloy-chamber.worker.js). It has no way to run a named Alloy command. The rig adds one (`rig-command`, rig/b1-chamber-entry.js) and exists only in tests.
- 064-19 proved rows 4 to 7 and 9 of the command matrix in the chamber and carried the gap as H1: those rows are chamber facts, not site-callable parity. 064-21 (`aem-martech`, ACDL, Launch) cannot claim a drop-in or wrapper decision without a site-callable path. The 064-20 notes add that `evaluateRulesets` stays rig-reachable only.
- ADR-0060 (Proposed) asks for a governed command and result bridge and recommends declared commands with host-side adapters (its Option A), and rejects a generic proxy (its Option B). It deliberately did not pick an envelope. ADR-0061 and ADR-0062 make stock behaviour the default with Airlock controls on top.
- Stock `alloy("cmd", options)` returns a promise. Stock Alloy validates options and rejects with its own errors.

## Decision Options Considered

### Allowlist

#### Option A: The five commands (recommended)
`getIdentity`, `appendIdentityToUrl`, `applyResponse`, `getLibraryInfo`, `createEventMergeId`.
- **Pros:** Exactly the H1 gap. Each command is already worker-native and proven in 064-19. Each takes and returns plain data. No function crosses the boundary. Small enough to review per entry.
- **Cons:** A site needing another command waits for a follow-up entry.

#### Option B: The five plus `evaluateRulesets` (the named owner option)
- **Pros:** A site could trigger rule evaluation itself.
- **Cons:** It is not just a read. It evaluates rulesets, then triggers delivery and rendering of the results, and it is meant to feed `subscribeRulesetItems`, whose callback is incompatible as a function (064-19 AC2) and is mediated as data instead (064-20). Exposing it means deciding who owns that delivery and render ordering for a site-triggered evaluation, and no adopter flow cited so far needs it. Adding it later is one allowlist entry plus one acceptance criterion.

#### Option C: A generic pass-through of any Alloy command
- **Pros:** Looks most like stock.
- **Cons:** This is ADR-0060's rejected Option B. It would also expose `sendEvent`, `setConsent` and `configure` around the seal and the config pin. Rejected.

### Entry shape (local decision, no owner input needed)

`handle.command(name, options)` returning a promise, not one method per command and not a `window.alloy` global.
- A single method means the handle does not grow when the list grows, and the allowlist lives in one place.
- Per-command methods give typo safety but widen the public surface for every addition.
- A global `alloy` on the page would be an ambient authority the airlock is built to avoid (ADR-0062 point 2's boundary reasoning). A site or the 064-21 wrapper that wants `alloy(cmd, opts)` can map it to `handle.command` in its own code.

## Recommended Decision

Adopt Option A with the single-method entry. The mechanics:

1. **Allowlist, enforced twice.** The handle checks the name against the five before posting anything. The chamber worker checks it again on receipt and runs only those five. Any other name rejects with a plain `Error` and never reaches Alloy. Names that stock has but the list excludes get a pointer in the message (`sendEvent` -> `push`, `setConsent` -> `handle.setConsent`, `configure` -> boot options).
2. **Data only across the boundary.** `options` and results must be structured-clone-safe plain data: no function, symbol, DOM node or class instance. A violation in `options` rejects immediately on the main thread with a plain `Error`, before any message is sent (064-19 AC2: functions cannot cross, and Airlock says so instead of dropping them). Results come back as data and are rebuilt on the main thread; no handle, proxy or function comes back. Errors cross as an envelope `{ name, message, code }` (clone drops custom properties, so `code` is copied explicitly) and the main thread rebuilds a plain `Error` carrying them. An Alloy-raised error keeps its own name, message and `code`; if Alloy's own error is a `TypeError` it is rebuilt as a plain `Error` with the original name in the envelope, so a `TypeError` never reaches a caller as such.
3. **Stock promise semantics.** The call returns a promise that resolves with the shape stock resolves with (`getIdentity` -> `{ identity: { ECID }, edge: { regionId } }`, `appendIdentityToUrl` -> `{ url }`, `getLibraryInfo` -> `{ libraryInfo }`, `createEventMergeId` -> `{ eventMergeId }`, `applyResponse` -> the stock result). Options reach stock Alloy as given (except `renderDecisions`, point 5), so Alloy's own validation errors are what the site sees. Airlock does not re-validate options. Calls are dispatched to the chamber in call order and settle independently: a parked `getIdentity` never blocks a later `getLibraryInfo`. A call made before the chamber is ready waits for boot. Each call has its own id. Differences from a page with stock Alloy, all deliberate: the entry is `handle.command`, not a `window.alloy` global; `getLibraryInfo().libraryInfo.commands` lists commands that `handle.command` refuses; and the ADR-0062 consent hold (point 4).
4. **Consent and seal behaviour.** The chamber is the authority. Alloy's own consent state decides what each command does, and the host adds no second consent check. The worker boots Alloy with `defaultConsent: "pending"` under a pending page vector, drives `setConsent` for granted or denied, and leaves Alloy's default when no consent input is wired (alloy-chamber.worker.js, `shapeAlloyBoot`). The command outcome follows from that, so the slice records it per command and per state from pinned stock 2.31.1 (not assumed here):
   - **pending, denied, granted:** Alloy decides, exactly as on a stock page with the same `defaultConsent` / `setConsent`. A command that stock holds until consent resolves stays pending. A command that stock rejects with a declined-consent error rejects with the same error. A command that stock resolves resolves. Airlock changes none of this.
   - **seal and egress:** a command that makes Alloy send a request (an identity acquire) goes through the seal like any request. The seal's rejection goes to Alloy's fetch (status 0, plain `Error`), and Alloy turns that into its own command outcome. The command promise never receives the seal's error directly. The 068-01 seam park applies where Alloy believes it may send but the page is not granted (a stale `in` consent cookie, or no consent input wired): the request parks and the command stays pending until grant. There is no host-side timeout on a parked command, so on a site with no consent input a parked `getIdentity` stays pending (with the existing no-consent-input warning). A bounded wait is a follow-up if the owner wants one.
   - Every rejection Airlock itself raises (unknown command, bad options, disposed handle, per-call `renderDecisions` conflict, chamber loss) is a plain `Error`, never a `TypeError` (064-18 contract).
   - The ADR-0062 exception (a) hold is the one consent-related difference from stock: a site with no consent setup may hold where stock (`defaultConsent: "in"`) resolves. It is a documented difference, not a parity failure (ADR-0062 point 5). A comparison supplies a consent state matching the recording.
5. **`applyResponse`, the 064-20 renderer and `renderDecisions`.** Stock Alloy has no boot-level `renderDecisions`; it is a per-command option that defaults to false. The chamber always runs `applyResponse` headless (`renderDecisions: false`) and returns the stock result, whose propositions are data. If the caller passed `renderDecisions: true`, the host then renders those result propositions with the 064-20 renderer on the main thread (the same path as `handle.applyPropositions`), rewrites the render fields of the returned propositions (`renderAttempted`) from the renderer's output, and resolves only after rendering finishes. If the caller omitted it or passed false, nothing renders, as stock. The boot-level `renderDecisions` option affects only the automatic `sendEvent` path (064-20) and is not consulted here. The renderer exists on every `bootAlloy` boot, whether or not personalization is configured. `applyResponse` without rendering sends nothing (064-19 row 4). With rendering, whether stock also sends a display notification is pinned by the differential; any difference is reported in the slice notes as a gap, and the notification path is the 064-20 one (the site reports displays with `push`, as with `applyPropositions`). This is a deliberate fidelity trade: no tagging of decision deliveries, one render owner.
6. **Unknown, malformed and late calls.** A non-string or empty name, an unlisted name or non-plain `options` rejects with a plain `Error` and sends nothing. A call after `dispose()` rejects with a plain `Error`. If the chamber is lost (worker `error`, or `fatal` with `phase: "load"`), every in-flight and waiting call rejects with a plain `Error`. If `configure` fails, calls waiting for boot reject with a plain `Error` that names the configure failure. A `fatal` for a single failed `sendEvent` does not reject commands. Late results for a settled id are ignored.
7. **No new ambient authority.** The entry gives a site nothing the chamber did not already do and no new capability grant. It adds no DOM, network, storage or global access to the chamber. The path is `handle.command` -> worker `command` message -> Alloy -> `command-result` message, and any egress still passes the seal.

### Relation to ADR-0060, ADR-0061 and ADR-0062

- ADR-0060 stays Proposed. This ADR answers one of its open questions (which host observations must complete before an SDK call settles) for `applyResponse` only: it settles after rendering when rendering was requested. The one-instance evidence ADR-0060 wants is covered by the slice (one chamber, one Alloy instance, concurrent calls share it). This ADR is a narrow, separately accepted instance of its Option A for five commands. It picks an envelope (`command` and `command-result` worker messages, an id per call) for these five only. ADR-0060's open questions for the other commands (callbacks, streaming, host observations that must complete before an SDK call settles) stay open and are not decided here. Nothing here contradicts its recommendation or its kill criteria: no function crosses, no SDK fork, and no unrestricted page access.
- ADR-0061: each allowlisted command needs a recorded-fixture or labelled SYNTHETIC stock-vs-airlock comparison before it counts as parity. The handle method itself is not parity evidence.
- ADR-0062: stock behaviour is the default. The entry returns stock result shapes and stock Alloy errors. The consent hold (exception (a)) is the only intended difference.
- Branch: the entry lives with the Alloy connector on `vendor-adobe`. The shared core host (`core/wrapped-sdk-host.js`) ignores unknown message types and keeps its configure latch private, so the Alloy adapter adds its own `command-result` listener and its own ready latch; the core host and other tracks' handles do not change.

## Consequences

**Becomes easier:**
- 064-21 can make a real drop-in, wrapper or not-viable call for `aem-martech` and ACDL, because a site can reach identity and library calls.
- Rows 4 to 7 and 9 can be cited as site-callable, with the stock comparison behind them.

**Becomes harder:**
- A new public method must be kept stable. Each later command (including `evaluateRulesets`) needs its own evidence.
- The chamber worker gains a message type, which widens its input surface by one validated message.

## Assumptions

- The five commands' options and results are plain data. 064-19 showed this for the recorded cases.
- Alloy's own validation is a sufficient first line for option shape.

## Kill criteria

- A listed command needs a function, a DOM reference or ambient page state to behave like stock.
- A seal rejection cannot be carried back as a plain `Error` without turning into a `TypeError` somewhere on the path.
- The comparison shows a default site gets a different result than stock for a reason other than the ADR-0062 hold and the differences listed in point 3.

## Owner answer (2026-11-20)

Question: does `evaluateRulesets` join the allowlist? Recommended: no. Owner: "Yes, accept with the five commands, leave evaluateRulesets out (Recommended)". Adding it later is one allowlist entry plus one criterion, with its own comparison.

## Implementation notes (064-26, 2026-11-20)

- A `fatal{phase:"post-load"}` from the worker (a boot failure after the bundle loaded) is treated as chamber loss, like `load`: no command can run in that chamber.
- Results cross as JSON-normalised data (`undefined` keys dropped, Dates become strings). Alloy's results are plain JSON, so stock results are unchanged.
- An error is rebuilt as a plain `Error` with the envelope's `message`, `code` (string or number only) and, for an Alloy `TypeError`, `name` kept as `"Error"` with the original name on `error.alloyName`. Other names (for example `"Error"` or a custom Alloy name) are kept as `name`.
- Option validation accepts plain data (including `undefined` values and non-finite numbers) and is stricter than structured clone: it also refuses bigints, class instances and circular references, besides functions, symbols and DOM nodes.
- `applyResponse` with `renderDecisions:true` passes no `metadata` to the renderer; the display notification gap is the one `applyPropositions` already has (064-24/25).
- A render failure rejects the call with a plain `Error` that names rendering; after `dispose` the render step is skipped.
- The ADR-0060 open question "which host observations must complete before an SDK operation settles" is answered here for `applyResponse` only; ADR-0060 stays Proposed.
- A `push` enqueued while an `applyResponse` is in flight waits for it before it is sent (stock runs its commands in order, 064-29); a redirect display that `applyResponse` queues was sent first (superseded by 064-32 round 5, next line). Other commands do not gate a push.
- Whether a push sees the cache an `applyResponse` filled is decided by call order, not by timing: a push called before the apply runs cold even if the apply finishes first (for the host cache and the declared scopes), one called after runs warm (064-32). A push called behind an in-flight apply waits only for that apply's cache warm, not for its render or redirect display, so it can reach the wire before the redirect display, as stock does when the apply is not awaited (064-32 round 5, an amendment of the 064-29 gate). An earlier `applyResponse` spends the declared placement scopes, so the first push after it carries none of them, as in stock.
- The no-consent-input warning now also fires when `command("getIdentity")` is called, so a page that only uses commands gets the same warning a `push` raises. Calls to the other four commands do not warn: they settle under a hold.
- Recorded against stock for `applyResponse({renderDecisions: true})`: stock also sends a display notification and drops rendered propositions from `decisions`; the handle does neither (slice 064-26 notes).
