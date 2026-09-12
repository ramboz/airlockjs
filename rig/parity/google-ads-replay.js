/**
 * Google Ads (AW) replay orchestration — spec 044-01 AC4 (mirrors `rig/parity/ga4-replay.js`).
 * Factors the ctx-source -> `handle` -> flatten pipeline that `run-google-ads.mjs` and the tests
 * both need into ONE place, so the CLI and the tests cannot drift and `emitted` is DERIVED, not
 * hardcoded. Sources `auid` from the FIXTURE's own `_gcl_au` cookie (AC4 — never the captured
 * beacon's `auid` field, which would be a tautological false-green on the very identity field the
 * oracle checks), exactly as `ga4-ctx.js` sources `cid`/`sid` from the fixture's cookies. Reuses
 * 038-01's generic `fieldsFromUrl` GET-beacon parser (`rig/parity/replay.js`).
 */
import { createGoogleAdsConnector } from "../../connectors/google-ads/connector.js";
import { sourceGoogleAdsCtx } from "../../connectors/google-ads/cookies.js";
import { googleAdsParityDescriptor } from "./descriptors/google-ads.js";
import { SYNTHETIC_AW_CONVERSION_ID } from "./redact-google-ads.js";
import { fieldsFromUrl } from "./replay.js";

/** The all-four-granted host consent vector a real page WOULD have resolved to produce the fixture's
 *  live-observed granted-state carriage (`gcs=G111` / `gcd=13r3r3r3r5l1` / `npa=0`). `consent` is not
 *  cookie-derived (unlike `auid`), so it has no `sourceGoogleAdsCtx` equivalent — threaded here the
 *  same way `test/ga4-gtag.test.js` threads its granted vector (the declared default is left unset,
 *  defaulting to denied-all per `encodeGcd`'s rule — the reference page's own declared default). */
const GRANTED_CONSENT = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/**
 * Cookie map -> raw `document.cookie` string (a harness-only convenience; mirrors `ga4-ctx.js`'s
 * `cookieMapToString`).
 * @param {Readonly<Record<string,string>>} [cookieMap]
 * @returns {string}
 */
function cookieMapToString(cookieMap) {
  return Object.entries(cookieMap || {})
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Replay a redacted AW `ccm/collect` fixture through airlock's real Google Ads connector to a flat
 * field-set the oracle can diff. `emitted:false` (with `{}` fields) when the container event name
 * maps to no airlock event (the connector's zero-or-one gate) — a reportable result.
 * @param {Object} args
 * @param {{ container_fields: Record<string,string>, cookies?: Record<string,string> }} args.fixture
 * @param {import("./oracle").ParityDescriptor} [args.descriptor] defaults to the AW descriptor.
 * @returns {{ emitted: boolean, fields: Record<string,string> }}
 */
export function replayGoogleAdsEgress({ fixture, descriptor = googleAdsParityDescriptor }) {
  const logicalEvent = descriptor.deriveLogicalEvent(fixture.container_fields);
  if (logicalEvent.type == null) return { emitted: false, fields: {} };

  // Source auid from the fixture's OWN _gcl_au cookie + click ids from the landing URL (the fixture's
  // dl) — the SAME first-party sources a real host reads, never a beacon back-feed (AC4).
  const ctx = sourceGoogleAdsCtx({
    cookieString: cookieMapToString(fixture.cookies),
    landingUrl: fixture.container_fields.dl || "",
    adStorageGranted: true,
  });

  const connector = createGoogleAdsConnector({
    conversionId: SYNTHETIC_AW_CONVERSION_ID,
    ctx: { ...ctx, consent: GRANTED_CONSENT },
  });
  const requests = connector.handle({ type: logicalEvent.type, params: logicalEvent.params });
  if (!requests.length) return { emitted: false, fields: {} };
  return { emitted: true, fields: fieldsFromUrl(requests[0].url) };
}
