#!/usr/bin/env node
/**
 * 051-07: recorded JSON predicates only. No SDK, transport, browser, selectors
 * from environment, or independent provenance verification.
 */
import { types } from "node:util";
import { pathToFileURL } from "node:url";
import { Failure, fail, equal, parseJson, readJson } from "./contract.mjs";

const CASES = ["positive", "no-offer", "non-render", "no-consent"];
const CHECKS = ["routing", "consent", "collection", "notifications", "order"];
const COUNTS = ["requests", "consent_updates", "fetch_events", "page_events",
  "custom_events", "display_events", "interaction_events"];
const CLAIMS = ["actual_dispatch_verified", "sdk_execution_verified", "host_render_verified",
  "chamber_compatibility_verified", "downstream_receipt_verified", "full_wire_conformance_verified"];
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const OVERRIDES = new Set(["configOverrides", "edgeConfigOverrides", "sdkConfig"]);
const SCHEMAS = ["default-content-item", "html-content-item", "json-content-item",
  "redirect-item", "ruleset-item", "message/in-app", "message/content-card"]
  .map(name => `https://ns.adobe.com/personalization/${name}`);
const TYPES = ["decisioning.propositionFetch", "web.webpagedetails.pageViews",
  "web.webinteraction.linkClicks", "decisioning.propositionInteract"];
const MAPPINGS = ["pageName", "pageURL", "linkName", "linkType"];
const HELP = "Recorded stock payload checks only (not dispatch/SDK/DOM proof): --input <private JSON path> | --help\n";
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const requireInput = condition => { if (!condition) fail("invalid_input"); };

function freeze(value) {
  for (const child of Object.values(value)) if (object(child)) freeze(child);
  return Object.freeze(value);
}
function report(caseName = "invalid", overall = "invalid_input", exit = 2) {
  return {
    kind: "airlock.adobe-stock.wire-report", schema_version: 1, case: caseName,
    overall, exit_code: exit,
    checks: Object.fromEntries(CHECKS.map(k => [k, "not_exercised"])),
    counts: Object.fromEntries(COUNTS.map(k => [k, 0])),
    claims: Object.fromEntries(CLAIMS.map(k => [k, false])),
  };
}
function errorReport(error) {
  return freeze(error instanceof Failure && error.reason === "invalid_input"
    ? report() : report("invalid", "internal_failure", 3));
}

