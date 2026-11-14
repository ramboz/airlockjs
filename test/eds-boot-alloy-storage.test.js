// 067-12 at the bootAlloy seam: the boot storage seed and write-back honor the storage grant.
// Alloy declares no stock storage set yet (real sets arrive with 064/065/066), so the stock set
// below is a TEST VENDOR fixture swapped in for the connector's ALLOY_STORAGE_* exports; the
// no-stock cases run unmocked in test/eds-boot-alloy-storage-default.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../connectors/alloy/connector.js", async (orig) => ({
  ...(await orig()),
  ALLOY_STORAGE_NAMES: { localStorage: ["vendor_", "vtld"], sessionStorage: ["vsid"] },
  ALLOY_STORAGE_PURPOSES: { localStorage: { vendor_: ["analytics_storage"] }, sessionStorage: { vsid: ["analytics_storage"] } },
}));

const { bootAlloy } = await import("../adapters/eds/index.js");

class RecordingWorker {
  constructor(url) { RecordingWorker.instances.push(this); this.url = String(url); this.messages = []; this.handlers = []; }
  postMessage(m) { this.messages.push(m); }
  addEventListener(type, fn) { if (type === "message") this.handlers.push(fn); }
  terminate() {}
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
}
RecordingWorker.instances = [];
const worker = () => RecordingWorker.instances[0];
const initOf = (w) => w.messages.find((m) => m.type === "init");
const entry = (extra = {}) => ({ bundleUrl: "https://airlock.example/alloy.js", datastreamId: "ds-1", orgId: "ORG@AdobeOrg", ...extra });

function fakeStorage(obj) {
  const m = new Map(Object.entries(obj));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

let local;
let session;
beforeEach(() => {
  RecordingWorker.instances = [];
  local = fakeStorage({ vendor_id: "1", vtld: "t", secret: "x" });
  session = fakeStorage({ vsid: "s", other: "y" });
  vi.stubGlobal("Worker", RecordingWorker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("bootAlloy storage grant with a test vendor stock set", () => {
  it("stock default: the init message seeds exactly the stock keys, nothing else", async () => {
    await bootAlloy(entry());
    expect(initOf(worker()).storage).toEqual({ localStorage: { vendor_id: "1", vtld: "t" }, sessionStorage: { vsid: "s" } });
  });

  it("stock default: a stock write-back reaches the page storage, an out-of-set one does not", async () => {
    await bootAlloy(entry());
    worker().emit({ type: "storage-writeback", area: "localStorage", key: "vendor_new", value: "n" });
    worker().emit({ type: "storage-writeback", area: "localStorage", key: "secret", value: "pwned" });
    worker().emit({ type: "storage-writeback", area: "sessionStorage", key: "vsid", value: null });
    expect(local.dump()).toMatchObject({ vendor_new: "n", secret: "x" });
    expect(session.dump()).toEqual({ other: "y" });
  });

  it("narrowed opt-in: the seed and write-back shrink to the subset", async () => {
    await bootAlloy(entry({ storageGrantNarrowing: { localStorage: ["vtld"] } }));
    expect(initOf(worker()).storage).toEqual({ localStorage: { vtld: "t" }, sessionStorage: { vsid: "s" } });
    worker().emit({ type: "storage-writeback", area: "localStorage", key: "vendor_new", value: "n" });
    expect(local.dump().vendor_new).toBeUndefined();
  });

  it("a narrowing outside the stock set fails loud at boot", async () => {
    await expect(bootAlloy(entry({ storageGrantNarrowing: { localStorage: ["secret"] } }))).rejects.toThrow(TypeError);
  });

  it("a denied storage purpose blocks a granted write-back", async () => {
    await bootAlloy(entry({ consent: { analytics_storage: "denied" } }));
    worker().emit({ type: "storage-writeback", area: "localStorage", key: "vendor_new", value: "n" });
    worker().emit({ type: "storage-writeback", area: "localStorage", key: "vtld", value: "t2" });
    expect(local.dump()).toMatchObject({ vtld: "t2" });
    expect(local.dump().vendor_new).toBeUndefined();
  });

  it("an unavailable page storage still boots with an empty seed", async () => {
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("sessionStorage", undefined);
    await bootAlloy(entry());
    expect(initOf(worker()).storage).toEqual({ localStorage: {}, sessionStorage: {} });
  });
});
