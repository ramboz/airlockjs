import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, writeSync, fsyncSync,
  mkdirSync, readFileSync, unlinkSync, chmodSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createSecureServer, constants as h2constants } from "node:http2";
import { connect } from "node:net";
import { release } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LIMITS, createNativeStockPolicy } from "./native-stock-policy.mjs";
import { elideProxyAuthorization, headerBytes } from "./native-stock-egress.mjs";

const AUTHORITY = "www.facebook.com:443", ORIGIN = "https://www.facebook.com";
const PIXEL = "999000000000001";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const HASH = bytes => createHash("sha256").update(bytes).digest("hex");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = category => { throw new Error(category); };
const SOURCE_FILES = ["native-stock-capture.mjs", "native-stock-meta.mjs", "native-stock-egress.mjs",
  "native-stock-capture.test.mjs", "native-stock-meta.test.mjs", "native-stock-egress.test.mjs",
  "native-stock-policy.mjs", "native-stock-policy.test.mjs",
  "meta-additional-authority.mjs", "meta-additional-authority.test.mjs",
  "inspected-meta-record.mjs", "inspected-meta-record.test.mjs",
  "meta-additional-qualification.mjs", "meta-additional-qualification.test.mjs",
  "meta-additional-supervision.mjs", "meta-additional-supervision.test.mjs",
  "meta-rendezvous-peer.mjs", "meta-rendezvous-peer.test.mjs",
  "inspected-meta-stock.mjs", "inspected-meta-stock.test.mjs", "inspected-transport.mjs",
  "inspected-http-wire.mjs", "inspected-http-wire.test.mjs",
  "inspected-meta-policy.mjs", "inspected-meta-policy.test.mjs",
  "inspected-header-block.mjs", "inspected-header-block.test.mjs",
  "reference-inspection.mjs", "reference-inspection.test.mjs",
  "qualification-loopback-chrome", "qualification-loopback-network.sb", "../package.json", "../package-lock.json"];

