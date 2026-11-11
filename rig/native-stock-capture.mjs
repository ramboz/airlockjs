import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { constants, closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync,
  readFileSync, readSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { isProxy } from "node:util/types";
import { denyStockExecution, LIMITS } from "./native-stock-policy.mjs";
import { classifyProbe, probeFirstParty } from "./native-stock-egress.mjs";
import { data, equal, json } from "./inspected-meta-record.mjs";
import { additionalAuthority, additionalSnapshotReader, validateAdditionalAuthority,
  validateAdditionalInspection, validateAdditionalLocation } from "./meta-additional-authority.mjs";

const execute = promisify(execFile);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const googleAdditionalReservations = new WeakMap();
const nativeGoogleReservationPermits = new WeakMap();
const claims = Object.freeze({
  native_sdk_executed: false, live_guard_qualified: false, case_reserved: false,
  vendor_http_received: false, product_receipt: false, matching: false, attribution: false,
});
const plain = value => value !== null && typeof value === "object"
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const privateTarget = (stat, directory = false) =>
  (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1)
  && stat.uid === process.getuid() && (stat.mode & 0o7777) === (directory ? 0o700 : 0o600);
function syncDir(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function privateJson(path, value) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify(value));
    for (let offset = 0; offset < bytes.length;) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw new Error("output_write_failed");
      offset += written;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDir(dirname(path));
}
function prepareOutput(path) {
  try {
    // Reject every symlink ancestor, not just the immediate parent.
    let ancestor = dirname(path);
    const parent = lstatSync(ancestor);
    if (parent.uid !== process.getuid() || (parent.mode & 0o7777) !== 0o700)
      throw new Error("private_parent_required");
    while (true) {
      const s = lstatSync(ancestor);
      if (!s.isDirectory() || s.isSymbolicLink()) throw new Error("unsafe_ancestor");
      if (ancestor === parse(ancestor).root) break;
      ancestor = dirname(ancestor);
    }
    mkdirSync(path, { mode: 0o700 });
    syncDir(path); syncDir(dirname(path));
  } catch { throw new Error("output_unavailable"); }
}

export function claimSyntheticGoogleReservation(reservation, bindingSha256) {
  return claimGoogleAdditionalReservation(reservation, bindingSha256, "synthetic");
}

export function claimNativeGoogleReservation(reservation, bindingSha256) {
  return claimGoogleAdditionalReservation(reservation, bindingSha256, "native");
}

function claimGoogleAdditionalReservation(reservation, bindingSha256, kind) {
  if (!reservation || isProxy(reservation) || !googleAdditionalReservations.has(reservation))
    throw new Error("google_additional_reservation_invalid");
  const expected = googleAdditionalReservations.get(reservation);
  googleAdditionalReservations.delete(reservation);
  if (expected.binding !== bindingSha256 || expected.kind !== kind)
    throw new Error("google_additional_reservation_invalid");
}

export async function reserveNativeAdditionalGoogleSlot(admissionTicket, binding) {
  const { claimNativeGoogleReservationAdmission } = await import("./inspected-google-admission.mjs");
  claimNativeGoogleReservationAdmission(admissionTicket, binding);
  const permit = Object.freeze({});
  nativeGoogleReservationPermits.set(permit, hash(JSON.stringify(data(binding))));
  try {
    return reserveStockSlot({ authority_path: binding.authority.path, authority_sha256: binding.authority.sha256,
      case_name: "google-stock", input_sha256: binding.inputs.sha256, source_sha256: binding.source_sha256,
      window: binding.window, additional_binding: binding, native_permit: permit });
  } finally { nativeGoogleReservationPermits.delete(permit); }
}

