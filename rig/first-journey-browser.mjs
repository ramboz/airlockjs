import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants, closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync,
  readFileSync, writeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { release } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { reserveCase } from "./first-journey-admission.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LAUNCHER = fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url));
const POLICY = fileURLToPath(new URL("./qualification-loopback-network.sb", import.meta.url));
const SURFACES = ["fetch-get", "fetch-post", "xhr", "image", "beacon", "script", "redirect", "fanout"];
const CONTROLS = ["none", "missing-body", "late-read", "response-limit",
  "request-limit", "url-limit", "wrong-transport", "invalid-parent",
  "cleanup-failure", "output-failure", "output-deadline",
  "nonempty-redirect", "marker-loss", "query-order",
  "unsupported-frame", "unsupported-popup", "unsupported-worker", "unsupported-service-worker",
  "unsupported-websocket"];
const CAPS = Object.freeze({
  observed_requests: 64, google_dispatches: 20, meta_dispatches: 8,
  url_bytes: 2048, request_bytes: 65536, response_bytes: 2097152,
  retained_bytes: 8388608, duration_ms: 60000,
});
const POST = Buffer.from([0, 255, 128, 65, 13, 10, 192, 175]);
const FINAL = Buffer.from([254, 0, 127, 42]);
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const execute = promisify(execFile);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const error = category => Object.assign(new Error(category), { category });
const js = value => JSON.stringify(value).replaceAll("<", "\\u003c");
const checkedKeys = (value, names) => value && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).every(key => names.includes(key));
const claims = Object.freeze({
  live_guard_qualified: false, native_sdk_executed: false, vendor_dispatch_verified: false,
  vendor_receipt_verified: false, chamber_compatibility_verified: false,
  matching_verified: false, attribution_verified: false, full_support_verified: false,
});

function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function privateJson(path, value) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
    | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fstatSync(fd);
    if ((stat.mode & 0o7777) !== 0o600 || !stat.isFile() || stat.nlink !== 1)
      throw error("output_permissions");
    const bytes = Buffer.from(JSON.stringify(value, null, 2));
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw error("output_write_failed");
      offset += written;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDirectory(dirname(path));
}

