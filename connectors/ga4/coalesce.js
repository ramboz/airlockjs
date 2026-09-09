/**
 * GA4 `coalesce` strategy — spec 040-03, the first real adapter for the
 * 040-02 core egress-coalescing seam (ADR-0021 Option C). Revives 039-04's
 * deferred batched-POST transport (a parity-spec digression it turned out not
 * to be — see docs/specs/039-ga4-gtag-connector/slice-04-batched-post-
 * transport.md) as a CORE performance feature: given ≥2 same-context GA4
 * `/g/collect` GET beacons in one lock-through cycle, this SYNTHESIZES gtag's
 * own observed batched-POST convention (one POST, shared params on the query
 * once, one `en=…` line per event in the body) — matching the 2026-09-08
 * live-observed shape byte-for-byte in STRUCTURE (see the slice's Assumptions
 * for the acknowledged n=1 grounding + the `_et`-value divergence).
 *
 * Pure — no cookies, no globals, no DOM (mirrors `gtag.js`'s/`map.js`'s own
 * pure-mapper style) — `core/airlock.js`'s 040-02 seam hands this the group of
 * already-built `{ url, method: "GET" }` beacons for ONE origin+path (all
 * `/g/collect`, so the core hands this a single group per cycle) and takes the
 * returned `EgressRequest[]` verbatim (re-checking each output's endpoint
 * ceiling itself — this module never touches dispatch).
 *
 * NOT wired into, imported by, or a modification of `core/coalescing-broker.js`
 * (Alloy's identity-mint deduper on a different round-trip path, ADR-0021
 * Amendment 2026-09-09) or `core/airlock.js` (the seam is already landed,
 * 040-02) — this file is a plain, importable strategy a caller passes as
 * `createAirlock({ coalesce: coalesceGa4 })`.
 */

/** AC4's fixed param-key TAXONOMY over the closed set `mapToGtagCollect` can
 *  produce (`connectors/ga4/gtag.js:251-292`): a key is PER-EVENT iff it is
 *  exactly `en`/`_et`, or starts with the `ep.`/`epn.` custom-param prefixes —
 *  every other key (`v`, `tid`, `cid`, `sid`, session-state, `dl`/`dr`/`dt`,
 *  `gcs`/`gcd`, and any future shared field) is SHARED by default. This is a
 *  classification by KEY NAME, never by "which section of the single GET it
 *  sat in" — the frame-critique correction AC4 codifies (`_et` sits on the
 *  single-GET's query yet classifies PER-EVENT here).
 * @param {string} key a DECODED query-param key
 * @returns {"per-event"|"shared"}
 */
function classifyKey(key) {
  if (key === "en" || key === "_et" || key.startsWith("ep.") || key.startsWith("epn.")) {
    return "per-event";
  }
  return "shared";
}

/**
 * Split a built beacon URL into its base (origin+pathname) and raw query
 * string, WITHOUT touching percent-encoding — the raw query is re-emitted
 * byte-for-byte later, so this never round-trips through decode/re-encode
 * (which could disagree with `gtag.js`'s own `encodeURIComponent` escaping,
 * e.g. space-as-`+` vs `%20`).
 * @param {string} url
 * @returns {{ base: string, query: string }}
 */
function splitUrl(url) {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return { base: url, query: "" };
  return { base: url.slice(0, qIndex), query: url.slice(qIndex + 1) };
}

/**
 * Parse a raw query string into ordered `{ key, pair }` records — `key` is
 * DECODED (for classification only), `pair` is the ORIGINAL `key=value` raw
 * token (preserved verbatim for byte-faithful re-emission).
 * @param {string} query
 * @returns {Array<{ key: string, pair: string }>}
 */
function parseParamPairs(query) {
  if (!query) return [];
  return query.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    return { key: decodeURIComponent(rawKey), pair };
  });
}

/**
 * Parse one built GET request into its base, its ordered SHARED/PER-EVENT
 * param-pair lists (AC4's taxonomy), and a canonical SHARED signature (AC2) —
 * the sorted, `&`-joined raw shared pairs, so two requests with the identical
 * shared param SET (same keys, same values) compare equal regardless of the
 * order those params happened to appear in the source GET.
 * @param {{ url: string, method: string }} request
 */
