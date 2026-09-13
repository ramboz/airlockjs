/**
 * Floodlight (DC) `;`-delimited `activity` replay orchestration — spec 046-02 AC3 (the SIBLING of
 * `rig/parity/floodlight-ccm-replay.js`, for the activity form). Factors the ctx-source -> `handle`
 * -> flatten pipeline that `run-floodlight-activity.mjs` and the tests both need into ONE place, so
 * the CLI and the tests cannot drift and `emitted` is DERIVED, not hardcoded.
 *
 * Two things distinguish this from the ccm replay:
 *  1. It configures the Floodlight-native identity (`src`/`type`/`cat`) from the SYNTHETIC redactor
 *     constants — so airlock's emitted identity matches the redacted fixture's identity (an identity
 *     compare, not a shape compare). `auiddc` still comes from the FIXTURE's own `_gcl_au` cookie
 *     (never the beacon's `auiddc` field, which would be a tautological false-green), via the SAME
 *     `sourceGoogleAdsCtx` REUSED from `connectors/google-ads/cookies.js` (§A4).
 *  2. It selects the ACTIVITY beacon out of `handle`'s length-2 `[ccm, activity]` return and flattens
 *     it with `fieldsFromMatrixUrl` (the `;`-path parser) — NOT `fieldsFromUrl` (the query parser the
 *     ccm replay uses), because a matrix-URI wire has no query string for `URLSearchParams` to read.
 */
import {
  createFloodlightConnector,
  FLOODLIGHT_ACTIVITY_ENDPOINT,
} from "../../connectors/floodlight/connector.js";
import { sourceGoogleAdsCtx } from "../../connectors/google-ads/cookies.js";
import { floodlightActivityParityDescriptor } from "./descriptors/floodlight-activity.js";
import { SYNTHETIC_DC_CONVERSION_ID } from "./redact-floodlight-ccm.js";
import {
  SYNTHETIC_DC_SRC,
  SYNTHETIC_DC_TYPE,
  SYNTHETIC_DC_CAT,
} from "./redact-floodlight-activity.js";
import { fieldsFromMatrixUrl } from "./replay.js";

/** The all-four-granted host consent vector a real page WOULD have resolved to produce the fixture's
 *  live-observed granted-state carriage (`gcs=G111` / `gcd=13r3r3r3r5l1` / `npa=0`) — the SAME
 *  vector `floodlight-ccm-replay.js` threads (both DC forms share the container's own Consent-Mode
 *  declaration, R-010). The declared default is left unset, defaulting to denied-all per
 *  `encodeGcd`'s rule — the reference page's own declared default. */
const GRANTED_CONSENT = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/**
 * Cookie map -> raw `document.cookie` string (a harness-only convenience; mirrors
 * `floodlight-ccm-replay.js`'s own `cookieMapToString`).
 * @param {Readonly<Record<string,string>>} [cookieMap]
 * @returns {string}
 */
function cookieMapToString(cookieMap) {
  return Object.entries(cookieMap || {})
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Replay a redacted DC `activity` fixture through airlock's real Floodlight connector to a flat
 * field-set the oracle can diff. `emitted:false` (with `{}` fields) when the container event maps to
 * no airlock event, or the connector emits no activity beacon — a reportable result.
 * @param {Object} args
 * @param {{ container_fields: Record<string,string>, cookies?: Record<string,string> }} args.fixture
 * @param {import("./oracle").ParityDescriptor} [args.descriptor] defaults to the floodlight-activity descriptor.
 * @returns {{ emitted: boolean, fields: Record<string,string> }}
 */
export function replayFloodlightActivityEgress({ fixture, descriptor = floodlightActivityParityDescriptor }) {
  const logicalEvent = descriptor.deriveLogicalEvent(fixture.container_fields);
  if (logicalEvent.type == null) return { emitted: false, fields: {} };

  // Source auiddc from the fixture's OWN _gcl_au cookie — the SAME first-party source a real host
  // reads, never a beacon back-feed (AC3/§A4). sourceGoogleAdsCtx yields ctx.auid; the connector
  // emits it under the `auiddc` param name for the activity form.
  const ctx = sourceGoogleAdsCtx({
    cookieString: cookieMapToString(fixture.cookies),
    adStorageGranted: true,
  });

  const connector = createFloodlightConnector({
    conversionId: SYNTHETIC_DC_CONVERSION_ID,
    src: SYNTHETIC_DC_SRC,
    type: SYNTHETIC_DC_TYPE,
    cat: SYNTHETIC_DC_CAT,
    ctx: { ...ctx, consent: GRANTED_CONSENT },
  });
  const requests = connector.handle({ type: logicalEvent.type, params: logicalEvent.params });
  // handle() returns [ccm, activity]; select the ACTIVITY (;-delimited) beacon by its endpoint.
  const activity = requests.find((r) => r.url.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT));
  if (!activity) return { emitted: false, fields: {} };
  return { emitted: true, fields: fieldsFromMatrixUrl(activity.url) };
}
