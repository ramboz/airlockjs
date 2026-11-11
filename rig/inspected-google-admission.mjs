import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync,
  writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";
import { promisify } from "node:util";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { readMetaPrivate } from "./native-stock-meta.mjs";
import { privateOriginalDirectory, readPrivateOriginal } from "./private-original-file.mjs";
import { createNativeStockPolicy, LIMITS, parseGoogleStockResponse } from "./native-stock-policy.mjs";
import { createNativeAdditionalGoogleReader, validateNativeAdditionalGoogle, prepareNativeAdditionalGoogle,
  consumeNativeAdditionalGoogle, additionalGoogleSourcePin } from "./inspected-google-additional.mjs";
import { reserveNativeAdditionalGoogleSlot } from "./native-stock-capture.mjs";
import { startNativeGoogleInspectedTransport } from "./inspected-transport.mjs";

const OFFICIAL_PIN = "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50";
const digest = value => createHash("sha256").update(JSON.stringify(data(value))).digest("hex");
const LOADED_SOURCE_PINS = inspectedMetaSourcePins();
const plans = new WeakMap();
const nativeEngines = new WeakMap();
const nativeReservationAdmissions = new WeakMap();
const execute = promisify(execFile);
const LOCAL_SOURCE = Buffer.from("/* sdk-absent google fixture */\n");
const COMMANDS = Object.freeze({ initialize: 1, configure: 1, conversion: 1, consent: "native-default" });
const GOOGLE_SCOPE = Object.freeze({
  case_name: "google-stock", initialization_commands: 1, configuration_commands: 1, conversion_commands: 1,
  value: 1, currency: "USD", action: "owned_secondary_purchase", physical_vendor_http_attempt_ceiling: 20,
  absolute_seconds: 60, uses_original_existing_google_stock_slot: true, additional_events_or_retry_grants: false,
  temporary_inspector_trust_in_isolated_browser: true, upstream_real_collector_certificate_validation_required: true,
  inspected_network_not_chrome_tls: true, system_trust_changes: false, account_or_billing_changes: false,
});
const AUTHORITY_LIMITS = Object.freeze({
  google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
  google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
  google_vendor_https_requests_per_case: LIMITS.google_requests, meta_vendor_https_requests_per_case: LIMITS.meta_requests,
  observed_requests_per_case: LIMITS.observations, absolute_seconds_per_case: 60, url_bytes: LIMITS.url_bytes,
  request_headers_and_body_bytes: LIMITS.request_bytes, response_bytes: LIMITS.response_bytes,
  retained_aggregate_bytes: LIMITS.aggregate_bytes,
});
const AUTHORITY_OPTIONAL = ["authority_id_purpose", "date", "owner_selected_exactly", "approved_question",
  "requirements", "excluded", "adobe_handoff", "not_an_executable_live_case_manifest", "guard_currently_live_qualified",
  "fresh_setup_currently_verified", "owner_setup_facts_received", "owner_setup_receipt",
  "fresh_case_specific_live_preflight_still_required", "owner_response_limit_clarification",
  "owner_reference_header_timing_exception", "candidate_or_production_rules_relaxed",
  "native_or_chamber_case_started_by_this_approval_record"];

export function googleCasePermissionDigest(value) {
  const { case_permission: _casePermission, ...binding } = data(value);
  return digest(binding);
}
export const googleBindingDigest = digest;

