import { constants } from "node:fs";
import { open, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const PROFILE = "analytics-target-initial";
export const LIMITS = Object.freeze({
  request_timeout_ms: 10000, run_timeout_ms: 120000,
  max_response_bytes: 1048576, max_total_response_bytes: 8388608,
  max_requests: 24, max_pages: 1, max_items: 1000,
});
export class Failure extends Error {
  constructor(reason, state = "unverified", action = null) {
    super(reason);
    this.reason = reason;
    this.state = state;
    this.action = action;
  }
}
export const fail = (reason = "invalid_configuration", state, action) => { throw new Failure(reason, state, action); };
const requireValue = condition => { if (!condition) fail(); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
export const hash = value => createHash("sha256").update(value, "utf8").digest("hex");
export const equal = isDeepStrictEqual;

// Scan before JSON.parse: escaped duplicate keys and nesting are not detectable afterwards.
export function parseJson(text, maxDepth, reason = "invalid_configuration") {
  let index = 0;
  const reject = () => fail(reason);
  const whitespace = () => { while (/[ \n\r\t]/.test(text[index] ?? "") && index < text.length) index++; };
  const string = () => {
    const start = index++;
    while (index < text.length) {
      const char = text[index++];
      if (char === "\\") index++;
      else if (char === '"') {
        try { return JSON.parse(text.slice(start, index)); } catch { reject(); }
      }
    }
    reject();
  };
  const value = depth => {
    whitespace();
    const char = text[index];
    if (char === "{" || char === "[") {
      if (depth > maxDepth) reject();
      const closing = char === "{" ? "}" : "]";
      const keys = new Set();
      index++; whitespace();
      if (text[index] === closing) { index++; return; }
      while (index < text.length) {
        if (char === "{") {
          if (text[index] !== '"') reject();
          const key = string();
          if (keys.has(key) || forbidden.has(key)) reject();
          keys.add(key); whitespace();
          if (text[index++] !== ":") reject();
        }
        value(depth + 1); whitespace();
        if (text[index] === closing) { index++; return; }
        if (text[index++] !== ",") reject();
        whitespace();
      }
      reject();
    } else if (char === '"') string();
    else {
      const start = index;
      while (index < text.length && !/[,\]} \n\r\t]/.test(text[index])) index++;
      if (start === index) reject();
      try { JSON.parse(text.slice(start, index)); } catch { reject(); }
    }
  };
  value(1); whitespace();
  if (index !== text.length) reject();
  try { return JSON.parse(text); } catch { reject(); }
}

