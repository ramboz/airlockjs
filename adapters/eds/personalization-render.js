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
export const REDIRECT_DISPLAY_WAIT_MS = 1500;

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
  let fetches = 0;
  let latest = new Map();
  const views = new Map();
  const placeholder = (name) => ({ scope: name, scopeDetails: { characteristics: { scopeType: "view" } }, items: [{ schema: SCHEMA.DEFAULT }] });
  const pick = (map, name) => {
    const list = typeof name === "string" ? map.get(name.toLowerCase()) : null;
    return list && list.length ? list : [placeholder(name)];
  };
  return {
    isInitialized: () => initialized,
    markInitialized: () => { initialized = true; },
    /** How many fetched responses were stored; an event compares it to the count when it started. */
    fetchCount: () => fetches,
    /**
     * Store a response's view-scoped propositions (replacing per view name); returns them. A fetched response
     * also becomes the "latest" storage (064-29); an applied one only merges into the cache, as stock's does.
     */
    store(propositions, { fetched = true } = {}) {
      initialized = true;
      const byName = new Map();
      for (const p of propositions) {
        const key = p.scope.toLowerCase();
        byName.set(key, [...(byName.get(key) || []), p]);
      }
      for (const [key, list] of byName) views.set(key, list);
      if (fetched) { latest = byName; fetches += 1; }
    },
    /** Is there a cached entry for this view name (the placeholder `get` returns does not count)? */
    has: (name) => typeof name === "string" && !!(views.get(name.toLowerCase()) || []).length,
    /** The cached propositions for a view name, or the placeholder. */
    get: (name) => pick(views, name),
    /** The named view of the most recent fetched response only (stock's `update()` on a fetch), or the placeholder. */
    getLatest: (name) => pick(latest, name),
  };
}

/**
 * The deliveries still in flight (064-28). More than one can overlap (the ruleset-item callback and a fetch answer's
 * delivery; an applied response is stored, not delivered), so `settled` waits for all of them, including any tracked while it waits. A rejected run never
 * rejects `settled`.
 */
