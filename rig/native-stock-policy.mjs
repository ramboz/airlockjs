// Eligibility is not dispatch authority. The stock entry stays disabled until
// transport, canonical reservation and complete-capture prerequisites qualify.
export const LIMITS = Object.freeze({
  google_requests: 20, meta_requests: 8, observations: 64, url_bytes: 2048,
  request_bytes: 65536, response_bytes: 2097152, aggregate_bytes: 8388608,
  duration_ms: 60000,
});

export function denyStockExecution(caseName) {
  if (!["google-stock", "meta-stock"].includes(caseName)) throw new Error("unsupported_case");
  throw new Error("pre_admission_blocked");
}

export const META_REFERENCE_COHORTS = Object.freeze({
  "retained-2026-10-15": Object.freeze({
    runtime: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b",
    configuration: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921",
  }),
  "authenticated-2026-10-21": Object.freeze({
    runtime: "d4487bcc9db399030b7089a15e37a6e755bed441992ced0716fb7f9a874e20d1",
    configuration: "b1720ebb329e506fd223f066353d977281280866d85e908dc2561a6c1161c46d",
  }),
});
const PINS = {
  google: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50",
};
const META_FIELDS = new Set(("aems cdl coo dl ec ev fbp id if imft iss it iw ler o plt "
  + "pmd[title] r rl rqm sh sw ts tz v").split(" ")
  .concat(Array.from({ length: 51 }, (_v, n) => `expv2[${n}]`)));
const META_MDC_FIELDS = new Set([...META_FIELDS, "mdc[data]", "mdc[version]"]);
const META_MDC_COMPONENTS = ["json_ld", "opengraph", "schema_org", "rdfa"];
const GOOGLE_BASE = ("async auid bg cv data dma en ept fmt frm fst gcd gtm guid hn npa pscdl "
  + "random rcb tag_exp tiba u_h u_w uaa uab uafvl uam uamb uap uapv uaw url").split(" ");
const GOOGLE_PRIMARY = "category currency_code gcl_ctr gtm_ee label oid value".split(" ");
const CCM_FIELDS = ("_gsid apvc auid dl dma dt en fmt frm gcd gtm navt npa rcb rnd scrsrc "
  + "tag_exp tfd tft tid tids").split(" ");
const S_FIELDS = "_gsid auid fmt gtm".split(" ");
const plain = value => value !== null && typeof value === "object"
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value, required, optional = []) => plain(value)
  && required.every(key => Object.hasOwn(value, key))
  && Reflect.ownKeys(value).every(key => required.includes(key) || optional.includes(key));
const text = (value, maximum = 4096) => typeof value === "string" && value.length > 0
  && value.isWellFormed() && Buffer.byteLength(value) <= maximum
  && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
const byteLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const size = value => byteLength.call(value);
const reject = message => { throw new Error(message); };

function parsedUrl(raw) {
  if (!text(raw, LIMITS.url_bytes)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port
      || url.href !== raw) return null;
    // URLSearchParams replaces malformed encodings. Policy must reject them,
    // not authorize a different decoded selector than the original wire input.
    for (const part of url.search.slice(1).split("&")) {
      const at = part.indexOf("=");
      decodeURIComponent((at < 0 ? part : part.slice(0, at)).replaceAll("+", " "));
      decodeURIComponent((at < 0 ? "" : part.slice(at + 1)).replaceAll("+", " "));
    }
    return url;
  } catch { return null; }
}
function uniqueFields(url, permitted) {
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!permitted.has(key) || seen.has(key) || (value !== "" && !text(value))) return false;
    seen.add(key);
  }
  return true;
}
const exact = (url, key, expected) => url.searchParams.getAll(key).length === 1
  && url.searchParams.get(key) === expected;
const token = value => typeof value === "string" && /^[A-Za-z0-9._-]{1,256}$/.test(value);
const headerBytes = headers => Buffer.byteLength(JSON.stringify(Object.entries(headers)
  .map(([key, value]) => [key.toLowerCase(), value]).sort(([a], [b]) => a.localeCompare(b))));
