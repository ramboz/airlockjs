import { describe, expect, it } from "vitest";
import { createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const event = (seq, args) => ({
  type: "google-ads-command", seq, ts: 0, snapshot: {},
  payload: { args, context: { pageURL: "https://example.test/worker-protocol", referrer: "" } },
});
const conversion = ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 72, currency: "EUR", transaction_id: "worker-only-72" }];

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
  const result = receive(chamber, "result");
  chamber.postMessage({ type: "event", event: event(1, ["config", "AW-0000000000"]) });
  expect((await result).summary).toMatchObject({ seq: 1, disposition: "configured", requests: 0 });
}
async function request(chamber, seq = 2) {
  const intercepted = receive(chamber, "intercepted-fetch");
  chamber.postMessage({ type: "event", event: event(seq, conversion) });
  return intercepted;
}

describe("actual worker correlation faults, not independent receiver evidence", () => {
  it("rejects a mistyped experimental routing option during worker initialization", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalRouting: "true" });
      expect(await fatal).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects a mistyped experimental scope option during worker initialization", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalParameterScopes: "true" });
      expect(await fatal).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects a mistyped bootstrap option during worker initialization", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalBootstrap: "true" });
      expect(await fatal).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("validates the primitive bootstrap timestamp inside the actual worker", async () => {
    const chamber = createNodeConversionChamber();
    try {
      const configured = receive(chamber, "phase");
      chamber.postMessage({ type: "init", endpoint, transportTimeoutMs: 500, experimentalBootstrap: true });
      await configured;
      const values = [123, NaN, Infinity, 0.5, 8640000000000001, "123", new Date(123), {}, null];
      for (const [index, value] of values.entries()) {
        const result = receive(chamber, "result");
        chamber.postMessage({ type: "event", event: event(index + 1, ["js", value]) });
        expect((await result).summary).toEqual(index === 0
          ? { seq: 1, disposition: "bootstrap-accepted", requests: 0 }
          : { seq: index + 1, disposition: "rejected", reason: "unsupported-bootstrap", requests: 0 });
      }
    } finally { await chamber.dispose(); }
  }, 5000);

  it.each(["unknown-id", "invalid-status", "oversized-body"])("fails terminally on %s rather than posting a success result", async (fault) => {
    const chamber = createNodeConversionChamber();
    try {
      await configure(chamber);
      const intercepted = await request(chamber);
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({
        type: "intercepted-fetch-response",
        id: fault === "unknown-id" ? intercepted.id + 1 : intercepted.id,
        status: fault === "invalid-status" ? 999 : 204,
        body: fault === "oversized-body" ? "x".repeat(4097) : "",
      });
      expect(await fatal).toEqual({ type: "fatal", message: "invalid-transport-response" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("never lets a duplicate old response ID settle the next command", async () => {
    const chamber = createNodeConversionChamber();
    const results = [];
    const unsubscribe = chamber.onMessage((message) => { if (message.type === "result") results.push(message.summary.seq); });
    try {
      await configure(chamber);
      const first = await request(chamber);
      const settled = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: first.id, status: 204, body: "" });
      expect((await settled).summary).toMatchObject({ seq: 2, disposition: "transport-settled" });
      const second = await request(chamber, 3);
      expect(second.id).not.toBe(first.id);
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({ type: "intercepted-fetch-response", id: first.id, status: 204, body: "" });
      expect(await fatal).toEqual({ type: "fatal", message: "invalid-transport-response" });
      expect(results).toEqual([1, 2]);
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("bounds lost correlation and ignores a late response after terminal timeout", async () => {
    const chamber = createNodeConversionChamber();
    const seen = [];
    const unsubscribe = chamber.onMessage((message) => seen.push(message));
    try {
      await configure(chamber, 30);
      const fatal = receive(chamber, "fatal");
      const intercepted = await request(chamber);
      expect(await fatal).toEqual({ type: "fatal", message: "transport-timeout" });
      chamber.postMessage({ type: "intercepted-fetch-response", id: intercepted.id, status: 204, body: "" });
      chamber.postMessage({ type: "event", event: event(3, conversion) });
      // A bounded observation window, not a retry or new transport attempt.
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(seen.filter((message) => message.type === "result").map((message) => message.summary.seq)).toEqual([1]);
      expect(seen.filter((message) => message.type === "intercepted-fetch")).toHaveLength(1);
    } finally { unsubscribe(); await chamber.dispose(); }
  }, 5000);

  it("treats status zero as failed/terminal, not a receipt or successful empty response", async () => {
    const chamber = createNodeConversionChamber();
    try {
      await configure(chamber);
      const intercepted = await request(chamber);
      const result = receive(chamber, "result");
      chamber.postMessage({ type: "intercepted-fetch-response", id: intercepted.id, status: 0, body: "" });
      expect((await result).summary).toMatchObject({ seq: 2, disposition: "failed", status: 0, terminal: true, reason: "transport-failed" });
    } finally { await chamber.dispose(); }
  }, 5000);

  it("rejects a concurrent second command rather than mixing request/result sequences", async () => {
    const chamber = createNodeConversionChamber();
    try {
      await configure(chamber);
      await request(chamber);
      const fatal = receive(chamber, "fatal");
      chamber.postMessage({ type: "event", event: event(3, conversion) });
      expect(await fatal).toEqual({ type: "fatal", message: "invalid-command-order" });
    } finally { await chamber.dispose(); }
  }, 5000);
});
