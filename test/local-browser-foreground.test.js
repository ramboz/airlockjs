import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { execFile, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fixtureModule from "../rig/local-browser-journeys.mjs";
import * as foregroundModule from "../rig/local-browser-foreground.mjs";
import {
  assertForegroundReceipts, checkForegroundRequest, runGoogleBrowserOperationsForeground,
  runLocalBrowserForeground, startForegroundControlFetch,
} from "../rig/local-browser-foreground.mjs";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

const origin = "http://127.0.0.1:43111";
const metaFields = (second = false) => [
  ["id", "000000000000000"], ["ev", "PageView"],
  ["dl", second ? "https://example.test/meta-b#second" : "https://example.test/meta-a"],
  ["rl", ""], ["if", "false"], ["sw", "412"], ["sh", "823"], ["tz", "-420"],
];
const googleFields = (second = false) => [
  ["label", "SYNTHETIC_LABEL"], ["value", second ? "0" : "28.75"],
  ["currency_code", second ? "" : "CAD"], ["oid", second ? "synthetic-b" : "synthetic-a"],
  ["url", second ? "https://example.test/google-b#second" : "https://example.test/google-a"],
];
function rows(vendor) {
  return [false, true].map((second) => {
    const fields = vendor === "meta" ? metaFields(second) : googleFields(second);
    const query = new URLSearchParams(fields).toString();
    return {
      method: "GET", path: vendor === "meta" ? "/tr/" : "/pagead/conversion/0000000000/",
      query, fields, rawFields: query.split("&").map((field) => field.split("=")),
      status: 200, response: "finished", arrivedAt: 1, respondedAt: 2,
    };
  });
}

describe("foreground source-only receipt and route checks — NOT browser qualification", () => {
  it("exports the closed paired opaque diagnostic selector", () => {
    expect(foregroundModule.runGoogleOpaqueDiagnosticForeground).toBeTypeOf("function");
  });

  it("rejects options and extra CLI arguments without launching a browser", async () => {
    const launch = vi.spyOn(chromium, "launchServer");
    await expect(foregroundModule.runGoogleOpaqueDiagnosticForeground({})).rejects.toThrow("fixed-operation-no-options");
    expect(launch).not.toHaveBeenCalled();
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("../rig/local-browser-foreground.mjs", import.meta.url)), "--google-opaque-diagnostic", "extra",
    ], { encoding: "utf8", env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixed-foreground-no-options");
    expect(result.stdout).toBe("");
  });

  it("does not resolve a positive preflight after headers before zero-body EOF", async () => {
    let finish;
    const body = new Promise((resolve) => { finish = resolve; });
    const reader = { read: vi.fn(() => body), cancel: vi.fn(), releaseLock: vi.fn() };
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      status: 200, headers: new Headers({ "content-length": "0" }), body: { getReader: () => reader },
    })));
    startForegroundControlFetch(`${origin}/tr/?${rows("meta")[0].query}`);
    await Promise.resolve();
    expect(window.__foregroundControl.state).toBe("pending");
    finish({ done: true });
    await vi.waitFor(() => expect(window.__foregroundControl).toMatchObject({
      state: "resolved", status: 200, bodyConsumed: true, bodyBytes: 0,
    }));
    expect(reader.read).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
    expect(reader.cancel).not.toHaveBeenCalled();
  });

  it.each(["content", "read-error", "missing-stream", "wrong-framing"])("rejects preflight %s rather than header-only success", async (fault) => {
    const reader = {
      read: vi.fn(async () => {
        if (fault === "read-error") throw new Error("read-failed");
        return { done: false, value: new Uint8Array([1]) };
      }),
      cancel: vi.fn(async () => {}), releaseLock: vi.fn(),
    };
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      status: 200, headers: new Headers({ "content-length": fault === "wrong-framing" ? "1" : "0" }),
      body: fault === "missing-stream" ? null : { getReader: () => reader },
    })));
    startForegroundControlFetch(`${origin}/tr/?${rows("meta")[0].query}`);
    await vi.waitFor(() => expect(window.__foregroundControl).toMatchObject({
      state: "rejected", status: null, bodyConsumed: false,
    }));
    if (fault === "content" || fault === "read-error") {
      expect(reader.cancel).toHaveBeenCalledOnce();
      expect(reader.releaseLock).toHaveBeenCalledOnce();
    } else expect(reader.read).not.toHaveBeenCalled();
  });

  it.each(["meta", "google"])("%s requires both complete, literal, distinct receiver documents", (vendor) => {
    expect(() => assertForegroundReceipts(vendor, rows(vendor))).not.toThrow();
    for (const change of [
      (value) => value.pop(),
      (value) => value.push(value[0]),
      (value) => { value[1] = value[0]; },
      (value) => { value[0].fields.reverse(); },
      (value) => { value[0].status = 204; },
      (value) => { value[0].response = "aborted"; },
      (value) => { value[0].query += "&extra=1"; },
      (value) => { value[0].rawFields = []; },
      (value) => { value[0].path += "/"; },
      (value) => { value[0].method = "POST"; },
    ]) {
      const value = rows(vendor);
      change(value);
      expect(() => assertForegroundReceipts(vendor, value)).toThrow();
    }
  });

  it("permits only literal current-fixture GET resources and canonical measurements", () => {
    const fixture = { origin, sourceManifest: [{ path: "/fixed.js" }], pageManifest: [{ path: "/meta" }] };
    const input = { url: `${origin}/fixed.js`, method: "GET", bodyBytes: 0, headerBytes: 100, resourceType: "script" };
    expect(checkForegroundRequest(fixture, "meta", input, "product")).toBe("asset");
    expect(checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/meta`, resourceType: "document",
    }, "product")).toBe("document");
    expect(checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/tr/?${rows("meta")[0].query}`, resourceType: "fetch",
    }, "preflight")).toBe("measurement");
    expect(checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/preflight`, resourceType: "document",
    }, "preflight")).toBe("document");
    for (const patch of [
      input,
      { ...input, url: `${origin}/meta`, resourceType: "document" },
      { ...input, url: `${origin}/google`, resourceType: "document" },
      { ...input, url: `${origin}/preflight`, resourceType: "script" },
      { ...input, url: `${origin}/tr/?${rows("meta")[1].query}`, resourceType: "fetch" },
    ]) expect(() => checkForegroundRequest(fixture, "meta", patch, "preflight")).toThrow();
    expect(() => checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/preflight`, resourceType: "document",
    }, "product")).toThrow();
    expect(() => checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/preflight`, resourceType: "document",
    }, "failure")).toThrow();
    expect(() => checkForegroundRequest(fixture, "meta", input, "unknown")).toThrow();
    for (const patch of [
      { url: "https://example.test/fixed.js" }, { url: "http://localhost:43111/fixed.js" },
      { url: `${origin}/unknown` }, { url: `${origin}/fixed.js?v=1` },
      { url: `${origin}/x/../fixed.js` }, { url: `${origin}/fixed.js#fragment` },
      { method: "POST" }, { bodyBytes: 1 }, { bodyBytes: 65537 }, { headerBytes: 65537 },
      { resourceType: "websocket" }, { url: `${origin}/${"x".repeat(8192)}` },
      { url: `${origin}/tr/?id=000000000000000`, resourceType: "fetch" },
    ]) expect(() => checkForegroundRequest(fixture, "meta", { ...input, ...patch }, "product")).toThrow();
  });
});

const originalStart = fixtureModule.startLocalBrowserJourneys;
const originalOperationStart = fixtureModule.startGoogleBrowserOperationFixture;
const openFixtures = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(openFixtures.splice(0).map((fixture) => fixture.close()));
});
const sharedVendorSources = (vendor) => vendor === "meta"
  ? ["pageview-data", "event-options", "synthetic-identity", "agent-options"]
    .map((name) => `/connectors/meta-pixel/${name}.js`)
  : ["destination-selectors", "consent-commands", "bootstrap-command", "purchase-cart-items",
    "remarketing-control", "view-items"].map((name) => `/connectors/google-ads/${name}.js`);
const mainSources = (vendor) => [
  `/rig/local-browser-journeys-${vendor}.js`,
  `/adapters/${vendor === "meta" ? "meta-pixel" : "google-ads"}-prototype.js`,
  ...["wrapped-sdk-host", "endpoint-ceiling", "config-integrity", "consent", "payload-governance", "cookie-scope"]
    .map((name) => `/core/${name}.js`),
  ...sharedVendorSources(vendor),
];
const workerSources = (vendor) => [
  ...["confine-pixel-chamber", "egress-confinement", "connector-host"].map((name) => `/core/${name}.js`),
  ...(vendor === "meta" ? [
    "/connectors/meta-pixel/pageview-prototype.worker.js", "/connectors/meta-pixel/pageview-prototype.js",
    "/connectors/pixel/vendors/meta.js", "/connectors/pixel/advanced-matching.js",
  ] : ["/connectors/google-ads/conversion-prototype.worker.js", "/connectors/google-ads/conversion-prototype.js",
    "/connectors/google-ads/manual-response.js"]),
  ...sharedVendorSources(vendor),
];