export function metaSourcePins() {
  const require = createRequire(import.meta.url);
  return { ...Object.fromEntries(SOURCE_FILES.map(name => [name, HASH(readFileSync(new URL(name, import.meta.url)))])),
    playwright_entry: HASH(readFileSync(new URL(import.meta.resolve("playwright")))),
    playwright_version: require("playwright/package.json").version };
}
function syncDir(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function ancestors(path) {
  for (let current = dirname(path);;) {
    const s = lstatSync(current);
    if (!s.isDirectory() || s.isSymbolicLink()) fail("unsafe_private_path");
    if (current === parse(current).root) break;
    current = dirname(current);
  }
}
export function readMetaPrivate(path, maximum = 33554432) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 33554432) fail("invalid_private_limit");
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) fail("unsafe_private_path");
  ancestors(path);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.nlink !== 1 || s.uid !== process.getuid() || (s.mode & 0o7777) !== 0o600
      || s.size > maximum) fail("unsafe_private_file");
    const bytes = Buffer.alloc(s.size + 1);
    let offset = 0, n;
    while (offset < bytes.length && (n = readSync(fd, bytes, offset, bytes.length - offset, offset)) > 0) offset += n;
    if (offset !== s.size || offset > maximum) fail("private_file_changed");
    return bytes.subarray(0, offset);
  } finally { closeSync(fd); }
}
export function writeMetaPrivate(path, value) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify(value) + "\n");
    for (let offset = 0; offset < bytes.length;) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!n) fail("output_write_failed"); offset += n;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDir(dirname(path));
}
function outputAt(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) fail("invalid_output_path");
  ancestors(path);
  const parent = lstatSync(dirname(path));
  if (parent.uid !== process.getuid() || (parent.mode & 0o7777) !== 0o700) fail("private_output_parent_required");
  mkdirSync(path, { mode: 0o700 }); syncDir(path); syncDir(dirname(path));
}
function fixedPolicy(documentUrl) {
  // Route metadata only. These SDK resources are NEVER loaded or fulfilled.
  return { schema_version: 1, profile: "meta-pageview", case_name: "meta-stock",
    document_url: documentUrl, owned: { pixel_id: PIXEL }, companion_authorized: false,
    resources: [
      { role: "runtime", url: "https://connect.facebook.net/en_US/fbevents.js",
        sha256: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b" },
      { role: "configuration", url: `https://connect.facebook.net/signals/config/${PIXEL}?v=2.9.0&r=stable&domain=${new URL(documentUrl).hostname}&hme=synthetic&ex_m=one`,
        sha256: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921" },
    ] };
}
function countFixture(documentUrl, count, nonce) {
  const base = ORIGIN + "/tr/?id=" + PIXEL + "&ev=PageView&dl=" + encodeURIComponent(documentUrl);
  return {
    headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" },
      { name: "Content-Security-Policy", value: `default-src 'none'; script-src 'nonce-${nonce}'; img-src ${ORIGIN} data:; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` }],
    bytes: Buffer.from(`<!doctype html><link rel="icon" href="data:,"><title>Fixed synthetic count probe</title>
<script nonce="${nonce}">window.__runSynthetic=async function(){
 const base=${JSON.stringify(base)};
 for(let i=0;i<${count};i++)await new Promise(resolve=>{
  const im=new Image();im.onload=resolve;im.onerror=resolve;im.src=base+"&r="+i;
 });
};</script>`),
  };
}
function originalBody(request) {
  if (!request.hasPostData && !request.postDataEntries?.length) return Buffer.alloc(0);
  if (!Array.isArray(request.postDataEntries) || !request.postDataEntries.length) fail("request_original_unavailable");
  let size = 0;
  for (const entry of request.postDataEntries) {
    if (typeof entry.bytes !== "string" || entry.bytes.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.bytes))
      fail("request_original_unavailable");
    size += entry.bytes.length / 4 * 3 - (entry.bytes.endsWith("==") ? 2 : entry.bytes.endsWith("=") ? 1 : 0);
    if (size > LIMITS.request_bytes) fail("request_byte_limit");
  }
  return Buffer.concat(request.postDataEntries.map(entry => Buffer.from(entry.bytes, "base64")));
}
export function classifyMetaCountProbe(cases) {
  if (!Array.isArray(cases) || cases.length !== 12) return { witnessed: false, errors: ["incomplete_count_matrix"] };
  const find = (protocol, kind) => cases.find(row => row.protocol === protocol && row.kind === kind);
  const valid = row => row && Array.isArray(row.receiver) && Array.isArray(row.admissions)
    && row.pre_reserved_vendor_requests === row.admissions.length
    && row.backend_visible_http_attempts === row.receiver.length && row.guards_removed_after_close === true;
  const normal = ["h1", "h2"].every(protocol => {
    const row = find(protocol, "normal");
    return valid(row) && row.admissions.length === 1 && row.receiver.length === 1 && row.failures.length === 0;
  });
  const duplicated = row => valid(row) && row.fault_triggered && row.fault_on_reused_connection
    && row.receiver.some(hit => row.receiver.filter(other => other.url === hit.url).length
      > row.admissions.filter(admission => admission.url === hit.url).length);
  const faults = [["h1", "reused-close"], ["h1", "ceiling-close"], ["h2", "rst-refused"],
    ["h2", "goaway"], ["h2", "ceiling-rst-refused"]].every(([protocol, kind]) => duplicated(find(protocol, kind)));
  const contained = [["h1", "reused-close-no-replacement"], ["h2", "goaway-no-replacement"]].every(([protocol, kind]) => {
    const row = find(protocol, kind);
    return valid(row) && row.fault_on_reused_connection && row.denied_replacement_connects > 0
      && row.admissions.length === row.receiver.length && row.stop_reason === "transport_failure_inconclusive";
  });
  const ceiling = find("h2", "ceiling-rst-refused");
  const sameTunnel = valid(ceiling) && ceiling.admissions.length === LIMITS.meta_requests
    && ceiling.receiver.length > LIMITS.meta_requests && ceiling.connects === 1
    && ceiling.receiver.some(hit => ceiling.receiver.some(other => other !== hit && other.url === hit.url
      && other.connection_id === hit.connection_id && other.stream_id !== hit.stream_id));
  return { witnessed: normal && faults && contained && sameTunnel,
    errors: normal && faults && contained && sameTunnel ? [] : ["unmatched_count_controls"] };
}