// Descriptor-only traversal: never call getters/toJSON or user proxy traps.
// Count serialized UTF8 bytes incrementally BEFORE serialization, including
// escaping, punctuation and keys. Repeated noncyclic references count each time.
function plainSnapshot(input) {
  let nodes = 0, bytes = 0;
  const ancestors = new Set();
  function add(size) { bytes += size; requireInput(bytes <= 262144); }
  function quoted(text) {
    requireInput(text.length <= 262144);
    add(Buffer.byteLength(JSON.stringify(text), "utf8"));
  }
  function visit(value, depth) {
    requireInput(++nodes <= 10000);
    if (value === null) { add(4); return null; }
    if (typeof value === "string") { quoted(value); return value; }
    if (typeof value === "boolean") { add(value ? 4 : 5); return value; }
    if (typeof value === "number") {
      requireInput(Number.isFinite(value)); add(JSON.stringify(value).length); return value;
    }
    requireInput(typeof value === "object" && !types.isProxy(value));
    const array = Array.isArray(value);
    requireInput(depth <= 16 && !ancestors.has(value));
    const proto = Object.getPrototypeOf(value);
    requireInput(array ? proto === Array.prototype : proto === Object.prototype || proto === null);
    const keys = Reflect.ownKeys(value);
    requireInput(keys.length <= 10001 && keys.every(k => typeof k === "string" && !FORBIDDEN.has(k)));
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireInput(keys.every(k => Object.hasOwn(descriptors[k], "value")
      && (array && k === "length" || descriptors[k].enumerable)));
    let members = keys;
    if (array) {
      const length = descriptors.length.value;
      requireInput(Number.isSafeInteger(length) && length >= 0 && length <= 10000
        && keys.length === length + 1);
      members = Array.from({ length }, (_, i) => String(i));
      requireInput(members.every(k => Object.hasOwn(descriptors, k)));
    }
    ancestors.add(value);
    add(2 + Math.max(0, members.length - 1)); // braces/brackets and commas
    const copy = array ? [] : Object.create(null);
    for (const key of members) {
      if (!array) { quoted(key); add(1); } // colon
      copy[key] = visit(descriptors[key].value, depth + 1);
    }
    ancestors.delete(value);
    return copy;
  }
  // Retain the existing parser's depth/prototype protections as well.
  return parseJson(JSON.stringify(visit(input, 1)), 16, "invalid_input");
}
function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length
    && keys.every(k => Object.hasOwn(value, k));
}
function closed(value, keys) { requireInput(exact(value, keys)); }
function text(value, max = 250) {
  requireInput(typeof value === "string" && value.length > 0 && value.length <= max);
  // eslint-disable-next-line no-control-regex -- private scalar controls are prohibited
  requireInput(!/[\u0000-\u001f\u007f-\u009f]/u.test(value));
}
function schema(v) {
  closed(v, ["kind", "schema_version", "sdk_pin", "case", "expected", "host", "proposition", "requests"]);
  requireInput(v.kind === "airlock.adobe-stock.wire-capture" && v.schema_version === 1
    && v.sdk_pin === "alloy-2.31.1" && CASES.includes(v.case));
  closed(v.expected, ["datastream_id", "decision_scope", "page_name", "custom_name", "page_url"]);
  for (const k of ["datastream_id", "page_name", "custom_name"]) text(v.expected[k]);
  text(v.expected.decision_scope, 100);
  requireInput(/^[A-Za-z0-9_.-]+$/.test(v.expected.decision_scope)
    && !FORBIDDEN.has(v.expected.decision_scope)
    && ![".", "..", "target-global-mbox"].includes(v.expected.decision_scope));
  requireInput(v.expected.page_name !== v.expected.custom_name);
  text(v.expected.page_url, 2048);
  let url;
  try { url = new URL(v.expected.page_url); } catch { fail("invalid_input"); }
  requireInput(url.protocol === "https:" && !url.username && !url.password && !url.hash
    && !v.expected.page_url.includes("#") && url.href === v.expected.page_url);
  closed(v.host, ["rendered", "clicked"]);
  requireInput(typeof v.host.rendered === "boolean" && typeof v.host.clicked === "boolean");
  if (v.proposition !== null) {
    closed(v.proposition, ["id", "scope", "scopeDetails"]);
    text(v.proposition.id); text(v.proposition.scope, 100);
    requireInput(object(v.proposition.scopeDetails));
  }
  requireInput(Array.isArray(v.requests) && v.requests.length <= 8);
  for (const r of v.requests) {
    closed(r, ["path", "config_id", "body"]);
    text(r.path); text(r.config_id); requireInput(object(r.body));
  }
}
function field(v, ...keys) {
  for (const key of keys) {
    if (!object(v) || !Object.hasOwn(v, key)) return undefined;
    v = v[key];
  }
  return v;
}
function has(v, key) { return object(v) && Object.hasOwn(v, key); }
function noMappings(a, keys = MAPPINGS) {
  return a === undefined || object(a) && keys.every(k => !has(a, k));
}
function sdkContainers(event) {
  // Additive JSON is not a license to malformed known SDK containers.
  return [["data"], ["data", "__adobe"], ["data", "__adobe", "analytics"],
    ["xdm", "web"], ["xdm", "web", "webPageDetails"], ["xdm", "web", "webInteraction"],
    ["xdm", "_experience"], ["xdm", "_experience", "decisioning"]]
    .every(keys => {
      const parent = keys.length === 1 ? event : field(event, ...keys.slice(0, -1));
      const key = keys.at(-1);
      return !has(parent, key) || object(parent[key]);
    });
}
function noDecision(event) {
  return field(event, "xdm", "_experience", "decisioning") === undefined;
}
function notification(event, flag, proposition) {
  const d = field(event, "xdm", "_experience", "decisioning");
  return exact(field(d, "propositionEventType"), [flag])
    && d.propositionEventType[flag] === 1
    && Array.isArray(d.propositions) && d.propositions.length === 1
    && equal(d.propositions[0], proposition);
}
function hasOverride(value) {
  return value !== null && typeof value === "object" && Object.entries(value)
    .some(([key, child]) => OVERRIDES.has(key) || hasOverride(child));
}
function bodyQuery(body) {
  if (!has(body, "query")) return true;
  return exact(body.query, ["identity"]) && exact(body.query.identity, ["fetch"])
    && equal(body.query.identity.fetch, ["ECID"]);
}
function consentValue(body, val) {
  if (!Array.isArray(body.consent) || body.consent.length !== 1) return false;
  const c = body.consent[0];
  return field(c, "standard") === "Adobe" && field(c, "version") === "2.0"
    && field(c, "value", "collect", "val") === val
    && field(c, "value", "personalize", "content", "val") === val
    && field(c, "value", "marketing", "any", "val") === "n"
    && field(c, "value", "share", "val") === "n" && !has(body, "events");
}

