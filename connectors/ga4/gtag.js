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
 * SCOPE (039-01 core + 039-02 Consent-Mode STATE + 039-03 session state +
 * 039-05 Consent-Mode DEFAULTS): the CORE, single-event `/g/collect` beacon —
 * `v`, `tid`, `cid`, `sid`, `en`, `dl`/`dr`/`dt`, `ep.<k>`/`epn.<k>` custom
 * params, `_et` (engagement time) — PLUS `gcs`, the Consent-Mode STATE string
 * (039-02, `encodeGcs`, now in `connectors/consent-mode.js` per 044-01's extract),
 * PLUS `gcd`, the Consent-Mode DEFAULTS string (039-05, `encodeGcd`, likewise
 * in `connectors/consent-mode.js` — scoped to the live-grounded default-denied
 * deployment; omitted for any other declared default, a tracked known
 * non-parity gap, see that function's doc comment), PLUS
 * `sct`/`seg`/`_fv`/`_ss`/`_nsi`, the session-state fields (039-03, see
 * `appendSessionState` below) projected verbatim from the host-computed
 * `ctx.sessionState` — the STATEFUL half, since those values depend on cookie
 * history advanced by `connectors/ga4/cookies.js`'s `writeGa4SessionState`
 * (the `_ga_<stream>` read-modify-write writer that closes OQ13-2), called by
 * the HOST before this connector runs, mirroring how `ctx.clientId`/
 * `ctx.sessionId` are already host-sourced rather than derived here.
 * Transport is GET-only (a single captured event) — the batched-POST form
 * gtag uses for >=2 events is 039-04 (DEFERRED), out of scope.
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
// 044-01 (the extract-on-third-caller convention, docs/conventions.md § Code): the `gcs`/`gcd`
// Consent-Mode encoders (039-02/039-05) and the omit-when-undefined `appendParam` builder now live
// in shared, gtag-family-neutral leaves — Google Ads (spec 044) is their 2nd caller. This slice's
// behavior is UNCHANGED (byte-identical beacon): the definitions moved out verbatim; only the
// import site is new.
import { appendParam } from "../../core/query-params.js";
import { encodeGcs, encodeGcd } from "../consent-mode.js";

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
 * Append the 039-03 session-state fields (`sct`/`seg`/`_fv`/`_ss`/`_nsi`) from the host-computed
 * `ctx.sessionState` — the STATEFUL counterpart to `encodeGcs` (`connectors/consent-mode.js`, a pure
 * function of the consent vector); this one is not a pure function of anything
 * gtag.js holds, since the values depend on `_ga_<stream>` cookie HISTORY advanced by
 * `connectors/ga4/cookies.js`'s `writeGa4SessionState`, called by the HOST before this connector
 * runs — mirrors how `ctx.clientId`/`ctx.sessionId` are host-sourced, never derived here). Absent
 * `sessionState` (e.g. `analytics_storage` not granted, `writeGa4SessionState` returned `null`)
 * omits all five fields, same as an unset `ctx.consent` omits `gcs` (039-02's back-compat rule).
 * Each field is appended individually via `appendParam` — a key `writeGa4SessionState` never sets
 * for a given transition (e.g. `_fv` on a continuation) is `undefined` here and omitted, exactly
 * reproducing the observed "no `_fv`/`_ss`/`_nsi` on a continuation" rule (slice 039-03 AC2).
 * @param {string[]} query
 * @param {{ sct?: string, seg?: string, _fv?: string, _ss?: string, _nsi?: string }|null|undefined} sessionState
 */
function appendSessionState(query, sessionState) {
  if (!sessionState) return;
  appendParam(query, "sct", sessionState.sct);
  appendParam(query, "seg", sessionState.seg);
  appendParam(query, "_fv", sessionState._fv);
  appendParam(query, "_ss", sessionState._ss);
  appendParam(query, "_nsi", sessionState._nsi);
}

/**
 * @param {{ type: string, params?: Record<string, unknown> }} event
 *   The captured event — a GA4 event name + its params (the SAME
 *   `{ type, params }` descriptor shape `connectors/ga4/map.js`'s `mapToMp`
 *   consumes). `page_location`/`page_referrer`/`page_title` project onto
 *   `dl`/`dr`/`dt`; every OTHER param fans out to `ep.<k>` (string) /
 *   `epn.<k>` (number) — the container's own custom-param convention
 *   (R-009(a), capture-confirmed 2026-09-07).
 * @param {{ measurementId: string, ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string>, consentDefault?: Record<string, string>, sessionState?: { sct?: string, seg?: string, _fv?: string, _ss?: string, _nsi?: string } }, endpoint?: string }} config
 *   `ctx.consent` (039-02): the RAW ADR-0007 host consent vector (NOT the
 *   MP-shaped object `connectors/ga4/consent.js` produces) — the SAME single
 *   `config.ctx` sourcing path 039-01 already uses for identity, extended
 *   with the field `encodeGcs`/`encodeGcd` need. Absent/`undefined` resolves
 *   every purpose to `"pending"` (`core/consent.js`'s fail-to-pending
 *   default), so an unset-consent host omits `gcs`/`gcd` — back-compat with
 *   pre-039-02 beacons. `ctx.consentDefault` (039-05): the host's DECLARED
 *   Consent-Mode default (same vector shape) — gates `encodeGcd` to the
 *   live-grounded denied-all deployment; absent/`undefined` defaults to
 *   denied-all (see `isDeniedAllDefault`'s doc comment), so an unset host
 *   still emits `gcd` for airlock's own consent-governed target.
 *   `ctx.sessionState` (039-03): the host-computed session-state snapshot —
 *   normally `connectors/ga4/cookies.js`'s `writeGa4SessionState`'s return
 *   value, threaded the SAME single-sourcing-path way, and projected verbatim
 *   by `appendSessionState` above. Absent/`undefined` omits `sct`/`seg`/
 *   `_fv`/`_ss`/`_nsi` entirely — back-compat with pre-039-03 beacons.
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
  // 039-03: session-state carriage, projected verbatim from the host-computed ctx.sessionState —
  // see appendSessionState's doc comment for why this is not a pure function like encodeGcs.
  appendSessionState(query, ctx && ctx.sessionState);
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
  // 039-05: Consent Mode DEFAULTS, threaded the SAME `ctx.consent` vector
  // plus the declared `ctx.consentDefault` gate. `encodeGcd` returns
  // `undefined` (omitted) for a non-denied-all declared default (a tracked
  // known non-parity gap, see its doc comment) or a pending governing signal.
  appendParam(query, "gcd", encodeGcd(ctx && ctx.consent, ctx && ctx.consentDefault));

  const engagementTimeMsec =
    ctx && typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100;
  appendParam(query, "_et", engagementTimeMsec);

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Ship the core `/g/collect` gtag-protocol connector (039-01) + Consent-Mode
 * STATE carriage (039-02) + session-state carriage (039-03, the `_ga_<stream>`
 * writer that closes OQ13-2) + Consent-Mode DEFAULTS carriage (039-05, scoped
 * to the live-grounded default-denied deployment) — now (041-01 AC1) a full
 * `contracts/connector.d.ts` `Connector` (`{ manifest, init, handle }`),
 * mirroring `connectors/ga4/connector.js`'s own relationship to `map.js`:
 * `mapToGtagCollect` stays the pure mapping half (UNCHANGED by this slice —
 * config/ctx threading, not a capability-holding reshape; see
 * `writeGa4SessionState`'s doc comment in `connectors/ga4/cookies.js` for why
 * the cookie-write capability lives entirely on the HOST side), while this
 * factory adds the manifest declaration + a no-op `init` so `core/
 * connector-host.js` (and thus `core/ga4-gtag-chamber.worker.js`) can host it
 * the SAME way it hosts GA4-MP/alloy/pixel.
 *
 * @param {Readonly<{
 *   measurementId: string,
 *   ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string>, consentDefault?: Record<string, string> },
 *   endpoint?: string,
 * }>} [config] `measurementId` -> `tid`; `ctx` -> `cid`/`sid`/`_et`, sourced by
 *   the host exactly as the MP path does (039-01 AC2, `sourceGa4Ctx` reuse);
 *   `ctx.consent` (039-02) -> `gcs`, the raw ADR-0007 consent vector (see
 *   `mapToGtagCollect`'s doc comment); `ctx.consentDefault` (039-05) -> gates
 *   `gcd` to the live-grounded denied-all deployment (see `isDeniedAllDefault`'s
 *   doc comment); `endpoint` defaults to `GA4_GTAG_COLLECT_ENDPOINT`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createGa4GtagConnector(config = {}) {
  const { measurementId, ctx = {}, endpoint = GA4_GTAG_COLLECT_ENDPOINT } = config;

  const manifest = {
    name: "airlock/ga4-gtag",
    // Catch-all, mirroring connectors/ga4/connector.js's own `events`
    // annotation: gtag maps every event type to /g/collect and accepts
    // arbitrary custom event names by design — enumeration is impossible.
    events: ["*"],
    // reads = PROJECTION snapshot fields (ADR-0003 default-deny). handle()
    // reads the event PAYLOAD (event.params/event.payload) + host-sourced
    // ctx, never event.snapshot -> EMPTY, same as the MP connector's manifest.
    reads: [],
    capabilities: {
      // Same client_id (_ga) / session_id (_ga_<stream>) identity model as
      // the MP connector (connectors/ga4/connector.js's own declaration) —
      // sourced host-side via connectors/ga4/cookies.js's sourceGa4Ctx,
      // unwired here (config.ctx arrives already-sourced).
      cookies: ["_ga", "_ga_"],
      // it emits one /g/collect GET per event (the ready EgressRequest[] below).
      egress: true,
    },
    // ADVISORY endpoint (ADR-0006 — host allow-list wins): the resolved
    // /g/collect endpoint this instance was configured with.
    endpoints: [endpoint],
    // ADR-0007 consent-purpose annotation — gtag's OWN rationale, NOT
    // inherited from createGa4Connector's "no ads/personalization signal it
    // emits" wording (that wording does not hold for gtag, frame-critique
    // note): the beacon DOES carry `gcs`/`gcd` (Consent-Mode STATE/DEFAULTS,
    // 039-02/039-05) — but those fields COMMUNICATE the container's consent
    // DECISION (state carriage); they do not PERFORM ad egress themselves.
    // The beacon's own egress is a single analytics hit to /g/collect, so
    // `analytics_storage` is the sole governing purpose — `gcs`/`gcd` are
    // carried STATE, not a second egress purpose.
    purposes: {
      egress: ["analytics_storage"],
      endpoints: { [endpoint]: ["analytics_storage"] },
      cookies: {
        _ga: ["analytics_storage"],
        _ga_: ["analytics_storage"],
      },
    },
  };

  /**
   * gtag has no vendor SDK to boot (unlike alloy's `configure`) — ctx/
   * measurementId/endpoint all arrive via `config` at construction (mirrors
   * `createGa4Connector`'s own no-op `init`, connectors/ga4/connector.js:131-133).
   * Accepted for contract conformance only.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  function init(_caps) {
    // no-op — see doc comment above.
  }

  /**
   * Map one event to a single-element `EgressRequest[]` carrying ONE
   * `/g/collect` GET beacon (039-01's single-event scope — batched POST for
   * >=2 events is 039-04, deferred). The array wrapper matches the
   * `Connector.handle` contract (`contracts/connector.d.ts`) that
   * `core/connector-host.js` consumes via `for (const req of requests)`,
   * mirroring the sibling `connectors/pixel/connector.js` /
   * `connectors/ga4/connector.js` return shape. UNCHANGED by 041-01 (AC1).
   * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
   * @returns {Array<{ url: string, method: "GET" }>}
   */
  function handle(event) {
    return [mapToGtagCollect(event, { measurementId, ctx, endpoint })];
  }

  return { manifest, init, handle };
}
