import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createServer as httpServer } from "node:http";
import { createServer as h2Server } from "node:http2";
import { connect as tcpConnect } from "node:net";
import { createServer as tlsServer } from "node:tls";
import { release } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isProxy } from "node:util/types";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { reserveStockSlot } from "./native-stock-capture.mjs";
import { LIMITS, META_REFERENCE_COHORTS, createNativeStockPolicy } from "./native-stock-policy.mjs";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { inspectedDecoderDependencyPins, startLocalInspectedTransport, startNativeInspectedTransport } from "./inspected-transport.mjs";

const fail = category => { throw new Error(category); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const execute = promisify(execFile);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const plans = new WeakMap();
const PINS = META_REFERENCE_COHORTS["retained-2026-10-15"];
const COHORT = Object.freeze({ node: "v24.10.0", chrome: "155.0.8059.85", playwright: "1.62.1",
  macos: "27.0.1", darwin: "27.0.0", headless: false, transport: "inspected-network" });
const CHROME_INFO = "/Applications/Google Chrome.app/Contents/Info.plist";
const REVIEW_SCOPE = "059-15-inspected-meta-pre-admission-code";
const CLAIMS = Object.freeze({ native_sdk_executed: false, execution_authority: false,
  full_native_guard_qualified: false, source_bytes_verified: false,
  independent_ownership_authentication: false, native_execution_qualified: false,
  native_tls_parity: false, product_receipt: false, matching: false, attribution: false });
const AUTHORITY_LIMITS = Object.freeze({
  google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
  google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
  google_vendor_https_requests_per_case: 20, meta_vendor_https_requests_per_case: 8,
  observed_requests_per_case: 64, absolute_seconds_per_case: 60, url_bytes: 2048,
  request_headers_and_body_bytes: 65536, response_bytes: 2097152, retained_aggregate_bytes: 8388608,
});
const INSPECTION_SCOPE = Object.freeze({
  case_name: "meta-stock", pageview_commands: 1, physical_vendor_http_attempt_ceiling: 8,
  absolute_seconds: 60, uses_original_existing_meta_stock_slot: true,
  additional_events_or_retry_grants: false, temporary_inspector_trust_in_isolated_browser: true,
  upstream_real_collector_certificate_validation_required: true, inspected_network_not_chrome_tls: true,
});
const LOCAL_RUNTIME = `/* Fixed first-party SDK-ABSENT fixture; not fbq or Meta source. */
window.__localFixture={init:0,pageview:0,outcomes:[]};
window.__localInit=()=>{if(++window.__localFixture.init!==1)throw Error("duplicate_init")};
window.__localPageView=url=>new Promise(resolve=>{
 if(++window.__localFixture.pageview!==1)throw Error("duplicate_pageview");
 const image=new Image();image.onload=()=>{window.__localFixture.outcomes.push(true);resolve()};
 image.onerror=()=>{window.__localFixture.outcomes.push(false);resolve()};image.src=url;
});
`;
const LOCAL_CONFIGURATION = "/* Fixed first-party SDK-ABSENT configuration. */\nwindow.__localConfiguration=true;\n";
const LOCAL_ASSERTIONS = Object.freeze({
  setup: { complete_live_preflight: false, case_specific_source_cohort_and_window_bound: false, fixture_bound: true },
  coordination: { local_only: true, no_public_measurement: true },
  qualified_source: { fixture_bytes_verified: true, native_surface_qualified: false },
  guard: { sdk_absent_controller_only: true, full_native_guard_qualified: false },
  frame: { verdict: "not-a-native-review", scope: "sdk-absent-controller" },
  compliance: { verdict: "not-a-native-review", scope: "sdk-absent-controller" },
  craft: { verdict: "not-a-native-review", scope: "sdk-absent-controller" },
  architecture: { verdict: "not-a-native-review", scope: "sdk-absent-controller" },
  reconciliation: { verdict: "not-a-native-review", scope: "sdk-absent-controller" },
});
const NATIVE_ASSERTIONS = Object.freeze({
  setup: ["complete_live_preflight", "case_specific_source_cohort_and_window_bound", "owned_setup_verified"],
  coordination: ["current_control_hold_released", "source_unchanged", "nonoverlapping"],
  qualified_source: ["retained_bytes_verified", "declared_dependency_guard_qualified", "source_authentication"],
  guard: ["sdk_absent_guard_qualified", "physical_semantic_policy_qualified", "closed_controller_qualified"],
});
const nativeTransportLeases = new WeakMap();
function record(value, required, optional = []) {
  if (!value || typeof value !== "object" || isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("invalid_case_input");
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (required.some(key => !Object.hasOwn(fields, key))
    || keys.some(key => !required.includes(key) && !optional.includes(key))
    || keys.some(key => !Object.hasOwn(fields[key], "value"))) fail("invalid_case_input");
  return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}

function data(value, depth = 0, budget = { nodes: 0, limit: 4096 }) {
  if (++budget.nodes > budget.limit || depth > 12 || isProxy(value)) fail("invalid_case_input");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.isWellFormed() && Buffer.byteLength(value) <= 65536) return value;
  if (!value || typeof value !== "object") fail("invalid_case_input");
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail("invalid_case_input");
    const descriptors = Object.getOwnPropertyDescriptors(value), size = descriptors.length.value;
    if (size > 256 || Reflect.ownKeys(descriptors).length !== size + 1) fail("invalid_case_input");
    return Array.from({ length: size }, (_, n) => {
      if (!Object.hasOwn(descriptors[n] ?? {}, "value")) fail("invalid_case_input");
      return data(descriptors[n].value, depth + 1, budget);
    });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const input = record(value, Reflect.ownKeys(descriptors));
  const output = Object.create(null);
  const keys = Reflect.ownKeys(input);
  if (keys.some(key => typeof key !== "string")) fail("invalid_case_input");
  for (const key of keys.sort()) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail("invalid_case_input");
    output[key] = data(input[key], depth + 1, budget);
  }
  return output;
}
const equal = (a, b) => JSON.stringify(data(a)) === JSON.stringify(data(b));

