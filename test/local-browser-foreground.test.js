import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fixtureModule from "../rig/local-browser-journeys.mjs";
import { assertForegroundReceipts, checkForegroundRequest, runLocalBrowserForeground } from "../rig/local-browser-foreground.mjs";

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
    expect(checkForegroundRequest(fixture, "meta", input)).toBe("asset");
    expect(checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/meta`, resourceType: "document",
    })).toBe("document");
    expect(checkForegroundRequest(fixture, "meta", {
      ...input, url: `${origin}/tr/?${rows("meta")[0].query}`, resourceType: "fetch",
    })).toBe("measurement");
    for (const patch of [
      { url: "https://example.test/fixed.js" }, { url: "http://localhost:43111/fixed.js" },
      { url: `${origin}/unknown` }, { url: `${origin}/fixed.js?v=1` },
      { url: `${origin}/x/../fixed.js` }, { url: `${origin}/fixed.js#fragment` },
      { method: "POST" }, { bodyBytes: 1 }, { bodyBytes: 65537 }, { headerBytes: 65537 },
      { resourceType: "websocket" }, { url: `${origin}/${"x".repeat(8192)}` },
      { url: `${origin}/tr/?id=000000000000000`, resourceType: "fetch" },
    ]) expect(() => checkForegroundRequest(fixture, "meta", { ...input, ...patch })).toThrow();
  });
});

const originalStart = fixtureModule.startLocalBrowserJourneys;
const openFixtures = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(openFixtures.splice(0).map((fixture) => fixture.close()));
});
const mainSources = (vendor) => [
  `/rig/local-browser-journeys-${vendor}.js`,
  `/adapters/${vendor === "meta" ? "meta-pixel" : "google-ads"}-prototype.js`,
  ...["wrapped-sdk-host", "endpoint-ceiling", "config-integrity", "consent", "payload-governance", "cookie-scope"]
    .map((name) => `/core/${name}.js`),
];
const workerSources = (vendor) => [
  ...["confine-pixel-chamber", "egress-confinement", "connector-host"].map((name) => `/core/${name}.js`),
  ...(vendor === "meta" ? [
    "/connectors/meta-pixel/pageview-prototype.worker.js", "/connectors/meta-pixel/pageview-prototype.js",
    "/connectors/pixel/vendors/meta.js",
  ] : ["/connectors/google-ads/conversion-prototype.worker.js", "/connectors/google-ads/conversion-prototype.js"]),
];

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
    async send(url, type) {
      let resolve;
      let reject;
      const completion = new Promise((ok, no) => { resolve = ok; reject = no; });
      void completion.catch(() => {});
      const request = {
        url: () => url, method: () => "GET", resourceType: () => type,
        postDataBuffer: () => fault === "request-body" ? Buffer.from("x") : null,
        failure: () => ({ errorText: fault === "oversized-failure-code" ? `net::ERR_${"X".repeat(2048)}`
          : fault === "private-failure-detail" ? "Protocol error at https://private.invalid/?secret=not-retained"
            : failureDetail }),
        headersArray: async () => [{ name: "accept", value: fault === "header-overrun" ? "x".repeat(65537) : "*/*" }],
      };
      await this.handler({
        request: () => request,
        abort: async () => { this.emit("requestfailed", request); reject(new Error("source-test-aborted")); },
        continue: async () => {
          expect(new URL(url).hostname).toBe("127.0.0.1");
          const req = httpRequest(url, { agent: false }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              const body = Buffer.concat(chunks);
              this.emit("response", {
                request: () => request,
                status: () => fault === "204-body-unavailable" && type === "fetch" ? 204 : res.statusCode,
                body: async () => {
                  if (fault === "204-body-unavailable" && type === "fetch") {
                    throw new Error("Protocol error: No resource with given identifier found");
                  }
                  if (fault === "non204-body-unavailable" && res.statusCode !== 204) {
                    throw new Error("private protocol error unavailable");
                  }
                  if (fault === "response-overrun") return Buffer.alloc(2097153);
                  return fault === "source-substitution" && type === "script" ? Buffer.from("wrong") : body;
                },
              });
              if (["loading-failure-200", "oversized-failure-code", "private-failure-detail"].includes(fault) &&
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
      log.push(["goto", this.vendor, this.context.mode]);
      this.emit("framenavigated", this.frame);
      if (fault === "work-cutoff") {
        const afterCutoff = performance.now() + 50010;
        vi.spyOn(performance, "now").mockReturnValue(afterCutoff);
      }
      await this.context.send(url, "document");
      for (const path of mainSources(this.vendor)) await this.context.send(`${this.origin}${path}`, "script");
      if (fault === "request-count") {
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
      if (source.includes("void fetch(")) {
        this.control = { state: "pending", status: null };
        void this.context.send(arg, "fetch").then(
          (response) => { this.control = { state: "resolved", status: response.status }; },
          () => { this.control = { state: "rejected", status: null }; },
        );
        return;
      }
      if (source.includes("window.__foregroundControl")) return this.control;
      if (source.includes("window.beginNegativeControls()")) {
        this.worker = new EventEmitter();
        this.worker.url = () => `${this.origin}${workerSources(this.vendor)[3]}`;
        if (fault !== "missing-worker") this.emit("worker", this.worker);
        for (const path of workerSources(this.vendor)) await this.context.send(`${this.origin}${path}`, "script");
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
    browser.version = () => fault === "version" ? "155.0.0.0" : "156.0.8078.48";
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
    expect(result.normalJourneyChecks).toBe("PASS");
    expect(result).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, interruptionLossQualification: false });
    expect(result.vendors.map((vendor) => vendor.vendor)).toEqual(["meta", "google"]);
    for (const vendor of result.vendors) {
      expect(vendor.errors).toEqual([]);
      expect(vendor.controls).toEqual({
        allowedArrivals: 1, enforcedNewArrivals: 0, bypassNewArrivals: 1,
        governedZeroArrivals: true, responseBarrier: true, held503FailedWithout2xx: true,
      });
      expect(vendor.counts.measurementAttempts).toBe(7);
      expect(vendor.counts.observedRequests).toBeLessThanOrEqual(64);
      expect(vendor.counts.retainedBytes).toBeLessThanOrEqual(8388608);
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
    expect(gotos.map(([, vendor]) => vendor)).toEqual(["meta", "meta", "meta", "google", "google", "google"]);
  });

  it.each([
    ["source-substitution", "served-source-identity"], ["version", "browser-version-mismatch"],
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
    if (fault === "request-count") expect(result.vendors[0].counts.observedRequests).toBe(65);
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
