import { extractDecisions, VIEW_SCOPE } from "./decisions.js";

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
 *   - init(caps) -> alloy `configure({ datastreamId, orgId, context: [] })`
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
 * DECISIONS-AS-DATA (spec 012-03, AC1/AC2): `sendEvent({ renderDecisions:false })`
 * fetches Target personalization from the Edge and returns it as DATA
 * (propositions) — the chamber has no DOM, so nothing is rendered here. `handle`
 * extracts the `__view__` decisions from the alloy result and pushes them across
 * the boundary through the granted `caps.decisions.deliver` capability (the HOST
 * applies them via `reserveSpace`). This RECONCILES the deferred `decisions.fetch`
 * pull sketch (capability.d.ts) with alloy's actual push-from-`sendEvent`-response
 * flow — additive, and a no-op when no `decisions` capability is granted (GA4 /
 * 012-01 / 012-02 paths, whose responses carry no propositions, are unaffected).
 *
 * @param {Readonly<Record<string, unknown>>} [config] host-owned alloy config:
 *   `{ datastreamId, orgId, context?, alloy?, ...configureExtras }`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createAlloyConnector(config = {}) {
  const {
    datastreamId,
    orgId,
    context = [], // [] disables ambient auto-collection — the chamber is headless (R-004)
    alloy, // the injected command fn; defaults to the chamber's self.alloy global
    decisionScope = VIEW_SCOPE, // the personalization scope the host applies (R-004)
    ...configureExtras // debugEnabled / edgeDomain / etc. pass through to configure
  } = config;

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
    events: ["page_view"],
    // The projection fields the pageView XDM maps (ADR-0003 default-deny).
    reads: ["page_view.params.page_location", "page_view.params.page_title"],
    capabilities: {
      // alloy persists first-party identity + the getTld apex probe cookie
      // synchronously (R-004) -> it requests cookie access, served by the AC3
      // sync-read surface (caps.cookies.sync) via the chamber's document shim.
      cookies: ["com.adobe.alloy.getTld", "kndctr_", "AMCV_", "demdex", "s_ecid"],
      // it emits one interact request (captured in-chamber this slice).
      egress: true,
      // it returns Target personalization as data for the host to apply (012-03).
      decisions: true,
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
      context,
      ...configureExtras,
    });
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
    const result = await getAlloy()("sendEvent", {
      renderDecisions: false, // headless personalization: decisions as data (R-004)
      xdm: toXdm(event),
    });
    // 012-03: the propositions cross the boundary as DATA via the granted
    // decisions capability (push, reconciled with the deferred `fetch` sketch).
    const decisions = extractDecisions(result, { scope: decisionScope });
    if (decisions.length && granted && granted.decisions && typeof granted.decisions.deliver === "function") {
      granted.decisions.deliver(decisions);
    }
    return [];
  }

  return { manifest, init, handle };
}

/**
 * Map an airlock event to a minimal Analytics pageView XDM (R-004's sendEvent
 * shape). Tolerant of `params` (the GA4-style descriptor shape the rig drives)
 * or the contract's `payload`; falls back to safe defaults so a sparse event
 * still produces a well-formed pageView.
 * @param {{ params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 */
function toXdm(event) {
  const p = (event && (event.params || event.payload)) || {};
  return {
    eventType: "web.webpagedetails.pageViews",
    web: {
      webPageDetails: {
        URL: p.page_location || p.URL || "https://airlock.example/",
        name: p.page_title || p.name || "airlock",
      },
    },
  };
}
