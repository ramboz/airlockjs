// connectors/ga4/map.js
function validatePurchase(params) {
  const isNonEmptyString = (v2) => typeof v2 === "string" && v2.length > 0;
  if (!isNonEmptyString(params.transaction_id)) {
    throw new Error("purchase event missing or invalid transaction_id");
  }
  if (!isNonEmptyString(params.currency)) {
    throw new Error("purchase event missing or invalid currency");
  }
  if (typeof params.value !== "number" || !Number.isFinite(params.value) || params.value < 0) {
    throw new Error("purchase event missing or invalid value (non-negative number required)");
  }
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new Error("purchase event missing or invalid items");
  }
}
function mapToMp(event, ctx) {
  if (event.type === "purchase") validatePurchase(event.params || {});
  const params = {
    ...event.params || {},
    // session_id + engagement_time_msec are required for the event to attribute
    // to a session and appear in standard reports (contracts/ga4-mp.md §4).
    session_id: String(ctx.sessionId),
    engagement_time_msec: typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100
  };
  const body = {
    client_id: ctx.clientId,
    events: [{ name: event.type, params }]
  };
  if (ctx.userId) body.user_id = ctx.userId;
  if (ctx.consent) body.consent = ctx.consent;
  return body;
}

// core/egress.js
var KEEPALIVE_BUDGET_BYTES = 64 * 1024;
function createCriticalDispatcher({
  ctx,
  endpoints,
  trackers,
  // 030-01: the main-thread unload mapper is connector-generic. Default = GA4's
  // `mapToMp` (byte-unchanged for every existing caller); a worker-mapped connector
  // whose map lives in the chamber (e.g. helix-rum) passes a closure binding its own
  // main-thread mapper — `(event, ctx) => mapToRum(event, ctx, sampling)` — so its
  // unload-critical events (RUM's INP/late-CLS at page-hide) egress correctly instead
  // of being GA4-mis-mapped or dropped.
  mapper = mapToMp,
  budgetBytes = KEEPALIVE_BUDGET_BYTES,
  fetchImpl = typeof fetch !== "undefined" ? fetch : null,
  encode = (s2) => new TextEncoder().encode(s2).length
}) {
  let used = 0;
  let dispatched = 0;
  let dropped = 0;
  const n2 = typeof trackers === "number" ? trackers : endpoints.length;
  function dispatch(event) {
    for (let t2 = 0; t2 < n2; t2++) {
      const body = JSON.stringify(mapper(event, ctx));
      const bytes = encode(body);
      if (used + bytes > budgetBytes) {
        dropped++;
        continue;
      }
      used += bytes;
      try {
        const p2 = fetchImpl(endpoints[t2], { method: "POST", body, keepalive: true });
        if (p2 && typeof p2.then === "function") p2.then(() => {
        }, () => {
        });
        dispatched++;
      } catch {
        dropped++;
      }
    }
  }
  return {
    dispatch,
    bytesUsed: () => used,
    stats: () => ({
      fastDispatched: dispatched,
      fastDropped: dropped,
      keepaliveBytesUsed: used
    })
  };
}

// connectors/helix-rum/map.js
var RATE_WEIGHTS = { on: 1, off: 0, high: 10, medium: 100, low: 1e3 };
function resolveWeight({ rate, weight } = {}) {
  if (typeof weight === "number") return weight;
  if (typeof rate === "string" && Object.prototype.hasOwnProperty.call(RATE_WEIGHTS, rate)) {
    return RATE_WEIGHTS[rate];
  }
  return RATE_WEIGHTS.medium;
}
function rumUrl(collectBaseURL, weight) {
  return new URL(`.rum/${weight}`, collectBaseURL).href;
}
function errorFields(event) {
  const data = event && (event.params || event.payload) || {};
  return { source: data.source, target: data.target };
}
var CWV_ATTRIBUTION_FIELDS = [
  // LCPAttribution (lcp.d.ts:14-67) — excludes navigationEntry/
  // lcpResourceEntry/lcpEntry (each PerformanceEntry-shaped).
  "target",
  "url",
  "timeToFirstByte",
  "resourceLoadDelay",
  "resourceLoadDuration",
  "elementRenderDelay",
  // CLSAttribution (cls.d.ts:14-51) — excludes largestShiftEntry (a
  // LayoutShift entry) and largestShiftSource (carries a live DOM Node ref).
  "largestShiftTarget",
  "largestShiftTime",
  "largestShiftValue",
  "loadState",
  // INPAttribution (inp.d.ts:36-155) — excludes processedEventEntries /
  // longAnimationFrameEntries (entry arrays) and longestScript (nests a
  // PerformanceScriptTiming `.entry`; its two safe sub-scalars, `subpart`/
  // `intersectingDuration`, are dropped WHOLESALE along with it by
  // `projectCwv`'s shallow filter rather than partially unwrapped — see that
  // function's doc). `loadState` is shared with CLSAttribution, listed once.
  "interactionTarget",
  "interactionTime",
  "interactionType",
  "nextPaintTime",
  "inputDelay",
  "processingDuration",
  "presentationDelay",
  "totalScriptDuration",
  "totalStyleAndLayoutDuration",
  "totalPaintDuration",
  "totalUnattributedDuration"
];
function cwvFields(event) {
  const data = event && (event.params || event.payload) || {};
  const fields = { name: data.name, value: data.value };
  for (const key of CWV_ATTRIBUTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) fields[key] = data[key];
  }
  return fields;
}
function mapToRum(event, ctx, sampling) {
  const body = {
    weight: sampling.weight,
    id: sampling.id,
    referer: ctx && ctx.referer || "",
    checkpoint: event.type,
    t: typeof event.ts === "number" ? event.ts : 0
  };
  if (event.type === "error") return { ...body, ...errorFields(event) };
  if (event.type === "cwv") return { ...body, ...cwvFields(event) };
  return body;
}

// core/endpoint-ceiling.js
function originPath(url) {
  try {
    const u2 = new URL(url, "https://airlock.local");
    return u2.origin + u2.pathname;
  } catch {
    return null;
  }
}
function checkEndpointCeiling(url, declaredEndpoints) {
  const destination = originPath(url);
  const ceiling = /* @__PURE__ */ new Set();
  for (const endpoint of declaredEndpoints || []) {
    const reduced = originPath(endpoint);
    if (reduced) ceiling.add(reduced);
  }
  if (ceiling.size === 0) {
    return { verdict: "hold", destination, reason: "endpoint-ceiling: no declared endpoints \u2014 fail closed (hold)" };
  }
  if (destination === null) {
    return { verdict: "hold", destination, reason: "endpoint-ceiling: unparseable outbound url \u2014 fail closed (hold)" };
  }
  if (ceiling.has(destination)) {
    return { verdict: "allow", destination, reason: "ok" };
  }
  return {
    verdict: "hold",
    destination,
    reason: `endpoint-ceiling: outbound ${destination} not in declared endpoints \u2014 held at the seal`
  };
}

// core/consent.js
var CONSENT_PURPOSES = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "functional",
  "personalization"
];
function resolveConsent(vector, purpose) {
  if (!CONSENT_PURPOSES.includes(purpose)) return "pending";
  const raw = vector == null ? void 0 : vector[purpose];
  if (typeof raw !== "string") return "pending";
  const normalized = raw.toLowerCase();
  if (normalized === "granted") return "granted";
  if (normalized === "denied") return "denied";
  return "pending";
}
function egressVerdict(vector, purposes, { strict = false } = {}) {
  let verdict = "send";
  for (const p2 of purposes || []) {
    const state = resolveConsent(vector, p2);
    if (strict && state !== "granted") return "drop";
    if (state === "pending" && verdict === "send") verdict = "hold";
  }
  return verdict;
}

