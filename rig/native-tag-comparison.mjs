import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual as equal } from "node:util";
import { evaluateFieldRule, fieldRuleShape, protectedTarget } from "./field-rules.mjs";
import { evidenceSession, keys as strictKeys, parseEvidence } from "./attempt-evidence-io.mjs";

// Offline only. This module deliberately imports no browser, SDK or network API.
const LIMITS = Object.freeze({
  run_ms: 10000, manifest_bytes: 65536, resource_bytes: 2097152,
  depth: 24, nodes: 100000, requests: 256, rules: 32, selectors: 32, differences: 128,
});
const PINS = ["profile", "node_version", "browser_version", "os_release", "macos_version",
  "runtime_sha256", "configuration_sha256", "network_policy_sha256"];
const CONTROLS = ["drop", "route", "value", "consent", "identity", "duplicate",
  "response-truncation", "edge-loss", "empty-reference", "equal-redaction", "stale-pin"];
const SENTINELS = ["[redacted]", "<redacted>", "redacted", "***", "[removed]", "[masked]"];
const REPORT_KEYS = ["schema_version", "run_id", "evidence_layer", "profile", "mode",
  "overall", "exit_code", "errors", "node_version", "browser_version", "platform", "os_release",
  "macos_version", "runtime_sha256", "configuration_sha256", "provenance", "capture_complete",
  "cases", "expected_positive_cases", "counts", "controls", "guard", "limits", "claims",
  "not_proved", "control", "observation_window", "cleanup", "run_elapsed_ms"];
const NATIVE_REQUEST = ["ordinal", "case", "observed_at", "url", "query_pairs", "method",
  "resource_type", "headers", "headers_state", "body_base64", "body_state", "category",
  "network_id", "aborted", "locally_fulfilled", "local_response", "actual_vendor_response",
  "source_relationship", "native_relationship"];
const LOCAL_REQUEST = ["ordinal", "case", "url", "query_pairs", "method", "resource_type",
  "category", "headers", "headers_state", "cookies", "cookies_state", "body_base64", "body_state",
  "response", "redirect_to", "fanout_to"];
const CASE_KEYS = ["name", "started_at", "stopped_at", "observation_ms", "attempts",
  "runtime_fulfilled", "configuration_fulfilled", "dependency_closed", "consent",
  "qualified_positive_run_id", "qualified_positive_reference", "auxiliary_attempts", "total_native_attempts"];
const PRIVATE_CASE_KEYS = [...CASE_KEYS, "document_url", "fixture_sha256", "fixture_state",
  "native_state", "synthetic_inputs", "violations", "unsupported_surfaces", "page_errors", "navigation_completed"];
const PROVENANCE_KEYS = ["source_capture_sha256", "input_manifest_sha256", "fixture",
  "source_acquisition_sha256", "auxiliary_projection_sha256", "source_cohort", "bootstrap",
  "native_resources", "source_response_statuses", "consent", "browser_evidence", "runner_sha256",
  "launcher_sha256", "network_policy_sha256"];
