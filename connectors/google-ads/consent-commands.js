export const CONSENT_COMMAND_KEYS = Object.freeze(["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]);

export function validConsentCommand(args) {
  if (!Array.isArray(args) || args.length !== 3 || args[0] !== "consent" ||
      !["default", "update"].includes(args[1])) return false;
  const values = args[2];
  if (!values || typeof values !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(values))) return false;
  const keys = Reflect.ownKeys(values);
  if (!keys.length || keys.length > CONSENT_COMMAND_KEYS.length || keys.some((key) => !CONSENT_COMMAND_KEYS.includes(key))) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    return !!descriptor && Object.hasOwn(descriptor, "value") && ["granted", "denied"].includes(descriptor.value);
  });
}
