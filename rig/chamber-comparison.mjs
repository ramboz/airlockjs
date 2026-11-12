// 059-17: OFFLINE attempted-request diagnostic, never native qualification.
import { unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual as equal } from "node:util";
import { performance } from "node:perf_hooks";
import { inspectNativeAttempt } from "./native-tag-comparison.mjs";
import { inspectCapture } from "./chamber-capture.mjs";
import { canonical, check, createOutput, digest, EvidenceError, evidenceSession,
  fail, keys, plain, sha256, writeExclusive } from "./attempt-evidence-io.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA = "airlock.attempt-chamber-comparison.v1";
const CAPTURE = "airlock.sdk-absent-chamber-capture.v1";
const FILES = ["start.json", "capture.json", "report.json", "publication.json", "witness.json"];
const PINS = ["profile", "node_version", "browser_version", "os_release", "macos_version",
  "runtime_sha256", "configuration_sha256", "network_policy_sha256"];
const SOURCE_CLOSURE = ["rig/chamber-comparison.mjs", "rig/chamber-comparison.test.mjs",
  "rig/chamber-comparison.md", "rig/attempt-evidence-io.mjs", "rig/native-tag-comparison.mjs",
  "rig/native-tag-comparison.test.mjs", "rig/chamber-capture.mjs", "rig/chamber-capture.test.mjs"];
const DIRECT_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const CLAIMS = Object.freeze({ native_qualified: false, vendor_qualified: false, whole_wire: false,
  full_replacement: false, attribution: false, C2: false, C3: false, sdk_dispatch: false,
  native_acceptance: false, equivalent_inputs: false });
const UNAVAILABLE = ["native_final_headers", "native_vendor_responses", "native_cookie_acceptance",
  "redirect_fanout_edges", "browser_host_effects", "equivalent_inputs_consent_cohorts",
  "replacement_behavior", "vendor_outcomes", "C2", "C3"];
const EXCLUSIONS = ["reference_fixture", "reference_sources", "reference_other_cases", "reference_guard",
  "chamber_fixture_sources", "chamber_other_cases", "observer_metadata", "generated_fixture_metadata"];
const CATEGORIES = ["sequence", "missing_request", "extra_request", "url", "query", "method",
  "resource_type", "body", "kind"];
