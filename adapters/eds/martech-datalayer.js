// Spec 069-02: Airlock's generic data layer, plus an opt-in `adobeDataLayer` migration proxy (ADR-0065 point 5).
//
// A pure, adapter-level, import-free module with no `core/` dependency. It keeps core's push envelope
// (`contracts/push-api.md`: `push({ event, ...params })`, a malformed push is dropped with a warning, never thrown) and adds
// what core drops: state pushes with no `event` key. It is a main-thread capture surface and holds no capability: no handle,
// no chamber. Its only output is the `onEvent` callback the library passes (and, when given, `airlock.push`).
//
//   push(object)    validate a plain data object (own data properties, bounded depth, no cycle) while copying it, append it
//                   to the queue, return. No merge, no mapping, no callback: the cost depends on the pushed object's own
//                   size, never on the state size. A getter, a function value or a non-plain prototype drops the push with a
//                   `datalayer-bad-push` diagnostic; a function push is never executed (`datalayer-function-push-dropped`).
//   getState(path)  the live state, folded lazily from the queue (a deep merge equal to ACDL 3.0.1's `getState()`), cached
//                   until the next push and updated in place, so a reference stays live. A page that mutates the returned
//                   object outside `push` is unsupported and is not detected. `getStateSnapshot()` is a deep copy for the
//                   send-time merge, so a hook cannot edit the state.
//   the drain       one macrotask (`setTimeout(0)`, never a microtask) after a push: folds the state, then, once `attach()`
//                   was called, maps each event push to `onEvent({ eventType: event, ...xdm }, data, configOverrides)` the way
//                   `aem-martech`'s listener builds `sendAnalyticsEvent`'s arguments, in order, after `shouldProcessEvent`.
//   enqueue(fn)     puts a direct call (the library's `sendEvent`) in the same queue, so it keeps order with the events.
//
// KNOWN LIMIT (069-02 AC2): no JavaScript primitive tests for a Proxy without running a trap. The validation walk reads
// descriptors (never `get`, `set`, `has`, `defineProperty`, `deleteProperty` or `apply`), so the `getPrototypeOf`, `ownKeys`
// and `getOwnPropertyDescriptor` traps of a pushed Proxy can run once before `structuredClone` (which rejects a Proxy
// without running a trap) drops it. A getter is never invoked.
//
// `installAdobeDataLayerProxy()` is the only code that touches `window.adobeDataLayer` (or the custom instance name). It is a
// MIGRATION AID for sites that already push ACDL-shaped objects, not a best practice: new code should call the library's
// `pushToDataLayer`. It forwards object pushes into this data layer and diagnoses what ACDL gave that cannot cross the
// airlock (function pushes, listeners, change notifications).

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
export const MAX_DEPTH = 32;
// The core events the Alloy connector subscribes to (`ALLOY_EVENTS` in connectors/alloy/connector.js, pinned by a test): the
// forward skips them, so a `page_view` reaches Alloy once, through the library's own path.
export const FORWARD_SKIP_EVENTS = Object.freeze(["page_view"]);
const FORBIDDEN_INSTANCE_NAMES = new Set(["alloy", "__alloyNS"]);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

class BadPush extends Error {}
const bad = (reason) => new BadPush(reason);

/** Validate while copying: only own data properties of plain objects and arrays, up to MAX_DEPTH, no cycle. */
function copyValue(v, depth, ancestors, counter, path) {
  if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v !== "object") throw bad(`${typeof v} value at ${path}`);
  if (depth > MAX_DEPTH) throw bad(`deeper than ${MAX_DEPTH} levels at ${path}`);
  if (ancestors.has(v)) throw bad(`cyclic value at ${path}`);
  counter.visits += 1;
  ancestors.add(v);
  try {
    const array = Array.isArray(v);
    const proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw bad(`non-plain prototype at ${path}`);
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (array) {
      const out = [];
      for (let i = 0; i < descriptors.length.value; i += 1) {
        const d = descriptors[i];
        if (!d) { out.push(null); continue; }
        if (!("value" in d)) throw bad(`accessor property at ${path}[${i}]`);
        out.push(d.value === undefined ? null : copyValue(d.value, depth + 1, ancestors, counter, `${path}[${i}]`));
      }
      return out;
    }
    const out = {};
    for (const key of Object.keys(descriptors)) {
      const d = descriptors[key];
      if (!d.enumerable) continue;
      if (!("value" in d)) throw bad(`accessor property at ${path}.${key}`);
      if (d.value === undefined || UNSAFE.has(key)) continue;
      out[key] = copyValue(d.value, depth + 1, ancestors, counter, `${path}.${key}`);
    }
    return out;
  } finally {
    ancestors.delete(v);
  }
}

