// 059-16. Private, SDK-absent LEGACY SUBSET qualification, not a native producer.
// Usage (Node 24): node rig/chamber-capture.mjs capture --output-dir /absolute/NEW
// Read-only:       node rig/chamber-capture.mjs inspect --output-dir /absolute/NEW
// Fixed lifecycle controls: --control cleanup-deadline | publication-deadline.
// No vendor bytes, arbitrary drivers, program, URL, source or SDK fallbacks.
import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants, closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, writeSync, chmodSync, realpathSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { createRequire } from "node:module";
import { release, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual as equal, promisify } from "node:util";
import { performance } from "node:perf_hooks";

// Node's process time origin precedes this module's imports, parsing and helpers.
// The independent execFile caller additionally measures spawn -> actual close.
export const CLI_STARTED_MS = Math.floor(performance.timeOrigin);
const ENTRY = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(ENTRY), "..");
const require = createRequire(import.meta.url);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LAUNCHER = join(ROOT, "rig/qualification-loopback-chrome");
const POLICY = join(ROOT, "rig/qualification-loopback-network.sb");
const VERSION = "155.0.8059.85";
const CONTROLS = ["none", "cleanup-deadline", "publication-deadline", "producer-abort"];
const execute = promisify(execFile);
const ASSETS = ["eds.js", "pixel-chamber.worker.js", "google-ads-chamber.worker.js"];
const BUILT_OUTPUTS = ["alloy-chamber.worker.js", "chamber.worker.js", "dom-chamber.worker.js",
  "eds.js", "floodlight-chamber.worker.js", "ga4-gtag-chamber.worker.js", "google-ads-chamber.worker.js",
  "helix-rum-chamber.worker.js", "pixel-chamber.worker.js", "reserve-personalization.js", "tag-suppressor.js"];
const SCHEMA = "airlock.sdk-absent-chamber-capture.v1";
export const CAPS = Object.freeze({ duration_ms: 60000, observed_requests: 64, url_bytes: 2048,
  request_bytes: 65536, response_bytes: 2097152, retained_bytes: 8388608 });
const CLAIMS = Object.freeze({ legacy_subset_source: true, local_only: true,
  native_qualified: false, vendor_qualified: false, full_replacement: false, attribution: false,
  whole_wire: false, sdk_executed: false, product_verified: false, C2: false, C3: false });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = reason => { throw new Error(reason); };
const check = (condition, reason) => { if (!condition) fail(reason); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = value => Buffer.from(JSON.stringify(value));
function keys(value, required, reason) {
  check(value && Object.getPrototypeOf(value) === Object.prototype
    && equal(Object.keys(value).sort(), [...required].sort()), reason);
}
function safePath(path) {
  check(typeof path === "string" && isAbsolute(path) && resolve(path) === path, "invalid_options");
  for (let part = path; ; part = dirname(part)) {
    const stat = lstatSync(part);
    check(!stat.isSymbolicLink() && stat.isDirectory(), "output_unavailable");
    if (part === dirname(part)) break;
  }
}
export function createPrivateOutput(path) {
  check(typeof path === "string" && isAbsolute(path) && resolve(path) === path, "invalid_options");
  try {
    safePath(dirname(path));
    mkdirSync(path, { mode: 0o700 });
    check((lstatSync(path).mode & 0o777) === 0o700, "output_unavailable");
  } catch { fail("output_unavailable"); }
}
function syncDir(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function retainedBytes(path) {
  let total = 0, files = 0;
  function visit(current) {
    const stat = lstatSync(current);
    check(!stat.isSymbolicLink(), "output_unavailable");
    if (stat.isDirectory()) {
      check((stat.mode & 0o777) === 0o700, "output_permissions");
      for (const name of readdirSync(current)) visit(join(current, name));
    } else {
      check(stat.isFile() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600, "private_file");
      total += stat.size;
      check(total <= CAPS.retained_bytes, "retention_limit");
      check(++files <= 64, "artifact_limit");
    }
  }
  visit(path); return total;
}
function writePrivate(path, bytes) {
  check(retainedBytes(dirname(path)) + bytes.length <= CAPS.retained_bytes, "retention_limit");
  const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
    | constants.O_NOFOLLOW, 0o600);
  try {
    check(fstatSync(fd).nlink === 1 && (fstatSync(fd).mode & 0o777) === 0o600, "output_permissions");
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      check(count > 0, "output_write"); offset += count;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDir(dirname(path));
}
export function assertDeadline(deadline, reason, observed = Date.now()) {
  if (!Number.isFinite(deadline) || observed >= deadline)
    throw Object.assign(new Error(reason), { observed_ms: observed, deadline_ms: deadline });
}
export function executionLimits(started) {
  return { work_ms: started + 45000, cleanup_ms: started + 50000,
    report_ms: started + 55000, retention_ms: started + 57500,
    child_ms: started + 57000, absolute_ms: started + CAPS.duration_ms };
}
export function launchSchedule(started, now = Date.now()) {
  const timeout_ms = Math.min(12000, executionLimits(started).work_ms - now - 2000);
  check(timeout_ms >= 2000, "launch_reserve");
  return { timeout_ms, deadline_ms: now + timeout_ms - 1000 };
}
// The ONLY report publisher, for positives AND the real expired control. A late
// fsync is a failed publication too; retain the file as an original, never amend.
export function publishReport(outputDir, report, deadline) {
  const attempted = Date.now();
  assertDeadline(deadline, "publication_deadline", attempted);
  writePrivate(join(outputDir, "report.json"), json(report));
  const completed = Date.now();
  assertDeadline(deadline, "publication_deadline", completed);
  return { status: "published", attempted_ms: attempted, completed_ms: completed,
    deadline_ms: deadline, reason: null };
}
function readPrivate(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    check(stat.isFile() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600
      && stat.size <= CAPS.retained_bytes, "private_file");
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
export function parseArgs(argv) {
  const [command, ...args] = argv;
  check(["capture", "inspect"].includes(command) && args.length % 2 === 0, "invalid_options");
  const options = { command, control: "none" }, seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    check(["--output-dir", "--control"].includes(name) && !seen.has(name)
      && typeof value === "string" && (command === "capture" || name !== "--control"), "invalid_options");
    seen.add(name);
    if (name === "--output-dir") options.outputDir = value;
    else options.control = value;
  }
  check(typeof options.outputDir === "string" && isAbsolute(options.outputDir)
    && resolve(options.outputDir) === options.outputDir && CONTROLS.includes(options.control), "invalid_options");
  return options;
}

// A graph encoding, applied BEFORE crossing Playwright's JSON boundary. Does not
// stringify away undefined, aliasing, array holes, -0, BigInt or typed buffers.
// Unhandled structured-clone kinds are explicit gaps, not flattened objects.
export function encodeOriginal(original) {
  const seen = new Map();
  function node(value) {
    if (value === undefined) return ["undefined"];
    if (value === null) return ["null"];
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
    if (["string", "boolean"].includes(typeof value)) return [typeof value, value];
    if (typeof value === "bigint") return ["bigint", String(value)];
    if (typeof value !== "object") throw Error("unsupported_original");
    if (seen.has(value)) return ["ref", seen.get(value)];
    const id = seen.size; seen.set(value, id);
    if (value instanceof ArrayBuffer) return ["buffer", id, [...new Uint8Array(value)]];
    if (ArrayBuffer.isView(value)) return ["view", id, value.constructor.name,
      node(value.buffer), value.byteOffset, value.byteLength];
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
      throw Error("unsupported_original");
    const entries = Reflect.ownKeys(value).filter(key => !(Array.isArray(value) && key === "length"))
      .map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== "string" || !("value" in descriptor)) throw Error("unsupported_original");
        return [key, node(descriptor.value)];
      });
    return Array.isArray(value) ? ["array", id, value.length, entries]
      : ["object", id, Object.getPrototypeOf(value) === null, entries];
  }
  return node(original);
}
export function decodeOriginal(encoded) {
  const seen = [];
  function node(row) {
    check(Array.isArray(row), "original_shape");
    const [type, a, b, c, d, e] = row;
    if (type === "undefined" || type === "null") {
      check(row.length === 1, "original_shape"); return type === "null" ? null : undefined;
    }
    if (["string", "boolean", "number", "bigint", "ref"].includes(type)) {
      check(row.length === 2, "original_shape");
      if (type === "ref") { check(Number.isInteger(a) && a >= 0 && a < seen.length, "original_shape"); return seen[a]; }
      if (type === "string" || type === "boolean") { check(typeof a === type, "original_shape"); return a; }
      check(typeof a === "string", "original_shape");
      if (type === "bigint") { check(/^-?\d+$/.test(a), "original_shape"); return BigInt(a); }
      check(a === "-0" || String(Number(a)) === a, "original_shape"); return Number(a);
    }
    check(a === seen.length && ["buffer", "view", "object", "array"].includes(type), "original_shape");
    let value;
    if (type === "buffer") {
      check(row.length === 3 && Array.isArray(b) && b.every(n => Number.isInteger(n) && n >= 0 && n < 256),
        "original_shape");
      value = new Uint8Array(b).buffer; seen.push(value);
    } else if (type === "view") {
      const types = { Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array,
        Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView };
      check(row.length === 6 && Object.hasOwn(types, b), "original_shape");
      seen.push(null); const buffer = node(c);
      check(buffer instanceof ArrayBuffer && Number.isInteger(d) && Number.isInteger(e), "original_shape");
      value = b === "DataView" ? new DataView(buffer, d, e)
        : new types[b](buffer, d, e / types[b].BYTES_PER_ELEMENT);
      seen[a] = value;
    } else {
      check(row.length === 4 && Array.isArray(c) && (type === "array"
        ? Number.isInteger(b) && b >= 0 && b < 100000 : typeof b === "boolean"), "original_shape");
      value = type === "array" ? new Array(b) : Object.create(b ? null : Object.prototype);
      seen.push(value); const names = new Set();
      for (const entry of c) {
        check(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string"
          && !names.has(entry[0]), "original_shape");
        names.add(entry[0]); Object.defineProperty(value, entry[0], {
          value: node(entry[1]), enumerable: true, configurable: true, writable: true,
        });
      }
    }
    return value;
  }
  return node(encoded);
}

