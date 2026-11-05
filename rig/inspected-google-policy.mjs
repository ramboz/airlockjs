import { isProxy } from "node:util/types";
import { createNativeStockPolicy } from "./native-stock-policy.mjs";

const fail = reason => { throw new Error(reason); };
function data(input) {
  let nodes = 0;
  const copy = (value, depth) => {
    if (++nodes > 256 || depth > 6) fail("invalid_google_binding_input");
    if (value === null || ["boolean", "number"].includes(typeof value)) return value;
    if (typeof value === "string") {
      if (value.length > 8192) fail("invalid_google_binding_input");
      return value;
    }
    if (!value || typeof value !== "object" || isProxy(value)) fail("invalid_google_binding_input");
    const array = Array.isArray(value);
    if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)
      && !(Object.getPrototypeOf(value) === null && !array)) fail("invalid_google_binding_input");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (array) {
      const length = descriptors.length.value;
      if (length > 128 || keys.length !== length + 1
        || keys.some(key => key !== "length" && !Array.from({ length }, (_, n) => String(n)).includes(key))
        || keys.some(key => !Object.hasOwn(descriptors[key], "value"))) fail("invalid_google_binding_input");
      return Array.from({ length }, (_, n) => copy(descriptors[n].value, depth + 1));
    }
    const result = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string" || !Object.hasOwn(descriptors[key], "value")) fail("invalid_google_binding_input");
      result[key] = copy(descriptors[key].value, depth + 1);
    }
    return result;
  };
  return copy(input, 0);
}
function record(input, required, optional = []) {
  if (!input || typeof input !== "object" || isProxy(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail("invalid_google_binding_input");
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  if (!required.every(key => Object.hasOwn(descriptors, key))
    || keys.some(key => !required.includes(key) && !optional.includes(key))
    || keys.some(key => !Object.hasOwn(descriptors[key], "value"))) fail("invalid_google_binding_input");
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

// Logical observations are caller evidence, not dispatch permission.
export function createInspectedGooglePolicy(options) {
  const input = record(options, ["mode", "profile", "resolveObservation"]);
  if (input.mode !== "DECLARED-GOOGLE-PROFILE" || typeof input.resolveObservation !== "function"
    || isProxy(input.resolveObservation)) fail("invalid_google_binding_input");
  const config = data(input.profile);
  if (!config || config.profile !== "google-ads-conversion" || config.case_name !== "google-stock")
    fail("unsupported_inspected_profile");
  const policy = createNativeStockPolicy(config), mappings = new Map(), logical = new Map();
  return Object.freeze({
    inspect(actual, expectedRedirect) {
      let candidates;
      try {
        candidates = input.resolveObservation(Object.freeze({ ordinal: actual.ordinal, connection: actual.connection,
          stream: actual.stream, url: actual.url, method: actual.method }));
      } catch { fail("logical_observation_resolver_failed"); }
      const copied = data(candidates);
      if (!Array.isArray(copied) || copied.length !== 1) fail("missing_or_ambiguous_logical_observation");
      const observation = record(copied[0], ["network_id", "url", "method", "resource_type"],
        ["fetch_id", "redirect_from", "response_parent"]);
      if (typeof observation.network_id !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(observation.network_id)
        || (Object.hasOwn(observation, "fetch_id") && (typeof observation.fetch_id !== "string"
          || !/^[A-Za-z0-9._:-]{1,256}$/.test(observation.fetch_id)))
        || observation.url !== actual.url || observation.method !== actual.method
        || typeof observation.resource_type !== "string") fail("logical_observation_mismatch");
      const prior = logical.get(observation.network_id);
      if (prior && Object.keys({ ...prior, ...observation }).some(key => prior[key] !== observation[key])) {
        const parent = mappings.get(observation.redirect_from);
        if (!prior.fetch_id || !observation.fetch_id || prior.fetch_id === observation.fetch_id
          || observation.resource_type !== prior.resource_type || observation.method !== prior.method
          || parent?.logical_network_id !== observation.network_id || parent.logical_fetch_id !== prior.fetch_id)
          fail("changed_logical_observation");
      }
      if (expectedRedirect !== null && observation.redirect_from !== expectedRedirect)
        fail("missing_actual_redirect_parent");
      const parents = {};
      for (const key of ["redirect_from", "response_parent"]) {
        if (!Object.hasOwn(observation, key)) continue;
        const parent = mappings.get(observation[key]);
        if (!Number.isSafeInteger(observation[key]) || !parent || parent.ordinal >= actual.ordinal)
          fail("invalid_physical_parent");
        parents[key] = parent.policy_ordinal;
      }
      if (actual.headers.length > 128) fail("google_header_field_limit");
      const headers = Object.create(null), duplicates = [];
      for (const [name, value] of actual.headers) {
        if (name.startsWith(":")) continue;
        const key = name.toLowerCase();
        if (Object.hasOwn(headers, key)) duplicates.push(key);
        else headers[key] = value;
      }
      const decision = policy.inspect({ url: actual.url, method: actual.method,
        resource_type: observation.resource_type, headers, body: Buffer.alloc(0), ...parents });
      if (decision.disposition !== "eligible") fail(decision.reason);
      if (!["primary", "auxiliary"].includes(decision.kind)) fail("unsupported_inspected_google_route");
      return { observation, decision, duplicates, actual };
    },
    register(binding) {
      const { observation, decision, actual, duplicates } = binding, ordinal = mappings.size;
      policy.registerAdmission(decision, ordinal);
      const mapping = Object.freeze({ ordinal: actual.ordinal, policy_ordinal: ordinal,
        connection: actual.connection, stream: actual.stream, logical_network_id: observation.network_id,
        ...(observation.fetch_id ? { logical_fetch_id: observation.fetch_id } : {}),
        resource_type: observation.resource_type, redirect_from: observation.redirect_from ?? null,
        response_parent: observation.response_parent ?? null });
      mappings.set(actual.ordinal, mapping);
      logical.set(observation.network_id, Object.freeze({ ...observation }));
      return { ...mapping, policy_decision: decision, header_view: "classification_only_first_occurrence",
        duplicate_header_names: duplicates };
    },
    recordResponse(row) {
      const mapping = mappings.get(row.ordinal);
      if (!mapping) fail("unmatched_policy_response");
      return policy.recordResponse({ ordinal: mapping.policy_ordinal, status: row.status,
        headers: row.headers, body: Buffer.concat(row.body, row.decoded_body_bytes), complete: true });
    },
    summary: () => ({ ...policy.summary(), full_native_guard_qualified: false,
      execution_authority: false, native_tls_parity: false, native_execution_qualified: false }),
  });
}
