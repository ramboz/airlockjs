/**
 * GA4 identity sourcing from the `_ga` / `_ga_<stream>` cookies (slice 004-03).
 *
 * Pure, dependency-injected module — no DOM, no globals, no Date.now/Math.random
 * hardwired in the logic (both are injectable, defaulted params). The HOST runs
 * this on the main thread (the connector never touches document.cookie — the
 * chamber stays cookie-free, capability.d.ts / ADR-0003): the adapter hands it a
 * capability-shaped async cookie accessor plus the raw cookie string for stream
 * discovery, and gets back the MINIMAL `{ clientId, sessionId }` ctx snapshot.
 *
 * GRAMMAR CAVEAT (slice Assumptions / ga4-mp.md § Provenance): the cookie shapes
 * below are community-derived, NOT part of Google's pinned contract, and have
 * already drifted once (GS1→GS2). Every parser here degrades to `null` on any
 * shape violation — never a throw — and the caller takes the documented fallback.
 *
 *   _ga           = GA1.<domain-depth>.<random>.<unix-seconds>
 *                   → client_id is the LAST TWO dotted segments (prefix-tolerant)
 *   _ga_<STREAM>  = GS1.1.<session_id>.<session_number>.…        (dot-separated)
 *                 | GS2.1.s<session_id>$o<n>$…    ($-separated, s-prefixed field)
 */

const DIGITS = /^\d+$/;

/** `_ga` cookie lifetime on write: ≈ 2 years (GA's own default). Browsers cap the
 *  effective lifetime (Safari ITP ~7d for script-written cookies, Chrome ~400d) —
 *  caps shorten continuity, never break correctness. */
export const GA_COOKIE_MAX_AGE_S = 63072000;

/**
 * Extract a GA4 `client_id` from a raw `_ga` cookie value: the last two dotted
 * segments `<random>.<unix-seconds>` (both numeric), tolerant of prefix /
 * domain-depth variation (`GA1.1.…`, `GA1.2.…`, or an already-bare pair).
 * @param {string|null|undefined} value raw `_ga` cookie value.
 * @returns {string|null} the client_id, or null on any malformed/absent shape.
 */
export function parseGaClientId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 2) return null;
  const random = parts[parts.length - 2];
  const seconds = parts[parts.length - 1];
  if (!DIGITS.test(random) || !DIGITS.test(seconds)) return null;
  return `${random}.${seconds}`;
}

/**
 * Extract a GA4 `session_id` from a raw `_ga_<STREAM>` cookie value, tolerating
 * the GS1→GS2 grammar drift: GS1 keeps it as the third dot-segment; GS2 packs
 * `$`-separated fields into that segment with the session id `s`-prefixed.
 * @param {string|null|undefined} value raw `_ga_<STREAM>` cookie value.
 * @returns {string|null} the session_id, or null on any malformed/absent shape.
 */
export function parseGaSessionId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 3) return null;
  const field = parts[2];
  if (field.includes("$") || field.startsWith("s")) {
    // GS2: find the s-prefixed numeric field among the $-separated fields.
    for (const f of field.split("$")) {
      const m = /^s(\d+)$/.exec(f);
      if (m) return m[1];
    }
    return null;
  }
  // GS1: the third dot-segment IS the session id.
  return DIGITS.test(field) ? field : null;
}

/**
 * Find the `_ga_<STREAM>` session cookie's raw value in a full `document.cookie`
 * string — `_ga` itself, `_gat`, `_gid` never match (the name must be `_ga_` plus
 * a non-empty stream id). When several `_ga_*` cookies exist (multi-stream page),
 * the FIRST in document.cookie order wins — a deterministic, documented pick; a
 * stream-selection policy is out of scope for MVP1's single-stream deployment.
 * @param {string|null|undefined} cookieString the raw `document.cookie` string.
 * @returns {string|null} the (decoded) cookie value, or null when absent.
 */
export function findGaStreamCookie(cookieString) {
  if (typeof cookieString !== "string" || cookieString.length === 0) return null;
  for (const pair of cookieString.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name.startsWith("_ga_") && name.length > 4) {
      const raw = pair.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw; // malformed %-escape: use the raw value, never throw
      }
    }
  }
  return null;
}

/**
 * The GA1 write format for a generated client_id — written AS `_ga` (not an
 * airlock-owned name) so on-page GA / later gtag coexistence reads the same
 * identity in both directions (slice 004-03 Assumptions).
 * @param {string} clientId `<random>.<unix-seconds>`
 */
export function formatGaCookieValue(clientId) {
  return `GA1.1.${clientId}`;
}

/**
 * Source the minimal GA4 identity ctx (ADR-0003 snapshot) on the host:
 *
 *  - `clientId` from `_ga` via the mediated accessor; when absent, GENERATE
 *    `<10-digit random>.<unix-seconds>` and persist it as `_ga` in GA1 format
 *    (max-age ≈ 2y, path=/, SameSite=Lax). The write is defensive: an EXISTING
 *    `_ga` — even one we cannot parse — is never overwritten (a malformed value
 *    may be a newer grammar another tag understands); the generated id then
 *    serves this page only.
 *  - `sessionId` from `_ga_<stream>` (found in `cookieString`); absent/malformed
 *    falls back to a per-page session id (unix-seconds at boot) — on a gtag-free
 *    site this fallback is the steady state (slice Assumptions).
 *
 * Consent note: this identity write is NOT gated by the seal — the seal gates
 * egress only (declared in the slice Assumptions, registered as refinement-todo
 * OQ13 item 1).
 *
 * @param {object} opts
 * @param {{ get(name: string): Promise<string|null>,
 *           set(name: string, value: string, opts?: object): Promise<void> }} opts.cookies
 *   capability.d.ts-shaped async cookie accessor (host-mediated).
 * @param {string} [opts.cookieString] raw `document.cookie`, ONLY for `_ga_<stream>`
 *   discovery (the stream suffix is unknowable a priori, and the capability shape
 *   has no enumeration). It never enters the returned ctx.
 * @param {() => number} [opts.now]    injectable clock (ms), default Date.now.
 * @param {() => number} [opts.random] injectable [0,1) source, default Math.random.
 * @returns {Promise<{ clientId: string, sessionId: string }>} the minimal snapshot.
 */
export async function sourceGa4Ctx({ cookies, cookieString = "", now = Date.now, random = Math.random }) {
  const bootSeconds = Math.floor(now() / 1000);

  const rawGa = await cookies.get("_ga");
  let clientId = parseGaClientId(rawGa);
  if (clientId === null) {
    const tenDigits = String(1_000_000_000 + Math.floor(random() * 9_000_000_000));
    clientId = `${tenDigits}.${bootSeconds}`;
    if (rawGa == null) {
      await cookies.set("_ga", formatGaCookieValue(clientId), {
        maxAge: GA_COOKIE_MAX_AGE_S,
        path: "/",
        sameSite: "lax",
      });
    }
  }

  const sessionId = parseGaSessionId(findGaStreamCookie(cookieString)) ?? String(bootSeconds);
  return { clientId, sessionId };
}
