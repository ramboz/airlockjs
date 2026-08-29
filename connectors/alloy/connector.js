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
    ...configureExtras // debugEnabled / edgeDomain / etc. pass through to configure
  } = config;

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
    },
  };

  /**
   * Boot alloy: `configure` exactly once (createConnectorHost guarantees a
   * single call). `caps` is accepted for contract conformance; alloy consumes
   * the sync-cookie capability INDIRECTLY through the chamber's document shim,
   * so the connector body does not touch `caps`.
   * @param {import("../../contracts/capability").GrantedCapabilities} _caps
   */
  async function init(_caps) {
    await getAlloy()("configure", {
      datastreamId,
      orgId,
      context,
      ...configureExtras,
    });
  }

  /**
   * Map one event to an alloy `sendEvent`. Returns [] — no orchestrator
   * EgressRequest this slice (see SCOPE above).
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {Promise<import("../../contracts/connector").EgressRequest[]>}
   */
  async function handle(event) {
    await getAlloy()("sendEvent", {
      renderDecisions: false, // headless personalization: decisions as data (R-004)
      xdm: toXdm(event),
    });
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
