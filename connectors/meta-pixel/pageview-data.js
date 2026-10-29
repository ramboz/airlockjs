export const BASIC_EVENT_DATA_KEYS = Object.freeze(["value", "currency"]);
export const SCALAR_EVENT_DATA_KEYS = Object.freeze([
  "region", "content_category", "content_name", "search_string", "content_type",
  "predicted_ltv", "num_items", "status", "delivery_category",
]);

function snapshotContentIds(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isInteger(length) || length < 0 || length > 16 || Reflect.ownKeys(descriptors).length !== length + 1) return null;
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

export function snapshotPageViewData(value, experimentalScalarEventData = false, experimentalContentIds = false) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    if (!BASIC_EVENT_DATA_KEYS.includes(key) && !(experimentalScalarEventData && SCALAR_EVENT_DATA_KEYS.includes(key)) &&
        !(experimentalContentIds && key === "content_ids")) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (item !== undefined) {
      if (key === "content_ids") {
        const ids = snapshotContentIds(item);
        if (ids === null) return null;
        result[key] = ids;
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