async function actualImports(start) {
  const found = new Set();
  const pending = [start];
  while (pending.length) {
    const path = pending.shift();
    if (found.has(path)) continue;
    found.add(path);
    const source = await readFile(new URL(`..${path}`, import.meta.url), "utf8");
    for (const [, specifier] of source.matchAll(/^\s*import\s+(?:[^;"']+?\s+from\s+)?["']([^"']+)["']/gm)) {
      expect(specifier).toMatch(/^\.\.?\//);
      pending.push(new URL(specifier, `${origin}${path}`).pathname);
    }
  }
  return [...found].sort();
}

it.each(["meta", "google"])("controlled %s source events match actual main and worker imports independently", async (vendor) => {
  const adapter = `/adapters/${vendor === "meta" ? "meta-pixel" : "google-ads"}-prototype.js`;
  const source = await readFile(new URL(`..${adapter}`, import.meta.url), "utf8");
  const [, worker] = source.match(/new Worker\(new URL\(["']([^"']+)["'], import\.meta\.url\)/);
  const workerURL = new URL(worker, `${origin}${adapter}`).pathname;
  expect([...mainSources(vendor)].sort()).toEqual(await actualImports(`/rig/local-browser-journeys-${vendor}.js`));
  expect([...workerSources(vendor)].sort()).toEqual(await actualImports(workerURL));
});

// Controlled browser/worker EVENTS, never browser execution. Requests below use
// actual Node HTTP against the unmodified literal-loopback fixture/receiver.
async function controlledBrowser(fault = null, failureDetail = "net::ERR_ABORTED", browserVersion = null) {
  const log = [];
  const servers = [];
  const fixtures = new Map();
  const paired = fault?.startsWith("paired-") === true;
  vi.spyOn(fixtureModule, "startLocalBrowserJourneys").mockImplementation(async () => {
    const fixture = await originalStart();
    openFixtures.push(fixture);
    fixtures.set(fixture.origin, fixture);
    if (fault === "missing-receiver") fixture.getReceiverArrivals = () => [];
    return fixture;
  });
  vi.spyOn(fixtureModule, "startGoogleBrowserOperationFixture").mockImplementation(async (name) => {
    const fixture = await originalOperationStart(name);
    openFixtures.push(fixture);
    fixtures.set(fixture.origin, fixture);
    return fixture;
  });
  class Context extends EventEmitter {
    constructor(mode) { super(); this.mode = mode; this.closed = false; }
    async routeWebSocket(pattern, handler) { log.push(["websocket-route", pattern]); this.socketRoute = handler; }
    async route(pattern, handler) { log.push(["http-route", pattern]); this.handler = handler; }
    async grantPermissions(permissions, options) { log.push(["permissions", permissions, options]); }
    async newPage() {
      expect(this.handler).toBeTypeOf("function");
      expect(this.socketRoute).toBeTypeOf("function");
      log.push(["page-created", this.mode]);
      this.page = new Page(this);
      this.emit("page", this.page);
      return this.page;
    }
    async send(url, type, method = "GET") {
      let resolve;
      let reject;
      const completion = new Promise((ok, no) => { resolve = ok; reject = no; });
      void completion.catch(() => {});
      const request = {
        url: () => url, method: () => method, resourceType: () => type,
        redirectedFrom: () => null,
        postDataBuffer: () => fault === "request-body" ? Buffer.from("x") : null,
        failure: () => ({ errorText: fault === "oversized-failure-code" ? `net::ERR_${"X".repeat(2048)}`
          : fault === "private-failure-detail" ? "Protocol error at https://private.invalid/?secret=not-retained"
            : failureDetail }),
        headersArray: async () => [{ name: "accept", value: fault === "header-overrun" ? "x".repeat(65537) : "*/*" }],
        headers: () => ({ accept: paired && fault === "paired-mismatched-headers" && this.mode === "opaque-direct" ? "other" : "*/*" }),
        allHeaders: async () => {
          if (fault === "paired-requestheaders-unknown" && this.mode === "opaque-direct") throw new Error("not available");
          return { accept: paired && fault === "paired-mismatched-headers" && this.mode === "opaque-direct" ? "other" : "*/*" };
        },
        isNavigationRequest: () => type === "document",
      };
      await this.handler({
        request: () => request,
        abort: async () => { this.emit("requestfailed", request); reject(new Error("source-test-aborted")); },
        continue: async () => {
          expect(new URL(url).hostname).toBe("127.0.0.1");
          const req = httpRequest(url, { agent: false, method }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              const body = Buffer.concat(chunks);
              if (fault === "paired-late-frame" && this.mode === "opaque" && type === "fetch" &&
                  url.endsWith("/rig/google-browser-operation-frame.html")) {
                this.pendingFrame = { request, status: res.statusCode };
                this.emit("requestfinished", request);
                resolve({ status: res.statusCode, body });
                return;
              }
              const pairedSecondary = paired && type === "fetch" && method === "POST";
              const unavailable = pairedSecondary &&
                (fault === "paired-both-unavailable" ||
                  fault === "paired-baseline-unavailable" && this.mode === "opaque" ||
                  fault === "paired-direct-unavailable" && this.mode === "opaque-direct" ||
                  fault === "paired-direct-lost-unavailable" && this.mode === "opaque-direct" ||
                  fault === "paired-concurrent-fatal" && this.mode === "opaque");
              if (pairedSecondary && this.protocol) {
                this.protocol.emit("Network.requestWillBeSent", {
                  requestId: "test.1", request: { url, method },
                });
                if (fault === "paired-protocol-duplicate") this.protocol.emit("Network.requestWillBeSent", {
                  requestId: "test.2", request: { url, method },
                });
              }
              const delayedOpaque = fault?.startsWith("opaque-observer-") &&
                this.mode === "opaque" && type === "fetch" && method === "POST";
              if (delayedOpaque) {
                log.push(["opaque-controller-headers"]);
                if (["opaque-observer-early", "opaque-observer-pending"].includes(fault)) {
                  setTimeout(() => {
                    this.emit("response", {
                      request: () => request, status: () => res.statusCode,
                      body: async () => { throw new Error("observer-body-unavailable"); },
                    });
                    this.emit("requestfinished", request);
                  }, 30);
                  if (fault === "opaque-observer-early") {
                    setTimeout(() => resolve({ status: res.statusCode, body }), 75);
                  }
                  return;
                }
                resolve({ status: res.statusCode, body });
                if (fault === "opaque-observer-never") return;
                const deliverResponse = () => {
                  log.push(["opaque-recorder-response"]);
                  this.emit("response", {
                    request: () => request, status: () => res.statusCode,
                    body: async () => {
                      if (fault === "opaque-observer-complete") {
                        await new Promise((done) => setTimeout(done, 75));
                      }
                      if (["opaque-observer-unavailable", "opaque-observer-snapshot-unavailable",
                        "opaque-observer-snapshot-hangs"].includes(fault) ||
                          this.realmRemoved) {
                        throw new Error("observer-body-unavailable");
                      }
                      log.push(["opaque-recorder-body"]);
                      return body;
                    },
                  });
                };
                if (fault === "opaque-observer-complete") deliverResponse();
                setTimeout(() => {
                  if (fault !== "opaque-observer-complete") deliverResponse();
                  if (fault === "opaque-observer-requestfailed" || this.realmRemoved) {
                    this.emit("requestfailed", request);
                    log.push(["opaque-recorder-failed"]);
                  } else {
                    this.emit("requestfinished", request);
                    log.push(["opaque-recorder-finished"]);
                  }
                }, 75);
                return;
              }
              if (fault === "paired-baseline-noresponse" && pairedSecondary && this.mode === "opaque") {
                this.emit("requestfailed", request);
                resolve({ status: res.statusCode, body });
                return;
              }
              this.emit("response", {
                request: () => request,
                status: () => fault === "204-body-unavailable" && type === "fetch" ? 204
                  : fault === "paired-response-status" && pairedSecondary ? 302 : res.statusCode,
                headerValue: async (name) => res.headers[name],
                allHeaders: async () => fault === "paired-header-overrun" && pairedSecondary
                  ? { oversized: "x".repeat(65537) }
                  : fault === "paired-content-type" && pairedSecondary ? { ...res.headers, "content-type": "text/plain" }
                    : fault === "paired-cors-header" && pairedSecondary
                      ? { ...res.headers, "access-control-allow-origin": "*" } : res.headers,
                frame: () => type === "document" && this.mode !== "preflight" ? {} : this.page.mainFrame(),
                body: async () => {
                  if (unavailable) throw new Error("source-test-body-unavailable");
                  if (fault === "paired-response-nonzero" && pairedSecondary) return Buffer.from("unexpected");
                  if (fault === "204-body-unavailable" && type === "fetch") {
                    throw new Error("Protocol error: No resource with given identifier found");
                  }
                  if (fault === "non204-body-unavailable" && res.statusCode !== 204) {
                    throw new Error("private protocol error unavailable");
                  }
                  if (fault === "operation-accounting" && this.contextCase === "operation" &&
                      type === "fetch" && method === "GET" && res.statusCode === 200) {
                    throw new Error("private protocol error unavailable");
                  }
                  if (fault === "operation-overrun" && this.contextCase === "operation" &&
                      type === "fetch" && method === "GET" && res.statusCode === 200) return Buffer.alloc(2097153);
                  if (fault === "response-overrun") return Buffer.alloc(2097153);
                  return fault === "source-substitution" && type === "script" ? Buffer.from("wrong") : body;
                },
              });
              if (fault === "paired-concurrent-fatal" && unavailable) this.page.emit("pageerror", new Error("test"));
              if (pairedSecondary && this.protocol) {
                if (fault === "paired-protocol-failure") this.protocol.emit("Network.loadingFailed", {
                  requestId: "test.1", errorText: "net::ERR_ABORTED", canceled: true, blockedReason: "csp",
                });
                else this.protocol.emit("Network.loadingFinished", { requestId: "test.1" });
              }
              if ((pairedSecondary && (fault === "paired-both-requestfailed" ||
                    fault === "paired-direct-rejected" && this.mode === "opaque-direct" ||
                    fault === "paired-baseline-requestfailed" && this.mode === "opaque") ||
                ["loading-failure-200", "oversized-failure-code", "private-failure-detail"].includes(fault) ||
                ["operation-accounting", "operation-overrun"].includes(fault) && method === "GET" && res.statusCode === 200 &&
                  this.contextCase === "operation") &&
                type === "fetch") this.emit("requestfailed", request);
              else this.emit("requestfinished", request);
              resolve({ status: res.statusCode, body });
            });
          });
          req.once("error", (error) => { this.emit("requestfailed", request); reject(error); });
          req.setTimeout(3000, () => req.destroy(new Error("source-test-HTTP-deadline")));
          req.end();
        },
      });
      return completion;
    }
    async close() {
      log.push(["context-close", this.mode]);
      if (fault === "context-close" && this.mode === "preflight") throw new Error("source-test-context-close");
      if (fault === "paired-close-failure" && this.mode === "opaque") throw new Error("source-test-context-close");
      if (this.pendingFrame) {
        this.emit("response", {
          request: () => this.pendingFrame.request, status: () => this.pendingFrame.status,
          body: async () => { throw new Error("source-test-late-frame"); },
        });
      }
      this.closed = true;
      this.page?.worker?.emit("close");
    }
    async newCDPSession() {
      if (!paired || fault === "paired-protocol-unknown") throw new Error("source-test-unavailable");
      this.protocol = new EventEmitter();
      this.protocol.send = async () => {};
      return this.protocol;
    }
  }
  class Page extends EventEmitter {
    constructor(context) {
      super();
      this.context = context;
      this.journey = { phase: "not-started", failure: null, fullCompatibility: false, overall: "INCONCLUSIVE", disposal: "not-created" };
      this.frame = { url: () => this.url };
    }
    mainFrame() { return this.frame; }
    async goto(url) {
      this.url = url;
      this.vendor = new URL(url).pathname.slice(1);
      this.origin = new URL(url).origin;
      this.fixture = fixtures.get(this.origin);
      this.context.contextCase = this.vendor === "google-browser-operation" ? "operation" : "legacy";
      if (this.context.contextCase === "operation" && !(paired && this.context.mode === "opaque-direct")) {
        this.context.mode = this.fixture.caseName;
      }
      log.push(["goto", this.vendor, this.context.mode]);
      this.emit("framenavigated", this.frame);
      if (fault === "work-cutoff") {
        const afterCutoff = performance.now() + 50010;
        vi.spyOn(performance, "now").mockReturnValue(afterCutoff);
      }
      await this.context.send(url, "document");
      if ((fault?.startsWith("opaque-observer-") || paired) && this.vendor === "google-browser-operation") {
        if (fault === "paired-console-overrun") this.emit("console", { type: () => "error", text: () => "x".repeat(2049) });
        if (fault === "paired-console") this.emit("console", { type: () => "error", text: () => "synthetic console error" });
        if (this.fixture.caseName === "unreadable-primary") throw new Error("source-test-after-opaque");
        return;
      }
      if (["operation-accounting", "operation-overrun"].includes(fault) && this.vendor === "google-browser-operation") {
        await this.context.send(`${this.fixture.origins[1]}${this.fixture.operationPaths.secondary}`, "fetch", "POST");
        await this.context.send(`${this.fixture.origin}${this.fixture.operationPaths.primary}`, "fetch");
        return;
      }
      if (this.context.mode === "preflight") {
        if (fault === "preflight-source") await this.context.send(`${this.origin}/adapters/meta-pixel-prototype.js`, "script");
        if (fault === "preflight-document") await this.context.send(`${this.origin}/meta`, "document");
        if (fault === "preflight-worker") {
          const worker = new EventEmitter();
          worker.url = () => `${this.origin}/connectors/meta-pixel/pageview-prototype.worker.js`;
          this.emit("worker", worker);
        }
      } else {
        for (const path of mainSources(this.vendor)) await this.context.send(`${this.origin}${path}`, "script");
      }
      if (fault === "request-count" && this.context.mode === "product") {
        for (let index = 0; index < 70; index += 1) {
          await this.context.send(`${this.origin}/core/wrapped-sdk-host.js`, "script");
        }
      }
      if (fault === "websocket") this.context.socketRoute({ close: vi.fn() });
      if (fault === "frame") this.emit("frameattached", {});
      if (fault === "popup") this.context.emit("page", { close: async () => {} });
      if (fault === "service-worker") this.context.emit("serviceworker", {});
    }
    async waitForFunction() {}
    async evaluate(fn, arg) {
      const source = fn.toString();
      if ((fault?.startsWith("opaque-observer-") || paired) && this.vendor === "google-browser-operation") {
        if (source.includes("window.prepareBrowserOperation()")) {
          if (fault === "paired-operation-deadline") throw new Error("operation-opaque-deadline");
          this.worker = new EventEmitter();
          this.worker.url = () => `${this.origin}/connectors/google-ads/conversion-prototype.worker.js`;
          this.emit("worker", this.worker);
          if (paired) await this.context.send(`${this.origin}/rig/google-browser-operation-frame.html`, "fetch");
          await this.context.send(`${this.origin}/rig/google-browser-operation-frame.html`, "document");
          this.operation = { phase: "ready", runtime: { phase: "ready", outcomes: [] } };
          return structuredClone(this.operation);
        }
        if (source.includes("window.beginBrowserOperation()")) {
          this.operation.phase = "in-flight";
          this.operationPromise = (async () => {
            await this.context.send(`${this.origin}${this.fixture.operationPaths.primary}`, "fetch");
            await this.context.send(`${this.fixture.origins[1]}${this.fixture.operationPaths.secondary}`, "fetch", "POST");
            if (this.fixture.caseName === "readable") {
              await this.context.send(`${this.fixture.origins[1]}/operation-unexpected-path`, "fetch");
            }
            this.operation = { phase: "settled", runtime: { phase: "ready", outcomes: [{
              disposition: this.fixture.caseName === "opaque" ? "opaque" : "readable",
              authoredOperations: 2, ...(this.fixture.caseName === "readable" ? { status: 200 } : {}),
            }] } };
            return structuredClone(this.operation);
          })();
          return;
        }
        if (source.includes("window.waitBrowserOperation()")) return this.operationPromise;
        if (source.includes("window.getBrowserOperationState()")) {
          if (fault === "opaque-observer-snapshot-unavailable" && this.fixture.caseName === "opaque") {
            throw new Error("private-snapshot-error");
          }
          if (fault === "opaque-observer-snapshot-hangs" && this.fixture.caseName === "opaque") {
            return new Promise(() => {});
          }
          return structuredClone(this.operation);
        }
        if (source.includes("window.stopBrowserOperation(")) {
          log.push(["opaque-realm-removed"]);
          this.context.realmRemoved = true;
          this.operation.runtime.phase = "terminal";
          return;
        }
        if (source.includes("window.disposeBrowserOperation()")) {
          this.worker.emit("close");
          this.operation.phase = "disposed";
          return;
        }
        if (source.includes("window.beginDirectOpaqueControl(")) {
          log.push(["direct-control", arg]);
          await this.context.send(`${this.origin}/rig/google-browser-operation-frame.html`, "fetch");
          await this.context.send(`${this.origin}/rig/google-browser-operation-frame.html`, "document");
          await this.context.send(arg, "fetch", "POST");
          if (fault === "paired-direct-deadline") return { disposition: "deadline" };
          if (fault === "paired-direct-rejected") return { disposition: "rejected", httpOutcome: "UNKNOWN" };
          return { disposition: "opaque", httpOutcome: "UNKNOWN" };
        }
        if (source.includes("window.disposeDirectOpaqueControl()")) {
          log.push(["direct-dispose"]);
          if (fault === "paired-direct-lost" || fault === "paired-direct-lost-unavailable") {
            return "direct-realm-identity";
          }
          return "disposed";
        }
      }
      if (source.includes("void fetch(")) {
        this.control = { state: "pending", status: null };
        void this.context.send(arg, "fetch").then(
          (response) => { this.control = {
            state: "resolved", status: response.status, bodyConsumed: true, bodyBytes: response.body.length,
          }; },
          () => { this.control = { state: "rejected", status: null }; },
        );
        return;
      }
      if (source.includes("window.__foregroundControl")) return this.control;
      if (source.includes("window.beginNegativeControls()")) {
        this.worker = new EventEmitter();
        this.worker.url = () => `${this.origin}${workerSources(this.vendor)[3]}`;
        if (fault !== "missing-worker") this.emit("worker", this.worker);
        const paths = workerSources(this.vendor);
        if (fault === "missing-source") paths.pop();
        if (fault === "duplicate-source") paths.push(paths.at(-1));
        for (const path of paths) await this.context.send(`${this.origin}${path}`, "script");
        this.journey = {
          ...this.journey, phase: "negative-controls-complete", disposal: "pending",
          controls: { pendingDispatchAttempts: 0, deniedDispatchAttempts: 0, grantWithoutCommandDispatchAttempts: 0 },
          captureAndTransport: {
            phase: "ready", inFlight: false, host: { dispatchAttempts: 0 },
            outcomes: [
              { seq: 1, disposition: this.vendor === "meta" ? "initialized" : "configured" },
              { seq: 2, disposition: "held" }, { seq: 3, disposition: "held" },
            ],
          },
        };
        if (fault === "empty-result") return {};
        return structuredClone(this.journey);
      }
      if (source.includes("window.beginPositiveControls()")) {
        this.journey.phase = "positive-in-flight";
        this.journey.captureAndTransport.inFlight = true;
        this.positive = (async () => {
          for (const row of rows(this.vendor)) {
            let status = 0;
            try { status = (await this.context.send(`${this.origin}${row.path}?${row.query}`, "fetch")).status; } catch {}
            this.journey.captureAndTransport.host.dispatchAttempts += 1;
            this.journey.captureAndTransport.outcomes.push({
              seq: this.journey.captureAndTransport.outcomes.length + 1,
              disposition: status === 200 ? "transport-settled" : "failed", status,
            });
          }
          this.journey.captureAndTransport.inFlight = false;
          if (this.journey.captureAndTransport.outcomes.slice(3).every((outcome) => outcome.status === 200)) {
            this.journey.phase = "page-transport-settled";
          } else {
            this.journey.phase = "failed";
            this.journey.failure = "positive-controls-failed";
            this.journey.disposal = "adapter-dispose-resolved-worker-exit-needs-independent-observation";
            this.worker.emit("close");
          }
        })();
        return;
      }
      if (source.includes("window.finishJourney()")) {
        await this.positive;
        this.journey.phase = "completed-page-checks";
        this.journey.captureAndTransport.phase = "disposed";
        this.journey.disposal = "adapter-dispose-resolved-worker-exit-needs-independent-observation";
        this.worker.emit("close");
      }
      if (source.includes("window.getJourneyState()") || source.includes("window.finishJourney()")) {
        return structuredClone(this.journey);
      }
      throw new Error("unexpected-source-test-evaluation");
    }
  }
  function makeServer(options = {}) {
    const server = new EventEmitter();
    const child = new EventEmitter();
    child.pid = 910001 + servers.length;
    child.spawnargs = fault === "owned-argv-unavailable" ? undefined : [
      "source-only-fake-Chrome", ...(fault === "owned-argv-missing-proxy" ? [] : options.args || []),
      `--user-data-dir=${fileURLToPath(new URL(
        fault === "profile-present" ? "../" : `../.foreground-source-only-nonexistent-profile-${servers.length + 1}`, import.meta.url,
      ))}`,
      ...(fault === "owned-argv-oversize" ? ["x".repeat(8193)] : []),
    ];
    child.exitCode = null;
    child.signalCode = null;
    child.kill = vi.fn((signal) => {
      log.push(["exact-owned-kill", child.pid, signal]);
      child.signalCode = signal;
      child.emit("exit", null, signal);
      child.emit("close", null, signal);
    });
    server.process = () => { log.push(["process-captured", child.pid]); return child; };
    server.wsEndpoint = () => fault === "foreign-endpoint" ? "ws://localhost:41299/foreign" : "ws://127.0.0.1:41299/owned-source-test";
    server.close = vi.fn(async () => {
      log.push(["server-close", child.pid]);
      if (fault === "server-close") return new Promise(() => {});
      child.exitCode = 0;
      child.emit("exit", 0, null);
      if (fault !== "missing-process-close") child.emit("close", 0, null);
      server.emit("close");
    });
    server.child = child;
    servers.push(server);
    return server;
  }
  const launch = vi.spyOn(chromium, "launchServer").mockImplementation(async (options) => {
    log.push(["launch", options]);
    return makeServer(options);
  });
  const connect = vi.spyOn(chromium, "connect").mockImplementation(async (endpoint) => {
    log.push(["connect", endpoint]);
    const browser = new EventEmitter();
    let contexts = 0;
    browser.version = () => (Array.isArray(browserVersion) ? browserVersion[servers.length - 1] : browserVersion) ?? (fault === "version-80" ? "156.0.8078.80"
      : fault === "version" ? "155.0.0.0"
      : fault === "old-version" ? "156.0.8078.48"
      : fault === "prior-version" ? "156.0.8078.76"
      : launch.mock.calls.at(-1)[0].args ? "157.0.8103.40" : "156.0.8078.80");
    browser.newContext = async (options) => {
      log.push(["new-context", options]);
      return new Context((paired ? ["preflight", "opaque", "opaque-direct"] : ["preflight", "product", "failure"])[contexts++]);
    };
    browser.close = async () => { log.push(["browser-close"]); browser.emit("disconnected"); };
    return browser;
  });
  return { log, launch, connect, servers, makeServer };
}

describe("controlled browser events + real Node HTTP — NOT actual Chrome/worker proof", () => {
  it.each([
    ["operation", runGoogleBrowserOperationsForeground, "opaque-observer-unavailable"],
    ["diagnostic", foregroundModule.runGoogleOpaqueDiagnosticForeground, "paired-protocol-unknown"],
  ])("pins Google %s to Chrome 157 in metadata and connected browser", async (_name, run, fault) => {
    const fake = await controlledBrowser(fault, "net::ERR_ABORTED", "157.0.8103.40");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await run()).vendors[0];
    expect(result.errors).not.toContain("installed-browser-version-mismatch");
    expect(result.errors).not.toContain("browser-version-mismatch");
    expect(result.browserVersion).toBe("157.0.8103.40");
    expect(fake.connect).toHaveBeenCalledOnce();
  }, 10000);

  it.each([
    ["operation", runGoogleBrowserOperationsForeground],
    ["diagnostic", foregroundModule.runGoogleOpaqueDiagnosticForeground],
  ])("rejects old Chrome 156 metadata before Google %s launch", async (_name, run) => {
    const fake = await controlledBrowser();
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "156.0.8078.80", "");
      return {};
    });
    const result = (await run()).vendors[0];
    expect(result.errors).toContain("installed-browser-version-mismatch");
    expect(fake.launch).not.toHaveBeenCalled();
  }, 10000);

  it.each([
    ["operation", runGoogleBrowserOperationsForeground],
    ["diagnostic", foregroundModule.runGoogleOpaqueDiagnosticForeground],
  ])("rejects a mismatched Chrome 157 metadata patch before Google %s launch", async (_name, run) => {
    const fake = await controlledBrowser();
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.41", "");
      return {};
    });
    const result = (await run()).vendors[0];
    expect(result.errors).toContain("installed-browser-version-mismatch");
    expect(fake.launch).not.toHaveBeenCalled();
  }, 10000);

  it.each([
    ["operation", "156.0.8078.80", runGoogleBrowserOperationsForeground],
    ["operation", "157.0.8103.41", runGoogleBrowserOperationsForeground],
    ["diagnostic", "156.0.8078.80", foregroundModule.runGoogleOpaqueDiagnosticForeground],
    ["diagnostic", "157.0.8103.41", foregroundModule.runGoogleOpaqueDiagnosticForeground],
  ])("rejects Google %s connected browser %s when metadata matches", async (_name, version, run) => {
    const fake = await controlledBrowser(null, "net::ERR_ABORTED", version);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await run()).vendors[0];
    expect(result.errors).toContain("browser-version-mismatch");
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.log.some(([event]) => event === "new-context")).toBe(false);
  }, 10000);

  it.each([
    ["meta", ["157.0.8103.40"]],
    ["google", ["156.0.8078.80", "157.0.8103.40"]],
  ])("keeps the default %s browser pinned to Chrome 156", async (vendor, versions) => {
    await controlledBrowser(null, "net::ERR_ABORTED", versions);
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors.at(-1)).toMatchObject({
      vendor, browserVersion: "157.0.8103.40",
    });
    expect(result.vendors.at(-1).errors).toContain("browser-version-mismatch");
  }, 10000);

  it("allows only one fixed captured-realm control even under concurrent calls", async () => {
    const fixture = await originalOperationStart("opaque");
    openFixtures.push(fixture);
    const realm = {
      valid: vi.fn(() => true), fetch: vi.fn(async () => ({ type: "opaque" })), dispose: vi.fn(),
    };
    const createRealm = vi.fn(async () => realm);
    const createAdapter = vi.fn();
    vi.resetModules();
    vi.doMock("../adapters/google-browser-operation-realm.js", () => ({ createGoogleBrowserRealm: createRealm }));
    vi.doMock("../adapters/google-ads-prototype.js", () => ({ createGoogleAdsPrototype: createAdapter }));
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("location", { pathname: "/google-browser-operation" });
    vi.stubGlobal("document", {
      body: { dataset: {
        case: "opaque", primary: fixture.origin, secondary: fixture.origins[1],
        recipients: fixture.origins.slice(0, 2).join(" "),
      } },
      getElementById: () => ({ textContent: "" }),
    });
    try {
      await import("../rig/local-browser-journeys-google.js");
      const url = `${fixture.origins[1]}${fixture.operationPaths.secondary}`;
      const first = window.beginDirectOpaqueControl(url);
      const second = window.beginDirectOpaqueControl(url);
      await expect(second).rejects.toThrow("invalid-direct-control");
      await expect(first).resolves.toEqual({ disposition: "opaque", httpOutcome: "UNKNOWN" });
      expect(createRealm).toHaveBeenCalledOnce();
      expect(createAdapter).not.toHaveBeenCalled();
      expect(createRealm.mock.calls[0][0]).toEqual(fixture.origins.slice(0, 2));
      expect(realm.fetch).toHaveBeenCalledOnce();
      const [target, init] = realm.fetch.mock.calls[0];
      expect(target).toBe(url);
      expect(init).toMatchObject({
        method: "POST", credentials: "omit", redirect: "follow", mode: "no-cors", referrerPolicy: "no-referrer",
        signal: expect.any(AbortSignal),
      });
      expect(init).not.toHaveProperty("body");
      expect(init).not.toHaveProperty("headers");
      expect(realm.dispose).not.toHaveBeenCalled();
      window.disposeDirectOpaqueControl();
      expect(realm.dispose).toHaveBeenCalledOnce();
    } finally {
      vi.doUnmock("../adapters/google-browser-operation-realm.js");
      vi.doUnmock("../adapters/google-ads-prototype.js");
      vi.resetModules();
    }
  }, 10000);

  it("reports a direct control abort caused by its deadline as a deadline", async () => {
    const fixture = await originalOperationStart("opaque");
    openFixtures.push(fixture);
    let started;
    const startedPromise = new Promise((resolve) => { started = resolve; });
    const realm = {
      valid: vi.fn(() => true),
      fetch: vi.fn((_url, init) => new Promise((_resolve, reject) => {
        started();
        init.signal.addEventListener("abort", () => reject(new Error("source-aborted")), { once: true });
      })),
      dispose: vi.fn(),
    };
    vi.resetModules();
    vi.doMock("../adapters/google-browser-operation-realm.js", () => ({ createGoogleBrowserRealm: vi.fn(async () => realm) }));
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("location", { pathname: "/google-browser-operation" });
    vi.stubGlobal("document", {
      body: { dataset: {
        case: "opaque", primary: fixture.origin, secondary: fixture.origins[1],
        recipients: fixture.origins.slice(0, 2).join(" "),
      } },
      getElementById: () => ({ textContent: "" }),
    });
    try {
      await import("../rig/local-browser-journeys-google.js");
      vi.useFakeTimers();
      const promise = window.beginDirectOpaqueControl(`${fixture.origins[1]}${fixture.operationPaths.secondary}`);
      void promise.catch(() => {});
      await startedPromise;
      await vi.advanceTimersByTimeAsync(1500);
      await expect(promise).rejects.toThrow("direct-control-deadline");
      window.disposeDirectOpaqueControl();
      expect(realm.dispose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
      vi.doUnmock("../adapters/google-browser-operation-realm.js");
      vi.resetModules();
    }
  }, 10000);

  it.each(["loss-callback", "invalid-realm"])("rejects %s after opaque fetch while recorder is pending", async (fault) => {
    const fixture = await originalOperationStart("opaque");
    openFixtures.push(fixture);
    let onLoss;
    let valid = true;
    let finishRecorder;
    let recorderSettled = false;
    const recorder = new Promise((resolve) => { finishRecorder = resolve; }).then(() => { recorderSettled = true; });
    const realm = {
      valid: vi.fn(() => valid), fetch: vi.fn(async () => ({ type: "opaque" })), dispose: vi.fn(),
    };
    vi.resetModules();
    vi.doMock("../adapters/google-browser-operation-realm.js", () => ({
      createGoogleBrowserRealm: vi.fn(async (_origins, lost) => { onLoss = lost; return realm; }),
    }));
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("location", { pathname: "/google-browser-operation" });
    vi.stubGlobal("document", {
      body: { dataset: {
        case: "opaque", primary: fixture.origin, secondary: fixture.origins[1],
        recipients: fixture.origins.slice(0, 2).join(" "),
      } },
      getElementById: () => ({ textContent: "" }),
    });
    try {
      await import("../rig/local-browser-journeys-google.js");
      const url = `${fixture.origins[1]}${fixture.operationPaths.secondary}`;
      await expect(window.beginDirectOpaqueControl(url)).resolves.toEqual({ disposition: "opaque", httpOutcome: "UNKNOWN" });
      expect(recorderSettled).toBe(false);
      if (fault === "loss-callback") onLoss();
      else valid = false;
      finishRecorder();
      await recorder;
      expect(() => window.disposeDirectOpaqueControl()).toThrow("direct-realm-identity");
      expect(realm.dispose).not.toHaveBeenCalled();
      expect(realm.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    } finally {
      vi.doUnmock("../adapters/google-browser-operation-realm.js");
      vi.resetModules();
    }
  }, 10000);

  it.each(["foreign-origin", "changed-query"])("rejects a %s direct target without a fetch or retry", async (fault) => {
    const fixture = await originalOperationStart("opaque");
    openFixtures.push(fixture);
    const createRealm = vi.fn();
    vi.resetModules();
    vi.doMock("../adapters/google-browser-operation-realm.js", () => ({ createGoogleBrowserRealm: createRealm }));
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("location", { pathname: "/google-browser-operation" });
    vi.stubGlobal("document", {
      body: { dataset: {
        case: "opaque", primary: fixture.origin, secondary: fixture.origins[1],
        recipients: fixture.origins.slice(0, 2).join(" "),
      } },
      getElementById: () => ({ textContent: "" }),
    });
    try {
      await import("../rig/local-browser-journeys-google.js");
      const fixed = `${fixture.origins[1]}${fixture.operationPaths.secondary}`;
      const bad = fault === "foreign-origin" ? `https://example.test${fixture.operationPaths.secondary}` : `${fixed}&extra=1`;
      await expect(window.beginDirectOpaqueControl(bad)).rejects.toThrow("invalid-direct-control");
      await expect(window.beginDirectOpaqueControl(fixed)).rejects.toThrow("invalid-direct-control");
      expect(createRealm).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("../adapters/google-browser-operation-realm.js");
      vi.resetModules();
    }
  }, 10000);

  it.each([
    ["paired-both-pass", "PASS", "PASS", "UNREPRODUCED"],
    ["paired-baseline-unavailable", "FAILED", "PASS", "DIFFERENTIAL"],
    ["paired-direct-unavailable", "PASS", "FAILED", "DIFFERENTIAL"],
    ["paired-both-unavailable", "FAILED", "FAILED", "MATCHED_FAILURE"],
    ["paired-mismatched-headers", "PASS", "PASS", "MISMATCHED"],
    ["paired-baseline-requestfailed", "FAILED", "PASS", "DIFFERENTIAL"],
    ["paired-both-requestfailed", "FAILED", "FAILED", "MATCHED_FAILURE"],
    ["paired-direct-rejected", "PASS", "FAILED", "DIFFERENTIAL"],
  ])("retains paired fake observer outcomes for %s without qualification", async (fault, baseline, direct, comparison) => {
    const fake = await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const report = await foregroundModule.runGoogleOpaqueDiagnosticForeground();
    const result = report.vendors[0];
    const evidence = result.privateEvidence.diagnostic;
    expect(report.normalJourneyChecks).toBe("FAILED");
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(evidence.baseline.status).toBe(baseline);
    expect(evidence.direct.status).toBe(direct);
    expect(evidence.opaqueHTTPOutcome).toBe("UNKNOWN");
    expect(evidence.match).toMatchObject({
      target: true, method: true, bodyBytes: true, framePolicy: true,
      headers: fault !== "paired-mismatched-headers", mode: "no-cors", credentials: "omit",
      redirect: "follow", referrerPolicy: "no-referrer",
      responseStatus: true,
      responseBody: fault.includes("unavailable") ? "UNKNOWN" : true,
    });
    const baselinePost = result.privateEvidence.requests.find((row) => row.mode === "opaque" && row.method === "POST");
    const directPost = result.privateEvidence.requests.find((row) => row.mode === "opaque-direct" && row.method === "POST");
    const withoutDate = (headers) => headers.filter(([name]) => name.toLowerCase() !== "date");
    expect(withoutDate(baselinePost.responseHeaders)).toEqual(withoutDate(directPost.responseHeaders));
    const baselineDate = baselinePost.responseHeaders.find(([name]) => name.toLowerCase() === "date")?.[1];
    const directDate = directPost.responseHeaders.find(([name]) => name.toLowerCase() === "date")?.[1];
    expect(evidence.match.responseHeaders).toBe(baselineDate === directDate);
    expect(result.pairedDiagnostic).toEqual({
      execution: "COMPLETED", comparison: baselineDate === directDate ? comparison : "MISMATCHED",
    });
    expect(result.counts.workerEvents).toBe(1);
    expect(fake.log.filter(([name]) => name === "new-context")).toHaveLength(3);
    expect(fake.log.filter(([name]) => name === "direct-control")).toHaveLength(1);
    expect(result.cleanup.contexts).toEqual([true, true, true]);
    expect(result.cleanup.fixtures).toEqual([true, true]);
    expect(result.counts.measurementAttempts).toBe(6);
    expect(result.privateEvidence.receiverDocuments.opaque.map((row) => row.stage))
      .toEqual(["primary", "secondary", "secondary"]);
    expect(result.privateEvidence.requests.filter((row) => row.mode === "opaque-direct" && row.kind === "measurement"))
      .toHaveLength(1);
    if (baseline === "FAILED") expect(result.errors).toContain(
      fault.includes("requestfailed") ? "opaque-request-failed" : "response-body-unavailable",
    );
    expect(evidence.protocol.opaque).toMatchObject({ status: "observing", requestId: "test.1", finished: true });
    expect(evidence.protocol["opaque-direct"]).toMatchObject({ status: "observing", requestId: "test.1", finished: true });
    expect(result.privateEvidence.requests.find((row) => row.mode === "opaque" && row.method === "POST").responseHeaders)
      .toEqual(expect.arrayContaining([["content-length", "0"]]));
  }, 10000);

  it.each([
    ["paired-concurrent-fatal", "page-error"],
    ["paired-header-overrun", "diagnostic-header-limit"],
    ["paired-console-overrun", "diagnostic-console-limit"],
    ["paired-close-failure", "context-close-failed"],
    ["paired-operation-deadline", "operation-opaque-deadline"],
    ["paired-protocol-duplicate", "diagnostic-protocol-identity"],
  ])("stops a paired fake run on %s and does not start the direct control", async (fault, error) => {
    const fake = await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.errors).toContain(error);
    expect(result.pairedDiagnostic).toEqual({ execution: "INCOMPLETE", comparison: "UNKNOWN" });
    expect(fake.log.some(([name]) => name === "direct-control")).toBe(false);
  }, 10000);

  it("reports unavailable passive protocol data as UNKNOWN in the fake", async () => {
    await controlledBrowser("paired-protocol-unknown");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.privateEvidence.diagnostic.protocol.opaque).toMatchObject({
      status: "UNKNOWN", requestId: "UNKNOWN", finished: "UNKNOWN", failure: "UNKNOWN",
      canceled: "UNKNOWN", blockedReason: "UNKNOWN",
    });
  }, 10000);

  it("correlates bounded fake protocol failure fields only to each context's request", async () => {
    await controlledBrowser("paired-protocol-failure");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    for (const mode of ["opaque", "opaque-direct"]) {
      const protocol = result.privateEvidence.diagnostic.protocol[mode];
      expect(protocol).toMatchObject({
        status: "observing", requestId: "test.1", failure: "net::ERR_ABORTED", canceled: true, blockedReason: "csp",
      });
      expect(result.privateEvidence.requests[protocol.requestIndex]).toMatchObject({ mode, kind: "measurement", method: "POST" });
    }
  }, 10000);

  it("retains bounded fake console errors as private observations", async () => {
    await controlledBrowser("paired-console");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.privateEvidence.diagnostic.consoleStatus).toEqual({ opaque: "observing", "opaque-direct": "observing" });
    expect(result.privateEvidence.diagnostic.consoleErrors).toEqual([
      { mode: "opaque", text: "synthetic console error" },
      { mode: "opaque-direct", text: "synthetic console error" },
    ]);
  }, 10000);

  it("reports request header comparison UNKNOWN when full headers are unavailable", async () => {
    await controlledBrowser("paired-requestheaders-unknown");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.pairedDiagnostic).toEqual({ execution: "COMPLETED", comparison: "UNKNOWN" });
    expect(result.privateEvidence.diagnostic.match.headers).toBe("UNKNOWN");
  }, 10000);

  it("retains a differential observer result while response matching is UNKNOWN", async () => {
    await controlledBrowser("paired-baseline-noresponse");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.pairedDiagnostic).toEqual({ execution: "COMPLETED", comparison: "UNKNOWN" });
    const evidence = result.privateEvidence.diagnostic;
    expect(evidence.observationComparison).toBe("DIFFERENTIAL");
    expect(evidence.baseline).toEqual({ status: "FAILED", errors: ["opaque-request-failed"] });
    expect(evidence.match).toMatchObject({
      responseStatus: "UNKNOWN", responseHeaders: "UNKNOWN", responseBody: "UNKNOWN",
    });
  }, 10000);

  it("stops a direct-control deadline without reporting diagnostic completion", async () => {
    const fake = await controlledBrowser("paired-direct-deadline");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.errors).toContain("direct-control-deadline");
    expect(result.pairedDiagnostic).toEqual({ execution: "INCOMPLETE", comparison: "UNKNOWN" });
    expect(fake.log.filter(([name]) => name === "direct-control")).toHaveLength(1);
    expect(result.normalJourneyChecks).toBe("FAILED");
  }, 10000);

  it.each(["paired-direct-lost", "paired-direct-lost-unavailable"])(
    "keeps %s fatal after direct observer settlement", async (fault) => {
      const fake = await controlledBrowser(fault);
      vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
        callback(null, "157.0.8103.40", "");
        return {};
      });
      const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
      expect(result.errors).toContain("direct-realm-identity");
      if (fault.endsWith("-unavailable")) expect(result.errors).toContain("response-body-unavailable");
      expect(result.pairedDiagnostic).toEqual({ execution: "INCOMPLETE", comparison: "UNKNOWN" });
      expect(result.normalJourneyChecks).toBe("FAILED");
      expect(fake.log.filter(([name]) => name === "direct-control")).toHaveLength(1);
      expect(result.cleanup.contexts).toEqual([true, true, true]);
      expect(result.cleanup.fixtures).toEqual([true, true]);
    }, 10000,
  );

  it("does not hide a late unrelated frame observer failure after a successful baseline", async () => {
    const fake = await controlledBrowser("paired-late-frame");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.errors).toContain("diagnostic-unexpected-observer");
    expect(result.pairedDiagnostic).toEqual({ execution: "INCOMPLETE", comparison: "UNKNOWN" });
    expect(fake.log.some(([name]) => name === "direct-control")).toBe(false);
  }, 10000);

  it.each([
    ["paired-content-type", "diagnostic-response-headers"],
    ["paired-cors-header", "diagnostic-response-headers"],
    ["paired-response-nonzero", "diagnostic-response-body"],
    ["paired-response-status", "diagnostic-response-status"],
  ])("rejects altered synthetic response evidence for %s", async (fault, error) => {
    const fake = await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await foregroundModule.runGoogleOpaqueDiagnosticForeground()).vendors[0];
    expect(result.errors).toContain(error);
    expect(result.pairedDiagnostic).toEqual({ execution: "INCOMPLETE", comparison: "UNKNOWN" });
    expect(fake.log.some(([name]) => name === "direct-control")).toBe(false);
  }, 10000);

  it("requests and retains the fixed no-proxy flag for the Google operation launcher", async () => {
    const fake = await controlledBrowser("opaque-observer-unavailable");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(fake.launch.mock.calls[0][0].args).toEqual(["--no-proxy-server"]);
    expect(result.privateEvidence.proxyLaunch).toMatchObject({
      requestedArgs: ["--no-proxy-server"], ownedArgvStatus: "observed-owned-launcher-argv",
      ownedArgv: fake.servers[0].child.spawnargs,
    });
    console.info("FAKE NODE LAUNCH EVIDENCE (not Chrome)", JSON.stringify({
      requestedArgs: result.privateEvidence.proxyLaunch.requestedArgs,
      ownedArgv: result.privateEvidence.proxyLaunch.ownedArgv,
    }));
  }, 10000);

  it.each([
    ["owned-argv-missing-proxy", "owned-no-proxy-flag-missing", "observed-owned-launcher-argv"],
    ["owned-argv-unavailable", "owned-launch-args-unavailable", "unavailable"],
    ["owned-argv-oversize", "owned-launch-args-unavailable", "unavailable"],
  ])("fails closed when %s", async (fault, error, status) => {
    const fake = await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.errors).toContain(error);
    expect(result.privateEvidence.proxyLaunch).toMatchObject({
      requestedArgs: ["--no-proxy-server"], ownedArgvStatus: status,
      ownedArgv: fault === "owned-argv-missing-proxy" ? fake.servers[0].child.spawnargs : null,
    });
    expect(fake.connect).not.toHaveBeenCalled();
    expect(fake.servers[0].close).toHaveBeenCalled();
  }, 10000);

  it("does not claim requested or owned argv when the operation launch was not attempted", async () => {
    const fake = await controlledBrowser();
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "155.0.0.0", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(result.errors).toContain("installed-browser-version-mismatch");
    expect(result.privateEvidence.proxyLaunch).toMatchObject({
      requestedArgs: null, ownedArgv: null, ownedArgvStatus: "unavailable",
    });
    expect(fake.launch).not.toHaveBeenCalled();
  }, 10000);

  it.each(["complete", "late-response", "unavailable", "requestfailed", "never"])(
    "keeps the opaque realm until independent recorder %s, preserving the runtime observation",
    async (kind) => {
      const fake = await controlledBrowser(`opaque-observer-${kind}`);
      vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
        callback(null, "157.0.8103.40", "");
        return {};
      });
      const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
      const snapshot = result.privateEvidence.commandObservations.find((row) =>
        row.mode === "opaque" && row.phase === "runtime-opaque-settled");
      expect(snapshot?.state.runtime.outcomes.at(-1), JSON.stringify({ errors: result.errors, log: fake.log })).toMatchObject({
        disposition: "opaque", authoredOperations: 2,
      });
      expect(snapshot.state.runtime.outcomes.at(-1)).not.toHaveProperty("status");
      const secondary = result.privateEvidence.requests.find((row) =>
        row.mode === "opaque" && row.kind === "measurement" && row.method === "POST");
      const captured = result.privateEvidence.requests.filter((row) => row.bodyVerified === true).length;
      expect(result.counts.verifiedResponseBodies).toBe(captured);
      expect(result.normalJourneyChecks).toBe("FAILED");
      const timeline = result.privateEvidence.operationTimeline;
      const settled = timeline.findIndex((row) => row.mode === "opaque" && row.event === "runtime-wait-settled");
      expect(timeline[settled].state.runtime.outcomes.at(-1)).toMatchObject({
        disposition: "opaque", authoredOperations: 2,
      });
      expect(timeline[settled].state.runtime.outcomes.at(-1)).not.toHaveProperty("status");
      const secondaryIndex = result.privateEvidence.requests.indexOf(secondary);
      const failed = timeline.findIndex((row) => row.event === "failure");
      const cleanup = timeline.findIndex((row) => row.event === "cleanup-start");
      expect(failed).toBeGreaterThan(settled);
      expect(cleanup).toBeGreaterThan(failed);
      if (kind === "complete" || kind === "late-response") {
        expect(result.errors).toContain("source-test-after-opaque");
        expect(secondary).toMatchObject({ status: 200, finished: true, responseBodyState: "captured-bytes",
          responseBytes: 0, bodyVerified: true });
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-body")).toBeGreaterThan(-1);
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-body")).toBeLessThan(
          fake.log.findIndex(([event]) => event === "opaque-realm-removed"));
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-finished")).toBeLessThan(
          fake.log.findIndex(([event]) => event === "opaque-realm-removed"));
        expect(timeline.findIndex((row) => row.event === "response-body-verified" &&
          row.request === secondaryIndex)).toBeGreaterThan(settled);
      } else {
        expect(result.errors).toContain(kind === "unavailable" ? "response-body-unavailable"
          : kind === "never" ? "opaque-observer-completion-deadline" : "opaque-request-failed");
        if (kind === "requestfailed") expect(secondary.failureCode).toBe("net::ERR_ABORTED");
        if (kind === "unavailable") expect(secondary.responseBodyState).toBe("unavailable");
        if (kind !== "requestfailed") expect(secondary.bodyVerified).not.toBe(true);
        expect(fake.log.some(([event]) => event === "opaque-realm-removed")).toBe(false);
        const snapshot = timeline.find((row) => row.event === "failure-snapshot");
        expect(snapshot).toMatchObject({ mode: "opaque", status: "observed", state: {
          phase: "settled", runtime: { outcomes: [expect.objectContaining({ disposition: "opaque" })] },
        } });
        expect(timeline.indexOf(snapshot)).toBeGreaterThan(failed);
        expect(timeline.indexOf(snapshot)).toBeLessThan(cleanup);
        if (kind === "unavailable") expect(timeline.some((row) =>
          row.event === "response-body-unavailable" && row.request === secondaryIndex)).toBe(true);
        if (kind === "requestfailed") expect(timeline.some((row) =>
          row.event === "request-failed" && row.request === secondaryIndex)).toBe(true);
      }
    }, 10000);

  it.each(["unavailable", "hangs"])("reports a %s failure snapshot without changing the original error", async (kind) => {
    await controlledBrowser(`opaque-observer-snapshot-${kind}`);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(result.errors).toContain("response-body-unavailable");
    expect(result.privateEvidence.operationTimeline.find((row) => row.event === "failure-snapshot"))
      .toMatchObject({ mode: "opaque", status: "unavailable", reason: "evaluation-state-or-snapshot-deadline" });
    expect(JSON.stringify(result.privateEvidence.operationTimeline)).not.toContain("private-snapshot-error");
  }, 10000);

  it.each([
    ["early", "settled"],
    ["pending", "in-flight"],
  ])("retains %s observer failure and the subsequently observed %s runtime state", async (kind, phase) => {
    await controlledBrowser(`opaque-observer-${kind}`);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.errors).toContain("response-body-unavailable");
    const events = result.privateEvidence.operationTimeline;
    const failure = events.findIndex((row) => row.event === "failure" && row.code === "response-body-unavailable");
    const snapshot = events.findIndex((row) => row.event === "failure-snapshot");
    const cleanup = events.findIndex((row) => row.event === "cleanup-start");
    expect(failure).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(failure);
    expect(events[snapshot]).toMatchObject({ mode: "opaque", status: "observed", state: { phase } });
    expect(cleanup).toBeGreaterThan(snapshot);
    const secondary = result.privateEvidence.requests.findIndex((row) =>
      row.mode === "opaque" && row.kind === "measurement" && row.method === "POST");
    const responseEvent = events.findIndex((row) => row.event === "response-event" && row.request === secondary);
    const responseProcessed = events.findIndex((row) => row.event === "response-processed" && row.request === secondary);
    const requestFinished = events.findIndex((row) => row.event === "request-finished" && row.request === secondary);
    expect(responseEvent).toBeGreaterThan(-1);
    expect(requestFinished).toBeGreaterThan(responseEvent);
    expect(responseProcessed).toBeGreaterThan(requestFinished);
    const settled = events.findIndex((row) => row.event === "runtime-wait-settled" && row.mode === "opaque");
    if (kind === "early") expect(settled).toBeGreaterThan(failure);
    else {
      expect(settled).toBe(-1);
      expect(result.errors).toContain("operation-opaque-deadline");
    }
    expect(events.slice(cleanup).some((row) => row.event === "close-finished" &&
      row.kind === "context" && row.mode === "opaque" && row.closed)).toBe(true);
    expect(events.slice(cleanup).some((row) => row.event === "close-finished" &&
      row.kind === "fixture" && row.mode === "opaque" && row.closed)).toBe(true);
    expect(events.slice(cleanup).find((row) => row.event === "fixture-closure" && row.mode === "opaque"))
      .toMatchObject({ status: "observed-closed", state: {
        closure: "closed", listening: false, openSockets: 0, pendingResponses: 0,
      } });
    expect(result.privateEvidence.timelineStatus).toMatchObject({
      ordering: "host-observation-order-only", failureSnapshot: "observed", omitted: 0,
    });
  }, 10000);

  it("reports an unavailable snapshot if failure precedes any operation page", async () => {
    await controlledBrowser("context-close");
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const result = (await runGoogleBrowserOperationsForeground()).vendors[0];
    expect(result.errors).toContain("context-close-failed");
    expect(result.privateEvidence.operationTimeline.find((row) => row.event === "failure-snapshot"))
      .toMatchObject({ mode: null, status: "unavailable", reason: "page-unavailable" });
    expect(result.normalJourneyChecks).toBe("FAILED");
  }, 10000);

  it.each([
    ["operation-accounting", "response-body-unavailable"],
    ["operation-overrun", "response-byte-limit"],
  ])("counts only verified response bytes for private %s", async (fault, error) => {
    await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "157.0.8103.40", "");
      return {};
    });
    const report = await runGoogleBrowserOperationsForeground();
    const result = report.vendors[0];
    const rows = result.privateEvidence.requests;
    expect(result.errors).toContain(error);
    expect(rows.some((row) => row.responseBodyState === "redirect-unavailable" && row.bodyChecked)).toBe(true);
    expect(rows.some((row) => row.responseBodyState ===
      (fault === "operation-overrun" ? "captured-bytes" : "unavailable") && row.bodyChecked && !row.bodyVerified)).toBe(true);
    const captured = rows.filter((row) => row.responseBodyState === "captured-bytes" && row.bodyVerified).length;
    expect(captured).toBeGreaterThan(0);
    expect(result.counts.verifiedResponseBodies).toBe(captured);
    const timeline = result.privateEvidence.operationTimeline;
    expect(timeline.find((row) => row.event === "failure-snapshot"))
      .toMatchObject({ mode: "readable", status: "unavailable" });
    if (fault === "operation-overrun") expect(timeline.some((row) =>
      row.event === "response-body-captured" && row.bytes === 2097153)).toBe(true);
  }, 10000);

  it("accepts exact Chrome 156.0.8078.80 in the controlled cohort", async () => {
    await controlledBrowser("version-80");
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("PASS");
    expect(result.vendors.map((vendor) => vendor.browserVersion)).toEqual([
      "156.0.8078.80", "156.0.8078.80",
    ]);
  });

  it("does not qualify HTTP204 through the owner-selected local HTTP200 path", async () => {
    await controlledBrowser("204-body-unavailable");
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors[0].errors).toContain("unexpected-response-status");
    expect(result.vendors).toHaveLength(1);
  });

  it.each(["oversized-failure-code", "private-failure-detail"])("does not retain %s", async (fault) => {
    await controlledBrowser(fault);
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors[0].errors).toContain("unexpected-request-failure");
    expect(result.vendors[0].privateEvidence.requests.at(-1).failureCode)
      .toBe("request-failure-detail-unavailable");
    expect(JSON.stringify(result)).not.toMatch(/private\.invalid|secret=not-retained|X{97}/);
  });

  it.each([96, 97])("enforces the failure-code length boundary at %i characters", async (length) => {
    const code = `net::ERR_${"X".repeat(length - "net::ERR_".length)}`;
    await controlledBrowser("loading-failure-200", code);
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors[0].privateEvidence.requests.at(-1).failureCode)
      .toBe(length === 96 ? code : "request-failure-detail-unavailable");
  });

  it("runs fixed Meta then Google, real sink controls and held 503; captures ownership before connect and cleans normally", async () => {
    const fake = await controlledBrowser();
    const result = await runLocalBrowserForeground();
    expect(result.vendors[0].errors).toEqual([]);
    expect(result.normalJourneyChecks).toBe("PASS");
    expect(result).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, interruptionLossQualification: false });
    expect(result.limits).toEqual({
      intervalMs: 60000, workMs: 50000, launchMs: 10000, requests: 64,
      measurements: 8, urlBytes: 8192, requestBytes: 65536, responseBytes: 2097152, retainedBytes: 8388608,
    });
    expect(result.vendors.map((vendor) => vendor.vendor)).toEqual(["meta", "google"]);
    for (const vendor of result.vendors) {
      expect(vendor.browserVersion).toBe("156.0.8078.80");
      expect(vendor.errors).toEqual([]);
      expect(vendor.controls).toEqual({
        allowedArrivals: 1, enforcedNewArrivals: 0, bypassNewArrivals: 1,
        governedZeroArrivals: true, responseBarrier: true, held503FailedWithout2xx: true,
      });
      expect(vendor.counts.measurementAttempts).toBe(7);
      expect(vendor.counts.observedRequests).toBe(vendor.vendor === "meta" ? 56 : 62);
      expect(vendor.counts.retainedBytes).toBeLessThanOrEqual(8388608);
      expect(vendor.sourceHashes.fixture).toHaveLength(33);
      const preflight = vendor.privateEvidence.requests.filter((row) => row.mode === "preflight");
      expect(preflight.map((row) => row.kind)).toEqual(["document", "measurement", "measurement", "measurement"]);
      expect(preflight[0]).toMatchObject({ path: "/preflight", bodyChecked: true });
      expect(vendor.privateEvidence.workers.every((worker) => worker.mode !== "preflight")).toBe(true);
      expect(vendor.cleanup).toMatchObject({
        contexts: [true, true, true], fixtures: [true, true, true], profileAbsent: true,
        workersClosed: true, normalNonsignalExit: true, serverCloseEvent: true, serverCloseResolved: true,
      });
      expect(vendor.privateOwnership.pid).toBeGreaterThan(0);
      expect(vendor.privateEvidence.receiverDocuments.product).toHaveLength(2);
      assertForegroundReceipts(vendor.vendor, vendor.privateEvidence.receiverDocuments.product);
      expect(vendor.privateEvidence.commandObservations.some((row) =>
        row.mode === "product" && row.phase === "held-response" && row.state.phase === "positive-in-flight")).toBe(true);
      expect(vendor.privateEvidence.requests.filter((row) => row.bodyChecked).every((row) =>
        /^[a-f0-9]{64}$/.test(row.responseSha256) && row.method === "GET")).toBe(true);
      expect(vendor.privateEvidence.workers.every((row) => row.closed && row.observedURL.endsWith(row.path))).toBe(true);
      const { privateOwnership: _private, privateEvidence: _evidence, ...publicPart } = vendor;
      expect(JSON.stringify(publicPart)).not.toMatch(/example\.test|SYNTHETIC_LABEL|user-data-dir|nonexistent-profile/);
    }
    expect(fake.launch).toHaveBeenCalledTimes(2);
    expect(fake.connect).toHaveBeenCalledTimes(2);
    expect(new Set(result.vendors.map((vendor) => vendor.privateOwnership.profile)).size).toBe(2);
    for (const [options] of fake.launch.mock.calls) {
      expect(options).toMatchObject({ host: "127.0.0.1", headless: false, timeout: 10000, handleSIGINT: false, handleSIGTERM: false });
      expect(options.executablePath).toBe(fileURLToPath(new URL("../rig/qualification-loopback-chrome", import.meta.url)));
      expect(options).not.toHaveProperty("userDataDir");
      expect(options).not.toHaveProperty("args");
    }
    expect(result.vendors.every((vendor) => !("proxyLaunch" in vendor.privateEvidence))).toBe(true);
    const capture = fake.log.findIndex(([event]) => event === "process-captured");
    expect(capture).toBeLessThan(fake.log.findIndex(([event]) => event === "connect"));
    expect(fake.servers.every((server) => server.child.kill.mock.calls.length === 0)).toBe(true);
    expect(fake.log.filter(([event]) => event === "new-context").every(([, options]) =>
      options.serviceWorkers === "block")).toBe(true);
    const gotos = fake.log.filter(([event]) => event === "goto");
    expect(gotos.map(([, vendor]) => vendor)).toEqual(["preflight", "meta", "meta", "preflight", "google", "google"]);
  });

  it.each([
    ["source-substitution", "served-source-identity"], ["version", "browser-version-mismatch"],
    ["old-version", "browser-version-mismatch"], ["prior-version", "browser-version-mismatch"],
    ["preflight-source", "request-outside-fixed-manifest"], ["preflight-document", "request-outside-fixed-manifest"],
    ["preflight-worker", "unexpected-worker"], ["missing-source", "loaded-source-closure"],
    ["duplicate-source", "loaded-source-closure"],
    ["foreign-endpoint", "owned-browser-endpoint"], ["missing-worker", "missing-worker-event"],
    ["empty-result", "negative-controls-not-zero"], ["profile-present", "profile-disposition"],
    ["context-close", "context-close-failed"], ["websocket", "unexpected-websocket"],
    ["frame", "unexpected-frame"], ["popup", "unexpected-page"], ["service-worker", "unexpected-service-worker"],
    ["request-body", "request-bounds"], ["header-overrun", "request-bounds"],
    ["response-overrun", "response-byte-limit"], ["non204-body-unavailable", "response-body-unavailable"],
    ["request-count", "request-count-limit"], ["loading-failure-200", "unexpected-request-failure"],
    ["work-cutoff", "request-after-work-cutoff"], ["missing-receiver", "preflight-held-deadline"],
  ])("fails %s without retry, still closing every acquired fixture/server", async (fault, error) => {
    const fake = await controlledBrowser(fault);
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors).toHaveLength(1);
    expect(result.vendors[0].errors).toContain(error);
    expect(result.vendors[0].fullCompatibility).toBe(false);
    expect(fake.launch).toHaveBeenCalledOnce();
    expect(fake.servers[0].close).toHaveBeenCalledOnce();
    if (fault === "request-count") {
      expect(result.vendors[0].counts.observedRequests).toBe(65);
      expect(result.vendors[0].privateEvidence.requests.at(-1).mode).toBe("product");
    }
    if (fault === "work-cutoff") expect(result.vendors[0].elapsedMs).toBeLessThan(60000);
    if (fault === "loading-failure-200") expect(result.vendors[0].privateEvidence.requests.at(-1))
      .toMatchObject({ status: 200, failureCode: "net::ERR_ABORTED" });
    for (const fixture of openFixtures) {
      expect(fixture.getState()).toMatchObject({ closure: "closed", listening: false, openSockets: 0, pendingResponses: 0 });
    }
  });

  it("rejects all execution options before acquiring anything", async () => {
    const fake = await controlledBrowser();
    await expect(runLocalBrowserForeground({ url: "http://127.0.0.1:1/" })).rejects.toThrow("fixed-foreground-no-options");
    expect(fake.launch).not.toHaveBeenCalled();
    expect(openFixtures).toHaveLength(0);
  });

  it("retains a launch resolving after the 10s await expires and closes it inside the ORIGINAL interval (fake clock/process only)", async () => {
    const fake = await controlledBrowser();
    const fixture = await originalStart();
    openFixtures.push(fixture);
    vi.spyOn(fixtureModule, "startLocalBrowserJourneys").mockResolvedValue(fixture);
    vi.useFakeTimers();
    let settle;
    fake.launch.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const running = runLocalBrowserForeground();
    await vi.waitFor(() => expect(fake.launch).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(10001);
    expect(fake.launch).toHaveBeenCalledOnce();
    expect(fake.connect).not.toHaveBeenCalled();
    const late = fake.makeServer();
    settle(late);
    await vi.advanceTimersByTimeAsync(100);
    const result = await running;
    expect(late.close).toHaveBeenCalledOnce();
    expect(late.child.kill).not.toHaveBeenCalled();
    expect(result.vendors[0].errors).toContain("browser-acquisition-deadline");
    expect(result.vendors[0].elapsedMs).toBeLessThan(60000);
    expect(result.vendors[0].cleanup).toMatchObject({ normalNonsignalExit: true, profileAbsent: true });
    expect(result.vendors[0].privateOwnership.pendingAcquisitions).toEqual([]);
  });

  it("uses only the retained exact child as a last resort and cannot pass signalled/unsettled cleanup (NO real process signal)", async () => {
    const fake = await controlledBrowser("server-close");
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors[0].errors).toContain("server-close-failed");
    expect(result.vendors[0].errors).toContain("server-close-unsettled");
    expect(fake.servers[0].child.kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
    expect(result.vendors[0].cleanup).toMatchObject({
      normalNonsignalExit: false, processExit: { code: null, signal: "SIGKILL" },
      processClose: { code: null, signal: "SIGKILL" }, profileAbsent: true,
    });
    expect(result.vendors[0].elapsedMs).toBeLessThan(60000);
  }, 10000);

  it("requires the actual process stdio-close callback, not exitCode alone (fake events only)", async () => {
    const fake = await controlledBrowser("missing-process-close");
    const result = await runLocalBrowserForeground();
    expect(result.normalJourneyChecks).toBe("FAILED");
    expect(result.vendors[0].errors).toContain("owned-process-disposition");
    expect(result.vendors[0].cleanup.processClose).toBeNull();
    expect(fake.servers[0].child.kill).not.toHaveBeenCalled();
  });

  it("redacts dependency error text, preserving exact profile/PID only in privateOwnership", async () => {
    const fake = await controlledBrowser();
    fake.connect.mockRejectedValue(new Error("failure at /private/personal-profile?token=DO_NOT_LOG"));
    const result = await runLocalBrowserForeground();
    expect(result.vendors[0].errors).toContain("unexpected-tool-error");
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_LOG|personal-profile/);
    expect(result.vendors[0].privateOwnership).toMatchObject({ pid: 910001 });
  });

  it("serializes one JSON artifact, publishing each vendor before the next launch (fully mocked entry import, NO browser launch)", async () => {
    const fake = await controlledBrowser();
    const fixtureFactory = fixtureModule.startLocalBrowserJourneys;
    const argv = process.argv;
    const exitCode = process.exitCode;
    let output = "";
    vi.doMock("playwright", () => ({ chromium: { launchServer: fake.launch, connect: fake.connect } }));
    vi.doMock("../rig/local-browser-journeys.mjs", () => ({ startLocalBrowserJourneys: fixtureFactory }));
    vi.resetModules();
    vi.spyOn(process.stdout, "write").mockImplementation((text, callback) => {
      output += text;
      fake.log.push(["stdout-fragment", fake.launch.mock.calls.length]);
      queueMicrotask(() => callback());
      return true;
    });
    process.argv = [process.execPath, fileURLToPath(new URL("../rig/local-browser-foreground.mjs", import.meta.url))];
    try {
      await import("../rig/local-browser-foreground.mjs");
      const report = JSON.parse(output);
      expect(report.normalJourneyChecks).toBe("PASS");
      expect(report.vendors).toHaveLength(2);
      expect(report.publicationReceipts).toHaveLength(2);
      expect(report.publicationReceipts.every((receipt) =>
        receipt.withinOriginalInterval && receipt.stdoutCallbackElapsedMs < 60000)).toBe(true);
      expect(fake.log.filter(([event]) => event === "stdout-fragment").map(([, launches]) => launches)).toEqual([0, 1, 2, 2]);
      expect(process.exitCode).toBe(0);
    } finally {
      process.argv = argv;
      process.exitCode = exitCode;
      vi.doUnmock("playwright");
      vi.doUnmock("../rig/local-browser-journeys.mjs");
      vi.resetModules();
    }
  });
});
