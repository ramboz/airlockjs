/**
 * Floodlight (DC) page-load connector — spec 046-01 (`ccm/collect`) + spec 046-02 (the `;`-delimited
 * `activity` form), the gtag-family sibling to Google Ads (spec 044). The `ccm/collect` beacon is a
 * near-verbatim mirror of `connectors/google-ads/connector.js`: this slice is deliberately
 * reuse-complete (spec 046 §Overview) — same builder (`appendParam`/`&`), same 039/044 Consent-Mode
 * encoders (`connectors/consent-mode.js`), same `_gcl_au` read (`connectors/google-ads/cookies.js`'s
 * `sourceGoogleAdsCtx`, imported directly — NOT re-implemented, §A4: `auid`==`auiddc`==`_gcl_au`-
 * derived), same governed-GET egress shape (spec 026). Only the vendor id prefix (`DC-…` not
 * `AW-…`), the module name, and the manifest differ.
 *
 * THE A2 ENDPOINT DECISION (RESOLVED 2026-09-13, R-010 recon on `erp.intuit.com`): DC fires the
 * page-load beacon to `www.google.com/ccm/collect?tid=DC-<id>&en=page_view&...` — the SAME field
 * vocabulary + endpoint FAMILY as AW's own `ccm/collect` (`tid`/`en`/`dl`/`dt`/`auid`/`gcs`/`gcd`/
 * `npa`/`dma`), carried under the DC-specific `tid=DC-<id>` id. This connector ALSO reproduces the
 * sibling `;`-delimited `ad.doubleclick.net/activity` form (Floodlight-native `src`/`type`/`cat`
 * identity, `auiddc` — spec 046-02, `mapToDcActivity` below), via the path-delimited
 * `core/path-matrix.js` encoder (a distinct wire grammar from `appendParam`/`&`, deliberately not
 * reused — see that module's own doc comment). The activity beacon is OPT-IN: `handle()` below emits
 * it only when the Floodlight-native identity (`src`) is configured — a `src`-less connector emits
 * ONLY the `ccm/collect` beacon, byte-identical to 046-01.
 *
 * IDENTITY (AC3): `auid` is NOT sourced here — it arrives via `config.ctx`, sourced host-side by
 * `connectors/google-ads/cookies.js`'s `sourceGoogleAdsCtx` (read-when-present / omit-when-absent /
 * NEVER minted, spec 044 §A5, reused verbatim per spec 046 §A4 — DC's `auid` IS the `_gcl_au`-
 * derived value, not a distinct `_gcl_dc`). This connector never touches cookies, the DOM, or any
 * ambient global. Unlike AW, this beacon carries no inbound click ids (`gclid`/`wbraid`/`gbraid`) —
 * the field vocabulary this slice reproduces, per the committed fixture, is `tid`/`en`/`dl`/`dt`/
 * `auid`/`gcs`/`gcd`/`npa` only.
 *
 * CONSENT (AC2): `gcs`/`gcd`/`npa` are ALL the REUSED `connectors/consent-mode.js` encoders —
 * Floodlight is their 3rd (`gcs`/`gcd`) / 2nd (`npa`) caller; `npa` was EXTRACTED into that shared
 * module THIS slice out of `connectors/google-ads/connector.js` (the extract-on-third-caller
 * convention, docs/conventions.md § Code — see that module's doc comment for the rationale). The
 * manifest declares `purposes.egress: ["ad_storage"]` so THE SEAL can gate the whole beacon under
 * `ad_storage`-denial — activated by 046-03 (mirrors 044-02), not this slice.
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node, exactly like
 * `connectors/google-ads/connector.js`.
 */
import { appendParam } from "../../core/query-params.js";
import { appendMatrixParam, joinMatrixUrl } from "../../core/path-matrix.js";
import { encodeGcs, encodeGcd, encodeNpa } from "../consent-mode.js";

/** The Consent-Mode collect endpoint DC's `ccm/collect` page-load beacon shares with AW (spec 046
 *  §A2) — the DC conversion id rides the SAME `tid=DC-<id>` query param position AW uses for
 *  `tid=AW-<id>`. */
export const FLOODLIGHT_CCM_COLLECT_ENDPOINT = "https://www.google.com/ccm/collect";