function boundedJson(bytes) {
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { reject("invalid_policy_response"); }
  let depth = 0, tokens = 0, quoted = false, escaped = false;
  for (const char of source) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') { quoted = true; tokens++; }
    else if (char === "[" || char === "{") { depth++; tokens++; }
    else if (char === "]" || char === "}") depth--;
    else if (char === ",") tokens++;
    if (depth > 16 || tokens > 5000) reject("response_structure_limit");
  }
  try { return JSON.parse(source); }
  catch { reject("invalid_policy_response"); }
}

function uniqueJsonMembers(source) {
  const objects = [];
  let previous;
  // JSON.parse collapses duplicates; inspect the original, already-validated tokens.
  for (const [token] of source.matchAll(/"(?:\\.|[^"\\])*"|[{}:]/g)) {
    if (token === "{") objects.push(new Set());
    else if (token === "}") objects.pop();
    else if (token === ":") {
      const key = JSON.parse(previous), seen = objects.at(-1);
      if (seen.has(key)) return false;
      seen.add(key);
    }
    previous = token;
  }
  return true;
}

function qualifiedMetaMetadata(url) {
  const hasData = url.searchParams.has("mdc[data]"), hasVersion = url.searchParams.has("mdc[version]");
  if (!hasData && !hasVersion) return true;
  if (!hasData || !hasVersion || !/^[a-f0-9]{32}$/.test(url.searchParams.get("mdc[version]"))) return false;
  const source = url.searchParams.get("mdc[data]");
  let payload;
  try {
    payload = boundedJson(Buffer.from(source));
    if (!uniqueJsonMembers(source)) return false;
  }
  catch { return false; }
  return exactKeys(payload, META_MDC_COMPONENTS) && META_MDC_COMPONENTS.every(key => {
    const component = payload[key];
    return exactKeys(component, ["b"]) && text(component.b)
      && Buffer.from(component.b, "base64").toString("base64") === component.b;
  });
}

function snapshot(input) {
  if (!exactKeys(input, ["schema_version", "profile", "case_name", "document_url",
    "owned", "resources", "companion_authorized"])
    || input.schema_version !== 1 || typeof input.companion_authorized !== "boolean")
    reject("invalid_native_policy");
  const meta = input.profile === "meta-pageview";
  if ((!meta && input.profile !== "google-ads-conversion")
    || input.case_name !== (meta ? "meta-stock" : "google-stock")
    || !parsedUrl(input.document_url) || !Array.isArray(input.resources)
    || input.resources.length !== (meta ? 2 : 1)) reject("invalid_native_policy");
  const owned = input.owned;
  if (meta ? !exactKeys(owned, ["pixel_id"]) || !/^\d{1,32}$/.test(owned.pixel_id)
    || typeof owned.pixel_id !== "string" || input.companion_authorized
    : !exactKeys(owned, ["conversion_id", "conversion_label", "value", "currency", "transaction_id"])
      || typeof owned.conversion_id !== "string" || !/^AW-\d{1,20}$/.test(owned.conversion_id)
      || !text(owned.conversion_label, 128) || owned.value !== 1 || owned.currency !== "USD"
      || !text(owned.transaction_id, 128)) reject("invalid_native_policy");
  const resources = [];
  for (const resource of input.resources) {
    if (!exactKeys(resource, ["role", "url", "sha256"]) || !parsedUrl(resource.url)
      || resources.some(item => item.role === resource.role)) reject("invalid_native_policy");
    const url = parsedUrl(resource.url);
    if (resource.role === "runtime") {
      if (meta ? resource.url !== "https://connect.facebook.net/en_US/fbevents.js"
        : url.origin !== "https://www.googletagmanager.com" || url.pathname !== "/gtag/js"
          || resource.sha256 !== PINS.google
          || !uniqueFields(url, new Set(["id"])) || !exact(url, "id", owned.conversion_id))
        reject("invalid_native_policy");
    } else if (!meta || resource.role !== "configuration"
      || url.origin !== "https://connect.facebook.net"
      || url.pathname !== `/signals/config/${owned.pixel_id}`
      || !uniqueFields(url, new Set(["v", "r", "domain", "hme", "ex_m"]))
      || [...url.searchParams].length !== 5
      || !exact(url, "domain", new URL(input.document_url).hostname))
      reject("invalid_native_policy");
    resources.push(Object.freeze({ role: resource.role, url: resource.url, sha256: resource.sha256 }));
  }
  if (!resources.some(resource => resource.role === "runtime")
    || (meta && !resources.some(resource => resource.role === "configuration")))
    reject("invalid_native_policy");
  const metaCohort = meta ? Object.entries(META_REFERENCE_COHORTS).find(([, pins]) =>
    resources.every(resource => pins[resource.role] === resource.sha256))?.[0] : null;
  if (meta && !metaCohort) reject("invalid_native_policy");
  return Object.freeze({ profile: input.profile, case_name: input.case_name,
    document_url: input.document_url, companion_authorized: input.companion_authorized,
    meta, metaCohort, owned: Object.freeze({ ...owned }), resources: Object.freeze(resources) });
}

