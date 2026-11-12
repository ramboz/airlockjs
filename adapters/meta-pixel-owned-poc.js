import { createMetaPixelPrototype } from "./meta-pixel-prototype.js";

const endpoint = "https://www.facebook.com/tr/";
const documentPattern = /^https:\/\/main--aem-eds-airlock-poc--adobe-rnd\.aem\.live\/\?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=[A-Za-z0-9_-]{1,128}(?![\s\S])/;
const pageKey = Symbol.for("airlock.meta.owned-poc.v1");
const automaticKey = Symbol.for("airlock.meta.owned-poc.automatic.v1");
const configPath = "/tools/airlock-meta/automatic-config.json";

async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("deadline")), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function prepareOwnedPoc({ page = window, makeAdapter = createMetaPixelPrototype } = {}) {
  if (!documentPattern.test(page.location.href) || page.document.URL !== page.location.href) return false;
  if (Object.hasOwn(page, pageKey)) return true;
  let claimed = false;
  let consent = "pending";
  let adapter;
  let exited = false;
  let cleanup;
  function onConsent(event) {
    try {
      const value = event?.detail?.consented;
      consent = value === true ? "granted" : value === false ? "denied" : "pending";
    } catch { consent = "pending"; }
    adapter?.setConsent({ ad_storage: consent });
  }
  function stop() {
    if (cleanup) return cleanup;
    page.removeEventListener("consent.update", onConsent);
    page.removeEventListener("pagehide", onExit);
    cleanup = bounded(Promise.resolve().then(() => adapter?.dispose()), 1500);
    return cleanup;
  }
  function onExit() {
    exited = true;
    claimed = true;
    void stop().catch(() => {});
  }
  async function arm(input) {
    if (claimed) return { error: "already-armed" };
    claimed = true;
    let result;
    try {
      if (consent !== "granted") {
        result = { error: "consent-unavailable" };
      } else {
        const descriptors = input && typeof input === "object" &&
          [Object.prototype, null].includes(Object.getPrototypeOf(input)) && Object.getOwnPropertyDescriptors(input);
        const keys = ["pixelId", "notBefore", "notAfter"];
        if (!descriptors || Reflect.ownKeys(descriptors).length !== keys.length ||
            !keys.every((key) => Object.hasOwn(descriptors[key] || {}, "value"))) throw new Error("invalid");
        const { pixelId, notBefore, notAfter } = input;
        const now = Date.now();
        if (typeof pixelId !== "string" || !/^\d{1,32}$/.test(pixelId) ||
            !Number.isSafeInteger(notBefore) || !Number.isSafeInteger(notAfter) || notBefore <= 0 ||
            notAfter <= notBefore || notAfter - notBefore > 360000 || now < notBefore || now >= notAfter ||
            page.location.href !== page.document.URL || !documentPattern.test(page.document.URL) ||
            page.self !== page.top || page.document.referrer !== "") throw new Error("invalid");
        adapter = makeAdapter({ endpoint, ownedPocBinding: { pixelId, documentURL: page.document.URL, notBefore, notAfter },
          consent: { ad_storage: consent }, transportTimeoutMs: 3000, commandTimeoutMs: 5000 });
        adapter.fbq("init", pixelId);
        adapter.fbq("track", "PageView");
        const state = await bounded(adapter.flush(), 11000);
        const outcome = state.outcomes?.[1];
        const dispositions = ["transport-settled", "response-unavailable", "held", "failed", "rejected"];
        if (!exited && state.outcomes?.length === 2 && dispositions.includes(outcome?.disposition)) {
          result = { disposition: outcome.disposition, status: Number.isInteger(outcome.status) ? outcome.status : 0,
            body: state.liveResponse?.body === "not-collected" ? "not-collected" : "unavailable" };
        } else result = { error: "execution-failed" };
      }
    } catch { result = { error: "execution-failed" }; }
    try { await stop(); } catch { return { error: "cleanup-failed" }; }
    return result;
  }
  const surface = Object.freeze({ arm });
  Object.defineProperty(page, pageKey, { value: surface });
  Object.defineProperty(page, "__airlockMetaPoc", { value: surface });
  page.addEventListener("consent.update", onConsent);
  page.addEventListener("pagehide", onExit, { once: true });
  return true;
}

function sitePixel(page) {
  const matches = [];
  for (const script of page.document.querySelectorAll("head > script")) {
    const pattern = /window\.fbq\('init', '(\d{1,32})'\);/g;
    for (const match of script.textContent.matchAll(pattern)) matches.push(match[1]);
  }
  if (matches.length !== 1) throw new Error("binding");
  return matches[0];
}

