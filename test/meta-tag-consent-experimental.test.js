import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}, receiverOptions) {
  const receiver = await createPrototypeReceiver(receiverOptions);
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalTagConsent: true, ...options,
  });
  return {
    adapter, chamber, receiver,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function fakeChamber() {
  let listener;
  const sent = [];
  return {
    sent,
    postMessage(message) {
      sent.push(message);
      if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
    onError() { return () => {}; },
    emit(message) { listener?.(message); },
    dispose() {},
  };
}

describe("experimental tag consent through the trusted local seal", () => {
  it.each([false, true])("requires a boolean opt-in and keeps the command unsupported by default (multi=%s)", async (multi) => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalTagConsent: "true" })).toThrow("invalid-experimental-option");
    }
    const env = await setup({
      experimentalTagConsent: false, experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["unsupported-command", "initialized", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("applies tag consent to custom and targeted events", async () => {
    const env = await setup({
      experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalEvents: true,
    });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("consent", "revoke");
      adapter.fbq("trackCustom", "LocalCustom");
      adapter.fbq("trackSingleCustom", ids[1], "LocalCustom");
      adapter.fbq("consent", "grant");
      adapter.fbq("trackSingleCustom", ids[1], "LocalCustom");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", "consent-updated", "held", "held", "consent-updated", "transport-settled"]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("id"))).toEqual([ids[1]]);
      expect(JSON.stringify(state)).not.toContain(ids[1]);
    } finally { await env.close(); }
  }, 5000);

  it("holds the retained revoke-before-init sequence; grant allows only later new events", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("consent", "revoke");
      adapter.fbq("init", "000000000000000");
      adapter.fbq("track", "PageView");
      let state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual(["consent-updated", "initialized", "held"]);
      expect(receiver.arrivals).toHaveLength(0);
      adapter.fbq("consent", "grant");
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);
      adapter.fbq("track", "PageView");
      state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it.each(["denied", "pending", undefined])("never lets tag grant override host %s consent", async (hostConsent) => {
    const env = await setup({ consent: { ad_storage: hostConsent } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", "000000000000000");
      adapter.fbq("consent", "revoke");
      adapter.fbq("consent", "grant");
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toHaveLength(0);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("does not let host consent changes override a tag revoke", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("consent", "revoke");
      adapter.fbq("init", "000000000000000");
      adapter.setConsent({ ad_storage: "denied" });
      adapter.setConsent({ ad_storage: "granted" });
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toHaveLength(0);
    } finally { await env.close(); }
  }, 5000);

  it("does not read page context when capturing a tag consent command", async () => {
    const captureContext = vi.fn(() => { throw new Error("private-context"); });
    const env = await setup({ captureContext });
    try {
      env.adapter.fbq("consent", "revoke");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("consent-updated");
      expect(captureContext).not.toHaveBeenCalled();
    } finally { await env.close(); }
  }, 5000);

  it("immediately revokes remaining broadcast branches even if a grant is queued before the response", async () => {
    let adapter;
    let requests = 0;
    const env = await setup({ experimentalRouting: true, experimentalMultiPixelRouting: true }, {
      respond(_request, response) {
        requests += 1;
        if (requests === 1) {
          adapter.fbq("consent", "revoke");
          adapter.fbq("consent", "grant");
          adapter.fbq("trackSingle", ids[1], "PageView");
        }
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", "partial", "consent-updated", "consent-updated", "transport-settled"]);
      expect(state.outcomes[2].branches.map((branch) => branch.disposition)).toEqual(["transport-settled", "held"]);
      expect(env.receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("id"))).toEqual(ids);
      expect(state.host).toMatchObject({ dispatchAttempts: 2, consentHeld: 1 });
    } finally { await env.close(); }
  }, 5000);

  it("does not grant queued events captured under revoke or events superseded by a later revoke", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", "000000000000000");
      adapter.fbq("track", "PageView");
      adapter.fbq("consent", "revoke");
      adapter.fbq("track", "PageView");
      adapter.fbq("consent", "grant");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "held", "consent-updated", "held", "consent-updated", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed consent commands without changing the seal", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", "000000000000000");
      adapter.fbq("consent");
      adapter.fbq("consent", "REVOKE");
      adapter.fbq("consent", "revoke", "extra");
      adapter.fbq("consent", { action: "revoke" });
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.slice(1, 5).every((item) => item.disposition === "rejected")).toBe(true);
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("does not apply an overflow-rejected revoke", async () => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      queueLimit: 1, consent: { ad_storage: "granted" }, experimentalTagConsent: true,
    });
    try {
      adapter.fbq("init", "000000000000000");
      adapter.fbq("consent", "revoke");
      expect(adapter.getState().outcomes.at(-1).reason).toBe("queue-overflow");
      await Promise.resolve();
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("track", "PageView");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      await vi.waitFor(() => expect(chamber.sent).toContainEqual(expect.objectContaining({
        type: "intercepted-fetch-response", id: 1, status: 204,
      })));
      chamber.emit({ type: "result", summary: { seq: 3, disposition: "transport-settled", requests: 1, status: 204 }, ready: [] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); }
  });

  it.each([false, true])("rejects a fake worker trying to dispatch during a consent command (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      consent: { ad_storage: "granted" }, experimentalTagConsent: true,
      experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("consent", "grant");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each([false, true])("rejects a forged consent result (multi=%s)", async (multi) => {
    const chamber = fakeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
      experimentalTagConsent: true, experimentalRouting: multi, experimentalMultiPixelRouting: multi,
    });
    try {
      await Promise.resolve();
      adapter.fbq("consent", "grant");
      chamber.emit({ type: "result", summary: {
        seq: 1, disposition: "consent-updated", requests: 0, private: "must-not-appear",
      }, ready: [] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(JSON.stringify(state)).not.toContain("must-not-appear");
    } finally { await adapter.dispose(); }
  });

  it("holds a fake worker request even when it ignores an admitted revoke", async () => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      consent: { ad_storage: "granted" }, experimentalTagConsent: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000000");
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("consent", "revoke");
      chamber.emit({ type: "result", summary: { seq: 2, disposition: "consent-updated", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("track", "PageView");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      expect(chamber.sent).toContainEqual(expect.objectContaining({
        type: "intercepted-fetch-response", id: 1, status: 0, statusText: "held at the seal: consent",
      }));
      chamber.emit({ type: "result", summary: {
        seq: 3, disposition: "held", requests: 1, status: 0, reason: "held-at-seal",
      }, ready: [] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it("rejects a fake single-Pixel worker claiming a held request was sent", async () => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, fetchImpl,
      consent: { ad_storage: "denied" }, experimentalTagConsent: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000000");
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("track", "PageView");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:43210/tr/?ev=PageView" });
      expect(chamber.sent).toContainEqual(expect.objectContaining({
        type: "intercepted-fetch-response", id: 1, status: 0,
      }));
      chamber.emit({ type: "result", summary: {
        seq: 2, disposition: "transport-settled", requests: 1, status: 204,
      }, ready: [] });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
});
