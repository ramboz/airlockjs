/**
 * Main-thread personalization rendering — spec 064-20 (B4). The chamber has no DOM (ADR-0014), so the
 * propositions Alloy returns leave it as data through the granted `decisions` capability and THIS module
 * renders them on the host page, behaving as stock Alloy 2.31.1 does with `renderDecisions: true`:
 *
 *   - `default-content-item`: nothing to draw, counted as rendered (the recorded `__view__` display notification);
 *   - `dom-action` items (and `html-content-item` with `metadata[scope] = { selector, actionType }`): the stock
 *     action set; HTML goes through the 018 sanitizer, never raw;
 *   - `redirect-item`: `location.replace` to an http(s) URL;
 *   - JSON, rule set, in-app and content-card items: returned to the caller as data, not rendered.
 *
 * `customCode` is NOT rendered: it runs arbitrary site-unknown script on the main thread, which the airlock
 * exists to keep out. It is returned with `renderAttempted: false` and a diagnostic (incompatible, spec 064 2.2).
 *
 * Everything is DI'd (`document`, `location`, `sanitize`, `diagnose`) so it runs hermetically with a fake DOM.
 */
import { sanitizeHtml, isDangerousUrl } from "../../core/sanitize-html.js";

const NS = "https://ns.adobe.com/personalization/";
export const SCHEMA = Object.freeze({
  DEFAULT: `${NS}default-content-item`,
  HTML: `${NS}html-content-item`,
  JSON: `${NS}json-content-item`,
  REDIRECT: `${NS}redirect-item`,
  RULESET: `${NS}ruleset-item`,
  DOM_ACTION: `${NS}dom-action`,
});
export const VIEW_SCOPE = "__view__";
export const PREHIDING_ID = "alloy-prehiding";
const SELECTOR_WAIT_MS = 3000;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** `a:eq(2) b` style selectors (stock extension): split on `:eq(n)` and walk the matches. */
function selectAll(doc, selector, root) {
  const parts = String(selector).split(/:eq\((\d+)\)/);
  let nodes = [root || doc];
  for (let i = 0; i < parts.length; i += 2) {
    const css = parts[i].trim();
    const index = parts[i + 1];
    if (css) {
      const next = [];
      for (const n of nodes) {
        const found = n === doc || n === root ? n.querySelectorAll(css) : n.querySelectorAll(css);
        next.push(...found);
      }
      nodes = next;
    }
    if (index !== undefined) nodes = nodes[Number(index)] ? [nodes[Number(index)]] : [];
  }
  return nodes[0] === doc ? [] : nodes;
}

/** Wait (bounded) for a selector to match, as stock does for late-loading containers. */
function awaitSelector(doc, selector, timeoutMs, win) {
  let found;
  try { found = selectAll(doc, selector); } catch (e) { return Promise.resolve([]); }
  if (found.length || typeof win.MutationObserver !== "function") return Promise.resolve(found);
  return new Promise((resolve) => {
    const finish = () => { observer.disconnect(); clearTimeout(timer); resolve(selectAll(doc, selector)); };
    const observer = new win.MutationObserver(() => { try { if (selectAll(doc, selector).length) finish(); } catch (e) { finish(); } });
    const timer = setTimeout(finish, timeoutMs);
    observer.observe(doc.documentElement || doc, { childList: true, subtree: true });
  });
}

const toPx = (v) => (String(v).endsWith("px") ? v : `${v}px`);

/**
 * Build the renderer.
 * @param {{ document?: Document, window?: Window, sanitize?: (html: string) => string, diagnose?: (r: object) => void, selectorTimeoutMs?: number }} [deps]
 */
