export function snapshotPageViewData(value) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    if (key !== "value" && key !== "currency") return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item = descriptor.value;
    if (item !== undefined && (key === "value"
      ? typeof item !== "number" || !Number.isFinite(item)
      : typeof item !== "string" || item.length > 64 || !item.isWellFormed())) return null;
    result[key] = item;
  }
  return result;
}
