import { isMetaCookieIdentityField, isUnverifiableMetaCookieIdentity } from "./parity/redact.js";

const ANNOTATIONS = new Set([
  "_variant", "_id_note", "_cd_note", "_ud_note", "_fbp_note", "_experiments_note", "_dl_note",
]);

function describe(value, name) {
  if (value == null) return { state: "unavailable", type: value === null ? "null" : "undefined" };
  if (Array.isArray(value)) {
    return { state: "structured", type: "array", count: value.length, items: value.map((item) => describe(item, name)) };
  }
  if (typeof value === "object") {
    return {
      state: "structured", type: "object",
      members: Object.entries(value).map(([key, item]) => ({ name: key, ...describe(item, key) })),
    };
  }
  const redacted = typeof value === "string" && (isMetaCookieIdentityField(name)
    ? isUnverifiableMetaCookieIdentity(name, value)
    : /REDACTED/i.test(value) || (name === "id" && /^0+$/.test(value)));
  return { state: redacted ? "redacted" : "literal", type: typeof value };
}

/**
 * Pure gap comparison; accepts RECEIVER data, not a precomputed expected report.
 * The fixture is a historical redacted description, not original wire bytes.
 * Field names/types/dispositions are public; raw values never enter this result.
 */
export function compareMetaPageViewPrototype({ generatedRequest, fixture, beaconIndex = 0 }) {
  const reference = fixture?.beacons?.[beaconIndex];
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) throw new Error("fixture-beacon-required");
  let url;
  try { url = new URL(generatedRequest?.url); } catch { /* unavailable input stays visible below */ }
  const generated = new Map();
  if (url) {
    for (const [name, value] of url.searchParams) {
      if (!generated.has(name)) generated.set(name, []);
      generated.get(name).push(value);
    }
  }
  const referenceNames = Object.keys(reference).filter((name) => !ANNOTATIONS.has(name));
  const fields = [...new Set([...generated.keys(), ...referenceNames])].sort().map((name) => {
    const values = generated.get(name);
    const referencePresent = referenceNames.includes(name);
    const source = referencePresent ? describe(reference[name], name) : { state: "missing" };
    const actual = !values ? { state: "missing" } : values.length === 1 ? describe(values[0], name) : {
      state: "multimap", type: "string[]", count: values.length, items: values.map((value) => describe(value, name)),
    };
    let disposition;
    if (!values) disposition = "missing-generated";
    else if (!referencePresent) disposition = "extra-generated";
    else if (source.state === "unavailable") disposition = "unavailable";
    else if (values.length !== 1 || source.state === "structured") disposition = "representation-different";
    else if (actual.type !== source.type) disposition = "type-different";
    else if (isUnverifiableMetaCookieIdentity(name, reference[name])
      || isUnverifiableMetaCookieIdentity(name, values[0])) disposition = "redacted-unverifiable";
    else if (values[0] !== reference[name]) disposition = "different";
    else if (source.state === "redacted" || actual.state === "redacted") disposition = "redacted-unverifiable";
    else disposition = "literal-match";
    return { name, generated: actual, reference: source, disposition };
  });
  return {
    overall: "inconclusive",
    fullCompatibility: false,
    reference: "historical-redacted-capture-description",
    referenceBeacon: beaconIndex,
    generatedRequest: url ? "observed-query" : "unavailable",
    fields,
    annotations: Object.keys(reference).filter((name) => ANNOTATIONS.has(name)),
    transport: {
      endpoint: !url || !fixture.endpoint ? "unavailable" : `${url.origin}${url.pathname}` === fixture.endpoint ? "literal-match" : "different",
      method: !generatedRequest?.method || !fixture.method ? "unavailable" : generatedRequest.method === fixture.method ? "literal-match" : "different",
      generated: "Node-loopback-Fetch-only",
      native: "Image-versus-Fetch-not-qualified-by-this-fixture",
    },
    gaps: [
      { name: "omitted-experiment-flags", state: "unavailable", count: 38 },
      ...[
        "original-request-bytes-and-query-order", "native-query-multiplicity-and-structured-encoding",
        "headers-and-credentials", "native-response-and-redirect-effects", "browser-transport-and-Image-behavior",
        "browser-cookies-and-identity-continuity", "native-consent-and-queue-semantics",
        "matching-and-attribution", "performance-and-C2-C3", "equivalent-native-input-and-full-reference",
        "all-other-commands-and-native-features",
      ].map((name) => ({ name, state: "unavailable" })),
    ],
  };
}
