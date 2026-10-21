import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { record } from "./inspected-meta-record.mjs";
import { ADDITIONAL_COMMANDS, ADDITIONAL_LIMITS, ADDITIONAL_SCOPE, ADDITIONAL_VARIANT,
  SYNTHETIC_ADDITIONAL_ID, OWNER_MESSAGE_AT, additionalLocator } from "./meta-additional-authority.mjs";
import { reserveStockSlot } from "./native-stock-capture.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { superviseAdditionalMetaChild } from "./meta-additional-supervision.mjs";
import { inspectedMetaBindingDigest, inspectedMetaCasePermissionDigest, inspectedMetaSourcePins,
  localInspectedMetaDefinition, prepareLocalInspectedMeta, runLocalInspectedMeta,
  inspectAdditionalMetaQualification } from "./inspected-meta-stock.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const handle = path => ({ path, sha256: hash(readMetaPrivate(path)) });

/** Fixed first-party SDK-ABSENT data only, confined to fresh private rig/out.
 * It never opens real evidence or accepts an authority, URL, source or driver. */
export function createAdditionalMetaFixture() {
  if (arguments.length) throw new Error("invalid_fixture_options");
  mkdirSync("rig/out", { recursive: true });
  const root = join(realpathSync("rig/out"), "059-18-additional-" + randomBytes(12).toString("hex"));
  mkdirSync(root, { mode: 0o700 });
  const save = (name, value) => {
    const path = join(root, name);
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    writeFileSync(path, bytes, { mode: 0o600 });
    return { path, sha256: hash(bytes) };
  };
  const definition = localInspectedMetaDefinition(), now = Date.now();
  const original = save("original-authority.json", {
    schema_version: 1, kind: "owner_conversation_authority", status: "approved_conditional",
    authority_id: "synthetic-inspected-meta-parent", synthetic_only: true,
    cases: Object.fromEntries(["google-stock", "google-chamber", "meta-stock", "meta-chamber"]
      .map(name => [name, { reserved: false, admitted: false, spent: false }])),
    limits: definition.authority_limits,
  });
  const parentReservation = reserveStockSlot({ authority_path: original.path, authority_sha256: original.sha256,
    case_name: "meta-stock", input_sha256: "a".repeat(64), source_sha256: "b".repeat(64),
    window: { not_before_ms: now - 1000, expires_at_ms: now + 59000 } });
  const spent = handle(parentReservation.canonical_record_path);
  const decision = save("synthetic-decision.json", {
    schema: "airlock.synthetic-additional-meta-decision.v1", owner_message_at: OWNER_MESSAGE_AT,
    pending_question: "Fixed SDK-ABSENT fixture, not an owner question", exact_owner_answer: "NOT an owner answer",
    status: "approved_additional_bounded_case_scope", additional_stock_cases: 1,
    commands: ADDITIONAL_COMMANDS, limits: ADDITIONAL_LIMITS, transport: "inspected-network",
    delegated: "Synthetic fixture only", original_authority_and_spent_slot: "Immutable synthetic spent parent",
    remaining_required: ["All native gates remain"], not_granted: ["Any native or public execution"],
    new_slot_reserved: false, sdk_started_by_recording: false, executable_manifest_created: false,
  });
  const baseline = save("lineage-baseline.json", {
    schema: "airlock.additional-meta-original-lineage-baseline.v1", observed_at: new Date(now).toISOString(),
    authority: additionalLocator(original.path), spent_reservation: additionalLocator(spent.path),
    owner_decision: additionalLocator(decision.path),
    new_authority_created: false, new_slot_reserved: false, sdk_started: false, original_mutated: false,
  });
  // The future grant's self locator is established on the same inode, not a
  // copied grant. Native grant authoring is deliberately NOT exposed here.
  const authority = save(SYNTHETIC_ADDITIONAL_ID + ".json", {});
  const stat = lstatSync(authority.path, { bigint: true });
  const authorityValue = {
    schema_version: 1, kind: "owner_conversation_authority", status: "approved_conditional",
    authority_id: SYNTHETIC_ADDITIONAL_ID, authority_variant: ADDITIONAL_VARIANT, synthetic_only: true,
    self_locator: { path: authority.path, dev: String(stat.dev), ino: String(stat.ino) },
    lineage_baseline: additionalLocator(baseline.path),
    cases: { "meta-stock": { reserved: false, admitted: false, spent: false } },
    commands: ADDITIONAL_COMMANDS, limits: ADDITIONAL_LIMITS,
  };
  Object.assign(authority, save(SYNTHETIC_ADDITIONAL_ID + ".json", authorityValue));
  const permission = save("additional-inspection.json", {
    schema_version: 1, kind: "inspected-meta-additional-permission", status: "synthetic_local_only",
    scope: ADDITIONAL_SCOPE, owner_decision: additionalLocator(decision.path), lineage_baseline: additionalLocator(baseline.path),
    original_authority_mutated: false, original_slots_reserved_or_spent: 1, additional_slots_reserved_or_spent: 0,
  });
  const inputs = save("inputs.json", {
    schema_version: 1, profile: "meta-pageview", owned_origin: "https://owned.example",
    document_url: "https://owned.example/inspection", pixel_id: "999999999999999",
    runtime: { ...save("runtime.js", Buffer.from(definition.runtime)),
      request_url: "https://connect.facebook.net/en_US/fbevents.js", response_status: 200 },
    configuration: { ...save("configuration.js", Buffer.from(definition.configuration)),
      request_url: "https://connect.facebook.net/signals/config/999999999999999?v=2.9.0&r=stable&domain=owned.example&hme=synthetic&ex_m=one",
      response_status: 200 },
    source_capture_sha256: "a".repeat(64), authorization: "Fixed synthetic SDK-ABSENT fixture only",
  });
  const binding = {
    inputs, authority, inspection_permission: permission, source_pins: inspectedMetaSourcePins(), cohort: definition.cohort,
    window: { not_before_ms: now - 1000, expires_at_ms: now + 59000 }, limits: definition.limits, commands: ADDITIONAL_COMMANDS,
    additional: { variant: ADDITIONAL_VARIANT, lineage_baseline: additionalLocator(baseline.path) },
    scheduling: { selected_by: "operator", delegated: true, owner_message_at: OWNER_MESSAGE_AT, selected_at_ms: now - 1000 },
  };
  const evidence = {}, manifestPath = join(root, "manifest.json");
  const slot = join(root, "native-stock-slots-" + SYNTHETIC_ADDITIONAL_ID, "meta-stock.reserved");
  const rebind = () => {
    const base = JSON.parse(readFileSync(baseline.path));
    base.authority = additionalLocator(original.path); base.spent_reservation = additionalLocator(spent.path);
    base.owner_decision = additionalLocator(decision.path);
    Object.assign(baseline, save("lineage-baseline.json", base));
    const grant = JSON.parse(readFileSync(authority.path));
    grant.lineage_baseline = additionalLocator(baseline.path);
    writeFileSync(authority.path, JSON.stringify(grant), { mode: 0o600 }); authority.sha256 = hash(readFileSync(authority.path));
    binding.authority = authority; binding.additional.lineage_baseline = additionalLocator(baseline.path);
    const inspection = JSON.parse(readFileSync(permission.path));
    inspection.lineage_baseline = additionalLocator(baseline.path); inspection.owner_decision = additionalLocator(decision.path);
    Object.assign(permission, save("additional-inspection.json", inspection));
    binding.inspection_permission = permission;
    binding.case_permission = save("meta-additional-case-permission.json", {
      schema_version: 1, kind: "inspected-meta-additional-case-location", status: "synthetic_local_binding",
      case_name: "meta-stock", transport: "inspected-network", native_execution_permitted: false,
      authority_locator: additionalLocator(authority.path), canonical_slot_path: slot,
      permission_source_sha256: inspectedMetaCasePermissionDigest(binding), valid_until_ms: binding.window.expires_at_ms,
    });
    for (const [name, assertions] of Object.entries(definition.evidence_assertions))
      evidence[name] = save(name + ".json", { schema_version: 1, kind: "inspected-meta-" + name,
        layer: "synthetic-sdk-absent", binding_sha256: inspectedMetaBindingDigest(binding),
        valid_until_ms: binding.window.expires_at_ms, assertions });
    save("manifest.json", { schema_version: 1, kind: "airlock.inspected-meta-local.v1",
      case_name: "meta-stock", transport: "inspected-network", binding, evidence, output_dir: join(root, "run") });
  };
  rebind();
  return { root, original, spent, decision, baseline, authority, permission, binding, evidence, slot, rebind,
    options: () => ({ manifest_path: manifestPath, manifest_sha256: hash(readFileSync(manifestPath)) }),
    reservationOptions: () => ({ authority_path: authority.path, authority_sha256: authority.sha256,
      case_name: "meta-stock", input_sha256: inputs.sha256, source_sha256: inspectedMetaBindingDigest(binding.source_pins),
      window: binding.window, additional_binding: binding }) };
}

