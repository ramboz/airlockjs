import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync,
  readFileSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createServer as httpServer } from "node:http";
import { createServer as h2Server } from "node:http2";
import { connect as tcpConnect } from "node:net";
import { createServer as tlsServer } from "node:tls";
import { release, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isProxy } from "node:util/types";
import { record, data, equal, json } from "./inspected-meta-record.mjs";
import { additionalAuthority, validateAdditionalAuthority, validateAdditionalInspection,
  validateAdditionalLocation } from "./meta-additional-authority.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { reserveStockSlot } from "./native-stock-capture.mjs";
import { LIMITS, META_REFERENCE_COHORTS, createNativeStockPolicy } from "./native-stock-policy.mjs";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { createInspectedHeaderBlockDecoder } from "./inspected-header-block.mjs";
import { registerAdditionalPorts, registerAdditionalPending, registerAdditionalBrowser,
  holdAdditionalShutdown } from "./meta-additional-supervision.mjs";
import { inspectedDecoderDependencyPins, startLocalInspectedTransport, startNativeInspectedTransport } from "./inspected-transport.mjs";
import { createMetaAttendedControl, inspectMetaAttendedQualification } from "./meta-attended-control.mjs";
import { beginLocalGuardRegistration, localGuardSourceDigest } from "./local-guard-observation.mjs";

