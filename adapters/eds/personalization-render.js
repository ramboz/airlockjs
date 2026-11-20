/**
 * Main-thread personalization rendering — spec 064-20 (B4). The chamber has no DOM (ADR-0014), so the
 * propositions Alloy returns leave it as data through the granted `decisions` capability and THIS module
 * renders them on the host page, behaving as stock Alloy 2.31.1 does with `renderDecisions: true`:
 *
 *   - `default-content-item`: nothing to draw, counted as rendered (the recorded `__view__` display notification);
 *   - `dom-action` items (and `html-content-item` with `metadata[scope] = { selector, actionType }`): the stock
 *     action set; HTML goes through the 018 sanitizer, never raw;
 *   - `redirect-item`: prehide BODY, send the display notification (`deps.redirectDisplay`; keepalive once the identity cookie exists, as stock),
 *     then `location.replace` to an http(s) URL (064-24). A display that is held, failed or slow is diagnosed and
 *     the redirect proceeds after `redirectTimeoutMs`, so a held seal never strands the visitor on the page;
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
const REDIRECT_DISPLAY_WAIT_MS = 1500;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const IDS_ATTR = "data-adobe-proposition-ids";

/** Stock `getScopeType() === "view"`: a view-scoped proposition (not the page-wide `__view__` / web surface). */
export function isViewProposition(p) {
  if (!isObject(p) || typeof p.scope !== "string" || p.scope === VIEW_SCOPE || /^web:\/\//.test(p.scope)) return false;
  const details = isObject(p.scopeDetails) ? p.scopeDetails : {};
  return isObject(details.characteristics) && details.characteristics.scopeType === "view";
}

/**
 * The SPA view cache (064-23), as stock Alloy 2.31.1 keeps it: view-scoped propositions from every response,
 * keyed by lower-cased view name and replaced per name, so a later push naming the view renders them without a
 * request. A name with nothing cached gets stock's empty-view placeholder (a default-content item, no id).
 * It is initialized by the first fetched response, even an empty one.
 */
export function createViewCache() {
  let initialized = false;
  const views = new Map();
  const placeholder = (name) => ({ scope: name, scopeDetails: { characteristics: { scopeType: "view" } }, items: [{ schema: SCHEMA.DEFAULT }] });
  return {
    isInitialized: () => initialized,
    markInitialized: () => { initialized = true; },
    /** Store a response's view-scoped propositions (replacing per view name); returns them. */
    store(propositions) {
      initialized = true;
      const byName = new Map();
      for (const p of propositions) {
        const key = p.scope.toLowerCase();
        byName.set(key, [...(byName.get(key) || []), p]);
      }
      for (const [key, list] of byName) views.set(key, list);
    },
    /** The cached propositions for a view name, or the placeholder. */
    get(name) {
      const list = typeof name === "string" ? views.get(name.toLowerCase()) : null;
      return list && list.length ? list : [placeholder(name)];
    },
  };
}

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
        const found = n.querySelectorAll(css);
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
 * @param {{ document?: Document, window?: Window, sanitize?: (html: string) => string, diagnose?: (r: object) => void, selectorTimeoutMs?: number,
 *   redirectDisplay?: (displayed: object[]) => Promise<{ sent: boolean, reason?: string }>, redirectTimeoutMs?: number }} [deps]
 *   `redirectDisplay` sends the redirect's display notification (documentUnloading) and settles once the request
 *   has left, or says why it did not. Absent, a redirect navigates at once (no notification).
 */
export function createPropositionRenderer(deps = {}) {
  const win = deps.window || (typeof window !== "undefined" ? window : {});
  const doc = deps.document || (typeof document !== "undefined" ? document : null);
  const sanitize = deps.sanitize || ((html) => sanitizeHtml(html));
  const diagnose = deps.diagnose || (() => {});
  const waitMs = deps.selectorTimeoutMs ?? SELECTOR_WAIT_MS;
  const redirectWaitMs = deps.redirectTimeoutMs ?? REDIRECT_DISPLAY_WAIT_MS;
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
      case "insertAfter": { const parent = el.parentNode; const ref = el.nextElementSibling; if (parent) for (const n of fragmentNodes(content)) parent.insertBefore(n, ref); return true; }
      case "setText": el.textContent = String(content == null ? "" : content); return true;
      case "setAttribute":
        if (isObject(content)) for (const [k, v] of Object.entries(content)) {
          // Executable-content vectors the sanitizer would strip from HTML are refused here too (spec 064 2.2 customCode rule).
          const tag = String(el.tagName).toLowerCase();
          const risky = /^on/i.test(k) || /^(srcdoc|data|http-equiv|formaction)$/i.test(k) || /^(script|iframe|object|embed|base|meta|link)$/.test(tag)
            || (/^(href|src|action|xlink:href|poster|background|ping)$/i.test(k) && isDangerousUrl(v));
          if (risky) { warn(`setAttribute "${k}" on <${tag}> refused by the sanitizer policy`); continue; }
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
      const viewScoped = isViewProposition(proposition);
      for (const el of nodes) {
        const done = rendered.get(el) || new Set();
        if (done.has(item.id) && type === "rearrange") continue; // rearrange is idempotent-guarded like stock
        // Stock marks view-scoped items on the element and does not draw one twice (returning to a view).
        const marked = viewScoped ? (el.getAttribute(IDS_ATTR) || "").split(",") : null;
        if (marked && marked.includes(String(item.id))) { any = true; continue; }
        if (applyAction(type, el, content)) {
          any = true; done.add(item.id); rendered.set(el, done);
          if (marked && el.setAttribute) el.setAttribute(IDS_ATTR, [...marked, String(item.id)].sort().join(","));
        } else { warn(`unknown dom-action type "${type}"`, { scope: proposition.scope }); return false; }
      }
      if (!nodes.length) warn(`selector matched nothing: ${selector}`, { scope: proposition.scope });
      return any;
    } finally {
      reveal(prehidingSelector);
    }
  }

  /** Stock `applyPropositions` metadata: an html-content item renders as a dom-action at `{ selector, actionType }`. */
  function asDomAction(item, metadata) {
    const own = isObject(item.data) && typeof item.data.selector === "string" && typeof item.data.type === "string";
    if (own) return { ...item, schema: SCHEMA.DOM_ACTION };
    const meta = isObject(metadata) ? metadata : null;
    if (!meta || typeof meta.selector !== "string" || typeof meta.actionType !== "string") return null;
    return { ...item, schema: SCHEMA.DOM_ACTION, data: { ...item.data, selector: meta.selector, type: meta.actionType } };
  }

  /**
   * Stock order: hide the body, send the display notification (keepalive), then `location.replace`. The display is
   * not awaited by the caller: it is queued behind the event that delivered this proposition, so waiting here would
   * deadlock. Navigation follows the send, or the bounded wait when the display is held, failed or never settles.
   */
  const redirectUrl = (item) => {
    const url = item && item.schema === SCHEMA.REDIRECT && item.data ? item.data.content : undefined;
    return typeof url === "string" && /^https?:\/\//i.test(url) && !isDangerousUrl(url) ? url : null;
  };
  /** True when this proposition carries a redirect item the renderer will follow (stock's `onlyRenderThis`). */
  const hasRedirect = (proposition) => !!proposition && Array.isArray(proposition.items) && proposition.items.some((i) => redirectUrl(i));
  let redirecting = false;
  function redirect(url, proposition) {
    if (!redirectUrl({ schema: SCHEMA.REDIRECT, data: { content: url } })) {
      warn("redirect refused: only http(s) URLs are followed", { scope: proposition.scope });
      return false;
    }
    // A throwing diagnostic sink must never keep the visitor on a hidden page.
    const problem = (disposition, reason) => {
      try { diagnose({ level: "warn", kind: "decisions", disposition, reason, scope: proposition.scope }); } catch (e) { /* the sink failed; navigation still proceeds */ }
    };
    let navigated = false;
    let failedNav = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      try {
        if (!win.location || typeof win.location.replace !== "function") throw new Error("location.replace is unavailable");
        win.location.replace(url);
      } catch (e) {
        problem("redirect-display-failed", `the redirect could not navigate (${(e && e.message) || e})`);
        reveal("BODY");
        redirecting = false;
        failedNav = true;
      }
    };
    if (typeof deps.redirectDisplay !== "function") { navigate(); return !failedNav; }
    prehide("BODY");
    const timer = setTimeout(() => {
      navigate();
      problem("redirect-display-held", `the redirect display notification was not sent within ${redirectWaitMs}ms (held at the seal or still queued); redirecting without it`);
    }, redirectWaitMs);
    const settle = (fn) => (arg) => { clearTimeout(timer); navigate(); fn(arg); };
    let pending;
    try {
      pending = Promise.resolve(deps.redirectDisplay([{ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails }]));
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(
      settle((r) => { if (!(r && r.sent)) problem("redirect-display-failed", `the redirect display notification was not sent (${(r && r.reason) || "unknown"}); redirecting without it`); }),
      settle((e) => problem("redirect-display-failed", `the redirect display notification failed (${(e && e.message) || e}); redirecting without it`)),
    );
    return true;
  }

  /**
   * Render propositions. `metadata` is the `applyPropositions` per-scope map; the post-response path passes none.
   * @returns {Promise<{ propositions: object[], displayed: object[], redirected: boolean }>} `propositions` is the stock return value
   *   (each with `renderAttempted`); `displayed` are the `{ id, scope, scopeDetails }` the display notification carries;
   *   `redirected` is true when a redirect was started (its own display notification is sent by the redirect).
   */
  async function render(propositions, { metadata = {} } = {}) {
    const out = [];
    const displayed = [];
    let redirected = false;
    // Stock marks a redirect `onlyRenderThis`: nothing else in the response renders. Only the first redirect proposition does.
    const list = Array.isArray(propositions) ? propositions : [];
    const only = redirecting ? null : list.find((p) => isObject(p) && hasRedirect(p));
    for (const proposition of list) {
      if (!isObject(proposition)) continue;
      if (redirecting || (only && proposition !== only)) { out.push({ ...proposition, renderAttempted: false }); continue; }
      // Stock skips a `__view__` proposition that was already rendered (applyPropositions re-run).
      if (proposition.scope === VIEW_SCOPE && proposition.renderAttempted) { out.push(proposition); continue; }
      const items = Array.isArray(proposition.items) ? proposition.items : [];
      const renderedItems = [];
      for (const item of items) {
        const schema = item && item.schema;
        if (redirecting || (proposition === only && !redirectUrl(item))) continue;
        let ok = false;
        try {
          if (schema === SCHEMA.DEFAULT) ok = true;
          else if (schema === SCHEMA.DOM_ACTION) ok = await renderDomAction(item, proposition);
          else if (schema === SCHEMA.HTML) {
            const action = asDomAction(item, metadata[proposition.scope]);
            if (action) ok = await renderDomAction(action, proposition);
          } else if (schema === SCHEMA.REDIRECT) { ok = redirect(item.data && item.data.content, proposition); redirected = redirected || ok; if (ok) redirecting = true; }
        } catch (e) {
          warn(`item ${item && item.id} failed to render: ${e && e.message}`, { scope: proposition.scope });
        }
        if (ok) renderedItems.push(item);
      }
      const attempted = renderedItems.length > 0;
      out.push({ ...proposition, renderAttempted: attempted });
      if (attempted && !(redirected && proposition === only)) {
        displayed.push({ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails });
      }
    }
    return { propositions: out, displayed, redirected };
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

  return { render, clickMetasFor, hasClickSelectors: () => clickMetas.size > 0, hasRedirect: (p) => hasRedirect(p), isRedirecting: () => redirecting };
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
  if (label || token) decisioning.propositionAction = { ...(label ? { label } : {}), ...(token ? { tokens: [token] } : {}) };
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
