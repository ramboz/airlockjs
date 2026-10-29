const FIXTURE_PATTERN = /^airlock-local-synthetic-[0-9a-f]{32}-[12]$/;

export function createSyntheticIdentityFixtures() {
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error("synthetic-identity-random-unavailable");
  globalThis.crypto.getRandomValues(bytes);
  const seed = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [`airlock-local-synthetic-${seed}-1`, `airlock-local-synthetic-${seed}-2`];
}

export function validSyntheticIdentityFixtures(fixtures) {
  if (!Array.isArray(fixtures) || Object.getPrototypeOf(fixtures) !== Array.prototype) return false;
  const length = Object.getOwnPropertyDescriptor(fixtures, "length")?.value;
  if (length !== 2) return false;
  const first = Object.getOwnPropertyDescriptor(fixtures, "0");
  const second = Object.getOwnPropertyDescriptor(fixtures, "1");
  if (!first || !second || !Object.hasOwn(first, "value") || !Object.hasOwn(second, "value") ||
      typeof first.value !== "string" || typeof second.value !== "string" ||
      !FIXTURE_PATTERN.test(first.value) || !FIXTURE_PATTERN.test(second.value)) return false;
  return Reflect.ownKeys(fixtures).length === 3 && first.value.endsWith("-1") &&
    second.value === `${first.value.slice(0, -1)}2`;
}

export function snapshotSyntheticIdentity(value, fixtures) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "external_id");
  if (!descriptor || !Object.hasOwn(descriptor, "value") || !fixtures.includes(descriptor.value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "external_id") return null;
  return { external_id: descriptor.value };
}
