import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startGoogleBrowserOperationFixture, startLocalBrowserJourneys } from "./local-browser-journeys.mjs";

const LAUNCHER = fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url));
const IS_MAIN = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const VERSION = "156.0.8078.80";
const LEGACY_GUARD_HASHES = {
  "/rig/qualification-loopback-chrome": "3ce657f2c85945a13c2ab9cc8a6cb364eb8f66725f643a608aa978b5363b3cbf",
  "/rig/qualification-loopback-network.sb": "3204564960c5bdc369d996647e0e52176b63028bf8efe3924fbff7e1f9c0e3ee",
};
const publicationReceipts = [];
let publishedVendors = 0;
let publicationDeadline;
async function writeOutput(text, deadline) {
  let timer;
  try {
    const remaining = deadline === undefined ? undefined : deadline - performance.now();
    requireFact(remaining === undefined || remaining > 0, "output-publication-expired");
    const writing = new Promise((resolve, reject) => {
      process.stdout.write(text, (error) => error ? reject(error) : resolve());
    });
    if (deadline === undefined) return await writing;
    return await Promise.race([writing, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("output-publication-expired")), remaining);
    })]);
  } finally { clearTimeout(timer); }
}
const LIMITS = Object.freeze({
  intervalMs: 60000, workMs: 50000, launchMs: 10000, requests: 64,
  measurements: 8, urlBytes: 8192, requestBytes: 65536, responseBytes: 2097152, retainedBytes: 8388608,
});
const LEGACY_LIMITS = LIMITS;
const OPERATION_LIMITS = Object.freeze({ ...LIMITS, intervalMs: 120000, workMs: 100000, requests: 256, measurements: 24 });
const OPERATION_CASES = Object.freeze(["readable", "opaque", "unreadable-primary", "csp-negative", "redirect-307", "revoke", "lifecycle"]);
const COMMON = [
  "/core/confine-pixel-chamber.js", "/core/egress-confinement.js", "/core/connector-host.js",
  "/core/wrapped-sdk-host.js", "/core/endpoint-ceiling.js", "/core/config-integrity.js",
  "/core/consent.js", "/core/payload-governance.js", "/core/cookie-scope.js",
];
const SHARED_VENDOR_SOURCES = {
  meta: ["pageview-data", "event-options", "synthetic-identity", "agent-options"]
    .map((name) => `/connectors/meta-pixel/${name}.js`),
  google: ["destination-selectors", "consent-commands", "bootstrap-command", "purchase-cart-items",
    "remarketing-control", "view-items"].map((name) => `/connectors/google-ads/${name}.js`),
};
const workerPath = (vendor) => vendor === "meta"
  ? "/connectors/meta-pixel/pageview-prototype.worker.js"
  : "/connectors/google-ads/conversion-prototype.worker.js";
const receiverPath = (vendor) => vendor === "meta" ? "/tr/" : "/pagead/conversion/0000000000/";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function requireFact(condition, code) { if (!condition) throw new Error(code); }
function fields(vendor, second = false) {
  requireFact(vendor === "meta" || vendor === "google", "fixed-vendor-required");
  return vendor === "meta" ? [
    ["id", "000000000000000"], ["ev", "PageView"],
    ["dl", second ? "https://example.test/meta-b#second" : "https://example.test/meta-a"],
    ["rl", ""], ["if", "false"], ["sw", "412"], ["sh", "823"], ["tz", "-420"],
  ] : [
    ["label", "SYNTHETIC_LABEL"], ["value", second ? "0" : "28.75"],
    ["currency_code", second ? "" : "CAD"], ["oid", second ? "synthetic-b" : "synthetic-a"],
    ["url", second ? "https://example.test/google-b#second" : "https://example.test/google-a"],
  ];
}
const queryFor = (vendor, second = false) => new URLSearchParams(fields(vendor, second)).toString();