// core/payload-governance.js
var DEFAULT_DENYLIST = [
  "password",
  "passwd",
  "pwd",
  "cvv",
  "cvv2",
  "cvc",
  "ssn",
  "social_security_number",
  "card_number",
  "cardnumber",
  "credit_card",
  "creditcard",
  "cc_number"
];
function findKeyCaseInsensitive(obj, name) {
  if (obj == null || typeof obj !== "object") return void 0;
  const lower = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return key;
  }
  return void 0;
}
function matchingKeysCaseInsensitive(obj, name) {
  if (obj == null || typeof obj !== "object") return [];
  const lower = name.toLowerCase();
  return Object.keys(obj).filter((key) => key.toLowerCase() === lower);
}
function stripDottedPath(governed, segments) {
  let cur = governed;
  const actualKeys = [];
  for (let i2 = 0; i2 < segments.length - 1; i2++) {
    const key = findKeyCaseInsensitive(cur, segments[i2]);
    if (key === void 0) return false;
    actualKeys.push(key);
    cur = cur[key];
  }
  const leafKeys = matchingKeysCaseInsensitive(cur, segments[segments.length - 1]);
  if (leafKeys.length === 0) return false;
  let node = governed;
  for (const key of actualKeys) {
    node[key] = { ...node[key] };
    node = node[key];
  }
  for (const leafKey of leafKeys) delete node[leafKey];
  return true;
}
function governPayload(params, denylist) {
  const entries = Array.isArray(denylist) ? denylist.filter((e2) => typeof e2 === "string" && e2.length > 0) : [];
  if (entries.length === 0) return { governed: params, stripped: [] };
  try {
    const governed = { ...params };
    const stripped = [];
    for (const entry of entries) {
      if (entry.includes(".")) continue;
      const keys = matchingKeysCaseInsensitive(governed, entry);
      if (keys.length) {
        for (const key of keys) delete governed[key];
        stripped.push(entry);
      }
    }
    for (const entry of entries) {
      if (!entry.includes(".")) continue;
      const segments = entry.split(".").filter(Boolean);
      if (segments.length < 2) continue;
      if (stripDottedPath(governed, segments)) stripped.push(entry);
    }
    return { governed: stripped.length ? governed : params, stripped };
  } catch {
    try {
      return { governed: { ...params }, stripped: [], error: true };
    } catch {
      return { governed: params, stripped: [], error: true };
    }
  }
}

// core/airlock.js
function consoleDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}
function fetchInit(method, body) {
  return method === "GET" ? { method: "GET", keepalive: true } : { method: "POST", body, keepalive: true };
}
function createAirlock({
  trackers,
  workFactor,
  endpoints,
  ctx,
  unloadCritical,
  onDiagnostic,
  consent = null,
  egressPurposes = [],
  consentStrict = false,
  payloadDenylist = [],
  // Connector-selection seam (spec 026-01 AC3, resolving the "GA4-hardcoded
  // connector factory + worker URL" gap; spec 025-03 AC6 adds a THIRD
  // branch): `connector: "pixel"` hosts `connectors/pixel/connector.js`'s
  // createPixelConnector via `core/pixel-chamber.worker.js`; `connector:
  // "dom"` hosts airlock's own worker-side DOM mirror
  // (`core/worker-dom/mirror.js`) via `core/dom-chamber.worker.js` — instead
  // of the default GA4 chamber. Both non-GA4 branches generalize the
  // `worker.postMessage({type:"init", …})` payload below to carry
  // `connectorConfig` VERBATIM (a free-form bag the specific chamber
  // interprets — the pixel chamber reads its declarative config fields, the
  // dom chamber reads `{authorSource, elements, workUs}`) instead of the
  // GA4-shaped `{trackers, workFactor, endpoints, ctx}` fields. Omitted (or
  // any value other than "pixel"/"dom") -> the GA4 default path,
  // BYTE-UNCHANGED (a regression test pins the worker URL + the exact init
  // message shape for both GA4 AND pixel).
  connector,
  connectorConfig
}) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
  const inspectorTag = (Math.random().toString(36).slice(2) + "000000").slice(0, 6);
  let beaconSeq = 0;
  const effectiveDenylist = [...DEFAULT_DENYLIST, ...payloadDenylist || []];
  function governParams(params) {
    if (!effectiveDenylist.length) return params;
    const { governed, stripped, error } = governPayload(params, effectiveDenylist);
    if (error) {
      diagnose({ level: "error", kind: "payload-governance", disposition: "skipped", reason: "govern-failed" });
    }
    for (const field of stripped) {
      diagnose({ level: "warn", kind: "payload-governance", disposition: "stripped", field });
    }
    return governed;
  }
  const ceiling = (endpoints || []).map(originPath).filter(Boolean);
  let consentVector = consent || {};
  const heldBeacons = [];
  const log = [];
  const projection = /* @__PURE__ */ Object.create(null);
  const ring = [];
  let seq = 0;
  let dispatched = 0;
  let scheduled = false;
  const criticalTypes = new Set(unloadCritical || []);
  if (connector === "helix-rum" && !(connectorConfig && connectorConfig.sampling)) {
    console.error(
      "airlock: helix-rum instance constructed without connectorConfig.sampling \u2014 its unload CWV would fall back to GA4 mapping; bootHelixRum must pass { sampling: { weight, id } }."
    );
  }
  const critical = createCriticalDispatcher({
    ctx,
    endpoints,
    trackers,
    ...connector === "helix-rum" && connectorConfig && connectorConfig.sampling ? { mapper: (event, mapCtx) => mapToRum(event, mapCtx, connectorConfig.sampling) } : {}
  });
  const criticalDispatchGated = (d2) => {
    if (egressPurposes.length) {
      const v2 = egressVerdict(consentVector, egressPurposes, { strict: consentStrict });
      if (v2 !== "send") {
        diagnose({
          level: "warn",
          kind: "consent",
          disposition: "dropped",
          purpose: egressPurposes.join(","),
          reason: "sync/unload path \u2014 un-granted purpose dropped (no hold at teardown)"
        });
        return;
      }
    }
    critical.dispatch({ ...d2, params: governParams(d2.params) });
  };
  const worker = connector === "pixel" ? new Worker(new URL("./pixel-chamber.worker.js", import.meta.url), { type: "module" }) : connector === "dom" ? new Worker(new URL("./dom-chamber.worker.js", import.meta.url), { type: "module" }) : connector === "helix-rum" ? new Worker(new URL("./helix-rum-chamber.worker.js", import.meta.url), { type: "module" }) : new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" });
  worker.postMessage(
    connector === "pixel" || connector === "dom" || connector === "helix-rum" ? { type: "init", ...connectorConfig || {} } : { type: "init", trackers, workFactor, endpoints, ctx }
  );
  worker.onmessage = (e2) => {
    const data = e2.data;
    const ready = data && data.ready;
    if (ready) {
      for (const r2 of ready) {
        if (egressPurposes.length) {
          const v2 = egressVerdict(consentVector, egressPurposes, { strict: consentStrict });
          if (v2 === "drop") {
            diagnose({
              level: "warn",
              kind: "consent",
              disposition: "dropped",
              purpose: egressPurposes.join(","),
              reason: "strict regime \u2014 un-granted purpose dropped"
            });
            continue;
          }
          if (v2 === "hold") {
            const beaconId = `${inspectorTag}#${beaconSeq += 1}`;
            heldBeacons.push({ url: r2.url, method: r2.method, body: r2.body, beaconId });
            diagnose({
              level: "warn",
              kind: "consent",
              disposition: "held",
              purpose: egressPurposes.join(","),
              reason: "purpose pending \u2014 held at the seal",
              beaconId,
              destination: r2.url
            });
            continue;
          }
        }
        if (ceiling.length) {
          const c2 = checkEndpointCeiling(r2.url, endpoints);
          if (c2.verdict === "hold") {
            diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c2.destination, reason: c2.reason });
            continue;
          }
        }
        fetch(r2.url, fetchInit(r2.method, r2.body)).then(() => {
          dispatched++;
        }, () => {
          dispatched++;
        });
      }
    }
    const dropped = data && data.dropped;
    if (dropped && dropped.length) {
      for (const d2 of dropped) {
        diagnose({ level: "warn", kind: "dropped", type: d2.type, reason: d2.reason, index: d2.index });
      }
    }
  };
  worker.onerror = (err) => {
    diagnose({
      level: "error",
      kind: "chamber-error",
      message: err && err.message != null ? err.message : String(err),
      ...err && err.filename != null ? { filename: err.filename } : {},
      ...err && err.lineno != null ? { lineno: err.lineno } : {}
    });
  };
  const sendBatch = (batch) => {
    if (!effectiveDenylist.length) {
      worker.postMessage({ type: "events", batch });
      return;
    }
    const governedBatch = batch.map((d2) => ({ ...d2, params: governParams(d2.params) }));
    worker.postMessage({ type: "events", batch: governedBatch });
  };
  const drain = () => {
    scheduled = false;
    if (!ring.length) return;
    const batch = ring.splice(0, 50);
    sendBatch(batch);
    if (ring.length) schedule();
  };
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestIdleCallback(drain, { timeout: 50 });
    }
  }
  const unloadFlush = () => {
    if (!ring.length) return;
    const remaining = ring.splice(0, ring.length);
    remaining.sort(
      (a2, b2) => (criticalTypes.has(b2.type) ? 1 : 0) - (criticalTypes.has(a2.type) ? 1 : 0)
    );
    for (const d2 of remaining) criticalDispatchGated({ type: d2.type, params: d2.params, ts: d2.ts });
  };
  function onVisibilityChange() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") unloadFlush();
  }
  if (connector !== "pixel" && typeof addEventListener === "function") {
    addEventListener("visibilitychange", onVisibilityChange);
    addEventListener("pagehide", unloadFlush);
  }
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (typeof removeEventListener === "function") {
      removeEventListener("visibilitychange", onVisibilityChange);
      removeEventListener("pagehide", unloadFlush);
    }
    if (worker && typeof worker.terminate === "function") worker.terminate();
  }
  return {
    /**
     * Interaction-path entry: append + fold + enqueue. O(1), no mapping.
     *
     * Accepts the PINNED contract shape `push({ event: "name", ...params })`
     * (contracts/push-api.md): the reserved `event` key is the GA4 event name,
     * every other key is a param. We normalize to the internal `{ type, params }`
     * descriptor here — the log/projection/ring/worker and the golden `mapToMp` all
     * stay on `{ type, params }`, so reconciling the surface is a one-line unpack.
     */
    push(evt) {
      const { event: type, ...params } = evt || {};
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: push() dropped \u2014 missing/empty `event` name", evt);
        return;
      }
      const descriptor = { seq: seq++, type, ts: performance.now(), params };
      log.push(descriptor);
      projection[type] = descriptor;
      ring.push(descriptor);
      schedule();
    },
    /**
     * Unload-critical entry (OQ10 fast path): map + send SYNCHRONOUSLY on the main
     * thread, right now, bypassing the worker. Call from an outbound-link click or
     * a `pagehide`/`beforeunload` handler for the canonical last beacon — the event
     * generated inside the unload window that the async worker path would lose.
     * Steady-state events MUST use `push()`; this path is INP-unsafe by design and
     * only justified when the page is going away.
     */
    pushCritical(evt) {
      if (connector === "pixel") {
        diagnose({
          level: "warn",
          kind: "dropped",
          reason: "pushCritical unsupported for a pixel connector (no main-thread critical mapper; routing to the GA4 critical dispatcher would mis-map)"
        });
        return;
      }
      const { event: type, ...params } = evt || {};
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: pushCritical() dropped \u2014 missing/empty `event` name", evt);
        return;
      }
      criticalDispatchGated({ type, params, ts: performance.now() });
    },
    /**
     * 017-03 AC2 (ADR-0007 point ③ — THIS slice's own main-thread
     * consent-update path; NOT 017-01's deferred worker `ctx` re-send, which
     * governs only the mapper reshape ① and stays deferred). Merges `vector`
     * into the mutable main-thread consent state. On a pending→granted edge
     * for a HELD egress purpose, the buffered beacons are FLUSHED — a pure
     * main-thread re-`fetch(url, body)` (they are already mapped; no worker,
     * no re-map), so a flushed beacon still carries its BOOT-TIME mapper
     * reshape (a named residual — docs/refinement-todo.md). A still-pending
     * purpose's beacons stay held.
     * @param {Record<string, string>} vector a partial consent-vector update
     *   (core/consent.js's shape), merged over the existing state.
     */
    setConsent(vector) {
      consentVector = { ...consentVector, ...vector || {} };
      if (egressPurposes.length && heldBeacons.length && egressVerdict(consentVector, egressPurposes, { strict: consentStrict }) === "send") {
        const flushing = heldBeacons.splice(0, heldBeacons.length);
        for (const b2 of flushing) {
          fetch(b2.url, fetchInit(b2.method, b2.body)).then(() => {
            dispatched++;
          }, () => {
            dispatched++;
          });
          diagnose({
            level: "warn",
            kind: "consent",
            disposition: "flushed",
            purpose: egressPurposes.join(","),
            reason: "purpose granted \u2014 held beacon flushed",
            beaconId: b2.beaconId,
            // 028-02: same id as this beacon's `held` record → the held→flushed chain
            destination: b2.url
          });
        }
      }
    },
    /**
     * Synchronous read (AD-3): no argument → the whole projection; a dotted path
     * (`getState("a.b.c")`, contracts/push-api.md) → the value at that path in the
     * projection, `undefined` if any hop is absent. Never throws on a missing path.
     */
    getState(path) {
      if (path == null) return projection;
      let cur = projection;
      for (const key of String(path).split(".")) {
        if (cur == null) return void 0;
        cur = cur[key];
      }
      return cur;
    },
    flushNow() {
      while (ring.length) sendBatch(ring.splice(0, 50));
    },
    stats() {
      return { dispatched, logged: log.length, ...critical.stats() };
    },
    /**
     * 021-01 AC1 (OQ12 item 4): tear this instance down — removes the
     * visibilitychange/pagehide listeners and terminates the Worker. Idempotent
     * (a second call is a no-op) and null-safe (no addEventListener/Worker.terminate
     * -> skipped, never throws). See the `dispose` closure above for the guard.
     */
    dispose,
    // spec 025-03 AC6: expose the raw `worker` ONLY for connector:"dom" —
    // GA4/pixel stay byte-unchanged (no `worker` key at all — this handle's
    // shape for those two connectors is unaffected). A dom-chamber tag's
    // protocol (main->worker event-forward, worker->main mutation-flush,
    // `core/worker-dom/protocol.js`) is architecturally DIFFERENT from GA4/
    // pixel's ready/dropped egress protocol this handle's `push`/
    // `pushCritical`/`worker.onmessage` machinery is built for — a dom-tag
    // adapter (a `bootWorkerDomTag`-style boot, or a rig) drives that
    // DIFFERENT protocol directly against the SAME underlying worker this
    // seam already constructed + initialized, rather than this module
    // growing a second, unrelated dispatch shape it would otherwise need to
    // understand. Freely reassigning `worker.onmessage` is expected (this
    // module's OWN ready/dropped handler is a harmless no-op for the
    // `{type:"mutations"}` shape the dom chamber posts).
    ...connector === "dom" ? { worker } : {}
  };
}