function snapshotAutomaticConfig(value, page) {
  const keys = ["enabled", "pixelId", "documentURL", "notBefore", "notAfter", "maxPageViewsPerDocument"];
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error("shape");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(descriptors[key] || {}, "value"))) throw new Error("shape");
  const config = Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
  if (typeof config.enabled !== "boolean" || typeof config.pixelId !== "string" ||
      !/^\d{1,32}$/.test(config.pixelId) || config.pixelId !== sitePixel(page) ||
      config.maxPageViewsPerDocument !== 1) throw new Error("shape");
  if (!config.enabled) {
    if (config.documentURL !== "" || config.notBefore !== 0 || config.notAfter !== 0) throw new Error("shape");
  } else {
    const now = Date.now();
    if (config.documentURL !== page.document.URL || page.location.href !== config.documentURL ||
        !documentPattern.test(config.documentURL) || page.self !== page.top || page.document.referrer !== "" ||
        !Number.isSafeInteger(config.notBefore) || !Number.isSafeInteger(config.notAfter) ||
        config.notBefore <= 0 || config.notAfter <= config.notBefore ||
        config.notAfter - config.notBefore > 360000 || now < config.notBefore || now >= config.notAfter) {
      throw new Error("shape");
    }
  }
  return Object.freeze(config);
}

async function readAutomaticConfig(response) {
  if (!response.ok || response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
    throw new Error("response");
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new Error("size");
  if (!response.body) throw new Error("body");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new Error("size");
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function prepareAutomaticOwnedPoc({
  page = window,
  makeAdapter = createMetaPixelPrototype,
  fetchImpl = (...args) => page.fetch(...args),
  deadline = Date.now() + 5000,
} = {}) {
  if (!documentPattern.test(page.location.href) || page.document.URL !== page.location.href) return false;
  if (Object.hasOwn(page, automaticKey)) return true;
  if (!prepareOwnedPoc({ page, makeAdapter })) return false;
  let state = Object.freeze({ state: "preparing" });
  let consent = "pending";
  let config;
  let timer;
  let terminal = false;
  const controller = new AbortController();
  const surface = Object.freeze({ getState: () => state });
  Object.defineProperty(page, automaticKey, { value: surface });
  Object.defineProperty(page, "__airlockMetaAutomatic", { value: surface });

  function finish(next, outcome) {
    if (terminal) return;
    terminal = true;
    clearTimeout(timer);
    controller.abort();
    page.removeEventListener("consent.update", onConsent);
    page.removeEventListener("pagehide", onExit);
    state = Object.freeze(outcome ? { state: next, outcome: Object.freeze(outcome) } : { state: next });
  }
  function maybeArm() {
    if (terminal || !config || consent !== "granted") return;
    if (Date.now() >= config.notAfter || Date.now() < config.notBefore ||
        page.location.href !== config.documentURL || page.document.URL !== config.documentURL) {
      finish("expired");
      return;
    }
    state = Object.freeze({ state: "running" });
    clearTimeout(timer);
    page.removeEventListener("consent.update", onConsent);
    const { pixelId, notBefore, notAfter } = config;
    void page.__airlockMetaPoc.arm({ pixelId, notBefore, notAfter }).then(
      (outcome) => finish(outcome.error || ["failed", "rejected"].includes(outcome.disposition) ? "failed" : "complete", outcome),
      () => finish("failed", { error: "execution-failed" }),
    );
  }
  function onConsent(event) {
    try {
      const value = event?.detail?.consented;
      consent = value === true ? "granted" : value === false ? "denied" : "pending";
    } catch { consent = "pending"; }
    if (consent === "denied") finish("denied");
    else maybeArm();
  }
  function onExit() { finish("exited"); }
  page.addEventListener("consent.update", onConsent);
  page.addEventListener("pagehide", onExit, { once: true });

  const end = Math.min(deadline, Date.now() + 5000);
  if (!Number.isFinite(end) || end <= Date.now()) {
    finish("config-error");
    return true;
  }
  timer = setTimeout(() => finish("config-error"), end - Date.now());
  try {
    const request = fetchImpl(configPath, {
      credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
    });
    void Promise.resolve(request).then(readAutomaticConfig).then((value) => {
      if (terminal) return;
      if (Date.now() >= end) throw new Error("deadline");
      config = snapshotAutomaticConfig(value, page);
      if (!config.enabled) { finish("disabled"); return; }
      clearTimeout(timer);
      timer = setTimeout(() => finish("expired"), Math.max(0, config.notAfter - Date.now()));
      state = Object.freeze({ state: "waiting-consent" });
      maybeArm();
    }).catch(() => finish("config-error"));
  } catch { finish("config-error"); }
  return true;
}
