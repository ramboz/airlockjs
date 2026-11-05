import { createGoogleAdsPrototype } from "./google-ads-prototype.js";

const attachedQueues = new WeakMap();
const arrayPush = Array.prototype.push;
const dataLayerLimit = 128;

/** Source-only loopback entry. The caller must keep native tags absent. */
export async function attachGoogleAdsDataLayerPrototype({
  dataLayer, experimentalDataLayer = true, ...options
} = {}) {
  const borrowedChamber = options.chamber && attachedQueues.get(dataLayer) === options.chamber;
  let adapter;
  let installed = false;
  let capturing = false;
  let disposed = false;
  let closing;

  function push(...entries) {
    if (this !== dataLayer) throw new Error("invalid-data-layer-receiver");
    if (disposed) throw new Error("prototype-unavailable");
    if (capturing) throw new Error("data-layer-reentrant");
    if (Object.getOwnPropertyDescriptor(dataLayer, "push")?.value !== push) throw new Error("data-layer-hook-changed");
    capturing = true;
    try {
      adapter.drainDataLayer(dataLayer);
      if (dataLayer.length + entries.length > dataLayerLimit) throw new Error("invalid-data-layer");
      const length = arrayPush.apply(dataLayer, entries);
      adapter.drainDataLayer(dataLayer);
      return length;
    } finally { capturing = false; }
  }

  function dispose() {
    if (!closing) {
      disposed = true;
      closing = (async () => {
        const failures = [];
        try {
          if (installed && Object.getOwnPropertyDescriptor(dataLayer, "push")?.value === push) delete dataLayer.push;
        } catch (error) { failures.push(error); }
        try {
          if (adapter) await adapter.dispose();
          else if (!borrowedChamber) await options.chamber?.dispose();
        } catch (error) { failures.push(error); }
        if (failures.length) throw new AggregateError(failures, "data-layer-cleanup-failed");
      })();
    }
    return closing;
  }

  try {
    if (attachedQueues.has(dataLayer)) throw new Error("data-layer-already-attached");
    if (!Array.isArray(dataLayer) || Object.getPrototypeOf(dataLayer) !== Array.prototype ||
        !Object.isExtensible(dataLayer) || Object.hasOwn(dataLayer, "push") ||
        Object.getOwnPropertyDescriptor(dataLayer, "length")?.writable !== true ||
        Object.getOwnPropertyDescriptor(Array.prototype, "push")?.value !== arrayPush) {
      throw new Error("invalid-data-layer");
    }
    if (experimentalDataLayer !== true) throw new Error("invalid-experimental-option");
    attachedQueues.set(dataLayer, options.chamber);
    adapter = createGoogleAdsPrototype({ ...options, experimentalDataLayer: true });
    Object.defineProperty(dataLayer, "push", { value: push, writable: true, configurable: true });
    installed = true;
    capturing = true;
    try { adapter.drainDataLayer(dataLayer); } finally { capturing = false; }
    return { ...adapter, dispose };
  } catch (error) {
    try { await dispose(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "data-layer-attachment-failed", { cause: cleanupError }); }
    throw error;
  }
}
