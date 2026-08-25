/* Alloy-in-worker spike — classic Web Worker.
 * Installs instrumented shim globals, boots the stock Alloy standalone bundle,
 * configures it with context:[] (no ambient collection) and renderDecisions:false
 * (headless personalization), then sends one event. Every global access is logged
 * so we can see where Alloy first needs synchronous document.cookie / storage. */

/* eslint-disable */
const summary = {
  booted: false,
  configureSettled: null,
  sendEventSettled: null,
  cookie: { reads: 0, writes: 0, firstRead: null, firstWrite: null, writeBacks: [] },
  storage: { session: 0, local: 0 },
  fetchCalls: [],
  unstubbed: {}, // prop -> count, the globals Alloy touched that we did not explicitly stub
};

function post(type, payload) { self.postMessage({ type, ...payload }); }
function log(op, detail) { post("log", { entry: { t: Date.now(), op, detail } }); }
function noteUnstubbed(kind, prop) {
  const key = kind + "." + String(prop);
  summary.unstubbed[key] = (summary.unstubbed[key] || 0) + 1;
  if (summary.unstubbed[key] <= 2) log("unstubbed", { access: key });
}
function shortStack() {
  return (new Error().stack || "").split("\n").slice(3, 8).map((l) => l.trim());
}

/* ---- synchronous cookie cache (seeded from the main thread) ---- */
let cookieJar = "";
function getCookie() {
  summary.cookie.reads++;
  const stack = shortStack();
  if (!summary.cookie.firstRead) summary.cookie.firstRead = { value: cookieJar, stack };
  log("cookie.get", { value: cookieJar, stack });
  return cookieJar;
}
function setCookie(v) {
  summary.cookie.writes++;
  const raw = String(v);
  const stack = shortStack();
  if (!summary.cookie.firstWrite) summary.cookie.firstWrite = { value: raw, stack };
  try {
    const name = raw.split("=")[0].trim();
    const firstPair = raw.split(";")[0];
    const pairs = cookieJar ? cookieJar.split("; ").filter((p) => p.split("=")[0].trim() !== name) : [];
    pairs.push(firstPair);
    cookieJar = pairs.join("; ");
  } catch (e) {}
  summary.cookie.writeBacks.push(raw);
  log("cookie.set", { value: raw, stack });
  post("cookie-writeback", { value: raw }); // async write-back to real document.cookie
}

