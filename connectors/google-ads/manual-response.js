// These are offline analysis limits, not limits or permissions for live transport.
const MAX_BODY_BYTES = 65536;
const MAX_URL = 8192;
const MAX_HEADERS = 32;
const MAX_DEPTH = 16;
const MAX_NODES = 1024;
const PROTECTED = ["label", "value", "currency_code", "oid", "url", "auid", "en"];

function fail(code) { throw new Error(code); }

function text(input) {
  if (typeof input === "string") {
    if (!input.isWellFormed() || new TextEncoder().encode(input).byteLength > MAX_BODY_BYTES) fail("body-limit");
    return input;
  }
  if (!(input instanceof Uint8Array) || input.byteLength > MAX_BODY_BYTES) fail("body-limit");
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input); } catch { fail("invalid-utf8"); }
}

// A small JSON parser checks decoded duplicate names and limits before building the value.
export function parseGoogleManualJson(source) {
  let at = 0, nodes = 0;
  const space = () => { while (/[ \t\r\n]/.test(source[at] ?? "") && at < source.length) at += 1; };
  function string() {
    const start = at++;
    while (at < source.length) {
      const ch = source[at++];
      if (ch === "\\") { at += 1; continue; }
      if (ch === '"') {
        let value;
        try { value = JSON.parse(source.slice(start, at)); } catch { fail("invalid-json"); }
        if (!value.isWellFormed()) fail("invalid-json");
        return value;
      }
    }
    fail("invalid-json");
  }
  function value(depth) {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) fail("structure-limit");
    space();
    const ch = source[at];
    if (ch === '"') return string();
    if (ch === "{" || ch === "[") {
      const object = ch === "{", result = object ? Object.create(null) : [];
      const seen = new Set();
      at += 1; space();
      if (source[at] === (object ? "}" : "]")) { at += 1; return result; }
      while (at < source.length) {
        if (object) {
          if (source[at] !== '"') fail("invalid-json");
          const key = string();
          if (seen.has(key)) fail("duplicate-json");
          seen.add(key); space();
          if (source[at++] !== ":") fail("invalid-json");
          result[key] = value(depth + 1);
        } else result.push(value(depth + 1));
        space();
        if (source[at] === (object ? "}" : "]")) { at += 1; return result; }
        if (source[at++] !== ",") fail("invalid-json");
        space();
      }
      fail("invalid-json");
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(at));
    if (!match) fail("invalid-json");
    at += match[0].length;
    return JSON.parse(match[0]);
  }
  const result = value(0);
  space();
  if (at !== source.length) fail("invalid-json");
  return result;
}

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function parseFrame(input) {
  const body = text(input);
  const match = /^event: message\ndata: ([^\r\n]+)\n\n$/.exec(body);
  if (!match) fail("invalid-frame");
  const data = parseGoogleManualJson(match[1]);
  if (!exactKeys(data, ["fetch", "options"]) || !Array.isArray(data.fetch)) fail("invalid-message");
  if (data.fetch.length !== 1) fail("invalid-fetch-count");
  if (typeof data.fetch[0] !== "string" ||
      !exactKeys(data.options, ["fallback_url", "fallback_url_method"]) ||
      typeof data.options.fallback_url !== "string" || data.options.fallback_url_method !== "fetch") {
    fail("invalid-message");
  }
  const fetchUrl = safeUrl(data.fetch[0]), fallback = safeUrl(data.options.fallback_url);
  const fetchPath = /^\/pagead\/viewthroughconversion\/(\d{1,32})\/$/.exec(fetchUrl.pathname);
  if (fetchUrl.hostname !== "googleads.g.doubleclick.net" || !fetchPath ||
      fallback.hostname !== "www.google.com" ||
      fallback.pathname !== `/pagead/1p-conversion/${fetchPath[1]}/`) fail("invalid-url");
  return data;
}

export function googleManualSafeError(error) {
  const allowed = new Set(["body-limit", "invalid-utf8", "invalid-json", "duplicate-json", "structure-limit",
    "invalid-frame", "invalid-message", "invalid-fetch-count", "invalid-owned", "invalid-url", "invalid-ownership",
    "invalid-sequence", "invalid-headers", "invalid-response", "invalid-parent"]);
  return allowed.has(error?.message) ? error.message : "invalid-input";
}

/** Framing only: never returns URLs or grants permission to use them. */
export function decodeGoogleManualResponse(body) {
  const claims = { dispatch_authorized: false, native_execution_qualified: false, complete_reference: false,
    chamber_execution: false, product_receipt: false };
  try {
    parseFrame(body);
    return { status: "decoded", fetch_offers: 1, fallback: "offered", ...claims };
  } catch (error) {
    return { status: "rejected", error: googleManualSafeError(error), ...claims };
  }
}