// Reservation is bookkeeping only. The caller must establish every execution
// prerequisite before using it; this API does not make the stock CLI executable.
export function reserveStockSlot(options) {
  const snapshotData = value => {
    if (isProxy(value) || !plain(value)) throw new Error("invalid_slot_input");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some(key => !Object.hasOwn(descriptors[key], "value")))
      throw new Error("invalid_slot_input");
    return Object.fromEntries(Reflect.ownKeys(descriptors).map(key => [key, descriptors[key].value]));
  };
  if (isProxy(options)) throw new Error("invalid_slot_input");
  if (!plain(options)) throw new Error("unsupported_case");
  options = snapshotData(options);
  if (!["google-stock", "meta-stock"].includes(options.case_name))
    throw new Error("unsupported_case");
  options.window = snapshotData(options.window);
  const keys = ["authority_path", "authority_sha256", "case_name", "input_sha256",
    "source_sha256", "window"];
  if (!Reflect.ownKeys(options).every(key => keys.includes(key) || ["clock", "additional_binding", "native_permit"].includes(key))
    || !keys.every(key => Object.hasOwn(options, key))
    || typeof options.authority_path !== "string" || !isAbsolute(options.authority_path)
    || resolve(options.authority_path) !== options.authority_path
    || ![options.authority_sha256, options.input_sha256, options.source_sha256].every(digest)
    || !plain(options.window) || Reflect.ownKeys(options.window).length !== 2
    || !["not_before_ms", "expires_at_ms"].every(key => Number.isSafeInteger(options.window[key]))
    || options.window.not_before_ms < 0 || options.window.expires_at_ms <= options.window.not_before_ms
    || options.window.expires_at_ms - options.window.not_before_ms > LIMITS.duration_ms
    || (options.clock !== undefined && typeof options.clock !== "function"))
    throw new Error("invalid_slot_input");
  options = Object.freeze({ ...options, window: Object.freeze({ ...options.window }),
    ...(Object.hasOwn(options, "additional_binding") ? { additional_binding: data(options.additional_binding) } : {}) });
  if (options.case_name === "google-stock" && options.additional_binding) {
    const binding = options.additional_binding, root = dirname(options.authority_path);
    const synthetic = equal(binding.cohort, { kind: "sdk-free-synthetic", native_execution_qualified: false });
    if (synthetic ? dirname(root) !== resolve("rig/out")
      || !/^google-additional-[a-f0-9]{16}$/.test(root.slice(resolve("rig/out").length + 1))
      || options.authority_path !== join(root, "authority.json") || binding.case_permission?.path !== join(root, "case.json")
      : options.authority_path !== join(root, "google-additional-authority.json")
      || binding.case_permission?.path !== join(root, "google-additional-case-permission.json"))
      throw new Error("google_additional_reservation_binding_invalid");
    if (synthetic && Object.hasOwn(options, "native_permit"))
      throw new Error("invalid_google_native_reservation_permit");
    if (!synthetic) {
      const permit = options.native_permit;
      if (!permit || isProxy(permit) || !nativeGoogleReservationPermits.has(permit))
        throw new Error("invalid_google_native_reservation_permit");
      const expected = nativeGoogleReservationPermits.get(permit);
      nativeGoogleReservationPermits.delete(permit);
      if (expected !== hash(JSON.stringify(data(binding)))) throw new Error("invalid_google_native_reservation_permit");
    }
  } else if (Object.hasOwn(options, "native_permit")) {
    throw new Error("invalid_google_native_reservation_permit");
  }
  const clock = options.clock ?? (() => Date.now()), window = { ...options.window };
  let last = null;
  const check = () => {
    let now;
    try { now = clock(); } catch { throw new Error("slot_clock_invalid"); }
    if (!Number.isFinite(now) || now < 0 || (last !== null && now < last))
      throw new Error("slot_clock_invalid");
    last = now;
    if (now < window.not_before_ms || now >= window.expires_at_ms) throw new Error("slot_window_inactive");
    return now;
  };
  check();
  let authority, authorityBytes;
  try {
    const parent = lstatSync(dirname(options.authority_path));
    if (!privateTarget(parent, true)) throw new Error("invalid_authority_parent");
    const fd = openSync(options.authority_path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let bytes;
    try {
      const stat = fstatSync(fd);
      if (!privateTarget(stat) || stat.size > 65536) throw new Error("invalid_authority_file");
      const buffer = Buffer.alloc(65537);
      let offset = 0, count;
      while (offset < buffer.length && (count = readSync(fd, buffer, offset, buffer.length - offset, offset)) > 0)
        offset += count;
      if (offset > 65536) throw new Error("authority_limit");
      bytes = buffer.subarray(0, offset);
    } finally { closeSync(fd); }
    if (hash(bytes) !== options.authority_sha256) throw new Error("stale_authority");
    authorityBytes = bytes;
    authority = JSON.parse(bytes.toString("utf8"));
  } catch { throw new Error("slot_authority_unavailable"); }
  let additional = null, additionalReader = null, googleAdditional = false, googleNative = false;
  if (plain(authority) && authority.authority_variant === "google-additional") {
    authority = json(authorityBytes);
    const binding = options.additional_binding;
    if (!binding || options.case_name !== "google-stock" || Object.hasOwn(options, "clock")
      || !equal(binding.authority, { path: options.authority_path, sha256: options.authority_sha256 })
      || binding.inputs?.sha256 !== options.input_sha256 || binding.source_sha256 !== options.source_sha256
      || !equal(binding.window, options.window)) throw new Error("google_additional_reservation_binding_invalid");
    const { createNativeAdditionalGoogleReader, validateNativeAdditionalGoogle } =
      createRequire(import.meta.url)("./inspected-google-additional.mjs");
    additionalReader = createNativeAdditionalGoogleReader();
    additional = validateNativeAdditionalGoogle(binding, additionalReader);
    if (!equal(additional.authority, authority)) throw new Error("google_additional_authority_invalid");
    googleAdditional = googleNative = true;
  } else if (plain(authority) && (authority.schema === "airlock.synthetic-google-additional-authority.v1"
    || typeof authority.authority_id === "string" && authority.authority_id.startsWith("synthetic-google-additional-"))) {
    authority = json(authorityBytes);
    const binding = options.additional_binding;
    if (!binding || options.case_name !== "google-stock" || Object.hasOwn(options, "clock")
      || !equal(binding.authority, { path: options.authority_path, sha256: options.authority_sha256 })
      || binding.inputs?.sha256 !== options.input_sha256 || binding.source_sha256 !== options.source_sha256
      || !equal(binding.window, options.window)) throw new Error("google_additional_reservation_binding_invalid");
    const { createAdditionalGoogleReader, validateSyntheticAdditionalGoogle } =
      createRequire(import.meta.url)("./inspected-google-additional.mjs");
    additionalReader = createAdditionalGoogleReader(dirname(options.authority_path));
    const validated = validateSyntheticAdditionalGoogle(binding, additionalReader);
    if (!equal(validated.authority, authority)) throw new Error("google_additional_authority_invalid");
    additional = validated;
    googleAdditional = true;
  } else if (plain(authority) && additionalAuthority(authority)) {
    authority = json(authorityBytes);
    const binding = options.additional_binding;
    if (!binding || options.case_name !== "meta-stock" || Object.hasOwn(options, "clock")
      || !equal(binding.authority, { path: options.authority_path, sha256: options.authority_sha256 })
      || binding.inputs?.sha256 !== options.input_sha256
      || hash(JSON.stringify(data(binding.source_pins))) !== options.source_sha256
      || !equal(binding.window, options.window)) throw new Error("additional_reservation_binding_invalid");
    additionalReader = additionalSnapshotReader();
    additionalReader.read(binding.authority);
    const local = authority.synthetic_only === true, root = local ? dirname(options.authority_path) : null;
    if (local && !root.startsWith(resolve("rig/out") + "/")) throw new Error("nonlocal_fixture_handle");
    additional = validateAdditionalAuthority({ authority, binding, local, root, read: additionalReader.read });
    const permission = json(additionalReader.read(binding.inspection_permission));
    validateAdditionalInspection(permission, binding, local);
    if (!equal(permission.owner_decision, additional.baseline.owner_decision))
      throw new Error("additional_inspection_permission_invalid");
    const location = json(additionalReader.read(binding.case_permission));
    validateAdditionalLocation(location, binding, authority, local, additional.baseline);
    additionalReader.unchanged();
  } else if (Object.hasOwn(options, "additional_binding")) throw new Error("additional_authority_required");
  else if (!plain(authority) || authority.schema_version !== 1 || authority.kind !== "owner_conversation_authority"
    || authority.status !== "approved_conditional" || typeof authority.authority_id !== "string"
    || !/^[a-z][a-z0-9-]{0,63}$/.test(authority.authority_id)
    || !plain(authority.cases) || !plain(authority.cases[options.case_name])
    || !["reserved", "admitted", "spent"].every(key => authority.cases[options.case_name][key] === false)
    || !plain(authority.limits)
    || !Object.entries({
      google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
      google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
      google_vendor_https_requests_per_case: LIMITS.google_requests,
      meta_vendor_https_requests_per_case: LIMITS.meta_requests, observed_requests_per_case: LIMITS.observations,
      absolute_seconds_per_case: 60, url_bytes: LIMITS.url_bytes,
      request_headers_and_body_bytes: LIMITS.request_bytes, response_bytes: LIMITS.response_bytes,
      retained_aggregate_bytes: LIMITS.aggregate_bytes,
    }).every(([key, value]) => authority.limits[key] === value)) throw new Error("slot_authority_invalid");
  const reservedAt = check();
  const dir = join(dirname(options.authority_path), `native-stock-slots-${authority.authority_id}`);
  const path = join(dir, `${options.case_name}.reserved`);
  const record = {
    schema_version: 1, state: "spent", case_name: options.case_name,
    authority_id: authority.authority_id, authority_sha256: options.authority_sha256,
    source_sha256: options.source_sha256, input_sha256: options.input_sha256,
    reserved_at_ms: reservedAt, window,
    execution_prerequisites_proved_by_reservation: false,
    ...(additional ? { authority_variant: googleAdditional
      ? googleNative ? "google-additional" : "synthetic-google-additional" : "additional-meta-2026-10-21",
      lineage_baseline_sha256: googleAdditional ? options.additional_binding.baseline.sha256 : authority.lineage_baseline.sha256,
      binding_sha256: hash(JSON.stringify(data(options.additional_binding))) } : {}),
  };
  let recordIdentity;
  try {
    try { mkdirSync(dir, { mode: 0o700 }); }
    catch (caught) { if (caught.code !== "EEXIST") throw caught; }
    if (!privateTarget(lstatSync(dir), true)) throw new Error("unsafe_slot_directory");
    syncDir(dirname(dir));
    let fd;
    try {
      fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    } catch (caught) {
      if (["EEXIST", "ELOOP"].includes(caught.code)) {
        const spent = privateTarget(lstatSync(path));
        // eslint-disable-next-line preserve-caught-error -- Filesystem causes expose private journal paths.
        throw new Error(spent ? "stock_slot_spent" : "unsafe_slot_record");
      }
      throw caught;
    }
    try {
      if (!privateTarget(fstatSync(fd))) throw new Error("unsafe_slot_record");
      const bytes = Buffer.from(JSON.stringify(record) + "\n");
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(fd, bytes, offset, bytes.length - offset);
        if (!written) throw new Error("slot_write_failed");
        offset += written;
      }
      fsyncSync(fd);
      const s = fstatSync(fd, { bigint: true });
      recordIdentity = [s.dev, s.ino, s.nlink, s.size, s.mode, s.mtimeNs, s.ctimeNs].join(":");
    } finally { closeSync(fd); }
    syncDir(dir);
  } catch (caught) {
    if (caught.message === "stock_slot_spent") throw caught;
    // eslint-disable-next-line preserve-caught-error -- Do not attach private authority/filesystem details.
    throw new Error("stock_reservation_failed");
  }
  check(); // A late failure leaves the exclusive record spent; there is no refund.
  additionalReader?.unchanged();
  if (additional) {
    const s = lstatSync(path, { bigint: true });
    if ([s.dev, s.ino, s.nlink, s.size, s.mode, s.mtimeNs, s.ctimeNs].join(":") !== recordIdentity)
      throw new Error("canonical_reservation_changed");
  }
  const result = Object.freeze({ case_name: options.case_name, reserved: true, network_authorized: false,
    owner_identity_authenticated: false, execution_prerequisites_proved: false,
    canonical_record_path: path, canonical_record_identity: recordIdentity });
  if (googleAdditional)
    googleAdditionalReservations.set(result, { kind: googleNative ? "native" : "synthetic",
      binding: hash(JSON.stringify(data(options.additional_binding))) });
  return result;
}

