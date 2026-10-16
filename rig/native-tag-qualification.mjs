import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const CASES = ["fetch_get", "fetch_post", "image", "xhr", "beacon", "redirect", "fanout"];
const LEGS = ["positive", "enforced", "bypass"];
const CONTROLS = ["none", "empty-reference", "dropped-request", "missing-response",
  "hung-read", "wrong-body", "guard-bypass", "broken-positive", "request-body-limit",
  "response-body-limit", "aggregate-body-limit", "request-limit", "url-byte-limit",
  "dropped-redirect-branch", "dropped-fanout-branch", "delayed-read", "late-response",
  "late-response-timeout", "transport-abort", "run-timeout", "cleanup-timeout", "output-timeout",
  "directory-timeout"];
const LIMITS = Object.freeze({
  maxRequests: 64, maxUrlBytes: 2048, maxRequestBytes: 65536,
  maxResponseBytes: 1048576, maxTotalBytes: 4194304,
  settleMs: 5000, runMs: 60000,
});
const MARKER = "qualification-private-marker";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const stamp = () => new Date().toISOString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => createHash("sha256").update(value).digest("hex");

class QualificationError extends Error {
  constructor(category) { super(category); this.category = category; }
}

function report(overall, errors, runId = randomUUID()) {
  return {
    schema_version: 1,
    run_id: runId,
    evidence_layer: "local_network",
    overall,
    exit_code: { qualified: 0, nonconformant: 1, inconclusive: 2, invalid_input: 3 }[overall],
    errors,
    expected_positive_cases: [],
    observation_window: null,
    provenance: null,
    capture_complete: false,
    guard: { mechanism: "cdp_fetch_request_stage", qualified: false },
    claims: {
      vendor_dispatch_verified: false,
      vendor_receipt_verified: false,
      chamber_compatibility_verified: false,
      matching_verified: false,
      attribution_verified: false,
      full_support_verified: false,
    },
  };
}

function setOutcome(result, overall, errors) {
  result.overall = overall;
  result.exit_code = { qualified: 0, nonconformant: 1, inconclusive: 2, invalid_input: 3 }[overall];
  result.errors = [...new Set(errors)];
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

async function until(predicate, milliseconds = 1500) {
  const deadline = Date.now() + milliseconds;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new QualificationError("observation_timeout");
    await delay(10);
  }
}