function prepare(options, local) {
  const input = record(options, ["manifest_path", "manifest_sha256"]);
  const root = local && typeof input.manifest_path === "string" ? dirname(input.manifest_path) : null;
  if (local && (dirname(root) !== resolve("rig/out") || !/^google-prep-[a-f0-9]{16}$/.test(root.slice(-28))))
    throw Error("nonlocal_google_fixture");
  const snapshots = [];
  const read = (handle, maximum = 65536, uid = process.getuid()) => {
    const item = record(handle, ["path", "sha256"]);
    if (typeof item.path !== "string" || !isAbsolute(item.path) || resolve(item.path) !== item.path
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)
      || local && !item.path.startsWith(root + "/")) throw Error("invalid_google_private_handle");
    let original;
    try { original = readPrivateOriginal(item.path, { uid, maximum }); }
    catch { throw Error("google_private_handle_unavailable"); }
    if (original.handle.sha256 !== item.sha256) throw Error("google_private_handle_stale");
    snapshots.push({ item, handle: original.handle, maximum, uid });
    return original.bytes;
  };
  const manifest = json(read({ path: input.manifest_path, sha256: input.manifest_sha256 }));
  record(manifest, ["schema_version", "kind", "case_name", "transport", "binding", "evidence", "output_dir"]);
  if (!local && manifest.schema_version === 1 && manifest.kind === "airlock.inspected-google-additional-stock.v1"
    && manifest.case_name === "google-stock" && manifest.transport === "inspected-network") {
    const reader = createNativeAdditionalGoogleReader();
    reader.read({ path: input.manifest_path, sha256: input.manifest_sha256 });
    const validated = validateNativeAdditionalGoogle(manifest.binding, reader);
    if (!equal(validated.binding.source_pins, LOADED_SOURCE_PINS)
      || !equal(inspectedMetaSourcePins(), LOADED_SOURCE_PINS)) throw Error("google_additional_source_stale");
    if (typeof manifest.output_dir !== "string" || !isAbsolute(manifest.output_dir)
      || resolve(manifest.output_dir) !== manifest.output_dir
      || manifest.output_dir !== join(dirname(validated.binding.authority.path), "google-additional-output"))
      throw Error("invalid_google_output");
    privateOriginalDirectory(dirname(manifest.output_dir), process.getuid());
    try { lstatSync(manifest.output_dir); throw Error("google_output_exists"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const additionalPlan = prepareNativeAdditionalGoogle(manifest.binding);
    const blockers = Object.freeze(["current_browser_qualification_unverified", "native_stop_unqualified",
      "retained_guard_unqualified", "evidence_provenance_unqualified"]);
    const plan = Object.freeze({ admission: "blocked", execution_authority: false,
      case_name: "google-stock", blockers, toJSON() { throw Error("google_plan_not_serializable"); } });
    plans.set(plan, { kind: "additional", binding: validated.binding, profile: validated.profile,
      source: validated.source,
      reader, additionalPlan, output: manifest.output_dir, blockers, nativeReady: false });
    return plan;
  }
  if (manifest.schema_version !== 1 || manifest.kind !== (local
    ? "airlock.inspected-google-local.v1" : "airlock.inspected-google-stock.v1")
    || manifest.case_name !== "google-stock" || manifest.transport !== "inspected-network")
    throw Error("unsupported_google_manifest");
  const binding = record(manifest.binding, ["inputs", "authority", "inspection_permission", "case_permission",
    "source_pins", "cohort", "window", "limits", "commands"]);
  if (!equal(binding.limits, LIMITS) || !equal(binding.commands, COMMANDS)) throw Error("google_envelope_invalid");
  const window = record(binding.window, ["not_before_ms", "expires_at_ms", "observation_end_ms"]);
  const checkWindow = () => {
    const now = Date.now();
    if (!Object.values(window).every(Number.isSafeInteger) || window.not_before_ms < 0
      || now < window.not_before_ms || now >= window.observation_end_ms
      || window.expires_at_ms <= window.not_before_ms || window.expires_at_ms - window.not_before_ms > LIMITS.duration_ms
      || window.observation_end_ms > window.expires_at_ms - 6000) throw Error("google_window_inactive");
  };
  checkWindow();
  const sources = inspectedMetaSourcePins(), cohort = currentGoogleCohort();
  if (!equal(sources, LOADED_SOURCE_PINS) || !equal(sources, binding.source_pins)) throw Error("google_source_stale");
  if (!equal(cohort, binding.cohort)) throw Error("google_cohort_stale");
  if (typeof manifest.output_dir !== "string" || !isAbsolute(manifest.output_dir)
    || resolve(manifest.output_dir) !== manifest.output_dir || local && dirname(manifest.output_dir) !== root)
    throw Error("invalid_google_output");
  try { lstatSync(manifest.output_dir); throw Error("google_output_exists"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const inputs = json(read(binding.inputs));
  record(inputs, ["schema_version", "profile", "owned_origin", "document_url", "owned", "runtime",
    "companion_authorized", "source_capture_sha256", "authorization"]);
  const runtime = record(inputs.runtime, ["path", "sha256", "request_url", "response_status"]);
  if (inputs.schema_version !== 1 || inputs.profile !== "google-ads-conversion"
    || typeof inputs.source_capture_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(inputs.source_capture_sha256)
    || typeof inputs.authorization !== "string" || inputs.authorization.length < 1 || inputs.authorization.length > 4096)
    throw Error("invalid_google_inputs");
  try {
    const url = new URL(inputs.document_url);
    if (url.origin !== inputs.owned_origin) throw Error("origin");
  } catch { throw Error("invalid_google_inputs"); }
  const profile = { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
    document_url: inputs.document_url, owned: inputs.owned, companion_authorized: inputs.companion_authorized,
    resources: [{ role: "runtime", url: runtime.request_url, sha256: local ? OFFICIAL_PIN : runtime.sha256 }] };
  createNativeStockPolicy(profile);
  if (runtime.response_status !== 200 || !local && runtime.sha256 !== OFFICIAL_PIN)
    throw Error("google_retained_source_invalid");
  const sourceBytes = read({ path: runtime.path, sha256: runtime.sha256 }, LIMITS.response_bytes);
  if (local && !sourceBytes.equals(LOCAL_SOURCE)) throw Error("google_retained_source_invalid");
  const authority = json(read(binding.authority));
  record(authority, ["schema_version", "kind", "status", "authority_id", "cases", "limits"],
    local ? ["synthetic_only"] : AUTHORITY_OPTIONAL);
  if (authority.schema_version !== 1 || authority.kind !== "owner_conversation_authority"
    || authority.status !== "approved_conditional" || !equal(authority.limits, AUTHORITY_LIMITS)
    || (local ? authority.authority_id !== "synthetic-only-grant" || authority.synthetic_only !== true
      : authority.authority_id !== "google-meta-paired-2026-10-19"))
    throw Error("google_original_authority_invalid");
  record(authority.cases, ["google-stock", "google-chamber", "meta-stock", "meta-chamber"]);
  if (!equal(authority.cases["google-stock"], { reserved: false, admitted: false, spent: false }))
    throw Error("google_original_case_unavailable");
  const inspection = json(read(binding.inspection_permission));
  record(inspection, ["schema_version", "kind", "status", "decision", "decision_sha256", "scope"]);
  const decisionPath = resolve("docs/decisions/adr-0045-inspected-google-reference.md");
  const decision = readPrivateOriginal(decisionPath, { uid: null, maximum: 65536 });
  snapshots.push({ item: { path: decisionPath }, handle: decision.handle, maximum: 65536, uid: null });
  if (inspection.schema_version !== 1 || inspection.kind !== "inspected-google-reference-design"
    || inspection.status !== (local ? "synthetic_local_binding" : "candidate_unattested")
    || inspection.decision !== "ADR-0045" || inspection.decision_sha256 !== decision.handle.sha256
    || !/^---\r?\nstatus: Accepted\r?\n/.test(decision.bytes.toString("utf8"))
    || !equal(inspection.scope, GOOGLE_SCOPE)) throw Error("google_inspection_scope_invalid");
  const permission = json(read(binding.case_permission));
  record(permission, ["schema_version", "kind", "status", "case_name", "transport", "native_execution_permitted",
    "authority_locator", "canonical_slot_path", "permission_source_sha256", "valid_until_ms"]);
  const locator = record(permission.authority_locator, ["path", "sha256", "dev", "ino"]);
  const authorityStat = lstatSync(binding.authority.path, { bigint: true });
  const canonical = join(dirname(binding.authority.path), `native-stock-slots-${authority.authority_id}`, "google-stock.reserved");
  if (permission.schema_version !== 1 || permission.kind !== "inspected-google-case-location"
    || permission.status !== (local ? "synthetic_local_binding" : "approved_case_binding")
    || permission.native_execution_permitted !== !local || permission.case_name !== "google-stock"
    || permission.transport !== "inspected-network" || locator.path !== binding.authority.path
    || locator.sha256 !== binding.authority.sha256 || locator.dev !== String(authorityStat.dev)
    || locator.ino !== String(authorityStat.ino) || permission.canonical_slot_path !== canonical
    || permission.permission_source_sha256 !== googleCasePermissionDigest(binding)
    || permission.valid_until_ms !== window.expires_at_ms) throw Error("google_case_permission_invalid");
  try { lstatSync(canonical); throw Error("google_stock_slot_spent"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const evidence = record(manifest.evidence, ["setup", "coordination", "qualified_source", "guard",
    "frame", "compliance", "craft", "architecture", "reconciliation"]);
  const blockers = ["inspection_permission_provenance_unqualified", "case_permission_provenance_unqualified",
    "evidence_provenance_unqualified", "current_browser_qualification_unverified", "browser_descendant_cleanup_unqualified"];
  const sourceHash = digest(sources), bindingHash = digest(binding);
  const fingerprint = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const verifyQualification = handle => {
    const index = json(read(handle, LIMITS.response_bytes));
    record(index, ["schema", "source_pins", "cohort", "cases"]);
    if (index.schema !== "airlock.sdk-absent-google-browser-validation.v1"
      || !equal(index.source_pins, sources) || !equal(index.cohort, cohort)
      || !Array.isArray(index.cases) || index.cases.length !== 84) throw Error("google_qualification_incomplete");
    const controls = ["positive", "marker", "marker-bypass", "path", "path-bypass", "changed-input",
      "changed-input-bypass", "ambiguous", "ambiguous-bypass", "authority", "authority-bypass", "body",
      "body-bypass", "expiration", "expiration-bypass", "unsupported-transport", "unsupported-transport-bypass",
      "response-parent", "response-parent-unlinked", "response-parent-unlinked-bypass",
      "response-parent-incomplete", "response-parent-incomplete-bypass", "aggregate", "aggregate-bypass",
      "close", "close-positive", "no-ticket", "abort", "redirect", "budget", "budget-bypass", "certificate",
      "wrong-name", "response-limit", "response-limit-bypass", "header-limit", "header-limit-bypass",
      "truncated", "truncated-bypass", "retry", "retry-bypass", "goaway", "goaway-bypass"];
    const expected = new Set(["h1", "h2"].flatMap(protocol => controls
      .filter(control => protocol === "h2" || !control.startsWith("goaway"))
      .map(control => protocol + "/" + control)));
    const seen = new Set();
    for (const row of index.cases) {
      record(row, ["protocol", "control", "result", "witness", "completion"]);
      const key = row.protocol + "/" + row.control;
      if (!expected.has(key) || seen.has(key)) throw Error("google_qualification_incomplete");
      seen.add(key);
      if (dirname(row.result.path) !== join(dirname(row.witness.path), "run")
        || dirname(row.witness.path) !== dirname(row.completion.path)) throw Error("google_qualification_invalid");
      const resultBytes = read(row.result, LIMITS.aggregate_bytes), result = json(resultBytes);
      const witness = json(read(row.witness)), completion = json(read(row.completion));
      const abort = row.control === "abort", code = abort ? 1 : 0;
      if (completion.schema !== "airlock.sdk-absent-google-command-completion.v1"
        || completion.protocol !== row.protocol || completion.control !== row.control
        || completion.command_exit_observed !== true || completion.command_close_observed !== true
        || completion.complete !== false || completion.producer_evidence !== "not_validated"
        || completion.exit_code !== code || completion.close_code !== code || completion.signal !== null
        || completion.close_signal !== null || completion.spawn_failed !== false || completion.output_overflow !== false
        || !Number.isFinite(completion.elapsed_ms) || completion.elapsed_ms <= 0 || completion.elapsed_ms >= 60000
        || completion.source_before_sha256 !== fingerprint(sources) || completion.cohort_before_sha256 !== fingerprint(cohort)
        || witness.schema !== "airlock.sdk-absent-google-child-witness.v1" || witness.complete !== true
        || witness.command_exit_observed !== true || witness.exit_code !== code || witness.signal !== null
        || witness.protocol !== row.protocol || witness.control !== row.control
        || witness.result_sha256 !== row.result.sha256 || witness.source_sha256 !== fingerprint(sources)
        || witness.cohort_sha256 !== fingerprint(cohort) || witness.native_execution_qualified !== false
        || witness.native_sdk_executed !== false || witness.public_upstream_requests !== 0
        || witness.stdout_sha256 !== completion.stdout_sha256 || witness.stderr_sha256 !== completion.stderr_sha256
        || witness.elapsed_ms !== completion.elapsed_ms || witness.producer_outcome !== result.outcome
        || result.protocol !== row.protocol || result.control !== row.control
        || result.outcome !== (abort ? "inconclusive" : "pass")
        || (abort ? !equal(result.errors, ["synthetic_abort"]) || result.receiver_attempts !== 1
          || result.cleanup?.guard_at_context_close !== true : !equal(result.errors, []))
        || result.native_sdk_executed !== false || result.public_upstream_requests !== 0
        || result.native_execution_qualified !== false || !equal(result.source_before, sources)
        || !equal(result.source_after, sources) || !equal(result.cohort_before, cohort)
        || !equal(result.cohort_after, cohort)) throw Error("google_qualification_invalid");
      const { wire, responses } = record(result.originals, ["responses"], ["wire", "bytes"]);
      if (!Array.isArray(responses) || wire !== undefined && !Array.isArray(wire)
        || row.control === "positive" && (!(wire?.length) || !responses.length))
        throw Error("google_originals_invalid");
      const originals = [...(wire ?? []).flatMap(item => [item.request, item.response]), ...responses.map(item => item.body)];
      const names = new Set();
      let total = resultBytes.length;
      for (const original of originals) {
        record(original, ["file", "bytes", "chunks", "sha256"]);
        if (typeof original.file !== "string" || !/^original-[1-9][0-9]*\.bin$/.test(original.file)
          || names.has(original.file) || !Number.isSafeInteger(original.bytes) || original.bytes < 0
          || !Array.isArray(original.chunks) || original.chunks.some(size => !Number.isSafeInteger(size) || size < 0)
          || original.chunks.reduce((sum, size) => sum + size, 0) !== original.bytes
          || typeof original.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(original.sha256))
          throw Error("google_originals_invalid");
        names.add(original.file);
        const path = join(dirname(row.result.path), original.file);
        let bytes;
        if (original.bytes === 0) {
          bytes = readMetaPrivate(path, LIMITS.aggregate_bytes);
          if (bytes.length !== 0) throw Error("google_originals_invalid");
          const stat = lstatSync(path);
          snapshots.push({ emptyPath: path, stat: { dev: stat.dev, ino: stat.ino, mode: stat.mode,
            uid: stat.uid, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size } });
        } else bytes = read({ path, sha256: original.sha256 }, LIMITS.aggregate_bytes);
        total += bytes.length;
        if (bytes.length !== original.bytes || createHash("sha256").update(bytes).digest("hex") !== original.sha256
          || total > LIMITS.aggregate_bytes) throw Error("google_originals_invalid");
      }
    }
    if (seen.size !== expected.size) throw Error("google_qualification_incomplete");
  };
  const verifyReview = (name, receipt) => {
    const scope = `059-15-google-stock-inspected-network-${name}`;
    if (!equal(receipt.assertions, { verdict: "pass", scope }) || !receipt.review_artifact || !receipt.review_document)
      throw Error("google_review_invalid");
    const review = json(read(receipt.review_artifact));
    record(review, ["schema", "binding_sha256", "source_pins_sha256", "scope", "verdict", "reviewer_id",
      "reviewer_kind", "completed_at_ms", "reviewer_completion_observed", "reviewer_turn"]);
    if (review.schema !== "airlock.independent-review-receipt.v2" || review.binding_sha256 !== bindingHash
      || review.source_pins_sha256 !== sourceHash || review.scope !== scope || review.verdict !== "pass"
      || typeof review.reviewer_id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(review.reviewer_id)
      || review.reviewer_kind !== "independent" || review.reviewer_completion_observed !== true
      || !Number.isSafeInteger(review.reviewer_turn) || review.reviewer_turn < 0
      || !Number.isSafeInteger(review.completed_at_ms) || review.completed_at_ms < 0
      || review.completed_at_ms > receipt.issued_at_ms) throw Error("google_review_invalid");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(read(receipt.review_document, 65536, local ? process.getuid() : null));
    const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!front) throw Error("google_review_invalid");
    const fields = Object.create(null);
    for (const line of front[1].split(/\r?\n/)) {
      const entry = /^([a-z0-9_]+): ([^\r\n]+)$/.exec(line);
      if (!entry || Object.hasOwn(fields, entry[1])) throw Error("google_review_invalid");
      fields[entry[1]] = entry[2];
    }
    const passName = name === "frame" ? "frame-critique" : name === "architecture" ? "arch" : name;
    if (!/^059-15(?: - .+)?$/.test(fields.slice ?? "") || fields.pass !== passName || fields.verdict !== "pass"
      || fields.reviewer !== review.reviewer_id || Date.parse(fields.reviewed_at) !== review.completed_at_ms
      || !fields.prompt_source || fields.binding_sha256 !== bindingHash || fields.source_pins_sha256 !== sourceHash)
      throw Error("google_review_invalid");
  };
  for (const [name, handle] of Object.entries(evidence)) {
    if (handle === null) blockers.push(name + "_proof_missing");
    else {
      const receipt = json(read(handle));
      record(receipt, ["schema_version", "kind", "layer", "binding_sha256", "issued_at_ms", "valid_until_ms",
        "assertions"], ["qualification", "review_artifact", "review_document"]);
      if (receipt.schema_version !== 1 || receipt.kind !== "inspected-google-" + name
        || receipt.layer !== "reviewed-inspected-google-preflight" || receipt.binding_sha256 !== bindingHash
        || !Number.isSafeInteger(receipt.issued_at_ms) || receipt.issued_at_ms < 0
        || receipt.issued_at_ms > window.not_before_ms || receipt.valid_until_ms !== window.expires_at_ms)
        throw Error("google_evidence_stale");
      if (["frame", "compliance", "craft", "architecture", "reconciliation"].includes(name)) {
        if (Object.hasOwn(receipt, "qualification")) throw Error("google_review_invalid");
        verifyReview(name, receipt);
      } else if (name === "guard") {
        if (!receipt.qualification) throw Error("google_qualification_incomplete");
        record(receipt.assertions, []);
        if (receipt.review_artifact || receipt.review_document) throw Error("google_evidence_invalid");
        verifyQualification(receipt.qualification);
        blockers.push("guard_independent_provenance_unqualified");
      } else {
        record(receipt.assertions, []);
        if (receipt.qualification || receipt.review_artifact || receipt.review_document)
          throw Error("google_evidence_invalid");
        blockers.push(name + "_independent_provenance_unqualified");
      }
    }
  }
  for (const item of snapshots) {
    if (item.emptyPath) {
      const stat = lstatSync(item.emptyPath);
      const current = { dev: stat.dev, ino: stat.ino, mode: stat.mode, uid: stat.uid,
        mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size };
      if (!equal(current, item.stat) || readMetaPrivate(item.emptyPath).length !== 0)
        throw Error("google_private_handle_changed");
      continue;
    }
    let original;
    try { original = readPrivateOriginal(item.item.path, { uid: item.uid, maximum: item.maximum }); }
    catch { throw Error("google_private_handle_changed"); }
    if (!equal(original.handle, item.handle)) throw Error("google_private_handle_changed");
  }
  if (!equal(inspectedMetaSourcePins(), sources) || !equal(currentGoogleCohort(), cohort))
    throw Error("google_source_or_cohort_changed");
  checkWindow();
  if (local) return Object.freeze({ admission: "blocked", execution_authority: false,
    profile: profile.profile, case_name: "google-stock", blockers: Object.freeze(blockers) });
  const plan = Object.freeze({ admission: "blocked", execution_authority: false, case_name: "google-stock",
    blockers: Object.freeze(blockers), toJSON() { throw Error("google_plan_not_serializable"); } });
  plans.set(plan, { binding });
  return plan;
}

export function inspectLocalGooglePreparation(options) { return prepare(options, true); }
export function prepareNativeGoogleStock(options) {
  try { record(options, ["manifest_path", "manifest_sha256"]); }
  catch { throw Error("google_native_admission_closed"); }
  return prepare(options, false);
}
function assertNativeGoogleAdmission(state) {
  if (!state || state.kind !== "additional" || !state.nativeReady || state.blockers.length)
    throw Error("google_native_admission_closed");
  state.reader.unchanged();
  if (state.binding.source_sha256 !== additionalGoogleSourcePin()
    || !equal(state.binding.source_pins, LOADED_SOURCE_PINS)
    || !equal(inspectedMetaSourcePins(), LOADED_SOURCE_PINS)
    || !equal(state.binding.cohort, currentGoogleCohort())) throw Error("google_source_or_cohort_changed");
  if (Date.now() < state.binding.window.not_before_ms || Date.now() >= state.binding.observation_end_ms)
    throw Error("case_window_inactive");
}

export function claimNativeGoogleEngine(token, additionalPlan) {
  if (!token || isProxy(token) || !nativeEngines.has(token)) throw Error("invalid_google_native_engine");
  const engine = nativeEngines.get(token);
  nativeEngines.delete(token);
  if (engine.additionalPlan !== additionalPlan) throw Error("invalid_google_native_engine");
  engine.assertAdmission();
  return engine;
}

export function claimNativeGoogleReservationAdmission(ticket, binding) {
  if (!ticket || isProxy(ticket) || !nativeReservationAdmissions.has(ticket))
    throw Error("invalid_google_native_reservation_permit");
  const state = nativeReservationAdmissions.get(ticket);
  nativeReservationAdmissions.delete(ticket);
  if (!equal(state.binding, binding)) throw Error("invalid_google_native_reservation_permit");
  assertNativeGoogleAdmission(state);
}

function googleNativeDocument(profile) {
  const nonce = randomBytes(16).toString("hex");
  const js = value => JSON.stringify(value).replaceAll("<", "\\u003c");
  const { owned, resources } = profile;
  const runtime = resources.find(item => item.role === "runtime").url;
  const script = `
if(localStorage.length||sessionStorage.length||document.cookie)throw Error("nonempty_native_storage");
const source=${js(runtime)};
const policy=trustedTypes.createPolicy("default",{createScriptURL(value){
 if(value!==source)throw new TypeError("unpinned_script_dependency");return value;
}});
window.dataLayer=window.dataLayer||[];
window.gtag=function(){window.dataLayer.push(arguments)};
window.__airlockNativeCommands={initialize:0,configure:0,conversion:0,consent:"native-default"};
const tag=document.createElement("script");tag.async=true;tag.src=policy.createScriptURL(source);
document.head.appendChild(tag);
gtag("js",new Date());window.__airlockNativeCommands.initialize++;
gtag("config",${js(owned.conversion_id)});window.__airlockNativeCommands.configure++;
gtag("event","conversion",${js({ send_to: `${owned.conversion_id}/${owned.conversion_label}`,
    value: 1, currency: "USD", transaction_id: owned.transaction_id })});
window.__airlockNativeCommands.conversion++;
`;
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; `
    + "require-trusted-types-for 'script'; connect-src https:; img-src https: data:; "
    + "frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return { bytes: Buffer.from(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">`
    + `<title>Isolated Google reference</title><script nonce="${nonce}">${script}</script>`),
  headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" },
    { name: "Content-Security-Policy", value: csp }] };
}

export function createGoogleBrowserObservation({ cdp, profile, observer, logical, check, wait, stop,
  document, source }) {
  const policy = createNativeStockPolicy(profile), network = [], pending = new Set(), waiters = new Set();
  const fulfilled = new Set();
  let stopped = false, fetchCount = 0;
  const halt = reason => {
    if (stopped) return;
    stopped = true;
    observer.stop(reason);
    stop(reason);
    for (const notify of waiters) notify();
  };
  const active = () => {
    if (stopped) throw Error("google_observation_stopped");
    check();
    if (observer.snapshot().stopped) throw Error(observer.snapshot().reason);
  };
  const retain = value => {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (!observer.reserveObservation(bytes)) throw Error("google_observation_retention_limit");
    return value;
  };
  const track = work => {
    pending.add(work);
    work.catch(error => halt(error.message)).finally(() => pending.delete(work));
  };
  const onNetwork = event => {
    try {
      active();
      if (network.length >= LIMITS.observations || typeof event.requestId !== "string"
        || typeof event.request?.url !== "string" || Buffer.byteLength(event.request.url) > LIMITS.url_bytes
        || typeof event.request.method !== "string" || typeof event.type !== "string")
        throw Error("google_observation_invalid");
      network.push(retain({ network_id: event.requestId, url: event.request.url, method: event.request.method,
        resource_type: event.type, redirect_url: event.redirectResponse?.url ?? null,
        redirect_status: event.redirectResponse?.status ?? null }));
      for (const notify of waiters) notify();
    } catch (error) { halt(error.message); }
  };
  const onPaused = event => track((async () => {
    try {
      active();
      if (++fetchCount > LIMITS.observations || typeof event.requestId !== "string"
        || typeof event.networkId !== "string" || typeof event.request?.url !== "string"
        || Buffer.byteLength(event.request.url) > LIMITS.url_bytes || typeof event.request.method !== "string")
        throw Error("google_observation_invalid");
      if (event.request.hasPostData || event.request.postDataEntries?.length
        || typeof event.request.postData === "string" && event.request.postData.length)
        throw Error("unqualified_request_body");
      const headers = data(event.request.headers);
      if (!headers || typeof headers !== "object" || Array.isArray(headers)
        || Object.keys(headers).length > 128 || Buffer.byteLength(JSON.stringify(headers)) > LIMITS.request_bytes)
        throw Error("google_request_header_limit");
      retain({ fetch_id: event.requestId, network_id: event.networkId, resource_type: event.resourceType,
        request: { url: event.request.url, method: event.request.method, headers } });
      const candidates = () => network.filter(row => row.network_id === event.networkId
        && row.url === event.request.url && row.method === event.request.method);
      let matches = candidates();
      if (!matches.length) {
        let notify;
        const observed = new Promise(resolve => {
          notify = () => { if (stopped || candidates().length) resolve(); };
        });
        waiters.add(notify);
        try { await wait(observed, 1000); } finally { waiters.delete(notify); }
        active();
        matches = candidates();
      }
      if (matches.length !== 1 || matches[0].resource_type !== event.resourceType)
        throw Error("missing_or_ambiguous_network_observation");
      const item = matches[0];
      const decision = policy.inspect({ url: item.url, method: item.method, resource_type: item.resource_type,
        headers, body: Buffer.alloc(0) });
      if (decision.disposition !== "eligible" && !(decision.reason === "owned_primary_not_admitted"
        && observer.snapshot().policy?.primary > 0)) throw Error(decision.reason);
      if (decision.kind === "fixture" || decision.kind === "local_source") {
        if (fulfilled.has(decision.kind)) throw Error("repeated_google_local_source");
        const body = decision.kind === "fixture" ? document?.bytes : source;
        if (!Buffer.isBuffer(body)) throw Error("google_local_source_unavailable");
        const encoded = body.toString("base64");
        if (!observer.reserveObservation(body.length + Buffer.byteLength(encoded)))
          throw Error("google_observation_retention_limit");
        active();
        fulfilled.add(decision.kind);
        await wait(cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
          responseHeaders: decision.kind === "fixture" ? document.headers
            : [{ name: "Content-Type", value: "application/javascript; charset=utf-8" }],
          body: encoded }));
        return;
      }
      const row = { network_id: item.network_id, fetch_id: event.requestId, url: item.url,
        method: item.method, resource_type: item.resource_type };
      const originals = observer.originals();
      if (originals.requests.some(request => ["awaiting", "streaming"].includes(request.response_state)))
        throw Error("google_prior_response_incomplete");
      if (item.redirect_url) {
        const parents = originals.requests.filter(request => request.logical_network_id === item.network_id
          && request.url === item.redirect_url && originals.responses.some(response =>
            response.ordinal === request.ordinal && response.state === "complete"
            && response.status === item.redirect_status && response.redirect_url === item.url));
        if (parents.length !== 1) throw Error("missing_actual_redirect_parent");
        row.redirect_from = parents[0].ordinal;
      } else {
        const parents = [];
        for (const response of originals.responses) {
          if (response.state !== "complete" || !response.headers.some(([name, value]) =>
            name.toLowerCase() === "content-type" && value.toLowerCase().split(";")[0].trim() === "application/json"))
            continue;
          if (!observer.reserveObservation(response.decoded_body_bytes)) throw Error("google_observation_retention_limit");
          let value;
          try { value = parseGoogleStockResponse(Buffer.concat(response.body, response.decoded_body_bytes)); }
          catch { throw Error("google_response_parent_invalid"); }
          let count = 0, found = false;
          const visit = (item, depth) => {
            if (++count > 5000 || depth > 16) throw Error("google_response_parent_invalid");
            if (item === row.url) found = true;
            else if (item && typeof item === "object") Object.values(item).forEach(child => visit(child, depth + 1));
          };
          visit(value, 0);
          if (found) parents.push(response.ordinal);
        }
        if (parents.length > 1) throw Error("ambiguous_response_parent");
        if (parents.length === 1) row.response_parent = parents[0];
      }
      const prior = logical.findIndex(value => value.network_id === row.network_id);
      if (prior >= 0) logical.splice(prior, 1);
      logical.push(retain(row));
      active();
      await wait(cdp.send("Fetch.continueRequest", { requestId: event.requestId }));
    } catch (error) {
      halt(error.message);
      await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }).catch(() => {});
    }
  })());
  return Object.freeze({
    async start() {
      active();
      cdp.on("Network.requestWillBeSent", onNetwork);
      cdp.on("Fetch.requestPaused", onPaused);
      await wait(cdp.send("Network.enable"));
      active();
      await wait(cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }));
      active();
    },
    async settle() { await Promise.allSettled([...pending]); },
    stop(reason) {
      halt(reason);
      cdp.off("Network.requestWillBeSent", onNetwork);
      cdp.off("Fetch.requestPaused", onPaused);
    },
  });
}

