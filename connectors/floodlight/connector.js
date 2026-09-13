/**
 * Floodlight (DC) page-load connector — spec 046-01, the gtag-family sibling to Google Ads (spec
 * 044). A near-verbatim mirror of `connectors/google-ads/connector.js`: this slice is deliberately
 * reuse-complete (spec 046 §Overview) — same builder (`appendParam`/`&`), same 039/044 Consent-Mode
 * encoders (`connectors/consent-mode.js`), same `_gcl_au` read (`connectors/google-ads/cookies.js`'s
 * `sourceGoogleAdsCtx`, imported directly — NOT re-implemented, §A4: `auid`==`auiddc`==`_gcl_au`-
 * derived), same governed-GET egress shape (spec 026). Only the vendor id prefix (`DC-…` not
 * `AW-…`), the module name, and the manifest differ.
 *
 * THE A2 ENDPOINT DECISION (RESOLVED 2026-09-13, R-010 recon on `erp.intuit.com`): DC fires the
 * page-load beacon to `www.google.com/ccm/collect?tid=DC-<id>&en=page_view&...` — the SAME field
 * vocabulary + endpoint FAMILY as AW's own `ccm/collect` (`tid`/`en`/`dl`/`dt`/`auid`/`gcs`/`gcd`/
 * `npa`/`dma`), carried under the DC-specific `tid=DC-<id>` id. This connector reproduces that ONE
 * beacon; the sibling `;`-delimited `ad.doubleclick.net/activity` form (Floodlight-native `src`/
 * `type`/`cat` identity, `auiddc`) is 046-02 (new machinery — a path-delimited encoder, out of scope
 * here).
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
import { encodeGcs, encodeGcd, encodeNpa } from "../consent-mode.js";

/** The Consent-Mode collect endpoint DC's `ccm/collect` page-load beacon shares with AW (spec 046
 *  §A2) — the DC conversion id rides the SAME `tid=DC-<id>` query param position AW uses for
 *  `tid=AW-<id>`. */
export const FLOODLIGHT_CCM_COLLECT_ENDPOINT = "https://www.google.com/ccm/collect";

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
  const { conversionId, ctx = {}, endpoint = FLOODLIGHT_CCM_COLLECT_ENDPOINT } = config;

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
    // ADVISORY endpoint (ADR-0006 — host allow-list wins): the resolved ccm/collect endpoint.
    endpoints: [endpoint],
    // ADR-0007 consent-purpose annotation: Floodlight remarketing/activity egress is governed by
    // `ad_storage` — declaring it here is what lets THE SEAL hold the beacon under `ad_storage`-
    // denial (046-03). `gcs`/`gcd`/`npa` COMMUNICATE the consent decision (carried state), they are
    // not a second egress purpose. The `_gcl_au` read is `ad_storage`-purposed too (AC3's gate).
    purposes: {
      egress: ["ad_storage"],
      endpoints: { [endpoint]: ["ad_storage"] },
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
   * Map one event to a zero-or-one `EgressRequest[]` carrying the DC ccm/collect GET beacon. Only
   * `page_view` maps (the page-load beacon); any other event -> `[]`, never a throw and never a
   * partial beacon — mirroring the AW/pixel/RUM connectors' zero-or-one gate.
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    if (!event || event.type !== PAGE_LOAD_EVENT) return []; // this connector maps only the page-load beacon
    // 046-03 (045-01's additive-optional `EgressRequest.event` channel, mirroring 044-02): attach the
    // SOURCE event to the ready request so a future `holdOnDenied` seal can REBUILD this beacon under
    // the now-current consent on a grant-flush, instead of re-sending the stale under-denial payload.
    // Additive-only — a connector/seal that does not opt in never reads this field; harmless here.
    return [{ ...mapToDcCollect(event, { conversionId, ctx, endpoint }), event }];
  }

  return { manifest, init, handle };
}
