import { createHash } from "node:crypto";

// Offline, vendor-neutral field-rule primitives (ADR-0061 point 10). Pure
// functions only: the comparator resolves selectors and applies the tokens.
// There is deliberately no generic ignore, regex DSL, expression or eval.

export const FIELD_CLASSES = Object.freeze(["generated", "input_derived", "server_context", "volatile"]);
export const FORMAT_KINDS = Object.freeze(["uuid", "hex", "decimal", "base64url", "token", "epoch_ms", "epoch_s"]);
export const TRANSFORMS = Object.freeze(["identity", "lowercase", "sha256_hex", "trim_lowercase_sha256_hex",
  "base64", "base64url"]);
export const CONTEXTS = Object.freeze(["egress_region", "served_config", "response"]);
export const RELATIONS = Object.freeze(["equal", "distinct", "none"]);
// Routing, action, amount, currency and consent fields cannot be declared
// generated or volatile: a changed value there is a real difference.
export const PROTECTED_KEYS = Object.freeze(["ev", "id", "pixel_id", "send_to", "label", "value", "currency",
  "currency_code", "cd[value]", "cd[currency]", "consent", "gcs", "gcd", "gdpr", "gdpr_consent", "dp", "dl", "en"]);
export const LIMITS = Object.freeze({ selectors: 8, derived_from: 32, allowed: 16, allowed_bytes: 256, length: 512 });

const FORMAT_PATTERNS = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  hex: /^[0-9a-f]+$/i,
  decimal: /^[0-9]+$/,
  base64url: /^[A-Za-z0-9_-]+$/,
  token: /^[A-Za-z0-9._~-]+$/,
  epoch_ms: /^[0-9]{13}$/,
  epoch_s: /^[0-9]{10}$/,
};
const plain = v => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const keysAre = (v, keys) => plain(v) && Object.keys(v).length === keys.length
  && keys.every(k => Object.hasOwn(v, k));

export function formatShape(f) {
  if (!plain(f) || !FORMAT_KINDS.includes(f.kind)) fail("invalid_field_format");
  const allowed = ["kind", "min", "max"];
  if (Object.keys(f).some(k => !allowed.includes(k))) fail("invalid_field_format");
  const fixed = ["uuid", "epoch_ms", "epoch_s"].includes(f.kind);
  for (const k of ["min", "max"]) {
    if (fixed ? Object.hasOwn(f, k) : (!Number.isInteger(f[k]) || f[k] < 1 || f[k] > LIMITS.length))
      fail("invalid_field_format");
  }
  if (!fixed && f.min > f.max) fail("invalid_field_format");
}

export function matchesFormat(value, f) {
  if (typeof value !== "string" || !FORMAT_PATTERNS[f.kind].test(value)) return false;
  return !Object.hasOwn(f, "min") || (value.length >= f.min && value.length <= f.max);
}

export function transformValue(name, value) {
  switch (name) {
    case "identity": return value;
    case "lowercase": return value.toLowerCase();
    case "sha256_hex": return sha256(value);
    case "trim_lowercase_sha256_hex": return sha256(value.trim().toLowerCase());
    case "base64": return Buffer.from(value).toString("base64");
    case "base64url": return Buffer.from(value).toString("base64url");
    default: return fail("invalid_field_transform");
  }
}

// Validates one rule's own shape. `selectorShape` is the caller's selector
// validator (it throws); the rule never invents selector forms of its own.
export function fieldRuleShape(rule, selectorShape) {
  if (!plain(rule)) fail("invalid_field_rule");
  const common = ["class", "selectors", "derived_from"];
  const extra = {
    generated: ["format", "relation"], input_derived: ["source", "transform"],
    server_context: ["context", "allowed"], volatile: ["format"],
  }[rule.class];
  if (!extra || !keysAre(rule, [...common, ...extra])) fail("invalid_field_rule");
  if (!Array.isArray(rule.selectors) || rule.selectors.length < 1
    || rule.selectors.length > LIMITS.selectors) fail("invalid_field_rule");
  rule.selectors.forEach(selectorShape);
  // Bounded to rules derived from a frozen corpus: every rule names its fixtures.
  if (!Array.isArray(rule.derived_from) || rule.derived_from.length < 1
    || rule.derived_from.length > LIMITS.derived_from || !rule.derived_from.every(digest)
    || new Set(rule.derived_from).size !== rule.derived_from.length) fail("field_rule_corpus_missing");
  if (rule.class === "generated") {
    formatShape(rule.format);
    if (!RELATIONS.includes(rule.relation)) fail("invalid_field_rule");
  } else if (rule.class === "volatile") formatShape(rule.format);
  else if (rule.class === "input_derived") {
    selectorShape(rule.source);
    if (!TRANSFORMS.includes(rule.transform)) fail("invalid_field_transform");
  } else {
    if (!CONTEXTS.includes(rule.context) || !Array.isArray(rule.allowed) || rule.allowed.length < 1
      || rule.allowed.length > LIMITS.allowed || new Set(rule.allowed).size !== rule.allowed.length
      || !rule.allowed.every(v => typeof v === "string" && v.length > 0
        && Buffer.byteLength(v) <= LIMITS.allowed_bytes)) fail("invalid_field_rule");
  }
}

// `values` is one side's selected originals (same order as rule.selectors);
// `source` is that side's source value for input_derived rules. Returns
// { valid, tokens } where tokens replace the originals for comparison.
export function evaluateFieldRule(rule, index, values, source) {
  const text = values.every(v => typeof v === "string" && v.length > 0);
  if (!text) return { valid: false };
  if (rule.class === "volatile") {
    return { valid: values.every(v => matchesFormat(v, rule.format)),
      tokens: values.map(() => `field:${index}:volatile`) };
  }
  if (rule.class === "generated") {
    if (!values.every(v => matchesFormat(v, rule.format))) return { valid: false };
    const unique = new Set(values).size;
    if (rule.relation === "equal" && unique !== 1) return { valid: false };
    if (rule.relation === "distinct" && unique !== values.length) return { valid: false };
    return { valid: true, tokens: values.map((v, i) => rule.relation === "distinct"
      ? `field:${index}:generated:${i}` : `field:${index}:generated`) };
  }
  if (rule.class === "input_derived") {
    if (typeof source !== "string" || source.length === 0) return { valid: false };
    const expected = transformValue(rule.transform, source);
    return { valid: values.every(v => v === expected), tokens: values.map(() => `field:${index}:input`) };
  }
  return { valid: values.every(v => rule.allowed.includes(v)),
    tokens: values.map(() => `field:${index}:server`) };
}

export function protectedTarget(rule, key) {
  return ["generated", "volatile"].includes(rule.class)
    && typeof key === "string" && PROTECTED_KEYS.includes(key.toLowerCase());
}
