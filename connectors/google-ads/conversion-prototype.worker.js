import "../../core/confine-pixel-chamber.js";
import { createConnectorHost } from "../../core/connector-host.js";
import { createGoogleAdsConversionPrototype } from "./conversion-prototype.js";
import { validRemarketingDisableCommand } from "./remarketing-control.js";
import {
  parseGoogleBrowserWorkerMessage, parseGoogleWorkerMessage, parseGoogleWorkerRedirect, validateGoogleBrowserOwned,
} from "./manual-response.js";

let connector;
let configuring = false;
let busy = false;
let terminal = false;
let lastSequence = 0;
let requestId = 0;
let timeoutMs = 1000;
let multiDestination = false;
let manualChain;
let browserOperation;
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

function dispatch(request, index, chain) {
  if (terminal || pending.size) throw new Error("invalid-pending-state");
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("transport-timeout"), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    self.postMessage({ type: "intercepted-fetch", id, url: request.url, method: request.method,
      ...(multiDestination ? { index } : {}), ...(chain || {}) });
  });
}

function workerOwned(event) {
  const args = event.payload.args;
  const params = args[2];
  const selector = typeof params?.send_to === "string" && /^(AW-\d{1,32})\/([A-Za-z0-9_-]{1,128})$/.exec(params.send_to);
  if (args[0] !== "event" || args[1] !== "conversion" || !selector ||
      selector[1] !== `AW-${(manualChain || browserOperation).id}`) throw new Error("invalid-owned");
  return {
    conversion_id: selector[1], conversion_label: selector[2], value: params.value,
    currency: params.currency, transaction_id: params.transaction_id,
    document_url: event.payload.context.pageURL, auid: (manualChain || browserOperation).auid,
  };
}

function dispatchBrowser(event, request, stage, parentId, source) {
  if (terminal || pending.size) throw new Error("invalid-pending-state");
  const operationId = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("transport-timeout"), timeoutMs + 250);
    pending.set(operationId, { resolve, reject, timer, commandId: event.seq, browser: true });
    self.postMessage({
      type: "browser-operation-request", instanceId: browserOperation.instanceId, epoch: browserOperation.epoch,
      commandId: event.seq, operationId, parentId, stage, url: request.url, method: request.method,
      ...(source ? { source } : {}),
    });
  });
}

async function routeBrowserOperation(event, request) {
  const owned = workerOwned(event);
  validateGoogleBrowserOwned(owned);
  const primaryId = requestId + 1;
  const primary = await dispatchBrowser(event, request, "primary", 0);
  if (["rejected", "aborted", "timed-out"].includes(primary.kind)) {
    return { seq: event.seq, disposition: "failed", reason: primary.kind, authoredOperations: 1 };
  }
  if (primary.kind !== "readable" || primary.status !== 200 ||
      !/^application\/json(?:\s*;|$)/i.test(primary.headers?.["content-type"] || "")) {
    return { seq: event.seq, disposition: "failed", reason: "primary-unreadable", authoredOperations: 1 };
  }
  const message = parseGoogleBrowserWorkerMessage(primary.body, owned);
  const parsed = new URL(message.fetch);
  const secondary = await dispatchBrowser(event, {
    url: `${browserOperation.secondaryOrigin}/pagead/viewthroughconversion/${browserOperation.id}/${parsed.search}`,
    method: "POST",
  }, "secondary", primaryId, message.fetch);
  if (secondary.kind === "opaque") return { seq: event.seq, disposition: "opaque", authoredOperations: 2 };
  if (secondary.kind === "readable") return {
    seq: event.seq, disposition: "readable", authoredOperations: 2, status: secondary.status,
  };
  return { seq: event.seq, disposition: "failed", reason: secondary.kind, authoredOperations: 2 };
}

function localUrl(raw, path) {
  const parsed = new URL(raw);
  return `${manualChain.origin}/pagead/${path}/${manualChain.id}/${parsed.search}`;
}

function checkTransportFailure(response) {
  if (response.status !== 0) return;
  if (response.statusText === "transport-timeout" ||
      response.statusText?.startsWith("intercepted-fetch timed out after ")) throw new Error("transport-timeout");
  if (["response-unavailable", "response-too-large", "invalid-utf8"].includes(response.statusText)) {
    throw new Error(response.statusText);
  }
}