const fail = category => { throw new Error(category); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const execute = promisify(execFile);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const plans = new WeakMap();
const PINS = META_REFERENCE_COHORTS["retained-2026-10-15"];
const COHORT = Object.freeze({ node: "v24.10.0", chrome: "156.0.8078.49", playwright: "1.62.1",
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
const LOCAL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
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
/** Internal CDP admission seam shared by the four effectful continuation kinds. */
export function createInspectedMetaContinuation(options) {
  const input = record(options, ["cdp", "check", "phase", "stopping"]);
  if (!input.cdp || typeof input.cdp.send !== "function" ||
    !["check", "phase", "stopping"].every(key => typeof input[key] === "function")) fail("invalid_case_input");
  const admit = () => {
    input.check();
    if (input.phase() !== "running" || input.stopping()) fail("case_admission_closed");
  };
  const send = (method, parameters) => {
    if (!["Debugger.resume", "Fetch.fulfillRequest", "Fetch.continueRequest", "Runtime.evaluate"].includes(method))
      fail("unsupported_meta_continuation");
    admit();
    return input.cdp.send(method, parameters);
  };
  send.assertAdmission = admit;
  return send;
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
  state.attendedControl?.check(["closing", "finished"].includes(state.phase));
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
    "inspected-meta-record.mjs", "inspected-meta-record.test.mjs",
    "meta-additional-authority.mjs", "meta-additional-authority.test.mjs",
    "meta-additional-qualification.mjs", "meta-additional-qualification.test.mjs",
    "meta-additional-supervision.mjs", "meta-additional-supervision.test.mjs",
    "meta-attended-control.mjs", "meta-attended-control.test.mjs",
    "meta-attended-reference.mjs", "meta-attended-reference.test.mjs",
    "meta-attended-stop.mjs", "meta-attended-stop.test.mjs",
    "local-guard-observation.mjs", "local-guard-observation.test.mjs",
    "meta-rendezvous-peer.mjs", "meta-rendezvous-peer.test.mjs",
    "meta-preexec-bootstrap.mjs", "meta-preexec-bootstrap.test.mjs", "meta-preexec-bootstrap-launcher",
    "meta-owned-socket-observer.c", "meta-owned-socket-observer.cohort.json",
    "sdk-absent-chrome-preexec.mjs", "sdk-absent-chrome-preexec.test.mjs", "sdk-absent-chrome-io.mjs",
    "sdk-absent-chrome-runtime.mjs", "sdk-absent-chrome-runtime.boundary.test.mjs",
    "sdk-absent-chrome-actors.mjs", "sdk-absent-chrome-actors.boundary.test.mjs", "sdk-absent-chrome-launcher",
    "sdk-absent-chrome.browser.test.mjs", "sdk-absent-chrome.browser.config.mjs",
    "sdk-absent-chrome-io.test.mjs", "sdk-absent-chrome-completion.mjs", "sdk-absent-chrome-completion.test.mjs",
    "sdk-absent-chrome-admission.test.mjs",
    "private-original-file.mjs", "private-original-file.test.mjs",
    "sdk-absent-owned-namespace.mjs", "sdk-absent-owned-namespace-io.mjs", "sdk-absent-owned-namespace-time.mjs",
    "sdk-absent-owned-namespace-cohort.json", "sdk-absent-owned-namespace-clock.json", "sdk-absent-owned-namespace.Dockerfile",
    "sdk-absent-owned-namespace-init.mjs", "sdk-absent-owned-namespace-payload.mjs", "sdk-absent-owned-namespace-consumer.mjs",
    "sdk-absent-owned-namespace-admission.mjs", "sdk-absent-owned-namespace-image-admission.mjs",
    "sdk-absent-owned-namespace-actors.mjs", "sdk-absent-owned-namespace-worker.mjs",
    "sdk-absent-owned-namespace-entry.mjs", "sdk-absent-owned-namespace-wire.mjs",
    "sdk-absent-owned-namespace.test.mjs", "sdk-absent-owned-namespace-actors.test.mjs",
    "sdk-absent-owned-namespace-actors.fixture.mjs", "sdk-absent-owned-namespace-admission.test.mjs",
    "sdk-absent-owned-namespace-closures.config.mjs", "sdk-absent-owned-namespace-closures.setup.mjs",
    "sdk-absent-owned-namespace-pipeline.test.mjs",
    "sdk-absent-clock-observation-admission.mjs", "sdk-absent-clock-observation-admission.test.mjs",
    "sdk-absent-clock-observation-cohort.json", "sdk-absent-clock-observation-entry.mjs",
    "sdk-absent-clock-observation-init.mjs", "sdk-absent-clock-observation-integration.config.mjs",
    "sdk-absent-clock-observation-program.mjs", "sdk-absent-clock-observation-program.test.mjs",
    "sdk-absent-clock-observation-integration.setup.mjs", "sdk-absent-clock-observation-io.mjs",
    "sdk-absent-clock-observation-observer.mjs", "sdk-absent-clock-observation-outer.mjs",
    "sdk-absent-clock-observation-pipeline.test.mjs", "sdk-absent-clock-observation-plan.mjs",
    "sdk-absent-clock-observation-producer.mjs", "sdk-absent-clock-observation-protocol.mjs",
    "sdk-absent-clock-observation-reader.mjs", "sdk-absent-clock-observation-streams.mjs",
    "sdk-absent-clock-observation-supervisor.mjs", "sdk-absent-clock-observation-wire.mjs",
    "sdk-absent-clock-observation.Dockerfile",
    "sdk-absent-clock-host-plan.mjs", "sdk-absent-clock-host-protocol.mjs", "sdk-absent-clock-host-io.mjs",
    "sdk-absent-clock-host-observer.mjs", "sdk-absent-clock-host-fixture.mjs", "sdk-absent-clock-host-reader.mjs",
    "sdk-absent-clock-host-source.test.mjs", "sdk-absent-clock-host-actual.mjs",
    "sdk-absent-clock-host-actual.config.mjs", "sdk-absent-clock-host-source.config.mjs",
    "sdk-absent-clock-host-source.setup.mjs",
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
      local ? [] : ["issued_at_ms", "qualification", "additional_qualification", "attended_qualification", "review_artifact"]);
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
    if (name !== "guard" && Object.hasOwn(receipt, "additional_qualification")) fail("invalid_native_evidence");
    if (name !== "guard" && Object.hasOwn(receipt, "attended_qualification")) fail("invalid_native_evidence");
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
        if (binding.additional) {
          if (!receipt.additional_qualification) state.blockers.push("additional_path_qualification_missing");
          else verifyAdditionalQualification(state, receipt.additional_qualification);
          if (!receipt.attended_qualification) state.blockers.push("attended_owner_qualification_missing");
          else inspectMetaAttendedQualification({
            qualification: receipt.attended_qualification, source_pins: binding.source_pins,
          }, handle => json(readHandle(handle, snapshots, 65536)));
        } else if (Object.hasOwn(receipt, "additional_qualification") ||
          Object.hasOwn(receipt, "attended_qualification")) fail("invalid_native_evidence");
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
function originalBytes(value, maximum) {
  if (typeof value !== "string" || !value.length || value.length > Math.ceil(maximum / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    fail("additional_original_bytes_invalid");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > maximum || bytes.toString("base64") !== value) fail("additional_original_bytes_invalid");
  return bytes;
}
// ONLY the two fixed uncompressed, nonredirecting additional-path positives.
// This does not broaden the physical parser or qualify arbitrary responses.
function positiveFrames(bytes) {
  const frames = [];
  for (let at = 0; at < bytes.length;) {
    if (frames.length >= 64 || bytes.length - at < 9) fail("additional_original_protocol_invalid");
    const size = bytes.readUIntBE(at, 3), stream = bytes.readUInt32BE(at + 5);
    if (size > 16384 || at + 9 + size > bytes.length || stream > 0x7fffffff)
      fail("additional_original_protocol_invalid");
    frames.push({ type: bytes[at + 3], flags: bytes[at + 4], stream,
      raw: bytes.subarray(at, at + 9 + size), body: bytes.subarray(at + 9, at + 9 + size) });
    at += size + 9;
  }
  return frames;
}
function verifyAdditionalOriginals(capture, report, inputs, protocol) {
  const bad = () => fail("additional_original_relationship_invalid");
  record(capture.originals, ["requests", "responses", "wire"]);
  if (![capture.originals.requests, capture.originals.responses, capture.originals.wire, capture.receiver,
    capture.receiver_wire, capture.logical_observations, capture.network_events, capture.fetch_events].every(Array.isArray)
    || capture.originals.requests.length !== 1 || capture.originals.responses.length !== 1
    || capture.originals.wire.length !== 1 || capture.receiver.length !== 1
    || capture.receiver_wire.length !== 1 || capture.logical_observations.length !== 1) bad();
  if (inputs.pixel_id !== "999999999999999" || inputs.document_url !== "https://owned.example/inspection"
    || inputs.owned_origin !== "https://owned.example") bad();
  const target = "/tr/?id=" + inputs.pixel_id + "&ev=PageView&dl=" + encodeURIComponent(inputs.document_url) + "&r=0";
  const url = "https://www.facebook.com" + target, logical = capture.logical_observations[0];
  record(logical, ["network_id", "fetch_id", "url", "method", "resource_type", "fetch_resource_type"]);
  if (logical.url !== url || logical.method !== "GET" || logical.resource_type !== "Image"
    || logical.fetch_resource_type !== "Image") bad();
  const original = capture.originals.wire[0];
  record(original, ["connection", "protocol", "request", "response"]);
  if (original.connection !== 1 || original.protocol !== protocol || !equal(report.negotiated_protocols, [protocol])) bad();
  const requestBytes = originalBytes(original.request, LIMITS.request_bytes + LIMITS.url_bytes + 1024);
  const responseBytes = originalBytes(original.response, LIMITS.response_bytes);
  const requestReplay = createInspectedHttpWire({ mode: "DECLARED-META-PROFILE", profile: profileOf(inputs, true),
    resolveObservation: () => [{ network_id: logical.network_id, fetch_id: logical.fetch_id,
      url: logical.url, method: logical.method, resource_type: logical.resource_type }] });
  const connection = requestReplay.connection(protocol);
  let replayBytes = requestBytes, responseHeaders, body;
  if (protocol === "h1") {
    const end = responseBytes.indexOf("\r\n\r\n");
    if (end < 0 || end > LIMITS.request_bytes) bad();
    const lines = responseBytes.subarray(0, end).toString("latin1").split("\r\n");
    if (lines.shift() !== "HTTP/1.1 200 OK") bad();
    responseHeaders = lines.map(line => {
      const at = line.indexOf(": ");
      if (at < 1 || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(line.slice(0, at))) bad();
      return [line.slice(0, at), line.slice(at + 2)];
    });
    body = responseBytes.subarray(end + 4);
  } else {
    const preface = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
    if (!requestBytes.subarray(0, preface.length).equals(preface)) bad();
    const requests = positiveFrames(requestBytes.subarray(preface.length)), responses = positiveFrames(responseBytes);
    // The pinned Chrome and first-party receiver's actual SETTINGS/ACK pairs.
    // ACKs are checked against BOTH directions here. The synchronous request
    // replay omits only its ACK (the live parser handles it after response
    // SETTINGS); full untouched wire is compared with BOTH endpoints below.
    const settings = (frame, flags, hex) => frame?.type === 4 && frame.flags === flags
      && frame.stream === 0 && frame.body.toString("hex") === hex;
    if (![3, 4].includes(requests.length)
      || !settings(requests[0], 0, "000100010000000200000000000400600000000600040000")
      || !settings(requests.at(-1), 1, "")
      || requests.at(-2).type !== 1 || ![5, 37].includes(requests.at(-2).flags)
      || requests.at(-2).stream !== 1
      || requests.length === 4 && (requests[1].type !== 8 || requests[1].flags !== 0
        || requests[1].stream !== 0 || requests[1].body.length !== 4
        || requests[1].body.readUInt32BE(0) < 1 || requests[1].body.readUInt32BE(0) > 0x7fffffff)
      || responses.length < 4 || !settings(responses[0], 0, "000600020000") || !settings(responses[1], 1, "")
      || responses[2].type !== 1 || responses[2].flags !== 4 || responses[2].stream !== 1) bad();
    replayBytes = Buffer.concat([preface, ...requests.slice(0, -1).map(frame => frame.raw)]);
    responseHeaders = createInspectedHeaderBlockDecoder({ maxTableSize: 65536 }).decode(responses[2].body).pairs;
    const data = responses.slice(3);
    if (data.some((frame, n) => frame.type !== 0 || frame.stream !== 1
      || frame.flags !== (n === data.length - 1 ? 1 : 0))) bad();
    body = Buffer.concat(data.map(frame => frame.body));
  }
  const accepted = connection.request(replayBytes);
  connection.endRequest();
  if (!accepted.equals(replayBytes) || requestReplay.snapshot().stopped || requestReplay.snapshot().forwarded !== 1) bad();
  const request = { ...requestReplay.originals().requests[0], response_state: "complete" };
  // Complete original fields, policy disposition, ownership, counts, stream,
  // physical bytes and logical IDs must be DERIVED from retained request bytes.
  if (request.url !== url || !equal(request, capture.originals.requests[0])) bad();
  const common = [["content-type", "image/png"], ["cache-control", "no-store"],
    ["set-cookie", "local_one=one; Secure; SameSite=None; Partitioned; Path=/"],
    ["set-cookie", "local_two=two; Secure; SameSite=None; Partitioned; Path=/"], ["content-length", String(LOCAL_PNG.length)]];
  const lower = responseHeaders.map(([key, value]) => [key.toLowerCase(), value]);
  if (!body.equals(LOCAL_PNG) || (protocol === "h2" ? !equal(lower, [[":status", "200"], ...common])
    : !equal(lower, common) && !equal(lower, [...common, ["connection", "keep-alive"], ["keep-alive", "timeout=5"]]))) bad();
  const policy = createNativeStockPolicy(profileOf(inputs, true));
  const headers = Object.fromEntries(request.headers.filter(([key]) => !key.startsWith(":"))
    .map(([key, value]) => [key.toLowerCase(), value]));
  const decision = policy.inspect({ url: request.url, method: request.method,
    resource_type: request.resource_type, headers, body: Buffer.alloc(0) });
  if (!equal(decision, request.policy_decision)) bad();
  policy.registerAdmission(decision, 0);
  const policyResponse = policy.recordResponse({ ordinal: 0, status: 200, headers: responseHeaders, body, complete: true });
  const response = { ordinal: 1, connection: 1, stream: request.stream, status: 200, headers: responseHeaders,
    body: body.toString("base64"), header_bytes: Buffer.byteLength(JSON.stringify(responseHeaders)),
    decoded_body_bytes: body.length, encoded_body_bytes: body.length, state: "complete", redirect_url: null,
    expected_length: body.length, coding: "identity", policy_ordinal: 0, logical_network_id: logical.network_id,
    framing: protocol === "h1" ? "length" : "h2", policy_response: policyResponse };
  if (!equal(response, capture.originals.responses[0])) bad();
  const receiver = capture.receiver[0];
  if (!equal(receiver, { url: target, method: "GET", headers: request.headers.flat(), status: response.status,
    body_sha256: hash(body), body_bytes: body.length })) bad();
  const expected = [[inputs.document_url, "Document"], [inputs.runtime.request_url, "Script"],
    [inputs.configuration.request_url, "Script"], [url, "Image"]];
  if (capture.network_events.length !== 4 || capture.fetch_events.length !== 4) bad();
  if (capture.network_events.some(row => !row || typeof row.url !== "string")
    || capture.fetch_events.some(row => !row || !row.request || typeof row.request.url !== "string")) bad();
  for (const [expectedUrl, type] of expected) {
    const network = capture.network_events.filter(row => row.url === expectedUrl);
    const fetch = capture.fetch_events.filter(row => row.request.url === expectedUrl);
    if (network.length !== 1 || fetch.length !== 1 || network[0].method !== "GET"
      || network[0].resource_type !== type || fetch[0].resource_type !== type || fetch[0].request.method !== "GET"
      || fetch[0].network_id !== network[0].network_id) bad();
    if (type !== "Image") continue;
    if (network[0].network_id !== logical.network_id || fetch[0].fetch_id !== logical.fetch_id
      || network[0].redirect_url !== null || network[0].redirect_status !== null
      || Object.hasOwn(fetch[0].request, "hasPostData") && fetch[0].request.hasPostData !== false
      || fetch[0].request.postDataEntries?.length || fetch[0].request.postData) bad();
    const staged = fetch[0].request.headers;
    if (!staged || typeof staged !== "object" || Array.isArray(staged)) bad();
    for (const [key, value] of Object.entries(staged)) {
      const actual = request.headers.filter(([name]) => name.toLowerCase() === key.toLowerCase());
      if (actual.length !== 1 || typeof value !== "string" || value !== actual[0][1]) bad();
    }
  }
  const broker = capture.local_broker, peer = capture.receiver_wire[0];
  if (!broker || !peer || broker.mode !== "sdk-absent" || broker.authenticated_peers !== 1 || broker.public_upstream_requests !== 0
    || !equal(broker.errors, []) || broker.sockets_closed !== true || broker.tasks_settled !== true
    || broker.server_closed !== true || !Array.isArray(broker.tunnels) || broker.tunnels.length !== 1
    || !Number.isInteger(peer.peer_port) || peer.peer_port < 1 || peer.peer_port > 65535) bad();
  const tunnel = broker.tunnels[0];
  if (!tunnel || tunnel.protocol !== protocol || tunnel.upstream_peer_port !== peer.peer_port || tunnel.upstream_authorized !== true
    || tunnel.upstream_validation !== "generated-local-ca-and-hostname") bad();
  for (const [direction, bytes] of [["request", requestBytes], ["response", responseBytes]]) {
    if (peer[direction + "_bytes"] !== bytes.length || tunnel[direction + "_bytes"] !== bytes.length
      || peer[direction + "_sha256"] !== hash(bytes) || tunnel[direction + "_sha256"] !== hash(bytes)) bad();
  }
}
function verifyAdditionalLifecycle(supervision, exit, completion, read) {
  const bad = () => fail("additional_supervision_relationship_invalid");
  const fields = ["pid", "ppid", "pgid", "uid", "started", "state", "command_sha256"];
  const sameBirth = (a, b) => ["pid", "ppid", "pgid", "uid", "started"].every(key => a[key] === b[key]);
  const process = (value, at, final = false) => {
    record(value, final ? [...fields, "final"] : fields);
    if (!["pid", "ppid", "pgid"].every(key => Number.isSafeInteger(value[key]) && value[key] > 0)
      || value.uid !== supervision.node.uid || !digest(value.command_sha256)
      || typeof value.started !== "string"
      || !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2} \d\d:\d\d:\d\d \d{4}$/.test(value.started)
      || !Number.isFinite(Date.parse(value.started)) || Date.parse(value.started) < supervision.started_ms - 1000
      || Date.parse(value.started) > at || typeof value.state !== "string"
      || !/^[DIRSTUVWXZ?][<>+ELNslWX]*$/.test(value.state)) bad();
  };
  const end = supervision.started_ms + supervision.elapsed_ms;
  process(supervision.node, end);
  if (!Array.isArray(supervision.node_processes) || supervision.node_processes.length > 1) bad();
  for (const member of supervision.node_processes) {
    process(member, end, true);
    // Producer's closed predicate admits only this exact, terminated Node
    // lifetime. Empty means absent; a listed "absent"/live/unknown row is not
    // an observation of the kernel's zombie state.
    if (!sameBirth(member, supervision.node) || !member.state.startsWith("Z") || member.final !== "zombie") bad();
  }
  if (!Number.isSafeInteger(exit.exited_at_ms) || exit.exited_at_ms < completion.publication.attempted_at_ms
    || exit.exited_at_ms < supervision.started_ms || exit.exited_at_ms > end + 1
    || !Number.isSafeInteger(exit.elapsed_ms) || exit.elapsed_ms <= 0 || exit.elapsed_ms > supervision.elapsed_ms + 1) bad();
  const browser = supervision.browsers[0], finalPorts = supervision.ports.map(item => item.port);
  const keyFields = ["path", "dev", "ino", "birthtime_ms", "uid", "size"];
  const keyIdentity = key => Object.fromEntries(keyFields.map(name => [name, key[name]]));
  const finalKeys = supervision.private_keys.map(key => {
    record(key, [...keyFields, "removed"]);
    if (!Number.isSafeInteger(key.dev) || key.dev < 0 || !Number.isSafeInteger(key.ino) || key.ino < 1
      || !Number.isFinite(key.birthtime_ms) || key.birthtime_ms < supervision.started_ms
      || key.birthtime_ms > end || key.uid !== supervision.node.uid
      || !Number.isSafeInteger(key.size) || key.size < 1 || key.size > 16384) bad();
    return keyIdentity(key);
  });
  const image = (value, profile) => {
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (typeof value !== "string" || /[\0\r\n]/.test(value)) bad();
    const dir = [...value.matchAll(/(?:^| )--user-data-dir=(\S+)/g)];
    if (dir.length !== 1 || dir[0][1] !== profile.argument_path) bad();
    if (value.startsWith(chrome + " ")) return "chrome";
    bad();
  };
  const profile = browser.profile;
  record(profile, ["path", "argument_path", "dev", "ino", "birthtime_ms", "uid"]);
  if (profile.birthtime_ms < supervision.started_ms || profile.birthtime_ms > end) bad();
  process(browser.root, end);
  if (typeof browser.root_command !== "string" || hash(browser.root_command) !== browser.root.command_sha256
    || image(browser.root_command, profile) !== "chrome") bad();
  const members = new Map();
  for (const member of browser.processes) {
    process(member, end, true);
    if (members.has(member.pid) || member.pgid !== browser.root.pgid
      || !["absent", "zombie"].includes(member.final)) bad();
    members.set(member.pid, member);
  }
  if (!members.has(browser.root.pid) || !fields.every(key => members.get(browser.root.pid)[key] === browser.root[key])) bad();
  for (const member of members.values()) {
    let current = member;
    const visited = new Set();
    while (current.pid !== browser.root.pid) {
      if (visited.has(current.pid) || !members.has(current.ppid)) bad();
      visited.add(current.pid); current = members.get(current.ppid);
    }
  }
  const expected = ["node", "ports", "browser-pending", "browser-discovered", "browser-ready", "resources-final"];
  if (supervision.registrations.length !== expected.length) bad();
  let previous = supervision.started_ms;
  let firstPorts;
  for (const [n, handle] of supervision.registrations.entries()) {
    const registration = json(read(handle));
    record(registration, ["phase", "at_ms", "node", "ports", "private_keys", "browsers"]);
    if (registration.phase !== expected[n] || !Number.isSafeInteger(registration.at_ms)
      || registration.at_ms < previous || registration.at_ms > end + 1
      || !equal(registration.node, supervision.node)) bad();
    previous = registration.at_ms;
    if (n < expected.length - 1 ? registration.at_ms > completion.publication.resources_closed_at_ms
      : registration.at_ms < exit.exited_at_ms) bad();
    if (!Array.isArray(registration.ports) || !Array.isArray(registration.private_keys)
      || !Array.isArray(registration.browsers)) bad();
    if (n === 0) {
      if (registration.ports.length || registration.private_keys.length || registration.browsers.length) bad();
      continue;
    }
    if (n === 1) firstPorts = registration.ports;
    if (n < 4 ? !registration.ports.length || registration.ports.length >= finalPorts.length
      || !equal(registration.ports, firstPorts)
      || registration.ports.some((port, at) => port !== finalPorts[at]) : !equal(registration.ports, finalPorts)) bad();
    if (registration.private_keys.length !== finalKeys.length) bad();
    for (const [at, key] of registration.private_keys.entries()) {
      record(key, keyFields);
      if (!equal(key, finalKeys[at]) || key.birthtime_ms > registration.at_ms) bad();
    }
    if (n < 3) { if (registration.browsers.length) bad(); continue; }
    if (registration.browsers.length !== 1) bad();
    const snapshot = registration.browsers[0];
    record(snapshot, ["root", "root_command", "profile", "members"]);
    process(snapshot.root, registration.at_ms);
    if (!sameBirth(snapshot.root, browser.root) || !equal(snapshot.profile, profile)
      || profile.birthtime_ms > registration.at_ms || typeof snapshot.root_command !== "string"
      || hash(snapshot.root_command) !== snapshot.root.command_sha256
      || !Array.isArray(snapshot.members) || !snapshot.members.length || snapshot.members.length > 64) bad();
    image(snapshot.root_command, profile);
    if (!equal(snapshot.root, browser.root) || snapshot.root_command !== browser.root_command) bad();
    const seen = new Set();
    for (const member of snapshot.members) {
      process(member, registration.at_ms);
      const final = members.get(member.pid);
      if (seen.has(member.pid) || !final || !sameBirth(member, final) || member.pgid !== browser.root.pgid) bad();
      seen.add(member.pid);
      const expectedMember = member.pid === browser.root.pid ? snapshot.root : final;
      if (!fields.every(key => member[key] === expectedMember[key])) bad();
    }
    if (!seen.has(browser.root.pid) || n === 5 && seen.size !== members.size) bad();
  }
}
function verifyAdditionalQualification(state, handle) {
  const read = (value, maximum = 2097152) => readHandle(value, state.snapshots, maximum);
  const index = json(read(handle));
  record(index, ["schema", "source_pins", "official_sdk_executed", "public_upstream_requests",
    "actual_owner_slots_reserved", "cases"]);
  if (index.schema !== "airlock.sdk-absent-additional-meta-validation.v1"
    || !equal(index.source_pins, state.manifest.binding.source_pins)
    || index.official_sdk_executed !== false || index.public_upstream_requests !== 0
    || index.actual_owner_slots_reserved !== 0 || !Array.isArray(index.cases) || index.cases.length !== 2)
    fail("additional_qualification_invalid");
  const roots = new Set();
  for (const [n, row] of index.cases.entries()) {
    record(row, ["protocol", "manifest", "report", "capture", "completion", "actual_child"]);
    if (row.protocol !== ["h1", "h2"][n]) fail("additional_qualification_invalid");
    const manifest = json(read(row.manifest)), root = dirname(row.manifest.path), binding = manifest.binding;
    if (!root.startsWith(resolve("rig/out") + "/") || roots.has(root)
      || manifest.kind !== "airlock.inspected-meta-local.v1" || manifest.case_name !== "meta-stock"
      || manifest.output_dir !== join(root, "run")) fail("additional_qualification_invalid");
    roots.add(root);
    const fixtureRead = value => readHandle(value, state.snapshots, 65536, root);
    const authority = json(fixtureRead(binding.authority));
    const lineage = validateAdditionalAuthority({ authority, binding, local: true, root, read: fixtureRead });
    const permission = json(fixtureRead(binding.inspection_permission));
    validateAdditionalInspection(permission, binding, true);
    if (!equal(permission.owner_decision, lineage.baseline.owner_decision)) fail("additional_qualification_invalid");
    validateAdditionalLocation(json(fixtureRead(binding.case_permission)), binding, authority, true, lineage.baseline);
    const inputs = json(fixtureRead(binding.inputs));
    for (const role of ["runtime", "configuration"]) {
      const { path, sha256 } = inputs[role];
      if (!fixtureRead({ path, sha256 }).equals(Buffer.from(role === "runtime" ? LOCAL_RUNTIME : LOCAL_CONFIGURATION)))
        fail("additional_qualification_invalid");
    }
    const report = json(read(row.report), 16384), capture = json(read(row.capture, 33554432), 16384);
    const completion = json(read(row.completion)), child = json(read(row.actual_child));
    const supervision = json(read(child.supervision));
    const lifetime = value => value && Number.isSafeInteger(value.pid) && value.pid > 0
      && value.pgid === value.pid && value.uid === process.getuid()
      && typeof value.started === "string" && value.started.length > 10 && digest(value.command_sha256);
    if (supervision.schema !== "airlock.additional-meta-supervision.v1" || supervision.control !== "normal"
      || !equal(supervision.command, child.command) || supervision.qualified !== true
      || supervision.timed_out !== false || supervision.resource_disposition !== "closed"
      || supervision.child_exit_observed !== true || supervision.pipes_closed !== true
      || !equal(supervision.errors, []) || !lifetime(supervision.node)
      || supervision.node.command_sha256 !== hash(child.command.join(" "))
      || !Number.isSafeInteger(supervision.elapsed_ms) || supervision.elapsed_ms <= 0 || supervision.elapsed_ms >= 60000
      || !Number.isSafeInteger(supervision.started_ms) || supervision.started_ms < binding.window.not_before_ms
      || supervision.started_ms + supervision.elapsed_ms >= binding.window.expires_at_ms
      || !equal(supervision.source_before, binding.source_pins) || !equal(supervision.source_after, binding.source_pins)
      || !Array.isArray(supervision.browsers) || supervision.browsers.length !== 1
      || !Array.isArray(supervision.ports) || supervision.ports.length < 4 || supervision.ports.length > 8
      || !Array.isArray(supervision.private_keys) || supervision.private_keys.length !== 2
      || supervision.private_keys.some(item => item.removed !== true)
      || !equal(supervision.private_keys.map(item => item.path).sort(),
        ["inspector-key.pem", "receiver-key.pem"].map(name => join(root, "run", name)).sort())
      || new Set(supervision.ports.map(item => item.port)).size !== supervision.ports.length
      || supervision.ports.some(item => item.closed !== true || !Number.isInteger(item.port) || item.port < 1 || item.port > 65535)
      || !Array.isArray(supervision.registrations) || supervision.registrations.length < 4
      || supervision.registrations.length > 16) fail("additional_supervision_invalid");
    const exit = json(read(supervision.actual_exit));
    if (exit.command_exit_observed !== true || exit.actual_exit_code !== 0 || exit.signal !== null
      || !equal(exit.command, child.command)) fail("additional_supervision_invalid");
    for (const browser of supervision.browsers) {
      if (!lifetime(browser.root) || browser.root.ppid !== supervision.node.pid || browser.status !== "closed"
        || browser.profile_removed !== true || !equal(browser.errors, []) || !browser.profile
        || browser.profile.uid !== process.getuid() || !Number.isFinite(browser.profile.birthtime_ms)
        || !Number.isSafeInteger(browser.profile.dev) || !Number.isSafeInteger(browser.profile.ino)
        || typeof browser.profile.path !== "string" || dirname(browser.profile.path) !== realpathSync(tmpdir())
        || !/^playwright_chromiumdev_profile-[A-Za-z0-9]+$/.test(browser.profile.path.split("/").at(-1))
        || typeof browser.profile.argument_path !== "string"
        || join(realpathSync(dirname(browser.profile.argument_path)), browser.profile.argument_path.split("/").at(-1)) !== browser.profile.path
        || !Array.isArray(browser.processes) || !browser.processes.length || browser.processes.length > 64
        || browser.processes.some(item => !["absent", "zombie"].includes(item.final)
          || item.uid !== browser.root.uid || item.pgid !== browser.root.pgid || !digest(item.command_sha256)))
        fail("additional_supervision_invalid");
    }
    verifyAdditionalLifecycle(supervision, exit, completion, read);
    const reservation = json(read(report.reservation));
    record(reservation, ["schema_version", "state", "case_name", "authority_id", "authority_sha256",
      "source_sha256", "input_sha256", "reserved_at_ms", "window", "execution_prerequisites_proved_by_reservation",
      "authority_variant", "lineage_baseline_sha256", "binding_sha256"]);
    if (!equal(binding.source_pins, index.source_pins) || !equal(report.source_before, index.source_pins)
      || !equal(report.source_after, index.source_pins)) fail("additional_qualification_stale_source");
    if (row.report.path !== join(root, "run/report.json") || row.capture.path !== join(root, "run/capture.json")
      || row.completion.path !== join(root, "run/completion.json")
      || !equal(child.command, [process.execPath, fileURLToPath(new URL("./meta-additional-qualification.mjs", import.meta.url)),
        "--supervised-child", row.protocol, "normal", row.manifest.path, row.manifest.sha256])
      || child.command_exit_observed !== true || child.actual_exit_code !== 0 || child.signal !== null
      || !Number.isFinite(child.elapsed_external_ms) || child.elapsed_external_ms <= 0 || child.elapsed_external_ms >= 60000
      || report.schema !== "airlock.sdk-absent-inspected-meta-controller.v1"
      || report.authority_variant !== "additional-meta-2026-10-21" || report.protocol !== row.protocol || report.program !== "normal"
      || report.local_controller_qualified !== true || report.local_slot_reserved !== true
      || report.native_sdk_executed !== false || report.execution_authority !== false
      || report.full_native_guard_qualified !== false || report.actual_owner_slots_reserved !== 0
      || report.public_upstream_requests !== 0 || !equal(report.errors, []) || report.producer_exit_code !== 0
      || report.binding_sha256 !== inspectedMetaBindingDigest(binding)
      || report.response_originals_match !== true || report.original_wire_bytes_equal !== true
      || report.receiver_attempts !== 1 || report.responses_complete !== 1 || report.fixture_sources_consumed !== 2
      || !equal(report.cohort, COHORT) || !equal(binding.cohort, COHORT) || !equal(report.window, binding.window)
      || !equal(report.cleanup, Object.fromEntries(["contexts_closed", "sockets_closed", "sessions_closed",
        "servers_closed", "observers_settled", "context_close_observers_settled", "server_close_observers_settled",
        "script_observers_settled", "network_waiters_settled", "decompressors_closed", "private_keys_removed",
        "browser_process_exited", "transport_closed", "transport_sockets_closed", "transport_tasks_settled",
        "deadline_met"].map(key => [key, true])))
      || !equal(capture.cleanup, report.cleanup)
      || capture.schema !== "airlock.sdk-absent-inspected-meta-originals.v1"
      || capture.authority_variant !== report.authority_variant
      || !equal(capture.lineage_baseline, report.lineage_baseline)
      || !equal(report.lineage_baseline, binding.additional.lineage_baseline)
      || !equal(capture.reservation, report.reservation) || report.reservation.path !== lineage.canonical_slot_path
      || reservation.schema_version !== 1 || reservation.execution_prerequisites_proved_by_reservation !== false
      || !Number.isSafeInteger(reservation.reserved_at_ms)
      || reservation.reserved_at_ms < binding.window.not_before_ms
      || reservation.reserved_at_ms >= binding.window.expires_at_ms
      || reservation.reserved_at_ms >= completion.publication.resources_closed_at_ms
      || reservation.state !== "spent" || reservation.authority_id !== authority.authority_id
      || reservation.authority_sha256 !== binding.authority.sha256 || reservation.case_name !== "meta-stock"
      || reservation.authority_variant !== report.authority_variant
      || reservation.lineage_baseline_sha256 !== binding.additional.lineage_baseline.sha256
      || reservation.binding_sha256 !== report.binding_sha256
      || reservation.input_sha256 !== binding.inputs.sha256
      || reservation.source_sha256 !== inspectedMetaBindingDigest(index.source_pins)
      || !equal(reservation.window, binding.window)
      || !equal(capture.local_result, { init: 1, pageview: 1, outcomes: [true] })
      || !equal(capture.order, ["durable_reservation", "fixture_execution", "logical_dispatch", "receiver", "context_closed"])
      || capture.source_execution.length !== 2 || capture.script_evidence.length !== 2
      || completion.schema !== "airlock.sdk-absent-inspected-meta-completion.v1"
      || completion.binding_sha256 !== report.binding_sha256 || completion.command_exit_observed !== false
      || completion.producer_exit_code !== 0 || completion.report_sha256 !== row.report.sha256
      || completion.capture_sha256 !== row.capture.sha256 || !equal(completion.window, report.window)
      || !["resources_closed_at_ms", "capture_written_at_ms", "report_write_started_at_ms", "attempted_at_ms"]
        .every(key => Number.isSafeInteger(completion.publication[key])
          && completion.publication[key] >= report.window.not_before_ms)
      || completion.publication.resources_closed_at_ms > completion.publication.capture_written_at_ms
      || completion.publication.capture_written_at_ms > completion.publication.report_write_started_at_ms
      || completion.publication.report_write_started_at_ms > completion.publication.attempted_at_ms
      || completion.publication.attempted_at_ms >= report.window.expires_at_ms)
      fail("additional_qualification_invalid");
    verifyAdditionalOriginals(capture, report, inputs, row.protocol);
    for (const role of ["runtime", "configuration"]) {
      const bytes = Buffer.from(role === "runtime" ? LOCAL_RUNTIME : LOCAL_CONFIGURATION), sha256 = hash(bytes);
      if (!equal(capture.verified_source_originals[role], { sha256, bytes_base64: bytes.toString("base64") })
        || capture.script_evidence.filter(item => item.role === role && item.sha256 === sha256
          && item.evidence === "actual_script_parsed_source").length !== 1
        || capture.source_execution.filter(item => item.role === role && item.sha256 === sha256
          && item.evidence === "validated_before_script_execution_and_resumed").length !== 1)
        fail("additional_qualification_source_invalid");
    }
  }
  state.additionalQualificationVerified = true;
}
/** Read-only inspection, never a prepared plan, native lease or grant. */
export function inspectAdditionalMetaQualification(handle) {
  const state = { snapshots: [], manifest: { binding: { source_pins: inspectedMetaSourcePins() } } };
  verifyAdditionalQualification(state, handle);
  unchanged(state);
  return Object.freeze({ schema: "airlock.additional-meta-qualification-inspection.v1",
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
    "source_pins", "cohort", "window", "limits", "commands"],
  ["case_permission", "observation_end_ms", "additional", "scheduling"]);
  if (Object.hasOwn(binding, "additional") !== Object.hasOwn(binding, "scheduling")) fail("additional_binding_invalid");
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
    if (binding.additional && !state.additionalQualificationVerified
      && !state.blockers.includes("additional_path_qualification_missing"))
      state.blockers.push("additional_path_qualification_missing");
    if (state.blockers.length) { unchanged(state); check(state); return preparedPlan(state, false); }
  } else if (Object.hasOwn(binding, "observation_end_ms")) fail("invalid_local_program");
  const authority = json(readHandle(binding.authority, snapshots, 65536, root));
  state.authority = authority;
  state.additional = additionalAuthority(authority);
  if (state.additional) {
    state.lineage = validateAdditionalAuthority({ authority, binding, local, root,
      read: handle => readHandle(handle, snapshots, 65536, root) });
  } else {
    if (binding.additional) fail("additional_authority_required");
    authorityAt(authority, local);
  }
  if (!binding.case_permission) fail("original_authority_location_binding_missing");
  validateLocationPermission(state);
  slotAvailable(state);
  const permission = json(readHandle(binding.inspection_permission, snapshots, 65536, root));
  if (state.additional) {
    validateAdditionalInspection(permission, binding, local);
    if (!equal(permission.owner_decision, state.lineage.baseline.owner_decision)) fail("additional_inspection_permission_invalid");
  } else {
  if (!equal(permission.scope, INSPECTION_SCOPE) || permission.schema_version !== 1
    || (local ? permission.kind !== "synthetic_inspection_design" || permission.status !== "local_only"
      : permission.kind !== "owner_conversation_authority"
        || permission.status !== "approved_conditional_reference_design"
        || permission.original_authority_mutated !== false || permission.actual_slots_reserved_or_spent !== 0))
    fail("inspection_permission_missing");
  if (local) record(permission, ["schema_version", "kind", "status", "scope"]);
  else record(permission, ["schema_version", "kind", "status", "recorded_on", "question", "choices",
    "answer", "scope", "remaining_required", "not_granted", "original_authority_mutated", "actual_slots_reserved_or_spent"]);
  }
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
  if (state.additional) fail("native_attended_entry_required");
  unchanged(state); check(state);
  if (!state.nativeReady || state.blockers.length) fail("native_pre_admission_blocked");
  validateNativeAdmission(state);
  return runEngine(state, { protocol: null, program: "native" });
}
/** Fixed attended entry; it cannot turn a local plan into a native transport lease. */
export async function runAttendedInspectedMeta(plan) {
  const state = !isProxy(plan) && plan && plans.get(plan);
  if (arguments.length !== 1 || !state?.manifest.binding.additional) fail("invalid_prepared_case");
  const entry = fileURLToPath(new URL("./meta-attended-reference.mjs", import.meta.url));
  if (process.argv.length !== 5 || process.argv[1] !== entry ||
    !["--native", "--local-h1", "--local-h2", "--local-owner-stop"].includes(process.argv[2]) ||
    process.argv[3] !== state.snapshots[0].handle.path ||
    process.argv[4] !== state.snapshots[0].handle.sha256 ||
    (process.argv[2] === "--native") === state.local) fail("fixed_attended_entry_required");
  if (!state.local) {
    if (!state.nativeReady || state.blockers.length) fail("native_pre_admission_blocked");
    validateNativeAdmission(state);
  }
  state.attended = true;
  return runEngine(state, { protocol: state.local ? process.argv[2] === "--local-h1" ? "h1" : "h2" : null,
    program: process.argv[2] === "--local-owner-stop" ? "attended-owner-stop" : state.local ? "normal" : "native" });
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
    if (identity(state.reservation.canonical_record_path) !== state.reservation_identity
      || hash(readMetaPrivate(state.reservation.canonical_record_path, 65536)) !== state.reservation_sha256)
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
  if (state.additional) {
    validateAdditionalLocation(permission, binding, state.authority, state.local, state.lineage.baseline);
    state.casePermission = permission; return;
  }
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
  "deadline", "close-failure", "output-failure", "late-output", "supervision-stuck-shutdown"];

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
  if (program === "supervision-stuck-shutdown" && !state.additional) fail("invalid_local_program");
  return runEngine(state, { protocol, program });
}
async function runEngine(state, { protocol, program }) {
  const local = state.local;
  if (!local) validateNativeAdmission(state);
  if (state.attempted) fail("prepared_case_already_attempted");
  unchanged(state); check(state); slotAvailable(state); outputAvailable(state.manifest.output_dir);
  if (local && state.additional && !state.attended && !process.send) fail("additional_supervisor_required");
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
  let browserServer, browser, transport, cdp, continuation, page, context, reserved = false, localResult = null;
  let timer, fixtureTimer, sourceConsumers = new Set(), logicalAuthority = false, stopping = false, step = "preparing";
  let cleanupMode = false;
  let attendedResult = null;
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
    const result = await wait(continuation("Runtime.evaluate", { expression: source, awaitPromise: true, returnByValue: true }), 6000);
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
    if (state.attended && remaining() < 25000) fail("insufficient_cleanup_window");
    if (!local && state.attended &&
      state.manifest.binding.observation_end_ms > state.manifest.binding.window.expires_at_ms - 20000)
      fail("insufficient_cleanup_window");
    unchanged(state); check(state); slotAvailable(state);
    if (!local) validateNativeAdmission(state);
    const binding = state.manifest.binding;
    state.reservation = reserveStockSlot({ authority_path: binding.authority.path,
      authority_sha256: binding.authority.sha256, case_name: "meta-stock",
      input_sha256: binding.inputs.sha256, source_sha256: inspectedMetaBindingDigest(binding.source_pins),
      window: binding.window, ...(state.additional ? { additional_binding: binding } : {}) });
    state.reservation_sha256 = hash(readMetaPrivate(state.reservation.canonical_record_path, 65536));
    state.reservation_identity = state.reservation.canonical_record_identity;
    state.reserved = reserved = true; state.phase = "running"; order.push("durable_reservation");
    checkReservation(state);
    mkdirSync(output, { mode: 0o700 }); syncDirectory(output); syncDirectory(dirname(output));
    outputPrepared = true;
    if (state.attended) {
      state.attendedControl = await createMetaAttendedControl({
        output_dir: output, manifest: state.snapshots[0].handle,
        binding_sha256: inspectedMetaBindingDigest(binding), source_pins: binding.source_pins,
        window: binding.window, deadline_ms: state.started + LIMITS.duration_ms, retain,
        onStop: reason => {
          logicalAuthority = false;
          stopCase(reason);
          if (transport) task(Promise.resolve(transport.close()));
        },
      });
    }
    unchanged(state); check(state);
    timer = setTimeout(() => {
      if (state.attendedControl) {
        state.attendedControl.requestStop("controller_deadline");
        task(state.attendedControl.killBrowser());
        return;
      }
      stopCase("controller_deadline");
      const child = browserServer?.process();
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, remaining() - (state.attended ? 20000 : 5000));
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
    const png = LOCAL_PNG;
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
    if (local && state.additional && !state.attended) {
      await wait(registerAdditionalPorts([...servers].map(server => server.address().port).concat(transport.port)), 4500);
      await wait(registerAdditionalPending(), 4500);
    }
    if (state.attendedControl) await state.attendedControl.beforeBrowser();
    const localGuard = local && !state.additional && !state.attended &&
      process.env.AIRLOCK_LOCAL_GUARD_REGISTRATION === "1"
      ? await wait(beginLocalGuardRegistration({
        directory: output, source_sha256: localGuardSourceDigest(binding.source_pins), window: binding.window,
      }), 4500) : null;
    const browserAcquisition = chromium.launchServer({
      executablePath: fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url)),
      host: "127.0.0.1", headless: false, timeout: Math.max(1, Math.min(10000, remaining() - 6000)),
      proxy: { server: "http://127.0.0.1:" + transport.port },
      args: ["--disable-background-networking", "--dns-prefetch-disable", `--ignore-certificate-errors-spki-list=${spki}`],
      ...(state.attended ? { handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false } : {}),
    });
    browserServer = state.attendedControl
      ? await wait(state.attendedControl.trackBrowser(browserAcquisition), 10000)
      : await browserAcquisition;
    if (localGuard) await wait(localGuard.ready(browserServer), 4500);
    if (local && state.additional && !state.attended) await wait(registerAdditionalBrowser(browserServer), 4500);
    if (program === "attended-owner-stop") {
      while (!stopping) {
        check(state);
        await wait(new Promise(resolve => setTimeout(resolve, 20)));
      }
      fail("owner_stop_requested");
    }
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
    continuation = createInspectedMetaContinuation({
      cdp, check: () => { unchanged(state); checkReservation(state); check(state); },
      phase: () => state.phase, stopping: () => stopping,
    });
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
      await wait(continuation("Debugger.resume"));
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
        await wait(continuation("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
          responseHeaders: document.headers, body: document.bytes.toString("base64") }));
      } else if (decision.kind === "local_source") {
        const role = decision.route;
        if (state.fulfilled.has(role)) return deny("repeated_source_dependency");
        unchanged(state); check(state); state.fulfilled.add(role);
        await wait(continuation("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
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
        await wait(continuation("Fetch.continueRequest", { requestId: event.requestId }));
      }
    })()));
    await wait(cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }));
    await wait(cdp.send("Debugger.setInstrumentationBreakpoint", { instrumentation: "beforeScriptExecution" }));
    unchanged(state); check(state); checkReservation(state);
    step = "fixture_navigation";
    continuation.assertAdmission();
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
    if (local && program === "supervision-stuck-shutdown") {
      writeMetaPrivate(join(output, "supervision-abort-originals.json"), {
        schema: "airlock.additional-meta-stuck-shutdown-originals.v1", native_sdk_executed: false,
        actual_owner_slots_reserved: 0, public_upstream_requests: 0, originals: originalsOf(observer),
        logical_observations: logicalAll, source_execution: sourceExecution, receiver: receiverRows,
        order, closure_claimed: false, at_ms: Date.now() });
      await holdAdditionalShutdown(browserServer.process().pid);
    }
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
      "cohort_mismatch", "owner_stop_requested"].includes(error.message) ? error.message : local ? "local_controller_inconclusive" : "native_stock_inconclusive");
  } finally {
    state.phase = "closing";
    cleanupMode = true;
    clearTimeout(fixtureTimer);
    for (const value of [...contexts]) try { await closeContext(value); } catch { errors.push("context_close_failed"); }
    stop();
    if (transport) try { await transport.close(); } catch { errors.push("transport_close_failed"); }
    await wait(Promise.allSettled([...tasks])).catch(() => errors.push("observer_settlement_failed"));
    if (observer.snapshot().decompressors) observer.stop("controller_cleanup");
    let mayCloseBrowser = true;
    if (state.attendedControl) {
      try { await state.attendedControl.beforeClose(); }
      catch { mayCloseBrowser = false; errors.push("attended_profile_identity_unknown"); }
    }
    if (browser && mayCloseBrowser) try { await wait(browser.close(), 2500); } catch { errors.push("browser_close_failed"); }
    if (browserServer && mayCloseBrowser) try { await wait(browserServer.close(), 2500); } catch { errors.push("browser_server_close_failed"); }
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) {
      if (state.attendedControl) {
        try { await state.attendedControl.killBrowser(); } catch { errors.push("attended_browser_signal_failed"); }
      } else child.kill("SIGKILL");
      await wait(new Promise(resolve => child.once("exit", resolve)), 1500).catch(() => errors.push("owned_process_close_failed"));
    }
    state.phase = "finished";
    if (!outputPrepared) fail("case_output_unavailable_after_reservation");
    for (const value of [...contexts]) try { await closeContext(value); } catch { errors.push("context_close_retry_failed"); }
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("receiver_close_failed"); }
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("receiver_close_retry_failed"); }
    for (const path of secrets) try { if (existsSync(path)) unlinkSync(path); } catch { errors.push("private_key_cleanup_failed"); }
    if (state.attendedControl) {
      try {
        attendedResult = await state.attendedControl.finish();
        if (!attendedResult.pending_settled || !attendedResult.browser_closed ||
          !attendedResult.profile_absent || attendedResult.errors.length) errors.push("attended_cleanup_unknown");
      } catch { errors.push("attended_cleanup_unknown"); }
    }
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
    ...(attendedResult ? { attended_control: {
      start: attendedResult.control, browser: attendedResult.browser, final: attendedResult.final,
    } } : {}),
    engine: "shared-inspected-meta",
    binding_sha256: inspectedMetaBindingDigest(state.manifest.binding),
    input_sha256: state.manifest.binding.inputs.sha256,
    authority_sha256: state.manifest.binding.authority.sha256,
    ...(state.additional ? { authority_variant: "additional-meta-2026-10-21",
      lineage_baseline: state.manifest.binding.additional.lineage_baseline,
      reservation: { path: state.reservation.canonical_record_path, sha256: state.reservation_sha256 } } : {}),
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
    ...(state.additional ? { authority_variant: "additional-meta-2026-10-21",
      lineage_baseline: state.manifest.binding.additional.lineage_baseline,
      reservation: { path: state.reservation.canonical_record_path, sha256: state.reservation_sha256 } } : {}),
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
