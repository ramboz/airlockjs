import { snapshotDestinationSelectors } from "./destination-selectors.js";
import { validConsentCommand } from "./consent-commands.js";

const PARAMS = ["send_to", "value", "currency", "transaction_id"];
const SCOPE_PARAMS = ["value", "currency", "transaction_id"];

function validURL(value, empty = false) {
  if (typeof value !== "string" || value.length > 2048 || !value.isWellFormed()) return false;
  if (empty && value === "") return true;
  if (!/^https?:\/\//.test(value) || /[\s\u0000-\u001f\u007f]/u.test(value)) return false; // eslint-disable-line no-control-regex -- reject URL control characters
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch { return false; }
}

function dataRecord(value, allowed) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => !allowed.includes(key))) return null;
  const copy = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    copy[key] = descriptor.value;
  }
  return copy;
}

function validateValues(params) {
  if (params.value !== undefined && (typeof params.value !== "number" || !Number.isFinite(params.value))) throw new Error("unsupported-value");
  if (params.currency !== undefined && (typeof params.currency !== "string" || params.currency.length > 64 || !params.currency.isWellFormed())) throw new Error("unsupported-currency");
  if (params.transaction_id !== undefined && (typeof params.transaction_id !== "string" || params.transaction_id.length > 128 || !params.transaction_id.isWellFormed())) throw new Error("unsupported-transaction");
}

function selectorValues(value, multiple) {
  if (!multiple || !Array.isArray(value)) return [value];
  const selectors = snapshotDestinationSelectors(value);
  if (!selectors) throw new Error("destination-mismatch");
  return selectors;
}

/** Experimental synthetic-only connector; no vendor SDK or ambient I/O.
 * Config is retained state ONLY, deliberately not native config behavior.
 */
export function createGoogleAdsConversionPrototype({
  endpoint, additionalEndpoint, experimentalRouting = false, experimentalParameterScopes = false,
  experimentalMultiDestination = false, experimentalConsentCommands = false,
} = {}) {
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean" ||
      typeof experimentalMultiDestination !== "boolean" || typeof experimentalConsentCommands !== "boolean" ||
      (experimentalMultiDestination && !experimentalRouting)) {
    throw new Error("invalid-experimental-option");
  }
  const pattern = experimentalRouting === true
    ? /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,20})\/$/
    : /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(0000000000)\/$/;
  const match = typeof endpoint === "string" && endpoint.match(pattern);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  const second = experimentalMultiDestination && typeof additionalEndpoint === "string" && additionalEndpoint.match(pattern);
  if (experimentalMultiDestination && (!second || Number(second[1]) > 65535 || match[2] === second[2])) {
    throw new Error("literal-loopback-endpoint-required");
  }
  const destinations = new Map([[`AW-${match[2]}`, endpoint]]);
  if (experimentalMultiDestination) destinations.set(`AW-${second[2]}`, additionalEndpoint);
  let initialized = false;
  const globalScope = Object.create(null);
  const configs = new Map();
  const endpoints = [...destinations.values()];
  return {
    manifest: {
      name: "airlock/google-ads/conversion-prototype",
      events: ["google-ads-command"],
      reads: [],
      capabilities: { egress: true },
      endpoints,
      purposes: { egress: ["ad_storage"], endpoints: Object.fromEntries(endpoints.map((value) => [value, ["ad_storage"]])) },
    },
    init() { initialized = true; },
    handle(event) {
      if (!initialized) throw new Error("connector-not-initialized");
      const { args, context: capturedContext } = event?.payload || {};
      if (event?.type !== "google-ads-command" || !Array.isArray(args)) throw new Error("unsupported-command");
      if (experimentalConsentCommands && args[0] === "consent") {
        if (!validConsentCommand(args)) throw new Error("unsupported-consent");
        return [];
      }
      if (experimentalParameterScopes && args[0] === "set") {
        if (args.length !== 2 && args.length !== 3) throw new Error("unsupported-command");
        let values;
        if (args.length === 2) {
          values = dataRecord(args[1], SCOPE_PARAMS);
        } else if (typeof args[1] === "string" && SCOPE_PARAMS.includes(args[1])) {
          values = Object.assign(Object.create(null), { [args[1]]: args[2] });
        }
        if (!values) throw new Error("unsupported-parameters");
        validateValues(values);
        Object.assign(globalScope, values);
        return [];
      }
      if (args[0] === "config") {
        if (args.length !== 2 && !(experimentalParameterScopes && args.length === 3)) throw new Error("unsupported-config");
        if (!destinations.has(args[1])) throw new Error(experimentalRouting === true ? "destination-mismatch" : "synthetic-destination-required");
        if (configs.has(args[1])) throw new Error("duplicate-config");
        let configScope = Object.create(null);
        if (args.length === 3) {
          const values = dataRecord(args[2], SCOPE_PARAMS);
          if (!values) throw new Error("unsupported-parameters");
          validateValues(values);
          configScope = values;
        }
        configs.set(args[1], configScope);
        return [];
      }
      if (args.length !== 3 || args[0] !== "event" || args[1] !== "conversion") throw new Error("unsupported-command");
      if (!configs.size) throw new Error("conversion-before-config");
      const params = dataRecord(args[2], PARAMS);
      if (!params) throw new Error("unsupported-parameters");
      let selected;
      if (experimentalRouting === true) {
        const selectors = selectorValues(params.send_to, experimentalMultiDestination);
        if (!selectors.length || selectors.length > (experimentalMultiDestination ? 2 : 1)) throw new Error("destination-mismatch");
        const seen = new Set();
        selected = selectors.map((value) => {
          const selector = typeof value === "string" && value.match(/^(AW-\d{1,20})\/([A-Za-z0-9_-]{1,128})$/);
          if (!selector || !destinations.has(selector[1]) || seen.has(selector[1])) throw new Error("destination-mismatch");
          seen.add(selector[1]);
          return { destination: selector[1], label: selector[2] };
        });
      } else if (!Object.hasOwn(params, "send_to") || params.send_to !== "AW-0000000000/SYNTHETIC_LABEL") {
        throw new Error("synthetic-selector-required");
      } else {
        selected = [{ destination: "AW-0000000000", label: "SYNTHETIC_LABEL" }];
      }
      if (selected.some(({ destination }) => !configs.has(destination))) throw new Error("conversion-before-config");
      validateValues(params);
      const context = dataRecord(capturedContext, ["pageURL", "referrer"]);
      if (!context || Reflect.ownKeys(context).length !== 2 ||
          !Object.hasOwn(context, "pageURL") || !Object.hasOwn(context, "referrer") ||
          !validURL(context.pageURL) || !validURL(context.referrer, true)) throw new Error("invalid-context");
      return selected.map(({ destination, label }) => {
        const effective = experimentalParameterScopes ? { ...globalScope, ...configs.get(destination), ...params } : params;
        const query = new URLSearchParams({ label });
        for (const [input, output] of [["value", "value"], ["currency", "currency_code"], ["transaction_id", "oid"]]) {
          if (effective[input] !== undefined) query.set(output, String(effective[input]));
        }
        query.set("url", context.pageURL);
        const url = `${destinations.get(destination)}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        return { url, method: "GET" };
      });
    },
  };
}
