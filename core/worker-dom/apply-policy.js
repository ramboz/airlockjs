/**
 * The mutation-apply SAFETY ALLOWLIST (spec 025-02 AC6). The DOM chamber
 * isolates the TAG (ADR-0001), but the mutation channel it flushes through
 * (`./protocol.js`) is a WRITE SURFACE to the REAL main-thread DOM
 * (`adapters/eds/dom-apply.js` applies it) — a hostile/compromised op
 * stream must not be able to inject a `<script>`, an event-handler
 * attribute, a foreign/`<style>` element, or a CSS-exfil style value.
 *
 * This is an ALLOWLIST over the write surface (only these tag names /
 * attribute names may be applied), NOT a denylist of known-bad — a denylist
 * of dangerous HTML is inherently incomplete (`style`/`link`/SVG/
 * `formaction`/CSS `url()` all escape one; AC6). Scoped to exactly what the
 * 025-02 fixture needs + a small, clearly-safe layout/text superset — NEVER
 * `script`/`iframe`/`object`/`embed`/`style`/`link`/`base`/`meta`/SVG.
 *
 * ATTRIBUTE NAMES: `class` / `id` / `style` / any `data-*` — a CLOSED set.
 * URL-bearing attributes (`href`/`src`/`formaction`/`xlink:href`/...) and
 * `on*` handlers are refused BY CONSTRUCTION (never enumerated, never
 * allowed) — not by a special-cased denial. If a future slice needs a
 * URL-bearing attribute, it must be added here WITH a value-scheme check
 * (http(s)/relative only) alongside it — never bare.
 *
 * STYLE VALUES are additionally value-guarded (AC6/AC7 — a name-level
 * allowlist of `style` is not enough): reject a value containing `url(`,
 * `expression(`, or `/*`. This is a MINIMAL token guard, not airtight
 * (escape-bypassable, e.g. CSS `\75rl(` decodes to `url(` at parse time —
 * AC7's honest caveat); full value-level style sanitization is a NAMED
 * 025-03 deliverable (its sanitizer write path), not claimed here.
 */
import { OP } from "./protocol.js";

/** The element-tag allowlist (AC6/AC7) — the layout/text elements the
 *  025-02 fixture needs + a small, clearly-safe superset. */
export const ALLOWED_TAGS = new Set([
  "div", "span", "p", "ul", "ol", "li",
  "a", "b", "i", "strong", "em", "small", "br",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "button", "label", "section", "article", "header", "footer", "nav",
]);

const FIXED_ALLOWED_ATTRS = new Set(["class", "id", "style"]);
const STYLE_HOSTILE_TOKENS = ["url(", "expression(", "/*"];

// A CSS class token / attribute name must be a non-empty string with no ASCII
// whitespace or attribute-name-illegal chars — else the real-DOM call THROWS
// (`classList.add("a b")` -> InvalidCharacterError; `setAttribute("data-x y", …)`
// -> InvalidCharacterError). Validate at the policy layer so such an op is
// cleanly REFUSED, not thrown-then-caught (defense-in-depth with
// dom-apply.js's own try/catch — 025-02 review, both passes). (025-02 review.)
const INVALID_NAME_CHARS = /[^A-Za-z0-9_-]/;
/** @param {unknown} s @returns {boolean} */
export function isValidNameToken(s) {
  return typeof s === "string" && s.length > 0 && !INVALID_NAME_CHARS.test(s);
}

/** @param {unknown} tag @returns {boolean} */
export function isAllowedTag(tag) {
  return typeof tag === "string" && tag.length > 0 && ALLOWED_TAGS.has(tag.toLowerCase());
}

/** @param {unknown} name @returns {boolean} */
export function isAllowedAttributeName(name) {
  // Reject whitespace/structural-char names too (else `setAttribute("data-x y",…)`
  // THROWS InvalidCharacterError) — 025-02 review, defense-in-depth.
  if (!isValidNameToken(name)) return false;
  const n = name.toLowerCase();
  return FIXED_ALLOWED_ATTRS.has(n) || n.startsWith("data-");
}

/** @param {unknown} value @returns {boolean} */
export function isSafeStyleValue(value) {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return !STYLE_HOSTILE_TOKENS.some((tok) => v.includes(tok));
}

/**
 * Evaluate one recorded mutation op against the allowlist. Never throws;
 * `allow:false` always carries a `reason` (surfaced by the caller —
 * `adapters/eds/dom-apply.js` — via the 009-02 diagnostics sink).
 * @param {{op?:unknown, [k:string]:unknown} | null | undefined} mutOp
 * @returns {{allow:boolean, reason?:string}}
 */
export function evaluateOp(mutOp) {
  if (!mutOp || typeof mutOp.op !== "string") {
    return { allow: false, reason: "apply-policy: malformed op (missing/non-string `op`)" };
  }
  switch (mutOp.op) {
    case OP.CREATE_ELEMENT:
      return isAllowedTag(mutOp.tag)
        ? { allow: true }
        : { allow: false, reason: `apply-policy: tag "${mutOp.tag}" is not in the safety allowlist` };

    case OP.SET_ATTRIBUTE:
      if (!isAllowedAttributeName(mutOp.name)) {
        return { allow: false, reason: `apply-policy: attribute "${mutOp.name}" is not in the safety allowlist` };
      }
      if (String(mutOp.name).toLowerCase() === "style" && !isSafeStyleValue(mutOp.value)) {
        return { allow: false, reason: "apply-policy: style value carries a hostile token (url(/expression(//*)" };
      }
      return { allow: true };

    case OP.SET_STYLE:
      return isSafeStyleValue(mutOp.value)
        ? { allow: true }
        : { allow: false, reason: "apply-policy: style value carries a hostile token (url(/expression(//*)" };

    case OP.CREATE_TEXT:
    case OP.SET_TEXT:
    case OP.APPEND_CHILD:
      // Text / structural ops carry no name/token injection surface at this
      // layer (a hostile append CYCLE would throw HierarchyRequestError, caught
      // by dom-apply.js's try/catch — it can't be validated here without the
      // tree state).
      return { allow: true };

    case OP.CLASS_ADD:
    case OP.CLASS_REMOVE:
    case OP.CLASS_TOGGLE:
      // A class token must be a valid DOMTokenList token — a space-containing or
      // empty token makes `classList.add/remove/toggle` THROW
      // (InvalidCharacterError/SyntaxError), which would crash the batch. Reject
      // it cleanly HERE (025-02 review, defense-in-depth with dom-apply.js's
      // own try/catch) rather than relying on the native throw.
      return isValidNameToken(mutOp.name)
        ? { allow: true }
        : { allow: false, reason: `apply-policy: invalid class token "${mutOp.name}" (empty/whitespace/structural char)` };

    default:
      return { allow: false, reason: `apply-policy: unknown op "${mutOp.op}" (outside the wire contract)` };
  }
}
