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
