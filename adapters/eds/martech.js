/*
 * Copyright the Airlock contributors.
 * Portions derive from `adobe-rnd/aem-martech` (Apache-2.0; the upstream file carries no copyright line, the holder is
 * inferred as Adobe Inc. from its package.json: see THIRD_PARTY_NOTICES.md).
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * NOTICE: this file closely follows `adobe-rnd/aem-martech` (Apache-2.0, pinned at commit 1aa3dee3, `src/index.js`): the
 * exports, and in places the logic (the consent-object build, the proposition-apply loop, the page-activation and display
 * reporting flow, the data-layer state merge), are carried over and adapted to the `bootAlloy` handle. This file was
 * changed from that source: it runs against the handle, not `window.alloy`. See THIRD_PARTY_NOTICES.md at the repository root.
 */

// Spec 069-03 (ADR-0065): the Airlock martech library. The same exports as `aem-martech`, written against the `bootAlloy`
// handle: Alloy runs in the chamber, so this module never reads or writes `window.alloy`, `window.__alloyNS` or
// `window[alloyInstanceName]`, never imports `alloy.min.js` on the main thread, loads no ACDL, and installs no
// `window.adobeDataLayer` unless the site calls `installAdobeDataLayerProxy` itself (a migration aid).
//
// A site that called `window.alloy(...)` directly fails loudly: there is no such global. Reach the other ADR-0063
// commands with `getAirlockHandle().command(name, options)`.
//
// Differences from `aem-martech`, each pinned by a test (test/adobe-069-03-martech.test.js):
//   - `martechConfig.airlock` ({ bundleUrl, workerUrl } only) or `martechConfig.handle` is how the chamber is reached;
//     `dataLayerUrl` does not exist. `alloyInstanceName` is inert (other than "alloy" it is diagnosed).
//   - `defaultConsent: "in"` is not honoured (diagnosed `defaultConsent-in-not-honoured`); `"out"` sends nothing and drops
//     events until `updateUserConsent` grants.
//   - `martechDelayed` loads no Launch container (`launch-not-loaded` per URL).
//   - `applyPersonalization(viewName)` renders the cached view; stock 2.31.1 is a no-op for the bare form.
//   - A call queued before the chamber exists shares the data layer's 200-entry pre-attach cap (also without a data
//     layer); an evicted call's promise rejects. If the boot fails, every queued call rejects and later calls reject at once.
//   - A throwing page `onBeforeEventSend` is caught (diagnostic `hook-threw`) and the event is dropped, so `sendEvent`
//     resolves: the pinned aem-martech catches it and logs to the console. The lower-level bridge wrapper still rejects.
//   - Under `defaultConsent: "out"` a send made right after an unawaited `updateUserConsent` waits for it; a send with no
//     grant is dropped (`consent-out-event-dropped`).
//   - Any `webSDKConfig` option the library cannot carry is diagnosed `unsupported-option`. These options stay inert and
//     are not diagnosed: `debugEnabled`, `targetMigrationEnabled`, `autoCollectPropositionInteractions`.
//
// Diagnostics go to `createMartech(handle, { onDiagnostic })` (default: `console.warn`).

import { bootAlloy } from "./index.js";
import { createAlloyCommandBridge } from "./alloy-bridge.js";
import { collectStockContext } from "./before-event-send.js";
import { createDataLayer, MAX_HELD_EVENTS } from "./martech-datalayer.js";

export const DEFAULT_CONFIG = {
  analytics: true,
  alloyInstanceName: "alloy",
  trackPageView: true,
  dataLayer: true,
  dataLayerInstanceName: "adobeDataLayer",
  includeDataLayerState: true,
  launchUrls: [],
  personalization: true,
  performanceOptimized: true,
  personalizationTimeout: 1000,
  shouldProcessEvent: () => true,
  decisionScopes: [],
};

