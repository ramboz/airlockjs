// Passive, caller-owned Page observation only. Importing performs no work.
import { types } from "node:util";
import { Failure, parseJson } from "./contract.mjs";

const EDGE = "https://edge.adobedc.net";
const LIMITS = Object.freeze({ maxRequests: 8, maxRequestBytes: 65536,
  maxResponseBytes: 65536, maxTotalBytes: 1048576, settleTimeoutMs: 5000 });
const SCALAR_BYTES = Object.freeze({ url: 2048, method: 32, content_type: 1024 });
const CLAIMS = ["sdk_execution_verified", "host_render_verified",
  "chamber_compatibility_verified", "downstream_receipt_verified", "full_wire_conformance_verified"];
const ACTION = /^\/ee\/(?:(?:or2|va6|irl1|ind1|jpn3|sgp3|aus3)\/)?v1\/(?:interact|collect|privacy\/set-consent)$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const invalid = () => { throw new Failure("invalid_input"); };
const stamp = () => new Date().toISOString();

function freeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function configuration(input) {
  if (!object(input) || types.isProxy(input)) invalid();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const options = { ...LIMITS, edgeOrigin: EDGE };
  for (const key of Reflect.ownKeys(descriptors)) {
    const d = descriptors[key];
    if (typeof key !== "string" || !["datastreamId", "edgeOrigin", ...Object.keys(LIMITS)].includes(key)
      || !Object.hasOwn(d, "value") || !d.enumerable) invalid();
    options[key] = d.value;
  }
  const id = options.datastreamId;
  // eslint-disable-next-line no-control-regex -- reject controls in the private scalar
  if (typeof id !== "string" || !id.length || id.length > 250 || /[\s\u0000-\u001f\u007f-\u009f]/u.test(id)
    || Buffer.byteLength(id, "utf8") > 250
    || Buffer.from(id).toString("utf8") !== id) invalid();
  for (const [key, ceiling] of Object.entries(LIMITS))
    if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > ceiling) invalid();
  const origin = options.edgeOrigin;
  if (origin !== EDGE) {
    if (typeof origin !== "string" || !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::[1-9]\d{0,4})?$/.test(origin)) invalid();
    const url = new URL(origin);
    if (url.origin !== origin || (url.port && Number(url.port) > 65535)) invalid();
  }
  return options;
}

// Page is intentionally not plain data, but method validation must not invoke
// getters/proxy traps. Real Playwright methods reside on its class prototypes.
function pageMethod(page, key) {
  let owner = page;
  while (owner && owner !== Object.prototype) {
    if (types.isProxy(owner)) invalid();
    const d = Object.getOwnPropertyDescriptor(owner, key);
    if (d) {
      if (!Object.hasOwn(d, "value") || typeof d.value !== "function") invalid();
      return d.value;
    }
    owner = Object.getPrototypeOf(owner);
  }
  invalid();
}

function jsonObject(text) {
  const parsed = parseJson(text, 16, "invalid_input");
  if (!object(parsed)) throw new Failure("invalid_input");
  const finite = value => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Failure("invalid_input");
    if (value && typeof value === "object") Object.values(value).forEach(finite);
  };
  finite(parsed);
  return parsed;
}
function decode(buffer) {
  // ignoreBOM preserves a BOM verbatim rather than silently stripping bytes.
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
  if (!Buffer.from(text, "utf8").equals(buffer)) throw new Failure("invalid_input");
  return text;
}
function nonempty(value) {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}
function routing(raw, url, options) {
  if (url.origin !== options.edgeOrigin || url.href !== raw || url.username || url.password
    || url.hash || !ACTION.test(url.pathname)) return false;
  const pairs = url.search.slice(1).split("&");
  if (pairs.length !== 2 || !pairs.every(p => /^(configId|requestId)=/.test(p))) return false;
  const query = url.searchParams;
  return query.getAll("configId").length === 1 && query.get("configId") === options.datastreamId
    && query.getAll("requestId").length === 1 && UUID.test(query.get("requestId") ?? "");
}

