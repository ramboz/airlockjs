import { snapshotDestinationSelectors } from "./destination-selectors.js";
import { validConsentCommand } from "./consent-commands.js";
import { validBootstrapCommand } from "./bootstrap-command.js";
import { snapshotPurchaseCartItems } from "./purchase-cart-items.js";
import { validRemarketingDisableCommand } from "./remarketing-control.js";
import { isEnabledViewEvent, isRemarketingPurchase, REMARKETING_PURCHASE_MARKER, snapshotViewItems, validViewItemValue } from "./view-items.js";

const PARAMS = ["send_to", "value", "currency", "transaction_id"];
const SCOPE_PARAMS = ["value", "currency", "transaction_id"];
const FEED_PARAMS = ["aw_merchant_id", "aw_feed_country", "aw_feed_language"];
const CUSTOM_PARAMS = ["example_variable", "color", "product_name"];

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
  experimentalMultiDestination = false, experimentalConsentCommands = false, experimentalBootstrap = false, experimentalPurchase = false,
  experimentalPurchaseCart = false, experimentalPurchaseDiscount = false, experimentalPurchaseFeed = false,
  experimentalCustomVariables = false, experimentalRetailViewItem = false, experimentalEducationViewItem = false,
  experimentalLocalViewItem = false, experimentalRealEstateViewItem = false, experimentalTravelViewItem = false,
  experimentalFlightsViewItem = false,
  experimentalViewItemList = false, experimentalViewSearchResults = false, experimentalAddToCart = false,
  experimentalRemarketingPurchase = false, experimentalDisableRemarketing = false,
} = {}) {
  const viewOptions = {
    retail: experimentalRetailViewItem, education: experimentalEducationViewItem,
    local: experimentalLocalViewItem, realEstate: experimentalRealEstateViewItem,
    travel: experimentalTravelViewItem, flights: experimentalFlightsViewItem,
  };
  const experimentalViewItem = Object.values(viewOptions).some((enabled) => enabled === true);
  const viewEvents = {
    view_item_list: experimentalViewItemList,
    view_search_results: experimentalViewSearchResults,
    add_to_cart: experimentalAddToCart,
  };
  const experimentalViewEvent = experimentalRemarketingPurchase === true || Object.values(viewEvents).some((enabled) => enabled === true);
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean" ||
      typeof experimentalMultiDestination !== "boolean" || typeof experimentalConsentCommands !== "boolean" ||
      typeof experimentalBootstrap !== "boolean" || typeof experimentalPurchase !== "boolean" ||
      typeof experimentalPurchaseCart !== "boolean" || (experimentalPurchaseCart && !experimentalPurchase) ||
      typeof experimentalPurchaseDiscount !== "boolean" || (experimentalPurchaseDiscount && !experimentalPurchase) ||
      typeof experimentalPurchaseFeed !== "boolean" || (experimentalPurchaseFeed && !experimentalPurchaseCart) ||
      typeof experimentalCustomVariables !== "boolean" || typeof experimentalRemarketingPurchase !== "boolean" ||
      typeof experimentalDisableRemarketing !== "boolean" ||
      Object.values(viewEvents).some((enabled) => typeof enabled !== "boolean") ||
      Object.values(viewOptions).some((enabled) => typeof enabled !== "boolean") ||
      ((experimentalViewItem || experimentalViewEvent) && (experimentalParameterScopes || experimentalMultiDestination)) ||
      (experimentalDisableRemarketing && (experimentalParameterScopes || experimentalMultiDestination)) ||
      (experimentalMultiDestination && !experimentalRouting)) {
    throw new Error("invalid-experimental-option");
  }
  const pattern = experimentalRouting === true
    ? /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,32})\/$/
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
  let seenCommand = false;
  let remarketingDisabled = false;
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
      const firstCommand = !seenCommand;
      seenCommand = true;
      if (experimentalDisableRemarketing && args[0] === "set" && args[1] === "allow_ad_personalization_signals") {
        if (!firstCommand || !validRemarketingDisableCommand(args)) throw new Error("unsupported-remarketing-control");
        remarketingDisabled = true;
        return [];
      }
      if (experimentalBootstrap && args[0] === "js") {
        if (!validBootstrapCommand(args)) throw new Error("unsupported-bootstrap");
        return [];
      }
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
      const purchase = experimentalPurchase && args[1] === "purchase";
      const input = args[2];
      const remarketingPurchase = input && typeof input === "object" && !Array.isArray(input) &&
        isRemarketingPurchase(args[1], Object.hasOwn(input, "send_to"), experimentalViewItem, experimentalRemarketingPurchase);
      const viewItem = isEnabledViewEvent(args[1], experimentalViewItem, viewEvents) || remarketingPurchase;
      if (args.length !== 3 || args[0] !== "event" || (args[1] !== "conversion" && !purchase && !viewItem)) throw new Error("unsupported-command");
      if (!configs.size) throw new Error("conversion-before-config");
      if (viewItem) {
        const values = dataRecord(args[2], ["items", "value"]);
        if (!values) throw new Error("unsupported-parameters");
        const items = snapshotViewItems(values.items, viewOptions);
        if (!items) throw new Error("unsupported-items");
        if (!validViewItemValue(values.value)) throw new Error("unsupported-value");
        const context = dataRecord(capturedContext, ["pageURL", "referrer"]);
        if (!context || Reflect.ownKeys(context).length !== 2 ||
            !Object.hasOwn(context, "pageURL") || !Object.hasOwn(context, "referrer") ||
            !validURL(context.pageURL) || !validURL(context.referrer, true)) throw new Error("invalid-context");
        const query = new URLSearchParams({
          airlock_event: remarketingPurchase ? REMARKETING_PURCHASE_MARKER : args[1], airlock_items: JSON.stringify(items),
        });
        if (values.value !== undefined) query.set("airlock_value", String(values.value));
        const url = `${endpoints[0]}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        if (remarketingDisabled) return [];
        return [{ url, method: "GET" }];
      }
      const params = dataRecord(args[2], purchase
        ? [...PARAMS, "new_customer", ...(experimentalPurchaseCart ? ["items"] : []),
          ...(experimentalPurchaseDiscount ? ["discount"] : []), ...(experimentalPurchaseFeed ? FEED_PARAMS : [])]
        : experimentalCustomVariables ? [...PARAMS, ...CUSTOM_PARAMS] : PARAMS);
      if (!params) throw new Error("unsupported-parameters");
      if (!purchase && experimentalCustomVariables && CUSTOM_PARAMS.some((name) => params[name] !== undefined &&
          (typeof params[name] !== "string" || params[name].length > 100 || !params[name].isWellFormed()))) {
        throw new Error("unsupported-custom-variable");
      }
      if (purchase && params.new_customer !== undefined && typeof params.new_customer !== "boolean") {
        throw new Error("unsupported-new-customer");
      }
      const items = purchase && experimentalPurchaseCart && params.items !== undefined
        ? snapshotPurchaseCartItems(params.items) : undefined;
      if (items === null) throw new Error("unsupported-items");
      if (purchase && experimentalPurchaseDiscount && params.discount !== undefined &&
          (typeof params.discount !== "number" || !Number.isFinite(params.discount) ||
           params.discount < 0 || Object.is(params.discount, -0))) throw new Error("unsupported-discount");
      if (purchase && experimentalPurchaseFeed &&
          ((params.aw_merchant_id !== undefined && (!Number.isSafeInteger(params.aw_merchant_id) || params.aw_merchant_id <= 0)) ||
           (params.aw_feed_country !== undefined && (typeof params.aw_feed_country !== "string" ||
            params.aw_feed_country.length !== 2 || !/^[A-Z]{2}$/.test(params.aw_feed_country))) ||
           (params.aw_feed_language !== undefined && (typeof params.aw_feed_language !== "string" ||
            params.aw_feed_language.length !== 2 || !/^[A-Za-z]{2}$/.test(params.aw_feed_language))))) {
        throw new Error("unsupported-feed");
      }
      let selected;
      if (experimentalRouting === true) {
        const selectors = selectorValues(params.send_to, experimentalMultiDestination);
        if (!selectors.length || selectors.length > (experimentalMultiDestination ? 2 : 1)) throw new Error("destination-mismatch");
        const seen = new Set();
        selected = selectors.map((value) => {
          const selector = typeof value === "string" && value.match(/^(AW-\d{1,32})\/([A-Za-z0-9_-]{1,128})$/);
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
        if (purchase) {
          query.set("airlock_event", "purchase");
          if (params.new_customer !== undefined) query.set("airlock_new_customer", String(params.new_customer));
          if (items) query.set("airlock_items", JSON.stringify(items));
          if (experimentalPurchaseDiscount && params.discount !== undefined) query.set("airlock_discount", String(params.discount));
          if (experimentalPurchaseFeed) {
            for (const [input, output] of [
              ["aw_merchant_id", "airlock_merchant_id"], ["aw_feed_country", "airlock_feed_country"],
              ["aw_feed_language", "airlock_feed_language"],
            ]) {
              if (params[input] !== undefined) query.set(output, String(params[input]));
            }
          }
        }
        if (!purchase && experimentalCustomVariables) {
          for (const name of CUSTOM_PARAMS) {
            if (params[name] !== undefined) query.set(`airlock_custom_${name}`, params[name]);
          }
        }
        query.set("url", context.pageURL);
        const url = `${destinations.get(destination)}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        return { url, method: "GET" };
      });
    },
  };
}
