/**
 * Egress confinement — the SHARED `core/` primitive both chambers apply
 * (spec 012-01 AC5, originally alloy-only at
 * `connectors/alloy/egress-confinement.js`; RELOCATED + EXTENDED to `core/`
 * by spec 016-01 so the GA4 chamber can apply the same posture).
 *
 * ALLOW-LIST posture, not a (never-complete) enumerated deny-list: withhold
 * every ambient network primitive a classic/module Worker retains (XHR,
 * WebSocket, EventSource, WebTransport, nested Worker, CacheStorage,
 * `navigator.sendBeacon`), each made ABSENT or a THROWING STUB in the target
 * scope, so code running in the chamber post-boot cannot reach the network by
 * any of those paths.
 *
 * `fetch` is the ONE primitive whose disposition depends on the connector
 * archetype (016-01 finding) — the two chambers need OPPOSITE outcomes:
 *   - alloy (wrapped-SDK, default `opts.withholdFetch` falsy): `fetch` IS the
 *     mediated surface (the chamber's intercepted-fetch shim posts to main —
 *     `connectors/alloy/alloy-chamber.worker.js`), so it is PRESERVED — the
 *     chamber's sole surviving network-capable path. `record.fetchPreserved`
 *     is the success signal, unchanged from spec 012-01.
 *   - GA4 (wire-protocol, `opts.withholdFetch: true`): `fetch` is NOT
 *     mediated — GA4's egress is the `ready` postMessage
 *     (`core/connector-host.js`'s `routeBatch` return value) — so `fetch` is
 *     WITHHELD too, and the success signal is the INVERSE:
 *     `record.fetchWithheld === true` / `record.fetchPreserved === false`.
 *     Reporting `fetchPreserved: true` for GA4 would be a silently wrong
 *     signal (alloy's invariant is not GA4's), so withholdFetch mode never
 *     sets it.
 *
 * This is egress CONFINEMENT at the chamber boundary — distinct from the
 * seal's consent/allow-list ENFORCEMENT on the mediated path (MVP3's
 * `core/endpoint-ceiling.js`, spec 016-01) or the outbound-destination pin
 * (`core/config-integrity.js`, spec 015-01).
 *
 * Pure + deterministic (operates on a passed-in scope object, no `self`/DOM at
 * module top level) so it is directly unit-testable in Node against a fake
 * global scope. The alloy chamber worker applies it to `self` right after the
 * stock bundle loads (at the same point importScripts is revoked), so alloy's
 * own configure + sendEvent run UNDER confinement — proving the allow-list did
 * not break alloy (R-004: alloy uses only `fetch`). The GA4 chamber applies it
 * (withholdFetch mode) via `core/confine-ga4-chamber.js`, imported FIRST by
 * `core/chamber.worker.js` — BEFORE the connector modules evaluate, closing
 * the top-level `const f = self.fetch`-capture bypass a body/init-time call
 * would leave open (016-01; see that module's header for the ES-module
 * post-order argument).
 *
 * DELIBERATELY NOT here: dynamic `import()` of a remote specifier. That is a
 * language-level loader primitive a JS shim cannot reliably withhold — the
 * DISCLOSED residual (spec 012-01 AC5; named again for GA4 by 016-01). The
 * adversarial rig probes it at runtime and records the outcome honestly; it
 * is gated by MVP3 seal enforcement (and a worker `connect-src` CSP where the
 * host controls response headers).
 */

export const CONFINEMENT_MESSAGE =
  "withheld in the chamber — the mediated fetch is the chamber's sole network-capable surface (egress confinement, spec 012-01 AC5)";

// The ambient network-capable CONSTRUCTORS withheld. `fetch` is deliberately
// NOT here: it is the allow-listed, mediated surface. `importScripts` is
// revoked by the chamber's own boot path (not this pure function).
//   - XMLHttpRequest : classic request egress
//   - WebSocket      : constructing one immediately opens a socket
//   - EventSource    : constructing one immediately opens a stream
//   - WebTransport   : constructing one immediately opens a transport
//   - Worker         : a nested dedicated Worker (a fresh, un-confined scope)
export const WITHHELD_NETWORK_CONSTRUCTORS = [
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "WebTransport",
  "Worker",
];

function withheldError(name) {
  return new Error(name + " is " + CONFINEMENT_MESSAGE);
}

// A throwing stub usable as a constructor: `new stub()` throws before it can
// return an instance, so the primitive is not a working network path.
function throwingConstructor(name) {
  return function airlockWithheld() {
    throw withheldError(name);
  };
}

