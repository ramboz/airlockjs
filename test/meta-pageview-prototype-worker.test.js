import { describe, expect, it } from "vitest";
import { createNodePrototypeChamber } from "../rig/meta-pageview-prototype.mjs";
import { createSyntheticIdentityFixtures } from "../connectors/meta-pixel/synthetic-identity.js";

const endpoint = "http://127.0.0.1:43210/tr/";
const event = (seq, args) => ({
  seq, ts: 0, type: "meta-pixel-command", snapshot: {},
  payload: {
    args,
    context: {
      pageURL: "https://example.test/", referrer: "", inFrame: true,
      screenWidth: 1920, screenHeight: 1080, timezoneOffset: 60,
    },
  },
});

function receive(chamber, type) {
  return new Promise((resolve, reject) => {
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type !== type) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("worker-test-deadline")); }, 1500);
  });
}

async function configure(chamber, transportTimeoutMs = 500) {
  const configured = receive(chamber, "phase");
  chamber.postMessage({ type: "init", endpoint, transportTimeoutMs });
  expect(await configured).toEqual({ type: "phase", name: "configured" });
  const initialized = receive(chamber, "result");
  chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
  expect((await initialized).summary).toMatchObject({ seq: 1, disposition: "initialized", requests: 0 });
}

describe("actual first-party worker correlated protocol (not receipt evidence)", () => {
  it.each(["experimentalRouting", "experimentalPageViewData", "experimentalMultiPixelRouting", "experimentalEvents", "experimentalScalarEventData", "experimentalContentNameArray", "experimentalContentIds", "experimentalContents", "experimentalContentsItemPrice", "experimentalCustomProperties", "experimentalNumericOrderId", "experimentalEventIds", "experimentalSetAgent", "experimentalNullPurchaseValue", "experimentalSyntheticAdvancedMatching", "experimentalTagConsent"])("rejects mistyped %s during worker initialization", async (option) => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, [option]: "true" });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each([false, true])("revalidates null Purchase values in the worker (enabled=%s)", async (enabled) => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalEvents: true,
        experimentalPageViewData: true, experimentalNullPurchaseValue: enabled,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      for (const [seq, args] of [
        [2, ["trackCustom", "Other", { value: null }]],
        [3, ["track", "Purchase", { value: null }]],
        [4, ["trackCustom", "Purchase", { value: "null" }]],
      ]) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(seq, args) });
        expect((await rejected).summary).toMatchObject({
          seq, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
      }
      expect(requests).toEqual([]);
      if (!enabled) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(5, ["trackCustom", "Purchase", { value: null }]) });
        expect((await rejected).summary).toMatchObject({
          seq: 5, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
        expect(requests).toEqual([]);
      } else {
        const intercepted = receive(chamber, "intercepted-fetch");
        chamber.postMessage({ type: "event", event: event(5, ["trackCustom", "Purchase", { value: null }]) });
        const request = await intercepted;
        expect(new URL(request.url).searchParams.getAll("cd[value]")).toEqual(["null"]);
        const settled = receive(chamber, "result");
        chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
        expect((await settled).summary).toMatchObject({ seq: 5, disposition: "transport-settled", status: 204 });
      }
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it.each([
    { experimentalEvents: true },
    { experimentalPageViewData: true },
  ])("rejects a null Purchase opt-in with missing worker prerequisites", async (options) => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalNullPurchaseValue: true, ...options,
      });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("revalidates consent command shapes in the serialized worker without requesting transport", async () => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalTagConsent: true });
      await configured;
      const commands = [
        { args: ["consent", "revoke"], disposition: "consent-updated" },
        { args: ["consent", "grant"], disposition: "consent-updated" },
        { args: ["consent"], disposition: "rejected" },
        { args: ["consent", "REVOKE"], disposition: "rejected" },
        { args: ["consent", "revoke", "extra"], disposition: "rejected" },
        { args: ["consent", { action: "revoke" }], disposition: "rejected" },
      ];
      for (const [index, command] of commands.entries()) {
        const result = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 1, command.args) });
        expect((await result).summary).toMatchObject({
          seq: index + 1, disposition: command.disposition, requests: 0,
          ...(command.disposition === "rejected" ? { reason: "unsupported-command" } : {}),
        });
      }
      expect(requests).toEqual([]);
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it.each([false, true])("revalidates agent commands in the worker (enabled=%s)", async (enabled) => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    const agent = "magento_opensource-0.0.0-1.2.3";
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalSetAgent: enabled });
      await configured;
      const beforeInit = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["set", "agent", agent, "000000000000000"]) });
      expect((await beforeInit).summary).toMatchObject({
        seq: 1, disposition: "rejected", reason: enabled ? "uninitialized-pixel" : "unsupported-command", requests: 0,
      });
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(2, ["init", "000000000000000"]) });
      await initialized;
      const invalid = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(3, ["set", "agent", "not-a-supported-agent", "000000000000000"]) });
      expect((await invalid).summary).toMatchObject({
        seq: 3, disposition: "rejected", reason: enabled ? "unsupported-agent" : "unsupported-command", requests: 0,
      });
      const set = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(4, ["set", "agent", agent, "000000000000000"]) });
      expect((await set).summary).toMatchObject({
        seq: 4, disposition: enabled ? "agent-updated" : "rejected", requests: 0,
        ...(enabled ? {} : { reason: "unsupported-command" }),
      });
      expect(requests).toEqual([]);
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(5, ["track", "PageView"]) });
      const request = await requested;
      expect(new URL(request.url).searchParams.getAll("a")).toEqual(enabled ? [agent] : []);
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 5, disposition: "transport-settled", status: 204 });
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("rejects the content-ID opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalContentIds: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the content-name array opt-in when scalar data is disabled", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalContentNameArray: true,
      });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each([false, true])("revalidates serialized content-name arrays in the worker (enabled=%s)", async (enabled) => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalEvents: true,
        experimentalPageViewData: true, experimentalScalarEventData: true, experimentalContentNameArray: enabled,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      const invalid = [[1], [null], Array(17).fill("name")];
      if (!enabled) invalid.push(["Test Product"]);
      for (const [index, names] of invalid.entries()) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 2, ["trackCustom", "Purchase", { content_name: names }]) });
        expect((await rejected).summary).toMatchObject({
          seq: index + 2, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
      }
      expect(requests).toEqual([]);
      if (enabled) {
        const requested = receive(chamber, "intercepted-fetch");
        chamber.postMessage({
          type: "event", event: event(5, ["trackCustom", "Purchase", { content_name: ["Test Product"] }]),
        });
        const request = await requested;
        expect(new URL(request.url).searchParams.get("cd[content_name]")).toBe('["Test Product"]');
        const settled = receive(chamber, "result");
        chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
        expect((await settled).summary).toMatchObject({ seq: 5, disposition: "transport-settled", status: 204 });
      }
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("rejects the event-ID opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalEventIds: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the contents opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalContents: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the item-price opt-in when contents are disabled", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalContentsItemPrice: true,
      });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the custom-property opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalCustomProperties: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the numeric order-ID opt-in when custom properties are disabled", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalNumericOrderId: true,
      });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("revalidates serialized numeric order IDs before requesting transport", async () => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalEvents: true,
        experimentalPageViewData: true, experimentalCustomProperties: true, experimentalNumericOrderId: true,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      for (const [index, data] of [
        { order_id: -1 }, { order_id: 1.5 }, { order_id: Number.MAX_SAFE_INTEGER + 1 },
        { order_id: NaN }, { order_id: -0 }, { other_number: 1 },
      ].entries()) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 2, ["trackCustom", "Purchase", data]) });
        expect((await rejected).summary).toMatchObject({
          seq: index + 2, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
      }
      expect(requests).toEqual([]);
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(8, ["trackCustom", "Purchase", { order_id: 1 }]) });
      const request = await requested;
      expect(new URL(request.url).searchParams.get("cd[order_id]")).toBe("1");
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 8, disposition: "transport-settled", status: 204 });
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("revalidates serialized custom properties before requesting transport", async () => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalCustomProperties: true,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      for (const [index, data] of [
        { placement: 1 }, { region: "us" },
        Object.fromEntries(Array.from({ length: 9 }, (_, item) => [`field_${item}`, "x"])),
      ].entries()) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 2, ["track", "PageView", data]) });
        expect((await rejected).summary).toMatchObject({
          seq: index + 2, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
      }
      expect(requests).toEqual([]);
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(5, ["track", "PageView", { placement: "header" }]) });
      const request = await requested;
      expect(new URL(request.url).searchParams.get("cd[placement]")).toBe("header");
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 5, disposition: "transport-settled", status: 204 });
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("revalidates serialized nested contents before requesting transport", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalContents: true,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      const rejected = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView", {
        contents: [{ id: "one", quantity: 1, item_price: 2 }],
      }]) });
      expect((await rejected).summary).toMatchObject({ seq: 2, disposition: "rejected", reason: "unsupported-parameters" });
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(3, ["track", "PageView", {
        contents: [{ id: "one", quantity: 2 }],
      }]) });
      const request = await requested;
      expect(new URL(request.url).searchParams.get("cd[contents]")).toBe('[{"id":"one","quantity":2}]');
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 3, disposition: "transport-settled", status: 204 });
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each([false, true])("revalidates serialized item prices in the worker (enabled=%s)", async (enabled) => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalEvents: true,
        experimentalPageViewData: true, experimentalContents: true, experimentalContentsItemPrice: enabled,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      const invalid = [
        { id: "sku", quantity: 1, item_price: -1 },
        { id: "sku", quantity: 1, item_price: NaN },
        { id: "sku", quantity: 1, item_price: 100, extra: true },
      ];
      if (!enabled) invalid.push({ id: "sku", quantity: 1, item_price: 100 });
      for (const [index, item] of invalid.entries()) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 2, ["trackCustom", "Purchase", { contents: [item] }]) });
        expect((await rejected).summary).toMatchObject({
          seq: index + 2, disposition: "rejected", reason: "unsupported-parameters", requests: 0,
        });
      }
      expect(requests).toEqual([]);
      if (enabled) {
        const requested = receive(chamber, "intercepted-fetch");
        chamber.postMessage({
          type: "event", event: event(5, ["trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1, item_price: 100 }] }]),
        });
        const request = await requested;
        expect(new URL(request.url).searchParams.get("cd[contents]")).toBe('[{"id":"sku","quantity":1,"item_price":100}]');
        const settled = receive(chamber, "result");
        chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
        expect((await settled).summary).toMatchObject({ seq: 5, disposition: "transport-settled", status: 204 });
      }
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("revalidates event options after serialization before the worker requests transport", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500,
        experimentalPageViewData: true, experimentalEventIds: true,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000000"]) });
      await initialized;
      const rejected = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView", {}, { eventID: 1 }]) });
      expect((await rejected).summary).toMatchObject({ seq: 2, disposition: "rejected", reason: "unsupported-options" });
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(3, ["track", "PageView", {}, { eventID: "local-id" }]) });
      const request = await requested;
      expect(new URL(request.url).searchParams.get("eid")).toBe("local-id");
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 3, disposition: "transport-settled", status: 204 });
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each([false, true])("revalidates custom-event options in the worker (event IDs=%s)", async (enabled) => {
    const chamber = createNodePrototypeChamber();
    const requests = [];
    const unsubscribe = chamber.onMessage((message) => {
      if (message.type === "intercepted-fetch") requests.push(message);
    });
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalEvents: true,
        experimentalPageViewData: true, experimentalEventIds: enabled,
        experimentalRouting: true, experimentalMultiPixelRouting: true,
      });
      await configured;
      const initialized = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000001"]) });
      await initialized;
      const invalid = [
        ["trackCustom", "Purchase", {}, { eventID: 1 }],
        ["trackSingleCustom", "000000000000001", "Purchase", {}, { eventID: "one" }],
      ];
      for (const [index, args] of invalid.entries()) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 2, args) });
        expect((await rejected).summary).toMatchObject({
          seq: index + 2, disposition: "rejected",
          reason: enabled && index === 0 ? "unsupported-options" : "unsupported-command", requests: 0,
        });
      }
      if (!enabled) {
        const rejected = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(4, ["trackCustom", "Purchase", {}, { eventID: "one" }]) });
        expect((await rejected).summary).toMatchObject({
          seq: 4, disposition: "rejected", reason: "unsupported-command", requests: 0,
        });
        expect(requests).toEqual([]);
      } else {
        expect(requests).toEqual([]);
        const requested = receive(chamber, "intercepted-fetch");
        chamber.postMessage({ type: "event", event: event(4, ["trackCustom", "Purchase", {}, { eventID: "one" }]) });
        const request = await requested;
        expect(new URL(request.url).searchParams.get("eid")).toBe("one");
        const settled = receive(chamber, "result");
        chamber.postMessage({ type: "intercepted-fetch-response", id: request.id, status: 204, body: "" });
        expect((await settled).summary).toMatchObject({
          seq: 4, disposition: "transport-settled",
          branches: [{ ordinal: 1, disposition: "transport-settled", status: 204 }],
        });
      }
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("revalidates synthetic init identities after serialization", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalRouting: true,
        experimentalMultiPixelRouting: true, experimentalSyntheticAdvancedMatching: true,
        syntheticIdentityFixtures: createSyntheticIdentityFixtures(),
      });
      await configured;
      const rejected = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(1, ["init", "000000000000001", { external_id: "unsupported" }]) });
      expect((await rejected).summary).toMatchObject({ seq: 1, disposition: "rejected", reason: "unsupported-identity" });
      const beforeInit = receive(chamber, "result");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView"]) });
      expect((await beforeInit).summary).toMatchObject({ seq: 2, disposition: "rejected", reason: "pageview-before-init" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each(["unknown-id", "invalid-status", "oversized-body"])("fails visibly on %s, not a success-shaped result", async (kind) => {
    const chamber = createNodePrototypeChamber();
    try {
      await configure(chamber);
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView"]) });
      const request = await requested;
      expect(request.method).toBe("GET");
      expect(new URL(request.url).searchParams.get("if")).toBe("true");
      const failed = receive(chamber, "fatal");
      chamber.postMessage({
        type: "intercepted-fetch-response",
        id: kind === "unknown-id" ? request.id + 1 : request.id,
        status: kind === "invalid-status" ? 999 : 204,
        body: kind === "oversized-body" ? "x".repeat(4097) : "",
      });
      expect(await failed).toEqual({ type: "fatal", message: "invalid-transport-response" });
    } finally {
      await chamber.dispose();
    }
  }, 5000);

  it("bounds pending transport and emits fatal when no correlated response arrives", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      await configure(chamber, 40);
      const requested = receive(chamber, "intercepted-fetch");
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView"]) });
      await requested;
      expect(await failed).toEqual({ type: "fatal", message: "transport-timeout" });
    } finally {
      await chamber.dispose();
    }
  }, 5000);

  it("rejects a second in-flight command rather than confusing the first response/result", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      await configure(chamber);
      const requested = receive(chamber, "intercepted-fetch");
      chamber.postMessage({ type: "event", event: event(2, ["track", "PageView"]) });
      await requested;
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "event", event: event(3, ["track", "PageView"]) });
      expect(await failed).toEqual({ type: "fatal", message: "invalid-command-order" });
    } finally {
      await chamber.dispose();
    }
  }, 5000);
});