function routeFor(url, method, resource, policy) {
  if (policy.meta) {
    return url.origin === "https://www.facebook.com" && url.pathname === "/tr/"
      && method === "GET" && resource === "Image"
      ? { route: "meta_pageview", kind: "primary",
        fields: policy.metaCohort === "authenticated-2026-10-21" ? META_MDC_FIELDS : META_FIELDS } : null;
  }
  const id = policy.owned.conversion_id.slice(3), getImage = method === "GET" && resource === "Image";
  const postXhr = method === "POST" && resource === "XHR";
  const first = url.origin === "https://www.googleadservices.com"
    && url.pathname === `/pagead/conversion/${id}/` && method === "GET" && resource === "XHR";
  const party = url.origin === "https://www.google.com"
    && url.pathname === `/pagead/1p-conversion/${id}/` && postXhr;
  if (first || party) return { route: party ? "google_first_party_primary" : "google_primary",
    kind: "primary", fields: new Set([...GOOGLE_BASE, ...GOOGLE_PRIMARY,
      ...(party ? ["ct_cookie_present", "gcp", "sscte"] : [])]) };
  if (url.origin === "https://googleads.g.doubleclick.net"
    && url.pathname === `/pagead/viewthroughconversion/${id}/`
    && (getImage || (method === "GET" && resource === "Script")))
    return { route: "google_viewthrough", kind: "auxiliary",
      fields: new Set([...GOOGLE_BASE, ...(resource === "Script" ? ["rfmt"] : [])]) };
  if (url.origin === "https://www.google.com" && url.pathname === `/rmkt/collect/${id}/`
    && (getImage || postXhr)) return { route: "google_remarketing", kind: "auxiliary",
    fields: new Set([...GOOGLE_BASE, "gcp"]) };
  if (url.origin === "https://www.google.com" && url.pathname === "/ccm/collect"
    && (getImage || postXhr)) return { route: "google_ccm", kind: "auxiliary", fields: new Set(CCM_FIELDS) };
  if (url.origin === "https://ad.doubleclick.net" && url.pathname === "/ccm/s/collect"
    && (getImage || postXhr)) return { route: "google_selector_free", kind: "auxiliary",
    fields: new Set(S_FIELDS) };
  return null;
}

/**
 * Private controller-side eligibility only. Admission/response registration is
 * trusted caller evidence, not authentication or independent network proof.
 */
