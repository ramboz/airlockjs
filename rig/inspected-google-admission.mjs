import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { readMetaPrivate } from "./native-stock-meta.mjs";
import { readPrivateOriginal } from "./private-original-file.mjs";
import { createNativeStockPolicy, LIMITS } from "./native-stock-policy.mjs";

const OFFICIAL_PIN = "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50";
const digest = value => createHash("sha256").update(JSON.stringify(data(value))).digest("hex");
const LOADED_SOURCE_PINS = inspectedMetaSourcePins();
const plans = new WeakMap();
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
export async function runNativeGoogleStock(plan) {
  if (!plan || !plans.has(plan)) throw Error("invalid_google_prepared_case");
  throw Error("google_native_admission_closed");
}