async function routeManualChain(event, request) {
  const owned = workerOwned(event);
  const primaryId = requestId + 1;
  const primary = await dispatch(request, 0, { stage: "primary", parent: 0 });
  if (primary.status === 0 && primary.statusText?.startsWith("held at the seal:")) {
    return { seq: event.seq, disposition: "held", reason: "held-at-seal", requests: 1, status: 0 };
  }
  checkTransportFailure(primary);
  if (primary.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(primary.headers?.["content-type"] || "")) {
    throw new Error("invalid-chain-response");
  }
  const message = parseGoogleWorkerMessage(primary.body, owned);
  const secondaryId = requestId + 1;
  const secondary = await dispatch({ url: localUrl(message.fetch, "viewthroughconversion"), method: "POST" }, 0,
    { stage: "secondary", parent: primaryId, source: message.fetch });
  checkTransportFailure(secondary);
  if (secondary.status !== 302 || typeof secondary.headers?.location !== "string") {
    throw new Error("invalid-chain-response");
  }
  const location = parseGoogleWorkerRedirect(secondary.headers.location, message.fetch, owned);
  const final = await dispatch({ url: localUrl(location, "1p-conversion"), method: "GET" }, 0,
    { stage: "final", parent: secondaryId, source: location });
  checkTransportFailure(final);
  if (final.status !== 200) throw new Error("invalid-chain-response");
  return { seq: event.seq, disposition: "transport-settled", requests: 3, status: 200 };
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
        disposition: validRemarketingDisableCommand(event.payload.args) ? "remarketing-disabled" :
          event.payload.args[0] === "event" ? "remarketing-suppressed" :
          event.payload.args[0] === "set" ? "scope-updated" :
          event.payload.args[0] === "consent" ? "consent-updated" :
            event.payload.args[0] === "js" ? "bootstrap-accepted" : "configured", requests: 0 };
    } else if (browserOperation) {
      if (result.ready.length !== 1) throw new Error("invalid-request-count");
      summary = await routeBrowserOperation(event, result.ready[0]);
    } else if (manualChain) {
      if (result.ready.length !== 1) throw new Error("invalid-request-count");
      summary = await routeManualChain(event, result.ready[0]);
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
  } catch (error) {
    const safe = new Set(["invalid-owned", "invalid-url", "invalid-ownership", "invalid-parent", "body-limit",
      "invalid-utf8", "invalid-json", "duplicate-json", "structure-limit", "invalid-frame",
      "invalid-message", "invalid-fetch-count", "invalid-chain-response", "response-unavailable", "response-too-large",
      "transport-timeout"]);
    fatal(manualChain && safe.has(error?.message) ? error.message : "transport-failed");
  }
  finally { busy = false; }
}

self.onmessage = async ({ data }) => {
  if (terminal) return;
  if (data?.type === "browser-operation-response") {
    const entry = pending.get(data.operationId);
    const outcome = data.outcome;
    const keys = ["type", "instanceId", "epoch", "commandId", "operationId", "outcome"];
    const validKind = outcome && ["readable", "opaque", "rejected", "aborted", "timed-out"].includes(outcome.kind);
    const validReadable = outcome?.kind !== "readable" ||
      (Number.isInteger(outcome.status) && outcome.status >= 100 && outcome.status <= 599 &&
       typeof outcome.body === "string" && outcome.body.isWellFormed() &&
       new TextEncoder().encode(outcome.body).byteLength <= 65536 &&
       outcome.headers && typeof outcome.headers === "object" && !Array.isArray(outcome.headers) &&
       Object.keys(outcome.headers).every((key) => key === "content-type") &&
       (outcome.headers["content-type"] === undefined ||
        typeof outcome.headers["content-type"] === "string" && outcome.headers["content-type"].length <= 256));
    const validOutcomeKeys = outcome && Object.keys(outcome).every((key) =>
      (outcome.kind === "readable" ? ["kind", "status", "body", "headers"] : ["kind"]).includes(key));
    if (!browserOperation || !entry?.browser || data.instanceId !== browserOperation.instanceId ||
        data.epoch !== browserOperation.epoch || data.commandId !== entry.commandId ||
        Object.keys(data).length !== keys.length || !Object.keys(data).every((key) => keys.includes(key)) ||
        !validKind || !validReadable || !validOutcomeKeys) {
      fatal("invalid-transport-response"); return;
    }
    pending.delete(data.operationId);
    clearTimeout(entry.timer);
    entry.resolve(outcome);
  } else if (data?.type === "intercepted-fetch-response") {
    const entry = pending.get(data.id);
    if (!entry || entry.browser || !Number.isInteger(data.status) || (data.status !== 0 && (data.status < 100 || data.status > 599)) ||
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
      if (data.experimentalBrowserOperation) {
        const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,32})\/$/.exec(data.endpoint);
        const option = data.experimentalBrowserOperation;
        const secondaryOrigin = option.secondaryOrigin === undefined ? `http://127.0.0.1:${match?.[1]}` : option.secondaryOrigin;
        if (!match || Number(match[1]) > 65535 || !option || typeof option !== "object" || Array.isArray(option) ||
            data.experimentalRouting !== true ||
            Object.keys(data).some((key) => key.startsWith("experimental") &&
              !["experimentalRouting", "experimentalBrowserOperation"].includes(key) && data[key]) ||
            typeof option.instanceId !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(option.instanceId) ||
            !Number.isSafeInteger(option.epoch) || option.epoch < 1 ||
            typeof option.auid !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(option.auid) ||
            !/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.test(secondaryOrigin) ||
            Number(new URL(secondaryOrigin).port) > 65535 ||
            Object.keys(option).some((key) => !["instanceId", "epoch", "auid", "secondaryOrigin"].includes(key))) {
          throw new Error("invalid-browser-operation");
        }
        browserOperation = { ...option, id: match[2], secondaryOrigin };
      }
      if (data.experimentalManualResponseChain) {
        const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,32})\/$/.exec(data.endpoint);
        const identity = data.experimentalManualResponseChain;
        if (!match || !identity || Object.keys(identity).length !== 1 ||
            typeof identity.auid !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(identity.auid)) {
          throw new Error("invalid-manual-chain");
        }
        manualChain = { id: match[2], origin: `http://127.0.0.1:${match[1]}`, auid: identity.auid };
      }
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
        experimentalFlightsViewItem: data.experimentalFlightsViewItem,
        experimentalViewItemList: data.experimentalViewItemList,
        experimentalViewSearchResults: data.experimentalViewSearchResults,
        experimentalAddToCart: data.experimentalAddToCart,
        experimentalRemarketingPurchase: data.experimentalRemarketingPurchase,
        experimentalDisableRemarketing: data.experimentalDisableRemarketing,
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
