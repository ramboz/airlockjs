import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:http";
import { isAbsolute, join } from "node:path";
import { release } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LAUNCHER = fileURLToPath(new URL("./offline-reference-chrome", import.meta.url));
const NETWORK_POLICY = fileURLToPath(new URL("./offline-reference-network.sb", import.meta.url));
const RUNTIME_URL = "https://connect.facebook.net/en_US/fbevents.js";
const NODE_VERSION = "v24.10.0";
const BROWSER_VERSION = "155.0.8059.80";
const MACOS_VERSION = "27.0.1";
const OS_RELEASE = "27.0.0";
const execute = promisify(execFile);
// This first profile qualifies only the owner's exact retained official bytes,
// not arbitrary code with a self-declared URL/hash. Updating pins is new work.
const NATIVE_PINS = Object.freeze({
  runtime: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b",
  configuration: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921",
});
const LIMITS = Object.freeze({
  run_ms: 60000, observation_ms: 5000, settle_ms: 5000,
  requests: 64, url_bytes: 2048, request_body_bytes: 65536,
  header_bytes: 65536, resource_bytes: 2097152, manifest_bytes: 32768,
});
const CASES = ["baseline", "query-disabled", "consent-revoked", "value1", "value2"];
const VALUES = { value1: "13.25", value2: "29.75" };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const stamp = () => new Date().toISOString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const plain = value => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
class ReferenceError extends Error {
  constructor(category, invalid = false) {
    super(category);
    this.category = category;
    this.invalid = invalid;
  }
}
const reject = (category, invalid = true) => { throw new ReferenceError(category, invalid); };
function outcome(result, overall, errors) {
  result.overall = overall;
  result.exit_code = { qualified: 0, nonconformant: 1, inconclusive: 2, invalid_input: 3 }[overall];
  result.errors = [...new Set(errors)];
}
function report(mode = "headed") {
  return {
    schema_version: 1, run_id: randomUUID(), evidence_layer: "native_attempt",
    profile: "meta-pageview", mode, overall: "inconclusive", exit_code: 2, errors: [],
    node_version: process.version, browser_version: null,
    platform: process.platform, os_release: release(), macos_version: null,
    runtime_sha256: null, configuration_sha256: null,
    provenance: null, capture_complete: false, cases: [],
    expected_positive_cases: ["baseline", "value1", "value2"],
    counts: { attempts: 0, recorded_requests: 0 },
    controls: { disabled_linked: false, consent_negative_linked: false, value_contrast: false },
    guard: { mechanism: "cdp_fetch_request_stage_all_fulfill_or_abort",
      process_control: null, resolver_control: null, http_control: null, qualified: false },
    limits: LIMITS,
    claims: { vendor_dispatch_verified: false, vendor_receipt_verified: false,
      chamber_compatibility_verified: false, matching_verified: false,
      attribution_verified: false, full_support_verified: false },
    not_proved: ["vendor_http_responses", "cookie_acceptance", "redirect_execution",
      "other_consent_states_and_transitions", "frames", "workers", "websockets", "full_vendor_dependency_surface",
      "google_native_reference"],
  };
}
function keys(value, expected) {
  if (!plain(value)) reject("invalid_manifest_object");
  if (Object.keys(value).some(key => !expected.includes(key))) reject("unknown_manifest_field");
  if (expected.some(key => !Object.hasOwn(value, key))) reject("missing_manifest_field");
}
function text(value, max = 4096) {
  return typeof value === "string" && value.length > 0
    && Buffer.byteLength(value) <= max && ![...value].some(char => char.charCodeAt(0) < 32);
}
function sourceUrl(value) {
  if (!text(value, LIMITS.url_bytes)) reject("invalid_source_url");
  let parsed;
  try { parsed = new URL(value); } catch { reject("invalid_source_url"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash)
    reject("invalid_source_url");
  return parsed;
}
async function boundedRead(path, maximum, category, check) {
  check();
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    check();
    const info = await handle.stat();
    check();
    if (!info.isFile()) reject(`${category}_unavailable`, false);
    if (info.size > maximum) reject(`${category}_byte_limit`, false);
    const bytes = Buffer.alloc(maximum + 1);
    let offset = 0;
    while (offset <= maximum) {
      const { bytesRead } = await handle.read(bytes, offset, maximum + 1 - offset, offset);
      check();
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > maximum) reject(`${category}_byte_limit`, false);
    return bytes.subarray(0, offset);
  } catch (error) {
    if (error instanceof ReferenceError) throw error;
    reject(`${category}_unavailable`, false);
  } finally {
    if (handle) await handle.close();
  }
}
async function inputsAt(path, check) {
  const bytes = await boundedRead(path, LIMITS.manifest_bytes, "manifest", check);
  let manifest;
  try { manifest = JSON.parse(bytes.toString("utf8")); } catch { reject("invalid_manifest_json"); }
  keys(manifest, ["schema_version", "profile", "owned_origin", "document_url", "pixel_id",
    "runtime", "configuration", "source_capture_sha256", "authorization"]);
  if (manifest.schema_version !== 1) reject("unsupported_schema");
  if (manifest.profile !== "meta-pageview") reject("unsupported_profile");
  const origin = sourceUrl(manifest.owned_origin);
  const document = sourceUrl(manifest.document_url);
  if (origin.origin !== manifest.owned_origin || document.origin !== origin.origin)
    reject("owned_origin_mismatch");
  if (!text(manifest.pixel_id, 32) || !/^[0-9]{1,32}$/.test(manifest.pixel_id))
    reject("invalid_pixel_selector");
  if (typeof manifest.source_capture_sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(manifest.source_capture_sha256))
    reject("invalid_source_digest");
  if (!text(manifest.authorization, 4096)) reject("authorization_required");
  for (const name of ["runtime", "configuration"]) {
    const resource = manifest[name];
    keys(resource, ["path", "sha256", "request_url", "response_status"]);
    if (!text(resource.path) || !isAbsolute(resource.path)) reject("invalid_resource_path");
    if (typeof resource.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(resource.sha256))
      reject("invalid_resource_digest");
    if (resource.response_status !== 200) reject("invalid_source_status");
    const url = sourceUrl(resource.request_url);
    if (name === "runtime" && resource.request_url !== RUNTIME_URL) reject("invalid_runtime_url");
    if (name === "configuration" && (url.origin !== "https://connect.facebook.net"
      || url.pathname !== `/signals/config/${manifest.pixel_id}`))
      reject("invalid_configuration_url");
    resource.bytes = await boundedRead(resource.path, LIMITS.resource_bytes, "resource", check);
    check();
    if (hash(resource.bytes) !== resource.sha256) reject("resource_hash_mismatch", false);
  }
  return { manifest, manifest_sha256: hash(bytes) };
}

