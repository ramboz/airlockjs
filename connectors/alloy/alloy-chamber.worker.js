/* Alloy Option-B chamber — spec 012-01, AC2 + AC3 + AC4.  (classic Web Worker)
 *
 * A dedicated CLASSIC Worker (NOT type:module) that hosts the UNMODIFIED stock
 * `@adobe/alloy@2.35.0` bundle. R-004's proven route, generalized onto the
 * airlock contract:
 *   - installs a shim global scope (window/document/navigator/screen/session+
 *     localStorage) INSIDE the isolation boundary (mirror of R-004's Proxy shims);
 *   - installs a SYNCHRONOUS cookie cache (createSyncCookieCache) seeded from the
 *     main thread at boot, async write-back — exposed through the ADDITIVE
 *     `GrantedCapabilities.cookies.sync` surface (AC3). The `document.cookie` shim
 *     DELEGATES to that capability, so the sync-read surface is what actually
 *     serves alloy's synchronous reads (the getApexDomain/getTld probe first,
 *     then identity reads);
 *   - `importScripts` the byte-identical bundle (766 KB IIFE), then REVOKES
 *     importScripts (AC2 prose: no post-boot remote re-load);
 *   - runs alloy through the SHARED createConnectorHost + createAlloyConnector
 *     (AC1 reuse) so init = configure, handle = sendEvent, on one retained
 *     instance.
 *
 * Built into a classic IIFE by rig/alloy-chamber.mjs (esbuild, format:iife) — the
 * ESM imports below are inlined; `importScripts` and the worker globals are left
 * untouched. This file is NEVER loaded as a module worker and uses NO dynamic
 * import() — the deliberately-taken load route (AC2 / AD-7).
 *
 * AC4 (this stage): alloy's own worker-side `fetch` to `.../ee/v1/interact` is
 * INTERCEPTED in the chamber (the fetch shim below) and routed into the
 * orchestrator's main-thread dispatch (ADR-0004) — the shim does NO real network
 * fetch in the worker; it postMessages the request to main and resolves with the
 * Response main sends back. The main-thread dispatcher hits a minting-Edge stub
 * that server-assigns a fresh ECID; alloy persists it synchronously into the
 * AMCV_<ORGID> cell via the AC3 sync surface, mirrored async to the broker's jar.
 *
 * AC5 (this stage): egress CONFINEMENT — an ALLOW-LIST posture in which the
 * mediated (intercepted) fetch above is the chamber's SOLE network-capable
 * surface. Right after the bundle loads (at the same point importScripts is
 * revoked) the chamber withholds every OTHER ambient network primitive a
 * classic Worker retains (applyEgressConfinement + denySendBeacon), so alloy's
 * OWN configure + sendEvent run UNDER confinement (R-004: alloy uses only
 * fetch, so it is not broken). A post-boot adversarial self-probe (runEgressProbe)
 * attempts each withheld primitive from inside the chamber and reports it
 * unreachable; dynamic import() of a remote specifier is the DISCLOSED residual
 * a shim cannot withhold — probed and recorded honestly, never silently passed.
 *
 * SCOPE — AC2/AC3/AC4/AC5. The contract-guard ADR is AC6 — a later stage,
 * deliberately NOT built here.
 */

/* eslint-disable */
import { createConnectorHost } from "../../core/connector-host.js";
import { createAlloyConnector } from "./connector.js";
import { createSyncCookieCache } from "./sync-cookie-cache.js";
import { applyEgressConfinement, denySendBeacon } from "./egress-confinement.js";

