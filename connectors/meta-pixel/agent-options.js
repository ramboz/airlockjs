export function isSupportedSyntheticAgent(value) {
  return typeof value === "string" &&
    /^(?:magento_opensource|adobe_commerce)-0\.0\.0-\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value);
}

export function snapshotInitAgentOptions(data, options) {
  if (!data || typeof data !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(data)) ||
      Reflect.ownKeys(data).length !== 0) return null;
  if (!options || typeof options !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(options))) return null;
  const keys = Reflect.ownKeys(options);
  if (keys.length !== 1 || keys[0] !== "agent") return null;
  const descriptor = Object.getOwnPropertyDescriptor(options, "agent");
  if (!descriptor || !Object.hasOwn(descriptor, "value") || !isSupportedSyntheticAgent(descriptor.value)) return null;
  return { agent: descriptor.value };
}
