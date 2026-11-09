import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Enumerated from the actual two adapters and their module-worker imports.
// No filesystem discovery or general static root is used.
const SOURCE_PATHS = [
  "/rig/local-browser-journeys-meta.js",
  "/rig/local-browser-journeys-google.js",
  "/adapters/meta-pixel-prototype.js",
  "/adapters/google-ads-prototype.js",
  "/connectors/meta-pixel/pageview-prototype.worker.js",
  "/connectors/meta-pixel/pageview-prototype.js",
  "/connectors/meta-pixel/pageview-data.js",
  "/connectors/meta-pixel/event-options.js",
  "/connectors/meta-pixel/synthetic-identity.js",
  "/connectors/meta-pixel/agent-options.js",
  "/connectors/pixel/advanced-matching.js",
  "/connectors/pixel/vendors/meta.js",
  "/connectors/google-ads/conversion-prototype.worker.js",
  "/connectors/google-ads/conversion-prototype.js",
  "/connectors/google-ads/manual-response.js",
  "/connectors/google-ads/destination-selectors.js",
  "/connectors/google-ads/consent-commands.js",
  "/connectors/google-ads/bootstrap-command.js",
  "/connectors/google-ads/purchase-cart-items.js",
  "/connectors/google-ads/remarketing-control.js",
  "/connectors/google-ads/view-items.js",
  "/core/confine-pixel-chamber.js",
  "/core/egress-confinement.js",
  "/core/connector-host.js",
  "/core/wrapped-sdk-host.js",
  "/core/endpoint-ceiling.js",
  "/core/config-integrity.js",
  "/core/consent.js",
  "/core/payload-governance.js",
  "/core/cookie-scope.js",
];
const CSP = "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": CSP,
  "referrer-policy": "no-referrer",
};
const EMPTY_HEADERS = {
  ...HEADERS, connection: "close",
  "content-type": "text/plain; charset=utf-8", "content-length": "0",
};
const LIMITS = Object.freeze({
  observedRequests: 64, measurementAttempts: 8, urlBytes: 8192, requestBodyBytes: 65536,
  headerBytes: 65536, headerCount: 64, responseBytes: 2097152, retainedBytes: 8388608,
  sockets: 64, responseHoldMs: 2000, cleanupMs: 2000, lifetimeMs: 60000,
});

