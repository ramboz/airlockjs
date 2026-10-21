import { isProxy } from "node:util/types";

const fail = category => { throw new Error(category); };
export function record(value, required, optional = []) {
  if (!value || typeof value !== "object" || isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("invalid_case_input");
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (required.some(key => !Object.hasOwn(fields, key))
    || keys.some(key => !required.includes(key) && !optional.includes(key))
    || keys.some(key => !Object.hasOwn(fields[key], "value"))) fail("invalid_case_input");
  return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
export function data(value, depth = 0, budget = { nodes: 0, limit: 4096 }) {
  if (++budget.nodes > budget.limit || depth > 12 || isProxy(value)) fail("invalid_case_input");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.isWellFormed() && Buffer.byteLength(value) <= 65536) return value;
  if (!value || typeof value !== "object") fail("invalid_case_input");
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail("invalid_case_input");
    const descriptors = Object.getOwnPropertyDescriptors(value), size = descriptors.length.value;
    if (size > 256 || Reflect.ownKeys(descriptors).length !== size + 1) fail("invalid_case_input");
    return Array.from({ length: size }, (_, n) => {
      if (!Object.hasOwn(descriptors[n] ?? {}, "value")) fail("invalid_case_input");
      return data(descriptors[n].value, depth + 1, budget);
    });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const input = record(value, Reflect.ownKeys(descriptors));
  const output = Object.create(null);
  const keys = Reflect.ownKeys(input);
  if (keys.some(key => typeof key !== "string")) fail("invalid_case_input");
  for (const key of keys.sort()) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail("invalid_case_input");
    output[key] = data(input[key], depth + 1, budget);
  }
  return output;
}
export const equal = (a, b) => JSON.stringify(data(a)) === JSON.stringify(data(b));

// JSON.parse alone silently accepts duplicate keys, including inside handles.
export function json(bytes, maximumNodes = 4096) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("invalid_case_json"); }
  // eslint-disable-next-line no-control-regex -- JSON strings cannot contain literal control octets.
  const token = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let offset = 0, nodes = 0;
  const next = () => {
    while (/\s/.test(text[offset] ?? "") && offset < text.length) offset++;
    token.lastIndex = offset;
    const match = token.exec(text);
    if (!match) fail("invalid_case_json");
    offset = token.lastIndex; return match[0];
  };
  const visit = (first = next(), depth = 0) => {
    if (++nodes > maximumNodes || depth > 12) fail("invalid_case_json");
    if (!["{", "["].includes(first)) {
      if (/^[}\],:]$/.test(first)) fail("invalid_case_json");
      return;
    }
    const object = first === "{", end = object ? "}" : "]", seen = new Set();
    let item = next();
    if (item === end) return;
    while (true) {
      if (object) {
        if (!item.startsWith('"')) fail("invalid_case_json");
        const key = JSON.parse(item);
        if (seen.has(key)) fail("duplicate_case_key");
        seen.add(key);
        if (next() !== ":") fail("invalid_case_json");
        item = next();
      }
      visit(item, depth + 1);
      const separator = next();
      if (separator === end) return;
      if (separator !== ",") fail("invalid_case_json");
      item = next();
    }
  };
  visit();
  if (text.slice(offset).trim()) fail("invalid_case_json");
  try { return data(JSON.parse(text), 0, { nodes: 0, limit: maximumNodes }); } catch { fail("invalid_case_json"); }
}