function filesUnder(path) {
  const result = [];
  function visit(current) {
    const stat = lstatSync(current);
    check(!stat.isSymbolicLink(), "source_symlink");
    if (stat.isDirectory()) for (const name of readdirSync(current).sort()) visit(join(current, name));
    else if (stat.isFile()) result.push(current);
    else fail("source_surface");
  }
  visit(path); return result;
}
function pin(path, label = relative(ROOT, path)) {
  const bytes = readFileSync(path); return { path: label, bytes: bytes.length, sha256: hash(bytes) };
}
// Module membership from this reviewed, non-minified esbuild layout, NOT a
// detector for embedded SDKs in arbitrary bundles. The entire source closure and
// build tool tree are pinned separately; the reader checks these markers afresh.
function assetModules(bytes) {
  const paths = [...bytes.toString().matchAll(/^\/\/ ((?:core|adapters|connectors|drivers|node_modules\/web-vitals)\/[^\n]+\.js)$/gm)]
    .map(match => match[1]);
  check(paths.length > 0 && new Set(paths).size === paths.length, "asset_graph");
  return paths.map(path => pin(join(ROOT, path), path));
}
export function currentIdentity() {
  const sources = ["core", "adapters", "connectors", "drivers", "contracts"]
    .flatMap(name => filesUnder(join(ROOT, name)))
    .concat(["build.mjs", "package.json", "package-lock.json", "rig/chamber-capture.mjs",
      "rig/chamber-capture.test.mjs", "rig/qualification-loopback-chrome",
      "rig/qualification-loopback-network.sb"].map(name => join(ROOT, name)))
    .sort().map(path => pin(path));
  const dependencies = ["playwright", "playwright-core", "esbuild", "web-vitals",
    `@esbuild/${process.platform}-${process.arch}`].map(name => {
    const directory = join(ROOT, "node_modules", name);
    const entries = filesUnder(directory).map(path => pin(path, relative(directory, path)));
    return { name, version: JSON.parse(readFileSync(join(directory, "package.json"))).version,
      tree_sha256: hash(json(entries)), files: entries.length };
  });
  const launcher = readFileSync(LAUNCHER, "utf8"), policy = readFileSync(POLICY, "utf8");
  check(launcher.includes("/usr/bin/sandbox-exec") && launcher.includes(CHROME)
    && policy.includes("(deny network*)") && policy.includes('(remote ip "localhost:*")')
    && policy.includes('"/var/run/mDNSResponder"') && policy.includes('"/private/var/run/mDNSResponder"')
    && policy.includes('(deny mach-lookup (global-name "com.apple.mDNSResponder"))'), "launcher_policy");
  return { sources, dependencies, browser: { expected_version: VERSION, binary: pin(CHROME, CHROME) },
    node: { version: process.version, binary: pin(process.execPath, process.execPath) },
    os: { platform: process.platform, arch: process.arch, release: release(),
      process_inspector: pin("/bin/ps", "/bin/ps") } };
}
export function verifyIdentity(identity) { check(equal(identity, currentIdentity()), "source_identity"); }

// This is the only generated page. Its sources and serialization helper are pinned.
// Delaying initial delivery lets an INDEPENDENT worker observer attach before init.
// Values are cloned at the original postMessage boundary, never JSON-normalized.
function fixtureRuntime() {
  window.__capture = { traffic: [], input: null, pending: [], released: false, marker: null };
  const ActualWorker = window.Worker, state = window.__capture;
  window.Worker = class extends ActualWorker {
    constructor(url, options) {
      super(url, options);
      state.worker_options = options;
      const post = this.postMessage.bind(this);
      this.postMessage = (message, ...rest) => {
        const original = structuredClone(message);
        state.traffic.push({ direction: "host-post", url: String(url), value: window.__encode(original) });
        if (state.control === "event-drop" && message.type === "events") return;
        if (state.released) post(message, ...rest);
        else state.pending.push(() => post(original, ...rest));
      };
      this.addEventListener("message", event => state.traffic.push({
        direction: "host-receive", url: String(url), value: window.__encode(event.data),
      }));
    }
  };
  window.__release = () => { state.released = true; for (const send of state.pending.splice(0)) send(); };
  window.__run = async (vendor, control, replay) => {
    state.control = control;
    if (control.startsWith("source-")) {
      await new Promise(resolve => {
        const script = document.createElement("script"); script.src = "/forbidden-firstparty.js";
        script.onload = script.onerror = resolve; document.head.append(script);
      });
      return;
    }
    if (control === "main-only") {
      // Deliberate fake page marker + SAME receiver payload, never worker proof.
      state.fake_worker_marker = true;
      await fetch(replay.url, { method: replay.method }); return;
    }
    const api = await import("/eds.js");
    const consent = { ad_storage: "granted", analytics_storage: "granted",
      ad_user_data: "granted", ad_personalization: "granted" };
    const options = { endpoint: location.origin + "/sink/" + vendor, consent };
    const handle = vendor === "meta"
      ? await api.bootMetaPixel({ ...options, pixelId: "999999999999999" })
      : await api.bootGoogleAds({ ...options, conversionId: "AW-0000000000" });
    window.__handle = handle;
    const input = { event: "page_view", page_location: location.origin + "/fixture",
      page_title: "Fixed LEGACY SUBSET fixture", optional: undefined,
      binary_fixture: new Uint8Array([0, 255, 128, 65]) };
    state.input = window.__encode(input);
    handle.push(input); handle.flushNow();
  };
}
function fixtureBytes() {
  return Buffer.from(`<!doctype html><meta charset="utf-8"><title>SDK-absent legacy subset</title>
<link rel="icon" href="data:,"><script nonce="fixed-firstparty">
window.__encode=${HELPERS.encoder};(${HELPERS.fixture})();
</script>`);
}
const FORBIDDEN = Buffer.from('window.__capture.marker="executed-firstparty-forbidden-control";'
  + 'fetch("/marker-received?fixed=firstparty&dup=one&dup=two").then(r=>r.arrayBuffer());');
function workerProbe(encode) {
  const traffic = [];
  globalThis.__chamberTraffic = traffic;
  const post = globalThis.postMessage.bind(globalThis);
  globalThis.postMessage = (value, ...rest) => {
    traffic.push({ direction: "worker-post", value: encode(value) }); return post(value, ...rest);
  };
  globalThis.addEventListener("message", event => traffic.push({
    direction: "worker-receive", value: encode(event.data),
  }));
  return { actual_worker_global: typeof globalThis.WorkerGlobalScope === "function"
    && globalThis instanceof globalThis.WorkerGlobalScope,
  document_absent: typeof globalThis.document === "undefined", location: globalThis.location.href };
}
// Read the exact reviewed helpers, not loader-transformed Function.toString()
// (Vitest instruments modules). No caller can select or supply source.
const helperText = readFileSync(ENTRY, "utf8");
function between(start, end) {
  const from = helperText.indexOf(start), to = helperText.indexOf(end, from);
  check(from >= 0 && to > from, "helper_identity");
  return helperText.slice(from, to).replace(/^export /, "").trimEnd();
}
const HELPERS = Object.freeze({
  encoder: between("export function encodeOriginal(", "\nexport function decodeOriginal("),
  fixture: between("function fixtureRuntime(", "\nfunction fixtureBytes("),
  worker: between("function workerProbe(", "\n// Read the exact reviewed helpers,"),
});
check(typeof fixtureRuntime === "function" && typeof workerProbe === "function", "helper_identity");

