/**
 * The generic pixel connector — spec 026-01 (the archetype proof, resolving
 * OQ10 for the GET case). A vendor-NEUTRAL wire-protocol connector
 * (contracts/connector.d.ts: manifest -> factory -> init -> handle, hosted
 * worker-side by the SAME `core/connector-host.js` GA4/alloy/RUM already
 * use) whose `handle()` interprets a **declarative config**
 * `{ endpoint, eventMap, paramMap }` instead of a bespoke per-vendor `mapToX`
 * function (contrast `connectors/ga4/map.js`'s hand-written `mapToMp`) — the
 * net-new machinery spec 026 exists to build (spec 026 § "Of the config
 * triple... the param/payload map is net-new").
 *
 * NO VENDOR-SPECIFIC CODE LIVES HERE (AC1). Every vendor's specifics —
 * its endpoint, its event-name vocabulary, its query-param shape, even which
 * query key carries the pixel id vs. the mapped event name — are DATA, read
 * off `config`. Meta's own specifics live entirely in the config fixture
 * (connectors/pixel/vendors/meta.js); test/pixel-connector.test.js proves
 * genericity further by running an UNRELATED fake-vendor config (different
 * query-key vocabulary entirely) through this SAME connector code.
 *
 * WIRE SHAPE — GET, never POST (AC1/AC2): every pixel vendor's `/tr`-style
 * beacon (Meta, LinkedIn Insight, Bing UET, …) is a 1x1-image GET, not a JSON
 * POST body (spec 026 § Assumptions). `handle()` always returns
 * `method: "GET"` and OMITS `body` entirely — `core/airlock.js`'s
 * method-aware dispatch (026-01 AC4) honors that: a GET request must never
 * carry a body (a real `fetch(url, {method:"GET", body})` throws).
 *
 * DECLARATIVE PARAM PROJECTION (AC2/AC8): `paramMap` is keyed by the OUTPUT
 * query-parameter name; each entry names WHERE its value comes from —
 *   - `{ from: "static", value }` — a fixed literal (Meta's pixel id under
 *     its "id" query key; a different vendor might name that key anything).
 *   - `{ from: "event" }` — the event name THIS config's `eventMap` produced
 *     for `event.type` (Meta's "ev" query key).
 *   - `{ from: "params", key }` — `event.params[key]` (or `event.payload[key]`
 *     for the contract-shaped AirlockEvent form — mirrors
 *     `connectors/ga4/connector.js`'s SAME `event.params || event.payload`
 *     bridge), included ONLY when present (undefined/null -> omitted, never
 *     an empty-string query param).
 * A field NOT named in `paramMap` can never reach the query string, no
 * matter what `event.params` carries — the connector serializes ONLY what
 * the declarative config projects (AC8's "only governed event.params" half);
 * the OTHER half — that `event.params` itself is already governance-stripped
 * of denylisted PII before this connector ever sees it — is
 * `core/airlock.js`'s job (input-side `governParams`, ADR-0012), not this
 * connector's. This connector never reads `ctx` at all (no `ctx` config key
 * exists here, unlike GA4/RUM) — structurally unable to inject un-governed
 * host-sourced identity into a beacon (AC8's "no un-governed ctx identity").
 *
 * EVENT ROUTING (mirrors `connectors/helix-rum/connector.js`'s zero-or-one
 * gate): an `event.type` absent from `eventMap` maps to `[]`, never a throw
 * and never a partial/garbled beacon — a pixel config only speaks the vendor
 * events it explicitly declares, unlike GA4's `events: ["*"]` catch-all.
 * `manifest.events` is DERIVED from `Object.keys(eventMap)` (declared, not
 * enforced, ADR-0006/0007 — mirrors every other connector's manifest).
 *
 * NO COOKIE CAPABILITY REQUESTED (AC9 structural half): unlike GA4
 * (`_ga`/`_ga_`) or alloy (`kndctr_`/`AMCV_`/`demdex`), this connector's
 * manifest never declares a `capabilities.cookies` — the 026-01 Meta config
 * carries NO basic (`_fbp`/`fbc`) or advanced-matching (`ud[...]`) identity;
 * both are explicitly out of scope for this slice (spec's "Identity honesty").
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node,
 * exactly like `connectors/ga4/connector.js` and
 * `connectors/helix-rum/connector.js`.
 *
 * @param {Readonly<Record<string, unknown>>} [config] the declarative pixel
 *   config: `{ name?, endpoint, eventMap, paramMap, egressPurposes?,
 *   endpoints?, capabilities? }`. `endpoint`/`eventMap`/`paramMap` are the
 *   wire-shape interpreter's own inputs (AC1); `name`/`egressPurposes`/
 *   `endpoints`/`capabilities` feed the MANIFEST only (ADR-0006/0007
 *   disclosure — declared, not enforced).
 * @returns {import("../../contracts/connector").Connector}
 */
export function createPixelConnector(config = {}) {
  const {
    name = "airlock/pixel",
    endpoint,
    eventMap = {},
    paramMap = {},
    egressPurposes = [],
    endpoints,
    capabilities = {},
  } = config;

  // The declared/advisory endpoint set (ADR-0006 — the host allow-list at
  // core/airlock.js's endpoint ceiling is authoritative regardless of what a
  // connector declares here). Defaults to `[endpoint]` when the config does
  // not separately enumerate `endpoints` — the common single-destination case
  // every pixel vendor config in this slice uses.
  const declaredEndpoints =
    Array.isArray(endpoints) && endpoints.length
      ? [...new Set(endpoints)]
      : typeof endpoint === "string" && endpoint.length
        ? [endpoint]
        : [];

  const manifest = {
    name,
    events: Object.keys(eventMap),
    reads: [],
    capabilities: { egress: true, ...capabilities },
    endpoints: declaredEndpoints,
    purposes: {
      egress: [...egressPurposes],
      endpoints: Object.fromEntries(declaredEndpoints.map((e) => [e, [...egressPurposes]])),
    },
  };

  /**
   * No vendor SDK to boot — a wire-protocol connector (mirrors GA4/RUM's
   * synchronous no-op init). Accepted for contract conformance only.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  function init(_caps) {
    // no-op — see doc comment above.
  }

  /**
   * Interpret the declarative config against one event -> zero-or-one GET
   * EgressRequest. Never throws on an unmapped event type or a missing
   * param — fails safe to `[]`/an omitted param, never a partial or
   * malformed beacon.
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    const type = event && event.type;
    if (!Object.prototype.hasOwnProperty.call(eventMap, type)) return []; // this config does not map this event
    const vendorEvent = eventMap[type];

    // Same bridge connectors/ga4/connector.js's handle() uses: a real batch
    // descriptor carries `params`, a contract-shaped AirlockEvent carries
    // `payload` — either way `handle` reads whichever is present.
    const source = (event && (event.params || event.payload)) || {};

    const query = [];
    for (const [queryKey, spec] of Object.entries(paramMap)) {
      if (!spec || typeof spec !== "object") continue;
      let value;
      if (spec.from === "static") value = spec.value;
      else if (spec.from === "event") value = vendorEvent;
      else if (spec.from === "params") value = source[spec.key];
      if (value === undefined || value === null) continue; // omitted, never an empty-string param
      query.push(`${encodeURIComponent(queryKey)}=${encodeURIComponent(String(value))}`);
    }

    const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
    // GET, no body (AC1/AC2/AC4) — contracts/connector.d.ts's
    // `method?: "POST" | "GET"`, resolved for the GET case by this slice.
    return [{ url, method: "GET" }];
  }

  return { manifest, init, handle };
}
