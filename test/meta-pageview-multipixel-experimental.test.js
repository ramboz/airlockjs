import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002", "000000000000003", "000000000000004", "000000000000005"];
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}, receiverOptions) {
  const receiver = await createPrototypeReceiver(receiverOptions);
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
  });
  return {
    receiver, chamber, adapter,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function selected(arrivals) {
  return arrivals.map(({ url }) => {
    const query = new URL(url).searchParams;
    return [query.get("id"), query.get("ev"), query.get("cd[value]"), query.get("cd[currency]")];
  });
}

describe("experimental multi-Pixel PageView routing through a real worker", () => {
  it("requires explicit boolean options and a separate routing opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalMultiPixelRouting: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalMultiPixelRouting: true })).toThrow("multi-pixel-routing-requires-routing");
    }
  });

  it("broadcasts in init order, targets a single initialized Pixel and snapshots data", async () => {
    const env = await setup({ experimentalPageViewData: true });
    try {
      const { adapter, receiver, chamber } = env;
      const data = { value: 12.5, currency: "CAD" };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView", data);
      data.value = 99;
      adapter.fbq("trackSingle", ids[1], "PageView", { value: 0, currency: "USD" });
      adapter.fbq("trackSingle", ids[0], "PageView");
      const result = await adapter.flush();
      expect(result.outcomes.map((item) => item.disposition)).toEqual([
        "initialized", "initialized", "transport-settled", "transport-settled", "transport-settled",
      ]);
      expect(result.outcomes[2]).toMatchObject({
        requests: 2, selected: 2, branches: [
          { ordinal: 1, disposition: "transport-settled", status: 204 },
          { ordinal: 2, disposition: "transport-settled", status: 204 },
        ],
      });
      expect(selected(receiver.arrivals)).toEqual([
        [ids[0], "PageView", "12.5", "CAD"], [ids[1], "PageView", "12.5", "CAD"],
        [ids[1], "PageView", "0", "USD"], [ids[0], "PageView", null, null],
      ]);
      expect((await chamber.probe).ambientFetchDenied).toBe(true);
      expect(JSON.stringify(result)).not.toContain(ids[0]);
      result.outcomes[2].branches[0].status = 500;
      expect(adapter.getState().outcomes[2].branches[0].status).toBe(204);
    } finally { await env.close(); }
  }, 5000);

  it("rejects duplicate, excessive, uninitialized and unsupported targets without extra sends", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("trackSingle", ids[0], "PageView");
      for (const id of ids.slice(0, 4)) adapter.fbq("init", id);
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[4]);
      adapter.fbq("trackSingle", ids[4], "PageView");
      adapter.fbq("trackSingle", "bad", "PageView");
      adapter.fbq("trackSingle", ids[0], "Purchase");
      adapter.fbq("trackSingle", ids[1], "PageView", { value: 1 });
      const result = await adapter.flush();
      expect(result.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "pageview-before-init", "initialized", "initialized", "initialized", "initialized",
        "duplicate-init", "pixel-limit", "uninitialized-pixel", "invalid-pixel-id",
        "unsupported-command", "unsupported-argument",
      ]);
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled", requests: 4, selected: 4 });
      expect(selected(receiver.arrivals).map(([id]) => id)).toEqual(ids.slice(0, 4));
    } finally { await env.close(); }
  }, 5000);

  it("rechecks consent per branch and does not replay a held branch", async () => {
    let adapter;
    const env = await setup({}, {
      respond(_request, response) {
        adapter.setConsent({ ad_storage: "denied" });
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView");
      const outcome = (await adapter.flush()).outcomes.at(-1);
      expect(outcome).toMatchObject({ disposition: "partial", requests: 2, selected: 2, branches: [
        { ordinal: 1, disposition: "transport-settled", status: 204 },
        { ordinal: 2, disposition: "held", status: 0, reason: "held-at-seal" },
      ] });
      expect(selected(env.receiver.arrivals).map(([id]) => id)).toEqual([ids[0]]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("reports a non-2xx branch independently and does not call the whole broadcast successful", async () => {
    let requests = 0;
    const env = await setup({}, {
      respond(_request, response) { response.writeHead(++requests === 1 ? 503 : 204).end(); },
    });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({
        disposition: "partial", requests: 2, selected: 2, branches: [
          { ordinal: 1, disposition: "failed", status: 503 },
          { ordinal: 2, disposition: "transport-settled", status: 204 },
        ],
      });
      expect(receiver.arrivals).toHaveLength(2);
    } finally { await env.close(); }
  }, 5000);

  it("stops a broadcast after a transport failure and reports unattempted branches", async () => {
    let calls = 0;
    const env = await setup({
      fetchImpl(url, options) {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error("private-transport-error"));
        return fetch(url, options);
      },
    });
    try {
      const { adapter, receiver } = env;
      for (const id of ids.slice(0, 3)) adapter.fbq("init", id);
      adapter.fbq("track", "PageView");
      adapter.fbq("trackSingle", ids[2], "PageView");
      const state = await adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "transport-failed" });
      expect(state.outcomes[3]).toMatchObject({
        disposition: "partial", requests: 2, selected: 3, reason: "transport-failed", terminal: true,
        branches: [
          { ordinal: 1, disposition: "transport-settled", status: 204 },
          { ordinal: 2, disposition: "failed", status: 0, reason: "transport-failed" },
        ],
      });
      expect(state.outcomes[4]).toMatchObject({ disposition: "rejected", reason: "transport-failed" });
      expect(selected(receiver.arrivals).map(([id]) => id)).toEqual([ids[0]]);
      expect(calls).toBe(2);
      expect(JSON.stringify(state)).not.toContain("private-transport-error");
    } finally { await env.close(); }
  }, 5000);

  it("keeps the existing single-Pixel mode when multi-Pixel routing is not enabled", async () => {
    const env = await setup({ experimentalMultiPixelRouting: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackSingle", ids[0], "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "duplicate-init", "unsupported-command",
      ]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("terminates a timed-out broadcast and never sends its remaining branches", async () => {
    let requests = 0;
    const env = await setup({ commandTimeoutMs: 180, transportTimeoutMs: 1000 }, {
      respond(_request, response) {
        requests += 1;
        if (requests === 1) response.writeHead(204).end();
      },
    });
    try {
      const { adapter, receiver } = env;
      for (const id of ids.slice(0, 3)) adapter.fbq("init", id);
      adapter.fbq("track", "PageView");
      adapter.fbq("trackSingle", ids[2], "PageView");
      const state = await adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "command-timeout" });
      expect(state.outcomes.slice(-2).map((item) => item.reason)).toEqual(["command-timeout", "command-timeout"]);
      expect(selected(receiver.arrivals).map(([id]) => id)).toEqual(ids.slice(0, 2));
    } finally { await env.close(); }
  }, 5000);
});
