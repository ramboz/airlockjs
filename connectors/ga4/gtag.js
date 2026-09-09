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
 * SCOPE (039-01 core + 039-02 Consent-Mode STATE): the CORE, single-event
 * `/g/collect` beacon — `v`, `tid`, `cid`, `sid`, `en`, `dl`/`dr`/`dt`,
 * `ep.<k>`/`epn.<k>` custom params, `_et` (engagement time) — PLUS `gcs`, the
 * Consent-Mode STATE string (039-02, see `encodeGcs` below). Session-state
 * carriage (`sct`/`seg`/`_fv`/`_ss`/`_nsi`, the `_ga_<stream>` writer) is
 * 039-03; the Consent-Mode DEFAULTS string `gcd` is 039-05 (it co-varies with
 * consent, so it is not a pure vector function like `gcs` is — see
 * docs/specs/039-ga4-gtag-connector/slice-02-consent-mode.md's Grounding
 * note). None of that is read or written here. Transport is GET-only (a
 * single captured event) — the batched-POST form gtag uses for >=2 events is
 * 039-04 (DEFERRED), out of scope.
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
import { resolveConsent } from "../../core/consent.js";

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

/** The two Consent-Mode v2 STORAGE purposes `gcs` carries, in the
 *  documented digit ORDER (`G1<ad_storage><analytics_storage>`) — `gcs`
 *  ignores the two DATA-USE purposes (`ad_user_data`/`ad_personalization`),
 *  unlike the MP path's `connectors/ga4/consent.js` shaper (039-02's Goal). */
const GCS_PURPOSES = ["ad_storage", "analytics_storage"];

/** `resolveConsent`'s `"granted"|"denied"` states, keyed to their `gcs`
 *  digit. `"pending"` is deliberately ABSENT — a pending purpose is handled
 *  by `encodeGcs`'s early-return, never reaches this lookup. */
const GCS_DIGIT = { granted: "1", denied: "0" };

/**
 * Encode the Consent-Mode v2 **STATE** string `gcs` (`G1<ad_storage>
 * <analytics_storage>`, e.g. `G111` all-granted / `G100` all-denied — both
 * live-observed anchors, `docs/specs/039-ga4-gtag-connector/slice-02-consent-
 * mode.md`) from a host-supplied ADR-0007 consent vector. A pure function of
 * the vector — no default-config input, unlike the harder `gcd` derivation
 * (039-05, deferred: `gcd` co-varies with consent, so it is not a pure
 * vector function).
 *
 * PENDING omission (mirrors `connectors/ga4/consent.js:48`'s "no signal yet
 * — omit, don't fail-safe to DENIED"): `gcs` is a JOINT positional string —
 * a single digit cannot be omitted while keeping the other — so if EITHER
 * governing purpose (`ad_storage`/`analytics_storage`) is `"pending"`, this
 * returns `undefined` and `gcs` is omitted from the beacon ENTIRELY, never a
 * partial/guessed `G1XY` (039-02 AC2's mixed-pending rule).
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (`core/consent.js`'s shape) — the SAME raw
 *   vector `resolveConsent`/`shapeMpConsent` read, NOT the MP-shaped
 *   `{ ad_user_data, ad_personalization }` object `connectors/ga4/consent.js`
 *   produces (that shape has no storage-purpose fields at all).
 * @returns {string|undefined} the `gcs` STATE string, or `undefined` when
 *   either governing purpose has no signal yet.
 */
function encodeGcs(vector) {
  const states = GCS_PURPOSES.map((purpose) => resolveConsent(vector, purpose));
  if (states.some((state) => state === "pending")) return undefined; // joint string — omit entirely, never a partial guess
  return `G1${states.map((state) => GCS_DIGIT[state]).join("")}`;
}

/**
 * @param {{ type: string, params?: Record<string, unknown> }} event
 *   The captured event — a GA4 event name + its params (the SAME
 *   `{ type, params }` descriptor shape `connectors/ga4/map.js`'s `mapToMp`
 *   consumes). `page_location`/`page_referrer`/`page_title` project onto
 *   `dl`/`dr`/`dt`; every OTHER param fans out to `ep.<k>` (string) /
 *   `epn.<k>` (number) — the container's own custom-param convention
 *   (R-009(a), capture-confirmed 2026-09-07).
 * @param {{ measurementId: string, ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string> }, endpoint?: string }} config
 *   `ctx.consent` (039-02): the RAW ADR-0007 host consent vector (NOT the
 *   MP-shaped object `connectors/ga4/consent.js` produces) — the SAME single
 *   `config.ctx` sourcing path 039-01 already uses for identity, extended
 *   with the one field `encodeGcs` needs. Absent/`undefined` resolves every
 *   purpose to `"pending"` (`core/consent.js`'s fail-to-pending default), so
 *   an unset-consent host omits `gcs` — back-compat with pre-039-02 beacons.
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

  // 039-02: Consent Mode STATE. `encodeGcs` returns `undefined` (omitted by
  // `appendParam`) whenever either governing purpose is still pending — see
  // that function's doc comment for the joint-string/mixed-pending rule.
  appendParam(query, "gcs", encodeGcs(ctx && ctx.consent));

  const engagementTimeMsec =
    ctx && typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100;
  appendParam(query, "_et", engagementTimeMsec);

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Ship the core `/g/collect` gtag-protocol connector (039-01) + Consent-Mode
 * STATE carriage (039-02). NOT (yet) a full `contracts/connector.d.ts`
 * `Connector` — like `map.js`'s `mapToMp`, this is the pure mapping half; a
 * `Connector`-conforming wrapper (mirroring `connectors/ga4/connector.js`'s
 * relationship to `map.js`) is host-wiring work for a later slice once
 * session-state carriage (`gcd`, 039-05) lands too.
 *
 * @param {Readonly<{
 *   measurementId: string,
 *   ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string> },
 *   endpoint?: string,
 * }>} [config] `measurementId` -> `tid`; `ctx` -> `cid`/`sid`/`_et`, sourced by
 *   the host exactly as the MP path does (039-01 AC2, `sourceGa4Ctx` reuse);
 *   `ctx.consent` (039-02) -> `gcs`, the raw ADR-0007 consent vector (see
 *   `mapToGtagCollect`'s doc comment); `endpoint` defaults to
 *   `GA4_GTAG_COLLECT_ENDPOINT`.
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
