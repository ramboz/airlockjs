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

// core/config-integrity.js
function outboundTenants(url, tenantKey) {
  try {
    return new URL(url, "https://airlock.local").searchParams.getAll(tenantKey);
  } catch {
    return [];
  }
}
function hostOf(url) {
  try {
    return new URL(url, "https://airlock.local").host;
  } catch {
    return null;
  }
}
function schemeOf(url) {
  try {
    return new URL(url, "https://airlock.local").protocol;
  } catch {
    return null;
  }
}
var DEFAULT_PINNED_SCHEME = "https:";
function normalizeScheme(scheme) {
  if (!scheme) return null;
  const s2 = String(scheme).toLowerCase();
  return s2.endsWith(":") ? s2 : `${s2}:`;
}
function checkConfigIntegrity(url, pin) {
  const { pinnedHost, tenantKey, pinnedTenant, pinnedScheme } = pin || {};
  if (!pinnedHost || !tenantKey || !pinnedTenant) {
    return {
      verdict: "hold",
      host: hostOf(url),
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: incomplete pin (misconfiguration)"
    };
  }
  const host = hostOf(url);
  if (host !== pinnedHost) {
    return {
      verdict: "hold",
      host,
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: outbound host != pinned host (foreign-host egress)"
    };
  }
  const expectedScheme = normalizeScheme(pinnedScheme) || DEFAULT_PINNED_SCHEME;
  if (schemeOf(url) !== expectedScheme) {
    return {
      verdict: "hold",
      host,
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: outbound scheme != pinned scheme (transport downgrade)"
    };
  }
  const tenants = outboundTenants(url, tenantKey);
  if (tenants.length === 0) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: no ${tenantKey} on the interact` };
  }
  if (tenants.length > 1) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: multiple ${tenantKey} params (parameter pollution)` };
  }
  if (tenants[0] !== pinnedTenant) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: outbound ${tenantKey} != host-pinned tenant (same-host tenant re-route)` };
  }
  return { verdict: "allow", host, outboundTenants: tenants, reason: "ok" };
}
function pinnedDispatchUrl(url, pin) {
  const u2 = new URL(url, "https://airlock.local");
  u2.protocol = normalizeScheme(pin.pinnedScheme) || DEFAULT_PINNED_SCHEME;
  u2.host = pin.pinnedHost;
  u2.searchParams.delete(pin.tenantKey);
  u2.searchParams.set(pin.tenantKey, pin.pinnedTenant);
  return u2.toString();
}

// core/cookie-scope.js
var COOKIE_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
function isValidCookieName(name) {
  return typeof name === "string" && COOKIE_NAME_TOKEN.test(name);
}
function matchesGrantedName(name, grantedNames) {
  if (typeof name !== "string" || !Array.isArray(grantedNames)) return false;
  return grantedNames.some((entry) => typeof entry === "string" && (entry.endsWith("_") ? name.startsWith(entry) : name === entry));
}
function scopeSeedCookies(jar, grantedNames) {
  if (typeof jar !== "string" || !jar.trim()) return "";
  return jar.split(";").map((pair) => pair.trim()).filter((pair) => pair.includes("=")).filter((pair) => matchesGrantedName(pair.slice(0, pair.indexOf("=")).trim(), grantedNames)).join("; ");
}

// core/wrapped-sdk-host.js
function consoleDiagnostic2(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}
function createWrappedSdkHost({
  chamber,
  caps,
  timeoutMs = 5e3,
  configIntegrity = null,
  endpointCeiling = null,
  consent = null,
  egressPurposes = [],
  payloadDenylist = null,
  grantedCookieNames = null,
  onDiagnostic
}) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic2;
  const inspectorTag = (Math.random().toString(36).slice(2) + "000000").slice(0, 6);
  if (consent && !egressPurposes.length) {
    diagnose({
      level: "warn",
      kind: "consent",
      disposition: "not-enforced",
      reason: "consent vector wired without egressPurposes \u2014 the TRUSTED seam-side drop is OFF; only the in-chamber setConsent delegate is active"
    });
  }
  const state = {
    phases: [],
    writeBacks: [],
    mainDispatch: { count: 0, requests: [] },
    summary: null,
    ready: [],
    fatal: null,
    held: 0,
    overridden: 0,
    ceilingHeld: 0,
    consentHeld: 0,
    cookieScopeHeld: 0
  };
  let queuedEvent = null;
  let onResult = null;
  let configured = false;
  function dispatchInterceptedFetch(m2) {
    if (endpointCeiling) {
      const c2 = checkEndpointCeiling(m2.url, endpointCeiling);
      if (c2.verdict === "hold") {
        state.ceilingHeld += 1;
        diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c2.destination, reason: c2.reason, beaconId: `${inspectorTag}#${m2.id}` });
        chamber.postMessage({ type: "intercepted-fetch-response", id: m2.id, status: 0, statusText: "held at the seal: endpoint-ceiling", body: "" });
        return;
      }
    }
    const runConfigIntegrity = configIntegrity && (!endpointCeiling || hostOf(m2.url) === configIntegrity.pinnedHost);
    if (runConfigIntegrity) {
      const check = checkConfigIntegrity(m2.url, configIntegrity);
      if (check.verdict === "hold") {
        const pinComplete = !!(configIntegrity.pinnedHost && configIntegrity.tenantKey && configIntegrity.pinnedTenant);
        if (configIntegrity.disposition === "override" && pinComplete) {
          state.overridden += 1;
          diagnose({ level: "error", kind: "config-integrity", disposition: "overridden", reason: check.reason, beaconId: `${inspectorTag}#${m2.id}`, destination: hostOf(m2.url) });
          m2 = { ...m2, url: pinnedDispatchUrl(m2.url, configIntegrity) };
        } else {
          state.held += 1;
          diagnose({ level: "error", kind: "config-integrity", disposition: "held", reason: check.reason, beaconId: `${inspectorTag}#${m2.id}`, destination: hostOf(m2.url) });
          chamber.postMessage({ type: "intercepted-fetch-response", id: m2.id, status: 0, statusText: "held at the seal: config-integrity", body: "" });
          return;
        }
      }
    } else if (endpointCeiling && configIntegrity && hostOf(m2.url) !== configIntegrity.pinnedHost) {
      diagnose({
        level: "warn",
        kind: "config-integrity",
        disposition: "unpinned-declared-origin",
        reason: "config-integrity: declared origin is not the tenant-pinned host \u2014 tenant NOT checked here (multi-tenant-pin follow-up)"
      });
    }
    if (egressPurposes.length) {
      const splitPersonalization = egressPurposes.includes("personalization") && resolveConsent(consent, "personalization") !== "granted" && egressPurposes.some((p2) => p2 !== "personalization");
      const effectivePurposes = splitPersonalization ? egressPurposes.filter((p2) => p2 !== "personalization") : egressPurposes;
      const verdict = egressVerdict(consent, effectivePurposes, { strict: true });
      if (verdict !== "send") {
        state.consentHeld += 1;
        diagnose({
          level: "warn",
          kind: "consent",
          disposition: "held",
          purpose: egressPurposes.join(","),
          reason: "un-granted governing purpose \u2014 alloy interact held at the seal",
          beaconId: `${inspectorTag}#${m2.id}`,
          destination: hostOf(m2.url)
        });
        chamber.postMessage({ type: "intercepted-fetch-response", id: m2.id, status: 0, statusText: "held at the seal: consent", body: "" });
        return;
      }
      if (splitPersonalization && m2.body) {
        const strippedBody = stripInterceptedPersonalizationQuery(
          m2.body,
          () => diagnose({
            level: "warn",
            kind: "consent",
            disposition: "personalization-stripped",
            purpose: "personalization",
            reason: "personalization un-granted \u2014 per-event query stripped; analytics-only interact dispatched",
            beaconId: `${inspectorTag}#${m2.id}`,
            destination: hostOf(m2.url)
          })
        );
        if (strippedBody !== m2.body) m2 = { ...m2, body: strippedBody };
      }
    }
    if (payloadDenylist && payloadDenylist.length && m2.body) {
      const strippedBody = stripInterceptedXdmBody(
        m2.body,
        payloadDenylist,
        (field) => diagnose({ level: "warn", kind: "payload-governance", disposition: "stripped", field }),
        (reason) => diagnose({ level: "error", kind: "payload-governance", disposition: "skipped", reason })
      );
      if (strippedBody !== m2.body) m2 = { ...m2, body: strippedBody };
    }
    state.mainDispatch.count += 1;
    state.mainDispatch.requests.push({ url: m2.url, method: m2.method, body: m2.body });
    let settled = false;
    const respond = (payload) => {
      if (settled) return;
      settled = true;
      chamber.postMessage({ type: "intercepted-fetch-response", id: m2.id, ...payload });
    };
    const timer = setTimeout(() => {
      respond({
        status: 0,
        statusText: `intercepted-fetch timed out after ${timeoutMs}ms (no main-thread response)`,
        body: ""
      });
    }, timeoutMs);
    Promise.resolve().then(() => caps.egress.dispatch({ url: m2.url, method: m2.method, headers: m2.headers, body: m2.body })).then((res) => {
      clearTimeout(timer);
      respond({
        status: res && res.status || 0,
        statusText: res && res.statusText || "",
        headers: res && res.headers || { "content-type": "application/json" },
        body: res && res.body != null ? res.body : ""
      });
    }).catch((err) => {
      clearTimeout(timer);
      respond({ status: 0, statusText: String(err && err.message || err), body: "" });
    });
  }
  function handleMessage(raw) {
    const m2 = raw || {};
    if (m2.type === "phase") {
      state.phases.push(m2.name);
      if (m2.name === "configured") {
        configured = true;
        if (queuedEvent) {
          const event = queuedEvent;
          queuedEvent = null;
          chamber.postMessage({ type: "event", event });
        }
      }
    } else if (m2.type === "intercepted-fetch") {
      dispatchInterceptedFetch(m2);
    } else if (m2.type === "decisions") {
      if (caps.decisions && typeof caps.decisions.deliver === "function") {
        try {
          caps.decisions.deliver(m2.decisions);
        } catch (e2) {
        }
      }
    } else if (m2.type === "cookie-writeback") {
      state.writeBacks.push(m2.value);
      const cookieName = String(m2.value).split("=")[0].trim();
      const invalidName = grantedCookieNames && !isValidCookieName(cookieName);
      const ungranted = grantedCookieNames && !invalidName && !matchesGrantedName(cookieName, grantedCookieNames);
      if (invalidName || ungranted) {
        state.cookieScopeHeld += 1;
        diagnose({
          level: "error",
          kind: "cookie-scope",
          disposition: "dropped",
          reason: invalidName ? "invalid cookie-name token \u2014 write-back dropped at the seal" : "un-granted cookie name \u2014 write-back dropped at the seal",
          name: cookieName
        });
      } else {
        const reconciled = reconcileForBrokerJar(m2.value);
        if (caps.cookies && typeof caps.cookies.reconcile === "function") {
          try {
            caps.cookies.reconcile(reconciled);
          } catch (e2) {
          }
        }
      }
    } else if (m2.type === "result") {
      state.summary = m2.summary;
      state.ready = m2.ready || [];
      if (onResult) {
        const { resolve } = onResult;
        onResult = null;
        resolve({ summary: m2.summary, ready: m2.ready || [] });
      }
    } else if (m2.type === "fatal") {
      state.fatal = m2;
      if (onResult) {
        const { reject } = onResult;
        onResult = null;
        reject(Object.assign(new Error(m2.message || "chamber fatal"), { detail: m2 }));
      }
    }
  }
  chamber.onMessage(handleMessage);
  return {
    /** Boot the chamber: posts `{ type: "init", ...initMsg }`. */
    init(initMsg) {
      chamber.postMessage({ type: "init", ...initMsg || {} });
    },
    /**
     * Drive one page event through the chamber, and settle when the chamber
     * reports back — resolves `{ summary, ready }` on `result`, rejects on
     * `fatal`. Single-slot: exactly one event may be in flight at a time
     * (re-entry is rejected), but — unlike 014-01 — the host may be driven
     * REPEATEDLY once configured (033-02 AC2). Before the chamber reports
     * `phase:"configured"`, the event is QUEUED and sent on that message (the
     * unchanged 014-01 boot flow); AFTER configured, the chamber is already
     * live, so the event is posted IMMEDIATELY. The adapter (bootAlloy)
     * serializes its `push`/`pushCritical` through this call so the re-entry
     * guard is never tripped — one page event per host round-trip, N in
     * sequence.
     */
    driveEvent(event) {
      return new Promise((resolve, reject) => {
        if (onResult) {
          reject(new Error("driveEvent already in flight \u2014 call once, after init()"));
          return;
        }
        onResult = { resolve, reject };
        if (configured) {
          chamber.postMessage({ type: "event", event });
        } else {
          queuedEvent = event;
        }
      });
    },
    /** A snapshot of everything observed so far (for rig/test assertions). */
    getState() {
      return {
        phases: state.phases.slice(),
        writeBacks: state.writeBacks.slice(),
        mainDispatch: { count: state.mainDispatch.count, requests: state.mainDispatch.requests.slice() },
        summary: state.summary,
        ready: state.ready.slice(),
        fatal: state.fatal,
        held: state.held,
        overridden: state.overridden,
        ceilingHeld: state.ceilingHeld,
        consentHeld: state.consentHeld,
        cookieScopeHeld: state.cookieScopeHeld
      };
    }
  };
}
function reconcileForBrokerJar(raw) {
  return String(raw).split(";").map((s2) => s2.trim()).filter((seg) => {
    const s2 = seg.toLowerCase();
    return !s2.startsWith("domain=") && s2 !== "secure" && !s2.startsWith("samesite=");
  }).join("; ");
}
function stripInterceptedXdmBody(rawBody, denylist, onStripped, onError) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (e2) {
    return rawBody;
  }
  if (!parsed || !Array.isArray(parsed.events)) return rawBody;
  let changed = false;
  const events = parsed.events.map((evt) => {
    if (!evt || typeof evt !== "object" || evt.xdm == null || typeof evt.xdm !== "object") return evt;
    const { governed, stripped, error } = governPayload(evt.xdm, denylist);
    if (error && typeof onError === "function") onError("govern-failed");
    if (!stripped.length) return evt;
    changed = true;
    for (const field of stripped) {
      if (typeof onStripped === "function") onStripped(field);
    }
    return { ...evt, xdm: governed };
  });
  return changed ? JSON.stringify({ ...parsed, events }) : rawBody;
}
function stripInterceptedPersonalizationQuery(rawBody, onStripped) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (e2) {
    return rawBody;
  }
  if (!parsed || !Array.isArray(parsed.events)) return rawBody;
  let changed = false;
  const events = parsed.events.map((evt) => {
    if (!evt || typeof evt !== "object" || evt.query == null || typeof evt.query !== "object") return evt;
    if (!Object.prototype.hasOwnProperty.call(evt.query, "personalization")) return evt;
    changed = true;
    if (typeof onStripped === "function") onStripped();
    const nextQuery = { ...evt.query };
    delete nextQuery.personalization;
    if (Object.keys(nextQuery).length === 0) {
      const nextEvt = { ...evt };
      delete nextEvt.query;
      return nextEvt;
    }
    return { ...evt, query: nextQuery };
  });
  return changed ? JSON.stringify({ ...parsed, events }) : rawBody;
}