function createBudget(milliseconds, errors, forceCleanup) {
  const deadline = Date.now() + milliseconds;
  const controller = new AbortController();
  const expired = () => {
    errors.add("run_deadline_exceeded");
    controller.abort();
    forceCleanup();
  };
  const watchdog = setTimeout(expired, milliseconds);
  return {
    signal: controller.signal,
    remaining: () => Math.max(0, deadline - Date.now()),
    async wait(work, category, reserve = 0) {
      const remaining = deadline - Date.now() - reserve;
      if (remaining <= 0) {
        errors.add(category);
        forceCleanup();
        throw new QualificationError(category);
      }
      let timer;
      try {
        return await Promise.race([
          Promise.resolve().then(work),
          new Promise((_resolve, reject) => {
            timer = setTimeout(() => {
              errors.add(category);
              forceCleanup();
              reject(new QualificationError(category));
            }, remaining);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    finish() { clearTimeout(watchdog); },
  };
}

async function startSink(role, state) {
  if (state.executionStopped) throw new QualificationError("execution_stopped");
  let origin;
  const server = createServer((request, response) => {
    let url;
    try { url = new URL(request.url, origin); } catch {
      state.errors.add("invalid_local_request");
      response.writeHead(400).end();
      return;
    }
    const name = url.searchParams.get("case");
    const leg = url.searchParams.get("leg");
    if (url.origin !== origin || url.username || url.password || url.hash) {
      response.writeHead(400).end();
      state.errors.add("invalid_local_request");
      return;
    }
    if (Buffer.byteLength(`${origin}${request.url}`) > LIMITS.maxUrlBytes) {
      state.errors.add("url_byte_limit");
      response.writeHead(414).end();
      return;
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      Connection: "close",
    };
    if (url.pathname === "/fixture" || url.pathname === "/favicon.ico") {
      const body = url.pathname === "/fixture"
        ? Buffer.from("<!doctype html><html><body>Local qualification fixture</body></html>")
        : Buffer.alloc(0);
      response.writeHead(200, {
        ...headers, "Content-Type": "text/html", "Content-Length": body.length,
      }).end(body);
      return;
    }
    if (!CASES.includes(name) || !LEGS.includes(leg)
      || !["/target", "/redirect", "/fanout"].includes(url.pathname)) {
      response.writeHead(400, headers).end();
      state.errors.add("invalid_fixture_request");
      return;
    }
    let size = 0;
    const chunks = [];
    request.on("error", () => state.errors.add("receiver_read_failed"));
    request.on("data", chunk => {
      size += chunk.length;
      if (size > LIMITS.maxRequestBytes) {
        state.errors.add("request_byte_limit");
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      if (state.received.length >= LIMITS.maxRequests) {
        state.errors.add("request_limit");
        response.writeHead(413, headers).end();
        return;
      }
      const target = `${state.tripwire}/target?case=${name}&leg=${leg}`;
      let body = Buffer.from(`${MARKER}:${name}`);
      let status = 200;
      let contentType = "text/plain";
      if (url.pathname === "/redirect") {
        status = 302;
        body = Buffer.alloc(0);
        headers.Location = target;
      } else if (url.pathname === "/fanout") {
        body = Buffer.from(JSON.stringify({ next: target }));
        contentType = "application/json";
      } else if (name === "image") {
        body = GIF;
        contentType = "image/gif";
      }
      if (leg === "positive" && name === "fetch_get" && url.pathname === "/target") {
        if (state.control === "response-body-limit")
          body = Buffer.alloc(LIMITS.maxResponseBytes + 1, 65);
        if (state.control === "aggregate-body-limit")
          body = Buffer.alloc(LIMITS.maxResponseBytes, 65);
      }
      const requestBody = Buffer.concat(chunks);
      const row = {
        role, name, leg, url: `${origin}${request.url}`, method: request.method,
        headers: { ...request.headers }, body_bytes: requestBody.length,
        body_sha256: hash(requestBody), response_status: null,
        response_body_bytes: null, response_body_sha256: null, response_delivery: "pending",
      };
      state.received.push(row);
      let done = false;
      const send = () => {
        if (done) return;
        done = true;
        row.response_status = status;
        row.response_body_bytes = body.length;
        row.response_body_sha256 = hash(body);
        row.response_delivery = "sent";
        response.writeHead(status, {
          ...headers, "Content-Type": contentType, "Content-Length": body.length,
        }).end(body);
      };
      const cancel = () => {
        if (done) return;
        done = true;
        row.response_delivery = "cancelled_by_cleanup";
        response.destroy();
      };
      const firstTarget = leg === "positive" && name === "fetch_get"
        && url.pathname === "/target";
      if (firstTarget && state.control === "transport-abort") {
        done = true;
        row.response_delivery = "aborted_without_guard";
        response.destroy();
      } else if (firstTarget && ["late-response", "late-response-timeout"].includes(state.control)) {
        state.pendingResponses.push({ leg, send, cancel });
      } else send();
    });
  });
  server.requestTimeout = LIMITS.settleMs;
  server.headersTimeout = LIMITS.settleMs;
  server.keepAliveTimeout = 1;
  const resource = { server, origin: null, closed: false };
  state.sinks.push(resource);
  server.once("close", () => { resource.closed = true; });
  await new Promise((resolve, reject) => {
    const onError = error => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  server.on("error", () => state.errors.add("receiver_server_failed"));
  origin = `http://127.0.0.1:${server.address().port}`;
  resource.origin = origin;
  if (state.executionStopped) {
    server.closeAllConnections();
    server.close();
    throw new QualificationError("execution_stopped");
  }
  return resource;
}

async function startGuard(context, page, origins, tripwire, leg, state, blocked) {
  const session = await context.newCDPSession(page);
  const pending = new Set();
  let closing = false;
  const paused = event => {
    const task = (async () => {
      const url = new URL(event.request.url);
      const external = !origins.has(url.origin);
      if (external || (leg === "enforced" && state.control !== "guard-bypass"
        && url.origin === tripwire)) {
        blocked.add(event.request.url);
        if (external) state.errors.add("outside_loopback_attempt");
        await session.send("Fetch.failRequest", {
          requestId: event.requestId, errorReason: "BlockedByClient",
        });
      } else {
        await session.send("Fetch.continueRequest", { requestId: event.requestId });
      }
    })().catch(() => {
      if (!closing) state.errors.add("guard_interception_failed");
    });
    pending.add(task);
    task.then(() => pending.delete(task));
  };
  session.on("Fetch.requestPaused", paused);
  await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  return {
    listenersDetached: () => closing && !session.listeners("Fetch.requestPaused").includes(paused),
    async close() {
      closing = true;
      session.off("Fetch.requestPaused", paused);
      // The caller closes the context first, so detaching cannot unseal a live page.
      try { await session.detach(); } catch {
        if (!page.isClosed()) state.errors.add("guard_cleanup_failed");
      }
      await Promise.all([...pending]);
    },
  };
}

function startRecorder(page, state, blocked, leg) {
  const tracked = new Map();
  const pending = new Set();
  let accepting = true;
  let finished = false;
  let stopping;
  let releaseRead;
  const deferredRead = new Promise(resolve => { releaseRead = resolve; });
  const phase = () => accepting ? "observation" : "settling";
  function fail(category, record) {
    if (finished) return;
    state.errors.add(category);
    if (record && !record.error) record.error = category;
  }
  function retainBody(record, key, buffer, ceiling) {
    if (finished) return false;
    if (!Buffer.isBuffer(buffer)) { fail("invalid_body", record); return false; }
    if (buffer.length > ceiling || state.bodyBytes + buffer.length > LIMITS.maxTotalBytes) {
      fail("body_byte_limit", record);
      return false;
    }
    state.bodyBytes += buffer.length;
    record[key] = buffer.toString("base64");
    return true;
  }
  function schedule(record, category, work) {
    const task = Promise.resolve().then(work).catch(() => fail(category, record));
    pending.add(task);
    task.then(() => pending.delete(task));
  }
  const onRequest = request => {
    if (finished) return;
    state.observed++;
    if (!accepting) {
      fail("request_after_cutoff");
      return;
    }
    if (state.control === "empty-reference") return;
    const requestUrl = new URL(request.url());
    const firstTarget = leg === "positive" && requestUrl.pathname === "/target"
      && requestUrl.searchParams.get("case") === "fetch_get";
    if (state.control === "dropped-request" && firstTarget) return;
    if (state.requests.length >= LIMITS.maxRequests) { fail("request_limit"); return; }
    const raw = request.url();
    if (Buffer.byteLength(raw) > LIMITS.maxUrlBytes) { fail("url_byte_limit"); return; }
    const from = request.redirectedFrom();
    const record = {
      ordinal: state.requests.length, leg, url: raw, method: request.method(),
      observed_at: stamp(), resource_type: request.resourceType(),
      redirected_from: from ? tracked.get(from)?.ordinal ?? null : null,
      request_headers: null, request_body_base64: null,
      response_status: null, response_headers: null, response_body_base64: null,
      response_body_state: null, terminal: false, guard_blocked: blocked.has(raw),
      response_phase: null, read_completed_phase: null, terminal_phase: null,
      capture_status: "recording", transport_failure: null, error: null,
    };
    tracked.set(request, record);
    state.requests.push(record);
    let body = request.postDataBuffer();
    if (body !== null) {
      if (state.control === "wrong-body" && leg === "positive"
        && requestUrl.searchParams.get("case") === "fetch_post") {
        body = Buffer.from(body);
        body[0] ^= 1;
      }
      retainBody(record, "request_body_base64", body, LIMITS.maxRequestBytes);
    }
    schedule(record, "request_read_failed", async () => {
      const headers = await request.headersArray();
      if (!finished) record.request_headers = headers;
    });
  };
  const onResponse = response => {
    if (finished) return;
    const record = tracked.get(response.request());
    if (!record) {
      if (accepting) fail("unpaired_response");
      return;
    }
    record.response_phase = phase();
    schedule(record, "response_read_failed", async () => {
      const headers = await response.headersArray();
      if (finished) return;
      record.response_status = response.status();
      record.response_headers = headers;
      const url = new URL(record.url);
      const firstTarget = leg === "positive" && url.pathname === "/target"
        && url.searchParams.get("case") === "fetch_get";
      if (firstTarget && state.control === "missing-response") {
        fail("response_read_failed", record);
        return;
      }
      if (firstTarget && state.control === "hung-read") await new Promise(() => {});
      if (firstTarget && state.control === "delayed-read") await deferredRead;
      if (finished) return;
      const length = headers.find(header => header.name.toLowerCase() === "content-length")?.value;
      if (length === "0" || response.status() === 204 || response.status() === 304) {
        record.response_body_base64 = "";
        record.response_body_state = "empty_http_framing";
      } else {
        const body = await response.body();
        if (retainBody(record, "response_body_base64", body, LIMITS.maxResponseBytes))
          record.response_body_state = "captured_bytes";
      }
      if (!finished) record.read_completed_phase = phase();
    });
  };
  const onFinished = request => {
    const record = tracked.get(request);
    if (record && !finished) {
      record.terminal = true;
      record.terminal_phase = phase();
    }
  };
  const onFailed = request => {
    const record = tracked.get(request);
    if (!record || finished) return;
    record.terminal = true;
    record.terminal_phase = phase();
    record.guard_blocked = blocked.has(request.url());
    record.transport_failure = request.failure()?.errorText ?? "transport_failed";
    if (!record.guard_blocked) fail("transport_failed", record);
  };
  const listeners = [
    ["request", onRequest], ["response", onResponse],
    ["requestfinished", onFinished], ["requestfailed", onFailed],
  ];
  listeners.forEach(([event, listener]) => page.on(event, listener));
  return {
    async stop() {
      if (stopping) return stopping;
      accepting = false;
      releaseRead();
      if (state.control === "late-response")
        state.pendingResponses.filter(response => response.leg === leg).forEach(response => response.send());
      stopping = (async () => {
        const available = state.budget.remaining() - state.cleanupReserve - state.outputReserve;
        const deadline = Date.now() + Math.max(0, Math.min(state.limits.settleMs, available));
        const settled = () => [...tracked.entries()].every(([request, record]) =>
          record.terminal && (record.request_headers || record.error)
          && (blocked.has(request.url()) || record.transport_failure
            || record.response_body_base64 !== null || record.error));
        while (pending.size || !settled()) {
          if (Date.now() >= deadline) { fail("settle_timeout"); break; }
          await delay(Math.min(10, deadline - Date.now()));
        }
        listeners.forEach(([event, listener]) => page.off(event, listener));
        for (const [request, record] of tracked) {
          record.guard_blocked = blocked.has(request.url());
          if (!record.request_headers || !record.terminal
            || (!record.guard_blocked && record.response_body_base64 === null))
            fail(record.error ?? "settle_timeout", record);
          record.capture_status = record.guard_blocked ? "guard_blocked"
            : record.transport_failure ? "aborted_without_guard"
              : record.error ?? "complete";
        }
        finished = true;
        tracked.clear();
        return { pendingReads: pending.size,
          listenersDetached: listeners.every(([event, listener]) =>
            !page.listeners(event).includes(listener)) };
      })();
      return stopping;
    },
  };
}

async function exercise(page, name, target, requestBody = MARKER) {
  return page.evaluate(async ({ kind, url, marker }) => {
    try {
      if (kind === "image") {
        return await new Promise(resolve => {
          const image = new Image();
          image.onload = () => resolve("completed");
          image.onerror = () => resolve("blocked_or_failed");
          image.src = url;
        });
      }
      if (kind === "xhr") {
        return await new Promise(resolve => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.onload = () => resolve("completed");
          xhr.onerror = () => resolve("blocked_or_failed");
          xhr.send(marker);
        });
      }
      if (kind === "beacon")
        return navigator.sendBeacon(url, marker) ? "queued" : "not_queued";
      let response = await fetch(url, kind === "fetch_post"
        ? { method: "POST", body: marker } : undefined);
      if (kind === "fanout") {
        const body = await response.json();
        response = await fetch(body.next);
      }
      await response.arrayBuffer();
      return "completed";
    } catch {
      return "blocked_or_failed";
    }
  }, { kind: name, url: target, marker: requestBody });
}

function targetRows(rows, origin, name, leg) {
  return rows.filter(row => {
    const url = new URL(row.url);
    return url.origin === origin && url.pathname === "/target"
      && url.searchParams.get("case") === name && row.leg === leg;
  });
}

function grade(state, cases) {
  const differences = new Set();
  for (const received of state.received) {
    const captured = state.requests.find(row => row.leg === received.leg && row.url === received.url);
    if (!captured) { state.errors.add("missing_request"); continue; }
    const requestBody = Buffer.from(captured.request_body_base64 ?? "", "base64");
    const responseBody = captured.response_body_base64 === null
      ? null : Buffer.from(captured.response_body_base64, "base64");
    if (captured.method !== received.method || requestBody.length !== received.body_bytes
      || hash(requestBody) !== received.body_sha256
      || captured.response_status !== received.response_status
      || (responseBody !== null && (responseBody.length !== received.response_body_bytes
        || hash(responseBody) !== received.response_body_sha256)))
      differences.add("wire_mismatch");
    const type = received.headers["content-type"];
    if (type && !captured.request_headers?.some(header =>
      header.name.toLowerCase() === "content-type" && header.value === type))
      state.errors.add("missing_request_header");
    const url = new URL(received.url);
    if (url.pathname === "/redirect") {
      const target = state.requests.find(row => row.redirected_from === captured.ordinal);
      const location = captured.response_headers?.find(header =>
        header.name.toLowerCase() === "location")?.value;
      if (!target || target.url !== location || new URL(target.url).searchParams.has("owner"))
        state.errors.add("missing_redirect_relationship");
      else state.links.push({ kind: "http_redirect", from: captured.ordinal, to: target.ordinal });
    }
    if (url.pathname === "/fanout" && responseBody !== null) {
      let next;
      try { next = JSON.parse(responseBody.toString("utf8")).next; } catch {
        state.errors.add("invalid_fanout_response");
      }
      const target = state.requests.find(row => row.leg === received.leg && row.url === next);
      if (!target) state.errors.add("missing_fanout_relationship");
      else state.links.push({ kind: "response_url", from: captured.ordinal, to: target.ordinal });
    }
  }
  for (const row of cases) {
    if (row.positive.arrivals !== 1 || row.positive.attempts !== 1)
      state.errors.add("matched_positive_failed");
    if (row.enforced.arrivals !== 0) differences.add("guard_leak");
    else if (row.enforced.attempts !== 1 || row.enforced.blocked !== 1)
      state.errors.add("missing_enforcement_observation");
    if (row.bypass.arrivals !== 1 || !row.bypass.detected)
      state.errors.add("bypass_control_failed");
  }
  for (const leg of LEGS) {
    for (const [kind, path] of [["http_redirect", "/redirect"], ["response_url", "/fanout"]]) {
      const sources = state.requests.filter(row => row.leg === leg
        && new URL(row.url).pathname === path);
      const witnesses = state.received.filter(row => row.leg === leg
        && new URL(row.url).pathname === path);
      if (sources.length !== 1 || witnesses.length !== 1
        || state.links.filter(link => link.kind === kind && link.from === sources[0]?.ordinal).length !== 1)
        state.errors.add("branch_relationship_incomplete");
    }
  }
  return { overall: differences.has("guard_leak") ? "nonconformant"
    : state.errors.size ? "inconclusive" : differences.size ? "nonconformant" : "qualified",
    errors: [...state.errors, ...differences] };
}

export async function runLocalQualification(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    return report("invalid_input", ["invalid_options"]);
  if (options.surface !== undefined && options.surface !== "core-http")
    return report("invalid_input", ["unsupported_surface"]);
  if (typeof options.outputDir !== "string" || !options.outputDir.trim())
    return report("invalid_input", ["output_directory_required"]);
  if (Object.keys(options).some(key => !["surface", "outputDir", "control"].includes(key)))
    return report("invalid_input", ["unknown_option"]);
  const control = options.control ?? "none";
  if (!CONTROLS.includes(control)) return report("invalid_input", ["unknown_control"]);
  const result = report("inconclusive", []);
  const timedFault = ["run-timeout", "cleanup-timeout", "output-timeout", "directory-timeout"]
    .includes(control);
  const limits = timedFault ? { ...LIMITS, runMs: 10000, settleMs: 1000 } : LIMITS;
  const outputReserve = timedFault ? 750 : 1500;
  const cleanupReserve = timedFault ? 2000 : 4000;
  const forceReserve = 500;
  const started = Date.now();
  result.control = control;
  result.expected_positive_cases = [...CASES];
  result.observation_window = {
    started_at: stamp(), stopped_at: null,
    max_wall_ms: limits.runMs, settle_timeout_ms: limits.settleMs,
  };
  const sinks = [];
  const state = { requests: [], received: [], links: [], errors: new Set(), observed: 0,
    bodyBytes: 0, control, pendingResponses: [], sinks, limits,
    outputReserve, cleanupReserve, executionStopped: false };
  const recorders = [];
  const contexts = [];
  const guards = [];
  const pageListeners = [];
  const sinkClosures = new Map();
  let browser;
  let browserServer;
  let ownedProcess;
  let launching;
  let killing;
  let killFallback;
  let driverClosed = false;
  const closeSink = resource => {
    if (sinkClosures.has(resource)) return sinkClosures.get(resource);
    const closing = new Promise(resolve => {
      if (resource.closed || !resource.server.listening) { resolve(); return; }
      resource.server.close(error => {
        if (error) state.errors.add("receiver_cleanup_failed");
        resolve();
      });
      resource.server.closeAllConnections();
    });
    sinkClosures.set(resource, closing);
    return closing;
  };
  const forceCleanup = () => {
    state.executionStopped = true;
    state.pendingResponses.forEach(response => response.cancel());
    sinks.forEach(closeSink);
    if (browserServer && !killing && ownedProcess
      && ownedProcess.exitCode === null && ownedProcess.signalCode === null) {
      killing = browserServer.kill().catch(() => state.errors.add("owned_browser_kill_failed"));
      killFallback = setTimeout(() => {
        if (ownedProcess && ownedProcess.exitCode === null && ownedProcess.signalCode === null)
          ownedProcess.kill("SIGKILL");
      }, 100);
    }
  };
  const budget = createBudget(limits.runMs, state.errors, forceCleanup);
  state.budget = budget;
  const checkExecution = () => {
    if (state.executionStopped) throw new QualificationError("execution_stopped");
  };
  const rememberBrowser = server => {
    if (!browserServer) {
      browserServer = server;
      ownedProcess = server.process();
      server.once("close", () => { driverClosed = true; });
    }
  };
  const interrupt = () => {
    state.errors.add("run_interrupted");
    forceCleanup();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    await budget.wait(async () => {
      if (control === "directory-timeout") await new Promise(() => {});
      checkExecution();
      await mkdir(options.outputDir, { mode: 0o700 });
      checkExecution();
    }, "output_acquisition_deadline");
  } catch (error) {
    state.executionStopped = true;
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    clearTimeout(killFallback);
    budget.finish();
    const deadlineFailure = error.category === "output_acquisition_deadline"
      || state.errors.has("run_deadline_exceeded");
    setOutcome(result, deadlineFailure ? "inconclusive" : "invalid_input",
      [...state.errors, deadlineFailure ? "output_acquisition_deadline" : "output_directory_unavailable"]);
    result.observation_window.stopped_at = stamp();
    result.cleanup = { browser_closed: true, owned_browser_process_exited: true,
      servers_closed: true, pending_reads: 0,
      listeners_detached: !process.listeners("SIGINT").includes(interrupt)
        && !process.listeners("SIGTERM").includes(interrupt) };
    result.counts = { observed_requests: 0, stored_requests: 0,
      received_requests: 0, retained_body_bytes: 0 };
    result.surface = { qualified: [], not_qualified: [...CASES, "vendor_runtime", "vendor_wire"] };
    result.run_elapsed_ms = Date.now() - started;
    return freeze(result);
  }
  const execute = async () => {
    const { chromium } = await import("playwright");
    checkExecution();
    const tripwire = await startSink("tripwire", state);
    state.tripwire = tripwire.origin;
    checkExecution();
    const allowed = await startSink("allowed", state);
    checkExecution();
    launching = chromium.launchServer({
      channel: "chrome", headless: true, host: "127.0.0.1",
      timeout: Math.max(1, budget.remaining() - limits.settleMs - cleanupReserve - outputReserve),
    });
    rememberBrowser(await launching);
    if (state.executionStopped) { forceCleanup(); checkExecution(); }
    const endpoint = browserServer.wsEndpoint();
    if (new URL(endpoint).hostname !== "127.0.0.1")
      throw new QualificationError("invalid_driver_origin");
    browser = await chromium.connect(endpoint, {
      timeout: Math.max(1, budget.remaining() - cleanupReserve - outputReserve),
    });
    checkExecution();
    result.provenance = {
      node_version: process.version, browser_version: browser.version(),
      runner_sha256: hash(await readFile(fileURLToPath(import.meta.url))),
      fixture_kind: "fixed_loopback_core_http", started_at: stamp(),
    };
    if (process.version !== "v24.10.0" || browser.version() !== "155.0.8059.80")
      throw new QualificationError("runtime_pin_changed");
    for (const leg of LEGS) {
      checkExecution();
      const context = await browser.newContext({ serviceWorkers: "block" });
      contexts.push(context);
      checkExecution();
      const blocked = new Set();
      const origins = new Set(sinks.map(sink => sink.origin));
      const page = await context.newPage();
      const guard = await startGuard(context, page, origins, tripwire.origin, leg, state, blocked);
      guards.push(guard);
      const onPageError = () => state.errors.add("fixture_page_error");
      page.on("pageerror", onPageError);
      pageListeners.push({ page, listener: onPageError });
      const recorder = startRecorder(page, state, blocked, leg);
      recorders.push(recorder);
      await page.goto(`${allowed.origin}/fixture`, { waitUntil: "load" });
      if (control === "run-timeout" && leg === "positive") {
        await exercise(page, "fetch_get", `${tripwire.origin}/target?case=fetch_get&leg=positive`);
        await new Promise(() => {});
      }
      if (leg === "positive" && ["request-limit", "aggregate-body-limit"].includes(control)) {
        const count = control === "request-limit" ? LIMITS.maxRequests + 1 : 5;
        for (let index = 0; index < count; index++) {
          await exercise(page, "fetch_get",
            `${tripwire.origin}/target?case=fetch_get&leg=positive&batch=${index}`);
        }
        await recorder.stop();
        throw new QualificationError(`${control.replaceAll("-", "_")}_control`);
      }
      for (const name of CASES) {
        checkExecution();
        result.active_case = { name, leg };
        const origin = ["redirect", "fanout"].includes(name) ? allowed.origin : tripwire.origin;
        const path = name === "redirect" ? "/redirect" : name === "fanout" ? "/fanout" : "/target";
        let target = `${origin}${path}?case=${name}&leg=${leg}&owner=${result.run_id}`
          + (name === "fetch_get" ? "&dup=first&dup=second" : "");
        if (control === "broken-positive" && leg === "positive" && name === "fetch_get")
          target = `${tripwire.origin}/not-the-tripwire`;
        if (control === "url-byte-limit" && leg === "positive" && name === "fetch_get")
          target = target.padEnd(LIMITS.maxUrlBytes + 1, "x");
        if (leg === "enforced" && ((control === "dropped-redirect-branch" && name === "redirect")
          || (control === "dropped-fanout-branch" && name === "fanout")))
          target = `${tripwire.origin}/target?case=${name}&leg=${leg}`;
        const body = control === "request-body-limit" && leg === "positive" && name === "fetch_post"
          ? MARKER.repeat(Math.ceil((LIMITS.maxRequestBytes + 1) / MARKER.length))
            .slice(0, LIMITS.maxRequestBytes + 1) : MARKER;
        const late = leg === "positive" && name === "fetch_get"
          && ["late-response", "late-response-timeout"].includes(control);
        if (late) {
          await page.evaluate(url => {
            window.qualificationPending = fetch(url).then(response => response.arrayBuffer())
              .catch(() => "transport_failed");
          }, target);
        } else await exercise(page, name, target, body);
        await until(() => targetRows(state.requests, tripwire.origin, name, leg)
          .some(row => late || row.terminal));
        if (leg !== "enforced")
          await until(() => targetRows(state.received, tripwire.origin, name, leg).length === 1);
      }
      await recorder.stop();
      if (state.errors.size) throw new QualificationError("capture_incomplete");
      await context.close();
      await guard.close();
      checkExecution();
    }
    result.cases = CASES.map(name => {
      const row = { name };
      for (const leg of LEGS) {
        const attempts = targetRows(state.requests, tripwire.origin, name, leg);
        const arrivals = targetRows(state.received, tripwire.origin, name, leg);
        row[leg] = {
          attempts: attempts.length, arrivals: arrivals.length,
          blocked: attempts.filter(request => request.guard_blocked).length,
        };
      }
      row.bypass.detected = row.bypass.arrivals > 0;
      return row;
    });
    const verdict = grade(state, result.cases);
    setOutcome(result, verdict.overall, verdict.errors);
  };
  try {
    await budget.wait(execute, "execution_deadline_exceeded",
      limits.settleMs + cleanupReserve + outputReserve);
    state.executionStopped = true;
  } catch (error) {
    state.failureDetail = error.stack ?? String(error);
    setOutcome(result, "inconclusive",
      [...state.errors, error.category ?? "environment_or_observation_failed"]);
  } finally {
    state.executionStopped = true;
    const cleanup = async (category, work, reserve = outputReserve + forceReserve) => {
      try { return await budget.wait(work, category, reserve); } catch {
        state.errors.add(category);
        forceCleanup();
        return null;
      }
    };
    if (launching && !browserServer) {
      const server = await cleanup("browser_launch_cleanup_deadline", () => launching);
      if (server) rememberBrowser(server);
      forceCleanup();
    }
    const snapshots = await cleanup("recorder_cleanup_deadline",
      () => Promise.all(recorders.map(recorder => recorder.stop()))) ?? [];
    const pendingReads = snapshots.reduce((sum, snapshot) => sum + snapshot.pendingReads, 0);
    for (const { page, listener } of pageListeners) page.off("pageerror", listener);
    if (control === "cleanup-timeout")
      await cleanup("cleanup_deadline_exceeded", () => new Promise(() => {}),
        cleanupReserve + outputReserve);
    for (const context of contexts)
      await cleanup("context_cleanup_failed", () => context.close());
    for (const guard of guards)
      await cleanup("guard_cleanup_failed", () => guard.close());
    if (browser) await cleanup("browser_cleanup_failed", () => browser.close());
    if (browserServer)
      await cleanup("browser_server_cleanup_failed", () => browserServer.close());
    if (killing) await cleanup("owned_browser_kill_deadline", () => killing, outputReserve);
    state.pendingResponses.forEach(response => response.cancel());
    await cleanup("receiver_cleanup_deadline", () => Promise.all(sinks.map(closeSink)), outputReserve);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    const processExited = !ownedProcess
      || ownedProcess.exitCode !== null || ownedProcess.signalCode !== null;
    result.cleanup = {
      browser_closed: (!browser || !browser.isConnected()) && processExited && (!browserServer || driverClosed),
      owned_browser_process_exited: processExited,
      servers_closed: sinks.every(resource => resource.closed),
      pending_reads: pendingReads,
      listeners_detached: snapshots.length === recorders.length
        && snapshots.every(snapshot => snapshot.listenersDetached)
        && pageListeners.every(({ page, listener }) => !page.listeners("pageerror").includes(listener))
        && guards.every(guard => guard.listenersDetached())
        && !process.listeners("SIGINT").includes(interrupt)
        && !process.listeners("SIGTERM").includes(interrupt),
    };
    if (!result.cleanup.browser_closed || !result.cleanup.servers_closed
      || !result.cleanup.listeners_detached || pendingReads > 0)
      state.errors.add("cleanup_incomplete");
    result.observation_window.stopped_at = stamp();
    if (Date.parse(result.observation_window.stopped_at)
      - Date.parse(result.observation_window.started_at) > limits.runMs)
      state.errors.add("run_wall_limit_exceeded");
    result.counts = {
      observed_requests: state.observed, stored_requests: state.requests.length,
      received_requests: state.received.length, retained_body_bytes: state.bodyBytes,
    };
    if (state.errors.size && result.overall === "qualified")
      setOutcome(result, "inconclusive", [...state.errors]);
    else setOutcome(result, result.overall, [...result.errors, ...state.errors]);
    result.capture_complete = result.cases?.length === CASES.length && state.requests.length > 0
      && state.errors.size === 0 && state.observed === state.requests.length
      && state.requests.every(request => request.terminal && request.request_headers
        && (request.guard_blocked || request.response_body_base64 !== null));
    result.guard.qualified = result.overall === "qualified" && result.capture_complete;
    result.surface = {
      qualified: result.overall === "qualified" ? [...CASES] : [],
      not_qualified: ["frames", "dedicated_workers", "service_workers", "websockets",
        "browser_background", "vendor_runtime", "vendor_wire"],
    };
    const capture = freeze({
      schema_version: 1, run_id: result.run_id,
      requests: state.requests, receiver_requests: state.received,
      links: state.links, errors: [...state.errors],
      failure_detail: state.failureDetail ?? null, limits,
      observation_window: result.observation_window, provenance: result.provenance ?? null,
      control, browser_process_id: ownedProcess?.pid ?? null,
    });
    try {
      await budget.wait(() => writeFile(`${options.outputDir}/capture.json`,
        `${JSON.stringify(capture, null, 2)}\n`,
        { flag: "wx", mode: 0o600, signal: budget.signal }), "capture_output_deadline");
      if (control === "output-timeout")
        await budget.wait(() => new Promise(() => {}), "report_output_deadline");
      await budget.wait(() => writeFile(`${options.outputDir}/report.json`,
        `${JSON.stringify(result, null, 2)}\n`,
        { flag: "wx", mode: 0o600, signal: budget.signal }), "report_output_deadline");
    } catch {
      setOutcome(result, "inconclusive", [...result.errors, "private_output_failed"]);
      result.surface.qualified = [];
      result.guard.qualified = false;
    } finally {
      clearTimeout(killFallback);
      budget.finish();
    }
  }
  if (state.errors.size) {
    setOutcome(result, result.overall === "qualified" ? "inconclusive" : result.overall,
      [...result.errors, ...state.errors]);
    if (result.overall !== "qualified") {
      result.surface.qualified = [];
      result.guard.qualified = false;
    }
  }
  result.run_elapsed_ms = Date.now() - started;
  if (result.run_elapsed_ms > limits.runMs) {
    setOutcome(result, "inconclusive", [...result.errors, "run_wall_limit_exceeded"]);
    result.surface.qualified = [];
    result.guard.qualified = false;
  }
  return freeze(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const keys = { "--output-dir": "outputDir", "--control": "control", "--surface": "surface" };
  const options = {};
  let valid = args.length > 0 && args.length % 2 === 0;
  for (let index = 0; valid && index < args.length; index += 2) {
    const key = Object.hasOwn(keys, args[index]) ? keys[args[index]] : null;
    if (!key || Object.hasOwn(options, key) || args[index + 1].startsWith("--")) valid = false;
    else options[key] = args[index + 1];
  }
  const result = valid
    ? await runLocalQualification(options)
    : report("invalid_input", ["invalid_arguments"]);
  console.log(JSON.stringify(result));
  process.exitCode = result.exit_code;
}