/** ACDL's stored copy of a value: nulls are dropped from arrays and from every object inside them. */
function deepCopy(v) {
  if (Array.isArray(v)) return v.filter((e) => e !== null).map(deepCopy);
  if (!isObj(v)) return v;
  const out = {};
  for (const key of Object.keys(v)) if (!UNSAFE.has(key) && v[key] !== null) out[key] = deepCopy(v[key]);
  return out;
}

/** ACDL 3.0.1's merge: null deletes, objects merge into objects, an object never replaces a scalar or an array, anything else replaces. */
function foldInto(target, source, counter) {
  for (const key of Object.keys(source)) {
    if (UNSAFE.has(key)) continue;
    counter.visits += 1;
    const value = source[key];
    if (value === null) {
      delete target[key];
    } else if (isObj(value)) {
      if (!hasOwn(target, key)) target[key] = {};
      if (isObj(target[key])) foldInto(target[key], value, counter);
    } else {
      target[key] = deepCopy(value);
    }
  }
}

function readPath(state, path) {
  if (path === undefined || path === null || path === "") return state;
  const keys = String(path).split(".");
  let cur = state;
  for (const key of keys) {
    if (UNSAFE.has(key) || cur === null || typeof cur !== "object" || !hasOwn(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/**
 * @param {{ onEvent?: (xdm: object, data?: object, configOverrides?: object) => void,
 *           shouldProcessEvent?: (payload: object) => boolean,
 *           diagnose?: (record: object) => void,
 *           airlock?: { push: (evt: object) => void } }} [deps]
 */
export function createDataLayer({ onEvent = () => {}, shouldProcessEvent = () => true, diagnose = () => {}, airlock } = {}) {
  const state = {};
  const pushCounter = { visits: 0 };
  const foldCounter = { visits: 0 };
  const foldQueue = [];
  const sendQueue = [];
  let foldHead = 0;
  let sendHead = 0;
  let seq = 0;
  let scheduled = false;
  let attached = false;
  let mapEvents = true;
  let proxyCheck = null;
  const say = (record) => { try { diagnose({ level: "warn", ...record }); } catch (e) { /* a throwing sink never breaks the page */ } };

  function dropBad(reason) {
    console.warn(`airlock: data layer push dropped — ${reason}`);
    say({ kind: "datalayer-bad-push", reason });
  }

  function foldThrough(target) {
    while (foldHead < foldQueue.length) {
      const item = foldQueue[foldHead];
      foldHead += 1;
      if (!item.folded) {
        item.folded = true;
        const { event, eventInfo, ...rest } = item.payload;
        foldInto(state, rest, foldCounter);
      }
      if (item === target) break;
    }
    if (foldHead === foldQueue.length) { foldQueue.length = 0; foldHead = 0; }
  }
  const foldAll = () => foldThrough(null);

  function forward(event, payload) {
    if (!airlock || FORWARD_SKIP_EVENTS.includes(event)) return;
    const params = {};
    if (payload.xdm !== undefined) params.xdm = payload.xdm;
    if (payload.data !== undefined) params.data = payload.data;
    try { airlock.push({ event, ...params }); } catch (e) { say({ kind: "datalayer-forward-threw", reason: String((e && e.message) || e) }); }
  }

  function mapEvent(item) {
    const { payload } = item;
    foldThrough(item);
    let process;
    try { process = shouldProcessEvent(payload); } catch (e) {
      say({ kind: "hook-threw", option: "shouldProcessEvent", reason: `shouldProcessEvent threw (${String((e && e.message) || e)}); the event is dropped` });
      return;
    }
    if (!process) return;
    const { event, xdm, data, configOverrides } = payload;
    try { onEvent({ eventType: event, ...(isObj(xdm) ? xdm : {}) }, data, configOverrides); } catch (e) {
      say({ kind: "datalayer-onevent-threw", reason: String((e && e.message) || e) });
    }
    forward(event, payload);
  }

  function drain() {
    scheduled = false;
    if (proxyCheck) proxyCheck();
    if (attached) {
      while (sendHead < sendQueue.length) {
        const entry = sendQueue[sendHead];
        sendHead += 1;
        if (entry.call) {
          try { entry.call(); } catch (e) { say({ kind: "datalayer-call-threw", reason: String((e && e.message) || e) }); }
        } else if (mapEvents) {
          mapEvent(entry);
        }
      }
      sendQueue.length = 0;
      sendHead = 0;
    }
    foldAll();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(drain, 0);
  }

  function push(raw) {
    if (typeof raw === "function") {
      say({ kind: "datalayer-function-push-dropped", reason: "a function push is never executed: page code cannot run in the capture path" });
      return;
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      dropBad("a push must be a plain data object");
      return;
    }
    let payload;
    try {
      payload = copyValue(raw, 0, new Set(), pushCounter, "push");
      if (typeof structuredClone === "function") structuredClone(raw);
    } catch (e) {
      dropBad(e instanceof BadPush ? e.message : "not plain data (a Proxy or an uncloneable value)");
      return;
    }
    if (hasOwn(payload, "event") && (typeof payload.event !== "string" || payload.event.length === 0)) {
      dropBad("`event` must be a non-empty string");
      return;
    }
    const item = { seq, payload, folded: false };
    seq += 1;
    foldQueue.push(item);
    if (typeof payload.event === "string") sendQueue.push(item);
    schedule();
  }

  function getState(path) {
    foldAll();
    return readPath(state, path);
  }

  function getStateSnapshot() {
    foldAll();
    return typeof structuredClone === "function" ? structuredClone(state) : deepCopy(state);
  }

  /** Start mapping events (the library's lazy phase). `analytics: false` keeps the state and maps no event. */
  function attach({ analytics = true } = {}) {
    attached = true;
    mapEvents = analytics !== false;
    schedule();
  }

  function enqueue(fn) {
    sendQueue.push({ call: fn });
    schedule();
  }

  function scanBlocks(doc = globalThis.document) {
    const ids = [];
    if (!doc || typeof doc.querySelectorAll !== "function") return ids;
    for (const el of [...doc.querySelectorAll("[data-block-data-layer]")]) {
      let data;
      try { data = JSON.parse(el.dataset.blockDataLayer); } catch (e) { data = {}; }
      if (!el.id) {
        const blockClass = el.classList[0];
        const siblings = blockClass
          ? [...doc.querySelectorAll(`.${blockClass}`)]
          : [...doc.querySelectorAll("[data-block-data-layer]")].filter((e) => !e.classList.length);
        el.id = `${data?.parentId ? `${data.parentId}-` : ""}${siblings.indexOf(el) + 1}`;
      }
      push({ blocks: { [el.id]: data } });
      ids.push(el.id);
    }
    return ids;
  }

  /** The opt-in migration proxy: the only code here that touches a page global. */
  function installAdobeDataLayerProxy({ instanceName = "adobeDataLayer" } = {}) {
    if (typeof instanceName !== "string" || !instanceName || FORBIDDEN_INSTANCE_NAMES.has(instanceName)) {
      throw new Error(`installAdobeDataLayerProxy: "${String(instanceName)}" is not a valid data layer instance name`);
    }
    const win = typeof window !== "undefined" ? window : globalThis;
    let arr = win[instanceName];
    if (arr === undefined || arr === null) {
      arr = [];
      win[instanceName] = arr;
    } else if (!Array.isArray(arr) || typeof arr.getState === "function" || typeof arr.addEventListener === "function") {
      say({ kind: "datalayer-foreign-implementation", reason: `window.${instanceName} already holds a data layer implementation; the proxy was not installed` });
      return { installed: false };
    }
    const nativePush = Array.prototype.push;
    const define = (name, fn) => Object.defineProperty(arr, name, { value: fn, writable: true, configurable: true, enumerable: false });
    const take = (entry) => {
      if (typeof entry === "function") say({ kind: "datalayer-function-push-dropped", reason: "a function push is never executed: page code cannot run in the capture path" });
      else push(entry);
    };
    let active = true;
    const stop = () => {
      if (!active) return;
      active = false;
      say({ kind: "datalayer-foreign-implementation", reason: `another implementation replaced window.${instanceName}.push; the proxy stopped forwarding` });
    };
    let current = proxiedPush;
    function proxiedPush(...items) {
      if (active) for (const item of items) take(item);
      return nativePush.apply(arr, items);
    }
    for (const entry of arr.slice()) take(entry);
    // An assignment of another implementation's push (a late ACDL) is seen at once; a defineProperty is caught at the next drain.
    Object.defineProperty(arr, "push", { get: () => current, set: (fn) => { if (fn !== proxiedPush) stop(); current = fn; }, configurable: true, enumerable: false });
    define("getState", (path) => getState(path));
    for (const name of ["addEventListener", "removeEventListener", "on", "off"]) {
      define(name, () => { say({ kind: "datalayer-listener-not-supported", reason: `${name} registers nothing: listeners cannot cross the airlock` }); });
    }
    proxyCheck = () => { if (active && arr.push !== proxiedPush) stop(); };
    return { installed: true, instanceName };
  }

  return {
    push,
    getState,
    getStateSnapshot,
    attach,
    enqueue,
    scanBlocks,
    installAdobeDataLayerProxy,
    stats: () => ({ pushVisits: pushCounter.visits, foldVisits: foldCounter.visits }),
  };
}