function planFor(origin, surface, leg, control) {
  const suffix = `?owned=probe&dup=one&dup=two&surface=${surface}&leg=${leg}`;
  const names = surface === "fanout" ? ["fan-one", "fan-two"]
    : surface === "redirect" ? ["redirect", "target"] : [surface];
  const descriptors = names.map((name, index) => ({
    name, url: origin + "/" + name + suffix,
    method: ["fetch-post", "xhr", "beacon", "redirect", "target"].includes(name) ? "POST" : "GET",
    transport: surface === "image" ? "image" : surface === "script" ? "script"
      : surface === "beacon" ? "beacon" : surface === "xhr" ? "xhr" : "fetch",
    resources: surface === "image" ? ["Image"] : surface === "script" ? ["Script"]
      : surface === "beacon" ? ["Ping"] : ["Fetch", "XHR"],
    parent: surface === "redirect" && index === 1 ? "redirect" : null,
  }));
  if (control === "marker-loss") descriptors[1].actualUrl = descriptors[1].url.replace("owned=probe", "owned=lost");
  const fixtureUrl = origin + "/fixture" + suffix;
  const scope = [{
    id: "fixture", url: fixtureUrl, method: "GET", transport: "document",
    resource: "Document", mode: "local", parent_scope: null, required_response: true,
  }, ...descriptors.flatMap(row => row.resources.map(resource => ({
    id: row.name + "-" + resource.toLowerCase(), url: row.url, method: row.method,
    transport: row.transport, resource, mode: "dispatch", required_response: true,
    parent_scope: row.parent ? row.parent + "-" + resource.toLowerCase() : null,
  })))];
  const target = control === "query-order"
    ? descriptors[0].url.replace("dup=one&dup=two", "dup=two&dup=one")
    : control === "url-limit" ? descriptors[0].url + "&extra=" + "x".repeat(CAPS.url_bytes)
      : descriptors[0].url;
  const post = control === "request-limit" ? `new Uint8Array(${CAPS.request_bytes + 1})`
    : `new Uint8Array(${js([...POST])})`;
  let code;
  if (surface === "image") code = `await new Promise((r,j)=>{const i=new Image();i.onload=r;i.onerror=j;i.src=${js(target)};});`;
  else if (surface === "script") code = `await new Promise((r,j)=>{const s=document.createElement("script");s.onload=r;s.onerror=j;s.src=${js(target)};document.head.append(s);});`;
  else if (surface === "xhr") code = `await new Promise((r,j)=>{const x=new XMLHttpRequest();x.open("POST",${js(target)});x.responseType="arraybuffer";x.onload=r;x.onerror=j;x.send(${post});});`;
  else if (surface === "beacon") code = `if(!navigator.sendBeacon(${js(target)},${post}))throw Error("beacon_rejected");`;
  else if (surface === "fanout") code = `await Promise.all(${js(descriptors.map(row => row.url))}.map(u=>fetch(u).then(r=>r.arrayBuffer())));`;
  else code = `await fetch(${js(target)},${descriptors[0].method === "POST"
    ? `{method:"POST",body:${post}}` : "{}"}).then(r=>r.arrayBuffer());`;
  if (control === "unsupported-frame") code = `const f=document.createElement("iframe");f.src=${js(target)};document.body.append(f);`;
  if (control === "unsupported-popup") code = `window.open(${js(target)},"_blank");`;
  if (control === "unsupported-worker") code = `new Worker(${js(target)});`;
  if (control === "unsupported-service-worker") code = `await navigator.serviceWorker.register(${js(target)});`;
  if (control === "unsupported-websocket") code = `window.__surfaceSocket=new WebSocket(${js(target.replace("http:", "ws:"))});`;
  if (control === "wrong-transport") code = `const s=document.createElement("script");s.src=${js(target)};document.head.append(s);`;
  if (control === "invalid-parent") code = `await fetch(${js(descriptors[1].url)},{method:"POST",body:${post}});`;
  const fixture = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script>
window.__done=false;window.__failure=null;
(async()=>{try{${code}}catch(e){window.__failure=e.name;}finally{window.__done=true;}})();
</script></body></html>`);
  return { surface, leg, control, fixtureUrl, fixture, descriptors, scopes: scope };
}

async function receiver(state) {
  const server = createServer((request, response) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > CAPS.request_bytes) {
        state.errors.add("receiver_request_limit"); request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      const active = state.case;
      const row = { url: request.url, method: request.method, headers: request.rawHeaders,
        body_base64: Buffer.concat(chunks).toString("base64"),
        response_status: null, response_headers: null, response_body_base64: null };
      state.arrivals.push(row);
      const name = active?.descriptors.find(entry => new URL(entry.actualUrl ?? entry.url).pathname
        === new URL(request.url, state.origin).pathname)?.name;
      let body, status = 200;
      const headers = ["Cache-Control", "no-store", "X-Duplicate", "one", "X-Duplicate", "two"];
      if (!active || !name) {
        state.errors.add("unknown_receiver_request"); status = 403; body = Buffer.alloc(0);
      } else if (name === "redirect") {
        status = 307;
        body = active.control === "nonempty-redirect" ? POST : Buffer.alloc(0);
        headers.push("Location", active.descriptors[1].actualUrl ?? active.descriptors[1].url,
          "Set-Cookie", "first=one; Path=/; SameSite=Lax",
          "Set-Cookie", "second=two; Path=/; SameSite=Lax");
      } else if (name === "image") {
        body = GIF; headers.push("Content-Type", "image/gif");
      } else if (name === "script") {
        body = Buffer.from("window.__scriptObserved=true;");
        headers.push("Content-Type", "application/javascript");
      } else if (name === "beacon") { status = 204; body = Buffer.alloc(0); }
      else if (active.control === "unsupported-worker") {
        body = Buffer.from("self.postMessage('fixed-worker-control');");
        headers.push("Content-Type", "application/javascript");
      } else if (active.control === "unsupported-service-worker") {
        body = Buffer.from("self.addEventListener('install',()=>self.skipWaiting());");
        headers.push("Content-Type", "application/javascript");
      } else if (["unsupported-popup", "unsupported-frame"].includes(active.control)) {
        body = Buffer.from('<!doctype html><link rel="icon" href="data:,"><p>fixed-surface-control</p>');
        headers.push("Content-Type", "text/html");
      }
      else {
        body = active.control === "response-limit" ? Buffer.alloc(CAPS.response_bytes + 1) : FINAL;
        headers.push("Content-Type", "application/octet-stream");
      }
      headers.push("Content-Length", String(body.length));
      row.response_status = status;
      row.response_headers = [...headers];
      row.response_body_base64 = body.toString("base64");
      response.writeHead(status, headers).end(body);
    });
  });
  server.on("connection", socket => {
    state.sockets.add(socket); socket.once("close", () => state.sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    if (state.case?.control !== "unsupported-websocket") {
      state.errors.add("unexpected_websocket_upgrade"); socket.destroy(); return;
    }
    const accept = createHash("sha1").update(request.headers["sec-websocket-key"]
      + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    state.arrivals.push({ url: request.url, method: request.method, headers: request.rawHeaders,
      body_base64: "", response_status: 101, response_headers: [], response_body_base64: "" });
    socket.end("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  });
  state.server = server;
  await state.budget(() => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  }));
  state.origin = `http://127.0.0.1:${server.address().port}`;
  server.on("error", () => state.errors.add("receiver_failed"));
}