function headerMap(raw) {
  check(Array.isArray(raw) && raw.length % 2 === 0 && raw.every(item => typeof item === "string"), "header_original");
  const result = {};
  for (let i = 0; i < raw.length; i += 2) {
    const name = raw[i].toLowerCase();
    result[name] = name in result ? result[name] + "\n" + raw[i + 1] : raw[i + 1];
  }
  return result;
}
function lowerHeaders(value) {
  check(value && typeof value === "object" && Object.values(value).every(v => typeof v === "string"), "header_original");
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.toLowerCase(), item]));
}
function rawResponseHeaders(text) {
  check(typeof text === "string" && /^HTTP\/1\.1 \d{3} /.test(text), "response_headers_missing");
  return text.split("\r\n").slice(1).filter(Boolean).flatMap(line => {
    const colon = line.indexOf(":"); check(colon > 0, "response_headers_missing");
    return [line.slice(0, colon), line.slice(colon + 1).trimStart()];
  });
}
function originalBytes(encoded, limit, reason) {
  check(typeof encoded === "string"
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),
  reason + "_encoding");
  check(encoded.length <= Math.ceil(limit / 3) * 4, reason === "response_original" ? "response_limit" : "request_limit");
  const bytes = Buffer.from(encoded, "base64");
  check(bytes.toString("base64") === encoded, reason + "_encoding");
  check(bytes.length <= limit, reason === "response_original" ? "response_limit" : "request_limit");
  return bytes;
}
function responseLength(headers) {
  headerMap(headers); // Validate the actual ordered original, not a default map.
  const lengths = [];
  for (let i = 0; i < headers.length; i += 2) {
    if (headers[i].toLowerCase() === "content-length") lengths.push(headers[i + 1]);
    check(!["transfer-encoding", "content-encoding"].includes(headers[i].toLowerCase()),
      "unsupported_response_framing");
  }
  // This closed HTTP/1 fixture has exactly one length. Even equal duplicate
  // lengths are unsupported, not silently collapsed; conflicts fail explicitly.
  check(lengths.length === 1 && /^(0|[1-9]\d*)$/.test(lengths[0])
    && Number.isSafeInteger(Number(lengths[0])), "response_content_length");
  const length = Number(lengths[0]);
  check(length <= CAPS.response_bytes, "response_limit");
  return length;
}
function responseOriginal(encoded, headers) {
  const bytes = originalBytes(encoded, CAPS.response_bytes, "response_original");
  check(bytes.length === responseLength(headers), "response_original_length");
  return bytes;
}
export function compareHttp(observed, sink) {
  check(typeof observed?.url === "string" && Buffer.byteLength(observed.url) <= CAPS.url_bytes, "url_limit");
  check(observed && sink && new URL(observed.url).origin.startsWith("http://127.0.0.1:")
    && new URL(observed.url).pathname + new URL(observed.url).search === sink.url
    && observed.method === sink.method, "http_relationship");
  check(["Fetch", "XHR"].includes(observed.resource), "legacy_transport");
  check(observed.body && observed.body.state === "absent" && observed.body.base64 === null
    && sink.body === "", "request_original_missing");
  check(Buffer.byteLength(JSON.stringify(sink.headers)) <= CAPS.request_bytes, "request_limit");
  originalBytes(sink.body, CAPS.request_bytes, "request_original");
  check(observed.extra && equal(lowerHeaders(observed.extra.headers), headerMap(sink.headers)), "request_headers_mismatch");
  check(observed.response?.body?.state === "available"
    && typeof observed.response.body.base64 === "string", "response_original_missing");
  responseOriginal(observed.response.body.base64, rawResponseHeaders(observed.response.extra?.headersText));
  responseOriginal(sink.response.body, sink.response.headers);
  check(observed.response.status === sink.response?.status
    && observed.response.extra?.statusCode === sink.response.status
    && equal(rawResponseHeaders(observed.response.extra.headersText), sink.response.headers)
    && equal(lowerHeaders(observed.response.extra.headers), headerMap(sink.response.headers))
    && observed.response.body.base64 === sink.response.body, "response_sink_mismatch");
}
const workerAsset = vendor => vendor === "meta" ? "pixel-chamber.worker.js" : "google-ads-chamber.worker.js";
function decodedTraffic(rows) {
  check(Array.isArray(rows), "worker_boundary_missing");
  return rows.map(row => {
    check(["host-post", "host-receive", "worker-post", "worker-receive"].includes(row.direction),
      "worker_boundary_missing");
    return { ...row, message: decodeOriginal(row.value) };
  });
}
export function qualifyCase(row, assets) {
  check(row.workers?.length === 1, "worker_proof_missing");
  const worker = row.workers[0];
  check(worker.source?.script_id && worker.source.body && worker.source.sha256
    && assets?.[workerAsset(row.vendor)] === worker.source.sha256
    && hash(Buffer.from(worker.source.body)) === worker.source.sha256, "worker_source_missing");
  check(worker.execution?.actual_worker_global === true && worker.execution.document_absent === true
    && worker.execution.location === worker.url && worker.url === worker.source.url
    && worker.url.endsWith("/" + workerAsset(row.vendor))
    && row.worker_options?.type === "module", "worker_execution_missing");
  const traffic = decodedTraffic(row.traffic), workerTraffic = decodedTraffic(row.worker_traffic);
  const sent = traffic.filter(item => item.direction === "host-post");
  const received = workerTraffic.filter(item => item.direction === "worker-receive");
  const results = workerTraffic.filter(item => item.direction === "worker-post");
  const delivered = traffic.filter(item => item.direction === "host-receive");
  check(sent.length === 2 && received.length === 2 && results.length === 1 && delivered.length === 1
    && equal(sent.map(item => item.value), received.map(item => item.value))
    && equal(results[0].value, delivered[0].value)
    && sent[0].message.type === "init" && sent[1].message.type === "events"
    && sent[1].message.batch?.length === 1, "worker_boundary_missing");
  const input = decodeOriginal(row.input), event = sent[1].message.batch[0];
  const origin = new URL(worker.url).origin;
  const fixedInput = { event: "page_view", page_location: origin + "/fixture",
    page_title: "Fixed LEGACY SUBSET fixture", optional: undefined,
    binary_fixture: new Uint8Array([0, 255, 128, 65]) };
  check(input && input.event === "page_view" && event.type === input.event
    && equal(input, fixedInput)
    && Number.isFinite(event.ts) && event.seq === 0
    && equal(event.params, Object.fromEntries(Object.entries(input).filter(([name]) => name !== "event"))),
  "input_relationship");
  const ready = results[0].message.ready;
  check(ready?.length === 1 && results[0].message.dropped?.length === 0
    && ready[0].method === "GET" && !Object.hasOwn(ready[0], "body"), "worker_result_missing");
  const request = row.http?.filter(item => ["Fetch", "XHR"].includes(item.resource));
  check(row.sinks?.length === 1 && request?.length === 1 && request[0].url === ready[0].url,
    "host_request_relationship");
  check(sent[0].message.endpoint === new URL(ready[0].url).origin + "/sink/" + row.vendor,
    "init_relationship");
  check(row.vendor === "meta" ? sent[0].message.name === "airlock/pixel/meta"
    && sent[0].message.paramMap?.id?.value === "999999999999999"
    : sent[0].message.conversionId === "AW-0000000000", "init_relationship");
  compareHttp(request[0], row.sinks[0]); return ready[0];
}

async function until(promise, deadline, reason) {
  check(Date.now() < deadline, reason);
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(reason)), deadline - Date.now());
    })]);
  } finally { clearTimeout(timer); }
}
async function waitFor(predicate, deadline, reason) {
  while (!predicate()) { check(Date.now() < deadline, reason); await sleep(10); }
}
function closedProcess(process) { return process && (process.exitCode !== null || process.signalCode !== null); }

// Darwin-only, like the fixed sandbox launcher. Never retain the global process
// catalog: only identities in the launcher-created, isolated Chrome group.
async function processRows(groups) {
  check(Array.isArray(groups) && groups.every(pid => Number.isSafeInteger(pid) && pid > 0), "process_group_identity");
  if (!groups.length) return [];
  let stdout;
  try {
    ({ stdout } = await execute("/bin/ps",
      ["-g", groups.join(","), "-ww", "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="],
      { timeout: 1000, maxBuffer: 2097152, env: { ...process.env, LC_ALL: "C" } }));
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return [];
    throw error;
  }
  if (!stdout.trim()) return [];
  return stdout.trim().split("\n").map(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+(.+)$/);
    check(match, "process_inspection_shape");
    return { pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), uid: Number(match[4]),
      started: match[5], state: match[6], command: match[7], command_sha256: hash(match[7]) };
  });
}
function processIdentity(row) {
  const { command: _command, ...identity } = row;
  return identity;
}
export function sameOwnedProcess(expected, current) {
  return !!expected && !!current && ["pid", "pgid", "uid", "started", "command_sha256"]
    .every(key => expected[key] === current[key]);
}
function terminatedLifetime(expected, current) {
  // Kernel zombies no longer expose the executable's argv. They cannot execute,
  // accept signals or hold descriptors; retain their original identity, and
  // require the unchanged PID/birth/group/user before classifying termination.
  return !!current && current.state.startsWith("Z") && ["pid", "pgid", "uid", "started"]
    .every(key => expected[key] === current[key]);
}
export function signalDisposition(error) {
  return !error ? "sent" : error.code === "ESRCH" ? "vanished" : "unknown";
}
function profileIdentity(path) {
  const canonical = realpathSync(path), stat = lstatSync(canonical);
  check(dirname(canonical) === realpathSync(tmpdir())
    && /^playwright_chromiumdev_profile-[A-Za-z0-9]+$/.test(canonical.split("/").at(-1))
    && stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid()
    && (stat.mode & 0o777) === 0o700, "owned_profile");
  return { path: canonical, argument_path: path, dev: stat.dev, ino: stat.ino,
    birthtime_ms: stat.birthtimeMs, uid: stat.uid };
}
async function registerBrowser(server, state) {
  const child = server.process(), rows = await processRows([child.pid]);
  const root = rows.find(row => row.pid === child.pid);
  const profileArg = child.spawnargs.find(arg => arg.startsWith("--user-data-dir="));
  check(root && profileArg && root.ppid === process.pid && root.pgid === child.pid
    && root.uid === process.getuid() && root.command.startsWith(CHROME + " "), "owned_browser_identity");
  const profile = profileIdentity(profileArg.slice("--user-data-dir=".length));
  const endpoint = new URL(server.wsEndpoint()), receiver = new URL(state.origin);
  check(endpoint.hostname === "127.0.0.1" && receiver.hostname === "127.0.0.1", "owned_endpoint");
  check(process.send, "parent_ownership_missing");
  const ownership = { root: processIdentity(root), profile,
    endpoint_port: Number(endpoint.port), receiver_port: Number(receiver.port) };
  await until(new Promise((resolve, reject) => {
    const listener = message => {
      if (message?.type === "ownership-registered" && message.pid === child.pid) {
        process.off("message", listener); resolve();
      }
    };
    process.on("message", listener);
    process.send({ type: "owned-browser", pid: child.pid, ownership },
      error => { if (error) { process.off("message", listener); reject(error); } });
  }), state.workDeadline, "ownership_registration_deadline");
}
function ownedGroup(rows, item) {
  // Node/Playwright launches detached: pgid == root PID, in a fresh session.
  // A matching birth/image anchor is required before discovering more members.
  const anchor = rows.some(row => [...item.members.values()]
    .some(known => sameOwnedProcess(known, row) || terminatedLifetime(known, row)));
  if (!anchor && rows.some(row => row.pgid === item.root.pgid)) fail("owned_group_unanchored");
  if (anchor) for (const row of rows) {
    if (row.pgid === item.root.pgid && row.uid === item.root.uid
      && row.command.startsWith("/Applications/Google Chrome.app/Contents/")) {
      check(item.members.size < 64 || item.members.has(row.pid), "owned_process_limit");
      if (!item.members.has(row.pid)) item.members.set(row.pid, processIdentity(row));
    }
  }
  return rows;
}
async function endpointClosed(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let done = false;
    const finish = closed => { if (!done) { done = true; socket.destroy(); resolve(closed); } };
    socket.once("connect", () => finish(false));
    socket.once("error", error => finish(error.code === "ECONNREFUSED"));
    socket.setTimeout(200, () => finish(false));
  });
}
async function closeLeftBehind(item, deadline) {
  const result = { pid: item.root.pid, initially_left_behind: null, status: "unknown",
    profile: item.profile, profile_removed: false, endpoint_closed: false, receiver_closed: false,
    endpoint_port: item.endpoint_port, receiver_port: item.receiver_port,
    signals: [], processes: [], errors: [] };
  try {
    check(item.verified, "ownership_unverified");
    let rows = ownedGroup(await processRows([item.root.pgid]), item);
    const states = () => [...item.members.values()].map(identity => {
      const current = rows.find(row => row.pid === identity.pid);
      return { identity, current, final: !current ? "absent" : terminatedLifetime(identity, current) ? "zombie"
        : !sameOwnedProcess(identity, current) ? "replaced" : "live" };
    });
    result.initially_left_behind = states().some(row => row.final === "live");
    item.running_after_child = result.initially_left_behind; // Immutable initial disposition.
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      for (const member of states().filter(row => row.final === "live")) {
        assertDeadline(deadline, "parent_cleanup_deadline");
        // Revalidate immediately before EACH signal. A changed birth/image/group
        // or an already vanished PID is not a signal target.
        const current = (await processRows([item.root.pgid])).find(row => row.pid === member.identity.pid);
        if (!current) {
          result.signals.push({ pid: member.identity.pid, signal, outcome: "vanished", at_ms: Date.now() }); continue;
        }
        if (!sameOwnedProcess(member.identity, current)) {
          result.errors.push("process_identity_changed"); continue;
        }
        let error;
        try { process.kill(current.pid, signal); } catch (caught) { error = caught; }
        result.signals.push({ pid: current.pid, signal, outcome: signalDisposition(error), at_ms: Date.now() });
        if (error && error.code !== "ESRCH") result.errors.push("signal_" + error.code);
      }
      const settle = Math.min(deadline, Date.now() + 750);
      do {
        rows = ownedGroup(await processRows([item.root.pgid]), item);
        if (states().every(row => ["absent", "zombie"].includes(row.final))) break;
        await sleep(25);
      } while (Date.now() < settle);
      if (states().every(row => ["absent", "zombie"].includes(row.final))) break;
    }
    result.processes = states().map(({ identity, final }) => ({ ...identity, final }));
    check(result.processes.every(row => ["absent", "zombie"].includes(row.final)), "owned_process_closure_unknown");
    // No recursive deletion until all original processes have stopped. The
    // exact launch-created inode/birth/path must still be ours; never a new path.
    try {
      const current = profileIdentity(item.profile.argument_path);
      check(equal(current, item.profile), "owned_profile_replaced");
      assertDeadline(deadline, "parent_cleanup_deadline");
      rmSync(current.path, { recursive: true });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    try { lstatSync(item.profile.path); } catch (error) {
      if (error.code === "ENOENT") result.profile_removed = true; else throw error;
    }
    [result.endpoint_closed, result.receiver_closed] = await Promise.all([
      endpointClosed(item.endpoint_port), endpointClosed(item.receiver_port),
    ]);
    check(result.profile_removed && result.endpoint_closed && result.receiver_closed, "owned_resource_closure_unknown");
    result.status = "closed"; result.closed_ms = Date.now();
  } catch (error) { result.errors.push(error.message); }
  return result;
}