export function createPropositionRenderer(deps = {}) {
  const win = deps.window || (typeof window !== "undefined" ? window : {});
  const doc = deps.document || (typeof document !== "undefined" ? document : null);
  const sanitize = deps.sanitize || ((html) => sanitizeHtml(html));
  const diagnose = deps.diagnose || (() => {});
  const waitMs = deps.selectorTimeoutMs ?? SELECTOR_WAIT_MS;
  const rendered = new WeakMap(); // element -> Set of item ids already rendered (stock renderStatusHandler)
  const clickMetas = new Map(); // selector -> { [propositionId]: { scope, scopeDetails, trackingLabel } }
  const prehidden = new Map(); // selector -> <style>

  const warn = (reason, extra) => diagnose({ level: "warn", kind: "decisions", disposition: "unrendered", reason, ...extra });

  function prehide(selector) {
    if (!doc || !selector || prehidden.has(selector)) return;
    const style = doc.createElement("style");
    style.textContent = `${selector} { visibility: hidden }`;
    (doc.head || doc.documentElement).appendChild(style);
    prehidden.set(selector, style);
  }
  function reveal(selector) {
    const style = prehidden.get(selector);
    if (style) { style.remove(); prehidden.delete(selector); }
  }

  const html = (content) => sanitize(String(content == null ? "" : content));
  const fragmentNodes = (content) => {
    const tpl = doc.createElement("template");
    tpl.innerHTML = html(content);
    return [...tpl.content.childNodes];
  };
  const setStyle = (el, style, priority) => {
    for (const [k, v] of Object.entries(style)) {
      el.style.setProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), String(v), priority || "");
    }
  };

  /** One action over one element. Returns false when the action type is not rendered here. */
  function applyAction(type, el, content) {
    switch (type) {
      case "setHtml": el.replaceChildren(...fragmentNodes(content)); return true;
      case "replaceHtml": el.replaceWith(...fragmentNodes(content)); return true;
      // stock puts prepended content before the first ELEMENT child (after leading text), else appends
      case "prependHtml": { const first = el.firstElementChild; for (const n of fragmentNodes(content)) el.insertBefore(n, first); return true; }
      case "appendHtml": el.append(...fragmentNodes(content)); return true;
      case "insertBefore": el.before(...fragmentNodes(content)); return true;
      case "insertAfter": { const parent = el.parentNode; if (parent) for (const n of fragmentNodes(content)) parent.insertBefore(n, el.nextElementSibling); return true; }
      case "setText": el.textContent = String(content == null ? "" : content); return true;
      case "setAttribute":
        if (isObject(content)) for (const [k, v] of Object.entries(content)) {
          if (/^on/i.test(k) || (/^(href|src|action|formaction|xlink:href)$/i.test(k) && isDangerousUrl(v))) { warn(`setAttribute "${k}" refused by the sanitizer policy`); continue; }
          el.setAttribute(k, String(v));
        }
        return true;
      case "setImageSource":
        if (String(el.tagName).toUpperCase() !== "IMG") return true;
        if (isDangerousUrl(content)) { warn("setImageSource refused: dangerous URL"); return true; }
        el.removeAttribute("src");
        el.setAttribute("src", String(content));
        return true;
      case "setStyle": { const { priority, ...style } = isObject(content) ? content : {}; setStyle(el, style, priority); return true; }
      case "move": {
        const { priority, ...style } = isObject(content) ? content : {};
        for (const k of ["left", "top"]) if (k in style) style[k] = toPx(style[k]);
        setStyle(el, style, priority);
        return true;
      }
      case "resize": {
        const { priority, ...style } = isObject(content) ? content : {};
        for (const k of ["width", "height"]) if (k in style) style[k] = toPx(style[k]);
        setStyle(el, style, priority);
        return true;
      }
      case "rearrange": {
        const { from, to } = isObject(content) ? content : {};
        const kids = [...el.children];
        const a = kids[from]; const b = kids[to];
        if (a && b) { if (from < to) b.after(a); else b.before(a); }
        return true;
      }
      case "remove": el.remove(); return true;
      default: return false;
    }
  }

  /** Render one dom-action item. Resolves true when the item counts as rendered. */
  async function renderDomAction(item, proposition) {
    const data = isObject(item.data) ? item.data : {};
    const { type, selector, content, prehidingSelector } = data;
    if (!doc || typeof selector !== "string" || !selector) { warn("dom-action item has no selector", { scope: proposition.scope }); return false; }
    if (type === "customCode") {
      warn("customCode actions are not rendered: they run arbitrary script on the main thread (incompatible, spec 064 2.2)", { scope: proposition.scope });
      return false;
    }
    if (type === "click") {
      const meta = { scope: proposition.scope, scopeDetails: proposition.scopeDetails, trackingLabel: item.characteristics && item.characteristics.trackingLabel, scopeType: proposition.scopeDetails && proposition.scopeDetails.characteristics && proposition.scopeDetails.characteristics.scopeType };
      const byProposition = clickMetas.get(selector) || {};
      byProposition[proposition.id] = meta;
      clickMetas.set(selector, byProposition);
      return true;
    }
    prehide(prehidingSelector);
    try {
      const nodes = await awaitSelector(doc, selector, waitMs, win);
      let any = false;
      for (const el of nodes) {
        const done = rendered.get(el) || new Set();
        if (done.has(item.id) && type === "rearrange") continue; // rearrange is idempotent-guarded like stock
        if (applyAction(type, el, content)) { any = true; done.add(item.id); rendered.set(el, done); }
        else { warn(`unknown dom-action type "${type}"`, { scope: proposition.scope }); return false; }
      }
      if (!nodes.length) warn(`selector matched nothing: ${selector}`, { scope: proposition.scope });
      return any;
    } finally {
      reveal(prehidingSelector);
    }
  }

  /** Stock `applyPropositions` metadata: an html-content item renders as a dom-action at `{ selector, actionType }`. */
  function asDomAction(item, metadata) {
    const meta = isObject(metadata) ? metadata : null;
    if (!meta || typeof meta.selector !== "string" || typeof meta.actionType !== "string") return null;
    return { ...item, schema: SCHEMA.DOM_ACTION, data: { ...item.data, selector: meta.selector, type: meta.actionType } };
  }

  function redirect(url, proposition) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || isDangerousUrl(url)) {
      warn("redirect refused: only http(s) URLs are followed", { scope: proposition.scope });
      return false;
    }
    if (win.location && typeof win.location.replace === "function") win.location.replace(url);
    return true;
  }

  /**
   * Render propositions. `metadata` is the `applyPropositions` per-scope map; the post-response path passes none.
   * @returns {Promise<{ propositions: object[], displayed: object[] }>} `propositions` is the stock return value
   *   (each with `renderAttempted`); `displayed` are the `{ id, scope, scopeDetails }` the display notification carries.
   */
  async function render(propositions, { metadata = {} } = {}) {
    const out = [];
    const displayed = [];
    for (const proposition of Array.isArray(propositions) ? propositions : []) {
      if (!isObject(proposition)) continue;
      // Stock skips a `__view__` proposition that was already rendered (applyPropositions re-run).
      if (proposition.scope === VIEW_SCOPE && proposition.renderAttempted) { out.push(proposition); continue; }
      const items = Array.isArray(proposition.items) ? proposition.items : [];
      const renderedItems = [];
      for (const item of items) {
        const schema = item && item.schema;
        let ok = false;
        if (schema === SCHEMA.DEFAULT) ok = true;
        else if (schema === SCHEMA.DOM_ACTION) ok = await renderDomAction(item, proposition);
        else if (schema === SCHEMA.HTML) {
          const action = asDomAction(item, metadata[proposition.scope]);
          if (action) ok = await renderDomAction(action, proposition);
        } else if (schema === SCHEMA.REDIRECT) ok = redirect(item.data && item.data.content, proposition);
        if (ok) renderedItems.push(item);
      }
      const attempted = renderedItems.length > 0;
      out.push({ ...proposition, renderAttempted: attempted });
      if (attempted && !items.some((i) => i && i.schema === SCHEMA.REDIRECT)) {
        displayed.push({ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails });
      }
    }
    return { propositions: out, displayed };
  }

  /** The metas for a clicked element: every stored click selector the element (or an ancestor) matches. */
  function clickMetasFor(target) {
    const metas = [];
    for (const [selector, byProposition] of clickMetas) {
      let hit;
      try { hit = target && typeof target.closest === "function" ? target.closest(selector) : null; } catch (e) { continue; }
      if (!hit) continue;
      for (const [id, m] of Object.entries(byProposition)) metas.push({ id, scope: m.scope, scopeDetails: m.scopeDetails, trackingLabel: m.trackingLabel, scopeType: m.scopeType });
    }
    return metas;
  }

  return { render, clickMetasFor, hasClickSelectors: () => clickMetas.size > 0 };
}

