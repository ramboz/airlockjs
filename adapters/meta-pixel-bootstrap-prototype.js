import { createMetaPixelPrototype } from "./meta-pixel-prototype.js";

function readPreload(bootstrap, limit) {
  try {
    if (typeof bootstrap !== "function") return { error: "invalid-bootstrap-preload" };
    if (Reflect.has(bootstrap, "callMethod")) return { error: "bootstrap-already-attached" };
    if (!Object.isExtensible(bootstrap)) return { error: "invalid-bootstrap-preload" };
    const property = Object.getOwnPropertyDescriptor(bootstrap, "queue");
    if (!property || !Object.hasOwn(property, "value") || !property.writable || !Array.isArray(property.value)) {
      return { error: "invalid-bootstrap-preload" };
    }
    const queue = property.value;
    const length = Object.getOwnPropertyDescriptor(queue, "length")?.value;
    if (!Number.isInteger(length) || length < 0) return { error: "invalid-bootstrap-preload" };
    if (length > limit) return { error: "bootstrap-queue-limit" };
    if (Object.getPrototypeOf(queue) !== Array.prototype) return { error: "invalid-bootstrap-preload" };
    const entries = [];
    for (let index = 0; index < length; index += 1) {
      const item = Object.getOwnPropertyDescriptor(queue, index);
      if (!item || !Object.hasOwn(item, "value") || !item.value || typeof item.value !== "object" ||
          ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(item.value))) {
        return { error: "invalid-bootstrap-preload" };
      }
      const count = Object.getOwnPropertyDescriptor(item.value, "length")?.value;
      if (!Number.isInteger(count) || count < 0 || count > 5) return { error: "invalid-bootstrap-preload" };
      const args = [];
      for (let argument = 0; argument < count; argument += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item.value, argument);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) return { error: "invalid-bootstrap-preload" };
        args.push(descriptor.value);
      }
      entries.push(args);
    }
    return { property, queue, entries };
  } catch {
    return { error: "invalid-bootstrap-preload" };
  }
}

function samePreload(first, second) {
  return first.queue === second.queue && first.property.writable === second.property.writable &&
    first.property.enumerable === second.property.enumerable &&
    first.property.configurable === second.property.configurable && first.entries.length <= second.entries.length &&
    first.entries.every((args, index) => args.length === second.entries[index].length &&
      args.every((value, argument) => Object.is(value, second.entries[index][argument])));
}

/**
 * Explicit local-only attachment to a caller-supplied fixture-style stub.
 * It does not install, discover or replace a global fbq.
 */
export async function createMetaPixelBootstrapPrototype({ bootstrap, ...options } = {}) {
  const limit = options.queueLimit === undefined ? 32 : options.queueLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error("invalid-prototype-bounds");
  const preload = readPreload(bootstrap, limit);
  if (preload.error) throw new Error(preload.error);
  const adapter = createMetaPixelPrototype(options);
  let queueReplaced = false;
  let methodInstalled = false;
  let failure = "bootstrap-install-failed";
  try {
    if ((await adapter.ready()).phase !== "ready") {
      failure = "bootstrap-worker-unavailable";
      throw new Error(failure);
    }
    const current = readPreload(bootstrap, limit);
    if (current.error || !samePreload(preload, current)) {
      failure = current.error === "bootstrap-queue-limit" ? current.error : "bootstrap-preload-changed";
      throw new Error(failure);
    }
    if (adapter.getState().phase !== "ready") {
      failure = "bootstrap-worker-unavailable";
      throw new Error(failure);
    }
    Object.defineProperty(bootstrap, "queue", { ...preload.property, value: [] });
    queueReplaced = true;
    Object.defineProperty(bootstrap, "callMethod", {
      configurable: true, writable: true, value: (...args) => adapter.fbq(...args),
    });
    methodInstalled = true;
    for (const args of current.entries) adapter.fbq(...args);
    return adapter;
  } catch {
    const failures = [];
    if (methodInstalled) {
      try {
        if (!Reflect.deleteProperty(bootstrap, "callMethod")) failures.push(new Error("bootstrap-rollback-failed"));
      } catch {
        failures.push(new Error("bootstrap-rollback-failed"));
      }
    }
    if (queueReplaced) {
      try { Object.defineProperty(bootstrap, "queue", preload.property); }
      catch { failures.push(new Error("bootstrap-rollback-failed")); }
    }
    try { await adapter.dispose(); }
    catch { failures.push(new Error("prototype-cleanup-failed")); }
    if (failures.length) throw new AggregateError(failures, failure);
    throw new Error(failure);
  }
}