const SENTINELS = ["[redacted]", "<redacted>", "***", "[removed]", "[masked]"];
const text = value => typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= 2097152;
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function redacted(value) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "redacted" || SENTINELS.some(s => lower.includes(s));
  }
  return value && typeof value === "object" && Object.values(value).some(redacted);
}
function handle(value) {
  keys(value, ["path", "sha256"]); canonical(value.path); check(digest(value.sha256), "invalid_manifest");
}
function manifest(value) {
  keys(value, ["schema", "profile", "case", "expected_pins", "reference", "chamber"]);
  check(value.schema === SCHEMA && ["meta-pageview", "google-ads-conversion"].includes(value.profile)
    && value.case === "baseline", "invalid_manifest");
  keys(value.expected_pins, PINS);
  check(value.expected_pins.profile === value.profile, "invalid_manifest");
  for (const p of PINS) {
    if (p === "configuration_sha256" && value.profile === "google-ads-conversion"
      && value.expected_pins[p] === null) continue;
    check(p.endsWith("sha256") ? digest(value.expected_pins[p]) : text(value.expected_pins[p]), "invalid_manifest");
  }
  keys(value.reference, ["report", "capture", "completion"]); Object.values(value.reference).forEach(handle);
  keys(value.chamber, ["output", "command"]); canonical(value.chamber.output); handle(value.chamber.command);
  const paths = [...Object.values(value.reference).map(v => v.path), value.chamber.command.path];
  check(new Set(paths).size === paths.length
    && paths.every(p => !p.startsWith(value.chamber.output + "/")), "ambiguous_handles");
}
function requestShape(row) {
  keys(row, ["url", "query_pairs", "method", "resource_type", "body_state", "body_base64", "kind"]);
  check(text(row.url) && text(row.method) && text(row.resource_type)
    && ["measurement", "companion"].includes(row.kind), "invalid_request");
  let url;
  try { url = new URL(row.url); } catch { fail("invalid_request"); }
  check(["http:", "https:"].includes(url.protocol) && Array.isArray(row.query_pairs)
    && row.query_pairs.length <= 256 && row.query_pairs.every(p => Array.isArray(p)
      && p.length === 2 && p.every(x => typeof x === "string"))
    && equal([...url.searchParams], row.query_pairs), "invalid_request");
  check(["absent", "captured"].includes(row.body_state)
    && (row.body_state === "absent" ? row.body_base64 === null
      : typeof row.body_base64 === "string" && Buffer.byteLength(row.body_base64) <= 2097152
        && Buffer.from(row.body_base64, "base64").toString("base64") === row.body_base64), "invalid_body");
  check(!redacted(row) && (row.body_state !== "captured"
    || !redacted(Buffer.from(row.body_base64, "base64").toString("utf8"))), "redacted_evidence");
}
// Raw mechanics control, NOT a source validator or a qualification interface.
// Fixed field list; no callbacks, identities, URL rewrites or normalization.
export function compareObservedAttempts(reference, chamber) {
  const session = evidenceSession();
  check(Array.isArray(reference) && reference.length > 0 && reference.length <= 256
    && Array.isArray(chamber) && chamber.length > 0 && chamber.length <= 64, "request_limit_or_empty");
  [...reference, ...chamber].forEach(requestShape);
  const differences = [], counts = { reference_requests: reference.length,
    chamber_requests: chamber.length, equal_requests: 0, differences: 0 };
  const add = (category, ordinal, a, b) => {
    session.check(); check(differences.length < 128, "difference_limit");
    differences.push({ category, ordinal, reference: a, chamber: b });
  };
  if (reference.length !== chamber.length) add("sequence", null, reference.length, chamber.length);
  for (let i = 0; i < Math.max(reference.length, chamber.length); i++) {
    const a = reference[i], b = chamber[i], before = differences.length;
    if (!a) add("extra_request", i, null, b);
    else if (!b) add("missing_request", i, a, null);
    else {
      for (const [category, fields] of [
        ["url", ["url"]], ["query", ["query_pairs"]], ["method", ["method"]],
        ["resource_type", ["resource_type"]], ["body", ["body_state", "body_base64"]], ["kind", ["kind"]],
      ]) if (fields.some(k => !equal(a[k], b[k])))
        add(category, i, Object.fromEntries(fields.map(k => [k, a[k]])),
          Object.fromEntries(fields.map(k => [k, b[k]])));
      if (before === differences.length) counts.equal_requests++;
    }
  }
  counts.differences = differences.length;
  return freeze({ counts, differences });
}
function report() {
  return { schema: SCHEMA + ".public", overall: "inconclusive", exit_code: 2, errors: [],
    counts: { reference_requests: 0, chamber_requests: 0, equal_requests: 0, differences: 0,
      source_validations: 0, excluded_reference_requests: 0, excluded_chamber_observations: 0 },
    differences: Object.fromEntries(CATEGORIES.map(k => [k, 0])),
    exclusions: Object.fromEntries(EXCLUSIONS.map(k => [k, 0])),
    unavailable: Object.fromEntries(UNAVAILABLE.map(k => [k, 1])), claims: CLAIMS };
}
function outcome(result, overall, errors = []) {
  result.overall = overall;
  result.exit_code = { nonconformant: 1, inconclusive: 2, invalid_input: 3 }[overall];
  result.errors = errors;
}
function readHandle(session, value, maximum = 2097152) {
  return session.json(value.path, maximum, value.sha256);
}
function wholeCli(session, m, raw) {
  const command = readHandle(session, m.chamber.command);
  keys(command, ["schema", "output", "pid", "started_ms", "closed_ms", "duration_ms", "exit_code",
    "signal", "timeout", "source_before", "source_after", "files", "stdout", "stderr"]);
  check(command.schema === "airlock.chamber-whole-cli-witness.v1" && command.output === m.chamber.output
    && Number.isSafeInteger(command.pid) && command.pid > 0 && command.exit_code === 0
    && command.signal === null && command.timeout === false, "outer_completion_invalid");
  check(Number.isSafeInteger(command.started_ms) && Number.isSafeInteger(command.closed_ms)
    && command.closed_ms >= command.started_ms && command.closed_ms <= Date.now()
    && Number.isFinite(command.duration_ms) && command.duration_ms >= 0 && command.duration_ms <= 60000
    && command.closed_ms - command.started_ms <= 60000
    && Math.abs(command.duration_ms - (command.closed_ms - command.started_ms)) <= 1000,
  "outer_chronology_invalid");
  check(typeof command.stdout === "string" && typeof command.stderr === "string"
    && Buffer.byteLength(command.stdout) + Buffer.byteLength(command.stderr) <= 65536, "outer_completion_invalid");
  const paths = ["rig/chamber-capture.mjs", "rig/chamber-capture.test.mjs"].map(p => join(ROOT, p));
  keys(command.source_before, paths); keys(command.source_after, paths);
  check(equal(command.source_before, command.source_after), "outer_source_changed");
  for (const p of paths) session.read(p, 2097152, command.source_before[p], true);
  keys(command.files, FILES);
  for (const name of FILES) session.read(join(m.chamber.output, name), 8388608, command.files[name]);
  const start = session.json(join(m.chamber.output, "start.json"), 8388608);
  const inner = session.json(join(m.chamber.output, "witness.json"), 8388608);
  check(start.control === "none" && Number.isSafeInteger(start.started_ms)
    && start.started_ms === raw.lifecycle.started_ms && start.started_ms >= command.started_ms
    && Number.isSafeInteger(inner.child?.closed_ms) && Number.isSafeInteger(inner.observed_ms)
    && inner.child.closed_ms >= start.started_ms && inner.observed_ms >= inner.child.closed_ms
    && inner.observed_ms <= command.closed_ms, "outer_chronology_invalid");
  return command;
}
function sourceShape(raw) {
  keys(raw, ["schema", "run_id", "identity", "caps", "claims", "origin", "assets", "fixture_sha256",
    "forbidden_sha256", "browser_version", "browser_process", "acquisitions", "cases", "errors", "lifecycle", "cleanup"]);
  check(raw.schema === CAPTURE && Array.isArray(raw.cases), "unsupported_chamber_schema");
  let observations = 0;
  for (const c of raw.cases) {
    keys(c, ["vendor", "control", "positive", "workers", "targets", "sources", "worker_traffic",
      "traffic", "input", "worker_options", "http", "sinks", "marker", "blocked", "observations",
      "errors", "receiver"]);
    check(["meta", "google"].includes(c.vendor) && ["positive", "main-only", "event-drop",
      "source-enforced", "source-bypass"].includes(c.control)
      && Array.isArray(c.http), "unknown_chamber_category");
    keys(c.observations, ["installed_before_navigation"]);
    if (c.worker_options !== null) keys(c.worker_options, ["type"]);
    const source = s => keys(s, ["url", "script_id", "body", "sha256"]);
    for (const s of c.sources) source(s);
    for (const w of c.workers) {
      keys(w, ["url", "execution", "source"]); source(w.source);
      keys(w.execution, ["actual_worker_global", "document_absent", "location"]);
    }
    for (const t of c.targets) { keys(t, ["target_id", "type", "url", "source"]); source(t.source); }
    for (const t of c.traffic) keys(t, ["direction", "url", "value"]);
    for (const t of c.worker_traffic) keys(t, ["direction", "value"]);
    for (const b of c.blocked) keys(b, ["url", "resource"]);
    for (const s of [...c.sinks, ...c.receiver]) {
      keys(s, ["url", "method", "headers", "body", "response"]);
      keys(s.response, ["status", "headers", "body"]);
    }
    for (const r of c.http) {
      keys(r, ["id", "url", "method", "resource", "request", "body", "extra", "response", "failed"]);
      check(["Document", "Script", "Fetch", "XHR"].includes(r.resource), "unknown_chamber_category");
      keys(r.body, ["state", "base64"]);
      check(["absent", "unavailable"].includes(r.body.state) && r.body.base64 === null, "invalid_body");
      observerShape(r);
    }
    observations += c.http.length;
  }
  check(observations <= 64, "observation_limit");
  check(!redacted(raw), "redacted_evidence");
}
// Closed retained CDP observer shapes. Optional fields are known protocol
// metadata, not arbitrary extension points. Values/headers remain in PRIVATE
// originals; their final/browser/sink relationships still belong to inspectCapture.
function known(value, fields) {
  check(plain(value) && Object.keys(value).every(k => fields.includes(k)), "unknown_observer_field");
}
function observerShape(r) {
  const request = value => known(value, ["url", "method", "headers", "mixedContentType",
    "initialPriority", "referrerPolicy", "isSameSite", "hasPostData", "postData", "postDataEntries"]);
  const stack = value => {
    known(value, ["callFrames"]);
    for (const frame of value.callFrames ?? [])
      keys(frame, ["functionName", "scriptId", "url", "lineNumber", "columnNumber"]);
  };
  known(r.request, ["requestId", "loaderId", "documentURL", "request", "timestamp", "wallTime",
    "initiator", "redirectHasExtraInfo", "type", "frameId", "hasUserGesture", "renderBlockingBehavior"]);
  if (r.request.request) request(r.request.request);
  if (r.request.initiator) {
    known(r.request.initiator, ["type", "stack", "url"]);
    if (r.request.initiator.stack) stack(r.request.initiator.stack);
  }
  if (r.extra) {
    known(r.extra, ["requestId", "associatedCookies", "headers", "connectTiming",
      "siteHasCookieInOtherPartition", "clientSecurityState"]);
    check(!r.extra.associatedCookies?.length, "unsupported_cookie_evidence");
    if (r.extra.connectTiming) keys(r.extra.connectTiming, ["requestTime"]);
    if (r.extra.clientSecurityState) keys(r.extra.clientSecurityState,
      ["initiatorIsSecureContext", "initiatorIPAddressSpace", "localNetworkAccessRequestPolicy"]);
  }
  if (r.failed) known(r.failed, ["requestId", "timestamp", "type", "errorText", "canceled", "blockedReason"]);
  if (!r.response) return;
  const response = r.response;
  known(response, ["status", "extra", "fetch", "body", "event"]);
  if (response.body) keys(response.body, ["state", "base64"]);
  if (response.extra) {
    known(response.extra, ["requestId", "blockedCookies", "headers", "resourceIPAddressSpace",
      "statusCode", "headersText", "cookiePartitionKey", "cookiePartitionKeyOpaque", "exemptedCookies"]);
    check(!response.extra.blockedCookies?.length && !response.extra.exemptedCookies?.length, "unsupported_cookie_evidence");
    if (response.extra.cookiePartitionKey) keys(response.extra.cookiePartitionKey, ["topLevelSite", "hasCrossSiteAncestor"]);
  }
  if (response.fetch) {
    known(response.fetch, ["requestId", "request", "frameId", "resourceType", "responseStatusCode",
      "responseStatusText", "responseHeaders", "networkId"]);
    if (response.fetch.request) request(response.fetch.request);
    for (const h of response.fetch.responseHeaders ?? []) keys(h, ["name", "value"]);
  }
  if (response.event) {
    known(response.event, ["requestId", "loaderId", "timestamp", "type", "response", "hasExtraInfo", "frameId"]);
    if (response.event.response) {
      const e = response.event.response;
      known(e, ["url", "status", "statusText", "headers", "mimeType", "charset", "connectionReused",
        "connectionId", "remoteIPAddress", "remotePort", "fromDiskCache", "fromServiceWorker",
        "fromPrefetchCache", "encodedDataLength", "timing", "responseTime", "protocol",
        "alternateProtocolUsage", "securityState"]);
      if (e.timing) known(e.timing, ["requestTime", "proxyStart", "proxyEnd", "dnsStart", "dnsEnd",
        "connectStart", "connectEnd", "sslStart", "sslEnd", "workerStart", "workerReady",
        "workerFetchStart", "workerRespondWithSettled", "sendStart", "sendEnd", "pushStart",
        "pushEnd", "receiveHeadersStart", "receiveHeadersEnd"]);
    }
  }
}
function project(native, raw, profile, result) {
  const rows = native.capture.requests;
  check(native.report.profile === profile, "native_profile_mismatch");
  check(Array.isArray(rows) && rows.length <= 256, "request_limit_or_empty");
  const allowed = ["fixture_document", "runtime", "configuration", "fixture_favicon",
    "native_measurement", "native_auxiliary", "http_tripwire"];
  const cases = ["guard-tripwire", "baseline", "query-disabled", "value1", "value2",
    ...(profile === "meta-pageview" ? ["consent-revoked"] : [])];
  check(rows.every(r => allowed.includes(r.category) && cases.includes(r.case)), "unknown_native_category");
  const reference = [];
  for (const r of rows) {
    if (r.case === "baseline" && ["native_measurement", "native_auxiliary"].includes(r.category)) {
      reference.push({ url: r.url, query_pairs: r.query_pairs, method: r.method,
        resource_type: r.resource_type, body_state: r.body_state, body_base64: r.body_base64,
        kind: r.category === "native_measurement" ? "measurement" : "companion" });
    } else {
      const category = r.case === "guard-tripwire" ? "reference_guard"
        : r.case !== "baseline" ? "reference_other_cases" : ["runtime", "configuration"].includes(r.category)
          ? "reference_sources" : "reference_fixture";
      result.exclusions[category]++;
      result.counts.excluded_reference_requests++;
    }
    result.exclusions.observer_metadata += ["ordinal", "observed_at", "network_id"].filter(k => Object.hasOwn(r, k)).length;
    if (r.local_response?.provenance === "generated_synthetic") result.exclusions.generated_fixture_metadata += 2;
  }
  const vendor = profile === "meta-pageview" ? "meta" : "google";
  const positives = raw.cases.filter(c => c.control === "positive" && c.vendor === vendor);
  check(positives.length === 1 && positives[0].positive === vendor + "-positive", "chamber_case_mismatch");
  const chamber = [];
  for (const c of raw.cases) for (const r of c.http) {
    if (c === positives[0] && ["Fetch", "XHR"].includes(r.resource)) {
      chamber.push({ url: r.url, query_pairs: [...new URL(r.url).searchParams], method: r.method,
        resource_type: r.resource, body_state: r.body.state === "absent" ? "absent" : "captured",
        body_base64: r.body.base64, kind: "measurement" });
    } else {
      result.exclusions[c === positives[0] ? "chamber_fixture_sources" : "chamber_other_cases"]++;
      result.counts.excluded_chamber_observations++;
    }
    result.exclusions.observer_metadata += Object.hasOwn(r, "id") ? 1 : 0;
  }
  check(reference.some(r => r.kind === "measurement"), "request_limit_or_empty");
  return { reference, chamber, positive: positives[0] };
}
function context(native, raw, positive, profile) {
  return {
    reference_identity: Object.fromEntries([...PINS, "mode", "platform"].map(k => [k, native.report[k] ?? null])),
    chamber_identity: raw.identity, chamber_browser_version: raw.browser_version,
    chamber_mode: "headless", chamber_source: "legacy_subset", chamber_consent: "explicit_host_grant",
    reference_consent: native.capture.cases.find(c => c.name === "baseline")?.consent ?? null,
    reference_source: native.capture.source, reference_case: "baseline",
    chamber_case: positive.positive, chamber_input: positive.input,
    reference_input: native.capture.cases.find(c => c.name === "baseline") ?? null,
    reference_event: profile === "meta-pageview" ? "PageView" : "conversion",
    chamber_event: "page_view", equivalent_inputs: false, equivalent_cohorts: false,
    equivalent_consent: false, equivalent_endpoints: false,
    reference_headers: "available_cdp_request_stage_headers",
    chamber_headers: "final_browser_and_independent_receiver",
    unavailable: UNAVAILABLE,
  };
}
export function parseArgs(args) {
  check(Array.isArray(args) && args.length === 4, "invalid_options");
  const options = {}, flags = { "--inputs": "inputs", "--output-dir": "outputDir" };
  for (let i = 0; i < args.length; i += 2) {
    check(Object.hasOwn(flags, args[i]) && !Object.hasOwn(options, flags[args[i]]), "invalid_options");
    options[flags[args[i]]] = canonical(args[i + 1]);
  }
  keys(options, ["inputs", "outputDir"]); return options;
}
export async function runChamberComparison(options) {
  const session = evidenceSession(DIRECT_CLI ? 0 : performance.now()), result = report();
  let acquired = false, stage = "options";
  try {
    keys(options, ["inputs", "outputDir"]); canonical(options.inputs); canonical(options.outputDir);
    stage = "manifest";
    const m = session.json(options.inputs, 65536); manifest(m);
    check(options.inputs !== options.outputDir && !options.inputs.startsWith(options.outputDir + "/")
      && !options.outputDir.startsWith(m.chamber.output + "/"), "unsafe_output");
    stage = "output"; createOutput(options.outputDir); acquired = true;
    for (const source of SOURCE_CLOSURE) session.read(join(ROOT, source), 2097152, undefined, true);
    stage = "native";
    // Pre-read originals for raw ambiguity, privacy, bounds and immutability.
    for (const h of Object.values(m.reference)) readHandle(session, h);
    const native = await inspectNativeAttempt({ reference: m.reference, expected_pins: m.expected_pins });
    session.check(); result.counts.source_validations++;
    stage = "chamber";
    session.tree(m.chamber.output);
    const raw = session.json(join(m.chamber.output, "capture.json"), 8388608); sourceShape(raw);
    const qualification = await inspectCapture(m.chamber.output);
    session.check();
    check(qualification.schema === CAPTURE + ".qualification" && qualification.guard_qualification === "PASS"
      && qualification.case_conclusive === true && qualification.child_exit_code === 0
      && qualification.legacy_subset_source === true && qualification.local_only === true
      && qualification.native_qualified === false && qualification.whole_wire === false
      && qualification.capture_sha256 === sha256(session.read(join(m.chamber.output, "capture.json"), 8388608)),
    "chamber_unqualified");
    stage = "outer";
    const command = wholeCli(session, m, raw);
    result.counts.source_validations++;
    stage = "diagnostic";
    const projected = project(native, raw, m.profile, result);
    const comparison = compareObservedAttempts(projected.reference, projected.chamber);
    Object.assign(result.counts, comparison.counts);
    for (const d of comparison.differences) result.differences[d.category]++;
    outcome(result, comparison.differences.length ? "nonconformant" : "inconclusive");
    const privateData = { schema: SCHEMA + ".private", manifest: m, reference: native,
      chamber: { capture: raw, qualification, command }, context: context(native, raw, projected.positive, m.profile),
      projected, differences: comparison.differences, source_snapshots: session.snapshots() };
    stage = "publication";
    session.recheck();
    const files = {};
    files["comparison.json"] = writeExclusive(join(options.outputDir, "comparison.json"), privateData, session.check);
    files["report.json"] = writeExclusive(join(options.outputDir, "report.json"), result, session.check);
    // Validate the producer graph again after publication IO, not just its
    // original snapshot. inspectCapture is strictly read-only.
    const final = await inspectCapture(m.chamber.output);
    check(equal(final, qualification), "chamber_changed");
    session.recheck();
    for (const [name, hash] of Object.entries(files)) session.read(join(options.outputDir, name), 16777216, hash);
    writeExclusive(join(options.outputDir, "completion.json"), {
      schema: SCHEMA + ".publication", status: "published", files,
      inputs_unchanged_observed: true, observed_ms: Date.now(),
      command_exit_observed: false, future_exit_attested: false,
    }, session.check);
    session.recheck(); session.check();
  } catch (error) {
    // Never expose paths, values, digests, arbitrary exception messages or SDK
    // strings. Detailed inputs are retained only in the private output.
    const categories = { options: "invalid_options", output: "output_unavailable", manifest: "invalid_manifest",
      native: "native_source_rejected", chamber: "chamber_source_rejected", outer: "outer_completion_rejected",
      diagnostic: "diagnostic_evidence_rejected", publication: "publication_failed" };
    outcome(result, ["options", "output", "manifest"].includes(stage) ? "invalid_input" : "inconclusive",
      [error instanceof EvidenceError && error.category === "deadline_exceeded"
        ? "deadline_exceeded" : categories[stage]]);
    result.counts.differences = 0;
    for (const k of CATEGORIES) result.differences[k] = 0;
    if (acquired) {
      try { unlinkSync(join(options.outputDir, "completion.json")); } catch { /* No completion to revoke. */ }
      try {
        writeExclusive(join(options.outputDir, "failure.json"), {
          schema: SCHEMA + ".failure", public: result, command_exit_observed: false,
        }, session.check);
      } catch { /* No publication beyond the deadline; originals remain untouched. */ }
    }
  }
  return freeze(result);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Include import/module startup in the offline command budget.
  let result;
  try {
    check(performance.now() < 10000, "deadline_exceeded");
    result = await runChamberComparison(parseArgs(process.argv.slice(2)));
  } catch (error) {
    result = report();
    const expired = error instanceof EvidenceError && error.category === "deadline_exceeded";
    outcome(result, expired ? "inconclusive" : "invalid_input",
      [expired ? "deadline_exceeded" : "invalid_options"]);
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.exit_code;
}
