import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000000";
const page = () => ({
  pageURL: "https://example.test/one",
  referrer: "",
  inFrame: false,
  screenWidth: 412,
  screenHeight: 823,
  timezoneOffset: -420,
});

async function within(promise, ms = 1500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("local-test-deadline")), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("actual serialized Node worker and local receipt (not browser/native parity)", () => {
  it("encodes captured timezone minutes with the pinned configuration's opposite sign", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const context = page();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" },
    });
    try {
      adapter.fbq("init", pixelId);
      for (const offset of [0, -420, 300, -330, 345]) {
        context.timezoneOffset = offset;
        adapter.fbq("track", "PageView");
      }
      const state = await within(adapter.flush());
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "initialized", ...Array(5).fill("transport-settled"),
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("tz"))).toEqual([
        "0", "420", "-300", "330", "-345",
      ]);
    } finally {
      await closePrototypeResources({ adapter, chamber, receiver });
    }
  }, 5000);

  it("attempts receiver and chamber cleanup even when earlier disposal fails", async () => {
    const adapter = { dispose: vi.fn(async () => { throw new Error("private-adapter-detail"); }) };
    const chamber = { dispose: vi.fn(async () => { throw new Error("private-chamber-detail"); }) };
    const receiver = { close: vi.fn(async () => {}) };
    const cause = new Error("original-local-journey");
    const failure = await closePrototypeResources({ adapter, chamber, receiver, cause }).catch((error) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toBe("prototype-cleanup-failed");
    expect(failure.errors.map((error) => error.message)).toEqual(["adapter-cleanup-failed", "chamber-cleanup-failed"]);
    expect(failure.cause).toBe(cause);
    expect(JSON.stringify(failure.errors.map((error) => error.message))).not.toContain("private-");
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(receiver.close).toHaveBeenCalledTimes(1);
  });

  it("queues pre-ready init then two snapshotted pages through the actual connector and receiver", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const context = page();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" },
    });
    try {
      expect(adapter.fbq("init", pixelId)).toBeUndefined();
      expect(adapter.fbq("track", "PageView")).toBeUndefined();
      context.pageURL = "https://example.test/two#changed";
      adapter.fbq("track", "PageView");
      context.pageURL = "https://example.test/never-captured";
      const result = await adapter.flush();
      expect(result.outcomes.map((outcome) => outcome.disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("dl"))).toEqual([
        "https://example.test/one", "https://example.test/two#changed",
      ]);
      for (const arrival of receiver.arrivals) {
        expect([...new URL(arrival.url).searchParams.keys()]).toEqual(["id", "ev", "dl", "rl", "if", "sw", "sh", "tz"]);
      }
      const probe = await within(chamber.probe);
      expect(probe.threadId).toBeGreaterThan(0);
      expect(probe.ambientFetchDenied).toBe(true);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
      expect(chamber.getState()).toEqual({ closing: true, closed: true });
      expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
    }
  }, 5000);

  it.each(["pending", "denied"])("holds %s consent with zero receiver arrivals, and grant sends only a new command", async (ad_storage) => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage },
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView");
      const held = await within(adapter.flush());
      expect(held.outcomes.at(-1)).toMatchObject({ disposition: "held", status: 0 });
      expect(held.host).toMatchObject({ dispatchAttempts: 0, consentHeld: 1 });
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "PageView");
      expect((await within(adapter.flush())).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("keeps unsupported/duplicate/before-init outcomes visible and allows a later valid command", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    });
    try {
      adapter.fbq("track", "PageView");
      adapter.fbq("init", "123");
      adapter.fbq("init", pixelId);
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "Purchase");
      adapter.fbq("track", "PageView", "extra");
      const state = await within(adapter.flush());
      expect(state.outcomes.map((entry) => entry.reason || entry.disposition)).toEqual([
        "pageview-before-init", "synthetic-pixel-required", "initialized", "duplicate-init",
        "unsupported-command", "unsupported-command",
      ]);
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "PageView");
      await within(adapter.flush());
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.stringify(adapter.getState())).not.toContain("https://example.test");
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("does not post the PageView result until its correlated real receiver response settles", async () => {
    let received;
    let release;
    const arrival = new Promise((resolve) => { received = resolve; });
    const receiver = await createPrototypeReceiver({
      respond(_request, response) { release = () => response.writeHead(204).end(); received(); },
    });
    const chamber = createNodePrototypeChamber();
    const timeline = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "result") timeline.push(`result-${message.summary.seq}`);
    });
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint,
      chamber: {
        ...chamber,
        postMessage(message) {
          if (message.type === "intercepted-fetch-response") timeline.push(`response-${message.id}`);
          chamber.postMessage(message);
        },
      },
      captureContext: page, consent: { ad_storage: "granted" },
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView");
      let flushed = false;
      const flushing = adapter.flush().then((state) => { flushed = true; return state; });
      await within(arrival);
      expect(receiver.arrivals).toHaveLength(1);
      expect(adapter.getState()).toMatchObject({ inFlight: true, host: { dispatchAttempts: 1 }, receipt: "not-observed-by-adapter" });
      expect(timeline).toEqual(["result-1"]);
      expect(flushed).toBe(false);
      release();
      const state = await within(flushing);
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(timeline).toEqual(["result-1", "response-1", "result-2"]);
    } finally {
      unsubscribe();
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("makes a command timeout terminal so a late result cannot settle the next queued command", async () => {
    const receiver = await createPrototypeReceiver({ respond() {} });
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
      commandTimeoutMs: 100, transportTimeoutMs: 1000,
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      const state = await within(adapter.flush());
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "command-timeout", queued: 0, inFlight: false });
      expect(state.outcomes.map((entry) => entry.reason || entry.disposition)).toEqual([
        "initialized", "command-timeout", "command-timeout",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      adapter.fbq("track", "PageView");
      expect(adapter.getState().outcomes.at(-1).reason).toBe("terminal");
      expect(receiver.arrivals).toHaveLength(1);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("makes a stalled real response fail/timeout visibly with no success-shaped fallback", async () => {
    const receiver = await createPrototypeReceiver({ respond() {} });
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
      commandTimeoutMs: 1000, transportTimeoutMs: 60,
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView");
      const state = await within(adapter.flush());
      expect(state.phase).toBe("terminal");
      expect(["transport-timeout", "transport-failed"]).toContain(state.terminalReason);
      expect(["rejected", "failed"]).toContain(state.outcomes.at(-1).disposition);
      expect(receiver.arrivals).toHaveLength(1);
      expect(state.receipt).toBe("not-observed-by-adapter");
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it.each([302, 503])("does not follow a local %i or turn an HTTP error into transport success", async (status) => {
    const receiver = await createPrototypeReceiver({
      respond(_request, response) { response.writeHead(status, { location: "/not-allowed/" }).end(); },
    });
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView");
      const state = await within(adapter.flush());
      expect(state.outcomes.at(-1).disposition).toBe("failed");
      expect(state.outcomes.at(-1).status).toBe(status === 302 ? 0 : 503);
      expect(receiver.arrivals).toHaveLength(1);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);
});