// connectors/alloy/decisions.js
var VIEW_SCOPE = "__view__";
var HTML_CONTENT_ITEM_SCHEMA = "https://ns.adobe.com/personalization/html-content-item";
function contentOf(x2) {
  return x2 && x2.content && typeof x2.content === "object" ? x2.content : x2;
}
function htmlOfDecision(decision) {
  const proposition = contentOf(decision);
  const items = proposition && Array.isArray(proposition.items) ? proposition.items : [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const data = item.data;
    const isHtml = item.schema === HTML_CONTENT_ITEM_SCHEMA || data && typeof data.content === "string" && /^text\/html/.test(String(data.format || ""));
    if (isHtml && data && typeof data.content === "string") return data.content;
  }
  return null;
}

// connectors/alloy/connector.js
var ALLOY_INTERACT_ENDPOINT = "https://adobedc.demdex.net/ee/v1/interact";
var ALLOY_COOKIE_NAMES = ["com.adobe.alloy.getTld", "kndctr_", "AMCV_", "demdex", "s_ecid"];

// adapters/eds/decisions-exposure.js
var PROPOSITION_EXPOSURE_EVENT = "proposition_display";
function propositionOf(x2) {
  if (x2 && typeof x2 === "object" && x2.content && typeof x2.content === "object" && ("scope" in x2.content || "id" in x2.content)) {
    return contentOf(x2);
  }
  return x2;
}
function mapPropositionToExposure(decisionOrProposition) {
  const p2 = propositionOf(decisionOrProposition);
  if (!p2 || typeof p2 !== "object") return null;
  const scope = p2.scope;
  const propositionId = p2.id;
  if (!scope || !propositionId) return null;
  const sd = p2.scopeDetails || {};
  const activityId = sd.activity && sd.activity.id;
  const experienceId = sd.experience && sd.experience.id;
  return {
    event: PROPOSITION_EXPOSURE_EVENT,
    proposition_id: propositionId,
    scope,
    ...activityId ? { activity_id: activityId } : {},
    ...experienceId ? { experience_id: experienceId } : {}
  };
}
function createPropositionExposureReporter(handle, { seen = /* @__PURE__ */ new Set() } = {}) {
  const report = (decisionOrProposition) => {
    const evt = mapPropositionToExposure(decisionOrProposition);
    if (!evt) return;
    const key = evt.scope + ":" + evt.proposition_id;
    if (seen.has(key)) return;
    seen.add(key);
    handle.push(evt);
  };
  return {
    report,
    reportAll(decisions) {
      for (const d2 of decisions || []) report(d2);
    }
  };
}

