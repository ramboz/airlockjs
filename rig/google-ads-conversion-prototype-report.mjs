const MAPPED = ["label", "value", "currency_code", "oid", "url"];
const KNOWN = [
  "apvc", "async", "auid", "bg", "category", "cerd", "cid", "crd", "ct_cookie_present",
  "currency_code", "cv", "data", "dl", "dma", "dt", "en", "eoid", "ept", "fmt", "frm",
  "fsk", "fst", "gcd", "gcl_ctr", "gcp", "gtm", "gtm_ee", "guid", "hn", "id", "ipr",
  "is_vtc", "label", "navt", "npa", "oid", "pscdl", "pscrd", "random", "rcb", "rfmt",
  "rmt_tld", "rnd", "scrsrc", "tag_exp", "tfd", "tft", "tiba", "tid", "tids", "u_h",
  "u_w", "uaa", "uab", "uafvl", "uam", "uamb", "uap", "uapv", "uaw", "url", "value",
];
const GAPS = [
  "config-page-remarketing-companions",
  "first-party-primary-alternative",
  "response-linked-fetch-fallback-redirect-cookie",
  "identity-cookies-click-ids",
  "native-Consent-Mode",
  "callbacks-navigation",
  "browser-transport-headers-credentials",
  "deduplication-matching-attribution-backend-receipt",
  "CWV-performance",
  "native-values-endpoints-raw-query-body-headers-unavailable",
  "historical-SDK-runtime-configuration-bytes-version-unavailable",
  "fresh-current-context-native-reference-unavailable",
  "complete-native-primary-and-chain-unqualified",
];

function nativeShape(projection) {
  if (!projection) return { disposition: "missing-explicit-projection", rows: [], fields: [] };
  const rows = projection.request_rows;
  const counts = [0, 0, 1, 0, 33, 33, 20, 3, 3, 38, 39, 44];
  const methods = ["GET", "GET", "GET", "GET", "GET", "POST", "POST", "POST", "GET", "GET", "GET", "POST"];
  const resources = ["document", "script", "script", "script", "script", "fetch", "fetch", "fetch", "image", "image", "fetch", "fetch"];
  const valid = projection.schema_version === 1 &&
    projection.evidence_kind === "field-only-retained-native-ledger-projection-not-full-reference" &&
    projection.fullCompatibility === false && projection.primary_ordinal === 10 && projection.response_linked_ordinal === 11 &&
    Array.isArray(rows) && rows.length === 12 && rows.every((row, index) =>
      row?.ordinal === index && row.method === methods[index] && row.resource_type === resources[index] &&
      row.query_pair_count === counts[index] && Array.isArray(row.query_names_in_order) &&
      row.query_names_in_order.length === counts[index] && row.query_names_in_order.every((name) => KNOWN.includes(name)) &&
      row.guard_blocked === [7, 8].includes(index) && row.response_observed === ![7, 8, 11].includes(index) &&
      row.response_status === ([7, 8, 11].includes(index) ? null : 200)) &&
    JSON.stringify(projection.unique_query_names) === JSON.stringify(KNOWN) &&
    JSON.stringify([...new Set(rows.flatMap((row) => row.query_names_in_order))].sort()) === JSON.stringify(KNOWN);
  if (!valid) return { disposition: "invalid-or-nonconversion-projection", rows: [], fields: [] };
  return {
    disposition: "partial-retained-native-shape-only",
    rowCount: rows.length, uniqueFieldCount: KNOWN.length,
    nativeValueEquality: "unavailable", nativeEndpointEquality: "unavailable",
    rows: rows.map((row) => {
      const names = row.query_names_in_order;
      const unique = [...new Set(names)];
      const mapped = row.ordinal === 10 ? unique.filter((name) => MAPPED.includes(name)).length : 0;
      return {
        ordinal: row.ordinal, method: row.method, resourceType: row.resource_type,
        disposition: row.ordinal === 10 ? "five-field-name-subset-only" : "not-implemented",
        pairCount: row.query_pair_count, queryNamesInOrder: [...names],
        fieldsInOrder: names.map((name, position) => ({
          name, position,
          disposition: row.ordinal === 10 && MAPPED.includes(name) ? "local-mapping-name-only-native-value-unavailable" : "not-implemented",
        })),
        duplicateFields: unique.filter((name) => names.filter((item) => item === name).length > 1)
          .map((field) => ({ field, occurrences: names.filter((name) => name === field).length })),
        guardBlocked: row.guard_blocked, responseObserved: row.response_observed, responseStatus: row.response_status,
        responseLinked: row.ordinal === 11, transactionFieldPresent: names.includes("oid"),
        mappedFieldNameCount: mapped, missingFieldNameCount: unique.length - mapped,
      };
    }),
    fields: KNOWN.map((name) => ({
      name,
      disposition: MAPPED.includes(name) ? "primary-local-name-only-native-semantics-unavailable" : "not-implemented",
      rows: rows.filter((row) => row.query_names_in_order.includes(name)).map((row) => row.ordinal),
      totalOccurrences: rows.reduce((count, row) => count + row.query_names_in_order.filter((field) => field === name).length, 0),
    })),
    limitations: [
      "field-only-not-native-value-replay-or-protocol-oracle",
      "no-original-request-response-bytes-or-raw-query-or-private-identifiers",
      "one-historical-native-command-not-current-same-input-reference",
      "primary-HTTP200-not-backend-receipt",
      "ordinal11-response-unobserved-oid-absent-eoid-not-transaction-substitute",
      "two-guard-blocked-auxiliaries-two-unavailable-bodies",
      "historical-runtime-configuration-bytes-version-unsaved",
    ],
  };
}

