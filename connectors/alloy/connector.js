import { extractDecisions, VIEW_SCOPE } from "./decisions.js";

/**
 * Alloy's default `context` list: the groups stock `@adobe/alloy@2.31.1` collects
 * (ADR-0062 point 2, spec 067-08). The chamber fills them from the 067-07 stock-context
 * channel. A site narrows the list with the `context` option; it never needs to widen it.
 */
export const ALLOY_DEFAULT_CONTEXT = Object.freeze(["web", "device", "environment", "placeContext"]);

/**
 * The one Adobe Edge host alloy is known to egress to — the `interact` endpoint,
 * observed by R-004 and the executed 012-01 chamber probe
 * (`https://adobedc.demdex.net/ee/v1/interact`). Declared as an ADVISORY endpoint
 * (ADR-0006 — the host-owned allow-list wins; a connector cannot widen it).
 *
 * A FLOOR, NOT A COMPLETE MAP for this wrapped-SDK CDP: alloy also fires
 * SERVER-DIRECTED ID-sync / demdex URLs the Edge *response* returns at runtime
 * (ADR-0006 kill-criterion / ADR-0008 / R-004 open question), which a static
 * up-front declaration cannot enumerate. That breadth is creds-gated to MVP3's
 * live-Alloy Risk-First probe — see slice-04 Findings (egress-breadth axis).
 */
export const ALLOY_INTERACT_ENDPOINT = "https://adobedc.demdex.net/ee/v1/interact";

/**
 * 064-18 (spec 064 s2.2 Network, ADR-0062): every destination stock Alloy 2.31.1 posts to
 * in the frozen capture (plus the hint-less `collect`, derived from the source: 064-24), as a seam endpoint ceiling. The Adobe domain serves the first page
 * view and `identity/acquire`; the edge domain serves everything after the location hint is
 * known, as `/ee/<hint>/v1/...` (`{hint}` is one path segment, see core/endpoint-ceiling.js),
 * plus the hint-less `privacy/set-consent` and, for a documentUnloading event sent before any hint is
 * known (064-24), the hint-less `collect`. A first-party edge domain adds the same paths on the
 * site's own host (`allowlistForEdgeDomain`), host-owned, never chamber-supplied.
 */
export const ALLOY_STOCK_ENDPOINTS = Object.freeze([
  ALLOY_INTERACT_ENDPOINT,
  "https://adobedc.demdex.net/ee/v1/identity/acquire",
  "https://adobedc.demdex.net/ee/v1/privacy/set-consent",
  "https://edge.adobedc.net/ee/v1/interact",
  "https://edge.adobedc.net/ee/v1/collect",
  "https://edge.adobedc.net/ee/v1/privacy/set-consent",
  "https://edge.adobedc.net/ee/{hint}/v1/interact",
  "https://edge.adobedc.net/ee/{hint}/v1/collect",
  "https://edge.adobedc.net/ee/{hint}/v1/identity/acquire",
  "https://edge.adobedc.net/ee/{hint}/v1/privacy/set-consent",
]);

/**
 * The same destination shapes on a site's first-party edge domain (`edgeDomain` config).
 * @param {string} edgeDomain a bare host such as `data.example.com`
 * @returns {string[]}
 */
export function allowlistForEdgeDomain(edgeDomain) {
  const host = String(edgeDomain || "").trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) {
    throw new TypeError("edgeDomain must be a bare host name (no scheme, path or port)");
  }
  return [
    `https://${host}/ee/v1/interact`,
    `https://${host}/ee/v1/identity/acquire`,
    `https://${host}/ee/v1/collect`,
    `https://${host}/ee/v1/privacy/set-consent`,
    `https://${host}/ee/{hint}/v1/interact`,
    `https://${host}/ee/{hint}/v1/collect`,
    `https://${host}/ee/{hint}/v1/identity/acquire`,
    `https://${host}/ee/{hint}/v1/privacy/set-consent`,
  ];
}

