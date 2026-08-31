/**
 * Decisions-as-data parse — spec 012-03, AC1/AC2 (pure, browser-safe piece).
 *
 * alloy `sendEvent({ renderDecisions: false })` resolves to a result carrying
 * `propositions` (Target headless mode — R-004: alloy fetches the decisions from
 * the Edge and hands them BACK as data instead of rendering them). This module is
 * where the wrapped-SDK connector turns that result into the airlock contract's
 * `Decision[]` (`{ scope, content }`, contracts/capability.d.ts) for a scope
 * (default `__view__`, the above-the-fold personalization scope R-004 confirmed is
 * present in the interact query).
 *
 * PURE + null-safe by design: the connector calls `extractDecisions` INSIDE the
 * chamber, which has no DOM — the decision must cross the boundary as DATA (AC2),
 * never applied in the worker. The HOST applies it later through the mediated
 * `reserveSpace` capability (adapters/eds/dom.js). No node builtins, no `self`,
 * no DOM — so it is directly unit-testable and safe to inline into the classic
 * worker bundle (the ESM import is inlined by esbuild).
 *
 * The proposition SHAPE is the documented Adobe XDM Personalization proposition
 * (`{ id, scope, scopeDetails, items: [{ schema, data: { content } }] }`), grounded
 * against the alloy 2.35.0 bundle (which carries `personalization:decisions`,
 * `__view__`, the `html-content-item` schema, and `renderAttempted`).
 */

/** The default above-the-fold personalization scope alloy requests (R-004). */
export const VIEW_SCOPE = "__view__";

/** The html-content-item schema whose `data.content` is the HTML the host applies. */
const HTML_CONTENT_ITEM_SCHEMA = "https://ns.adobe.com/personalization/html-content-item";

/**
 * Turn an alloy sendEvent result into the contract's `Decision[]` for a scope.
 *
 * @param {{ propositions?: Array<object> } | null | undefined} result
 *   the resolved value of alloy `sendEvent({ renderDecisions:false, ... })`.
 * @param {{ scope?: string | null }} [opts] scope filter (default `__view__`;
 *   `null` returns every scope).
 * @returns {Array<{ scope: string, content: object }>} one Decision per matching
 *   proposition — `content` is the proposition itself (data the host reads), so
 *   `scopeDetails`/`items` survive the boundary. Never throws.
 */
export function extractDecisions(result, { scope = VIEW_SCOPE } = {}) {
  const propositions = result && Array.isArray(result.propositions) ? result.propositions : [];
  const out = [];
  for (const p of propositions) {
    if (!p || typeof p !== "object") continue;
    if (scope != null && p.scope !== scope) continue;
    out.push({ scope: p.scope, content: p });
  }
  return out;
}

/**
 * Unwrap a Decision (`{ scope, content }`) to its `content` object, or pass a
 * bare proposition (or any other non-Decision value) through unchanged.
 *
 * SHARED (018-02 AC2 — a rule-of-three extraction) with
 * `adapters/eds/decisions-exposure.js`'s `propositionOf`, which imports this
 * accessor but layers its OWN extra scope/id predicate on top rather than
 * delegating to it wholesale: this accessor unwraps `.content` whenever it is
 * an object, with no proposition-IDENTITY check. `htmlOfDecision` below can
 * tolerate that (a content object with no items just yields no html match,
 * same as no content at all), but `decisions-exposure.js`'s exposure mapping
 * cannot — it needs a `scope`+`id` to report anything, so unwrapping an
 * ID-less `.content` there would silently paper over a malformed proposition
 * instead of correctly falling through to `null`. So the two sites are NOT
 * byte-identical in their gating, and forcing full unification would change
 * `decisions-exposure.js`'s behavior on that edge case (see the 018-02
 * deviation log). This is not a third private copy, though: the base unwrap
 * lives here once; only the extra gate is local to the one site that needs it.
 *
 * @param {{ content?: unknown } | unknown} x a Decision or a bare proposition.
 * @returns {unknown} `x.content` when it is an object, else `x` itself.
 */
export function contentOf(x) {
  return x && x.content && typeof x.content === "object" ? x.content : x;
}

/**
 * The renderable HTML a decision fills its reserved box with — the first
 * html-content-item's `data.content` string, or `null` when the proposition
 * carries no HTML item (e.g. a JSON offer, a redirect). Null-safe, never throws.
 *
 * @param {{ content?: object } | object | null | undefined} decision a Decision
 *   (`{ scope, content }`) or a bare proposition.
 * @returns {string | null}
 */
export function htmlOfDecision(decision) {
  const proposition = contentOf(decision);
  const items = proposition && Array.isArray(proposition.items) ? proposition.items : [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const data = item.data;
    const isHtml = item.schema === HTML_CONTENT_ITEM_SCHEMA
      || (data && typeof data.content === "string" && /^text\/html/.test(String(data.format || "")));
    if (isHtml && data && typeof data.content === "string") return data.content;
  }
  return null;
}
