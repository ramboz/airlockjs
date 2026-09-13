/**
 * Floodlight (DC) `ccm/collect` replay orchestration — spec 046-01 AC4 (mirrors
 * `rig/parity/google-ads-replay.js`). Factors the ctx-source -> `handle` -> flatten pipeline that
 * `run-floodlight-ccm.mjs` and the tests both need into ONE place, so the CLI and the tests cannot
 * drift and `emitted` is DERIVED, not hardcoded. Sources `auid` from the FIXTURE's own `_gcl_au`
 * cookie (AC4 — never the captured beacon's `auid` field, which would be a tautological false-green
 * on the very identity field the oracle checks), via the SAME `sourceGoogleAdsCtx` REUSED from spec
 * 044 / `connectors/google-ads/cookies.js` (spec 046 §A4: `auid`==`_gcl_au`-derived — no separate
 * Floodlight cookie reader). Reuses 038-01's generic `fieldsFromUrl` GET-beacon parser
 * (`rig/parity/replay.js`).
 */
import { createFloodlightConnector } from "../../connectors/floodlight/connector.js";
import { sourceGoogleAdsCtx } from "../../connectors/google-ads/cookies.js";
import { floodlightCcmParityDescriptor } from "./descriptors/floodlight-ccm.js";
import { SYNTHETIC_DC_CONVERSION_ID } from "./redact-floodlight-ccm.js";
import { fieldsFromUrl } from "./replay.js";

/** The all-four-granted host consent vector a real page WOULD have resolved to produce the fixture's
 *  live-observed granted-state carriage (`gcs=G111` / `gcd=13r3r3r3r5l1` / `npa=0`) — the SAME
 *  vector `google-ads-replay.js` threads (both DC and AW share the container's own Consent-Mode
 *  declaration, R-009/R-010). The declared default is left unset, defaulting to denied-all per
 *  `encodeGcd`'s rule — the reference page's own declared default. */
const GRANTED_CONSENT = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/**
 * Cookie map -> raw `document.cookie` string (a harness-only convenience; mirrors
 * `google-ads-replay.js`'s own `cookieMapToString`).
 * @param {Readonly<Record<string,string>>} [cookieMap]
 * @returns {string}
 */
function cookieMapToString(cookieMap) {
  return Object.entries(cookieMap || {})
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Replay a redacted DC `ccm/collect` fixture through airlock's real Floodlight connector to a flat
 * field-set the oracle can diff. `emitted:false` (with `{}` fields) when the container event name
 * maps to no airlock event (the connector's zero-or-one gate) — a reportable result.
 * @param {Object} args
 * @param {{ container_fields: Record<string,string>, cookies?: Record<string,string> }} args.fixture
 * @param {import("./oracle").ParityDescriptor} [args.descriptor] defaults to the floodlight-ccm descriptor.
 * @returns {{ emitted: boolean, fields: Record<string,string> }}
 */
export function replayFloodlightCcmEgress({ fixture, descriptor = floodlightCcmParityDescriptor }) {
  const logicalEvent = descriptor.deriveLogicalEvent(fixture.container_fields);
  if (logicalEvent.type == null) return { emitted: false, fields: {} };

  // Source auid from the fixture's OWN _gcl_au cookie — the SAME first-party source a real host
  // reads, never a beacon back-feed (AC4). No landing-URL click-id read: DC's ccm/collect ctx is
  // just { auid }, unlike AW's own gclid/wbraid/gbraid carriage (this connector does not read them).
  const ctx = sourceGoogleAdsCtx({
    cookieString: cookieMapToString(fixture.cookies),
    adStorageGranted: true,
  });

  const connector = createFloodlightConnector({
    conversionId: SYNTHETIC_DC_CONVERSION_ID,
    ctx: { ...ctx, consent: GRANTED_CONSENT },
  });
  const requests = connector.handle({ type: logicalEvent.type, params: logicalEvent.params });
  if (!requests.length) return { emitted: false, fields: {} };
  return { emitted: true, fields: fieldsFromUrl(requests[0].url) };
}