/**
 * 064-18 (spec 064 s2.2 Response handling, AC4): the `handle[].type` values the response
 * parser may see. The 8 the connector consumes are listed in s2.2; the two extras were
 * observed in the frozen corpus and are ignored by design (`locationHint:result` is read via
 * the cluster cookie, `consent:preferences` is the set-consent acknowledgement). A type
 * outside this list raises a visible `unknown-handle` diagnostic at the seam.
 */
export const ALLOY_CONSUMED_HANDLE_TYPES = Object.freeze([
  "state:store",
  "identity:result",
  "identity:exchange",
  "personalization:decisions",
  "activation:push",
  "activation:pull",
  "media-analytics:new-session",
  "brand-concierge:conversation",
]);
export const ALLOY_IGNORED_HANDLE_TYPES = Object.freeze(["locationHint:result", "consent:preferences"]);
export const ALLOY_KNOWN_HANDLE_TYPES = Object.freeze([...ALLOY_CONSUMED_HANDLE_TYPES, ...ALLOY_IGNORED_HANDLE_TYPES]);

/**
 * Alloy's declared cookie names — the SAME set the manifest's
 * `capabilities.cookies` (below) declares, hoisted to a static, module-level
 * export (spec 035-01 AC3) so it is ONE source of truth. Before this slice
 * the declared set lived ONLY inline in the manifest, which is instantiated
 * exclusively inside the worker (`createAlloyConnector`, used by
 * `alloy-chamber.worker.js`) — unreachable from the main thread. The
 * host-side enforcement seams (the READ boot-seed filter, `adapters/eds/index.js`'s
 * `bootAlloy`; the WRITE write-back scope, `core/wrapped-sdk-host.js`) both
 * import THIS export, so they can never drift from what the manifest actually
 * declares. Mirrors `ALLOY_INTERACT_ENDPOINT` immediately above.
 *
 * Mixed exact + PREFIX (R-004-grounded, no separate marker in
 * `CapabilityRequest.cookies: readonly string[]` — `contracts/capability.d.ts`):
 * `kndctr_`/`AMCV_` are prefixes (the real name carries a dynamic per-org/per-
 * property suffix); `com.adobe.alloy.getTld`/`demdex`/`s_ecid` are exact. The
 * ratified exact-vs-prefix convention (`core/cookie-scope.js`'s
 * `matchesGrantedName`) is: a trailing `_` is a prefix marker, everything else
 * is exact.
 */
export const ALLOY_COOKIE_NAMES = ["com.adobe.alloy.getTld", "kndctr_", "AMCV_", "demdex", "s_ecid"];

/**
 * Alloy's per-cookie consent purposes (ADR-0007 annotation), hoisted so the host-side
 * write-back seam (spec 067-05 AC4) and the manifest read ONE table. Keys are the
 * `ALLOY_COOKIE_NAMES` entries.
 */
export const ALLOY_COOKIE_PURPOSES = Object.freeze({
  // apex-domain probe cookie — functional infrastructure, no data use.
  "com.adobe.alloy.getTld": ["functional"],
  // Adobe Edge consent/identity + Visitor ECID — a SHARED identity serving
  // BOTH analytics and personalization (ADR-0007: one I/O, several purposes).
  "kndctr_": ["analytics_storage", "personalization"],
  "AMCV_": ["analytics_storage", "personalization"],
  // third-party Audience Manager sync — ad/identity (server-directed; MVP3).
  "demdex": ["ad_storage"],
  // Analytics ECID mirror.
  "s_ecid": ["analytics_storage"],
});