/** The classic DoubleClick Floodlight `activity` endpoint (spec 046-02 §A2) — the `;`-delimited
 *  page-load beacon whose params ride the URL PATH as `;`-separated `key=value` segments
 *  (`ad.doubleclick.net/activity;src=<id>;type=<t>;cat=<c>;…`), carrying the Floodlight-native
 *  identity `src`/`type`/`cat` that `ccm/collect` does NOT. */
export const FLOODLIGHT_ACTIVITY_ENDPOINT = "https://ad.doubleclick.net/activity";

/** The `page_view` event this connector reproduces the page-load beacon for. A captured event of any
 *  OTHER type maps to `[]` (the zero-or-one gate, mirroring the AW/pixel/RUM connectors) — the true
 *  Floodlight CONVERSION activity (enhanced-match hashes) is MVP9, out of scope (spec 046 §A5). */
const PAGE_LOAD_EVENT = "page_view";

/**
 * Map one page-load event to the DC `ccm/collect` GET beacon — byte-for-byte the SAME builder as
 * `connectors/google-ads/connector.js`'s private `mapToAwCollect`, minus the AW-only inbound click-id
 * fields (`gclid`/`wbraid`/`gbraid`) DC's `ccm/collect` vocabulary does not carry.
 * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @param {{ conversionId: string, ctx: { auid?: string, consent?: Record<string,string>, consentDefault?: Record<string,string> }, endpoint: string }} config
 * @returns {{ url: string, method: "GET" }}
 */