/** Fixed H1/H2 positive programs, independent child exit and final originals.
 * No source downloads, native grants, arbitrary URLs/drivers or public mode. */
export async function runAdditionalMetaQualification(options) {
  const input = record(options, ["outputDir"]);
  const output = input.outputDir;
  if (typeof output !== "string" || !isAbsolute(output) || resolve(output) !== output) throw new Error("invalid_qualification_output");
  const parent = lstatSync(dirname(output));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()
    || (parent.mode & 0o7777) !== 0o700) throw new Error("invalid_qualification_output");
  mkdirSync(output, { mode: 0o700 });
  const source = inspectedMetaSourcePins(), cases = [];
  for (const protocol of ["h1", "h2"]) {
    const f = createAdditionalMetaFixture();
    const child = await superviseAdditionalMetaChild({ ...f.options(), protocol,
      output_dir: join(output, protocol + "-supervision") });
    const actualPath = join(output, protocol + "-actual-child.json");
    writeMetaPrivate(actualPath, child);
    if (child.actual_exit_code !== 0 || child.signal !== null) throw new Error("additional_qualification_child_failed");
    const row = { protocol, manifest: handle(f.options().manifest_path),
      report: handle(join(f.root, "run/report.json")), capture: handle(join(f.root, "run/capture.json")),
      completion: handle(join(f.root, "run/completion.json")), actual_child: handle(actualPath) };
    cases.push(row);
  }
  const indexPath = join(output, "additional-index.json");
  writeMetaPrivate(indexPath, { schema: "airlock.sdk-absent-additional-meta-validation.v1",
    source_pins: source, official_sdk_executed: false, public_upstream_requests: 0, actual_owner_slots_reserved: 0, cases });
  const result = inspectAdditionalMetaQualification(handle(indexPath));
  writeMetaPrivate(join(output, "verified-qualification.json"), { ...result, index: handle(indexPath),
    source_after: inspectedMetaSourcePins(), command_exit_observed: false });
  return result;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length === 5 && args[0] === "--supervised-child" && ["h1", "h2"].includes(args[1])
    && ["normal", "stuck-shutdown"].includes(args[2]) && process.send) {
    const plan = prepareLocalInspectedMeta({ manifest_path: args[3], manifest_sha256: args[4] });
    const result = await runLocalInspectedMeta(plan, { protocol: args[1],
      program: args[2] === "normal" ? "normal" : "supervision-stuck-shutdown" });
    process.exitCode = result.producer_exit_code;
  } else if (args.length === 3 && args[0] === "--witness-additional" && args[1] === "--output-dir") {
    await runAdditionalMetaQualification({ outputDir: args[2] });
    console.log("sdk_absent_additional_path_verified");
  } else throw new Error("invalid_qualification_options");
}
