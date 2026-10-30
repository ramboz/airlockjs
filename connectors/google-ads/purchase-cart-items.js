const ITEM_KEYS = ["id", "price", "quantity"];
const MAX_ITEMS = 10;

function dataValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function hasKeys(object, expected) {
  const keys = Reflect.ownKeys(object);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function snapshotPurchaseCartItems(value) {
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
    const price = dataValue(source, "price");
    const quantity = dataValue(source, "quantity");
    if (typeof id !== "string" || !id.length || id.length > 128 || !id.isWellFormed() ||
        typeof price !== "number" || !Number.isFinite(price) || price < 0 || Object.is(price, -0) ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return null;
    sources.push(source);
    items.push({ id, price, quantity });
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