function evaluate(v) {
  const out = report(v.case, "capture_checks_passed", 0);
  const ok = Object.fromEntries(CHECKS.map(k => [k, true]));
  const expected = v.expected, c = out.counts, timeline = [];
  const denied = v.case === "no-consent", positive = v.case === "positive";
  c.requests = v.requests.length;
  if (hasOverride(v)) ok.routing = false;
  const propositionValid = v.proposition !== null
    && v.proposition.scope === expected.decision_scope
    && v.proposition.scopeDetails.decisionProvider === "TGT";
  if ((positive || v.case === "non-render") ? !propositionValid : v.proposition !== null) {
    ok.notifications = false;
  }
  if (v.host.rendered !== positive || v.host.clicked !== !denied) ok.notifications = false;

  for (const r of v.requests) {
    const match = /^\/ee\/(?:(?:or2|va6|irl1|ind1|jpn3|sgp3|aus3)\/)?v1\/(interact|collect|privacy\/set-consent)$/.exec(r.path);
    if (!match || r.config_id !== expected.datastream_id) ok.routing = false;
    const route = match?.[1];
    const body = r.body;
    if (!bodyQuery(body)) ok.collection = false;
    if (has(body, "consent")) {
      c.consent_updates += Array.isArray(body.consent) ? body.consent.length : 1;
      timeline.push("consent");
      if (route !== "privacy/set-consent") ok.routing = false;
      if (!consentValue(body, denied ? "n" : "y")) ok.consent = false;
    } else if (route === "privacy/set-consent") ok.consent = false;
    if (has(body, "events")) {
      if (route !== "interact" && route !== "collect") ok.routing = false;
      if (has(body, "consent")) ok.consent = false;
      if (!Array.isArray(body.events) || !body.events.length || body.events.length > 4) {
        ok.collection = false;
      }
      if (!Array.isArray(body.events)) continue;
      for (const e of body.events) {
        const type = field(e, "xdm", "eventType");
        const index = TYPES.indexOf(type);
        timeline.push(index < 0 ? "unknown" : ["fetch", "page", "custom", "interact"][index]);
        const d = field(e, "xdm", "_experience", "decisioning");
        if (has(field(d, "propositionEventType"), "display")) c.display_events++;
        if (index >= 0) c[["fetch_events", "page_events", "custom_events", "interaction_events"][index]]++;
        if (index < 0) { ok.collection = false; ok.notifications = false; continue; }
        const a = field(e, "data", "__adobe", "analytics");
        const page = field(e, "xdm", "web", "webPageDetails");
        const link = field(e, "xdm", "web", "webInteraction");
        if (!sdkContainers(e) || index !== 1 && has(page, "pageViews")
          || index !== 2 && has(link, "linkClicks")) ok.collection = false;
        if (index !== 0 && has(e, "query")) ok.collection = false;
        if (index === 0) {
          const q = field(e, "query"), p = field(q, "personalization");
          if (field(page, "URL") !== expected.page_url || !noMappings(a)
            || !exact(q, ["personalization"]) || !exact(p, ["schemas", "decisionScopes", "surfaces"])
            || !equal(p.schemas, SCHEMAS) || !equal(p.decisionScopes, [expected.decision_scope])
            || !equal(p.surfaces, [])) ok.collection = false;
        } else if (index === 1) {
          if (field(page, "name") !== expected.page_name || field(page, "URL") !== expected.page_url
            || field(page, "pageViews", "value") !== 1
            || field(a, "pageName") !== expected.page_name || field(a, "pageURL") !== expected.page_url
            || !noMappings(a, ["linkName", "linkType"]) || has(link, "linkClicks")) ok.collection = false;
        } else if (index === 2) {
          if (field(link, "name") !== expected.custom_name || field(link, "type") !== "other"
            || field(link, "linkClicks", "value") !== 1 || field(a, "linkType") !== "o"
            || field(a, "linkName") !== expected.custom_name || !noMappings(a, ["pageName", "pageURL"])
            || has(page, "pageViews")) ok.collection = false;
        } else if (!noMappings(a)) ok.collection = false;
        if (positive && (index === 1 || index === 3)) {
          if (!notification(e, index === 1 ? "display" : "interact", v.proposition)) ok.notifications = false;
        } else if (!noDecision(e)) ok.notifications = false;
      }
    } else if (!has(body, "consent")) ok.collection = false;
  }
  if (denied ? c.consent_updates > 1 : c.consent_updates !== 1) ok.consent = false;
  const wanted = denied ? [0, 0, 0, 0] : [1, 1, 1, positive ? 1 : 0];
  if (![c.fetch_events, c.page_events, c.custom_events, c.interaction_events]
    .every((n, i) => n === wanted[i]) || denied && timeline.some(t => t !== "consent")) {
    ok.collection = false;
  }
  if (c.display_events !== (positive ? 1 : 0)) ok.notifications = false;
  let granted = false, fetched = false;
  for (const phase of timeline) {
    if (phase === "consent") granted = true;
    else {
      if (!granted || phase !== "fetch" && !fetched) ok.order = false;
      if (phase === "fetch") fetched = true;
    }
  }
  for (const k of CHECKS) out.checks[k] = ok[k] ? "passed" : "failed";
  if (!c.requests && ok.routing) out.checks.routing = "not_exercised";
  if (!c.consent_updates && ok.consent) out.checks.consent = "not_exercised";
  if (denied && timeline.every(t => t === "consent")) {
    if (ok.collection) out.checks.collection = "not_exercised";
    if (ok.order) out.checks.order = "not_exercised";
    if (ok.notifications) out.checks.notifications = "not_exercised";
  }
  if (Object.values(ok).some(pass => !pass)) {
    out.overall = "capture_checks_failed"; out.exit_code = 1;
  }
  return freeze(out);
}