/**
 * Alloy's stock localStorage/sessionStorage set (spec 067-12, grounded by 064-27), shape
 * `{ localStorage?, sessionStorage? }` of exact keys. Stock Alloy 2.31.1 names every key
 * `com.adobe.alloy.` + a per-component namespace (`utils/injectStorage.js`), and the prefix rule
 * (a trailing `_`) cannot express keys that END in a version, so every entry is exact. What the
 * chamber's default configuration writes, and nothing else:
 *  - localStorage `validation.clientId`: the Assurance client id, created when `adb_validation_sessionid` is
 *    on the URL (`utils/request/createGetAssuranceValidationTokenParams.js`). Source-derived.
 *  - sessionStorage `instance.alloy.debug`: the debug flag, written when the `alloy_debug` URL parameter is
 *    present (`core/createLogController.js`; the bundle's default instance name is `alloy`). Source-derived.
 *  - the org-scoped localStorage consent hashes: see `alloyStorageGrant`.
 * Not granted because the stock default never writes them: `<org>.decisioning.events` (needs
 * `personalizationStorageEnabled`, not exposed), `<org>clickData` (needs `clickCollection.sessionStorageEnabled`,
 * and clicks are collected on the main thread, never in the chamber) and `<org>.pushNotifications.*`
 * (push is incompatible, 064-22). `ALLOY_STORAGE_PURPOSES` is the matching
 * `{ [area]: { [entry]: purposes } }` table for the consent write denial.
 */
const ALLOY_STORAGE_NAMESPACE = "com.adobe.alloy.";
const FUNCTIONAL = Object.freeze(["functional"]);
export const ALLOY_STORAGE_NAMES = Object.freeze({
  localStorage: Object.freeze([`${ALLOY_STORAGE_NAMESPACE}validation.clientId`]),
  sessionStorage: Object.freeze([`${ALLOY_STORAGE_NAMESPACE}instance.alloy.debug`]),
});
// Identifiers for tooling and consent bookkeeping, not analytics or personalization data: functional.
export const ALLOY_STORAGE_PURPOSES = Object.freeze({
  localStorage: Object.freeze({ [`${ALLOY_STORAGE_NAMESPACE}validation.clientId`]: FUNCTIONAL }),
  sessionStorage: Object.freeze({ [`${ALLOY_STORAGE_NAMESPACE}instance.alloy.debug`]: FUNCTIONAL }),
});

/**
 * The full stock storage grant for one org: `ALLOY_STORAGE_NAMES` plus the consent-hash keys
 * `com.adobe.alloy.<org>.consentHashes.Adobe.2.0` (org `@` becomes `_`, as stock's
 * `sanitizeOrgIdForCookieName`), the one standard the chamber's consent driver sends (CAP-corpus-verified).
 * Other standards (e.g. TCF) are not granted until a consent path sends them. Consent hashes are functional:
 * stock writes them under any consent state, they only record what was sent.
 * @param {string} [orgId]
 * @returns {{ names: object, purposes: object }}
 */
export function alloyStorageGrant(orgId) {
  if (typeof orgId !== "string" || !orgId) return { names: ALLOY_STORAGE_NAMES, purposes: ALLOY_STORAGE_PURPOSES };
  const local = [...ALLOY_STORAGE_NAMES.localStorage, `${ALLOY_STORAGE_NAMESPACE}${orgId.replace("@", "_")}.consentHashes.Adobe.2.0`];
  return {
    names: Object.freeze({ localStorage: Object.freeze(local), sessionStorage: ALLOY_STORAGE_NAMES.sessionStorage }),
    purposes: Object.freeze({
      localStorage: Object.freeze(Object.fromEntries(local.map((k) => [k, ALLOY_STORAGE_PURPOSES.localStorage[k] || FUNCTIONAL]))),
      sessionStorage: ALLOY_STORAGE_PURPOSES.sessionStorage,
    }),
  };
}

/**
 * alloy's declared vocabulary — the SINGLE SOURCE OF TRUTH the manifest below AND the
 * `adapters/eds/index.js` boot/composite-fan-out consume (imported, not hand-mirrored), mirroring
 * `ALLOY_COOKIE_NAMES`'s own "SAME array reference so the two can never drift" discipline (035-01 AC3).
 * Frozen so the shared reference cannot be mutated by either consumer. `events` is the one Analytics
 * pageView the composite fans to alloy; `egressPurposes` is the analytics_storage+personalization pair
 * the seal gates on. Retiring the adapter's prior hand-maintained mirror consts.
 */
export const ALLOY_EVENTS = Object.freeze(["page_view"]);
export const ALLOY_EGRESS_PURPOSES = Object.freeze(["analytics_storage", "personalization"]);

