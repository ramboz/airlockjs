/**
 * Meta Pixel ADVANCED MATCHING — per-field normalization + SHA-256 hashing +
 * the `ud[<field>]` egress merge (spec 026-04; the design is
 * [ADR-0022](../../docs/decisions/adr-0022-pixel-advanced-matching-hashing.md),
 * Option C hashed EAGERLY).
 *
 * Because airlock reproduces Meta's `/tr` wire directly (it does NOT load
 * `fbevents.js`), it is in the Conversions-API position: it must normalize +
 * SHA-256-hash the user-data fields ITSELF, then emit `ud[<field>]=<hex>`. This
 * module owns exactly that closed spec — Meta's published Customer Information
 * Parameters (ADR-0022 A4) — and NOTHING about where the raw values come from
 * or where the hashes are cached (that wiring is the chamber + `core/airlock.js`).
 *
 * SECURITY (ADR-0022 A5 / spec 026-04): the normalizers below run in the
 * EGRESS-CONFINED pixel chamber, on raw identity that reaches the worker on a
 * DEDICATED channel (`init`/`setIdentity`, never `push()`/events, so a host
 * `payloadDenylist` never strips it before hashing). The ONLY value that ever
 * leaves the worker is the hash — `hashField` is one-way and `mergeAdvancedMatching`
 * only ever appends a hash, never a raw value. A raw identity string can never
 * reach the network.
 *
 * PURE + realm-portable: no `self`/`postMessage`/DOM. Hashing uses WebCrypto
 * `crypto.subtle.digest` — present in the window realm, the worker realm, AND
 * the vitest Node realm (Node 18+ exposes `globalThis.crypto.subtle`), so no
 * `node:crypto` import is needed (and none is added — a `node:crypto` specifier
 * would break `build.mjs`'s `platform:"browser"` bundle). `mergeAdvancedMatching`
 * is pure string work (no crypto), so `core/airlock.js`'s synchronous unload
 * path can import it without pulling WebCrypto onto the main-thread critical path.
 */

/**
 * Meta's per-field normalization (ADR-0022 A4 — the DoR table). Each entry maps
 * a raw host-supplied value to its normalized string; the caller then SHA-256s
 * that string. A field ABSENT here is unknown to advanced matching and is never
 * hashed or emitted (`hashField` returns `undefined`) — a structural guarantee
 * that only documented `ud[...]` fields ever reach the wire.
 *
 *  - `em`          email — trim + lowercase.
 *  - `ph`          phone — digits only, strip leading zeros (keep the country
 *                  code the host prepended; never add a `+`).
 *  - `fn`/`ln`     first/last name — trim, lowercase, strip whitespace +
 *                  punctuation (UTF-8: non-Latin letters are preserved).
 *  - `db`          birthdate — digits only (host supplies YYYYMMDD).
 *  - `ge`          gender — first char, lowercased (`f`/`m`).
 *  - `ct`          city — lowercase, no spaces/punctuation.
 *  - `st`          state/region — lowercase, no spaces/punctuation (host supplies
 *                  the 2-char ANSI code; never truncated here — truncating a full
 *                  name would corrupt a non-prefix code, e.g. Texas → "te").
 *  - `zp`          postal — lowercase, no spaces/punctuation, first 5 chars.
 *  - `country`     country — lowercase, no spaces/punctuation (ISO-3166-1 alpha-2).
 *  - `external_id` a first-party id — NO normalization (hashed verbatim; the
 *                  real capture hashes it, ADR-0022 A4).
 */
const collapse = (v) => String(v).trim().toLowerCase().replace(/[\s\p{P}]/gu, "");

const NORMALIZERS = {
  em: (v) => String(v).trim().toLowerCase(),
  ph: (v) => String(v).replace(/[^0-9]/g, "").replace(/^0+/, ""),
  fn: collapse,
  ln: collapse,
  db: (v) => String(v).replace(/[^0-9]/g, ""),
  ge: (v) => String(v).trim().toLowerCase().slice(0, 1),
  ct: collapse,
  st: collapse,
  zp: (v) => collapse(v).slice(0, 5),
  country: collapse,
  external_id: (v) => String(v),
};