export async function readJson(path, credential = false) {
  let handle;
  try {
    const before = await lstat(path);
    requireValue(before.isFile() && !before.isSymbolicLink() && before.size <= 262144);
    if (credential) requireValue([0o400, 0o600].includes(before.mode & 0o7777) && before.uid === process.getuid());
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    requireValue(stat.isFile() && stat.ino === before.ino && stat.dev === before.dev && stat.size <= 262144);
    if (credential) requireValue([0o400, 0o600].includes(stat.mode & 0o7777) && stat.uid === process.getuid());
    const chunks = [];
    let bytes = 0;
    while (true) {
      const buffer = Buffer.alloc(16384);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      bytes += bytesRead;
      requireValue(bytes <= 262144);
      chunks.push(buffer.subarray(0, bytesRead));
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    const result = parseJson(text, 16);
    requireValue(object(result));
    return result;
  } catch (error) {
    if (error instanceof Failure) throw error;
    if (["ENOENT", "EACCES", "EPERM"].includes(error?.code)) {
      fail(credential ? "credentials_unavailable" : "missing_evidence");
    }
    fail();
  } finally {
    if (handle) await handle.close();
  }
}

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const result = {};
  const flags = { "--input": "input", "--routing-evidence": "routing", "--credential-secret-index": "index" };
  for (let index = 0; index < argv.length; index += 2) {
    requireValue(Object.hasOwn(flags, argv[index]));
    const key = flags[argv[index]];
    requireValue(key && !Object.hasOwn(result, key) && typeof argv[index + 1] === "string" && argv[index + 1].length > 0 && !argv[index + 1].startsWith("--"));
    result[key] = argv[index + 1];
  }
  requireValue(result.input);
  if (Object.hasOwn(result, "index")) {
    requireValue(/^(0|[1-9]\d*)$/.test(result.index) && Number.isSafeInteger(Number(result.index)));
    result.index = Number(result.index);
  }
  return result;
}
function closed(value, keys, optional = []) {
  requireValue(object(value));
  requireValue(Object.keys(value).every(key => keys.includes(key) || optional.includes(key)));
  requireValue(keys.every(key => Object.hasOwn(value, key)));
}
function literal(value, expected) { requireValue(value === expected); }
function text(value, max = 250) {
  requireValue(typeof value === "string" && value.length > 0 && value.length <= max);
  // Scalar references may contain spaces, but never control characters.
  // eslint-disable-next-line no-control-regex -- explicitly reject control characters in private inputs
  requireValue(!/[\u0000-\u001f\u007f]/u.test(value));
}
function identifier(value, max = 250, simple = false) {
  text(value, max);
  requireValue((simple ? /^[A-Za-z0-9_-]+$/ : /^[A-Za-z0-9_@.-]+$/).test(value));
  requireValue(![".", ".."].includes(value) && !forbidden.has(value));
}
function resourceId(value) {
  requireValue(typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)));
}
function digest(value) { requireValue(typeof value === "string" && /^[a-f0-9]{64}$/.test(value)); }
function boolean(value) { requireValue(typeof value === "boolean"); }
function array(value, max, validator) {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= max);
  for (const item of value) validator(item);
}
function distinct(value) { requireValue(new Set(value).size === value.length); }
export function utc(value) {
  // RFC3339 secfrac has one or more digits; the private file byte ceiling bounds its length.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return NaN;
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 19) !== value.slice(0, 19)) return NaN;
  return stamp;
}
function timestamp(value) { requireValue(Number.isFinite(utc(value))); }
function site(value) {
  closed(value, ["github_owner", "github_repo", "ref", "preview_origin"]);
  for (const key of ["github_owner", "github_repo", "ref"]) {
    identifier(value[key], 63, true);
    requireValue(/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/.test(value[key]));
  }
  const hostname = `${value.ref}--${value.github_repo}--${value.github_owner}`;
  requireValue(hostname.length <= 63);
  literal(value.preview_origin, `https://${hostname}.aem.page`);
}
function selectors(value) {
  closed(value, ["ims_org_id", "global_company_id", "report_suite_id", "target", "datastream", "site"]);
  for (const key of ["ims_org_id", "global_company_id", "report_suite_id"]) identifier(value[key]);
  requireValue(Buffer.byteLength(value.report_suite_id, "utf8") <= 40);
  const target = value.target;
  closed(target, ["tenant", "workspace_id", "property_id", "environment_id", "activity_id", "decision_scope", "offers"]);
  identifier(target.tenant, 64, true); identifier(target.workspace_id);
  for (const key of ["property_id", "environment_id", "activity_id"]) resourceId(target[key]);
  text(target.decision_scope, 100);
  requireValue(/^[A-Za-z0-9_.-]+$/.test(target.decision_scope) && !forbidden.has(target.decision_scope) &&
    ![".", "..", "target-global-mbox"].includes(target.decision_scope));
  array(target.offers, 2, offer => {
    closed(offer, ["id", "content_sha256"]); resourceId(offer.id); digest(offer.content_sha256);
  });
  requireValue(target.offers.length === 2); distinct(target.offers.map(offer => offer.id));
  closed(value.datastream, ["id", "configuration_context"]);
  identifier(value.datastream.id); identifier(value.datastream.configuration_context);
  site(value.site);
}
function ownerEvidence(value) {
  closed(value, ["kind", "schema_version", "observed_at", "expires_at", "provenance", "bindings", "credential_identity_sha256", "dedicated_resources"]);
  literal(value.kind, "airlock.adobe-preflight.owner-selection"); literal(value.schema_version, 1);
  timestamp(value.observed_at); timestamp(value.expires_at);
  closed(value.provenance, ["basis", "authority_ref", "record_ref"]);
  literal(value.provenance.basis, "owner-scoped-configuration");
  text(value.provenance.authority_ref); text(value.provenance.record_ref);
  selectors(value.bindings); digest(value.credential_identity_sha256);
  const names = ["analytics_suite", "target_property", "target_environment", "target_workspace", "target_activity", "target_offers", "site"];
  closed(value.dedicated_resources, names);
  for (const name of names) boolean(value.dedicated_resources[name]);
}
export function validateInput(value) {
  closed(value, ["kind", "schema_version", "profile", "approval", "selectors", "report_window"], ["scope_evidence", "limits"]);
  literal(value.kind, "airlock.adobe-preflight.input"); literal(value.schema_version, 1); literal(value.profile, PROFILE);
  closed(value.approval, ["mode", "approved_at", "expires_at", "authority_ref"]);
  literal(value.approval.mode, "read-only");
  timestamp(value.approval.approved_at); timestamp(value.approval.expires_at); text(value.approval.authority_ref);
  selectors(value.selectors);
  if (value.scope_evidence !== undefined) ownerEvidence(value.scope_evidence);
  closed(value.report_window, ["start", "end"]);
  for (const stamp of Object.values(value.report_window)) {
    requireValue(typeof stamp === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(stamp) && Number.isFinite(utc(stamp + "Z")));
  }
  const duration = Date.parse(value.report_window.end + "Z") - Date.parse(value.report_window.start + "Z");
  requireValue(duration > 0 && duration <= 86400000);
  if (value.limits !== undefined) {
    closed(value.limits, [], Object.keys(LIMITS));
    for (const [key, limit] of Object.entries(value.limits)) requireValue(Number.isSafeInteger(limit) && limit > 0 && limit <= LIMITS[key]);
  }
  return { ...LIMITS, ...value.limits };
}
export function validateCredentials(value, index) {
  closed(value, ["ORG_ID", "CLIENT_ID", "CLIENT_SECRETS", "SCOPES", "TECHNICAL_ACCOUNT_ID", "TECHNICAL_ACCOUNT_EMAIL"]);
  for (const key of ["ORG_ID", "CLIENT_ID", "TECHNICAL_ACCOUNT_ID"]) text(value[key]);
  text(value.TECHNICAL_ACCOUNT_EMAIL, 320);
  array(value.CLIENT_SECRETS, 16, secret => { text(secret, 8192); requireValue(Buffer.byteLength(secret) <= 8192); });
  array(value.SCOPES, 256, scope => { text(scope); requireValue(!/[,\s]/u.test(scope)); });
  distinct(value.SCOPES);
  requireValue(index !== undefined || value.CLIENT_SECRETS.length === 1);
  const chosen = index ?? 0;
  requireValue(chosen < value.CLIENT_SECRETS.length);
  return chosen;
}
export function validateRouting(value) {
  closed(value, ["kind", "schema_version", "basis", "observed_at", "assessment_completed_at", "expires_at", "provenance", "bindings", "selected_datastream_id", "analytics_report_suite_ids", "visible_enabled_services", "service_inventory_complete", "disabled_or_absent_services", "analytics_single_suite_matches_selected_suite", "property_token_api_sha256", "required_target_environment_id", "target_environment_pin_saved_owner_confirmed", "target_environment_pin_confirmation_source", "target_environment_pin_confirmed_at", "configuration_api_read_verified"]);
  literal(value.kind, "airlock.adobe-preflight.routing-evidence"); literal(value.schema_version, 1);
  literal(value.basis, "owner-ui-and-saved-pin-confirmation");
  for (const key of ["observed_at", "assessment_completed_at", "expires_at", "target_environment_pin_confirmed_at"]) timestamp(value[key]);
  closed(value.provenance, ["authority_ref", "record_ref", "screenshot_source", "screenshot_sha256"]);
  text(value.provenance.authority_ref); text(value.provenance.record_ref); literal(value.provenance.screenshot_source, "owner-supplied");
  array(value.provenance.screenshot_sha256, 3, digest); requireValue(value.provenance.screenshot_sha256.length === 3); distinct(value.provenance.screenshot_sha256);
  closed(value.bindings, ["ims_org_id", "global_company_id", "report_suite_id", "target_tenant", "target_workspace_id", "target_property_id", "target_environment_id", "datastream_id", "configuration_context", "site"]);
  for (const [key, item] of Object.entries(value.bindings)) {
    if (key === "site") site(item);
    else if (["target_property_id", "target_environment_id"].includes(key)) resourceId(item);
    else identifier(item);
  }
  identifier(value.selected_datastream_id); resourceId(value.required_target_environment_id);
  for (const key of ["analytics_report_suite_ids", "visible_enabled_services", "disabled_or_absent_services"]) {
    array(value[key], 256, item => identifier(item)); distinct(value[key]);
  }
  for (const key of ["service_inventory_complete", "analytics_single_suite_matches_selected_suite", "target_environment_pin_saved_owner_confirmed"]) boolean(value[key]);
  digest(value.property_token_api_sha256); text(value.target_environment_pin_confirmation_source);
  literal(value.configuration_api_read_verified, false);
}
function compareUtc(left, right) {
  // Validated UTC calendar strings sort by whole seconds, then by exact decimal fraction.
  // Date.parse is used for calendar validation, not for evidence ordering: it drops sub-ms digits.
  const secondsA = left.slice(0, 19), secondsB = right.slice(0, 19);
  if (secondsA !== secondsB) return secondsA < secondsB ? -1 : 1;
  const a = left[19] === "." ? left.slice(20, -1) : "";
  const b = right[19] === "." ? right.slice(20, -1) : "";
  const width = Math.max(a.length, b.length);
  const paddedA = a.padEnd(width, "0"), paddedB = b.padEnd(width, "0");
  return paddedA < paddedB ? -1 : paddedA > paddedB ? 1 : 0;
}
function fresh(observed, expires, start, deadline) {
  return compareUtc(observed, new Date(start).toISOString()) <= 0 &&
    compareUtc(observed, new Date(start - 86400000).toISOString()) >= 0 &&
    compareUtc(expires, new Date(deadline).toISOString()) > 0 && compareUtc(expires, observed) > 0;
}
export function evaluateScope(input, credentials, start, deadline) {
  const evidence = input.scope_evidence;
  if (!evidence) fail("missing_evidence");
  const approval = input.approval;
  if (!equal(evidence.bindings, input.selectors) || evidence.provenance.authority_ref !== approval.authority_ref ||
      Object.values(evidence.dedicated_resources).some(item => item !== true)) fail("scope_mismatch", "blocked");
  if (credentials && (credentials.ORG_ID !== input.selectors.ims_org_id ||
      evidence.credential_identity_sha256 !== hash(JSON.stringify([credentials.ORG_ID, credentials.CLIENT_ID, credentials.TECHNICAL_ACCOUNT_ID])))) {
    fail("scope_mismatch", "blocked", "correct_input");
  }
  if (compareUtc(approval.approved_at, new Date(start).toISOString()) > 0 ||
      compareUtc(approval.expires_at, new Date(deadline).toISOString()) <= 0 ||
      compareUtc(approval.expires_at, approval.approved_at) <= 0 ||
      !fresh(evidence.observed_at, evidence.expires_at, start, deadline)) fail("stale_evidence");
}
export function evaluateRouting(value, input, start, deadline, propertyToken) {
  if (!value) fail("missing_evidence");
  const observed = value.observed_at, completed = value.assessment_completed_at, pin = value.target_environment_pin_confirmed_at;
  const s = input.selectors, t = s.target;
  const expected = { ims_org_id: s.ims_org_id, global_company_id: s.global_company_id, report_suite_id: s.report_suite_id,
    target_tenant: t.tenant, target_workspace_id: t.workspace_id, target_property_id: t.property_id,
    target_environment_id: t.environment_id, datastream_id: s.datastream.id, configuration_context: s.datastream.configuration_context, site: s.site };
  if (!equal(value.bindings, expected) || value.selected_datastream_id !== s.datastream.id ||
      value.required_target_environment_id !== t.environment_id || value.provenance.authority_ref !== input.approval.authority_ref ||
      (propertyToken !== undefined && hash(propertyToken) !== value.property_token_api_sha256)) fail("scope_mismatch", "blocked");
  if (!value.target_environment_pin_saved_owner_confirmed) fail("unsafe_configuration", "blocked", "save_environment_pin");
  if (!equal([...value.visible_enabled_services].sort(), ["analytics", "target"]) ||
      !equal(value.analytics_report_suite_ids, [s.report_suite_id]) || !value.analytics_single_suite_matches_selected_suite) fail("unsafe_configuration", "blocked");
  if (!fresh(observed, value.expires_at, start, deadline) || !fresh(completed, value.expires_at, start, deadline) ||
      compareUtc(completed, observed) < 0 || compareUtc(pin, observed) < 0 || compareUtc(pin, completed) > 0) fail("stale_evidence");
  if (!value.service_inventory_complete ||
      !equal([...value.disabled_or_absent_services].sort(), ["aep", "ajo", "audience-manager", "event-forwarding"])) fail("missing_evidence");
}