// JSON.parse alone silently accepts duplicate keys, including inside handles.
function json(bytes, maximumNodes = 4096) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("invalid_case_json"); }
  // eslint-disable-next-line no-control-regex -- JSON strings cannot contain literal control octets.
  const token = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let offset = 0, nodes = 0;
  const next = () => {
    while (/\s/.test(text[offset] ?? "") && offset < text.length) offset++;
    token.lastIndex = offset;
    const match = token.exec(text);
    if (!match) fail("invalid_case_json");
    offset = token.lastIndex; return match[0];
  };
  const visit = (first = next(), depth = 0) => {
    if (++nodes > maximumNodes || depth > 12) fail("invalid_case_json");
    if (!["{", "["].includes(first)) {
      if (/^[}\],:]$/.test(first)) fail("invalid_case_json");
      return;
    }
    const object = first === "{", end = object ? "}" : "]", seen = new Set();
    let item = next();
    if (item === end) return;
    while (true) {
      if (object) {
        if (!item.startsWith('"')) fail("invalid_case_json");
        const key = JSON.parse(item);
        if (seen.has(key)) fail("duplicate_case_key");
        seen.add(key);
        if (next() !== ":") fail("invalid_case_json");
        item = next();
      }
      visit(item, depth + 1);
      const separator = next();
      if (separator === end) return;
      if (separator !== ",") fail("invalid_case_json");
      item = next();
    }
  };
  visit();
  if (text.slice(offset).trim()) fail("invalid_case_json");
  try { return data(JSON.parse(text), 0, { nodes: 0, limit: maximumNodes }); } catch { fail("invalid_case_json"); }
}
function absolute(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path || path.includes("\0"))
    fail("unsafe_case_path");
  return path;
}
function privateParent(path) {
  const stat = lstatSync(dirname(absolute(path)));
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o7777) !== 0o700) fail("unsafe_case_parent");
}
const identity = path => {
  const s = lstatSync(path, { bigint: true });
  return [s.dev, s.ino, s.nlink, s.size, s.mode, s.mtimeNs, s.ctimeNs].join(":");
};
function readHandle(value, snapshots, maximum = 65536, root = null) {
  const handle = record(value, ["path", "sha256"]);
  absolute(handle.path);
  if (!digest(handle.sha256)) fail("invalid_case_digest");
  if (root && !handle.path.startsWith(root + "/")) fail("nonlocal_fixture_handle");
  let before, after, bytes;
  try {
    privateParent(handle.path);
    before = identity(handle.path); bytes = readMetaPrivate(handle.path, maximum); after = identity(handle.path);
  } catch { fail("private_case_handle_unavailable"); }
  if (after !== before || hash(bytes) !== handle.sha256) fail("stale_case_handle");
  snapshots.push({ handle, maximum, identity: before });
  return bytes;
}
function unchanged(state) {
  for (const item of state.snapshots) {
    try {
      if (identity(item.handle.path) !== item.identity
        || hash(readMetaPrivate(item.handle.path, item.maximum)) !== item.handle.sha256) fail("case_source_changed");
    } catch { fail("case_source_changed"); }
  }
  let pins;
  try { pins = inspectedMetaSourcePins(); } catch { fail("runtime_source_changed"); }
  if (!equal(state.manifest.binding.source_pins, pins) || !equal(pins, LOADED_SOURCE_PINS)) fail("runtime_source_changed");
}
function check(state) {
  const now = Date.now(), monotonic = performance.now();
  if (!Number.isFinite(now) || !Number.isFinite(monotonic) || now < state.lastWall || monotonic < state.lastMono)
    fail("case_clock_invalid");
  state.lastWall = now; state.lastMono = monotonic;
  const window = state.manifest.binding.window;
  if (now < window.not_before_ms || now >= window.expires_at_ms
    || monotonic - state.started >= LIMITS.duration_ms) fail("case_window_inactive");
}
function outputAvailable(path) {
  absolute(path);
  const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (path.startsWith(project + "/") && !path.startsWith(join(project, "rig/out") + "/"))
    fail("private_output_namespace_required");
  privateParent(path);
  // readMetaPrivate checks ancestors for inputs. Output has no file to open.
  for (let parent = dirname(path);;) {
    const s = lstatSync(parent);
    if (!s.isDirectory() || s.isSymbolicLink()) fail("unsafe_case_path");
    if (parent === dirname(parent)) break;
    parent = dirname(parent);
  }
  if (existsSync(path)) fail("case_output_exists");
  // existsSync reports false for dangling links.
  try { lstatSync(path); fail("case_output_exists"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

export function inspectedMetaSourcePins() {
  const require = createRequire(import.meta.url);
  const files = ["inspected-meta-stock.mjs", "inspected-meta-stock.test.mjs",
    "inspected-transport.mjs",
    "native-stock-capture.mjs", "native-stock-capture.test.mjs",
    "native-stock-meta.mjs", "native-stock-meta.test.mjs", "native-stock-egress.mjs", "native-stock-egress.test.mjs",
    "native-stock-policy.mjs", "native-stock-policy.test.mjs",
    "inspected-http-wire.mjs", "inspected-http-wire.test.mjs",
    "inspected-meta-policy.mjs", "inspected-meta-policy.test.mjs",
    "inspected-header-block.mjs", "inspected-header-block.test.mjs",
    "reference-inspection.mjs", "reference-inspection.test.mjs",
    "qualification-loopback-chrome", "qualification-loopback-network.sb", "../package.json", "../package-lock.json"];
  return { ...Object.fromEntries(files.map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))])),
    playwright_entry: hash(readFileSync(new URL(import.meta.resolve("playwright")))),
    playwright_driver_bundle: hash(driverBundle()),
    chrome_bundle_info: hash(chromeInfo()),
    hpack_entry: hash(readFileSync(require.resolve("hpack.js"))),
    header_decoder_dependencies: inspectedDecoderDependencyPins(),
    playwright_version: require("playwright/package.json").version };
}
function chromeInfo() {
  const before = lstatSync(CHROME_INFO);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 65536)
    fail("unsafe_chrome_cohort_metadata");
  const pinned = identity(CHROME_INFO), bytes = readFileSync(CHROME_INFO);
  if (identity(CHROME_INFO) !== pinned || bytes.length !== before.size) fail("chrome_cohort_changed");
  return bytes;
}
function driverBundle() {
  const require = createRequire(import.meta.url);
  const path = join(dirname(require.resolve("playwright-core/package.json")), "lib/coreBundle.js");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16777216)
    fail("unsafe_driver_source");
  return readFileSync(path);
}
function driverGuardHashes() {
  // Derive the exact first-party service-worker guard from the PINNED
  // installed driver, not from an observed denial or an anonymous-code bypass.
  const source = driverBundle().toString("utf8");
  const guards = [...source.matchAll(/addInitScript\(\s*nullProgress,\s*`([\s\S]*?)`/g)]
    .filter(match => match[1].includes("navigator.serviceWorker.register"));
  const wrappers = [...source.matchAll(/`(\(\(\) => \{\n {6})\$\{([A-Za-z_$][\w$]*)\}(\n {4}\}\)\(\);)`/g)];
  if (guards.length !== 1 || wrappers.length !== 1 || guards[0][1].includes("${") || guards[0][1].includes("\\"))
    fail("unsupported_driver_guard_source");
  return [hash(""), hash(wrappers[0][1] + guards[0][1] + wrappers[0][3])];
}
export function inspectedMetaBindingDigest(binding) { return hash(JSON.stringify(data(binding))); }
export function inspectedMetaCasePermissionDigest(binding) {
  const { case_permission: _permission, ...context } = data(binding);
  return inspectedMetaBindingDigest(context);
}
export function localInspectedMetaDefinition() {
  return data({ runtime: LOCAL_RUNTIME, configuration: LOCAL_CONFIGURATION, cohort: COHORT,
    limits: LIMITS, authority_limits: AUTHORITY_LIMITS, inspection_scope: INSPECTION_SCOPE,
    evidence_assertions: LOCAL_ASSERTIONS });
}

function profileOf(inputs, local) {
  return { schema_version: 1, profile: "meta-pageview", case_name: "meta-stock",
    document_url: inputs.document_url, owned: { pixel_id: inputs.pixel_id }, companion_authorized: false,
    resources: ["runtime", "configuration"].map(role => ({
      role, url: inputs[role].request_url, sha256: local ? PINS[role] : inputs[role].sha256,
    })) };
}
function authorityAt(value, local) {
  if (value.schema_version !== 1 || value.kind !== "owner_conversation_authority"
    || value.status !== "approved_conditional" || !equal(value.limits, AUTHORITY_LIMITS)
    || (local ? value.synthetic_only !== true || !/^synthetic-inspected-meta-[a-z0-9-]{1,32}$/.test(value.authority_id)
      : value.authority_id !== "google-meta-paired-2026-10-19" || Object.hasOwn(value, "synthetic_only")))
    fail("invalid_original_authority");
  record(value.cases, ["google-stock", "google-chamber", "meta-stock", "meta-chamber"]);
  for (const name of Object.keys(value.cases))
    if (!equal(value.cases[name], { reserved: false, admitted: false, spent: false })) fail("original_case_unavailable");
  const required = ["schema_version", "kind", "status", "authority_id", "cases", "limits"];
  if (local) record(value, [...required, "synthetic_only"]);
  else record(value, required, [
    "authority_id_purpose", "date", "owner_selected_exactly", "approved_question", "requirements", "excluded",
    "adobe_handoff", "not_an_executable_live_case_manifest", "guard_currently_live_qualified",
    "fresh_setup_currently_verified", "owner_setup_facts_received", "owner_setup_receipt",
    "fresh_case_specific_live_preflight_still_required", "owner_response_limit_clarification",
    "owner_reference_header_timing_exception", "candidate_or_production_rules_relaxed",
    "native_or_chamber_case_started_by_this_approval_record",
  ]);
}
function preparedPlan(state, complete) {
  state.nativeReady = complete && !state.local && state.blockers.length === 0;
  const plan = Object.freeze({ schema: "airlock.inspected-meta-plan.v1", case_name: "meta-stock",
    transport: "inspected-network", preparation_complete: complete,
    execution: state.local ? "LOCAL-ONLY" : state.nativeReady ? "READY-FOR-EXPLICIT-RUN" : "BLOCKED",
    blockers: Object.freeze([...state.blockers]), ...CLAIMS });
  plans.set(plan, state); return plan;
}
function readEvidence(state) {
  const { manifest, local, snapshots, root } = state, binding = manifest.binding;
  const evidence = record(manifest.evidence, Object.keys(LOCAL_ASSERTIONS));
  for (const name of Object.keys(LOCAL_ASSERTIONS)) {
    if (evidence[name] === null) {
      if (local) fail("local_evidence_missing");
      state.blockers.push(name + "_proof_missing"); continue;
    }
    const receipt = json(readHandle(evidence[name], snapshots, 65536, root));
    record(receipt, ["schema_version", "kind", "layer", "binding_sha256", "valid_until_ms", "assertions"],
      local ? [] : ["issued_at_ms", "qualification", "review_artifact"]);
    if (receipt.schema_version !== 1 || receipt.kind !== "inspected-meta-" + name
      || receipt.binding_sha256 !== inspectedMetaBindingDigest(binding)
      || !Number.isSafeInteger(receipt.valid_until_ms) || receipt.valid_until_ms < binding.window.expires_at_ms)
      fail("stale_case_evidence");
    if (local) {
      if (receipt.layer !== "synthetic-sdk-absent" || !equal(receipt.assertions, LOCAL_ASSERTIONS[name]))
        fail("invalid_local_evidence");
      continue;
    }
    // Native preflight does not require this case to have already executed.
    // SDK-absent guard evidence and an actual reviewed case permission are
    // separate layers; local fixture assertions alone are never authority.
    if (receipt.layer !== "reviewed-inspected-meta-preflight") fail("synthetic_evidence_not_native_authority");
    if (!Number.isSafeInteger(receipt.issued_at_ms) || receipt.issued_at_ms < 0 || receipt.issued_at_ms > Date.now()
      || receipt.issued_at_ms > binding.window.not_before_ms
      || receipt.valid_until_ms !== binding.window.expires_at_ms) fail("stale_native_lease");
    if (Object.hasOwn(NATIVE_ASSERTIONS, name)) {
      const assertions = record(receipt.assertions, NATIVE_ASSERTIONS[name]);
      if (Object.values(assertions).some(value => typeof value !== "boolean")) fail("invalid_native_evidence");
      if (Object.values(assertions).some(value => !value))
        state.blockers.push(name + "_proof_incomplete");
      if (Object.hasOwn(receipt, "review_artifact")
        || name !== "guard" && Object.hasOwn(receipt, "qualification")) fail("invalid_native_evidence");
      if (name === "guard") {
        if (!receipt.qualification) state.blockers.push("guard_qualification_witness_missing");
        else verifyQualification(state, receipt.qualification);
      }
    } else {
      const assertions = record(receipt.assertions, ["verdict", "scope"]);
      if (!["pass", "needs-changes", "not-run"].includes(assertions.verdict)
        || assertions.scope !== REVIEW_SCOPE) fail("invalid_native_review_scope");
      if (assertions.verdict !== "pass") state.blockers.push(name + "_review_incomplete");
      if (!receipt.review_artifact) { state.blockers.push(name + "_actual_review_missing"); continue; }
      if (Object.hasOwn(receipt, "qualification")) fail("invalid_native_evidence");
      const review = json(readHandle(receipt.review_artifact, snapshots, 65536));
      record(review, ["schema", "binding_sha256", "source_pins_sha256", "scope", "verdict",
        "reviewer_id", "reviewer_kind", "completed_at_ms", "reviewer_completion_observed", "reviewer_turn"]);
      if (review.schema !== "airlock.independent-review-receipt.v2"
        || review.binding_sha256 !== inspectedMetaBindingDigest(binding)
        || review.source_pins_sha256 !== inspectedMetaBindingDigest(binding.source_pins)
        || review.scope !== assertions.scope || review.verdict !== "pass"
        || typeof review.reviewer_id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(review.reviewer_id)
        || review.reviewer_kind !== "independent" || !Number.isSafeInteger(review.completed_at_ms)
        || review.completed_at_ms < 0 || review.completed_at_ms > receipt.issued_at_ms
        || review.reviewer_completion_observed !== true || !Number.isSafeInteger(review.reviewer_turn)
        || review.reviewer_turn < 0) fail("actual_review_invalid");
    }
  }
}
function verifyQualification(state, handle) {
  const index = json(readHandle(handle, state.snapshots, 2097152));
  if (index.schema !== "airlock.sdk-absent-inspected-meta-validation.v1"
    || !equal(index.source_pins, state.manifest.binding.source_pins)
    || index.official_sdk_executed !== false || index.public_upstream_requests !== 0
    || index.actual_owner_slots_reserved !== 0 || !Array.isArray(index.controller) || !Array.isArray(index.relay)
    || index.controller.length !== 14 || index.relay.length !== 11) fail("guard_qualification_invalid");
  const seen = new Set();
  for (const [family, rows] of [["controller", index.controller], ["relay", index.relay]]) {
    for (const row of rows) {
      if (typeof row.root !== "string" || row.root.length > 4096) fail("guard_qualification_invalid");
      if (!digest(row.capture_sha256) || row.capture_digest_recorded_after_child_exit !== true
        || row.command_exit_observed !== true) fail("guard_capture_witness_missing");
      const root = isAbsolute(row.root) ? absolute(row.root) : resolve(row.root);
      const original = (name, sha256, maximum = 2097152) =>
        readHandle({ path: join(root, name), sha256 }, state.snapshots, maximum);
      const report = json(original("run/report.json", row.report_sha256), 16384);
      const child = json(original("actual-child.json", row.actual_child_sha256));
      const witness = json(original("verified-child.json", row.verified_child_sha256));
      if (child.command_exit_observed !== true || !Number.isInteger(child.code)
        || row.actual_exit_code !== child.code
        || (witness.actual_exit_code ?? witness.code) !== child.code
        || witness.report_sha256 !== row.report_sha256 || child.elapsed_external_ms <= 0 || child.elapsed_external_ms >= 60000
        || !Number.isFinite(child.elapsed_external_ms)
        || !report.cleanup || !Object.values(report.cleanup).every(value => value === true)
        || report.public_upstream_requests !== 0 || report.execution_authority !== false
        || report.full_native_guard_qualified !== false
        || !report.source_before || !equal(report.source_before, report.source_after))
        fail("guard_qualification_invalid");
      if (!report.cohort || !["node", "chrome", "playwright", "macos", "darwin"].every(key => report.cohort[key] === COHORT[key])
        || report.cohort.headless !== (family === "relay")) fail("guard_qualification_cohort_mismatch");
      if (!equal(report.source_before, state.manifest.binding.source_pins))
        fail("guard_qualification_stale_source");
      const capture = family === "controller" && report.program === "output-failure" ? "failure-originals.json" : "capture.json";
      if (witness.capture_sha256 ? witness.capture_sha256 !== row.capture_sha256
        : family !== "relay" || !["deadline", "close-failure", "output-failure", "late-output"].includes(report.diagnostic_cohort))
        fail("guard_capture_witness_missing");
      // Legacy lifecycle witnesses bind report-only. Their actual post-exit
      // capture hash must be supplied explicitly by the reviewed outer index;
      // never derive an expected digest from the file while accepting it.
      const captureBytes = original("run/" + capture, row.capture_sha256, 33554432);
      if (family === "relay") {
        const index = json(captureBytes);
        if (index.schema !== "airlock.local-inspected-originals.v1" || index.inspected_network !== true
          || !Array.isArray(index.cases) || !index.cases.length || index.cases.length > LIMITS.observations
          || !Array.isArray(report.cases) || index.cases.length !== report.cases.length)
          fail("guard_originals_invalid");
        const names = new Set();
        for (const item of index.cases) {
          if (!["h1", "h2"].includes(item.protocol) || typeof item.kind !== "string"
            || !/^[a-z][a-z0-9-]{0,63}$/.test(item.kind)
            || !["case-", "failure-case-"].some(prefix =>
              item.originals_file === prefix + item.protocol + "-" + item.kind + ".json")
            || !digest(item.originals_sha256) || names.has(item.originals_file)
            || report.cases.filter(value => value.protocol === item.protocol && value.kind === item.kind).length !== 1)
            fail("guard_originals_invalid");
          names.add(item.originals_file);
          try { original("run/" + item.originals_file, item.originals_sha256, 33554432); }
          catch { fail("guard_originals_unavailable"); }
        }
      }
      const latePublication = family === "controller" ? report.program === "late-output"
        : report.diagnostic_cohort === "late-output";
      let publicationFailure = null;
      if (latePublication) {
        try {
          if (!digest(row.finalization_failure_sha256)
            || witness.finalization_failure_sha256 !== row.finalization_failure_sha256)
            fail("guard_publication_failure_invalid");
          publicationFailure = json(original("run/failure-finalization.json", row.finalization_failure_sha256));
          const failure = publicationFailure, window = report.window, publication = failure.publication;
          const category = family === "controller" ? "case_window_inactive" : "inspection_output_deadline";
          if (failure.schema !== (family === "controller" ? "airlock.inspected-meta-finalization-failure.v1"
            : "airlock.local-inspected-finalization-failure.v1")
            || failure.failure_category !== category || !equal(failure.errors, [category])
            || failure.producer_exit_code !== 2 || failure.command_exit_observed !== false
            || failure.captured_reference_accepted !== false || failure.capture_sha256 !== row.capture_sha256
            || failure.report_sha256 !== row.report_sha256 || !equal(failure.window, window)
            || !equal(failure.cleanup, { ...report.cleanup, deadline_met: false })
            || report.cleanup.deadline_met !== true || report.producer_exit_code !== 0
            || !equal(report.errors, [])
            || !(family === "controller" ? report.local_controller_qualified : report.local_composition_qualified)
            || !Number.isSafeInteger(window.not_before_ms) || !Number.isSafeInteger(window.expires_at_ms)
            || window.expires_at_ms - window.not_before_ms < 10000
            || window.expires_at_ms - window.not_before_ms > 17000
            || !["resources_closed_at_ms", "capture_written_at_ms", "report_write_started_at_ms", "attempted_at_ms"]
              .every(key => Number.isSafeInteger(publication[key]))
            || publication.resources_closed_at_ms < window.not_before_ms
            || publication.resources_closed_at_ms > publication.capture_written_at_ms
            || publication.capture_written_at_ms > publication.report_write_started_at_ms
            || publication.report_write_started_at_ms >= window.expires_at_ms
            || publication.attempted_at_ms < window.expires_at_ms
            || publication.attempted_at_ms - window.not_before_ms >= LIMITS.duration_ms
            || !Number.isSafeInteger(failure.elapsed_ms) || failure.elapsed_ms <= 0
            || failure.elapsed_ms >= LIMITS.duration_ms || failure.elapsed_ms > child.elapsed_external_ms
            || existsSync(join(root, "run/completion.json")))
            fail("guard_publication_failure_invalid");
        } catch { fail("guard_publication_failure_invalid"); }
      }
      let label, expected;
      if (family === "controller") {
        if (report.native_sdk_executed !== false || report.actual_owner_slots_reserved !== 0) fail("guard_qualification_invalid");
        label = report.program === "normal" && report.errors.includes("case_source_changed")
          ? "source-race" : report.program + "/" + report.protocol;
        expected = ["normal/h1", "normal/h2", "redirect/h2", "finite-window/h2"].includes(label) ? 0 : 2;
        const negative = { "source-race": "case_source_changed", "fetch/h1": "unqualified_route_or_field",
          "unknown-resource/h1": "unqualified_route_or_field", "unknown-surface/h1": "unqualified_request_body",
          "deadline/h1": "local_deadline_control", "close-failure/h1": "local_context_close_failure",
          "output-failure/h1": "capture_output_failed", "late-output/h1": "case_window_inactive" };
        negative["extra-request/h1"] = "additional_pageview";
        if (expected === 0 ? !report.local_controller_qualified
          : label === "reset/h1" ? report.responses_complete !== 0
            : !Object.hasOwn(negative, label) || !(publicationFailure ?? report).errors.includes(negative[label]))
          fail("guard_control_unmatched");
      } else {
        if (report.official_sdk_executed !== false || report.owner_slots_reserved !== 0) fail("guard_qualification_invalid");
        label = report.diagnostic_cohort;
        const fault = ["deadline", "close-failure", "output-failure", "late-output"].includes(label);
        expected = label === "late-output" ? 3 : fault ? 2 : 0;
        if (!fault && !(report.local_count_qualified || report.local_composition_qualified || report.local_declared_profile_qualified))
          fail("guard_control_unmatched");
        if (fault && !publicationFailure && !Object.values(report.lifecycle_controls).some(value => value === true))
          fail("guard_control_unmatched");
      }
      if (seen.has(family + "/" + label) || child.code !== expected) fail("guard_control_unmatched");
      seen.add(family + "/" + label);
    }
  }
  if (!["normal/h1", "normal/h2", "redirect/h2", "finite-window/h2", "extra-request/h1", "source-race", "fetch/h1", "unknown-resource/h1",
    "unknown-surface/h1", "reset/h1", "deadline/h1", "close-failure/h1", "output-failure/h1", "late-output/h1"]
    .every(label => seen.has("controller/" + label))
    || !["physical", "request", "response", "compression", "aggregate", "transport", "declared-meta",
      "deadline", "close-failure", "output-failure", "late-output"].every(label => seen.has("relay/" + label)))
    fail("guard_control_unmatched");
}
/** Read-only SDK-absent witness verification; NOT a review, lease or grant. */
export function inspectSdkAbsentQualification(handle) {
  const state = { snapshots: [], manifest: { binding: { source_pins: inspectedMetaSourcePins() } } };
  verifyQualification(state, handle);
  unchanged(state);
  return Object.freeze({ schema: "airlock.sdk-absent-qualification-inspection.v1",
    sdk_absent_evidence_verified: true, ...CLAIMS });
}
function prepare(options, local) {
  const started = performance.now();
  const input = record(options, ["manifest_path", "manifest_sha256"]);
  const snapshots = [];
  const manifestHandle = { path: input.manifest_path, sha256: input.manifest_sha256 };
  const root = local ? dirname(absolute(input.manifest_path)) : null;
  if (local && !root.startsWith(resolve("rig/out") + "/")) fail("nonlocal_fixture_handle");
  const manifest = json(readHandle(manifestHandle, snapshots, 65536, root));
  if (manifest.case_name !== "meta-stock") fail("unsupported_case");
  record(manifest, ["schema_version", "kind", "case_name", "transport", "binding", "evidence", "output_dir"]);
  if (manifest.schema_version !== 1 || manifest.transport !== "inspected-network"
    || manifest.kind !== (local ? "airlock.inspected-meta-local.v1" : "airlock.inspected-meta-stock.v1"))
    fail("unsupported_case_mode");
  const binding = record(manifest.binding, ["inputs", "authority", "inspection_permission",
    "source_pins", "cohort", "window", "limits", "commands"], ["case_permission", "observation_end_ms"]);
  if (!equal(binding.limits, LIMITS) || !equal(binding.cohort, COHORT)
    || !equal(binding.commands, { init: 1, pageview: 1, consent: "native-default" })) fail("case_envelope_mismatch");
  const window = record(binding.window, ["not_before_ms", "expires_at_ms"]);
  if (![window.not_before_ms, window.expires_at_ms].every(Number.isSafeInteger)
    || window.not_before_ms < 0 || window.expires_at_ms <= window.not_before_ms
    || window.expires_at_ms - window.not_before_ms > LIMITS.duration_ms) fail("invalid_case_window");
  const state = { local, manifest, snapshots, started, lastWall: 0, lastMono: started, attempted: false,
    root, fixtureOriginals: [], fulfilled: new Set(), sources: Object.create(null), blockers: [] };
  check(state);
  if (!equal(binding.source_pins, inspectedMetaSourcePins())) fail("stale_runtime_pins");
  if (!equal(binding.source_pins, LOADED_SOURCE_PINS)) fail("loaded_runtime_source_changed");
  absolute(manifest.output_dir);
  if (local && dirname(manifest.output_dir) !== root) fail("nonlocal_fixture_handle");
  outputAvailable(manifest.output_dir);
  if (!local) {
    for (const name of ["inputs", "authority", "inspection_permission"])
      readHandle(binding[name], snapshots, 65536);
    if (binding.case_permission) readHandle(binding.case_permission, snapshots, 65536);
    if (!binding.case_permission) state.blockers.push("original_authority_location_binding_missing");
    if (!Object.hasOwn(binding, "observation_end_ms")) state.blockers.push("finite_observation_end_missing");
    else if (!Number.isSafeInteger(binding.observation_end_ms)
      || binding.observation_end_ms <= window.not_before_ms
      || binding.observation_end_ms > window.expires_at_ms - 6000) fail("invalid_observation_window");
    readEvidence(state);
    if (state.blockers.length) { unchanged(state); check(state); return preparedPlan(state, false); }
  } else if (Object.hasOwn(binding, "observation_end_ms")) fail("invalid_local_program");
  const authority = json(readHandle(binding.authority, snapshots, 65536, root));
  authorityAt(authority, local);
  state.authority = authority;
  if (!binding.case_permission) fail("original_authority_location_binding_missing");
  validateLocationPermission(state);
  slotAvailable(state);
  const permission = json(readHandle(binding.inspection_permission, snapshots, 65536, root));
  if (!equal(permission.scope, INSPECTION_SCOPE) || permission.schema_version !== 1
    || (local ? permission.kind !== "synthetic_inspection_design" || permission.status !== "local_only"
      : permission.kind !== "owner_conversation_authority"
        || permission.status !== "approved_conditional_reference_design"
        || permission.original_authority_mutated !== false || permission.actual_slots_reserved_or_spent !== 0))
    fail("inspection_permission_missing");
  if (local) record(permission, ["schema_version", "kind", "status", "scope"]);
  else record(permission, ["schema_version", "kind", "status", "recorded_on", "question", "choices",
    "answer", "scope", "remaining_required", "not_granted", "original_authority_mutated", "actual_slots_reserved_or_spent"]);
  const inputs = json(readHandle(binding.inputs, snapshots, 65536, root));
  record(inputs, ["schema_version", "profile", "owned_origin", "document_url", "pixel_id",
    "runtime", "configuration", "source_capture_sha256", "authorization"]);
  let document;
  try { document = new URL(inputs.document_url); } catch { fail("invalid_owned_fixture"); }
  if (inputs.schema_version !== 1 || inputs.profile !== "meta-pageview" || document.origin !== inputs.owned_origin
    || !digest(inputs.source_capture_sha256) || typeof inputs.authorization !== "string"
    || !inputs.authorization.length || inputs.authorization.length > 4096) fail("invalid_owned_fixture");
  const resources = Object.fromEntries(["runtime", "configuration"].map(role =>
    [role, record(inputs[role], ["path", "sha256", "request_url", "response_status"])]));
  const sourceCohort = local ? null : Object.entries(META_REFERENCE_COHORTS).find(([, pins]) =>
    ["runtime", "configuration"].every(role => resources[role].sha256 === pins[role]));
  if (!local && !sourceCohort) fail("unqualified_source_bytes");
  state.referenceSourceCohort = local ? "sdk-absent-fixture" : sourceCohort[0];
  for (const role of ["runtime", "configuration"]) {
    const resource = resources[role];
    if (resource.response_status !== 200) fail("invalid_retained_source");
    const bytes = readHandle({ path: resource.path, sha256: resource.sha256 }, snapshots, LIMITS.response_bytes, root);
    if (local && !bytes.equals(Buffer.from(role === "runtime" ? LOCAL_RUNTIME : LOCAL_CONFIGURATION)))
      fail("unqualified_source_bytes");
    state.sources[role] = Buffer.from(bytes);
  }
  if (local && (inputs.document_url !== "https://owned.example/inspection"
    || inputs.owned_origin !== "https://owned.example" || inputs.pixel_id !== "999999999999999"))
    fail("nonlocal_fixture_input");
  state.inputs = inputs; state.profile = profileOf(inputs, local);
  createNativeStockPolicy(state.profile);
  if (local) readEvidence(state);
  unchanged(state); check(state);
  return preparedPlan(state, true);
}

/**
 * Closed manifest: {schema_version,kind,case_name,transport,binding,evidence,
 * output_dir}. binding contains explicit {path,sha256} handles for inputs,
 * original authority and separate inspection permission. case_permission
 * binds the APPROVED original path/dev/inode/canonical slot and the input/
 * inspection/source/cohort/window digest; it cannot be inferred from the old
 * grant. Native observation_end_ms is explicit, inside the same <=60 s case
 * window with cleanup reserve. Neither field books or renews a window.
 * Evidence handles (or null
 * for missing native proof) are setup/coordination/qualified_source/guard and
 * frame/compliance/craft/architecture/reconciliation. Nothing is discovered in a session.
 * Retained bytes are hashed/copied, NEVER imported/evaluated here. Neither a
 * URL/pin declaration nor this read verifies source authenticity or ownership.
 */
export function prepareInspectedMetaStock(options) { return prepare(options, false); }
export function prepareLocalInspectedMeta(options) { return prepare(options, true); }

export async function runInspectedMetaStock(plan) {
  const state = !isProxy(plan) && plan && plans.get(plan);
  if (!state) fail("invalid_prepared_case");
  if (arguments.length !== 1) fail("invalid_case_input");
  if (state.local) fail("native_pre_admission_blocked");
  unchanged(state); check(state);
  if (!state.nativeReady || state.blockers.length) fail("native_pre_admission_blocked");
  validateNativeAdmission(state);
  return runEngine(state, { protocol: null, program: "native" });
}
function validateNativeAdmission(state) {
  if (state.local || !state.nativeReady || !state.casePermission?.native_execution_permitted
    || state.blockers.length) fail("native_pre_admission_blocked");
  unchanged(state); check(state);
  const locator = state.casePermission.authority_locator, stat = lstatSync(locator.path, { bigint: true });
  if (locator.path !== state.manifest.binding.authority.path
    || locator.dev !== String(stat.dev) || locator.ino !== String(stat.ino))
    fail("original_authority_location_mismatch");
  if (["NODE_TLS_REJECT_UNAUTHORIZED", "NODE_EXTRA_CA_CERTS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "SSLKEYLOGFILE", "NODE_OPTIONS", "NODE_DEBUG"].some(name => Object.hasOwn(process.env, name))
    || process.execArgv.some(arg => /^--(?:tls-|use-.*ca|openssl-)/.test(arg)))
    fail("unsafe_native_tls_environment");
}
function checkReservation(state) {
  if (!state.reserved || !state.reservation || !state.reservation_sha256
    || state.reservation.canonical_record_path !== state.casePermission.canonical_slot_path)
    fail("canonical_reservation_missing");
  try {
    if (hash(readMetaPrivate(state.reservation.canonical_record_path, 65536)) !== state.reservation_sha256)
      fail("canonical_reservation_changed");
  } catch { fail("canonical_reservation_changed"); }
}
// Internal transport hand-off: only runEngine can create this unexported
// WeakMap capability after admission and the ORIGINAL durable reservation.
// The public connector is never selected by a receipt flag or local program.
export function claimNativeMetaTransport(lease) {
  if (!lease || isProxy(lease) || !nativeTransportLeases.has(lease)) fail("invalid_native_transport_lease");
  const value = nativeTransportLeases.get(lease);
  nativeTransportLeases.delete(lease);
  validateNativeAdmission(value.state); checkReservation(value.state);
  if (value.state.phase !== "running") fail("invalid_native_transport_lease");
  return value.config;
}

function validateLocationPermission(state) {
  const binding = state.manifest.binding;
  const permission = json(readHandle(binding.case_permission, state.snapshots, 65536, state.root));
  record(permission, ["schema_version", "kind", "status", "case_name", "transport",
    "native_execution_permitted", "authority_locator", "canonical_slot_path", "permission_source_sha256", "valid_until_ms"]);
  const locator = record(permission.authority_locator, ["path", "sha256", "dev", "ino"]);
  const stat = lstatSync(binding.authority.path, { bigint: true });
  if (locator.path !== binding.authority.path || locator.sha256 !== binding.authority.sha256
    || locator.dev !== String(stat.dev) || locator.ino !== String(stat.ino)
    || permission.canonical_slot_path !== join(dirname(locator.path),
      "native-stock-slots-" + state.authority.authority_id, "meta-stock.reserved"))
    fail("original_authority_location_mismatch");
  if (permission.schema_version !== 1 || permission.kind !== "inspected-meta-case-location"
    || permission.case_name !== "meta-stock" || permission.transport !== "inspected-network"
    || permission.status !== (state.local ? "synthetic_local_binding" : "approved_case_binding")
    || permission.native_execution_permitted !== !state.local
    || permission.permission_source_sha256 !== inspectedMetaCasePermissionDigest(binding)
    || permission.valid_until_ms !== binding.window.expires_at_ms)
    fail("case_permission_binding_invalid");
  state.casePermission = permission;
}
function slotAvailable(state) {
  const folder = join(dirname(state.manifest.binding.authority.path), "native-stock-slots-" + state.authority.authority_id);
  try {
    const stat = lstatSync(folder);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
      || (stat.mode & 0o7777) !== 0o700) fail("unsafe_original_slot");
    try { lstatSync(join(folder, "meta-stock.reserved")); fail("stock_slot_spent"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}
function syncDirectory(path) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
const encodedJs = value => JSON.stringify(value).replaceAll("<", "\\u003c");
function documentFor(state, program, target) {
  const nonce = randomBytes(16).toString("hex"), input = state.inputs;
  const resources = [input.runtime.request_url, input.configuration.request_url];
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; `
    + "require-trusted-types-for 'script'; img-src https://www.facebook.com data:; "
    + "connect-src https://www.facebook.com; worker-src 'none'; frame-src 'none'; "
    + "object-src 'none'; base-uri 'none'; form-action 'none'";
  const native = `
  if(localStorage.length||sessionStorage.length||document.cookie)throw Error("nonempty_native_storage");
  const pinned=${encodedJs(resources)};
const policy=trustedTypes.createPolicy("default",{createScriptURL(value){
 if(!pinned.includes(value))throw new TypeError("unpinned_script_dependency");return value;
}});
window.__airlockNativeCommands={init:0,pageview:0,consent:"native-default"};
!function(f,b,e,v,n,t,s){
 if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
 if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
 t=b.createElement(e);t.async=!0;t.src=policy.createScriptURL(v);
 s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
}(window,document,"script",${encodedJs(input.runtime.request_url)});
fbq("init",${encodedJs(input.pixel_id)});
window.__airlockNativeCommands.init++;
fbq("track","PageView");
window.__airlockNativeCommands.pageview++;
`;
  // This branch contains only the fixed first-party fixture. It is not an fbq
  // substitute, native source proof, a consent override or an identity seed.
  const local = `
const pinned=${encodedJs(resources)};
const policy=trustedTypes.createPolicy("default",{createScriptURL(value){
 if(!pinned.includes(value))throw TypeError("unqualified_fixture_dependency");return value;
}});
window.runLocal=async()=>{
 for(const url of pinned)await new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.onload=resolve;script.onerror=reject;
  script.src=policy.createScriptURL(url);document.head.appendChild(script);
 });
 if(!window.__localConfiguration)throw Error("fixture_configuration_missing");
 window.__localInit();
 ${program === "fetch" ? `await fetch(${encodedJs(target)});`
    : program === "unknown-surface" ? `await fetch(${encodedJs(target)},{method:"POST",body:"denied"});`
      : `await window.__localPageView(${encodedJs(target)});`}
 ${program === "extra-request" ? `await new Promise(resolve=>{
 const image=new Image();image.onload=resolve;image.onerror=resolve;
 image.src=${encodedJs(target?.slice(0, -1) + "1")};});` : ""}
 return window.__localFixture;
};`;
  const script = state.local ? local : native;
  return { bytes: Buffer.from(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">
<title>Isolated reference fixture</title><script nonce="${nonce}">${script}</script>`), script_sha256: hash(script),
    headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" },
      { name: "Content-Security-Policy", value: csp }] };
}
function originalsOf(observer) {
  const original = observer.originals();
  return {
    requests: original.requests,
    responses: original.responses.map(({ decoder: _decoder, ...response }) => ({
      ...response, body: Buffer.concat(response.body, response.decoded_body_bytes).toString("base64"),
    })),
    wire: original.wire.map(row => ({ ...row,
      request: Buffer.concat(row.request).toString("base64"), response: Buffer.concat(row.response).toString("base64") })),
  };
}
const PROGRAMS = ["normal", "redirect", "finite-window", "extra-request", "fetch", "unknown-resource", "unknown-surface", "reset",
  "deadline", "close-failure", "output-failure", "late-output"];

