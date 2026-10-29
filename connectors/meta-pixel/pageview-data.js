export const BASIC_EVENT_DATA_KEYS = Object.freeze(["value", "currency"]);
export const SCALAR_EVENT_DATA_KEYS = Object.freeze([
  "region", "content_category", "content_name", "search_string", "content_type",
  "predicted_ltv", "num_items", "status", "delivery_category",
]);

export function snapshotPageViewData(value, experimentalScalarEventData = false) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    if (!BASIC_EVENT_DATA_KEYS.includes(key) && !(experimentalScalarEventData && SCALAR_EVENT_DATA_KEYS.includes(key))) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (item !== undefined) {
      if (key === "value" || key === "predicted_ltv") {
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
