import "../../core/confine-pixel-chamber.js";
import { createConnectorHost } from "../../core/connector-host.js";
import { createMetaPageViewPrototype } from "./pageview-prototype.js";

let connector;
let connectorInstance;
let configuring = false;
let busy = false;
let terminal = false;
let lastSequence = 0;
let requestId = 0;
let cookieRequestId = 0;
let storageRequestId = 0;
let activeSequence = 0;
let activeGeneration = 0;
let timeoutMs = 1000;
let multiPixelRouting = false;
let liveMode = false;
let referrerEnabled = false;
const pending = new Map();
const pendingCookies = new Map();
const pendingStorage = new Map();

function fatal(reason) {
  if (terminal) return;
  terminal = true;
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
  for (const entry of pendingCookies.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pendingCookies.clear();
  for (const entry of pendingStorage.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pendingStorage.clear();
  self.postMessage({ type: "fatal", message: reason });
}

function storageRequest(operation, name, value) {
  if (pendingStorage.size || pendingCookies.size || pending.size || !busy || terminal) {
    throw new Error("invalid-pending-state");
  }
  const id = ++storageRequestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("storage-timeout"), timeoutMs);
    pendingStorage.set(id, { resolve, reject, timer, operation });
    self.postMessage({ type: "storage-request", id, seq: activeSequence, generation: activeGeneration,
      operation, name, ...(operation === "set" ? { value } : {}),
      ...(operation === "remove" ? { reason: "expired" } : {}) });
  });
}

function cookieRequest(operation, name, value, options) {
  if (pendingCookies.size || pendingStorage.size || terminal) throw new Error("invalid-pending-state");
  const id = ++cookieRequestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("cookie-timeout"), timeoutMs);
    pendingCookies.set(id, { resolve, reject, timer, operation });
    self.postMessage({ type: "cookie-request", id, operation, name,
      ...(operation === "set" ? { value, options } : {}) });
  });
}

function dispatch(request) {
  if (pending.size || pendingStorage.size || terminal) throw new Error("invalid-pending-state");
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("transport-timeout"), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    self.postMessage({ type: "intercepted-fetch", id, url: request.url, method: "GET" });
  });
}

async function route(event) {
  if (!connector || busy || !Number.isSafeInteger(event?.seq) || event.seq <= lastSequence) {
    fatal("invalid-command-order");
    return;
  }
  busy = true;
  lastSequence = event.seq;
  activeSequence = event.seq;
  activeGeneration = event.snapshot?.referrerGeneration ?? 0;
  try {
    const result = await connector.routeBatch([event]);
    let summary;
    if (result.dropped.length) {
      summary = { seq: event.seq, disposition: "rejected", reason: result.dropped[0].reason, requests: 0 };
    } else if (!result.ready.length) {
      summary = {
        seq: event.seq,
        disposition: event.payload.args[0] === "consent" ? "consent-updated" :
          event.payload.args[0] === "set" ? "agent-updated" : "initialized",
        requests: 0,
      };
      if (event.payload.args[0] === "init" && connectorInstance?.referrerDisposition &&
          event.snapshot?.referrerExperiment === true) {
        summary.referrerDisposition = connectorInstance.referrerDisposition();
      }
    } else {
      if (result.ready.length > (multiPixelRouting ? 4 : 1)) throw new Error("invalid-request-count");
      const branches = [];
      for (const request of result.ready) {
        // Each branch crosses the trusted host separately; consent may change between responses.
        const response = await dispatch(request);
        const held = response.status === 0 && response.statusText?.startsWith("held at the seal:");
        const unavailable = liveMode && response.status === 0 && response.statusText === "live-response-unavailable";
        const failure = liveMode && response.statusText === "live-policy-rejected" ? "policy-rejected" :
          liveMode && response.statusText === "live-transport-aborted" ? "transport-aborted" :
          liveMode && (response.statusText === "live-transport-timeout" ||
            response.statusText?.startsWith("intercepted-fetch timed out")) ? "transport-timeout" : "transport-failed";
        branches.push({
          ordinal: branches.length + 1,
          disposition: held ? "held" : unavailable ? "response-unavailable" :
            response.status >= 200 && response.status < 300 ? "transport-settled" : "failed",
          status: response.status,
          ...(held ? { reason: "held-at-seal" } : response.status === 0 && !unavailable ? { reason: failure } : {}),
        });
        if (response.status === 0 && !held && !unavailable) break;
      }
      const first = branches[0];
      const terminalFailure = branches.some((branch) =>
        ["transport-failed", "transport-aborted", "transport-timeout", "policy-rejected"].includes(branch.reason));
      const disposition = branches.length === result.ready.length &&
        branches.every((branch) => branch.disposition === first.disposition) ? first.disposition : "partial";
      summary = multiPixelRouting
        ? { seq: event.seq, disposition, requests: branches.length, selected: result.ready.length, branches,
          ...(terminalFailure ? { terminal: true, reason: "transport-failed" } : {}) }
        : { seq: event.seq, disposition, requests: 1, status: first.status,
          ...(first.reason ? { reason: first.reason } : {}), ...(terminalFailure ? { terminal: true } : {}) };
    }
    if (!terminal) self.postMessage({ type: "result", summary, ready: [] });
  } catch {
    fatal("transport-failed");
  } finally {
    busy = false;
  }
}