const CLAIMS = Object.freeze({
  vendor_dispatch_verified: false, vendor_receipt_verified: false,
  chamber_compatibility_verified: false, matching_verified: false,
  reporting_verified: false, attribution_verified: false, full_support_verified: false,
});
const EXCLUSIONS = Object.freeze([
  { name: "observer_run_identity", reason: "Validated source linkage, not wire content." },
  { name: "observer_times", reason: "Capture clock metadata, not wire content." },
  { name: "observer_network_and_process_ids", reason: "Recorder-local handles, not wire content." },
  { name: "generated_fixture_metadata", reason: "Generated fixture size/digest, not vendor response bytes." },
]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const plain = v => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;
const text = v => typeof v === "string" && v.length > 0 && Buffer.byteLength(v) <= 4096;
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const freeze = v => {
  if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
class ComparisonError extends Error {
  constructor(category, overall = "invalid_input") {
    super(category); this.category = category; this.overall = overall;
  }
}
const reject = (category, overall) => { throw new ComparisonError(category, overall); };
function exactKeys(v, keys) {
  if (!plain(v) || !equal(Object.keys(v).sort(), [...keys].sort())) reject("invalid_manifest");
}
function known(v, keys, issues, required = []) {
  if (!plain(v)) reject("missing_evidence", "inconclusive");
  if (required.some(k => !Object.hasOwn(v, k))) reject("missing_evidence", "inconclusive");
  const unknown = Object.keys(v).filter(k => !keys.includes(k));
  if (unknown.length) {
    issues.add("unknown_fields");
    issues.unknownFields = (issues.unknownFields ?? 0) + unknown.length;
  }
}
function boundedTree(value, check) {
  let nodes = 0;
  function visit(v, depth) {
    check();
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) reject("structure_limit", "inconclusive");
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k)) reject("unsafe_object_key");
        visit(x, depth + 1);
      }
    }
  }
  visit(value, 0);
}
function sentinel(value) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return SENTINELS.some(s => lower === s || (s !== "redacted" && lower.includes(s)));
  }
  return value && typeof value === "object" && Object.values(value).some(sentinel);
}
function state(result, overall, errors) {
  result.overall = overall;
  result.exit_code = { qualified: 0, nonconformant: 1, inconclusive: 2, invalid_input: 3 }[overall];
  result.errors = [...new Set(errors)];
}
function publicReport() {
  return {
    schema_version: 1, run_id: randomUUID(), evidence_layer: null, candidate_kind: null,
    overall: "inconclusive", exit_code: 2, errors: [], limits: LIMITS,
    counts: { reference_requests: 0, candidate_requests: 0, equal_requests: 0,
      differences: 0, preserved_relationships: 0, presence_only: 0, unknown_fields: 0,
      missing_evidence: 0, forbidden_dispatch: 0 },
    differences: [], exclusions: EXCLUSIONS.map(e => ({ ...e, count: 0 })),
    source_bytes: null, evidence: null, control: null, claims: CLAIMS,
    not_proved: ["full_vendor_replacement", "actual_chamber_execution", "vendor_dispatch_and_receipt",
      "cookie_acceptance", "matching_reporting_attribution", "browser_host_effects",
      "cross_run_native_normalization"],
  };
}
function clock() {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.run_ms);
  const check = () => {
    if (controller.signal.aborted || Date.now() - started >= LIMITS.run_ms)
      reject("run_deadline_exceeded", "inconclusive");
  };
  return {
    check, signal: controller.signal,
    async wait(work) {
      check();
      let timeout;
      try {
        const result = await Promise.race([work(), new Promise((_resolve, fail) => {
          timeout = setTimeout(() => {
            controller.abort();
            fail(new ComparisonError("run_deadline_exceeded", "inconclusive"));
          }, Math.max(1, LIMITS.run_ms - (Date.now() - started)));
        })]);
        check();
        return result;
      } finally { clearTimeout(timeout); }
    },
    finish() { clearTimeout(timer); },
  };
}
// Second caller: inline mirror of the reference runner's no-follow/nonblocking
// bounded regular-file reader. No FIFO, device or final symlink can block it.
async function boundedRead(path, maximum, category, budget) {
  let handle;
  try {
    budget.check();
    handle = await budget.wait(() => open(path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK));
    const info = await budget.wait(() => handle.stat());
    if (!info.isFile()) reject(`${category}_unavailable`, "inconclusive");
    if (info.size > maximum) reject(`${category}_byte_limit`, "inconclusive");
    const bytes = Buffer.alloc(maximum + 1);
    let offset = 0;
    while (offset <= maximum) {
      const { bytesRead } = await budget.wait(() => handle.read(bytes, offset, maximum + 1 - offset, offset));
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > maximum) reject(`${category}_byte_limit`, "inconclusive");
    return bytes.subarray(0, offset);
  } catch (error) {
    if (error instanceof ComparisonError) throw error;
    reject(`${category}_unavailable`, "inconclusive");
  } finally {
    if (handle) await handle.close();
  }
}
function parse(bytes, budget, category) {
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { reject(`invalid_${category}_json`); }
  boundedTree(value, budget.check);
  return value;
}
function descriptor(value) {
  exactKeys(value, ["path", "sha256"]);
  if (!text(value.path) || !isAbsolute(value.path) || !digest(value.sha256)) reject("invalid_resource");
}
function selectorShape(s) {
  if (!plain(s) || !Number.isInteger(s.request) || s.request < 0 || s.request >= LIMITS.requests)
    reject("invalid_rule_selector");
  if (s.field === "query") {
    exactKeys(s, ["request", "field", "index"]);
    if (!Number.isInteger(s.index) || s.index < 0 || s.index >= 256) reject("invalid_rule_selector");
  } else if (s.field === "header") {
    exactKeys(s, ["request", "field", "name"]);
    if (!text(s.name)) reject("invalid_rule_selector");
  } else if (s.field === "body_utf8") exactKeys(s, ["request", "field"]);
  else reject("invalid_rule_selector");
}
function manifestShape(m) {
  exactKeys(m, ["schema_version", "layer", "reference", "candidate", "candidate_kind",
    "expected_pins", "rules", "authorization"]);
  if (m.schema_version !== 1 || !["native_attempt", "whole_wire", "local_control"].includes(m.layer)
    || !["reference_control", "observed_sequence"].includes(m.candidate_kind) || !text(m.authorization))
    reject("invalid_manifest");
  for (const side of ["reference", "candidate"]) {
    exactKeys(m[side], ["report", "capture", "completion"]);
    Object.values(m[side]).forEach(descriptor);
  }
  exactKeys(m.expected_pins, PINS);
  for (const p of PINS) {
    if (p === "configuration_sha256" && m.expected_pins[p] === null) continue;
    if (p.endsWith("sha256") ? !digest(m.expected_pins[p]) : !text(m.expected_pins[p]))
      reject("invalid_expected_pins");
  }
  const withFields = Object.hasOwn(m.rules, "fields");
  exactKeys(m.rules, withFields ? ["identities", "hashes", "fields"] : ["identities", "hashes"]);
  if (withFields && !Array.isArray(m.rules.fields)) reject("invalid_field_rule");
  if (!Array.isArray(m.rules.identities) || !Array.isArray(m.rules.hashes)
    || m.rules.identities.length + m.rules.hashes.length + (m.rules.fields?.length ?? 0) > LIMITS.rules)
    reject("rule_limit");
  const used = new Set();
  const use = s => {
    selectorShape(s);
    const key = JSON.stringify([s.request, s.field, s.index ?? s.name ?? null]);
    if (used.has(key)) reject("overlapping_rules");
    used.add(key);
  };
  for (const rule of m.rules.identities) {
    exactKeys(rule, ["groups"]);
    if (!Array.isArray(rule.groups) || rule.groups.length < 2
      || rule.groups.length > LIMITS.selectors) reject("invalid_identity_rule");
    let count = 0;
    for (const group of rule.groups) {
      if (!Array.isArray(group) || group.length < 2) reject("invalid_identity_rule");
      count += group.length;
      group.forEach(use);
    }
    if (count > LIMITS.selectors) reject("rule_limit");
  }
  for (const rule of m.rules.hashes) {
    exactKeys(rule, ["input", "digest", "normalization"]);
    if (!["identity", "trim_lowercase_utf8"].includes(rule.normalization)) reject("invalid_hash_rule");
    use(rule.input); use(rule.digest);
  }
  for (const rule of m.rules.fields ?? []) {
    try { fieldRuleShape(rule, selectorShape); } catch (e) {
      if (e instanceof ComparisonError) throw e;
      reject(e.message.startsWith("invalid_field") || e.message.startsWith("field_rule")
        ? e.message : "invalid_field_rule");
    }
    rule.selectors.forEach(use);
  }
  // An input_derived source stays compared exactly: no rule may target it.
  const same = (x, y) => x.request === y.request && x.field === y.field
    && (x.index ?? x.name ?? null) === (y.index ?? y.name ?? null);
  for (const rule of m.rules.fields ?? [])
    if (rule.class === "input_derived"
      && (m.rules.fields.some(o => o.selectors.some(s => same(s, rule.source)))
        || m.rules.hashes.some(o => same(o.input, rule.source) || same(o.digest, rule.source))))
      reject("overlapping_rules");
}
async function loadSide(resources, budget, inspection = null) {
  const loaded = {};
  for (const kind of ["report", "capture", "completion"]) {
    const bytes = inspection
      ? inspection.read(resources[kind].path, LIMITS.resource_bytes, resources[kind].sha256)
      : await boundedRead(resources[kind].path, LIMITS.resource_bytes, kind, budget);
    if (hash(bytes) !== resources[kind].sha256) reject(`${kind}_digest_mismatch`, "inconclusive");
    loaded[kind] = inspection ? parseEvidence(bytes, inspection.check) : parse(bytes, budget, kind);
  }
  const c = loaded.completion;
  if (!plain(c) || !equal(Object.keys(c).sort(), ["schema_version", "run_id", "report_sha256",
    "capture_sha256", "completed", "exit_code", "overall", "source_owner_attestation"].sort())
    || c.schema_version !== 1 || c.run_id !== loaded.report.run_id || c.completed !== true
    || c.exit_code !== 0 || c.overall !== "qualified" || !text(c.source_owner_attestation)
    || c.report_sha256 !== resources.report.sha256 || c.capture_sha256 !== resources.capture.sha256)
    reject("completion_unqualified", "inconclusive");
  return loaded;
}
function body(row, issues) {
  if (!["absent", "captured", "unavailable", "truncated"].includes(row.body_state))
    reject("invalid_body_state");
  if (row.body_state === "unavailable" || row.body_state === "truncated") issues.add("missing_evidence");
  if (row.body_state === "absent") {
    if (row.body_base64 !== null) reject("invalid_body_integrity");
    return;
  }
  if (row.body_state === "captured") {
    if (typeof row.body_base64 !== "string"
      || Buffer.from(row.body_base64, "base64").toString("base64") !== row.body_base64)
      reject("invalid_body_integrity");
    if (sentinel(Buffer.from(row.body_base64, "base64").toString("utf8"))) issues.add("redacted_values");
  }
}
function pairs(value) {
  return Array.isArray(value) && value.length <= 256
    && value.every(p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === "string"));
}
function headers(value, native = false) {
  return native ? plain(value) && Object.values(value).every(v => typeof v === "string") : pairs(value);
}
function validateRequests(capture, local, issues) {
  if (!Array.isArray(capture.requests) || capture.requests.length > LIMITS.requests) reject("request_limit");
  if (!capture.requests.length) issues.add("missing_positive_reference");
  for (const [i, r] of capture.requests.entries()) {
    known(r, local ? LOCAL_REQUEST : NATIVE_REQUEST, issues,
      local ? LOCAL_REQUEST : NATIVE_REQUEST.filter(k => k !== "native_relationship"));
    if (r.ordinal !== i || !text(r.case) || !text(r.method) || !text(r.category)
      || !text(r.resource_type) || !text(r.url)) reject("invalid_capture");
    let parsed;
    try { parsed = new URL(r.url); } catch { reject("invalid_capture_url"); }
    if (!["http:", "https:"].includes(parsed.protocol) || !pairs(r.query_pairs)
      || !equal([...parsed.searchParams], r.query_pairs)) reject("invalid_query_redundancy");
    if (!headers(r.headers, !local)) reject("invalid_headers");
    if (r.headers_state !== (local ? "complete" : "available_cdp_request_stage_headers"))
      issues.add("missing_evidence");
    if (!local && !Object.keys(r.headers).length) issues.add("missing_evidence");
    body(r, issues);
    if (local) {
      if (!pairs(r.cookies) || r.cookies_state !== "complete") issues.add("missing_evidence");
      known(r.response, ["status", "headers", "cookies", "body_base64", "body_state",
        "headers_state", "cookies_state", "complete"], issues);
      const s = r.response;
      if (!Number.isInteger(s.status) || s.status < 100 || s.status > 599) reject("invalid_response");
      if (!pairs(s.headers) || !pairs(s.cookies) || s.headers_state !== "complete"
        || s.cookies_state !== "complete" || s.complete !== true) issues.add("missing_evidence");
      body(s, issues);
      if (!(r.redirect_to === null || Number.isInteger(r.redirect_to))
        || !Array.isArray(r.fanout_to) || !r.fanout_to.every(Number.isInteger)) reject("invalid_edges");
      if ([r.redirect_to, ...r.fanout_to].filter(v => v !== null)
        .some(v => v < 0 || v >= capture.requests.length)) reject("invalid_edges");
    } else {
      if (r.aborted !== true && r.locally_fulfilled !== true) issues.add("forbidden_dispatch");
      if (r.actual_vendor_response !== false) issues.add("unknown_fields");
      if (r.local_response !== null) {
        known(r.local_response, ["status", "body_bytes", "body_sha256", "provenance"], issues);
        if (!digest(r.local_response.body_sha256) || !Number.isInteger(r.local_response.body_bytes)
          || r.local_response.body_bytes < 0 || r.local_response.status !== 200) reject("invalid_local_response");
      }
      if (r.native_relationship) {
        known(r.native_relationship, ["catalog", "evidence", "static_projection_sha256",
          "same_case_owned_primary_correlated", "independent_ownership_authentication",
          "complete_initiator_proof", "authorizes_dispatch", "authorizes_fulfillment"], issues);
        if (r.native_relationship.same_case_owned_primary_correlated !== true
          || r.native_relationship.authorizes_dispatch !== false
          || r.native_relationship.authorizes_fulfillment !== false) issues.add("missing_evidence");
      }
    }
  }
}
function nativeFields(row) {
  const values = [...row.query_pairs];
  if (row.body_state === "captured" && Object.entries(row.headers).some(([k, v]) =>
    k.toLowerCase() === "content-type" && v.startsWith("application/x-www-form-urlencoded"))) {
    values.push(...new URLSearchParams(Buffer.from(row.body_base64, "base64").toString("utf8")));
  }
  return new URLSearchParams(values);
}
function nativeObservations(report, capture, issues) {
  const google = report.profile === "google-ads-conversion", source = capture.source;
  const one = (data, key, value) => data.getAll(key).length === 1 && data.get(key) === value;
  const positives = ["baseline", "value1", "value2"];
  const sourceResources = [source.runtime, ...(google ? source.dependencies : [source.configuration])];
  if (sourceResources.some(r => r.source_http_status !== 200 || !digest(r.sha256))
    || report.configuration_sha256 !== (google ? null : source.configuration.sha256))
    issues.add("source_identity_mismatch");
  for (const c of capture.cases.filter(c => c.name !== "guard-tripwire")) {
    const document = `${source.owned_origin}/__airlock_native_reference_fixture__?case=${c.name}`
      + (c.name === "query-disabled" ? "&native=disabled" : "");
    const expectedConsent = c.name === "consent-revoked"
      ? "explicit_revoke_before_init" : "native_default_not_overridden";
    if (c.document_url !== document || c.fixture_state?.executed !== true
      || c.fixture_state.disabled !== (c.name === "query-disabled") || c.consent !== expectedConsent
      || c.fixture_state.consent !== expectedConsent) issues.add("native_observation_unqualified");
    const rows = capture.requests.filter(r => r.case === c.name);
    for (const r of rows) {
      if (!["fixture_document", "runtime", "configuration", "fixture_favicon",
        "native_measurement", "native_auxiliary"].includes(r.category)) issues.add("unknown_fields");
      if (["runtime", "configuration"].includes(r.category)) {
        const resource = sourceResources.find(resource => resource.url === r.url);
        if (!resource || r.local_response?.body_sha256 !== resource.sha256
          || r.source_relationship !== r.category || r.locally_fulfilled !== true
          || r.resource_type !== "Script") issues.add("source_identity_mismatch");
      }
      if (r.category === "fixture_document" && r.url !== document) issues.add("native_observation_unqualified");
    }
    if (!positives.includes(c.name)) {
      if (rows.some(r => ["native_measurement", "native_auxiliary"].includes(r.category))
        || (c.name === "query-disabled" && rows.some(r => ["runtime", "configuration"].includes(r.category))))
        issues.add("native_observation_unqualified");
      continue;
    }
    const value = c.name === "value2" ? "29.75" : "13.25";
    const primaries = rows.filter(r => r.category === "native_measurement");
    if (!primaries.length || (!google && primaries.length !== 1)) issues.add("missing_positive_reference");
    for (const r of primaries) {
      const data = nativeFields(r), url = new URL(r.url);
      let valid = r.aborted === true && r.locally_fulfilled === false;
      if (google) {
        const id = source.conversion_id?.slice(3);
        valid &&= ((url.origin === "https://www.googleadservices.com" && url.pathname === `/pagead/conversion/${id}/`)
          || (url.origin === "https://www.google.com" && url.pathname === `/pagead/1p-conversion/${id}/`))
          && one(data, "label", source.conversion_label) && one(data, "value", value)
          && one(data, "currency_code", "USD") && one(data, "oid", `airlock-native-reference-${c.name}`)
          && one(data, "url", document);
      } else {
        valid &&= url.origin === "https://www.facebook.com" && url.pathname === "/tr/"
          && one(data, "id", source.pixel_id) && one(data, "ev", "PageView") && one(data, "dl", document)
          && (c.name === "baseline" || (one(data, "cd[value]", value) && one(data, "cd[currency]", "USD")));
      }
      if (!valid) issues.add("native_observation_unqualified");
    }
    if (google) {
      const expected = { send_to: `${source.conversion_id}/${source.conversion_label}`, value: Number(value),
        currency: "USD", transaction_id: `airlock-native-reference-${c.name}` };
      if (!equal(c.synthetic_inputs, expected) || !equal(c.native_state.conversion_input, expected)
        || c.native_state.destination_initialized !== true) issues.add("native_observation_unqualified");
      for (const r of rows.filter(r => r.category === "native_auxiliary")) {
        const data = nativeFields(r), identities = primaries.map(p => nativeFields(p).getAll("auid"));
        if (!identities.length || identities.some(v => v.length !== 1 || !v[0])
          || new Set(identities.map(v => v[0])).size !== 1 || !one(data, "auid", identities[0][0])
          || r.aborted !== true || r.locally_fulfilled !== false || !r.native_relationship
          || r.native_relationship.static_projection_sha256 !== report.provenance.auxiliary_projection_sha256)
          issues.add("native_observation_unqualified");
      }
    }
  }
}
function validateNative(report, capture, issues, verifyObservations) {
  known(capture, ["schema_version", "run_id", "source", "requests", "cases", "errors", "receiver_requests",
    "failure_detail", "provenance", "browser_process_ids", "limits"], issues);
  known(report, REPORT_KEYS, issues);
  const google = report.profile === "google-ads-conversion";
  if (!google && report.profile !== "meta-pageview") issues.add("unknown_fields");
  const names = google ? ["baseline", "query-disabled", "value1", "value2"]
    : ["baseline", "query-disabled", "consent-revoked", "value1", "value2"];
  if (report.evidence_layer !== "native_attempt" || report.mode !== "headed"
    || report.control !== "none" || report.platform !== "darwin") issues.add("source_unqualified");
  const p = report.provenance;
  known(p, PROVENANCE_KEYS, issues);
  known(p.source_response_statuses, ["runtime", "configuration", "dependencies"], issues);
  known(capture.provenance, PROVENANCE_KEYS, issues);
  if (!equal(capture.provenance, p)) issues.add("source_identity_mismatch");
  known(capture.source, ["owned_origin", "source_document_url", "pixel_id", "conversion_id",
    "conversion_label", "source_acquisition_sha256", "source_capture_sha256", "runtime",
    "configuration", "dependencies"], issues);
  for (const resource of [capture.source.runtime, ...(google ? capture.source.dependencies ?? []
    : [capture.source.configuration])]) known(resource, ["url", "sha256", "source_http_status"], issues);
  if (capture.source.runtime?.sha256 !== report.runtime_sha256
    || (!google && capture.source.configuration?.sha256 !== report.configuration_sha256)
    || capture.source.source_capture_sha256 !== p.source_capture_sha256
    || p.native_resources !== "unmodified_retained_official_bytes_locally_fulfilled")
    issues.add("source_identity_mismatch");
  if (google && (p.source_cohort !== "newly_acquired_google_native_bytes_not_historical_capture"
    || p.source_acquisition_sha256 !== capture.source.source_acquisition_sha256))
    issues.add("source_identity_mismatch");
  known(report.counts, ["attempts", "recorded_requests", "native_auxiliaries", "total_native_attempts"], issues);
  known(report.controls, ["disabled_linked", "consent_negative_linked", "value_contrast"], issues);
  if (report.controls.disabled_linked !== true || report.controls.value_contrast !== true
    || report.controls.consent_negative_linked !== !google) issues.add("source_unqualified");
  known(report.guard, ["mechanism", "process_control", "resolver_control", "http_control", "qualified"], issues);
  known(report.guard.process_control, ["positive_arrivals", "positive_status", "confined_arrivals",
    "navigation_denied", "qualified", "cohort"], issues);
  known(report.guard.resolver_control, ["positive_connections", "confined_denials",
    "qualified", "query_payload_sent", "scope"], issues);
  known(report.guard.http_control, ["attempts", "aborted", "arrivals", "qualified"], issues);
  const pinnedCounts = (control, expected) => Object.entries(expected).every(([key, value]) =>
    Number.isSafeInteger(control[key]) && control[key] === value);
  if (report.guard.mechanism !== "cdp_fetch_request_stage_all_fulfill_or_abort"
    || report.guard.process_control.qualified !== true
    || !pinnedCounts(report.guard.process_control, { positive_arrivals: 1, positive_status: 200, confined_arrivals: 0 })
    || report.guard.process_control.navigation_denied !== true
    || report.guard.resolver_control.qualified !== true
    || !pinnedCounts(report.guard.resolver_control, { positive_connections: 2, confined_denials: 2 })
    || report.guard.resolver_control.query_payload_sent !== false
    || report.guard.http_control.qualified !== true
    || !pinnedCounts(report.guard.http_control, { attempts: 1, aborted: 1, arrivals: 0 }))
    issues.add("forbidden_dispatch");
  known(report.cleanup, ["owned_processes_exited", "servers_closed", "contexts_closed", "signal_listeners_detached"], issues);
  known(report.claims, Object.keys(CLAIMS).filter(k => k !== "reporting_verified"), issues);
  if (Object.values(report.claims).some(v => v !== false)) issues.add("unsupported_claims");
  known(report.observation_window, ["started_at", "stopped_at", "max_wall_ms", "per_case_ms"], issues);
  const w = report.observation_window;
  if (!Number.isFinite(Date.parse(w.started_at)) || !Number.isFinite(Date.parse(w.stopped_at))
    || Date.parse(w.stopped_at) < Date.parse(w.started_at)
    || !Number.isInteger(w.max_wall_ms) || w.max_wall_ms < 1 || w.max_wall_ms > 60000
    || !Number.isInteger(w.per_case_ms) || w.per_case_ms < 1 || w.per_case_ms > w.max_wall_ms
    || !Number.isFinite(report.run_elapsed_ms) || report.run_elapsed_ms < 0
    || report.run_elapsed_ms >= w.max_wall_ms || report.limits?.run_ms !== w.max_wall_ms)
    issues.add("missing_evidence");
  for (const limits of [report.limits, capture.limits]) known(limits,
    ["run_ms", "observation_ms", "settle_ms", "requests", "url_bytes", "request_body_bytes",
      "header_bytes", "resource_bytes", "manifest_bytes"], issues);
  if (!equal(report.expected_positive_cases, ["baseline", "value1", "value2"])
    || !Array.isArray(report.cases) || !equal(report.cases.map(c => c.name), names)
    || !Array.isArray(capture.cases) || !equal(capture.cases.map(c => c.name), ["guard-tripwire", ...names]))
    reject("case_matrix_unqualified", "inconclusive");
  const measurements = capture.requests.filter(r => r.category === "native_measurement");
  const auxiliaries = capture.requests.filter(r => r.category === "native_auxiliary");
  if (report.counts.attempts !== measurements.length
    || (google && (report.counts.native_auxiliaries !== auxiliaries.length
      || report.counts.total_native_attempts !== measurements.length + auxiliaries.length)))
    issues.add("source_count_mismatch");
  for (const c of capture.cases) {
    known(c, PRIVATE_CASE_KEYS, issues);
    known(c.native_state, google ? ["callable", "destination_initialized", "data_layer_length", "conversion_input"]
      : ["callable", "queue_length", "owned_pixel_count", "event_count"], issues);
    known(c.synthetic_inputs, google ? ["send_to", "value", "currency", "transaction_id"] : ["value", "currency"], issues);
    if (c.fixture_state !== null) known(c.fixture_state, ["executed", "disabled", "consent"], issues);
    if (google && c.native_state.conversion_input !== null)
      known(c.native_state.conversion_input, ["send_to", "value", "currency", "transaction_id"], issues);
    if (c.navigation_completed !== true || !Array.isArray(c.violations) || c.violations.length
      || !Array.isArray(c.page_errors) || c.page_errors.length
      || !Array.isArray(c.unsupported_surfaces) || c.unsupported_surfaces.length) issues.add("source_unqualified");
  }
  for (const c of report.cases) {
    known(c, CASE_KEYS, issues);
    const privateCase = capture.cases.find(p => p.name === c.name);
    // The recorder snapshots private cases before gradeCases links the public
    // summaries. Null is the known pre-grading snapshot, not an unlinked report.
    if (!Object.entries(c).filter(([k]) => k !== "qualified_positive_run_id")
      .every(([k, v]) => equal(privateCase[k], v))
      || ![null, report.run_id].includes(privateCase.qualified_positive_run_id)
      || c.qualified_positive_run_id !== report.run_id || c.dependency_closed !== true)
      issues.add("case_linkage_unqualified");
    const rows = capture.requests.filter(r => r.case === c.name);
    const positive = ["baseline", "value1", "value2"].includes(c.name);
    const actual = rows.filter(r => r.category === "native_measurement");
    if (c.attempts !== actual.length || (verifyObservations && positive
      && (!actual.length || c.qualified_positive_reference !== true))
      || (!positive && actual.length)) issues.add("missing_positive_reference");
    if (positive && (privateCase.fixture_state?.executed !== true || privateCase.native_state.callable !== true))
      issues.add("missing_positive_reference");
    if (c.runtime_fulfilled !== rows.filter(r => r.category === "runtime" && r.locally_fulfilled).length
      || c.configuration_fulfilled !== rows.filter(r => r.category === "configuration" && r.locally_fulfilled).length
      || (google && (c.auxiliary_attempts !== rows.filter(r => r.category === "native_auxiliary").length
        || c.total_native_attempts !== c.attempts + c.auxiliary_attempts))) issues.add("source_count_mismatch");
  }
  if (capture.failure_detail !== null || !Array.isArray(capture.errors) || capture.errors.length)
    issues.add("source_unqualified");
  if (!Array.isArray(capture.receiver_requests) || capture.receiver_requests.length !== 1)
    issues.add("source_unqualified");
  for (const r of capture.receiver_requests ?? []) {
    known(r, ["path", "at", "method", "headers", "response_status"], issues);
    if (!headers(r.headers, true) || r.response_status !== 200) issues.add("source_unqualified");
  }
  if (verifyObservations) nativeObservations(report, capture, issues);
}
function validateSide(side, m, issues, verifyObservations) {
  const { report: r, capture: c } = side;
  if (!plain(r) || !plain(c)) reject("invalid_source");
  const local = c.kind === "local_complete_sequence";
  const cleanupKeys = local ? ["complete"] : ["owned_processes_exited", "servers_closed",
    "contexts_closed", "signal_listeners_detached"];
  if (r.schema_version !== 1 || c.schema_version !== 1 || !text(r.run_id)
    || r.run_id !== c.run_id) issues.add("source_identity_mismatch");
  if (r.overall !== "qualified" || r.exit_code !== 0 || !Array.isArray(r.errors)
    || r.errors.length || r.capture_complete !== true || r.guard?.qualified !== true
    || !plain(r.cleanup) || !cleanupKeys.every(key =>
      Object.hasOwn(r.cleanup, key) && r.cleanup[key] === true)) issues.add("source_unqualified");
  for (const p of PINS) {
    const actual = p === "network_policy_sha256" ? r.provenance?.[p] : r[p];
    if (actual !== m.expected_pins[p]) issues.add("stale_pins");
  }
  validateRequests(c, local, issues);
  if (r.counts?.recorded_requests !== c.requests.length) issues.add("source_count_mismatch");
  if (local) {
    known(c, ["schema_version", "kind", "run_id", "complete", "requests"], issues);
    known(r, ["schema_version", "run_id", "evidence_layer", ...PINS,
      "overall", "exit_code", "errors", "capture_complete", "counts", "provenance", "guard", "cleanup"], issues);
    known(r.counts, ["recorded_requests"], issues);
    known(r.provenance, ["network_policy_sha256"], issues);
    known(r.guard, ["qualified"], issues);
    known(r.cleanup, ["complete"], issues);
    if (r.network_policy_sha256 !== r.provenance.network_policy_sha256) issues.add("stale_pins");
    if (m.layer !== "local_control" || r.evidence_layer !== "local_control"
      || r.profile !== "local-synthetic" || c.complete !== true) issues.add("source_unqualified");
    if (m.rules.fields?.length) issues.add("field_rules_native_only");
  } else {
    if (m.rules.identities.length || m.rules.hashes.length)
      issues.add("native_normalization_unsupported");
    validateNative(r, c, issues, verifyObservations);
    if (m.layer === "whole_wire") issues.add("whole_wire_unavailable");
    if (m.layer === "local_control") issues.add("source_unqualified");
  }
  if (sentinel(c)) issues.add("redacted_values");
}
// The strict reader must reconcile the HTTP control's ORIGINAL observations,
// not just its asserted counters. The legacy comparator intentionally keeps
// its old validation path. These are the fixed httpBoundary/guardedCase rows.
function validateHttpGuard({ report, capture }) {
  const guard = capture.cases.find(c => c.name === "guard-tripwire");
  const rows = capture.requests.filter(r => r.case === "guard-tripwire");
  const [document, attempt] = rows, control = report.guard.http_control;
  let origin;
  try {
    const url = new URL(guard.document_url);
    if (url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) > 0)
      origin = url.origin;
  } catch { /* Missing or malformed original cannot qualify the source control. */ }
  const attempts = capture.requests.filter(r => r.category === "http_tripwire");
  const target = attempt && new URL(attempt.url);
  const arrivals = target && capture.receiver_requests.filter(r => r.path === target.pathname).length;
  if (!origin || rows.length !== 2 || attempts.length !== control.attempts
    || attempts.filter(r => r.aborted === true).length !== control.aborted
    || arrivals !== control.arrivals || guard.attempts !== 0
    || guard.runtime_fulfilled !== 0 || guard.configuration_fulfilled !== 0
    || guard.observation_ms !== 500 || guard.fixture_state !== null
    || guard.document_url !== `${origin}/guard-fixture`
    || document.category !== "fixture_document" || document.url !== guard.document_url
    || document.method !== "GET" || document.resource_type !== "Document"
    || document.aborted !== false || document.locally_fulfilled !== true
    || document.local_response?.provenance !== "generated_synthetic"
    || document.local_response.body_sha256 !== guard.fixture_sha256
    || document.local_response.body_bytes <= 0
    || attempt.category !== "http_tripwire" || attempt !== attempts[0]
    || attempt.method !== "GET" || !["XHR", "Fetch"].includes(attempt.resource_type)
    || attempt.aborted !== true || attempt.locally_fulfilled !== false || attempt.local_response !== null
    || !/^\/http-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(target.pathname)
    || attempt.url !== origin + target.pathname
    || rows.some(r => r.body_state !== "absent" || r.body_base64 !== null
      || r.source_relationship !== null || r.native_relationship != null)
    || capture.receiver_requests.some(r => r.method !== "GET"
      || !/^\/process-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.path)))
    reject("guard_observation_unqualified", "inconclusive");
}
// Strict READ-ONLY entry for distinct downstream consumers. Unlike comparator
// controls, this ALWAYS checks all observations; no local or whole-wire mode.
// The legacy comparator above/below retains its original input/output behavior.
export async function inspectNativeAttempt(options) {
  strictKeys(options, ["reference", "expected_pins"]);
  strictKeys(options.reference, ["report", "capture", "completion"]);
  Object.values(options.reference).forEach(descriptor);
  strictKeys(options.expected_pins, PINS);
  const pins = options.expected_pins;
  if (!["meta-pageview", "google-ads-conversion"].includes(pins.profile)
    || PINS.some(p => p === "configuration_sha256" && pins[p] === null ? false
      : p.endsWith("sha256") ? !digest(pins[p]) : !text(pins[p]))) reject("invalid_expected_pins");
  if (new Set(Object.values(options.reference).map(v => v.path)).size !== 3) reject("ambiguous_handles");
  const inspection = evidenceSession();
  const side = await loadSide(options.reference, null, inspection);
  if (side.capture.kind !== undefined || side.report.evidence_layer !== "native_attempt"
    || side.report.schema_version !== 1 || side.capture.schema_version !== 1)
    reject("unsupported_native_schema", "inconclusive");
  const issues = new Set();
  validateSide(side, { expected_pins: pins, layer: "native_attempt",
    rules: { identities: [], hashes: [] } }, issues, true);
  validateHttpGuard(side);
  const cases = new Set(side.capture.cases.map(c => c.name));
  if (side.capture.requests.some(r => !cases.has(r.case)
    || !["fixture_document", "runtime", "configuration", "fixture_favicon",
      "native_measurement", "native_auxiliary", "http_tripwire"].includes(r.category)))
    issues.add("unknown_fields");
  if (sentinel(side.report) || sentinel(side.completion)) issues.add("redacted_values");
  if (issues.size) reject([...issues].sort()[0], "inconclusive");
  inspection.recheck();
  return freeze({ ...side, originals: inspection.snapshots() });
}
function selected(side, s) {
  const row = side.capture.requests[s.request];
  if (!row) reject("rule_evidence_unavailable", "inconclusive");
  if (s.field === "query") {
    if (!row.query_pairs[s.index]) reject("rule_evidence_unavailable", "inconclusive");
    return row.query_pairs[s.index][1];
  }
  if (s.field === "body_utf8") {
    if (row.body_state !== "captured") reject("rule_evidence_unavailable", "inconclusive");
    const bytes = Buffer.from(row.body_base64, "base64");
    const value = bytes.toString("utf8");
    if (!bytes.equals(Buffer.from(value))) reject("rule_evidence_unavailable", "inconclusive");
    return value;
  }
  if (Array.isArray(row.headers)) {
    const found = row.headers.filter(p => p[0] === s.name);
    if (found.length !== 1) reject("rule_evidence_unavailable", "inconclusive");
    return found[0][1];
  }
  if (!Object.hasOwn(row.headers, s.name)) reject("rule_evidence_unavailable", "inconclusive");
  return row.headers[s.name];
}
// Retain the original percent-escape/literal/+ spelling, including escape case,
// for every selected query byte. Different encoding must not be normalized away.
function encoding(value) {
  const result = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "%" && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      const pair = value.slice(i + 1, i + 3);
      result.push(`percent:${[...pair].map(c => /[a-f]/.test(c) ? "lower" : /[A-F]/.test(c) ? "upper" : "digit").join(",")}`);
      i += 2;
    } else result.push(value[i] === "+" ? "plus" : "literal");
  }
  return result;
}
function project(side, exclusions) {
  const c = structuredClone(side.capture);
  if (c.kind === "local_complete_sequence") return c;
  function remove(obj, key, index) {
    if (Object.hasOwn(obj, key)) { delete obj[key]; exclusions[index].count++; }
  }
  remove(c, "run_id", 0); remove(c, "browser_process_ids", 2);
  for (const r of c.requests) {
    remove(r, "observed_at", 1); remove(r, "network_id", 2);
    if (r.local_response?.provenance === "generated_synthetic") {
      remove(r.local_response, "body_bytes", 3); remove(r.local_response, "body_sha256", 3);
    }
  }
  for (const row of c.cases) {
    remove(row, "started_at", 1); remove(row, "stopped_at", 1);
    remove(row, "qualified_positive_run_id", 0); remove(row, "fixture_sha256", 3);
  }
  for (const row of c.receiver_requests) remove(row, "at", 1);
  return c;
}
// `collapse` keeps which escape spellings occurred but not the value length,
// because a field rule legitimately covers values of different lengths.
function replaceSelected(projected, s, value, collapse = false) {
  const row = projected.requests[s.request];
  if (s.field === "query") {
    const question = row.url.indexOf("?");
    const fragment = row.url.indexOf("#", question);
    const end = fragment < 0 ? row.url.length : fragment;
    const tokens = row.url.slice(question + 1, end).split("&");
    const token = tokens[s.index];
    const equals = token.indexOf("=");
    if (equals < 0) reject("rule_evidence_unavailable", "inconclusive");
    tokens[s.index] = `${token.slice(0, equals + 1)}${JSON.stringify([value, collapse
      ? [...new Set(encoding(token.slice(equals + 1)))].sort() : encoding(token.slice(equals + 1))])}`;
    row.url = row.url.slice(0, question + 1) + tokens.join("&") + row.url.slice(end);
    row.query_pairs[s.index][1] = value;
  } else if (s.field === "body_utf8") row.body_base64 = Buffer.from(value).toString("base64");
  else if (Array.isArray(row.headers)) row.headers.find(p => p[0] === s.name)[1] = value;
  else row.headers[s.name] = value;
}
function applyRules(a, b, pa, pb, rules, issues) {
  // Local synthetic policy, not caller-declared semantics. Validate every
  // original target on BOTH sides before any relationship projection.
  const allow = (s, role) => {
    for (const side of [a, b]) {
      const names = role === "identity" ? ["id", "client_id"]
        : role === "input" ? ["synthetic_hash_input"] : ["synthetic_sha256"];
      const header = role === "identity" ? "X-Private-Identity"
        : role === "input" ? "X-Private-Hash-Input" : "X-Private-SHA256";
      const row = side.capture.requests[s.request];
      if (!row) reject("rule_evidence_unavailable", "inconclusive");
      if (!(s.field === "query" && names.includes(row.query_pairs[s.index]?.[0]))
        && !(s.field === "header" && s.name === header))
        reject("rule_target_unsupported");
    }
  };
  for (const rule of rules.identities)
    for (const group of rule.groups) for (const s of group) allow(s, "identity");
  for (const rule of rules.hashes) { allow(rule.input, "input"); allow(rule.digest, "digest"); }
  let preserved = 0;
  for (const [i, rule] of rules.identities.entries()) {
    let valid = true;
    for (const side of [a, b]) {
      const values = [];
      for (const group of rule.groups) {
        const v = group.map(s => selected(side, s));
        if (v.some(x => !text(x)) || !v.every(x => x === v[0])) valid = false;
        values.push(v[0]);
      }
      if (new Set(values).size !== values.length) valid = false;
    }
    if (!valid) { issues.add("identity_relationship"); continue; }
    for (const [j, group] of rule.groups.entries()) {
      for (const s of group) {
        replaceSelected(pa, s, `identity:${i}:${j}`);
        replaceSelected(pb, s, `identity:${i}:${j}`);
      }
      preserved++;
    }
  }
  for (const rule of rules.hashes) {
    const normalize = value => rule.normalization === "identity" ? value : value.trim().toLowerCase();
    let valid = true;
    for (const side of [a, b]) {
      const input = selected(side, rule.input);
      const value = selected(side, rule.digest);
      if (!text(input) || !digest(value) || hash(normalize(input)) !== value) valid = false;
    }
    if (!valid) { issues.add("hash_relationship"); continue; }
    for (const [side, p] of [[a, pa], [b, pb]])
      replaceSelected(p, rule.input, normalize(selected(side, rule.input)));
    preserved++;
  }
  return preserved + applyFieldRules(a, b, pa, pb, rules.fields ?? [], issues);
}
// Native-side field rules (ADR-0061 point 10). Each class validates the ORIGINAL
// values on both sides first; only a valid rule replaces them with one token.
function applyFieldRules(a, b, pa, pb, rules, issues) {
  if (a.capture.kind === "local_complete_sequence") return 0;
  const keyOf = (side, s) => {
    const row = side.capture.requests[s.request];
    if (!row) reject("rule_evidence_unavailable", "inconclusive");
    return s.field === "query" ? row.query_pairs[s.index]?.[0] : s.field === "header" ? s.name : null;
  };
  let applied = 0;
  for (const [i, rule] of rules.entries()) {
    for (const side of [a, b]) for (const s of rule.selectors) {
      const key = keyOf(side, s);
      if (s.field === "body_utf8" && rule.class !== "input_derived") reject("rule_target_unsupported");
      if (protectedTarget(rule, key)) reject("rule_target_unsupported");
    }
    const results = [a, b].map(side => evaluateFieldRule(rule, i,
      rule.selectors.map(s => selected(side, s)), rule.source ? selected(side, rule.source) : undefined));
    if (results.some(r => !r.valid)) { issues.add("field_rule_violation"); continue; }
    // Same input state must yield the same server-supplied value on both sides.
    if (rule.class === "server_context"
      && JSON.stringify(rule.selectors.map(s => selected(a, s))) !== JSON.stringify(rule.selectors.map(s => selected(b, s)))) {
      issues.add("field_rule_violation"); continue;
    }
    for (const [p, r] of [[pa, results[0]], [pb, results[1]]])
      rule.selectors.forEach((s, k) => replaceSelected(p, s, r.tokens[k], true));
    applied++;
  }
  return applied;
}
function compare(a, b, m, budget, control = false) {
  const result = publicReport();
  result.evidence_layer = m.layer; result.candidate_kind = m.candidate_kind;
  const issues = new Set();
  validateSide(a, m, issues, !control); validateSide(b, m, issues, !control);
  budget.check();
  result.counts.reference_requests = a.capture.requests.length;
  result.counts.candidate_requests = b.capture.requests.length;
  const evidence = side => {
    const rows = side.capture.requests, local = side.capture.kind === "local_complete_sequence";
    return {
      request_bodies_captured: rows.filter(r => r.body_state === "captured").length,
      request_bodies_absent: rows.filter(r => r.body_state === "absent").length,
      request_bodies_unavailable: rows.filter(r => ["unavailable", "truncated"].includes(r.body_state)).length,
      complete_local_responses: local ? rows.filter(r => r.response.complete === true).length : 0,
      response_metadata_only: local ? 0 : rows.filter(r => r.local_response !== null).length,
      vendor_responses_unavailable: local ? 0 : rows.filter(r =>
        ["native_measurement", "native_auxiliary"].includes(r.category)).length,
      cookie_attachment_unproved: local ? 0 : rows.length,
      redirect_fanout_unavailable: local ? 0 : rows.length,
    };
  };
  result.evidence = { reference: evidence(a), candidate: evidence(b) };
  result.counts.presence_only = result.evidence.reference.response_metadata_only
    + result.evidence.candidate.response_metadata_only;
  const pa = project(a, result.exclusions), pb = project(b, result.exclusions);
  if (issues.size) {
    for (const key of ["unknown_fields", "missing_evidence", "forbidden_dispatch"])
      result.counts[key] = issues.has(key) ? 1 : 0;
    result.counts.unknown_fields = issues.unknownFields ?? result.counts.unknown_fields;
    if (issues.has("whole_wire_unavailable")) result.counts.missing_evidence++;
    state(result, "inconclusive", [...issues]);
    return { result, details: [] };
  }
  result.counts.preserved_relationships = applyRules(a, b, pa, pb, m.rules, issues);
  const details = [];
  const difference = (category, ordinal, reference, candidate) => {
    budget.check();
    if (details.length >= LIMITS.differences) reject("difference_limit", "inconclusive");
    result.differences.push({ category, ordinal });
    details.push({ category, ordinal, reference, candidate });
  };
  if (pa.requests.length !== pb.requests.length)
    difference("sequence", null, pa.requests.length, pb.requests.length);
  const categories = [
    ["method", ["method"]], ["classification", ["category", "resource_type", "case"]],
    ["query", ["query_pairs"]], ["headers", ["headers", "headers_state"]],
    ["cookies", ["cookies", "cookies_state"]], ["body", ["body_base64", "body_state"]],
    ["response", ["response", "local_response", "actual_vendor_response"]],
    ["edges", ["redirect_to", "fanout_to"]],
    ["source_relationship", ["aborted", "locally_fulfilled", "source_relationship", "native_relationship"]],
  ];
  for (let i = 0; i < Math.min(pa.requests.length, pb.requests.length); i++) {
    const x = pa.requests[i], y = pb.requests[i];
    const before = details.length;
    for (const [category, keys] of categories) {
      if (keys.some(k => !equal(x[k], y[k])))
        difference(category, i, keys.map(k => x[k]), keys.map(k => y[k]));
    }
    if (x.url !== y.url) {
      const base = url => url.split("?")[0];
      const category = base(x.url) !== base(y.url) ? "destination"
        : equal(x.query_pairs, y.query_pairs) ? "encoding" : "query";
      difference(category, i, x.url, y.url);
    }
    if (before === details.length) result.counts.equal_requests++;
  }
  // All known non-request source/case records also remain material, except the
  // fixed counted observer/generated-fixture exclusions above.
  const withoutRequests = p => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "requests"));
  if (!equal(withoutRequests(pa), withoutRequests(pb)))
    difference("scenario_evidence", null, withoutRequests(pa), withoutRequests(pb));
  result.counts.differences = details.length;
  state(result, issues.size || details.length ? "nonconformant" : "qualified", [...issues]);
  return { result, details };
}
function setQuery(row, index, value) {
  const url = new URL(row.url);
  const q = row.url.indexOf("?");
  const end = row.url.indexOf("#", q);
  const tokens = row.url.slice(q + 1, end < 0 ? undefined : end).split("&");
  const eq = tokens[index].indexOf("=");
  tokens[index] = tokens[index].slice(0, eq + 1) + encodeURIComponent(value);
  row.url = row.url.slice(0, q + 1) + tokens.join("&") + (end < 0 ? "" : row.url.slice(end));
  row.query_pairs = [...new URL(row.url).searchParams];
  return url.href !== new URL(row.url).href;
}
function mutate(a, b, name) {
  const rows = b.capture.requests;
  const local = b.capture.kind === "local_complete_sequence";
  let category, applied = false;
  const index = rows.findIndex(r => r.category === (local ? "conversion" : "native_measurement"));
  const row = rows[index < 0 ? 0 : index];
  if (name === "drop" || name === "duplicate") {
    if (name === "drop") {
      rows.pop();
      if (local) for (const r of rows) {
        if (r.redirect_to === rows.length) r.redirect_to = null;
        r.fanout_to = r.fanout_to.filter(target => target !== rows.length);
      }
    }
    else rows.push(structuredClone(row));
    rows.forEach((r, i) => { r.ordinal = i; });
    category = "sequence"; applied = true;
  } else if (name === "route") {
    row.url = row.url.replace(/^(https?:\/\/[^/?#]+)/, "$1/comparison-control-route");
    category = "destination"; applied = true;
  } else if (["value", "consent", "identity"].includes(name)) {
    const names = name === "value" ? ["value", "cd[value]"] : name === "consent"
      ? ["consent", "gcs", "gcd"] : ["id", "auid", "_fbp", "fbp"];
    const target = rows.find(r => r.query_pairs.some(p => names.includes(p[0])));
    const i = target?.query_pairs.findIndex(p => names.includes(p[0]));
    if (target && i >= 0) applied = setQuery(target, i, `${target.query_pairs[i][1]}-control-change`);
    category = "query";
    if (!applied && name === "consent" && !local) {
      const c = b.capture.cases.find(c => c.name === "baseline");
      c.consent += "-control-change";
      b.report.cases.find(c => c.name === "baseline").consent = c.consent;
      category = "scenario_evidence"; applied = true;
    }
  } else if (name === "response-truncation" && local) {
    row.response.body_base64 = Buffer.from(row.response.body_base64, "base64").subarray(0, 1).toString("base64");
    category = "response"; applied = true;
  } else if (name === "edge-loss" && local) {
    const edge = rows.find(r => r.redirect_to !== null || r.fanout_to.length);
    if (edge) { edge.redirect_to = null; edge.fanout_to = []; applied = true; }
    category = "edges";
  } else if (name === "empty-reference") {
    a.capture.requests = []; a.report.counts.recorded_requests = 0;
    category = "missing_positive_reference"; applied = true;
  } else if (name === "equal-redaction") {
    const target = Math.max(0, index);
    for (const side of [a, b]) {
      const r = side.capture.requests[target];
      if (r.query_pairs.length) setQuery(r, 0, "[REDACTED]");
      else r.headers[local ? 0 : Object.keys(r.headers)[0]] = local
        ? [r.headers[0][0], "[REDACTED]"] : "[REDACTED]";
    }
    category = "redacted_values"; applied = true;
  } else if (name === "stale-pin") {
    b.report.browser_version += "-stale";
    category = "stale_pins"; applied = true;
  }
  return { applied, category };
}
// Controls intentionally operate on a validated canonical clone, not on forged
// source receipts. Reconcile redundant bookkeeping before the same comparator.
function reconcile(side) {
  const { report: r, capture: c } = side;
  r.counts.recorded_requests = c.requests.length;
  if (c.kind === "local_complete_sequence") return;
  const count = (name, category) => c.requests.filter(x => (!name || x.case === name) && x.category === category).length;
  r.counts.attempts = count(null, "native_measurement");
  if (r.profile === "google-ads-conversion") {
    r.counts.native_auxiliaries = count(null, "native_auxiliary");
    r.counts.total_native_attempts = r.counts.attempts + r.counts.native_auxiliaries;
  }
  for (const row of r.cases) {
    row.attempts = count(row.name, "native_measurement");
    if (r.profile === "google-ads-conversion") {
      row.auxiliary_attempts = count(row.name, "native_auxiliary");
      row.total_native_attempts = row.attempts + row.auxiliary_attempts;
    }
    Object.assign(c.cases.find(c => c.name === row.name), row);
  }
}
export async function runNativeComparison(options) {
  let result = publicReport();
  if (!plain(options) || Object.keys(options).some(k => !["inputs", "outputDir", "control"].includes(k))
    || !text(options.inputs) || !isAbsolute(options.inputs) || !text(options.outputDir)
    || !isAbsolute(options.outputDir) || (options.control !== undefined && !CONTROLS.includes(options.control))) {
    state(result, "invalid_input", ["invalid_options"]); return freeze(result);
  }
  const budget = clock();
  let acquired = false, privateData = null;
  try {
    try { await budget.wait(() => mkdir(options.outputDir, { mode: 0o700 })); acquired = true; }
    catch (e) {
      if (e instanceof ComparisonError) throw e;
      reject("output_directory_unavailable");
    }
    const bytes = await boundedRead(options.inputs, LIMITS.manifest_bytes, "manifest", budget);
    const m = parse(bytes, budget, "manifest");
    manifestShape(m);
    result.evidence_layer = m.layer; result.candidate_kind = m.candidate_kind;
    const a = await loadSide(m.reference, budget), b = await loadSide(m.candidate, budget);
    let comparison = compare(a, b, m, budget);
    if (options.control) {
      const positive = comparison.result;
      if (positive.exit_code !== 0) reject("control_positive_unqualified", "inconclusive");
      const ma = structuredClone(a), mb = structuredClone(b);
      const before = JSON.stringify([ma, mb]);
      const mutation = mutate(ma, mb, options.control);
      if (!mutation.applied || before === JSON.stringify([ma, mb]))
        reject("control_unavailable", "inconclusive");
      reconcile(ma); reconcile(mb);
      comparison = compare(ma, mb, m, budget, true);
      const detected = comparison.result.exit_code !== 0
        && (comparison.result.errors.includes(mutation.category)
          || comparison.result.differences.some(d => d.category === mutation.category));
      comparison.result.control = { name: options.control, positive_run_id: positive.run_id,
        positive_exit_code: positive.exit_code, applied: true, detected, expected_category: mutation.category };
      if (!detected) state(comparison.result, "inconclusive", ["control_not_detected"]);
      privateData = { manifest: m, reference: a, candidate: b, mutated_reference: ma,
        mutated_candidate: mb, positive, details: comparison.details };
    } else privateData = { manifest: m, reference: a, candidate: b, details: comparison.details };
    result = comparison.result;
    result.source_bytes = {
      manifest_sha256: hash(bytes),
      reference: Object.fromEntries(Object.entries(m.reference).map(([k, v]) => [k, v.sha256])),
      candidate: Object.fromEntries(Object.entries(m.candidate).map(([k, v]) => [k, v.sha256])),
    };
  } catch (error) {
    state(result, error instanceof ComparisonError ? error.overall : "inconclusive",
      [error instanceof ComparisonError ? error.category : "comparison_failed"]);
  }
  if (acquired) {
    try {
      await budget.wait(() => writeFile(join(options.outputDir, "comparison.json"),
        JSON.stringify(privateData ?? { errors: result.errors }), { mode: 0o600, flag: "wx", signal: budget.signal }));
      await budget.wait(() => writeFile(join(options.outputDir, "report.json"),
        JSON.stringify(result) + "\n", { mode: 0o600, flag: "wx", signal: budget.signal }));
    } catch (error) {
      state(result, "inconclusive", [...result.errors,
        error instanceof ComparisonError ? error.category : "private_output_failed"]);
    }
  }
  try { budget.check(); } catch { state(result, "inconclusive", [...result.errors, "run_deadline_exceeded"]); }
  budget.finish();
  return freeze(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), options = {};
  const flags = { "--inputs": "inputs", "--output-dir": "outputDir", "--control": "control" };
  let valid = args.length > 0 && args.length % 2 === 0;
  for (let i = 0; valid && i < args.length; i += 2) {
    const key = Object.hasOwn(flags, args[i]) ? flags[args[i]] : null;
    if (!key || Object.hasOwn(options, key) || args[i + 1].startsWith("--")) valid = false;
    else options[key] = args[i + 1];
  }
  const result = valid ? await runNativeComparison(options) : publicReport();
  if (!valid) state(result, "invalid_input", ["invalid_arguments"]);
  console.log(JSON.stringify(result));
  process.exitCode = result.exit_code;
}
