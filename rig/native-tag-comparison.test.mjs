import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectNativeAttempt, runNativeComparison } from "./native-tag-comparison.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const execute = promisify(execFile);
const entry = fileURLToPath(new URL("./native-tag-comparison.mjs", import.meta.url));
const temporary = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
const pins = {
  profile: "local-synthetic", node_version: "test-node", browser_version: "test-browser",
  os_release: "test-os", macos_version: "test-macos", runtime_sha256: "a".repeat(64),
  configuration_sha256: null, network_policy_sha256: "b".repeat(64),
};
function request(ordinal, identity = "private-id-A") {
  const url = `https://fixture.invalid/convert?value=13.25&consent=granted&id=${identity}&dup=one&dup=two`;
  return {
    ordinal, case: "baseline", url, query_pairs: [...new URL(url).searchParams],
    method: "POST", resource_type: "Fetch", category: "conversion",
    headers: [["Content-Type", "text/plain"], ["Cookie", "private-cookie=one"]],
    headers_state: "complete", cookies: [["private-cookie", "one"]], cookies_state: "complete",
    body_base64: Buffer.from("private-body").toString("base64"), body_state: "captured",
    response: { status: 200, headers: [["Set-Cookie", "private-response=two"]],
      cookies: [["private-response", "two"]], body_base64: Buffer.from("private-response").toString("base64"),
      body_state: "captured", headers_state: "complete", cookies_state: "complete", complete: true },
    redirect_to: ordinal === 0 ? 1 : null, fanout_to: ordinal === 0 ? [1, 2] : [],
  };
}
async function fixture() {
  const parent = await mkdtemp(join(await realpath(tmpdir()), "airlock-comparison-test-"));
  temporary.push(parent);
  const capture = {
    schema_version: 1, kind: "local_complete_sequence", run_id: "local-run", complete: true,
    requests: [request(0), request(1), request(2, "private-id-B"), request(3, "private-id-B")],
  };
  const report = {
    schema_version: 1, run_id: capture.run_id, evidence_layer: "local_control", ...pins,
    overall: "qualified", exit_code: 0, errors: [], capture_complete: true,
    counts: { recorded_requests: capture.requests.length },
    provenance: { network_policy_sha256: pins.network_policy_sha256 },
    guard: { qualified: true }, cleanup: { complete: true },
  };
  const manifest = {
    schema_version: 1, layer: "local_control", reference: {}, candidate: {},
    candidate_kind: "reference_control", expected_pins: { ...pins },
    rules: { identities: [], hashes: [] }, authorization: "local synthetic comparison only",
  };
  const f = { parent, report, capture, candidateReport: structuredClone(report),
    candidateCapture: structuredClone(capture), manifest, inputs: join(parent, "inputs.json"),
    outputDir: join(parent, "output") };
  f.save = async () => {
    for (const side of ["reference", "candidate"]) {
      const r = side === "reference" ? f.report : f.candidateReport;
      const c = side === "reference" ? f.capture : f.candidateCapture;
      const put = async (name, value) => {
        const bytes = JSON.stringify(value);
        const path = join(parent, `${side}-${name}.json`);
        await writeFile(path, bytes, { mode: 0o600 });
        return { path, sha256: hash(bytes) };
      };
      manifest[side].report = await put("report", r);
      manifest[side].capture = await put("capture", c);
      manifest[side].completion = await put("completion", {
        schema_version: 1, run_id: r.run_id, report_sha256: manifest[side].report.sha256,
        capture_sha256: manifest[side].capture.sha256, completed: true, exit_code: 0,
        overall: "qualified", source_owner_attestation: "witnessed local command, not a signature",
      });
    }
    await writeFile(f.inputs, JSON.stringify(manifest), { mode: 0o600 });
  };
  f.run = async control => {
    await f.save();
    return runNativeComparison({ inputs: f.inputs, outputDir: f.outputDir, ...(control ? { control } : {}) });
  };
  return f;
}
function query(row, index, value) {
  const tokens = row.url.split("?");
  const pairs = tokens[1].split("&");
  pairs[index] = `${pairs[index].split("=")[0]}=${encodeURIComponent(value)}`;
  row.url = `${tokens[0]}?${pairs.join("&")}`;
  row.query_pairs = [...new URL(row.url).searchParams];
}
const selector = (request, index = 2) => ({ request, field: "query", index });
async function hashFixture() {
  const f = await fixture();
  for (const c of [f.capture, f.candidateCapture]) {
    const r = c.requests[0];
    r.url = r.url.replace("?value=", "?synthetic_hash_input=").replace("&id=", "&synthetic_sha256=");
    r.query_pairs = [...new URL(r.url).searchParams];
  }
  return f;
}