function safeUrl(raw) {
  if (typeof raw !== "string" || raw.length > MAX_URL || !raw.isWellFormed() ||
      // eslint-disable-next-line no-control-regex -- reject ambiguous URL syntax before URL normalization.
      /[\s\u0000-\u001f\u007f\\#]/u.test(raw) || /%(?![0-9a-f]{2})/i.test(raw) ||
      !/^https:\/\/[a-z0-9.-]+(?:\/|$)/.test(raw)) fail("invalid-url");
  try {
    for (const component of raw.split(/[?&=]/)) decodeURIComponent(component);
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
        raw.split("?")[0] !== `${url.origin}${url.pathname}`) fail("invalid-url");
    return url;
  } catch { fail("invalid-url"); }
}

function checkOwned(owned) {
  if (!owned || typeof owned !== "object" || !/^AW-\d{1,32}$/.test(owned.conversion_id) ||
      typeof owned.conversion_label !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(owned.conversion_label) ||
      owned.value !== 1 || owned.currency !== "USD" ||
      typeof owned.transaction_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(owned.transaction_id) ||
      typeof owned.auid !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(owned.auid)) fail("invalid-owned");
  safeUrl(owned.document_url);
}

function checkUrl(raw, owned, kind) {
  const url = safeUrl(raw), id = owned.conversion_id.slice(3);
  const routes = {
    primary: ["www.googleadservices.com", "conversion"],
    fetch: ["googleads.g.doubleclick.net", "viewthroughconversion"],
    firstparty: ["www.google.com", "1p-conversion"],
  };
  const [host, path] = routes[kind];
  if (url.hostname !== host || url.pathname !== `/pagead/${path}/${id}/`) fail("invalid-url");
  const params = url.searchParams;
  for (const key of PROTECTED) if (params.getAll(key).length > 1) fail("invalid-ownership");
  const expected = { label: owned.conversion_label, value: "1", currency_code: "USD",
    url: owned.document_url, auid: owned.auid, en: "conversion" };
  for (const [key, value] of Object.entries(expected)) {
    if (params.getAll(key).length !== 1 || params.get(key) !== value) fail("invalid-ownership");
  }
  const oid = params.getAll("oid");
  if ((kind === "primary" && oid.length !== 1) || (oid.length && oid[0] !== owned.transaction_id)) {
    fail("invalid-ownership");
  }
  return [...params.entries()];
}

function headers(input) {
  if (input === null) return null;
  if (!Array.isArray(input) || input.length > MAX_HEADERS) fail("invalid-headers");
  for (const pair of input) {
    if (!Array.isArray(pair) || pair.length !== 2 ||
        typeof pair[0] !== "string" || typeof pair[1] !== "string" ||
        pair[0].length > 256 || pair[1].length > MAX_URL || !pair[1].isWellFormed() ||
        // eslint-disable-next-line no-control-regex -- reject control characters in captured header values.
        !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(pair[0]) || /[\u0000-\u0008\u000a-\u001f\u007f]/.test(pair[1])) fail("invalid-headers");
  }
  return input;
}

function header(input, name) {
  const values = input?.filter(([key]) => key.toLowerCase() === name).map(([, value]) => value) ?? [];
  if (values.length !== 1) fail("invalid-headers");
  return values[0];
}

function samePairsPrefix(prefix, pairs) {
  return prefix.length <= pairs.length && prefix.every(([key, value], i) =>
    pairs[i][0] === key && pairs[i][1] === value);
}