// Register the PENDING acquisition before starting Playwright, not only the
// winning value of Promise.race. The observer survives timeout and owns every
// actual late resource through close and promise settlement.
async function acquireBrowser(state, phase = "primary") {
  const started = Date.now();
  const schedule = phase === "primary" ? launchSchedule(state.raw.lifecycle.started_ms, started)
    : { timeout_ms: 8000, deadline_ms: started + 3000 };
  check(started + schedule.timeout_ms + 5000 < state.limits.cleanup_ms, "launch_reserve");
  const record = { phase, started_ms: started, ...schedule, pending_at_timeout: false,
    timed_out_ms: null, registered_ms: null, delivered_ms: null, settled_ms: null,
    pid: null, exit_code: null, signal: null, closed_ms: null, failure: null };
  state.raw.acquisitions.push(record);
  const slot = { record, server: null, abandoned: false, settled: false, promise: null };
  state.acquisitions.add(slot);
  slot.promise = (async () => {
    const { chromium } = require("playwright");
    const server = await chromium.launchServer({ executablePath: LAUNCHER, headless: true,
      host: "127.0.0.1", timeout: schedule.timeout_ms,
      artifactsDir: join(state.outputDir, "browser-artifacts"),
      args: ["--disable-background-networking", "--dns-prefetch-disable"] });
    slot.server = server;
    const child = server.process();
    record.pid = child.pid; record.registered_ms = Date.now();
    const processRecord = { pid: child.pid, exit_code: null, signal: null, closed_ms: null };
    if (phase === "primary") {
      state.browserServer = server; state.raw.browser_process = processRecord;
    }
    child.once("close", (exit_code, signal) => {
      const closed_ms = Date.now();
      Object.assign(record, { exit_code, signal, closed_ms });
      Object.assign(processRecord, { exit_code, signal, closed_ms });
    });
    await registerBrowser(server, state);
    if (phase === "late-control") {
      // A REAL confined Chrome remains owned while its handoff is held. This is
      // not a fake browser, injected close failure, or tiny launch timeout.
      await sleep(Math.max(0, started + 5000 - Date.now()));
    }
    record.delivered_ms = Date.now();
    if (slot.abandoned || state.cancelling) {
      await server.close();
      await waitFor(() => record.closed_ms !== null, state.limits.cleanup_ms, "late_browser_close_deadline");
    }
    return server;
  })().catch(error => { record.failure = error.message; throw error; }).finally(() => {
    record.settled_ms = Date.now(); slot.settled = true;
  });
  // Keep the rejection observed even if the budget has expired before until().
  slot.promise.catch(() => {});
  try { return await until(slot.promise, schedule.deadline_ms, "browser_launch_deadline"); }
  catch (error) {
    slot.abandoned = true;
    if (error.message === "browser_launch_deadline") {
      record.timed_out_ms = Date.now(); record.pending_at_timeout = !slot.settled;
    }
    throw error;
  }
}

// Nested CDP sessions are worker TARGET evidence, not a page-created marker.
// Debugger source bodies are retrieved from the actual loaded worker scripts.
async function debuggerObserver(page, row, state) {
  const cdp = await page.context().newCDPSession(page);
  const pending = new Map(), sessions = new Map(); let sequence = 0;
  const send = (sessionId, method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    cdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) })
      .catch(error => { pending.delete(id); reject(error); });
  });
  cdp.on("Target.receivedMessageFromTarget", event => {
    const message = JSON.parse(event.message), target = sessions.get(event.sessionId);
    if (message.id) {
      const promise = pending.get(message.id); pending.delete(message.id);
      if (promise) message.error ? promise.reject(Error("worker_debugger_" + message.error.message))
        : promise.resolve(message.result);
    }
    if (message.method === "Debugger.scriptParsed" && message.params.url) {
      const script = message.params;
      const work = send(event.sessionId, "Debugger.getScriptSource", { scriptId: script.scriptId }).then(result => {
        const source = { url: script.url, script_id: script.scriptId, body: result.scriptSource,
          sha256: hash(Buffer.from(result.scriptSource)) };
        row.sources.push(source);
        if (target) target.source = source;
        if (script.url !== state.origin + "/" + workerAsset(row.vendor)) state.errors.push("unknown_worker_source");
      });
      state.track(work);
    }
  });
  cdp.on("Target.attachedToTarget", event => {
    const info = event.targetInfo;
    if (info.type !== "worker") { state.errors.push("unknown_target"); return; }
    const target = { target_id: info.targetId, type: info.type, url: info.url, source: null };
    sessions.set(event.sessionId, target); row.targets.push(target);
    state.track(send(event.sessionId, "Runtime.enable").then(() => send(event.sessionId, "Debugger.enable")));
  });
  await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  await cdp.send("Network.enable", { maxTotalBufferSize: CAPS.retained_bytes,
    maxResourceBufferSize: CAPS.response_bytes, maxPostDataSize: CAPS.request_bytes });
  const requests = new Map();
  cdp.on("Network.requestWillBeSent", event => {
    const request = event.request;
    const item = { id: event.requestId, url: request.url, method: request.method, resource: event.type,
      request: event, body: request.hasPostData
        ? { state: "unavailable", base64: null } : { state: "absent", base64: null },
      extra: null, response: null, failed: null };
    row.http.push(item); requests.set(item.id, item);
    if (++state.observed > CAPS.observed_requests) state.errors.push("request_limit");
    if (Buffer.byteLength(request.url) > CAPS.url_bytes) state.errors.push("url_limit");
    if (Buffer.byteLength(JSON.stringify(request.headers)) > CAPS.request_bytes) state.errors.push("request_limit");
    if (request.hasPostData) state.errors.push("unsupported_request_body");
  });
  cdp.on("Network.requestWillBeSentExtraInfo", event => {
    const item = requests.get(event.requestId);
    if (item) item.extra = event; else state.errors.push("orphan_request_extra");
  });
  const responseExtra = new Map();
  cdp.on("Network.responseReceivedExtraInfo", event => {
    responseExtra.set(event.requestId, event);
    const item = requests.get(event.requestId);
    if (item?.response) item.response.extra = event;
  });
  cdp.on("Network.responseReceived", event => {
    const item = requests.get(event.requestId);
    if (!item) { state.errors.push("orphan_response"); return; }
    item.response = { ...item.response, status: event.response.status, event,
      extra: responseExtra.get(event.requestId) || null, body: item.response?.body || null };
  });
  cdp.on("Network.loadingFailed", event => {
    const item = requests.get(event.requestId);
    if (item) item.failed = event; else state.errors.push("orphan_failure");
  });
  // Response-stage interception reads ORIGINAL bytes before releasing the actual
  // response. It also covers unconsumed host fetch bodies and worker boot scripts
  // whose Network.loadingFinished may migrate to the worker's target.
  cdp.on("Fetch.requestPaused", event => {
    const work = (async () => {
      const url = event.request.url, parsed = new URL(url), control = row.control;
      if (event.responseStatusCode === undefined) {
        const expectedResources = parsed.pathname === "/fixture" ? ["Document"]
          : parsed.pathname === "/" + workerAsset(row.vendor) ? ["Other"]
            : parsed.pathname.endsWith(".js") ? ["Script"] : ["Fetch", "XHR"];
        const allowed = expectedResources.includes(event.resourceType) && parsed.origin === state.origin && (["/fixture", "/eds.js",
          "/pixel-chamber.worker.js", "/google-ads-chamber.worker.js", "/sink/" + row.vendor].includes(parsed.pathname)
          || control === "source-bypass" && ["/forbidden-firstparty.js", "/marker-received"].includes(parsed.pathname));
        if (Buffer.byteLength(url) > CAPS.url_bytes) {
          state.errors.push("url_limit");
          await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
        } else if (!allowed) {
          row.blocked.push({ url, resource: event.resourceType });
          if (!(control === "source-enforced" && url === state.origin + "/forbidden-firstparty.js"))
            state.errors.push("source_guard");
          await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
        } else await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
        return;
      }
      const item = requests.get(event.networkId);
      check(item && event.responseStatusCode === 200, "response_original_missing");
      const responseHeaders = event.responseHeaders?.flatMap(header => [header.name, header.value]);
      responseLength(responseHeaders);
      const result = await cdp.send("Fetch.getResponseBody", { requestId: event.requestId });
      const bytes = result.base64Encoded ? originalBytes(result.body, CAPS.response_bytes, "response_original")
        : Buffer.from(result.body);
      check(bytes.length <= CAPS.response_bytes, "response_limit"); state.retain(bytes.length);
      check(bytes.length === responseLength(responseHeaders), "response_original_length");
      item.response = { ...item.response, status: event.responseStatusCode,
        extra: responseExtra.get(event.networkId) || null, fetch: event,
        body: { state: "available", base64: bytes.toString("base64") } };
      await cdp.send("Fetch.continueResponse", { requestId: event.requestId });
    })();
    state.track(work);
  });
  await cdp.send("Fetch.enable", { patterns: [
    { urlPattern: "*", requestStage: "Request" }, { urlPattern: "*", requestStage: "Response" },
  ] });
  return cdp;
}

