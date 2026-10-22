import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

async function engineWithPublicBoundaries(fault = "") {
  const calls = [], originals = [];
  const server = { process: () => ({ pid: 630003 }), wsEndpoint: () => "ws://127.0.0.1:63001/not-retained",
    close: vi.fn(async () => { calls.push("server-close"); }) };
  const cdp = { detach: vi.fn(async () => {}), send: vi.fn(async (method, parameters) => {
    calls.push(method);
    const challenge = parameters.expression.match(/value:("[a-f0-9]+")/)[1];
    return { result: { value: JSON.stringify({ href: fault === "remote-page" ? "https://example.invalid/" : "about:blank",
      value: [...JSON.parse(challenge)].reverse().join("") }) } };
  }) };
  const page = { url: () => "about:blank" };
  const context = { route: vi.fn(async () => {}), cookies: vi.fn(async () => fault === "dirty-context" ? [{ name: "foreign" }] : []),
    newPage: vi.fn(async () => page), newCDPSession: vi.fn(async () => cdp), close: vi.fn(async () => {}) };
  const browser = { version: () => fault === "wrong-version" ? "0.0.0.0" : "155.0.8059.85",
    newContext: vi.fn(async () => context), close: vi.fn(async () => {}) };
  const launchServer = vi.fn(async options => {
    calls.push("public-launchServer");
    expect(options).not.toHaveProperty("userDataDir");
    expect(options).not.toHaveProperty("_userDataDir");
    expect(options).not.toHaveProperty("logger");
    expect(options).not.toHaveProperty("ignoreDefaultArgs");
    expect(options).toMatchObject({ headless: false, chromiumSandbox: true, host: "127.0.0.1",
      env: { TMPDIR: "/private/pure-owned-tmp" } });
    if (fault === "pre-return-launch-error") throw Error("pure-pre-return-launch-error");
    return server;
  });
  const chromium = { launchServer, connect: vi.fn(async () => browser) };
  vi.doMock("playwright-core", () => ({ chromium }));
  vi.doMock("node:os", () => ({ tmpdir: () => "/private/pure-owned-tmp" }));
  vi.doMock("./sdk-absent-chrome-io.mjs", async () => {
    const actual = await vi.importActual("./sdk-absent-chrome-io.mjs");
    return { ...actual, issued: () => ({ ticket: { expires_at_ms: Date.now() + 10000, parent: { pid: process.ppid },
      temp: { path: "/private/pure-owned-tmp" } }, ticket_sha256: "a".repeat(64) }),
    save: (_root, name, value) => { originals.push({ name, value }); return { sha256: "b".repeat(64) }; } };
  });
  vi.doMock("./sdk-absent-chrome-preexec.mjs", async () => ({
    ...await vi.importActual("./sdk-absent-chrome-preexec.mjs"),
    sdkAbsentChromeReadiness: () => ({ ready: true, reason: "pure-module-boundary-double-only" }),
  }));
  const originalSend = process.send;
  process.send = vi.fn(message => {
    calls.push(message.type);
    if (message.type === "engine-ready") queueMicrotask(() => process.emit("message", { type: "launch-permission" }));
    if (message.type === "browser-returned") queueMicrotask(() => process.emit("message", { type: "browser-owner", pid: 630003 }));
    if (message.type === "normal-proof") queueMicrotask(() => process.emit("message", { type: "close-permission" }));
  });
  vi.resetModules();
  let error;
  try {
    const { runSdkAbsentChromeEngine } = await import("./sdk-absent-chrome-actors.mjs");
    const work = runSdkAbsentChromeEngine("/private/pure-case");
    queueMicrotask(() => process.emit("message", { type: "engine-owner", ticket_sha256: "a".repeat(64),
      identity: { pid: process.pid, ppid: process.ppid, uid: process.getuid() } }));
    try { await work; } catch (e) { error = e.message; }
    return { error, calls, originals, chromium, cdp, context };
  } finally {
    if (originalSend) process.send = originalSend; else delete process.send;
    vi.doUnmock("playwright-core"); vi.doUnmock("node:os"); vi.doUnmock("./sdk-absent-chrome-io.mjs");
    vi.doUnmock("./sdk-absent-chrome-preexec.mjs"); vi.resetModules();
  }
}

describe("SDK-absent actor boundary", () => {
  it("does not import Playwright or launch on an unissued engine context", async () => {
    const launchServer = vi.fn(() => { throw Error("unexpected browser allocation"); });
    vi.doMock("playwright-core", () => ({ chromium: { launchServer } }));
    vi.resetModules();
    try {
      const { runSdkAbsentChromeEngine } = await import("./sdk-absent-chrome-actors.mjs");
      expect(typeof runSdkAbsentChromeEngine).toBe("function");
      await expect(runSdkAbsentChromeEngine(resolve("rig/out/unissued-sdk-absent-case"))).rejects.toThrow();
      expect(launchServer).not.toHaveBeenCalled();
    } finally { vi.doUnmock("playwright-core"); vi.resetModules(); }
  });
  it("runs the actual public launch/connect/context/CDP/close pipeline with an input-derived renderer reply", async () => {
    const result = await engineWithPublicBoundaries();
    expect(result.error).toBeUndefined();
    expect(result.calls).toEqual(["engine-ready", "launch-pending", "public-launchServer", "browser-returned",
      "Runtime.evaluate", "normal-proof", "server-close", "engine-complete"]);
    expect(result.originals.map(row => row.name)).toEqual(["engine-launch-pending", "engine-browser-returned",
      "engine-normal-proof", "engine-normal-closed"]);
    expect(result.originals.find(row => row.name === "engine-normal-proof").value).toMatchObject({
      version: "155.0.8059.85", cookies: [], page_url: "about:blank",
    });
  });
  it.each(["pre-return-launch-error", "wrong-version", "dirty-context", "remote-page"])(
    "retains pending acquisition and refuses %s without a normal proof", async fault => {
      const result = await engineWithPublicBoundaries(fault);
      expect(result.error).toBeDefined();
      expect(result.originals.some(row => row.name === "engine-launch-pending")).toBe(true);
      expect(result.originals.some(row => row.name === "engine-normal-proof")).toBe(false);
      if (fault === "pre-return-launch-error") expect(result.calls).not.toContain("browser-returned");
    });
});