// adapters/eds/placements.js
function firstDuplicateScope(items) {
  const seen = /* @__PURE__ */ new Set();
  for (const it of Array.isArray(items) ? items : []) {
    const scope = it && typeof it.scope === "string" ? it.scope : null;
    if (scope == null) continue;
    if (seen.has(scope)) return scope;
    seen.add(scope);
  }
  return null;
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

// node_modules/web-vitals/dist/web-vitals.attribution.js
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
function installOnWindow(handle) {
  if (typeof window === "undefined") return handle;
  if (window.airlock && typeof window.airlock.dispose === "function") window.airlock.dispose();
  window.airlock = handle;
  return handle;
}
async function bootGa4Core(opts = {}) {
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
  wireInteractions(handle);
  wireExposure(handle);
  wireBlocks(handle);
  return handle;
}
async function bootEdsAnalytics(opts = {}) {
  return installOnWindow(await bootGa4Core(opts));
}
var PIXEL_VENDORS = {
  meta: { createConfig: createMetaPixelConfig, egressPurposes: META_EGRESS_PURPOSES },
  linkedin: { createConfig: createLinkedInInsightConfig, egressPurposes: LINKEDIN_EGRESS_PURPOSES },
  bing: { createConfig: createBingUetConfig, egressPurposes: BING_EGRESS_PURPOSES }
};
function bootPixelConnector(vendor, opts = {}) {
  const entry = PIXEL_VENDORS[vendor];
  if (!entry) {
    throw new Error(`airlock: unknown pixel vendor "${vendor}" (expected one of ${Object.keys(PIXEL_VENDORS).join(", ")})`);
  }
  const { consent, consentStrict = false, payloadDenylist, ...ids } = opts;
  const connectorConfig = entry.createConfig(ids);
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {},
    // no host-sourced identity crosses into a pixel instance (026-01 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? entry.egressPurposes : [],
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
async function bootMetaPixel(opts = {}) {
  return bootPixelConnector("meta", opts);
}
async function bootLinkedInInsight(opts = {}) {
  return bootPixelConnector("linkedin", opts);
}
async function bootBingUet(opts = {}) {
  return bootPixelConnector("bing", opts);
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
var ALLOY_MANIFEST_EVENTS = ["page_view"];
var ALLOY_EGRESS_PURPOSES = ["analytics_storage", "personalization"];
function decisionDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}
function deriveDecisionScopes(placements, reserved) {
  const fromPlacements = Array.isArray(placements) ? placements.map((p2) => p2 && p2.scope) : [];
  const fromReserved = reserved && typeof reserved === "object" ? Object.keys(reserved) : [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const s2 of [...fromPlacements, ...fromReserved]) {
    if (typeof s2 === "string" && s2 && !seen.has(s2)) {
      seen.add(s2);
      out.push(s2);
    }
  }
  return out;
}
function wireAlloyDecisions({ caps, reserved, diagnose, compositeEmit }) {
  const exposureReporter = createPropositionExposureReporter(
    {
      // The exposure routes through the WIRED composite-emit ref (034-03 AC2/AC3) — `{ accepts,
      // emit }` bound by boot() to THE composite this alloy booted under, NOT the mutable
      // window.airlock global (which a mid-session re-boot swaps — the reachable misroute this
      // fixes). The ref is deferred (populated after createComposite), so this closure reads it
      // LAZILY at report time. GATE via accepts("proposition_display") — the unambiguous
      // analytics-["*"]-sink signal (034-03 AC1, replacing 033-03's push count-return):
      //   - no ref / un-populated ref (a standalone bootAlloy, never wired) -> drop + diagnose;
      //   - ref present but accepts()===false (alloy-only boot, no ["*"] sink) -> drop + diagnose;
      //   - else emit() -> the composite fans the exposure to GA4 (["*"], captures); alloy's own
      //     ["page_view"] handle IGNORES it (no second interact / no proposition loop).
      // Either drop is never a throw: the DISPLAY already happened (fill); only exposure
      // TELEMETRY needs an analytics connector in the same boot(config) (documented, AC3).
      push: (evt) => {
        const ref = compositeEmit;
        if (!ref || typeof ref.accepts !== "function" || typeof ref.emit !== "function") {
          diagnose({ level: "warn", kind: "decisions", disposition: "exposure-dropped", reason: "no analytics sink for the proposition_display exposure (no wired composite-emit ref \u2014 a standalone bootAlloy)", scope: evt && evt.scope });
          return;
        }
        if (!ref.accepts(PROPOSITION_EXPOSURE_EVENT)) {
          diagnose({ level: "warn", kind: "decisions", disposition: "exposure-dropped", reason: "no analytics ['*'] sink accepted the proposition_display exposure (alloy-only boot) \u2014 the display works; exposure telemetry needs an analytics connector in the same boot(config)", scope: evt && evt.scope });
          return;
        }
        ref.emit(evt);
      }
    },
    { seen: /* @__PURE__ */ new Set() }
  );
  caps.decisions = {
    deliver: async (decisions) => {
      for (const decision of decisions || []) {
        const scope = decision && decision.scope;
        const handlePromise = scope != null ? reserved[scope] : void 0;
        if (!handlePromise) {
          diagnose({ level: "warn", kind: "decisions", disposition: "dropped", reason: "no reserved placement for this scope \u2014 the eager reservePersonalization was skipped/mis-wired, or the scope is unconfigured (NOT lazily reserved \u2014 that would reintroduce the flicker AC2 fixes)", scope });
          continue;
        }
        let handle;
        try {
          handle = await handlePromise;
        } catch (e2) {
          diagnose({ level: "warn", kind: "decisions", disposition: "dropped", reason: "the reserved placement handle rejected (selector matched nothing at reserve time) \u2014 the prehide-timeout backstop reveals the box", scope });
          continue;
        }
        const html = htmlOfDecision(decision);
        if (!html) {
          diagnose({ level: "warn", kind: "decisions", disposition: "dropped", reason: "the decision carried no renderable html-content-item (a JSON offer / redirect)", scope });
          continue;
        }
        handle.fill(html);
        exposureReporter.report(decision);
      }
    }
  };
}
async function bootAlloy(opts = {}) {
  const { bundleUrl, datastreamId, orgId, datastream, edgeConfigId, context = [], consent, payloadDenylist, workerUrl, reservedPlacements, compositeEmit } = opts;
  if (typeof bundleUrl !== "string" || bundleUrl.length === 0) {
    throw new Error("airlock bootAlloy: `bundleUrl` is required (the adopter-supplied stock @adobe/alloy bundle URL \u2014 ADR-0016)");
  }
  const resolvedDatastreamId = datastreamId ?? datastream ?? edgeConfigId;
  if (typeof resolvedDatastreamId !== "string" || resolvedDatastreamId.length === 0) {
    throw new Error("airlock bootAlloy: a datastream id is required (`datastreamId`, or its `datastream`/`edgeConfigId` alias) \u2014 alloy configure() + the config-integrity tenant pin both need it");
  }
  const worker = workerUrl ? new Worker(workerUrl) : new Worker(new URL("./alloy-chamber.worker.js", import.meta.url));
  const chamber = {
    postMessage: (msg) => worker.postMessage(msg),
    onMessage: (cb) => worker.addEventListener("message", (e2) => cb(e2.data))
  };
  const consentRef = consent ? { ...consent } : null;
  const caps = {
    egress: {
      // The ADR-0010 capability's orchestrator-side implementation: the REAL
      // main-thread fetch (ADR-0004). The host runs the endpoint/consent/config
      // gates BEFORE calling this, so a held interact never reaches the network.
      async dispatch(req) {
        const res = await fetch(req.url, { method: req.method || "POST", headers: req.headers || {}, body: req.body });
        const body = typeof res.text === "function" ? await res.text() : "";
        const ct = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") : null;
        return { status: res.status, statusText: res.statusText, headers: { "content-type": ct || "application/json" }, body };
      }
    },
    cookies: {
      // The chamber's async cookie write-back (the server-assigned ECID), reconciled
      // by the host into a form the real jar accepts (Domain/Secure/SameSite dropped).
      reconcile: (reconciled) => {
        try {
          if (typeof document !== "undefined") document.cookie = reconciled;
        } catch (e2) {
        }
      }
    }
  };
  const diagnose = typeof opts.onDiagnostic === "function" ? opts.onDiagnostic : decisionDiagnostic;
  const reserved = reservedPlacements && typeof reservedPlacements === "object" ? reservedPlacements : {};
  const personalizationConfigured = Array.isArray(opts.placements) && opts.placements.length > 0 || Object.keys(reserved).length > 0;
  if (personalizationConfigured) wireAlloyDecisions({ caps, reserved, diagnose, compositeEmit });
  const host = createWrappedSdkHost({
    chamber,
    caps,
    // ADR-0011 / spec 015 — the TRUSTED config-integrity TENANT pin. A cross-origin/untrusted
    // adopter bundle (ADR-0016) can re-`configure` alloy or craft its own interact fetch to an
    // ATTACKER's Adobe org; the seam pins the tenant to the host-owned datastream (`configId` on
    // adobedc.demdex.net — the live Edge routes by it, 013-03) and HOLDS (fail-closed) any
    // re-tenant. The pin is chamber-immutable (built here, on main), not chamber-supplied.
    configIntegrity: {
      pinnedHost: hostOf(ALLOY_INTERACT_ENDPOINT),
      tenantKey: "configId",
      pinnedTenant: resolvedDatastreamId,
      disposition: "hold"
    },
    // ADR-0006 / spec 016 — the host-owned endpoint CEILING, wired to the GROUNDED interact FLOOR
    // (016-02 AC3/AC5's accepted trade-off): the honest interact origin+path passes; any off-floor
    // destination is HELD. The un-grounded server-directed breadth (demdex/ID-sync URLs the Edge
    // response returns at runtime) is held+surfaced fail-closed — grounding that breadth is the
    // creds-gated live-Alloy follow-on (docs/refinement-todo.md), NOT a silent drop.
    endpointCeiling: [ALLOY_INTERACT_ENDPOINT],
    consent: consentRef,
    // 020-02: the TRUSTED strict seam gate. Gated on `consent` being wired (back-compat:
    // no consent → [] → gate off, byte-unchanged), mirroring every other boot.
    egressPurposes: consent ? ALLOY_EGRESS_PURPOSES : [],
    payloadDenylist,
    // spec 035-01 AC2/AC3 — the WRITE-side name-scope + validation gate, wired to
    // the SAME ALLOY_COOKIE_NAMES the READ-side seed filter uses (above) — one
    // source of truth, both enforcement seams.
    grantedCookieNames: ALLOY_COOKIE_NAMES
  });
  const decisionScopes = deriveDecisionScopes(opts.placements, reserved);
  const config = { datastreamId: resolvedDatastreamId, orgId, context, ...decisionScopes.length ? { decisionScopes } : {} };
  const rawSeedCookie = typeof document !== "undefined" && document.cookie || "";
  const seedCookie = scopeSeedCookies(rawSeedCookie, ALLOY_COOKIE_NAMES);
  host.init({ cookie: seedCookie, config, bundleUrl, consent });
  let tail = Promise.resolve();
  const enqueue = (event) => {
    const run = tail.then(() => host.driveEvent(event));
    tail = run.catch(() => {
    });
    return run;
  };
  const toDescriptor = (evt) => {
    const { event, ...params } = evt || {};
    return { type: event, params };
  };
  let disposed = false;
  return {
    push: (evt) => {
      enqueue(toDescriptor(evt));
    },
    // alloy's interact is a synchronous vendor round-trip (not a sync sendBeacon), so
    // pushCritical rides the SAME queued driveEvent — best-effort on unload; a true
    // unload fast path for the wrapped-SDK interact is a named follow-on.
    pushCritical: (evt) => {
      enqueue(toDescriptor(evt));
    },
    // Update the TRUSTED seam gate live (mutating the ref the host reads). A boot with
    // no consent leaves the gate off (egressPurposes stayed []), same as every other
    // connector; a mid-session in-chamber re-delegate is a named follow-on.
    setConsent: (v2) => {
      if (consentRef && v2) Object.assign(consentRef, v2);
    },
    getState: () => host.getState(),
    stats: () => host.getState(),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (worker && typeof worker.terminate === "function") worker.terminate();
    }
  };
}
var acceptsEvent = (events, name) => events.includes("*") || events.includes(name);
function createComposite(connectors) {
  return {
    // push/pushCritical FAN OUT (void — the public write-surface contract 032-01 established),
    // gated by each connector's declared vocabulary. (033-03 briefly overloaded these to RETURN
    // the fan-out count for the exposure sink's alloy-only detection; 034-03 AC1 reverted that in
    // favor of a scoped `accepts(name)` predicate — 037-01's 1.0 API pin (ADR-0017) then removed
    // `accepts` from the INSTALLED handle entirely (an internal fan-out detail, not part of the
    // frozen `window.airlock` surface, which is exactly `{ push, pushCritical, setConsent,
    // getState, flushNow, stats, dispose }`). `boot()` rebinds the alloy exposure reporter's
    // `compositeEmit.accepts` to a LOCAL predicate over `booted` instead — see `boot()` below.)
    push: (evt) => {
      const name = evt && evt.event;
      for (const c2 of connectors) if (acceptsEvent(c2.events, name)) c2.handle.push(evt);
    },
    pushCritical: (evt) => {
      const name = evt && evt.event;
      for (const c2 of connectors) {
        if (typeof c2.handle.pushCritical === "function" && acceptsEvent(c2.events, name)) c2.handle.pushCritical(evt);
      }
    },
    setConsent: (v2) => {
      for (const c2 of connectors) if (typeof c2.handle.setConsent === "function") c2.handle.setConsent(v2);
    },
    getState: (path) => connectors.length ? connectors[0].handle.getState(path) : void 0,
    flushNow: () => {
      for (const c2 of connectors) if (typeof c2.handle.flushNow === "function") c2.handle.flushNow();
    },
    stats: () => connectors.length ? connectors[0].handle.stats() : {},
    dispose: () => {
      for (const c2 of connectors) if (typeof c2.handle.dispose === "function") c2.handle.dispose();
    }
  };
}
var GA4_MANIFEST_EVENTS = ["*"];
var HELIX_RUM_MANIFEST_EVENTS = ["top", "error", "cwv"];
var KNOWN_CONNECTOR_TYPES = ["ga4", "pixel", "helix-rum", "alloy"];
var PIXEL_REQUIRED_ID = { meta: "pixelId", linkedin: "partnerId", bing: "tagId" };
function validateConfig(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("airlock boot(config): config must be an object");
  }
  const { connectors, consent, consentStrict, payloadDenylist } = config;
  if (connectors !== void 0 && !Array.isArray(connectors)) {
    throw new Error('airlock boot(config): "connectors" must be an array');
  }
  if (consent !== void 0 && (consent === null || typeof consent !== "object" || Array.isArray(consent))) {
    throw new Error('airlock boot(config): "consent" must be an object (a purpose -> state map)');
  }
  if (consentStrict !== void 0 && typeof consentStrict !== "boolean") {
    throw new Error('airlock boot(config): "consentStrict" must be a boolean');
  }
  if (payloadDenylist !== void 0 && (!Array.isArray(payloadDenylist) || payloadDenylist.some((k2) => typeof k2 !== "string"))) {
    throw new Error('airlock boot(config): "payloadDenylist" must be an array of strings');
  }
}
function validateConnectorEntry(entry, index) {
  const at = `connectors[${index}]`;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`airlock boot(config): ${at} must be a connector object`);
  }
  const { type } = entry;
  if (!KNOWN_CONNECTOR_TYPES.includes(type)) {
    throw new Error(
      `airlock boot(config): ${at} has unknown connector type ${JSON.stringify(type)} \u2014 expected one of: ${KNOWN_CONNECTOR_TYPES.join(", ")}`
    );
  }
  if (type === "pixel") {
    const idField = PIXEL_REQUIRED_ID[entry.vendor];
    if (!idField) {
      throw new Error(
        `airlock boot(config): ${at} (pixel) has unknown vendor ${JSON.stringify(entry.vendor)} \u2014 expected one of: ${Object.keys(PIXEL_REQUIRED_ID).join(", ")}`
      );
    }
    if (typeof entry[idField] !== "string" || entry[idField].length === 0) {
      throw new Error(
        `airlock boot(config): ${at} (pixel/${entry.vendor}) is missing required id field ${JSON.stringify(idField)} (a non-empty string)`
      );
    }
  }
  if (type === "helix-rum" && "weight" in entry && typeof entry.weight !== "number") {
    throw new Error(`airlock boot(config): ${at} (helix-rum) field "weight" must be a number`);
  }
  if (type === "alloy") {
    if (typeof entry.bundleUrl !== "string" || entry.bundleUrl.length === 0) {
      throw new Error(`airlock boot(config): ${at} (alloy) is missing required field "bundleUrl" (a non-empty string \u2014 the adopter-supplied stock @adobe/alloy bundle URL, ADR-0016)`);
    }
    const dsId = entry.datastreamId ?? entry.datastream ?? entry.edgeConfigId;
    if (typeof dsId !== "string" || dsId.length === 0) {
      throw new Error(`airlock boot(config): ${at} (alloy) is missing a datastream id \u2014 set "datastreamId" (or its "datastream"/"edgeConfigId" alias); alloy configure() + the config-integrity tenant pin both require it`);
    }
    if ("placements" in entry && entry.placements !== void 0) {
      if (!Array.isArray(entry.placements)) {
        throw new Error(`airlock boot(config): ${at} (alloy) field "placements" must be an array of { scope, selector, minHeight }`);
      }
      for (const p2 of entry.placements) {
        if (!p2 || typeof p2 !== "object" || Array.isArray(p2)) {
          throw new Error(`airlock boot(config): ${at} (alloy) each placement must be an object { scope, selector, minHeight }`);
        }
        if (typeof p2.scope !== "string" || p2.scope.length === 0) {
          throw new Error(`airlock boot(config): ${at} (alloy) placement is missing required "scope" (a non-empty personalization scope string, e.g. "${VIEW_SCOPE}")`);
        }
        if (typeof p2.selector !== "string" || p2.selector.length === 0) {
          throw new Error(`airlock boot(config): ${at} (alloy) placement is missing required "selector" (a non-empty CSS selector string)`);
        }
        if (typeof p2.minHeight !== "number" || !Number.isFinite(p2.minHeight) || p2.minHeight < 0) {
          throw new Error(`airlock boot(config): ${at} (alloy) placement has a missing/invalid "minHeight" (a finite number >= 0 \u2014 the box's reserved height in px, sized before paint)`);
        }
      }
      const dup = firstDuplicateScope(entry.placements);
      if (dup) {
        throw new Error(`airlock boot(config): ${at} (alloy) has a duplicate placement scope ${JSON.stringify(dup)} \u2014 each scope may appear at most once (the scope\u2192placement map is keyed by scope; a duplicate would collapse last-wins)`);
      }
    }
  }
}
async function bootConnector(entry, governance, index, reservedPlacements, compositeEmit) {
  validateConnectorEntry(entry, index);
  const { type, ...rest } = entry || {};
  switch (type) {
    case "ga4":
      return { handle: await bootGa4Core({ ...rest, ...governance }), events: GA4_MANIFEST_EVENTS };
    case "pixel": {
      const { vendor, ...ids } = rest;
      const handle = bootPixelConnector(vendor, { ...ids, ...governance });
      const events = Object.keys(PIXEL_VENDORS[vendor].createConfig(ids).eventMap);
      return { handle, events };
    }
    case "helix-rum":
      return { handle: bootHelixRum(rest), events: HELIX_RUM_MANIFEST_EVENTS };
    case "alloy":
      return { handle: await bootAlloy({ ...rest, ...governance, reservedPlacements, compositeEmit }), events: ALLOY_MANIFEST_EVENTS };
    default:
      throw new Error(`airlock boot(config): unknown connector type ${JSON.stringify(type)}`);
  }
}
async function boot(config = {}, opts = {}) {
  validateConfig(config);
  const { connectors = [], consent, consentStrict, payloadDenylist } = config;
  const governance = { consent, consentStrict, payloadDenylist };
  const reservedPlacements = opts && opts.reservedPlacements ? opts.reservedPlacements : void 0;
  const compositeEmit = { accepts: null, emit: null };
  const booted = [];
  try {
    for (let i2 = 0; i2 < connectors.length; i2++) {
      booted.push(await bootConnector(connectors[i2], governance, i2, reservedPlacements, compositeEmit));
    }
  } catch (err) {
    for (const c2 of booted) {
      if (c2 && c2.handle && typeof c2.handle.dispose === "function") c2.handle.dispose();
    }
    throw err;
  }
  const composite = createComposite(booted);
  compositeEmit.accepts = (name) => booted.some((c2) => acceptsEvent(c2.events, name));
  compositeEmit.emit = (evt) => composite.push(evt);
  return installOnWindow(composite);
}
var eds_default = bootEdsAnalytics;
export {
  BING_EGRESS_PURPOSES,
  LINKEDIN_EGRESS_PURPOSES,
  META_EGRESS_PURPOSES,
  UC2_EVENTS,
  boot,
  bootAlloy,
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
