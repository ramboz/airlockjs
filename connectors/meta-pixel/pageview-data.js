export const BASIC_EVENT_DATA_KEYS = Object.freeze(["value", "currency"]);
export const SCALAR_EVENT_DATA_KEYS = Object.freeze([
  "region", "content_category", "content_name", "search_string", "content_type",
  "predicted_ltv", "num_items", "status", "delivery_category",
]);

const RESERVED_CUSTOM_KEYS = new Set([
  ...BASIC_EVENT_DATA_KEYS, ...SCALAR_EVENT_DATA_KEYS, "content_ids", "contents", "eventid",
  "em", "ph", "fn", "ln", "external_id", "ge", "db", "ct", "st", "zp", "country", "email", "phone",
  "fbp", "fbc", "fbclid",
]);
const CUSTOM_PROPERTY_LIMIT = 8;
const JSON_STRING_LIMIT = 2048;
const JSON_STRING_TOKEN = String.raw`"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"`;
const JSON_ID_TOKEN = String.raw`(?:${JSON_STRING_TOKEN}|0|[1-9]\d*)`;
const JSON_CONTENT_ITEM = String.raw`\{\s*"id"\s*:\s*${JSON_ID_TOKEN}\s*,\s*"quantity"\s*:\s*1\s*\}`;
const JSON_CONTENTS_SHAPE = new RegExp(
  String.raw`^\s*\[(?:\s*${JSON_CONTENT_ITEM}(?:\s*,\s*${JSON_CONTENT_ITEM})*)?\s*\]\s*$`, "u",
);

export function isStandardEventDataKey(key) {
  return BASIC_EVENT_DATA_KEYS.includes(key) || SCALAR_EVENT_DATA_KEYS.includes(key) ||
    key === "content_ids" || key === "contents";
}

function snapshotContentValues(value, allowNumbers, allowFalseId = false) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 0 || length > 16) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== length || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (typeof item === "string") {
      if (!item.length || item.length > 64 || !item.isWellFormed()) return null;
    } else if (!(allowNumbers && allowFalseId && item === false) &&
        (!allowNumbers || !Number.isSafeInteger(item) || item < 0 || Object.is(item, -0))) return null;
    result.push(item);
  }
  return result;
}

function snapshotContents(value, experimentalContentsItemPrice, allowFalseId = false) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 0 || length > 16) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== length || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (!item || typeof item !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return null;
    const id = Object.getOwnPropertyDescriptor(item, "id");
    const quantity = Object.getOwnPropertyDescriptor(item, "quantity");
    if (!id || !quantity || !Object.hasOwn(id, "value") || !Object.hasOwn(quantity, "value")) return null;
    if (typeof id.value === "string") {
      if (!id.value.length || id.value.length > 64 || !id.value.isWellFormed()) return null;
    } else if (!(allowFalseId && id.value === false) &&
        (!Number.isSafeInteger(id.value) || id.value < 0 || Object.is(id.value, -0))) return null;
    if (typeof quantity.value !== "number" || !Number.isFinite(quantity.value) || quantity.value < 0 ||
        quantity.value > Number.MAX_SAFE_INTEGER || Object.is(quantity.value, -0)) return null;
    const keys = Reflect.ownKeys(item);
    const hasPrice = keys.includes("item_price");
    if (keys.length !== (hasPrice ? 3 : 2) || !keys.includes("id") || !keys.includes("quantity") ||
        (hasPrice && !experimentalContentsItemPrice)) return null;
    const snapshot = { id: id.value, quantity: quantity.value };
    if (hasPrice) {
      const price = Object.getOwnPropertyDescriptor(item, "item_price");
      if (!price || !Object.hasOwn(price, "value") || typeof price.value !== "number" ||
          !Number.isFinite(price.value) || price.value < 0 || price.value > Number.MAX_SAFE_INTEGER ||
          Object.is(price.value, -0)) return null;
      snapshot.item_price = price.value;
    }
    result.push(snapshot);
  }
  return result;
}

function validViewContentJson(value, key) {
  if (typeof value !== "string" || value.length > JSON_STRING_LIMIT || !value.isWellFormed()) return false;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
  if (key === "content_ids") return snapshotContentValues(parsed, true) !== null;
  // Reject duplicate or extra keys before preserving the original text.
  if (!JSON_CONTENTS_SHAPE.test(value)) return false;
  const contents = snapshotContents(parsed, false);
  return contents !== null && contents.every((item) => item.quantity === 1);
}