// Self-contained because Playwright serializes this function into the owned page.
export function startForegroundControlFetch(url) {
  window.__foregroundControl = { state: "pending", status: null, bodyConsumed: false };
  void fetch(url, { method: "GET", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" })
    .then(async (response) => {
      if (response.status !== 200 || response.headers.get("content-length") !== "0" || !response.body) {
        throw new Error("invalid-control-response");
      }
      const reader = response.body.getReader();
      let done = false;
      try {
        const chunk = await reader.read();
        done = chunk.done === true;
        if (!done || chunk.value?.byteLength) throw new Error("nonempty-control-response");
      } finally {
        try { if (!done) await reader.cancel(); }
        finally { reader.releaseLock(); }
      }
      window.__foregroundControl = { state: "resolved", status: 200, bodyConsumed: true, bodyBytes: 0 };
    }).catch(() => {
      window.__foregroundControl = { state: "rejected", status: null, bodyConsumed: false };
    });
}

// These pure checks are exported for offline tests, not as execution configuration.
export function assertForegroundReceipts(vendor, rows, statuses = [200, 200]) {
  requireFact(Array.isArray(rows) && rows.length === statuses.length, "receiver-count");
  rows.forEach((row, index) => {
    const query = queryFor(vendor, index === 1);
    requireFact(row.method === "GET" && row.path === receiverPath(vendor) &&
      row.query === query && equal(row.fields, fields(vendor, index === 1)) &&
      equal(row.rawFields, query.split("&").map((field) => field.split("="))) &&
      row.status === statuses[index] && row.response === "finished" &&
      Number.isFinite(row.arrivedAt) && row.respondedAt >= row.arrivedAt, "receiver-document");
  });
}

export function checkForegroundRequest(fixture, vendor, input, mode) {
  requireFact(vendor === "meta" || vendor === "google", "fixed-vendor-required");
  requireFact(["preflight", "product", "failure"].includes(mode), "fixed-mode-required");
  requireFact(/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(fixture.origin), "fixture-origin");
  requireFact(typeof input.url === "string" && Buffer.byteLength(input.url) <= LIMITS.urlBytes &&
    input.method === "GET" && input.bodyBytes === 0 &&
    Number.isInteger(input.headerBytes) && input.headerBytes >= 0 &&
    input.headerBytes <= LIMITS.requestBytes, "request-bounds");
  const documentPath = mode === "preflight" ? "/preflight" : `/${vendor}`;
  if (input.url === `${fixture.origin}${documentPath}` && input.resourceType === "document") return "document";
  if (mode !== "preflight" && fixture.sourceManifest.some(({ path }) => input.url === `${fixture.origin}${path}`) &&
      input.resourceType === "script") return "asset";
  if (["fetch", "xhr"].includes(input.resourceType) &&
      (mode === "preflight" ? [false] : [false, true]).some((second) =>
        input.url === `${fixture.origin}${receiverPath(vendor)}?${queryFor(vendor, second)}`)) return "measurement";
  throw new Error("request-outside-fixed-manifest");
}

export function checkGoogleOperationRequest(fixture, input) {
  requireFact(OPERATION_CASES.includes(fixture.caseName) && Array.isArray(fixture.origins) &&
    fixture.origins.length === 3 && fixture.origins.every((origin) =>
      /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin)), "operation-fixture");
  requireFact(typeof input.url === "string" && Buffer.byteLength(input.url) <= OPERATION_LIMITS.urlBytes &&
    ["GET", "POST"].includes(input.method) && input.bodyBytes === 0 &&
    Number.isInteger(input.headerBytes) && input.headerBytes >= 0 &&
    input.headerBytes <= OPERATION_LIMITS.requestBytes, "request-bounds");
  const [parent, secondary, denied] = fixture.origins;
  const url = input.url;
  const resource = input.resourceType;
  if (input.method === "GET" && resource === "document" && url === `${parent}/google-browser-operation`) return "document";
  if (input.method === "GET" && ["document", "fetch"].includes(resource) &&
      url === `${parent}/rig/google-browser-operation-frame.html`) return resource === "document" ? "frame" : "frame-verification";
  if (input.method === "GET" && resource === "script" &&
      fixture.sourceManifest.some(({ path }) => url === `${parent}${path}`)) return "asset";
  if (["fetch", "xhr"].includes(resource)) {
    const primary = fixture.caseName === "unreadable-primary" ? secondary : parent;
    if (input.method === "GET" && url === `${primary}${fixture.operationPaths.primary}`) return "measurement";
    if (input.method === "POST" && url === `${secondary}${fixture.operationPaths.secondary}`) return "measurement";
    if (input.method === "GET" && fixture.caseName === "csp-negative" && url === `${denied}/reachability`) return "measurement";
    if (input.method === "GET" && fixture.caseName === "csp-negative" && url === `${denied}/operation-csp-denied`) return "measurement";
    if (input.method === "POST" && fixture.caseName === "redirect-307" && url === `${secondary}/operation-intermediate`) return "measurement";
    if (input.method === "GET" && url === `${secondary}/${fixture.caseName === "readable" ? "operation-unexpected-path" : "operation-final"}`) return "measurement";
  }
  throw new Error("request-outside-fixed-manifest");
}

async function runVendor(vendor, interruption, ownedProfiles, operationPacket = false) {
  const LIMITS = operationPacket ? OPERATION_LIMITS : LEGACY_LIMITS;
  const start = performance.now();
  const cutoff = start + LIMITS.workMs;
  const end = start + LIMITS.intervalMs;
  publicationDeadline = end;
  const errors = [];
  const entries = [];
  const requests = [];
  const observations = new Set();
  const workers = [];
  const receiverFixtures = new Map();
  const commandObservations = [];
  const controls = {};
  const cleanup = { contexts: [], fixtures: [] };
  let retainedBytes = 0;
  let observedRequests = 0;
  let measurementAttempts = 0;
  let stopping = false;
  let sourceHashes;
  let browserVersion;
  let processFacts;
  let productChecked = false;
  const fail = (message) => {
    const code = typeof message === "string" && /^[a-z][a-z0-9-]{0,80}$/.test(message) ? message : "unexpected-tool-error";
    if (errors.length < 16 && !errors.includes(code)) errors.push(code);
  };
  function retain(value) {
    retainedBytes += Buffer.isBuffer(value) ? value.length : Buffer.byteLength(JSON.stringify(value));
    requireFact(retainedBytes <= LIMITS.retainedBytes, "retention-limit");
    return value;
  }
  async function bounded(action, label, max = 5000, cleaning = false, stopAt = cleaning ? end : cutoff) {
    if (!cleaning) {
      requireFact(!interruption.signal.aborted, "owner-interrupted");
      requireFact(errors.length === 0, errors[0]);
    }
    const remaining = Math.min(max, stopAt - performance.now());
    requireFact(remaining > 0, `${label}-deadline`);
    let timer;
    let abort;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          if (!cleaning) {
            requireFact(performance.now() < cutoff && !interruption.signal.aborted, `${label}-deadline`);
            requireFact(errors.length === 0, errors[0]);
          }
          return action();
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label}-deadline`)), remaining);
          if (!cleaning) {
            abort = () => reject(new Error("owner-interrupted"));
            interruption.signal.addEventListener("abort", abort, { once: true });
          }
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (abort) interruption.signal.removeEventListener("abort", abort);
    }
  }
  async function until(predicate, label, max = 1500, cleaning = false) {
    const stopAt = Math.min(cleaning ? end : cutoff, performance.now() + max);
    return bounded(async () => {
      while (!await predicate()) {
        requireFact(performance.now() < stopAt, `${label}-deadline`);
        if (!cleaning) requireFact(errors.length === 0, errors[0]);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }, label, max, cleaning, stopAt);
  }
  function observe(action) {
    const promise = Promise.resolve().then(action).catch((error) => fail(error.message));
    observations.add(promise);
    void promise.finally(() => observations.delete(promise));
  }
  async function flush() {
    await bounded(() => Promise.all([...observations]), "request-observation");
    requireFact(errors.length === 0, errors[0]);
  }
  function acquire(kind, action) {
    // Register ownership BEFORE invoking/awaiting any allocating operation.
    if (operationPacket) {
      const maximum = kind === "fixture" || kind === "context" ? 8 : 1;
      requireFact(entries.filter((entry) => entry.kind === kind).length < maximum, "operation-acquisition-limit");
    }
    const entry = { kind, value: null, settled: false };
    entries.push(entry);
    entry.promise = Promise.resolve().then(() => {
      requireFact(!stopping && performance.now() < cutoff && !interruption.signal.aborted, "acquisition-after-work-cutoff");
      requireFact(errors.length === 0, errors[0]);
      return action();
    }).then((value) => {
      entry.value = value;
      entry.settled = true;
      try {
        if (kind === "server") {
          const child = value.process();
          processFacts = { child, pid: child.pid, exit: null, close: null, serverEvent: false, killed: false };
          child.once("exit", (code, signal) => { processFacts.exit = { code, signal }; });
          child.once("close", (code, signal) => { processFacts.close = { code, signal }; });
          child.once("error", () => fail("owned-process-error"));
          value.once("close", () => { processFacts.serverEvent = true; });
          const profiles = child.spawnargs.filter((arg) => arg.startsWith("--user-data-dir="));
          processFacts.profile = profiles.length === 1 ? profiles[0].slice("--user-data-dir=".length) : null;
          requireFact(Number.isSafeInteger(child.pid) && child.pid > 0 && processFacts.profile &&
            isAbsolute(processFacts.profile), "owned-process-profile-identity");
          requireFact(!ownedProfiles.has(processFacts.profile), "reused-browser-profile");
          ownedProfiles.add(processFacts.profile);
        }
      } finally {
        if (stopping) void closeEntry(entry);
      }
      return value;
    }, (error) => {
      entry.settled = true;
      throw error;
    });
    void entry.promise.catch(() => {});
    return entry;
  }
  async function closeEntry(entry) {
    if (!entry.value) return;
    if (!entry.closing) entry.closing = (async () => {
      try {
        entry.closeOperation = Promise.resolve().then(() => entry.value.close()).then(() => { entry.closed = true; });
        void entry.closeOperation.catch(() => {});
        await bounded(() => entry.closeOperation, `${entry.kind}-close`, entry.kind === "server" ? 2500 : 1000, true);
      } catch { fail(`${entry.kind}-close-failed`); }
      if (entry.kind === "context") cleanup.contexts.push(entry.closed === true);
      if (entry.kind === "fixture") try {
        const state = entry.value.getState();
        retain(state);
        const closed = entry.closed === true && state.closure === "closed" && !state.listening &&
          state.openSockets === 0 && state.pendingResponses === 0 && state.errors.length === 0 &&
          state.refusedRequests === 0 && state.overLimitRequests === 0;
        cleanup.fixtures.push(closed);
        if (!closed) fail("fixture-disposition");
      } catch { cleanup.fixtures.push(false); fail("fixture-disposition"); }
    })();
    return entry.closing;
  }
  async function startFixture(caseName) {
    if (sourceHashes) requireFact(retainedBytes + sourceHashes.fixture.reduce((sum, row) => sum + row.bytes, 0) <=
      LIMITS.retainedBytes, "retention-limit");
    const entry = acquire("fixture", () => caseName ? startGoogleBrowserOperationFixture(caseName) : startLocalBrowserJourneys());
    const fixture = await bounded(() => entry.promise, "fixture-start", 2500);
    const hashes = [...fixture.pageManifest, ...fixture.sourceManifest];
    requireFact(hashes.length === (caseName ? 34 : 33) && hashes.every((row) => row.bytes <= LIMITS.responseBytes &&
      /^[a-f0-9]{64}$/.test(row.sha256)), "source-manifest");
    retainedBytes += hashes.reduce((sum, row) => sum + row.bytes, 0);
    requireFact(retainedBytes <= LIMITS.retainedBytes, "retention-limit");
    if (!sourceHashes) sourceHashes = { fixture: retain(hashes) };
    else if (!caseName) requireFact(equal(sourceHashes.fixture, hashes), "fixture-source-changed");
    else {
      sourceHashes.operation ||= {};
      sourceHashes.operation[caseName] = retain(hashes);
      if (sourceHashes.operationSources) requireFact(equal(sourceHashes.operationSources, fixture.sourceManifest), "operation-source-changed");
      else sourceHashes.operationSources = retain(fixture.sourceManifest);
    }
    return entry;
  }
  async function pageFor(browser, fixture, mode) {
    const operation = operationPacket && mode !== "preflight";
    const documentPath = mode === "preflight" ? "/preflight" : operation ? "/google-browser-operation" : `/${vendor}`;
    receiverFixtures.set(mode, fixture);
    const contextEntry = acquire("context", () => browser.newContext({ serviceWorkers: "block" }));
    const context = await bounded(() => contextEntry.promise, "context-start");
    const state = { mode, page: null, documents: 0, measurements: 0, deny: false, positive: false, worker: null,
      cspDenialObserved: false };
    const rows = new Map();
    context.on("serviceworker", () => fail("unexpected-service-worker"));
    context.on("page", (page) => {
      if (state.page) {
        fail("unexpected-page");
        observe(() => page.close());
        return;
      }
      state.page = page;
      page.on("pageerror", () => fail("page-error"));
      page.on("console", (message) => {
        if (operation && mode === "csp-negative") {
          const text = message.text();
          if (text.length <= 2048 && /content security policy/i.test(text) &&
              /connect-src/i.test(text) && text.includes(fixture.origins[2])) state.cspDenialObserved = true;
        }
      });
      page.on("crash", () => fail("page-crashed"));
      page.on("dialog", (dialog) => { fail("unexpected-dialog"); observe(() => dialog.dismiss()); });
      page.on("download", () => fail("unexpected-download"));
      page.on("frameattached", () => { if (!operation) fail("unexpected-frame"); });
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame() ? frame.url() !== `${fixture.origin}${documentPath}` :
          !operation || frame.parentFrame() !== page.mainFrame() ||
          frame.url() !== `${fixture.origin}/rig/google-browser-operation-frame.html`) fail("unexpected-navigation");
      });
      page.on("websocket", () => fail("unexpected-websocket"));
      page.on("worker", (worker) => {
        if (workers.length >= (operationPacket ? 8 : 2)) { fail("unexpected-worker"); return; }
        const row = { path: workerPath(vendor), observedURL: worker.url(), closed: false, mode };
        workers.push(row);
        if (mode === "preflight" || (state.worker && !operation) ||
            worker.url() !== `${fixture.origin}${row.path}`) fail("unexpected-worker");
        state.worker = worker;
        worker.once("close", () => { row.closed = true; });
      });
    });
    await bounded(() => context.routeWebSocket("**/*", (socket) => {
      fail("unexpected-websocket");
      socket.close();
    }), "websocket-denial");
    await bounded(() => context.route("**/*", async (route) => {
      const request = route.request();
      let row;
      try {
        requireFact(!stopping && performance.now() < cutoff, "request-after-work-cutoff");
        if (operation && request.redirectedFrom() && rows.has(request)) {
          await route.continue();
          return;
        }
        observedRequests = Math.min(observedRequests + 1, LIMITS.requests + 1);
        requireFact(observedRequests <= LIMITS.requests, "request-count-limit");
        requireFact(errors.length === 0, errors[0]);
        row = { mode, path: null, denied: false, status: null, finished: false, bodyChecked: false };
        requests.push(row);
        rows.set(request, row);
        const headers = operationPacket
          ? Object.entries(request.headers()).map(([name, value]) => ({ name, value }))
          : await request.headersArray();
        const input = {
          url: request.url(), method: request.method(), bodyBytes: request.postDataBuffer()?.length || 0,
          headerBytes: Buffer.byteLength(headers.map(({ name, value }) => `${name}: ${value}\r\n`).join("")),
          resourceType: request.resourceType(),
        };
        const kind = operation ? checkGoogleOperationRequest(fixture, input) : checkForegroundRequest(fixture, vendor, input, mode);
        requireFact(headers.length <= 64, "request-header-count");
        const document = { url: request.url(), method: request.method(),
          resourceType: request.resourceType(), headers, bodyBytes: request.postDataBuffer()?.length || 0 };
        // Charge before retaining data; rejected input leaves only fixed metadata.
        retain(document);
        retainedBytes += 1024; // Bounded response status/hash and final row metadata.
        requireFact(retainedBytes <= LIMITS.retainedBytes, "retention-limit");
        Object.assign(row, document);
        row.path = new URL(request.url()).pathname;
        row.kind = kind;
        retain(row);
        if (kind === "document") requireFact(++state.documents === 1, "extra-document");
        if (kind === "measurement") {
          requireFact(++measurementAttempts <= LIMITS.measurements, "measurement-count-limit");
          state.measurements += 1;
          const second = state.measurements === 2 && mode !== "preflight";
          if (!operation) requireFact(request.url() === `${fixture.origin}${receiverPath(vendor)}?${queryFor(vendor, second)}` &&
            state.measurements <= (mode === "preflight" ? 3 : 2) &&
            (mode === "preflight" || state.positive), "unexpected-measurement");
          if (state.deny || (mode === "failure" && second)) {
            row.denied = true;
            await route.abort("blockedbyclient");
            return;
          }
        }
        await route.continue();
      } catch (error) {
        fail(error.message);
        if (row) row.violation = true;
        try { await route.abort("blockedbyclient"); } catch { fail("route-abort-failed"); }
      }
    }), "request-denial");
    context.on("request", (request) => {
      if (!operation || !request.redirectedFrom()) return;
      try {
        requireFact(!stopping && performance.now() < cutoff && errors.length === 0, "redirect-after-work-cutoff");
        requireFact(++observedRequests <= LIMITS.requests && ++measurementAttempts <= LIMITS.measurements,
          "redirect-count-limit");
        const input = {
          url: request.url(), method: request.method(), bodyBytes: request.postDataBuffer()?.length || 0,
          headerBytes: 0, resourceType: request.resourceType(),
        };
        requireFact(checkGoogleOperationRequest(fixture, input) === "measurement", "redirect-outside-manifest");
        const row = { mode, kind: "measurement", path: new URL(input.url).pathname, ...input,
          denied: false, status: null, finished: false, bodyChecked: false, redirected: true };
        requests.push(row);
        rows.set(request, row);
        retain(row);
        observe(async () => {
          const headers = Object.entries(request.headers()).map(([name, value]) => ({ name, value }));
          const headerBytes = Buffer.byteLength(headers.map(({ name, value }) => `${name}: ${value}\r\n`).join(""));
          requireFact(headers.length <= 64 && headerBytes <= LIMITS.requestBytes, "redirect-header-limit");
          row.headers = retain(headers);
          row.headerBytes = headerBytes;
        });
      } catch (error) { fail(error.message); }
    });
    context.on("requestfailed", (request) => {
      const row = rows.get(request);
      if (row) {
        const detail = request.failure?.()?.errorText;
        // Keep a bounded network code, never a URL or arbitrary protocol text.
        row.failureCode = typeof detail === "string" && detail.length <= 96 && /^net::ERR_[A-Z0-9_]+$/.test(detail)
          ? detail : "request-failure-detail-unavailable";
      }
      if (!row?.denied && !(operation && row?.kind === "measurement")) fail("unexpected-request-failure");
      if (row) {
        row.finished = true;
        if (operation && row.kind === "measurement") row.bodyChecked = true;
      }
    });
    context.on("requestfinished", (request) => {
      const row = rows.get(request);
      if (!row) fail("unobserved-request");
      else row.finished = true;
    });
    context.on("response", (response) => observe(async () => {
      const row = rows.get(response.request());
      requireFact(row && !row.denied && !row.violation && row.status === null, "unobserved-response");
      row.status = response.status();
      const expected = row.kind === "measurement"
        ? (mode === "failure" ? 503 : 200)
        : 200;
      if (operation && row.kind === "measurement") {
        requireFact([200, 302, 307].includes(row.status), "unexpected-response-status");
        if (row.status === 302 || row.status === 307) {
          row.responseBodyState = "redirect-unavailable";
          row.bodyChecked = true;
          return;
        }
      } else requireFact(row.status === expected, "unexpected-response-status");
      let body;
      try { body = await response.body(); }
      catch {
        row.responseBodyState = "unavailable";
        throw new Error("response-body-unavailable");
      }
      row.responseBodyState = "captured-bytes";
      requireFact(body.length <= LIMITS.responseBytes, "response-byte-limit");
      retain(body);
      row.responseBytes = body.length;
      row.responseSha256 = digest(body);
      if (row.kind === "measurement") {
        if (!operation) requireFact(body.length === 0, "measurement-response-body");
      }
      else {
        const manifest = [...fixture.pageManifest, ...fixture.sourceManifest].find((entry) => entry.path === row.path);
        requireFact(manifest && body.length === manifest.bytes && digest(body) === manifest.sha256, "served-source-identity");
      }
      if (operation && row.kind === "frame") {
        const policy = await response.headerValue("content-security-policy");
        requireFact(policy === fixture.framePolicy &&
          response.request().isNavigationRequest() &&
          response.frame() !== state.page.mainFrame(), "frame-navigation-policy");
        row.frameNavigationPolicy = policy;
        row.frameNavigationBytes = body.toString("utf8");
      }
      row.bodyChecked = true;
      if (operationPacket) row.bodyVerified = true;
    }));
    await bounded(() => context.grantPermissions(["local-network-access"], { origin: fixture.origin }), "local-permission");
    const page = await bounded(() => context.newPage(), "page-start");
    requireFact(state.page === page, "unobserved-page");
    await bounded(() => page.goto(`${fixture.origin}${documentPath}`, {
      waitUntil: "load", timeout: Math.min(5000, Math.max(1, cutoff - performance.now())),
    }), "page-load");
    if (operation) {
      await bounded(() => page.waitForFunction(() => typeof window.prepareBrowserOperation === "function" &&
        typeof window.getBrowserOperationState === "function"), "operation-controller-ready");
    } else if (mode !== "preflight") {
      await bounded(() => page.waitForFunction(() =>
        typeof window.getJourneyState === "function" && typeof window.beginNegativeControls === "function" &&
        typeof window.beginPositiveControls === "function" && typeof window.finishJourney === "function",
      null, { timeout: Math.min(3000, Math.max(1, cutoff - performance.now())) }), "controller-ready");
      requireFact((await bounded(() => page.evaluate(() => window.getJourneyState()), "controller-idle")).phase === "not-started",
        "controller-not-idle");
    }
    return { contextEntry, state, page };
  }
  async function closePhase(fixtureEntry, pageState) {
    await flush();
    const fixture = fixtureEntry.value;
    requireFact(fixture.getState().refusedRequests === 0 && fixture.getState().overLimitRequests === 0 &&
      fixture.getState().errors.length === 0, "fixture-request-failure");
    const phaseRows = requests.filter((row) => row.mode === pageState.state.mode);
    await until(() => phaseRows.every((row) => row.finished && (row.denied || row.bodyChecked)), "responses-finished");
    await closeEntry(pageState.contextEntry);
    await closeEntry(fixtureEntry);
    requireFact(errors.length === 0, errors[0]);
  }
  async function negatives(pageState, fixture) {
    const state = retain(await bounded(() => pageState.page.evaluate(() => window.beginNegativeControls()), "negative-controls", 7000));
    commandObservations.push({ mode: pageState.state.mode, phase: "negative-controls", state });
    requireFact(state.phase === "negative-controls-complete" && state.failure === null &&
      state.captureAndTransport?.host.dispatchAttempts === 0 &&
      equal(state.controls, {
        pendingDispatchAttempts: 0, deniedDispatchAttempts: 0, grantWithoutCommandDispatchAttempts: 0,
      }) && fixture.getReceiverArrivals(vendor).length === 0 &&
      fixture.getReceiverArrivals(vendor === "meta" ? "google" : "meta").length === 0, "negative-controls-not-zero");
    requireFact(pageState.state.worker, "missing-worker-event");
    const expected = [
      ...COMMON, `/rig/local-browser-journeys-${vendor}.js`, `/adapters/${vendor === "meta" ? "meta-pixel" : "google-ads"}-prototype.js`,
      workerPath(vendor), vendor === "meta"
        ? "/connectors/meta-pixel/pageview-prototype.js" : "/connectors/google-ads/conversion-prototype.js",
      ...(vendor === "meta" ? ["/connectors/pixel/vendors/meta.js", "/connectors/pixel/advanced-matching.js"] : []),
      ...(vendor === "google" ? ["/connectors/google-ads/manual-response.js"] : []),
      ...SHARED_VENDOR_SOURCES[vendor], ...SHARED_VENDOR_SOURCES[vendor],
    ];
    const actual = requests.filter((row) => row.mode === pageState.state.mode && row.kind === "asset").map((row) => row.path);
    requireFact(equal(actual.sort(), expected.sort()), "loaded-source-closure");
  }
  async function beginPositive(pageState) {
    pageState.state.positive = true;
    // Deliberately do not return/await the controller's command promise.
    await bounded(() => pageState.page.evaluate(() => { void window.beginPositiveControls(); }), "positive-start");
  }
  async function held(pageState, fixture) {
    await until(() => fixture.getReceiverArrivals(vendor).length === 1, "held-arrival");
    const row = fixture.getReceiverArrivals(vendor)[0];
    const state = retain(await bounded(() => pageState.page.evaluate(() => window.getJourneyState()), "pending-command"));
    commandObservations.push({ mode: pageState.state.mode, phase: "held-response", state });
    requireFact(row.status === null && row.response === "held" &&
      state.phase === "positive-in-flight" && state.failure === null &&
      state.captureAndTransport.inFlight === true && state.captureAndTransport.outcomes.length === 3 &&
      !state.captureAndTransport.outcomes.some((outcome) => outcome.seq >= 4), "response-barrier-not-observed");
  }
  async function operationCases(browser) {
    for (const name of OPERATION_CASES) {
      const fixtureEntry = await startFixture(name);
      const fixture = fixtureEntry.value;
      const pageState = await pageFor(browser, fixture, name);
      const page = pageState.page;
      const evaluate = (fn, arg) => bounded(() => page.evaluate(fn, arg), `operation-${name}`, 5000);
      const receipts = () => fixture.getOperationReceipts();
      const waitStage = (stage, count = 1) => until(() => receipts().filter((row) => row.stage === stage).length >= count,
        `operation-${name}-${stage}`, 2500);
      const begin = () => evaluate(() => window.beginBrowserOperation());
      const wait = () => evaluate(() => window.waitBrowserOperation());
      const prepare = () => evaluate(() => window.prepareBrowserOperation());
      if (name === "csp-negative") {
        requireFact(await evaluate(() => window.probeDisallowedReceiver()) === "reachable", "csp-reachability");
        await waitStage("reachability");
      }
      await prepare();
      await begin();
      if (name === "readable") {
        await waitStage("final");
        const pending = await evaluate(() => window.getBrowserOperationState());
        requireFact(pending.phase === "in-flight" && receipts().at(-1).status === null, "final-response-barrier");
        requireFact(fixture.releaseResponse("final"), "final-response-release");
      } else if (name === "revoke") {
        for (const [index, stop] of ["consent", "permission"].entries()) {
          if (index) { await prepare(); await begin(); }
          await waitStage("final", index + 1);
          await evaluate((kind) => window.stopBrowserOperation(kind), stop);
          const stopped = await wait();
          requireFact(stopped.runtime.phase === "terminal", "revocation-not-terminal");
          await evaluate(() => window.disposeBrowserOperation());
        }
      } else if (name === "lifecycle") {
        await waitStage("primary");
        const timedOut = await wait();
        requireFact(timedOut.runtime.outcomes.at(-1)?.reason === "timed-out", "transport-deadline");
        await begin();
        await waitStage("primary", 2);
        await evaluate(() => window.stopBrowserOperation("worker"));
        requireFact((await wait()).runtime.phase === "terminal", "owned-worker-loss");
      }
      if (name !== "revoke" && name !== "lifecycle") {
        const result = await wait();
        const outcome = result.runtime.outcomes.at(-1);
        const rows = receipts().filter((row) => row.stage !== "reachability");
        if (name === "readable" || name === "redirect-307") {
          requireFact(outcome?.disposition === "readable" && outcome.authoredOperations === 2 && outcome.status === 200,
            "readable-outcome");
        } else if (name === "opaque") {
          requireFact(outcome?.disposition === "opaque" && outcome.authoredOperations === 2 && !("status" in outcome),
            "opaque-outcome");
          commandObservations.push({ mode: name, phase: "runtime-opaque-settled", state: retain(result) });
          await until(() => {
            const observed = requests.filter((row) => row.mode === name && row.kind === "measurement");
            requireFact(!observed.some((row) => row.failureCode), "opaque-request-failed");
            return observed.length === 2 &&
              observed.some((row) => row.method === "GET" && row.url === `${fixture.origin}${fixture.operationPaths.primary}`) &&
              observed.some((row) => row.method === "POST" &&
                row.url === `${fixture.origins[1]}${fixture.operationPaths.secondary}`) &&
              observed.every((row) => row.status === 200 && row.finished && row.bodyVerified === true);
          }, "opaque-observer-completion");
          await flush();
          await evaluate(() => window.stopBrowserOperation("realm"));
          await until(async () => (await page.evaluate(() => window.getBrowserOperationState())).runtime.phase === "terminal",
            "realm-loss");
        } else if (name === "unreadable-primary") {
          requireFact(outcome?.disposition === "failed" && outcome.authoredOperations === 1 &&
            rows.every((row) => row.stage === "primary"), "unreadable-primary-control");
        } else {
          requireFact(outcome?.disposition === "failed" && outcome.authoredOperations === 2 &&
            !rows.some((row) => row.origin === fixture.origins[2]), "csp-denial-control");
          await until(() => pageState.state.cspDenialObserved, "csp-console-observation");
          requireFact(!requests.some((row) => row.mode === name &&
            row.url === `${fixture.origins[2]}/operation-csp-denied` && row.denied), "csp-harness-aborted");
        }
        if (name === "readable") requireFact(equal(rows.map((row) => [row.method, row.status]),
          [["GET", 200], ["POST", 302], ["GET", 200]]), "readable-receiver-sequence");
        if (name === "redirect-307") requireFact(equal(rows.map((row) => [row.method, row.status]),
          [["GET", 200], ["POST", 307], ["POST", 200]]), "redirect-receiver-sequence");
        await evaluate(() => window.disposeBrowserOperation());
      } else if (name === "lifecycle") await evaluate(() => window.disposeBrowserOperation());
      await flush();
      const frameRows = requests.filter((row) => row.mode === name && row.kind === "frame");
      requireFact(frameRows.length === (name === "revoke" ? 2 : 1) &&
        frameRows.every((row) => row.bodyChecked && row.frameNavigationPolicy === fixture.framePolicy &&
          typeof row.frameNavigationBytes === "string"), "loaded-frame-observation");
      commandObservations.push({ mode: name, state: retain(await evaluate(() => window.getBrowserOperationState())),
        receipts: retain(receipts()) });
      await closePhase(fixtureEntry, pageState);
    }
    await until(() => workers.length === 8 && workers.every((worker) => worker.closed), "worker-disposition");
    controls.browserOperationCases = true;
  }
  try {
    const preflightFixture = await startFixture();
    const ownSources = [
      "/rig/local-browser-foreground.mjs", "/rig/local-browser-journeys.mjs",
      "/rig/qualification-loopback-chrome", "/rig/qualification-loopback-network.sb",
    ];
    sourceHashes.procedure = await bounded(() => Promise.all(ownSources.map(async (path) => {
      const body = await readFile(new URL(`..${path}`, import.meta.url));
      retain(body);
      const sha256 = digest(body);
      requireFact(!LEGACY_GUARD_HASHES[path] || LEGACY_GUARD_HASHES[path] === sha256, "legacy-guard-source-changed");
      return { path, bytes: body.length, sha256 };
    })), "procedure-sources");
    if (operationPacket) await bounded(() => new Promise((resolve, reject) => {
      execFile("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw",
        "/Applications/Google Chrome.app/Contents/Info.plist"], { timeout: 2000, maxBuffer: 1024 },
      (error, stdout) => {
        if (error || stdout.trim() !== VERSION) reject(new Error("installed-browser-version-mismatch"));
        else resolve();
      });
    }), "installed-browser-metadata", 2500);
    const serverEntry = acquire("server", () => chromium.launchServer({
      executablePath: LAUNCHER, host: "127.0.0.1", headless: false,
      timeout: Math.min(LIMITS.launchMs, Math.max(1, cutoff - performance.now())),
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    }));
    const server = await bounded(() => serverEntry.promise, "browser-acquisition", LIMITS.launchMs);
    const endpoint = server.wsEndpoint();
    const parsed = new URL(endpoint);
    requireFact(parsed.protocol === "ws:" && parsed.hostname === "127.0.0.1" &&
      parsed.port && !parsed.username && !parsed.password && !parsed.search && !parsed.hash, "owned-browser-endpoint");
    const browserEntry = acquire("browser", () => chromium.connect(endpoint, {
      timeout: Math.min(5000, Math.max(1, cutoff - performance.now())),
    }));
    const browser = await bounded(() => browserEntry.promise, "browser-connect");
    browser.on("disconnected", () => { if (!stopping) fail("unexpected-browser-disconnect"); });
    browserVersion = browser.version();
    requireFact(browserVersion === VERSION, "browser-version-mismatch");
    const preflight = await pageFor(browser, preflightFixture.value, "preflight");
    const fixture = preflightFixture.value;
    const localURL = `${fixture.origin}${receiverPath(vendor)}?${queryFor(vendor)}`;
    async function sendControl() {
      await bounded(() => preflight.page.evaluate(startForegroundControlFetch, localURL), "local-preflight-start");
    }
    async function controlResult(expectedState, status) {
      await until(async () => {
        const result = await preflight.page.evaluate(() => window.__foregroundControl);
        const matched = result?.state === expectedState && result.status === status &&
          (expectedState !== "resolved" || (result.bodyConsumed === true && result.bodyBytes === 0));
        if (matched) commandObservations.push({
          mode: "preflight", phase: `control-${commandObservations.length + 1}-${expectedState}`, state: retain(result),
        });
        return matched;
      }, "local-preflight-result");
    }
    await sendControl();
    await until(() => fixture.getReceiverArrivals(vendor).length === 1, "preflight-held");
    requireFact(fixture.getReceiverArrivals(vendor)[0].response === "held" &&
      fixture.releaseFirstResponse(vendor), "preflight-release");
    await controlResult("resolved", 200);
    controls.allowedArrivals = fixture.getReceiverArrivals(vendor).length;
    preflight.state.deny = true;
    await sendControl();
    await controlResult("rejected", null);
    controls.enforcedNewArrivals = fixture.getReceiverArrivals(vendor).length - controls.allowedArrivals;
    preflight.state.deny = false; // Remove ONLY this exact local request's denial.
    await sendControl();
    await controlResult("resolved", 200);
    controls.bypassNewArrivals = fixture.getReceiverArrivals(vendor).length - controls.allowedArrivals;
    requireFact(controls.allowedArrivals === 1 && controls.enforcedNewArrivals === 0 &&
      controls.bypassNewArrivals === 1 && preflight.state.measurements === 3, "receiving-controls");
    requireFact(preflight.state.documents === 1 && !preflight.state.worker &&
      !workers.some((worker) => worker.mode === "preflight") &&
      requests.filter((row) => row.mode === "preflight").every((row) =>
        row.kind === "document" || row.kind === "measurement"), "preflight-product-activity");
    assertForegroundReceipts(vendor, fixture.getReceiverArrivals(vendor).slice(0, 1), [200]);
    const bypass = fixture.getReceiverArrivals(vendor)[1];
    assertForegroundReceipts(vendor, [bypass], [200]);
    await closePhase(preflightFixture, preflight);

    if (operationPacket) {
      await operationCases(browser);
      productChecked = true;
    } else {
    const productFixture = await startFixture();
    const product = await pageFor(browser, productFixture.value, "product");
    await negatives(product, productFixture.value);
    controls.governedZeroArrivals = true;
    await beginPositive(product);
    await held(product, productFixture.value);
    controls.responseBarrier = true;
    requireFact(productFixture.value.releaseFirstResponse(vendor), "product-release");
    await until(async () =>
      (await product.page.evaluate(() => window.getJourneyState())).phase === "page-transport-settled",
    "product-settled", 7000);
    const finished = retain(await bounded(() => product.page.evaluate(() => window.finishJourney()), "finish-journey"));
    commandObservations.push({ mode: "product", phase: "finished", state: finished });
    requireFact(finished.phase === "completed-page-checks" && finished.failure === null &&
      finished.captureAndTransport?.phase === "disposed" && finished.disposal !== "UNKNOWN" &&
      finished.captureAndTransport.outcomes.length === 5 &&
      finished.captureAndTransport.outcomes.slice(3).every((outcome, index) =>
        outcome.seq === index + 4 && outcome.disposition === "transport-settled" && outcome.status === 200),
    "product-command-results");
    assertForegroundReceipts(vendor, productFixture.value.getReceiverArrivals(vendor));
    requireFact(productFixture.value.getReceiverArrivals(vendor === "meta" ? "google" : "meta").length === 0,
      "foreign-vendor-arrival");
    await closePhase(productFixture, product);
    productChecked = true;

    const failedFixture = await startFixture();
    const failed = await pageFor(browser, failedFixture.value, "failure");
    await negatives(failed, failedFixture.value);
    await beginPositive(failed);
    await held(failed, failedFixture.value);
    requireFact(failedFixture.value.failFirstResponse(vendor), "error-control-release");
    await until(async () => (await failed.page.evaluate(() => window.getJourneyState())).phase === "failed",
      "error-control-failed", 7000);
    const rejected = retain(await bounded(() => failed.page.evaluate(() => window.getJourneyState()), "error-control-state"));
    commandObservations.push({ mode: "failure", phase: "finished", state: rejected });
    requireFact(rejected.failure === "positive-controls-failed" && rejected.fullCompatibility === false &&
      rejected.overall === "INCONCLUSIVE" && rejected.disposal !== "UNKNOWN" &&
      rejected.captureAndTransport?.outcomes.some((outcome) =>
        outcome.seq === 4 && outcome.disposition === "failed" && outcome.status === 503) &&
      rejected.captureAndTransport.outcomes.every((outcome) =>
        outcome.disposition !== "transport-settled" && !(outcome.status >= 200 && outcome.status < 300)),
    "error-control-false-success");
    assertForegroundReceipts(vendor, failedFixture.value.getReceiverArrivals(vendor), [503]);
    controls.held503FailedWithout2xx = true;
    await closePhase(failedFixture, failed);
    requireFact(workers.length === 2 && workers.every((worker) => worker.closed), "worker-disposition");
    }
  } catch (error) { fail(error.message); }
  finally {
    stopping = true;
    // Independent attempts: a failed context/browser close cannot skip a fixture or the process.
    for (const kind of ["context", "browser", "server", "fixture"]) {
      for (const entry of entries.filter((entry) => entry.kind === kind)) await closeEntry(entry);
    }
    const pending = entries.filter((entry) => !entry.settled);
    if (pending.length) {
      try {
        await bounded(() => Promise.allSettled(pending.map((entry) => entry.promise)),
          "pending-acquisitions", Math.max(1, end - performance.now() - 3000), true, end - 3000);
      } catch { fail("unsettled-acquisition"); }
      for (const entry of entries) await closeEntry(entry);
    }
    if (processFacts) {
      const { child } = processFacts;
      if (child.exitCode === null && child.signalCode === null) {
        fail("normal-browser-close-not-observed");
        processFacts.killed = true;
        try { child.kill("SIGKILL"); } catch { fail("owned-process-kill-failed"); }
      }
      try {
        await until(() => processFacts.close !== null && processFacts.exit !== null, "owned-process-close", 1500, true);
      } catch { fail("owned-process-disposition"); }
      const serverEntry = entries.find((entry) => entry.kind === "server");
      if (serverEntry?.closeOperation && !serverEntry.closed) try {
        await bounded(() => serverEntry.closeOperation, "server-close-settlement", 1500, true);
      } catch { fail("server-close-unsettled"); }
      try {
        await bounded(async () => {
          requireFact(processFacts.profile, "profile-identity-unknown");
          try {
            await lstat(processFacts.profile);
            throw new Error("profile-still-present");
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
            cleanup.profileAbsent = true;
          }
        }, "profile-absence", 1000, true);
      } catch { fail("profile-disposition"); }
      cleanup.processExit = processFacts.exit;
      cleanup.processClose = processFacts.close;
      cleanup.serverCloseEvent = processFacts.serverEvent;
      cleanup.serverCloseResolved = entries.find((entry) => entry.kind === "server")?.closed === true;
      cleanup.normalNonsignalExit = !processFacts.killed && processFacts.exit?.code === 0 &&
        processFacts.exit?.signal === null && processFacts.close?.code === 0 && processFacts.close?.signal === null;
      if (!cleanup.normalNonsignalExit || !cleanup.serverCloseEvent || !cleanup.serverCloseResolved) fail("browser-cleanup-unknown");
    } else fail("browser-ownership-unknown");
  }
  if (interruption.signal.aborted) fail("owner-interrupted");
  if (entries.some((entry) => !entry.settled || !entry.closed)) fail("acquisition-or-cleanup-unknown");
  if (performance.now() >= end) fail("original-interval-expired");
  const receiverCounts = {};
  const receiverDocuments = {};
  for (const [mode, fixture] of receiverFixtures) try {
    receiverDocuments[mode] = retain(mode === "preflight" || !operationPacket
      ? fixture.getReceiverArrivals(vendor) : fixture.getOperationReceipts());
    receiverCounts[mode] = receiverDocuments[mode].length;
  } catch { fail("receiver-final-observation"); }
  const expectedPhases = operationPacket ? 8 : 3;
  const passed = productChecked && (operationPacket ? controls.browserOperationCases : controls.held503FailedWithout2xx) &&
    errors.length === 0 && cleanup.profileAbsent && cleanup.normalNonsignalExit && cleanup.contexts.length === expectedPhases &&
    cleanup.fixtures.length === expectedPhases && cleanup.contexts.every(Boolean) && cleanup.fixtures.every(Boolean);
  const report = {
    vendor, normalJourneyChecks: passed ? "PASS" : "FAILED", overall: "INCONCLUSIVE",
    fullCompatibility: false, interruptionLossQualification: false,
    transportScope: operationPacket ? "Synthetic local browser operations only; opaque HTTP outcome and hidden hops remain unknown." :
      "Local explicitly empty HTTP200 only; HTTP204 remains unqualified.",
    browserVersion, workerURLPath: workerPath(vendor), sourceHashes, controls,
    receiptSource: "Independent local HTTP receiver, never controller JSON or host dispatch counters.",
    nativeGaps: vendor === "google" ? {
      historicalRows: 12, historicalNames: 62, primaryNames: 39, localMappings: 5, missingPrimaryNames: 34,
      responseLinkedBranch: operationPacket ? "experimental-browser-only-not-product-parity" : "unimplemented",
    } : { localMappings: 8, historicalFields: 20 },
    counts: {
      observedRequests, measurementAttempts, retainedBytes,
      productArrivals: receiverCounts.product ?? null, workerEvents: workers.length,
      deniedLocalRequests: requests.filter((row) => row.denied).length,
      verifiedResponseBodies: requests.filter((row) =>
        operationPacket ? row.bodyVerified === true : row.bodyChecked).length,
      receiverArrivals: receiverCounts,
    },
    cleanup: { ...cleanup, workersClosed: workers.every((worker) => worker.closed),
      disposition: passed ? "normal-owned-cleanup-observed" : "UNKNOWN-or-failed-see-errors" },
    elapsedMs: Math.ceil(performance.now() - start), errors,
    privateOwnership: {
      pid: processFacts?.pid || null, profile: processFacts?.profile || null,
      pendingAcquisitions: entries.filter((entry) => !entry.settled).map((entry) => entry.kind),
      instruction: "Owner supervises this exact test browser only; agent-loss cleanup is UNKNOWN. No process scans or profile deletion.",
    },
    privateEvidence: { receiverDocuments, commandObservations, requests, workers },
  };
  // Stream each completed vendor record before starting the next interval.
  // The final footer makes this ONE ordinary JSON document, not NDJSON.
  if (IS_MAIN) {
    try {
      await bounded(() => writeOutput(`${publishedVendors++ ? "," : ""}${JSON.stringify(report)}`),
        "vendor-publication", Math.max(1, end - performance.now()), true);
      const acknowledgedAt = performance.now();
      publicationReceipts.push({ vendor, stdoutCallbackElapsedMs: Math.ceil(acknowledgedAt - start),
        withinOriginalInterval: acknowledgedAt < end });
      requireFact(acknowledgedAt < end, "output-publication-expired");
    } catch { fail("output-publication-unknown"); report.normalJourneyChecks = "FAILED"; }
  }
  return report;
}

/** Fixed owner-supervised foreground procedure. Importing this module never launches. */
export async function runLocalBrowserForeground() {
  requireFact(arguments.length === 0, "fixed-foreground-no-options");
  const interruption = new AbortController();
  const onSignal = () => interruption.abort();
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const vendors = [];
  const ownedProfiles = new Set();
  try {
    for (const vendor of ["meta", "google"]) {
      vendors.push(await runVendor(vendor, interruption, ownedProfiles));
      if (vendors.at(-1).normalJourneyChecks !== "PASS") break;
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  return {
    procedure: "fixed-headed-local-Meta-then-Google", overall: "INCONCLUSIVE",
    fullCompatibility: false, interruptionLossQualification: false, limits: LIMITS,
    transportScope: "Local explicitly empty HTTP200 only; HTTP204 remains unqualified.",
    guardScope: "Exact local HTTP Fetch/module graph only; unchanged legacy Seatbelt loopback source, NOT native/public-IP full-guard proof.",
    externalWholeCLICompletion: "Parent must observe actual command exit afterwards; this producer cannot report future exit.",
    publicationReceipts,
    normalJourneyChecks: vendors.length === 2 && vendors.every((vendor) => vendor.normalJourneyChecks === "PASS") ? "PASS" : "FAILED",
    vendors,
  };
}

/** Separate fixed packet through the same owned launcher, guards and cleanup. */
export async function runGoogleBrowserOperationsForeground() {
  requireFact(arguments.length === 0, "fixed-operation-no-options");
  const interruption = new AbortController();
  const onSignal = () => interruption.abort();
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  let result;
  try { result = await runVendor("google", interruption, new Set(), true); }
  finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  return {
    procedure: "fixed-headed-local-Google-browser-operations", overall: "INCONCLUSIVE", fullCompatibility: false,
    interruptionLossQualification: false, limits: OPERATION_LIMITS,
    guardScope: "Fixed loopback experiment; CSP constrains origins, not hidden redirect paths or hops.",
    externalWholeCLICompletion: "Parent must observe actual command exit afterwards.",
    publicationReceipts, normalJourneyChecks: result.normalJourneyChecks, vendors: [result],
  };
}

if (IS_MAIN) {
  const operationPacket = process.argv.length === 3 && process.argv[2] === "--google-browser-operations";
  if (process.argv.length !== 2 && !operationPacket) {
    console.error("fixed-foreground-no-options");
    process.exitCode = 1;
  } else {
    await writeOutput('{"vendors":[');
    const report = operationPacket ? await runGoogleBrowserOperationsForeground() : await runLocalBrowserForeground();
    const { vendors: _vendors, ...footer } = report;
    try {
      await writeOutput(`],${JSON.stringify(footer).slice(1)}\n`, publicationDeadline);
      process.exitCode = report.normalJourneyChecks === "PASS" ? 0 : 1;
    } catch {
      console.error("output-publication-unknown");
      process.exitCode = 1;
    }
  }
}