// Closed local diagnostic, not a source executor or a successful native guard.
// Every synthetic Image is a counted measurement; there is no HTTP warmup.
export async function runMetaCountQualification(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir"
    || typeof Object.getOwnPropertyDescriptor(options, "outputDir")?.value !== "string")
    fail("invalid_count_probe_options");
  options = Object.freeze({ outputDir: options.outputDir });
  const started = performance.now();
  const checkDeadline = () => { if (performance.now() - started >= LIMITS.duration_ms) fail("count_probe_deadline"); };
  if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0") fail("cohort_mismatch");
  const osVersion = await promisify(execFile)("/usr/bin/sw_vers", ["-productVersion"], { timeout: 2000 });
  if (osVersion.stdout.trim() !== "27.0.1") fail("cohort_mismatch");
  outputAt(options.outputDir);
  const keyPath = join(options.outputDir, "key.pem"), certPath = join(options.outputDir, "certificate.pem");
  let key, cert;
  try {
    await promisify(execFile)("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=www.facebook.com",
      "-addext", "subjectAltName=DNS:www.facebook.com"], { timeout: 5000, maxBuffer: 8192 });
    chmodSync(keyPath, 0o600); chmodSync(certPath, 0o600);
    key = readMetaPrivate(keyPath, 16384); cert = readMetaPrivate(certPath, 16384);
  } catch {
    if (existsSync(keyPath)) unlinkSync(keyPath);
    fail("local_certificate_failed");
  }
  const pin = createHash("sha256").update(new X509Certificate(cert).publicKey
    .export({ type: "spki", format: "der" })).digest("base64");
  const sockets = new Set(), sessions = new Set(), contexts = new Set(), tasks = new Set();
  const cases = [], errors = [];
  const username = randomBytes(16).toString("hex"), password = randomBytes(24).toString("hex");
  const authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");
  let proxy, upstream, browser, browserServer, active = null, port = null, expired = false;
  const own = socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket)); return socket;
  };
  const stopSockets = () => {
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
  };
  const kill = () => {
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
  const deadline = async (promise, ms, category) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(category)), ms);
    })]); } finally { clearTimeout(timer); }
  };
  const wait = async (condition, category, ms = 2000) => {
    const until = performance.now() + ms;
    while (!condition()) {
      if (expired || performance.now() >= until) fail(category);
      await sleep(5);
    }
  };
  const listen = server => deadline(new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
  }), 2000, "listen_deadline");
  const closeServer = server => !server?.listening ? Promise.resolve()
    : deadline(new Promise(resolve => server.close(resolve)), 2000, "server_close_deadline");
  const watchdog = setTimeout(() => { expired = true; stopSockets(); kill(); },
    Math.max(1, LIMITS.duration_ms - (performance.now() - started)));
  try {
    const { chromium } = await import("playwright");
    proxy = createServer((_req, res) => res.writeHead(403).end());
    proxy.on("connection", own);
    proxy.on("connect", (req, client, head) => {
      const deny = code => client.end(`HTTP/1.1 ${code} Denied\r\n${code === 407
        ? 'Proxy-Authenticate: Basic realm="fixed-meta-count"\r\n' : ""}Content-Length: 0\r\nConnection: close\r\n\r\n`);
      const row = active;
      if (req.headers["proxy-authorization"] !== authorization) {
        if (row) row.connect_denials.auth++;
        return deny(407);
      }
      if (req.url !== AUTHORITY || head.length || !row || row.stopped || !port) {
        if (row) row.connect_denials[req.url !== AUTHORITY ? "authority" : head.length ? "head" : "stopped"]++;
        return deny(403);
      }
      if (row.tickets < 1) { row.denied_replacement_connects++; return deny(403); }
      row.tickets--; row.connects++;
      const remote = own(connect({ host: "127.0.0.1", port }));
      row.liveTunnels.add(remote);
      remote.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        client.pipe(remote); remote.pipe(client);
      });
      remote.once("close", () => { row.liveTunnels.delete(remote); client.destroy(); });
      client.once("close", () => remote.destroy());
    });
    await listen(proxy);
    browserServer = await chromium.launchServer({
      executablePath: fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url)),
      headless: false, host: "127.0.0.1", timeout: 10000,
      proxy: { server: `http://127.0.0.1:${proxy.address().port}`, username, password },
      args: ["--disable-background-networking", "--dns-prefetch-disable",
        `--ignore-certificate-errors-spki-list=${pin}`],
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    if (browser.version() !== "155.0.8059.80") fail("cohort_mismatch");
    for (const protocol of ["h1", "h2"]) {
      const connectionIds = new Map();
      upstream = protocol === "h1"
        ? createHttpsServer({ key, cert, maxHeaderSize: 131072, ALPNProtocols: ["http/1.1"] })
        : createSecureServer({ key, cert, allowHTTP1: false, settings: { maxHeaderListSize: 131072 } });
      upstream.on("connection", own);
      upstream.on("session", session => {
        sessions.add(session); session.on("error", () => {});
        session.once("close", () => sessions.delete(session));
      });
      upstream.on("request", (req, res) => {
        const row = active;
        if (!row) { res.writeHead(403).end(); return; }
        res.on("error", () => {}); req.on("error", () => {});
        if (req.stream) req.stream.on("error", () => {});
        const connection = req.socket.remotePort;
        if (!connectionIds.has(connection)) connectionIds.set(connection, connectionIds.size + 1);
        const url = ORIGIN + req.url;
        const receiver = { url, method: req.method, headers: elideProxyAuthorization(req.headers),
          connection_id: connectionIds.get(connection), stream_id: req.stream?.id ?? null,
          matched_pre_reservations: row.admissions.filter(admission => admission.url === url).map(admission => admission.ordinal),
          receiver_response_status: null, received_body_bytes: 0 };
        row.receiver.push(receiver);
        req.on("data", bytes => { receiver.received_body_bytes += bytes.length; }); req.resume();
        const index = Number(new URL(url).searchParams.get("r"));
        // Inject one fault, then allow any retry to receive the ordinary reply.
        // The measured retry count is not a guessed upper bound on Chrome.
        if (row.fault !== "none" && index === row.count - 1 && !row.fault_triggered) {
          row.fault_triggered = true; receiver.fault = row.fault;
          receiver.fault_on_reused_connection = row.receiver.slice(0, -1)
            .some(previous => previous.connection_id === receiver.connection_id);
          if (row.fault === "close-before-response") req.socket.destroy();
          else if (row.fault === "rst-refused") req.stream.close(h2constants.NGHTTP2_REFUSED_STREAM);
          else if (row.fault === "rst-cancel") req.stream.close(h2constants.NGHTTP2_CANCEL);
          else {
            req.stream.session.goaway(h2constants.NGHTTP2_NO_ERROR, 0);
            req.stream.close(h2constants.NGHTTP2_REFUSED_STREAM);
          }
          return;
        }
        receiver.receiver_response_status = 200; receiver.fixture_response_sha256 = HASH(PNG);
        res.writeHead(200, { "content-type": "image/png", "content-length": String(PNG.length), "cache-control": "no-store" });
        res.end(PNG);
      });
      await listen(upstream); port = upstream.address().port;
      const plans = protocol === "h1" ? [
        ["normal", "none", 1, "per-request"], ["cross-origin-normal", "none", 1, "per-request"],
        ["reused-close", "close-before-response", 2, "per-request"],
        ["reused-close-no-replacement", "close-before-response", 2, "cold-only"],
        ["ceiling-close", "close-before-response", 8, "per-request"],
      ] : [
        ["normal", "none", 1, "cold-only"], ["cross-origin-normal", "none", 1, "cold-only"],
        ["rst-refused", "rst-refused", 2, "cold-only"], ["rst-cancel", "rst-cancel", 2, "cold-only"],
        ["goaway", "goaway", 2, "per-request"], ["goaway-no-replacement", "goaway", 2, "cold-only"],
        ["ceiling-rst-refused", "rst-refused", 8, "cold-only"],
      ];
      for (const [kind, fault, count, ticketMode] of plans) {
        const row = { protocol, kind, fault, count, ticket_mode: ticketMode, receiver: [], admissions: [],
          request_events: [], fetch_pauses: [], extra_info: [], failures: [], stopped: false, tickets: 0, connects: 0,
          denied_replacement_connects: 0, liveTunnels: new Set(), fault_triggered: false,
          connect_denials: { auth: 0, authority: 0, head: 0, stopped: 0 } };
        cases.push(row); active = row;
        const documentUrl = (kind === "cross-origin-normal" ? "https://owned-meta.test.invalid" : ORIGIN)
          + "/__fixed_count_case__";
        row.same_origin_diagnostic = kind !== "cross-origin-normal";
        const policy = createNativeStockPolicy(fixedPolicy(documentUrl));
        const context = await browser.newContext({ serviceWorkers: "block" }); contexts.add(context);
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        const tasksHere = new Set(), byNetwork = new Map();
        const task = promise => {
          tasks.add(promise); tasksHere.add(promise);
          promise.catch(() => { row.observer_failed = true; row.stopped = true; stopSockets(); })
            .finally(() => { tasks.delete(promise); tasksHere.delete(promise); });
        };
        const stop = reason => {
          if (!row.stopped) row.stop_reason = reason;
          row.stopped = true; stopSockets();
          task(cdp.send("Page.stopLoading").catch(() => {}));
        };
        const unsupported = () => stop("unsupported_surface");
        context.on("page", unsupported); context.on("serviceworker", unsupported);
        for (const event of ["worker", "frameattached", "websocket"]) page.on(event, unsupported);
        await cdp.send("Network.enable");
        cdp.on("Fetch.authRequired", event => task((async () => {
          const allowed = !row.stopped && event.authChallenge.source === "Proxy"
            && event.authChallenge.origin === `http://127.0.0.1:${proxy.address().port}`;
          row.proxy_auth_callbacks = (row.proxy_auth_callbacks ?? 0) + 1;
          await cdp.send("Fetch.continueWithAuth", { requestId: event.requestId, authChallengeResponse: allowed
            ? { response: "ProvideCredentials", username, password } : { response: "CancelAuth" } });
          if (!allowed) stop("unexpected_authentication_challenge");
        })()));
        cdp.on("Network.requestWillBeSent", event => {
          if (event.request.url.startsWith(ORIGIN + "/tr/"))
            row.request_events.push({ request_id: event.requestId, url: event.request.url });
        });
        cdp.on("Network.requestWillBeSentExtraInfo", event => {
          const entry = byNetwork.get(event.requestId);
          if (!entry || entry.kind === "fixture") return;
          const headers = elideProxyAuthorization(event.headers);
          row.extra_info.push({ request_id: event.requestId, ordinal: entry.ordinal, headers,
            bytes: headerBytes(headers), pre_reserved_vendor_requests: policy.summary().vendor_registered,
            receiver_attempts_already_visible: row.receiver.length });
          if (headerBytes(headers) > LIMITS.request_bytes) stop("final_header_limit_inconclusive");
        });
        cdp.on("Network.loadingFailed", event => {
          if (!byNetwork.has(event.requestId)) return;
          row.failures.push({ request_id: event.requestId, error: /^net::ERR_[A-Z_]+$/.test(event.errorText)
            ? event.errorText : "transport_failure" });
          stop("transport_failure_inconclusive");
        });
        cdp.on("Fetch.requestPaused", event => task((async () => {
          if (event.request.url.startsWith(ORIGIN + "/tr/")) row.fetch_pauses.push({
            fetch_id: event.requestId, network_id: event.networkId, url: event.request.url,
          });
          if (row.stopped) {
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); return;
          }
          const body = originalBody(event.request), headers = elideProxyAuthorization(event.request.headers);
          const decision = policy.inspect({ url: event.request.url, method: event.request.method,
            resource_type: event.resourceType, headers, body });
          if (decision.disposition !== "eligible" || decision.kind === "local_source") {
            stop("scope_or_staged_limit_denied");
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); return;
          }
          let admission;
          try { admission = policy.registerAdmission(decision, policy.summary().registered); }
          catch { stop("pre_send_request_count_limit"); return; }
          const entry = { ...admission, url: event.request.url, fetch_id: event.requestId, network_id: event.networkId,
            headers, body_base64: body.toString("base64"), pre_send_bytes: headerBytes(headers) + body.length,
            receiver_attempts_before_reservation: row.receiver.length };
          byNetwork.set(event.networkId, entry);
          if (admission.kind === "fixture") {
            const doc = countFixture(documentUrl, count, randomBytes(16).toString("hex"));
            await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
              responseHeaders: doc.headers, body: doc.bytes.toString("base64") }); return;
          }
          row.admissions.push(entry);
          if (ticketMode === "per-request" || row.liveTunnels.size === 0) row.tickets++;
          await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
        })()));
        await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }], handleAuthRequests: true });
        await page.goto(documentUrl, { waitUntil: "load", timeout: 4000 });
        await deadline(page.evaluate(() => window.__runSynthetic()), 7000, "fixture_deadline");
        await wait(() => tasksHere.size === 0, "observer_deadline");
        row.policy_summary = policy.summary();
        row.pre_reserved_vendor_requests = policy.summary().vendor_registered;
        row.backend_visible_http_attempts = row.receiver.length;
        row.per_url = [...new Set(row.admissions.map(entry => entry.url))].map(url => ({
          url, pre_reservations: row.admissions.filter(entry => entry.url === url).length,
          receiver_attempts: row.receiver.filter(entry => entry.url === url).length,
          network_request_events: row.request_events.filter(entry => entry.url === url).length,
          fetch_pause_events: row.fetch_pauses.filter(entry => entry.url === url).length,
        }));
        row.unbudgeted_backend_attempts = row.per_url.reduce((sum, entry) =>
          sum + Math.max(0, entry.receiver_attempts - entry.pre_reservations), 0);
        row.owner_meta_wire_ceiling_exceeded = row.receiver.length > LIMITS.meta_requests;
        row.fault_on_reused_connection = row.receiver.some(entry => entry.fault_on_reused_connection === true);
        row.cookies_after = await context.cookies();
        await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context);
        context.off("page", unsupported); context.off("serviceworker", unsupported);
        for (const event of ["worker", "frameattached", "websocket"]) page.off(event, unsupported);
        row.guards_removed_after_close = true; active = null;
        stopSockets(); await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup");
      }
      active = null; port = null; await closeServer(upstream);
    }
  } catch (error) {
    errors.push(["cohort_mismatch", "fixture_deadline", "observer_deadline", "socket_cleanup",
      "context_close_deadline", "listen_deadline", "server_close_deadline"].includes(error.message) ? error.message : "meta_count_probe_failed");
  } finally {
    for (const context of contexts) {
      try { await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context); }
      catch { errors.push("context_close_failed"); }
    }
    try { await deadline(browser?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    try { await deadline(browserServer?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    await deadline(Promise.allSettled([...tasks]), 2000, "observer_deadline").catch(() => errors.push("observer_deadline"));
    stopSockets();
    await closeServer(upstream).catch(() => errors.push("sink_close_failed"));
    await closeServer(proxy).catch(() => errors.push("proxy_close_failed"));
    await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup").catch(() => errors.push("socket_cleanup"));
    clearTimeout(watchdog); unlinkSync(keyPath); syncDir(options.outputDir);
  }
  for (const row of cases) { delete row.liveTunnels; delete row.tickets; }
  const cleanup = { contexts_closed: contexts.size === 0, sockets_closed: sockets.size === 0 && sessions.size === 0,
    observers_settled: tasks.size === 0, proxy_closed: !!proxy && !proxy.listening, sinks_closed: !!upstream && !upstream.listening,
    deadline_met: !expired && performance.now() - started < LIMITS.duration_ms,
    browser_process_exited: !!browserServer && (browserServer.process().exitCode !== null || browserServer.process().signalCode !== null) };
  const finding = classifyMetaCountProbe(cases);
  const witnessed = finding.witnessed && errors.length === 0 && Object.values(cleanup).every(Boolean);
  const capture = { schema: "airlock.meta-transmission-count-originals.v1", cases,
    scope: "receiver request-attempt ledger, not complete native reference response capture",
    official_sdk_executed: false, owner_selectors_used: false };
  const report = { schema: "airlock.meta-transmission-count-blocker.v1", witnessed, native_execution_qualified: false,
    producer_exit_code: witnessed ? 2 : 3, blockers: witnessed ? ["backend_http_attempts_not_pre_reserved"] : ["count_probe_incomplete"],
    cases: cases.map(({ receiver, admissions, extra_info, request_events, fetch_pauses, per_url, cookies_after, ...summary }) => summary),
    errors: [...errors, ...finding.errors], cleanup, source_pins: metaSourcePins(), official_sdk_executed: false,
    owner_slots_reserved: 0, public_provider_requests: 0, synthetic_measurements_not_http_warmups: true,
    header_timing_exception_does_not_waive_attempt_counts: true, full_reference_controller_qualified: false,
    cohort: { node: process.version, chrome: "155.0.8059.80", macos: "27.0.1", darwin: release(),
      headed: true, test_trust: "exact_generated_spki_only", upstream: "fixed_literal_loopback_only",
      same_origin_count_diagnostics_not_owned_top_native_meta_proof: true } };
  checkDeadline(); writeMetaPrivate(join(options.outputDir, "capture.json"), capture);
  checkDeadline(); writeMetaPrivate(join(options.outputDir, "report.json"), report);
  checkDeadline(); writeMetaPrivate(join(options.outputDir, "completion.json"), {
    schema: "airlock.meta-count-completion.v1", command_exit_observed: false, producer_exit_code: report.producer_exit_code,
    report_sha256: HASH(readFileSync(join(options.outputDir, "report.json"))),
    capture_sha256: HASH(readFileSync(join(options.outputDir, "capture.json"))) });
  checkDeadline();
  return report;
}
