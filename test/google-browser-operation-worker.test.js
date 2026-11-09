import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const fixture = JSON.parse(readFileSync(new URL("../rig/fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const owned = fixture.owned;
const endpoint = `http://127.0.0.1:41234/pagead/conversion/${owned.conversion_id.slice(3)}/`;
const instanceId = "synthetic-browser-operation";
const command = {
  type: "google-ads-command", seq: 2, ts: 0, snapshot: {},
  payload: {
    args: ["event", "conversion", {
      send_to: `${owned.conversion_id}/${owned.conversion_label}`,
      value: 72, currency: "EUR", transaction_id: owned.transaction_id,
    }],
    context: { pageURL: owned.document_url, referrer: "" },
  },
};

function receive(chamber) {
  return new Promise((resolve, reject) => {
    const unsubscribe = chamber.onMessage((message) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("worker-test-deadline"));
    }, 1500);
  });
}

async function setup(chamber) {
  expect(await chamber.probe).toMatchObject({ ambientFetchDenied: true });
  let next = receive(chamber);
  chamber.postMessage({
    type: "init", endpoint, transportTimeoutMs: 500, experimentalRouting: true,
    experimentalBrowserOperation: { instanceId, epoch: 1, auid: owned.auid },
  });
  expect(await next).toEqual({ type: "phase", name: "configured" });
  next = receive(chamber);
  chamber.postMessage({
    type: "event",
    event: { ...command, seq: 1, payload: { ...command.payload, args: ["config", owned.conversion_id] } },
  });
  expect(await next).toMatchObject({ type: "result", summary: { seq: 1, disposition: "configured" } });
  next = receive(chamber);
  chamber.postMessage({ type: "event", event: command });
  return next;
}

function primaryFrame() {
  return fixture.entries[0].response.body.replaceAll("value=1", "value=72")
    .replaceAll("currency_code=USD", "currency_code=EUR");
}

function response(operation, outcome) {
  return {
    type: "browser-operation-response", instanceId, epoch: 1, commandId: 2,
    operationId: operation.operationId, outcome,
  };
}

describe("private Google browser-operation worker protocol", () => {
  it("authors a correlated primary from the actual command, not manual-capture defaults", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const primary = await setup(chamber);
      expect(primary).toMatchObject({
        type: "browser-operation-request", instanceId, epoch: 1, commandId: 2,
        operationId: 1, parentId: 0, stage: "primary", method: "GET",
      });
      const url = new URL(primary.url);
      expect(`${url.origin}${url.pathname}`).toBe(endpoint);
      expect([...url.searchParams.keys()].sort()).toEqual(["currency_code", "label", "oid", "url", "value"]);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        label: owned.conversion_label, value: "72", currency_code: "EUR",
        oid: owned.transaction_id, url: owned.document_url,
      });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("uses readable primary data for one secondary and reports an opaque result without HTTP success", async () => {
    const chamber = createNodeConversionChamber();
    const seen = [];
    const unsubscribe = chamber.onMessage((message) => seen.push(message));
    try {
      const primary = await setup(chamber);
      expect(primary).toMatchObject({ type: "browser-operation-request", operationId: 1 });
      let next = receive(chamber);
      chamber.postMessage(response(primary, {
        kind: "readable", status: 200, headers: { "content-type": "application/json" }, body: primaryFrame(),
      }));
      const secondary = await next;
      expect(secondary).toMatchObject({
        type: "browser-operation-request", instanceId, epoch: 1, commandId: 2,
        operationId: 2, parentId: 1, stage: "secondary", method: "POST",
      });
      const offered = new URL(fixture.entries[1].request.url.replace("value=1", "value=72")
        .replace("currency_code=USD", "currency_code=EUR"));
      const actual = new URL(secondary.url);
      expect(actual.origin).toBe(new URL(endpoint).origin);
      expect(actual.pathname).toBe(offered.pathname);
      expect(actual.search).toBe(offered.search);
      next = receive(chamber);
      chamber.postMessage(response(secondary, { kind: "opaque" }));
      const result = await next;
      expect(result).toMatchObject({
        type: "result", summary: { seq: 2, disposition: "opaque", authoredOperations: 2 },
      });
      expect(result.summary).not.toHaveProperty("status");
      expect(result.summary).not.toHaveProperty("headers");
      expect(result.summary).not.toHaveProperty("body");
      expect(result.summary.disposition).not.toBe("transport-settled");
      expect(seen.filter((message) => message.type === "browser-operation-request")).toHaveLength(2);
    } finally {
      unsubscribe();
      await chamber.dispose();
    }
  }, 5000);

  it("stops after an unreadable primary instead of authoring a secondary", async () => {
    const chamber = createNodeConversionChamber();
    const seen = [];
    const unsubscribe = chamber.onMessage((message) => seen.push(message));
    try {
      const primary = await setup(chamber);
      const next = receive(chamber);
      chamber.postMessage(response(primary, { kind: "opaque" }));
      expect(await next).toMatchObject({
        type: "result", summary: { seq: 2, disposition: "failed", reason: "primary-unreadable", authoredOperations: 1 },
      });
      expect(seen.filter((message) => message.type === "browser-operation-request")).toHaveLength(1);
    } finally {
      unsubscribe();
      await chamber.dispose();
    }
  }, 5000);

  it.each([
    ["foreign instance", (primary) => ({ ...response(primary, { kind: "opaque" }), instanceId: "foreign" })],
    ["stale epoch", (primary) => ({ ...response(primary, { kind: "opaque" }), epoch: 2 })],
    ["wrong command", (primary) => ({ ...response(primary, { kind: "opaque" }), commandId: 3 })],
    ["wrong operation", (primary) => ({ ...response(primary, { kind: "opaque" }), operationId: 2 })],
    ["invented opaque status", (primary) => response(primary, { kind: "opaque", status: 200 })],
    ["oversized readable body", (primary) => response(primary, {
      kind: "readable", status: 200, headers: {}, body: "x".repeat(65537),
    })],
    ["legacy response", (primary) => ({
      type: "intercepted-fetch-response", id: primary.operationId, status: 200, body: "",
    })],
  ])("rejects a %s instead of accepting it as a private response", async (_name, message) => {
    const chamber = createNodeConversionChamber();
    try {
      const primary = await setup(chamber);
      const next = receive(chamber);
      chamber.postMessage(message(primary));
      expect(await next).toEqual({ type: "fatal", message: "invalid-transport-response" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects a duplicate primary response while the secondary is pending", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const primary = await setup(chamber);
      const reply = response(primary, {
        kind: "readable", status: 200, headers: { "content-type": "application/json" }, body: primaryFrame(),
      });
      let next = receive(chamber);
      chamber.postMessage(reply);
      expect(await next).toMatchObject({ type: "browser-operation-request", stage: "secondary", parentId: 1 });
      next = receive(chamber);
      chamber.postMessage(reply);
      expect(await next).toEqual({ type: "fatal", message: "invalid-transport-response" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("does not send a primary if a required command value is missing", async () => {
    const chamber = createNodeConversionChamber();
    const seen = [];
    const unsubscribe = chamber.onMessage((message) => seen.push(message));
    try {
      expect(await chamber.probe).toMatchObject({ ambientFetchDenied: true });
      let next = receive(chamber);
      chamber.postMessage({
        type: "init", endpoint, transportTimeoutMs: 500, experimentalRouting: true,
        experimentalBrowserOperation: { instanceId, epoch: 1, auid: owned.auid },
      });
      await next;
      next = receive(chamber);
      chamber.postMessage({
        type: "event",
        event: { ...command, seq: 1, payload: { ...command.payload, args: ["config", owned.conversion_id] } },
      });
      await next;
      next = receive(chamber);
      const { value: omitted, ...params } = command.payload.args[2];
      expect(omitted).toBe(72);
      chamber.postMessage({
        type: "event", event: { ...command, payload: { ...command.payload, args: ["event", "conversion", params] } },
      });
      expect(await next).toMatchObject({ type: "fatal" });
      expect(seen.filter((message) => message.type === "browser-operation-request")).toHaveLength(0);
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);
});
