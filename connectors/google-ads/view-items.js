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

export function validViewItemValue(value, items) {
  return (value === undefined && items[0].google_business_vertical === "retail") ||
    (typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && !Object.is(value, -0));
}

function validText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && value.isWellFormed();
}

export function snapshotViewItems(value, { retail = false, education = false, local = false, realEstate = false } = {}) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = dataValue(value, "length");
  if (!Number.isInteger(length) || length < 1 || length > MAX_ITEMS) return null;
  const indices = Array.from({ length }, (_, index) => String(index));
  if (!hasKeys(value, [...indices, "length"]) || dataValue(value, "length") !== length) return null;
  const sources = [];
  const items = [];
  let eventVertical;
  for (const index of indices) {
    const source = dataValue(value, index);
    if (!source || typeof source !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(source))) return null;
    const id = dataValue(source, "id");
    const vertical = dataValue(source, "google_business_vertical");
    if (eventVertical && eventVertical !== vertical) return null;
    const keys = vertical === "education" && Object.hasOwn(source, "location_id")
      ? [...ITEM_KEYS, "location_id"] : ITEM_KEYS;
    if (!hasKeys(source, keys)) return null;
    const location = keys.length === 3 ? dataValue(source, "location_id") : undefined;
    if (vertical === "retail") {
      if (!retail || !Number.isSafeInteger(id) || id < 1) return null;
    } else if (vertical === "education") {
      if (!education || !validText(id) || (keys.length === 3 && !validText(location))) return null;
    } else if (vertical === "local") {
      if (!local || !validText(id)) return null;
    } else if (vertical === "real_estate") {
      if (!realEstate || !validText(id)) return null;
    } else return null;
    eventVertical = vertical;
    const item = { id, google_business_vertical: vertical };
    if (keys.length === 3) item.location_id = location;
    sources.push({ source, keys });
    items.push(item);
  }
  if (dataValue(value, "length") !== length || !hasKeys(value, [...indices, "length"])) return null;
  for (const [index, { source, keys }] of sources.entries()) {
    if (dataValue(value, String(index)) !== source || ![Object.prototype, null].includes(Object.getPrototypeOf(source)) ||
        !hasKeys(source, keys) ||
        keys.some((key) => !Object.is(dataValue(source, key), items[index][key]))) return null;
  }
  if (dataValue(value, "length") !== length) return null;
  return items;
}
