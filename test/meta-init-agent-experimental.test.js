import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const agentOne = "magento_opensource-0.0.0-1.2.3";
const agentTwo = "adobe_commerce-0.0.0-4.5.6";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalInitAgent: true, ...options,
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
  return {
    pixel: query.get("id"), event: query.get("ev"),
    agent: query.getAll("a"), identity: query.getAll("ud[external_id]"),
  };
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

describe("experimental empty-data init agent through the serialized Meta worker", () => {
  it("requires a boolean opt-in and keeps the four-argument init rejected by default", async () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalInitAgent: "true" })).toThrow("invalid-experimental-option");
    }
    const env = await setup({ experimentalInitAgent: false });
    try {
      env.adapter.fbq("init", ids[0], {}, { agent: agentOne });
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason))
        .toEqual(["unsupported-argument", "pageview-before-init"]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots both inputs, initializes each Pixel and keeps agent values out of state", async () => {
    const env = await setup();
    try {
      const empty = {};
      const options = { agent: agentOne };
      env.adapter.fbq("init", ids[0], empty, options);
      empty.external_id = "must-not-be-read";
      options.agent = agentTwo;
      env.adapter.fbq("init", ids[1], {}, { agent: agentTwo });
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", agent: [agentOne], identity: [] },
        { pixel: ids[1], event: "PageView", agent: [agentTwo], identity: [] },
      ]);
      expect(JSON.stringify(state)).not.toContain(agentOne);
      expect(JSON.stringify(state)).not.toContain(ids[0]);
      expect(JSON.stringify(state)).not.toContain("must-not-be-read");
    } finally { await env.close(); }
  }, 5000);

  it("rejects repeated initialization without replacing either existing agent", async () => {
    const env = await setup();
    try {
      env.adapter.fbq("init", ids[0], {}, { agent: agentOne });
      env.adapter.fbq("init", ids[0], {}, { agent: agentTwo });
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("init", ids[1], {}, { agent: agentTwo });
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "duplicate-init", "initialized", "duplicate-init", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", agent: [agentOne], identity: [] },
        { pixel: ids[1], event: "PageView", agent: [], identity: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects nonempty data and malformed options without invoking getters or initializing", async () => {
    const env = await setup({ experimentalSyntheticAdvancedMatching: true });
    try {
      let reads = 0;
      const personal = { get email() { reads += 1; return "not-read"; } };
      const hidden = Object.defineProperty({}, "hidden", { value: "not-supported" });
      const invalid = [
        [null, { agent: agentOne }], [[], { agent: agentOne }], [{ external_id: "not-supported" }, { agent: agentOne }],
        [personal, { agent: agentOne }], [hidden, { agent: agentOne }],
        [Object.assign({}, { [Symbol("extra")]: 1 }), { agent: agentOne }],
        [{}, null], [{}, {}], [{}, { agent: "other" }], [{}, { agent: agentOne, extra: true }],
        [{}, { get agent() { reads += 1; return agentOne; } }],
        [{}, Object.create({ agent: agentOne })],
        [{}, Object.assign({ agent: agentOne }, { [Symbol("extra")]: true })],
      ];
      for (const [data, options] of invalid) env.adapter.fbq("init", ids[0], data, options);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason)).toEqual([
        ...invalid.map(() => "unsupported-init-options"), "pageview-before-init",
      ]);
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not enable the separate set-agent command", async () => {
    const env = await setup();
    try {
      env.adapter.fbq("init", ids[0], {}, { agent: agentOne });
      env.adapter.fbq("set", "agent", agentTwo, ids[0]);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-command", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", agent: [agentOne], identity: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("supports the single synthetic Pixel without capturing context for the init command", async () => {
    const captureContext = vi.fn(page);
    const env = await setup({
      captureContext, experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000", {}, { agent: agentOne });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("initialized");
      expect(captureContext).not.toHaveBeenCalled();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: "000000000000000", event: "PageView", agent: [agentOne], identity: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("uses a later separately enabled agent setting for subsequent local events", async () => {
    const env = await setup({ experimentalSetAgent: true });
    try {
      env.adapter.fbq("init", ids[0], {}, { agent: agentOne });
      env.adapter.fbq("track", "PageView");
      env.adapter.fbq("set", "agent", agentTwo, ids[0]);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "transport-settled", "agent-updated", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", agent: [agentOne], identity: [] },
        { pixel: ids[0], event: "PageView", agent: [agentTwo], identity: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("keeps the existing synthetic identity path separate when both options are enabled", async () => {
    const env = await setup({ experimentalSyntheticAdvancedMatching: true });
    try {
      const identity = env.adapter.syntheticIdentity(0);
      env.adapter.fbq("init", ids[0], identity, { agent: agentOne });
      env.adapter.fbq("init", ids[0], identity);
      env.adapter.fbq("init", ids[1], Object.create(null), Object.assign(Object.create(null), { agent: agentTwo }));
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["unsupported-init-options", "initialized", "initialized", "transport-settled"]);
      const arrivals = env.receiver.arrivals.map(fields);
      expect(arrivals[0]).toMatchObject({ pixel: ids[0], event: "PageView", agent: [] });
      expect(arrivals[0].identity).toHaveLength(1);
      expect(arrivals[1]).toEqual({ pixel: ids[1], event: "PageView", agent: [agentTwo], identity: [] });
      expect(JSON.stringify(state)).not.toContain(identity.external_id);
    } finally { await env.close(); }
  }, 5000);

  it("keeps both consent seals independent and never replays held events", async () => {
    const env = await setup({ experimentalTagConsent: true, consent: { ad_storage: "denied" } });
    try {
      env.adapter.fbq("init", ids[0], {}, { agent: agentOne });
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.fbq("consent", "grant");
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "PageView", agent: [agentOne], identity: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it.each([false, true])("rejects forged transport during init (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      consent: { ad_storage: "granted" }, experimentalInitAgent: true,
      experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000000", {}, { agent: agentOne });
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each([false, true])("rejects forged init summaries containing data (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
      experimentalInitAgent: true, experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000000", {}, { agent: agentOne });
      chamber.emit({ type: "result", summary: {
        seq: 1, disposition: "initialized", requests: 0, private: "must-not-appear",
      }, ready: [] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(JSON.stringify(state)).not.toContain("must-not-appear");
    } finally { await adapter.dispose(); }
  });
});