/**
 * SDK-ABSENT orchestration only. The opaque plan must have been prepared by
 * prepareLocalInspectedMeta, entirely inside its canonical rig/out private
 * fixture folder, with exact fixed source bytes and synthetic owner records.
 * No caller can supply a driver, clock, reservation function, URL or arbitrary
 * program. protocol/program select only fixed local diagnostic controls.
 * Synthetic slots use reserveStockSlot's existing canonical namespace and
 * irreversible spend semantics; they can never select the actual authority.
 */
export async function runLocalInspectedMeta(plan, options = {}) {
  const state = !isProxy(plan) && plan && plans.get(plan);
  if (!state || !state.local) fail("invalid_prepared_case");
  const input = record(options, [], ["protocol", "program"]);
  const protocol = Object.hasOwn(input, "protocol") ? input.protocol : "h2";
  const program = Object.hasOwn(input, "program") ? input.program : "normal";
  if (!["h1", "h2"].includes(protocol) || !PROGRAMS.includes(program)) fail("invalid_local_program");
  return runEngine(state, { protocol, program });
}
async function runEngine(state, { protocol, program }) {
  const local = state.local;
  if (!local) validateNativeAdmission(state);
  if (state.attempted) fail("prepared_case_already_attempted");
  unchanged(state); check(state); slotAvailable(state); outputAvailable(state.manifest.output_dir);
  state.attempted = true;
  const require = createRequire(import.meta.url), output = state.manifest.output_dir;
  if (process.version !== COHORT.node || process.platform !== "darwin" || release() !== COHORT.darwin
    || require("playwright/package.json").version !== COHORT.playwright
    || (await execute("/usr/bin/sw_vers", ["-productVersion"], { timeout: 2000 })).stdout.trim() !== COHORT.macos
    || (await execute("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", CHROME_INFO],
      { timeout: 2000 })).stdout.trim() !== COHORT.chrome)
    fail("cohort_mismatch");
  check(state); unchanged(state);
  const errors = [], networkEvents = [], fetchEvents = [], logical = [], logicalAll = [], scriptEvidence = [], receiverRows = [], links = [];
  const sourceExecution = [], sourceDenials = [], scriptTasks = new Set(), executionTasks = new Set();
  const trustedExpressions = new Set(), cdpOriginals = [], nativeInitiators = [];
  const targetEvidence = [];
  const lifecycleEvidence = [];
  // Chrome can pause on a genuinely empty initial script. Exact zero bytes
  // carry no code; this is not an allowance for anonymous/eval dependencies.
  for (const sha256 of driverGuardHashes()) trustedExpressions.add(sha256);
  const browserErrors = [], failures = [];
  const networkWaiters = new Set();
  const sockets = new Set(), sessions = new Set(), tasks = new Set(), servers = new Set(), contexts = new Set();
  const closingServers = new Map(), secrets = [], closingContexts = new Map(), order = [];
  let browserServer, browser, transport, cdp, page, context, reserved = false, localResult = null;
  let timer, fixtureTimer, sourceConsumers = new Set(), logicalAuthority = false, stopping = false, step = "preparing";
  let cleanupMode = false;
  let outputPrepared = false;
  let primaryNetworkId = null, observationCompleted = false;
  const observer = createInspectedHttpWire({ mode: "DECLARED-META-PROFILE", profile: state.profile,
    resolveObservation: actual => {
      if (!local && (state.phase !== "running" || Date.now() >= state.manifest.binding.observation_end_ms))
        fail("observation_window_expired");
      if (!local) { unchanged(state); checkReservation(state); }
      return logical.filter(row => row.url === actual.url && row.method === actual.method)
      .map(({ network_id, fetch_id, url, method, resource_type, redirect_from }) => ({
        network_id, fetch_id, url, method, resource_type,
        ...(redirect_from === undefined ? {} : { redirect_from }),
      }));
    } });
  if (!observer.reserveObservation(state.sources.runtime.length + state.sources.configuration.length))
    fail("controller_retention_limit");
  const own = socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket)); return socket;
  };
  const stop = () => { for (const session of sessions) session.destroy(); for (const socket of sockets) socket.destroy(); };
  const stopCase = reason => {
    stopping = true; errors.push(reason); observer.stop(reason); stop();
  };
  const retain = value => {
    const bytes = Buffer.from(JSON.stringify(value));
    // Denial seals admission, not bounded forensic evidence through close.
    if (observer.snapshot().stopped ? !observer.retain(bytes) : !observer.reserveObservation(bytes.length))
      fail("controller_retention_limit");
    return value;
  };
  const lifecycle = value => {
    try { lifecycleEvidence.push(retain(value)); } catch { stopCase("controller_retention_limit"); }
  };
  const remaining = () => Math.min(LIMITS.duration_ms - (performance.now() - state.started),
    state.manifest.binding.window.expires_at_ms - Date.now());
  const wait = async (promise, maximum = 4000) => {
    // Expiry closes admission, not ownership. Still close owned resources
    // under the SAME monotonic absolute cap, even if the wall window expired.
    const duration = Math.min(maximum, cleanupMode ? LIMITS.duration_ms - (performance.now() - state.started) : remaining());
    if (duration <= 0) fail("case_window_inactive");
    let timeout;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("controller_step_deadline")), duration);
      })]);
    } finally { clearTimeout(timeout); }
  };
  const task = promise => {
    tasks.add(promise);
    promise.catch(error => stopCase(["case_source_changed", "runtime_source_changed", "case_window_inactive",
      "case_clock_invalid", "consumed_fixture_source_mismatch"].includes(error.message)
      ? error.message : "controller_observation_failed")).finally(() => tasks.delete(promise));
  };
  const evaluate = async expression => {
    const source = expression + "\n//# sourceURL=airlock-controller-evidence\n";
    trustedExpressions.add(hash(source));
    const result = await wait(cdp.send("Runtime.evaluate", { expression: source, awaitPromise: true, returnByValue: true }), 6000);
    if (result.exceptionDetails) fail("controller_evaluation_failed");
    return result.result.value;
  };
  const observeUntil = async end => {
    while (!stopping && Date.now() < end) {
      check(state);
      await wait(new Promise(resolve => setTimeout(resolve, Math.min(50, end - Date.now()))));
    }
    if (stopping) fail("observation_stopped");
    observationCompleted = true;
  };
  const nativeInitiator = async network => {
    const ids = new Set(sourceExecution.map(row => row.script_id));
    const observed = [], pending = [network.initiator?.stack], visited = new Set();
    let nodes = 0;
    while (pending.length) {
      const stack = pending.shift();
      if (!stack) continue;
      if (++nodes > 16 || !Array.isArray(stack.callFrames) || stack.callFrames.length > 128)
        fail("native_initiator_unsupported");
      observed.push(retain(stack));
      if (stack.callFrames.some(frame => ids.has(frame.scriptId))) {
        nativeInitiators.push(retain({ network_id: network.network_id, url: network.url,
          evidence: "actual_script_id_and_verified_resumed_source", stacks: observed }));
        return;
      }
      if (stack.parent) pending.push(stack.parent);
      if (stack.parentId) {
        const key = JSON.stringify(stack.parentId);
        if (visited.has(key)) fail("native_initiator_unsupported");
        visited.add(key);
        const result = await wait(cdp.send("Debugger.getStackTrace", { stackTraceId: stack.parentId }));
        pending.push(result.stackTrace);
      }
    }
    fail("native_initiator_missing");
  };
  const listen = async server => {
    servers.add(server);
    await wait(new Promise((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    }));
    return server.address().port;
  };
  const closeServer = async server => {
    if (!closingServers.has(server)) {
      const closing = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      const tracked = closing.catch(error => {
        if (closingServers.get(server) === tracked) closingServers.delete(server);
        throw error;
      });
      closingServers.set(server, tracked);
    }
    await wait(closingServers.get(server), 1500);
    closingServers.delete(server); servers.delete(server);
  };
  const closeContext = async value => {
    if (!closingContexts.has(value)) {
      const tracked = value.close().catch(error => {
        if (closingContexts.get(value) === tracked) closingContexts.delete(value);
        throw error;
      });
      closingContexts.set(value, tracked);
    }
    await wait(closingContexts.get(value), 1500);
    closingContexts.delete(value); contexts.delete(value);
  };
  const certificate = async role => {
    const keyPath = join(output, role + "-key.pem"), certPath = join(output, role + "-certificate.pem");
    secrets.push(keyPath);
    await wait(execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=www.facebook.com",
      "-addext", "subjectAltName=DNS:www.facebook.com"], { timeout: 5000, maxBuffer: 8192 }), 5500);
    chmodSync(keyPath, 0o600); chmodSync(certPath, 0o600);
    return { key: readMetaPrivate(keyPath, 16384), cert: readMetaPrivate(certPath, 16384) };
  };
  try {
    if (remaining() < 10000) fail("insufficient_cleanup_window");
    unchanged(state); check(state); slotAvailable(state);
    if (!local) validateNativeAdmission(state);
    const binding = state.manifest.binding;
    state.reservation = reserveStockSlot({ authority_path: binding.authority.path,
      authority_sha256: binding.authority.sha256, case_name: "meta-stock",
      input_sha256: binding.inputs.sha256, source_sha256: inspectedMetaBindingDigest(binding.source_pins),
      window: binding.window });
    state.reservation_sha256 = hash(readMetaPrivate(state.reservation.canonical_record_path, 65536));
    state.reserved = reserved = true; state.phase = "running"; order.push("durable_reservation");
    checkReservation(state);
    mkdirSync(output, { mode: 0o700 }); syncDirectory(output); syncDirectory(dirname(output));
    outputPrepared = true;
    unchanged(state); check(state);
    timer = setTimeout(() => {
      stopCase("controller_deadline");
      const child = browserServer?.process();
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, remaining() - 5000);
    // OpenSSL may create files before chmod; the private directory and mask
    // keep the ephemeral key private even during its creation.
    const mask = process.umask(0o077);
    let inspector, receiverIdentity;
    try { inspector = await certificate("inspector"); if (local) receiverIdentity = await certificate("receiver"); }
    finally { process.umask(mask); }
    const spki = createHash("sha256").update(new X509Certificate(inspector.cert).publicKey
      .export({ type: "spki", format: "der" })).digest("base64");
    const target = local ? "https://www.facebook.com/tr/?id=999999999999999&ev=PageView&dl="
      + encodeURIComponent(state.inputs.document_url) + "&r=0" : null;
    if (local) {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const application = protocol === "h1" ? httpServer({ maxHeaderSize: 131072 })
      : h2Server({ settings: { maxHeaderListSize: 131072 } });
    application.on("connection", own);
    application.on("session", session => {
      sessions.add(session); session.on("error", () => {});
      session.once("close", () => sessions.delete(session));
    });
    application.on("request", (request, response) => {
      request.on("error", () => {}); response.on("error", () => {}); request.stream?.on("error", () => {});
      try {
        check(state);
        const redirect = program === "redirect" && request.url.endsWith("r=0");
        const body = redirect ? Buffer.from("fixed first-party redirect original") : png;
        const row = retain({ url: request.url, method: request.method, headers: request.rawHeaders,
          status: redirect ? 302 : 200, body_sha256: hash(body), body_bytes: body.length });
        receiverRows.push(row); order.push("receiver");
        request.resume();
        if (program === "deadline") {
          fixtureTimer = setTimeout(() => stopCase("local_deadline_control"), 100);
          return;
        }
        const headers = { "Content-Type": "image/png", "Cache-Control": "no-store",
          "Set-Cookie": ["local_one=one; Secure; SameSite=None; Partitioned; Path=/",
            "local_two=two; Secure; SameSite=None; Partitioned; Path=/"],
          "Content-Length": String(body.length + (program === "reset" ? 1 : 0)) };
        if (redirect) headers.Location = target.slice(0, -1) + "1";
        response.sendDate = false; response.writeHead(row.status, headers);
        if (program === "reset") {
          response.flushHeaders(); response.write(body.subarray(0, 20));
          fixtureTimer = setTimeout(() => request.socket.destroy(), 50);
        } else response.end(body);
      } catch { stopCase("local_receiver_failed"); response.destroy(); }
    });
    const applicationPort = await listen(application);
    const receiver = tlsServer({ ...receiverIdentity, ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] }, secure => {
      own(secure); secure.pause();
      const plain = own(tcpConnect({ host: "127.0.0.1", port: applicationPort }));
      const link = { peer_port: secure.remotePort, request: createHash("sha256"), response: createHash("sha256"),
        request_bytes: 0, response_bytes: 0 };
      links.push(link);
      plain.once("connect", () => { secure.pipe(plain); plain.pipe(secure); secure.resume(); });
      secure.on("data", bytes => { link.request.update(bytes); link.request_bytes += bytes.length; });
      plain.on("data", bytes => { link.response.update(bytes); link.response_bytes += bytes.length; });
      secure.once("close", () => plain.destroy()); plain.once("close", () => secure.destroy());
    });
    receiver.on("connection", own); receiver.on("tlsClientError", () => {});
    const receiverPort = await listen(receiver);
    transport = await startLocalInspectedTransport({ inspector, protocol, observer,
      receiver: { port: receiverPort, certificate: receiverIdentity.cert, logicalAuthority: () => logicalAuthority },
      check: () => check(state), wait });
    } else {
      const lease = Object.freeze({});
      nativeTransportLeases.set(lease, { state, config: { inspector, observer, wait,
        beforeConnect: () => {
          validateNativeAdmission(state); checkReservation(state);
          if (state.phase !== "running" || Date.now() >= state.manifest.binding.observation_end_ms)
            fail("observation_window_expired");
        },
        logicalAuthority: () => logicalAuthority && !stopping && state.phase === "running"
          && Date.now() < state.manifest.binding.observation_end_ms,
        check: () => { check(state); checkReservation(state); if (!["running", "closing"].includes(state.phase)) fail("native_case_stopped"); } } });
      transport = await startNativeInspectedTransport(lease);
    }
    const { chromium } = await import("playwright");
    check(state);
    browserServer = await chromium.launchServer({
      executablePath: fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url)),
      host: "127.0.0.1", headless: false, timeout: Math.max(1, Math.min(10000, remaining() - 6000)),
      proxy: { server: "http://127.0.0.1:" + transport.port },
      args: ["--disable-background-networking", "--dns-prefetch-disable", `--ignore-certificate-errors-spki-list=${spki}`],
    });
    browserServer.process().once("exit", (code, signal) => {
      lifecycle({ resource: "browser_process", event: "exit", code, signal, step, phase: state.phase });
      if (state.phase === "running" && step !== "context_teardown" && !stopping) stopCase("unexpected_browser_exit");
    });
    check(state);
    if (new URL(browserServer.wsEndpoint()).hostname !== "127.0.0.1") fail("invalid_driver_peer");
    browser = await wait(chromium.connect(browserServer.wsEndpoint()));
    browser.once("disconnected", () => {
      lifecycle({ resource: "browser", event: "disconnected", step, phase: state.phase });
      if (state.phase === "running" && step !== "context_teardown" && !stopping) stopCase("unexpected_browser_disconnect");
    });
    if (browser.version() !== COHORT.chrome) fail("cohort_mismatch");
    transport.attachOwnedBrowser(await wait(browser.newBrowserCDPSession()));
    context = await wait(browser.newContext({ serviceWorkers: "block" })); contexts.add(context);
    context.once("close", () => {
      lifecycle({ resource: "context", event: "close", step, phase: state.phase });
      if (state.phase === "running" && step !== "context_teardown" && !stopping) stopCase("unexpected_context_close");
    });
    if ((await wait(context.cookies())).length) fail("nonempty_local_storage");
    page = await wait(context.newPage()); cdp = await wait(context.newCDPSession(page));
    page.once("close", () => {
      lifecycle({ resource: "page", event: "close", step, phase: state.phase });
      if (state.phase === "running" && step !== "context_teardown" && !stopping) stopCase("unexpected_page_close");
    });
    page.once("crash", () => stopCase("unexpected_page_crash"));
    page.on("pageerror", error => {
      try { browserErrors.push(retain({ kind: "page_error", message: error.message })); }
      catch { stopCase("controller_retention_limit"); }
      if (!local) stopCase("native_script_error");
    });
    page.on("console", message => {
      if (!local && message.type() === "warning" && /service worker registration blocked/i.test(message.text())) {
        stopCase("unsupported_service_worker"); return;
      }
      if (message.type() !== "error") return;
      try { browserErrors.push(retain({ kind: "console_error", message: message.text() })); }
      catch { stopCase("controller_retention_limit"); }
      if (!local) stopCase("native_browser_error");
    });
    context.on("page", extra => {
      if (extra !== page) {
        try { targetEvidence.push(retain({ kind: "unexpected_page", url: extra.url(), closed: extra.isClosed() })); } catch {}
        stopCase("unsupported_target");
      }
    });
    context.on("serviceworker", () => stopCase("unsupported_service_worker"));
    page.on("frameattached", () => stopCase("unsupported_frame"));
    page.on("worker", () => stopCase("unsupported_worker"));
    page.on("websocket", () => stopCase("unsupported_websocket"));
    await wait(cdp.send("Network.enable"));
    await wait(cdp.send("Debugger.enable"));
    const document = documentFor(state, program, program === "unknown-resource" ? target + "&unknown=denied" : target);
    if (!observer.reserveObservation(document.bytes.length)) fail("controller_retention_limit");
    cdp.on("Debugger.scriptParsed", event => {
      const role = ["runtime", "configuration"].find(role => state.inputs[role].request_url === event.url);
      if (!role) return;
      const work = (async () => {
        const result = await wait(cdp.send("Debugger.getScriptSource", { scriptId: event.scriptId }));
        check(state);
        const sha256 = hash(Buffer.from(result.scriptSource));
        if (sha256 !== hash(state.sources[role])) fail("consumed_fixture_source_mismatch");
        scriptEvidence.push(retain({ role, sha256, script_id: event.scriptId, evidence: "actual_script_parsed_source" }));
        sourceConsumers.add(role);
      })();
      scriptTasks.add(work); work.finally(() => scriptTasks.delete(work)).catch(() => {});
      task(work);
    });
    cdp.on("Debugger.paused", event => {
      const work = (async () => {
      const scriptId = event.data?.scriptId ?? event.callFrames?.[0]?.location?.scriptId;
      if (event.reason !== "instrumentation" || typeof scriptId !== "string") {
        stopCase("unsupported_debugger_pause"); return;
      }
      const result = await wait(cdp.send("Debugger.getScriptSource", { scriptId }));
      const sha256 = hash(Buffer.from(result.scriptSource));
      const role = ["runtime", "configuration"].find(name => sha256 === hash(state.sources[name]));
      if (!role && sha256 !== document.script_sha256 && !trustedExpressions.has(sha256)) {
        sourceDenials.push(retain({ script_id: scriptId, sha256, source_base64: Buffer.from(result.scriptSource).toString("base64"),
          expected_fixture_sha256: document.script_sha256 }));
        stopCase("unsupported_script_source"); return;
      }
      unchanged(state); check(state); checkReservation(state);
      if (!local && role && Date.now() >= state.manifest.binding.observation_end_ms) {
        stopCase("observation_window_expired"); return;
      }
      await wait(cdp.send("Debugger.resume"));
      if (role) sourceExecution.push(retain({ role, sha256, script_id: scriptId,
        evidence: "validated_before_script_execution_and_resumed" }));
      })();
      executionTasks.add(work); work.finally(() => executionTasks.delete(work)).catch(() => {});
      task(work);
    });
    for (const name of ["Network.requestWillBeSentExtraInfo", "Network.responseReceivedExtraInfo",
      "Network.responseReceived", "Network.loadingFinished", "Network.loadingFailed"]) {
      let count = 0;
      cdp.on(name, event => {
        try {
          if (++count > LIMITS.observations) fail("controller_observation_limit");
          cdpOriginals.push(retain({ event: name, original: event }));
        } catch { stopCase("controller_observation_limit"); }
      });
    }
    cdp.on("Network.requestWillBeSent", event => {
      try {
        check(state);
        if (networkEvents.length >= LIMITS.observations) fail("controller_observation_limit");
        networkEvents.push(retain({ network_id: event.requestId, url: event.request.url,
          method: event.request.method, resource_type: event.type,
          initiator: event.initiator,
          redirect_url: event.redirectResponse?.url ?? null, redirect_status: event.redirectResponse?.status ?? null }));
        for (const notify of networkWaiters) notify();
      } catch (error) {
        stopCase(["controller_observation_limit", "controller_retention_limit", "case_window_inactive",
          "case_clock_invalid"].includes(error.message) ? error.message : "controller_observation_failed");
      }
    });
    const policy = createNativeStockPolicy(state.profile);
    cdp.on("Fetch.requestPaused", event => task((async () => {
      const deny = async reason => {
        stopCase(reason);
        await wait(cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }));
      };
      check(state);
      if (stopping || !reserved) return deny("dispatch_before_reservation");
      if (!local && Date.now() >= state.manifest.binding.observation_end_ms) return deny("observation_window_expired");
      if (fetchEvents.length >= LIMITS.observations) return deny("controller_observation_limit");
      fetchEvents.push(retain({ fetch_id: event.requestId, network_id: event.networkId ?? null,
        resource_type: event.resourceType, request: event.request }));
      if (typeof event.networkId !== "string") return deny("missing_or_ambiguous_network_observation");
      const candidates = () => networkEvents.filter(row => row.network_id === event.networkId
        && row.url === event.request.url && row.method === event.request.method);
      let matches = candidates();
      if (matches.length === 0) {
        // CDP domains can deliver the actual Network event after Fetch pauses.
        // Wait while STILL PAUSED; never invent its type or continue early.
        let notify;
        const observed = new Promise(resolve => { notify = () => { if (candidates().length) resolve(candidates()); }; });
        networkWaiters.add(notify);
        try { matches = await wait(observed, 1000); }
        catch { return deny("missing_or_ambiguous_network_observation"); }
        finally { networkWaiters.delete(notify); }
      }
      if (matches.length !== 1) return deny("missing_or_ambiguous_network_observation");
      const network = matches[0];
      if (event.request.hasPostData || event.request.postDataEntries?.length
        || typeof event.request.postData === "string" && event.request.postData.length)
        return deny("unqualified_request_body");
      const decision = policy.inspect({ url: event.request.url, method: event.request.method,
        resource_type: network.resource_type, headers: event.request.headers, body: Buffer.alloc(0) });
      if (decision.disposition !== "eligible") return deny(decision.reason);
      if (decision.kind === "fixture") {
        if (state.fulfilled.has("document")) return deny("repeated_fixture");
        unchanged(state); checkReservation(state);
        state.fulfilled.add("document"); order.push("fixture_execution");
        await wait(cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
          responseHeaders: document.headers, body: document.bytes.toString("base64") }));
      } else if (decision.kind === "local_source") {
        const role = decision.route;
        if (state.fulfilled.has(role)) return deny("repeated_source_dependency");
        unchanged(state); check(state); state.fulfilled.add(role);
        await wait(cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/javascript; charset=utf-8" }],
          body: state.sources[role].toString("base64") }));
      } else {
        if (!network.redirect_url) {
          if (primaryNetworkId !== null && primaryNetworkId !== event.networkId) return deny("additional_pageview");
          primaryNetworkId = event.networkId;
        }
        await wait(Promise.allSettled([...scriptTasks]));
        await wait(Promise.allSettled([...executionTasks]));
        if (!local && !sourceConsumers.has("runtime")) return deny("runtime_source_consumption_missing");
        const observed = { network_id: event.networkId, fetch_id: event.requestId, url: event.request.url,
          method: event.request.method, resource_type: network.resource_type,
          fetch_resource_type: event.resourceType };
        if (network.redirect_url) {
          const originals = observer.originals();
          const parent = originals.requests.findLast(row => row.logical_network_id === event.networkId
            && row.url === network.redirect_url && originals.responses.some(response =>
              response.ordinal === row.ordinal && response.state === "complete"
              && response.status === network.redirect_status && response.redirect_url === event.request.url));
          if (!parent) return deny("missing_actual_redirect_parent");
          observed.redirect_from = parent.ordinal;
          if (!local) nativeInitiators.push(retain({ network_id: event.networkId, url: event.request.url,
            evidence: "completed_actual_redirect", physical_parent: parent.ordinal }));
        } else if (!local) await nativeInitiator(network);
        const prior = logical.findIndex(row => row.network_id === observed.network_id);
        if (prior >= 0) logical.splice(prior, 1);
        const original = retain(observed); logical.push(original); logicalAll.push(original); logicalAuthority = true;
        unchanged(state); check(state); order.push("logical_dispatch");
        await wait(cdp.send("Fetch.continueRequest", { requestId: event.requestId }));
      }
    })()));
    await wait(cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }));
    await wait(cdp.send("Debugger.setInstrumentationBreakpoint", { instrumentation: "beforeScriptExecution" }));
    unchanged(state); check(state); checkReservation(state);
    step = "fixture_navigation";
    await wait(page.goto(state.inputs.document_url, { waitUntil: "load", timeout: 4000 }));
    step = "fixture_command";
    if (local) {
      localResult = retain(await evaluate("window.runLocal()"));
      if (program === "finite-window") await observeUntil(Date.now() + 100);
    }
    else {
      await observeUntil(state.manifest.binding.observation_end_ms);
      if (observer.originals().requests.some(request => request.response_state === "awaiting"
        || request.response_state === "streaming")) fail("observation_window_incomplete");
      localResult = retain(await evaluate(`(()=>{
 const queue=window.fbq;
 return {commands:window.__airlockNativeCommands??null,
 runtime_active:typeof queue==="function"&&typeof queue.callMethod==="function",
 remaining_queue:Array.isArray(queue?.queue)?queue.queue.length:null};
})()`));
      if (!localResult.runtime_active || localResult.remaining_queue !== 0
        || !equal(localResult.commands, { init: 1, pageview: 1, consent: "native-default" }))
        fail("native_processing_evidence_incomplete");
    }
    step = "settlement";
    await wait(Promise.allSettled([...tasks]));
    check(state); unchanged(state);
    if (sourceConsumers.size !== 2 || new Set(sourceExecution.map(row => row.role)).size !== 2)
      fail("source_consumption_incomplete");
    state.storage = retain(await evaluate(`(async()=>({
 local:{...localStorage},session:{...sessionStorage},
 indexed_db:await indexedDB.databases(),cache_names:await caches.keys(),
 service_workers:(await navigator.serviceWorker.getRegistrations()).map(worker=>({scope:worker.scope}))
}))()`));
    if (state.storage.indexed_db.length || state.storage.cache_names.length || state.storage.service_workers.length)
      fail("unsupported_persistent_storage");
    state.cookies = retain(await wait(context.cookies()));
    step = "context_teardown";
    if (program === "close-failure") {
      closingContexts.set(context, context.close());
      fail("local_context_close_failure");
    }
    await closeContext(context); order.push("context_closed");
  } catch (error) {
    try { failures.push(retain({ step, name: error.name, message: error.message })); } catch {}
    // Do not expose provider selectors, paths, CDP payloads or arbitrary errors.
    errors.push(["case_source_changed", "runtime_source_changed", "case_window_inactive", "source_consumption_incomplete",
      "observation_window_incomplete", "native_observation_stopped", "native_processing_evidence_incomplete",
      "native_initiator_missing", "native_initiator_unsupported", "local_context_close_failure", "insufficient_cleanup_window",
      "cohort_mismatch"].includes(error.message) ? error.message : local ? "local_controller_inconclusive" : "native_stock_inconclusive");
  } finally {
    state.phase = "closing";
    cleanupMode = true;
    clearTimeout(fixtureTimer);
    for (const value of [...contexts]) try { await closeContext(value); } catch { errors.push("context_close_failed"); }
    stop();
    if (transport) try { await transport.close(); } catch { errors.push("transport_close_failed"); }
    await wait(Promise.allSettled([...tasks])).catch(() => errors.push("observer_settlement_failed"));
    if (observer.snapshot().decompressors) observer.stop("controller_cleanup");
    if (browser) try { await wait(browser.close(), 2500); } catch { errors.push("browser_close_failed"); }
    if (browserServer) try { await wait(browserServer.close(), 2500); } catch { errors.push("browser_server_close_failed"); }
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await wait(new Promise(resolve => child.once("exit", resolve)), 1500).catch(() => errors.push("owned_process_close_failed"));
    }
    state.phase = "finished";
    if (!outputPrepared) fail("case_output_unavailable_after_reservation");
    for (const value of [...contexts]) try { await closeContext(value); } catch { errors.push("context_close_retry_failed"); }
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("receiver_close_failed"); }
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("receiver_close_retry_failed"); }
    for (const path of secrets) try { if (existsSync(path)) unlinkSync(path); } catch { errors.push("private_key_cleanup_failed"); }
    clearTimeout(timer);
  }
  const resourcesClosedAt = Date.now();
  try { unchanged(state); check(state); } catch (error) { errors.push(error.message); }
  let sourceAfter = null;
  try { sourceAfter = inspectedMetaSourcePins(); } catch { errors.push("runtime_source_unavailable"); }
  const cleanup = { contexts_closed: contexts.size === 0, sockets_closed: sockets.size === 0,
    sessions_closed: sessions.size === 0, servers_closed: servers.size === 0, observers_settled: tasks.size === 0,
    context_close_observers_settled: closingContexts.size === 0, server_close_observers_settled: closingServers.size === 0,
    script_observers_settled: scriptTasks.size === 0 && executionTasks.size === 0,
    network_waiters_settled: networkWaiters.size === 0, decompressors_closed: observer.snapshot().decompressors === 0,
    private_keys_removed: secrets.every(path => !existsSync(path)),
    browser_process_exited: !browserServer || browserServer.process().exitCode !== null || browserServer.process().signalCode !== null,
    transport_closed: !transport || transport.snapshot().server_closed,
    transport_sockets_closed: !transport || transport.snapshot().sockets_closed,
    transport_tasks_settled: !transport || transport.snapshot().tasks_settled,
    deadline_met: remaining() > 0 };
  const snapshot = observer.snapshot(), originals = originalsOf(observer);
  const receiverWire = links.map(row => ({ peer_port: row.peer_port,
    request_sha256: row.request.digest("hex"), response_sha256: row.response.digest("hex"),
    request_bytes: row.request_bytes, response_bytes: row.response_bytes }));
  const wireEqual = !!transport && transport.snapshot().tunnels.length > 0
    && transport.snapshot().tunnels.every(tunnel => {
      const peer = receiverWire.find(row => row.peer_port === tunnel.upstream_peer_port);
      return peer && peer.request_bytes === tunnel.request_bytes && peer.response_bytes === tunnel.response_bytes
        && peer.request_sha256 === tunnel.request_sha256 && peer.response_sha256 === tunnel.response_sha256;
    });
  const responsesMatch = originals.responses.length === receiverRows.length && originals.responses.every((row, n) =>
    row.state === "complete" && row.status === receiverRows[n].status
    && hash(Buffer.from(row.body, "base64")) === receiverRows[n].body_sha256);
  const localQualified = local && reserved && !errors.length && !snapshot.stopped
    && sourceConsumers.size === 2 && localResult?.init === 1 && localResult?.pageview === 1
    && responsesMatch && wireEqual && snapshot.forwarded > 0 && Object.values(cleanup).every(Boolean);
  const completeNativeChain = originals.requests.length > 0 && originals.requests.every(request => {
    if (request.response_state === "complete") return true;
    if (request.response_state !== "transport-aborted") return false;
    return originals.requests.some(retry => retry.ordinal > request.ordinal && retry.url === request.url
      && retry.logical_network_id === request.logical_network_id && retry.response_state === "complete");
  }) && originals.responses.some(response => response.state === "complete" && response.status >= 200 && response.status < 300);
  const nativeProcessing = !local && localResult?.runtime_active === true && localResult.remaining_queue === 0
    && equal(localResult.commands, { init: 1, pageview: 1, consent: "native-default" });
  const nativeQualified = !local && reserved && !errors.length && !snapshot.stopped
    && sourceConsumers.size === 2 && new Set(sourceExecution.map(row => row.role)).size === 2
    && nativeProcessing && observationCompleted && nativeInitiators.length === logicalAll.length && completeNativeChain
    && transport?.snapshot().tunnels.every(tunnel => tunnel.upstream_validation === "default-ca-and-hostname"
      && tunnel.upstream_authorized) && Object.values(cleanup).every(Boolean);
  const qualified = localQualified || nativeQualified;
  const runtimeObserved = !local && (nativeProcessing || nativeInitiators.some(row =>
    row.evidence === "actual_script_id_and_verified_resumed_source"));
  const nativeFacts = local ? {} : {
    native_sdk_executed: runtimeObserved ? true : sourceExecution.some(row => row.role === "runtime") ? null : false,
    official_source_fulfilled: state.fulfilled.has("runtime"),
    official_source_execution_resumed: sourceExecution.some(row => row.role === "runtime"),
    native_source_consumption_verified: nativeProcessing && sourceConsumers.size === 2
      && new Set(sourceExecution.map(row => row.role)).size === 2,
    retained_source_bytes_verified: true, source_authentication: false, native_processing_observed: nativeProcessing,
    native_reference_complete: nativeQualified, captured_reference_accepted: false,
  };
  const report = { schema: local ? "airlock.sdk-absent-inspected-meta-controller.v1" : "airlock.inspected-meta-stock.v1", ...CLAIMS,
    engine: "shared-inspected-meta",
    binding_sha256: inspectedMetaBindingDigest(state.manifest.binding),
    input_sha256: state.manifest.binding.inputs.sha256,
    authority_sha256: state.manifest.binding.authority.sha256,
    inspection_permission_sha256: state.manifest.binding.inspection_permission.sha256,
    source_before: state.manifest.binding.source_pins, source_after: sourceAfter,
    cohort: COHORT, window: state.manifest.binding.window,
    transport: "inspected-network", protocol: local ? protocol : "negotiated",
    reference_source_cohort: state.referenceSourceCohort,
    negotiated_protocols: [...new Set(transport?.snapshot().tunnels.map(tunnel => tunnel.protocol) ?? [])],
    program, local_controller_qualified: localQualified,
    finite_observation_completed: observationCompleted,
    captured_reference_accepted: false, fixture_sources_consumed: sourceConsumers.size,
    local_slot_reserved: local && reserved, actual_owner_slots_reserved: local ? 0 : Number(reserved),
    public_upstream_requests: local ? 0 : snapshot.forwarded,
    receiver_attempts: local ? receiverRows.length : null, response_originals_match: local ? responsesMatch : null,
    original_wire_bytes_equal: local ? wireEqual : null, wire_originals_retained: originals.wire.length > 0,
    responses_complete: originals.responses.filter(row => row.state === "complete").length,
    callback_outcomes: localResult?.outcomes ?? null, retention: snapshot, cleanup,
    residuals: [local ? "SDK-absent fixture/controller proof only; no official SDK/source, ownership, review or live admission"
      : "single declared Meta stock case only; complete vendor/native-surface qualification is separate",
      "retained provenance, case permission and review records are trusted private evidence, not independent source/owner authentication",
      "complete source-pinned pre-admission code/guard reviews, current setup/coordination, immutable original locator and finite window are required before effects",
      "inspected-network is not ordinary Chrome TLS, vendor product receipt, matching or attribution"],
    errors: [...new Set(errors)], producer_exit_code: qualified ? 0 : 2,
    command_exit_observed: false, elapsed_ms: Math.ceil(performance.now() - state.started), ...nativeFacts };
  const capture = { schema: local ? "airlock.sdk-absent-inspected-meta-originals.v1" : "airlock.inspected-meta-stock-originals.v1",
    transport: "inspected-network", reference_source_cohort: state.referenceSourceCohort,
    ...CLAIMS, ...nativeFacts, originals, network_events: networkEvents, fetch_events: fetchEvents,
    logical_observations: logicalAll, native_initiators: nativeInitiators, script_evidence: scriptEvidence, source_execution: sourceExecution,
    source_denials: sourceDenials,
    cdp_originals: cdpOriginals,
    target_evidence: targetEvidence,
    lifecycle_evidence: lifecycleEvidence,
    browser_errors: browserErrors, failure_details: failures,
    receiver: receiverRows, local_result: localResult, cookies: state.cookies ?? null, storage: state.storage ?? null,
    order, cleanup, local_broker: local ? transport?.snapshot() ?? null : null,
    native_broker: local ? null : transport?.snapshot() ?? null,
    verified_source_originals: Object.fromEntries(["runtime", "configuration"].map(role => [role,
      { sha256: hash(state.sources[role]), bytes_base64: state.sources[role].toString("base64") }])),
    receiver_wire: receiverWire };
  const publication = { resources_closed_at_ms: resourcesClosedAt, capture_written_at_ms: null,
    report_write_started_at_ms: null, attempted_at_ms: null };
  let captureFile = "capture.json", reportFile = "report.json";
  if (program === "output-failure") writeMetaPrivate(join(output, captureFile), { synthetic_collision_not_originals: true });
  try { writeMetaPrivate(join(output, captureFile), capture); }
  catch {
    report.errors.push("capture_output_failed"); report.local_controller_qualified = false; report.producer_exit_code = 2;
    if (!local) report.native_reference_complete = false;
    captureFile = "failure-originals.json"; writeMetaPrivate(join(output, captureFile), capture);
  }
  publication.capture_written_at_ms = Date.now();
  report.elapsed_ms = Math.ceil(performance.now() - state.started);
  if (remaining() <= 0) {
    report.errors.push("case_window_inactive"); report.local_controller_qualified = false; report.producer_exit_code = 2;
    if (!local) report.native_reference_complete = false;
  }
  publication.report_write_started_at_ms = Date.now();
  try { writeMetaPrivate(join(output, reportFile), report); }
  catch { reportFile = "failure-report.json"; report.local_controller_qualified = false; report.producer_exit_code = 2;
    if (!local) report.native_reference_complete = false;
    report.errors.push("report_output_failed"); writeMetaPrivate(join(output, reportFile), report); }
  // Fixed SDK-absent fault: close everything and retain early originals while
  // active, then cross the manifest deadline before the ordinary publication
  // guard. No named-program error or completion suppression supplies the result.
  if (local && program === "late-output")
    await new Promise(resolve => setTimeout(resolve, Math.max(1, remaining() + 25)));
  const finalization = () => {
    publication.attempted_at_ms = Date.now();
    unchanged(state); check(state); checkReservation(state);
  };
  try { finalization(); }
  catch (error) {
    const category = ["case_source_changed", "runtime_source_changed", "case_window_inactive",
      "canonical_reservation_changed"].includes(error.message) ? error.message : "case_finalization_failed";
    report.errors.push(category);
    report.local_controller_qualified = false; report.producer_exit_code = 2;
    if (!local) report.native_reference_complete = false;
    writeMetaPrivate(join(output, "failure-finalization.json"), {
      schema: "airlock.inspected-meta-finalization-failure.v1", captured_reference_accepted: false,
      producer_exit_code: 2, command_exit_observed: false, failure_category: category,
      errors: [...new Set(report.errors)], transport: "inspected-network",
      window: state.manifest.binding.window, publication, elapsed_ms: Math.ceil(performance.now() - state.started),
      cleanup: { ...cleanup, deadline_met: remaining() > 0 },
      capture_sha256: hash(readMetaPrivate(join(output, captureFile))),
      report_sha256: hash(readMetaPrivate(join(output, reportFile))),
    });
    return report;
  }

  if (!report.errors.some(error => ["capture_output_failed", "report_output_failed"].includes(error)))
    writeMetaPrivate(join(output, "completion.json"), {
      schema: local ? "airlock.sdk-absent-inspected-meta-completion.v1" : "airlock.inspected-meta-stock-completion.v1",
      transport: "inspected-network", ...CLAIMS, ...nativeFacts,
      ...(!local ? { native_reference_complete: report.native_reference_complete } : {}),
      binding_sha256: report.binding_sha256, cohort: COHORT,
      window: state.manifest.binding.window, publication,
      producer_exit_code: report.producer_exit_code, command_exit_observed: false,
      capture_sha256: hash(readMetaPrivate(join(output, captureFile))),
      report_sha256: hash(readMetaPrivate(join(output, reportFile))),
    });
  try { finalization(); }
  catch (error) {
    writeMetaPrivate(join(output, "completion-invalidated.json"), {
      schema: "airlock.inspected-meta-completion-invalidated.v1", captured_reference_accepted: false,
      producer_exit_code: 2, command_exit_observed: false, transport: "inspected-network",
      failure_category: error.message, window: state.manifest.binding.window, publication,
      elapsed_ms: Math.ceil(performance.now() - state.started), cleanup: { ...cleanup, deadline_met: remaining() > 0 },
      capture_sha256: hash(readMetaPrivate(join(output, captureFile))),
      report_sha256: hash(readMetaPrivate(join(output, reportFile))),
    });
    fail("controller_output_finalization_failed");
  }
  return report;
}

// A long-lived caller cannot re-pin changed on-disk code/dependencies while
// continuing to execute an older already-imported controller/decoder.
const LOADED_SOURCE_PINS = inspectedMetaSourcePins();