// No official-source/native execution entry. This delivers the permitted
// concrete pre-admission blocker, not a partially implemented live guard.
export async function runQualification(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir" || typeof options.outputDir !== "string"
    || !isAbsolute(options.outputDir) || resolve(options.outputDir) !== options.outputDir)
    throw new Error("invalid_options");
  const start = performance.now();
  const checkDeadline = () => {
    if (performance.now() - start >= LIMITS.duration_ms) throw new Error("output_deadline");
  };
  prepareOutput(options.outputDir);
  const osVersion = await execute("/usr/bin/sw_vers", ["-productVersion"], { timeout: 2000 });
  if (osVersion.stdout.trim() !== "27.0.1") throw new Error("cohort_mismatch");
  const oldMask = process.umask(0o077);
  try {
    await execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-sha256", "-days", "1", "-keyout", join(options.outputDir, "key.pem"),
      "-out", join(options.outputDir, "certificate.pem"), "-subj", "/CN=collector.test.invalid",
      "-addext", "subjectAltName=DNS:collector.test.invalid"], { timeout: 5000, maxBuffer: 8192 });
  } catch { throw new Error("local_certificate_failed"); }
  finally { process.umask(oldMask); }
  checkDeadline();
  const result = await probeFirstParty(options);
  const finding = classifyProbe(result.protocols);
  const report = {
    schema: "airlock.native-stock-pre-admission-blocker.v1",
    ...finding, protocols: result.protocols, cleanup: result.cleanup, claims,
    cohort: { node: process.version, chrome: "155.0.8059.80", macos: "27.0.1", darwin: "27.0.0",
      headless: true, test_trust: "exact_generated_spki_only", native_mode_available: false },
    errors: [...result.errors, ...finding.errors], producer_exit_code: 2,
    provenance: Object.fromEntries(["native-stock-capture.mjs", "native-stock-capture.test.mjs",
      "native-stock-meta.mjs", "native-stock-meta.test.mjs", "native-stock-egress.mjs", "native-stock-egress.test.mjs",
      "native-stock-policy.mjs", "native-stock-policy.test.mjs",
      "meta-additional-authority.mjs", "meta-additional-authority.test.mjs",
      "inspected-meta-record.mjs", "inspected-meta-record.test.mjs",
      "qualification-loopback-chrome", "qualification-loopback-network.sb"]
      .map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))])),
  };
  const require = createRequire(import.meta.url);
  report.provenance.playwright_entry_sha256 = hash(readFileSync(new URL(import.meta.resolve("playwright"))));
  report.provenance.playwright_version = require("playwright/package.json").version;
  report.provenance.lockfile_sha256 = hash(readFileSync(new URL("../package-lock.json", import.meta.url)));
  report.witnessed &&= report.errors.length === 0 && Object.values(report.cleanup).every(Boolean);
  checkDeadline();
  privateJson(join(options.outputDir, "capture.json"), result.raw);
  privateJson(join(options.outputDir, "report.json"), report);
  checkDeadline();
  privateJson(join(options.outputDir, "completion.json"), {
    schema: "airlock.synthetic-blocker-completion.v1", command_exit_observed: false,
    producer_exit_code: 2, report_sha256: hash(readFileSync(join(options.outputDir, "report.json"))),
    capture_sha256: hash(readFileSync(join(options.outputDir, "capture.json"))),
  });
  checkDeadline();
  return report;
}

