/**
 * validatePixelVendorConfig — the authoring-time guard for a
 * `PixelVendorConfig` (contracts/pixel-connector.d.ts), spec 026-03 AC2.
 *
 * Pure, import-free — no `self`/`postMessage`/DOM, no dependency on
 * `connectors/pixel/connector.js` itself (mirrors `core/consent.js` /
 * `core/payload-governance.js`'s pure, dependency-free primitive style).
 * `createPixelConnector` never calls this: the interpreter's own diff stays
 * empty (AC5) — this is an ADDITIVE, config-author-facing tool run at
 * authoring/test time, not a runtime gate.
 *
 * DELIBERATELY STRICTER THAN THE INTERPRETER (AC2). `connectors/pixel/
 * connector.js`'s `handle()` fails SOFT on a malformed config: it
 * `String()`s any scalar `paramMap` value regardless of type
 * (connector.js:143) and tolerates a missing/empty `endpoint` by still
 * building a URL via `String(endpoint)` (connector.js:146) — for `undefined`
 * that literally produces the string `"undefined"` as the request URL,
 * rather than throwing. This validator does NOT describe that runtime
 * tolerance; it is a stricter, authoring-time contract whose job is to catch
 * a config author's mistake BEFORE it ships as a silently-broken beacon. A
 * `{ valid: true }` result means "matches the documented PixelVendorConfig
 * shape" — never read it as "the interpreter would otherwise have thrown."
 *
 * Never throws — a malformed/non-object `config` (including `null` or
 * `undefined`) fails safe to `{ valid: false, errors: [...] }`, exactly like
 * every other malformed shape this function inspects.
 */

/**
 * @typedef {{ valid: boolean, errors: string[] }} PixelVendorConfigValidation
 */

/**
 * Validate a candidate `PixelVendorConfig` against the authoring-time
 * contract described in this module's header comment.
 *
 * @param {unknown} config the candidate
 *   `import("../../contracts/pixel-connector").PixelVendorConfig` — inspected
 *   defensively; may be any malformed shape (that is the point of a guard).
 * @returns {PixelVendorConfigValidation} `valid`: true iff `errors` is
 *   empty. `errors`: zero or more specific, actionable messages, each
 *   naming the offending field/key (never a bare "invalid config").
 */
export function validatePixelVendorConfig(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return { valid: false, errors: ["config must be an object"] };
  }

  const errors = [];
  const { endpoint, eventMap, paramMap, egressPurposes } = config;

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    errors.push("endpoint must be a non-empty string");
  }

  if (eventMap === null || typeof eventMap !== "object" || Array.isArray(eventMap)) {
    errors.push("eventMap must be an object (Record<string, string | null>)");
  } else {
    for (const [type, value] of Object.entries(eventMap)) {
      if (typeof value !== "string" && value !== null) {
        errors.push(`eventMap.${type} must be a string or null (the null-omits idiom), got ${typeof value}`);
      }
    }
  }

  if (paramMap === null || typeof paramMap !== "object" || Array.isArray(paramMap)) {
    errors.push("paramMap must be an object (Record<string, PixelParamSpec>)");
  } else {
    for (const [key, spec] of Object.entries(paramMap)) {
      const from = spec !== null && typeof spec === "object" ? spec.from : undefined;

      if (from === "static") {
        if (spec.value === undefined) {
          errors.push(`paramMap.${key} has from:"static" but is missing "value"`);
        } else if (typeof spec.value !== "string" && typeof spec.value !== "number") {
          // Align the guard with the PixelVendorConfig type (value: string | number).
          // Without this, `value: {}` passes here yet the interpreter String()s it
          // to "[object Object]" in a live URL (connector.js:143) — the exact
          // silently-broken beacon this validator exists to catch (026-03 review).
          errors.push(
            `paramMap.${key} from:"static" value must be a string or number, got ${spec.value === null ? "null" : typeof spec.value}`,
          );
        }
      } else if (from === "event") {
        // no further requirement — the source is this config's own eventMap.
      } else if (from === "params") {
        if (typeof spec.key !== "string" || spec.key.length === 0) {
          errors.push(`paramMap.${key} has from:"params" but is missing a non-empty "key"`);
        }
      } else {
        errors.push(
          `paramMap.${key} has an unknown or missing "from" (got ${String(from)}); expected "static", "event", or "params"`,
        );
      }
    }
  }

  if (egressPurposes !== undefined && !Array.isArray(egressPurposes)) {
    errors.push("egressPurposes must be an array");
  }

  return { valid: errors.length === 0, errors };
}
