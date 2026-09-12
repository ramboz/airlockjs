/**
 * Google Ads (AW) page-load connector — spec 044-01, implementing the gtag-family model
 * (ADR-0019). A NEW module in the gtag family: it REUSES spec 039's Consent-Mode encoders
 * (`connectors/consent-mode.js`, extracted this slice) + spec 026's governed GET egress, rather than
 * forking either the GA4 gtag connector (no GA4 session state here) or the pixel config (no
 * Consent-Mode carriage there) — the arch-review-ratified shape (spec 044 §Overview).
 *
 * THE A1 ENDPOINT DECISION (grounded on the 2026-09-11 R-009 §(b) `erp.intuit.com` capture). The
 * AW tag fires FOUR page-load endpoints; this connector reproduces the **`ccm/collect`** one:
 *   - `www.google.com/ccm/collect?tid=AW-<id>&en=page_view&...` — CHOSEN. The only AW page-load
 *     beacon carrying the FULL Consent-Mode v2 pair (`gcs` STATE + `gcd` DEFAULTS + `npa`) AND clean
 *     `tid`/`en`/`dl`/`dt`/`auid` fields — the SAME vocabulary the 039 `/g/collect` connector
 *     already emits, so it is a true same-protocol sibling the 038 oracle can field-diff.
 *   - `googleads.g.doubleclick.net/pagead/viewthroughconversion/<id>/` + `www.google.com/rmkt/
 *     collect/<id>/` — REJECTED as a mutual MIRROR PAIR (the capture confirms A1's hypothesis:
 *     identical query params modulo `fmt`/`ept`/`gcp`), and both carry ONLY `gcd` (no `gcs` STATE),
 *     encode the event opaquely as `data=event%3Dpage_view`, and are dominated by environmental
 *     client-hint/device fields — no clean attribution vocabulary to verify.
 *   - `www.google.com/ccm/form-data/<id>` — REJECTED: the enhanced-conversions channel
 *     (`ec_mode=c`, `em=tv.1` typed-value flags). The hashed match egresses only on a CONVERSION
 *     event, so on a page-load it carries no attribution the oracle can verify (spec 044 §A3, MVP9).
 *
 * IDENTITY (AC3): `auid` (from `_gcl_au`) + inbound `gclid`/`wbraid`/`gbraid` are NOT sourced here —
 * they arrive via `config.ctx`, sourced host-side by `connectors/google-ads/cookies.js`'s
 * `sourceGoogleAdsCtx` (read-when-present / omit-when-absent / NEVER minted, §A5). This connector
 * never touches cookies, the DOM, or any ambient global.
 *
 * CONSENT (AC2): `gcs`/`gcd` are the REUSED `connectors/consent-mode.js` encoders (byte-identical to the
 * GA4 gtag carriage); `npa` (non-personalized ads) is a small AW-local derivation (039 emits no
 * `npa`). The manifest declares `purposes.egress: ["ad_storage"]` so THE SEAL can gate the whole
 * beacon under `ad_storage`-denial (slice 044-02, seal-hold) — this slice wires only the granted
 * (happy) path; it does not implement the denied-path hold.
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node, exactly like
 * `connectors/ga4/gtag.js` and `connectors/pixel/connector.js`.
 */
import { appendParam } from "../../core/query-params.js";
import { encodeGcs, encodeGcd } from "../consent-mode.js";
import { resolveConsent } from "../../core/consent.js";

/** The Consent-Mode collect endpoint for the AW tag (production) — the AW conversion id rides the
 *  `tid=AW-<id>` query param, NOT the path, unlike the `viewthroughconversion`/`rmkt` mirrors. */
export const GOOGLE_ADS_CCM_COLLECT_ENDPOINT = "https://www.google.com/ccm/collect";

/** The `page_view` event this connector reproduces the page-load remarketing beacon for. A captured
 *  event of any OTHER type maps to `[]` (the zero-or-one gate, mirroring the pixel/RUM connectors) —
 *  the true AW CONVERSION ping (a conversion event) is MVP9, out of scope (spec 044 §A3). */
const PAGE_LOAD_EVENT = "page_view";

/** The two DATA-USE purposes governing `npa` (non-personalized ads). */
const NPA_PURPOSES = ["ad_user_data", "ad_personalization"];

/**
 * Encode the `npa` (non-personalized ads) flag from the host consent vector: `"0"` (personalized
 * ads OK — the live-observed granted-state anchor `npa=0`, R-009 §(b)) when BOTH `ad_user_data` and
 * `ad_personalization` are granted, `"1"` (non-personalized) otherwise. A NEW AW-local derivation:
 * spec 039's gtag connector emits no `npa`, so it is not one of the extracted `connectors/consent-mode.js`
 * encoders — kept connector-local until a 2nd consumer (Floodlight, a sibling spec) triggers
 * the extract-on-third-caller convention (docs/conventions.md § Code). `npa` is always present (a single digit; unlike the joint `gcs`/`gcd`
 * strings, it is never omitted). This slice asserts only the granted anchor (`npa=0`); the denied
 * beacon is held at the seal (slice 044-02) rather than sent with `npa=1`.
 * @param {Record<string, string>|null|undefined} vector the host consent vector.
 * @returns {"0"|"1"}
 */
export function encodeNpa(vector) {
  const granted = NPA_PURPOSES.every((purpose) => resolveConsent(vector, purpose) === "granted");
  return granted ? "0" : "1";
}