export function createDeliveryTracker() {
  const pending = new Set();
  return {
    track(run) {
      const p = Promise.resolve(run).catch(() => {});
      pending.add(p);
      p.then(() => pending.delete(p));
      return p;
    },
    async settled() {
      while (pending.size) await Promise.all([...pending]);
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
  const clickMetas = new Map(); // selector -> { [propositionId]: { scope, scopeDetails, trackingLabel, scopeType } }
  // Stock `autoCollectPropositionInteractions`: per decision provider, which rendered elements get decorated for click collection.
  const autoCollect = { AJO: "always", TGT: "never", ...(isObject(deps.autoCollectPropositionInteractions) ? deps.autoCollectPropositionInteractions : {}) };
  const interactions = new Map(); // interact id -> [{ id, scope, scopeDetails, scopeType, provider, items: [{ id }] }]
  let interactCounter = 0;
  let inserted = [];
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
    const nodes = [...tpl.content.childNodes];
    inserted = nodes;
    return nodes;
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

  const CONTAINER_ACTIONS = new Set(["setHtml", "appendHtml", "setText", "setAttribute", "setStyle", "move", "resize"]);
  const INSERT_ACTIONS = new Set(["prependHtml", "insertAfter", "insertBefore", "replaceHtml"]);
  /** The elements stock decorates for an action: the container, the inserted elements, or the swapped pair. */
  function decorationTargets(type, el, content, before) {
    if (CONTAINER_ACTIONS.has(type)) return [el];
    if (INSERT_ACTIONS.has(type)) return inserted.filter((n) => n && n.tagName);
    if (type === "setImageSource") return String(el.tagName).toUpperCase() === "IMG" ? [el] : [];
    if (type === "rearrange") { const { from, to } = isObject(content) ? content : {}; return [before[from], before[to]].filter(Boolean); }
    return [];
  }
  /** Stock `decorateProposition`: mark a rendered element so a click on it is collected as an interaction. */
  function decorate(target, item, proposition) {
    const provider = proposition.scopeDetails && proposition.scopeDetails.decisionProvider;
    const mode = autoCollect[provider];
    if (mode !== "always" && mode !== "decoratedElementsOnly") return;
    let interactId = target.getAttribute("data-aep-interact-id");
    if (!interactId) { interactCounter += 1; interactId = String(interactCounter); target.setAttribute("data-aep-interact-id", interactId); }
    const scopeType = proposition.scopeDetails && proposition.scopeDetails.characteristics && proposition.scopeDetails.characteristics.scopeType;
    const metas = interactions.get(interactId) || [];
    // Stock keeps one meta per proposition per element, with a set of item ids.
    const have = metas.find((m) => m.id === proposition.id);
    if (!have) metas.push({ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails, scopeType, provider, items: [{ id: item.id }] });
    else if (!have.items.some((i) => i.id === item.id)) have.items.push({ id: item.id });
    interactions.set(interactId, metas);
    const label = item.characteristics && item.characteristics.trackingLabel;
    if (label && !target.getAttribute("data-aep-click-label")) target.setAttribute("data-aep-click-label", label);
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
      return "click"; // rendered (attempted), but stock leaves a click item out of the display notification
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
        const before = type === "rearrange" ? [...el.children] : null;
        inserted = [];
        if (applyAction(type, el, content)) {
          for (const t of decorationTargets(type, el, content, before)) decorate(t, item, proposition);
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
      let notified = false;
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
        if (ok) { renderedItems.push(item); if (ok !== "click") notified = true; }
      }
      const attempted = renderedItems.length > 0;
      out.push({ ...proposition, renderAttempted: attempted });
      if (notified && !(redirected && proposition === only)) {
        displayed.push({ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails });
      }
    }
    return { propositions: out, displayed, redirected };
  }

  const strip = ({ trackingLabel, scopeType, provider, ...notification }) => notification;
  const dedupe = (metas) => metas.filter((m, i) => metas.findIndex((o) => JSON.stringify(o) === JSON.stringify(m)) === i);
  const viewOf = (metas) => { const v = metas.find((m) => m.scopeType === "view"); return v ? v.scope : undefined; };

  /** Stock `collectClicks`: the click-item metas of the nearest matching ancestor per stored selector; the label and view come from the closest. */
  function collectClicks(target) {
    const out = { metas: [], label: "", viewName: undefined };
    let labelDepth = Infinity; let viewDepth = Infinity;
    for (const [selector, byProposition] of clickMetas) {
      let depth = 0; let node = target;
      for (; node; node = node.parentNode, depth += 1) {
        try { if (node.nodeType === 1 && selectAll(doc, selector).includes(node)) break; } catch (e) { node = null; break; }
      }
      if (!node) continue;
      const metas = Object.entries(byProposition).map(([id, m]) => ({ id, ...m }));
      const labelled = metas.find((m) => m.trackingLabel);
      if (labelled && depth <= labelDepth) { out.label = labelled.trackingLabel; labelDepth = depth; }
      const view = viewOf(metas);
      if (view && depth <= viewDepth) { out.viewName = view; viewDepth = depth; }
      out.metas.push(...metas);
    }
    out.metas = dedupe(out.metas.map(strip));
    return out;
  }

  /** Stock `collectInteractions`: the decorated ancestors' rendered-item metas, filtered by each provider's auto-collect mode. */
  function collectInteractions(target) {
    const ids = []; let label = ""; let token;
    for (let node = target; node && node.nodeType !== 9 && node.tagName !== "HTML"; node = node.parentNode) {
      if (!node.getAttribute) continue;
      const id = node.getAttribute("data-aep-interact-id");
      if (id) ids.push(id);
      if (!label && node.getAttribute("data-aep-click-label")) label = node.getAttribute("data-aep-click-label");
      if (!token && node.getAttribute("data-aep-click-token")) token = node.getAttribute("data-aep-click-token");
    }
    const out = { metas: [], label: "", token: undefined, viewName: undefined };
    if (!ids.length) return out;
    const merged = new Map();
    for (const id of ids) for (const m of interactions.get(id) || []) {
      const have = merged.get(m.id);
      if (!have) merged.set(m.id, { ...m, items: [...m.items] });
      else for (const i of m.items) if (!have.items.some((x) => x.id === i.id)) have.items.push(i);
    }
    const kept = [...merged.values()].filter((m) => autoCollect[m.provider] === "always" || (autoCollect[m.provider] === "decoratedElementsOnly" && (label || token)));
    if (!kept.length) return out;
    return { metas: kept.map(strip), label, token, viewName: viewOf(kept) };
  }

  /** What a click on `target` reports to Edge: the propositions, the action (label, token) and the view, merged as stock does. */
  function collectInteraction(target) {
    const parts = [collectInteractions(target), collectClicks(target)];
    const out = { metas: [], label: "", token: undefined, viewName: undefined };
    for (const p of parts) {
      out.metas.push(...p.metas);
      out.label = out.label || p.label || "";
      out.token = out.token || p.token;
      out.viewName = out.viewName || p.viewName;
    }
    out.metas = dedupe(out.metas);
    return out;
  }

  return { render, collectInteraction, hasRedirect: (p) => hasRedirect(p), isRedirecting: () => redirecting };
}

/** The display notification XDM Alloy sends after rendering (recorded, S4); `viewName` is the view the event names. */
export function displayNotificationXdm(displayed, viewName) {
  return {
    eventType: "decisioning.propositionDisplay",
    ...(viewName ? { web: { webPageDetails: { viewName } } } : {}),
    _experience: { decisioning: { propositions: displayed, propositionEventType: { display: 1 } } },
  };
}

/** The click (interact) notification XDM, `propositionEventType.interact = 1`, as stock builds it (viewName, `propositionAction`). */
export function interactNotificationXdm({ metas, label, token, viewName }) {
  const decisioning = { propositions: metas, propositionEventType: { interact: 1 } };
  if (label || token) decisioning.propositionAction = { ...(label ? { label } : {}), ...(token ? { tokens: [token] } : {}) };
  return { eventType: "decisioning.propositionInteract", ...(viewName ? { web: { webPageDetails: { viewName } } } : {}), _experience: { decisioning } };
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