// Fixed first-party local fixture only. This is not exported as a live executor.
async function captureCase(state, surface, leg, control = "none") {
  const plan = planFor(state.origin, surface, leg, control);
  state.case = plan;
  const localId = `${surface}-${leg}-${control}`;
  const authority = {
    schema_version: 1, status: "approved", evidence_layer: "local-control",
    authority_id: "synthetic-" + localId, source_revision: state.source,
    expires_at_ms: state.wallDeadline, journal_dir: join(state.outputDir, localId),
    limits: { ...CAPS },
    cases: [{ case_name: "google-stock", input_digest: hash(plan.fixture),
      ownership_marker: "probe", scopes: plan.scopes }],
  };
  const gate = reserveCase({ authority, case_name: "google-stock",
    source_revision: state.source, input_digest: hash(plan.fixture), prerequisites: null });
  const row = { id: localId, surface, leg, control, requests: [], initiators: [], extra_requests: [],
    extra_responses: [], failures: [], cleanup: {}, gate: null, arrivals: [],
    gaps: [], passed: false };
  const arrivalStart = state.arrivals.length;
  const context = await state.budget(() => state.browser.newContext({ serviceWorkers: "block" }));
  state.contexts.add(context);
  await state.budget(() => context.grantPermissions(["local-network-access"], { origin: state.origin }));
  const page = await state.budget(() => context.newPage());
  const session = await state.budget(() => context.newCDPSession(page));
  const tasks = new Set(), byFetchId = new Map();
  let stopped = false, closing = false, ended = false, localRetained = 0;
  const fail = reason => { row.failures.push(reason); stopped = true; };
  const track = task => {
    tasks.add(task);
    task.then(() => tasks.delete(task), () => tasks.delete(task));
  };
  const hooks = [];
  state.cleanupHooks.set(context, { hooks, row, tasks });
  const on = (object, event, listener) => { object.on(event, listener); hooks.push([object, event, listener]); };
  const unsupported = kind => {
    fail(kind);
    track(context.close().catch(() => { row.failures.push("unsupported_cleanup_failed"); }));
  };
  on(context, "page", () => unsupported("unsupported_page"));
  on(context, "serviceworker", () => unsupported("unsupported_service_worker"));
  on(page, "frameattached", () => unsupported("unsupported_frame"));
  on(page, "worker", () => unsupported("unsupported_worker"));
  on(page, "websocket", () => unsupported("unsupported_websocket"));
  on(page, "pageerror", () => fail("fixture_page_error"));
  on(page, "console", message => {
    if (message.type() === "warning" && message.text() === "Service Worker registration blocked by Playwright")
      unsupported("unsupported_service_worker");
  });
  await state.budget(() => context.exposeBinding("__airlockBlockedSurface", (_source, directive) => {
    if (!ended) unsupported(directive === "worker-src" ? "unsupported_worker" : "unsupported_csp_surface");
  }));
  await state.budget(() => context.addInitScript(() => {
    window.__airlockBlockedDirectives = [];
    document.addEventListener("securitypolicyviolation", event => {
      window.__airlockBlockedDirectives.push(event.effectiveDirective);
      void window.__airlockBlockedSurface(event.effectiveDirective);
    });
  }));
  await state.budget(() => context.routeWebSocket("**/*", socket => {
    fail("unsupported_websocket"); socket.close();
  }));
  await state.budget(() => context.route("**/*", async route => {
    let rootFrame = false;
    try { rootFrame = route.request().frame() === page.mainFrame(); }
    catch { fail("unsupported_request_context"); }
    if (stopped || !rootFrame) {
      fail("unsupported_or_stopped_request");
      await route.abort("blockedbyclient");
    } else await route.continue();
  }));
  await state.budget(() => session.send("Network.enable", {
    maxTotalBufferSize: CAPS.retained_bytes, maxResourceBufferSize: CAPS.response_bytes,
    maxPostDataSize: CAPS.request_bytes,
  }));
  on(session, "Network.requestWillBeSentExtraInfo", event => {
    row.extra_requests.push(event);
    if (Buffer.byteLength(JSON.stringify(event.headers)) > CAPS.request_bytes) fail("final_headers_limit");
  });
  on(session, "Network.responseReceivedExtraInfo", event => { row.extra_responses.push(event); });
  on(session, "Network.requestWillBeSent", event => {
    row.initiators.push({ network_id: event.requestId, url: event.request.url,
      initiator: event.initiator, redirect_response: event.redirectResponse ?? null,
      frame_id: event.frameId ?? null });
  });
  on(session, "Fetch.requestPaused", event => track((async () => {
    const abort = () => session.send("Fetch.failRequest", {
      requestId: event.requestId, errorReason: "BlockedByClient",
    });
    if (stopped || closing || state.expired()) { fail("admission_stopped"); await abort(); return; }
    if (event.responseStatusCode !== undefined) {
      const request = byFetchId.get(event.requestId);
      if (!request) { fail("unpaired_response"); await abort(); return; }
      const responseHeaders = event.responseHeaders ?? [];
      request.response = { status: event.responseStatusCode, headers: responseHeaders,
        body_base64: null, body_state: "unavailable" };
      const contentLength = responseHeaders.filter(header => header.name.toLowerCase() === "content-length");
      const framedEmpty = event.responseStatusCode === 204
        || (contentLength.length === 1 && contentLength[0].value === "0");
      if (control === "missing-body") {
        row.gaps.push("injected_missing_body"); fail("response_body_unavailable"); await abort(); return;
      }
      if (control === "late-read") {
        // Deliberate matched failure before any read; never publish a timed-out pass.
        try { await state.budget(() => sleep(150), 50); }
        catch { fail("response_read_deadline"); await abort(); return; }
      }
      let body;
      if (framedEmpty) {
        body = Buffer.alloc(0); request.response.body_state = "empty_http_framing";
      } else {
        try {
          const retained = await state.budget(() => session.send("Fetch.getResponseBody", {
            requestId: event.requestId,
          }));
          body = Buffer.from(retained.body, retained.base64Encoded ? "base64" : "utf8");
          request.response.body_state = "captured_original";
        } catch {
          row.gaps.push("original_response_body_unavailable");
          fail("response_body_unavailable"); await abort(); return;
        }
      }
      const completed = gate.complete({ ordinal: request.ordinal,
        headers: Buffer.from(JSON.stringify(responseHeaders)), body, complete: true });
      if (completed.state === "failed") {
        fail(completed.category); await abort(); return;
      }
      request.response.body_base64 = body.toString("base64");
      await session.send("Fetch.continueResponse", { requestId: event.requestId });
      return;
    }
    const request = event.request;
    const fixture = request.url === plan.fixtureUrl;
    const descriptor = plan.descriptors.find(entry => entry.url === request.url);
    let body = Buffer.alloc(0), bodyState = "absent";
    if (request.hasPostData || request.postDataEntries || request.postData !== undefined) {
      if (request.postDataEntries?.length
        && request.postDataEntries.every(entry => typeof entry.bytes === "string")) {
        body = Buffer.concat(request.postDataEntries.map(entry => Buffer.from(entry.bytes, "base64")));
        bodyState = "captured_original_entries";
      } else {
        fail("original_request_body_unavailable"); await abort(); return;
      }
    }
    const observation = {
      url: request.url, method: request.method, resource: event.resourceType,
      transport: fixture ? "document" : descriptor?.transport ?? "fetch",
      ownership_marker: fixture || descriptor ? "probe" : "unknown",
      parent_ordinal: event.redirectedRequestId
        ? byFetchId.get(event.redirectedRequestId)?.ordinal ?? null : null,
      headers: Buffer.from(JSON.stringify(request.headers)), body,
    };
    const permission = gate.admit(observation);
    const entry = {
      ordinal: permission.ordinal, url: request.url, query_pairs: [...new URL(request.url).searchParams],
      method: request.method, resource: event.resourceType, declared_fixture_transport: observation.transport,
      headers: request.headers, headers_state: "request_pause_not_final",
      body_base64: body.toString("base64"), body_state: bodyState, network_id: event.networkId ?? null,
      parent_ordinal: observation.parent_ordinal, continued: false, local: false, aborted: false,
      redirected_from_fetch_id: event.redirectedRequestId ?? null, response: null,
    };
    row.requests.push(entry);
    byFetchId.set(event.requestId, entry);
    if (!permission.allowed) { fail(permission.result.category); entry.aborted = true; await abort(); return; }
    if (fixture) {
      const headers = [
        { name: "Content-Type", value: "text/html; charset=utf-8" },
        { name: "Content-Security-Policy", value: `default-src 'none'; script-src 'unsafe-inline' ${state.origin}; connect-src ${state.origin} ${state.origin.replace("http:", "ws:")}; img-src ${state.origin} data:; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` },
      ];
      gate.complete({ ordinal: permission.ordinal, headers: Buffer.from(JSON.stringify(headers)),
        body: plan.fixture, complete: true });
      localRetained = gate.report().counts.retained_bytes;
      entry.local = true;
      entry.response = { status: 200, headers, body_base64: plan.fixture.toString("base64"),
        body_state: "generated_fixture" };
      await session.send("Fetch.fulfillRequest", { requestId: event.requestId,
        responseCode: 200, responseHeaders: headers, body: plan.fixture.toString("base64") });
    } else if (leg === "enforced") {
      entry.aborted = true; fail("enforced_denial"); await abort();
    } else {
      entry.continued = true;
      await session.send("Fetch.continueRequest", { requestId: event.requestId });
    }
  })().catch(() => {
    if (!closing && !ended) {
      fail("capture_or_deadline_failure");
      track(context.close().catch(() => { row.failures.push("capture_cleanup_failed"); }));
    }
  })));
  try {
    await state.budget(() => session.send("Fetch.enable", { patterns: [
      { urlPattern: "*", requestStage: "Request" }, { urlPattern: "*", requestStage: "Response" },
    ] }));
    await state.budget(() => page.goto(plan.fixtureUrl, { waitUntil: "load", timeout: 5000 }));
    await state.budget(() => page.waitForFunction(() => window.__done === true, null, { timeout: 3000 }));
    // Beacon and event delivery can outlive the fixture's synchronous completion.
    await state.budget(() => sleep(100));
    if (!stopped && (await state.budget(() => page.evaluate(() => window.__airlockBlockedDirectives))).length)
      fail("unsupported_csp_surface");
    while (tasks.size) await state.budget(() => sleep(5));
  } catch {
    if (!stopped) fail("fixture_or_settle_failure");
  } finally {
    closing = true;
    try {
      if (control !== "cleanup-failure") {
        await state.budget(() => context.close());
        row.cleanup.context_closed = true;
      }
    } catch { row.failures.push("context_cleanup_failed"); }
    if (!row.cleanup.context_closed) {
      if (!row.failures.includes("context_cleanup_failed")) row.failures.push("context_cleanup_failed");
      row.cleanup.first_close_failed = true;
      row.cleanup.guards_retained_for_retry = hooks.every(([object, event, listener]) =>
        object.listeners(event).includes(listener));
    }
    if (row.cleanup.context_closed) state.contexts.delete(context);
    while (tasks.size && !state.expired()) await sleep(5);
    ended = true;
    if (row.cleanup.context_closed) {
      hooks.forEach(([object, event, listener]) => object.off(event, listener));
      state.cleanupHooks.delete(context);
    }
    row.cleanup.observers_removed = row.cleanup.context_closed === true
      && hooks.every(([object, event, listener]) => !object.listeners(event).includes(listener));
    row.cleanup.pending_tasks = tasks.size;
    row.arrivals = state.arrivals.slice(arrivalStart);
    row.gate = gate.terminate({
      observers_removed: row.cleanup.observers_removed, pending_requests_settled: tasks.size === 0,
      owned_resources_closed: row.cleanup.context_closed === true,
    });
  }
  const dispatched = row.requests.filter(entry => entry.continued);
  const seen = new Map();
  for (const entry of dispatched) {
    const index = seen.get(entry.network_id) ?? 0;
    seen.set(entry.network_id, index + 1);
    entry.final_request_extra = row.extra_requests.filter(event => event.requestId === entry.network_id)[index] ?? null;
    entry.final_response_extra = row.extra_responses.filter(event => event.requestId === entry.network_id)[index] ?? null;
    entry.initiator = row.initiators.find(event => event.url === entry.url)?.initiator ?? null;
  }
  const fields = headers => {
    const pairs = [];
    for (let index = 0; index < headers.length; index += 2)
      pairs.push([headers[index].toLowerCase(), headers[index + 1]]);
    return pairs;
  };
  const samePairs = (a, b) => JSON.stringify(a.map(pair => JSON.stringify(pair)).sort())
    === JSON.stringify(b.map(pair => JSON.stringify(pair)).sort());
  const rawFields = text => typeof text === "string" ? text.split("\r\n").slice(1)
    .filter(line => line.length > 0).map(line => {
      const at = line.indexOf(":");
      return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trimStart()];
    }) : null;
  let retainedFinalBytes = localRetained;
  const observed = dispatched.length > 0 && dispatched.every(entry => {
    const hit = row.arrivals.find(arrival => state.origin + arrival.url === entry.url);
    return hit && hit.method === entry.method && hit.body_base64 === entry.body_base64
      && entry.response?.body_base64 === hit.response_body_base64
      && entry.response?.status === hit.response_status;
  });
  const extras = dispatched.length > 0 && dispatched.every(entry =>
    entry.final_request_extra !== null && entry.final_response_extra !== null && entry.initiator !== null);
  const headersVerified = dispatched.length > 0 && dispatched.every(entry => {
    const hit = row.arrivals.find(arrival => state.origin + arrival.url === entry.url);
    if (!hit || !entry.final_request_extra || !entry.final_response_extra) return false;
    const finalHeaders = Object.entries(entry.final_request_extra.headers)
      .flatMap(([name, value]) => value.split("\n").map(part => [name.toLowerCase(), part]));
    const rawResponse = rawFields(entry.final_response_extra.headersText);
    const declaredResponse = fields(hit.response_headers);
    const responseHeaders = rawResponse ?? [];
    const requestsMatch = samePairs(finalHeaders, fields(hit.headers));
    const responsesMatch = declaredResponse.every(pair => responseHeaders.some(found =>
      found[0] === pair[0] && found[1] === pair[1]));
    const requestBytes = Buffer.byteLength(JSON.stringify(finalHeaders))
      + Buffer.from(entry.body_base64, "base64").length;
    const responseBytes = Buffer.byteLength(JSON.stringify(responseHeaders))
      + Buffer.from(entry.response?.body_base64 ?? "", "base64").length;
    retainedFinalBytes += Buffer.byteLength(entry.url) + requestBytes + responseBytes;
    if (requestBytes > CAPS.request_bytes || responseBytes > CAPS.response_bytes
      || retainedFinalBytes > CAPS.retained_bytes) row.failures.push("final_wire_byte_limit");
    return requestsMatch && responsesMatch && rawResponse !== null;
  });
  const targetArrival = row.arrivals.find(arrival => arrival.url.startsWith("/target?"));
  const cookieVerified = surface !== "redirect" || !!targetArrival
    && fields(targetArrival.headers).some(([name, value]) => name === "cookie"
      && value.includes("first=one") && value.includes("second=two"));
  row.byte_comparison = observed;
  row.extra_info_present = extras;
  row.final_headers_match_sink = headersVerified;
  row.redirect_cookie_attachment = cookieVerified;
  row.final_observed_retained_bytes = retainedFinalBytes;
  row.passed = leg === "enforced" ? row.arrivals.length === 0 && row.failures.includes("enforced_denial")
    : row.arrivals.length === plan.descriptors.length && observed && extras && headersVerified && cookieVerified
      && row.gate.state === "succeeded" && row.failures.length === 0;
  return row;
}