/** Pure, descriptor-safe, bounded recorded-value checker; never returns input fields. */
export function checkStockWire(value) {
  try {
    const v = plainSnapshot(value);
    schema(v);
    return evaluate(v);
  } catch (error) { return errorReport(error); }
}

/** Only --input <path> or --help. Streams are the sole output seam; return exit enum. */
export async function runWireCli({ argv, stdout, stderr }) {
  let result;
  try {
    let args;
    try { args = plainSnapshot(argv); }
    catch (error) {
      if (error instanceof Failure) fail("invalid_invocation");
      throw error;
    }
    if (Array.isArray(args) && args.length === 1 && args[0] === "--help") {
      stdout.write(HELP); return 0;
    }
    if (!Array.isArray(args) || args.length !== 2 || args[0] !== "--input"
      || typeof args[1] !== "string" || !args[1] || args[1].startsWith("--")
      // eslint-disable-next-line no-control-regex -- do not admit control/NUL path handles
      || /[\u0000-\u001f\u007f-\u009f]/u.test(args[1])) {
      fail("invalid_invocation");
    }
    // Reader failures are explicit invalid-input refusals, never missing-evidence passes.
    let value;
    try { value = await readJson(args[1], true); }
    catch (error) {
      if (error instanceof Failure) fail("invalid_input");
      throw error;
    }
    result = checkStockWire(value);
  } catch (error) {
    result = error instanceof Failure
      ? freeze(report("invalid", error.reason === "invalid_input" ? "invalid_input" : "invalid_invocation", 2))
      : freeze(report("invalid", "internal_failure", 3));
  }
  stdout.write(JSON.stringify(result) + "\n");
  if (result.exit_code) stderr.write(result.overall + "\n");
  return result.exit_code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runWireCli({
    argv: process.argv.slice(2), stdout: process.stdout, stderr: process.stderr,
  });
}
