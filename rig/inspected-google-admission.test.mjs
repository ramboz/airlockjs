import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { googleBindingDigest, googleCasePermissionDigest, inspectLocalGooglePreparation,
  runNativeGoogleStock } from "./inspected-google-admission.mjs";
import { prepareNativeGoogleStock } from "./inspected-google-controller.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { LIMITS } from "./native-stock-policy.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const scope = { case_name: "google-stock", initialization_commands: 1, configuration_commands: 1,
  conversion_commands: 1, value: 1, currency: "USD", action: "owned_secondary_purchase",
  physical_vendor_http_attempt_ceiling: 20, absolute_seconds: 60, uses_original_existing_google_stock_slot: true,
  additional_events_or_retry_grants: false, temporary_inspector_trust_in_isolated_browser: true,
  upstream_real_collector_certificate_validation_required: true, inspected_network_not_chrome_tls: true,
  system_trust_changes: false, account_or_billing_changes: false };
function preparationFixture() {
  const root = resolve("rig/out", `google-prep-${randomBytes(8).toString("hex")}`);
  mkdirSync(root, { mode: 0o700 });
  const save = (name, value) => {
    const path = `${root}/${name}`, bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    writeFileSync(path, bytes, { mode: 0o600 });
    return { path, sha256: hash(bytes) };
  };
  const source = save("runtime.js", Buffer.from("/* sdk-absent google fixture */\n"));
  const inputs = { schema_version: 1, profile: "google-ads-conversion", owned_origin: "https://owned.example",
    document_url: "https://owned.example/inspection",
    owned: { conversion_id: "AW-000000000", conversion_label: "synthetic", value: 1,
      currency: "USD", transaction_id: "synthetic-transaction" },
    runtime: { ...source, request_url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
      response_status: 200 }, companion_authorized: true, source_capture_sha256: "a".repeat(64),
    authorization: "synthetic fixture only" };
  const authority = save("authority.json", { schema_version: 1, kind: "owner_conversation_authority",
    status: "approved_conditional", authority_id: "synthetic-only-grant", synthetic_only: true,
    cases: Object.fromEntries(["google-stock", "google-chamber", "meta-stock", "meta-chamber"]
      .map(name => [name, { reserved: false, admitted: false, spent: false }])),
    limits: { google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
      google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
      google_vendor_https_requests_per_case: 20, meta_vendor_https_requests_per_case: 8,
      observed_requests_per_case: 64, absolute_seconds_per_case: 60, url_bytes: 2048,
      request_headers_and_body_bytes: 65536, response_bytes: 2097152, retained_aggregate_bytes: 8388608 } });
  const inspection = { schema_version: 1, kind: "inspected-google-reference-design",
    status: "synthetic_local_binding", decision: "ADR-0045",
    decision_sha256: hash(readFileSync("docs/decisions/adr-0045-inspected-google-reference.md")), scope };
  const now = Date.now(), binding = { inputs: null, authority,
    inspection_permission: null, case_permission: null, source_pins: inspectedMetaSourcePins(),
    cohort: currentGoogleCohort(), window: { not_before_ms: now - 1000, expires_at_ms: now + 55000,
      observation_end_ms: now + 45000 }, limits: LIMITS,
    commands: { initialize: 1, configure: 1, conversion: 1, consent: "native-default" } };
  const evidence = { setup: null, coordination: null, qualified_source: null, guard: null,
    frame: null, compliance: null, craft: null, architecture: null, reconciliation: null };
  let manifest;
  const refresh = () => {
    binding.inputs = save("inputs.json", inputs);
    binding.inspection_permission = save("inspection.json", inspection);
    const stat = statSync(authority.path);
    binding.case_permission = save("case.json", { schema_version: 1, kind: "inspected-google-case-location",
      status: "synthetic_local_binding", case_name: "google-stock", transport: "inspected-network",
      native_execution_permitted: false, authority_locator: { ...authority, dev: String(stat.dev), ino: String(stat.ino) },
      canonical_slot_path: `${root}/native-stock-slots-synthetic-only-grant/google-stock.reserved`,
      permission_source_sha256: googleCasePermissionDigest(binding), valid_until_ms: binding.window.expires_at_ms });
    manifest = save("manifest.json", { schema_version: 1, kind: "airlock.inspected-google-local.v1",
      case_name: "google-stock", transport: "inspected-network", binding, evidence, output_dir: `${root}/run` });
    return { manifest_path: manifest.path, manifest_sha256: manifest.sha256 };
  };
  return { root, save, inputs, binding, evidence, inspection, refresh };
}