async function unsupportedPositive(state, control) {
  const plan = planFor(state.origin, "fetch-post", "surface-bypass", control);
  const start = state.arrivals.length;
  const context = await state.budget(() => state.browser.newContext({
    serviceWorkers: control === "unsupported-service-worker" ? "allow" : "block",
  }));
  state.contexts.add(context);
  await state.budget(() => context.grantPermissions(["local-network-access"], { origin: state.origin }));
  const page = await state.budget(() => context.newPage());
  const observed = new Set();
  const listeners = [
    [context, "page", () => observed.add("unsupported-popup")],
    [context, "serviceworker", () => observed.add("unsupported-service-worker")],
    [page, "frameattached", () => observed.add("unsupported-frame")],
    [page, "worker", () => observed.add("unsupported-worker")],
    [page, "websocket", socket => {
      observed.add("unsupported-websocket");
      socket.on("socketerror", message => {
        result.socket_error_code = /net::[A-Z_]+/.exec(message)?.[0] ?? "socket_error";
      });
    }],
  ];
  listeners.forEach(([target, event, listener]) => target.on(event, listener));
  state.case = plan;
  const result = { id: control + "-matched-bypass", surface: control,
    guard_bypassed: true, arrivals: 0, observed: false, context_closed: false,
    blocked_routes: 0, request_failures: 0, passed: false };
  state.controlDiagnostic = result;
  page.on("requestfailed", () => { result.request_failures++; });
  try {
    await state.budget(() => context.route("**/*", async route => {
      if (route.request().url() === plan.fixtureUrl) {
        await route.fulfill({ contentType: "text/html", body: plan.fixture });
      } else if (plan.descriptors.some(row => row.url === route.request().url())) await route.continue();
      else { result.blocked_routes++; await route.abort("blockedbyclient"); }
    }));
    await state.budget(() => page.goto(plan.fixtureUrl, { waitUntil: "load", timeout: 3000 }));
    const cutoff = performance.now() + 2000;
    while (state.arrivals.length === start || !observed.has(control)) {
      if (state.expired() || performance.now() >= cutoff) break;
      await sleep(5);
    }
  } finally {
    try {
      await state.budget(() => context.close(), 1500);
      state.contexts.delete(context);
      listeners.forEach(([target, event, listener]) => target.off(event, listener));
      result.context_closed = true;
    } catch {
      state.errors.add("unsupported_positive_cleanup_failed");
    }
    result.arrivals = state.arrivals.length - start;
    result.observed = observed.has(control);
  }
  result.passed = result.arrivals === 1 && result.observed && result.context_closed;
  return result;
}

