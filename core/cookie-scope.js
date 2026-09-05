/**
 * Cookie-name scope + validation — the shared pure-string primitive behind
 * spec 035-01's name-scoped, injection-safe cookie-grant hardening (OQ13-4).
 * ADR-0006's grant law is `granted = declared ∩ allowed`; this module supplies
 * the two pieces every enforcement SEAM needs to apply that law to
 * `CapabilityRequest.cookies` (`contracts/capability.d.ts`):
 *
 *   - `isValidCookieName` — the RFC 6265 §4.1.1 / RFC 7230 §3.2.6 cookie-name
 *     TOKEN grammar. Fail-closed name validation: a name carrying anything
 *     outside the token charset (a separator, a control character, a space)
 *     is rejected — closing the attribute-injection / header-splitting
 *     surface a raw, unvalidated `document.cookie = name=value; attrs` write
 *     opens.
 *   - `matchesGrantedName` — the exact-vs-prefix match rule, RATIFIED against
 *     every REAL declared cookie name in the codebase (alloy's
 *     `kndctr_`/`AMCV_` prefixes + `demdex`/`s_ecid`/`com.adobe.alloy.getTld`
 *     exacts; GA4's `_ga` exact + `_ga_` prefix): a declared entry ENDING IN
 *     `_` matches by PREFIX; every other entry matches EXACT ONLY. This is
 *     the convention every real declaration already follows — `matchesGrantedName`
 *     just makes it load-bearing instead of implicit.
 *   - `scopeSeedCookies` — the READ-side filter built on `matchesGrantedName`:
 *     keep only the jar pairs whose name is granted.
 *
 * Pure — no DOM, no globals, no vendor specifics (mirrors core/consent.js's
 * vendor-neutral shape). Deliberately layering-NEUTRAL: this module imports
 * nothing, so it is safe to import from EITHER side of the core/connector
 * boundary — `core/wrapped-sdk-host.js` (the trusted WRITE-back seam) and
 * `adapters/eds/index.js` (the trusted READ boot-seed seam) both import it
 * directly; a connector's own manifest module (`connectors/alloy/connector.js`)
 * could too, without creating a core -> connectors edge (test/core-boundary.test.js
 * only guards core/ -> rig/; a core/ module importing nothing is never a
 * boundary violation in either direction).
 */

/**
 * The RFC 2616 §2.2 `token` charset RFC 6265 borrows for the cookie-name
 * production: any US-ASCII CHAR except CTLs (octets 0-31, 127) or the
 * `separators` set (`( ) < > @ , ; : \ " / [ ] ? = { }` plus SP and HT).
 * Enumerated positively (a whitelist of the SURVIVING chars) rather than as a
 * denylist of the excluded ones, so anything not explicitly a token char —
 * not just the enumerated injection vectors — fails closed.
 */
const COOKIE_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Validate a single cookie NAME against the RFC 6265 / RFC 7230 cookie-name
 * token grammar. A name is valid iff it is one or more token characters and
 * NOTHING else — no controls, no whitespace (including a leading/trailing
 * space or a bare tab), and none of the RFC 7230 separators (`; = , ( ) < >
 * @ : \ " / [ ] ? { }`). Rejecting these closes the attribute-injection
 * surface (a name smuggling `; domain=evil.com`) and the header/response-
 * splitting surface (a name carrying an embedded `\n`/`\r`).
 *
 * Defensive: a non-string `name` (including the empty string — a token needs
 * at least one character) returns `false` rather than throwing.
 * @param {unknown} name
 * @returns {boolean}
 */
export function isValidCookieName(name) {
  return typeof name === "string" && COOKIE_NAME_TOKEN.test(name);
}

/**
 * Match one cookie name against a connector's declared name set (ADR-0006
 * `granted = declared ∩ allowed`, applied to `CapabilityRequest.cookies:
 * readonly string[]` — a type with no prefix marker of its own). Ratified
 * convention, grounded against every real declaration in the codebase: an
 * entry ENDING IN `_` is a PREFIX match (alloy's `kndctr_` -> `kndctr_org`,
 * `AMCV_` -> `AMCV_1234`; GA4's `_ga_` -> `_ga_ABC123`); every OTHER entry is
 * an EXACT match only (alloy's `demdex`/`s_ecid`/`com.adobe.alloy.getTld`;
 * GA4's `_ga`). A stray suffix on an exact entry is deliberately NOT granted
 * — `demdex_evil` does not match the exact `demdex` declaration.
 *
 * Defensive: a non-string `name` or a non-array `grantedNames` returns
 * `false` (default-deny — never throws, never grants on a malformed input).
 * @param {unknown} name
 * @param {readonly string[]|null|undefined} grantedNames
 * @returns {boolean}
 */
export function matchesGrantedName(name, grantedNames) {
  if (typeof name !== "string" || !Array.isArray(grantedNames)) return false;
  return grantedNames.some((entry) => typeof entry === "string" && (entry.endsWith("_") ? name.startsWith(entry) : name === entry));
}

/**
 * The READ-side boot-seed filter (spec 035-01 AC1): parse a
 * `document.cookie`-shaped jar string (`"a=1; b=2"`) and keep ONLY the pairs
 * whose name `matchesGrantedName` one of `grantedNames`, re-joined in the
 * same `"; "`-delimited shape. This is what keeps a chamber's synchronous
 * cookie cache (`connectors/alloy/sync-cookie-cache.js`) from ever holding —
 * and thus a connector from ever reading — a cookie it did not declare
 * (ADR-0006's grant law, enforced on the trusted host side BEFORE the seed
 * crosses into the untrusted chamber).
 *
 * A malformed segment (no `=` at all) is dropped, never throws. An empty or
 * whitespace-only jar (or a non-string jar — defensive) yields `""`. The
 * relative order of the surviving pairs is preserved; a value itself
 * containing `=` is kept whole (only the FIRST `=` in a segment separates the
 * name from the value).
 * @param {unknown} jar
 * @param {readonly string[]|null|undefined} grantedNames
 * @returns {string}
 */
export function scopeSeedCookies(jar, grantedNames) {
  if (typeof jar !== "string" || !jar.trim()) return "";
  return jar
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.includes("="))
    .filter((pair) => matchesGrantedName(pair.slice(0, pair.indexOf("=")).trim(), grantedNames))
    .join("; ");
}