/* ---- storage shim (synchronous, in-memory) ---- */
function makeStorage(label) {
  const m = new Map();
  const api = {
    getItem: (k) => { summary.storage[label]++; log(label + "Storage.getItem", { k }); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { summary.storage[label]++; log(label + "Storage.setItem", { k }); m.set(k, String(v)); },
    removeItem: (k) => { log(label + "Storage.removeItem", { k }); m.delete(k); },
    clear: () => { log(label + "Storage.clear", {}); m.clear(); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return new Proxy(api, {
    get(t, p) { if (p in t) return t[p]; return m.get(p); },
    set(t, p, v) { m.set(p, String(v)); return true; },
  });
}

/* ---- element / node stub ---- */
function makeEl(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(), style: {}, dataset: {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; },
    cloneNode() { return makeEl(tag); }, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, remove() {},
    setAttributeNS() {}, contains() { return false; }, classList: { add() {}, remove() {}, contains() { return false; } },
    childNodes: [], children: [], parentNode: null, firstChild: null,
  };
  return el;
}

/* ---- document shim ---- */
const docBack = {
  referrer: "", title: "spike", visibilityState: "visible", hidden: false, readyState: "complete",
  documentElement: makeEl("html"), head: makeEl("head"), body: makeEl("body"),
  location: null,
  createElement: (tag) => { log("document.createElement", { tag }); return makeEl(tag); },
  createElementNS: (ns, tag) => makeEl(tag),
  createDocumentFragment: () => makeEl("#fragment"),
  createTextNode: () => ({ nodeType: 3 }),
  getElementsByTagName: () => [], getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: (type) => log("document.addEventListener", { type }),
  removeEventListener: () => {}, dispatchEvent: () => true,
};
const documentShim = new Proxy(docBack, {
  get(t, p) {
    if (p === "cookie") return getCookie();
    if (p in t) return t[p];
    noteUnstubbed("document", p);
    return undefined;
  },
  set(t, p, v) { if (p === "cookie") { setCookie(v); return true; } t[p] = v; return true; },
});

const locationShim = {
  href: "https://spike.example/", origin: "https://spike.example", protocol: "https:",
  host: "spike.example", hostname: "spike.example", port: "", pathname: "/", search: "", hash: "",
  toString() { return this.href; },
};
docBack.location = locationShim;

/* ---- navigator shim (WorkerNavigator lacks sendBeacon etc.) ---- */
const navBack = {
  userAgent: (self.navigator && self.navigator.userAgent) || "spike-worker",
  language: "en-US", languages: ["en-US"], cookieEnabled: true, onLine: true, doNotTrack: null,
  sendBeacon: (url) => { log("navigator.sendBeacon", { url }); summary.fetchCalls.push({ via: "sendBeacon", url }); return true; },
};
const navigatorShim = new Proxy(navBack, {
  get(t, p) {
    if (p in t) return t[p];
    try { const r = self.navigator && self.navigator[p]; if (r !== undefined) return typeof r === "function" ? r.bind(self.navigator) : r; } catch (e) {}
    noteUnstubbed("navigator", p);
    return undefined;
  },
});

/* ---- fetch shim: log and return a minimal Edge response so identity can flow ---- */
const realFetch = self.fetch.bind(self);
self.fetch = (url, opts) => {
  const u = String(typeof url === "object" && url ? url.url : url);
  let body = opts && opts.body;
  try { if (typeof body === "string" && body.length < 4000) body = JSON.parse(body); } catch (e) {}
  const rec = { via: "fetch", url: u, keepalive: !!(opts && opts.keepalive), body };
  summary.fetchCalls.push(rec);
  log("fetch", { url: u, keepalive: rec.keepalive });
  const fake = {
    requestId: "spike-req",
    handle: [
      { type: "identity:result", payload: [{ id: "SPIKE-ECID-0123456789", namespace: { code: "ECID" } }] },
      { type: "state:store", payload: [{ key: "kndctr_SPIKE_identity", value: "spike-store", maxAge: 34128000 }] },
    ],
  };
  return Promise.resolve(new Response(JSON.stringify(fake), { status: 200, headers: { "content-type": "application/json" } }));
};

/* ---- window shim ---- */
const winBack = {
  __alloyNS: ["alloy"],
  document: documentShim, location: locationShim, navigator: navigatorShim,
  screen: { width: 1280, height: 800, availWidth: 1280, availHeight: 800, colorDepth: 24, pixelDepth: 24, orientation: { type: "landscape-primary", angle: 0 } },
  innerWidth: 1280, innerHeight: 800, outerWidth: 1280, outerHeight: 800, devicePixelRatio: 1, screenX: 0, screenY: 0,
  Intl: self.Intl, Promise, Object, Array, JSON, Math, Date, Error, RegExp, Map, Set, WeakMap, Symbol,
  setTimeout: (...a) => self.setTimeout(...a), clearTimeout: (...a) => self.clearTimeout(...a),
  setInterval: (...a) => self.setInterval(...a), clearInterval: (...a) => self.clearInterval(...a),
  queueMicrotask: (...a) => self.queueMicrotask(...a),
  requestAnimationFrame: (cb) => self.setTimeout(() => cb(Date.now()), 16), cancelAnimationFrame: (id) => self.clearTimeout(id),
  addEventListener: (type) => log("window.addEventListener", { type }), removeEventListener: () => {}, dispatchEvent: () => true,
  fetch: self.fetch, performance: self.performance, crypto: self.crypto,
  atob: self.atob ? self.atob.bind(self) : undefined, btoa: self.btoa ? self.btoa.bind(self) : undefined,
  TextEncoder, TextDecoder, URL, URLSearchParams,
  localStorage: makeStorage("local"), sessionStorage: makeStorage("session"),
  matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
  IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  Event: class { constructor(t) { this.type = t; } },
};
const windowShim = new Proxy(winBack, {
  get(t, p) {
    if (p in t) return t[p];
    if (typeof self[p] !== "undefined") return typeof self[p] === "function" ? self[p].bind(self) : self[p];
    noteUnstubbed("window", p);
    return undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
winBack.window = windowShim; winBack.self = windowShim; winBack.top = windowShim; winBack.parent = windowShim; winBack.globalThis = windowShim;

/* ---- install globals on the worker scope ---- */
function install(seedCookie) {
  cookieJar = seedCookie || "";
  self.window = windowShim;
  self.document = documentShim;
  try { self.screen = winBack.screen; } catch (e) {}
  try { self.sessionStorage = winBack.sessionStorage; } catch (e) {}
  try { self.localStorage = winBack.localStorage; } catch (e) {}
  try { self.MutationObserver = winBack.MutationObserver; } catch (e) {}
  try { self.getComputedStyle = winBack.getComputedStyle; } catch (e) {}
  try { self.matchMedia = winBack.matchMedia; } catch (e) {}
  // base-code queue snippet, matching Alloy's real snippet: each call returns a
  // Promise and pushes [resolve, reject, arguments]; initializeStandalone swaps
  // q.push for its executor, which destructures exactly that shape.
  self.alloy = function () {
    const args = arguments;
    return new Promise((resolve, reject) => {
      (self.alloy.q = self.alloy.q || []).push([resolve, reject, args]);
    });
  };
  self.alloy.q = self.alloy.q || [];
  winBack.alloy = self.alloy;
  winBack.__alloyNS = self.__alloyNS = ["alloy"];
}

async function run(seedCookie) {
  try {
    install(seedCookie);
    post("phase", { name: "install", detail: "shims installed" });

    post("phase", { name: "importScripts", detail: "loading dist/alloy.js" });
    self.importScripts("/node_modules/@adobe/alloy/dist/alloy.js");
    summary.booted = true;
    post("phase", { name: "loaded", detail: "alloy bundle evaluated without throwing" });

    const alloy = self.alloy;
    post("phase", { name: "configure" });
    await alloy("configure", {
      datastreamId: "00000000-0000-0000-0000-000000000000",
      orgId: "SPIKE@AdobeOrg",
      context: [],
      debugEnabled: true,
    }).then(
      () => { summary.configureSettled = "fulfilled"; },
      (e) => { summary.configureSettled = "rejected: " + (e && e.message); },
    );
    log("configure.settled", { state: summary.configureSettled });

    post("phase", { name: "sendEvent" });
    await alloy("sendEvent", {
      renderDecisions: false,
      xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { URL: "https://spike.example/", name: "spike" } } },
    }).then(
      () => { summary.sendEventSettled = "fulfilled"; },
      (e) => { summary.sendEventSettled = "rejected: " + (e && e.message); },
    );
    log("sendEvent.settled", { state: summary.sendEventSettled });

    post("done", { summary });
  } catch (err) {
    post("fatal", { phase: summary.booted ? "post-load" : "load", message: err && err.message, stack: (err && err.stack) || "" });
    post("done", { summary });
  }
}

self.onmessage = (e) => { if (e.data && e.data.type === "init") run(e.data.cookie); };
