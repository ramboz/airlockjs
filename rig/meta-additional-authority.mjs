import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { readMetaPrivate } from "./native-stock-meta.mjs";
import { LIMITS } from "./native-stock-policy.mjs";
import { data, equal, json, record } from "./inspected-meta-record.mjs";

const fail = category => { throw new Error(category); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const ADDITIONAL_VARIANT = "additional-meta-2026-10-21";
export const ADDITIONAL_ID = "meta-stock-additional-2026-10-21";
export const SYNTHETIC_ADDITIONAL_ID = "synthetic-inspected-meta-additional";
export const OWNER_MESSAGE_AT = "2026-10-21T18:33:04.581Z";
// Content commitments only: no private paths, account selectors or SDK bytes.
const DECISION_SHA = "d23d7877ada0b2a6d9b353f1b70d4454bf7ea5d86953c3003fc6e60720886c19";
const BASELINE_SHA = "d1d44fe4e900cf48873766b84ffa86202e31a1e151f77faa63ab0f374b7a9b8b";
export const ADDITIONAL_LIMITS = Object.freeze({
  physical_vendor_https_attempts: 8, observations: 64, url_bytes: 2048,
  request_headers_and_body_bytes: 65536, response_bytes: 2097152,
  retained_aggregate_bytes: 8388608, absolute_duration_ms: 60000,
});
export const ADDITIONAL_COMMANDS = Object.freeze({ init: 1, pageview: 1, consent: "native-default" });
export const ADDITIONAL_SCOPE = Object.freeze({
  case_name: "meta-stock", pageview_commands: 1, physical_vendor_http_attempt_ceiling: 8,
  absolute_seconds: 60, uses_original_existing_meta_stock_slot: false,
  uses_one_additional_meta_stock_slot: true, additional_events_or_retry_grants: false,
  temporary_inspector_trust_in_isolated_browser: true,
  upstream_real_collector_certificate_validation_required: true, inspected_network_not_chrome_tls: true,
});
const ORIGINAL_LIMITS = {
  google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
  google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
  google_vendor_https_requests_per_case: 20, meta_vendor_https_requests_per_case: 8,
  observed_requests_per_case: 64, absolute_seconds_per_case: 60, url_bytes: 2048,
  request_headers_and_body_bytes: 65536, response_bytes: 2097152, retained_aggregate_bytes: 8388608,
};
const ORIGINAL_METADATA = [
  "authority_id_purpose", "date", "owner_selected_exactly", "approved_question", "requirements", "excluded",
  "adobe_handoff", "not_an_executable_live_case_manifest", "guard_currently_live_qualified",
  "fresh_setup_currently_verified", "owner_setup_facts_received", "owner_setup_receipt",
  "fresh_case_specific_live_preflight_still_required", "owner_response_limit_clarification",
  "owner_reference_header_timing_exception", "candidate_or_production_rules_relaxed",
  "native_or_chamber_case_started_by_this_approval_record",
];
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fileIdentity = path => {
  const s = lstatSync(path, { bigint: true });
  return [s.dev, s.ino, s.nlink, s.size, s.mode, s.mtimeNs, s.ctimeNs].join(":");
};
export function additionalSnapshotReader() {
  const snapshots = [];
  return {
    read(handle) {
      record(handle, ["path", "sha256"]);
      const parent = lstatSync(dirname(handle.path));
      if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()
        || (parent.mode & 0o7777) !== 0o700) fail("additional_private_parent_invalid");
      const identity = fileIdentity(handle.path), bytes = readMetaPrivate(handle.path, 65536);
      if (identity !== fileIdentity(handle.path) || hash(bytes) !== handle.sha256) fail("stale_case_handle");
      snapshots.push({ ...handle, identity });
      return bytes;
    },
    unchanged() {
      for (const item of snapshots)
        if (fileIdentity(item.path) !== item.identity || hash(readMetaPrivate(item.path, 65536)) !== item.sha256)
          fail("case_source_changed");
    },
  };
}
export function additionalAuthority(value) {
  return value.authority_id === ADDITIONAL_ID || value.authority_id === SYNTHETIC_ADDITIONAL_ID
    || typeof value.authority_id === "string" && /^(meta-stock-additional-|synthetic-inspected-meta-additional)/.test(value.authority_id)
    || value.authority_variant === ADDITIONAL_VARIANT || Object.hasOwn(value, "lineage_baseline");
}
export function additionalLocator(path) {
  const s = lstatSync(path, { bigint: true });
  return { path, sha256: hash(readMetaPrivate(path, 65536)), dev: String(s.dev), ino: String(s.ino) };
}
function locatorRead(locator, read, root) {
  record(locator, ["path", "sha256", "dev", "ino"]);
  if (typeof locator.path !== "string" || !isAbsolute(locator.path) || resolve(locator.path) !== locator.path
    || !digest(locator.sha256) || ![locator.dev, locator.ino].every(x => typeof x === "string" && /^(0|[1-9]\d*)$/.test(x))
    || root && !locator.path.startsWith(root + "/")) fail("additional_locator_invalid");
  const bytes = read({ path: locator.path, sha256: locator.sha256 });
  const stat = lstatSync(locator.path, { bigint: true });
  if (String(stat.dev) !== locator.dev || String(stat.ino) !== locator.ino) fail("additional_lineage_location_mismatch");
  return json(bytes);
}
function validWindow(window) {
  record(window, ["not_before_ms", "expires_at_ms"]);
  return Number.isSafeInteger(window.not_before_ms) && Number.isSafeInteger(window.expires_at_ms)
    && window.not_before_ms >= 0 && window.expires_at_ms > window.not_before_ms
    && window.expires_at_ms - window.not_before_ms <= 60000;
}
/** No effects or authority from this reader. Both the journal and engine must
 * validate the SAME closed content, self locator, lineage and case permission. */
