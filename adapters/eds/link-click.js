/**
 * Main-thread link-click collection — spec 064-20 (B4). The chamber sets `clickCollectionEnabled:false`
 * (no DOM there, ADR-0014), so the click side of stock Alloy's ActivityCollector runs HERE: one capture-phase
 * `document` click listener that reads the clicked link and hands a `web.webinteraction.linkClicks` event (and,
 * when personalization rendered a click-tracked item, a `decisioning.propositionInteract` one) to the mediated
 * queue. Nothing leaves the page from here; the event goes through the same seam gate as every other push.
 * Mirrors stock Alloy 2.31.1 (`web.webInteraction`, `__adobe.analytics.contextData.a.activitymap`).
 */
import { interactNotificationXdm } from "./personalization-render.js";
const DEFAULT_DOWNLOAD_QUALIFIER = "\\.(exe|zip|wav|mp3|mov|mpg|avi|wmv|pdf|doc|docx|xls|xlsx|ppt|pptx)$";
const LANDMARK = /^(HEADER|MAIN|FOOTER|NAV)$/i;
const UNSUPPORTED = /^(SCRIPT|STYLE|LINK|CANVAS|NOSCRIPT|#COMMENT)$/i;

const clean = (s) => (s && String(s).replace(/\s+/g, " ").trim()) || "";
const stripQueryHash = (u) => {
  const q = u.indexOf("?"); const h = u.indexOf("#");
  return q >= 0 && (q < h || h < 0) ? u.substring(0, q) : h >= 0 ? u.substring(0, h) : u;
};

const isLink = (e) => !!e.href && (e.tagName === "A" || e.tagName === "AREA") && !(e.onclick && e.protocol && e.protocol.toLowerCase().indexOf("javascript") >= 0);
const isSubmit = (e) => (e.tagName === "INPUT" && (e.getAttribute("type") === "submit" || (e.getAttribute("type") === "image" && e.src))) || (e.tagName === "BUTTON" && e.type === "submit");

function findClickable(el) {
  let n = el;
  while (n && (!n.nodeName || n.nodeName !== "BODY")) {
    if (isLink(n) || !!n.onclick || isSubmit(n)) return n;
    n = n.parentNode;
  }
  return null;
}

function supportedNodes(node, acc = { nodes: [], unsupported: false }) {
  if (node && node.nodeName && UNSUPPORTED.test(node.nodeName)) { acc.unsupported = true; return acc; }
  acc.nodes.push(node);
  for (const c of Array.from((node && node.childNodes) || [])) supportedNodes(c, acc);
  return acc;
}

function linkName(el) {
  let name = clean(el.innerText || el.textContent);
  const { nodes, unsupported } = supportedNodes(el);
  if (!name || unsupported) {
    const f = { texts: [] };
    for (const n of nodes) {
      if (n.getAttribute) {
        f.alt = f.alt || clean(n.getAttribute("alt"));
        f.title = f.title || clean(n.getAttribute("title"));
        f.inputValue = f.inputValue || (n.tagName === "INPUT" ? clean(n.getAttribute("value")) : "");
        f.imgSrc = f.imgSrc || (n.tagName === "IMG" ? clean(n.getAttribute("src")) : "");
        f.ariaLabel = f.ariaLabel || clean(n.getAttribute("aria-label"));
        f.name = f.name || clean(n.getAttribute("name"));
      }
      if (n.nodeValue) f.texts.push(n.nodeValue);
    }
    name = clean(f.texts.join("")) || f.alt || f.title || f.inputValue || f.imgSrc || f.ariaLabel || f.name;
  }
  return name || "";
}

function linkRegion(el) {
  let n = el.parentNode;
  while (n) {
    const r = clean(n.id || (n.role === "region" && n["aria-label"]) || (n.nodeName && LANDMARK.test(n.nodeName) ? n.nodeName : ""));
    if (r) return r;
    n = n.parentNode;
  }
  return "BODY";
}

function linkType(win, qualifier, url, el) {
  if (!url) return "other";
  if (el && el.download) return "download";
  if (qualifier && new RegExp(qualifier).test(stripQueryHash(url).toLowerCase())) return "download";
  const host = win.location && win.location.hostname && win.location.hostname.toLowerCase();
  if (host && stripQueryHash(url).toLowerCase().indexOf(host) < 0) return "exit";
  return "other";
}

/**
 * Install the collector.
 * @param {{ document: Document, window?: Window, enqueue: (evt: object) => void, config?: object, collectInteraction?: (target: Element) => { metas: object[], label?: string, token?: string, viewName?: string }, getPageName?: () => string | undefined }} deps
 * @returns {() => void} uninstall
 */
export function installLinkClickCollection({ document: doc, window: win = globalThis.window, enqueue, config = {}, collectInteraction, getPageName }) {
  if (!doc || typeof doc.addEventListener !== "function") return () => {};
  const cc = { internalLinkEnabled: true, externalLinkEnabled: true, downloadLinkEnabled: true, ...(config.clickCollection || {}) };
  const qualifier = typeof config.downloadLinkQualifier === "string" ? config.downloadLinkQualifier : DEFAULT_DOWNLOAD_QUALIFIER;
  const listener = (event) => {
    try {
      if (event.s_fe) return;
      const target = typeof event.composedPath === "function" && event.composedPath().length > 0 ? event.composedPath()[0] : event.target;
      if (!target) return;
      if (doc.getElementById && doc.getElementById("cppXYctnr")) return;
      // Stock builds ONE event per click: the link click and the proposition interact are merged into it.
      const interaction = collectInteraction ? collectInteraction(target) : null;
      const interact = interaction && interaction.metas.length ? interactNotificationXdm(interaction) : null;
      const link = linkClick(target);
      if (link && interact) {
        const { web: interactWeb, ...rest } = interact;
        enqueue({ event: "page_view", xdm: { ...link.xdm, ...rest, web: { ...link.xdm.web, ...(interactWeb || {}) } }, data: link.data });
      } else if (link) enqueue({ event: "page_view", ...link });
      else if (interact) enqueue({ event: "page_view", xdm: interact });
    } catch (e) { /* click collection must never break the page */ }
  };
  const linkClick = (target) => {
      const el = findClickable(target);
      if (!el) return null;
      const url = (() => { try { return new URL(el.href || "", win.location.href).href; } catch (e) { return win.location.href; } })();
      const type = linkType(win, qualifier, url, el);
      const name = linkName(el);
      const region = linkRegion(el);
      if (!url || !type || !name || !region) return null;
      if ((type === "download" && !cc.downloadLinkEnabled) || (type === "exit" && !cc.externalLinkEnabled) || (type === "other" && !cc.internalLinkEnabled)) return null;
      const remembered = getPageName && getPageName();
      return {
        xdm: { eventType: "web.webinteraction.linkClicks", web: { webInteraction: { name, region, type, URL: url, linkClicks: { value: 1 } } } },
        data: { __adobe: { analytics: { contextData: { a: { activitymap: { page: remembered || win.location.href, link: name, region, pageIDType: remembered ? 1 : 0 } } } } } },
      };
  };
  doc.addEventListener("click", listener, true);
  return () => doc.removeEventListener("click", listener, true);
}