// connectors/ga4/cookies.js
var DIGITS = /^\d+$/;
var GA_COOKIE_MAX_AGE_S = 63072e3;
function parseGaClientId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 2) return null;
  const random = parts[parts.length - 2];
  const seconds = parts[parts.length - 1];
  if (!DIGITS.test(random) || !DIGITS.test(seconds)) return null;
  return `${random}.${seconds}`;
}
function parseGaSessionId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 3) return null;
  const field = parts[2];
  if (field.includes("$") || field.startsWith("s")) {
    for (const f2 of field.split("$")) {
      const m2 = /^s(\d+)$/.exec(f2);
      if (m2) return m2[1];
    }
    return null;
  }
  return DIGITS.test(field) ? field : null;
}
function findGaStreamCookie(cookieString) {
  if (typeof cookieString !== "string" || cookieString.length === 0) return null;
  for (const pair of cookieString.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name.startsWith("_ga_") && name.length > 4) {
      const raw = pair.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}
function formatGaCookieValue(clientId) {
  return `GA1.1.${clientId}`;
}
async function sourceGa4Ctx({
  cookies,
  cookieString = "",
  now = Date.now,
  random = Math.random,
  storageGranted = true
}) {
  const bootSeconds = Math.floor(now() / 1e3);
  const mintEphemeralClientId = () => `${String(1e9 + Math.floor(random() * 9e9))}.${bootSeconds}`;
  if (!storageGranted) {
    return { clientId: mintEphemeralClientId(), sessionId: String(bootSeconds) };
  }
  const rawGa = await cookies.get("_ga");
  let clientId = parseGaClientId(rawGa);
  if (clientId === null) {
    clientId = mintEphemeralClientId();
    if (rawGa == null) {
      await cookies.set("_ga", formatGaCookieValue(clientId), {
        maxAge: GA_COOKIE_MAX_AGE_S,
        path: "/",
        sameSite: "lax"
      });
    }
  }
  const sessionId = parseGaSessionId(findGaStreamCookie(cookieString)) ?? String(bootSeconds);
  return { clientId, sessionId };
}

// connectors/ga4/consent.js
var DATA_USE_PURPOSES = ["ad_user_data", "ad_personalization"];
var MP_VALUE = { granted: "GRANTED", denied: "DENIED" };
function shapeMpConsent(vector) {
  const consent = {};
  for (const purpose of DATA_USE_PURPOSES) {
    const state = resolveConsent(vector, purpose);
    if (state === "pending") continue;
    consent[purpose] = MP_VALUE[state];
  }
  return Object.keys(consent).length > 0 ? consent : void 0;
}

// connectors/pixel/vendors/meta.js
var META_TR_ENDPOINT = "https://www.facebook.com/tr";
var SYNTHETIC_META_PIXEL_ID = "000000000000000";
var META_EGRESS_PURPOSES = ["ad_storage"];
function createMetaPixelConfig({ pixelId = SYNTHETIC_META_PIXEL_ID, endpoint = META_TR_ENDPOINT } = {}) {
  return {
    name: "airlock/pixel/meta",
    endpoint,
    eventMap: {
      page_view: "PageView",
      lead: "Lead"
    },
    paramMap: {
      id: { from: "static", value: pixelId },
      ev: { from: "event" },
      value: { from: "params", key: "value" },
      currency: { from: "params", key: "currency" },
      content_name: { from: "params", key: "content_name" },
      content_category: { from: "params", key: "content_category" }
    },
    egressPurposes: META_EGRESS_PURPOSES
  };
}

// connectors/pixel/vendors/linkedin.js
var LINKEDIN_COLLECT_ENDPOINT = "https://px.ads.linkedin.com/collect";
var SYNTHETIC_LINKEDIN_PARTNER_ID = "0000000";
var SYNTHETIC_LINKEDIN_CONVERSION_ID = "00000000";
var LINKEDIN_EGRESS_PURPOSES = ["ad_storage"];
function createLinkedInInsightConfig({
  partnerId = SYNTHETIC_LINKEDIN_PARTNER_ID,
  conversionId = SYNTHETIC_LINKEDIN_CONVERSION_ID,
  endpoint = LINKEDIN_COLLECT_ENDPOINT
} = {}) {
  return {
    name: "airlock/pixel/linkedin",
    endpoint,
    eventMap: {
      page_view: null,
      // the base tag: fires with NO event-name/conversionId key at all
      lead: conversionId
      // a conversion: the "vendor event" IS the conversion id itself
    },
    paramMap: {
      pid: { from: "static", value: partnerId },
      fmt: { from: "static", value: "gif" },
      conversionId: { from: "event" }
      // omitted for page_view (null vendorEvent), present for lead
    },
    egressPurposes: LINKEDIN_EGRESS_PURPOSES
  };
}

// connectors/pixel/vendors/bing.js
var BING_UET_ENDPOINT = "https://bat.bing.com/action/0";
var SYNTHETIC_BING_TAG_ID = "00000000";
var BING_EGRESS_PURPOSES = ["ad_storage"];
function createBingUetConfig({ tagId = SYNTHETIC_BING_TAG_ID, endpoint = BING_UET_ENDPOINT } = {}) {
  return {
    name: "airlock/pixel/bing",
    endpoint,
    eventMap: {
      page_view: "pageLoad",
      lead: "custom"
    },
    paramMap: {
      ti: { from: "static", value: tagId },
      evt: { from: "event" },
      gv: { from: "params", key: "value" },
      ec: { from: "params", key: "event_category" }
    },
    egressPurposes: BING_EGRESS_PURPOSES
  };
}

// adapters/eds/cookies.js
function createCookieCapability(doc = typeof document !== "undefined" ? document : void 0) {
  return {
    async get(name) {
      const jar = doc && doc.cookie || "";
      for (const pair of jar.split(";")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        if (pair.slice(0, eq).trim() !== name) continue;
        const raw = pair.slice(eq + 1).trim();
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
      return null;
    },
    async set(name, value, opts = {}) {
      if (!doc) return;
      let str = `${name}=${encodeURIComponent(value)}`;
      if (opts.maxAge !== void 0) str += `; max-age=${opts.maxAge}`;
      if (opts.path) str += `; path=${opts.path}`;
      if (opts.domain) str += `; domain=${opts.domain}`;
      if (opts.sameSite) str += `; samesite=${opts.sameSite}`;
      if (opts.secure) str += "; secure";
      doc.cookie = str;
    }
  };
}

// adapters/eds/exposure.js
var EXPOSURE_EVENT = "experiment_impression";
function readAppliedExperiment(doc) {
  const dataset = doc && doc.body && doc.body.dataset;
  if (!dataset) return null;
  const experimentId = dataset.experiment;
  const variantId = dataset.variant;
  if (!experimentId || !variantId) return null;
  return { experimentId, variantId };
}
function createExposureReporter(handle, { seen = /* @__PURE__ */ new Set() } = {}) {
  const report = (experimentId, variantId) => {
    if (!experimentId || !variantId) return;
    const key = `${experimentId}:${variantId}`;
    if (seen.has(key)) return;
    seen.add(key);
    handle.push({ event: EXPOSURE_EVENT, experiment_id: experimentId, variant_id: variantId });
  };
  return {
    /**
     * AC1 — eager page-level exposure: read the applied variant from the durable
     * body dataset and report it once. No experiment applied → no event.
     */
    reportFromBody(doc) {
      const applied = readAppliedExperiment(doc);
      if (!applied) return;
      report(applied.experimentId, applied.variantId);
    },
    /**
     * AC2 — post-boot exposure: the `aem:experimentation` CustomEvent's `detail`
     * carries `experiment`/`variant` (testbed plugin). Deduped against the boot read.
     */
    onAemExperimentation(detail) {
      if (!detail) return;
      report(detail.experiment, detail.variant);
    }
  };
}

// adapters/eds/blocks.js
var VIEW_BLOCK_EVENT = "view_block";
var metaMap = /* @__PURE__ */ new WeakMap();
function discoverBlocks(main) {
  if (!main || typeof main.querySelectorAll !== "function") return [];
  return Array.from(main.querySelectorAll("[data-block-status]"));
}
function blockName(el) {
  if (!el) return null;
  const fromData = el.dataset && el.dataset.blockName;
  if (fromData) return fromData;
  const cls = el.classList && el.classList[0];
  return cls || null;
}
function createBlockInstrumenter(handle, { observerFactory } = {}) {
  const onIntersect = (entries, observer) => {
    for (const entry of entries || []) {
      if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      const target = entry.target;
      const meta = metaMap.get(target);
      if (!meta) continue;
      handle.push({ event: VIEW_BLOCK_EVENT, block_name: meta.block_name });
      if (observer && typeof observer.unobserve === "function") observer.unobserve(target);
    }
  };
  return {
    /**
     * Instrument the decorated blocks within `main`: associate each in the WeakMap
     * (no DOM write) and register it for a first-view report at threshold 0.5. A
     * no-op when there is no observer factory, no `main`, or no blocks.
     */
    instrument(main) {
      if (typeof observerFactory !== "function") return;
      const blocks = discoverBlocks(main);
      if (blocks.length === 0) return;
      const observer = observerFactory(onIntersect, { threshold: 0.5 });
      if (!observer || typeof observer.observe !== "function") return;
      for (const block of blocks) {
        metaMap.set(block, { block_name: blockName(block) });
        observer.observe(block);
      }
    }
  };
}

// connectors/helix-rum/cwv-capture.js
function isScalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function projectCwv(metric) {
  const projected = { name: metric && metric.name, value: metric && metric.value };
  const attribution = metric && metric.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of Object.keys(attribution)) {
      if (isScalar(attribution[key])) projected[key] = attribution[key];
    }
  }
  return projected;
}
function startCwvCapture({ push, onLCP, onCLS, onINP }) {
  const onMetric = (metric) => push({ event: "cwv", ...projectCwv(metric) });
  onLCP(onMetric);
  onCLS(onMetric);
  onINP(onMetric);
}

