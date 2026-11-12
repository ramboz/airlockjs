export function snapshotDestinationSelectors(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 1 || length > 2) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1 ||
      keys.some((key) => key !== "length" && key !== "0" && (key !== "1" || length !== 2))) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const element = Object.getOwnPropertyDescriptor(value, String(index));
    if (!element || !Object.hasOwn(element, "value") || typeof element.value !== "string" || element.value.length > 2048) return null;
    result.push(element.value);
  }
  if (Object.getOwnPropertyDescriptor(value, "length")?.value !== length) return null;
  return result;
}