export async function runBrowserQualification(options) {
  if (!checkedKeys(options, ["outputDir", "control", "mode"])
    || typeof options.outputDir !== "string" || !isAbsolute(options.outputDir)
    || !CONTROLS.includes(options.control ?? "none")
    || !["headless", "headed"].includes(options.mode ?? "headless")) throw error("invalid_options");
  const started = performance.now(), wallDeadline = Date.now() + CAPS.duration_ms;
  try {
    const parent = lstatSync(dirname(options.outputDir));
    if (!parent.isDirectory() || parent.isSymbolicLink()) throw error("output_unavailable");
    mkdirSync(options.outputDir, { mode: 0o700 });
    if ((lstatSync(options.outputDir).mode & 0o7777) !== 0o700) throw error("output_unavailable");
    syncDirectory(dirname(options.outputDir));
  } catch { throw error("output_unavailable"); }
  const state = { outputDir: options.outputDir, source: null, origin: null,
    errors: new Set(), arrivals: [], contexts: new Set(), case: null, browser: null,
    server: null, sockets: new Set(), cleanupHooks: new Map(), wallDeadline,
    expired: () => performance.now() - started > CAPS.duration_ms };
  state.budget = async (work, maximum = CAPS.duration_ms) => {
    const remaining = Math.min(maximum, CAPS.duration_ms - (performance.now() - started));
    if (remaining <= 0) throw error("run_deadline");
    let timer;
    try {
      const value = await Promise.race([Promise.resolve().then(work),
        new Promise((_resolve, reject) => { timer = setTimeout(() => reject(error("run_deadline")), remaining); })]);
      if (state.expired()) throw error("run_deadline");
      return value;
    } finally { clearTimeout(timer); }
  };
  const result = { schema_version: 1, run_id: randomUUID(), evidence_layer: "local_browser_admission",
    overall: "inconclusive", exit_code: 2, errors: [], cohort: null, provenance: null,
    matrix: [], control: options.control ?? "none", cleanup: {}, claims };
  const raw = { schema_version: 1, run_id: result.run_id, cases: [], surface_positives: [] };
  let browserServer;
  const kill = () => {
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    for (const socket of state.sockets) socket.destroy();
    state.server?.closeAllConnections();
    if (state.server?.listening) state.server.close();
  };
  const watchdog = setTimeout(() => { state.errors.add("run_deadline"); kill(); },
    Math.max(0, CAPS.duration_ms - (performance.now() - started)));
  try {
    if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0")
      throw error("cohort_mismatch");
    const macos = (await state.budget(() => execute("/usr/bin/sw_vers", ["-productVersion"],
      { timeout: 2000, maxBuffer: 4096 }))).stdout.trim();
    if (macos !== "27.0.1") throw error("cohort_mismatch");
    const source = await readFile(fileURLToPath(import.meta.url));
    state.source = hash(source);
    result.provenance = {
      runner_sha256: state.source, launcher_sha256: hash(await readFile(LAUNCHER)),
      policy_sha256: hash(await readFile(POLICY)),
      admission_sha256: hash(await readFile(new URL("./first-journey-admission.mjs", import.meta.url))),
      playwright: {
        version: JSON.parse(await readFile(new URL("./package.json", import.meta.resolve("playwright")), "utf8")).version,
        entry_sha256: hash(await readFile(fileURLToPath(import.meta.resolve("playwright")))),
        package_lock_sha256: hash(await readFile(new URL("../package-lock.json", import.meta.url))),
      },
    };
    await receiver(state);
    const resolverRows = [];
    for (const path of ["/var/run/mDNSResponder", "/private/var/run/mDNSResponder"]) {
      const probe = `
        const net=require("node:net");let done=false;
        const s=net.createConnection({path:process.argv[1]});
        const finish=v=>{if(done)return;done=true;clearTimeout(t);s.destroy();console.log(v)};
        const t=setTimeout(()=>finish("timeout"),750);
        s.once("connect",()=>finish("connected"));s.once("error",e=>finish(e.code));
      `;
      const args = ["-e", probe, path];
      const settings = { timeout: 2000, maxBuffer: 4096 };
      const positive = (await state.budget(() => execute(process.execPath, args, settings))).stdout.trim();
      const confined = (await state.budget(() => execute("/usr/bin/sandbox-exec",
        ["-f", POLICY, process.execPath, ...args], settings))).stdout.trim();
      resolverRows.push({ positive: positive === "connected",
        denied: ["EPERM", "EACCES"].includes(confined), query_payload_sent: false });
    }
    result.resolver_controls = resolverRows;
    if (!resolverRows.every(row => row.positive && row.denied)) throw error("resolver_control_failed");
    const { chromium } = await import("playwright");
    const launching = chromium.launchServer({
      executablePath: LAUNCHER, host: "127.0.0.1",
      headless: options.mode !== "headed", timeout: 10000,
      args: ["--disable-background-networking", "--dns-prefetch-disable"],
    }).then(server => {
      browserServer = server;
      if (state.expired()) kill();
      return server;
    });
    await state.budget(() => launching);
    state.browser = await state.budget(() => chromium.connect(browserServer.wsEndpoint()));
    if (state.browser.version() !== "155.0.8059.80") throw error("cohort_mismatch");
    result.cohort = { node: process.version, browser: state.browser.version(), macos,
      darwin: release(), mode: options.mode ?? "headless", chrome_executable: CHROME,
      local_fixture_permission: "origin_scoped_local_network_access_in_fresh_synthetic_context_only" };
    for (const surface of SURFACES) {
      for (const leg of ["positive", "enforced", "bypass"]) {
        const captured = await captureCase(state, surface, leg);
        raw.cases.push(captured);
        if (!captured.cleanup.context_closed) throw error("case_cleanup_failed");
        result.matrix.push({
          surface, leg, arrivals: captured.arrivals.length, passed: captured.passed,
          admitted: captured.gate.counts.admitted_requests, dispatch_reservations: captured.gate.counts.dispatches,
          byte_comparison: captured.byte_comparison, extra_info_present: captured.extra_info_present,
          final_headers_match_sink: captured.final_headers_match_sink,
          redirect_cookie_attachment: captured.redirect_cookie_attachment,
          errors: [...new Set(captured.failures)], gate_category: captured.gate.category,
        });
        if (!captured.passed) state.errors.add("local_matrix_failed");
      }
    }
    if (!["none", "output-failure", "output-deadline"].includes(result.control)) {
      let matchedPositive = null;
      if (result.control.startsWith("unsupported-")) {
        matchedPositive = await unsupportedPositive(state, result.control);
        raw.surface_positives.push(matchedPositive);
        if (!matchedPositive.passed) throw error("unsupported_positive_failed");
      }
      const surface = ["nonempty-redirect", "marker-loss", "invalid-parent"].includes(result.control)
        ? "redirect" : result.control === "wrong-transport" ? "fetch-get" : "fetch-post";
      const captured = await captureCase(state, surface, "positive", result.control);
      raw.cases.push(captured);
      const intended = {
        "missing-body": "response_body_unavailable", "late-read": "response_read_deadline",
        "response-limit": "response_limit", "nonempty-redirect": "response_body_unavailable",
        "request-limit": "request_limit", "url-limit": "url_limit",
        "wrong-transport": "scope_mismatch", "invalid-parent": "parent_invalid",
        "cleanup-failure": "context_cleanup_failed",
        "marker-loss": "scope_mismatch", "query-order": "scope_mismatch",
        "unsupported-frame": "unsupported_frame", "unsupported-popup": "unsupported_page",
        "unsupported-worker": "unsupported_worker", "unsupported-websocket": "unsupported_websocket",
        "unsupported-service-worker": "unsupported_service_worker",
      }[result.control];
      result.negative = { intended, detected: captured.failures.includes(intended),
        arrivals: captured.arrivals.length, errors: [...new Set(captured.failures)],
        positive_link: matchedPositive ? null
          : result.matrix.findIndex(row => row.surface === surface && row.leg === "positive"),
        matched_positive: matchedPositive };
      if (!result.negative.detected) state.errors.add("intended_control_not_detected");
      state.errors.add("applied_negative_control");
    }
  } catch (caught) {
    state.errors.add(caught.category ?? "qualification_failed");
  } finally {
    const cleanupWait = async work => {
      let timer;
      try {
        return await Promise.race([Promise.resolve().then(work),
          new Promise((_resolve, reject) => { timer = setTimeout(() => reject(error("cleanup_deadline")), 1500); })]);
      } finally { clearTimeout(timer); }
    };
    for (const context of state.contexts) {
      try {
        await cleanupWait(() => context.close());
        state.contexts.delete(context);
        const owned = state.cleanupHooks.get(context);
        if (owned) {
          owned.hooks.forEach(([object, event, listener]) => object.off(event, listener));
          owned.row.cleanup.context_closed = true;
          owned.row.cleanup.retry_closed = true;
          owned.row.cleanup.observers_removed = true;
          owned.row.cleanup.pending_tasks = owned.tasks.size;
          state.cleanupHooks.delete(context);
        }
      }
      catch { state.errors.add("context_cleanup_failed"); }
    }
    if (state.browser) {
      try { await cleanupWait(() => state.browser.close()); }
      catch { state.errors.add("browser_cleanup_failed"); kill(); }
    }
    if (browserServer) {
      try { await cleanupWait(() => browserServer.close()); }
      catch {
        state.errors.add("browser_server_cleanup_failed"); kill();
        try { await cleanupWait(() => browserServer.kill()); }
        catch { state.errors.add("browser_server_kill_failed"); }
      }
    }
    result.cleanup.process_exited = !!browserServer
      && (browserServer.process().exitCode !== null || browserServer.process().signalCode !== null);
    if (state.server?.listening) {
      for (const socket of state.sockets) socket.destroy();
      state.server.closeAllConnections();
      await new Promise(resolve => state.server.close(() => resolve()));
    }
    result.cleanup.server_closed = !!state.server && !state.server.listening;
    result.cleanup.contexts_closed = state.contexts.size === 0 && raw.cases.length > 0
      && raw.cases.every(row => row.cleanup.context_closed === true);
    result.cleanup.observers_removed = state.cleanupHooks.size === 0 && raw.cases.length > 0
      && raw.cases.every(row => row.cleanup.observers_removed === true);
    result.cleanup.pending_settled = raw.cases.length > 0
      && raw.cases.every(row => row.cleanup.pending_tasks === 0);
    if (!Object.values(result.cleanup).every(value => value === true)) state.errors.add("cleanup_incomplete");
    if (state.expired()) state.errors.add("run_deadline");
    result.errors = [...state.errors];
    if (state.controlDiagnostic) result.control_diagnostic = state.controlDiagnostic;
    result.overall = result.errors.length ? "inconclusive" : "qualified_local";
    result.exit_code = result.errors.length ? 2 : 0;
    try {
      await state.budget(() => privateJson(join(state.outputDir, "capture.json"), raw));
      await state.budget(() => privateJson(join(state.outputDir, "report.json"), result));
      if (result.control === "output-failure") await state.budget(() => { throw error("injected_output_failure"); });
      if (result.control === "output-deadline") await state.budget(() => sleep(150), 50);
      await state.budget(() => privateJson(join(state.outputDir, "completion.json"), {
        run_id: result.run_id, result_exit_code: result.exit_code,
        command_exit_observed: false, cleanup: result.cleanup,
        report_sha256: hash(readFileSync(join(state.outputDir, "report.json"))),
        capture_sha256: hash(readFileSync(join(state.outputDir, "capture.json"))),
      }));
    } catch {
      state.errors.add("output_or_deadline_failure");
      result.errors = [...state.errors]; result.overall = "inconclusive"; result.exit_code = 2;
    }
    clearTimeout(watchdog);
  }
  return result;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args[0] !== "--output-dir" || ![2, 4, 6].includes(args.length)) {
    console.error("usage: node rig/first-journey-browser.mjs --output-dir <new-private-directory> [--control <fixed-control>] [--mode headed]");
    process.exitCode = 3;
  } else {
    const options = { outputDir: args[1] };
    let valid = true;
    for (let index = 2; index < args.length; index += 2) {
      const key = args[index] === "--control" ? "control" : args[index] === "--mode" ? "mode" : null;
      if (!key || Object.hasOwn(options, key)) { valid = false; break; }
      options[key] = args[index + 1];
    }
    try {
      if (!valid) throw error("invalid_options");
      const result = await runBrowserQualification(options);
      console.log(JSON.stringify({ overall: result.overall, exit_code: result.exit_code,
        cases: result.matrix.length, errors: result.errors, cleanup: result.cleanup,
        claims: result.claims }));
      process.exitCode = result.exit_code;
    } catch (caught) {
      console.error(caught.category ?? "qualification_failed"); process.exitCode = 3;
    }
  }
}