const AIRLOCK_KEYS = new Set(["bundleUrl", "workerUrl"]);
// Passed on to `bootAlloy`, or consumed by the library itself.
const CARRIED_WEBSDK = new Set(["orgId", "datastreamId", "edgeConfigId", "edgeDomain", "context", "thirdPartyCookiesEnabled", "clickCollectionEnabled", "defaultConsent", "onBeforeEventSend"]);
const INERT_WEBSDK = new Set(["debugEnabled", "targetMigrationEnabled", "autoCollectPropositionInteractions"]);
const FORBIDDEN_NAMES = ["alloy", "__alloyNS"];
const DOM_ACTION = "https://ns.adobe.com/personalization/dom-action";

function promiseWithTimeout(promise, timeout = 1000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout); }),
  ]).finally(() => clearTimeout(timer));
}

function handleRejectedPromise(error) {
  try {
    const [, file, line] = error.stack.split("\n")[1].trim().split(" ")[1].match(/(.*):(\d+):(\d+)/);
    error.sourceURL = file;
    error.line = line;
  } catch (err) { /* decorating never fails the call */ }
  throw error;
}

function onPageActivation(cb) {
  if (document.prerendering) document.addEventListener("prerenderingchange", cb, { once: true });
  else cb();
}

function onDecoratedElement(fn) {
  if (document.querySelector('[data-block-status="loaded"],[data-section-status="loaded"]')) fn();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.target.tagName === "BODY" || m.target.dataset.sectionStatus === "loaded" || m.target.dataset.blockStatus === "loaded")) fn();
  });
  const main = document.querySelector("main");
  if (main) observer.observe(main, { subtree: true, attributes: true, attributeFilter: ["data-block-status", "data-section-status"] });
  observer.observe(document.body, { childList: true });
  return () => observer.disconnect();
}

/** The Adobe 2.0 consent object `aem-martech`'s `updateUserConsent` builds. */
export function buildConsentObject(consent) {
  let marketingConfig;
  if (typeof consent.marketing === "boolean") {
    marketingConfig = { any: { val: consent.marketing ? "y" : "n" }, preferred: "email" };
  } else if (typeof consent.marketing === "object") {
    marketingConfig = {
      preferred: consent.marketing.preferred || "email",
      any: { val: (consent.marketing.email || consent.marketing.push || consent.marketing.sms) ? "y" : "n" },
      email: { val: consent.marketing.email ? "y" : "n" },
      push: { val: consent.marketing.push ? "y" : "n" },
      sms: { val: consent.marketing.sms ? "y" : "n" },
    };
  }
  return [{
    standard: "Adobe",
    version: "2.0",
    value: {
      collect: { val: consent.collect ? "y" : "n" },
      marketing: marketingConfig,
      personalize: { content: { val: consent.personalize ? "y" : "n" } },
      share: { val: consent.share ? "y" : "n" },
    },
  }];
}

/**
 * @param {object} [handle] a `bootAlloy` handle; without one `initMartech` boots the chamber from `martechConfig.airlock`
 * @param {{ onDiagnostic?: (record: object) => void, boot?: Function }} [opts] `boot` replaces `bootAlloy` (tests)
 */
