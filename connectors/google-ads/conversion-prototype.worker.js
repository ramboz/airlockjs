import "../../core/confine-pixel-chamber.js";
import { createConnectorHost } from "../../core/connector-host.js";
import { createGoogleAdsConversionPrototype } from "./conversion-prototype.js";

let connector;
let configuring = false;
let busy = false;
let terminal = false;
let lastSequence = 0;
let requestId = 0;
let timeoutMs = 1000;
let multiDestination = false;
const pending = new Map();

function fatal(reason) {
  if (terminal) return;
  terminal = true;
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
  self.postMessage({ type: "fatal", message: reason });
}

function dispatch(request, index) {
  if (terminal || pending.size) throw new Error("invalid-pending-state");
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("transport-timeout"), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    self.postMessage({ type: "intercepted-fetch", id, url: request.url, method: "GET",
      ...(multiDestination ? { index } : {}) });
  });
}

async function route(event) {
  if (!connector || busy || !Number.isSafeInteger(event?.seq) || event.seq <= lastSequence) {
    fatal("invalid-command-order");
    return;
  }
  busy = true;
  lastSequence = event.seq;
  try {
    const result = await connector.routeBatch([event]);
    let summary;
    if (result.dropped.length) {
      summary = { seq: event.seq, disposition: "rejected", reason: result.dropped[0].reason, requests: 0 };
    } else if (!result.ready.length) {
      summary = { seq: event.seq,
        disposition: event.payload.args[0] === "set" ? "scope-updated" :
          event.payload.args[0] === "consent" ? "consent-updated" :
            event.payload.args[0] === "js" ? "bootstrap-accepted" : "configured", requests: 0 };
    } else {
      if (result.ready.length > (multiDestination ? 2 : 1)) throw new Error("invalid-request-count");
      const branches = [];
      for (const [index, request] of result.ready.entries()) {
        const response = await dispatch(request, index);
        const held = response.status === 0 && response.statusText?.startsWith("held at the seal:");
        const disposition = held ? "held" : response.status >= 200 && response.status < 300 ? "transport-settled" : "failed";
        const reason = held ? "held-at-seal" : response.status === 0 ? "transport-failed" : undefined;
        branches.push({ index, disposition, status: response.status, ...(reason ? { reason } : {}) });
        if (response.status === 0 && !held) break;
      }
      const interrupted = branches.at(-1).reason === "transport-failed";
      if (multiDestination) {
        const requests = branches.length;
        while (branches.length < result.ready.length) branches.push({ index: branches.length, disposition: "not-attempted" });
        const dispositions = new Set(branches.map(({ disposition }) => disposition));
        const disposition = dispositions.size === 1 ? branches[0].disposition : "partial";
        summary = { seq: event.seq, disposition, requests, branches, ...(interrupted ? { terminal: true } : {}) };
      } else {
        const { disposition, status, reason } = branches[0];
        summary = { seq: event.seq, disposition, requests: 1, status,
          ...(reason ? { reason } : {}), ...(interrupted ? { terminal: true } : {}) };
      }
    }
    // Returned bodies/URLs are DATA ONLY. No scripts, callbacks, cookies or fanout.
    if (!terminal) self.postMessage({ type: "result", summary, ready: [] });
  } catch { fatal("transport-failed"); }
  finally { busy = false; }
}

self.onmessage = async ({ data }) => {
  if (terminal) return;
  if (data?.type === "intercepted-fetch-response") {
    const entry = pending.get(data.id);
    if (!entry || !Number.isInteger(data.status) || (data.status !== 0 && (data.status < 100 || data.status > 599)) ||
        typeof data.body !== "string" || data.body.length > 4096 ||
        (data.statusText !== undefined && typeof data.statusText !== "string")) {
      fatal("invalid-transport-response");
      return;
    }
    pending.delete(data.id);
    clearTimeout(entry.timer);
    entry.resolve(data);
  } else if (data?.type === "init") {
    if (configuring || connector) { fatal("duplicate-worker-init"); return; }
    configuring = true;
    try {
      if (!Number.isInteger(data.transportTimeoutMs) || data.transportTimeoutMs < 10 || data.transportTimeoutMs > 10000) throw new Error("invalid-timeout");
      timeoutMs = data.transportTimeoutMs;
      multiDestination = data.experimentalMultiDestination === true;
      connector = createConnectorHost(createGoogleAdsConversionPrototype, {
        endpoint: data.endpoint, experimentalRouting: data.experimentalRouting,
        experimentalParameterScopes: data.experimentalParameterScopes,
        additionalEndpoint: data.additionalEndpoint, experimentalMultiDestination: data.experimentalMultiDestination,
        experimentalConsentCommands: data.experimentalConsentCommands, experimentalBootstrap: data.experimentalBootstrap,
        experimentalPurchase: data.experimentalPurchase,
        experimentalPurchaseCart: data.experimentalPurchaseCart,
        experimentalPurchaseDiscount: data.experimentalPurchaseDiscount,
        experimentalPurchaseFeed: data.experimentalPurchaseFeed,
        experimentalCustomVariables: data.experimentalCustomVariables,
        experimentalRetailViewItem: data.experimentalRetailViewItem,
        experimentalEducationViewItem: data.experimentalEducationViewItem,
        experimentalLocalViewItem: data.experimentalLocalViewItem,
        experimentalRealEstateViewItem: data.experimentalRealEstateViewItem,
        experimentalTravelViewItem: data.experimentalTravelViewItem,
        experimentalViewItemList: data.experimentalViewItemList,
        experimentalViewSearchResults: data.experimentalViewSearchResults,
        experimentalAddToCart: data.experimentalAddToCart,
      });
      await connector.init({});
      if (!terminal) self.postMessage({ type: "phase", name: "configured" });
    } catch { fatal("worker-configuration-failed"); }
  } else if (data?.type === "event") {
    await route(data.event);
  } else if (data?.type !== "setConsent") {
    fatal("unsupported-worker-message");
  }
};