function validCustomString(value) {
  return typeof value === "string" && value.length <= 64 && value.isWellFormed();
}

function snapshotMagentoHeadArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertyDescriptor(value, "length")?.value !== 0) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || !keys.includes("source") || !keys.includes("pluginVersion")) return null;
  const result = [];
  for (const key of keys) {
    if (key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") ||
        !validCustomString(descriptor.value)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

export function snapshotPageViewData(value, experimentalScalarEventData = false, experimentalContentIds = false,
  experimentalContents = false, experimentalCustomProperties = false, experimentalNumericOrderId = false,
  experimentalContentsItemPrice = false, experimentalContentNameArray = false, allowNullPurchaseValue = false,
  allowViewContentJsonStrings = false, allowMagentoHeadArray = false, allowEmptyCheckoutValue = false,
  allowFalseCheckoutContentId = false) {
  if (allowMagentoHeadArray && experimentalCustomProperties && Array.isArray(value)) {
    return snapshotMagentoHeadArray(value);
  }
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = {};
  let customCount = 0;
  const keys = Reflect.ownKeys(value);
  if (experimentalCustomProperties &&
      keys.length > BASIC_EVENT_DATA_KEYS.length + SCALAR_EVENT_DATA_KEYS.length + 2 + CUSTOM_PROPERTY_LIMIT) return null;
  for (const key of keys) {
    if (typeof key !== "string") return null;
    const standard = isStandardEventDataKey(key);
    if (standard && !BASIC_EVENT_DATA_KEYS.includes(key) &&
        !(experimentalScalarEventData && SCALAR_EVENT_DATA_KEYS.includes(key)) &&
        !(experimentalContentIds && key === "content_ids") && !(experimentalContents && key === "contents")) return null;
    if (!standard && (!experimentalCustomProperties || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key) ||
        RESERVED_CUSTOM_KEYS.has(key.toLowerCase()) || Object.hasOwn(Object.prototype, key) ||
        ++customCount > CUSTOM_PROPERTY_LIMIT)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (!standard) {
      if (typeof item === "string") {
        if (!validCustomString(item)) return null;
      } else if (!(experimentalNumericOrderId && key === "order_id" && Number.isSafeInteger(item) &&
          item >= 0 && !Object.is(item, -0))) return null;
      result[key] = item;
      continue;
    }
    if (item !== undefined) {
      if ((key === "content_ids" || key === "contents") && typeof item === "string" && allowViewContentJsonStrings) {
        if (!validViewContentJson(item, key)) return null;
        result[key] = item;
        continue;
      }
      if (key === "content_ids") {
        const ids = snapshotContentValues(item, true, allowFalseCheckoutContentId);
        if (ids === null) return null;
        result[key] = ids;
        continue;
      } else if (key === "content_name" && experimentalContentNameArray && Array.isArray(item)) {
        const names = snapshotContentValues(item, false);
        if (names === null) return null;
        result[key] = names;
        continue;
      } else if (key === "contents") {
        const contents = snapshotContents(item, experimentalContentsItemPrice, allowFalseCheckoutContentId);
        if (contents === null) return null;
        result[key] = contents;
        continue;
      } else if (key === "value" && item === null && allowNullPurchaseValue) {
        result[key] = null;
        continue;
      } else if (key === "value" && item === "" && allowEmptyCheckoutValue) {
        result[key] = "";
        continue;
      } else if (key === "value" || key === "predicted_ltv") {
        if (typeof item !== "number" || !Number.isFinite(item)) return null;
      } else if (key === "num_items") {
        if (!Number.isSafeInteger(item) || item < 0) return null;
      } else if (key === "status") {
        if (typeof item !== "boolean") return null;
      } else {
        if (typeof item !== "string" || item.length > 64 || !item.isWellFormed()) return null;
        if (key === "content_type" && !["product", "product_group"].includes(item)) return null;
        if (key === "delivery_category" && !["in_store", "curbside", "home_delivery"].includes(item)) return null;
      }
    }
    result[key] = item;
  }
  return result;
}