// A single absolute clock exists before mkdir, input reads or browser acquisition.
// Every continuation checks it before it can execute any fixture/native code.
function budgetFor(state) {
  const deadline = state.started + LIMITS.run_ms;
  const controller = new AbortController();
  const expire = () => {
    state.fail("run_deadline_exceeded");
    state.stopped = true;
    controller.abort();
    state.force();
  };
  const timer = setTimeout(expire, Math.max(1, deadline - Date.now()));
  return {
    signal: controller.signal,
    remaining: () => Math.max(0, deadline - Date.now()),
    check() {
      if (state.stopped || Date.now() >= deadline) reject("execution_deadline_exceeded", false);
    },
    async wait(work, category, reserve = 0, cap = Infinity) {
      const remaining = Math.min(cap, deadline - Date.now() - reserve);
      if (remaining <= 0) { state.force(); reject(category, false); }
      let timeout;
      try {
        return await Promise.race([Promise.resolve().then(work),
          new Promise((_resolve, fail) => {
            timeout = setTimeout(() => {
              state.fail(category);
              state.stopped = true;
              state.force();
              fail(new ReferenceError(category));
            }, remaining);
          })]);
      } finally { clearTimeout(timeout); }
    },
    finish() { clearTimeout(timer); },
  };
}
async function receiver(state) {
  state.budget.check();
  const arrivals = [];
  const paths = { process: `/process-${randomUUID()}`, http: `/http-${randomUUID()}` };
  const server = createServer((request, response) => {
    if (request.url === paths.process || request.url === paths.http) {
      if (!state.published) arrivals.push({ path: request.url, at: stamp(), method: request.method,
        headers: request.headers, response_status: 200 });
    }
    response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'", Connection: "close" });
    response.end("owned loopback control; no native SDK");
  });
  state.sink = server;
  state.receiverRequests = arrivals;
  await new Promise((resolve, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", resolve);
  });
  state.budget.check();
  server.on("error", () => state.fail("receiver_failed"));
  return { server, arrivals, paths, origin: `http://127.0.0.1:${server.address().port}` };
}
function killOwned(resource) {
  const child = resource.process;
  if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}
async function launch(state, chromium, confined, headless) {
  state.budget.check();
  const launching = chromium.launchServer({
    executablePath: confined ? LAUNCHER : CHROME, headless, host: "127.0.0.1",
    args: ["--dns-prefetch-disable", "--disable-background-networking"],
    timeout: Math.max(1, Math.min(10000, state.budget.remaining() - 6000)),
  }).then(server => {
    const resource = { server, process: server.process(), browser: null, closed: false };
    server.once("close", () => { resource.closed = true; });
    if (!state.published) state.owned.push(resource);
    if (state.stopped) killOwned(resource);
    return resource;
  });
  state.launching.add(launching);
  let resource;
  try { resource = await launching; }
  finally { state.launching.delete(launching); }
  state.budget.check();
  const endpoint = resource.server.wsEndpoint();
  if (new URL(endpoint).hostname !== "127.0.0.1") reject("invalid_driver_origin", false);
  resource.browser = await chromium.connect(endpoint, {
    timeout: Math.max(1, Math.min(5000, state.budget.remaining() - 6000)),
  });
  state.budget.check();
  if (resource.browser.version() !== BROWSER_VERSION) reject("browser_version_mismatch", false);
  return resource;
}
async function closeOwned(state, resource) {
  if (resource.browser?.isConnected())
    await state.budget.wait(() => resource.browser.close(), "browser_cleanup_failed", 1500, 3000);
  await state.budget.wait(() => resource.server.close(), "browser_server_cleanup_failed", 1500, 3000);
  if (resource.process.exitCode === null && resource.process.signalCode === null)
    reject("owned_process_not_exited", false);
}
async function processBoundary(state, chromium, sink, mode) {
  const headless = mode === "headless-diagnostic";
  const positive = await launch(state, chromium, false, headless);
  const page = await positive.browser.newPage({ serviceWorkers: "block" });
  state.budget.check();
  const target = sink.origin + sink.paths.process;
  const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 3000 });
  state.budget.check();
  const positiveStatus = response?.status() ?? null;
  await page.close();
  await closeOwned(state, positive);
  state.budget.check();
  const positiveArrivals = sink.arrivals.filter(row => row.path === sink.paths.process).length;
  if (positiveArrivals !== 1 || positiveStatus !== 200) reject("process_positive_failed", false);
  const confined = await launch(state, chromium, true, headless);
  state.result.browser_version = confined.browser.version();
  const negative = await confined.browser.newPage({ serviceWorkers: "block" });
  state.budget.check();
  let denied = false;
  try {
    await negative.goto(target, { waitUntil: "domcontentloaded", timeout: 3000 });
  } catch { denied = true; }
  state.budget.check();
  await negative.close();
  const confinedArrivals = sink.arrivals.filter(row => row.path === sink.paths.process).length - positiveArrivals;
  const control = { positive_arrivals: positiveArrivals, positive_status: positiveStatus,
    confined_arrivals: confinedArrivals, navigation_denied: denied,
    qualified: denied && confinedArrivals === 0, cohort: mode };
  state.result.guard.process_control = control;
  if (!control.qualified) reject("process_network_boundary_failed", false);
  return confined;
}