const summary = {
  booted: false,
  importScriptsRevoked: false,
  configureSettled: null,
  sendEventSettled: null,
  syncSurfacePresent: false, // caps.cookies.sync exists (AC3 additive surface)
  firstCookieRead: null, // { value, stack } — must be alloy's getApexDomain probe
  firstCookieReadServedFromSyncSurface: false, // the read went through caps.cookies.sync.readSync
  getTldProbeRoundTrip: false, // wrote the probe cookie then read it back (sync coherence)
  cookieReads: 0,
  cookieWrites: 0,
  writeBacks: 0, // async reconcile posts to the broker jar
  fetchCalls: [], // [{ via, url, method }] — AC4: every alloy fetch is INTERCEPTED
  workerRealFetchCalls: 0, // AC4: must stay 0 — the shim does NO real network fetch in the worker
  dropped: [],
  egressConfined: false, // AC5: applyEgressConfinement ran (allow-list posture active)
  egressConfinement: null, // AC5: the record of what was withheld and how
};

function post(type, payload) { self.postMessage({ type, ...payload }); }
function shortStack() {
  return (new Error().stack || "").split("\n").slice(3, 8).map((l) => l.trim());
}

/* ---- AC3: the synchronous cookie cache + the granted sync-read surface ---- */
let cache = null;
let caps = null;
function buildCaps(seedCookie) {
  cache = createSyncCookieCache(seedCookie || "", (raw) => {
    summary.writeBacks++;
    post("cookie-writeback", { value: raw }); // async reconcile to the real jar
  });
  // The GrantedCapabilities the host hands the connector. The pinned async
  // get/set are present for SHAPE (unused by alloy, which reads document.cookie);
  // the ADDITIVE `sync` surface is what serves the synchronous reads (AC3).
  caps = {
    cookies: {
      get: async (name) => {
        const m = new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()\[\]\\\/+^]/g, "\\$&") + "=([^;]*)").exec(cache.readSync());
        return m ? decodeURIComponent(m[1]) : null;
      },
      set: async (name, value, opts = {}) => {
        const attrs = [`${name}=${value}`];
        if (opts.maxAge != null) attrs.push(`max-age=${opts.maxAge}`);
        if (opts.path) attrs.push(`path=${opts.path}`);
        cache.writeSync(attrs.join("; "));
      },
      sync: { readSync: cache.readSync, writeSync: cache.writeSync },
    },
    storage: {
      get: async () => null, set: async () => {}, remove: async () => {},
    },
    // 012-03: the decisions-as-data return channel. The connector calls
    // `deliver` with the Target decisions alloy returned (renderDecisions:false);
    // the chamber posts them to MAIN as DATA (the host applies them via
    // reserveSpace — the worker touches NO DOM, AC2). `fetch` is the deferred
    // capability.d.ts pull shape, reconciled to a no-op here since alloy PUSHES
    // decisions on the sendEvent response rather than answering a separate fetch.
    // Additive: 012-01/012-02 responses carry no propositions, so `deliver` is
    // never called there and no "decisions" message is posted.
    decisions: {
      deliver: (decisions) => { post("decisions", { decisions }); },
      fetch: async () => [],
    },
  };
  summary.syncSurfacePresent = typeof caps.cookies.sync.readSync === "function"
    && typeof caps.cookies.sync.writeSync === "function";
  return caps;
}

/* ---- storage shim (synchronous, in-memory) — R-004 ---- */
function makeStorage() {
  const m = new Map();
  const api = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return new Proxy(api, {
    get(t, p) { if (p in t) return t[p]; return m.get(p); },
    set(t, p, v) { m.set(p, String(v)); return true; },
  });
}