async function browserCase(state, vendor, control, replay = null) {
  const row = { vendor, control, positive: vendor + "-positive", workers: [], targets: [], sources: [],
    worker_traffic: [], traffic: [], input: null, worker_options: null, http: [], sinks: [],
    marker: null, blocked: [], observations: { installed_before_navigation: true }, errors: [] };
  state.raw.cases.push(row); state.active = row;
  const context = await state.browser.newContext({ serviceWorkers: "block" }); state.contexts.add(context);
  let page;
  context.on("page", extra => { if (page && extra !== page) state.errors.push("unknown_page"); });
  context.on("serviceworker", () => state.errors.push("unknown_service_worker"));
  page = await context.newPage();
  page.on("frameattached", () => state.errors.push("unknown_frame"));
  page.on("websocket", () => state.errors.push("unknown_websocket"));
  page.on("pageerror", error => row.errors.push(error.message));
  page.on("worker", worker => {
    const proof = { url: worker.url(), execution: null, source: null }; row.workers.push(proof);
    const work = worker.evaluate(`(${HELPERS.worker})(${HELPERS.encoder})`).then(result => {
      proof.execution = result;
    });
    state.track(work);
  });
  await debuggerObserver(page, row, state);
  await until(page.goto(state.origin + "/fixture", { waitUntil: "load" }), state.workDeadline, "navigation_deadline");
  await until(page.evaluate(([vendor, control, replay]) => window.__run(vendor, control, replay),
    [vendor, control, replay]), state.workDeadline, "fixture_deadline");
  if (["positive", "event-drop"].includes(control)) {
    await waitFor(() => row.workers.length === 1 && row.workers[0].execution && row.targets[0]?.source,
      state.workDeadline, "worker_observation_deadline");
    await state.settle();
    row.workers[0].source = row.targets[0].source;
    await page.evaluate(() => window.__release());
    if (control === "positive") {
      await waitFor(() => row.sinks.length === 1
        && row.http.some(item => item.resource === "Fetch" && item.response?.body), state.workDeadline,
      "measurement_deadline");
    } else {
      await sleep(100);
    }
    row.worker_traffic = await page.workers()[0].evaluate(() => globalThis.__chamberTraffic);
  }
  if (control === "source-bypass") await waitFor(() => row.sinks.length === 1
    && row.http.some(item => item.resource === "Fetch" && item.response?.body && item.response.extra),
  state.workDeadline, "marker_deadline");
  await state.settle();
  const observed = await page.evaluate(() => {
    const state = window.__capture;
    return { traffic: state.traffic, input: state.input, worker_options: state.worker_options || null,
      marker: state.marker };
  });
  Object.assign(row, observed);
  // Disposal ONLY after independent global/source/boundary/receiver observations.
  await page.evaluate(() => { if (window.__handle) window.__handle.dispose(); });
  await state.settle();
  await context.close(); state.contexts.delete(context);
  state.active = null;
  return row;
}

async function openReceiver(state, assets) {
  const server = createServer((request, response) => {
    const url = request.url;
    if (Buffer.byteLength(url) > CAPS.url_bytes
      || Buffer.byteLength(JSON.stringify(request.rawHeaders)) > CAPS.request_bytes) {
      state.errors.push("receiver_limit"); request.destroy(); return;
    }
    if (url === "/owned-hold") {
      state.raw.lifecycle.hold_received_ms = Date.now();
      state.holdResponse = response; return; // Genuine ACTIVE request: server.close must wait.
    }
    const row = state.active;
    const parsed = new URL(url, state.origin), path = parsed.pathname;
    const allowed = row && (url === "/fixture" || ASSETS.includes(path.slice(1))
      || path === "/sink/" + row.vendor || row.control === "source-bypass"
        && ["/forbidden-firstparty.js", "/marker-received"].includes(path));
    if (!allowed) { state.errors.push("receiver_source_guard"); response.writeHead(403).end(); return; }
    const chunks = []; let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > CAPS.request_bytes) { state.errors.push("request_limit"); request.destroy(); }
      else chunks.push(chunk);
    });
    request.on("end", () => {
      const body = Buffer.concat(chunks); state.retain(body.length);
      const content = url === "/fixture" ? fixtureBytes() : assets[path.slice(1)]
        || (path === "/forbidden-firstparty.js" ? FORBIDDEN : Buffer.from([0, 255, 128, 65, 13, 10]));
      const headers = ["Content-Type", url === "/fixture" ? "text/html; charset=utf-8"
        : ASSETS.includes(path.slice(1)) || path.endsWith(".js") ? "application/javascript" : "application/octet-stream",
      "Cache-Control", "no-store", "Content-Length", String(content.length),
      "X-Duplicate", "one", "X-Duplicate", "two", "Date", new Date().toUTCString(),
      "Connection", "close"];
      if (url === "/fixture") headers.push("Content-Security-Policy",
        "default-src 'none'; script-src 'self' 'nonce-fixed-firstparty'; worker-src 'self'; "
        + "connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'");
      const received = { url, method: request.method, headers: [...request.rawHeaders], body: body.toString("base64"),
        response: { status: 200, headers, body: content.toString("base64") } };
      row.receiver ||= []; row.receiver.push(received);
      if (path.startsWith("/sink/") || path === "/marker-received") row.sinks.push(received);
      response.writeHead(200, headers).end(content);
    });
  });
  server.on("connection", socket => {
    state.sockets.add(socket); socket.once("close", () => state.sockets.delete(socket));
  });
  server.on("error", error => state.errors.push("receiver_" + error.code));
  await until(new Promise(resolve => server.listen(0, "127.0.0.1", resolve)), state.workDeadline, "listen_deadline");
  state.server = server; state.origin = "http://127.0.0.1:" + server.address().port;
}