// Shaped like the retained recorder, but generated locally: never SDK evidence.
async function nativeFixture(profile = "meta-pageview") {
  const f = await fixture();
  const google = profile === "google-ads-conversion";
  const source = {
    owned_origin: "https://fixture.invalid", source_document_url: "https://fixture.invalid/source",
    source_capture_sha256: "c".repeat(64),
    runtime: { url: "https://runtime.invalid/sdk.js", sha256: pins.runtime_sha256, source_http_status: 200 },
    ...(google ? { conversion_id: "AW-123", conversion_label: "private-label",
      dependencies: [], source_acquisition_sha256: "d".repeat(64) }
      : { pixel_id: "123", configuration: { url: "https://runtime.invalid/config.js",
        sha256: "e".repeat(64), source_http_status: 200 } }),
  };
  const names = google ? ["baseline", "query-disabled", "value1", "value2"]
    : ["baseline", "query-disabled", "consent-revoked", "value1", "value2"];
  const requests = [], cases = [];
  const add = (name, category, url, locally = false) => {
    const r = {
      ordinal: requests.length, case: name, observed_at: "2026-10-16T00:00:00Z",
      url, query_pairs: [...new URL(url).searchParams], method: "GET", resource_type: "Image",
      headers: { Cookie: "private-cookie=one" }, headers_state: "available_cdp_request_stage_headers",
      body_base64: null, body_state: "absent", category, network_id: `observer-${requests.length}`,
      aborted: !locally, locally_fulfilled: locally,
      local_response: locally ? { status: 200, body_bytes: 100,
        body_sha256: category === "runtime" ? source.runtime.sha256
          : category === "configuration" ? source.configuration.sha256 : "f".repeat(64),
        provenance: category === "fixture_document" ? "generated_synthetic" : "retained_source_bytes" } : null,
      actual_vendor_response: false, source_relationship: ["runtime", "configuration"].includes(category) ? category : null,
    };
    if (locally) r.resource_type = category === "fixture_document" ? "Document" : "Script";
    requests.push(r);
    return r;
  };
  for (const name of ["guard-tripwire", ...names]) {
    const positive = ["baseline", "value1", "value2"].includes(name);
    const disabled = name === "query-disabled", guard = name === "guard-tripwire";
    const document = guard ? "http://127.0.0.1:1234/guard-fixture"
      : `${source.owned_origin}/__airlock_native_reference_fixture__?case=${name}${disabled ? "&native=disabled" : ""}`;
    add(name, "fixture_document", document, true);
    if (guard) add(name, "http_tripwire",
      "http://127.0.0.1:1234/http-12345678-1234-4234-8234-123456789abc").resource_type = "XHR";
    if (!disabled && !guard) add(name, "runtime", source.runtime.url, true);
    if (positive && !google) add(name, "configuration", source.configuration.url, true);
    const value = name === "value2" ? "29.75" : "13.25";
    const input = google ? { send_to: `${source.conversion_id}/${source.conversion_label}`,
      value: Number(value), currency: "USD", transaction_id: `airlock-native-reference-${name}` }
      : positive && name !== "baseline" ? { value, currency: "USD" } : {};
    if (positive) {
      const params = new URLSearchParams(google ? {
        label: source.conversion_label, value, currency_code: "USD", oid: input.transaction_id,
        url: document, auid: "private-auid",
      } : { id: source.pixel_id, ev: "PageView", dl: document, fbp: "private-fbp",
        ...(name !== "baseline" ? { "cd[value]": value, "cd[currency]": "USD" } : {}) });
      add(name, "native_measurement", `${google
        ? "https://www.google.com/pagead/1p-conversion/123/" : "https://www.facebook.com/tr/"}?${params}`);
    }
    const summary = { name, started_at: "2026-10-16T00:00:00Z", stopped_at: "2026-10-16T00:00:01Z",
      observation_ms: guard ? 500 : 1000, attempts: positive ? 1 : 0, runtime_fulfilled: !disabled && !guard ? 1 : 0,
      configuration_fulfilled: positive && !google ? 1 : 0, dependency_closed: true,
      consent: name === "consent-revoked" ? "explicit_revoke_before_init" : "native_default_not_overridden",
      qualified_positive_run_id: null, qualified_positive_reference: positive,
      ...(google ? { auxiliary_attempts: 0, total_native_attempts: positive ? 1 : 0 } : {}) };
    cases.push({ ...summary, document_url: document, fixture_sha256: "f".repeat(64),
      fixture_state: guard ? null : { executed: true, disabled, consent: summary.consent },
      native_state: google ? { callable: positive, destination_initialized: positive,
        data_layer_length: positive ? 3 : null, conversion_input: positive ? input : null }
        : { callable: positive || name === "consent-revoked", queue_length: name === "consent-revoked" ? 2 : null,
          owned_pixel_count: name === "consent-revoked" ? 0 : positive ? 1 : null,
          event_count: positive ? 1 : null },
      synthetic_inputs: input, violations: [], unsupported_surfaces: [], page_errors: [], navigation_completed: true });
  }
  const provenance = {
    network_policy_sha256: pins.network_policy_sha256, source_capture_sha256: source.source_capture_sha256,
    native_resources: "unmodified_retained_official_bytes_locally_fulfilled",
    source_response_statuses: google ? { runtime: 200, dependencies: [] } : { runtime: 200, configuration: 200 },
    ...(google ? { source_cohort: "newly_acquired_google_native_bytes_not_historical_capture",
      source_acquisition_sha256: source.source_acquisition_sha256 } : {}),
  };
  f.report = {
    schema_version: 1, run_id: "native-shaped-local-test", evidence_layer: "native_attempt",
    ...pins, profile, configuration_sha256: google ? null : source.configuration.sha256,
    mode: "headed", control: "none", platform: "darwin", overall: "qualified", exit_code: 0,
    errors: [], capture_complete: true, provenance,
    counts: { attempts: 3, recorded_requests: requests.length,
      ...(google ? { native_auxiliaries: 0, total_native_attempts: 3 } : {}) },
    cases: cases.slice(1).map(c => Object.fromEntries(Object.entries(c)
      .filter(([k]) => Object.keys(cases[0]).indexOf(k) < Object.keys(cases[0]).indexOf("document_url"))
      .map(([k, v]) => [k, k === "qualified_positive_run_id" ? "native-shaped-local-test" : v]))),
    expected_positive_cases: ["baseline", "value1", "value2"],
    controls: { disabled_linked: true, consent_negative_linked: !google, value_contrast: true },
    guard: { mechanism: "cdp_fetch_request_stage_all_fulfill_or_abort", qualified: true,
      process_control: { qualified: true, positive_arrivals: 1, positive_status: 200,
        confined_arrivals: 0, navigation_denied: true },
      resolver_control: { qualified: true, positive_connections: 2, confined_denials: 2, query_payload_sent: false },
      http_control: { qualified: true, attempts: 1, aborted: 1, arrivals: 0 } },
    cleanup: { owned_processes_exited: true, servers_closed: true, contexts_closed: true, signal_listeners_detached: true },
    claims: { vendor_dispatch_verified: false, vendor_receipt_verified: false, chamber_compatibility_verified: false,
      matching_verified: false, attribution_verified: false, full_support_verified: false },
    observation_window: { started_at: "2026-10-16T00:00:00Z", stopped_at: "2026-10-16T00:00:10Z",
      max_wall_ms: 60000, per_case_ms: 1000 }, run_elapsed_ms: 10000,
    limits: { run_ms: 60000, observation_ms: 1000 },
  };
  delete f.report.network_policy_sha256;
  f.capture = { schema_version: 1, run_id: f.report.run_id, source, requests, cases, errors: [],
    receiver_requests: [{ path: "/process-87654321-4321-4321-8321-cba987654321", at: "2026-10-16T00:00:00Z", method: "GET",
      headers: { Cookie: "private-cookie=one" }, response_status: 200 }],
    failure_detail: null, provenance: structuredClone(provenance), browser_process_ids: [123], limits: {} };
  f.candidateReport = structuredClone(f.report); f.candidateCapture = structuredClone(f.capture);
  f.manifest.expected_pins = { ...pins, profile, configuration_sha256: f.report.configuration_sha256 };
  f.manifest.layer = "native_attempt";
  return f;
}