async function preserveGoogleNativeOriginals({ output, observer, transport, cleanup, errors, observation, deadline }) {
  if (Date.now() >= deadline) throw Error("google_native_output_deadline");
  const { writeGoogleOriginals } = await import("./inspected-google-originals.mjs");
  const originals = observer.originals(), capture = writeGoogleOriginals(output, originals);
  const report = { outcome: "inconclusive", native_execution_qualified: false,
    producer_completion: "not_observed", descendant_cleanup: "unknown_manual",
    complete_descendant_cleanup: false, consent_override: "none", native_consent_state: "unobserved",
    observation, observer: observer.snapshot(),
    transport: transport?.snapshot() ?? null, cleanup, errors,
    originals: { requests: originals.requests, responses: capture.responses, wire: capture.wire ?? [] } };
  const bytes = Buffer.from(JSON.stringify(report) + "\n");
  if (capture.bytes + bytes.length > LIMITS.aggregate_bytes) throw Error("google_native_output_limit");
  const fd = openSync(join(output, "result.json"), "wx", 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(output, "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
  if (Date.now() >= deadline) throw Error("google_native_output_deadline");
}

async function runNativeGoogleEngine(state) {
  assertNativeGoogleAdmission(state);
  const binding = state.binding;
  const ticket = Object.freeze({});
  nativeReservationAdmissions.set(ticket, state);
  const reservation = await reserveNativeAdditionalGoogleSlot(ticket, binding);
  let transport = null, observer = null, bridge = null, stopping = false, cleanupMode = false;
  let timer = null, keyPath = null, certificatePath = null, outputCreated = false;
  let browserServer = null, browser = null, context = null, page = null, launchAttempted = false;
  const cleanup = {}, errors = [];
  let operationError, cleanupError = null, observation = null;
  const check = () => {
    if (stopping) throw Error("google_native_case_stopped");
    assertNativeGoogleAdmission(state);
  };
  const wait = async (promise, maximum = 5000) => {
    if (!cleanupMode) check();
    const remaining = Math.min(maximum, binding.window.expires_at_ms - Date.now());
    if (remaining <= 0) throw Error("case_window_inactive");
    let timeout;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error("case_window_inactive")), remaining);
      })]);
    } finally { clearTimeout(timeout); }
  };
  try {
    mkdirSync(state.output, { mode: 0o700 });
    outputCreated = true;
    keyPath = join(state.output, "google-inspector-key.pem");
    certificatePath = join(state.output, "google-inspector-certificate.pem");
    const remaining = Math.min(5000, binding.window.expires_at_ms - Date.now());
    if (remaining <= 0) throw Error("case_window_inactive");
    const oldMask = process.umask(0o077);
    try {
      await execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", keyPath, "-out", certificatePath, "-days", "1", "-subj", "/CN=www.googleadservices.com",
        "-addext", "subjectAltName=DNS:www.googleadservices.com,DNS:www.google.com,DNS:googleads.g.doubleclick.net,DNS:ad.doubleclick.net"],
      { timeout: remaining, maxBuffer: 8192 });
    } finally { process.umask(oldMask); }
    check();
    chmodSync(keyPath, 0o600); chmodSync(certificatePath, 0o600);
    const inspector = { key: readPrivateOriginal(keyPath, { uid: process.getuid(), maximum: 16384 }).bytes,
      cert: readPrivateOriginal(certificatePath, { uid: process.getuid(), maximum: 16384 }).bytes };
    const { createInspectedHttpWire } = await import("./inspected-http-wire.mjs");
    const logical = [];
    observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile: state.profile,
      resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
    if (!observer.reserveObservation(state.source.length * 2)) throw Error("google_observation_retention_limit");
    const token = Object.freeze({});
    nativeEngines.set(token, { additionalPlan: state.additionalPlan, assertAdmission: check,
      config: { inspector, observer, wait, check, beforeConnect: check,
        logicalAuthority: authority => !stopping && logical.some(row => {
          try { return new URL(row.url).host + ":443" === authority; } catch { return false; }
        }) } });
    const lease = await consumeNativeAdditionalGoogle(state.additionalPlan, reservation, token);
    timer = setTimeout(() => { stopping = true; observer.stop("case_window_inactive"); transport?.closeAdmission(); },
      Math.max(1, binding.observation_end_ms - Date.now()));
    transport = await startNativeGoogleInspectedTransport(lease);
    check();
    const document = googleNativeDocument(state.profile);
    const spki = createHash("sha256").update(new X509Certificate(inspector.cert).publicKey
      .export({ type: "spki", format: "der" })).digest("base64");
    const { chromium } = await import("playwright");
    check();
    const socketDir = realpathSync(tmpdir());
    launchAttempted = true;
    browserServer = await wait(chromium.launchServer({
      executablePath: fileURLToPath(new URL("./inspected-google-loopback-chrome", import.meta.url)),
      host: "127.0.0.1", headless: true, timeout: Math.max(1, Math.min(10000, binding.observation_end_ms - Date.now())),
      proxy: { server: "http://127.0.0.1:" + transport.port },
      env: { ...process.env, TMPDIR: socketDir, AIRLOCK_GOOGLE_SOCKET_DIR: socketDir,
        AIRLOCK_GOOGLE_BROKER_PORT: String(transport.port) },
      args: ["--disable-background-networking", "--dns-prefetch-disable",
        `--ignore-certificate-errors-spki-list=${spki}`],
    }), 10000);
    if (new URL(browserServer.wsEndpoint()).hostname !== "127.0.0.1") throw Error("invalid_driver_peer");
    browser = await wait(chromium.connect(browserServer.wsEndpoint()));
    if (browser.version() !== binding.cohort.chrome) throw Error("google_cohort_mismatch");
    transport.attachOwnedBrowser(await wait(browser.newBrowserCDPSession()));
    context = await wait(browser.newContext({ serviceWorkers: "block" }));
    if ((await wait(context.cookies())).length) throw Error("nonempty_native_storage");
    page = await wait(context.newPage());
    const cdp = await wait(context.newCDPSession(page));
    const stopCase = reason => {
      stopping = true;
      observer.stop(reason);
      transport.closeAdmission();
    };
    browserServer.process().once("exit", () => { if (!cleanupMode) stopCase("unexpected_browser_exit"); });
    browser.once("disconnected", () => { if (!cleanupMode) stopCase("unexpected_browser_disconnect"); });
    context.once("close", () => { if (!cleanupMode) stopCase("unexpected_context_close"); });
    page.once("close", () => { if (!cleanupMode) stopCase("unexpected_page_close"); });
    page.once("crash", () => stopCase("unexpected_page_crash"));
    page.on("pageerror", () => stopCase("native_script_error"));
    page.on("websocket", () => stopCase("unsupported_websocket"));
    page.on("worker", () => stopCase("unsupported_worker"));
    page.on("frameattached", () => stopCase("unsupported_frame"));
    context.on("serviceworker", () => stopCase("unsupported_service_worker"));
    context.on("page", extra => { if (extra !== page) stopCase("unsupported_target"); });
    bridge = createGoogleBrowserObservation({ cdp, profile: state.profile, observer, logical,
      check, wait, stop: stopCase, document, source: state.source });
    await bridge.start();
    await wait(page.goto(state.profile.document_url, { waitUntil: "load", timeout: 4000 }));
    check();
    const commands = await wait(page.evaluate(() => window.__airlockNativeCommands ?? null));
    if (!equal(commands, { initialize: 1, configure: 1, conversion: 1, consent: "native-default" }))
      throw Error("google_fixture_commands_incomplete");
    const pause = Math.max(0, binding.observation_end_ms - Date.now() - 1000);
    if (pause) await wait(new Promise(resolve => setTimeout(resolve, pause)), pause + 100);
    check();
    const storage = await wait(page.evaluate(async () => ({
      local: { ...localStorage }, session: { ...sessionStorage }, indexed_db: await indexedDB.databases(),
      cache_names: await caches.keys(), service_workers: (await navigator.serviceWorker.getRegistrations()).map(row => row.scope),
    })));
    const cookies = await wait(context.cookies());
    observation = { at_ms: Date.now(), fixture_commands: commands, storage, cookies,
      fixture_commands_are_independent_proof: false };
    if (!observer.reserveObservation(Buffer.byteLength(JSON.stringify(observation))))
      throw Error("google_observation_retention_limit");
    if (storage.indexed_db.length || storage.cache_names.length || storage.service_workers.length)
      throw Error("unsupported_persistent_storage");
    check();
    await wait(new Promise(resolve => setTimeout(resolve, Math.max(1, binding.observation_end_ms - Date.now()))),
      Math.max(1, binding.observation_end_ms - Date.now()));
    throw Error("google_native_runtime_unqualified");
  } catch (error) {
    operationError = error;
  } finally {
    stopping = true;
    cleanupMode = true;
    clearTimeout(timer);
    bridge?.stop("google_native_case_stopped");
    if (transport) transport.closeAdmission();
    try {
      const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
      await closeLocalGoogleBrowser({ context, browser, browserServer, launchAttempted, transport,
        settle: wait, cleanup, errors });
      if (bridge) await wait(bridge.settle());
      if (errors.length) cleanupError = Error("google_native_cleanup_incomplete");
    } catch (error) { cleanupError = error; }
    for (const path of [keyPath, certificatePath]) {
      if (!path) continue;
      try { unlinkSync(path); }
      catch (error) { if (error.code !== "ENOENT") cleanupError ??= error; }
    }
    if (outputCreated && observer) {
      try {
        await preserveGoogleNativeOriginals({ output: state.output, observer, transport, cleanup, errors, observation,
          deadline: binding.window.expires_at_ms });
      } catch (error) { cleanupError ??= error; }
    }
  }
  if (cleanupError) throw Error("google_native_cleanup_failed", { cause: cleanupError });
  if (operationError) throw operationError;
}

export async function runNativeGoogleStock(plan) {
  if (!plan || isProxy(plan) || !plans.has(plan)) throw Error("invalid_google_prepared_case");
  const state = plans.get(plan);
  assertNativeGoogleAdmission(state);
  return runNativeGoogleEngine(state);
}
