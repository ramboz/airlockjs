/**
 * 051-06 deployable opt-in browser entry. No eager import, config fetch, console
 * output, credential access, SDK renderer, or arbitrary vendor URL.
 * Counts are exported-call submissions, NOT transport completion/product receipt.
 */
const CASES = ["positive", "no-offer", "non-render", "no-consent"];
const METHODS = ["initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent",
  "pushEventToDataLayer", "martechLazy", "martechDelayed"];
const LINK = "web.webinteraction.linkClicks";
const HTML_SCHEMA = "https://ns.adobe.com/personalization/html-content-item";
const PINS = {
  aemMartech: "1aa3dee3c4791636efa9ad2994342f861c8e149b",
  alloy: "7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8",
  acdl: "c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c",
};
let claimed = false;

function fields(value, required, optional = []) {
  if (!value || typeof value !== "object"
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw "invalid_input";
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string" || ![...required, ...optional].includes(key)
      || !Object.hasOwn(descriptors[key], "value"))
      || required.some(key => !Object.hasOwn(descriptors, key))) throw "invalid_input";
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

function bounded(value, max = 100) {
  return typeof value === "string" && value.length > 0 && value.length <= max
    && ![...value].some(char => {
      const n = char.charCodeAt(0);
      return n <= 32 || (n >= 127 && n <= 159);
    });
}

function canonicalOrigin(value) {
  if (typeof value !== "string") return false;
  const u = new URL(value);
  return u.protocol === "https:" && u.origin === value && !u.username && !u.password && !u.port
    && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]+$/.test(u.hostname);
}

/** Pure predicate for the site's pre-config-fetch bootstrap guard. */
export function isOptIn(value, allowedOrigin) {
  try {
    if (!canonicalOrigin(allowedOrigin) || typeof value !== "string") return false;
    const u = new URL(value);
    if (u.origin !== allowedOrigin || u.pathname !== "/" || value.includes("#") || u.username || u.password
        || !value.startsWith(`${allowedOrigin}/?`)) return false;
    const parts = u.search.slice(1).split("&");
    if (parts.length !== 4 || new Set(parts.map(p => p.split("=")[0])).size !== 4) return false;
    return parts.every(p => p === "airlock-stock=v1" || p === "consent=decline"
      || /^case=(positive|no-offer|non-render|no-consent)$/.test(p)
      || /^run=airlock05102-[a-f0-9]{32}$/.test(p));
  } catch { return false; }
}

/** Closed public config. Enabled/current window required; no SDK overrides. */
export function validateConfig(value, nowMs = Date.now()) {
  try {
    const c = fields(value, ["schema_version", "enabled", "allowedOrigin", "allowedPath",
      "orgId", "datastreamId", "decisionScope", "windowStart", "windowEnd",
      "expectedOfferHashes", "vendorPin"], ["publicAssetPins"]);
    if (c.schema_version !== 1 || c.enabled !== true || !canonicalOrigin(c.allowedOrigin)
        || c.allowedPath !== "/" || !bounded(c.orgId) || !bounded(c.datastreamId)
        || typeof c.decisionScope !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(c.decisionScope)
        || Object.hasOwn(Object.prototype, c.decisionScope)
        || ["target-global-mbox", "prototype"].includes(c.decisionScope)
        || c.vendorPin !== "alloy-2.31.1" || !Number.isFinite(nowMs)) return false;
    const timestamp = t => typeof t === "string"
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)
      && new Date(t).toISOString() === t;
    if (!timestamp(c.windowStart) || !timestamp(c.windowEnd)
        || Date.parse(c.windowStart) > nowMs || Date.parse(c.windowEnd) <= nowMs) return false;
    const h = c.expectedOfferHashes;
    if (!Array.isArray(h) || h.length < 1 || h.length > 2
        || Reflect.ownKeys(h).length !== h.length + 1
        || [...Array(h.length).keys()].some(i => {
          const d = Object.getOwnPropertyDescriptor(h, String(i));
          return !d || !Object.hasOwn(d, "value") || typeof d.value !== "string"
            || !/^[a-f0-9]{64}$/.test(d.value);
        }) || new Set(h).size !== h.length) return false;
    if (Object.hasOwn(c, "publicAssetPins")) {
      const pins = fields(c.publicAssetPins, Object.keys(PINS));
      if (Object.keys(PINS).some(key => pins[key] !== PINS[key])) return false;
    }
    return true;
  } catch { return false; }
}

