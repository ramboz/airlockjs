import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, rmSync,
  symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

const load = () => import("./inspected-meta-stock.mjs");
const roots = [];
const retained = new Set();
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
afterEach(() => {
  for (const root of roots.splice(0)) if (!retained.has(root)) rmSync(root, { recursive: true, force: true });
});
function scratch() {
  mkdirSync("rig/out", { recursive: true });
  const root = join(realpathSync("rig/out"), "inspected-controller-" + randomBytes(12).toString("hex"));
  mkdirSync(root, { mode: 0o700 }); roots.push(root); return root;
}
function save(root, name, value) {
  const path = join(root, name), bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  writeFileSync(path, bytes, { mode: 0o600 });
  return { path, sha256: hash(bytes) };
}
async function fixture() {
  const api = await load(), root = scratch(), now = Date.now();
  const definition = api.localInspectedMetaDefinition();
  const inputs = save(root, "inputs.json", {
    schema_version: 1, profile: "meta-pageview", owned_origin: "https://owned.example",
    document_url: "https://owned.example/inspection", pixel_id: "999999999999999",
    runtime: { ...save(root, "runtime.js", Buffer.from(definition.runtime)),
      request_url: "https://connect.facebook.net/en_US/fbevents.js", response_status: 200 },
    configuration: { ...save(root, "configuration.js", Buffer.from(definition.configuration)),
      request_url: "https://connect.facebook.net/signals/config/999999999999999?v=2.9.0&r=stable&domain=owned.example&hme=synthetic&ex_m=one",
      response_status: 200 },
    source_capture_sha256: "a".repeat(64), authorization: "synthetic fixture only",
  });
  const authority = save(root, "authority.json", {
    schema_version: 1, kind: "owner_conversation_authority", status: "approved_conditional",
    authority_id: "synthetic-inspected-meta-fixture", synthetic_only: true,
    cases: Object.fromEntries(["google-stock", "google-chamber", "meta-stock", "meta-chamber"]
      .map(name => [name, { reserved: false, admitted: false, spent: false }])),
    limits: definition.authority_limits,
  });
  const inspection_permission = save(root, "inspection.json", { schema_version: 1,
    kind: "synthetic_inspection_design", status: "local_only", scope: definition.inspection_scope });
  const binding = { inputs, authority, inspection_permission, source_pins: api.inspectedMetaSourcePins(),
    cohort: definition.cohort, window: { not_before_ms: now - 1000, expires_at_ms: now + 59000 },
    limits: definition.limits, commands: { init: 1, pageview: 1, consent: "native-default" } };
  const evidence = {};
  const bind = () => {
    const stat = lstatSync(binding.authority.path, { bigint: true });
    binding.case_permission = save(root, "case-permission.json", { schema_version: 1,
      kind: "inspected-meta-case-location", status: "synthetic_local_binding", case_name: "meta-stock",
      transport: "inspected-network", native_execution_permitted: false,
      authority_locator: { ...binding.authority, dev: String(stat.dev), ino: String(stat.ino) },
      canonical_slot_path: join(root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved"),
      permission_source_sha256: api.inspectedMetaCasePermissionDigest(binding),
      valid_until_ms: binding.window.expires_at_ms });
    for (const [name, assertions] of Object.entries(definition.evidence_assertions))
      evidence[name] = save(root, name + ".json", { schema_version: 1, kind: "inspected-meta-" + name,
        layer: "synthetic-sdk-absent", binding_sha256: api.inspectedMetaBindingDigest(binding),
        valid_until_ms: binding.window.expires_at_ms, assertions });
    return save(root, "manifest.json", { schema_version: 1, kind: "airlock.inspected-meta-local.v1",
      case_name: "meta-stock", transport: "inspected-network", binding, evidence, output_dir: join(root, "run") });
  };
  const manifest = bind();
  return { api, root, binding, evidence, manifest, bind, definition,
    options: () => ({ manifest_path: manifest.path, manifest_sha256: hash(readFileSync(manifest.path)) }) };
}

// Unit-only operator-shaped records; never native permission or browser proof.
async function qualificationFixture() {
  const f = await fixture(), rows = { controller: [], relay: [] }, cases = new Map();
  const controller = [
    ["normal", "h1"], ["normal", "h2"], ["redirect", "h2"], ["finite-window", "h2"],
    ["extra-request", "h1"], ["source-race", "h1"], ["fetch", "h1"], ["unknown-resource", "h1"],
    ["unknown-surface", "h1"], ["reset", "h1"], ["deadline", "h1"], ["close-failure", "h1"],
    ["output-failure", "h1"], ["late-output", "h1"],
  ];
  const negative = { "extra-request": "additional_pageview", "source-race": "case_source_changed",
    fetch: "unqualified_route_or_field", "unknown-resource": "unqualified_route_or_field",
    "unknown-surface": "unqualified_request_body", deadline: "local_deadline_control",
    "close-failure": "local_context_close_failure", "output-failure": "capture_output_failed",
    "late-output": "case_window_inactive" };
  const relays = ["physical", "request", "response", "compression", "aggregate", "transport", "declared-meta",
    "deadline", "close-failure", "output-failure", "late-output"];
  const add = (family, label, protocol = "h1") => {
    const root = join(f.root, family + "-" + label + "-" + protocol), run = join(root, "run");
    mkdirSync(root, { mode: 0o700 }); mkdirSync(run, { mode: 0o700 });
    const fault = ["deadline", "close-failure", "output-failure", "late-output"].includes(label);
    const code = family === "controller" ? negative[label] || label === "reset" ? 2 : 0
      : label === "late-output" ? 3 : fault ? 2 : 0;
    const originalName = (fault ? "failure-" : "") + "case-h1-" + label + ".json";
    const childOriginal = save(run, originalName, { synthetic_only: true, receiver: [{ request: "fixture" }] });
    const capture = save(run, family === "controller" && label === "output-failure" ? "failure-originals.json" : "capture.json",
      family === "controller" ? { schema: "airlock.sdk-absent-inspected-meta-originals.v1", synthetic_only: true }
        : { schema: "airlock.local-inspected-originals.v1", inspected_network: true,
          cases: [{ protocol: "h1", kind: label, originals_file: originalName, originals_sha256: childOriginal.sha256 }] });
    const source = structuredClone(f.binding.source_pins);
    const late = label === "late-output", now = Date.now();
    const reportValue = { cleanup: { all_owned_resources_closed: true, deadline_met: true }, public_upstream_requests: 0,
      execution_authority: false, full_native_guard_qualified: false, source_before: source, source_after: source,
      cohort: { ...f.definition.cohort, headless: family === "relay" }, errors: !late && negative[label] ? [negative[label]] : [],
      producer_exit_code: late ? 0 : code, ...(late ? { window: { not_before_ms: now - 16000, expires_at_ms: now - 1000 } } : {}),
      ...(family === "controller" ? { native_sdk_executed: false, actual_owner_slots_reserved: 0,
        program: label === "source-race" ? "normal" : label, protocol, local_controller_qualified: late || code === 0,
        responses_complete: 0 } : { official_sdk_executed: false, owner_slots_reserved: 0,
        diagnostic_cohort: label, local_composition_qualified: late || code === 0, lifecycle_controls: { fault_observed: fault && !late },
        cases: [{ protocol: "h1", kind: label }] }) };
    const report = save(run, "report.json", reportValue);
    const child = save(root, "actual-child.json", { code, elapsed_external_ms: late ? 16000 : 10, command_exit_observed: true });
    const witnessValue = { code, report_sha256: report.sha256, capture_sha256: capture.sha256 };
    // Real expiry invalidates an intact earlier report, unlike the former
    // named-program forced error. The outer witness must pin that artifact.
    let failureValue, failure;
    if (late) {
      const category = family === "controller" ? "case_window_inactive" : "inspection_output_deadline";
      failureValue = { schema: family === "controller" ? "airlock.inspected-meta-finalization-failure.v1"
        : "airlock.local-inspected-finalization-failure.v1", producer_exit_code: 2,
        command_exit_observed: false, captured_reference_accepted: false, failure_category: category, errors: [category],
        report_sha256: report.sha256, capture_sha256: capture.sha256, window: reportValue.window,
        cleanup: { ...reportValue.cleanup, deadline_met: false }, elapsed_ms: 15050,
        publication: { resources_closed_at_ms: now - 14000, capture_written_at_ms: now - 13900,
          report_write_started_at_ms: now - 13800, attempted_at_ms: now - 950 } };
      failure = save(run, "failure-finalization.json", failureValue);
      witnessValue.finalization_failure_sha256 = failure.sha256;
    }
    const witness = save(root, "verified-child.json", witnessValue);
    const row = { root, report_sha256: report.sha256, actual_child_sha256: child.sha256,
      verified_child_sha256: witness.sha256, capture_sha256: capture.sha256,
      ...(failure ? { finalization_failure_sha256: failure.sha256 } : {}),
      capture_digest_recorded_after_child_exit: true, command_exit_observed: true, actual_exit_code: code };
    rows[family].push(row);
    cases.set(family + "/" + label + "/" + protocol, { root, run, reportValue, witnessValue, row, childOriginal, failureValue });
  };
  for (const [label, protocol] of controller) add("controller", label, protocol);
  for (const label of relays) add("relay", label);
  const value = { schema: "airlock.sdk-absent-inspected-meta-validation.v1",
    source_pins: f.binding.source_pins, official_sdk_executed: false, public_upstream_requests: 0,
    actual_owner_slots_reserved: 0, ...rows };
  const index = () => save(f.root, "unit-qualification-index.json", value);
  const rebindReport = entry => {
    const report = save(entry.run, "report.json", entry.reportValue);
    entry.witnessValue.report_sha256 = report.sha256;
    const witness = save(entry.root, "verified-child.json", entry.witnessValue);
    entry.row.report_sha256 = report.sha256; entry.row.verified_child_sha256 = witness.sha256;
  };
  const rebindFailure = entry => {
    const failure = save(entry.run, "failure-finalization.json", entry.failureValue);
    entry.witnessValue.finalization_failure_sha256 = failure.sha256;
    entry.row.finalization_failure_sha256 = failure.sha256;
    const witness = save(entry.root, "verified-child.json", entry.witnessValue);
    entry.row.verified_child_sha256 = witness.sha256;
  };
  return { ...f, cases, index, rebindReport, rebindFailure };
}

describe("inspected Meta stock preparation", () => {
  it("checks the complete unit-shaped qualification index without granting native authority", async () => {
    const f = await qualificationFixture();
    expect(f.api.inspectSdkAbsentQualification(f.index())).toMatchObject({
      sdk_absent_evidence_verified: true, execution_authority: false, native_sdk_executed: false,
    });
  });

  it.each(["controller", "relay"])("requires an independently pinned real publication failure for %s late output", async family => {
    const f = await qualificationFixture(), entry = f.cases.get(family + "/late-output/h1");
    expect(f.api.inspectSdkAbsentQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
    delete entry.row.finalization_failure_sha256;
    expect(() => f.api.inspectSdkAbsentQualification(f.index())).toThrow("guard_publication_failure_invalid");
  });

  it.each(["controller", "relay"].flatMap(family => [
    "before-expiry", "late-cleanup", "arbitrary-open-resource", "invented-category", "changed-original", "completion-present",
  ].map(fault => [family, fault])))("rejects %s late-output evidence with %s", async (family, fault) => {
    const f = await qualificationFixture(), entry = f.cases.get(family + "/late-output/h1");
    if (fault === "before-expiry") entry.failureValue.publication.attempted_at_ms = entry.reportValue.window.expires_at_ms - 1;
    if (fault === "late-cleanup") entry.failureValue.publication.resources_closed_at_ms = entry.reportValue.window.expires_at_ms;
    if (fault === "arbitrary-open-resource") entry.failureValue.cleanup.all_owned_resources_closed = false;
    if (fault === "invented-category") entry.failureValue.failure_category = "diagnostic_output_deadline";
    if (fault === "changed-original") entry.failureValue.capture_sha256 = "f".repeat(64);
    if (fault === "completion-present") save(entry.run, "completion.json", { synthetic_only: true });
    f.rebindFailure(entry);
    expect(() => f.api.inspectSdkAbsentQualification(f.index())).toThrow("guard_publication_failure_invalid");
  });

  it.each(["controller", "relay"].flatMap(family => [
    "inspected-http-wire.mjs", "inspected-meta-policy.mjs", "native-stock-policy.mjs",
    "qualification-loopback-network.sb", "playwright_driver_bundle", "header_decoder_dependencies",
  ].map(name => [family, name])))("rejects stale %s witness source %s despite a fresh outer index", async (family, name) => {
    const f = await qualificationFixture(), entry = f.cases.get(family + "/normal/h1")
      ?? f.cases.get(family + "/physical/h1");
    entry.reportValue.source_before[name] = "f".repeat(64);
    f.rebindReport(entry);
    expect(() => f.api.inspectSdkAbsentQualification(f.index())).toThrow("guard_qualification_stale_source");
  });

  it.each(["physical", "close-failure", "output-failure"])(
    "rejects missing or changed referenced %s originals, not merely their intact capture index", async label => {
      const f = await qualificationFixture(), entry = f.cases.get("relay/" + label + "/h1");
      writeFileSync(entry.childOriginal.path, "changed original", { mode: 0o600 });
      expect(() => f.api.inspectSdkAbsentQualification(f.index())).toThrow("guard_originals_unavailable");
      rmSync(entry.childOriginal.path);
      expect(() => f.api.inspectSdkAbsentQualification(f.index())).toThrow("guard_originals_unavailable");
    });

  it("returns exact missing native prerequisites without source execution or an invented locator", async () => {
    const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
    manifest.kind = "airlock.inspected-meta-stock.v1";
    manifest.binding.case_permission = null;
    for (const name of Object.keys(manifest.evidence)) manifest.evidence[name] = null;
    save(f.root, "manifest.json", manifest);
    const before = readdirSync(f.root).sort(), plan = f.api.prepareInspectedMetaStock(f.options());
    expect(plan).toMatchObject({ execution: "BLOCKED", preparation_complete: false, native_sdk_executed: false });
    expect(plan.blockers).toEqual(expect.arrayContaining(["original_authority_location_binding_missing",
      "guard_proof_missing", "setup_proof_missing", "coordination_proof_missing", "qualified_source_proof_missing",
      "frame_proof_missing", "compliance_proof_missing", "craft_proof_missing", "architecture_proof_missing",
      "reconciliation_proof_missing"]));
    expect(plan.blockers).not.toContain("native_controller_qualification_incomplete");
    await expect(f.api.runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
    expect(readdirSync(f.root).sort()).toEqual(before);
  });

  it("rejects synthetic receipts relabelled as a native manifest before any real authority lookup", async () => {
    const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
    manifest.kind = "airlock.inspected-meta-stock.v1";
    save(f.root, "manifest.json", manifest);
    expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("synthetic_evidence_not_native_authority");
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });

  it("cannot mint a public-connector lease from a synthetic plan, receipt or caller-owned object", async () => {
    const f = await fixture(), plan = f.api.prepareLocalInspectedMeta(f.options());
    const { startNativeInspectedTransport } = await import("./inspected-transport.mjs");
    for (const candidate of [null, {}, plan, f.binding, f.evidence.guard])
      await expect(startNativeInspectedTransport(candidate)).rejects.toThrow("invalid_native_transport_lease");
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });

  it("does not turn an SDK-absent declaration into guard evidence or native authority", async () => {
    const f = await fixture(), before = readdirSync(f.root).sort();
    expect(() => f.api.inspectSdkAbsentQualification(f.evidence.guard)).toThrow("guard_qualification_invalid");
    expect(readdirSync(f.root).sort()).toEqual(before);
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });

  it("requires an explicit independently post-exit capture digest, including failed lifecycle cases", async () => {
    const f = await fixture();
    const index = save(f.root, "declaration-not-a-qualification.json", {
      schema: "airlock.sdk-absent-inspected-meta-validation.v1", source_pins: f.binding.source_pins,
      official_sdk_executed: false, public_upstream_requests: 0, actual_owner_slots_reserved: 0,
      controller: Array.from({ length: 14 }, () => ({ root: f.root })),
      relay: Array.from({ length: 11 }, () => ({ root: f.root })),
    });
    expect(() => f.api.inspectSdkAbsentQualification(index)).toThrow("guard_capture_witness_missing");
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });

  it.each(["expired", "pending-guard", "pending-review", "unknown-key", "stale-handle"])(
    "blocks incomplete native preparation before public transport/reservation (%s)", async kind => {
      const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
      manifest.kind = "airlock.inspected-meta-stock.v1";
      manifest.binding.case_permission = null;
      manifest.binding.observation_end_ms = manifest.binding.window.expires_at_ms - 6000;
      for (const name of Object.keys(manifest.evidence)) manifest.evidence[name] = null;
      if (kind === "expired") manifest.binding.window = { not_before_ms: 0, expires_at_ms: 1 };
      if (kind === "unknown-key") manifest.binding.force = true;
      if (kind === "stale-handle") manifest.binding.inputs.sha256 = "f".repeat(64);
      if (["pending-guard", "pending-review"].includes(kind)) {
        const guard = kind === "pending-guard", name = guard ? "guard" : "craft";
        const pending = { schema_version: 1, kind: "inspected-meta-" + name,
          layer: "reviewed-inspected-meta-preflight",
          binding_sha256: f.api.inspectedMetaBindingDigest(manifest.binding),
          issued_at_ms: manifest.binding.window.not_before_ms, valid_until_ms: manifest.binding.window.expires_at_ms,
          assertions: guard ? { sdk_absent_guard_qualified: false, physical_semantic_policy_qualified: false,
            closed_controller_qualified: false } : { verdict: "not-run", scope: "059-15-inspected-meta-pre-admission-code" },
          ...(guard ? { qualification: null } : { review_artifact: null }) };
        manifest.evidence[name] = save(f.root, "deliberately-pending-native-" + name + ".json", pending);
      }
      save(f.root, "manifest.json", manifest);
      if (kind === "expired") expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("case_window_inactive");
      else if (kind === "unknown-key") expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("invalid_case_input");
      else if (kind === "stale-handle") expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("stale_case_handle");
      else {
        const plan = f.api.prepareInspectedMetaStock(f.options());
        expect(plan.execution).toBe("BLOCKED");
        expect(plan.blockers).toContain(kind === "pending-guard" ? "guard_proof_incomplete" : "craft_review_incomplete");
        await expect(f.api.runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
      }
      expect(existsSync(join(f.root, "run"))).toBe(false);
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
    });

  it("represents an observed independent agent completion without inventing a reviewer command exit", async () => {
    const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
    manifest.kind = "airlock.inspected-meta-stock.v1";
    manifest.binding.case_permission = null;
    manifest.binding.observation_end_ms = manifest.binding.window.expires_at_ms - 6000;
    for (const name of Object.keys(manifest.evidence)) manifest.evidence[name] = null;
    const binding = f.api.inspectedMetaBindingDigest(manifest.binding);
    const issued = manifest.binding.window.not_before_ms;
    const review = save(f.root, "unit-agent-review.json", {
      schema: "airlock.independent-review-receipt.v2", binding_sha256: binding,
      source_pins_sha256: f.api.inspectedMetaBindingDigest(manifest.binding.source_pins),
      scope: "059-15-inspected-meta-pre-admission-code", verdict: "pass",
      reviewer_id: "unit-only-independent-reviewer", reviewer_kind: "independent",
      completed_at_ms: issued, reviewer_completion_observed: true, reviewer_turn: 0,
    });
    manifest.evidence.craft = save(f.root, "unit-review-binding.json", {
      schema_version: 1, kind: "inspected-meta-craft", layer: "reviewed-inspected-meta-preflight",
      binding_sha256: binding, issued_at_ms: issued, valid_until_ms: manifest.binding.window.expires_at_ms,
      assertions: { verdict: "pass", scope: "059-15-inspected-meta-pre-admission-code" }, review_artifact: review,
    });
    save(f.root, "manifest.json", manifest);
    const plan = f.api.prepareInspectedMetaStock(f.options());
    expect(plan.execution).toBe("BLOCKED");
    expect(plan.blockers).not.toContain("craft_actual_review_missing");
    expect(plan.blockers).not.toContain("craft_review_incomplete");
    expect(existsSync(join(f.root, "run"))).toBe(false);
    expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
    const unobserved = JSON.parse(readFileSync(review.path));
    unobserved.reviewer_completion_observed = false;
    const replacement = save(f.root, "unit-agent-review.json", unobserved);
    const receipt = JSON.parse(readFileSync(manifest.evidence.craft.path));
    receipt.review_artifact = replacement;
    manifest.evidence.craft = save(f.root, "unit-review-binding.json", receipt);
    save(f.root, "manifest.json", manifest);
    expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("actual_review_invalid");
  });

  it("blocks a negative source-authentication assertion before native reservation", async () => {
    const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
    manifest.kind = "airlock.inspected-meta-stock.v1";
    manifest.binding.case_permission = null;
    manifest.binding.observation_end_ms = manifest.binding.window.expires_at_ms - 6000;
    for (const name of Object.keys(manifest.evidence)) manifest.evidence[name] = null;
    manifest.evidence.qualified_source = save(f.root, "negative-source-origin.json", {
      schema_version: 1, kind: "inspected-meta-qualified_source", layer: "reviewed-inspected-meta-preflight",
      binding_sha256: f.api.inspectedMetaBindingDigest(manifest.binding),
      issued_at_ms: manifest.binding.window.not_before_ms, valid_until_ms: manifest.binding.window.expires_at_ms,
      assertions: { retained_bytes_verified: true, declared_dependency_guard_qualified: true, source_authentication: false },
    });
    save(f.root, "manifest.json", manifest);
    const plan = f.api.prepareInspectedMetaStock(f.options());
    expect(plan.blockers).toContain("qualified_source_proof_incomplete");
    await expect(f.api.runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
    expect(existsSync(join(f.root, "run"))).toBe(false);
    expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
  });

  it("binds the installed twelve-package decoder closure, not only its entry point", async () => {
    const { inspectedMetaSourcePins } = await load();
    const { inspectedDecoderDependencyPins } = await import("./inspected-transport.mjs");
    const pins = inspectedMetaSourcePins();
    expect(Object.keys(pins.header_decoder_dependencies)).toHaveLength(12);
    expect(pins.header_decoder_dependencies).toEqual(inspectedDecoderDependencyPins());
    expect(pins.header_decoder_dependencies["hpack.js"]).toMatchObject({
      version: expect.any(String), sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    for (const name of ["inspected-meta-record.mjs", "inspected-meta-record.test.mjs",
      "meta-additional-authority.mjs", "meta-additional-authority.test.mjs",
      "meta-additional-qualification.mjs", "meta-additional-qualification.test.mjs",
      "meta-additional-supervision.mjs", "meta-additional-supervision.test.mjs",
      "meta-rendezvous-peer.mjs", "meta-rendezvous-peer.test.mjs",
      "meta-preexec-bootstrap.mjs", "meta-preexec-bootstrap.test.mjs", "meta-preexec-bootstrap-launcher",
      "meta-owned-socket-observer.c", "meta-owned-socket-observer.cohort.json",
      "sdk-absent-chrome-preexec.mjs", "sdk-absent-chrome-preexec.test.mjs", "sdk-absent-chrome-io.mjs",
      "sdk-absent-chrome-runtime.mjs", "sdk-absent-chrome-runtime.boundary.test.mjs",
      "sdk-absent-chrome-actors.mjs", "sdk-absent-chrome-actors.boundary.test.mjs", "sdk-absent-chrome-launcher",
      "sdk-absent-chrome.browser.test.mjs", "sdk-absent-chrome.browser.config.mjs",
      "sdk-absent-chrome-io.test.mjs", "sdk-absent-chrome-completion.mjs", "sdk-absent-chrome-completion.test.mjs",
      "sdk-absent-chrome-admission.test.mjs"])
      expect(pins[name]).toBe(hash(readFileSync(new URL(name, import.meta.url))));
  });

  it("rejects a byte-identical authority relocated beside a fresh canonical namespace", async () => {
    const f = await fixture(), manifest = JSON.parse(readFileSync(f.manifest.path));
    const other = join(f.root, "relocated"); mkdirSync(other, { mode: 0o700 });
    const copied = save(other, "authority.json", readFileSync(f.binding.authority.path));
    expect(copied.sha256).toBe(f.binding.authority.sha256);
    manifest.binding.authority = copied;
    save(f.root, "manifest.json", manifest);
    expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow("original_authority_location_mismatch");
    expect(readdirSync(other)).toEqual(["authority.json"]);
    expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });
  it("rejects open, accessor and proxy inputs without invoking code or touching output", async () => {
    const { prepareInspectedMetaStock } = await load();
    let invoked = 0;
    const getter = { get manifest_path() { invoked++; throw Error("must_not_run"); }, manifest_sha256: "a".repeat(64) };
    const proxy = new Proxy({}, { getPrototypeOf() { invoked++; throw Error("must_not_run"); } });
    for (const options of [null, {}, getter, proxy, { manifest_path: "/unused", manifest_sha256: "a".repeat(64), force: true }])
      expect(() => prepareInspectedMetaStock(options)).toThrow("invalid_case_input");
    expect(invoked).toBe(0);
  });

  it("rejects unknown cases before reading other handles and remains read-only", async () => {
    const { prepareInspectedMetaStock } = await load(), root = scratch();
    for (const case_name of ["google-stock", "meta-chamber", "unknown"]) {
      const manifest = save(root, "manifest.json", { schema_version: 1,
        kind: "airlock.inspected-meta-stock.v1", case_name });
      expect(() => prepareInspectedMetaStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("unsupported_case");
    }
    expect(readdirSync(root)).toEqual(["manifest.json"]);
    expect(JSON.parse(readFileSync(join(root, "manifest.json"))).case_name).toBe("unknown");
  });

  it("prepares an opaque local-only plan without creating output or a reservation", async () => {
    const f = await fixture(), before = readdirSync(f.root).sort();
    const plan = f.api.prepareLocalInspectedMeta(f.options());
    expect(plan).toMatchObject({ case_name: "meta-stock", transport: "inspected-network",
      execution: "LOCAL-ONLY", native_sdk_executed: false, execution_authority: false,
      full_native_guard_qualified: false, source_bytes_verified: false });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(JSON.stringify(plan)).not.toContain(f.root);
    expect(readdirSync(f.root).sort()).toEqual(before);
    await expect(f.api.runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
    expect(readdirSync(f.root).sort()).toEqual(before);
  });

  it.each(["limits", "commands", "cohort", "pins", "window", "expired", "future", "permission", "authority",
    "missing-review", "stale-review", "native-review", "unknown-handle", "source", "source-permissions",
    "source-symlink", "source-hardlink", "output", "output-symlink", "output-parent", "manifest-hash"])(
    "rejects unsafe/stale local preparation (%s) without a slot or output", async kind => {
      const f = await fixture();
      if (kind === "limits") f.binding.limits.meta_requests = 9;
      if (kind === "commands") f.binding.commands.pageview = 2;
      if (kind === "cohort") f.binding.cohort.headless = true;
      if (kind === "pins") f.binding.source_pins["inspected-meta-policy.mjs"] = "b".repeat(64);
      if (kind === "window") f.binding.window.expires_at_ms = f.binding.window.not_before_ms + 60001;
      if (kind === "expired") f.binding.window = { not_before_ms: 0, expires_at_ms: 1 };
      if (kind === "future") f.binding.window = { not_before_ms: Date.now() + 10000, expires_at_ms: Date.now() + 20000 };
      if (kind === "permission") {
        const value = JSON.parse(readFileSync(f.binding.inspection_permission.path));
        value.scope.additional_events_or_retry_grants = true;
        f.binding.inspection_permission = save(f.root, "inspection.json", value);
      }
      if (kind === "authority") {
        const value = JSON.parse(readFileSync(f.binding.authority.path));
        value.authority_id = "google-meta-paired-2026-10-19";
        f.binding.authority = save(f.root, "authority.json", value);
      }
      f.bind();
      if (["missing-review", "stale-review", "native-review"].includes(kind)) {
        const value = JSON.parse(readFileSync(f.evidence.craft.path));
        if (kind === "missing-review") rmSync(f.evidence.craft.path);
        else {
          if (kind === "stale-review") value.binding_sha256 = "b".repeat(64);
          else value.layer = "native-inspected-meta";
          f.evidence.craft = save(f.root, "craft.json", value);
        }
      }
      if (kind === "unknown-handle") f.binding.inputs.arbitrary = true;
      if (kind.startsWith("source")) {
        const path = join(f.root, "runtime.js");
        if (kind === "source") writeFileSync(path, "throw Error('MUST_NOT_EXECUTE')");
        if (kind === "source-permissions") chmodSync(path, 0o644);
        if (kind === "source-symlink") {
          rmSync(path); symlinkSync(join(f.root, "configuration.js"), path);
        }
        if (kind === "source-hardlink") linkSync(path, join(f.root, "hardlink.js"));
      }
      if (kind === "output") mkdirSync(join(f.root, "run"), { mode: 0o700 });
      if (kind === "output-symlink") symlinkSync(join(f.root, "absent"), join(f.root, "run"));
      if (kind === "output-parent") chmodSync(f.root, 0o755);
      // Rebind only manifest bytes, not stale evidence or changed source pins.
      const manifest = JSON.parse(readFileSync(f.manifest.path));
      manifest.binding = f.binding; manifest.evidence = f.evidence;
      save(f.root, "manifest.json", manifest);
      const options = f.options();
      if (kind === "manifest-hash") options.manifest_sha256 = "f".repeat(64);
      expect(() => f.api.prepareLocalInspectedMeta(options)).toThrow();
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
      if (!kind.startsWith("output")) expect(existsSync(join(f.root, "run"))).toBe(false);
    });

  it("rejects duplicate JSON keys rather than silently selecting the last authority/handle", async () => {
    const f = await fixture(), path = f.manifest.path;
    const value = readFileSync(path, "utf8").replace('"case_name":"meta-stock"', '"case_name":"meta-stock","case_name":"meta-stock"');
    save(f.root, "manifest.json", Buffer.from(value));
    expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow("duplicate_case_key");
  });

  it("cannot promote a synthetic plan/receipt or provide callbacks to the native or local executor", async () => {
    const f = await fixture(), plan = f.api.prepareLocalInspectedMeta(f.options());
    expect(() => f.api.prepareInspectedMetaStock(f.options())).toThrow("unsupported_case_mode");
    await expect(f.api.runInspectedMetaStock({ ...plan, execution_authority: true })).rejects.toThrow("invalid_prepared_case");
    await expect(f.api.runLocalInspectedMeta({ ...plan })).rejects.toThrow("invalid_prepared_case");
    await expect(f.api.runLocalInspectedMeta(plan, { program: "normal", upstream: "https://www.facebook.com" }))
      .rejects.toThrow("invalid_case_input");
    expect(existsSync(join(f.root, "run"))).toBe(false);
  });

  it("detects changed source after preparation before output, a browser, or canonical reservation", async () => {
    const f = await fixture(), plan = f.api.prepareLocalInspectedMeta(f.options());
    const path = join(f.root, "runtime.js");
    writeFileSync(path, "MUST_NOT_EXECUTE");
    await expect(f.api.runLocalInspectedMeta(plan)).rejects.toThrow("case_source_changed");
    expect(existsSync(join(f.root, "run"))).toBe(false);
    expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
  });

  it("uses the original canonical one-shot namespace even with a new output or prepared case", async () => {
    const f = await fixture(), plan = f.api.prepareLocalInspectedMeta(f.options());
    const { reserveStockSlot } = await import("./native-stock-capture.mjs");
    reserveStockSlot({ authority_path: f.binding.authority.path, authority_sha256: f.binding.authority.sha256,
      case_name: "meta-stock", input_sha256: f.binding.inputs.sha256, source_sha256: "a".repeat(64),
      window: f.binding.window });
    const folder = join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture");
    expect(readdirSync(folder)).toEqual(["meta-stock.reserved"]);
    await expect(f.api.runLocalInspectedMeta(plan)).rejects.toThrow("stock_slot_spent");
    const manifest = JSON.parse(readFileSync(f.manifest.path));
    manifest.output_dir = join(f.root, "new-output"); save(f.root, "manifest.json", manifest);
    expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow("stock_slot_spent");
    expect(existsSync(manifest.output_dir)).toBe(false);
    expect(JSON.parse(readFileSync(join(folder, "meta-stock.reserved"))).state).toBe("spent");
  });

  it.each(["expiry", "wall-regression", "monotonic-regression", "identical-source-replacement"])(
    "rejects late preparation changes without spending (%s)", async kind => {
      const f = await fixture(), plan = f.api.prepareLocalInspectedMeta(f.options());
      let expected = "case_clock_invalid";
      if (kind === "expiry") {
        vi.spyOn(Date, "now").mockReturnValue(f.binding.window.expires_at_ms); expected = "case_window_inactive";
      }
      if (kind === "wall-regression") vi.spyOn(Date, "now").mockReturnValue(0);
      if (kind === "monotonic-regression") vi.spyOn(performance, "now").mockReturnValue(0);
      if (kind === "identical-source-replacement") {
        const path = join(f.root, "runtime.js"), original = readFileSync(path);
        writeFileSync(path, "changed"); writeFileSync(path, original); expected = "case_source_changed";
      }
      try { await expect(f.api.runLocalInspectedMeta(plan)).rejects.toThrow(expected); }
      finally { vi.restoreAllMocks(); }
      expect(existsSync(join(f.root, "run"))).toBe(false);
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
    });

  it("does not invoke nested declaration accessors, proxies, symbols or serialization hooks", async () => {
    const { inspectedMetaBindingDigest } = await load();
    let calls = 0;
    const getter = { get path() { calls++; return "must_not_read"; } };
    for (const input of [{ nested: getter }, { nested: new Proxy({}, { ownKeys() { calls++; return []; } }) },
      { nested: { [Symbol("unknown")]: true } }, { nested: { toJSON() { calls++; return {}; } } }])
      expect(() => inspectedMetaBindingDigest(input)).toThrow("invalid_case_input");
    expect(calls).toBe(0);
  });

  it.each(["google_requests", "meta_requests", "observations", "url_bytes", "request_bytes",
    "response_bytes", "aggregate_bytes", "duration_ms"])(
    "rejects any increase to original %s without changing original authority", async name => {
      const f = await fixture(), original = readFileSync(f.binding.authority.path);
      f.binding.limits[name]++;
      f.bind();
      expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow("case_envelope_mismatch");
      expect(readFileSync(f.binding.authority.path)).toEqual(original);
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture"))).toBe(false);
    });
});

async function witnessedLocal(protocol, program = "normal", interference = null) {
  const f = await fixture();
  if (program === "late-output") {
    f.binding.window.expires_at_ms = Date.now() + 15000;
    f.bind();
  }
  retained.add(f.root);
  const entry = new URL("./inspected-meta-stock.mjs", import.meta.url).href;
  const code = `import{prepareLocalInspectedMeta,runLocalInspectedMeta}from${JSON.stringify(entry)};
    try {
      const plan=prepareLocalInspectedMeta({manifest_path:process.argv[1],manifest_sha256:process.argv[2]});
      const result=await runLocalInspectedMeta(plan,JSON.parse(process.argv[3]));
      console.log(JSON.stringify({category:"sdk_absent_controller",cases:1,qualified:result.local_controller_qualified,
        sdk_executed:false,public_upstream_requests:result.public_upstream_requests}));
      process.exitCode=result.producer_exit_code;
    } catch { console.error("local_controller_failed"); process.exitCode=3; }`;
  const command = ["--input-type=module", "-e", code, f.manifest.path, f.options().manifest_sha256,
    JSON.stringify({ protocol, program })];
  const started = performance.now();
  let child, modified = false;
  const mutator = interference === "source-after-reserve" ? setInterval(() => {
    if (modified || !existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved"))) return;
    modified = true; writeFileSync(join(f.root, "runtime.js"), "MUST_NOT_EXECUTE_CHANGED_FIXTURE");
  }, 1) : null;
  try { child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0 }; }
  catch (error) { child = { code: error.code, signal: error.signal ?? null, stdout: error.stdout, stderr: error.stderr }; }
  finally { clearInterval(mutator); }
  const elapsed = Math.ceil(performance.now() - started);
  save(f.root, "actual-child.json", { command, ...child, elapsed_external_ms: elapsed, command_exit_observed: true });
  const output = join(f.root, "run"), reportBytes = readFileSync(join(output, "report.json"));
  const report = JSON.parse(reportBytes), captureBytes = readFileSync(join(output,
    program === "output-failure" ? "failure-originals.json" : "capture.json"));
  const failurePath = join(output, "failure-finalization.json");
  save(f.root, "verified-child.json", { actual_exit_code: child.code, command_exit_observed: true,
    report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes), elapsed_external_ms: elapsed,
    ...(existsSync(failurePath) ? { finalization_failure_sha256: hash(readFileSync(failurePath)) } : {}) });
  expect(elapsed).toBeLessThan(60000);
  return { f, child, report, capture: JSON.parse(captureBytes), output, modified };
}

describe("actual local SDK-absent controller witness", () => {
  it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    "observes a complete fixed finite interval through the same engine before closing", async () => {
      const { child, report, capture } = await witnessedLocal("h2", "finite-window");
      expect(child.code).toBe(0);
      expect(report).toMatchObject({ finite_observation_completed: true, local_controller_qualified: true,
        engine: "shared-inspected-meta", native_sdk_executed: false, public_upstream_requests: 0, receiver_attempts: 1 });
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      expect(capture.source_execution).toHaveLength(2);
      expect(capture.order.at(-1)).toBe("context_closed");
    }, 70000);

  it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    "spends forever but never executes changed source racing after reservation", async () => {
      const { child, report, capture, modified, f } = await witnessedLocal("h2", "normal", "source-after-reserve");
      expect(modified).toBe(true);
      expect(child.code).toBe(2);
      expect(report.errors).toContain("case_source_changed");
      expect(report).toMatchObject({ local_controller_qualified: false, native_sdk_executed: false, local_slot_reserved: true });
      expect(report.receiver_attempts).toBeLessThanOrEqual(1);
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      for (const row of capture.script_evidence)
        expect(row.sha256).toBe(hash(Buffer.from(f.definition[row.role])));
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved"))).toBe(true);
      expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow();
    }, 70000);

  for (const protocol of ["h1", "h2"]) it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    `qualifies ${protocol} reservation/source/dispatch/original-response/close ordering`, async () => {
      const { f, child, report, capture, output } = await witnessedLocal(protocol);
      expect(child.code).toBe(0);
      expect(report).toMatchObject({ local_controller_qualified: true, native_sdk_executed: false,
        execution_authority: false, full_native_guard_qualified: false, source_bytes_verified: false,
        reference_source_cohort: "sdk-absent-fixture",
        native_tls_parity: false, captured_reference_accepted: false, fixture_sources_consumed: 2,
        actual_owner_slots_reserved: 0, public_upstream_requests: 0, receiver_attempts: 1,
        responses_complete: 1, response_originals_match: true, original_wire_bytes_equal: true, callback_outcomes: [true] });
      expect(report.errors).toEqual([]);
      expect(report.source_before).toEqual(f.binding.source_pins);
      expect(report.source_after).toEqual(report.source_before);
      expect(report.binding_sha256).toBe(f.api.inspectedMetaBindingDigest(f.binding));
      expect(report.cohort).toMatchObject({ headless: false, transport: "inspected-network" });
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      expect(capture.order[0]).toBe("durable_reservation");
      expect(capture.reference_source_cohort).toBe("sdk-absent-fixture");
      expect(capture.order.indexOf("fixture_execution")).toBeLessThan(capture.order.indexOf("logical_dispatch"));
      expect(capture.order.indexOf("logical_dispatch")).toBeLessThan(capture.order.indexOf("receiver"));
      expect(capture.order.at(-1)).toBe("context_closed");
      expect(capture.local_result).toMatchObject({ init: 1, pageview: 1 });
      expect(capture.script_evidence.map(row => row.role).sort()).toEqual(["configuration", "runtime"]);
      expect(capture.source_execution.map(row => row.role).sort()).toEqual(["configuration", "runtime"]);
      expect(capture.source_execution.every(row => row.evidence === "validated_before_script_execution_and_resumed")).toBe(true);
      expect(report.engine).toBe("shared-inspected-meta");
      expect(capture.cookies.map(cookie => cookie.name).sort()).toEqual(["local_one", "local_two"]);
      expect(capture.originals.responses[0].status).toBe(200);
      expect(capture.originals.requests[0].logical_network_id).toBe(capture.logical_observations[0].network_id);
      expect(capture.originals.requests[0].logical_fetch_id).toBe(capture.logical_observations[0].fetch_id);
      expect(capture.originals.requests[0].policy_decision.dispatch_authorized).toBe(false);
      const completion = JSON.parse(readFileSync(join(output, "completion.json")));
      expect(completion).toMatchObject({ transport: "inspected-network", command_exit_observed: false,
        producer_exit_code: 0, capture_sha256: hash(readFileSync(join(output, "capture.json"))),
        report_sha256: hash(readFileSync(join(output, "report.json"))) });
      expect(completion.window).toEqual(f.binding.window);
      expect(completion.publication.resources_closed_at_ms).toBeLessThanOrEqual(completion.publication.attempted_at_ms);
      expect(completion.publication.attempted_at_ms).toBeLessThan(f.binding.window.expires_at_ms);
      expect(readdirSync(output).filter(name => name.endsWith("-key.pem"))).toEqual([]);
      const record = join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved");
      expect(JSON.parse(readFileSync(record)).state).toBe("spent");
    }, 70000);

  it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    "follows an actual reused-Network-ID/new-Fetch-ID redirect using completed original parents", async () => {
      const { child, report, capture } = await witnessedLocal("h2", "redirect");
      expect(child.code).toBe(0);
      expect(report).toMatchObject({ local_controller_qualified: true, receiver_attempts: 2,
        responses_complete: 2, response_originals_match: true, original_wire_bytes_equal: true });
      const requests = capture.originals.requests;
      expect(requests.map(row => [row.ordinal, row.policy_ordinal, row.redirect_from])).toEqual([[1, 0, null], [2, 1, 1]]);
      expect(requests[0].logical_network_id).toBe(requests[1].logical_network_id);
      expect(requests[0].logical_fetch_id).not.toBe(requests[1].logical_fetch_id);
      expect(Buffer.from(capture.originals.responses[0].body, "base64").toString()).toBe("fixed first-party redirect original");
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
    }, 70000);

  for (const [program, reason] of [
    ["extra-request", "additional_pageview"],
    ["fetch", "unqualified_route_or_field"], ["unknown-resource", "unqualified_route_or_field"],
    ["unknown-surface", "unqualified_request_body"], ["reset", null], ["deadline", "local_deadline_control"],
    ["close-failure", "local_context_close_failure"], ["output-failure", "capture_output_failed"],
  ]) it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    `preserves a spent/inconclusive ${program} case without any silent retry`, async () => {
      const { f, child, report, capture, output } = await witnessedLocal("h1", program);
      expect(child.code).toBe(2);
      expect(report).toMatchObject({ local_controller_qualified: false, local_slot_reserved: true,
        native_sdk_executed: false, full_native_guard_qualified: false, public_upstream_requests: 0 });
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      if (reason) expect(report.errors).toContain(reason);
      if (["fetch", "unknown-resource", "unknown-surface"].includes(program)) expect(report.receiver_attempts).toBe(0);
      else expect(report.receiver_attempts).toBe(1);
      if (program === "fetch") {
        expect(capture.network_events.at(-1).resource_type).toBe("Fetch");
        expect(capture.fetch_events.at(-1).resource_type).toBe("XHR");
      }
      if (["close-failure", "output-failure"].includes(program)) {
        expect(capture.originals.responses).toHaveLength(1);
        expect(capture.originals.responses[0].state).toBe("complete");
        expect(Buffer.from(capture.originals.responses[0].body, "base64").length).toBeGreaterThan(0);
      }
      if (program === "reset") {
        expect(capture.originals.responses.some(row => row.state === "inconclusive")).toBe(true);
        expect(report.responses_complete).toBe(0);
        expect(report.callback_outcomes).not.toEqual([true]);
      }
      if (program === "output-failure") {
        expect(JSON.parse(readFileSync(join(output, "capture.json")))).toEqual({ synthetic_collision_not_originals: true });
        expect(existsSync(join(output, "failure-originals.json"))).toBe(true);
        expect(existsSync(join(output, "completion.json"))).toBe(false);
      }
      expect(JSON.parse(readFileSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved"))).state)
        .toBe("spent");
      expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow();
    }, 70000);

  it.runIf(process.env.AIRLOCK_INSPECTED_META_CONTROLLER_QUALIFICATION === "1")(
    "rejects expired actual publication through the shared case finalization guard after owned cleanup", async () => {
      const { f, child, report, capture, output } = await witnessedLocal("h1", "late-output");
      expect(child.code).toBe(2);
      expect(capture.originals.responses).toHaveLength(1);
      expect(capture.originals.responses[0].state).toBe("complete");
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      // The early report is preserved, not rewritten as if it had observed a
      // future failure. Only the real finalization guard may invalidate it.
      expect(report).toMatchObject({ local_controller_qualified: true, producer_exit_code: 0,
        native_sdk_executed: false, full_native_guard_qualified: false, execution_authority: false,
        local_slot_reserved: true, actual_owner_slots_reserved: 0, public_upstream_requests: 0 });
      expect(report.errors).toEqual([]);
      const failureBytes = readFileSync(join(output, "failure-finalization.json"));
      const failure = JSON.parse(failureBytes);
      expect(failure).toMatchObject({ producer_exit_code: 2, command_exit_observed: false,
        captured_reference_accepted: false, failure_category: "case_window_inactive",
        errors: ["case_window_inactive"], window: f.binding.window,
        capture_sha256: hash(readFileSync(join(output, "capture.json"))),
        report_sha256: hash(readFileSync(join(output, "report.json"))),
        cleanup: { deadline_met: false } });
      expect(Object.entries(failure.cleanup).filter(([name]) => name !== "deadline_met").every(([, closed]) => closed === true)).toBe(true);
      expect(failure.publication.resources_closed_at_ms).toBeLessThan(f.binding.window.expires_at_ms);
      expect(failure.publication.report_write_started_at_ms).toBeLessThan(f.binding.window.expires_at_ms);
      expect(failure.publication.attempted_at_ms).toBeGreaterThanOrEqual(f.binding.window.expires_at_ms);
      expect(failure.publication.attempted_at_ms).toBeGreaterThan(failure.publication.resources_closed_at_ms);
      expect(failure.elapsed_ms).toBeLessThan(60000);
      expect(f.binding.window.expires_at_ms - f.binding.window.not_before_ms).toBeLessThanOrEqual(17000);
      expect(capture.originals.responses).toHaveLength(1);
      expect(capture.originals.responses[0].state).toBe("complete");
      expect(capture.source_execution).toHaveLength(2);
      expect(capture.order.at(-1)).toBe("context_closed");
      expect(report.source_before).toEqual(report.source_after);
      expect(existsSync(join(output, "completion.json"))).toBe(false);
      expect(readdirSync(output).filter(name => name.endsWith("-key.pem"))).toEqual([]);
      const witness = JSON.parse(readFileSync(join(f.root, "verified-child.json")));
      expect(witness.finalization_failure_sha256).toBe(hash(failureBytes));
      expect(JSON.parse(readFileSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-fixture", "meta-stock.reserved"))).state)
        .toBe("spent");
      expect(() => f.api.prepareLocalInspectedMeta(f.options())).toThrow();
    }, 70000);
});