async function resolverBoundary(state) {
  const probe = `
    import net from "node:net";
    let done=false;
    const socket=net.createConnection({path:process.argv[1]});
    const finish=result=>{
      if(done)return;done=true;clearTimeout(timer);socket.destroy();
      process.stdout.write(JSON.stringify(result));
    };
    const timer=setTimeout(()=>finish({connected:false,error:"timeout"}),750);
    socket.once("connect",()=>finish({connected:true}));
    socket.once("error",error=>finish({connected:false,error:error.code}));
  `;
  const rows = [];
  for (const socketPath of ["/var/run/mDNSResponder", "/private/var/run/mDNSResponder"]) {
    state.budget.check();
    const args = ["--input-type=module", "-e", probe, socketPath];
    const settings = { timeout: 2000, maxBuffer: 4096, signal: state.budget.signal };
    let positive, confined;
    try {
      positive = JSON.parse((await execute(process.execPath, args, settings)).stdout);
      state.budget.check();
      confined = JSON.parse((await execute("/usr/bin/sandbox-exec",
        ["-f", NETWORK_POLICY, process.execPath, ...args], settings)).stdout);
    } catch { reject("resolver_control_unavailable", false); }
    state.budget.check();
    rows.push({
      positive: positive.connected === true,
      denied: confined.connected === false && ["EPERM", "EACCES"].includes(confined.error),
    });
  }
  const result = {
    positive_connections: rows.filter(row => row.positive).length,
    confined_denials: rows.filter(row => row.denied).length,
    qualified: rows.length === 2 && rows.every(row => row.positive && row.denied),
    query_payload_sent: false,
    scope: "known_macos_resolver_unix_socket_aliases_same_policy_no_dns_query",
  };
  state.result.guard.resolver_control = result;
  if (!result.qualified) reject("resolver_boundary_control_failed", false);
}