function compareChain(entries, owned) {
  checkOwned(owned);
  if (!Array.isArray(entries) || entries.length !== 3) fail("invalid-sequence");
  for (const [index, entry] of entries.entries()) {
    if (!entry?.request || !entry?.response ||
        entry.request.method !== ["GET", "POST", "GET"][index] ||
        entry.request.resource_type !== "fetch" || entry.request.body_size !== 0 ||
        entry.response.status !== [200, 302, 200][index]) fail("invalid-sequence");
    headers(entry.response.headers);
    if (entry.response.body !== null && typeof entry.response.body !== "string" &&
        !(entry.response.body instanceof Uint8Array)) fail("invalid-response");
    if (entry.response.body !== null) text(entry.response.body);
    if (!Number.isSafeInteger(entry.response.content_size) || entry.response.content_size < 0) fail("invalid-response");
  }
  checkUrl(entries[0].request.url, owned, "primary");
  if (!/^application\/json(?:\s*;|$)/i.test(header(entries[0].response.headers, "content-type"))) fail("invalid-response");
  const message = parseFrame(entries[0].response.body);
  const fetchPairs = checkUrl(message.fetch[0], owned, "fetch");
  if (fetchPairs.filter(([key]) => key === "random").length !== 1) fail("invalid-parent");
  const fallbackPairs = checkUrl(message.options.fallback_url, owned, "firstparty");
  if (!samePairsPrefix(fetchPairs, fallbackPairs) || fallbackPairs.length !== fetchPairs.length + 1 ||
      fallbackPairs.at(-1)[0] !== "gcp" || !fallbackPairs.at(-1)[1]) fail("invalid-parent");
  if (entries[1].request.url !== message.fetch[0]) fail("invalid-parent");
  const location = header(entries[1].response.headers, "location");
  const redirectPairs = checkUrl(location, owned, "firstparty");
  if (!samePairsPrefix(fetchPairs, redirectPairs) || redirectPairs.length !== fetchPairs.length + 3 ||
      redirectPairs.at(-3)[0] !== "is_vtc" || redirectPairs.at(-3)[1] !== "1" ||
      redirectPairs.at(-2)[0] !== "cid" || !redirectPairs.at(-2)[1] ||
      redirectPairs.at(-1)[0] !== "random" || !redirectPairs.at(-1)[1] ||
      redirectPairs.at(-1)[1] === fetchPairs.find(([key]) => key === "random")[1]) fail("invalid-parent");
  if (entries[2].request.url !== location) fail("invalid-parent");
  return {
    fallback: "offered-not-separately-observed",
    secondary_body: entries[1].response.body === null ? "unavailable" : "available",
    final_headers: entries[2].response.headers === null ? "unavailable" : "available",
    final_body: entries[2].response.body === null ? "unavailable" : "available",
    resource_binding: "unqualified",
    content_sizes: "retained-source-metadata",
  };
}

/** The expected owned values must be supplied separately from the entries under analysis. */
export function analyzeGoogleManualCapture(entries, owned) {
  const claims = { dispatch_authorized: false, native_execution_qualified: false, complete_reference: false,
    chamber_execution: false, product_receipt: false };
  try {
    const evidence = compareChain(entries, owned);
    return { overall: "inconclusive", sequence: "matched",
      counts: { requests: 3, frames: 1, fetch_offers: 1, fallback_offers: 1 }, evidence, claims };
  } catch (error) {
    return { overall: "rejected", sequence: "unmatched", error: googleManualSafeError(error), claims };
  }
}

/** First-party worker only: the returned URLs remain inert until confined by its caller. */
export function parseGoogleWorkerMessage(body, owned) {
  checkOwned(owned);
  const message = parseFrame(body);
  const fetchPairs = checkUrl(message.fetch[0], owned, "fetch");
  const fallbackPairs = checkUrl(message.options.fallback_url, owned, "firstparty");
  if (fetchPairs.some(([key]) => key === "oid") ||
      fetchPairs.filter(([key]) => key === "random").length !== 1 ||
      !samePairsPrefix(fetchPairs, fallbackPairs) || fallbackPairs.length !== fetchPairs.length + 1 ||
      fallbackPairs.at(-1)[0] !== "gcp" || !fallbackPairs.at(-1)[1]) fail("invalid-parent");
  return { fetch: message.fetch[0], fallback: message.options.fallback_url };
}

/** Validate the actual secondary response's Location against its exact parent. */
export function parseGoogleWorkerRedirect(location, fetchUrl, owned) {
  checkOwned(owned);
  const fetchPairs = checkUrl(fetchUrl, owned, "fetch");
  const redirectPairs = checkUrl(location, owned, "firstparty");
  if (fetchPairs.some(([key]) => key === "oid") ||
      fetchPairs.filter(([key]) => key === "random").length !== 1 ||
      !samePairsPrefix(fetchPairs, redirectPairs) || redirectPairs.length !== fetchPairs.length + 3 ||
      redirectPairs.at(-3)[0] !== "is_vtc" || redirectPairs.at(-3)[1] !== "1" ||
      redirectPairs.at(-2)[0] !== "cid" || !redirectPairs.at(-2)[1] ||
      redirectPairs.at(-1)[0] !== "random" || !redirectPairs.at(-1)[1] ||
      redirectPairs.at(-1)[1] === fetchPairs.find(([key]) => key === "random")[1]) fail("invalid-parent");
  return location;
}