/**
 * Map one page-load event to the AW `ccm/collect` GET beacon.
 * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @param {{ conversionId: string, ctx: { auid?: string, gclid?: string, wbraid?: string, gbraid?: string, consent?: Record<string,string>, consentDefault?: Record<string,string> }, endpoint: string }} config
 * @returns {{ url: string, method: "GET" }}
 */
function mapToAwCollect(event, { conversionId, ctx, endpoint }) {
  const source = (event && (event.params || event.payload)) || {};
  const query = [];

  appendParam(query, "tid", conversionId); // AW-<id> — the destination + auth (with origin), no secret
  appendParam(query, "en", event && event.type); // page_view
  appendParam(query, "dl", source.page_location);
  appendParam(query, "dt", source.page_title);

  // AC3: first-party linker id + inbound click ids — projected verbatim from the host-sourced ctx,
  // read-when-present / omit-when-absent. `appendParam` omits an undefined value, so an absent
  // `_gcl_au` (no `ctx.auid`) leaves `auid` OFF the URL entirely — airlock never mints one (§A5).
  appendParam(query, "auid", ctx && ctx.auid);
  appendParam(query, "gclid", ctx && ctx.gclid);
  appendParam(query, "wbraid", ctx && ctx.wbraid);
  appendParam(query, "gbraid", ctx && ctx.gbraid);

  // AC2: Consent Mode v2 carriage. `gcs`/`gcd` are the REUSED connectors/consent-mode.js encoders (each
  // returns `undefined` -> omitted for a pending governing signal / non-denied-all default); `npa`
  // is the AW-local derivation above.
  appendParam(query, "gcs", encodeGcs(ctx && ctx.consent));
  appendParam(query, "gcd", encodeGcd(ctx && ctx.consent, ctx && ctx.consentDefault));
  appendParam(query, "npa", encodeNpa(ctx && ctx.consent));

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Ship the Google Ads (AW) page-load connector (044-01) as a `contracts/connector.d.ts` `Connector`
 * (`{ manifest, init, handle }`), hosted the SAME way `core/connector-host.js` hosts GA4-gtag/pixel.
 *
 * @param {Readonly<{
 *   conversionId: string,
 *   ctx?: { auid?: string, gclid?: string, wbraid?: string, gbraid?: string, consent?: Record<string,string>, consentDefault?: Record<string,string> },
 *   endpoint?: string,
 * }>} [config] `conversionId` -> `tid` (the `AW-<id>`); `ctx` -> `auid`/click ids + the consent
 *   vector/declared default (see `mapToAwCollect`), sourced host-side by `sourceGoogleAdsCtx`;
 *   `endpoint` defaults to `GOOGLE_ADS_CCM_COLLECT_ENDPOINT`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createGoogleAdsConnector(config = {}) {
  const { conversionId, ctx = {}, endpoint = GOOGLE_ADS_CCM_COLLECT_ENDPOINT } = config;

  const manifest = {
    name: "airlock/google-ads",
    // The page-load remarketing beacon fires on page_view (contrast GA4-gtag's `["*"]` catch-all):
    // a captured event of any other type maps to [] — the conversion ping is MVP9 (§A3).
    events: [PAGE_LOAD_EVENT],
    // `reads` = PROJECTION snapshot fields (ADR-0003 default-deny). handle() reads the event PAYLOAD
    // + host-sourced ctx, never event.snapshot -> EMPTY (same as the GA4/pixel connectors).
    reads: [],
    capabilities: {
      // The first-party conversion-linker cookie airlock READS host-side for `auid` (never writes —
      // §A5). Declared for MVP3 disclosure; sourceGoogleAdsCtx is the (host-side) source.
      cookies: ["_gcl_au"],
      egress: true,
    },
    // ADVISORY endpoint (ADR-0006 — host allow-list wins): the resolved ccm/collect endpoint.
    endpoints: [endpoint],
    // ADR-0007 consent-purpose annotation: Google Ads remarketing/conversion egress is governed by
    // `ad_storage` — declaring it here is what lets THE SEAL hold the beacon under `ad_storage`-denial
    // (slice 044-02). `gcs`/`gcd`/`npa` COMMUNICATE the consent decision (carried state), they are
    // not a second egress purpose. The `_gcl_au` read is `ad_storage`-purposed too (AC3's gate).
    purposes: {
      egress: ["ad_storage"],
      endpoints: { [endpoint]: ["ad_storage"] },
      cookies: { _gcl_au: ["ad_storage"] },
    },
  };

  /**
   * No vendor SDK to boot — conversionId/ctx/endpoint all arrive via `config` at construction
   * (mirrors createGa4GtagConnector's own no-op init). Accepted for contract conformance only.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  function init(_caps) {
    // no-op — see doc comment above.
  }

  /**
   * Map one event to a zero-or-one `EgressRequest[]` carrying the AW ccm/collect GET beacon. Only
   * `page_view` maps (the page-load remarketing beacon); any other event -> `[]`, never a throw and
   * never a partial beacon — mirroring the pixel/RUM connectors' zero-or-one gate.
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    if (!event || event.type !== PAGE_LOAD_EVENT) return []; // this connector maps only the page-load beacon
    return [mapToAwCollect(event, { conversionId, ctx, endpoint })];
  }

  return { manifest, init, handle };
}