function csp(nonce, connect = "https:") {
  return `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; `
    + `connect-src ${connect}; img-src https:; frame-src 'none'; worker-src 'none'; `
    + "object-src 'none'; base-uri 'none'; form-action 'none'; "
    // Require Trusted Types without prohibiting the unmodified SDK's own
    // policy creation. Our default policy accepts only the two exact pins.
    + "require-trusted-types-for 'script'";
}
const js = value => JSON.stringify(value).replaceAll("<", "\\u003c");
function fixture(manifest, name, nonce) {
  const disabled = name === "query-disabled";
  const consent = name === "consent-revoked" ? "explicit_revoke_before_init" : "native_default_not_overridden";
  const params = VALUES[name] ? { value: Number(VALUES[name]), currency: "USD" } : null;
  const bootstrap = `
window.__airlockFixture={executed:true,disabled:${disabled},consent:${js(consent)}};
const pinned=${js([manifest.runtime.request_url, manifest.configuration.request_url])};
const policy=trustedTypes.createPolicy("default",{createScriptURL(value){
  if(!pinned.includes(value))throw new TypeError("unpinned_script_dependency");return value;
}});
if(new URLSearchParams(location.search).get("native")!=="disabled"){
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
    t=b.createElement(e);t.async=!0;t.src=policy.createScriptURL(v);
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,"script",${js(manifest.runtime.request_url)});
  ${name === "consent-revoked" ? 'fbq("consent","revoke");' : ""}
  fbq("init",${js(manifest.pixel_id)});
  fbq("track","PageView"${params ? `,${js(params)}` : ""});
}`;
  return Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><title>Airlock synthetic native-attempt fixture</title></head><body>Generated offline fixture, not the captured production document.<script nonce="${nonce}">${bootstrap}</script></body></html>`);
}
function fields(row) {
  const pairs = [...row.query_pairs];
  if (row.body_state === "captured" && row.body_base64
    && Object.entries(row.headers).some(([key, value]) =>
      key.toLowerCase() === "content-type" && value.startsWith("application/x-www-form-urlencoded"))) {
    pairs.push(...new URLSearchParams(Buffer.from(row.body_base64, "base64").toString("utf8")));
  }
  return new URLSearchParams(pairs);
}
function classification(raw, type, manifest, documentUrl, controlTarget, method, bodyState) {
  if (raw === documentUrl && type === "Document") return "fixture_document";
  if (controlTarget && raw === controlTarget) return "http_tripwire";
  if (raw === manifest.runtime.request_url && type === "Script") return "runtime";
  if (raw === manifest.configuration.request_url && type === "Script") return "configuration";
  const url = new URL(raw);
  if (raw === new URL("/favicon.ico", documentUrl).href
    && type === "Other" && method === "GET" && bodyState === "absent")
    return "fixture_favicon";
  if (url.origin === "https://www.facebook.com" && url.pathname === "/tr/")
    return "native_measurement";
  return type === "Script" ? "missing_dependency" : "unknown_auxiliary";
}

// Fetch is enabled before navigation. There is deliberately no network-continue
// operation: exact local fulfillment and pre-network failure are the only arms.
async function guardedCase(state, browser, manifest, name, control = null) {
  state.budget.check();
  const context = await browser.newContext({ serviceWorkers: "block" });
  state.contexts.add(context);
  state.budget.check();
  const page = await context.newPage();
  state.budget.check();
  const session = await context.newCDPSession(page);
  state.budget.check();
  const nonce = randomUUID().replaceAll("-", "");
  const documentUrl = control ? `${control.origin}/guard-fixture`
    : `${manifest.owned_origin}/__airlock_native_reference_fixture__?case=${name}`
      + (name === "query-disabled" ? "&native=disabled" : "");
  const documentBytes = control
    ? Buffer.from(`<!doctype html><script nonce="${nonce}">fetch(${js(control.target)}).catch(()=>{});</script>`)
    : fixture(manifest, name, nonce);
  const requests = [];
  const pending = new Set();
  let admitting = true;
  let finished = false;
  let observationTimer;
  const violations = [];
  const pageErrors = [];
  const unsupported = [];
  const surface = (category, details) => {
    if (finished || state.published) return;
    unsupported.push({ category, details, at: stamp() });
    state.fail(category);
  };
  const onNewPage = extra => {
    surface("unsupported_page_target", { url: extra.url() });
    const closing = extra.close().catch(() => state.fail("unsupported_target_cleanup_failed"));
    pending.add(closing);
    closing.finally(() => pending.delete(closing));
  };
  const onFrame = frame => surface("unsupported_frame", { url: frame.url() });
  const onWorker = worker => surface("unsupported_worker", { url: worker.url() });
  const onSocket = socket => surface("unsupported_websocket", { url: socket.url() });
  const onServiceWorker = worker => surface("unsupported_service_worker", { url: worker.url() });
  context.on("page", onNewPage);
  context.on("serviceworker", onServiceWorker);
  page.on("frameattached", onFrame);
  page.on("worker", onWorker);
  page.on("websocket", onSocket);
  const binding = "__airlockReferenceCsp";
  await context.exposeBinding(binding, (_source, violation) => {
    if (!finished && !state.published) {
      violations.push(violation);
      state.fail("forbidden_csp_surface");
    }
  });
  state.budget.check();
  await context.addInitScript(() => {
    window.__airlockPolicyViolations = [];
    document.addEventListener("securitypolicyviolation", event => {
      const violation = {
        directive: event.effectiveDirective, blocked_uri: event.blockedURI,
        disposition: event.disposition, sample: event.sample,
      };
      window.__airlockPolicyViolations.push(violation);
      void window.__airlockReferenceCsp(violation);
    });
  });
  state.budget.check();
  const onError = error => {
    if (!finished && !state.published) {
      pageErrors.push(String(error));
      state.fail("native_page_error");
    }
  };
  page.on("pageerror", onError);
  const paused = event => {
    if (finished || state.published) return;
    const task = (async () => {
      const request = event.request;
      const abort = async () => {
        await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
      };
      const afterCutoff = !admitting;
      if (afterCutoff) state.fail("request_after_cutoff");
      if (state.stopped) { await abort(); return; }
      if (state.requests.length >= LIMITS.requests) {
        state.fail("request_limit"); await abort(); return;
      }
      if (Buffer.byteLength(request.url) > LIMITS.url_bytes) {
        state.fail("url_byte_limit"); await abort(); return;
      }
      if (!plain(request.headers) || !Object.keys(request.headers).length) {
        state.fail("request_headers_unavailable"); await abort(); return;
      }
      if (Buffer.byteLength(JSON.stringify(request.headers)) > LIMITS.header_bytes) {
        state.fail("header_byte_limit"); await abort(); return;
      }
      let body = null;
      let bodyState = "absent";
      if (request.hasPostData || request.postData !== undefined || request.postDataEntries) {
        if (request.postDataEntries?.length && request.postDataEntries.every(entry => typeof entry.bytes === "string"))
          body = Buffer.concat(request.postDataEntries.map(entry => Buffer.from(entry.bytes, "base64")));
        else if (typeof request.postData === "string") body = Buffer.from(request.postData);
        else {
          state.fail("request_body_unavailable");
          bodyState = "unavailable";
        }
        if (body) bodyState = "captured";
      }
      if (body && body.length > LIMITS.request_body_bytes) {
        state.fail("request_body_byte_limit"); await abort(); return;
      }
      const category = classification(request.url, event.resourceType, manifest, documentUrl,
        control?.target, request.method, bodyState);
      const row = {
        ordinal: state.requests.length, case: name, observed_at: stamp(), url: request.url,
        query_pairs: [...new URL(request.url).searchParams], method: request.method,
        resource_type: event.resourceType, headers: request.headers,
        headers_state: "available_cdp_request_stage_headers",
        body_base64: body?.toString("base64") ?? null, body_state: bodyState,
        category, network_id: event.networkId ?? null, aborted: false,
        locally_fulfilled: false, local_response: null, actual_vendor_response: false,
        source_relationship: category === "runtime" || category === "configuration" ? category : null,
      };
      state.requests.push(row);
      requests.push(row);
      if (afterCutoff) {
        await abort();
        if (!finished && !state.published) row.aborted = true;
        return;
      }
      if (["fixture_document", "runtime", "configuration"].includes(category)) {
        const bytes = category === "fixture_document" ? documentBytes : manifest[category].bytes;
        const headers = category === "fixture_document"
          ? [{ name: "Content-Type", value: "text/html; charset=utf-8" },
            { name: "Content-Security-Policy", value: csp(nonce, control ? control.origin : "https:") }]
          : [{ name: "Content-Type", value: "application/javascript; charset=utf-8" }];
        state.budget.check();
        await session.send("Fetch.fulfillRequest", {
          requestId: event.requestId, responseCode: 200,
          responseHeaders: [...headers, { name: "Cache-Control", value: "no-store" }],
          body: bytes.toString("base64"),
        });
        if (!finished && !state.published) {
          row.locally_fulfilled = true;
          row.local_response = { status: 200, body_bytes: bytes.length, body_sha256: hash(bytes),
            provenance: category === "fixture_document" ? "generated_synthetic" : "retained_source_bytes" };
        }
      } else {
        await abort();
        if (!finished && !state.published) row.aborted = true;
        if (category === "missing_dependency" || category === "unknown_auxiliary") state.fail(category);
        if (category === "native_measurement") {
          const data = fields(row);
          if (data.getAll("id").length !== 1 || data.get("id") !== manifest.pixel_id
            || data.getAll("ev").length !== 1 || data.get("ev") !== "PageView")
            state.fail("non_owned_or_unexpected_measurement");
        }
      }
    })().catch(error => {
      if (!finished && !state.published) {
        state.fail(error.category ?? "capture_or_interception_failed");
        // Failure to abort/fulfill is never an implicit permission to send.
        void context.close().catch(() => state.fail("failed_guard_context_cleanup"));
      }
    });
    pending.add(task);
    task.finally(() => pending.delete(task));
  };
  session.on("Fetch.requestPaused", paused);
  try {
    await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    state.budget.check();
    const observationStart = Date.now();
    const startedAt = stamp();
    const observationMs = control ? 500 : LIMITS.observation_ms;
    observationTimer = setTimeout(() => { admitting = false; }, observationMs);
    try {
      await page.goto(documentUrl, { waitUntil: "load", timeout: observationMs });
    } catch { reject("fixture_navigation_failed", false); }
    state.budget.check();
    const remaining = observationStart + observationMs - Date.now();
    if (remaining > 0) await delay(remaining);
    state.budget.check();
    admitting = false;
    // Drain the live task set, not a snapshot: listeners remain attached while
    // asynchronous fulfillment/abort work accepted before cutoff completes.
    const settleDeadline = Math.min(Date.now() + LIMITS.settle_ms,
      state.started + LIMITS.run_ms - 6000);
    while (pending.size) {
      if (Date.now() >= settleDeadline) reject("capture_settle_timeout", false);
      await delay(10);
      state.budget.check();
    }
    const observedState = await page.evaluate(() => ({
      fixture: window.__airlockFixture ?? null,
      violations: window.__airlockPolicyViolations,
      native: {
        callable: typeof window.fbq?.callMethod === "function",
        queue_length: window.fbq?.queue?.length ?? null,
        owned_pixel_count: window.fbq?.getState?.().pixels?.length ?? null,
        event_count: window.fbq?.getState?.().pixels?.[0]?.eventCount ?? null,
      },
    }));
    state.budget.check();
    const fixtureState = observedState.fixture;
    if (!Array.isArray(observedState.violations)) state.fail("policy_capture_unavailable");
    else if (observedState.violations.length) {
      state.fail("forbidden_csp_surface");
      // The synchronous in-page copy closes an asynchronous binding delivery gap.
      for (const violation of observedState.violations) {
        if (!violations.some(old => JSON.stringify(old) === JSON.stringify(violation)))
          violations.push(violation);
      }
    }
    if (!control && !fixtureState?.executed) state.fail("bootstrap_not_executed");
    const attempts = requests.filter(row => row.category === "native_measurement");
    const summary = { name, started_at: startedAt, stopped_at: stamp(),
      observation_ms: observationMs, attempts: attempts.length,
      runtime_fulfilled: requests.filter(row => row.category === "runtime" && row.locally_fulfilled).length,
      configuration_fulfilled: requests.filter(row => row.category === "configuration" && row.locally_fulfilled).length,
      dependency_closed: false, consent: name === "consent-revoked"
        ? "explicit_revoke_before_init" : "native_default_not_overridden",
      qualified_positive_run_id: null, qualified_positive_reference: false };
    const noUnknownDependency = !requests.some(row =>
      ["missing_dependency", "unknown_auxiliary"].includes(row.category));
    summary.dependency_closed = name === "query-disabled"
      ? summary.runtime_fulfilled === 0 && summary.configuration_fulfilled === 0
      : name === "consent-revoked"
        ? summary.runtime_fulfilled === 1 && summary.configuration_fulfilled === 0
          && observedState.native.callable && observedState.native.queue_length === 2
          && observedState.native.owned_pixel_count === 0 && noUnknownDependency
        : summary.runtime_fulfilled === 1 && summary.configuration_fulfilled === 1
          && noUnknownDependency;
    summary.qualified_positive_reference = !control
      && !["query-disabled", "consent-revoked"].includes(name)
      && summary.dependency_closed && attempts.length === 1
      && !violations.length && !pageErrors.length && !unsupported.length
      && requests.every(row => (row.locally_fulfilled || row.aborted) && row.body_state !== "unavailable");
    if (!control && attempts.some(row => {
      const data = fields(row);
      return data.getAll("dl").length !== 1 || data.get("dl") !== documentUrl;
    })) state.fail("native_document_relationship_mismatch");
    state.privateCases.push({ ...summary, document_url: documentUrl,
      fixture_sha256: hash(documentBytes), fixture_state: fixtureState,
      native_state: observedState.native,
      synthetic_inputs: VALUES[name] ? { value: VALUES[name], currency: "USD" } : {},
      violations, unsupported_surfaces: unsupported, page_errors: pageErrors, navigation_completed: true });
    return { summary, requests };
  } finally {
    clearTimeout(observationTimer);
    admitting = false;
    // Closing the context precedes removing interception; it cannot unseal a
    // still-executing page. Late accepted work is drained with listeners live.
    await state.budget.wait(() => context.close(), "context_cleanup_failed", 1500, 3000);
    const settleDeadline = Math.min(Date.now() + 1000, state.started + LIMITS.run_ms - 1500);
    while (pending.size && Date.now() < settleDeadline) await delay(10);
    if (pending.size) state.fail("capture_settle_timeout");
    finished = true;
    page.off("pageerror", onError);
    session.off("Fetch.requestPaused", paused);
    context.off("page", onNewPage);
    context.off("serviceworker", onServiceWorker);
    page.off("frameattached", onFrame);
    page.off("worker", onWorker);
    page.off("websocket", onSocket);
    state.contexts.delete(context);
  }
}
async function httpBoundary(state, browser, sink, manifest) {
  const target = sink.origin + sink.paths.http;
  const observed = await guardedCase(state, browser, manifest, "guard-tripwire",
    { origin: sink.origin, target });
  const attempts = observed.requests.filter(row => row.category === "http_tripwire");
  const arrivals = sink.arrivals.filter(row => row.path === sink.paths.http).length;
  const control = { attempts: attempts.length, aborted: attempts.filter(row => row.aborted).length,
    arrivals, qualified: attempts.length === 1 && attempts[0].aborted && arrivals === 0 };
  state.result.guard.http_control = control;
  if (!control.qualified || state.errors.size) reject("http_boundary_control_failed", false);
}
function gradeCases(state, manifest) {
  const rows = state.result.cases;
  const baseline = rows.find(row => row.name === "baseline");
  if (!baseline || baseline.attempts === 0) state.fail("missing_positive_reference");
  if (rows.length !== CASES.length) state.fail("incomplete_case_matrix");
  for (const row of rows) {
    if (!row.dependency_closed) state.fail("missing_dependency");
    if (!["query-disabled", "consent-revoked"].includes(row.name) && row.attempts !== 1)
      state.fail("missing_or_ambiguous_positive");
  }
  const disabled = rows.find(row => row.name === "query-disabled");
  state.result.controls.disabled_linked = baseline?.qualified_positive_reference === true
    && disabled?.attempts === 0 && disabled.dependency_closed;
  if (!state.result.controls.disabled_linked) state.fail("disabled_control_unqualified");
  const revoked = rows.find(row => row.name === "consent-revoked");
  state.result.controls.consent_negative_linked = baseline?.qualified_positive_reference === true
    && revoked?.attempts === 0 && revoked.dependency_closed;
  if (!state.result.controls.consent_negative_linked) state.fail("consent_control_unqualified");
  const contrast = ["value1", "value2"].map(name => {
    const attempts = state.requests.filter(row => row.case === name && row.category === "native_measurement");
    if (attempts.length !== 1) return false;
    const data = fields(attempts[0]);
    return data.getAll("cd[value]").length === 1 && data.get("cd[value]") === VALUES[name]
      && data.getAll("cd[currency]").length === 1 && data.get("cd[currency]") === "USD"
      && data.getAll("id").length === 1 && data.get("id") === manifest.pixel_id
      && data.get("ev") === "PageView";
  });
  state.result.controls.value_contrast = contrast.every(Boolean);
  if (!state.result.controls.value_contrast) state.fail("value_contrast_unqualified");
  for (const row of rows) row.qualified_positive_run_id =
    state.result.controls.disabled_linked ? state.result.run_id : null;
}

export async function runNativeReference(options) {
  const result = report(options?.mode === "headless-diagnostic" ? options.mode : "headed");
  if (!plain(options) || Object.keys(options).some(key => !["inputs", "outputDir", "mode", "control"].includes(key))
    || !text(options.inputs) || !isAbsolute(options.inputs)
    || !text(options.outputDir) || !isAbsolute(options.outputDir)
    || (options.mode !== undefined && !["headed", "headless-diagnostic"].includes(options.mode))
    || (options.control !== undefined && options.control !== "boundary-only")) {
    outcome(result, "invalid_input", ["invalid_options"]);
    return freeze(result);
  }
  const state = {
    started: Date.now(), result, stopped: false, published: false,
    errors: new Set(), requests: [], privateCases: [], contexts: new Set(), owned: [],
    launching: new Set(), sink: null,
    fail(category) { if (!this.published) this.errors.add(category); },
    force() {
      this.stopped = true;
      this.owned.forEach(killOwned);
      if (this.sink) { this.sink.closeAllConnections(); this.sink.close(); }
    },
  };
  const budget = budgetFor(state);
  state.budget = budget;
  result.control = options.control ?? "none";
  result.observation_window = { started_at: stamp(), stopped_at: null,
    max_wall_ms: LIMITS.run_ms, per_case_ms: LIMITS.observation_ms };
  let acquired = false;
  let manifest;
  let privateFailure = null;
  const interrupt = () => { state.fail("run_interrupted"); state.force(); };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    await budget.wait(async () => {
      budget.check();
      try { await mkdir(options.outputDir, { mode: 0o700 }); }
      catch { reject("output_directory_unavailable"); }
      budget.check();
      acquired = true;
    }, "output_acquisition_deadline", 6000);
    await budget.wait(async () => {
      const loaded = await inputsAt(options.inputs, () => budget.check());
      budget.check();
      manifest = loaded.manifest;
      result.runtime_sha256 = manifest.runtime.sha256;
      result.configuration_sha256 = manifest.configuration.sha256;
      if (options.control !== "boundary-only"
        && Object.keys(NATIVE_PINS).some(name => manifest[name].sha256 !== NATIVE_PINS[name]))
        reject("unqualified_native_resource", false);
      result.provenance = {
        source_capture_sha256: manifest.source_capture_sha256,
        input_manifest_sha256: loaded.manifest_sha256,
        fixture: "generated_synthetic_not_source_document",
        bootstrap: "stock_meta_queue_init_pageview_with_exact_url_trusted_types",
        native_resources: options.control === "boundary-only"
          ? "supplied_resources_not_executed_or_fulfilled"
          : "unmodified_retained_official_bytes_locally_fulfilled",
        source_response_statuses: { runtime: manifest.runtime.response_status,
          configuration: manifest.configuration.response_status },
        consent: "native_default_except_explicit_revoke_control",
        browser_evidence: "unmodified_no_ua_or_webdriver_override",
        runner_sha256: hash(await readFile(fileURLToPath(import.meta.url))),
        launcher_sha256: hash(await readFile(LAUNCHER)),
        network_policy_sha256: hash(await readFile(NETWORK_POLICY)),
      };
      budget.check();
      if (process.platform !== "darwin") reject("macos_sandbox_unavailable", false);
      if (process.version !== NODE_VERSION) reject("node_version_mismatch", false);
      if (release() !== OS_RELEASE) reject("os_version_mismatch", false);
      try {
        const version = await execute("/usr/bin/sw_vers", ["-productVersion"],
          { timeout: 2000, maxBuffer: 4096, signal: budget.signal });
        budget.check();
        result.macos_version = version.stdout.trim();
      } catch { reject("os_version_unavailable", false); }
      if (result.macos_version !== MACOS_VERSION) reject("os_version_mismatch", false);
      try {
        await access("/usr/bin/sandbox-exec", constants.X_OK);
        await access(LAUNCHER, constants.X_OK);
        await access(NETWORK_POLICY, constants.R_OK);
        await access(CHROME, constants.X_OK);
      } catch { reject("sandbox_or_browser_unavailable", false); }
      budget.check();
      const { chromium } = await import("playwright");
      budget.check();
      const sink = await receiver(state);
      budget.check();
      const confined = await processBoundary(state, chromium, sink, result.mode);
      budget.check();
      await resolverBoundary(state);
      budget.check();
      await httpBoundary(state, confined.browser, sink, manifest);
      budget.check();
      if (options.control === "boundary-only") reject("native_execution_not_requested", false);
      for (const name of CASES) {
        const observed = await guardedCase(state, confined.browser, manifest, name);
        budget.check();
        result.cases.push(observed.summary);
        if (name === "baseline" && observed.summary.attempts === 0) {
          state.fail("missing_positive_reference");
          break;
        }
        if (state.errors.size) break;
      }
      gradeCases(state, manifest);
      outcome(result, state.errors.size ? "inconclusive" : "qualified", [...state.errors]);
    }, "execution_deadline_exceeded", 6000);
  } catch (error) {
    privateFailure = error.stack ?? String(error);
    state.fail(error.category ?? "environment_or_capture_failed");
    outcome(result, error.invalid ? "invalid_input" : "inconclusive", [...state.errors]);
  } finally {
    state.stopped = true;
    if (state.launching.size) {
      try {
        await budget.wait(() => Promise.all([...state.launching]), "browser_launch_cleanup_timeout", 1500, 1500);
      } catch { state.fail("browser_launch_cleanup_timeout"); }
    }
    for (const context of state.contexts) {
      try { await budget.wait(() => context.close(), "context_cleanup_failed", 1500, 1000); }
      catch { state.fail("context_cleanup_failed"); }
    }
    for (const resource of state.owned) {
      try { await closeOwned(state, resource); }
      catch {
        state.fail("owned_browser_cleanup_failed");
        killOwned(resource);
        try {
          await budget.wait(async () => {
            while (resource.process.exitCode === null && resource.process.signalCode === null) await delay(10);
          }, "owned_process_exit_timeout", 1500, 500);
        } catch { state.fail("owned_process_exit_timeout"); }
      }
    }
    if (state.sink) {
      try {
        await budget.wait(() => new Promise((resolve, fail) => {
          state.sink.close(error => error && error.code !== "ERR_SERVER_NOT_RUNNING" ? fail(error) : resolve());
          state.sink.closeAllConnections();
        }), "receiver_cleanup_failed", 1500, 1000);
      } catch { state.fail("receiver_cleanup_failed"); }
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    result.cleanup = {
      owned_processes_exited: state.owned.every(resource =>
        resource.process.exitCode !== null || resource.process.signalCode !== null)
        && state.launching.size === 0,
      servers_closed: !state.sink || !state.sink.listening,
      contexts_closed: state.contexts.size === 0,
      signal_listeners_detached: !process.listeners("SIGINT").includes(interrupt)
        && !process.listeners("SIGTERM").includes(interrupt),
    };
    if (Object.values(result.cleanup).some(value => !value)) state.fail("cleanup_incomplete");
    result.observation_window.stopped_at = stamp();
    result.counts = { attempts: state.requests.filter(row => row.category === "native_measurement").length,
      recorded_requests: state.requests.length };
    if (state.errors.size) outcome(result, result.overall === "invalid_input" ? "invalid_input" : "inconclusive",
      [...result.errors, ...state.errors]);
    result.capture_complete = result.overall === "qualified" && state.requests.length > 0
      && state.requests.every(row => (row.locally_fulfilled || row.aborted) && row.body_state !== "unavailable");
    result.guard.qualified = result.capture_complete
      && result.guard.process_control?.qualified === true
      && result.guard.resolver_control?.qualified === true
      && result.guard.http_control?.qualified === true;
    const capture = {
      schema_version: 1, run_id: result.run_id, source: manifest ? {
        owned_origin: manifest.owned_origin, source_document_url: manifest.document_url,
        pixel_id: manifest.pixel_id, source_capture_sha256: manifest.source_capture_sha256,
        runtime: { url: manifest.runtime.request_url, sha256: manifest.runtime.sha256,
          source_http_status: manifest.runtime.response_status },
        configuration: { url: manifest.configuration.request_url, sha256: manifest.configuration.sha256,
          source_http_status: manifest.configuration.response_status },
      } : null,
      requests: state.requests, cases: state.privateCases, errors: [...state.errors],
      receiver_requests: state.receiverRequests ?? [],
      failure_detail: privateFailure, provenance: result.provenance,
      browser_process_ids: state.owned.map(resource => resource.process.pid),
      limits: LIMITS,
    };
    if (acquired) {
      try {
        // Serialize snapshots, not live records. Aborted/expired writes cannot
        // later resume native execution or mutate the published summary.
        await budget.wait(() => writeFile(join(options.outputDir, "capture.json"),
          JSON.stringify(capture, null, 2) + "\n",
          { mode: 0o600, flag: "wx", signal: budget.signal }), "private_output_deadline");
        result.run_elapsed_ms = Date.now() - state.started;
        await budget.wait(() => writeFile(join(options.outputDir, "report.json"),
          JSON.stringify(result, null, 2) + "\n",
          { mode: 0o600, flag: "wx", signal: budget.signal }), "private_output_deadline");
      } catch {
        outcome(result, "inconclusive", [...result.errors, ...state.errors, "private_output_failed"]);
        result.capture_complete = false;
        result.guard.qualified = false;
      }
    }
    result.run_elapsed_ms = Date.now() - state.started;
    if (result.run_elapsed_ms >= LIMITS.run_ms || state.errors.has("run_deadline_exceeded")) {
      outcome(result, "inconclusive", [...result.errors, ...state.errors, "run_deadline_exceeded"]);
      result.capture_complete = false;
      result.guard.qualified = false;
    }
    state.published = true;
    budget.finish();
  }
  return freeze(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flags = { "--inputs": "inputs", "--output-dir": "outputDir", "--mode": "mode",
    "--control": "control" };
  const options = {};
  let valid = args.length > 0 && args.length % 2 === 0;
  for (let index = 0; valid && index < args.length; index += 2) {
    const key = Object.hasOwn(flags, args[index]) ? flags[args[index]] : null;
    if (!key || Object.hasOwn(options, key) || args[index + 1].startsWith("--")) valid = false;
    else options[key] = args[index + 1];
  }
  const result = valid ? await runNativeReference(options) : report();
  if (!valid) outcome(result, "invalid_input", ["invalid_arguments"]);
  console.log(JSON.stringify(result));
  process.exitCode = result.exit_code;
}
