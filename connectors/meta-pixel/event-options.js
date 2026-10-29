export function snapshotEventOptions(value) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "eventID") return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "eventID");
  if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
  const eventID = descriptor.value;
  if (typeof eventID !== "string" || !eventID.length || eventID.length > 64 || !eventID.isWellFormed()) return null;
  return { eventID };
}