function localRelationship(request, snapshot, endpoint, ordinal) {
  let url;
  try { url = new URL(request?.url); } catch { /* Invalid input remains a failed local assertion. */ }
  const query = url?.searchParams || new URLSearchParams();
  const args = snapshot?.args;
  const params = args?.[2];
  const validCommand = Array.isArray(args) && args.length === 3 && args[0] === "event" && args[1] === "conversion" &&
    params && typeof params === "object" && !Array.isArray(params) &&
    Reflect.ownKeys(params).every((key) => ["send_to", "value", "currency", "transaction_id"].includes(key)) &&
    params.send_to === "AW-0000000000/SYNTHETIC_LABEL";
  const fields = [["send_to", "label"], ["value", "value"], ["currency", "currency_code"], ["transaction_id", "oid"], ["pageURL", "url"]].map(([input, wire]) => {
    const source = input === "pageURL" ? snapshot?.context : params;
    const provided = Boolean(source && Object.hasOwn(source, input));
    const value = provided ? source[input] : undefined;
    const knownOmission = input !== "send_to" && input !== "pageURL" && (!provided || value === undefined);
    const supportedType = knownOmission ||
      (input === "value" ? typeof value === "number" && Number.isFinite(value) : typeof value === "string");
    const expected = input === "send_to" ? "SYNTHETIC_LABEL" : String(value);
    const occurrences = query.getAll(wire);
    return {
      input, wire, provided,
      inputType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value,
      expectation: knownOmission ? provided ? "explicit-undefined-omitted" : "omitted" :
        value === "" ? "empty-preserved" : value === 0 ? "zero-preserved" : "provided-value-preserved",
      wireOccurrences: occurrences.length,
      relationshipPreserved: Boolean(validCommand && supportedType &&
        (knownOmission ? occurrences.length === 0 : occurrences.length === 1 && occurrences[0] === expected)),
    };
  });
  const expectedFields = fields.filter((field) => !["omitted", "explicit-undefined-omitted"].includes(field.expectation)).map((field) => field.wire);
  const names = [...query.keys()];
  const endpointMatch = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/0000000000\/$/);
  const literalEndpoint = endpointMatch && Number(endpointMatch[1]) <= 65535;
  const routingPreserved = Boolean(literalEndpoint && url && request?.method === "GET" &&
    !url.username && !url.password && !url.hash && request.url.startsWith(`${endpoint}?`) &&
    `${url.origin}${url.pathname}` === endpoint);
  const uniqueQueryNames = new Set(names).size === names.length;
  const onlyExpectedFields = names.length === expectedFields.length && names.every((name) => expectedFields.includes(name));
  return {
    ordinal, routingPreserved, fields, uniqueQueryNames, onlyExpectedFields, pairCount: names.length,
    unknownFieldCount: names.filter((name) => !MAPPED.includes(name)).length,
    relationshipsPreserved: routingPreserved && uniqueQueryNames && onlyExpectedFields && fields.every((field) => field.relationshipPreserved),
    disposition: "synthetic-input-to-independent-local-arrival-only",
    headersAndBody: "not-recorded-by-this-receiver",
  };
}

/** Pure: accepts explicit independent arrivals and controlled snapshots only.
 * Public output exposes names/counts/booleans, NEVER input values or URLs.
 */
export function reportGoogleAdsConversionPrototype({ observedRequests = [], commandSnapshots = [], endpoint, projection } = {}) {
  return {
    overall: "INCONCLUSIVE", fullCompatibility: false,
    localEvidence: "synthetic-contract-not-native-parity",
    cardinalityPreserved: Array.isArray(observedRequests) && Array.isArray(commandSnapshots) && observedRequests.length === commandSnapshots.length,
    local: Array.from({ length: Math.max(observedRequests.length, commandSnapshots.length) }, (_, index) =>
      localRelationship(observedRequests[index], commandSnapshots[index], endpoint, index)),
    nativeShape: nativeShape(projection),
    gaps: [...GAPS],
  };
}
