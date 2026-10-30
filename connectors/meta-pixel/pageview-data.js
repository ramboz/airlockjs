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

export function isStandardEventDataKey(key) {
  return BASIC_EVENT_DATA_KEYS.includes(key) || SCALAR_EVENT_DATA_KEYS.includes(key) ||
    key === "content_ids" || key === "contents";
}

function snapshotContentIds(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 0 || length > 16) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== length || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const id = descriptor.value;
    if (typeof id === "string") {
      if (!id.length || id.length > 64 || !id.isWellFormed()) return null;
    } else if (!Number.isSafeInteger(id) || id < 0 || Object.is(id, -0)) return null;
    result.push(id);
  }
  return result;
}

function snapshotContents(value) {
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
    } else if (!Number.isSafeInteger(id.value) || id.value < 0 || Object.is(id.value, -0)) return null;
    if (typeof quantity.value !== "number" || !Number.isFinite(quantity.value) || quantity.value < 0 ||
        quantity.value > Number.MAX_SAFE_INTEGER || Object.is(quantity.value, -0)) return null;
    const keys = Reflect.ownKeys(item);
    if (keys.length !== 2 || !keys.includes("id") || !keys.includes("quantity")) return null;
    result.push({ id: id.value, quantity: quantity.value });
  }
  return result;
}

export function snapshotPageViewData(value, experimentalScalarEventData = false, experimentalContentIds = false,
  experimentalContents = false, experimentalCustomProperties = false) {
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
      if (typeof item !== "string" || item.length > 64 || !item.isWellFormed()) return null;
      result[key] = item;
      continue;
    }
    if (item !== undefined) {
      if (key === "content_ids") {
        const ids = snapshotContentIds(item);
        if (ids === null) return null;
        result[key] = ids;
        continue;
      } else if (key === "contents") {
        const contents = snapshotContents(item);
        if (contents === null) return null;
        result[key] = contents;
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