export function validateAdditionalAuthority({ authority, binding, local, read, root = null }) {
  record(binding, ["inputs", "authority", "inspection_permission", "source_pins", "cohort", "window",
    "limits", "commands", "additional", "scheduling", "case_permission"], ["observation_end_ms"]);
  for (const key of ["inputs", "authority", "inspection_permission", "case_permission"])
    record(binding[key], ["path", "sha256"]);
  if (!equal(binding.commands, ADDITIONAL_COMMANDS) || !equal(binding.limits, LIMITS)
    || !validWindow(binding.window)) fail("additional_binding_envelope_invalid");
  record(authority, ["schema_version", "kind", "status", "authority_id", "authority_variant",
    "self_locator", "lineage_baseline", "cases", "limits", "commands"], local ? ["synthetic_only"] : []);
  if (authority.schema_version !== 1 || authority.kind !== "owner_conversation_authority"
    || authority.status !== "approved_conditional" || authority.authority_variant !== ADDITIONAL_VARIANT
    || authority.authority_id !== (local ? SYNTHETIC_ADDITIONAL_ID : ADDITIONAL_ID)
    || local && authority.synthetic_only !== true
    || !equal(authority.cases, { "meta-stock": { reserved: false, admitted: false, spent: false } })
    || !equal(authority.limits, ADDITIONAL_LIMITS) || !equal(authority.commands, ADDITIONAL_COMMANDS))
    fail("additional_authority_invalid");
  const extra = record(binding.additional, ["variant", "lineage_baseline"]);
  if (extra.variant !== ADDITIONAL_VARIANT || !equal(extra.lineage_baseline, authority.lineage_baseline))
    fail("additional_binding_invalid");
  const baseline = locatorRead(extra.lineage_baseline, read, root);
  record(baseline, ["schema", "observed_at", "authority", "spent_reservation", "owner_decision",
    "new_authority_created", "new_slot_reserved", "sdk_started", "original_mutated"]);
  if (baseline.schema !== "airlock.additional-meta-original-lineage-baseline.v1"
    || typeof baseline.observed_at !== "string" || !Number.isFinite(Date.parse(baseline.observed_at))
    || baseline.new_authority_created !== false || baseline.new_slot_reserved !== false
    || baseline.sdk_started !== false || baseline.original_mutated !== false
    || !local && extra.lineage_baseline.sha256 !== BASELINE_SHA) fail("additional_lineage_invalid");
  const original = locatorRead(baseline.authority, read, root);
  record(original, ["schema_version", "kind", "status", "authority_id", "cases", "limits"],
    local ? ["synthetic_only"] : ORIGINAL_METADATA);
  const originalID = local ? "synthetic-inspected-meta-parent" : "google-meta-paired-2026-10-19";
  if (original.schema_version !== 1 || original.kind !== "owner_conversation_authority"
    || original.status !== "approved_conditional" || original.authority_id !== originalID
    || !equal(original.limits, ORIGINAL_LIMITS) || local && original.synthetic_only !== true
    || !equal(original.cases, Object.fromEntries(["google-stock", "google-chamber", "meta-stock", "meta-chamber"]
      .map(name => [name, { reserved: false, admitted: false, spent: false }])))) fail("additional_original_invalid");
  const spent = locatorRead(baseline.spent_reservation, read, root);
  record(spent, ["schema_version", "state", "case_name", "authority_id", "authority_sha256",
    "source_sha256", "input_sha256", "reserved_at_ms", "window", "execution_prerequisites_proved_by_reservation"]);
  // This semantic relation is required even if ALL outer digests are refreshed.
  if (spent.schema_version !== 1 || spent.state !== "spent" || spent.case_name !== "meta-stock"
    || spent.authority_id !== originalID || spent.authority_sha256 !== baseline.authority.sha256
    || ![spent.source_sha256, spent.input_sha256].every(digest) || !validWindow(spent.window)
    || !Number.isSafeInteger(spent.reserved_at_ms) || spent.reserved_at_ms < spent.window.not_before_ms
    || spent.reserved_at_ms >= spent.window.expires_at_ms
    || spent.execution_prerequisites_proved_by_reservation !== false
    || baseline.spent_reservation.path !== join(dirname(baseline.authority.path),
      "native-stock-slots-" + originalID, "meta-stock.reserved")) fail("additional_spent_parent_invalid");
  const decision = locatorRead(baseline.owner_decision, read, root);
  record(decision, ["schema", "owner_message_at", "pending_question", "exact_owner_answer", "status",
    "additional_stock_cases", "commands", "limits", "transport", "delegated", "original_authority_and_spent_slot",
    "remaining_required", "not_granted", "new_slot_reserved", "sdk_started_by_recording", "executable_manifest_created"]);
  if (decision.schema !== (local ? "airlock.synthetic-additional-meta-decision.v1" : "airlock.owner-additional-meta-case-decision.v1")
    || decision.owner_message_at !== OWNER_MESSAGE_AT || decision.status !== "approved_additional_bounded_case_scope"
    || decision.additional_stock_cases !== 1 || !equal(decision.commands, ADDITIONAL_COMMANDS)
    || !equal(decision.limits, ADDITIONAL_LIMITS) || decision.transport !== "inspected-network"
    || decision.new_slot_reserved !== false || decision.sdk_started_by_recording !== false
    || decision.executable_manifest_created !== false
    || !local && baseline.owner_decision.sha256 !== DECISION_SHA) fail("additional_decision_invalid");
  const self = record(authority.self_locator, ["path", "dev", "ino"]);
  const stat = lstatSync(binding.authority.path, { bigint: true });
  if (self.path !== binding.authority.path || self.dev !== String(stat.dev) || self.ino !== String(stat.ino)
    || self.path !== join(dirname(baseline.authority.path), authority.authority_id + ".json"))
    fail("additional_authority_location_mismatch");
  const scheduling = record(binding.scheduling, ["selected_by", "delegated", "owner_message_at", "selected_at_ms"]);
  if (scheduling.selected_by !== "operator" || scheduling.delegated !== true || scheduling.owner_message_at !== OWNER_MESSAGE_AT
    || !Number.isSafeInteger(scheduling.selected_at_ms) || scheduling.selected_at_ms < 0
    || scheduling.selected_at_ms > binding.window.not_before_ms
    || !local && scheduling.selected_at_ms < Date.parse(OWNER_MESSAGE_AT)) fail("additional_scheduling_invalid");
  return { baseline, canonical_slot_path: join(dirname(self.path),
    "native-stock-slots-" + authority.authority_id, "meta-stock.reserved") };
}
export function validateAdditionalInspection(permission, binding, local) {
  record(permission, ["schema_version", "kind", "status", "scope", "owner_decision", "lineage_baseline",
    "original_authority_mutated", "original_slots_reserved_or_spent", "additional_slots_reserved_or_spent"]);
  if (permission.schema_version !== 1 || permission.kind !== "inspected-meta-additional-permission"
    || permission.status !== (local ? "synthetic_local_only" : "approved_additional_reference_design")
    || !equal(permission.scope, ADDITIONAL_SCOPE)
    || permission.original_authority_mutated !== false || permission.original_slots_reserved_or_spent !== 1
    || permission.additional_slots_reserved_or_spent !== 0
    || !equal(permission.lineage_baseline, binding.additional.lineage_baseline))
    fail("additional_inspection_permission_invalid");
}
export function validateAdditionalLocation(permission, binding, authority, local, baseline) {
  record(permission, ["schema_version", "kind", "status", "case_name", "transport", "native_execution_permitted",
    "authority_locator", "canonical_slot_path", "permission_source_sha256", "valid_until_ms"]);
  const expected = additionalLocator(binding.authority.path);
  if (!equal(permission.authority_locator, expected)) fail("additional_authority_location_mismatch");
  if (binding.case_permission.path !== join(dirname(binding.authority.path), "meta-additional-case-permission.json"))
    fail("additional_case_permission_location_mismatch");
  const { case_permission: _permission, ...context } = data(binding);
  if (permission.schema_version !== 1 || permission.kind !== "inspected-meta-additional-case-location"
    || permission.status !== (local ? "synthetic_local_binding" : "approved_case_binding")
    || permission.case_name !== "meta-stock" || permission.transport !== "inspected-network"
    || permission.native_execution_permitted !== !local || permission.valid_until_ms !== binding.window.expires_at_ms
    || permission.permission_source_sha256 !== hash(JSON.stringify(data(context)))
    || permission.canonical_slot_path !== join(dirname(baseline.authority.path),
      "native-stock-slots-" + authority.authority_id, "meta-stock.reserved")) fail("additional_case_permission_invalid");
}
