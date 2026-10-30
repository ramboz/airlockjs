import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const endpoint = "http://127.0.0.1:41234/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/queue", referrer: "" };
const selector = "AW-0000000000/SYNTHETIC_LABEL";
function command() { return arguments; }

async function local(options, check) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({ endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, ...options });
    await check({ receiver, chamber, adapter });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental local dataLayer entry", () => {
  it("is unavailable by default and rejects a nonboolean option", () => {
    const adapter = createGoogleAdsPrototype({ endpoint, chamber: { postMessage() {}, onMessage() {}, onError() {}, dispose() {} },
      captureContext: () => context });
    expect(adapter).not.toHaveProperty("drainDataLayer");
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalDataLayer: "true" })).toThrow("invalid-experimental-option");
    return adapter.dispose();
  });

  it("drains standard pre-install arguments and later explicit appends through the real worker in order", async () => {
    await local({ experimentalDataLayer: true, experimentalBootstrap: true }, async ({ adapter, chamber, receiver }) => {
      const dataLayer = [];
      function gtag() { dataLayer.push(arguments); }
      const date = new Date(123);
      gtag("js", date);
      gtag("config", "AW-0000000000");
      const send = vi.spyOn(chamber, "postMessage");
      expect(adapter.drainDataLayer(dataLayer)).toBeUndefined();
      date.setTime(456);
      const params = { send_to: selector, value: 7 };
      gtag("event", "conversion", params);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["bootstrap-accepted", "configured"]);
      expect(receiver.arrivals).toEqual([]);
      expect(adapter.drainDataLayer(dataLayer)).toBeUndefined();
      params.value = 9;
      expect(adapter.drainDataLayer(dataLayer)).toBeUndefined();
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition))
        .toEqual(["bootstrap-accepted", "configured", "transport-settled"]);
      expect(state.host.dispatchAttempts).toBe(1);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("value")).toBe("7");
      const events = send.mock.calls.map(([message]) => message).filter(({ type }) => type === "event");
      expect(events.map(({ event }) => event.seq)).toEqual([1, 2, 3]);
      expect(events[0].event.payload.args).toEqual(["js", 123]);
      expect(dataLayer).toHaveLength(3);
      expect(Object.hasOwn(dataLayer, "push")).toBe(false);
      expect(state.fullCompatibility).toBe(false);
    });
  }, 8000);

  it("does not replay held entries when host consent later changes", async () => {
    await local({ experimentalDataLayer: true, consent: { ad_storage: "denied" } }, async ({ adapter, receiver }) => {
      const layer = [command("config", "AW-0000000000"), command("event", "conversion", { send_to: selector })];
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "held"]);
      adapter.setConsent({ ad_storage: "granted" });
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      layer.push(command("event", "conversion", { send_to: selector }));
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("does not enable bootstrap or tag consent commands implicitly", async () => {
    await local({ experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const layer = [
        command("js", new Date(123)),
        command("consent", "default", { ad_storage: "granted" }),
        command("config", "AW-0000000000"),
        command("event", "conversion", { send_to: selector }),
      ];
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ reason, disposition }) => reason || disposition))
        .toEqual(["unsupported-argument", "unsupported-parameters", "configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("applies an admitted queued denial before a preceding conversion can dispatch", async () => {
    await local({ experimentalDataLayer: true, experimentalConsentCommands: true }, async ({ adapter, receiver }) => {
      const layer = [
        command("consent", "default", { ad_storage: "granted" }),
        command("config", "AW-0000000000"),
        command("event", "conversion", { send_to: selector }),
        command("consent", "update", { ad_storage: "denied" }),
      ];
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["consent-updated", "configured", "held", "consent-updated"]);
      expect(receiver.arrivals).toEqual([]);
      layer.push(command("consent", "update", { ad_storage: "granted" }));
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("admits at most 128 structurally valid entries without hiding normal queue overflow", async () => {
    const chamber = { postMessage() {}, onMessage() {}, onError() {}, dispose() {} };
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => context,
      experimentalDataLayer: true });
    try {
      const layer = Array.from({ length: 128 }, () => command("config", "AW-0000000000"));
      adapter.drainDataLayer(layer);
      expect(adapter.getState().queued).toBe(32);
      expect(adapter.getState().outcomes).toHaveLength(96);
      expect(adapter.getState().outcomes.every(({ reason }) => reason === "queue-overflow")).toBe(true);
      adapter.drainDataLayer(layer);
      expect(adapter.getState().outcomes).toHaveLength(96);
      layer.push(command("event", "conversion", { send_to: selector }));
      expect(() => adapter.drainDataLayer(layer)).toThrow("invalid-data-layer");
      expect(adapter.getState().outcomes).toHaveLength(96);
    } finally { await adapter.dispose(); }
  });

  it("rejects malformed entries atomically without invoking accessors or replaying earlier entries", async () => {
    await local({ experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "never-read");
      const bad = command("event", "conversion", { send_to: selector });
      Object.defineProperty(bad, "1", { get: getter });
      const layer = [command("config", "AW-0000000000"), bad];
      expect(() => adapter.drainDataLayer(layer)).toThrow("invalid-data-layer");
      expect(adapter.getState().outcomes).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      layer[1] = command("event", "conversion", { send_to: selector });
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("refuses oversized or inconsistent proxy lengths without enumerating and detects replaced history", async () => {
    await local({ experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const enumerate = vi.fn(() => { throw new Error("never-enumerate"); });
      const readEntry = vi.fn();
      const oversized = new Proxy(Array(129), {
        ownKeys: enumerate,
        getOwnPropertyDescriptor(target, key) {
          if (key !== "length") readEntry();
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      expect(() => adapter.drainDataLayer(oversized)).toThrow("invalid-data-layer");
      expect(enumerate).not.toHaveBeenCalled();
      expect(readEntry).not.toHaveBeenCalled();
      let reads = 0;
      const inconsistent = new Proxy([command("config", "AW-0000000000")], {
        getOwnPropertyDescriptor(target, key) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          if (key === "length" && ++reads === 2) return { ...descriptor, value: 129 };
          return descriptor;
        },
      });
      expect(() => adapter.drainDataLayer(inconsistent)).toThrow("invalid-data-layer");
      expect(adapter.getState().outcomes).toEqual([]);
      const layer = [command("config", "AW-0000000000")];
      adapter.drainDataLayer(layer);
      await adapter.flush();
      layer[0] = command("config", "AW-0000000000");
      layer.push(command("event", "conversion", { send_to: selector }));
      expect(() => adapter.drainDataLayer(layer)).toThrow("data-layer-changed");
      expect(() => adapter.drainDataLayer([...layer])).toThrow("data-layer-changed");
      expect(receiver.arrivals).toEqual([]);
      expect(adapter.getState().outcomes).toHaveLength(1);
    });
  }, 8000);

  it("refuses reentrant drains before forwarding while leaving the outer queue ordered", async () => {
    await local({ experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const original = [command("config", "AW-0000000000"), command("event", "conversion", { send_to: selector })];
      let nested;
      const layer = new Proxy(original, {
        getOwnPropertyDescriptor(target, key) {
          if (key === "0" && !nested) {
            try { adapter.drainDataLayer(layer); } catch (error) { nested = error.message; }
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      adapter.drainDataLayer(layer);
      expect(nested).toBe("data-layer-reentrant");
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("refuses unsupported queue shapes and disposed adapters without exposing inputs", async () => {
    await local({ experimentalDataLayer: true }, async ({ adapter }) => {
      for (const layer of [null, {}, "private-value", [null], [[]], [command(1, 2, 3, 4)], Array(1)]) {
        expect(() => adapter.drainDataLayer(layer)).toThrow("invalid-data-layer");
      }
      const trapped = new Proxy([], { getPrototypeOf() { throw new Error("private-trap-error"); } });
      expect(() => adapter.drainDataLayer(trapped)).toThrow("invalid-data-layer");
      try { adapter.drainDataLayer(trapped); } catch (error) {
        expect(error.message).toBe("invalid-data-layer");
        expect(error.cause).toBeUndefined();
        expect(error.stack).not.toContain("private-trap-error");
      }
      const thrown = new Proxy({}, { getPrototypeOf() { throw new Error("private-error-inspection"); } });
      const hostile = new Proxy([], { getPrototypeOf() { throw thrown; } });
      expect(() => adapter.drainDataLayer(hostile)).toThrow("invalid-data-layer");
      expect(JSON.stringify(adapter.getState())).not.toContain("private-value");
      await adapter.dispose();
      expect(() => adapter.drainDataLayer([])).toThrow("prototype-unavailable");
    });
  }, 8000);
});