describe("059-17 read-only native-attempt seam (synthetic recorder-shaped units, NOT SDK evidence)", () => {
  it.each(["meta-pageview", "google-ads-conversion"])("AC2: validates %s without comparing or writing", async profile => {
    const f = await nativeFixture(profile);
    await f.save();
    const result = await inspectNativeAttempt({
      reference: f.manifest.reference, expected_pins: f.manifest.expected_pins,
    });
    expect(result.capture).toEqual(f.capture);
    expect(result.report).toEqual(f.report);
    expect(result.completion.completed).toBe(true);
    expect(Object.isFrozen(result.capture.requests)).toBe(true);
    await expect(stat(f.outputDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["meta-pageview", "google-ads-conversion"].flatMap(profile =>
    ["deleted", "fixture-deleted", "duplicate", "category", "case", "aborted", "fulfilled",
      "fixture-aborted", "fixture-unfulfilled", "local-response", "method", "resource-type",
      "target-path", "target-origin", "document-path", "fixture-url", "receiver-arrival"]
      .map(kind => [profile, kind])))(
    "AC2 correction: %s rejects reconciled guard observation %s, not stale handles", async (profile, kind) => {
      const f = await nativeFixture(profile), rows = f.capture.requests;
      const tripwire = rows.find(r => r.category === "http_tripwire");
      const document = rows.find(r => r.case === "guard-tripwire" && r.category === "fixture_document");
      if (kind === "deleted") rows.splice(rows.indexOf(tripwire), 1);
      if (kind === "fixture-deleted") rows.splice(rows.indexOf(document), 1);
      if (kind === "duplicate") rows.splice(rows.indexOf(tripwire), 0, structuredClone(tripwire));
      if (kind === "category") tripwire.category = "fixture_favicon";
      if (kind === "case") tripwire.case = "query-disabled";
      if (kind === "aborted") tripwire.aborted = false;
      if (kind === "fulfilled") tripwire.locally_fulfilled = true;
      if (kind === "fixture-aborted") document.aborted = true;
      if (kind === "fixture-unfulfilled") document.locally_fulfilled = false;
      if (kind === "local-response") tripwire.local_response = structuredClone(document.local_response);
      if (kind === "method") tripwire.method = "POST";
      if (kind === "resource-type") tripwire.resource_type = "Image";
      if (kind === "target-path") tripwire.url = tripwire.url.replace("/http-", "/other-");
      if (kind === "target-origin") tripwire.url = tripwire.url.replace(":1234", ":5678");
      if (kind === "document-path") f.capture.cases[0].document_url += "-other";
      if (kind === "fixture-url") document.url += "-other";
      if (kind === "receiver-arrival") f.capture.receiver_requests[0].path = new URL(tripwire.url).pathname;
      // Reconcile redundant bookkeeping AND real descriptors/completion hashes.
      // The report still asserts its original one-abort/zero-arrival guard.
      rows.forEach((r, i) => { r.ordinal = i; r.query_pairs = [...new URL(r.url).searchParams]; });
      f.report.counts.recorded_requests = rows.length;
      await f.save();
      expect(hash(await readFile(f.manifest.reference.capture.path))).toBe(f.manifest.reference.capture.sha256);
      const completion = JSON.parse(await readFile(f.manifest.reference.completion.path));
      expect(completion.capture_sha256).toBe(f.manifest.reference.capture.sha256);
      expect(completion.report_sha256).toBe(f.manifest.reference.report.sha256);
      await expect(inspectNativeAttempt({
        reference: f.manifest.reference, expected_pins: f.manifest.expected_pins,
      })).rejects.toThrow("guard_observation_unqualified");
    });

  it.each(["local", "stock", "empty", "unknown", "guard-category", "guard-case", "pin", "completion",
    "control", "redacted", "observation"])(
    "AC2/7: strict source failure %s is not bypassed by the reader", async kind => {
      const f = kind === "local" ? await fixture() : await nativeFixture();
      if (kind === "stock") f.report.schema_version = "airlock.inspected-meta-stock.v1";
      if (kind === "empty") f.capture.requests = [];
      if (kind === "unknown") f.capture.requests[0].unrecognized = true;
      if (kind === "guard-category") f.capture.requests[0].category = "unknown";
      if (kind === "guard-case") f.capture.requests[0].case = "unknown";
      if (kind === "pin") f.manifest.expected_pins.runtime_sha256 = "0".repeat(64);
      if (kind === "control") f.report.controls.value_contrast = false;
      if (kind === "redacted") f.capture.requests[0].headers.Cookie = "[REDACTED]";
      if (kind === "observation") {
        const r = f.capture.requests.find(r => r.category === "native_measurement");
        r.url = r.url.replace("PageView", "OtherEvent");
        r.query_pairs = [...new URL(r.url).searchParams];
      }
      await f.save();
      if (kind === "completion") await rm(f.manifest.reference.completion.path);
      await expect(inspectNativeAttempt({
        reference: f.manifest.reference, expected_pins: f.manifest.expected_pins,
      })).rejects.toThrow();
    });

  it.each(['"run_id":"ignored",', '"run_\\u0069d":"ignored",'])(
    "AC2/6: rejects raw ambiguous native JSON %s", async duplicate => {
      const f = await nativeFixture();
      await f.save();
      const handle = f.manifest.reference.capture;
      const bytes = (await readFile(handle.path, "utf8")).replace("{", "{" + duplicate);
      await writeFile(handle.path, bytes);
      handle.sha256 = hash(bytes);
      await expect(inspectNativeAttempt({
        reference: f.manifest.reference, expected_pins: f.manifest.expected_pins,
      })).rejects.toThrow("ambiguous_json");
    });
});

describe("058-03 complete value-preserving offline comparisons", () => {
  it.each(["meta-pageview", "google-ads-conversion"].flatMap(profile =>
    ["owned_processes_exited", "servers_closed", "contexts_closed", "signal_listeners_detached"]
      .flatMap(field => ["missing", "only-one-present", "false", "string", "null"]
        .map(kind => [profile, field, kind]))))(
    "AC1: %s cleanup requires explicit %s proof (%s)", async (profile, field, kind) => {
      const f = await nativeFixture(profile);
      for (const report of [f.report, f.candidateReport]) {
        if (kind === "missing") delete report.cleanup[field];
        else if (kind === "only-one-present") report.cleanup = { [field]: true };
        else report.cleanup[field] = kind === "false" ? false : kind === "string" ? "true" : null;
      }
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors).toContain("source_unqualified");
    });

  it.each(["missing", "false", "string", "null", "native-shape", "extra-key"])(
    "AC1: local cleanup requires its closed complete-true declaration (%s)", async kind => {
      const f = await fixture();
      for (const report of [f.report, f.candidateReport]) {
        report.cleanup = kind === "missing" ? {} : kind === "native-shape" ? { contexts_closed: true }
          : kind === "extra-key" ? { complete: true, contexts_closed: true }
            : { complete: kind === "false" ? false : kind === "string" ? "true" : null };
      }
      expect((await f.run()).exit_code).toBe(2);
    });

  it.each([
    ["process_control", "positive_arrivals", 1], ["process_control", "positive_status", 200],
    ["process_control", "confined_arrivals", 0], ["resolver_control", "positive_connections", 2],
    ["resolver_control", "confined_denials", 2], ["http_control", "attempts", 1],
    ["http_control", "aborted", 1], ["http_control", "arrivals", 0],
  ].flatMap(([control, key, expected]) => ["missing", "string", "null", "fractional", "negative", "wrong-count"]
    .map(kind => [control, key, expected, kind])))(
    "AC1: pinned guard %s.%s refuses %s (%s)", async (control, key, expected, kind) => {
      const f = await nativeFixture();
      for (const report of [f.report, f.candidateReport]) {
        const row = report.guard[control];
        if (kind === "missing") delete row[key];
        else row[key] = kind === "string" ? String(expected) : kind === "null" ? null
          : kind === "fractional" ? expected + 0.5 : kind === "negative" ? -1 : expected + 1;
      }
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors).toContain("forbidden_dispatch");
    });

  it.each(["meta-pageview", "google-ads-conversion"])(
    "AC1/5: %s native-shaped copy is an attempt control only; private case linkage is validated", async profile => {
      const f = await nativeFixture(profile);
      const result = await f.run();
      expect(result.errors).toEqual([]);
      expect(result.exit_code).toBe(0);
      expect(result.exclusions.find(e => e.name === "generated_fixture_metadata").count).toBeGreaterThan(0);
      expect(result.evidence.reference.vendor_responses_unavailable).toBe(f.report.counts.attempts
        + (f.report.counts.native_auxiliaries ?? 0));
      expect(result.counts.presence_only).toBeGreaterThan(0);
      expect(Object.values(result.claims).every(v => v === false)).toBe(true);
    });

  it.each(["url", "label", "value", "consent"])(
    "AC3: native %s normalization laundering is explicitly unsupported", async field => {
      const f = await nativeFixture("google-ads-conversion");
      const originals = f.capture.requests.filter(r => r.category === "native_measurement");
      const targets = f.candidateCapture.requests.filter(r => r.category === "native_measurement");
      if (field === "consent") {
        for (const r of [...originals, ...targets]) {
          r.url += "&consent=granted"; r.query_pairs = [...new URL(r.url).searchParams];
        }
      }
      const index = targets[0].query_pairs.findIndex(p => p[0] === field);
      query(targets[0], index, "private-wrong-account-action-or-consent");
      f.manifest.rules.hashes = [{
        input: selector(targets[0].ordinal, index),
        digest: selector(targets[1].ordinal, index), normalization: "identity",
      }];
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors).toContain("native_normalization_unsupported");
      expect(result.counts.preserved_relationships).toBe(0);
    });

  it.each(["meta-pageview", "google-ads-conversion"])(
    "AC1/5: %s identical native attempts cannot qualify whole wire", async profile => {
      const f = await nativeFixture(profile);
      f.manifest.layer = "whole_wire";
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors).toContain("whole_wire_unavailable");
    });

  it.each(["drop", "duplicate", "route", "value", "consent", "identity", "empty-reference",
    "equal-redaction", "stale-pin"])("AC4: native-shaped %s controls use validated clones", async control => {
    const f = await nativeFixture();
    const result = await f.run(control);
    expect(result.control?.positive_exit_code).toBe(0);
    expect(result.control?.applied).toBe(true);
    expect(result.control?.detected).toBe(true);
    expect(result.errors).not.toContain("control_not_detected");
    expect(result.exit_code).not.toBe(0);
  });

  it.each(["identity", "count", "case-link", "cleanup", "guard", "unknown-nested", "wrong-value",
    "empty-headers", "lost-window"])(
    "AC1: native %s qualification evidence cannot be trusted blindly", async kind => {
      const f = await nativeFixture();
      if (kind === "identity") f.candidateCapture.run_id = "other";
      if (kind === "count") f.candidateReport.counts.attempts++;
      if (kind === "case-link") f.candidateReport.cases[0].qualified_positive_run_id = "other";
      if (kind === "cleanup") f.candidateReport.cleanup.contexts_closed = false;
      if (kind === "guard") f.candidateReport.guard.http_control.arrivals = 1;
      if (kind === "unknown-nested") f.candidateCapture.cases[1].native_state.new_native_field = true;
      if (kind === "empty-headers") f.candidateCapture.requests[0].headers = {};
      if (kind === "lost-window") delete f.candidateReport.observation_window.stopped_at;
      if (kind === "wrong-value") {
        const r = f.candidateCapture.requests.find(r => r.case === "value1" && r.category === "native_measurement");
        query(r, r.query_pairs.findIndex(p => p[0] === "cd[value]"), "99");
      }
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
    });

  it("AC1/5: qualifies only the named local layer, freezes value-free output and writes private evidence", async () => {
    const f = await fixture();
    const result = await f.run();
    expect(result.overall).toBe("qualified");
    expect(result.exit_code).toBe(0);
    expect(result.evidence_layer).toBe("local_control");
    expect(result.candidate_kind).toBe("reference_control");
    expect(result.counts.equal_requests).toBe(4);
    expect(Object.values(result.claims).every(v => v === false)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.counts)).toBe(true);
    for (const secret of ["private-id", "fixture.invalid", "private-body", "private-cookie", f.parent])
      expect(JSON.stringify(result)).not.toContain(secret);
    expect((await stat(f.outputDir)).mode & 0o777).toBe(0o700);
    for (const name of ["report.json", "comparison.json"]) {
      expect((await stat(join(f.outputDir, name))).mode & 0o777).toBe(0o600);
    }
    expect(await readFile(join(f.outputDir, "comparison.json"), "utf8"))
      .toContain(Buffer.from("private-body").toString("base64"));
  });

  it.each([
    ["method", r => { r.method = "GET"; }, "method"],
    ["route", r => { r.url = r.url.replace("/convert?", "/elsewhere?"); }, "destination"],
    ["value", r => query(r, 0, "29.75"), "query"],
    ["consent", r => query(r, 1, "denied"), "query"],
    ["duplicate query order", r => {
      const a = r.query_pairs[3][1]; query(r, 3, r.query_pairs[4][1]); query(r, 4, a);
    }, "query"],
    ["encoding", r => { r.url = r.url.replace("13.25", "13%2E25"); }, "encoding"],
    ["headers", r => { r.headers[1][1] = "private-cookie=other"; }, "headers"],
    ["cookies", r => { r.cookies[0][1] = "other"; }, "cookies"],
    ["body", r => { r.body_base64 = Buffer.from("different").toString("base64"); }, "body"],
    ["response bytes", r => { r.response.body_base64 = Buffer.from("different").toString("base64"); }, "response"],
    ["response headers", r => { r.response.headers[0][1] = "other"; }, "response"],
    ["response cookies", r => { r.response.cookies[0][1] = "other"; }, "response"],
    ["redirect", r => { r.redirect_to = null; }, "edges"],
    ["fanout", r => { r.fanout_to = [1]; }, "edges"],
    ["resource type", r => { r.resource_type = "Image"; }, "classification"],
    ["category", r => { r.category = "auxiliary"; }, "classification"],
  ])("AC2: detects %s in the complete sequence", async (_label, mutate, category) => {
    const f = await fixture();
    mutate(f.candidateCapture.requests[0]);
    const result = await f.run();
    expect(result.exit_code).toBe(1);
    expect(result.differences.some(d => d.category === category)).toBe(true);
  });

  it.each(["drop", "duplicate", "order"])("AC2: detects sequence %s without parser-failure proof", async kind => {
    const f = await fixture();
    const rows = f.candidateCapture.requests;
    if (kind === "drop") rows.pop();
    if (kind === "duplicate") rows.push(structuredClone(rows.at(-1)));
    if (kind === "order") [rows[0], rows[2]] = [rows[2], rows[0]];
    rows.forEach((r, i) => { r.ordinal = i; });
    f.candidateReport.counts.recorded_requests = rows.length;
    const result = await f.run();
    expect(result.exit_code).toBe(1);
    expect(result.errors).not.toContain("invalid_capture");
  });

  it.each([
    ["unknown", f => { f.candidateCapture.requests[0].future_wire_field = "secret"; }, "unknown_fields"],
    ["body unavailable", f => {
      f.candidateCapture.requests[0].body_state = "unavailable";
      f.candidateCapture.requests[0].body_base64 = null;
    }, "missing_evidence"],
    ["response unavailable", f => { f.candidateCapture.requests[0].response.complete = false; }, "missing_evidence"],
    ["empty", f => {
      f.capture.requests = []; f.report.counts.recorded_requests = 0;
    }, "missing_positive_reference"],
  ])("AC1: %s cannot manufacture equality", async (_label, mutate, category) => {
    const f = await fixture();
    mutate(f);
    const result = await f.run();
    expect(result.exit_code).toBe(2);
    expect(result.errors).toContain(category);
  });

  it("AC3: checks original identity reuse AND distinctness on both sides before symbols", async () => {
    const f = await fixture();
    f.manifest.rules.identities = [{ groups: [[selector(0), selector(1)], [selector(2), selector(3)]] }];
    for (const [i, row] of f.candidateCapture.requests.entries()) query(row, 2, i < 2 ? "private-id-C" : "private-id-D");
    expect((await f.run()).exit_code).toBe(0);
  });

  it.each(["header"])("AC3: %s selectors operate on original individual fields", async field => {
    const f = await fixture();
    const select = request => ({ request, field, ...(field === "header" ? { name: "X-Private-Identity" } : {}) });
    for (const [side, c] of [f.capture, f.candidateCapture].entries()) {
      for (const [i, r] of c.requests.entries()) {
        const value = `private-${side ? "candidate" : "reference"}-${i < 2 ? "one" : "two"}`;
        if (field === "header") r.headers.push(["X-Private-Identity", value]);
        else r.body_base64 = Buffer.from(value).toString("base64");
      }
    }
    f.manifest.rules.identities = [{ groups: [[select(0), select(1)], [select(2), select(3)]] }];
    expect((await f.run()).exit_code).toBe(0);
  });

  it("AC3: hash-shaped values of DIFFERENT normalized inputs cannot manufacture equality", async () => {
    const f = await hashFixture();
    for (const [i, c] of [f.capture, f.candidateCapture].entries()) {
      query(c.requests[0], 0, `private-input-${i}`);
      query(c.requests[0], 2, hash(`private-input-${i}`));
    }
    f.manifest.rules.hashes = [{ input: selector(0, 0), digest: selector(0, 2), normalization: "identity" }];
    expect((await f.run()).exit_code).toBe(1);
  });

  it("AC4: an invalid positive never qualifies a mutation, and missing response/edge evidence stays unsupported", async () => {
    const f = await fixture();
    f.capture.requests = []; f.report.counts.recorded_requests = 0;
    const failed = await f.run("route");
    expect(failed.exit_code).toBe(2);
    expect(failed.errors).toContain("control_positive_unqualified");
    const g = await nativeFixture();
    const unavailable = await g.run("response-truncation");
    expect(unavailable.exit_code).toBe(2);
    expect(unavailable.errors).toContain("control_unavailable");
  });

  it.each(["collapsed", "unlinked", "sentinel", "empty"])("AC3: rejects %s identity relationships", async kind => {
    const f = await fixture();
    f.manifest.rules.identities = [{ groups: [[selector(0), selector(1)], [selector(2), selector(3)]] }];
    if (kind === "collapsed") for (const row of f.candidateCapture.requests) query(row, 2, "private-id-A");
    if (kind === "unlinked") query(f.candidateCapture.requests[1], 2, "private-id-C");
    if (kind === "sentinel" || kind === "empty") {
      for (const c of [f.capture, f.candidateCapture])
        for (const row of c.requests) query(row, 2, kind === "empty" ? "" : "[REDACTED]");
    }
    const result = await f.run();
    expect(result.exit_code).not.toBe(0);
    expect(result.errors).toContain(kind === "sentinel" ? "redacted_values" : "identity_relationship");
  });

  it.each(["good", "wrong", "sentinel"])("AC3: verifies original same-input hash VALUE: %s", async kind => {
    const f = await hashFixture();
    for (const c of [f.capture, f.candidateCapture]) {
      const row = c.requests[0];
      query(row, 0, " Owner@Example.Invalid ");
      query(row, 2, kind === "wrong" ? "f".repeat(64)
        : kind === "sentinel" ? "[REDACTED]" : hash("owner@example.invalid"));
    }
    f.manifest.rules.hashes = [{ input: selector(0, 0), digest: selector(0, 2),
      normalization: "trim_lowercase_utf8" }];
    const result = await f.run();
    expect(result.exit_code).toBe(kind === "good" ? 0 : kind === "wrong" ? 1 : 2);
    if (kind === "wrong") expect(result.errors).toContain("hash_relationship");
  });

  it("AC3: different-case originals qualify only with actual allowed hash input projection", async () => {
    const f = await hashFixture();
    for (const [i, c] of [f.capture, f.candidateCapture].entries()) {
      query(c.requests[0], 0, i ? " owner@example.invalid " : " OWNER@EXAMPLE.INVALID ");
      query(c.requests[0], 2, hash("owner@example.invalid"));
    }
    await f.save();
    expect((await runNativeComparison({ inputs: f.inputs, outputDir: join(f.parent, "exact") })).exit_code).toBe(1);
    f.manifest.rules.hashes = [{ input: selector(0, 0), digest: selector(0, 2),
      normalization: "trim_lowercase_utf8" }];
    expect((await f.run()).exit_code).toBe(0);
    const source = await readFile(entry, "utf8");
    const projection = "replaceSelected(p, rule.input, normalize(selected(side, rule.input)));";
    expect(source).toContain(projection);
    // A bounded local code mutation falsifies the positive: checking digests
    // alone is insufficient if normalized originals are never projected.
    const mutant = source.replace(projection, "{ void side; void p; }")
      .replace('"./attempt-evidence-io.mjs"', JSON.stringify(new URL("./attempt-evidence-io.mjs", import.meta.url).href))
      .replace('"./field-rules.mjs"', JSON.stringify(new URL("./field-rules.mjs", import.meta.url).href));
    const { runNativeComparison: withoutProjection } = await import(
      `data:text/javascript;base64,${Buffer.from(mutant).toString("base64")}`);
    const result = await withoutProjection({ inputs: f.inputs, outputDir: join(f.parent, "no-projection") });
    expect(result.exit_code).toBe(1);
  });

  it.each(["value", "consent", "destination", "label", "currency", "runtime_sha256", "Cookie", "body_utf8"])(
    "AC3: local identity rules cannot launder protected/opaque %s", async key => {
      const f = await fixture();
      const selections = [];
      for (const [side, c] of [f.capture, f.candidateCapture].entries()) {
        for (const [i, r] of c.requests.entries()) {
          const value = `${side ? "99" : "11"}${i < 2 ? "AA" : "BB"}`;
          if (key === "Cookie") r.headers = [["Cookie", value]];
          else if (key === "body_utf8") r.body_base64 = Buffer.from(value).toString("base64");
          else {
            r.url = `${r.url.split("?")[0]}?${key}=${value}`;
            r.query_pairs = [...new URL(r.url).searchParams];
          }
        }
      }
      for (let i = 0; i < 4; i++) selections.push(key === "Cookie"
        ? { request: i, field: "header", name: "Cookie" }
        : key === "body_utf8" ? { request: i, field: "body_utf8" } : selector(i, 0));
      f.manifest.rules.identities = [{ groups: [selections.slice(0, 2), selections.slice(2)] }];
      const result = await f.run();
      expect(result.exit_code).toBe(3);
      expect(result.errors).toContain("rule_target_unsupported");
    });

  it.each(["input", "digest"])("AC3: hash %s selectors cannot target protected fields", async role => {
    const f = await hashFixture();
    for (const c of [f.capture, f.candidateCapture]) {
      const r = c.requests[0];
      r.url = r.url.replace(role === "input" ? "synthetic_hash_input=" : "synthetic_sha256=", "value=");
      r.query_pairs = [...new URL(r.url).searchParams];
      query(r, 0, "private-input");
      query(r, 2, hash("private-input"));
    }
    f.manifest.rules.hashes = [{ input: selector(0, 0), digest: selector(0, 2), normalization: "identity" }];
    const result = await f.run();
    expect(result.exit_code).toBe(3);
    expect(result.errors).toContain("rule_target_unsupported");
  });

  it.each(["redirect", "fanout", "both"])("AC4: drop reconciles incoming %s links to the removed tail", async kind => {
    const f = await fixture();
    for (const c of [f.capture, f.candidateCapture]) {
      c.requests[0].redirect_to = kind === "fanout" ? null : 3;
      c.requests[0].fanout_to = kind === "redirect" ? [] : [1, 3, 3];
    }
    const result = await f.run("drop");
    expect(result.exit_code).toBe(1);
    expect(result.control).toMatchObject({ positive_exit_code: 0, applied: true, detected: true,
      expected_category: "sequence" });
    expect(result.errors).not.toContain("invalid_edges");
    expect(result.differences.some(d => d.category === "sequence")).toBe(true);
    const privateResult = JSON.parse(await readFile(join(f.outputDir, "comparison.json")));
    expect(privateResult.mutated_candidate.capture.requests[0].redirect_to).toBe(null);
    expect(privateResult.mutated_candidate.capture.requests[0].fanout_to).not.toContain(3);
  });

  it("AC3: identity rules cannot erase query encoding changes", async () => {
    const f = await fixture();
    f.manifest.rules.identities = [{ groups: [[selector(0), selector(1)], [selector(2), selector(3)]] }];
    for (const row of f.candidateCapture.requests) row.url = row.url.replace("private-id", "private%2Did");
    expect((await f.run()).exit_code).toBe(1);
  });

  it("AC1/3: identical redacted values without rules are not raw equality", async () => {
    const f = await fixture();
    for (const c of [f.capture, f.candidateCapture]) query(c.requests[0], 0, "[REDACTED]");
    expect((await f.run()).errors).toContain("redacted_values");
  });

  it.each(["drop", "route", "value", "consent", "identity", "duplicate", "response-truncation",
    "edge-loss", "empty-reference", "equal-redaction", "stale-pin"])(
    "AC4: %s mutation is applied, linked to a passing positive and fails its intended category", async control => {
      const f = await fixture();
      const result = await f.run(control);
      expect(result.exit_code).not.toBe(0);
      expect(result.control.positive_exit_code).toBe(0);
      expect(result.control.applied).toBe(true);
      expect(result.control.detected).toBe(true);
      expect(result.control.name).toBe(control);
    });

  it.each(["runtime_sha256", "configuration_sha256", "browser_version", "node_version",
    "os_release", "macos_version", "network_policy_sha256"])("AC6: changed %s is stale, never recaptured", async pin => {
    const f = await fixture();
    if (pin === "network_policy_sha256") f.candidateReport.provenance[pin] = "c".repeat(64);
    else f.candidateReport[pin] = "changed";
    const result = await f.run();
    expect(result.exit_code).toBe(2);
    expect(result.errors).toContain("stale_pins");
  });

  it.each(["missing", "failed", "mismatched"])("AC1: %s completed-command attestation blocks qualification", async kind => {
    const f = await fixture();
    await f.save();
    const path = f.manifest.reference.completion.path;
    const c = JSON.parse(await readFile(path));
    if (kind === "missing") await rm(path);
    else {
      if (kind === "failed") c.exit_code = 2;
      else c.report_sha256 = "f".repeat(64);
      const bytes = JSON.stringify(c);
      await writeFile(path, bytes);
      f.manifest.reference.completion.sha256 = hash(bytes);
      await writeFile(f.inputs, JSON.stringify(f.manifest));
    }
    const result = await runNativeComparison({ inputs: f.inputs, outputDir: f.outputDir });
    expect(result.exit_code).toBe(2);
    expect(result.evidence_layer).toBe("local_control");
    expect(result.errors.some(e => e.startsWith("completion"))).toBe(true);
  });

  it.each(["query redundancy", "base64"])("rejects invalid %s rather than comparing a lossy projection", async kind => {
    const f = await fixture();
    if (kind === "base64") f.capture.requests[0].body_base64 = "%%%";
    else f.capture.requests[0].query_pairs.pop();
    expect((await f.run()).exit_code).toBe(3);
  });

  it("AC1: unknown response extensions on BOTH sides remain inconclusive, never equal", async () => {
    const f = await fixture();
    for (const c of [f.capture, f.candidateCapture]) c.requests[0].response.new_wire_field = "private-new";
    const result = await f.run();
    expect(result.exit_code).toBe(2);
    expect(result.errors).toContain("unknown_fields");
    expect(result.counts.unknown_fields).toBe(2);
  });

  it("rejects unsupported ignore rules and symlink resources without following them", async () => {
    const f = await fixture();
    f.manifest.rules.ignore = ["anything"];
    expect((await f.run()).exit_code).toBe(3);
    const g = await fixture();
    await g.save();
    const link = join(g.parent, "link.json");
    await symlink(g.manifest.reference.capture.path, link);
    g.manifest.reference.capture.path = link;
    await writeFile(g.inputs, JSON.stringify(g.manifest));
    const result = await runNativeComparison({ inputs: g.inputs, outputDir: g.outputDir });
    expect(result.exit_code).toBe(2);
  });

  it("existing output cannot yield success; CLI emits the same frozen public contract", async () => {
    const f = await fixture();
    expect((await f.run()).exit_code).toBe(0);
    expect((await runNativeComparison({ inputs: f.inputs, outputDir: f.outputDir })).exit_code).toBe(3);
    const g = await fixture();
    await g.save();
    const cli = await execute(process.execPath, [entry, "--inputs", g.inputs, "--output-dir", g.outputDir]);
    expect(JSON.parse(cli.stdout).exit_code).toBe(0);
    expect(cli.stderr).toBe("");
  });

  it.each(["depth", "records", "rules", "differences", "bytes", "clock"])(
    "bounded %s exhaustion cannot fail open", async kind => {
      const f = await fixture();
      if (kind === "depth") {
        let v = f.candidateCapture;
        for (let i = 0; i < 30; i++) { v.nested = {}; v = v.nested; }
      }
      if (kind === "records") {
        f.capture.requests = Array.from({ length: 257 }, (_, i) => request(i));
        f.report.counts.recorded_requests = 257;
      }
      if (kind === "rules") f.manifest.rules.hashes = Array(33).fill({});
      if (kind === "differences") {
        f.capture.requests = Array.from({ length: 130 }, (_, i) => request(i));
        f.candidateCapture.requests = structuredClone(f.capture.requests);
        for (const row of f.candidateCapture.requests) row.method = "GET";
        f.report.counts.recorded_requests = f.candidateReport.counts.recorded_requests = 130;
      }
      if (kind === "bytes") f.capture.padding = "x".repeat(2097153);
      if (kind === "clock") {
        await f.save();
        let t = Date.now();
        vi.spyOn(Date, "now").mockImplementation(() => { t += 2000; return t; });
        const result = await runNativeComparison({ inputs: f.inputs, outputDir: f.outputDir });
        expect(result.exit_code).toBe(2);
        expect(result.errors).toContain("run_deadline_exceeded");
        return;
      }
      const result = await f.run();
      expect(result.exit_code).not.toBe(0);
      expect(result.errors.some(e => e.includes("limit"))).toBe(true);
    });

  it("FIFO resources return promptly and never block or qualify", async () => {
    const f = await fixture();
    await f.save();
    const path = join(f.parent, "capture.fifo");
    await execute("mkfifo", [path]);
    f.manifest.reference.capture.path = path;
    await writeFile(f.inputs, JSON.stringify(f.manifest));
    const result = await runNativeComparison({ inputs: f.inputs, outputDir: f.outputDir });
    expect(result.exit_code).toBe(2);
    expect(result.errors).toContain("capture_unavailable");
  });
});