async function produce(outputDir, token) {
  const start = JSON.parse(readPrivate(join(outputDir, "start.json")));
  check(start.run_id === token && CONTROLS.includes(start.control), "child_identity");
  const limits = executionLimits(start.started_ms), end = limits.absolute_ms;
  const raw = { schema: SCHEMA, run_id: token, identity: start.identity, caps: CAPS, claims: CLAIMS,
    origin: null, assets: [], fixture_sha256: hash(fixtureBytes()), forbidden_sha256: hash(FORBIDDEN),
    browser_version: null, browser_process: null, acquisitions: [], cases: [], errors: [],
    lifecycle: { started_ms: start.started_ms, browser_done_ms: null, hold_started_ms: null,
      hold_received_ms: null, expired_ms: null, cleanup_done_ms: null, publication_attempt_ms: null },
    cleanup: { contexts_closed: false, browser_closed: false, browser_process_exited: false,
      server_closed: false, sockets_closed: false, observers_settled: false, acquisitions_settled: false } };
  const state = { raw, limits, outputDir, workDeadline: limits.work_ms, errors: raw.errors, contexts: new Set(),
    acquisitions: new Set(), cancelling: false,
    sockets: new Set(), pending: new Set(), observed: 0, retained: 0,
    retain(bytes) { this.retained += bytes; if (this.retained > CAPS.retained_bytes) fail("retention_limit"); },
    track(promise) {
      const tracked = promise.catch(error => this.errors.push(error.message)).finally(() => this.pending.delete(tracked));
      this.pending.add(tracked);
    },
    async settle() {
      while (this.pending.size) await until(Promise.all([...this.pending]), end - 3000, "observer_deadline");
    } };
  const emergency = setTimeout(() => {
    state.errors.push("owned_watchdog");
    for (const socket of state.sockets) socket.destroy();
    state.cancelling = true;
    for (const slot of state.acquisitions) {
      slot.abandoned = true;
      const child = slot.server?.process();
      if (child && !closedProcess(child)) child.kill("SIGKILL");
    }
  }, Math.max(1, end - 1200 - Date.now()));
  emergency.unref();
  process.once("exit", () => clearTimeout(emergency));
  try {
    verifyIdentity(start.identity);
    createPrivateOutput(join(outputDir, "browser-artifacts"));
    const buildDir = join(outputDir, "built"); createPrivateOutput(buildDir);
    const { buildAirlock } = await import("../build.mjs");
    await until(buildAirlock({ outdir: buildDir }), state.workDeadline, "build_deadline");
    for (const path of filesUnder(buildDir)) {
      chmodSync(path, 0o600);
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { fsyncSync(fd); } finally { closeSync(fd); }
    }
    syncDir(buildDir);
    check(equal(readdirSync(buildDir).sort(), BUILT_OUTPUTS), "build_closure");
    retainedBytes(outputDir);
    const assets = Object.fromEntries(ASSETS.map(name => [name, readPrivate(join(buildDir, name))]));
    raw.assets = ASSETS.map(name => ({ name, sha256: hash(assets[name]), bytes: assets[name].length,
      modules: assetModules(assets[name]) }));
    await openReceiver(state, assets); raw.origin = state.origin;
    await acquireBrowser(state);
    const { chromium } = require("playwright");
    state.browser = await chromium.connect(state.browserServer.wsEndpoint(), { timeout: 7000 });
    assertDeadline(state.workDeadline, "connect_deadline");
    raw.browser_version = state.browser.version(); check(raw.browser_version === VERSION, "browser_cohort");
    for (const vendor of ["meta", "google"]) {
      const positive = await browserCase(state, vendor, "positive");
      const ready = qualifyCase(positive, Object.fromEntries(raw.assets.map(row => [row.name, row.sha256])));
      await browserCase(state, vendor, "main-only", ready);
      await browserCase(state, vendor, "event-drop");
    }
    await browserCase(state, "meta", "source-enforced");
    await browserCase(state, "meta", "source-bypass");
    if (start.control === "producer-abort") {
      // Preserve available actual worker/HTTP originals BEFORE the real crash.
      // A stopped genuine Chrome cannot process SIGTERM: parent must escalate.
      writePrivate(join(outputDir, "abort-originals.json"), json(raw));
      check(state.browserServer.process().kill("SIGSTOP"), "abort_stop_failed");
      process.send({ type: "abort-ready", pid: state.browserServer.process().pid });
      await new Promise(() => {}); // Parent aborts this specific producer after verifying ownership.
    }
    try { await acquireBrowser(state, "late-control"); fail("late_acquisition_not_detected"); }
    catch (error) { if (error.message !== "browser_launch_deadline") throw error; }
    await until(Promise.allSettled([...state.acquisitions].map(slot => slot.promise)),
      limits.cleanup_ms - 1000, "acquisition_settle_deadline");
  } catch (error) { raw.errors.push(error.message); }
  finally {
    raw.lifecycle.browser_done_ms = Date.now();
    state.cancelling = true;
    for (const slot of state.acquisitions) if (!slot.settled) slot.abandoned = true;
    await until(Promise.allSettled([...state.acquisitions].map(slot => slot.promise)),
      limits.cleanup_ms - 1000, "acquisition_settle_deadline").catch(error => raw.errors.push(error.message));
    raw.cleanup.acquisitions_settled = [...state.acquisitions].every(slot => slot.settled);
    for (const context of state.contexts) {
      try { await until(context.close(), end - 7000, "context_close_deadline"); state.contexts.delete(context); }
      catch (error) { raw.errors.push(error.message); }
    }
    raw.cleanup.contexts_closed = state.contexts.size === 0;
    if (state.browser) {
      try { await until(state.browser.close(), end - 7000, "browser_close_deadline"); raw.cleanup.browser_closed = true; }
      catch (error) { raw.errors.push(error.message); }
    }
    for (const slot of state.acquisitions) if (slot.server) {
      try { await until(slot.server.close(), limits.cleanup_ms, "browser_server_close_deadline"); }
      catch (error) {
        raw.errors.push(error.message);
        const process = slot.server.process();
        if (!closedProcess(process)) process.kill("SIGKILL");
        await waitFor(() => closedProcess(process), end - 4000, "browser_kill_deadline").catch(error => raw.errors.push(error.message));
      }
    }
    raw.cleanup.browser_process_exited = raw.cleanup.acquisitions_settled
      && [...state.acquisitions].every(slot => !slot.server || closedProcess(slot.server.process()));
    if (state.server) {
      if (start.control !== "none" && raw.errors.length === 0) {
        raw.lifecycle.hold_started_ms = Date.now();
        state.hold = createConnection({ host: "127.0.0.1", port: state.server.address().port });
        state.hold.on("error", error => raw.errors.push("hold_" + error.code));
        state.hold.on("connect", () => state.hold.write("GET /owned-hold HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"));
        await waitFor(() => raw.lifecycle.hold_received_ms, end - 10000, "hold_not_received");
      }
      const close = new Promise((resolve, reject) => state.server.close(error => error ? reject(error) : resolve()));
      try {
        if (start.control === "publication-deadline" && state.hold) {
          // Actual owned active request consumes the PUBLICATION window after
          // browser completion. Originals are fsynced before the expiry.
          writePrivate(join(outputDir, "pre-expiry.json"), json(raw));
          await sleep(Math.max(0, limits.report_ms + 100 - Date.now()));
          raw.lifecycle.expired_ms = Date.now();
          state.holdResponse.end(); state.hold.destroy();
          await until(close, limits.retention_ms, "server_close_deadline");
        } else await until(close, limits.cleanup_ms, "cleanup_deadline");
      } catch (error) {
        raw.errors.push(error.message); raw.lifecycle.expired_ms = Date.now();
        for (const socket of state.sockets) socket.destroy();
        state.hold?.destroy();
        await until(close, end - 3000, "server_retry_deadline").catch(error => raw.errors.push(error.message));
      }
      raw.cleanup.server_closed = !state.server.listening;
    }
    for (const socket of state.sockets) socket.destroy();
    state.hold?.destroy();
    await waitFor(() => state.sockets.size === 0, end - 1000, "socket_close_deadline")
      .catch(error => raw.errors.push(error.message));
    raw.cleanup.sockets_closed = state.sockets.size === 0;
    await state.settle().catch(error => raw.errors.push(error.message));
    raw.cleanup.observers_settled = state.pending.size === 0;
    raw.lifecycle.cleanup_done_ms = Date.now();
  }
  // No future-process-exit claim in either raw capture or report.
  try { verifyIdentity(start.identity); } catch (error) { raw.errors.push(error.message); }
  raw.lifecycle.publication_attempt_ms = Date.now();
  const bytes = json(raw);
  check(bytes.length <= CAPS.retained_bytes, "publication_limit");
  assertDeadline(limits.retention_ms, "retention_deadline");
  writePrivate(join(outputDir, "capture.json"), bytes);
  assertDeadline(limits.retention_ms, "retention_deadline");
  let qualified = false;
  try { validateRaw(raw); qualified = true; } catch (error) { state.validation_error = error.message; }
  const report = { schema: SCHEMA + ".producer", run_id: token, capture_sha256: hash(bytes),
    legacy_subset_source: true, local_only: true, claims: CLAIMS,
    case_conclusive: qualified && raw.errors.length === 0,
    failure: state.validation_error || null, command_exit_observed: false };
  let publication;
  try { publication = publishReport(outputDir, report, limits.report_ms); }
  catch (error) {
    if (error.message !== "publication_deadline") throw error;
    publication = { status: readdirSync(outputDir).includes("report.json") ? "late" : "refused",
      attempted_ms: error.observed_ms, completed_ms: null, deadline_ms: error.deadline_ms,
      reason: error.message };
  }
  // Failed originals use the reserved retention window, never the expired
  // report publisher and never overwrite a report that completed too late.
  assertDeadline(limits.retention_ms, "retention_deadline");
  writePrivate(join(outputDir, "publication.json"), json(publication));
  assertDeadline(limits.child_ms, "child_completion_deadline");
  return qualified && report.case_conclusive && publication.status === "published" ? 0 : 2;
}