function parseRequest(request) {
  const { base, query } = splitUrl(request.url);
  const pairs = parseParamPairs(query);
  const sharedPairs = pairs.filter((p) => classifyKey(p.key) === "shared");
  const perEventPairs = pairs.filter((p) => classifyKey(p.key) === "per-event");
  const sharedSignature = sharedPairs
    .map((p) => p.pair)
    .sort()
    .join("&");
  return { original: request, base, sharedPairs, perEventPairs, sharedSignature };
}

/**
 * Build one event's body-line params in the AC1/AC4 prescribed order — `en`
 * FIRST, then the INJECTED `_ee=1` batch marker (never present on a single
 * GET), then `ep.*`/`epn.*` in their original relative order, then the
 * RELOCATED `_et` LAST. Explicit bucketing (rather than assuming the source
 * GET's own param order) so this holds regardless of how the emitter orders
 * its query.
 * @param {Array<{ key: string, pair: string }>} perEventPairs
 * @returns {string} one `\r\n`-line's worth of `&`-joined params
 */
function buildBodyLine(perEventPairs) {
  const enPair = perEventPairs.find((p) => p.key === "en");
  const etPair = perEventPairs.find((p) => p.key === "_et");
  const customPairs = perEventPairs.filter((p) => p !== enPair && p !== etPair);

  const parts = [];
  if (enPair) parts.push(enPair.pair);
  parts.push("_ee=1"); // AC4(b): injected — never present on a single-GET input
  for (const p of customPairs) parts.push(p.pair);
  if (etPair) parts.push(etPair.pair); // AC4(a): relocated from the query to here

  return parts.join("&");
}

/**
 * Synthesize the batched POST for one sub-group of >=2 same-shared-context
 * requests (AC1): the url carries the FIRST request's shared pairs, in their
 * original GET order (every request in the group shares the identical set by
 * construction of the AC2 sub-grouping above); the body is one `\r\n`-joined
 * line per request, in cycle (array) order.
 * @param {Array<ReturnType<typeof parseRequest>>} items
 * @returns {{ url: string, method: "POST", body: string }}
 */
function buildBatchPost(items) {
  const { base, sharedPairs } = items[0];
  const url = sharedPairs.length ? `${base}?${sharedPairs.map((p) => p.pair).join("&")}` : base;
  const body = items.map((item) => buildBodyLine(item.perEventPairs)).join("\r\n");
  return { url, method: "POST", body };
}

/**
 * The GA4 `coalesce` strategy — the value passed as `createAirlock({
 * coalesce: coalesceGa4 })`. Receives one origin+path group of built
 * `/g/collect` GET beacons (040-02's grouping already guarantees this — all
 * survivors sharing origin+path land in ONE call), sub-groups them by their
 * FULL shared-context param set (AC2 — `tid` differing, or ANY other shared
 * param differing, e.g. a cross-page `dl`, forbids merging), and emits:
 *  - a lone sub-group member UNCHANGED (AC3 — still the 039-01 GET), or
 *  - ONE synthesized batched POST per sub-group of >=2 (AC1/AC4).
 * Sub-group (and cross-sub-group output) order follows first-seen cycle
 * order.
 * @param {Array<{ url: string, method: string }>} requests
 * @returns {Array<{ url: string, method: string, body?: string }>}
 */
export function coalesceGa4(requests) {
  if (!Array.isArray(requests) || requests.length === 0) return [];

  const groups = []; // [{ signature, items: [] }], first-seen order
  for (const request of requests) {
    const parsed = parseRequest(request);
    let group = groups.find((g) => g.signature === parsed.sharedSignature);
    if (!group) {
      group = { signature: parsed.sharedSignature, items: [] };
      groups.push(group);
    }
    group.items.push(parsed);
  }

  const outputs = [];
  for (const group of groups) {
    if (group.items.length === 1) {
      outputs.push(group.items[0].original); // AC3 — unchanged
    } else {
      outputs.push(buildBatchPost(group.items)); // AC1/AC4 — synthesized POST
    }
  }
  return outputs;
}