function mapToDcCollect(event, { conversionId, ctx, endpoint }) {
  const source = (event && (event.params || event.payload)) || {};
  const query = [];

  appendParam(query, "tid", conversionId); // DC-<id> — the destination + auth (with origin), no secret
  appendParam(query, "en", event && event.type); // page_view
  appendParam(query, "dl", source.page_location);
  appendParam(query, "dt", source.page_title);

  // AC3: first-party linker id — projected verbatim from the host-sourced ctx, read-when-present /
  // omit-when-absent. `appendParam` omits an undefined value, so an absent `_gcl_au` (no `ctx.auid`)
  // leaves `auid` OFF the URL entirely — airlock never mints one (§A5, reused from AW's own rule).
  appendParam(query, "auid", ctx && ctx.auid);

  // AC2: Consent Mode v2 carriage — REUSED connectors/consent-mode.js encoders (each returns
  // `undefined` -> omitted for a pending governing signal / non-denied-all default).
  appendParam(query, "gcs", encodeGcs(ctx && ctx.consent));
  appendParam(query, "gcd", encodeGcd(ctx && ctx.consent, ctx && ctx.consentDefault));
  appendParam(query, "npa", encodeNpa(ctx && ctx.consent));

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Map one page-load event to the DC `;`-delimited `activity` GET beacon (spec 046-02). UNLIKE
 * `mapToDcCollect`'s `?a=b&c=d` query, this rides its params on the URL PATH as `;`-delimited
 * `key=value` segments (a matrix URI) via the NEW `core/path-matrix.js` `appendMatrixParam` builder —
 * the query builder is deliberately NOT reused (different wire grammar; see that module's doc).
 *
 * FIELD PROVENANCE (ADR-0020 — reproduce only what airlock can honestly derive; never fabricate):
 *  - `src`/`type`/`cat` — the Floodlight-native identity, config-provided (the deploying dev's
 *    Floodlight tag config), exactly as `conversionId` is for `ccm/collect`. `src` is emitted FIRST
 *    so the manifest's declared ceiling prefix (`/activity;src=<id>`) anchors the beacon (AC4).
 *  - `npa`/`gcs`/`gcd` — the SHARED `../consent-mode.js` encoders — byte-identical VALUES to the ccm
 *    beacon (AC2); ONLY the URL layout differs (`;`-path here vs `&`-query there).
 *  - `auiddc` — the SAME host-sourced `_gcl_au`-derived value as ccm's `auid` (§A4: `auid`==`auiddc`),
 *    read-when-present / omit-when-absent / never minted, emitted under the `auiddc` param name.
 * The remaining container wire fields (custom vars `u10`/`u12`/`u99`, enhanced-conversions
 * `em`/`user_data_mode`/`epver`, protocol `dc_fmt`, cachebusters `num`/`ord`, visitor `u20`, geo
 * `dma`, referrer `~oref`) are DELIBERATELY not emitted — airlock has no honest source for them; they
 * are owned gaps / normalised noise in `rig/parity/descriptors/floodlight-activity.js`, never
 * fabricated onto the wire.
 * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @param {{ src?: string, type?: string, cat?: string, ctx: { auid?: string, consent?: Record<string,string>, consentDefault?: Record<string,string> }, endpoint: string }} config
 * @returns {{ url: string, method: "GET" }}
 */
function mapToDcActivity(_event, { src, type, cat, ctx, endpoint }) {
  const segments = [];

  // The Floodlight-native identity — `src` FIRST (the ceiling prefix anchor, AC4).
  appendMatrixParam(segments, "src", src);
  appendMatrixParam(segments, "type", type);
  appendMatrixParam(segments, "cat", cat);

  // AC2: Consent Mode v2 — the SAME ../consent-mode.js encoders/values as the ccm beacon (each
  // returns undefined -> omitted for a pending governing signal / non-denied-all default).
  appendMatrixParam(segments, "npa", encodeNpa(ctx && ctx.consent));
  appendMatrixParam(segments, "gcs", encodeGcs(ctx && ctx.consent));
  appendMatrixParam(segments, "gcd", encodeGcd(ctx && ctx.consent, ctx && ctx.consentDefault));

  // §A4: the first-party linker id — the SAME host-sourced ctx.auid the ccm beacon carries as `auid`,
  // emitted here under the `auiddc` param name. Omitted when absent (never minted).
  appendMatrixParam(segments, "auiddc", ctx && ctx.auid);

  const url = joinMatrixUrl(endpoint, segments);
  return { url, method: "GET" };
}

/**
 * Ship the Floodlight (DC) page-load connector (046-01) as a `contracts/connector.d.ts` `Connector`
 * (`{ manifest, init, handle }`), hosted the SAME way `core/connector-host.js` hosts GA4-gtag/
 * Google-Ads/pixel.
 *
 * @param {Readonly<{
 *   conversionId: string,
 *   ctx?: { auid?: string, consent?: Record<string,string>, consentDefault?: Record<string,string> },
 *   endpoint?: string,
 * }>} [config] `conversionId` -> `tid` (the `DC-<id>`); `ctx` -> `auid` + the consent vector/declared
 *   default (see `mapToDcCollect`), sourced host-side by `sourceGoogleAdsCtx` (REUSED from
 *   `connectors/google-ads/cookies.js` verbatim — §A4); `endpoint` defaults to
 *   `FLOODLIGHT_CCM_COLLECT_ENDPOINT`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createFloodlightConnector(config = {}) {
  const {
    conversionId,
    // The Floodlight-native activity identity (046-02) — src/type/cat, config-provided exactly like
    // conversionId. `src` also anchors the activity endpoint's declared ceiling prefix, and its mere
    // PRESENCE (below) gates whether the activity beacon/endpoint exist at all.
    src,
    type,
    cat,
    ctx = {},
    endpoint = FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    activityEndpoint = FLOODLIGHT_ACTIVITY_ENDPOINT,
  } = config;

  // The activity beacon is OPT-IN, gated on the Floodlight-native identity being configured — a
  // `src`-less connector (the 046-01-style call, no activity identity) declares/emits ONLY the
  // ccm/collect beacon, byte-identical to 046-01 (AC5); mirrors the connector's own
  // read-when-present/omit-when-absent identity discipline, applied here to the beacon itself rather
  // than a single field. `null` is treated the same as `undefined` (never a distinct "configured"
  // state) — consistent with `appendMatrixParam`'s own omission rule.
  const hasActivityIdentity = src !== undefined && src !== null;

  // The DECLARED ceiling PREFIX for the `;`-delimited activity beacon (AC4): origin + `/activity` +
  // the `;src=<id>` identity segment, built with the SAME `appendMatrixParam` + `joinMatrixUrl` pair
  // `mapToDcActivity` uses for the emitted URL's own first segment — ONE shared home (`core/
  // path-matrix.js`) for both sides of the join, so `core/endpoint-ceiling.js`'s segment-anchored
  // prefix match admits the beacon despite the per-request `num`/`ord` cachebuster that rides the
  // rest of the path (a duplicated join could silently drift the two apart).
  const activitySrcSegment = [];
  appendMatrixParam(activitySrcSegment, "src", src);
  const activityCeilingEndpoint = joinMatrixUrl(activityEndpoint, activitySrcSegment);

  const manifest = {
    name: "airlock/floodlight",
    // The page-load beacon fires on page_view (contrast GA4-gtag's `["*"]` catch-all): a captured
    // event of any other type maps to [] — the true conversion activity ping is MVP9 (§A5).
    events: [PAGE_LOAD_EVENT],
    // `reads` = PROJECTION snapshot fields (ADR-0003 default-deny). handle() reads the event PAYLOAD
    // + host-sourced ctx, never event.snapshot -> EMPTY (same as the AW/GA4/pixel connectors).
    reads: [],
    capabilities: {
      // The first-party conversion-linker cookie airlock READS host-side for `auid` (never writes —
      // §A5, via the REUSED sourceGoogleAdsCtx). Declared for MVP3 disclosure.
      cookies: ["_gcl_au"],
      egress: true,
    },
    // ADVISORY endpoints (ADR-0006 — host allow-list wins): the fixed `ccm/collect` (046-01, exact
    // origin+path) endpoint ALWAYS; the `;`-matrix `activity` prefix (046-02, segment-anchored prefix
    // match) ONLY when the activity identity is configured (`hasActivityIdentity`) — a `src`-less
    // connector declares a single endpoint, exactly like 046-01 (AC5).
    endpoints: hasActivityIdentity ? [endpoint, activityCeilingEndpoint] : [endpoint],
    // ADR-0007 consent-purpose annotation: each DECLARED page-load beacon's egress is governed by
    // `ad_storage` — declaring it here is what lets THE SEAL hold them under `ad_storage`-denial
    // (046-03). `gcs`/`gcd`/`npa` COMMUNICATE the consent decision (carried state), they are not a
    // second egress purpose. The `_gcl_au` read is `ad_storage`-purposed too (AC3's gate).
    purposes: {
      egress: ["ad_storage"],
      endpoints: hasActivityIdentity
        ? { [endpoint]: ["ad_storage"], [activityCeilingEndpoint]: ["ad_storage"] }
        : { [endpoint]: ["ad_storage"] },
      cookies: { _gcl_au: ["ad_storage"] },
    },
  };

  /**
   * No vendor SDK to boot — conversionId/ctx/endpoint all arrive via `config` at construction
   * (mirrors createGoogleAdsConnector's own no-op init). Accepted for contract conformance only.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  function init(_caps) {
    // no-op — see doc comment above.
  }

  /**
   * Map one page-load event to this connector's DC page-load GET beacon(s) (spec 046-02): the
   * `ccm/collect` query beacon (046-01, UNCHANGED, always index 0) ALONE — a length-1 array,
   * byte-identical to 046-01 — when no activity identity is configured (`hasActivityIdentity` false,
   * AC5); `[ccm, activity]`, with the `;`-delimited `activity` beacon (046-02) appended at index 1,
   * when `src` IS configured. Only `page_view` maps; any other event -> `[]`, never a throw and never
   * a partial beacon — mirroring the AW/pixel/RUM connectors' zero-or-one gate (here
   * zero-or-one-or-two).
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    if (!event || event.type !== PAGE_LOAD_EVENT) return []; // this connector maps only the page-load beacon
    // 046-03 (045-01's additive-optional `EgressRequest.event` channel, mirroring 044-02): attach the
    // SOURCE event to EACH ready request so a future `holdOnDenied` seal can REBUILD the beacon under
    // the now-current consent on a grant-flush, instead of re-sending the stale under-denial payload.
    // Additive-only — a connector/seal that does not opt in never reads this field; harmless here.
    // AC5: the ccm/collect beacon is byte-UNCHANGED from 046-01 and stays index 0.
    const requests = [{ ...mapToDcCollect(event, { conversionId, ctx, endpoint }), event }];
    // The activity beacon is OPT-IN — see hasActivityIdentity's own doc comment above.
    if (hasActivityIdentity) {
      requests.push({ ...mapToDcActivity(event, { src, type, cat, ctx, endpoint: activityEndpoint }), event });
    }
    return requests;
  }

  return { manifest, init, handle };
}