export function createMartech(handle, opts = {}) {
  if (handle !== undefined && handle !== null) assertHandle(handle);
  const diagnose = typeof opts.onDiagnostic === "function" ? opts.onDiagnostic : (r) => console.warn(r);
  const boot = typeof opts.boot === "function" ? opts.boot : bootAlloy;
  const say = (kind, option, reason) => safeDiagnose({ level: "warn", kind, ...(option ? { option } : {}), reason });
  // A throwing sink never breaks the page; every diagnostic path (library, bridge, data layer, boot) goes through it.
  function safeDiagnose(record) { try { diagnose(record); } catch (e) { /* ignore */ } }

  let config;
  let theHandle = handle || null;
  let alloy = null;
  let dl = null;
  let booting = null;
  let booted = false;
  let bootError = null;
  let outstanding = 0;
  const pending = new Set();
  const direct = [];
  let consentOut = false;
  let granted = false;
  // The latest `updateUserConsent` call, set the moment it is made so a send made right after it waits for it.
  let pendingConsent = null;
  let viewScopesWarned = false;

  let response;
  let domActionPropositionIds = new Set();
  const renderedPropositionIds = new Set();
  const reportedPropositionIds = new Set();
  let initialDisplayReported = false;
  let personalizationTimedOut = false;

  function assertInitialized(method) {
    if (!config) throw new Error(`Martech needs to be initialized before the \`${method}\` method is called`);
  }

  // A call made before the chamber exists is queued in the data layer's queue (so it keeps push order with data-layer
  // events and shares its cap), or in `direct` without a data layer (same cap); once booted and drained, calls run at once.
  // `run` receives the consent call in flight when the call was made, so a grant made just before it is waited for.
  function whenReady(run) {
    if (bootError) return Promise.reject(bootError);
    const gate = pendingConsent;
    if (booted && outstanding === 0) return run(gate);
    return new Promise((resolve, reject) => {
      outstanding += 1;
      let live = true;
      const entry = {
        fail(err) { if (live) { live = false; outstanding -= 1; pending.delete(entry); reject(err); } },
      };
      pending.add(entry);
      const call = () => {
        if (!live) return;
        live = false;
        outstanding -= 1;
        pending.delete(entry);
        try { Promise.resolve(run(gate)).then(resolve, reject); } catch (e) { reject(e); }
      };
      call.onDrop = () => entry.fail(new Error("airlock: a call made before the chamber was ready was dropped (the held queue is full)"));
      if (dl) dl.enqueue(call);
      else {
        direct.push(call);
        while (direct.length > MAX_HELD_EVENTS) {
          direct.shift().onDrop();
          say("held-call-overflow", undefined, `held-call queue full (cap ${MAX_HELD_EVENTS}) before the chamber exists: oldest held call dropped`);
        }
      }
    });
  }

  function failQueued(err) {
    bootError = err;
    for (const entry of [...pending]) entry.fail(err);
    direct.length = 0;
  }

  const sendEvent = async (payload, gate = null) => {
    if (consentOut) {
      if (gate) await gate;
      if (!granted) {
        say("consent-out-event-dropped", "defaultConsent", 'defaultConsent "out": the event was dropped because no updateUserConsent grant had landed');
        return {};
      }
    }
    return alloy("sendEvent", payload);
  };

  const hook = (payload) => {
    if (config.dataLayer && config.includeDataLayerState && dl) payload.xdm = { ...payload.xdm, ...dl.getStateSnapshot() };
    payload.data ||= {};
    payload.data.__adobe ||= {};
    payload.data.__adobe.analytics ||= {};
    payload.data.__adobe.target ||= {};
    // As the pinned aem-martech does, a throwing page hook is caught, reported (diagnostic, where stock logs to the
    // console) and the event is dropped: sendEvent resolves. The lower-level bridge wrapper still rejects.
    if (config.pageHook) {
      let result;
      try { result = config.pageHook(payload); } catch (e) {
        say("hook-threw", "onBeforeEventSend", `the page onBeforeEventSend threw (${String((e && e.message) || e)}); the event was dropped`);
        return false;
      }
      if (result === false) return false;
    }
    if (!Object.keys(payload.data.__adobe.target).length) delete payload.data.__adobe.target;
    if (!Object.keys(payload.data.__adobe.analytics).length) delete payload.data.__adobe.analytics;
    if (!Object.keys(payload.data.__adobe).length) delete payload.data.__adobe;
    if (!Object.keys(payload.data).length) delete payload.data;
    return true;
  };

  async function sendAnalyticsEvent(xdmData, dataMapping = {}, configOverrides = {}) {
    assertInitialized("sendAnalyticsEvent");
    console.assert(config.analytics, "Analytics tracking is disabled in the martech config");
    if (!config.analytics) return undefined;
    try {
      return await whenReady((gate) => sendEvent({ documentUnloading: true, xdm: xdmData, data: dataMapping, edgeConfigOverrides: configOverrides }, gate));
    } catch (err) {
      return handleRejectedPromise(err instanceof Error ? err : new Error(err));
    }
  }

  // The data layer drains only after the chamber exists, in push order: its events send at once (no second queueing).
  async function sendDataLayerEvent(xdmData, dataMapping = {}, configOverrides = {}) {
    try {
      return await sendEvent({ documentUnloading: true, xdm: xdmData, data: dataMapping, edgeConfigOverrides: configOverrides }, pendingConsent);
    } catch (err) {
      return handleRejectedPromise(err instanceof Error ? err : new Error(err));
    }
  }

  function publicSendEvent(payload) {
    return (async () => {
      assertInitialized("sendEvent");
      if (!viewScopesWarned && payload && Array.isArray(payload.decisionScopes) && payload.decisionScopes.includes("__view__") && config.decisionScopes && config.decisionScopes.length) {
        viewScopesWarned = true;
        say("unsupported-option", "decisionScopes", "a page `__view__` scope next to named scopes is decided by the chamber's Alloy; the scopes it sends can differ from live Alloy's");
      }
      return whenReady((gate) => sendEvent(payload, gate));
    })();
  }

  function reportDisplayedPropositions(propositions) {
    return sendAnalyticsEvent({
      eventType: "decisioning.propositionDisplay",
      _experience: { decisioning: { propositions, propositionEventType: { display: 1 } } },
    });
  }

  function reportLateDisplayedPropositions(propositionIds) {
    if (!initialDisplayReported) return;
    const newlyDisplayed = ((response && response.propositions) || [])
      .filter((p) => propositionIds.includes(p.id) && !reportedPropositionIds.has(p.id))
      .map((p) => ({ id: p.id, scope: p.scope, scopeDetails: p.scopeDetails }));
    if (!newlyDisplayed.length) return;
    newlyDisplayed.forEach((p) => reportedPropositionIds.add(p.id));
    onPageActivation(() => { reportDisplayedPropositions(newlyDisplayed).catch(() => {}); });
  }

  async function applyPropositions() {
    const renderDecisionResponse = await whenReady((gate) => sendEvent({
      type: "decisioning.propositionFetch",
      renderDecisions: false,
      personalization: { sendDisplayEvent: false, ...(config.decisionScopes && config.decisionScopes.length && { decisionScopes: config.decisionScopes }) },
    }, gate));
    response = renderDecisionResponse;
    if (!renderDecisionResponse || !renderDecisionResponse.propositions) return [];
    if (personalizationTimedOut) return renderDecisionResponse;
    let propositions = structuredClone(renderDecisionResponse.propositions)
      .filter((p) => p.items.some((i) => i.schema === DOM_ACTION));
    domActionPropositionIds = new Set(propositions.map((p) => p.id));
    let disconnect;
    let isApplying = false;
    let pendingRun = false;
    const run = async () => {
      if (!propositions.length || personalizationTimedOut) {
        if (disconnect) disconnect();
        return;
      }
      if (isApplying) { pendingRun = true; return; }
      isApplying = true;
      try {
        const applied = await whenReady(() => alloy("applyPropositions", { propositions }));
        const newlyRendered = [];
        ((applied && applied.propositions) || []).forEach((item) => {
          if (item.renderAttempted) {
            renderedPropositionIds.add(item.id);
            newlyRendered.push(item.id);
            propositions = propositions.filter((p) => p.id !== item.id);
          }
        });
        reportLateDisplayedPropositions(newlyRendered);
        if (!propositions.length && disconnect) disconnect();
      } finally {
        isApplying = false;
        if (pendingRun) { pendingRun = false; runSafe(); }
      }
    };
    const runSafe = () => run().catch((e) => say("apply-propositions-failed", "applyPropositions", `applying the propositions failed (${String((e && e.message) || e)})`));
    disconnect = onDecoratedElement(runSafe);
    return renderDecisionResponse;
  }

  function checkAirlockKeys(airlock) {
    if (airlock === undefined) return;
    if (!airlock || typeof airlock !== "object") throw new Error("martechConfig.airlock must be an object with bundleUrl and workerUrl");
    for (const key of Object.keys(airlock)) {
      if (!AIRLOCK_KEYS.has(key)) throw new Error(`martechConfig.airlock.${key} is not allowed: only bundleUrl and workerUrl can be set (consent is decided by updateUserConsent, never at boot)`);
    }
  }

  function bootOptions(webSDKConfig, martechConfig) {
    for (const key of Object.keys(webSDKConfig)) {
      if (CARRIED_WEBSDK.has(key) || INERT_WEBSDK.has(key)) continue;
      say("unsupported-option", key, `webSDKConfig.${key} cannot be carried by the airlock library and is ignored`);
    }
    if (martechConfig.alloyInstanceName !== undefined && martechConfig.alloyInstanceName !== "alloy") {
      say("unsupported-option", "alloyInstanceName", "the library has no page global: alloyInstanceName is inert");
    }
    if (martechConfig.dataLayerUrl !== undefined) say("unsupported-option", "dataLayerUrl", "no ACDL file is loaded: dataLayerUrl does not exist");
    if (webSDKConfig.defaultConsent === "in") {
      say("defaultConsent-in-not-honoured", "defaultConsent", 'defaultConsent "in" would grant before any consent call; the boot stays pending');
    }
    const out = { ...(martechConfig.airlock || {}) };
    for (const key of ["orgId", "edgeDomain", "thirdPartyCookiesEnabled", "clickCollectionEnabled"]) {
      if (webSDKConfig[key] !== undefined) out[key] = webSDKConfig[key];
    }
    if (webSDKConfig.datastreamId !== undefined) out.datastreamId = webSDKConfig.datastreamId;
    if (webSDKConfig.edgeConfigId !== undefined) out.edgeConfigId = webSDKConfig.edgeConfigId;
    out.context = Array.isArray(webSDKConfig.context) ? webSDKConfig.context : ["web", "device", "environment"];
    out.onDiagnostic = safeDiagnose;
    // Wires the decisions capability so sendEvent resolves the propositions (the sink itself needs no work).
    out.onDecisions = () => {};
    return out;
  }

  function ensureBooted() {
    if (booting) return booting;
    booting = (async () => {
      try {
        if (!theHandle) theHandle = await boot(config.bootOptions);
        assertHandle(theHandle);
        alloy = createAlloyCommandBridge(theHandle, { onDiagnostic: safeDiagnose, getContext: () => collectStockContext() });
        await alloy("configure", { context: config.bootOptions.context, onBeforeEventSend: hook });
        booted = true;
        // The queued calls run now; the data layer's events stay held until martechLazy attaches it.
        if (dl) dl.flushCalls();
        else direct.splice(0).forEach((call) => call());
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        failQueued(error);
        handleRejectedPromise(error);
      }
    })();
    return booting;
  }

  async function initMartech(webSDKConfig, martechConfig = {}) {
    if (config) throw new Error("Martech is already initialized.");
    if (!webSDKConfig || (!webSDKConfig.datastreamId && !webSDKConfig.edgeConfigId)) throw new Error('Please set your "datastreamId" for the WebSDK config.');
    if (!webSDKConfig.orgId) throw new Error('Please set your "orgId" for the WebSDK config.');
    checkAirlockKeys(martechConfig.airlock);
    const given = martechConfig.handle || handle;
    if (given) assertHandle(given);
    else if (!martechConfig.airlock || typeof martechConfig.airlock.bundleUrl !== "string") throw new Error("Please set martechConfig.airlock.bundleUrl (or pass martechConfig.handle) so the Alloy chamber can be booted.");

    const next = { ...DEFAULT_CONFIG, ...martechConfig };
    const { airlock, handle: ignored, ...rest } = next;
    config = rest;
    config.pageHook = typeof webSDKConfig.onBeforeEventSend === "function" ? webSDKConfig.onBeforeEventSend : null;
    if (webSDKConfig.onBeforeEventSend !== undefined && !config.pageHook) {
      say("unsupported-option", "onBeforeEventSend", "webSDKConfig.onBeforeEventSend must be a function: it is ignored");
    }
    if (given) {
      for (const key of ["edgeDomain", "thirdPartyCookiesEnabled", "clickCollectionEnabled"]) {
        if (webSDKConfig[key] !== undefined) say("unsupported-option", key, `webSDKConfig.${key} is a boot option and the given handle is already booted: it is ignored`);
      }
      if (martechConfig.airlock !== undefined) say("unsupported-option", "airlock", "martechConfig.airlock is ignored when a handle is given");
    }
    config.bootOptions = bootOptions(webSDKConfig, { ...martechConfig, airlock });
    consentOut = webSDKConfig.defaultConsent === "out";
    theHandle = given || null;
    if (config.dataLayer) {
      dl = createDataLayer({
        onEvent: (...args) => sendDataLayerEvent(...args),
        shouldProcessEvent: (payload) => config.shouldProcessEvent(payload),
        diagnose: safeDiagnose,
      });
    }
    if (config.personalization) await ensureBooted();
    return undefined;
  }

  function pushToDataLayer(payload) {
    assertInitialized("pushToDataLayer");
    if (!config.dataLayer || !dl) throw new Error("The data layer is disabled in the martech config");
    dl.push(payload);
  }

  function pushEventToDataLayer(event, xdm, data, configOverrides) {
    pushToDataLayer({ event, xdm, data, configOverrides });
  }

  async function updateUserConsent(consent) {
    assertInitialized("updateUserConsent");
    const object = buildConsentObject(consent);
    const wantsGrant = consent.collect === true;
    const result = whenReady(async () => {
      await theHandle.setAdobeConsent(object);
      granted = wantsGrant;
      return {};
    });
    // Set at once (before any await) so a send made right after it, unawaited, waits for it.
    const settled = result.then(() => {}, () => {}).then(() => { if (pendingConsent === settled) pendingConsent = null; });
    pendingConsent = settled;
    return result;
  }

  function initRumTracking(sampleRUM, options = {}) {
    if (options.withRumEnhancer) say("unsupported-option", "withRumEnhancer", "the RUM enhancer is a main-thread script and is not loaded by the airlock library");
    if (sampleRUM.always) {
      return (ev, cb) => sampleRUM.always.on(ev, (data) => cb(data));
    }
    return (ev, cb) => document.addEventListener("rum", (event) => {
      const data = event.detail || {};
      if (data.checkpoint !== ev) return;
      cb(data);
    });
  }

  function isPersonalizationEnabled() {
    return !!(config && config.personalization);
  }

  async function getPersonalizationForView(viewName) {
    assertInitialized("getPersonalizationForView");
    if (!viewName) throw new Error("The `viewName` parameter needs to be defined");
    return whenReady((gate) => sendEvent({ renderDecisions: true, xdm: { web: { webPageDetails: { viewName } } } }, gate));
  }

  async function applyPersonalization(viewName) {
    assertInitialized("applyPersonalization");
    if (!viewName) throw new Error("The `viewName` parameter needs to be defined");
    return whenReady(() => alloy("applyPropositions", { viewName }));
  }

  async function martechEager() {
    assertInitialized("martechEager");
    if (config.personalization && config.performanceOptimized) {
      return promiseWithTimeout(applyPropositions(), config.personalizationTimeout)
        .catch(() => { personalizationTimedOut = true; })
        .finally(() => {
          onPageActivation(() => {
            const propositions = ((response && response.propositions) || [])
              .filter((p) => !domActionPropositionIds.has(p.id) || renderedPropositionIds.has(p.id))
              .map((p) => ({ id: p.id, scope: p.scope, scopeDetails: p.scopeDetails }));
            propositions.forEach((p) => reportedPropositionIds.add(p.id));
            initialDisplayReported = true;
            if (!config.trackPageView && !propositions.length) return;
            sendAnalyticsEvent({
              eventType: config.trackPageView ? "web.webpagedetails.pageViews" : "decisioning.propositionDisplay",
              ...(propositions.length && { _experience: { decisioning: { propositions, propositionEventType: { display: 1 } } } }),
            }).catch(() => {});
          });
        });
    }
    if (config.personalization) document.body.style.visibility = "hidden";
    return undefined;
  }

  async function martechLazy() {
    assertInitialized("martechLazy");
    if (config.dataLayer && dl) dl.scanBlocks(document);
    if (!config.personalization) {
      await ensureBooted();
      if (dl) dl.attach({ analytics: config.analytics });
      if (config.trackPageView) {
        onPageActivation(() => { sendAnalyticsEvent({ eventType: "web.webpagedetails.pageViews" }).catch(() => {}); });
      }
      return;
    }
    await ensureBooted();
    if (dl) dl.attach({ analytics: config.analytics });
    if (!config.performanceOptimized) {
      try {
        response = await promiseWithTimeout(
          whenReady((gate) => sendEvent({ renderDecisions: true, decisionScopes: [...new Set(["__view__", ...(config.decisionScopes || [])])] }, gate)),
          config.personalizationTimeout,
        );
      } catch (err) { /* the page shows its default content */ } finally {
        document.body.style.visibility = null;
      }
      if (config.trackPageView) {
        onPageActivation(() => { sendAnalyticsEvent({ eventType: "web.webpagedetails.pageViews" }).catch(() => {}); });
      }
    }
  }

  async function martechDelayed() {
    assertInitialized("martechDelayed");
    for (const url of config.launchUrls || []) say("launch-not-loaded", "launchUrls", `${url}: a Launch container is a main-thread script and is not loaded by the airlock library`);
    return [];
  }

  function getAirlockHandle() {
    if (!theHandle || !booted) throw new Error("getAirlockHandle: the Airlock handle does not exist yet (it is booted by initMartech with personalization on, or by martechLazy with it off)");
    return theHandle;
  }

  function installAdobeDataLayerProxy(options = {}) {
    assertInitialized("installAdobeDataLayerProxy");
    if (!dl) throw new Error("The data layer is disabled in the martech config");
    const instanceName = options.instanceName === undefined ? config.dataLayerInstanceName : options.instanceName;
    if (FORBIDDEN_NAMES.includes(instanceName) || instanceName === config.alloyInstanceName) {
      throw new Error(`installAdobeDataLayerProxy: "${String(instanceName)}" would write a global Alloy name`);
    }
    return dl.installAdobeDataLayerProxy({ instanceName });
  }

  return {
    initMartech,
    sendEvent: publicSendEvent,
    sendAnalyticsEvent,
    pushToDataLayer,
    pushEventToDataLayer,
    updateUserConsent,
    initRumTracking,
    isPersonalizationEnabled,
    getPersonalizationForView,
    applyPersonalization,
    martechEager,
    martechLazy,
    martechDelayed,
    getAirlockHandle,
    installAdobeDataLayerProxy,
  };
}