function freeze(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === "object") freeze(child);
  });
  return Object.freeze(value);
}

function report(caseName = "invalid", overall = "notEligible") {
  return {
    kind: "airlock.adobe-stock.site-report", schema_version: 1, case: caseName, overall,
    phases: { eager: "not_started", lazy: "not_started", delayed: "not_started" },
    counts: { initializations: 0, consent_updates: 0, attempted_collection: 0, blocked_collection: 0,
      fetch_submissions: 0, page_submissions: 0, custom_submissions: 0, display_submissions: 0,
      interaction_submissions: 0, qualified_propositions: 0, render_confirmed: 0, click_confirmed: 0 },
    claims: { downstream_receipt_verified: false, deployment_verified: false,
      vendor_consent_enforcement_verified: false },
  };
}

function dataField(value, key) {
  if (!value || typeof value !== "object") throw "invalid_proposition";
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !Object.hasOwn(d, "value")) throw "invalid_proposition";
  return d.value;
}

// Only original plain, bounded data may travel back to the SDK as scopeDetails.
function plainData(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 100 || depth > 6) throw "invalid_proposition";
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value === "string" && value.length <= 500) return;
  if (!value || typeof value !== "object"
      || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value)))
    throw "invalid_proposition";
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || Object.hasOwn(Object.prototype, key) || key === "prototype")
      throw "invalid_proposition";
    plainData(dataField(value, key), depth + 1, budget);
  }
}

async function qualify(response, c, caseName) {
  const propositions = dataField(response, "propositions");
  if (!Array.isArray(propositions)) throw "invalid_proposition";
  if (caseName === "no-offer") {
    if (propositions.length) throw "invalid_proposition";
    return null;
  }
  if (propositions.length !== 1) throw "invalid_proposition";
  const p = dataField(propositions, "0");
  const id = dataField(p, "id");
  const scope = dataField(p, "scope");
  const scopeDetails = dataField(p, "scopeDetails");
  const items = dataField(p, "items");
  plainData(scopeDetails);
  if (!bounded(id, 250) || scope !== c.decisionScope
      || dataField(scopeDetails, "decisionProvider") !== "TGT"
      || !Array.isArray(items) || items.length !== 1) throw "invalid_proposition";
  const item = dataField(items, "0");
  const html = dataField(dataField(item, "data"), "content");
  if (!bounded(dataField(item, "id"), 250) || dataField(item, "schema") !== HTML_SCHEMA
      || typeof html !== "string" || !html.length || html.length > 4096) throw "invalid_proposition";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
  const hash = [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
  if (!c.expectedOfferHashes.includes(hash)) throw "invalid_proposition";
  // Reject active/unknown markup BEFORE parsing: even a detached parser can load images.
  const tags = html.match(/<[^>]*>/g) ?? [];
  if (!tags.length || html.replace(/<[^>]*>/g, "").includes("<")
      || tags.some(tag => !/^<(?:div|p|button(?: type="button")?|span(?: data-airlock-readiness="[A-Za-z0-9_-]{1,100}")?)>$/.test(tag)
        && !/^<\/(?:div|p|button|span)>$/.test(tag))) throw "invalid_proposition";
  let parsed;
  try { parsed = new DOMParser().parseFromString(html, "text/html"); }
  catch { throw "invalid_proposition"; }
  let nodes = 0;
  function safe(node, depth = 0) {
    if (++nodes > 40 || depth > 5) throw "invalid_proposition";
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE || !["DIV", "P", "BUTTON", "SPAN"].includes(node.tagName)
        || [...node.attributes].some(a =>
          !(node.tagName === "BUTTON" && a.name === "type" && a.value === "button")
          && !(node.tagName === "SPAN" && a.name === "data-airlock-readiness"
            && /^[A-Za-z0-9_-]{1,100}$/.test(a.value))))
      throw "invalid_proposition";
    if (node.tagName === "SPAN") node.removeAttribute("data-airlock-readiness");
    [...node.childNodes].forEach(child => safe(child, depth + 1));
  }
  if (!parsed.body.children.length) throw "invalid_proposition";
  [...parsed.body.childNodes].forEach(node => safe(node));
  return { identity: { id, scope, scopeDetails }, html, nodes: [...parsed.body.childNodes] };
}

