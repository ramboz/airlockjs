/**
 * Google Ads (AW) first-party identity sourcing — spec 044-01 (AC3). Reads the conversion-linker
 * cookie `_gcl_au` into the `auid` query param and inbound click ids (`gclid`/`wbraid`/`gbraid`)
 * out of the landing URL, host-side (the connector/chamber stays cookie-free + DOM-free, ADR-0003).
 * The HOST runs this on the main thread and threads the result onto `config.ctx`, exactly as the
 * GA4 path threads `sourceGa4Ctx`'s `{ clientId, sessionId }`.
 *
 * THE READ HALF ONLY — deliberately UNLIKE `connectors/ga4/cookies.js`'s `sourceGa4Ctx`, which
 * MINTS an arbitrary-but-valid `_ga` client id when absent. `_gcl_au` encodes a REAL Google-Ads
 * click signal a fabricated value would corrupt (polluting remarketing audiences), so airlock
 * forwards it or omits it, NEVER invents it: absent `_gcl_au` -> `auid` omitted, full stop (spec 044
 * §A5, the named `_gcl_au`-writer residual). Same read-when-present / omit-when-absent rule for the
 * inbound click ids (a direct load carries none — R-009 §(c)).
 *
 * Pure — no `document`, no globals: the raw cookie string + landing URL are handed in. Cookie value
 * reading uses the shared `core/cookie-parse.js` exact-name accessor (043-01).
 */
import { getCookieValue } from "../../core/cookie-parse.js";

const DIGITS = /^\d+$/;

/**
 * Extract the `auid` query value from a raw `_gcl_au` cookie value: the last two dotted segments
 * `<random>.<unix-seconds>` (both numeric), tolerant of the `<version>.<depth>.` prefix
 * (`1.1.<random>.<seconds>`). The extraction RULE coincides with `parseGaClientId`
 * (`connectors/ga4/cookies.js`) today, but `_gcl_au` is a DISTINCT (community-derived, Google-Ads
 * conversion-linker) cookie grammar — kept separate per the extract-on-third-caller convention's
 * rule-of-three (this is the 2nd
 * "last-two-dotted-segments" caller, not the 3rd). Degrades to `null` on any malformed/absent shape,
 * never throws — mirroring the GA4 cookie parsers' standing discipline.
 * @param {string|null|undefined} value raw `_gcl_au` cookie value.
 * @returns {string|null} the `auid` (`<random>.<seconds>`), or null on any malformed/absent shape.
 */
export function parseGclAuId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 2) return null;
  const random = parts[parts.length - 2];
  const seconds = parts[parts.length - 1];
  if (!DIGITS.test(random) || !DIGITS.test(seconds)) return null;
  return `${random}.${seconds}`;
}

/** The inbound Google-Ads click-id URL params, forwarded 1:1 as their own query params when the
 *  landing URL carries them. `gclid` = the classic click id; `wbraid`/`gbraid` = the app/web
 *  privacy-safe click ids (iOS/consent contexts). */
const CLICK_ID_PARAMS = ["gclid", "wbraid", "gbraid"];

/**
 * Read inbound Google-Ads click ids from a landing URL's query string — forward-when-present /
 * omit-when-absent (never minted). An empty-string param value is treated as absent.
 * @param {string|null|undefined} landingUrl the page's landing URL (`document.location`).
 * @returns {Record<string, string>} a subset of `{ gclid, wbraid, gbraid }` — only those present.
 */
export function readClickIds(landingUrl) {
  /** @type {Record<string, string>} */
  const out = {};
  if (typeof landingUrl !== "string" || landingUrl.length === 0) return out;
  let searchParams;
  try {
    searchParams = new URL(landingUrl).searchParams;
  } catch {
    return out; // malformed URL -> no click ids, never throw
  }
  for (const param of CLICK_ID_PARAMS) {
    const value = searchParams.get(param);
    if (value !== null && value !== "") out[param] = value;
  }
  return out;
}

/**
 * Source the Google Ads ctx (`auid` + inbound click ids) host-side. The `_gcl_au` READ is
 * `ad_storage`-gated (017-02's gate discipline, mirroring `sourceGa4Ctx`'s `storageGranted`):
 * under denial the persisted linker cookie is not even read (reading it would itself be USING denied
 * `ad_storage`). Click ids come from the landing URL, not storage, so they are not `ad_storage`-gated
 * here (the whole AW beacon is held at the seal under `ad_storage`-denial — slice 044-02 — which is
 * where consent gates egress; this function only sources what a granted page would carry).
 *
 * @param {object} opts
 * @param {string} [opts.cookieString] raw `document.cookie` (or equivalent jar) string.
 * @param {string} [opts.landingUrl] the page's landing URL for inbound click-id discovery.
 * @param {boolean} [opts.adStorageGranted] the resolved `ad_storage` grant
 *   (`resolveConsent(vector, "ad_storage") === "granted"`). Defaults `true` — back-compat for a
 *   caller with no consent vector wired (mirrors `sourceGa4Ctx`'s own default). `false` -> no
 *   `_gcl_au` read (no `auid`).
 * @returns {{ auid?: string, gclid?: string, wbraid?: string, gbraid?: string }} the ctx fields to
 *   thread onto `config.ctx` — each present ONLY when actually sourced (never minted).
 */
export function sourceGoogleAdsCtx({ cookieString = "", landingUrl = "", adStorageGranted = true } = {}) {
  /** @type {{ auid?: string, gclid?: string, wbraid?: string, gbraid?: string }} */
  const ctx = {};
  if (adStorageGranted) {
    const auid = parseGclAuId(getCookieValue(cookieString, "_gcl_au"));
    if (auid !== null) ctx.auid = auid; // present -> forward; absent -> omit (NEVER mint, §A5)
  }
  Object.assign(ctx, readClickIds(landingUrl));
  return ctx;
}