export function createNativeStockPolicy(input) {
  const policy = snapshot(input), decisions = new WeakMap(), admitted = [], responses = new Map();
  let primaryIdentity = null, caseIdentity = null, primaryCount = 0, vendorCount = 0;
  let responseLinks = 0, responseBytes = 0;
  const decision = (disposition, reason, data = null) => {
    const output = Object.freeze({ disposition, reason, kind: data?.kind ?? null,
      route: data?.route ?? null, dispatch_authorized: false,
      requires_final_header_gate: !["local_source", "fixture"].includes(data?.kind),
      source_bytes_verified: false,
      independent_ownership_authentication: false });
    if (disposition === "eligible") decisions.set(output, data);
    return output;
  };
  function inspect(request) {
    if (!exactKeys(request, ["url", "method", "resource_type", "headers", "body"],
      ["redirect_from", "response_parent"]) || !plain(request.headers)
      || Reflect.ownKeys(request.headers).length > 128
      || Reflect.ownKeys(request.headers).some(key => typeof key !== "string")
      || !Object.entries(request.headers).every(([key, value]) => text(key, 256)
        && typeof value === "string" && value.isWellFormed() && !/[\r\n]/.test(value))
      || !Buffer.isBuffer(request.body)) return decision("blocked", "invalid_request");
    if (Object.keys(request.headers).some(key =>
      ["authorization", "proxy-authorization"].includes(key.toLowerCase())))
      return decision("blocked", "authenticated_header_not_permitted");
    if (headerBytes(request.headers) + size(request.body) > LIMITS.request_bytes)
      return decision("blocked", "request_byte_limit");
    if (size(request.body) !== 0) return decision("blocked", "unqualified_request_body");
    const url = parsedUrl(request.url);
    if (!url) return decision("blocked", "invalid_request_url");
    const source = policy.resources.find(resource => resource.url === request.url);
    let data;
    if (request.url === policy.document_url && request.method === "GET" && request.resource_type === "Document")
      data = { route: "owned_fixture", kind: "fixture", url: request.url, identity: null };
    else if (source && request.method === "GET" && request.resource_type === "Script")
      data = { route: source.role, kind: "local_source", url: request.url, identity: null };
    else {
      const match = routeFor(url, request.method, request.resource_type, policy);
      if (!match || !uniqueFields(url, match.fields)) return decision("blocked", "unqualified_route_or_field");
      if (policy.meta) {
        if (!qualifiedMetaMetadata(url)) return decision("blocked", "unqualified_metadata_fields");
        if (!exact(url, "id", policy.owned.pixel_id) || !exact(url, "ev", "PageView")
          || !exact(url, "dl", policy.document_url) || (url.searchParams.has("rl") && !exact(url, "rl", "")))
          return decision("blocked", "owned_input_mismatch");
      } else if (match.kind === "primary") {
        if (!exact(url, "label", policy.owned.conversion_label) || !exact(url, "value", "1")
          || !exact(url, "currency_code", "USD") || !exact(url, "oid", policy.owned.transaction_id)
          || !exact(url, "url", policy.document_url)
          || (url.searchParams.has("en") && !exact(url, "en", "conversion")))
          return decision("blocked", "owned_input_mismatch");
      } else if (match.route === "google_selector_free") {
        if (!policy.companion_authorized) return decision("blocked", "companion_authority_missing");
        if (!primaryCount) return decision("deferred", "owned_primary_not_admitted");
        if (!exact(url, "auid", primaryIdentity)) return decision("blocked", "primary_identity_mismatch");
      } else if (match.route === "google_ccm") {
        if (!exact(url, "dl", policy.document_url) || !exact(url, "tid", policy.owned.conversion_id)
          || !exact(url, "tids", policy.owned.conversion_id) || !exact(url, "en", "page_view"))
          return decision("blocked", "owned_input_mismatch");
      } else if (!exact(url, "url", policy.document_url) || !exact(url, "en", "gtag.config"))
        return decision("blocked", "owned_input_mismatch");
      const identity = policy.meta ? null : url.searchParams.get("auid");
      if (!policy.meta && !token(identity)) return decision("blocked", "identity_unavailable");
      if (!policy.meta && caseIdentity !== null && identity !== caseIdentity)
        return decision("blocked", "case_identity_mismatch");
      data = { route: match.route, kind: match.kind, url: request.url, identity };
    }
    const redirect = request.redirect_from, response = request.response_parent;
    if (redirect !== undefined && response !== undefined) return decision("blocked", "ambiguous_parent");
    for (const [value, kind] of [[redirect, "redirect"], [response, "response"]]) {
      if (value === undefined) continue;
      if (!Number.isSafeInteger(value) || value < 0 || value >= admitted.length)
        return decision("blocked", "invalid_parent");
      const parent = responses.get(value);
      if (!parent || (kind === "redirect" ? parent.redirect !== request.url : !parent.urls.has(request.url)))
        return decision("blocked", "unverified_parent_url");
    }
    return decision("eligible", "owned_profile_route", data);
  }
  function registerAdmission(output, ordinal) {
    const data = decisions.get(output);
    if (!data || data.used || ordinal !== admitted.length || ordinal >= LIMITS.observations)
      reject("invalid_policy_admission");
    if (!policy.meta && data.identity !== null && caseIdentity !== null && data.identity !== caseIdentity)
      reject("invalid_policy_admission");
    const vendor = ["primary", "auxiliary"].includes(data.kind);
    if (vendor && vendorCount >= (policy.meta ? LIMITS.meta_requests : LIMITS.google_requests))
      reject("policy_request_count_limit");
    data.used = true;
    admitted.push(data);
    if (vendor) vendorCount++;
    if (!policy.meta && data.identity !== null) caseIdentity = data.identity;
    if (data.kind === "primary") {
      primaryCount++;
      if (!policy.meta) primaryIdentity = data.identity;
    }
    return Object.freeze({ ordinal, kind: data.kind, route: data.route });
  }
  function recordResponse(response) {
    if (!exactKeys(response, ["ordinal", "status", "headers", "body", "complete"])
      || !Number.isSafeInteger(response.ordinal) || !admitted[response.ordinal]
      || ["fixture", "local_source"].includes(admitted[response.ordinal].kind)
      || responses.has(response.ordinal) || !Number.isInteger(response.status)
      || response.status < 200 || response.status > 599 || response.complete !== true
      || !Array.isArray(response.headers) || response.headers.length > 256
      || !response.headers.every(pair => Array.isArray(pair) && pair.length === 2
        && text(pair[0], 256) && typeof pair[1] === "string" && pair[1].isWellFormed()
        && !/[\r\n]/.test(pair[1]))
      || !Buffer.isBuffer(response.body)
      || Buffer.byteLength(JSON.stringify(response.headers)) + size(response.body) > LIMITS.response_bytes)
      reject("invalid_policy_response");
    const bytes = Buffer.byteLength(JSON.stringify(response.headers)) + size(response.body);
    if (responseBytes + bytes > LIMITS.aggregate_bytes) reject("policy_response_aggregate_limit");
    const locations = response.headers.filter(([key]) => key.toLowerCase() === "location");
    const redirecting = [301, 302, 303, 307, 308].includes(response.status);
    if (locations.length > 1) reject("invalid_policy_response");
    let redirect = null;
    if (redirecting && locations.length) {
      try { redirect = new URL(locations[0][1], admitted[response.ordinal].url).href; }
      catch { reject("invalid_policy_response"); }
      if (!parsedUrl(redirect)) reject("invalid_policy_response");
    }
    const urls = new Set();
    const json = response.headers.some(([key, value]) => key.toLowerCase() === "content-type"
      && value.toLowerCase().split(";")[0].trim() === "application/json");
    if (json) {
      const parsed = boundedJson(response.body);
      let nodes = 0;
      const visit = (value, depth) => {
        if (++nodes > 5000 || depth > 16) reject("response_structure_limit");
        if (typeof value === "string" && parsedUrl(value)) urls.add(value);
        else if (value && typeof value === "object") Object.values(value).forEach(child => visit(child, depth + 1));
      };
      visit(parsed, 0);
    }
    responses.set(response.ordinal, { redirect, urls });
    responseBytes += bytes;
    responseLinks += urls.size + (redirect === null ? 0 : 1);
    return Object.freeze({ urls: urls.size, redirect: redirect !== null,
      evidence: "caller_attested_complete_original_not_independent_network_proof" });
  }
  return Object.freeze({ inspect, registerAdmission, recordResponse,
    summary: () => ({ profile: policy.profile, registered: admitted.length, primary: primaryCount,
      vendor_registered: vendorCount,
      responses: responses.size, response_links: responseLinks, dispatch_authorized: false,
      response_registered_bytes: responseBytes, whole_case_byte_budget_verified: false,
      source_bytes_verified: false, independent_ownership_authentication: false }) });
}