function page(vendor) {
  return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>First-party ${vendor} source fixture</title></head>
<body><h1>SDK-free ${vendor} local fixture</h1>
<p>Source preparation only. Independent worker, receiver and cleanup evidence is required.</p>
<pre id="journey-state" role="status">Not started. No browser qualification is granted.</pre>
<script type="module" src="/rig/local-browser-journeys-${vendor}.js"></script></body></html>`);
}

function syntheticFields(vendor, query) {
  const fields = new URLSearchParams(query);
  if (fields.toString() !== query) return null;
  const allowed = vendor === "meta" ? {
    id: ["000000000000000"], ev: ["PageView"],
    dl: ["https://example.test/meta-a", "https://example.test/meta-b#second"],
    rl: [""], if: ["false"], sw: ["412"], sh: ["823"], tz: ["-420"],
  } : {
    label: ["SYNTHETIC_LABEL"], value: ["28.75", "0"], currency_code: ["CAD", ""],
    oid: ["synthetic-a", "synthetic-b"],
    url: ["https://example.test/google-a", "https://example.test/google-b#second"],
  };
  const names = [...fields.keys()];
  const expected = Object.keys(allowed).filter((name) => vendor === "meta" || fields.has(name));
  if (vendor === "google" && (!fields.has("label") || !fields.has("url"))) return null;
  if (names.length !== expected.length || names.some((name, index) =>
    name !== expected[index] || !allowed[name]?.includes(fields.get(name)))) return null;
  return [...fields];
}

  const GOOGLE_OPERATION_CASES = Object.freeze([
    "readable", "opaque", "unreadable-primary", "csp-negative", "redirect-307", "revoke", "lifecycle",
  ]);

  /** Fixed synthetic receiver packet. It never acquires a browser. */
  export async function startGoogleBrowserOperationFixture(caseName) {
    if (arguments.length !== 1 || !GOOGLE_OPERATION_CASES.includes(caseName)) throw new Error("fixed-operation-case-required");
    const started = performance.now();
    const limits = Object.freeze({
      observedRequests: 256, measurementAttempts: 24, urlBytes: 8192, requestBodyBytes: 65536,
      headerBytes: 65536, headerCount: 64, responseBytes: 2097152, retainedBytes: 8388608,
      sockets: 64, responseHoldMs: 3000, cleanupMs: 2000, lifetimeMs: 120000,
    });
    const paths = [...SOURCE_PATHS, "/adapters/google-browser-operation-realm.js"];
    const sources = new Map(await Promise.all(paths.map(async (path) => [path, await readFile(new URL(`..${path}`, import.meta.url))])));
    const framePath = "/rig/google-browser-operation-frame.html";
    const frameBytes = await readFile(new URL(`..${framePath}`, import.meta.url));
    const original = JSON.parse(await readFile(new URL("./fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
    const { owned, entries } = original;
    const secondaryQuery = new URL(entries[1].request.url).search;
    const receipts = [];
    const sockets = new Set();
    const held = new Map();
    const errors = [];
    const servers = [];
    let observedRequests = 0;
    let measurementAttempts = 0;
    let retainedBytes = [...sources.values(), frameBytes].reduce((sum, value) => sum + value.length, 0);
    let closed = false;
    let closing;
    let lifetime;
    let origins;
    let pageBody;
    const preflight = Buffer.from("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Local transport control</title></head><body></body></html>");
    const recordError = (reason) => { if (!errors.includes(reason) && errors.length < 8) errors.push(reason); };
    const state = () => ({
      qualification: "source-and-Node-HTTP-only", overall: "INCONCLUSIVE", fullCompatibility: false, caseName,
      observedRequests, measurementAttempts, retainedBytes, listening: servers.some((server) => server.listening),
      openSockets: sockets.size, pendingResponses: held.size, closure: closed ? "closed" : "open", errors: [...errors],
      refusedRequests: errors.length, overLimitRequests: errors.includes("request-limit") ? 1 : 0,
    });
    function policy() {
      return "default-src 'none'; script-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; " +
        `connect-src ${origins[0]} ${origins[1]}`;
    }
    function headers(extra = {}) {
      return { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
        connection: "close", ...extra };
    }
    function finish(response, status, body = Buffer.alloc(0), extra = {}) {
      response.writeHead(status, headers({ "content-length": String(body.length), ...extra })).end(body);
    }
    function release(stage, status = 200) {
      const entry = held.get(stage);
      if (!entry) return false;
      held.delete(stage);
      clearTimeout(entry.timer);
      entry.row.status = status;
      entry.row.respondedAt = Date.now();
      finish(entry.response, status, Buffer.alloc(0),
        entry.row.origin !== origins[0] && caseName !== "opaque" ? { "access-control-allow-origin": origins[0] } : {});
      return true;
    }
    function hold(stage, response, row) {
      if (held.has(stage)) throw new Error("duplicate-held-response");
      const timer = setTimeout(() => release(stage, 504), limits.responseHoldMs);
      held.set(stage, { response, row, timer });
      response.once("close", () => {
        if (held.get(stage)?.response === response) { clearTimeout(timer); held.delete(stage); }
        if (!response.writableFinished) row.response = "aborted";
      });
    }
    function handler(index, request, response) {
      try {
        if (++observedRequests > limits.observedRequests) throw new Error("request-limit");
        if (!origins || request.headers.host !== new URL(origins[index]).host ||
            Buffer.byteLength(request.url) > limits.urlBytes || request.rawHeaders.length > limits.headerCount * 2 ||
            Buffer.byteLength(request.rawHeaders.join("\r\n")) > limits.headerBytes ||
            request.headers["transfer-encoding"] !== undefined ||
            (request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0")) {
          throw new Error("request-invalid");
        }
        const url = new URL(request.url, origins[index]);
        if (index === 0 && request.method === "GET") {
          if (request.url === "/preflight") return finish(response, 200, preflight, {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": `default-src 'none'; connect-src ${origins.join(" ")}; script-src 'none'`,
          });
          if (request.url === "/google-browser-operation") return finish(response, 200, pageBody, {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": `default-src 'none'; script-src 'self'; worker-src 'self'; frame-src ${origins[0]}${framePath}; connect-src ${origins.join(" ")}; object-src 'none'; base-uri 'none'; form-action 'none'`,
          });
          if (request.url === framePath) return finish(response, 200, frameBytes, {
            "content-type": "text/html; charset=utf-8", "content-security-policy": policy(),
          });
          const source = sources.get(request.url);
          if (source) return finish(response, 200, source, { "content-type": "text/javascript; charset=utf-8" });
        }
        const primaryOrigin = caseName === "unreadable-primary" ? origins[1] : origins[0];
        const primaryPath = `/pagead/conversion/${owned.conversion_id.slice(3)}/`;
        const secondaryPath = `/pagead/viewthroughconversion/${owned.conversion_id.slice(3)}/`;
        const expected = new URLSearchParams({
          label: owned.conversion_label, value: String(owned.value), currency_code: owned.currency,
          oid: owned.transaction_id, url: owned.document_url,
        }).toString();
        const stage = index === 2 && url.pathname === "/reachability" && request.method === "GET" ? "reachability" :
          origins[index] === primaryOrigin && url.pathname === primaryPath && url.search === `?${expected}` && request.method === "GET" ? "primary" :
            index === 1 && url.pathname === secondaryPath && url.search === secondaryQuery && request.method === "POST" ? "secondary" :
              index === 1 && url.pathname === "/operation-intermediate" && request.method === "POST" && caseName === "redirect-307" ? "intermediate" :
                ((index === 1 && url.pathname === "/operation-unexpected-path") ||
                 (index === 2 && url.pathname === "/operation-csp-denied") ||
                 (index === 1 && url.pathname === "/operation-final")) && request.method === "GET" ? "final" : null;
        if (!stage || ++measurementAttempts > limits.measurementAttempts) throw new Error("measurement-invalid");
        const row = { stage, origin: origins[index], path: url.pathname, method: request.method, status: null,
          arrivedAt: Date.now(), respondedAt: null, response: "pending" };
        retainedBytes += Buffer.byteLength(JSON.stringify(row)) + 256;
        if (retainedBytes > limits.retainedBytes) throw new Error("retention-limit");
        receipts.push(row);
        response.once("finish", () => { row.response = "finished"; });
        if (stage === "reachability") {
          row.status = 200; row.respondedAt = Date.now();
          return finish(response, 200, Buffer.alloc(0), { "access-control-allow-origin": origins[0] });
        }
        if (stage === "primary") {
          if (caseName === "lifecycle") return hold("primary", response, row);
          const body = Buffer.from(entries[0].response.body);
          row.status = 200; row.respondedAt = Date.now();
          return finish(response, 200, body, { "content-type": "application/json" });
        }
        if (stage === "secondary") {
          if (caseName === "opaque") {
            row.status = 200; row.respondedAt = Date.now();
            return finish(response, 200);
          }
          const target = caseName === "csp-negative" ? `${origins[2]}/operation-csp-denied` :
            caseName === "redirect-307" ? `${origins[1]}/operation-intermediate` :
              caseName === "readable" ? `${origins[1]}/operation-unexpected-path` : `${origins[1]}/operation-final`;
          row.status = caseName === "redirect-307" ? 307 : 302; row.respondedAt = Date.now();
          return finish(response, row.status, Buffer.alloc(0), {
            location: target, ...(caseName === "opaque" ? {} : { "access-control-allow-origin": origins[0] }),
          });
        }
        if (stage === "intermediate") {
          row.status = 200; row.respondedAt = Date.now();
          return finish(response, 200, Buffer.alloc(0), { "access-control-allow-origin": origins[0] });
        }
        if (caseName === "readable" || caseName === "revoke") return hold("final", response, row);
        row.status = 200; row.respondedAt = Date.now();
        return finish(response, 200, Buffer.alloc(0),
          index !== 0 && caseName !== "opaque" ? { "access-control-allow-origin": origins[0] } : {});
      } catch (error) {
        recordError(error?.message === "request-limit" ? "request-limit" : "request-invalid");
        if (!response.headersSent) finish(response, 400);
        else response.destroy();
      }
    }
    async function close() {
      if (!closing) closing = (async () => {
        clearTimeout(lifetime);
        for (const { timer, response } of held.values()) { clearTimeout(timer); response.destroy(); }
        held.clear();
        const waits = servers.map((server) => new Promise((resolve) => {
          try { server.close(() => resolve()); server.closeAllConnections(); } catch { resolve(); }
        }));
        const socketWaits = [...sockets].map((socket) => new Promise((resolve) => {
          if (socket.closed) { sockets.delete(socket); resolve(); return; }
          socket.once("close", resolve);
          socket.destroy();
        }));
        let timer;
        await Promise.race([Promise.all([...waits, ...socketWaits]), new Promise((resolve) => {
          timer = setTimeout(() => { recordError("cleanup-deadline"); resolve(); }, limits.cleanupMs);
        })]);
        clearTimeout(timer);
        closed = !servers.some((server) => server.listening) && sockets.size === 0 && errors.length === 0;
        return state();
      })();
      return closing;
    }
    try {
      for (let index = 0; index < 3; index += 1) {
        const server = createServer({ maxHeaderSize: limits.headerBytes, headersTimeout: 2000, requestTimeout: 2000 },
          (request, response) => handler(index, request, response));
        servers.push(server);
        server.maxConnections = limits.sockets;
        server.on("connection", (socket) => {
          sockets.add(socket);
          socket.once("close", () => sockets.delete(socket));
          socket.on("error", () => {});
          if (sockets.size > limits.sockets || closing) socket.destroy();
        });
        server.on("error", () => recordError("server-error"));
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("listen-deadline")), 2000);
          server.once("error", reject);
          server.listen(0, "127.0.0.1", () => { clearTimeout(timer); resolve(); });
        });
      }
      origins = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
      const data = [
        `data-case="${caseName}"`, `data-primary="${caseName === "unreadable-primary" ? origins[1] : origins[0]}"`,
        `data-secondary="${origins[1]}"`, `data-recipients="${origins[0]} ${origins[1]}"`,
        `data-denied="${origins[2]}"`,
      ].join(" ");
      pageBody = Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Google browser-operation fixture</title></head><body ${data}><pre id="journey-state"></pre><script type="module" src="/rig/local-browser-journeys-google.js"></script></body></html>`);
      retainedBytes += pageBody.length + preflight.length;
      if (retainedBytes > limits.retainedBytes) throw new Error("retention-limit");
      lifetime = setTimeout(() => { void close(); }, Math.max(0, limits.lifetimeMs - limits.cleanupMs - (performance.now() - started)));
      const digest = (path, body) => Object.freeze({ path, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") });
      return {
        origin: origins[0], origins: [...origins], caseName, limits,
        operationPaths: Object.freeze({ primary: `/pagead/conversion/${owned.conversion_id.slice(3)}/?${new URLSearchParams({
          label: owned.conversion_label, value: String(owned.value), currency_code: owned.currency,
          oid: owned.transaction_id, url: owned.document_url,
        })}`, secondary: `/pagead/viewthroughconversion/${owned.conversion_id.slice(3)}/${secondaryQuery}` }),
        sourceManifest: Object.freeze([...sources].map(([path, body]) => digest(path, body))),
        pageManifest: Object.freeze([digest("/preflight", preflight), digest("/google-browser-operation", pageBody), digest(framePath, frameBytes)]),
        getOperationReceipts: () => structuredClone(receipts),
        releaseResponse: (stage) => release(stage),
        framePolicy: policy(), getState: state, close,
      };
    } catch (error) { await close(); throw error; }
  }