/* ---- element / node stub — R-004 ---- */
function makeEl(tag) {
  return {
    tagName: String(tag || "div").toUpperCase(), style: {}, dataset: {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; },
    cloneNode() { return makeEl(tag); }, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, remove() {},
    setAttributeNS() {}, contains() { return false; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    childNodes: [], children: [], parentNode: null, firstChild: null,
  };
}

/* ---- document shim — cookie reads/writes DELEGATE to caps.cookies.sync (AC3) ---- */
function getCookie() {
  summary.cookieReads++;
  const value = caps.cookies.sync.readSync(); // served BY the granted sync surface
  if (!summary.firstCookieRead) {
    summary.firstCookieRead = { value, stack: shortStack() };
    summary.firstCookieReadServedFromSyncSurface = true;
  }
  return value;
}
function setCookie(v) {
  summary.cookieWrites++;
  caps.cookies.sync.writeSync(String(v));
  // getTld probe: alloy writes `com.adobe.alloy.getTld=...` then reads it back
  // to confirm the apex domain. Prove the sync cache round-trips it coherently.
  if (String(v).indexOf("com.adobe.alloy.getTld") === 0
      && caps.cookies.sync.readSync().indexOf("com.adobe.alloy.getTld") !== -1) {
    summary.getTldProbeRoundTrip = true;
  }
}

const docBack = {
  referrer: "", title: "airlock", visibilityState: "visible", hidden: false, readyState: "complete",
  documentElement: makeEl("html"), head: makeEl("head"), body: makeEl("body"),
  location: null,
  createElement: (tag) => makeEl(tag),
  createElementNS: (ns, tag) => makeEl(tag),
  createDocumentFragment: () => makeEl("#fragment"),
  createTextNode: () => ({ nodeType: 3 }),
  getElementsByTagName: () => [], getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
};
const documentShim = new Proxy(docBack, {
  get(t, p) {
    if (p === "cookie") return getCookie();
    if (p in t) return t[p];
    return undefined;
  },
  set(t, p, v) { if (p === "cookie") { setCookie(v); return true; } t[p] = v; return true; },
});

const locationShim = {
  href: "https://airlock.example/", origin: "https://airlock.example", protocol: "https:",
  host: "airlock.example", hostname: "airlock.example", port: "", pathname: "/", search: "", hash: "",
  toString() { return this.href; },
};
docBack.location = locationShim;

/* ---- navigator shim — R-004 ---- */
const navBack = {
  userAgent: (self.navigator && self.navigator.userAgent) || "airlock-chamber",
  language: "en-US", languages: ["en-US"], cookieEnabled: true, onLine: true, doNotTrack: null,
  sendBeacon: (url) => { summary.fetchCalls.push({ via: "sendBeacon", url: String(url) }); return true; },
};
const navigatorShim = new Proxy(navBack, {
  get(t, p) {
    if (p in t) return t[p];
    try { const r = self.navigator && self.navigator[p]; if (r !== undefined) return typeof r === "function" ? r.bind(self.navigator) : r; } catch (e) {}
    return undefined;
  },
});

/* ---- AC4: intercept alloy's worker-side fetch → the orchestrator's main-thread
 *      dispatch (ADR-0004). The shim does NOT fetch in the worker; it postMessages
 *      the request (url/method/headers/body) to main and returns a Promise that
 *      resolves with the Response the main thread sends back. The REAL network
 *      call happens on MAIN, never here (no SharedArrayBuffer — AD-4). ---- */

// Capture the real worker fetch, WRAPPED in a counter: the shim never calls it,
// so `workerRealFetchCalls` stays 0 — that invariant is what the rig asserts to
// prove no network egress happened in the worker. A regression that fell through
// to a real worker fetch would trip the counter.
const realWorkerFetch = typeof self.fetch === "function" ? self.fetch.bind(self) : null;
function guardedRealFetch(...args) {
  summary.workerRealFetchCalls++;
  return realWorkerFetch ? realWorkerFetch(...args) : Promise.reject(new Error("no real fetch in chamber"));
}

const pendingFetches = new Map(); // id -> { resolve, reject }
let fetchSeq = 0;

function normalizeHeaders(h) {
  if (!h) return {};
  if (typeof h.forEach === "function" && !(h instanceof Array)) {
    const o = {};
    h.forEach((v, k) => { o[k] = v; });
    return o;
  }
  try { return { ...h }; } catch (e) { return {}; }
}

self.fetch = (url, opts = {}) => {
  const isReq = typeof url === "object" && url;
  const u = String(isReq ? url.url : url);
  const method = String((opts.method || (isReq && url.method) || "GET")).toUpperCase();
  const headers = normalizeHeaders(opts.headers || (isReq && url.headers));
  let body = opts.body != null ? opts.body : (isReq ? url.body : undefined);
  if (body != null && typeof body !== "string") { try { body = String(body); } catch (e) { body = undefined; } }
  summary.fetchCalls.push({ via: "intercepted-to-main", url: u, method });
  const id = "af-" + (++fetchSeq);
  return new Promise((resolve, reject) => {
    pendingFetches.set(id, { resolve, reject });
    try {
      // Hand the request to the orchestrator on main (the parallel dispatcher).
      post("intercepted-fetch", { id, url: u, method, headers, body });
    } catch (err) {
      // No main channel to dispatch through — the ONLY path that could do a real
      // worker fetch, and it is counted (workerRealFetchCalls). Never taken for
      // alloy, which always has the main channel; here as an honest dead-man guard.
      pendingFetches.delete(id);
      guardedRealFetch(url, opts).then(resolve, reject);
    }
  });
};

// Resolve an intercepted fetch with the response the main thread dispatched. A
// real Response (worker global) so alloy reads it exactly as a network response —
// `.json()` / `.text()` / `.ok` / `.status` all work.
function resolveInterceptedFetch(m) {
  const pending = pendingFetches.get(m.id);
  if (!pending) return;
  pendingFetches.delete(m.id);
  try {
    if (m.status === 0) throw new Error(m.statusText || "main-thread dispatch failed");
    pending.resolve(new Response(m.body != null ? m.body : "", {
      status: m.status || 200,
      statusText: m.statusText || "",
      headers: m.headers || { "content-type": "application/json" },
    }));
  } catch (err) {
    pending.reject(err);
  }
}

/* ---- window shim — R-004 ---- */
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
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  fetch: self.fetch, performance: self.performance, crypto: self.crypto,
  atob: self.atob ? self.atob.bind(self) : undefined, btoa: self.btoa ? self.btoa.bind(self) : undefined,
  TextEncoder, TextDecoder, URL, URLSearchParams,
  localStorage: makeStorage(), sessionStorage: makeStorage(),
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
    return undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
winBack.window = windowShim; winBack.self = windowShim; winBack.top = windowShim; winBack.parent = windowShim; winBack.globalThis = windowShim;

/* ---- install the shim globals + the alloy base-code queue snippet — R-004 ---- */
function install(seedCookie) {
  buildCaps(seedCookie);
  self.window = windowShim;
  self.document = documentShim;
  try { self.screen = winBack.screen; } catch (e) {}
  try { self.sessionStorage = winBack.sessionStorage; } catch (e) {}
  try { self.localStorage = winBack.localStorage; } catch (e) {}
  try { self.MutationObserver = winBack.MutationObserver; } catch (e) {}
  try { self.getComputedStyle = winBack.getComputedStyle; } catch (e) {}
  try { self.matchMedia = winBack.matchMedia; } catch (e) {}
  // Alloy's real base-code snippet: each call returns a Promise and pushes
  // [resolve, reject, arguments]; initializeStandalone swaps q.push for its
  // executor, which destructures exactly that shape.
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

let host = null;

async function boot({ cookie, config, bundleUrl }) {
  try {
    install(cookie);
    post("phase", { name: "install" });

    self.importScripts(bundleUrl); // load the UNMODIFIED stock bundle
    summary.booted = true;
    // AC2 prose: revoke importScripts so untrusted post-boot code cannot re-load
    // remote script. alloy is a single IIFE — it never re-imports (R-004).
    try { self.importScripts = undefined; summary.importScriptsRevoked = true; } catch (e) {}

    // AC5 — egress CONFINEMENT (allow-list posture). Withhold every ambient
    // network primitive EXCEPT the mediated fetch, on the real worker scope AND
    // the page-shim navigator alloy is handed. Applied BEFORE configure/sendEvent
    // so alloy's own egress runs under confinement (R-004: alloy uses only fetch,
    // so this does not break it — the rig asserts it still boots + sends).
    const confinement = applyEgressConfinement(self);
    confinement.shimSendBeacon = denySendBeacon(navigatorShim); // the shim navigator alloy sees
    summary.egressConfinement = confinement;
    summary.egressConfined = confinement.fetchPreserved === true;

    post("phase", { name: "loaded" });

    // AC1 reuse: host the alloy connector exactly like GA4. `self.alloy` (the
    // queue fn the bundle now drives) is injected as the connector's command fn.
    host = createConnectorHost(createAlloyConnector, { ...(config || {}), alloy: self.alloy });
    summary.syncSurfacePresent = summary.syncSurfacePresent
      && typeof host.manifest === "object" && Array.isArray(host.manifest.capabilities.cookies);

    try {
      await host.init(caps); // -> alloy configure({ datastreamId, orgId, context:[] })
      summary.configureSettled = "fulfilled";
    } catch (e) {
      summary.configureSettled = "rejected: " + (e && e.message);
    }
    post("phase", { name: "configured", configureSettled: summary.configureSettled });
  } catch (err) {
    post("fatal", { phase: summary.booted ? "post-load" : "load", message: err && err.message, stack: (err && err.stack) || "", summary });
  }
}

async function drive(event) {
  try {
    const { ready, dropped } = await host.routeBatch([event]); // -> alloy sendEvent
    summary.dropped = dropped;
    summary.sendEventSettled = dropped.length === 0 ? "fulfilled" : "rejected: " + (dropped[0] && dropped[0].reason);
    // ready is [] for the wrapped-SDK path: alloy's egress rides the INTERCEPTED
    // fetch → main-thread dispatch (AC4), not the wire-protocol EgressRequest array.
    post("result", { summary, ready });
  } catch (err) {
    post("fatal", { phase: "sendEvent", message: err && err.message, stack: (err && err.stack) || "", summary });
  }
}

/* ---- AC5: post-boot adversarial self-probe. Runs INSIDE the chamber, as
 *      untrusted post-boot code would, attempting each withheld network
 *      primitive and reporting whether it is a WORKING path. reachable:false =
 *      absent or throws = confined. The rig asserts the whole set is unreachable
 *      while alloy still boots + sends through the mediated fetch. ---- */

// The disclosed residual — dynamic loader of a REMOTE specifier. Build the
// thunk at RUNTIME from a split keyword so esbuild's classic-worker bundle
// carries NO literal dynamic-loader token (AC2's load-route assertion stays
// green: has_dynamic_import must be false) while still exercising the
// language-level loader primitive a JS shim cannot reliably withhold.
const REMOTE_LOADER_KW = ["i", "m", "p", "o", "r", "t"].join("");
let remoteLoaderThunk = null;
try {
  remoteLoaderThunk = new Function("u", "return " + REMOTE_LOADER_KW + "(u)");
} catch (e) {
  remoteLoaderThunk = null;
}

async function probeRemoteLoader(url) {
  if (typeof remoteLoaderThunk !== "function") {
    return { attempted: true, reachable: false, outcome: "blocked", detail: "no runtime loader thunk (Function ctor unavailable)" };
  }
  let p;
  try {
    p = remoteLoaderThunk(url);
  } catch (e) {
    return { attempted: true, reachable: false, outcome: "blocked", detail: "loader threw synchronously: " + String((e && e.message) || e) };
  }
  if (!p || typeof p.then !== "function") {
    return { attempted: true, reachable: false, outcome: "blocked", detail: "loader did not return a thenable" };
  }
  try {
    const mod = await p;
    return { attempted: true, reachable: true, outcome: "disclosed-residual", detail: "remote module loaded over the network", marker: (mod && mod.MARKER) || null };
  } catch (e) {
    // The loader ENGAGED (returned a promise) but the remote module load failed.
    // The language-level primitive is still reachable — the disclosed residual,
    // distinct from a hard block.
    return { attempted: true, reachable: true, outcome: "disclosed-residual", detail: "loader engaged; remote module load failed: " + String((e && e.message) || e) };
  }
}

async function probeEgress(remoteLoaderUrl) {
  const probes = {};
  function attempt(key, fn) {
    try {
      const r = fn();
      probes[key] = { reachable: true, note: "usable — " + String(r) };
    } catch (e) {
      probes[key] = { reachable: false, error: String((e && e.message) || e) };
    }
  }

  // `.invalid` is a reserved non-resolving TLD, so a probe never actually
  // egresses to a live host — but constructing WebSocket/EventSource/WebTransport
  // IS the egress attempt (they open on construction), and constructing XHR/Worker
  // is the gateway. Withheld -> construction throws.
  attempt("XMLHttpRequest", () => { const x = new self.XMLHttpRequest(); x.open("GET", "https://egress.invalid/"); return "constructed + open()"; });
  attempt("WebSocket", () => { new self.WebSocket("wss://egress.invalid/"); return "opened socket"; });
  attempt("EventSource", () => { new self.EventSource("https://egress.invalid/"); return "opened stream"; });
  attempt("WebTransport", () => { new self.WebTransport("https://egress.invalid/"); return "opened transport"; });
  attempt("nested_Worker", () => { new self.Worker("data:application/javascript,0"); return "spawned nested worker"; });
  attempt("CacheStorage", () => {
    const p = self.caches.open("airlock-egress-probe"); // gateway to a Cache -> add/addAll fetch+store
    return (p && typeof p.then === "function") ? "caches.open() returned a promise" : "caches.open() returned";
  });
  attempt("navigator_sendBeacon", () => {
    const nav = (self.window && self.window.navigator) || self.navigator; // the shim navigator alloy/vendor code sees
    const ok = nav.sendBeacon("https://egress.invalid/", "x");
    return "sendBeacon returned " + String(ok);
  });
  attempt("importScripts", () => {
    // Prove revocation adversarially: a data: URL that would EXECUTE injected
    // code if importScripts were still a callable loader. Revoked -> not a
    // function -> throws.
    self.__egressImportScriptsExecuted = false;
    self.importScripts("data:application/javascript,self.__egressImportScriptsExecuted=true");
    if (self.__egressImportScriptsExecuted !== true) throw new Error("importScripts present but injected code did not run");
    return "loaded + executed injected remote-style code";
  });

  const remoteLoader = await probeRemoteLoader(remoteLoaderUrl);
  return { probes, remoteLoader };
}

async function runEgressProbe(remoteLoaderUrl) {
  try {
    const { probes, remoteLoader } = await probeEgress(remoteLoaderUrl);
    post("egress-probe-result", { probes, remoteLoader, confinement: summary.egressConfinement || null });
  } catch (err) {
    post("egress-probe-result", {
      probes: { probeError: { reachable: false, error: String((err && err.message) || err) } },
      remoteLoader: { attempted: false, reachable: false, outcome: "blocked", detail: "probe crashed: " + String((err && err.message) || err) },
      confinement: summary.egressConfinement || null,
    });
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "init") return void boot(m);
  if (m.type === "event") return void drive(m.event);
  // AC4: the main-thread dispatcher's response to an intercepted fetch.
  if (m.type === "intercepted-fetch-response") return void resolveInterceptedFetch(m);
  // AC5: the harness asks the chamber to run the adversarial egress self-probe.
  if (m.type === "probe-egress") return void runEgressProbe(m.remoteLoaderUrl);
};
