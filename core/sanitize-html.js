// Active-markup sanitizer — spec 018-01 (refinement-todo item k / mvp3.md
// release-check: "the reserveSpace innerHTML path is gated by a sanitizer").
//
// THE LOAD-BEARING CORRECTION THIS MODULE EXISTS TO MAKE (grounded, not
// assumed): `adapters/eds/dom.js`'s `fill()` writes a personalization
// decision's HTML through `innerHTML`. The EDS boilerplate's default
// Trusted-Types policy makes that write NOT THROW under
// `require-trusted-types-for 'script'` (R-005:79) — but read the actual
// policy (probes/eds-testbed/scripts/scripts.js:61-78): for the `Element
// innerHTML` sink it returns the input ESSENTIALLY UNCHANGED (no `on*`
// stripping, no `<script>` stripping — those only apply to the
// createContextualFragment/Document-write sinks and iframe[srcdoc]). So "the
// EDS TT policy accepts it" is a COMPATIBILITY property, not a SANITIZATION
// property — relying on it alone leaves the `on*`-handler / `javascript:`-URL
// surface wide open to a compromised chamber, a malicious Target offer, or a
// tampered Edge response (all in-model, AD-5: the chamber is untrusted). The
// sanitizer must be airlock's OWN, running before that write.
//
// WHAT THIS STRIPS, on an INERT parse (parsing does not execute scripts or
// fetch resources — see `sanitizeHtml`'s docstring):
//   (a) every `on*` attribute on any element (isEventHandlerAttr);
//   (b) `javascript:` / `vbscript:` / `data:text/html` values on the active
//       URL attributes in ACTIVE_URL_ATTRS (isDangerousUrl);
//   (c) the elements in STRIPPED_TAGS, entirely (isStrippedTag).
//
// HONEST BOUNDARY (AC4 — conservative defense-in-depth, NOT a complete XSS
// guarantee): this is a hand-rolled denylist. Mutation-XSS and
// parser-differential bypasses (why DOMPurify exists) are OUT of this
// denylist's reach by construction — airlock ships vanilla ES modules with no
// runtime dependency (architecture.md § Stack), so a deployment hosting
// genuinely untrusted content should slot a stricter sanitizer (e.g.
// DOMPurify) + a dedicated Trusted-Types policy via the SAME injectable seam
// (`adapters/eds/dom.js`'s `opts.setContent` / `opts.sanitize`) rather than
// rely on this default. The security-MUST posture (CLAUDE.md): guardrails are
// defense-in-depth, not a guarantee.
//
// VENDOR-NEUTRAL / IMPORT-FREE (mirrors core/consent.js, core/
// endpoint-ceiling.js — this file simply never imports anything, guarded
// structurally by test/core-boundary.test.js's core/->rig/ check and, more to
// the point here, by inspection: there is no `import` statement below). It
// DOES reference the ambient `DOMParser` global (typeof-guarded, exactly how
// adapters/eds/dom.js already references `document`/`performance`/
// `setTimeout`) — but ONLY as the DEFAULT; the parser is INJECTED via
// `opts.parse`, never imported, so this module stays loadable (and its pure
// predicates stay unit-testable) in Node, which has no DOMParser.
//
// SUBSTRATE (DoR pillar 4 — grounded, load-bearing): Node/vitest has NO
// DOMParser and this project deliberately ships no jsdom/happy-dom/linkedom.
// A fake parser could make the strip-predicates LOOK exercised without ever
// proving real HTML-parsing behaviour (mXSS, browser quirks) is defended —
// worse than no test for a security primitive. So the REAL parse->walk->
// strip->serialize proof against actual browser parsing runs in the
// Playwright rig (rig/sanitize-boundary.mjs); this module's own unit tests
// (test/sanitize-html.test.js) cover only the pure predicates, the
// non-string/empty->"" contract, and the DI-parser wiring.

/**
 * The active-URL attributes checked for a dangerous scheme (spec 018-01 AC2b).
 * Lower-case; matched case-insensitively against a walked element's attribute
 * names.
 */
export const ACTIVE_URL_ATTRS = ["href", "src", "xlink:href", "formaction", "action", "background", "poster"];

/**
 * Elements removed ENTIRELY, regardless of their own attributes (spec 018-01
 * AC2c). Lower-case; matched case-insensitively against a walked element's
 * tag name.
 */
export const STRIPPED_TAGS = ["script", "iframe", "object", "embed", "base", "meta", "link"];

const DANGEROUS_URL_SCHEMES = ["javascript:", "vbscript:", "data:text/html"];
// ASCII control chars (0x00-0x1F, 0x7F) + all whitespace — a classic
// denylist-evasion trick splits a scheme with a stray tab/newline
// ("jav\tascript:"), which browsers ignore when resolving a URL scheme.
const CONTROL_OR_WHITESPACE_RE = /[\u0000-\u001F\u007F\s]+/g;

/**
 * Is `name` an event-handler attribute (`on*`)? Pure — no DOM.
 * @param {unknown} name an attribute name.
 * @returns {boolean} `false` for any non-string input — never throws.
 */
export function isEventHandlerAttr(name) {
  return typeof name === "string" && /^on/i.test(name);
}

/**
 * Does `value` carry a dangerous URL scheme (`javascript:`, `vbscript:`, or
 * `data:text/html`)? Pure — no DOM. Case-insensitive, and tolerant of a
 * control-character/whitespace-obfuscated scheme (stripped before matching).
 * Conservative denylist, not a complete URL-safety parser (AC4's honest
 * boundary) — benign `https:`/relative/`mailto:`/non-html `data:` URIs are
 * NOT flagged.
 * @param {unknown} value an attribute value.
 * @returns {boolean} `false` for any non-string input — never throws.
 */
