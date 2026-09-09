/**
 * GA4 gtag-PROTOCOL connector — spec 039-01, implementing ADR-0019. A NEW
 * module, SIBLING to `connectors/ga4/map.js` (the Measurement Protocol
 * mapper) — this file does not import from, modify, or depend on `map.js` in
 * any way (039-01 AC4: the frozen MP surface, `map.js` + `contracts/ga4-mp*`,
 * stays byte-identical; see test/ga4-gtag.test.js's golden-hash assertions).
 *
 * A container's own GA4 tag loads `gtag.js` and sends its beacon to
 * `/g/collect`, authed by `tid` (measurement id) + request origin — NO
 * secret. That is the ADR-0019 adoption fix over the MP path (`map.js`'s
 * `mpUrl` requires an `api_secret`, a server-side trusted credential a
 * rewired browser-side tag cannot safely hold). This connector reproduces
 * that SAME wire protocol off-thread, through the SAME governed GET egress
 * `connectors/pixel/connector.js` already proves (spec 026).
 *
 * SCOPE (039-01 only — see docs/specs/039-ga4-gtag-connector/spec.md's
 * Decomposition): the CORE, single-event `/g/collect` beacon — `v`, `tid`,
 * `cid`, `sid`, `en`, `dl`/`dr`/`dt`, `ep.<k>`/`epn.<k>` custom params, and
 * `_et` (engagement time). Session-state carriage (`sct`/`seg`/`_fv`/`_ss`/
 * `_nsi`, the `_ga_<stream>` writer) is 039-03; Consent Mode (`gcs`/`gcd`) is
 * 039-02/039-05. None of that is read or written here. Transport is GET-only
 * (a single captured event) — the batched-POST form gtag uses for >=2 events
 * is 039-04 (DEFERRED), out of scope.
 *
 * IDENTITY (039-01 AC2): `cid`/`sid` are NOT sourced by this module — they
 * arrive via `config.ctx`, sourced by the HOST exactly as the MP path does
 * today (`connectors/ga4/cookies.js`'s `sourceGa4Ctx`, reused unmodified;
 * mirrors `connectors/ga4/connector.js`'s `config.ctx` convention). This
 * connector never touches cookies, the DOM, or any ambient global.
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node,
 * exactly like `connectors/ga4/map.js` and `connectors/pixel/connector.js`.
 */

/** GA4's public collect endpoint (production; region-prefixed variants exist
 *  but are out of this slice's scope — `mapToMp`'s sibling doesn't need one
 *  either, since auth here is `tid` + origin, not a region-scoped secret). */
export const GA4_GTAG_COLLECT_ENDPOINT = "https://www.google-analytics.com/g/collect";

/** gtag.js's own protocol version query param — constant across every beacon
 *  (R-009(a)'s capture-confirmed field map). */
const PROTOCOL_VERSION = "2";

/** Event-payload keys the CORE mapping already projects onto `dl`/`dr`/`dt` —
 *  excluded from the custom `ep.<k>`/`epn.<k>` fan-out so a param never lands
 *  under BOTH its dedicated field and a custom-param spelling. */
const CORE_PAYLOAD_KEYS = new Set(["page_location", "page_referrer", "page_title"]);

/**
 * Append `key=value` to a query-part array, `encodeURIComponent`-escaping
 * both sides — omitted (never an empty-string param) when `value` is
 * `undefined`/`null`, mirroring `connectors/pixel/connector.js`'s own
 * omission rule.
 * @param {string[]} query
 * @param {string} key
 * @param {unknown} value
 */
function appendParam(query, key, value) {
  if (value === undefined || value === null) return;
  query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

/**
 * @param {{ type: string, params?: Record<string, unknown> }} event
 *   The captured event — a GA4 event name + its params (the SAME
 *   `{ type, params }` descriptor shape `connectors/ga4/map.js`'s `mapToMp`
 *   consumes). `page_location`/`page_referrer`/`page_title` project onto
 *   `dl`/`dr`/`dt`; every OTHER param fans out to `ep.<k>` (string) /
 *   `epn.<k>` (number) — the container's own custom-param convention
 *   (R-009(a), capture-confirmed 2026-09-07).
 * @param {{ measurementId: string, ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number }, endpoint?: string }} config
 * @returns {{ url: string, method: "GET" }} A single beacon descriptor — wrapped
 *   into the `EgressRequest[]` array shape by `handle()` below (the
 *   `Connector.handle` contract, `contracts/connector.d.ts`).
 */
function mapToGtagCollect(event, { measurementId, ctx, endpoint }) {
  const source = (event && (event.params || event.payload)) || {};
  const query = [];

  appendParam(query, "v", PROTOCOL_VERSION);
  appendParam(query, "tid", measurementId);
  appendParam(query, "cid", ctx && ctx.clientId);
  appendParam(query, "sid", ctx && ctx.sessionId);
  appendParam(query, "en", event && event.type);
  appendParam(query, "dl", source.page_location);
  appendParam(query, "dr", source.page_referrer);
  appendParam(query, "dt", source.page_title);

  for (const [key, value] of Object.entries(source)) {
    if (CORE_PAYLOAD_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      appendParam(query, `epn.${key}`, value);
    } else {
      appendParam(query, `ep.${key}`, value);
    }
  }

  const engagementTimeMsec =
    ctx && typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100;
  appendParam(query, "_et", engagementTimeMsec);

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Ship the core `/g/collect` gtag-protocol connector (039-01). NOT (yet) a
 * full `contracts/connector.d.ts` `Connector` — like `map.js`'s `mapToMp`,
 * this is the pure mapping half; a `Connector`-conforming wrapper (mirroring
 * `connectors/ga4/connector.js`'s relationship to `map.js`) is host-wiring
 * work for a later slice once session-state/Consent-Mode carriage lands.
 *
 * @param {Readonly<{
 *   measurementId: string,
 *   ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number },
 *   endpoint?: string,
 * }>} [config] `measurementId` -> `tid`; `ctx` -> `cid`/`sid`/`_et`, sourced by
 *   the host exactly as the MP path does (039-01 AC2, `sourceGa4Ctx` reuse);
 *   `endpoint` defaults to `GA4_GTAG_COLLECT_ENDPOINT`.
 * @returns {{ handle(event: { type: string, params?: Record<string, unknown> }): Array<{ url: string, method: "GET" }> }}
 */
export function createGa4GtagConnector(config = {}) {
  const { measurementId, ctx = {}, endpoint = GA4_GTAG_COLLECT_ENDPOINT } = config;

  /**
   * Map one event to a single-element `EgressRequest[]` carrying ONE
   * `/g/collect` GET beacon (039-01's single-event scope — batched POST for
   * >=2 events is 039-04, deferred). The array wrapper matches the
   * `Connector.handle` contract (`contracts/connector.d.ts`) that
   * `core/connector-host.js` consumes via `for (const req of requests)`,
   * mirroring the sibling `connectors/pixel/connector.js` /
   * `connectors/ga4/connector.js` return shape.
   * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
   * @returns {Array<{ url: string, method: "GET" }>}
   */
  function handle(event) {
    return [mapToGtagCollect(event, { measurementId, ctx, endpoint })];
  }

  return { handle };
}
