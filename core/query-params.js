/**
 * Query-string param builder (spec 044-01, the extract-on-third-caller convention,
 * docs/conventions.md § Code) — the shared
 * "append `key=value` to a query array, `encodeURIComponent`-escaping both sides, OMITTED (never an
 * empty-string param) when the value is `undefined`/`null`" primitive that `connectors/ga4/gtag.js`
 * (`mapToGtagCollect`/`appendSessionState`), the new `connectors/google-ads/connector.js`, and —
 * inline, in its `paramMap` loop — `connectors/pixel/connector.js` all express identically. The
 * gtag + google-ads gtag-family beacons import this; the pixel connector's inline sibling is the
 * latent 3rd occurrence that tripped the extract-on-third-caller convention's rule-of-three (kept
 * inline there only because it is
 * embedded in that connector's declarative-config loop, a different shape).
 *
 * A PURE, import-free leaf (mirrors `core/cookie-parse.js` / `core/cookie-scope.js`): no `document`,
 * no globals, no consent/governance. Layering-neutral — safely importable from either side of the
 * core/connector boundary (test/core-boundary.test.js machine-enforces the import-free claim).
 */

/**
 * Append `key=value` to a query-part array, `encodeURIComponent`-escaping both sides — omitted
 * (never an empty-string param) when `value` is `undefined`/`null`.
 * @param {string[]} query
 * @param {string} key
 * @param {unknown} value
 */
export function appendParam(query, key, value) {
  if (value === undefined || value === null) return;
  query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}