describe("064-03 native-side field rules (ADR-0061 point 10)", () => {
  const corpus = [hash("fixture-a"), hash("fixture-b")];
  const uuid = n => `0000000${n}-0000-4000-8000-00000000000${n}`;
  const find = (rows, key) => rows.filter(r => r.category === "native_measurement")
    .map(r => ({ row: r, index: r.query_pairs.findIndex(p => p[0] === key) }));
  async function field(reference, candidate, key = "fbp") {
    const f = await nativeFixture("meta-pageview");
    const refs = find(f.capture.requests, key), cands = find(f.candidateCapture.requests, key);
    refs.forEach(({ row, index }, i) => query(row, index, reference(i)));
    cands.forEach(({ row, index }, i) => query(row, index, candidate(i)));
    const ordinals = refs.map(({ row }) => row.ordinal);
    const index = refs[0].index;
    f.sel = ordinals.map(request => ({ request, field: "query", index }));
    f.rule = (extra = {}) => ({ class: "generated", selectors: f.sel, derived_from: corpus,
      format: { kind: "token", min: 4, max: 64 }, relation: "none", ...extra });
    return f;
  }
  const same = value => () => value;

  it("without a rule, differing generated values are a plain query difference", async () => {
    const f = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    const result = await f.run();
    expect(result.exit_code).not.toBe(0);
    expect(result.differences.some(d => d.category === "query")).toBe(true);
  });

  it("generated: values of the declared format qualify and are counted as preserved relationships", async () => {
    const f = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    f.manifest.rules.fields = [f.rule()];
    const result = await f.run();
    expect(result.errors).toEqual([]);
    expect(result.exit_code).toBe(0);
    expect(result.counts.preserved_relationships).toBe(1);
    expect(result.counts.differences).toBe(0);
  });

  it("generated: a value outside the declared format fails the rule on either side", async () => {
    for (const [ref, cand] of [[same("fb.1.111.aaaa"), same("bad value!")], [same("bad value!"), same("fb.1.2.b")]]) {
      const f = await field(ref, cand);
      f.manifest.rules.fields = [f.rule()];
      const result = await f.run();
      expect(result.exit_code).not.toBe(0);
      expect(result.errors).toContain("field_rule_violation");
    }
  });

  it("generated relation=equal requires one value per capture; distinct requires different values", async () => {
    const equalOk = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    equalOk.manifest.rules.fields = [equalOk.rule({ relation: "equal" })];
    expect((await equalOk.run()).exit_code).toBe(0);
    const equalBad = await field(i => `fb.1.1.a${i}aa`, same("fb.1.222.bbbb"));
    equalBad.manifest.rules.fields = [equalBad.rule({ relation: "equal" })];
    expect((await equalBad.run()).errors).toContain("field_rule_violation");
    const distinctBad = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    distinctBad.manifest.rules.fields = [distinctBad.rule({ relation: "distinct" })];
    expect((await distinctBad.run()).errors).toContain("field_rule_violation");
  });

  it("volatile: presence and format only; a protected routing/value key is rejected", async () => {
    const ok = await field(same(uuid(1)), same(uuid(2)));
    ok.manifest.rules.fields = [{ ...ok.rule(), class: "volatile", format: { kind: "uuid" } }];
    delete ok.manifest.rules.fields[0].relation;
    expect((await ok.run()).exit_code).toBe(0);
    const protectedKey = await field(same("PageView"), same("PageView"), "ev");
    protectedKey.manifest.rules.fields = [protectedKey.rule({ format: { kind: "token", min: 1, max: 20 } })];
    const result = await protectedKey.run();
    expect(result.exit_code).toBe(3);
    expect(result.errors).toContain("rule_target_unsupported");
  });

  it("input_derived: the value must equal the declared transform of its source on each side", async () => {
    const f = await field(same(hash("fixture.invalid")), same(hash("fixture.invalid")));
    const dl = find(f.capture.requests, "dl")[0];
    const rule = { class: "input_derived", selectors: f.sel, derived_from: corpus,
      source: { request: dl.row.ordinal, field: "query", index: dl.index }, transform: "identity" };
    f.manifest.rules.fields = [{ ...rule, transform: "sha256_hex" }];
    // dl is a document URL, so the hash of "fixture.invalid" is not derived from it.
    expect((await f.run()).errors).toContain("field_rule_violation");
    for (const c of [f.capture, f.candidateCapture]) {
      const row = c.requests[dl.row.ordinal], v = row.query_pairs[dl.index][1];
      for (const { row: target, index } of find(c.requests, "fbp")) query(target, index, hash(v));
    }
    f.manifest.rules.fields = [{ ...rule, transform: "sha256_hex" }];
    f.outputDir = join(f.parent, "second-run");
    const result = await f.run();
    expect(result.errors).toEqual([]);
    expect(result.exit_code).toBe(0);
  });

  it("server_context: both sides must hold a value from the frozen allowed set", async () => {
    const ok = await field(same("eea"), same("non-eea"));
    ok.manifest.rules.fields = [{ class: "server_context", selectors: ok.sel, derived_from: corpus,
      context: "egress_region", allowed: ["eea", "non-eea"] }];
    expect((await ok.run()).exit_code).toBe(0);
    const unseen = await field(same("eea"), same("apac"));
    unseen.manifest.rules.fields = [{ class: "server_context", selectors: unseen.sel, derived_from: corpus,
      context: "egress_region", allowed: ["eea", "non-eea"] }];
    expect((await unseen.run()).errors).toContain("field_rule_violation");
  });

  it.each([
    ["no frozen-corpus digests", r => { r.derived_from = []; }, "field_rule_corpus_missing"],
    ["an unknown class (no generic ignore)", r => { r.class = "ignore"; }, "invalid_field_rule"],
    ["a regex or expression key", r => { r.pattern = ".*"; }, "invalid_field_rule"],
    ["an unknown format kind", r => { r.format = { kind: "regex", min: 1, max: 4 }; }, "invalid_field_format"],
    ["an overlapping selector", r => { r.selectors = [r.selectors[0], r.selectors[0]]; }, "overlapping_rules"],
  ])("rejects a rule with %s as invalid manifest input", async (_name, mutate, code) => {
    const f = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    const rule = f.rule();
    mutate(rule);
    f.manifest.rules.fields = [rule];
    const result = await f.run();
    expect(result.exit_code).toBe(3);
    expect(result.errors).toContain(code);
  });

  it("field rules on a local layer are inconclusive, never silently ignored; identity/hash native rules stay unsupported", async () => {
    const local = await fixture();
    local.manifest.rules.fields = [{ class: "generated", selectors: [selector(0)], derived_from: corpus,
      format: { kind: "token", min: 1, max: 64 }, relation: "none" }];
    const localResult = await local.run();
    expect(localResult.exit_code).toBe(2);
    expect(localResult.errors).toContain("field_rules_native_only");
    const native = await field(same("fb.1.111.aaaa"), same("fb.1.222.bbbb"));
    native.manifest.rules.hashes = [{ input: native.sel[0], digest: native.sel[1], normalization: "identity" }];
    expect((await native.run()).errors).toContain("native_normalization_unsupported");
  });
});
