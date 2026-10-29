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
  it.each(["experimentalRouting", "experimentalPageViewData", "experimentalMultiPixelRouting", "experimentalEvents", "experimentalScalarEventData", "experimentalContentIds", "experimentalEventIds", "experimentalSyntheticAdvancedMatching"])("rejects mistyped %s during worker initialization", async (option) => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, [option]: "true" });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the content-ID opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalContentIds: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects the event-ID opt-in when its data prerequisite is absent", async () => {
    const chamber = createNodePrototypeChamber();
    try {
      const failed = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalEventIds: true });
      expect(await failed).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
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