function visible(slot) {
  if (!slot.isConnected || !slot.getClientRects().length) return false;
  const rect = slot.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0
      || rect.top >= innerHeight || rect.left >= innerWidth) return false;
  for (let node = slot; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0)
      return false;
  }
  function intersectsVisibleArea(node) {
    const box = node.getBoundingClientRect();
    let left = Math.max(0, box.left);
    let right = Math.min(innerWidth, box.right);
    let top = Math.max(0, box.top);
    let bottom = Math.min(innerHeight, box.bottom);
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clips = value => ["hidden", "clip", "auto", "scroll"].includes(value);
      const clipX = ancestor === slot || clips(style.overflowX);
      const clipY = ancestor === slot || clips(style.overflowY);
      if (!clipX && !clipY) continue;
      const bounds = ancestor.getBoundingClientRect();
      // Client box excludes borders/scrollbars; account for axis scaling in viewport coordinates.
      const scaleX = ancestor.offsetWidth ? bounds.width / ancestor.offsetWidth : 1;
      const scaleY = ancestor.offsetHeight ? bounds.height / ancestor.offsetHeight : 1;
      const clipLeft = bounds.left + ancestor.clientLeft * scaleX;
      const clipTop = bounds.top + ancestor.clientTop * scaleY;
      if (clipX) {
        left = Math.max(left, clipLeft);
        right = Math.min(right, clipLeft + ancestor.clientWidth * scaleX);
      }
      if (clipY) {
        top = Math.max(top, clipTop);
        bottom = Math.min(bottom, clipTop + ancestor.clientHeight * scaleY);
      }
    }
    return right > left && bottom > top;
  }
  function descendantsVisible(parent) {
    return [...parent.children].every(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden && style.display !== "none" && style.visibility === "visible"
        && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0
        && intersectsVisibleArea(node) && descendantsVisible(node);
    });
  }
  return descendantsVisible(slot);
}

/**
 * Call phase wrappers at the original site's corresponding phase seams.
 * getObservation() is PRIVATE in-memory runner evidence; never log/commit it.
 */