export async function startStockWireRecorder(page, input) {
  let options, on, off;
  try {
    options = configuration(input);
    if (!object(page) || types.isProxy(page)) invalid();
    on = pageMethod(page, "on"); off = pageMethod(page, "off");
  } catch { invalid(); }

  const source = options.edgeOrigin === EDGE ? "adobe_origin" : "loopback_sink";
  const started = stamp(), records = [], tracked = new Map(), pending = new Set(), errors = new Set();
  const counts = { observed_requests: 0, stored_requests: 0, completed_responses: 0,
    request_bytes: 0, response_bytes: 0 };
  let accepting = true, finished = false, stopped, stopPromise;
  function error(category, state) {
    if (finished) return;
    errors.add(category);
    if (state && state.record.error === null) state.record.error = category;
  }
  // Metadata has fixed ceilings independent of lowered body limits. Timestamps
  // are generated fixed-size values; record overhead is bounded by the cap of 8.
  function retain(state, key, value) {
    if (finished) return false;
    if (Object.hasOwn(SCALAR_BYTES, key) && Buffer.byteLength(value, "utf8") > SCALAR_BYTES[key]) {
      error("byte_limit", state);
      return false;
    }
    state.record[key] = value;
    return true;
  }
  function bodyFits(buffer, state, count, ceiling) {
    counts[count] += buffer.length; // Include refused/invalid original bytes, not metadata.
    if (buffer.length > ceiling || counts.request_bytes + counts.response_bytes > options.maxTotalBytes) {
      error("byte_limit", state);
      return false;
    }
    return true;
  }
  function schedule(state, category, work) {
    const task = Promise.resolve().then(work).catch(() => error(category, state));
    pending.add(task);
    // Both fulfillment and rejection are consumed by task's fixed-category catch.
    task.then(() => pending.delete(task));
  }
  async function readRequest(req, state) {
    const r = state.record;
    const method = req.method();
    if (typeof method !== "string") { error("invalid_request", state); return; }
    retain(state, "method", method);
    if (method !== "POST") error("invalid_request", state);
    if (req.redirectedFrom()) error("redirect_observed", state);
    const contentType = await req.headerValue("content-type");
    if (finished) return;
    if (typeof contentType !== "string") error("invalid_request", state);
    else if (retain(state, "content_type", contentType)
      && !/^application\/json(?:\s*;[^]*)?$/i.test(contentType)) error("invalid_request", state);
    const buffer = req.postDataBuffer();
    if (!Buffer.isBuffer(buffer)) { error("invalid_request", state); return; }
    if (!bodyFits(buffer, state, "request_bytes", options.maxRequestBytes)) return;
    let text;
    try { text = decode(buffer); } catch { error("invalid_request", state); return; }
    retain(state, "request_body", text);
    try { jsonObject(text); } catch { error("invalid_request", state); }
    // r is internal only; no Request or parsed body reference reaches capture.
    state.requestDone = r.request_body !== null;
  }
  async function readResponse(res, state) {
    const status = res.status();
    if (Number.isInteger(status) && status >= 100 && status <= 599) state.record.response_status = status;
    if (status !== 200 && status !== 204) error("invalid_response", state);
    if (res.fromServiceWorker() !== false) error("invalid_response", state);
    const buffer = await res.body();
    if (finished) return;
    if (!Buffer.isBuffer(buffer)) { error("response_read_failed", state); return; }
    if (!bodyFits(buffer, state, "response_bytes", options.maxResponseBytes)) return;
    let text;
    try { text = decode(buffer); } catch { error("invalid_response", state); return; }
    if (!retain(state, "response_body", text)) return;
    state.responseDone = true;
    counts.completed_responses++;
    if (status === 204) {
      if (text !== "") error("invalid_response", state);
    } else {
      try {
        const parsed = jsonObject(text);
        if (["errors", "errorCode", "error"].some(key => nonempty(parsed[key])))
          error("invalid_response", state);
      } catch { error("invalid_response", state); }
    }
  }
  const requestListener = req => {
    if (!accepting) return;
    try {
      const raw = req.url();
      if (typeof raw !== "string") throw new Failure("invalid_input");
      const url = new URL(raw);
      // A terminal DNS dot must not hide Adobe drift. This normalization is
      // classification-only: routing still checks the unchanged URL/origin/raw.
      const adobe = /(?:^|\.)(?:adobedc|demdex)\.net$/i.test(url.hostname.replace(/\.$/, ""));
      if (url.origin !== options.edgeOrigin && !adobe) return;
      counts.observed_requests++;
      if (tracked.has(req)) { error("observer_failure", tracked.get(req)); return; }
      if (records.length >= options.maxRequests) { error("request_limit"); return; }
      const record = { ordinal: counts.observed_requests, url: null, method: null, content_type: null,
        request_body: null, request_observed_at: null, response_status: null, response_body: null,
        response_observed_at: null, error: null };
      const state = { record, requestDone: false, responseSeen: false, responseDone: false, failed: false };
      tracked.set(req, state); records.push(record); counts.stored_requests++;
      retain(state, "request_observed_at", stamp());
      retain(state, "url", raw);
      if (!routing(raw, url, options)) error("routing_mismatch", state);
      schedule(state, "request_read_failed", () => readRequest(req, state));
    } catch { error("observer_failure"); }
  };
  const responseListener = res => {
    if (!accepting) return;
    try {
      const state = tracked.get(res.request());
      if (!state) return;
      if (state.responseSeen) { error("observer_failure", state); return; }
      state.responseSeen = true;
      retain(state, "response_observed_at", stamp());
      schedule(state, "response_read_failed", () => readResponse(res, state));
    } catch { error("observer_failure"); }
  };
  const failedListener = req => {
    if (!accepting) return;
    const state = tracked.get(req);
    if (state) { state.failed = true; error("transport_failed", state); }
  };
  const listeners = [["request", requestListener], ["response", responseListener],
    ["requestfailed", failedListener]];
  try {
    for (const [event, listener] of listeners) on.call(page, event, listener);
  } catch {
    accepting = false; finished = true;
    // Roll back even an on() implementation that registered before throwing.
    for (const [event, listener] of listeners) {
      try { off.call(page, event, listener); } catch {
        // Already quarantined; the factory rejects with invalid_input below.
      }
    }
    invalid();
  }

  function stop() {
    if (stopPromise) return stopPromise;
    accepting = false; stopped = stamp();
    for (const [event, listener] of listeners) {
      try { off.call(page, event, listener); } catch { error("observer_failure"); }
    }
    stopPromise = (async () => {
      let timer;
      const drained = await Promise.race([
        Promise.all([...pending]).then(() => true),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), options.settleTimeoutMs); }),
      ]);
      clearTimeout(timer);
      if (!drained) error("settle_timeout");
      for (const state of tracked.values()) {
        if (!state.responseDone && !state.failed) error("incomplete_response", state);
        if (!drained && (!state.requestDone || !state.responseDone)) error("settle_timeout", state);
      }
      finished = true; // Quarantine uncancellable reads before exposing the snapshot.
      const categories = [...errors];
      const capture = { kind: "airlock.adobe-stock.network-capture", schema_version: 1, source,
        started_at: started, stopped_at: stopped, requests: records.map(r => ({ ...r })), errors: [...categories] };
      const report = { kind: "airlock.adobe-stock.network-report", schema_version: 1, source,
        overall: categories.length ? "recording_failed" : "recording_complete",
        exit_code: categories.length ? 1 : 0, counts: { ...counts }, errors: [...categories],
        claims: Object.fromEntries(CLAIMS.map(key => [key, false])) };
      tracked.clear(); records.length = 0;
      return freeze({ report, capture });
    })();
    return stopPromise;
  }
  return { stop };
}