/** Source/local-HTTP preparation only; never acquires a browser. */
export async function startLocalBrowserJourneys() {
  if (arguments.length) throw new Error("fixed-fixture-no-options");
  const startedAt = performance.now();
  const sources = new Map(await Promise.all(SOURCE_PATHS.map(async (path) => [
    path, await readFile(new URL(`..${path}`, import.meta.url)),
  ])));
  const pages = new Map([
    ["/preflight", Buffer.from("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Local transport control</title></head><body></body></html>")],
    ["/meta", page("meta")], ["/google", page("google")],
  ]);
  const bytes = [...sources.values(), ...pages.values()];
  let retainedBytes = bytes.reduce((total, buffer) => total + buffer.length, 0);
  if (bytes.some((buffer) => buffer.length > LIMITS.responseBytes) || retainedBytes > LIMITS.retainedBytes) {
    throw new Error("fixed-source-byte-limit");
  }
  const arrivals = { meta: [], google: [] };
  const held = new Map();
  const sockets = new Set();
  const errors = [];
  let refusedRequests = 0;
  let observedRequests = 0;
  let measurementAttempts = 0;
  let overLimitRequests = 0;
  let closing;
  let lifetime;
  let closure = "open";
  const recordError = (code) => { if (errors.length < 8 && !errors.includes(code)) errors.push(code); };
  function getState() {
    return {
      qualification: "source-and-Node-HTTP-only", overall: "INCONCLUSIVE", fullCompatibility: false,
      measurementAttempts, refusedRequests, observedRequests, overLimitRequests, retainedBytes,
      listening: server.listening, openSockets: sockets.size, pendingResponses: held.size,
      closure, errors: [...errors],
    };
  }
  function vendorName(vendor) {
    if (vendor !== "meta" && vendor !== "google") throw new Error("fixed-vendor-required");
    return vendor;
  }
  function release(vendor, status) {
    vendorName(vendor);
    const entry = held.get(vendor);
    if (!entry) return false;
    held.delete(vendor);
    clearTimeout(entry.timer);
    entry.row.status = status;
    entry.row.respondedAt = Date.now();
    entry.row.response = "sent";
    entry.response.writeHead(status, EMPTY_HEADERS).end();
    return true;
  }
  const server = createServer({
    maxHeaderSize: LIMITS.headerBytes, headersTimeout: 2000, requestTimeout: 2000,
    connectionsCheckingInterval: 100,
  }, (request, response) => {
    function refuse(status) {
      refusedRequests = Math.min(refusedRequests + 1, 65);
      response.writeHead(status, { ...HEADERS, connection: "close" }).end();
    }
    if (observedRequests >= LIMITS.observedRequests) {
      overLimitRequests = Math.min(overLimitRequests + 1, LIMITS.observedRequests);
      return refuse(429);
    }
    observedRequests += 1;
    const host = `127.0.0.1:${server.address().port}`;
    if (Buffer.byteLength(request.url) > LIMITS.urlBytes) return refuse(414);
    if (request.rawHeaders.length > LIMITS.headerCount * 2 ||
        Buffer.byteLength(request.rawHeaders.join("\r\n")) > LIMITS.headerBytes) return refuse(431);
    if (request.method !== "GET") return refuse(405);
    if (request.headers.host !== host ||
        (request.headers.origin !== undefined && request.headers.origin !== `http://${host}`)) return refuse(400);
    if (Number(request.headers["content-length"]) > LIMITS.requestBodyBytes) return refuse(413);
    if (request.headers["transfer-encoding"] !== undefined ||
        (request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0")) return refuse(400);
    const [path, query] = request.url.split("?");
    const vendor = path === "/tr/" ? "meta" : path === "/pagead/conversion/0000000000/" ? "google" : null;
    if (request.method === "GET" && vendor && query) {
      if (measurementAttempts >= LIMITS.measurementAttempts) return refuse(429);
      measurementAttempts += 1;
      const fields = request.url.split("?").length === 2 && syntheticFields(vendor, query);
      if (!fields) return refuse(400);
      const row = {
        ordinal: arrivals.meta.length + arrivals.google.length + 1,
        method: request.method, path, query, fields,
        rawFields: query.split("&").map((field) => field.split("=")),
        arrivedAt: Date.now(), respondedAt: null, status: null, response: "held",
      };
      // Reserve bounded space for subsequent response status/time/disposition.
      const rowBytes = Buffer.byteLength(JSON.stringify(row)) + 256;
      if (retainedBytes + rowBytes > LIMITS.retainedBytes) return refuse(507);
      retainedBytes += rowBytes;
      arrivals[vendor].push(row);
      response.once("finish", () => { row.response = "finished"; });
      response.once("close", () => {
        if (!response.writableFinished) row.response = "aborted";
        const entry = held.get(vendor);
        if (entry?.row === row) {
          clearTimeout(entry.timer);
          held.delete(vendor);
        }
      });
      if (arrivals[vendor].length === 1) {
        held.set(vendor, {
          row, response, timer: setTimeout(() => release(vendor, 504), LIMITS.responseHoldMs),
        });
      } else {
        row.status = 200;
        row.respondedAt = Date.now();
        response.writeHead(200, EMPTY_HEADERS).end();
      }
      return;
    }
    const body = pages.get(request.url) || sources.get(request.url);
    if (!body) return refuse(404);
    response.writeHead(200, {
      ...HEADERS,
      connection: "close",
      "content-type": pages.has(request.url) ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
    }).end(body);
  });
  server.maxConnections = LIMITS.sockets;
  server.setTimeout(4000, (socket) => socket.destroy());
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => {}); // Socket/parser failures retain no raw input.
    if (closure !== "open") socket.destroy();
  });
  server.on("error", () => {
    recordError("server-error");
    void close();
  });
  server.on("clientError", (error, socket) => {
    refusedRequests = Math.min(refusedRequests + 1, 65);
    const status = error.code === "HPE_HEADER_OVERFLOW" ? "431 Request Header Fields Too Large" : "400 Bad Request";
    if (socket.writable) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: ${CSP}\r\n\r\n`);
    else socket.destroy();
  });
  function close() {
    if (!closing) closing = (async () => {
      closure = "closing";
      clearTimeout(lifetime);
      for (const { timer } of held.values()) clearTimeout(timer);
      held.clear();
      const socketCloses = [...sockets].map((socket) => new Promise((resolve) => socket.once("close", resolve)));
      const serverClosed = new Promise((resolve) => {
        try {
          server.close((error) => {
            if (error && error.code !== "ERR_SERVER_NOT_RUNNING") recordError("server-close-failed");
            resolve();
          });
        } catch { recordError("server-close-failed"); resolve(); }
      });
      try { server.closeAllConnections(); } catch { recordError("server-connections-close-failed"); }
      for (const socket of sockets) {
        try { socket.destroy(); } catch { recordError("socket-close-failed"); }
      }
      let timer;
      try {
        await Promise.race([
          Promise.all([serverClosed, ...socketCloses]),
          new Promise((resolve) => { timer = setTimeout(() => { recordError("cleanup-deadline"); resolve(); }, LIMITS.cleanupMs); }),
        ]);
      } finally { clearTimeout(timer); }
      closure = !server.listening && sockets.size === 0 && errors.length === 0 ? "closed" : "UNKNOWN";
      return getState();
    })();
    return closing;
  }
  let listenTimer;
  try {
    await new Promise((resolve, reject) => {
      listenTimer = setTimeout(() => reject(new Error("loopback-listen-deadline")), 2000);
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch {
    await close();
    throw new Error("fixed-loopback-listen-failed");
  } finally { clearTimeout(listenTimer); }
  // Reserve cleanup inside the original helper lifetime, not after it.
  lifetime = setTimeout(() => { void close(); }, Math.max(
    0, LIMITS.lifetimeMs - LIMITS.cleanupMs - (performance.now() - startedAt),
  ));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    limits: LIMITS,
    sourceManifest: Object.freeze([...sources].map(([path, bytes]) => Object.freeze({
      path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    }))),
    pageManifest: Object.freeze([...pages].map(([path, bytes]) => Object.freeze({
      path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    }))),
    getReceiverArrivals: (vendor) => structuredClone(arrivals[vendorName(vendor)]),
    releaseFirstResponse: (vendor) => release(vendor, 200),
    failFirstResponse: (vendor) => release(vendor, 503),
    getState, close,
  };
}
