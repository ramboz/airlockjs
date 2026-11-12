import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createSyntheticIdentityFixtures } from "../connectors/meta-pixel/synthetic-identity.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002", "000000000000003"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const context = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});
const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: context() } });

async function setup(options = {}, receiverOptions) {
  const receiver = await createPrototypeReceiver(receiverOptions);
  const chamber = createNodePrototypeChamber();
  const workerMessages = [];
  chamber.onMessage((message) => workerMessages.push(message));
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: context, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true,
    experimentalSyntheticAdvancedMatching: true, ...options,
  });
  const values = adapter.syntheticIdentity
    ? [adapter.syntheticIdentity(0).external_id, adapter.syntheticIdentity(1).external_id]
    : createSyntheticIdentityFixtures();
  return {
    adapter, receiver, workerMessages, values,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

describe("synthetic Meta init identity through the local worker", () => {
  it("requires a boolean opt-in and validated multi-Pixel result handling", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalSyntheticAdvancedMatching: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalSyntheticAdvancedMatching: true })).toThrow("synthetic-identity-requires-multi-pixel-routing");
    }
  });

  it("generates private, per-instance fixtures and accepts only valid slots", async () => {
    const first = await setup();
    const second = await setup();
    try {
      expect(first.values.every((value) => !second.values.includes(value))).toBe(true);
      expect(() => first.adapter.syntheticIdentity(-1)).toThrow("invalid-synthetic-identity-index");
      expect(() => first.adapter.syntheticIdentity(2)).toThrow("invalid-synthetic-identity-index");
      const copy = first.adapter.syntheticIdentity(0);
      copy.external_id = second.values[0];
      first.adapter.fbq("init", ids[0], copy);
      first.adapter.fbq("init", ids[0], first.adapter.syntheticIdentity(0));
      first.adapter.fbq("track", "PageView");
      const state = await first.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "unsupported-identity", "initialized", "transport-settled",
      ]);
      expect([...first.values, ...second.values].every((value) => !JSON.stringify(state).includes(value))).toBe(true);
    } finally { await first.close(); await second.close(); }
  }, 5000);

  it("snapshots and hashes separately per Pixel without exposing raw inputs or hashes in public state", async () => {
    const env = await setup({ experimentalEvents: true });
    try {
      const { adapter, receiver, workerMessages, values } = env;
      const input = { external_id: values[0] };
      adapter.fbq("init", ids[0], input);
      input.external_id = values[1];
      adapter.fbq("init", ids[1], { external_id: values[1] });
      adapter.fbq("init", ids[2]);
      adapter.fbq("track", "PageView");
      adapter.fbq("trackSingle", ids[1], "Purchase");
      adapter.fbq("init", ids[0], { external_id: values[1] });
      adapter.fbq("trackSingle", ids[0], "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "initialized", "initialized", "transport-settled",
        "transport-settled", "duplicate-init", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(5);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      const expected = [[ids[0], hash(values[0])], [ids[1], hash(values[1])], [ids[2], null],
        [ids[1], hash(values[1])], [ids[0], hash(values[0])]];
      expect(queries.every((query, index) =>
        query.get("id") === expected[index][0] && query.get("ud[external_id]") === expected[index][1] &&
        query.getAll("ud[external_id]").length === (expected[index][1] ? 1 : 0))).toBe(true);
      const privateValues = [...values, ...values.map(hash)];
      const publicState = JSON.stringify(state);
      expect(privateValues.every((value) => !publicState.includes(value))).toBe(true);
      expect(workerMessages.every((message) => values.every((value) => !JSON.stringify(message).includes(value)))).toBe(true);
      expect(receiver.arrivals.every(({ url }) => values.every((value) => !decodeURIComponent(url).includes(value)))).toBe(true);
    } finally { await env.close(); }
  }, 5000);

  it("rejects all non-fixture identities and unsupported fields without invoking accessors", async () => {
    const env = await setup();
    try {
      const { values } = env;
      let getterReads = 0;
      const invalid = [
        null, [], {}, { external_id: "" }, { external_id: "not-an-approved-synthetic-value" },
        { external_id: values[0].toUpperCase() }, { external_id: 1 }, { external_id: null },
        { external_id: values[0], em: "unsupported" },
        { external_id: values[0], [Symbol("extra")]: 1 },
        Object.assign(Object.create({ extra: true }), { external_id: values[0] }),
        { get external_id() { getterReads += 1; return values[0]; } },
      ];
      for (const value of invalid) env.adapter.fbq("init", ids[0], value);
      env.adapter.fbq("init", ids[0], { external_id: values[0] });
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(0, invalid.length).every((item) => item.reason === "unsupported-identity")).toBe(true);
      expect(state.outcomes.slice(-2).map((item) => item.disposition)).toEqual(["initialized", "transport-settled"]);
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("preserves default rejection of an init identity record", async () => {
    const env = await setup({ experimentalSyntheticAdvancedMatching: false });
    try {
      const { values } = env;
      expect(env.adapter.syntheticIdentity).toBeUndefined();
      env.adapter.fbq("init", ids[0], { external_id: values[0] });
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "unsupported-argument", "initialized", "transport-settled",
      ]);
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("ud[external_id]")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it("holds denied requests without replay and uses the identity only on a later granted request", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { values } = env;
      env.adapter.fbq("init", ids[0], { external_id: values[0] });
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(env.receiver.arrivals).toHaveLength(0);
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toHaveLength(0);
      env.adapter.fbq("trackSingle", ids[0], "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals).toHaveLength(1);
      const actual = new URL(env.receiver.arrivals[0].url).searchParams.get("ud[external_id]");
      expect(actual === hash(values[0])).toBe(true);
    } finally { await env.close(); }
  }, 5000);

  it("rechecks consent between identity-bearing broadcast branches", async () => {
    let adapter;
    const env = await setup({}, {
      respond(_request, response) {
        adapter.setConsent({ ad_storage: "denied" });
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      const { values } = env;
      adapter.fbq("init", ids[0], { external_id: values[0] });
      adapter.fbq("init", ids[1], { external_id: values[1] });
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial", requests: 2, selected: 2,
        branches: [
          { ordinal: 1, disposition: "transport-settled", status: 204 },
          { ordinal: 2, disposition: "held", status: 0, reason: "held-at-seal" },
        ],
      });
      expect(env.receiver.arrivals).toHaveLength(1);
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(query.get("id") === ids[0] && query.get("ud[external_id]") === hash(values[0])).toBe(true);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("combines synthetic identity with opted-in event data and event-ID inputs", async () => {
    const env = await setup({
      experimentalEvents: true, experimentalPageViewData: true,
      experimentalScalarEventData: true, experimentalEventIds: true,
    });
    try {
      const { values } = env;
      env.adapter.fbq("init", ids[0], { external_id: values[0] });
      env.adapter.fbq("track", "Purchase", { value: 12, currency: "USD", region: "us" }, { eventID: "local-event" });
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals).toHaveLength(1);
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(query.get("ud[external_id]") === hash(values[0])).toBe(true);
      expect([query.get("ev"), query.get("cd[value]"), query.get("cd[currency]"),
        query.get("cd[region]"), query.get("eid")]).toEqual(["Purchase", "12", "USD", "us", "local-event"]);
    } finally { await env.close(); }
  }, 5000);

  it("includes the synthetic hash when enforcing the encoded request ceiling", async () => {
    const page = context();
    const env = await setup({ captureContext: () => page });
    try {
      const { adapter, receiver, values } = env;
      adapter.fbq("init", ids[0], { external_id: values[0] });
      let candidate;
      for (let count = 1; count <= 1500; count += 1) {
        const pageURL = `https://example.test/${"é".repeat(count)}`;
        const query = new URLSearchParams({
          id: ids[0], ev: "PageView", dl: pageURL, rl: "", if: "false",
          sw: "412", sh: "823", tz: "420",
        });
        const baseLength = `${receiver.endpoint}?${query}`.length;
        query.append("ud[external_id]", "a".repeat(64));
        if (baseLength <= 8192 && `${receiver.endpoint}?${query}`.length > 8192) {
          candidate = pageURL;
          break;
        }
      }
      expect(typeof candidate).toBe("string");
      page.pageURL = candidate;
      adapter.fbq("trackSingle", ids[0], "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.at(-1).reason).toBe("encoded-context-limit");
      expect(receiver.arrivals).toHaveLength(0);
    } finally { await env.close(); }
  }, 5000);

  it("revalidates in the connector and fails closed if hashing fails", async () => {
    const values = createSyntheticIdentityFixtures();
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalRouting: true,
      experimentalMultiPixelRouting: true, experimentalSyntheticAdvancedMatching: true,
      syntheticIdentityFixtures: values,
    });
    await host.init({});
    const invalid = await host.routeBatch([command(["init", ids[0], { external_id: "unsupported" }])]);
    expect(invalid.ready).toEqual([]);
    expect(invalid.dropped[0].reason).toBe("unsupported-identity");
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValue(new Error("private-error"));
    try {
      const failed = await host.routeBatch([command(["init", ids[0], { external_id: values[0] }])]);
      expect(failed.ready).toEqual([]);
      expect(failed.dropped[0].reason).toBe("identity-hash-failed");
    } finally { digest.mockRestore(); }
    expect((await host.routeBatch([command(["track", "PageView"])])).dropped[0].reason).toBe("pageview-before-init");
    expect((await host.routeBatch([command(["init", ids[0], { external_id: values[0] }])])).dropped).toEqual([]);
  });

  it("reserves the original Pixel during asynchronous hashing and enforces the Pixel limit", async () => {
    const values = createSyntheticIdentityFixtures();
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalRouting: true,
      experimentalMultiPixelRouting: true, experimentalSyntheticAdvancedMatching: true,
      syntheticIdentityFixtures: values,
    });
    await host.init({});
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let release;
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation((...args) =>
      new Promise((resolve, reject) => {
        release = () => originalDigest(...args).then(resolve, reject);
      }));
    try {
      const args = ["init", ids[0], { external_id: values[0] }];
      const pending = host.routeBatch([command(args)]);
      args[1] = "000000000000005";
      expect((await host.routeBatch([command(["init", ids[0]])])).dropped[0].reason).toBe("duplicate-init");
      for (const id of [ids[1], ids[2], "000000000000004"]) {
        expect((await host.routeBatch([command(["init", id])])).dropped).toEqual([]);
      }
      expect((await host.routeBatch([command(["init", "000000000000005"])])).dropped[0].reason).toBe("pixel-limit");
      release();
      expect((await pending).dropped).toEqual([]);
      const result = await host.routeBatch([command(["trackSingle", ids[0], "PageView"])]);
      expect(result.dropped).toEqual([]);
      expect(new URL(result.ready[0].url).searchParams.get("ud[external_id]") === hash(values[0])).toBe(true);
    } finally { digest.mockRestore(); }
  });

  it("rejects a worker summary that attempts to expose the synthetic input", async () => {
    let listener;
    let values;
    const chamber = {
      onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
      onError() { return () => {}; },
      postMessage(message) {
        if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
        if (message.type === "event") queueMicrotask(() => listener?.({
          type: "result", ready: [],
          summary: { seq: message.event.seq, disposition: "initialized", requests: 0, private: values[0] },
        }));
      },
      dispose() {},
    };
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: context,
      experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalSyntheticAdvancedMatching: true,
    });
    values = [adapter.syntheticIdentity(0).external_id, adapter.syntheticIdentity(1).external_id];
    try {
      adapter.fbq("init", ids[0], { external_id: values[0] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(values.every((value) => !JSON.stringify(state).includes(value))).toBe(true);
    } finally { await adapter.dispose(); }
  }, 5000);

  it("rejects any worker transport during synthetic identity init before reaching the host", async () => {
    let listener;
    let fetches = 0;
    let values;
    const chamber = {
      onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
      onError() { return () => {}; },
      postMessage(message) {
        if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
        if (message.type === "event") queueMicrotask(() => listener?.({
          type: "intercepted-fetch", id: 1, method: "GET",
          url: `http://127.0.0.1:43210/tr/?unexpected=${values[0]}`,
        }));
      },
      dispose() {},
    };
    const adapter = createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: context,
      consent: { ad_storage: "granted" }, fetchImpl: () => { fetches += 1; },
      experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalSyntheticAdvancedMatching: true,
    });
    values = [adapter.syntheticIdentity(0).external_id, adapter.syntheticIdentity(1).external_id];
    try {
      adapter.fbq("init", ids[0], { external_id: values[0] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(state.host.dispatchAttempts).toBe(0);
      expect(fetches).toBe(0);
      expect(values.every((value) => !JSON.stringify(state).includes(value))).toBe(true);
    } finally { await adapter.dispose(); }
  }, 5000);
});
