const ITEM_KEYS = ["id", "google_business_vertical"];
const TRAVEL_KEYS = ["destination", "google_business_vertical"];
const TRAVEL_OPTIONAL = ["origin", "start_date", "end_date"];
const MAX_ITEMS = 10;

export const VIEW_EVENT_NAMES = Object.freeze(["view_item", "view_item_list", "view_search_results", "add_to_cart"]);
export const REMARKETING_PURCHASE_MARKER = "remarketing_purchase";

export function isEnabledViewEvent(name, enabledVertical, events) {
  return enabledVertical && VIEW_EVENT_NAMES.includes(name) &&
    (name === "view_item" || events[name] === true);
}

export function isRemarketingPurchase(name, hasSendTo, enabledVertical, enabled) {
  return enabled && enabledVertical && name === "purchase" && !hasSendTo;
}

function dataValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function hasKeys(object, expected) {
  const keys = Reflect.ownKeys(object);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function validViewItemValue(value) {
  return value === undefined ||
    (typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && !Object.is(value, -0));
}

function validText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && value.isWellFormed();
}

function validDate(value) {
  if (typeof value !== "string" || value.length !== 10) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function snapshotViewItems(value, {
  retail = false, education = false, local = false, realEstate = false, travel = false, flights = false,
} = {}) {
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
    const vertical = dataValue(source, "google_business_vertical");
    if (eventVertical && eventVertical !== vertical) return null;
    const keys = vertical === "flights" ? [...TRAVEL_KEYS, ...TRAVEL_OPTIONAL] : vertical === "travel"
      ? [...TRAVEL_KEYS, ...TRAVEL_OPTIONAL.filter((key) => Object.hasOwn(source, key))]
      : vertical === "education" && Object.hasOwn(source, "location_id") ? [...ITEM_KEYS, "location_id"] : ITEM_KEYS;
    if (!hasKeys(source, keys)) return null;
    const item = Object.fromEntries(keys.map((key) => [key, dataValue(source, key)]));
    if (item.google_business_vertical !== vertical) return null;
    const { id } = item;
    if (vertical === "retail") {
      if (!retail || !Number.isSafeInteger(id) || id < 1) return null;
    } else if (vertical === "education") {
      if (!education || !validText(id) || (keys.length === 3 && !validText(item.location_id))) return null;
    } else if (vertical === "local") {
      if (!local || !validText(id)) return null;
    } else if (vertical === "real_estate") {
      if (!realEstate || !validText(id)) return null;
    } else if (vertical === "travel" || vertical === "flights") {
      if (!(vertical === "travel" ? travel : flights) || !validText(item.destination) ||
          (keys.includes("origin") && !validText(item.origin)) ||
          (keys.includes("start_date") && !validDate(item.start_date)) ||
          (keys.includes("end_date") && !validDate(item.end_date))) return null;
    } else return null;
    eventVertical = vertical;
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