export function isDangerousUrl(value) {
  if (typeof value !== "string") return false;
  const cleaned = value.replace(CONTROL_OR_WHITESPACE_RE, "").toLowerCase();
  return DANGEROUS_URL_SCHEMES.some((scheme) => cleaned.startsWith(scheme));
}

/**
 * Is `tagName` one of the denylisted elements (STRIPPED_TAGS)? Pure — no DOM.
 * @param {unknown} tagName an element tag name (any case).
 * @returns {boolean} `false` for any non-string input — never throws.
 */
export function isStrippedTag(tagName) {
  return typeof tagName === "string" && STRIPPED_TAGS.includes(tagName.trim().toLowerCase());
}

/** The default parser: the ambient `DOMParser` global (main-thread only —
 *  `sanitizeHtml`'s only caller, adapters/eds/dom.js, runs there). `null`
 *  when unavailable (e.g. Node/vitest) so the caller fails SAFE (`""`),
 *  never falls back to an unsanitized passthrough. */
function defaultParse(html) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * Collect every element reachable from `root`, INCLUDING inside any
 * `<template>` element's `.content` — a SEPARATE DocumentFragment tree that
 * ordinary `querySelectorAll` does NOT descend into, yet that IS serialized
 * back out through an ancestor's `.innerHTML` (a well-known sanitizer-bypass
 * vector: `<template><script>...</script></template>` would otherwise
 * survive a walk that only looks at the light-DOM `querySelectorAll("*")`
 * result). Recurses for nested templates-within-templates.
 * @param {{ querySelectorAll: (sel: string) => ArrayLike<any> }} root
 * @returns {any[]}
 */
function collectElements(root) {
  const found = Array.from(root.querySelectorAll("*"));
  const all = [];
  for (const el of found) {
    all.push(el);
    if (el.content && typeof el.content.querySelectorAll === "function") {
      all.push(...collectElements(el.content));
    }
  }
  return all;
}

/**
 * Walk every element reachable from `doc` (document-order, INCLUDING inside
 * `<template>` contents — see `collectElements`; this also covers elements a
 * browser's HTML parser may place in `<head>` even when authored "in body",
 * e.g. a stray `<meta>`/`<base>`/`<link>`) and remove, in place: every `on*`
 * attribute; any ACTIVE_URL_ATTRS value carrying a dangerous scheme; and
 * every STRIPPED_TAGS element entirely. Mutates `doc`; returns nothing.
 * @param {{ querySelectorAll: (sel: string) => ArrayLike<any> }} doc
 */
function stripActiveMarkup(doc) {
  // A single static snapshot BEFORE any mutation — removing attributes/
  // elements while iterating a LIVE list (e.g. a real NamedNodeMap) can skip
  // entries out from under the walk.
  const all = collectElements(doc);

  for (const el of all) {
    const names = Array.from(el.attributes || []).map((a) => a.name);
    for (const name of names) {
      if (isEventHandlerAttr(name)) {
        el.removeAttribute(name);
      } else if (ACTIVE_URL_ATTRS.includes(String(name).toLowerCase()) && isDangerousUrl(el.getAttribute(name))) {
        el.removeAttribute(name);
      }
    }
  }

  for (const el of all) {
    if (isStrippedTag(el.tagName) && el.parentNode && typeof el.parentNode.removeChild === "function") {
      el.parentNode.removeChild(el);
    }
  }
}

/**
 * Sanitize an HTML string for the ONE mediated DOM-write path
 * (`adapters/eds/dom.js`'s `fill()`, spec 018-01 AC1). Parses `html` on an
 * INERT parser (`DOMParser.parseFromString(html, "text/html")` by default —
 * parsing alone never executes a script or fetches a resource, so this is
 * safe to run over fully untrusted input), strips the active-markup surface
 * (see the module docstring), and re-serializes the cleaned `<body>`'s
 * `innerHTML`.
 *
 * NEVER THROWS: any failure (non-string/empty input, no parser available,
 * a malformed parse, an unexpected shape from an injected `opts.parse`) fails
 * SAFE — returns `""` — rather than ever falling back to the raw,
 * unsanitized input.
 *
 * @param {unknown} html the (possibly untrusted) HTML string to sanitize.
 * @param {{ parse?: (html: string) => { body: { innerHTML: string },
 *   querySelectorAll: (sel: string) => ArrayLike<any> } | null | undefined }}
 *   [opts] `parse` — the INJECTABLE parser (default: the ambient `DOMParser`
 *   global, `null` when unavailable). Injected so this vendor-neutral,
 *   import-free module never hardcodes a DOM dependency, and so its pure
 *   wiring is unit-testable in Node (which has no DOMParser) — see the
 *   module docstring's substrate note for what that Node coverage does and
 *   does not prove.
 * @returns {string} the cleaned `body.innerHTML`, or `""`.
 */
export function sanitizeHtml(html, opts = {}) {
  if (typeof html !== "string" || html.length === 0) return "";
  const parse = typeof opts.parse === "function" ? opts.parse : defaultParse;
  let doc;
  try {
    doc = parse(html);
  } catch {
    return ""; // a parse failure fails SAFE (no content), never raw passthrough
  }
  if (!doc || !doc.body || typeof doc.querySelectorAll !== "function") return "";
  try {
    stripActiveMarkup(doc);
    return typeof doc.body.innerHTML === "string" ? doc.body.innerHTML : "";
  } catch {
    return "";
  }
}
