const PARAMS = ["send_to", "value", "currency", "transaction_id"];

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

/** Experimental synthetic-only connector; no vendor SDK or ambient I/O.
 * Config is retained state ONLY, deliberately not native config behavior.
 */
export function createGoogleAdsConversionPrototype({ endpoint } = {}) {
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/0000000000\/$/);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  let initialized = false;
  let configured = false;
  return {
    manifest: {
      name: "airlock/google-ads/conversion-prototype",
      events: ["google-ads-command"],
      reads: [],
      capabilities: { egress: true },
      endpoints: [endpoint],
      purposes: { egress: ["ad_storage"], endpoints: { [endpoint]: ["ad_storage"] } },
    },
    init() { initialized = true; },
    handle(event) {
      if (!initialized) throw new Error("connector-not-initialized");
      const { args, context: capturedContext } = event?.payload || {};
      if (event?.type !== "google-ads-command" || !Array.isArray(args)) throw new Error("unsupported-command");
      if (args[0] === "config") {
        if (args.length !== 2) throw new Error("unsupported-config");
        if (args[1] !== "AW-0000000000") throw new Error("synthetic-destination-required");
        if (configured) throw new Error("duplicate-config");
        configured = true;
        return [];
      }
      if (args.length !== 3 || args[0] !== "event" || args[1] !== "conversion") throw new Error("unsupported-command");
      if (!configured) throw new Error("conversion-before-config");
      const params = dataRecord(args[2], PARAMS);
      if (!params) throw new Error("unsupported-parameters");
      if (!Object.hasOwn(params, "send_to") || params.send_to !== "AW-0000000000/SYNTHETIC_LABEL") throw new Error("synthetic-selector-required");
      if (params.value !== undefined && (typeof params.value !== "number" || !Number.isFinite(params.value))) throw new Error("unsupported-value");
      if (params.currency !== undefined && (typeof params.currency !== "string" || params.currency.length > 64 || !params.currency.isWellFormed())) throw new Error("unsupported-currency");
      if (params.transaction_id !== undefined && (typeof params.transaction_id !== "string" || params.transaction_id.length > 128 || !params.transaction_id.isWellFormed())) throw new Error("unsupported-transaction");
      const context = dataRecord(capturedContext, ["pageURL", "referrer"]);
      if (!context || Reflect.ownKeys(context).length !== 2 ||
          !Object.hasOwn(context, "pageURL") || !Object.hasOwn(context, "referrer") ||
          !validURL(context.pageURL) || !validURL(context.referrer, true)) throw new Error("invalid-context");
      const query = new URLSearchParams({ label: "SYNTHETIC_LABEL" });
      for (const [input, output] of [["value", "value"], ["currency", "currency_code"], ["transaction_id", "oid"]]) {
        if (params[input] !== undefined) query.set(output, String(params[input]));
      }
      query.set("url", context.pageURL);
      const url = `${endpoint}?${query}`;
      if (url.length > 8192) throw new Error("encoded-context-limit");
      return [{ url, method: "GET" }];
    },
  };
}
