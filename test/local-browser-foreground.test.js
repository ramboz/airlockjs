import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fixtureModule from "../rig/local-browser-journeys.mjs";
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
async function controlledBrowser(fault = null, failureDetail = "net::ERR_ABORTED") {
  const log = [];
  const servers = [];
  const fixtures = new Map();
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
        headers: () => ({ accept: "*/*" }),
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
              const delayedOpaque = fault?.startsWith("opaque-observer-") &&
                this.mode === "opaque" && type === "fetch" && method === "POST";
              if (delayedOpaque) {
                log.push(["opaque-controller-headers"]);
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
                      if (fault === "opaque-observer-unavailable" || this.realmRemoved) {
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
              this.emit("response", {
                request: () => request,
                status: () => fault === "204-body-unavailable" && type === "fetch" ? 204 : res.statusCode,
                headerValue: async (name) => res.headers[name],
                frame: () => type === "document" && this.mode !== "preflight" ? {} : this.page.mainFrame(),
                body: async () => {
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
              if ((["loading-failure-200", "oversized-failure-code", "private-failure-detail"].includes(fault) ||
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
      this.closed = true;
      this.page?.worker?.emit("close");
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
      if (this.context.contextCase === "operation") this.context.mode = this.fixture.caseName;
      log.push(["goto", this.vendor, this.context.mode]);
      this.emit("framenavigated", this.frame);
      if (fault === "work-cutoff") {
        const afterCutoff = performance.now() + 50010;
        vi.spyOn(performance, "now").mockReturnValue(afterCutoff);
      }
      await this.context.send(url, "document");
      if (fault?.startsWith("opaque-observer-") && this.vendor === "google-browser-operation") {
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
      if (fault?.startsWith("opaque-observer-") && this.vendor === "google-browser-operation") {
        if (source.includes("window.prepareBrowserOperation()")) {
          this.worker = new EventEmitter();
          this.worker.url = () => `${this.origin}/connectors/google-ads/conversion-prototype.worker.js`;
          this.emit("worker", this.worker);
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
        if (source.includes("window.getBrowserOperationState()")) return structuredClone(this.operation);
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
  function makeServer() {
    const server = new EventEmitter();
    const child = new EventEmitter();
    child.pid = 910001 + servers.length;
    child.spawnargs = [
      "source-only-fake-Chrome", `--user-data-dir=${fileURLToPath(new URL(
        fault === "profile-present" ? "../" : `../.foreground-source-only-nonexistent-profile-${servers.length + 1}`, import.meta.url,
      ))}`,
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
    return makeServer();
  });
  const connect = vi.spyOn(chromium, "connect").mockImplementation(async (endpoint) => {
    log.push(["connect", endpoint]);
    const browser = new EventEmitter();
    let contexts = 0;
    browser.version = () => fault === "version-80" ? "156.0.8078.80"
      : fault === "version" ? "155.0.0.0"
      : fault === "old-version" ? "156.0.8078.48"
      : fault === "prior-version" ? "156.0.8078.76" : "156.0.8078.80";
    browser.newContext = async (options) => {
      log.push(["new-context", options]);
      return new Context(["preflight", "product", "failure"][contexts++]);
    };
    browser.close = async () => { log.push(["browser-close"]); browser.emit("disconnected"); };
    return browser;
  });
  return { log, launch, connect, servers, makeServer };
}

describe("controlled browser events + real Node HTTP — NOT actual Chrome/worker proof", () => {
  it.each(["complete", "late-response", "unavailable", "requestfailed", "never"])(
    "keeps the opaque realm until independent recorder %s, preserving the runtime observation",
    async (kind) => {
      const fake = await controlledBrowser(`opaque-observer-${kind}`);
      vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
        callback(null, "156.0.8078.80", "");
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
      if (kind === "complete" || kind === "late-response") {
        expect(result.errors).toContain("source-test-after-opaque");
        expect(secondary).toMatchObject({ status: 200, finished: true, responseBodyState: "captured-bytes",
          responseBytes: 0, bodyVerified: true });
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-body")).toBeGreaterThan(-1);
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-body")).toBeLessThan(
          fake.log.findIndex(([event]) => event === "opaque-realm-removed"));
        expect(fake.log.findIndex(([event]) => event === "opaque-recorder-finished")).toBeLessThan(
          fake.log.findIndex(([event]) => event === "opaque-realm-removed"));
      } else {
        expect(result.errors).toContain(kind === "unavailable" ? "response-body-unavailable"
          : kind === "never" ? "opaque-observer-completion-deadline" : "opaque-request-failed");
        if (kind === "requestfailed") expect(secondary.failureCode).toBe("net::ERR_ABORTED");
        if (kind === "unavailable") expect(secondary.responseBodyState).toBe("unavailable");
        if (kind !== "requestfailed") expect(secondary.bodyVerified).not.toBe(true);
        expect(fake.log.some(([event]) => event === "opaque-realm-removed")).toBe(false);
      }
    }, 10000);

  it.each([
    ["operation-accounting", "response-body-unavailable"],
    ["operation-overrun", "response-byte-limit"],
  ])("counts only verified response bytes for private %s", async (fault, error) => {
    await controlledBrowser(fault);
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback(null, "156.0.8078.80", "");
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
    }
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