self.onmessage = async ({ data }) => {
  if (terminal) return;
  const initialDescriptors = data && Object.getOwnPropertyDescriptors(data);
  if (initialDescriptors?.type?.value === "init" && Object.hasOwn(initialDescriptors, "referrerStorageBinding")) {
    fatal("invalid-referrer-message"); return;
  }
  if (initialDescriptors?.type?.value === "init" && initialDescriptors.experimentalPageViewReferrer?.value === true) {
    const allowed = [
      "type", "endpoint", "transportTimeoutMs", "liveBinding", "ownedPocBinding",
      "experimentalPageViewData", "experimentalRouting", "experimentalMultiPixelRouting",
      "experimentalEvents", "experimentalScalarEventData", "experimentalContentNameArray",
      "experimentalContentIds", "experimentalContents", "experimentalContentsItemPrice",
      "experimentalCustomProperties", "experimentalNumericOrderId", "experimentalEventIds",
      "experimentalSetAgent", "experimentalInitAgent", "experimentalMagentoHeadArray",
      "experimentalNullPurchaseValue", "experimentalEmptyCheckoutValue",
      "experimentalFalseCheckoutContentId", "experimentalViewContentJsonStrings", "experimentalTagConsent",
      "experimentalFirstPartyCookie", "experimentalPageViewPreparation", "experimentalPageViewPerformance",
      "experimentalPageViewReferrer", "experimentalSyntheticAdvancedMatching", "syntheticIdentityFixtures",
    ];
    if (![Object.prototype, null].includes(Object.getPrototypeOf(data)) ||
        Reflect.ownKeys(initialDescriptors).some((key) => typeof key !== "string" ||
          !allowed.includes(key) || !Object.hasOwn(initialDescriptors[key], "value")) ||
        !["type", "endpoint", "transportTimeoutMs", "experimentalPageViewReferrer"]
          .every((key) => Object.hasOwn(initialDescriptors[key] || {}, "value"))) {
      fatal("invalid-referrer-message"); return;
    }
  }
  if (referrerEnabled) {
    try {
      const descriptors = data && Object.getOwnPropertyDescriptors(data);
      if (!data || ![Object.prototype, null].includes(Object.getPrototypeOf(data)) ||
          !descriptors.type || !Object.hasOwn(descriptors.type, "value") ||
          Reflect.ownKeys(descriptors).some((key) => typeof key !== "string" ||
            !Object.hasOwn(descriptors[key], "value"))) throw new Error();
      const keys = data.type === "event" ? ["type", "event"] :
        data.type === "invalidate-referrer" ? ["type"] :
          data.type === "storage-response" || data.type === "cookie-response" ||
          data.type === "intercepted-fetch-response" ? null : [];
      if (keys && (Reflect.ownKeys(descriptors).length !== keys.length ||
          !keys.every((key) => Object.hasOwn(descriptors, key)))) throw new Error();
      if (data.type === "cookie-response") {
        const allowed = ["type", "id", "status", "value"];
        if (Reflect.ownKeys(descriptors).some((key) => !allowed.includes(key)) ||
            !["type", "id", "status"].every((key) => Object.hasOwn(descriptors, key))) throw new Error();
      }
      if (data.type === "intercepted-fetch-response") {
        const allowed = ["type", "id", "status", "statusText", "headers", "body"];
        if (Reflect.ownKeys(descriptors).some((key) => !allowed.includes(key)) ||
            !["type", "id", "status", "body"].every((key) => Object.hasOwn(descriptors, key)) ||
            (Object.hasOwn(descriptors, "statusText") && typeof descriptors.statusText.value !== "string")) throw new Error();
      }
      if (data.type === "event") {
        const event = data.event;
        const eventDescriptors = event && Object.getOwnPropertyDescriptors(event);
        const eventKeys = ["type", "seq", "ts", "payload", "snapshot"];
        if (!event || ![Object.prototype, null].includes(Object.getPrototypeOf(event)) ||
            Reflect.ownKeys(eventDescriptors).length !== eventKeys.length ||
            !eventKeys.every((key) => Object.hasOwn(eventDescriptors[key] || {}, "value"))) throw new Error();
        const payload = eventDescriptors.payload.value;
        const payloadDescriptors = payload && Object.getOwnPropertyDescriptors(payload);
        if (!payload || ![Object.prototype, null].includes(Object.getPrototypeOf(payload)) ||
            Reflect.ownKeys(payloadDescriptors).length !== 2 ||
            !["args", "context"].every((key) => Object.hasOwn(payloadDescriptors[key] || {}, "value"))) throw new Error();
        const args = payloadDescriptors.args.value;
        const argsDescriptors = args && Object.getOwnPropertyDescriptors(args);
        if (!Array.isArray(args) || Object.getPrototypeOf(args) !== Array.prototype ||
            !Number.isSafeInteger(argsDescriptors.length?.value) || argsDescriptors.length.value > 4 ||
            Reflect.ownKeys(argsDescriptors).length !== argsDescriptors.length.value + 1 ||
            Array.from({ length: argsDescriptors.length.value }, (_, index) => index)
              .some((index) => !Object.hasOwn(argsDescriptors[index] || {}, "value"))) throw new Error();
        const snapshot = eventDescriptors.snapshot.value;
        const snapshots = snapshot && Object.getOwnPropertyDescriptors(snapshot);
        const snapshotKeys = ["referrerExperiment", "referrerAllowed", "referrerGeneration"];
        if (!snapshot || ![Object.prototype, null].includes(Object.getPrototypeOf(snapshot)) ||
            Reflect.ownKeys(snapshots).length !== snapshotKeys.length ||
            !snapshotKeys.every((key) => Object.hasOwn(snapshots[key] || {}, "value")) ||
            snapshots.referrerExperiment.value !== true || typeof snapshots.referrerAllowed.value !== "boolean" ||
            !Number.isSafeInteger(snapshots.referrerGeneration.value) || snapshots.referrerGeneration.value < 0) throw new Error();
      }
    } catch { fatal("invalid-referrer-message"); return; }
  }
  if (data?.type === "storage-response") {
    let record;
    try {
      if (!data || ![Object.prototype, null].includes(Object.getPrototypeOf(data))) throw new Error();
      const descriptors = Object.getOwnPropertyDescriptors(data);
      if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string" ||
          !["type", "id", "status", "value"].includes(key) || !Object.hasOwn(descriptors[key], "value"))) throw new Error();
      record = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
    } catch { fatal("invalid-storage-response"); return; }
    const entry = pendingStorage.get(record.id);
    const keys = record.status === "ok" && entry?.operation === "get"
      ? ["type", "id", "status", "value"] : ["type", "id", "status"];
    if (!entry || !["ok", "held", "failed", "unavailable"].includes(record.status) ||
        (record.status === "unavailable" && (record.id !== 1 || entry.operation !== "get")) ||
        Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key)) ||
        (keys.includes("value") && record.value !== null &&
          (typeof record.value !== "string" || record.value.length > 16 ||
           ![...record.value].every((character) => character.charCodeAt(0) <= 127)))) {
      fatal("invalid-storage-response"); return;
    }
    pendingStorage.delete(record.id);
    clearTimeout(entry.timer);
    if (record.status === "ok") entry.resolve(entry.operation === "get" ? record.value : undefined);
    else entry.reject(new Error(record.status === "held" ? "referrer-consent-held" :
      record.status === "unavailable" ? "storage-unavailable" : "storage-access-failed"));
  } else if (data?.type === "invalidate-referrer") {
    if (!connectorInstance || data && (Object.keys(data).length !== 1)) {
      fatal("invalid-referrer-invalidation"); return;
    }
    connectorInstance.invalidateReferrer();
    for (const entry of pendingStorage.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("referrer-consent-held"));
    }
    pendingStorage.clear();
  } else if (data?.type === "cookie-response") {
    const entry = pendingCookies.get(data.id);
    if (referrerEnabled && entry) {
      const keys = ["type", "id", "status", ...(data.status === "ok" && entry.operation === "get" ? ["value"] : [])];
      if (Object.keys(data).length !== keys.length || !keys.every((key) => Object.hasOwn(data, key))) {
        fatal("invalid-cookie-response"); return;
      }
    }
    if (!entry || !["ok", "held", "failed"].includes(data.status) ||
        (data.status === "ok" && entry.operation === "get" &&
          data.value !== null && (typeof data.value !== "string" || data.value.length > 256))) {
      fatal("invalid-cookie-response");
      return;
    }
    pendingCookies.delete(data.id);
    clearTimeout(entry.timer);
    if (data.status === "ok") entry.resolve(entry.operation === "get" ? data.value : undefined);
    else entry.reject(new Error(data.status === "held" ? "cookie-consent-held" : "cookie-access-failed"));
  } else if (data?.type === "intercepted-fetch-response") {
    const entry = pending.get(data.id);
    if (!entry || !Number.isInteger(data.status) || (data.status !== 0 && (data.status < 100 || data.status > 599)) ||
        typeof data.body !== "string" || data.body.length > 4096) {
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
      if (!Number.isInteger(data.transportTimeoutMs) || data.transportTimeoutMs < 10 || data.transportTimeoutMs > 10000) {
        throw new Error("invalid-timeout");
      }
      timeoutMs = data.transportTimeoutMs;
      referrerEnabled = data.experimentalPageViewReferrer === true;
      multiPixelRouting = data.experimentalMultiPixelRouting === true;
      liveMode = data.liveBinding !== undefined || data.ownedPocBinding !== undefined;
      connector = createConnectorHost((config) => {
        connectorInstance = createMetaPageViewPrototype(config);
        return connectorInstance;
      }, {
        endpoint: data.endpoint, liveBinding: data.liveBinding, ownedPocBinding: data.ownedPocBinding,
        experimentalPageViewData: data.experimentalPageViewData,
        experimentalRouting: data.experimentalRouting, experimentalMultiPixelRouting: data.experimentalMultiPixelRouting,
        experimentalEvents: data.experimentalEvents, experimentalScalarEventData: data.experimentalScalarEventData,
        experimentalContentNameArray: data.experimentalContentNameArray,
        experimentalContentIds: data.experimentalContentIds, experimentalContents: data.experimentalContents,
        experimentalContentsItemPrice: data.experimentalContentsItemPrice,
        experimentalCustomProperties: data.experimentalCustomProperties, experimentalNumericOrderId: data.experimentalNumericOrderId,
        experimentalEventIds: data.experimentalEventIds, experimentalSetAgent: data.experimentalSetAgent,
        experimentalInitAgent: data.experimentalInitAgent,
        experimentalMagentoHeadArray: data.experimentalMagentoHeadArray,
        experimentalNullPurchaseValue: data.experimentalNullPurchaseValue,
        experimentalEmptyCheckoutValue: data.experimentalEmptyCheckoutValue,
        experimentalFalseCheckoutContentId: data.experimentalFalseCheckoutContentId,
        experimentalViewContentJsonStrings: data.experimentalViewContentJsonStrings,
        experimentalTagConsent: data.experimentalTagConsent,
        experimentalFirstPartyCookie: data.experimentalFirstPartyCookie,
        experimentalPageViewPreparation: data.experimentalPageViewPreparation,
        experimentalPageViewPerformance: data.experimentalPageViewPerformance,
        experimentalPageViewReferrer: data.experimentalPageViewReferrer,
        experimentalSyntheticAdvancedMatching: data.experimentalSyntheticAdvancedMatching,
        syntheticIdentityFixtures: data.syntheticIdentityFixtures,
      });
      await connector.init({
        ...(data.experimentalFirstPartyCookie ? { cookies: {
          get: (name) => cookieRequest("get", name),
          set: (name, value, options) => cookieRequest("set", name, value, options),
        } } : {}),
        ...(data.experimentalPageViewReferrer ? { storage: {
          get: (name) => storageRequest("get", name),
          set: (name, value) => storageRequest("set", name, value),
          remove: (name) => storageRequest("remove", name),
        } } : {}),
      });
      self.postMessage({ type: "phase", name: "configured" });
    } catch {
      fatal("worker-configuration-failed");
    }
  } else if (data?.type === "event") {
    await route(data.event);
  } else if (data?.type !== "setConsent") {
    fatal("unsupported-worker-message");
  }
};