function validateSources(row, raw) {
  const allowed = new Map(raw.assets.map(asset => [raw.origin + "/" + asset.name, asset.sha256]));
  const known = [raw.origin + "/fixture", ...allowed.keys()];
  if (row.control === "source-bypass") known.push(raw.origin + "/forbidden-firstparty.js",
    raw.origin + "/marker-received?fixed=firstparty&dup=one&dup=two");
  for (const source of row.sources) check(allowed.has(source.url)
    && allowed.get(source.url) === source.sha256 && hash(Buffer.from(source.body)) === source.sha256, "source_closure");
  for (const request of row.http) {
    check(typeof request.url === "string" && Buffer.byteLength(request.url) <= CAPS.url_bytes, "url_limit");
    check(request.url.startsWith(raw.origin + "/"), "source_closure");
    const measurement = request.url.startsWith(raw.origin + "/sink/" + row.vendor + "?");
    const enforced = row.control === "source-enforced" && request.url === raw.origin + "/forbidden-firstparty.js";
    check(known.includes(request.url) || measurement || enforced, "source_closure");
    if (enforced) { check(request.failed && !request.response, "source_control"); continue; }
    check(request.response?.body?.state === "available"
      && typeof request.response.body.base64 === "string", "response_original_missing");
    const responseHeaders = request.response.fetch?.responseHeaders?.flatMap(header => [header.name, header.value]);
    responseOriginal(request.response.body.base64, responseHeaders);
    if (known.includes(request.url) && !request.url.includes("marker-received")) {
      const expected = request.url === raw.origin + "/fixture" ? raw.fixture_sha256
        : request.url === raw.origin + "/forbidden-firstparty.js" ? raw.forbidden_sha256 : allowed.get(request.url);
      check(hash(Buffer.from(request.response.body.base64, "base64")) === expected, "source_closure");
    }
    const sink = row.receiver?.find(item => raw.origin + item.url === request.url);
    check(sink && request.method === sink.method && request.response.status === sink.response.status, "receiver_original_missing");
    responseOriginal(sink.response.body, sink.response.headers);
    check(request.response.body.base64 === sink.response.body, "receiver_original_missing");
    check(Buffer.byteLength(JSON.stringify(sink.headers)) <= CAPS.request_bytes
      && originalBytes(sink.body, CAPS.request_bytes, "request_original").length <= CAPS.request_bytes, "request_limit");
    check(equal(lowerHeaders(request.extra?.headers), headerMap(sink.headers))
      && equal(request.response.fetch?.responseHeaders?.flatMap(header => [header.name, header.value]),
        sink.response.headers), "http_original_headers");
    if (measurement || request.url.includes("/marker-received?")) compareHttp(request, sink);
    else check(request.resource === (request.url === raw.origin + "/fixture" ? "Document" : "Script"),
      "source_surface");
  }
  check(row.receiver?.length === row.http.length - row.blocked.length, "receiver_original_missing");
}
function validateRaw(raw) {
  keys(raw, ["schema", "run_id", "identity", "caps", "claims", "origin", "assets", "fixture_sha256",
    "forbidden_sha256", "browser_version", "browser_process", "acquisitions", "cases", "errors", "lifecycle", "cleanup"], "capture_shape");
  check(raw.schema === SCHEMA && typeof raw.run_id === "string", "capture_shape");
  verifyIdentity(raw.identity);
  check(equal(raw.caps, CAPS) && equal(raw.claims, CLAIMS), "claims");
  check(raw.browser_version === VERSION, "browser_cohort");
  check(/^http:\/\/127\.0\.0\.1:\d+$/.test(raw.origin), "origin");
  check(raw.fixture_sha256 === hash(fixtureBytes()) && raw.forbidden_sha256 === hash(FORBIDDEN), "source_closure");
  check(Array.isArray(raw.assets) && equal(raw.assets.map(row => row.name), ASSETS)
    && raw.assets.every(row => /^[a-f0-9]{64}$/.test(row.sha256) && row.bytes > 0), "asset_pins");
  const sourcePins = new Map(raw.identity.sources.map(source => [source.path, source]));
  for (const path of filesUnder(join(ROOT, "node_modules/web-vitals")))
    sourcePins.set(relative(ROOT, path), pin(path));
  for (const asset of raw.assets) {
    keys(asset, ["name", "sha256", "bytes", "modules"], "asset_graph");
    check(Array.isArray(asset.modules) && asset.modules.length > 0
      && asset.modules.every(module => module && sourcePins.has(module.path)
        && equal(module, sourcePins.get(module.path))), "asset_graph");
  }
  check(raw.cases.length === 8, "matrix_incomplete");
  const assets = Object.fromEntries(raw.assets.map(row => [row.name, row.sha256]));
  for (const row of raw.cases) {
    keys(row, ["vendor", "control", "positive", "workers", "targets", "sources", "worker_traffic",
      "traffic", "input", "worker_options", "http", "sinks", "marker", "blocked", "observations",
      "errors", "receiver"], "case_shape");
    check(row.observations.installed_before_navigation === true && row.errors.length === 0, "observation_gap");
    validateSources(row, raw);
  }
  for (const vendor of ["meta", "google"]) {
    const rows = raw.cases.filter(row => row.vendor === vendor);
    const find = control => {
      const found = rows.filter(row => row.control === control);
      check(found.length === 1 && found[0].positive === vendor + "-positive", "control_positive_link");
      return found[0];
    };
    const positive = find("positive"), ready = qualifyCase(positive, assets);
    check(positive.targets.length === 1 && positive.targets[0].target_id
      && positive.targets[0].type === "worker"
      && equal(positive.targets[0].source, positive.workers[0].source), "worker_target_missing");
    const main = find("main-only");
    check(main.sinks.length === 1, "control_not_received");
    compareHttp(main.http.find(row => row.url === raw.origin + main.sinks[0].url), main.sinks[0]);
    check(main.sinks[0].url === new URL(ready.url).pathname + new URL(ready.url).search
      && main.sinks[0].body === positive.sinks[0].body, "control_payload_mismatch");
    let reason;
    try { qualifyCase(main, assets); } catch (error) { reason = error.message; }
    check(reason === "worker_proof_missing", "worker_control");
    const dropped = find("event-drop");
    reason = null;
    try { qualifyCase(dropped, assets); } catch (error) { reason = error.message; }
    check(reason === "worker_boundary_missing" && dropped.workers.length === 1
      && dropped.sinks.length === 0 && dropped.http.every(row => !["Fetch", "XHR"].includes(row.resource))
      && decodedTraffic(dropped.traffic).some(row => row.message.type === "events")
      && decodedTraffic(dropped.worker_traffic).every(row => row.message.type !== "events"), "event_drop_control");
  }
  const enforced = raw.cases.find(row => row.control === "source-enforced");
  const bypass = raw.cases.find(row => row.control === "source-bypass");
  check(enforced && bypass && enforced.blocked.length === 1
    && enforced.blocked[0].url === raw.origin + "/forbidden-firstparty.js"
    && enforced.marker === null && enforced.sinks.length === 0 && bypass.blocked.length === 0
    && bypass.marker === "executed-firstparty-forbidden-control" && bypass.sinks.length === 1
    && bypass.sinks[0].url === "/marker-received?fixed=firstparty&dup=one&dup=two", "source_control");
  keys(raw.cleanup, ["contexts_closed", "browser_closed", "browser_process_exited",
    "server_closed", "sockets_closed", "observers_settled", "acquisitions_settled"], "cleanup_shape");
  check(Object.values(raw.cleanup).every(value => value === true), "cleanup_incomplete");
  keys(raw.lifecycle, ["started_ms", "browser_done_ms", "hold_started_ms", "hold_received_ms",
    "expired_ms", "cleanup_done_ms", "publication_attempt_ms"], "lifecycle_shape");
  check(["started_ms", "browser_done_ms", "cleanup_done_ms", "publication_attempt_ms"]
    .every(name => Number.isSafeInteger(raw.lifecycle[name])), "lifecycle_shape");
  check(raw.lifecycle.cleanup_done_ms >= raw.lifecycle.browser_done_ms
    && raw.lifecycle.publication_attempt_ms >= raw.lifecycle.cleanup_done_ms, "lifecycle_order");
  keys(raw.browser_process, ["pid", "exit_code", "signal", "closed_ms"], "browser_process");
  check(raw.browser_process.pid > 0 && raw.browser_process.exit_code === 0 && raw.browser_process.signal === null
    && raw.browser_process.closed_ms >= raw.lifecycle.browser_done_ms
    && raw.browser_process.closed_ms <= raw.lifecycle.cleanup_done_ms, "browser_process");
  check(raw.acquisitions?.length === 2, "acquisition_evidence");
  for (const acquisition of raw.acquisitions) {
    keys(acquisition, ["phase", "started_ms", "timeout_ms", "deadline_ms", "pending_at_timeout",
      "timed_out_ms", "registered_ms", "delivered_ms", "settled_ms", "pid",
      "exit_code", "signal", "closed_ms", "failure"], "acquisition_shape");
    check(acquisition.pid > 0 && acquisition.exit_code === 0 && acquisition.signal === null
      && acquisition.failure === null && acquisition.registered_ms >= acquisition.started_ms
      && acquisition.delivered_ms >= acquisition.registered_ms
      && acquisition.settled_ms >= acquisition.delivered_ms
      && acquisition.closed_ms >= acquisition.registered_ms
      && acquisition.closed_ms <= raw.lifecycle.cleanup_done_ms, "acquisition_ownership");
  }
  const [primary, late] = raw.acquisitions;
  check(primary.phase === "primary" && primary.pid === raw.browser_process.pid
    && primary.closed_ms === raw.browser_process.closed_ms && !primary.pending_at_timeout
    && primary.timed_out_ms === null
    && equal({ timeout_ms: primary.timeout_ms, deadline_ms: primary.deadline_ms },
      launchSchedule(raw.lifecycle.started_ms, primary.started_ms)), "primary_acquisition");
  check(late.phase === "late-control" && late.timeout_ms === 8000 && late.deadline_ms === late.started_ms + 3000
    && late.pending_at_timeout === true && late.timed_out_ms >= late.deadline_ms
    && late.delivered_ms >= late.started_ms + 5000 && late.closed_ms >= late.timed_out_ms
    && late.settled_ms >= late.closed_ms, "late_acquisition_control");
  check(raw.cases.reduce((n, row) => n + row.http.length, raw.lifecycle.hold_received_ms ? 1 : 0)
    <= CAPS.observed_requests, "request_limit");
  check(raw.errors.length === 0 || equal(raw.errors, ["cleanup_deadline"]), "capture_failed:" + raw.errors.join(","));
  return true;
}

export async function inspectCapture(outputDir) {
  safePath(outputDir);
  check((lstatSync(outputDir).mode & 0o777) === 0o700, "output_permissions");
  retainedBytes(outputDir);
  const start = JSON.parse(readPrivate(join(outputDir, "start.json")));
  const witness = JSON.parse(readPrivate(join(outputDir, "witness.json")));
  keys(start, ["schema", "run_id", "control", "started_ms", "identity"], "start_shape");
  keys(witness, ["schema", "run_id", "started_ms", "observed_ms", "child", "files", "identity_sha256",
    "owned_browser", "owned_acquisitions", "parent_cleanup"], "witness_shape");
  keys(witness.child, ["exit_code", "signal", "timeout", "spawned_ms", "closed_ms", "pid"], "child_completion");
  check(start.schema === SCHEMA + ".start" && witness.schema === SCHEMA + ".witness"
    && start.run_id === witness.run_id && witness.started_ms === start.started_ms
    && witness.identity_sha256 === hash(json(start.identity)), "witness_identity");
  check(CONTROLS.includes(start.control) && witness.child.exit_code === (start.control === "none" ? 0 : 2)
    && witness.child.signal === null && witness.child.timeout === false && witness.child.pid > 0
    && witness.child.spawned_ms >= start.started_ms && witness.child.closed_ms >= witness.child.spawned_ms
    && witness.observed_ms >= witness.child.closed_ms && witness.observed_ms - start.started_ms <= CAPS.duration_ms,
  "child_completion");
  const expectedFiles = ["start.json", "capture.json", "publication.json", ...(start.control === "publication-deadline"
    ? ["pre-expiry.json"] : ["report.json"])];
  check(equal(Object.keys(witness.files).sort(), expectedFiles.sort()), "witness_files");
  check(equal(readdirSync(outputDir).sort(), [...expectedFiles, "built", "browser-artifacts", "witness.json"].sort()), "output_closure");
  check(readdirSync(join(outputDir, "browser-artifacts")).length === 0, "unexpected_browser_artifact");
  safePath(join(outputDir, "built"));
  check(equal(readdirSync(join(outputDir, "built")).sort(), BUILT_OUTPUTS), "build_closure");
  for (const name of expectedFiles) check(hash(readPrivate(join(outputDir, name))) === witness.files[name], "raw_digest:" + name);
  const rawBytes = readPrivate(join(outputDir, "capture.json")), raw = JSON.parse(rawBytes);
  validateRaw(raw);
  check(raw.run_id === start.run_id && equal(raw.identity, start.identity), "capture_identity");
  keys(witness.owned_browser, ["pid", "running_after_child"], "browser_completion");
  check(witness.owned_browser.pid === raw.browser_process.pid
    && witness.owned_browser.running_after_child === false, "browser_completion");
  check(witness.owned_acquisitions?.length === raw.acquisitions.length
    && witness.owned_acquisitions.every((item, index) => item.pid === raw.acquisitions[index].pid
      && item.running_after_child === false), "acquisition_completion");
  check(witness.parent_cleanup?.length === raw.acquisitions.length
    && witness.parent_cleanup.every((item, index) => item.pid === raw.acquisitions[index].pid
      && item.status === "closed" && item.initially_left_behind === false
      && item.profile_removed === true && item.endpoint_closed === true && item.receiver_closed === true
      && item.signals?.length === 0 && item.errors?.length === 0
      && item.processes?.length > 0 && item.processes.some(row => row.pid === item.pid && row.pgid === item.pid)
      && item.processes.every(row => ["absent", "zombie"].includes(row.final)
        && row.uid === process.getuid() && /^[a-f0-9]{64}$/.test(row.command_sha256))), "parent_cleanup");
  check(raw.lifecycle.started_ms === start.started_ms
    && raw.lifecycle.publication_attempt_ms <= witness.child.closed_ms, "lifecycle_order");
  for (const asset of raw.assets) {
    const bytes = readPrivate(join(outputDir, "built", asset.name));
    check(hash(bytes) === asset.sha256 && bytes.length === asset.bytes, "asset_digest");
    check(equal(asset.modules, assetModules(bytes)), "asset_graph");
  }
  if (start.control === "none") check(raw.errors.length === 0 && raw.lifecycle.expired_ms === null, "unexpected_failure");
  else {
    const limits = executionLimits(start.started_ms);
    const boundary = start.control === "cleanup-deadline" ? limits.cleanup_ms : limits.report_ms;
    check(equal(raw.errors, start.control === "cleanup-deadline" ? ["cleanup_deadline"] : [])
      && raw.lifecycle.hold_started_ms > raw.lifecycle.browser_done_ms
      && raw.lifecycle.hold_received_ms >= raw.lifecycle.hold_started_ms
      && raw.lifecycle.expired_ms >= boundary
      && raw.lifecycle.expired_ms - raw.lifecycle.hold_started_ms > 5000, "deadline_control");
  }
  const publication = JSON.parse(readPrivate(join(outputDir, "publication.json")));
  keys(publication, ["status", "attempted_ms", "completed_ms", "deadline_ms", "reason"], "publication_shape");
  check(publication.deadline_ms === executionLimits(start.started_ms).report_ms
    && publication.attempted_ms >= raw.lifecycle.publication_attempt_ms
    && publication.attempted_ms <= witness.child.closed_ms, "publication_relationship");
  if (start.control === "publication-deadline") {
    check(publication.reason === "publication_deadline" && publication.status === "refused"
      && publication.attempted_ms >= publication.deadline_ms && publication.completed_ms === null, "publication_control");
    check(!readdirSync(outputDir).includes("report.json"), "publication_control");
  } else {
    check(publication.status === "published" && publication.reason === null
      && publication.completed_ms >= publication.attempted_ms
      && publication.completed_ms < publication.deadline_ms
      && publication.completed_ms <= witness.child.closed_ms, "publication_relationship");
    const report = JSON.parse(readPrivate(join(outputDir, "report.json")));
    keys(report, ["schema", "run_id", "capture_sha256", "legacy_subset_source", "local_only",
      "claims", "case_conclusive", "failure", "command_exit_observed"], "report_shape");
    check(report.schema === SCHEMA + ".producer" && report.run_id === raw.run_id
      && report.capture_sha256 === hash(rawBytes) && report.command_exit_observed === false
      && report.legacy_subset_source === true && report.local_only === true && equal(report.claims, CLAIMS)
      && report.case_conclusive === (start.control === "none") && report.failure === null, "report_relationship");
  }
  return { schema: SCHEMA + ".qualification", guard_qualification: "PASS",
    case_conclusive: start.control === "none", legacy_subset_source: true, local_only: true,
    native_qualified: false, whole_wire: false, unfinished: "qualified native/chamber consumer integration",
    whole_cli_completion_observed: false,
    child_exit_code: witness.child.exit_code, capture_sha256: hash(rawBytes) };
}

