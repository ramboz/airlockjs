import { execFile } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createSecureServer, constants as H2 } from "node:http2";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createServer as createTlsServer } from "node:tls";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { isProxy } from "node:util/types";
import { createInspectedHttpWire, createInspectedRequestFramer } from "./inspected-http-wire.mjs";
import { startLocalGoogleInspectedTransport } from "./inspected-transport.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";

const execute = promisify(execFile);
const DOCUMENT = "https://owned.example/inspection";
const BASE = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const COMPANION = "https://ad.doubleclick.net/ccm/s/collect?auid=synthetic-auid";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const NAMES = ["www.googleadservices.com", "www.google.com", "googleads.g.doubleclick.net", "ad.doubleclick.net"];
const fail = reason => { throw Error(reason); };
const profile = () => ({
  schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock", document_url: DOCUMENT,
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic", value: 1,
    currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true,
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function diagnosticBypass() {
  let observed = 0, forwarded = 0, stopped = false, reason = null, retained = 0;
  const stop = value => { if (!stopped) { stopped = true; reason = value; } };
  return Object.freeze({
    stop, snapshot: () => ({ observed, forwarded, stopped, reason, diagnostic_bypass: true, retained_bytes: retained }),
    reserveObservation(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0 || retained + bytes > 8388608) { stop("aggregate_overflow"); return false; }
      retained += bytes; return true;
    },
    originals: () => ({ responses: [] }),
    connection(protocol) {
      const framer = createInspectedRequestFramer(protocol, {
        stop, stopped: () => stopped, rawHeaderLimit: 131072, frameLimit: 65536,
        begin() { observed++; if (observed > 64) { stop("observation_overflow"); return false; } return observed; },
        header() { forwarded++; return true; },
      });
      return { request: bytes => framer.push(bytes), response: async bytes => bytes,
        endRequest: () => framer.end(), endResponse: async () => {} };
    },
  });
}

/** Fixed SDK-free loopback controls. This entry cannot execute native source. */
export async function runLocalGoogleQualification(options) {
  if (!options || isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).length !== 3
    || Reflect.ownKeys(options).some(key => !["protocol", "control", "outputDir"].includes(key)
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value"))
    || !["h1", "h2"].includes(options.protocol)
    || !["positive", "marker", "marker-bypass", "path", "path-bypass", "changed-input", "changed-input-bypass",
      "ambiguous", "ambiguous-bypass", "close", "close-positive", "no-ticket", "abort", "redirect",
      "response-limit", "response-limit-bypass",
      "truncated", "truncated-bypass",
      "header-limit", "header-limit-bypass",
      "budget", "budget-bypass", "certificate", "wrong-name",
      "retry", "retry-bypass", "goaway", "goaway-bypass"].includes(options.control)
    || (options.control.startsWith("goaway") && options.protocol !== "h2")
    || typeof options.outputDir !== "string" || !isAbsolute(options.outputDir)
    || resolve(options.outputDir) !== options.outputDir) fail("invalid_google_qualification");
  const { protocol, control, outputDir } = options, parent = lstatSync(dirname(outputDir));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()
    || (parent.mode & 0o7777) !== 0o700) fail("invalid_google_output_parent");
  for (let ancestor = dirname(outputDir);;) {
    const stat = lstatSync(ancestor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("invalid_google_output_parent");
    if (dirname(ancestor) === ancestor) break;
    ancestor = dirname(ancestor);
  }
  mkdirSync(outputDir, { mode: 0o700 });
  const directoryFd = openSync(dirname(outputDir), "r");
  try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
  const started = performance.now(), expires = Date.now() + 60000;
  const check = () => {
    if (Date.now() >= expires || performance.now() - started >= 60000) fail("qualification_expired");
  };
  const wait = async (promise, maximum = 5000) => {
    check();
    const remaining = Math.min(maximum, expires - Date.now(), 60000 - (performance.now() - started));
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("qualification_timeout")), Math.max(1, remaining));
    })]); } finally { clearTimeout(timer); }
  };
  const settle = async (promise, maximum = 5000) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("cleanup_timeout")), maximum);
    })]); } finally { clearTimeout(timer); }
  };
  const files = [], sockets = new Set(), sessions = new Set(), tasks = new Set(), logical = [], networkEvents = [], receiver = [];
  const errors = [], cleanup = {}, outputs = [];
  const sourceBefore = inspectedMetaSourcePins();
  let cookies = [];
  let browserServer, browser, context, page, cdp, sink, transport, guard = true, guardAtClose = false, faultInjected = false;
  const track = promise => {
    tasks.add(promise);
    promise.catch(() => errors.push("cdp_event_failed")).finally(() => tasks.delete(promise));
  };
  const own = socket => { sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket)); };
  const bypass = control.endsWith("-bypass");
  const observer = bypass ? diagnosticBypass() : createInspectedHttpWire({
    mode: "DECLARED-GOOGLE-PROFILE", profile: profile(),
    resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
  const retain = value => {
    const bytes = Buffer.from(JSON.stringify(value));
    if (observer.snapshot().stopped && typeof observer.retain === "function"
      ? !observer.retain(bytes) : !observer.reserveObservation(bytes.length)) fail("aggregate_overflow");
    return value;
  };
  const certificate = async (name, names = NAMES) => {
    const key = join(outputDir, name + "-key.pem"), cert = join(outputDir, name + "-cert.pem");
    files.push(key, cert);
    await execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key,
      "-out", cert, "-days", "1", "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=" + names.map(host => "DNS:" + host).join(",")],
    { timeout: 5000, maxBuffer: 8192 });
    chmodSync(key, 0o600); chmodSync(cert, 0o600);
    return { key: readFileSync(key), cert: readFileSync(cert) };
  };
  try {
    const inspector = await certificate("inspector"), upstream = await certificate("upstream",
      control === "wrong-name" ? ["wrong.example"] : NAMES);
    const spki = createHash("sha256").update(new X509Certificate(inspector.cert).publicKey
      .export({ type: "spki", format: "der" })).digest("base64");
    const application = protocol === "h1" ? createHttpServer({ maxHeaderSize: 131072 })
      : createSecureServer({ ...upstream, maxHeaderListPairs: 8192, settings: { maxHeaderListSize: 131072 },
        ALPNProtocols: ["h2"] });
    sink = protocol === "h1" ? createTlsServer({ ...upstream, ALPNProtocols: ["http/1.1"] }, secure => {
      own(secure); application.emit("connection", secure);
    }) : application;
    sink.on("connection", own);
    application.on("session", session => { sessions.add(session); session.once("close", () => sessions.delete(session)); });
    application.on("request", (req, res) => {
      req.on("error", () => {}); res.on("error", () => {}); req.stream?.on("error", () => {});
      const received = { method: req.method, url: req.url, authority: req.headers[":authority"] ?? req.headers.host,
        headers: req.rawHeaders, response_body_sha256: null };
      try { receiver.push(retain(received)); }
      catch { errors.push("aggregate_overflow"); observer.stop("aggregate_overflow"); req.destroy(); return; }
      if ((control.startsWith("retry") || control.startsWith("goaway")) && !faultInjected && receiver.length === 20) {
        faultInjected = true;
        if (protocol === "h1") req.socket.destroy();
        else {
          if (control.startsWith("goaway")) req.stream.session.goaway(H2.NGHTTP2_NO_ERROR, 0);
          req.stream.close(H2.NGHTTP2_REFUSED_STREAM);
        }
        return;
      }
      const redirecting = control === "redirect" && receiver.length === 1;
      const body = redirecting ? Buffer.from("redirect-original")
        : control.startsWith("response-limit") ? Buffer.alloc(2097152, 65)
        : control.startsWith("truncated") ? Buffer.from("incomplete")
        : req.url.startsWith("/ccm/s/collect?") ? PNG : Buffer.from("synthetic-original");
      received.response_body_sha256 = retain(createHash("sha256").update(body).digest("hex"));
      res.writeHead(redirecting ? 302 : 200, { "access-control-allow-origin": "*",
        ...(redirecting ? { location: BASE + "&random=1" } : {}),
        "content-type": body === PNG ? "image/png" : "text/plain",
        "content-length": control.startsWith("truncated") ? body.length + 10 : body.length,
        ...(control.startsWith("truncated") && protocol === "h1" ? { connection: "close" } : {}),
        "set-cookie": "qualification=one; Secure; SameSite=None; Partitioned" });
      res.end(body);
    });
    await wait(new Promise((resolve, reject) => {
      sink.once("error", reject); sink.listen(0, "127.0.0.1", resolve);
    }));
    transport = await startLocalGoogleInspectedTransport({ inspector, protocol, observer, check, wait,
      receiver: { port: sink.address().port, certificate: control === "certificate" ? inspector.cert : upstream.cert,
        logicalAuthority: authority => logical.some(row => new URL(row.url).host + ":443" === authority) } });
    const { chromium } = await import("playwright");
    browserServer = await chromium.launchServer({ executablePath: fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url)),
      host: "127.0.0.1", headless: true, timeout: 10000, proxy: { server: "http://127.0.0.1:" + transport.port },
      args: ["--disable-background-networking", "--dns-prefetch-disable", `--ignore-certificate-errors-spki-list=${spki}`] });
    if (new URL(browserServer.wsEndpoint()).hostname !== "127.0.0.1") fail("driver_not_loopback");
    browser = await wait(chromium.connect(browserServer.wsEndpoint()));
    if (browser.version() !== "156.0.8078.80") fail("browser_cohort_mismatch");
    transport.attachOwnedBrowser(await wait(browser.newBrowserCDPSession()));
    context = await wait(browser.newContext({ serviceWorkers: "block" }));
    context.once("close", () => { guardAtClose = guard; });
    page = await wait(context.newPage()); cdp = await wait(context.newCDPSession(page));
    cdp.on("Network.requestWillBeSent", event => {
      if (networkEvents.length >= 64) {
        errors.push("observation_overflow"); observer.stop("observation_overflow"); transport.closeAdmission(); return;
      }
      try { networkEvents.push(retain({ network_id: event.requestId, url: event.request.url, method: event.request.method,
        resource_type: event.type, redirect_url: event.redirectResponse?.url ?? null,
        redirect_status: event.redirectResponse?.status ?? null })); }
      catch { errors.push("aggregate_overflow"); observer.stop("aggregate_overflow"); transport.closeAdmission(); }
    });
    await wait(cdp.send("Network.enable"));
    cdp.on("Fetch.requestPaused", event => track((async () => {
      check();
      if (event.request.url === DOCUMENT && event.resourceType === "Document") {
        await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "text/html" }],
          body: Buffer.from("<!doctype html><title>SDK-free local fixture</title>").toString("base64") });
      } else if (event.request.url.startsWith("https://www.googleadservices.com/")
        || event.request.url.startsWith("https://ad.doubleclick.net/")) {
        if (!event.networkId) fail("missing_logical_network_id");
        let matches = [];
        for (let n = 0; n < 200; n++) {
          matches = networkEvents.filter(row => row.network_id === event.networkId
            && row.url === event.request.url && row.method === event.request.method);
          if (matches.length) break;
          await sleep(5);
        }
        if (matches.length !== 1) fail("missing_or_ambiguous_network_event");
        const network = matches[0], parent = network.redirect_url && observer.originals().requests?.findLast(row =>
          row.logical_network_id === event.networkId && row.url === network.redirect_url
          && observer.originals().responses.some(response => response.ordinal === row.ordinal
            && response.state === "complete" && response.status === network.redirect_status
            && response.redirect_url === event.request.url));
        if (network.redirect_url && !parent) fail("unverified_redirect_parent");
        if (control !== "no-ticket") {
          const row = { network_id: event.networkId, fetch_id: event.requestId, url: event.request.url,
            method: event.request.method, resource_type: network.resource_type,
            ...(parent ? { redirect_from: parent.ordinal } : {}) };
          logical.push(retain(row));
          if (control.startsWith("ambiguous") && logical.length === 2) logical.push(retain({ ...row }));
        }
        const parameters = { requestId: event.requestId };
        if (control.startsWith("header-limit")) parameters.headers = [
          ...Object.entries(event.request.headers).map(([name, value]) => ({ name, value })),
          { name: "X-Padding", value: "a".repeat(65536) },
        ];
        await cdp.send("Fetch.continueRequest", parameters);
      } else await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
    })()));
    await wait(cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }));
    await wait(page.goto(DOCUMENT, { waitUntil: "load", timeout: 5000 }));
    const retry = control.startsWith("retry") || control.startsWith("goaway");
    const certificateFault = ["certificate", "wrong-name"].includes(control);
    const responseLimit = control.startsWith("response-limit");
    const headerLimit = control.startsWith("header-limit");
    const truncated = control.startsWith("truncated");
    const total = certificateFault || control === "no-ticket" || control === "redirect" || responseLimit || headerLimit || truncated ? 1
      : control.startsWith("budget") ? 21 : retry ? 20 : 2;
    for (let n = 0; n < total; n++) {
      const primary = control.startsWith("close") || n % 2 === 0;
      if (control === "close" && n === 1) transport.closeAdmission();
      let url = primary ? BASE + "&random=" + n : COMPANION + "&gtm=" + n;
      if (control.startsWith("marker") && n === 1) url = BASE.replace("label=synthetic&", "") + "&random=1";
      if (control.startsWith("path") && n === 1) url = BASE.replace("/pagead/conversion/", "/unknown/conversion/") + "&random=1";
      if (control.startsWith("changed-input") && n === 1)
        url = BASE.replace("oid=synthetic-transaction", "oid=other-transaction") + "&random=1";
      const kind = ["marker", "path", "changed-input"].some(value => control.startsWith(value)) && n === 1
        ? "xhr" : primary ? "xhr" : "image";
      const outcome = await wait(page.evaluate(({ url, kind }) => new Promise(resolve => {
        if (kind === "image") {
          const image = new Image();
          image.onload = () => resolve({ ok: true }); image.onerror = () => resolve({ ok: false });
          image.src = url;
        } else {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.responseText.length > 100
            ? { ok: xhr.status === 200, length: xhr.responseText.length }
            : { ok: xhr.status === 200, body: xhr.responseText });
          xhr.onerror = () => resolve({ ok: false }); xhr.open("GET", url); xhr.send();
        }
      }), { url, kind }), 10000);
      outputs.push(retain(outcome));
      if (control === "abort" && n === 0) fail("synthetic_abort");
    }
    await wait(Promise.allSettled([...tasks]));
    cookies = retain(await wait(context.cookies()));
    const expected = certificateFault || control === "no-ticket" || (headerLimit && !bypass) ? 0
      : control === "redirect" ? 2 : responseLimit || headerLimit || truncated ? 1
      : retry ? (bypass ? 21 : 20) : bypass ? total : ["positive", "close-positive"].includes(control) ? 2
        : ["marker", "path", "changed-input", "ambiguous", "close"].includes(control) ? 1 : 20;
    const snapshot = observer.snapshot(), reason = control === "marker" ? "owned_input_mismatch"
      : control === "path" ? "unqualified_route_or_field"
        : control === "changed-input" ? "owned_input_mismatch"
          : control === "ambiguous" ? "missing_or_ambiguous_logical_observation"
        : control === "response-limit" ? "response_overflow" : control === "header-limit" ? "semantic_header_limit"
          : control === "truncated" ? "truncated_response"
          : certificateFault ? "upstream_tls_failed"
        : control === "budget" || (retry && !bypass) ? "physical_request_limit" : null;
    const truncatedH2Bypass = control === "truncated-bypass" && protocol === "h2";
    const expectedSuccesses = control === "redirect" ? 1 : retry ? (bypass ? 20 : 19)
      : control === "response-limit" || truncated && !truncatedH2Bypass ? 0 : expected;
    if (receiver.length !== expected || snapshot.forwarded !== expected || snapshot.reason !== reason
      || (retry && !faultInjected) || outputs.length !== total || outputs.slice(0, expectedSuccesses).some(row => !row.ok)
      || outputs.slice(expectedSuccesses).some(row => row.ok)
      || outputs.filter(row => row.body !== undefined).some(row =>
        row.body !== (truncatedH2Bypass ? "incomplete" : "synthetic-original"))
      || (control === "response-limit-bypass" && outputs[0]?.length !== 2097152)
      || (!bypass && observer.originals().responses.filter(row => row.state === "complete").length
        !== (control === "redirect" ? 2 : expectedSuccesses))
      || (control === "redirect" && observer.originals().requests[1]?.redirect_from !== 1)
      || (!bypass && observer.originals().requests.some((row, index) =>
        JSON.stringify(row.headers.flat()) !== JSON.stringify(receiver[index]?.headers)))
      || (!bypass && observer.originals().responses.some(row => row.state === "complete"
        && createHash("sha256").update(Buffer.concat(row.body)).digest("hex")
          !== receiver[row.ordinal - 1]?.response_body_sha256))
      || (!certificateFault && control !== "no-ticket" && control !== "redirect" && !responseLimit && !headerLimit && !truncated
        && !["marker", "path", "changed-input", "ambiguous"].some(value => control.startsWith(value))
        && !control.startsWith("close") && !cookies.some(cookie => cookie.name === "qualification"
        && cookie.domain === "ad.doubleclick.net" && cookie.partitionKey === "https://owned.example"))
      || (!certificateFault && !control.startsWith("marker") && !control.startsWith("path") && total > 2
        && !receiver.some((row, index) => index > 1 && row.authority === "ad.doubleclick.net"
          && row.headers.some((value, at) => at % 2 === 0 && value.toLowerCase() === "cookie"
            && row.headers[at + 1].includes("qualification=one"))))
      || (certificateFault ? transport.snapshot().denials.upstream_certificate !== 1 : control === "no-ticket"
        ? !transport.snapshot().denial_authorities.no_authority?.["www.googleadservices.com:443"]
        : !transport.snapshot().tunnels.length || transport.snapshot().tunnels.some(row => !row.upstream_authorized)))
      fail("receiving_control_failed");
  } catch (error) {
    errors.push(error.message);
  } finally {
    if (transport) transport.closeAdmission();
    if (context) try { await settle(context.close()); } catch { errors.push("context_close_failed"); }
    cleanup.guard_at_context_close = guardAtClose;
    if (browser) try { await settle(browser.close()); } catch { errors.push("browser_close_failed"); }
    if (browserServer) try { await settle(browserServer.close()); } catch { errors.push("browser_server_close_failed"); }
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      try { await settle(exit, 2000); } catch { errors.push("browser_process_close_failed"); }
    }
    guard = false;
    cleanup.browser_process_exited = !child || child.exitCode !== null || child.signalCode !== null;
    if (transport) try { await settle(transport.close()); } catch { errors.push("transport_close_failed"); }
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
    if (sink) try { await settle(new Promise((resolve, reject) => sink.close(error => error ? reject(error) : resolve()))); }
    catch { errors.push("receiver_close_failed"); }
    try { await settle(Promise.allSettled([...tasks])); } catch { errors.push("cdp_settlement_failed"); }
    for (let n = 0; n < 100 && (sockets.size || sessions.size || transport && !transport.snapshot().sockets_closed); n++) await sleep(10);
    cleanup.receiver_sockets_closed = sockets.size === 0; cleanup.receiver_sessions_closed = sessions.size === 0;
    cleanup.cdp_tasks_settled = tasks.size === 0;
    cleanup.transport = transport?.snapshot() ?? null;
    for (const file of files) try { if (existsSync(file)) unlinkSync(file); } catch { errors.push("certificate_cleanup_failed"); }
    cleanup.keys_removed = files.every(file => !existsSync(file));
    if (!cleanup.guard_at_context_close || !cleanup.browser_process_exited || !cleanup.receiver_sockets_closed
      || !cleanup.receiver_sessions_closed || !cleanup.keys_removed || !cleanup.transport?.server_closed
      || !cleanup.transport?.sockets_closed || !cleanup.transport?.tasks_settled || !cleanup.cdp_tasks_settled)
      errors.push("cleanup_incomplete");
    if (cleanup.transport?.errors.length) errors.push("transport_errors");
    const expectedReason = control === "marker" ? "owned_input_mismatch"
      : control === "path" ? "unqualified_route_or_field" : control === "response-limit" ? "response_overflow"
        : control === "changed-input" ? "owned_input_mismatch"
          : control === "ambiguous" ? "missing_or_ambiguous_logical_observation"
        : control === "header-limit" ? "semantic_header_limit"
          : control === "truncated" ? "truncated_response"
        : ["certificate", "wrong-name"].includes(control) ? "upstream_tls_failed"
        : control === "budget" || (["retry", "goaway"].includes(control)) ? "physical_request_limit" : null;
    if (observer.snapshot().reason !== expectedReason) errors.push("final_observer_state_mismatch");
    if (observer.snapshot().late_wire_overflow) errors.push("aggregate_overflow");
    if (Date.now() >= expires || performance.now() - started >= 60000) errors.push("qualification_expired");
  }
  const sourceAfter = inspectedMetaSourcePins();
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) errors.push("qualification_source_changed");
  const originals = observer.originals();
  const originalWire = originals.wire?.map(row => ({ connection: row.connection, protocol: row.protocol,
    request: row.request.map(bytes => bytes.toString("base64")),
    response: row.response.map(bytes => bytes.toString("base64")) }));
  const originalResponses = originals.responses.map(row => ({ ...row,
    body: row.body.map(bytes => bytes.toString("base64")) }));
  const report = { protocol, control, outcome: errors.length ? "inconclusive" : "pass", errors,
    receiver_attempts: receiver.length, fault_injected: faultInjected, observer: observer.snapshot(), outputs, cleanup,
    logical, network_events: networkEvents, receiver, cookies, originals: { requests: originals.requests ?? [], responses: originalResponses,
      wire: originalWire ?? [] }, source_before: sourceBefore, source_after: sourceAfter,
    native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
  if (Buffer.byteLength(JSON.stringify(report)) > 8388608) fail("qualification_output_limit");
  const path = join(outputDir, "result.json");
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(report) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  const outputFd = openSync(outputDir, "r");
  try { fsyncSync(outputFd); } finally { closeSync(outputFd); }
  if (Date.now() >= expires || performance.now() - started >= 60000) fail("qualification_output_expired");
  if (errors.length) fail("local_google_qualification_inconclusive");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runLocalGoogleQualification({ protocol: process.argv[2], control: process.argv[3], outputDir: process.argv[4] });
    console.log(JSON.stringify({ protocol: report.protocol, control: report.control, outcome: report.outcome }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
