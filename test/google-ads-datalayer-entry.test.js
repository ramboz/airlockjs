import { describe, expect, it, vi } from "vitest";
import { attachGoogleAdsDataLayerPrototype } from "../adapters/google-ads-datalayer-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const selector = "AW-0000000000/SYNTHETIC_LABEL";
const endpoint = "http://127.0.0.1:41234/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/entry", referrer: "" };
function command() { return arguments; }

function fakeChamber() {
  return { postMessage: vi.fn(), onMessage: vi.fn(), onError: vi.fn(), dispose: vi.fn() };
}

async function local(consent, check) {
  let adapter, chamber, receiver, cause;
  const dataLayer = [];
  function gtag() { dataLayer.push(arguments); }
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, chamber, endpoint: receiver.endpoint, captureContext: () => context, consent,
    });
    await check({ adapter, chamber, receiver, dataLayer, gtag });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  expect(Object.hasOwn(dataLayer, "push")).toBe(false);
  expect(chamber.getState().closed).toBe(true);
  expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
}

describe("automatic local Google dataLayer entry", () => {
  it("captures a standard queued stub and later calls through the actual worker without manual drains", async () => {
    let adapter, chamber, receiver, cause;
    try {
      receiver = await createConversionReceiver();
      chamber = createNodeConversionChamber();
      const context = { pageURL: "https://example.test/entry-a", referrer: "" };
      const dataLayer = [];
      function gtag() { dataLayer.push(arguments); }
      const params = { send_to: selector, value: 7.5, currency: "CAD", transaction_id: "entry-a" };
      gtag("config", "AW-0000000000");
      gtag("event", "conversion", params);
      adapter = await attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint: receiver.endpoint, chamber, captureContext: () => context,
        consent: { ad_storage: "granted" },
      });
      Object.assign(params, { value: 0, currency: "USD", transaction_id: "entry-b" });
      context.pageURL = "https://example.test/entry-b";
      gtag("event", "conversion", params);
      params.value = 99;
      context.pageURL = "https://example.test/too-late";
      expect(dataLayer.push()).toBe(3);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "transport-settled", "transport-settled"]);
      expect(receiver.arrivals.map(({ method, url }) => {
        const request = new URL(url);
        return { method, path: request.pathname, fields: Object.fromEntries(request.searchParams) };
      })).toEqual([
        { method: "GET", path: "/pagead/conversion/0000000000/",
          fields: { label: "SYNTHETIC_LABEL", value: "7.5", currency_code: "CAD", oid: "entry-a", url: "https://example.test/entry-a" } },
        { method: "GET", path: "/pagead/conversion/0000000000/",
          fields: { label: "SYNTHETIC_LABEL", value: "0", currency_code: "USD", oid: "entry-b", url: "https://example.test/entry-b" } },
      ]);
      const probe = await chamber.probe;
      expect(probe.threadId).toBeGreaterThan(0);
      expect(probe.ambientFetchDenied).toBe(true);
      expect(state.fullCompatibility).toBe(false);
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
    expect(chamber.getState().closed).toBe(true);
    expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
  }, 8000);

  it("does not send config, pending or denied commands and never replays them on grant", async () => {
    await local({ ad_storage: "pending" }, async ({ adapter, receiver, gtag }) => {
      gtag("config", "AW-0000000000");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("configured");
      expect(receiver.arrivals).toEqual([]);
      gtag("event", "conversion", { send_to: selector });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "denied" });
      gtag("event", "conversion", { send_to: selector });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      gtag("event", "conversion", { send_to: selector });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(["pending", "denied"])("never releases previously %s captures on an immediate grant before worker readiness", async (ad_storage) => {
    let adapter, chamber, receiver, cause;
    const dataLayer = [
      command("config", "AW-0000000000"),
      command("event", "conversion", { send_to: selector, transaction_id: "queued-ungranted" }),
    ];
    function gtag() { dataLayer.push(arguments); }
    try {
      receiver = await createConversionReceiver();
      chamber = createNodeConversionChamber();
      adapter = await attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage },
      });
      gtag("event", "conversion", { send_to: selector, transaction_id: "live-ungranted" });
      adapter.setConsent({ ad_storage: "granted" });
      gtag("event", "conversion", { send_to: selector, transaction_id: "new-granted" });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "held", "held", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("oid")).toBe("new-granted");
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it("retains visible malformed-command outcomes and does not enable extra command modes", async () => {
    await local({ ad_storage: "granted" }, async ({ adapter, receiver, gtag }) => {
      gtag("js", new Date(123));
      gtag("consent", "default", { ad_storage: "granted" });
      gtag("config", "AW-0000000000");
      gtag("event", "conversion", { send_to: selector, invalid: true });
      gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.filter(({ disposition }) => disposition === "rejected")).toHaveLength(3);
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("does not replace globals and restores the ordinary push without erasing history", async () => {
    const chamber = fakeChamber();
    const dataLayer = [command("config", "AW-0000000000")];
    const originalGtag = Object.getOwnPropertyDescriptor(globalThis, "gtag");
    const originalLayer = Object.getOwnPropertyDescriptor(globalThis, "dataLayer");
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    const stalePush = dataLayer.push;
    expect(Object.getOwnPropertyDescriptor(dataLayer, "push").enumerable).toBe(false);
    const closing = adapter.dispose();
    expect(adapter.dispose()).toBe(closing);
    await closing;
    expect(dataLayer).toHaveLength(1);
    expect(Object.hasOwn(dataLayer, "push")).toBe(false);
    expect(chamber.dispose).toHaveBeenCalledOnce();
    expect(() => stalePush.call(dataLayer, command("config", "AW-0000000000"))).toThrow("prototype-unavailable");
    expect(dataLayer.push(command("config", "AW-0000000000"))).toBe(2);
    expect(Object.getOwnPropertyDescriptor(globalThis, "gtag")).toEqual(originalGtag);
    expect(Object.getOwnPropertyDescriptor(globalThis, "dataLayer")).toEqual(originalLayer);
  });

  it("cannot attach or reattach an accepted queue and replay retained conversions", async () => {
    await local({ ad_storage: "granted" }, async ({ adapter, receiver, dataLayer, gtag }) => {
      gtag("config", "AW-0000000000");
      gtag("event", "conversion", { send_to: selector });
      await adapter.flush();
      const duplicate = fakeChamber();
      await expect(attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint: receiver.endpoint, chamber: duplicate,
      })).rejects.toThrow();
      expect(duplicate.postMessage).not.toHaveBeenCalled();
      await adapter.dispose();
      await expect(attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint: receiver.endpoint, chamber: duplicate,
      })).rejects.toThrow("data-layer-already-attached");
      expect(duplicate.postMessage).not.toHaveBeenCalled();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("keeps a later owner's hook and does not invoke its getter during disposal", async () => {
    const chamber = fakeChamber();
    const dataLayer = [];
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    const getter = vi.fn(() => Array.prototype.push);
    Object.defineProperty(dataLayer, "push", { get: getter, configurable: true });
    await adapter.dispose();
    expect(Object.getOwnPropertyDescriptor(dataLayer, "push").get).toBe(getter);
    expect(getter).not.toHaveBeenCalled();
    expect(chamber.dispose).toHaveBeenCalledOnce();
  });

  it("attempts worker disposal even if its own hook can no longer be restored", async () => {
    const chamber = fakeChamber();
    const dataLayer = [];
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    Object.defineProperty(dataLayer, "push", { configurable: false });
    await expect(adapter.dispose()).rejects.toThrow("data-layer-cleanup-failed");
    expect(chamber.dispose).toHaveBeenCalledOnce();
    expect(adapter.getState().phase).toBe("disposed");
  });

  it("surfaces worker cleanup errors after removing its own hook", async () => {
    const chamber = fakeChamber();
    chamber.dispose.mockRejectedValue(new Error("synthetic-close-failure"));
    const dataLayer = [];
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    await expect(adapter.dispose()).rejects.toThrow("data-layer-cleanup-failed");
    expect(Object.hasOwn(dataLayer, "push")).toBe(false);
    expect(chamber.dispose).toHaveBeenCalledOnce();
  });

  it("cleans up a real worker after malformed initial history and does not install a lasting hook", async () => {
    const chamber = createNodeConversionChamber();
    const dataLayer = [command("config", "AW-0000000000"), ["not-an-arguments-entry"]];
    try {
      await expect(attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint, chamber, captureContext: () => context,
      })).rejects.toThrow("invalid-data-layer");
      expect(Object.hasOwn(dataLayer, "push")).toBe(false);
      expect(chamber.getState().closed).toBe(true);
    } finally { await chamber.dispose(); }
  }, 8000);

  it("retains both attachment and cleanup failures", async () => {
    const chamber = fakeChamber();
    chamber.dispose.mockRejectedValue(new Error("synthetic-close-failure"));
    const dataLayer = [null];
    const failure = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    }).then(() => null, (error) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toBe("data-layer-attachment-failed");
    expect(failure.errors[0].message).toBe("invalid-data-layer");
    expect(failure.errors[1].message).toBe("data-layer-cleanup-failed");
    expect(Object.hasOwn(dataLayer, "push")).toBe(false);
  });

  it("closes a supplied real worker when endpoint validation rejects attachment", async () => {
    const chamber = createNodeConversionChamber();
    const dataLayer = [];
    try {
      await expect(attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint: "https://vendor.invalid/conversion", chamber,
      })).rejects.toThrow("literal-loopback-endpoint-required");
      expect(chamber.getState().closed).toBe(true);
      expect(Object.hasOwn(dataLayer, "push")).toBe(false);
    } finally { await chamber.dispose(); }
  }, 8000);

  it.each([
    () => ({ dataLayer: null }),
    () => ({ dataLayer: Object.defineProperty([], "push", { value: Array.prototype.push }) }),
    () => ({ dataLayer: [], experimentalDataLayer: false }),
  ])("closes a newly supplied real worker on early input rejection", async (input) => {
    const chamber = createNodeConversionChamber();
    try {
      await expect(attachGoogleAdsDataLayerPrototype({ endpoint, chamber, ...input() })).rejects.toThrow();
      expect(chamber.getState().closed).toBe(true);
    } finally { await chamber.dispose(); }
  }, 8000);

  it("closes a new duplicate-attempt worker without closing the existing queue's worker", async () => {
    await local({ ad_storage: "granted" }, async ({ adapter, chamber, receiver, dataLayer, gtag }) => {
      const duplicate = createNodeConversionChamber();
      try {
        await expect(attachGoogleAdsDataLayerPrototype({
          dataLayer, endpoint: receiver.endpoint, chamber: duplicate,
        })).rejects.toThrow();
        expect(duplicate.getState().closed).toBe(true);
        await expect(attachGoogleAdsDataLayerPrototype({
          dataLayer, endpoint: receiver.endpoint, chamber,
        })).rejects.toThrow();
        expect(chamber.getState().closed).toBe(false);
        gtag("config", "AW-0000000000");
        gtag("event", "conversion", { send_to: selector });
        expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
        expect(receiver.arrivals).toHaveLength(1);
      } finally { await duplicate.dispose(); }
    });
  }, 8000);

  it.each([null, {}, Object.create([]), Object.freeze([]), Array(129), [null]])(
    "rejects an invalid initial queue visibly",
    async (dataLayer) => {
      const chamber = fakeChamber();
      await expect(attachGoogleAdsDataLayerPrototype({
        dataLayer, endpoint, chamber, captureContext: () => context,
      })).rejects.toThrow("invalid-data-layer");
      expect(chamber.dispose).toHaveBeenCalledOnce();
    },
  );

  it("rejects active native-style hooks, including accessors, without calling them", async () => {
    const getter = vi.fn(() => Array.prototype.push);
    for (const descriptor of [{ value: vi.fn() }, { get: getter }]) {
      const dataLayer = [];
      Object.defineProperty(dataLayer, "push", descriptor);
      const chamber = fakeChamber();
      await expect(attachGoogleAdsDataLayerPrototype({ dataLayer, endpoint, chamber })).rejects.toThrow("invalid-data-layer");
      expect(chamber.postMessage).not.toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects non-loopback endpoints and explicitly disabled dataLayer mode before init", async () => {
    for (const options of [{ endpoint: "https://vendor.invalid/pagead/conversion/0000000000/" },
      { endpoint, experimentalDataLayer: false }, { endpoint, experimentalDataLayer: "true" }]) {
      const chamber = fakeChamber();
      await expect(attachGoogleAdsDataLayerPrototype({
        ...options, dataLayer: [], chamber,
      })).rejects.toThrow();
      expect(chamber.postMessage).not.toHaveBeenCalled();
    }
  });

  it("rejects overflow before appending, and keeps normal adapter queue-overflow outcomes", async () => {
    const chamber = fakeChamber();
    const dataLayer = [];
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    try {
      expect(dataLayer.push(...Array.from({ length: 128 }, () => command("config", "AW-0000000000")))).toBe(128);
      const state = adapter.getState();
      expect(state.queued).toBe(32);
      expect(state.outcomes).toHaveLength(96);
      expect(state.outcomes.every(({ reason }) => reason === "queue-overflow")).toBe(true);
      expect(() => dataLayer.push(command("config", "AW-0000000000"))).toThrow("invalid-data-layer");
      expect(dataLayer).toHaveLength(128);
      expect(adapter.getState().outcomes).toHaveLength(96);
    } finally { await adapter.dispose(); }
  });

  it("rejects replaced history before appending a new entry", async () => {
    const chamber = fakeChamber();
    const dataLayer = [command("config", "AW-0000000000")];
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber, captureContext: () => context,
    });
    try {
      dataLayer[0] = command("config", "AW-0000000000");
      expect(() => dataLayer.push(command("event", "conversion", { send_to: selector }))).toThrow("data-layer-changed");
      expect(dataLayer).toHaveLength(1);
    } finally { await adapter.dispose(); }
  });

  it("does not capture a malformed append or invoke entry accessors", async () => {
    await local({ ad_storage: "granted" }, async ({ adapter, receiver, dataLayer, gtag }) => {
      gtag("config", "AW-0000000000");
      await adapter.flush();
      const getter = vi.fn();
      const bad = command("event", "conversion", { send_to: selector });
      Object.defineProperty(bad, "1", { get: getter });
      expect(() => dataLayer.push(bad)).toThrow("invalid-data-layer");
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      expect(adapter.getState().outcomes).toHaveLength(1);
    });
  }, 8000);

  it("prevents reentrant push and rejects foreign or displaced hook calls", async () => {
    const dataLayer = [];
    const chamber = fakeChamber();
    const nested = vi.fn();
    const adapter = await attachGoogleAdsDataLayerPrototype({
      dataLayer, endpoint, chamber,
      captureContext() {
        try { dataLayer.push(command("config", "AW-0000000000")); }
        catch (error) { nested(error.message); }
        return context;
      },
    });
    try {
      const push = dataLayer.push;
      expect(() => push.call([], command("config", "AW-0000000000"))).toThrow("invalid-data-layer-receiver");
      dataLayer.push(command("config", "AW-0000000000"));
      expect(nested).toHaveBeenCalledWith("data-layer-reentrant");
      expect(dataLayer).toHaveLength(1);
      dataLayer.push = Array.prototype.push;
      expect(() => push.call(dataLayer, command("config", "AW-0000000000"))).toThrow("data-layer-hook-changed");
    } finally { await adapter.dispose(); }
  });
});