// connectors/helix-rum/connector.js
var DEFAULT_COLLECT_BASE_URL = "https://ot.aem.live";
var DEFAULT_WEIGHT = RATE_WEIGHTS.medium;

// ../../../node_modules/web-vitals/dist/web-vitals.attribution.js
var t = class {
  t;
  o = 0;
  i = [];
  l(t2) {
    if (t2.hadRecentInput) return;
    const n2 = this.i[0], e2 = this.i.at(-1);
    this.o && n2 && e2 && t2.startTime - e2.startTime < 1e3 && t2.startTime - n2.startTime < 5e3 ? (this.o += t2.value, this.i.push(t2)) : (this.o = t2.value, this.i = [t2]), this.t?.(t2);
  }
};
var n = () => {
  const t2 = performance.getEntriesByType("navigation")[0];
  if (t2 && t2.responseStart > 0 && t2.responseStart < performance.now()) return t2;
};
var e = (t2) => {
  if ("loading" === document.readyState) return "loading";
  const e2 = n();
  if (e2) {
    if (t2 < e2.domInteractive) return "loading";
    if (0 === e2.domContentLoadedEventStart || t2 < e2.domContentLoadedEventStart) return "dom-interactive";
    if (0 === e2.domComplete || t2 < e2.domComplete) return "dom-content-loaded";
  }
  return "complete";
};
var o = (t2) => {
  const n2 = t2.nodeName;
  return 1 === t2.nodeType ? n2.toLowerCase() : n2.toUpperCase().replace(/^#/, "");
};
var i = (t2) => {
  let n2 = "";
  try {
    for (; 9 !== t2?.nodeType; ) {
      const e2 = t2, i2 = e2.id ? "#" + e2.id : [o(e2), ...Array.from(e2.classList ?? []).sort()].join(".");
      if (n2.length + i2.length > 99) return n2 || i2;
      if (n2 = n2 ? i2 + ">" + n2 : i2, e2.id) break;
      t2 = e2.parentNode;
    }
  } catch {
  }
  return n2;
};
var a = /* @__PURE__ */ new WeakMap();
function r(t2, n2) {
  let e2 = a.get(n2);
  return e2 || (e2 = /* @__PURE__ */ new WeakMap(), a.set(n2, e2)), e2.get(t2) || e2.set(t2, new n2()), e2.get(t2);
}
var s = -1;
var c = () => s;
var f = (t2) => {
  addEventListener("pageshow", (n2) => {
    n2.persisted && (s = n2.timeStamp, t2(n2));
  }, true);
};
var l = (t2, n2, e2, o2) => {
  let i2, a2;
  return (r2) => {
    n2.value >= 0 && (r2 || o2) && (a2 = n2.value - (i2 ?? 0), (a2 || void 0 === i2) && (i2 = n2.value, n2.delta = a2, n2.rating = ((t3, n3) => t3 > n3[1] ? "poor" : t3 > n3[0] ? "needs-improvement" : "good")(n2.value, e2), t2(n2)));
  };
};
var u = (t2) => {
  requestAnimationFrame(() => requestAnimationFrame(() => t2()));
};
var d = () => n()?.activationStart ?? 0;
var h = -1;
var g = /* @__PURE__ */ new Set();
var v = () => "hidden" !== document.visibilityState || document.prerendering ? 1 / 0 : 0;
var p = (t2) => {
  if ("hidden" === document.visibilityState) {
    if ("visibilitychange" === t2.type) for (const t3 of g) t3();
    isFinite(h) || (h = "visibilitychange" === t2.type ? t2.timeStamp : 0, removeEventListener("prerenderingchange", p, true));
  }
};
var m = (t2 = false) => {
  if (t2 && (h = 1 / 0), h < 0) {
    const t3 = d(), n2 = document.prerendering ? void 0 : globalThis.performance.getEntriesByType("visibility-state").find((n3) => "hidden" === n3.name && n3.startTime >= t3)?.startTime;
    h = n2 ?? v(), addEventListener("visibilitychange", p, true), addEventListener("prerenderingchange", p, true), f(() => {
      setTimeout(() => {
        h = v();
      });
    });
  }
  return { get firstHiddenTime() {
    return h;
  }, onHidden(t3) {
    g.add(t3);
  } };
};
var y = (t2, e2 = -1, o2, i2 = 0, a2, r2, s2) => {
  const f2 = n(), l2 = f2?.navigationId || 0;
  let u2 = "navigate";
  o2 ? u2 = o2 : c() >= 0 ? u2 = "back-forward-cache" : f2 && (document.prerendering || d() > 0 ? u2 = "prerender" : document.wasDiscarded ? u2 = "restore" : f2.type && (u2 = f2.type.replace(/_/g, "-")));
  return { name: t2, value: e2, rating: "good", delta: 0, entries: [], id: `v6-${Date.now()}-${Math.floor(8999999999999 * Math.random()) + 1e12}`, navigationType: u2, navigationId: i2 || l2, navigationInteractionId: a2, navigationURL: r2 || f2?.name, navigationStartTime: s2 || 0 };
};
var b = (t2, n2, e2 = {}) => {
  try {
    const o2 = t2.filter((t3) => PerformanceObserver.supportedEntryTypes.includes(t3));
    if (o2.length > 0) {
      const t3 = new PerformanceObserver((t4) => {
        queueMicrotask(() => {
          const e3 = t4.getEntries();
          o2.length > 1 && e3.sort((t5, n3) => t5.startTime + t5.duration - (n3.startTime + n3.duration)), n2(e3);
        });
      });
      for (const n3 of o2) t3.observe({ type: n3, buffered: true, ...e2 });
      return t3;
    }
  } catch {
  }
};
var M = (t2) => globalThis.PerformanceObserver?.supportedEntryTypes?.includes("soft-navigation") && "function" == typeof globalThis.PerformanceSoftNavigation?.prototype?.getLargestInteractionContentfulPaint && t2 && t2.reportSoftNavs;
var T = (t2, n2) => {
  if (t2.set(n2.navigationId, n2), t2.size > 2) {
    const n3 = t2.keys().next().value;
    void 0 !== n3 && t2.delete(n3);
  }
};
var E = (t2) => {
  let n2 = false;
  return () => {
    n2 || (t2(), n2 = true);
  };
};
var D = class {
  u;
};
var w = (t2) => {
  document.prerendering ? addEventListener("prerenderingchange", t2, true) : t2();
};
var S = [1800, 3e3];
var k = (t2, n2 = {}) => {
  const e2 = M(n2);
  w(() => {
    const o2 = r(n2, D), i2 = m();
    let a2, s2 = y("FCP");
    const h2 = b(["paint"], (t3) => {
      for (const n3 of t3) "first-contentful-paint" === n3.name && (h2.disconnect(), n3.startTime < i2.firstHiddenTime && (s2.value = Math.max(n3.startTime - d(), 0), s2.entries.push(n3), s2.navigationId = n3.navigationId || s2.navigationId, a2(true)));
    });
    if (h2 && (a2 = l(t2, s2, S, n2.reportAllChanges), f((e3) => {
      s2 = y("FCP", -1, "back-forward-cache", s2.navigationId, s2.navigationInteractionId, s2.navigationURL, c()), a2 = l(t2, s2, S, n2.reportAllChanges), u(() => {
        s2.value = performance.now() - e3.timeStamp, a2(true);
      });
    })), e2) {
      b(["soft-navigation"], (e3) => {
        e3.forEach((e4) => {
          o2.u && e4.navigationId && T(o2.u, e4);
          const i3 = Math.max((e4.presentationTime || e4.paintTime || 0) - e4.startTime, 0);
          s2 = y("FCP", i3, "soft-navigation", e4.navigationId, e4.interactionId, e4.name, e4.startTime), a2 = l(t2, s2, S, n2.reportAllChanges), a2(true);
        });
      }, n2);
    }
  });
};
var L = [0.1, 0.25];
var P = (t2) => t2.find((t3) => 1 === t3.node?.nodeType) || t2[0];
var F = (n2, o2 = {}) => {
  const a2 = r(o2 = Object.assign({}, o2), t), s2 = /* @__PURE__ */ new WeakMap();
  a2.t = (t2) => {
    if (t2?.sources?.length) {
      const n3 = P(t2.sources), e2 = n3?.node;
      if (e2) {
        const t3 = o2.generateTarget?.(e2) ?? i(e2);
        s2.set(n3, t3);
      }
    }
  };
  ((n3, e2 = {}) => {
    const o3 = m();
    k(E(() => {
      let i2, a3 = y("CLS", 0);
      const s3 = r(e2, t), d2 = (t2, o4, r2, c2, f2) => {
        a3 = y("CLS", 0, t2, o4, r2, c2, f2), s3.o = 0, i2 = l(n3, a3, L, e2.reportAllChanges);
      }, h2 = (t2 = false) => {
        s3.o > a3.value && (a3.value = s3.o, a3.entries = s3.i), i2(t2);
      }, g2 = (t2) => {
        h2(true), d2("soft-navigation", t2.navigationId, t2.interactionId, t2.name, t2.startTime);
      }, v2 = (t2) => {
        for (const n4 of t2) "soft-navigation" !== n4.entryType ? s3.l(n4) : g2(n4);
        h2();
      }, p2 = ["layout-shift"];
      M(e2) && p2.push("soft-navigation");
      const m2 = b(p2, v2);
      m2 && (i2 = l(n3, a3, L, e2.reportAllChanges), o3.onHidden(() => {
        v2(m2.takeRecords()), i2(true);
      }), f(() => {
        d2("back-forward-cache", a3.navigationId, a3.navigationInteractionId, a3.navigationURL, c()), u(i2);
      }), setTimeout(i2));
    }));
  })((t2) => {
    n2(((t3) => {
      let n3 = {};
      if (t3.entries.length) {
        const o3 = t3.entries.reduce((t4, n4) => t4.value > n4.value ? t4 : n4);
        if (o3?.sources?.length) {
          const t4 = P(o3.sources);
          t4 && (n3 = { largestShiftTarget: s2.get(t4), largestShiftTime: o3.startTime, largestShiftValue: o3.value, largestShiftSource: t4, largestShiftEntry: o3, loadState: e(o3.startTime) });
        }
      }
      return Object.assign(t3, { attribution: n3 });
    })(t2));
  }, o2);
};
var C = 0;
var I = 1 / 0;
var B = 0;
var O = (t2) => {
  for (const n2 of t2) n2.interactionId && (I = Math.min(I, n2.interactionId), B = Math.max(B, n2.interactionId), C = B ? (B - I) / 7 + 1 : 0);
};
var j;
var A = () => j ? C : performance.interactionCount ?? 0;
var N = () => {
  "interactionCount" in performance || j || (j = b(["event"], O, { durationThreshold: 0 }));
};
var q = class {
  h = 0;
  v = [];
  p = /* @__PURE__ */ new Map();
  m;
  M;
  T() {
    return A() - this.h;
  }
  D() {
    this.h = A(), this.v.length = 0, this.p.clear();
  }
  S(t2) {
    const n2 = this.T(), e2 = Math.min(this.v.length - 1, Math.floor(n2 / 50));
    return !n2 || -1 !== e2 || "soft-navigation" !== t2 && "back-forward-cache" !== t2 ? this.v[e2] : { k: 8, id: -1, entries: [] };
  }
  l(t2) {
    if (this.m?.(t2), !t2.interactionId) return;
    const n2 = this.v.at(-1);
    let e2 = this.p.get(t2.interactionId);
    if (e2 || this.v.length < 10 || t2.duration > n2.k) {
      if (e2 ? t2.duration > e2.k ? (e2.entries = [t2], e2.k = t2.duration) : t2.duration === e2.k && t2.startTime === e2.entries[0].startTime && e2.entries.push(t2) : (e2 = { id: t2.interactionId, entries: [t2], k: t2.duration }, this.p.set(e2.id, e2), this.v.push(e2)), this.v.sort((t3, n3) => n3.k - t3.k), this.v.length > 10) {
        const t3 = this.v.splice(10);
        for (const n3 of t3) this.p.delete(n3.id);
      }
      this.M?.(e2);
    }
  }
};
var W = (t2) => {
  const n2 = "requestIdleCallback" in globalThis ? 1e3 : 0, e2 = globalThis.requestIdleCallback || setTimeout, o2 = globalThis.cancelIdleCallback || clearTimeout;
  if ("hidden" === document.visibilityState) t2();
  else {
    const i2 = E(t2);
    let a2 = -1;
    const r2 = () => {
      o2(a2), i2();
    };
    addEventListener("visibilitychange", r2, { once: true, capture: true }), a2 = e2(() => {
      removeEventListener("visibilitychange", r2, { capture: true }), i2();
    }, { timeout: n2 });
  }
};
var x = [200, 500];
var R = (t2, n2 = {}) => {
  const o2 = r(n2 = Object.assign({}, n2), q);
  let a2 = [], s2 = [], u2 = 0;
  const d2 = /* @__PURE__ */ new WeakMap(), h2 = /* @__PURE__ */ new WeakMap();
  let g2 = false;
  const v2 = () => {
    g2 || (W(p2), g2 = true);
  }, p2 = () => {
    const t3 = new Set(o2.v.map((t4) => d2.get(t4.entries[0]))), n3 = s2.length - 10;
    s2 = s2.filter((e3, o3) => o3 >= n3 || t3.has(e3));
    const e2 = /* @__PURE__ */ new Set();
    for (const t4 of s2) {
      const n4 = T2(t4.startTime, t4.processingEnd);
      for (const t5 of n4) e2.add(t5);
    }
    a2 = a2.filter((t4) => t4.startTime > u2 || e2.has(t4)), g2 = false;
  };
  o2.m = (t3) => {
    const e2 = t3.startTime + t3.duration;
    let o3;
    u2 = Math.max(u2, t3.processingEnd);
    for (let i2 = s2.length - 1; i2 >= 0; i2--) {
      const a3 = s2[i2];
      if (Math.abs(e2 - a3.renderTime) <= 8) {
        o3 = a3, o3.startTime = Math.min(t3.startTime, o3.startTime), o3.processingStart = Math.min(t3.processingStart, o3.processingStart), o3.processingEnd = Math.max(t3.processingEnd, o3.processingEnd), n2.includeProcessedEventEntries && o3.entries.push(t3);
        break;
      }
    }
    o3 || (o3 = { startTime: t3.startTime, processingStart: t3.processingStart, processingEnd: t3.processingEnd, renderTime: e2, entries: n2.includeProcessedEventEntries ? [t3] : [] }, s2.push(o3)), t3.interactionId && d2.set(t3, o3), v2();
  }, o2.M = (t3) => {
    if (!h2.get(t3)) {
      const e2 = t3.entries.find((t4) => t4.target)?.target;
      if (e2) {
        const o3 = n2.generateTarget?.(e2) ?? i(e2);
        h2.set(t3, o3);
      } else {
        const n3 = t3.entries.find((t4) => t4.targetSelector)?.targetSelector;
        n3 && h2.set(t3, n3);
      }
    }
  };
  const T2 = (t3, n3) => {
    const e2 = [];
    for (const o3 of a2) if (!(o3.startTime + o3.duration < t3)) {
      if (o3.startTime > n3) break;
      e2.push(o3);
    }
    return e2;
  }, E2 = (t3) => {
    if (0 === t3.entries.length) {
      const n4 = t3.navigationStartTime || 0, o3 = { processedEventEntries: [], longAnimationFrameEntries: [], inputDelay: 0, processingDuration: 0, presentationDelay: t3.value, loadState: e(n4) };
      return Object.assign(t3, { attribution: o3 });
    }
    const n3 = t3.entries[0], i2 = d2.get(n3), a3 = Math.max(i2.processingStart, n3.startTime), r2 = Math.max(n3.startTime + n3.duration, a3), s3 = Math.min(i2.processingEnd, r2), c2 = i2.entries.sort((t4, n4) => t4.processingStart - n4.processingStart), f2 = T2(n3.startTime, s3), l2 = o2.p.get(n3.interactionId), u3 = { interactionTarget: h2.get(l2), interactionType: n3.name.startsWith("key") ? "keyboard" : "pointer", interactionTime: n3.startTime, nextPaintTime: r2, processedEventEntries: c2, longAnimationFrameEntries: f2, inputDelay: a3 - n3.startTime, processingDuration: s3 - a3, presentationDelay: r2 - s3, loadState: e(n3.startTime), longestScript: void 0, totalScriptDuration: void 0, totalStyleAndLayoutDuration: void 0, totalPaintDuration: void 0, totalUnattributedDuration: void 0 };
    return ((t4) => {
      const n4 = t4.interactionTime, e2 = t4.nextPaintTime;
      if (!t4.longAnimationFrameEntries?.length || !n4 || !e2) return;
      const o3 = t4.inputDelay, i3 = t4.processingDuration;
      let a4, r3, s4 = 0, c3 = 0, f3 = 0, l3 = 0;
      for (const e3 of t4.longAnimationFrameEntries) {
        c3 = c3 + e3.startTime + e3.duration - e3.styleAndLayoutStart;
        for (const t5 of e3.scripts) {
          const e4 = t5.startTime + t5.duration;
          if (e4 < n4) continue;
          const f4 = e4 - Math.max(n4, t5.startTime), u5 = t5.duration ? f4 / t5.duration * t5.forcedStyleAndLayoutDuration : 0;
          s4 += f4 - u5, c3 += u5, f4 > l3 && (r3 = t5.startTime < n4 + o3 ? "input-delay" : t5.startTime >= n4 + o3 + i3 ? "presentation-delay" : "processing-duration", a4 = t5, l3 = f4);
        }
      }
      const u4 = t4.longAnimationFrameEntries.at(-1), d3 = u4 ? u4.startTime + u4.duration : 0;
      d3 >= n4 + o3 + i3 && (f3 = e2 - d3), a4 && r3 && (t4.longestScript = { entry: a4, subpart: r3, intersectingDuration: l3 }), t4.totalScriptDuration = s4, t4.totalStyleAndLayoutDuration = c3, t4.totalPaintDuration = f3, t4.totalUnattributedDuration = e2 - n4 - s4 - c3 - f3;
    })(u3), Object.assign(t3, { attribution: u3 });
  };
  b(["long-animation-frame"], (t3) => {
    a2 = a2.concat(t3), v2();
  }, n2), ((t3, n3 = {}) => {
    if (!globalThis.PerformanceEventTiming || !("interactionId" in PerformanceEventTiming.prototype)) return;
    const e2 = m();
    w(() => {
      N();
      let o3, i2 = y("INP");
      const a3 = r(n3, q), s3 = (e3, r2, s4, c2, f2) => {
        a3.D(), i2 = y("INP", -1, e3, r2, s4, c2, f2), o3 = l(t3, i2, x, n3.reportAllChanges);
      }, u3 = () => {
        const t4 = a3.S(i2.navigationType);
        t4 && t4.k !== i2.value && (i2.value = t4.k, i2.entries = t4.entries, o3());
      }, d3 = (t4) => {
        u3(), o3(true), s3("soft-navigation", t4.navigationId, t4.interactionId, t4.name, t4.startTime);
      }, h3 = (t4, n4 = false) => {
        W(() => {
          for (const n5 of t4) "soft-navigation" !== n5.entryType ? a3.l(n5) : d3(n5);
          u3(), n4 && o3(true);
        });
      }, g3 = ["event", "first-input"];
      M(n3) && g3.push("soft-navigation");
      const v3 = b(g3, h3, { ...n3, durationThreshold: n3.durationThreshold ?? 40 });
      o3 = l(t3, i2, x, n3.reportAllChanges), v3 && (e2.onHidden(() => {
        h3(v3.takeRecords(), true);
      }), f(() => {
        s3("back-forward-cache", i2.navigationId, i2.navigationInteractionId, i2.navigationURL, c());
      }));
    });
  })((n3) => {
    t2(E2(n3));
  }, n2);
};
var U = class {
  m;
  u;
  l(t2) {
    this.m?.(t2);
  }
};
var $ = [2500, 4e3];
var H = 50;
var V = [];
b(["resource"], (t2) => {
  for (const n2 of t2) V.push(n2), V.length > H && V.shift();
});
var z = (t2, e2 = {}) => {
  null != (e2 = Object.assign({}, e2)).resourceBufferSize && (H = e2.resourceBufferSize);
  const o2 = r(e2, U), a2 = /* @__PURE__ */ new WeakMap();
  M(e2) && (o2.u = /* @__PURE__ */ new Map()), o2.m = (t3) => {
    const n2 = t3.element;
    if (n2) {
      const o3 = e2.generateTarget?.(n2) ?? i(n2);
      a2.set(t3, o3);
    } else t3.id && a2.set(t3, `#${t3.id}`);
  };
  ((t3, n2 = {}) => {
    let e3 = false;
    const o3 = M(n2);
    w(() => {
      let i2, a3 = m(), s2 = y("LCP");
      const h2 = r(n2, U), g2 = (o4, r2, c2, f2, u2) => {
        s2 = y("LCP", -1, o4, r2, c2, f2, u2), i2 = l(t3, s2, $, n2.reportAllChanges), e3 = false, "soft-navigation" === o4 && (a3 = m(true));
      }, v2 = (t4) => {
        h2.u && t4.navigationId && T(h2.u, t4), e3 || i2(true), g2("soft-navigation", t4.navigationId, t4.interactionId, t4.name, t4.startTime);
        const n3 = t4.getLargestInteractionContentfulPaint?.();
        n3 && p2([n3]);
      }, p2 = (t4) => {
        n2.reportAllChanges || o3 || (t4 = t4.slice(-1));
        for (const n3 of t4) {
          if (!n3) continue;
          if ("soft-navigation" === n3.entryType) {
            v2(n3);
            continue;
          }
          let t5 = 0, e4 = [], o4 = n3.startTime;
          if ("largest-contentful-paint" === n3.entryType) t5 = Math.max(n3.startTime - d(), 0), h2.l(n3), e4 = [n3];
          else if ("interaction-contentful-paint" === n3.entryType) {
            const i3 = n3;
            if (!s2.navigationId) continue;
            if ("interactionId" in i3 && i3.interactionId != s2.navigationInteractionId) continue;
            o4 = i3.largestContentfulPaint?.renderTime || 0, t5 = Math.max(o4 - n3.startTime, 0), i3.largestContentfulPaint && (h2.l(i3.largestContentfulPaint), e4 = [i3.largestContentfulPaint]);
          }
          o4 < a3.firstHiddenTime && (s2.value = t5, s2.entries = e4, i2());
        }
      }, M2 = ["largest-contentful-paint"];
      o3 && M2.push("interaction-contentful-paint", "soft-navigation");
      const E2 = b(M2, p2);
      if (E2) {
        i2 = l(t3, s2, $, n2.reportAllChanges);
        const a4 = ["keydown", "click", "visibilitychange"], r2 = (t4) => {
          if (t4.isTrusted && !e3) {
            const t5 = s2.id;
            W(() => {
              if (!e3) {
                if (!o3) {
                  E2.disconnect();
                  for (const t6 of a4) removeEventListener(t6, r2, { capture: true });
                }
                t5 === s2.id && (e3 = true, i2(true));
              }
            });
          }
        };
        for (const t4 of a4) addEventListener(t4, r2, { capture: true });
        f((o4) => {
          g2("back-forward-cache", s2.navigationId, s2.navigationInteractionId, s2.navigationURL, c()), i2 = l(t3, s2, $, n2.reportAllChanges), u(() => {
            s2.value = performance.now() - o4.timeStamp, e3 = true, i2(true);
          });
        });
      }
    });
  })((e3) => {
    t2(((t3) => {
      let e4 = { timeToFirstByte: 0, resourceLoadDelay: 0, resourceLoadDuration: 0, elementRenderDelay: t3.value };
      if (t3.entries.length) {
        const i2 = t3.entries.at(-1), r2 = i2.url && (V.findLast((t4) => t4.name === i2.url) || performance.getEntriesByType("resource").findLast((t4) => t4.name === i2.url));
        let s2;
        e4.target = a2.get(i2), e4.lcpEntry = i2, i2.url && (e4.url = i2.url), r2 && (e4.lcpResourceEntry = r2);
        let c2 = 0, f2 = 0;
        if ("soft-navigation" !== t3.navigationType ? (s2 = n(), c2 = s2?.activationStart ?? 0, f2 = s2?.responseStart ?? 0) : (c2 = t3.navigationStartTime || 0, s2 = o2.u?.get(t3.navigationId)), s2) {
          const n2 = Math.max(0, f2 - c2), o3 = Math.max(n2, r2 ? (r2.requestStart || r2.startTime) - c2 : 0), i3 = Math.min(t3.value, Math.max(o3, r2 ? r2.responseEnd - c2 : 0));
          e4 = { ...e4, timeToFirstByte: n2, resourceLoadDelay: o3 - n2, resourceLoadDuration: i3 - o3, elementRenderDelay: t3.value - i3, navigationEntry: s2 };
        }
      }
      return Object.assign(t3, { attribution: e4 });
    })(e3));
  }, e2);
};

// adapters/eds/index.js
var DEFAULT_ENDPOINTS = ["https://www.google-analytics.com/mp/collect"];
var GA4_EGRESS_PURPOSES = ["analytics_storage"];
var UC2_EVENTS = {
  engage: "cta_engage",
  // AC1: non-navigating CTA → steady-state worker cycle (push)
  outbound: "outbound_click",
  // AC2: navigating anchor leaving the page → fast path (pushCritical)
  closing: "page_view"
  // AC2: closing beacon on pagehide → fast path (pushCritical)
};
function pageOrigin(loc) {
  try {
    return new URL(loc.href).origin;
  } catch {
    return null;
  }
}
function navigatesAway(anchor, loc) {
  const href = anchor && anchor.href;
  if (typeof href !== "string" || href.length === 0) return false;
  let url;
  try {
    url = new URL(href, loc.href);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const origin = pageOrigin(loc);
  if (origin && url.origin !== origin) return true;
  return url.pathname === "/signup";
}
function opensElsewhere(e2, anchor) {
  if (e2.defaultPrevented || e2.metaKey || e2.ctrlKey || e2.shiftKey || e2.altKey) return true;
  if (!anchor) return false;
  if (anchor.target === "_blank") return true;
  return typeof anchor.hasAttribute === "function" && anchor.hasAttribute("download");
}
function wireInteractions(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : void 0);
  const win = io.win || (typeof window !== "undefined" ? window : void 0);
  const loc = io.loc || (typeof location !== "undefined" ? location : void 0);
  if (!doc || !win || !loc || typeof doc.addEventListener !== "function") return;
  if (doc.__airlockWired) return;
  doc.__airlockWired = true;
  doc.addEventListener("click", (e2) => {
    const t2 = e2 && e2.target;
    if (!t2 || typeof t2.closest !== "function") return;
    const engage = t2.closest("#cta-engage");
    if (engage) {
      const label = String(engage.textContent || "").trim().slice(0, 100);
      handle.push({ event: UC2_EVENTS.engage, link_text: label, page_location: loc.href });
      return;
    }
    const anchor = t2.closest("a[href]");
    if (anchor && !opensElsewhere(e2, anchor) && navigatesAway(anchor, loc)) {
      handle.pushCritical({
        event: UC2_EVENTS.outbound,
        link_url: anchor.href,
        page_location: loc.href
      });
    }
  });
  win.addEventListener("pagehide", () => {
    handle.pushCritical({ event: UC2_EVENTS.closing, page_location: loc.href });
  });
}
function wireExposure(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : void 0);
  if (!doc || typeof doc.addEventListener !== "function") return;
  if (doc.__airlockExposureWired) return;
  doc.__airlockExposureWired = true;
  const reporter = createExposureReporter(handle, { seen: /* @__PURE__ */ new Set() });
  reporter.reportFromBody(doc);
  doc.addEventListener(
    "aem:experimentation",
    (e2) => reporter.onAemExperimentation(e2 && e2.detail)
  );
}
function wireBlocks(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : void 0);
  const win = io.win || (typeof window !== "undefined" ? window : void 0);
  if (!doc || typeof doc.querySelector !== "function") return;
  if (doc.__airlockBlocksWired) return;
  const IntersectionObserverCtor = win && win.IntersectionObserver;
  if (typeof IntersectionObserverCtor !== "function") return;
  const main = doc.querySelector("main");
  if (!main) return;
  doc.__airlockBlocksWired = true;
  const observerFactory = (cb, opts) => new IntersectionObserverCtor(cb, opts);
  createBlockInstrumenter(handle, { observerFactory }).instrument(main);
}
async function bootEdsAnalytics(opts = {}) {
  const {
    ctx: providedCtx,
    consent,
    consentStrict = false,
    endpoints = DEFAULT_ENDPOINTS,
    trackers = endpoints.length,
    payloadDenylist
  } = opts;
  const storageGranted = consent ? resolveConsent(consent, "analytics_storage") === "granted" : true;
  const ctx = providedCtx ?? await sourceGa4Ctx({
    cookies: createCookieCapability(document),
    cookieString: document.cookie,
    storageGranted
  });
  const shapedConsent = consent ? shapeMpConsent(consent) : void 0;
  const ctxWithConsent = shapedConsent ? { ...ctx, consent: shapedConsent } : ctx;
  const airlock = createAirlock({
    trackers,
    workFactor: 0,
    endpoints,
    ctx: ctxWithConsent,
    consent,
    egressPurposes: consent ? GA4_EGRESS_PURPOSES : [],
    consentStrict,
    payloadDenylist
  });
  const handle = {
    push: (evt) => airlock.push(evt),
    pushCritical: (evt) => airlock.pushCritical(evt),
    setConsent: (v2) => airlock.setConsent(v2),
    // 017-03 AC2: mid-session grant -> flushes held beacons
    getState: (path) => airlock.getState(path),
    // whole projection or dotted-path read (push-api.md)
    flushNow: () => airlock.flushNow(),
    // force-drain the ring to the worker (deterministic teardown/test)
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose()
    // 021-01 AC1: tear down this instance's Worker + unload listeners
  };
  if (typeof window !== "undefined") {
    if (window.airlock && typeof window.airlock.dispose === "function") window.airlock.dispose();
    window.airlock = handle;
  }
  wireInteractions(handle);
  wireExposure(handle);
  wireBlocks(handle);
  return handle;
}
async function bootMetaPixel(opts = {}) {
  const { pixelId, endpoint, consent, consentStrict = false, payloadDenylist } = opts;
  const connectorConfig = createMetaPixelConfig({ pixelId, endpoint });
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {},
    // no host-sourced identity crosses into a pixel instance (026-01 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? META_EGRESS_PURPOSES : [],
    consentStrict,
    payloadDenylist
  });
  return {
    push: (evt) => airlock.push(evt),
    setConsent: (v2) => airlock.setConsent(v2),
    getState: (path) => airlock.getState(path),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose()
  };
}
async function bootLinkedInInsight(opts = {}) {
  const { partnerId, conversionId, endpoint, consent, consentStrict = false, payloadDenylist } = opts;
  const connectorConfig = createLinkedInInsightConfig({ partnerId, conversionId, endpoint });
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {},
    // no host-sourced identity crosses into a pixel instance (026-01/026-02 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? LINKEDIN_EGRESS_PURPOSES : [],
    consentStrict,
    payloadDenylist
  });
  return {
    push: (evt) => airlock.push(evt),
    setConsent: (v2) => airlock.setConsent(v2),
    getState: (path) => airlock.getState(path),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose()
  };
}
async function bootBingUet(opts = {}) {
  const { tagId, endpoint, consent, consentStrict = false, payloadDenylist } = opts;
  const connectorConfig = createBingUetConfig({ tagId, endpoint });
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {},
    // no host-sourced identity crosses into a pixel instance (026-01/026-02 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? BING_EGRESS_PURPOSES : [],
    consentStrict,
    payloadDenylist
  });
  return {
    push: (evt) => airlock.push(evt),
    setConsent: (v2) => airlock.setConsent(v2),
    getState: (path) => airlock.getState(path),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose()
  };
}
function bootHelixRum(opts = {}) {
  const {
    collectBaseURL = DEFAULT_COLLECT_BASE_URL,
    rate,
    weight: weightOverride,
    referer = typeof document !== "undefined" && document.referrer || "",
    forceSelect,
    onLCP: onLCPImpl = z,
    onCLS: onCLSImpl = F,
    onINP: onINPImpl = R
  } = opts;
  const weight = resolveWeight({ rate, weight: weightOverride });
  const id = crypto.randomUUID().slice(-9);
  const isSelected = forceSelect !== void 0 ? !!forceSelect : weight > 0 && Math.random() * weight < 1;
  const endpoint = rumUrl(collectBaseURL, weight);
  if (!isSelected) {
    const noop = () => {
    };
    return { push: noop, pushCritical: noop, setConsent: noop, getState: () => void 0, flushNow: noop, stats: () => ({}), dispose: noop, sampled: false };
  }
  const ctx = { referer };
  const airlock = createAirlock({
    connector: "helix-rum",
    // The worker connector gets the SAME sampling (id/weight/isSelected) so its
    // steady-state beacons match; `sampling` also drives the main-thread unload
    // mapper (mapToRum) via core/airlock.js's 030-01 criticalMapper selection.
    connectorConfig: { collectBaseURL, weight, id, isSelected: true, ctx, sampling: { weight, id } },
    endpoints: [endpoint],
    // host-owned ceiling (ADR-0006) — byte-matches the connector's endpoint
    ctx,
    egressPurposes: [],
    // RUM governance class: confined, NOT consent-gated (spec 022)
    trackers: 1
  });
  const push = (evt) => airlock.push(evt);
  push({ event: "top" });
  if (typeof addEventListener === "function") {
    addEventListener("error", (e2) => push({ event: "error", source: e2 && e2.filename, target: e2 && e2.message }));
    addEventListener("unhandledrejection", (e2) => push({ event: "error", source: "unhandledrejection", target: e2 && String(e2.reason) }));
    addEventListener("securitypolicyviolation", (e2) => push({ event: "error", source: e2 && e2.blockedURI, target: e2 && e2.violatedDirective }));
  }
  startCwvCapture({ push, onLCP: onLCPImpl, onCLS: onCLSImpl, onINP: onINPImpl });
  return {
    push,
    pushCritical: (evt) => airlock.pushCritical(evt),
    setConsent: (v2) => airlock.setConsent(v2),
    getState: (p2) => airlock.getState(p2),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose(),
    sampled: true
  };
}
var eds_default = bootEdsAnalytics;
export {
  BING_EGRESS_PURPOSES,
  LINKEDIN_EGRESS_PURPOSES,
  META_EGRESS_PURPOSES,
  UC2_EVENTS,
  bootBingUet,
  bootEdsAnalytics,
  bootHelixRum,
  bootLinkedInInsight,
  bootMetaPixel,
  eds_default as default,
  wireBlocks,
  wireExposure,
  wireInteractions
};