/** The documented advanced-matching field set (the `ud[...]` keys airlock can emit). */
export const ADVANCED_MATCHING_FIELDS = Object.freeze(Object.keys(NORMALIZERS));

/**
 * Normalize one field per Meta's spec. Returns `undefined` for an unknown field
 * or a nullish value — the caller then skips it (never hashes/emits it).
 * @param {string} field one of `ADVANCED_MATCHING_FIELDS`.
 * @param {unknown} rawValue the host-supplied raw value.
 * @returns {string|undefined} the normalized string, or `undefined`.
 */
export function normalizeField(field, rawValue) {
  const normalize = NORMALIZERS[field];
  if (typeof normalize !== "function") return undefined;
  if (rawValue === undefined || rawValue === null) return undefined;
  return normalize(rawValue);
}

/** Resolve WebCrypto's SubtleCrypto across realms (window/worker/Node globalThis). */
function subtleCrypto() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  return c && c.subtle && typeof c.subtle.digest === "function" ? c.subtle : null;
}

/** Lowercase hex of a byte array (the `ud[...]` wire form). */
function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/**
 * Normalize (per Meta's spec) + SHA-256-hash one advanced-matching field to its
 * lowercase-hex `ud[...]` value. One-way: only the hash is ever returned, so a
 * raw identity value can never be recovered from the result.
 *
 * @param {string} field one of `ADVANCED_MATCHING_FIELDS` (`em`/`ph`/`external_id`/…).
 * @param {unknown} rawValue the raw host-supplied value.
 * @returns {Promise<string|undefined>} the 64-char lowercase-hex SHA-256 of the
 *   normalized value, or `undefined` for an unknown field / nullish value (the
 *   caller omits it — never emits raw).
 */
export async function hashField(field, rawValue) {
  const normalized = normalizeField(field, rawValue);
  if (normalized === undefined) return undefined;
  const subtle = subtleCrypto();
  if (!subtle) {
    // WebCrypto is unavailable in every realm airlock runs in (window/worker
    // over HTTPS, and the Node 18+ vitest realm), so this is a hard environment
    // error — NOT a silent fallback that could ship an un-hashed value.
    throw new Error("airlock/pixel/advanced-matching: WebCrypto SubtleCrypto.digest is unavailable in this realm");
  }
  const bytes = new TextEncoder().encode(normalized);
  const digest = await subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

/**
 * Merge cached advanced-matching hashes into pixel `/tr` egress requests —
 * appends `ud[<field>]=<hex>` query params to each request's URL. PER-FIELD and
 * hash-only: a field present in `udHashes` ships; one absent (still hashing, or
 * never fed) is simply omitted; a raw value can never appear because `udHashes`
 * holds only hashes (the cache never receives raw identity — ADR-0022).
 *
 * BACK-COMPAT: an empty/absent `udHashes` (no advanced matching configured, or
 * the cache is still cold) returns the SAME `requests` reference unchanged —
 * byte-identical to a non-advanced-matching pixel beacon.
 *
 * @param {ReadonlyArray<{ url: string, method?: string, body?: string }>} requests
 *   the base pixel EgressRequests (from the identity-agnostic `handle`).
 * @param {Record<string, string>|null|undefined} udHashes field → 64-hex hash.
 * @returns {Array<{ url: string, method?: string, body?: string }>} the requests
 *   with `ud[...]` merged (a shallow-cloned copy per request whose URL changed),
 *   or the original `requests` when there is nothing to merge.
 */
export function mergeAdvancedMatching(requests, udHashes) {
  if (!requests || !requests.length || !udHashes) return requests;
  const params = [];
  for (const field of Object.keys(udHashes)) {
    const hex = udHashes[field];
    if (hex === undefined || hex === null || hex === "") continue;
    params.push(`${encodeURIComponent(`ud[${field}]`)}=${encodeURIComponent(String(hex))}`);
  }
  if (!params.length) return requests; // nothing ready -> byte-identical (back-compat / cold cache)
  const suffix = params.join("&");
  return requests.map((req) => {
    if (!req || typeof req.url !== "string") return req;
    const sep = req.url.includes("?") ? "&" : "?";
    return { ...req, url: `${req.url}${sep}${suffix}` };
  });
}