describe("closed Google manifest preparation", () => {
  it("rejects accessor options without invoking them", () => {
    let called = false;
    const options = { manifest_sha256: "0".repeat(64) };
    Object.defineProperty(options, "manifest_path", { enumerable: true, get() { called = true; return ""; } });
    expect(() => inspectLocalGooglePreparation(options)).toThrow("invalid_case_input");
    expect(() => prepareNativeGoogleStock(options)).toThrow("google_native_admission_closed");
    expect(called).toBe(false);
  });

  it("compiles the fixed policy in a synthetic-only inspection but never provides a native plan", async () => {
    const f = preparationFixture();
    try {
      const options = f.refresh(), report = inspectLocalGooglePreparation(options);
      expect(report).toMatchObject({ admission: "blocked", execution_authority: false,
        profile: "google-ads-conversion", case_name: "google-stock" });
      expect(report.blockers).toContain("browser_descendant_cleanup_unqualified");
      expect(() => prepareNativeGoogleStock(options)).toThrow();
      await expect(runNativeGoogleStock(report)).rejects.toThrow("invalid_google_prepared_case");
      await expect(runNativeGoogleStock(JSON.parse(JSON.stringify(report)))).rejects.toThrow("invalid_google_prepared_case");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["value", "currency", "transaction", "label", "runtime-url", "runtime-status", "command", "scope"])(
    "rejects changed %s before an executable plan or reservation", kind => {
      const f = preparationFixture();
      try {
        if (kind === "value") f.inputs.owned.value = 2;
        if (kind === "currency") f.inputs.owned.currency = "EUR";
        if (kind === "transaction") f.inputs.owned.transaction_id = "";
        if (kind === "label") f.inputs.owned.conversion_label = "";
        if (kind === "runtime-url") f.inputs.runtime.request_url = "https://foreign.example/gtag/js?id=AW-000000000";
        if (kind === "runtime-status") f.inputs.runtime.response_status = 404;
        if (kind === "command") f.binding.commands.conversion = 2;
        if (kind === "scope") f.inspection.scope = { ...scope, absolute_seconds: 61 };
        const options = f.refresh();
        const category = kind === "runtime-status" ? "google_retained_source_invalid"
          : kind === "command" ? "google_envelope_invalid"
            : kind === "scope" ? "google_inspection_scope_invalid" : "invalid_native_policy";
        expect(() => inspectLocalGooglePreparation(options)).toThrow(category);
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    });

  it.each(["source", "cohort", "window"])("rejects a stale %s binding", kind => {
    const f = preparationFixture();
    try {
      if (kind === "source") f.binding.source_pins["rig/inspected-google-admission.mjs"] = "0".repeat(64);
      if (kind === "cohort") f.binding.cohort = { ...f.binding.cohort, node: "wrong" };
      if (kind === "window") f.binding.window.expires_at_ms = Date.now() - 1;
      const options = f.refresh();
      expect(() => inspectLocalGooglePreparation(options)).toThrow(kind === "source" ? "google_source_stale"
        : kind === "cohort" ? "google_cohort_stale" : "google_window_inactive");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["missing", "content", "inode", "spent"])("rejects %s original authority or slot", kind => {
    const f = preparationFixture();
    try {
      const options = f.refresh(), path = f.binding.authority.path, bytes = readFileSync(path);
      if (kind === "missing" || kind === "inode") rmSync(path);
      if (kind === "content") writeFileSync(path, "changed", { mode: 0o600 });
      if (kind === "inode") writeFileSync(path, bytes, { mode: 0o600 });
      if (kind === "spent") {
        mkdirSync(`${f.root}/native-stock-slots-synthetic-only-grant`, { mode: 0o700 });
        writeFileSync(`${f.root}/native-stock-slots-synthetic-only-grant/google-stock.reserved`, "reserved", { mode: 0o600 });
      }
      expect(() => inspectLocalGooglePreparation(options)).toThrow(kind === "missing" ? "google_private_handle_unavailable"
        : kind === "content" ? "google_private_handle_stale"
          : kind === "inode" ? "google_case_permission_invalid" : "google_stock_slot_spent");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["locator", "slot"])("rejects a case permission bound to a different %s", kind => {
    const f = preparationFixture();
    try {
      const options = f.refresh(), manifest = JSON.parse(readFileSync(options.manifest_path));
      const permission = JSON.parse(readFileSync(f.binding.case_permission.path));
      if (kind === "locator") permission.authority_locator.ino = "0";
      else permission.canonical_slot_path += ".other";
      manifest.binding.case_permission = f.save("case.json", permission);
      const handle = f.save("manifest.json", manifest);
      expect(() => inspectLocalGooglePreparation({ manifest_path: handle.path, manifest_sha256: handle.sha256 }))
        .toThrow("google_case_permission_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects incomplete source-bound qualification indexes and synthetic evidence claiming native authority", () => {
    const f = preparationFixture();
    try {
      f.refresh();
      f.evidence.guard = f.save("guard.json", { schema_version: 1, kind: "inspected-google-guard",
        layer: "reviewed-inspected-google-preflight", binding_sha256: googleBindingDigest(f.binding),
        issued_at_ms: f.binding.window.not_before_ms - 1, valid_until_ms: f.binding.window.expires_at_ms,
        assertions: {}, qualification: f.save("index.json", { schema: "airlock.sdk-absent-google-browser-validation.v1",
          source_pins: f.binding.source_pins, cohort: f.binding.cohort, cases: [] }) });
      expect(() => inspectLocalGooglePreparation(f.refresh())).toThrow("google_qualification_incomplete");
      const stale = JSON.parse(readFileSync(f.evidence.guard.path));
      stale.binding_sha256 = "0".repeat(64);
      f.evidence.guard = f.save("guard.json", stale);
      expect(() => inspectLocalGooglePreparation(f.refresh())).toThrow("google_evidence_stale");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("traverses a complete synthetic qualification index and fails on missing or changed originals and completion", () => {
    const f = preparationFixture();
    try {
      f.refresh();
      const controls = ["positive", "marker", "marker-bypass", "path", "path-bypass", "changed-input",
        "changed-input-bypass", "ambiguous", "ambiguous-bypass", "authority", "authority-bypass", "body",
        "body-bypass", "expiration", "expiration-bypass", "unsupported-transport", "unsupported-transport-bypass",
        "response-parent", "response-parent-unlinked", "response-parent-unlinked-bypass",
        "response-parent-incomplete", "response-parent-incomplete-bypass", "aggregate", "aggregate-bypass",
        "close", "close-positive", "no-ticket", "abort", "redirect", "budget", "budget-bypass", "certificate",
        "wrong-name", "response-limit", "response-limit-bypass", "header-limit", "header-limit-bypass",
        "truncated", "truncated-bypass", "retry", "retry-bypass", "goaway", "goaway-bypass"];
      const source = hash(JSON.stringify(f.binding.source_pins)), cohort = hash(JSON.stringify(f.binding.cohort));
      const cases = [];
      for (const protocol of ["h1", "h2"]) for (const control of controls) {
        if (protocol === "h1" && control.startsWith("goaway")) continue;
        const base = `${protocol}-${control}`;
        mkdirSync(`${f.root}/${base}/run`, { recursive: true, mode: 0o700 });
        const bytes = Buffer.from("x"), original = file => {
          f.save(`${base}/run/${file}`, bytes);
          return { file, bytes: 1, chunks: [1], sha256: hash(bytes) };
        };
        const responses = [{ body: original("original-1.bin") }];
        const wire = control === "positive" ? [{ request: original("original-2.bin"),
          response: original("original-3.bin") }] : [];
        const abort = control === "abort", code = abort ? 1 : 0, outputHash = hash("");
        const result = f.save(`${base}/run/result.json`, { protocol, control, outcome: abort ? "inconclusive" : "pass",
          errors: abort ? ["synthetic_abort"] : [], receiver_attempts: abort ? 1 : 0,
          cleanup: { guard_at_context_close: true }, native_sdk_executed: false, public_upstream_requests: 0,
          native_execution_qualified: false, source_before: f.binding.source_pins, source_after: f.binding.source_pins,
          cohort_before: f.binding.cohort, cohort_after: f.binding.cohort, originals: { wire, responses } });
        const completion = f.save(`${base}/command-completion.json`, {
          schema: "airlock.sdk-absent-google-command-completion.v1", protocol, control, complete: false,
          producer_evidence: "not_validated", command_exit_observed: true, command_close_observed: true,
          exit_code: code, close_code: code, signal: null, close_signal: null, spawn_failed: false,
          output_overflow: false, elapsed_ms: 10, source_before_sha256: source, cohort_before_sha256: cohort,
          stdout_sha256: outputHash, stderr_sha256: outputHash });
        const witness = f.save(`${base}/witness.json`, { schema: "airlock.sdk-absent-google-child-witness.v1",
          protocol, control, complete: true, command_exit_observed: true, exit_code: code, signal: null,
          result_sha256: result.sha256, source_sha256: source, cohort_sha256: cohort, elapsed_ms: 10,
          stdout_sha256: outputHash, stderr_sha256: outputHash, producer_outcome: abort ? "inconclusive" : "pass",
          native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false });
        cases.push({ protocol, control, result, witness, completion });
      }
      const index = f.save("index.json", { schema: "airlock.sdk-absent-google-browser-validation.v1",
        source_pins: f.binding.source_pins, cohort: f.binding.cohort, cases });
      f.evidence.guard = f.save("guard.json", { schema_version: 1, kind: "inspected-google-guard",
        layer: "reviewed-inspected-google-preflight", binding_sha256: googleBindingDigest(f.binding),
        issued_at_ms: f.binding.window.not_before_ms - 1, valid_until_ms: f.binding.window.expires_at_ms,
        assertions: {}, qualification: index });
      const options = f.refresh(), report = inspectLocalGooglePreparation(options);
      expect(report.blockers).toContain("guard_independent_provenance_unqualified");
      expect(report.blockers).toContain("current_browser_qualification_unverified");
      const originalPath = `${f.root}/h1-positive/run/original-1.bin`;
      writeFileSync(originalPath, "changed", { mode: 0o600 });
      expect(() => inspectLocalGooglePreparation(options)).toThrow("google_private_handle_stale");
      writeFileSync(originalPath, "x", { mode: 0o600 });
      rmSync(`${f.root}/h1-positive/command-completion.json`);
      expect(() => inspectLocalGooglePreparation(options)).toThrow("google_private_handle_unavailable");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }, 30000);

  it.each(["wrong-case", "wrong-pass", "stale-source", "needs-changes"])(
    "rejects %s review artifacts rather than matching unrelated pass text", kind => {
      const f = preparationFixture();
      try {
        f.refresh();
        const bindingHash = googleBindingDigest(f.binding), sourceHash = googleBindingDigest(f.binding.source_pins);
        const now = f.binding.window.not_before_ms - 2000, scopeName = "059-15-google-stock-inspected-network-compliance";
        const doc = f.save("review.md", Buffer.from(`---\nslice: ${kind === "wrong-case" ? "059-14" : "059-15"}\n`
          + `pass: ${kind === "wrong-pass" ? "craft" : "compliance"}\nverdict: ${kind === "needs-changes" ? "needs-changes" : "pass"}\n`
          + `reviewer: jig:reviewer\nreviewed_at: ${new Date(now).toISOString()}\nprompt_source: review.py implementation\n`
          + `binding_sha256: ${bindingHash}\nsource_pins_sha256: ${sourceHash}\n---\nOther pass: pass\n`));
        const review = f.save("independent-review.json", { schema: "airlock.independent-review-receipt.v2",
          binding_sha256: bindingHash, source_pins_sha256: kind === "stale-source" ? "0".repeat(64) : sourceHash,
          scope: scopeName, verdict: "pass", reviewer_id: "jig:reviewer", reviewer_kind: "independent",
          completed_at_ms: now, reviewer_completion_observed: true, reviewer_turn: 1 });
        f.evidence.compliance = f.save("receipt.json", { schema_version: 1, kind: "inspected-google-compliance",
          layer: "reviewed-inspected-google-preflight", binding_sha256: bindingHash,
          issued_at_ms: f.binding.window.not_before_ms - 1, valid_until_ms: f.binding.window.expires_at_ms,
          assertions: { verdict: "pass", scope: scopeName }, review_artifact: review, review_document: doc });
        expect(() => inspectLocalGooglePreparation(f.refresh())).toThrow("google_review_invalid");
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    });

  it("checks a matching independent review without treating its synthetic receipt as authority", () => {
    const f = preparationFixture();
    try {
      f.refresh();
      const bindingHash = googleBindingDigest(f.binding), sourceHash = googleBindingDigest(f.binding.source_pins);
      const now = Math.floor((f.binding.window.not_before_ms - 2000) / 1000) * 1000;
      const scopeName = "059-15-google-stock-inspected-network-compliance";
      const doc = f.save("review.md", Buffer.from(`---\nslice: 059-15\npass: compliance\nverdict: pass\n`
        + `reviewer: jig:reviewer\nreviewed_at: ${new Date(now).toISOString()}\nprompt_source: review.py implementation\n`
        + `binding_sha256: ${bindingHash}\nsource_pins_sha256: ${sourceHash}\n---\n`));
      const review = f.save("independent-review.json", { schema: "airlock.independent-review-receipt.v2",
        binding_sha256: bindingHash, source_pins_sha256: sourceHash, scope: scopeName, verdict: "pass",
        reviewer_id: "jig:reviewer", reviewer_kind: "independent", completed_at_ms: now,
        reviewer_completion_observed: true, reviewer_turn: 1 });
      f.evidence.compliance = f.save("receipt.json", { schema_version: 1, kind: "inspected-google-compliance",
        layer: "reviewed-inspected-google-preflight", binding_sha256: bindingHash,
        issued_at_ms: f.binding.window.not_before_ms - 1, valid_until_ms: f.binding.window.expires_at_ms,
        assertions: { verdict: "pass", scope: scopeName }, review_artifact: review, review_document: doc });
      const report = inspectLocalGooglePreparation(f.refresh());
      expect(report.execution_authority).toBe(false);
      expect(report.blockers).toContain("evidence_provenance_unqualified");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects the actual non-clearing compliance review in the strict preparation path", () => {
    const f = preparationFixture();
    try {
      f.refresh();
      const bindingHash = googleBindingDigest(f.binding), sourceHash = googleBindingDigest(f.binding.source_pins);
      const now = Math.floor((f.binding.window.not_before_ms - 2000) / 1000) * 1000;
      const scopeName = "059-15-google-stock-inspected-network-compliance";
      const doc = f.save("actual-compliance.md",
        readFileSync("docs/specs/059-google-ads-full-compatibility/reviews/slice-15-compliance.md"));
      const review = f.save("independent-review.json", { schema: "airlock.independent-review-receipt.v2",
        binding_sha256: bindingHash, source_pins_sha256: sourceHash, scope: scopeName, verdict: "pass",
        reviewer_id: "jig:reviewer", reviewer_kind: "independent", completed_at_ms: now,
        reviewer_completion_observed: true, reviewer_turn: 1 });
      f.evidence.compliance = f.save("receipt.json", { schema_version: 1, kind: "inspected-google-compliance",
        layer: "reviewed-inspected-google-preflight", binding_sha256: bindingHash,
        issued_at_ms: f.binding.window.not_before_ms - 1, valid_until_ms: f.binding.window.expires_at_ms,
        assertions: { verdict: "pass", scope: scopeName }, review_artifact: review, review_document: doc });
      expect(() => inspectLocalGooglePreparation(f.refresh())).toThrow("google_review_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