/**
 * 068-02 (ADR-0062 amendment, owner decision 2026-11-20): the one request the seam forwards after an
 * explicit refusal, so Adobe records it. Alloy's `privacy/set-consent` with `collect: "n"`; only the
 * `consent` and `meta` body keys leave, so the ECID `query.identity.fetch` stock Alloy adds is removed.
 * Core reads this declaration and knows nothing about Alloy's request shape.
 */
export const ALLOY_CONSENT_OPT_OUT = Object.freeze({
  path: "/privacy/set-consent",
  match: Object.freeze({ path: Object.freeze(["consent", 0, "value", "collect", "val"]), equals: "n" }),
  forward: Object.freeze(["consent", "meta"]),
});

/**
 * Alloy wrapped-SDK connector — spec 012-01.
 *
 * The wrapped-SDK archetype (contracts/connector.d.ts): a ConnectorFactory
 * `config -> { manifest, init, handle }`, hosted by createConnectorHost exactly
 * like the GA4 wire-protocol connector (AC1). Instantiated ONCE per chamber, so
 * alloy's own identity/session state persists across events (the host retains
 * the instance).
 *
 * Per R-004, the command mapping is:
 *   - init(caps) -> alloy `configure({ datastreamId, orgId, context })` (context defaults to
 *     ALLOY_DEFAULT_CONTEXT, the stock list, ADR-0062)
 *   - handle(event) -> alloy `sendEvent({ renderDecisions: false, xdm })`
 *
 * The alloy command function (R-004 base-code queue snippet:
 * `alloy(command, options) -> Promise`) is injected via `config.alloy`; in the
 * real chamber that is the `self.alloy` global the stock bundle installs, so the
 * connector stays free of any direct global/DOM/network reach (ADR-0001 /
 * capability.d.ts). alloy reads document.cookie synchronously through the
 * chamber's shim, which delegates to the granted `caps.cookies.sync` surface
 * (AC3) — the connector itself needs no capability to boot alloy, so `init`
 * accepts `caps` for contract conformance but does not consume it.
 *
 * WRAPPED-SDK EGRESS MODEL (contrast the wire-protocol GA4): `handle` returns
 * **[]** — alloy does NOT hand an `EgressRequest` back to the orchestrator.
 * Instead alloy issues its own worker-side `fetch` to `.../ee/v1/interact`, which
 * the chamber **intercepts** and routes into the orchestrator's main-thread
 * dispatch (ADR-0004); the minting-Edge response's ECID is written back to the
 * identity cookie (AC4). The chamber confines egress so that the mediated `fetch`
 * is the connector's only network path (AC5). The interception + confinement live
 * in the chamber (alloy-chamber.worker.js), not here — this connector stays free
 * of any direct global/DOM/network reach.
 *
 * DECISIONS-AS-DATA (spec 012-03, AC1/AC2; spec 034-02 multi-scope):
 * `sendEvent({ renderDecisions:false, decisionScopes })` fetches Target
 * personalization for EVERY configured scope from the Edge and returns it as DATA
 * (propositions) — the chamber has no DOM, so nothing is rendered here. `handle`
 * extracts ALL returned decisions from the alloy result and pushes them across the
 * boundary through the granted `caps.decisions.deliver` capability (the HOST maps
 * each to its reserved box BY SCOPE and applies it via `reserveSpace`). This
 * RECONCILES the deferred `decisions.fetch` pull sketch (capability.d.ts) with
 * alloy's actual push-from-`sendEvent`-response flow — additive, and a no-op when no
 * `decisions` capability is granted (GA4 / 012-01 / 012-02 paths, whose responses
 * carry no propositions, are unaffected).
 *
 * @param {Readonly<Record<string, unknown>>} [config] host-owned alloy config:
 *   `{ datastreamId, orgId, context?, minimalXdm?, alloy?, decisionScopes?, ...configureExtras }`.
 *   `context` narrows the stock list; `minimalXdm: true` opts into the 2-field pageView
 *   mapping instead of forwarding the site-supplied `xdm` (ADR-0062).
 *   `decisionScopes` (spec 034-02) is the declared personalization scope set (from
 *   `placements[].scope`); absent → alloy's `__view__` default.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createAlloyConnector(config = {}) {
  const {
    datastreamId,
    orgId,
    context = ALLOY_DEFAULT_CONTEXT, // stock list (ADR-0062); a site narrows it, [] disables collection
    minimalXdm = false, // opt-in 2-field pageView mapping (was the only mapping before ADR-0062)
    alloy, // the injected command fn; defaults to the chamber's self.alloy global
    // spec 034-02: the personalization decision scopes the host declared (from
    // `placements[].scope`, derived by bootAlloy). Carried on the interact so alloy
    // fetches EVERY declared scope. `personalization.decisionScopes` is accepted +
    // merged too (alloy's own sendEvent merges both forms). Destructured OUT of
    // `configureExtras` so neither leaks into `configure` (they are sendEvent-only).
    decisionScopes,
    personalization,
    ...configureExtras // debugEnabled / edgeDomain / etc. pass through to configure
  } = config;

  // The merged, deduped scope set to request on the FIRST interact only (064-23: stock Alloy's
  // sendEvent carries `decisionScopes` once; later events ride its view cache and ask for none). EMPTY
  // when none are configured → the interact carries NO `decisionScopes` (alloy's `__view__` default,
  // byte-unchanged from 033-02/033-03).
  const configuredScopes = mergeDecisionScopes(decisionScopes, personalization);
  let scopesSent = false; // set once a scoped interact SUCCEEDS, so a failed first request does not lose the scopes

  // The granted capabilities, captured at init — `handle` delivers decisions
  // through `granted.decisions` (the push channel to the host). No capability
  // granted → decisions delivery is a no-op (GA4/012-01/012-02 unchanged).
  let granted = null;

  /** Resolve the alloy command fn (injected, else the chamber global). Throws a
   *  diagnosable error rather than a bare TypeError if the chamber is mis-wired. */
  function getAlloy() {
    const fn = typeof alloy === "function"
      ? alloy
      : (typeof globalThis !== "undefined" ? globalThis.alloy : undefined);
    if (typeof fn !== "function") {
      throw new Error(
        "alloy command function is unavailable in the chamber — the bundle did not install `self.alloy` (or none was injected via config.alloy)",
      );
    }
    return fn;
  }

  const manifest = {
    name: "airlock/alloy",
    // MVP2 proof scope: one Analytics pageView (R-004 / the slice's AC).
    events: ALLOY_EVENTS,
    // The projection fields the pageView XDM maps (ADR-0003 default-deny).
    reads: ["page_view.params.page_location", "page_view.params.page_title"],
    capabilities: {
      // alloy persists first-party identity + the getTld apex probe cookie
      // synchronously (R-004) -> it requests cookie access, served by the AC3
      // sync-read surface (caps.cookies.sync) via the chamber's document shim.
      // spec 035-01 AC3: declared FROM the module-level export above — the
      // SAME array reference — so this manifest and the host-side enforcement
      // seams can never drift apart.
      cookies: ALLOY_COOKIE_NAMES,
      // it emits one interact request (captured in-chamber this slice).
      egress: true,
      // it returns Target personalization as data for the host to apply (012-03).
      decisions: true,
    },
    // 012-04 DECLARATION-SHAPE (declared, NOT enforced FROM HERE — the seal now EXISTS and
    // enforces (017-03/020-02/016-02), but reads the host-owned egressPurposes/endpointCeiling
    // wired in bootAlloy, NOT this manifest field; gating on the manifest itself is the tracked
    // "manifest mirror-drift" tightening, docs/inbox.md). ADVISORY endpoints (ADR-0006 — host
    // allow-list wins) — since 064-18 the stock Edge/demdex endpoints incl. the location-hint
    // path; the server-directed ID-sync pixels are not listed (tagged `unbridged-load`, 064-22).
    endpoints: [...ALLOY_STOCK_ENDPOINTS],
    // ADR-0007 consent-purpose annotation: tags each declared endpoint / cookie /
    // read (and egress overall) with the purpose(s) it serves, so a grant resolves
    // per declared I/O — not per connector. DISCLOSURE ONLY in MVP2; the grant
    // resolver that reads it is MVP3 (ADR-0006 §Staging). Values are declared INTENT
    // grounded in alloy's functions (Adobe Analytics events, Target personalization,
    // ECID identity) + ADR-0007's Consent-Mode-v2 starter taxonomy — not a legal audit.
    purposes: {
      // Analytics events + the Target personalization query ride the same interact.
      egress: ALLOY_EGRESS_PURPOSES,
      endpoints: Object.fromEntries(ALLOY_STOCK_ENDPOINTS.map((e) => [e, ["analytics_storage", "personalization"]])),
      cookies: ALLOY_COOKIE_PURPOSES,
      reads: {
        "page_view.params.page_location": ["analytics_storage"],
        "page_view.params.page_title": ["analytics_storage"],
      },
    },
  };

  /**
   * Boot alloy: `configure` exactly once (createConnectorHost guarantees a
   * single call). alloy consumes the sync-cookie capability INDIRECTLY through
   * the chamber's document shim, so the connector body does not touch cookies;
   * `caps` is captured so `handle` can DELIVER decisions through
   * `caps.decisions` (012-03) — a no-op when that capability is not granted.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  async function init(caps) {
    granted = caps || null;
    await getAlloy()("configure", {
      datastreamId,
      orgId,
      context: [...(Array.isArray(context) ? context : ALLOY_DEFAULT_CONTEXT)],
      ...configureExtras,
    });
    // 064-20 M3: `subscribeRulesetItems.callback` is mediated as DATA — a function cannot cross the
    // airlock, so the chamber subscribes with its own callback and delivers the ruleset propositions
    // through the granted `decisions` capability; the main thread fans them out to the site's callback.
    if (granted && granted.decisions && typeof granted.decisions.deliver === "function") {
      try {
        await getAlloy()("subscribeRulesetItems", {
          callback: (result) => {
            const props = result && Array.isArray(result.propositions) ? result.propositions : [];
            if (props.length) granted.decisions.deliver(props.map((p) => ({ scope: (p && p.scope) || null, content: p, channel: "ruleset-items" })));
          },
        });
      } catch (e) { /* an alloy without subscribeRulesetItems: ruleset items stay un-mediated */ }
    }
  }

  /**
   * Map one event to an alloy `sendEvent`, then DELIVER the returned Target
   * decisions (headless, `renderDecisions:false`) to the host as DATA through the
   * granted `decisions` capability — the chamber never touches the DOM (AC2).
   * Returns [] — no orchestrator EgressRequest this slice (alloy's own interact
   * fetch rides the intercepted→main-dispatch path, see SCOPE above).
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {Promise<import("../../contracts/connector").EgressRequest[]>}
   */
  async function handle(event) {
    const options = {
      renderDecisions: false, // headless personalization: decisions as data (R-004)
      xdm: toXdm(event, minimalXdm),
    };
    // spec 034-02: carry the declared decision scopes on the interact so alloy fetches
    // EVERY configured scope (source-grounded: sendEvent accepts a top-level
    // `decisionScopes[]`, merged+deduped into the interact query; `renderDecisions:false`
    // does NOT gate the fetch). ABSENT scopes → no `decisionScopes` key → alloy's
    // `__view__` default, byte-unchanged (033-02/033-03).
    const eventData = event && event.params && event.params.data;
    if (eventData && typeof eventData === "object" && !Array.isArray(eventData)) options.data = eventData;
    // 064-24: stock `sendEvent({ documentUnloading: true })`: the request goes out as a keepalive beacon so it
    // survives the navigation that follows (a redirect proposition's display notification). Like stock, it is a
    // beacon only when the identity cookie exists; otherwise a plain fetch.
    if (event && event.params && event.params.documentUnloading === true) options.documentUnloading = true;
    const notification = isPropositionNotification(options.xdm);
    let sendsScopes = false;
    if (notification) {
      // 064-20: a display/interact notification is not a personalization query (recorded S4 2nd POST).
      options.personalization = { defaultPersonalizationEnabled: false, sendDisplayEvent: false };
    } else if (configuredScopes.length && !scopesSent) {
      sendsScopes = true;
      options.decisionScopes = configuredScopes;
      // Live-Alloy caveat (the analogue of 034-01's split): on a cache-uninitialized
      // event real alloy's shouldRequestDefaultPersonalization() AUTO-ADDS `__view__`
      // even when only named scopes are configured — a spurious extra proposition. When
      // NO `__view__` scope is declared, suppress it so only the declared scopes are
      // fetched. (Not observable in the rig — the injected config.alloy bypasses this
      // real-alloy path — so it is documented as a live-Alloy caveat.)
      if (!configuredScopes.includes(VIEW_SCOPE)) {
        options.personalization = { defaultPersonalizationEnabled: false };
      }
    }
    const result = await getAlloy()("sendEvent", options);
    if (sendsScopes) scopesSent = true;
    // 012-03 + 034-02: the propositions cross the boundary as DATA via the granted
    // decisions capability. Deliver ALL returned scopes (`scope:null`) — the HOST maps
    // each decision to its reserved box BY SCOPE (adapters/eds/index.js), not a single
    // filtered scope. In the single-`__view__`/analytics-only paths this is unchanged
    // (only `__view__` — or nothing — comes back).
    const decisions = notification ? [] : extractDecisions(result, { scope: null });
    if (decisions.length && granted && granted.decisions && typeof granted.decisions.deliver === "function") {
      granted.decisions.deliver(decisions);
    }
    return [];
  }

  return { manifest, init, handle };
}