function assertHandle(h) {
  if (!h || typeof h.setAdobeConsent !== "function") {
    throw new Error("The Airlock handle must provide setAdobeConsent (a bootAlloy handle): the library never calls setConsent");
  }
  for (const method of ["sendEvent", "applyPropositions", "command"]) {
    if (typeof h[method] !== "function") throw new Error(`The Airlock handle must provide ${method} (a bootAlloy handle)`);
  }
}

let defaultInstance = null;
const instance = () => {
  if (!defaultInstance) defaultInstance = createMartech();
  return defaultInstance;
};

export const initMartech = (...args) => instance().initMartech(...args);
export const sendEvent = (...args) => instance().sendEvent(...args);
export const sendAnalyticsEvent = (...args) => instance().sendAnalyticsEvent(...args);
export const pushToDataLayer = (...args) => instance().pushToDataLayer(...args);
export const pushEventToDataLayer = (...args) => instance().pushEventToDataLayer(...args);
export const updateUserConsent = (...args) => instance().updateUserConsent(...args);
export const initRumTracking = (...args) => instance().initRumTracking(...args);
export const isPersonalizationEnabled = (...args) => instance().isPersonalizationEnabled(...args);
export const getPersonalizationForView = (...args) => instance().getPersonalizationForView(...args);
export const applyPersonalization = (...args) => instance().applyPersonalization(...args);
export const martechEager = (...args) => instance().martechEager(...args);
export const martechLazy = (...args) => instance().martechLazy(...args);
export const martechDelayed = (...args) => instance().martechDelayed(...args);
export const getAirlockHandle = (...args) => instance().getAirlockHandle(...args);
export const installAdobeDataLayerProxy = (...args) => instance().installAdobeDataLayerProxy(...args);