/** The display notification XDM Alloy sends after rendering (recorded, S4). */
export function displayNotificationXdm(displayed) {
  return {
    eventType: "decisioning.propositionDisplay",
    _experience: { decisioning: { propositions: displayed, propositionEventType: { display: 1 } } },
  };
}

/** The click (interact) notification XDM, `propositionEventType.interact = 1`. */
export function interactNotificationXdm(metas, { label, token } = {}) {
  const propositions = metas.map(({ id, scope, scopeDetails }) => ({ id, scope, scopeDetails }));
  const decisioning = { propositions, propositionEventType: { interact: 1 } };
  if (label || token) decisioning.propositionAction = { ...(label ? { label } : {}), ...(token ? { token } : {}) };
  return { eventType: "decisioning.propositionInteract", _experience: { decisioning } };
}

/** The stock prehiding `<style id="alloy-prehiding">`: applied before the request, removed after the response. */
export function applyPrehidingStyle(doc, css) {
  if (!doc || !css || typeof css !== "string") return () => {};
  if (doc.getElementById(PREHIDING_ID)) return () => {};
  const style = doc.createElement("style");
  style.id = PREHIDING_ID;
  style.textContent = css;
  (doc.head || doc.documentElement).appendChild(style);
  return () => { const el = doc.getElementById(PREHIDING_ID); if (el) el.remove(); };
}