/** Is this XDM a personalization notification (`decisioning.proposition*`)? Those carry no query. */
function isPropositionNotification(xdm) {
  return !!xdm && typeof xdm.eventType === "string" && /^decisioning\.proposition/.test(xdm.eventType);
}

/**
 * Merge the decision scopes from the top-level config `decisionScopes` and a
 * `personalization.decisionScopes` (alloy's own sendEvent accepts + merges both
 * forms), deduped + order-preserving. Non-string / empty entries are dropped. Pure,
 * null-safe — returns `[]` when neither is configured (the caller then omits the key
 * so the interact keeps alloy's `__view__` default, byte-unchanged).
 * @param {unknown} top the config's top-level `decisionScopes`.
 * @param {{ decisionScopes?: unknown } | undefined} personalization the config's `personalization`.
 * @returns {string[]}
 */
function mergeDecisionScopes(top, personalization) {
  const fromTop = Array.isArray(top) ? top : [];
  const fromPzn = personalization && Array.isArray(personalization.decisionScopes) ? personalization.decisionScopes : [];
  const out = [];
  const seen = new Set();
  for (const s of [...fromTop, ...fromPzn]) {
    if (typeof s === "string" && s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

/**
 * The XDM for one event. Stock forwards the site-supplied `xdm`, so `params.xdm` (or
 * `payload.xdm`) goes through as given (ADR-0062). An event without one still gets the
 * minimal Analytics pageView (R-004's sendEvent shape, only the fields present) so the composite page_view fan-out
 * keeps working. `minimal` (opt-in `minimalXdm`) forces that 2-field mapping.
 * @param {{ params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @param {boolean} [minimal]
 */
function toXdm(event, minimal = false) {
  const p = (event && (event.params || event.payload)) || {};
  if (!minimal && p.xdm && typeof p.xdm === "object" && !Array.isArray(p.xdm)) return p.xdm;
  // Only what the event carries: Alloy merges this over the context it collects, so a
  // placeholder here would override the real page URL from the stock-context channel.
  const details = {};
  const url = p.page_location || p.URL;
  const name = p.page_title || p.name;
  if (url) details.URL = url;
  if (name) details.name = name;
  return {
    eventType: "web.webpagedetails.pageViews",
    ...(Object.keys(details).length ? { web: { webPageDetails: details } } : {}),
  };
}
