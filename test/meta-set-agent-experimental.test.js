import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const agentOne = "magento_opensource-0.0.0-1.2.3";
const agentTwo = "adobe_commerce-0.0.0-4.5.6";
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}, receiverOptions) {
  const receiver = await createPrototypeReceiver(receiverOptions);
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalEvents: true, experimentalPageViewData: true, experimentalEventIds: true,
    experimentalSetAgent: true, experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
  });
  return {
    adapter, receiver,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function fields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return { pixel: query.get("id"), event: query.get("ev"), eventId: query.get("eid"), agent: query.getAll("a") };
}

function fakeChamber() {
  let listener;
  return {
    postMessage(message) {
      if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
    onError() { return () => {}; },
    emit(message) { listener?.(message); },
    dispose() {},
  };
}

describe("experimental set agent through the serialized Meta worker", () => {
  it("requires a boolean opt-in and remains unsupported by default", async () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalSetAgent: "true" })).toThrow("invalid-experimental-option");
    }
    const env = await setup({ experimentalSetAgent: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("set", "agent", agentOne, ids[0]);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["unsupported-command", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].agent).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("orders per-Pixel settings before subsequent broadcasts and targeted calls", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView");
      let agent = agentOne;
      adapter.fbq("set", "agent", agent, ids[0]);
      agent = agentTwo;
      adapter.fbq("trackCustom", "Purchase", {}, { eventID: "synthetic" });
      adapter.fbq("set", "agent", agent, ids[1]);
      adapter.fbq("trackSingle", ids[1], "Purchase", {});
      adapter.fbq("set", "agent", agentTwo, ids[0]);
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "initialized", "transport-settled", "agent-updated", "transport-settled",
        "agent-updated", "transport-settled", "agent-updated", "transport-settled",
      ]);
      expect(receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({ pixel, event: "PageView", eventId: null, agent: [] })),
        { pixel: ids[0], event: "Purchase", eventId: "synthetic", agent: [agentOne] },
        { pixel: ids[1], event: "Purchase", eventId: "synthetic", agent: [] },
        { pixel: ids[1], event: "Purchase", eventId: null, agent: [agentTwo] },
        ...ids.map((pixel) => ({ pixel, event: "PageView", eventId: null, agent: [agentTwo] })),
      ]);
      expect(JSON.stringify(state)).not.toContain(agentOne);
      expect(JSON.stringify(state)).not.toContain(agentTwo);
      expect(JSON.stringify(state)).not.toContain(ids[0]);
    } finally { await env.close(); }
  }, 5000);

  it("supports the synthetic single-Pixel ID without enabling event-ID options", async () => {
    const env = await setup({
      experimentalEvents: false, experimentalEventIds: false, experimentalRouting: false,
      experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("set", "agent", agentOne, "000000000000000");
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual(["initialized", "agent-updated", "transport-settled"]);
      expect(JSON.stringify(state)).not.toContain(agentOne);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: "000000000000000", event: "PageView", eventId: null, agent: [agentOne] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("does not retain an agent command rejected before initialization", async () => {
    const env = await setup();
    try {
      env.adapter.fbq("set", "agent", agentOne, ids[0]);
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["uninitialized-pixel", "initialized", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].agent).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed, uninitialized and unsupported agent commands without changing state", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("set", "agent", agentOne, ids[0]);
      adapter.fbq("init", ids[0]);
      adapter.fbq("set", "agent", agentOne, ids[0]);
      const invalid = [
        ["set", "agent", agentTwo, ids[1]], ["set", "other", agentTwo, ids[0]],
        ["set", "agent", "", ids[0]], ["set", "agent", "magento_opensource-0.0.0-1.2", ids[0]],
        ["set", "agent", "magento_opensource-0.0.0-12345.1.1", ids[0]],
        ["set", "agent", "random", ids[0]], ["set", "agent", null, ids[0]],
        ["set", "agent", 1, ids[0]], ["set", "agent", agentTwo, "bad"],
        ["set", "agent", agentTwo], ["set", "agent", agentTwo, ids[0], "extra"],
      ];
      for (const args of invalid) adapter.fbq(...args);
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes[0].reason).toBe("uninitialized-pixel");
      expect(state.outcomes.slice(3, -1).every((item) => item.disposition === "rejected")).toBe(true);
      expect(receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", eventId: null, agent: [agentOne] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("does not capture page context for an agent-setting command", async () => {
    const captureContext = vi.fn(page);
    const env = await setup({ captureContext });
    try {
      env.adapter.fbq("init", ids[0]);
      await env.adapter.flush();
      captureContext.mockClear();
      env.adapter.fbq("set", "agent", agentOne, ids[0]);
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("agent-updated");
      expect(captureContext).not.toHaveBeenCalled();
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("retains settings privately while host consent denies events and never replays", async () => {
    const env = await setup({ consent: { ad_storage: "denied" }, experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("set", "agent", agentOne, ids[0]);
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "held" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "new" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "Purchase", eventId: "new", agent: [agentOne] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("holds remaining broadcast branches on tag revoke and does not replay", async () => {
    let adapter;
    let count = 0;
    const env = await setup({ experimentalTagConsent: true }, {
      respond(_request, response) {
        count += 1;
        if (count === 1) {
          adapter.fbq("consent", "revoke");
          adapter.fbq("consent", "grant");
        }
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("set", "agent", agentOne, ids[0]);
      adapter.fbq("set", "agent", agentTwo, ids[1]);
      adapter.fbq("trackCustom", "Purchase");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual([
        "initialized", "initialized", "agent-updated", "agent-updated", "partial", "consent-updated", "consent-updated",
      ]);
      expect(state.outcomes[4].branches.map((branch) => branch.disposition)).toEqual(["transport-settled", "held"]);
      await adapter.flush();
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "Purchase", eventId: null, agent: [agentOne] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it.each([false, true])("rejects a forged worker dispatch during agent setting (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      consent: { ad_storage: "granted" }, experimentalSetAgent: true,
      experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("set", "agent", agentOne, "000000000000000");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each([false, true])("rejects a forged agent-setting result with extra data (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
      experimentalSetAgent: true, experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("set", "agent", agentOne, "000000000000000");
      chamber.emit({ type: "result", summary: {
        seq: 1, disposition: "agent-updated", requests: 0, private: "must-not-appear",
      }, ready: [] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(JSON.stringify(state)).not.toContain("must-not-appear");
    } finally { await adapter.dispose(); }
  });

  it("rejects a forged agent-setting result when the option is disabled", async () => {
    const chamber = fakeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
      experimentalRouting: true, experimentalMultiPixelRouting: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("set", "agent", agentOne, ids[0]);
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "agent-updated", requests: 0 }, ready: [] });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
    } finally { await adapter.dispose(); }
  });
});
