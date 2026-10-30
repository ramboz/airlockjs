const ITEM_KEYS = ["id", "google_business_vertical"];
const MAX_ITEMS = 10;

function dataValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function hasKeys(object, expected) {
  const keys = Reflect.ownKeys(object);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function validRetailValue(value) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && !Object.is(value, -0));
}

export function snapshotRetailViewItems(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = dataValue(value, "length");
  if (!Number.isInteger(length) || length < 1 || length > MAX_ITEMS) return null;
  const indices = Array.from({ length }, (_, index) => String(index));
  if (!hasKeys(value, [...indices, "length"]) || dataValue(value, "length") !== length) return null;
  const sources = [];
  const items = [];
  for (const index of indices) {
    const source = dataValue(value, index);
    if (!source || typeof source !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(source)) ||
        !hasKeys(source, ITEM_KEYS)) return null;
    const id = dataValue(source, "id");
    const vertical = dataValue(source, "google_business_vertical");
    if (!Number.isSafeInteger(id) || id < 1 || vertical !== "retail") return null;
    sources.push(source);
    items.push({ id, google_business_vertical: vertical });
  }
  if (dataValue(value, "length") !== length || !hasKeys(value, [...indices, "length"])) return null;
  for (const [index, source] of sources.entries()) {
    if (dataValue(value, String(index)) !== source || ![Object.prototype, null].includes(Object.getPrototypeOf(source)) ||
        !hasKeys(source, ITEM_KEYS) ||
        ITEM_KEYS.some((key) => !Object.is(dataValue(source, key), items[index][key]))) return null;
  }
  if (dataValue(value, "length") !== length) return null;
  return items;
}
