/**
 * Path-matrix param builder (spec 046-02) — the `;`-delimited SIBLING of `core/query-params.js`'s
 * `appendParam`. Some vendor beacons ride their params on the URL PATH as `;`-delimited `key=value`
 * segments (a "matrix URI", RFC 3986 §3.3) rather than in a `?a=b&c=d` query string. DoubleClick's
 * classic Floodlight `activity` beacon is exactly this shape:
 * `ad.doubleclick.net/activity;src=<id>;type=<t>;cat=<c>;…`.
 *
 * The query builder (`appendParam`, `&`-joined) is DELIBERATELY not reused here: the two delimiters
 * (`&`/`?` vs `;`) and the two homes on the URL (query vs path) are different wire grammars — a
 * value that is safe in a query can still break a path-matrix segment, and vice versa. This is the
 * distinct primitive for the path-matrix shape.
 *
 * DELIMITER SAFETY: both key and value are `encodeURIComponent`-escaped, which escapes `;` (`%3B`),
 * `=` (`%3D`) and `/` (`%2F`) — so a value can NEVER inject a stray segment delimiter or a spurious
 * `key=value` pair (verified in test/floodlight.test.js). The inverse (`rig/parity/replay.js`'s
 * `fieldsFromMatrixUrl`) `decodeURIComponent`s each side back, so a `;`-bearing value round-trips.
 *
 * A PURE, import-free leaf (mirrors `core/query-params.js` / `core/cookie-parse.js`): no `document`,
 * no globals, no consent/governance. Layering-neutral — safely importable from either side of the
 * core/connector boundary (test/core-boundary.test.js machine-enforces the import-free claim).
 */

/**
 * Append a `key=value` path-matrix segment to a segment array, `encodeURIComponent`-escaping both
 * sides — omitted (never an empty-string segment) when `value` is `undefined`/`null`, exactly like
 * `appendParam`'s own omit-when-undefined rule. The caller joins the returned segments with `;` and
 * appends them to the base path (see `connectors/floodlight/connector.js`'s `mapToDcActivity`).
 * @param {string[]} segments
 * @param {string} key
 * @param {unknown} value
 */
export function appendMatrixParam(segments, key, value) {
  if (value === undefined || value === null) return;
  segments.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

/**
 * Join a base URL with `;`-delimited path-matrix segments (see `appendMatrixParam`): `base` alone
 * when `segments` is empty, else `` `${base};${segments.join(";")}` ``. This is the ONE shared home
 * for the join — `connectors/floodlight/connector.js` uses it BOTH for the emitted activity beacon's
 * URL (`mapToDcActivity`) AND for the manifest's declared endpoint-ceiling prefix
 * (`activityCeilingEndpoint`); those two call sites must stay byte-identical or
 * `core/endpoint-ceiling.js`'s segment-anchored prefix match stops admitting the beacon it declared —
 * factoring the join here makes that lockstep structural instead of two independently-maintained
 * inline copies.
 * @param {string} base
 * @param {readonly string[]} segments already-built `key=value` matrix segments (see appendMatrixParam)
 * @returns {string}
 */
export function joinMatrixUrl(base, segments) {
  return segments.length ? `${base};${segments.join(";")}` : String(base);
}