// This witness observes a separate fixed child's real exit. A witnessed count
// blocker is NOT a passing native-execution qualification or an owner slot.
export async function runMetaCountWitness(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir"
    || typeof Object.getOwnPropertyDescriptor(options, "outputDir")?.value !== "string"
    || !isAbsolute(options.outputDir) || resolve(options.outputDir) !== options.outputDir)
    throw new Error("invalid_options");
  const outputDir = options.outputDir, started = performance.now();
  prepareOutput(outputDir);
  const { metaSourcePins, readMetaPrivate, classifyMetaCountProbe } = await import("./native-stock-meta.mjs");
  const before = metaSourcePins();
  const run = join(outputDir, "run");
  const command = [fileURLToPath(import.meta.url), "--qualify-meta-counts", "--output-dir", run];
  let child;
  try {
    child = { ...await execute(process.execPath, command, {
      timeout: Math.max(1, Math.floor(LIMITS.duration_ms - (performance.now() - started))), maxBuffer: 16384,
    }), code: 0, signal: null };
  } catch (caught) {
    child = { code: Number.isInteger(caught.code) ? caught.code : null,
      signal: caught.signal ?? null, stdout: caught.stdout ?? "", stderr: caught.stderr ?? "" };
  }
  privateJson(join(outputDir, "actual-child.json"), {
    command: [process.execPath, ...command], command_exit_observed: true,
    actual_exit_code: child.code, signal: child.signal, stdout: child.stdout, stderr: child.stderr,
  });
  const after = metaSourcePins();
  const receipts = Object.fromEntries(["report", "capture", "completion"].map(name => {
    const path = join(run, name + ".json"), bytes = readMetaPrivate(path);
    return [name, { path, sha256: hash(bytes) }];
  }));
  const report = JSON.parse(readMetaPrivate(receipts.report.path));
  const raw = JSON.parse(readMetaPrivate(receipts.capture.path));
  const completion = JSON.parse(readMetaPrivate(receipts.completion.path));
  const matched = child.code === 2 && child.signal === null
    && JSON.stringify(before) === JSON.stringify(after)
    && report.schema === "airlock.meta-transmission-count-blocker.v1"
    && raw.schema === "airlock.meta-transmission-count-originals.v1"
    && report.witnessed === true && report.errors.length === 0
    && Object.values(report.cleanup).every(Boolean) && classifyMetaCountProbe(raw.cases).witnessed
    && JSON.stringify(report.source_pins) === JSON.stringify(before)
    && report.official_sdk_executed === false && report.owner_slots_reserved === 0
    && report.native_execution_qualified === false
    && completion.schema === "airlock.meta-count-completion.v1" && completion.command_exit_observed === false
    && completion.producer_exit_code === 2 && completion.report_sha256 === receipts.report.sha256
    && completion.capture_sha256 === receipts.capture.sha256
    && performance.now() - started < LIMITS.duration_ms;
  const witness = { schema: "airlock.meta-count-command-witness.v1",
    command: [process.execPath, ...command], command_exit_observed: true,
    actual_exit_code: child.code, signal: child.signal, stdout: child.stdout, stderr: child.stderr,
    source_before: before, source_after: after, receipts, blocker_witnessed: matched,
    native_execution_qualified: false, sdk_executed: false, owner_slots_reserved: 0,
    observed_elapsed_ms: Math.ceil(performance.now() - started) };
  privateJson(join(outputDir, "witness.json"), witness);
  if (!matched || performance.now() - started >= LIMITS.duration_ms) throw new Error("count_witness_unmatched");
  return witness;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === "--execute") denyStockExecution(args[1]); // Before all filesystem/SDK/journal work.
    if (args.length !== 3 || !["--qualify", "--qualify-meta-counts", "--witness-meta-counts"].includes(args[0])
      || args[1] !== "--output-dir")
      throw new Error("invalid_options");
    if (args[0] === "--qualify-meta-counts") {
      const { runMetaCountQualification } = await import("./native-stock-meta.mjs");
      const report = await runMetaCountQualification({ outputDir: args[2] });
      console.log(JSON.stringify({ category: report.witnessed ? "wire_count_blocker_witnessed" : "inconclusive_count_probe",
        cases: report.cases.length, sdk_executed: false, owner_slots_reserved: 0, native_execution_qualified: false }));
      process.exitCode = report.producer_exit_code;
    } else if (args[0] === "--witness-meta-counts") {
      await runMetaCountWitness({ outputDir: args[2] });
      console.log(JSON.stringify({ category: "wire_count_blocker_child_exit_witnessed",
        sdk_executed: false, owner_slots_reserved: 0, native_execution_qualified: false }));
    } else {
      const report = await runQualification({ outputDir: args[2] });
      console.log(JSON.stringify({ category: report.witnessed ? "pre_admission_blocker_witnessed" : "inconclusive_probe",
        blockers: report.blockers, protocols: report.protocols.length, claims: report.claims,
        cleanup: report.cleanup }));
      process.exitCode = 2;
    }
  } catch (caught) {
    console.error(["invalid_options", "unsupported_case", "pre_admission_blocked",
      "output_unavailable", "output_deadline", "local_certificate_failed", "cohort_mismatch",
      "count_probe_deadline", "count_witness_unmatched", "invalid_count_probe_options"]
      .includes(caught.message) ? caught.message : "qualification_failed");
    process.exitCode = 3;
  }
}
