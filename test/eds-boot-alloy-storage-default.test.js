// 067-12 migration (spec 067 check 8): a bootAlloy caller that declares no storage grant keeps
// today's behavior. Alloy declares no stock storage set, so with no narrowing the init message
// carries NO `storage` key and a storage write-back is not an error and touches nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy } from "../adapters/eds/index.js";

class RecordingWorker {
  constructor(url) { RecordingWorker.instances.push(this); this.url = String(url); this.messages = []; this.handlers = []; }
  postMessage(m) { this.messages.push(m); }
  addEventListener(type, fn) { if (type === "message") this.handlers.push(fn); }
  terminate() {}
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
}
RecordingWorker.instances = [];
const entry = (extra = {}) => ({ bundleUrl: "https://airlock.example/alloy.js", datastreamId: "ds-1", orgId: "ORG@AdobeOrg", ...extra });

beforeEach(() => {
  RecordingWorker.instances = [];
  vi.stubGlobal("Worker", RecordingWorker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("bootAlloy with no storage grant declared", () => {
  it("posts the init message without a storage key and never reads the page storage", async () => {
    const reads = vi.fn();
    vi.stubGlobal("localStorage", { get length() { reads(); return 0; }, key() {}, getItem() {} });
    await bootAlloy(entry());
    const init = RecordingWorker.instances[0].messages.find((m) => m.type === "init");
    expect("storage" in init).toBe(false);
    expect(reads).not.toHaveBeenCalled();
  });

  it("a storage write-back is applied ungated, as no grant is imposed", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, removeItem() {} });
    await bootAlloy(entry());
    RecordingWorker.instances[0].emit({ type: "storage-writeback", area: "localStorage", key: "k", value: "v" });
    expect(setItem).toHaveBeenCalledWith("k", "v");
  });

  it("a narrowing alone restricts the area it names and seeds only those keys", async () => {
    const data = { a: "1", b: "2" };
    vi.stubGlobal("localStorage", { get length() { return 2; }, key: (i) => Object.keys(data)[i], getItem: (k) => data[k] });
    await bootAlloy(entry({ storageGrantNarrowing: { localStorage: ["a"] } }));
    const init = RecordingWorker.instances[0].messages.find((m) => m.type === "init");
    expect(init.storage).toEqual({ localStorage: { a: "1" }, sessionStorage: {} });
  });
});