export function createStockEntry(input) {
  let o;
  let c;
  let caseName;
  let clock;
  try {
    o = fields(input, ["config", "runnerConsent"], ["slot", "loadIntegration", "clock"]);
    clock = o.clock ?? {
      now: Date.now,
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: timer => window.clearTimeout(timer),
    };
    const funcs = fields(clock, ["now", "setTimeout", "clearTimeout"]);
    if (Object.values(funcs).some(fn => typeof fn !== "function")
        || !validateConfig(o.config, clock.now())) throw "invalid_input";
    c = structuredClone(o.config);
    if (!isOptIn(location.href, c.allowedOrigin)) throw "invalid_input";
    caseName = new URL(location.href).searchParams.get("case");
    if (!CASES.includes(caseName)
        || o.runnerConsent !== (caseName === "no-consent" ? "deny" : "grant")
        || (Object.hasOwn(o, "loadIntegration") && typeof o.loadIntegration !== "function")
        || (Object.hasOwn(o, "slot") && (!(o.slot instanceof HTMLDivElement)
          || !o.slot.isConnected || o.slot.childNodes.length))) throw "invalid_input";
  } catch {
    const invalid = freeze(report());
    return Object.freeze({ eager: async () => invalid, lazy: async () => invalid,
      delayed: async () => invalid, ready: false, result: invalid, getObservation: () => null });
  }
  if (claimed) {
    const duplicate = freeze(report(caseName, "duplicate_entry"));
    return Object.freeze({ eager: async () => duplicate, lazy: async () => duplicate,
      delayed: async () => duplicate, ready: false, result: duplicate, getObservation: () => null });
  }
  claimed = true;
  const out = report(caseName, "pending");
  const counts = out.counts;
  const raw = { pageName: `${new URL(location.href).searchParams.get("run")}-${caseName}-1-page`,
    customName: `${new URL(location.href).searchParams.get("run")}-${caseName}-1-custom`,
    response: null, identity: null, qualifiedHTML: null, renderedHTML: null };
  const pageUrl = location.href;
  const load = o.loadIntegration ?? (() => import("./vendor/aem-martech/index.js"));
  let integration;
  let qualified;
  let slot;
  let button;
  let clickCleanup;
  let ready = false;
  let stopped = false;
  let nextPhase = 0;
  let running = false;
  let deadline = Date.parse(c.windowEnd);
  const granted = caseName !== "no-consent";
  const personalization = { defaultPersonalizationEnabled: false, sendDisplayEvent: false };
  const snapshot = () => freeze(structuredClone(out));

  function check() {
    if (stopped) throw out.overall;
    if (clock.now() >= deadline) throw "timeout";
    if (location.href !== pageUrl) throw "invalid_phase";
  }
  function stop(category) {
    stopped = true; ready = false;
    out.overall = ["timeout", "invalid_phase", "integration_rejected", "invalid_contract",
      "invalid_proposition", "render_unconfirmed"].includes(category) ? category : "internal_failure";
    if (button) button.disabled = true;
    clickCleanup?.();
  }
  async function call(name, ...args) {
    check();
    try { return await integration[name](...args); }
    catch { throw "integration_rejected"; }
  }
  async function collect(kind, invoke, display = false) {
    check(); counts.attempted_collection++;
    if (!granted) { counts.blocked_collection++; return undefined; }
    counts[`${kind}_submissions`]++;
    if (display) counts.display_submissions++;
    return invoke();
  }
  const decision = event => ({ _experience: { decisioning: {
    propositions: [qualified.identity], propositionEventType: { [event]: 1 },
  } } });

  async function eagerBody() {
    check();
    // Entirely site-owned; no vendor selector/element capability.
    slot = o.slot ?? document.createElement("div");
    slot.id = "airlock-stock-slot";
    Object.assign(slot.style, { width: "320px", height: "180px", minWidth: "320px",
      maxWidth: "320px", minHeight: "180px", maxHeight: "180px", boxSizing: "border-box", overflow: "hidden" });
    if (!o.slot) document.body.append(slot);
    button = document.createElement("button");
    button.id = "airlock-stock-control"; button.type = "button"; button.disabled = true;
    button.textContent = "Airlock synthetic control";
    slot.after(button);
    let module;
    try { module = await load(); } catch { throw "integration_rejected"; }
    check();
    integration = Object.fromEntries(METHODS.map(name => {
      const fn = Object.getOwnPropertyDescriptor(module, name)?.value;
      if (typeof fn !== "function") throw "invalid_contract";
      return [name, fn];
    }));
    counts.initializations++;
    await call("initMartech", {
      orgId: c.orgId, datastreamId: c.datastreamId, edgeDomain: "edge.adobedc.net",
      defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
      idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false,
      autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
    }, {
      analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 1000,
      trackPageView: false, dataLayer: true, includeDataLayerState: false, launchUrls: [],
      alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer",
      decisionScopes: [c.decisionScope], shouldProcessEvent: payload => payload?.event === LINK,
    });
    check(); counts.consent_updates++;
    await call("updateUserConsent", { collect: granted, personalize: granted, marketing: false, share: false });
    const response = await collect("fetch", () => call("sendEvent", {
      type: "decisioning.propositionFetch", renderDecisions: false, decisionScopes: [c.decisionScope],
      personalization, xdm: { web: { webPageDetails: { name: "airlock-stock-v1", URL: pageUrl } } },
    }));
    check();
    raw.response = response ?? null;
    if (granted) {
      try { qualified = await qualify(response, c, caseName); }
      catch { throw "invalid_proposition"; }
      check();
      if (qualified) {
        counts.qualified_propositions++;
        raw.identity = qualified.identity; raw.qualifiedHTML = qualified.html;
      }
      if (caseName === "positive") {
        check();
        slot.replaceChildren(...qualified.nodes.map(node => document.importNode(node, true)));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        check();
        if (!visible(slot)) throw "render_unconfirmed";
        raw.renderedHTML = qualified.html; counts.render_confirmed++;
      }
    }
    await collect("page", () => call("sendAnalyticsEvent", {
      eventType: "web.webpagedetails.pageViews",
      web: { webPageDetails: { name: raw.pageName, URL: pageUrl, pageViews: { value: 1 } } },
      ...(counts.render_confirmed ? decision("display") : {}),
    }, { __adobe: { analytics: { pageName: raw.pageName, pageURL: pageUrl } } }, {}),
    !!counts.render_confirmed);
  }

  async function lazyBody() {
    await call("martechLazy");
    check();
    if (granted) {
      await new Promise(resolve => {
        const clicked = event => {
          if (!event.isTrusted || stopped) return;
          clickCleanup(); ready = false; button.disabled = true;
        };
        clickCleanup = () => { button.removeEventListener("click", clicked); resolve(); };
        button.addEventListener("click", clicked);
        ready = true; button.disabled = false;
      });
      check(); counts.click_confirmed++;
    }
    await collect("custom", () => {
      check();
      let returned;
      try {
        returned = integration.pushEventToDataLayer(LINK, {
          web: { webInteraction: { name: raw.customName, type: "other", linkClicks: { value: 1 } } },
        }, { __adobe: { analytics: { linkType: "o", linkName: raw.customName } } }, {});
      } catch { throw "integration_rejected"; }
      if (returned !== undefined) {
        Promise.resolve(returned).catch(() => {});
        throw "invalid_contract";
      }
    });
    if (counts.render_confirmed || !granted) {
      await collect("interaction", () => call("sendEvent", {
        type: "decisioning.propositionInteract", renderDecisions: false, personalization, xdm: decision("interact"),
      }));
    }
  }

  async function phase(index, name, body) {
    if (stopped) return snapshot();
    if (running || nextPhase !== index) { stop("invalid_phase"); return snapshot(); }
    running = true; out.phases[name] = "running";
    let timer;
    try {
      check();
      if (index === 0) deadline = Math.min(deadline, clock.now() + 30000);
      await Promise.race([
        new Promise((_, reject) => {
          timer = clock.setTimeout(() => {
            stop("timeout"); reject("timeout");
          }, Math.min(10000, deadline - clock.now()));
        }),
        Promise.resolve().then(() => { check(); return body(); }),
      ]);
      check();
      out.phases[name] = "complete"; nextPhase++;
      if (index === 2) out.overall = granted ? "sdk_submission_observed" : "locally_guarded";
    } catch (category) {
      if (!stopped) stop(category);
      out.phases[name] = "failed";
    } finally {
      clock.clearTimeout(timer); running = false;
    }
    return snapshot();
  }

  return Object.freeze({
    eager: () => phase(0, "eager", eagerBody),
    lazy: () => phase(1, "lazy", lazyBody),
    delayed: () => phase(2, "delayed", () => call("martechDelayed")),
    get ready() { return ready && !stopped; },
    get result() { return snapshot(); },
    getObservation: () => raw,
  });
}
