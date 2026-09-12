/**
 * Cookie-value scan primitive (spec 043-01, the extract-on-third-caller convention,
 * docs/conventions.md § Code) — the shared exact-name "read a cookie value out of a raw `document.cookie`
 * string" accessor that `adapters/eds/index.js`'s `readCookieValue` (026-04)
 * and `adapters/eds/cookies.js`'s mediated `get(name)` open-coded identically
 * (the third + prior copies, tripping the extract-on-third-caller convention's rule-of-three).
 *
 * A PURE string-parse primitive: no `document`, no globals, no consent or
 * governance gating. Callers keep their own gating (e.g. 017-02 grant-gated
 * reads) — this module only changes *where the parse lives*, never *whether a
 * read is allowed*. It IMPORTS NOTHING, so it is layering-neutral: a leaf
 * safely importable from either side of the core/connector boundary
 * (`adapters/*` and `connectors/*` alike) without creating a core→connector
 * cycle (mirrors `core/cookie-scope.js`'s same import-nothing leaf shape).
 *
 * The absent-value sentinel here is `undefined` (matching `readCookieValue`'s
 * contract); a caller needing a different sentinel (e.g. the cookie
 * capability's `Promise<string|null>`) reconciles it at the call site
 * (`getCookieValue(...) ?? null`) rather than this module growing options.
 *
 * Deliberately narrow (leanness): only the exact-name accessor. The
 * prefix-match (`connectors/ga4/cookies.js` `findGaStreamCookie`), first-pair
 * / filter (`connectors/alloy/sync-cookie-cache.js`), and scoping
 * (`core/cookie-scope.js`, `core/wrapped-sdk-host.js`) variants are genuinely
 * different accessors and stay open-coded (spec 043 § A2) — no generic
 * "iterate cookie pairs" primitive is introduced here.
 */

/**
 * @param {string} cookieString a raw `document.cookie` (or equivalent jar) string.
 * @param {string} name the cookie name to look up (matched exactly, not by prefix).
 * @returns {string|undefined} the decoded value of the first pair whose name
 *   matches exactly, or `undefined` when `cookieString` is not a non-empty
 *   string or `name` is absent from the jar. Never throws: a malformed
 *   `%`-escape falls back to the raw trimmed value.
 */
export function getCookieValue(cookieString, name) {
  if (typeof cookieString !== "string" || cookieString.length === 0) return undefined;
  for (const pair of cookieString.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() !== name) continue;
    const raw = pair.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // malformed %-escape: surface raw, never throw
    }
  }
  return undefined;
}