// A CacheStorage-shaped stub whose every method throws. `caches.open(...)` is
// the gateway to a Cache (whose `add`/`addAll` fetch+store a URL — network
// egress); denying `open` closes that path. `add`/`addAll` are stubbed too so
// the whole surface named by AC5 is inert.
function throwingCacheStorage() {
  const deny = (op) => () => { throw withheldError("caches." + op); };
  return {
    open: deny("open"),
    match: deny("match"),
    has: deny("has"),
    delete: deny("delete"),
    keys: deny("keys"),
    add: deny("add"),
    addAll: deny("addAll"),
  };
}

// Force `target[name] = value` even when `name` is a setter-less accessor on
// the prototype (e.g. `caches` on WorkerGlobalScope). Returns HOW it was
// applied, for the confinement record. Order: plain assignment (works for the
// writable interface-object globals like XMLHttpRequest), then an own
// data-property that shadows a prototype accessor, then a best-effort delete.
function forceProp(target, name, value) {
  try {
    target[name] = value;
    if (target[name] === value) return "assigned";
  } catch (e) { /* strict-mode setter-less accessor throws — fall through */ }
  try {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
    return "defined";
  } catch (e) { /* non-configurable — fall through */ }
  try {
    delete target[name];
    return "deleted";
  } catch (e) { /* sealed — nothing more we can do */ }
  return "failed";
}

/**
 * Neutralize `navigator.sendBeacon` on the given navigator object, replacing it
 * with a throwing stub. `sendBeacon` is a fire-and-forget network egress path;
 * the allow-list withholds it. (In a Worker the REAL `WorkerNavigator` has no
 * `sendBeacon`, but the page-shim navigator alloy is handed does expose one —
 * both are neutralized by calling this on each.)
 * @param {object} navigator
 * @returns {"assigned"|"defined"|"deleted"|"failed"|"no-navigator"}
 */
export function denySendBeacon(navigator) {
  if (!navigator || typeof navigator !== "object") return "no-navigator";
  const stub = function airlockWithheld() {
    throw withheldError("navigator.sendBeacon");
  };
  return forceProp(navigator, "sendBeacon", stub);
}

/**
 * Apply egress confinement to a (worker-global-like) scope: withhold every
 * ambient network primitive. Idempotent and side-effect-scoped to `scope`
 * (+ `scope.navigator`).
 *
 * `fetch` handling depends on `opts.withholdFetch` (016-01):
 *   - default (falsy) — UNCHANGED spec-012-01 alloy behavior: `fetch` is
 *     PRESERVED (the chamber's sole surviving network-capable surface).
 *   - `true` — GA4's inverse: `fetch` is ALSO replaced with a throwing stub.
 *     `record.fetchPreserved` is never reported `true` in this mode (that
 *     success signal is alloy's, and reporting it here would silently invert
 *     its meaning); the success signal is `record.fetchWithheld`.
 *
 * @param {Record<string, unknown> & { navigator?: object, fetch?: unknown }} scope
 * @param {{ withholdFetch?: boolean }} [opts] `withholdFetch:true` also
 *   withholds `fetch` itself (GA4 — its egress is the `ready` postMessage,
 *   not a mediated fetch); omitted/falsy preserves `fetch` (alloy, unchanged).
 * @returns {{
 *   withheld: Record<string, string>,
 *   caches: string,
 *   sendBeacon: string,
 *   fetchPreserved: boolean,
 *   fetchWithheld: boolean,
 *   message: string,
 * }} a record of what was withheld and how (surfaced for the AC5/016-01 assertions).
 */
export function applyEgressConfinement(scope, opts = {}) {
  const withholdFetch = opts.withholdFetch === true;
  const fetchBefore = scope.fetch;
  const record = {
    withheld: {},
    caches: null,
    sendBeacon: null,
    fetchPreserved: false,
    fetchWithheld: false,
    message: CONFINEMENT_MESSAGE,
  };
  for (const name of WITHHELD_NETWORK_CONSTRUCTORS) {
    record.withheld[name] = forceProp(scope, name, throwingConstructor(name));
  }
  record.caches = forceProp(scope, "caches", throwingCacheStorage());
  record.sendBeacon = scope.navigator ? denySendBeacon(scope.navigator) : "no-navigator";
  if (withholdFetch) {
    // GA4 (016-01): fetch is NOT the mediated surface here — withhold it too,
    // same throwing-stub mechanism as the other constructors. Never report
    // `fetchPreserved: true` in this mode — that is alloy's inverted signal.
    forceProp(scope, "fetch", throwingConstructor("fetch"));
    record.fetchPreserved = false;
    record.fetchWithheld = typeof scope.fetch === "function";
  } else {
    // Allow-list invariant (alloy, unchanged): the mediated `fetch` is
    // UNTOUCHED — it stays the chamber's sole network-capable surface. A
    // regression that clobbered it (or that this function overreached into)
    // trips `fetchPreserved: false`.
    record.fetchPreserved = typeof scope.fetch === "function" && scope.fetch === fetchBefore;
    record.fetchWithheld = false;
  }
  return record;
}