async function capture(options) {
  const started = CLI_STARTED_MS, limits = executionLimits(started);
  let child, timeout = false;
  const owned = new Map(), registrations = new Set();
  let monitorPending = null, abortRequested = false;
  const watchdog = setTimeout(() => {
    process.exitCode = 2;
    // Browser signals/observation use ONLY the shared identity-checked fallback,
    // never a fire-and-forget PID loop. Earlier producer cutoff reserves cleanup.
    if (child && !closedProcess(child)) { timeout = true; child.kill("SIGKILL"); }
  }, Math.max(1, limits.absolute_ms - Date.now()));
  watchdog.unref(); // Stays armed, without postponing natural process exit.
  process.once("exit", () => {
    if (Date.now() >= limits.absolute_ms) process.exitCode = 2;
    clearTimeout(watchdog);
  });
  assertDeadline(limits.absolute_ms, "cli_deadline");
  createPrivateOutput(options.outputDir);
  const runId = randomUUID(), identity = currentIdentity();
  assertDeadline(limits.absolute_ms, "cli_deadline");
  const start = { schema: SCHEMA + ".start", run_id: runId, control: options.control,
    started_ms: started, identity };
  writePrivate(join(options.outputDir, "start.json"), json(start));
  assertDeadline(limits.absolute_ms, "cli_deadline");
  const spawned = Date.now();
  child = spawn(process.execPath, [ENTRY, "--_fixed-child", options.outputDir, runId],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let bytes = 0, stderr = "";
  child.on("message", message => {
    if (message?.type === "owned-browser" && Number.isSafeInteger(message.pid) && message.pid > 0
      && message.ownership?.root?.pid === message.pid && !owned.has(message.pid)) {
      const item = { ...message.ownership, verified: false, errors: [],
        members: new Map([[message.pid, message.ownership.root]]), running_after_child: null };
      owned.set(message.pid, item);
      const registration = (async () => {
        const rows = await processRows([message.pid]), root = rows.find(row => row.pid === message.pid);
        check(root && sameOwnedProcess(item.root, root) && root.ppid === child.pid
          && root.pgid === root.pid && root.uid === process.getuid()
          && root.command.startsWith(CHROME + " ")
          && root.command.includes("--user-data-dir=" + item.profile.argument_path), "parent_ownership_identity");
        check(equal(profileIdentity(item.profile.argument_path), item.profile), "parent_profile_identity");
        check([item.endpoint_port, item.receiver_port].every(port => Number.isInteger(port) && port > 0 && port < 65536),
          "parent_endpoint_identity");
        ownedGroup(rows, item); item.verified = true;
        if (child.connected) child.send({ type: "ownership-registered", pid: root.pid });
      })().catch(error => item.errors.push(error.message)).finally(() => registrations.delete(registration));
      registrations.add(registration);
    }
    if (message?.type === "abort-ready" && options.control === "producer-abort" && !abortRequested) {
      abortRequested = true;
      const abort = (async () => {
        const item = owned.get(message.pid);
        check(item?.verified, "abort_ownership_missing");
        const rows = ownedGroup(await processRows([item.root.pgid]), item), root = rows.find(row => row.pid === message.pid);
        check(sameOwnedProcess(item.root, root) && root.state.includes("T"), "abort_not_actually_stopped");
        writePrivate(join(options.outputDir, "abort-parent.json"), json({
          observed_ms: Date.now(), stopped_root: processIdentity(root), profile: item.profile,
          members: [...item.members.values()],
        }));
        child.kill("SIGKILL");
      })().catch(error => { stderr += error.message; child.kill("SIGKILL"); })
        .finally(() => registrations.delete(abort));
      registrations.add(abort);
    }
  });
  const monitor = setInterval(() => {
    if (monitorPending || closedProcess(child)) return;
    monitorPending = processRows([...owned.keys()]).then(rows => {
      for (const item of owned.values()) if (item.verified) {
        try { ownedGroup(rows, item); } catch (error) { item.errors.push(error.message); }
      }
    }).catch(error => { stderr += error.message; }).finally(() => { monitorPending = null; });
  }, 500);
  monitor.unref();
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    bytes += chunk.length;
    if (bytes <= 16384 && stream === child.stderr) stderr += chunk.toString();
    if (bytes > 16384) child.kill("SIGKILL");
  });
  const timer = setTimeout(() => { timeout = true; child.kill("SIGKILL"); },
    Math.max(1, limits.child_ms - Date.now()));
  const completion = await new Promise(resolve => {
    child.on("error", error => { stderr += error.message; });
    child.on("close", (exit_code, signal) => resolve({ exit_code, signal, timeout,
      spawned_ms: spawned, closed_ms: Date.now(), pid: child.pid || null }));
  });
  clearTimeout(timer);
  clearInterval(monitor);
  if (monitorPending) await monitorPending;
  while (registrations.size) await Promise.all([...registrations]);
  // Keep ownership until every registered browser's specific processes, endpoint
  // and private profile are observed closed. Unknown closure stays inconclusive.
  const parentCleanup = await Promise.all([...owned.values()].map(item =>
    closeLeftBehind(item, limits.absolute_ms - 700)));
  assertDeadline(limits.absolute_ms, "cli_deadline");
  const files = {};
  for (const name of ["start.json", "capture.json", "report.json", "pre-expiry.json", "publication.json",
    "abort-originals.json", "abort-parent.json"]) {
    if (readdirSync(options.outputDir).includes(name)) files[name] = hash(readPrivate(join(options.outputDir, name)));
    assertDeadline(limits.absolute_ms, "cli_deadline");
  }
  verifyIdentity(identity);
  assertDeadline(limits.absolute_ms, "cli_deadline");
  // This timestamp is a CHILD/source observation, not this process's completion.
  // Only the external caller can witness our actual exit and post-exit digests.
  const witness = { schema: SCHEMA + ".witness", run_id: runId, started_ms: started,
    observed_ms: Date.now(), child: completion, files, identity_sha256: hash(json(identity)),
    owned_browser: owned.size ? { pid: [...owned.keys()][0], running_after_child: [...owned.values()][0].running_after_child }
      : { pid: null, running_after_child: null },
    owned_acquisitions: [...owned.entries()].map(([pid, item]) => ({ pid, running_after_child: item.running_after_child })),
    parent_cleanup: parentCleanup };
  assertDeadline(limits.absolute_ms, "cli_deadline");
  writePrivate(join(options.outputDir, "witness.json"), json(witness));
  assertDeadline(limits.absolute_ms, "cli_deadline"); // Includes fsync + directory IO.
  try {
    const qualified = await inspectCapture(options.outputDir);
    assertDeadline(limits.absolute_ms, "cli_deadline"); // Includes all reader hashing.
    console.log(JSON.stringify({ ...qualified, output: options.outputDir }));
    assertDeadline(limits.absolute_ms, "cli_deadline");
    return qualified.case_conclusive ? 0 : 2;
  } catch (error) {
    const rawFailures = files["capture.json"] ? JSON.parse(readPrivate(join(options.outputDir, "capture.json"))).errors : [];
    console.log(JSON.stringify({ guard_qualification: "INCONCLUSIVE", reason: error.message,
      child: completion, child_error: stderr.slice(0, 1000), failures: rawFailures, output: options.outputDir }));
    return 2;
  }
}
if (process.argv[1] === ENTRY) {
  try {
    if (process.argv[2] === "--_fixed-child") {
      check(process.argv.length === 5, "invalid_options");
      process.exitCode = await produce(process.argv[3], process.argv[4]);
    } else {
      const options = parseArgs(process.argv.slice(2));
      if (options.command === "inspect") console.log(JSON.stringify(await inspectCapture(options.outputDir)));
      else process.exitCode = await capture(options);
    }
  } catch (error) { console.error(JSON.stringify({ status: "INCONCLUSIVE", reason: error.message })); process.exitCode = 2; }
}
