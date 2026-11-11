import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, fstatSync, lstatSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isProxy } from "node:util/types";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { privateOriginalDirectory, readPrivateOriginal } from "./private-original-file.mjs";
import { createNativeStockPolicy, LIMITS } from "./native-stock-policy.mjs";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const digest = value => hash(JSON.stringify(data(value)));
const fail = reason => { throw Error(reason); };
const commands = Object.freeze({ initialize: 1, configure: 1, conversion: 1, consent: "native-default" });
const cohort = Object.freeze({ kind: "sdk-free-synthetic", native_execution_qualified: false });
const plans = new WeakMap(), spentPlans = new WeakSet();
const transportLeases = new WeakMap();
// No additional Google owner decision has been authenticated and pinned.
const nativeOwnerEvidence = Object.freeze([]);
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function additionalGoogleSourcePin() {
  const files = ["inspected-google-additional.mjs", "inspected-google-additional.test.mjs",
    "inspected-google-native-lease.test.mjs", "inspected-google-native-lease-isolated.mjs",
    "native-stock-capture.mjs", "native-stock-policy.mjs", "inspected-meta-record.mjs",
    "private-original-file.mjs", "inspected-google-admission.mjs", "inspected-google-policy.mjs",
    "inspected-http-wire.mjs", "inspected-header-block.mjs", "inspected-google-cohort.mjs",
    "inspected-google-controller.mjs", "inspected-transport.mjs"];
  return digest(Object.fromEntries(files.map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))])));
}
const loadedGoogleSourcePin = additionalGoogleSourcePin();

export function additionalGoogleBindingDigest(value) {
  const { case_permission: _permission, ...rest } = data(value);
  return digest(rest);
}

export function createAdditionalGoogleReader(root) {
  const parent = resolve("rig/out");
  if (typeof root !== "string" || dirname(root) !== parent
    || !/^google-additional-[a-f0-9]{16}$/.test(root.slice(parent.length + 1)))
    fail("google_additional_nonlocal_fixture");
  privateOriginalDirectory(parent, process.getuid());
  privateOriginalDirectory(root, process.getuid());
  const snapshots = [];
  return {
    read(handle, name) {
      try {
        record(handle, ["path", "sha256"]);
        if (handle.path !== join(root, name) || !hex(handle.sha256)) fail("google_additional_handle_invalid");
        const original = readPrivateOriginal(handle.path, { uid: process.getuid(), maximum: 65536 });
        if (original.handle.sha256 !== handle.sha256) fail("google_additional_handle_stale");
        snapshots.push(original.handle);
        return json(original.bytes);
      } catch (error) {
        if (["google_additional_handle_invalid", "google_additional_handle_stale"].includes(error.message)) throw error;
        fail("google_additional_handle_unavailable");
      }
    },
    unchanged() {
      try {
        privateOriginalDirectory(parent, process.getuid());
        privateOriginalDirectory(root, process.getuid());
        for (const before of snapshots) {
          const current = readPrivateOriginal(before.path, { uid: process.getuid(), maximum: 65536 });
          if (!equal(before, current.handle)) fail("google_additional_source_changed");
        }
      } catch { fail("google_additional_source_changed"); }
    },
  };
}

function typed(value, fields, reason) {
  try { return record(value, fields); } catch { fail(reason); }
}

function checkWindow(window) {
  const value = typed(window, ["not_before_ms", "expires_at_ms"], "google_additional_window_inactive");
  const now = Date.now();
  if (!Number.isSafeInteger(value.not_before_ms) || !Number.isSafeInteger(value.expires_at_ms)
    || value.not_before_ms < 0 || value.expires_at_ms <= value.not_before_ms
    || value.expires_at_ms - value.not_before_ms > LIMITS.duration_ms
    || now < value.not_before_ms || now >= value.expires_at_ms) fail("google_additional_window_inactive");
}

export function authenticateAdditionalGoogleOwner(binding, read) {
  if (!binding?.case_permission) fail("google_additional_owner_permission_unavailable");
  if (typeof binding.authority?.path !== "string"
    || resolve(binding.authority.path) !== binding.authority.path
    || binding.authority.path !== join(dirname(binding.authority.path), "google-additional-authority.json")
    || binding.case_permission.path !== join(dirname(binding.authority.path), "google-additional-case-permission.json"))
    fail("google_additional_owner_permission_invalid");
  const readBound = handle => {
    if (!hex(handle?.sha256)) fail("google_additional_owner_permission_invalid");
    const bytes = read(handle);
    if (!Buffer.isBuffer(bytes) || hash(bytes) !== handle.sha256) fail("google_additional_owner_permission_invalid");
    return json(bytes);
  };
  let permission;
  try { permission = readBound(binding.case_permission); }
  catch { fail("google_additional_owner_permission_invalid"); }
  permission = typed(permission, ["schema_version", "kind", "status", "case_name", "transport",
    "native_execution_permitted", "authority_locator", "canonical_slot_path", "permission_source_sha256",
    "valid_until_ms", "owner_decision_sha256", "lineage_baseline_sha256", "attempt"],
  "google_additional_owner_permission_invalid");
  const locator = typed(permission.authority_locator, ["path", "sha256", "dev", "ino"],
    "google_additional_owner_permission_invalid");
  if (permission.schema_version !== 1 || permission.kind !== "inspected-google-additional-case-location"
    || permission.status !== "approved_case_binding" || permission.case_name !== "google-stock"
    || permission.transport !== "inspected-network" || permission.native_execution_permitted !== true
    || !binding.decision || !binding.baseline
    || permission.owner_decision_sha256 !== binding.decision.sha256
    || permission.lineage_baseline_sha256 !== binding.baseline.sha256
    || permission.permission_source_sha256 !== additionalGoogleBindingDigest(binding)
    || permission.valid_until_ms !== binding.window?.expires_at_ms
    || locator.path !== binding.authority?.path || locator.sha256 !== binding.authority?.sha256
    || ![locator.dev, locator.ino].every(value => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value))
    || typeof permission.attempt !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(permission.attempt))
    fail("google_additional_owner_permission_invalid");
  try {
    const stat = lstatSync(locator.path, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(process.getuid())
      || (stat.mode & 0o7777n) !== 0o600n || locator.dev !== String(stat.dev) || locator.ino !== String(stat.ino))
      fail("google_additional_owner_permission_invalid");
  } catch { fail("google_additional_owner_permission_invalid"); }

  let decision, baseline;
  if (binding.decision.path !== join(dirname(locator.path), "google-additional-owner-decision.json")
    || binding.baseline.path !== join(dirname(locator.path), "google-additional-lineage-baseline.json"))
    fail("google_additional_owner_permission_invalid");
  try {
    decision = readBound(binding.decision);
    baseline = readBound(binding.baseline);
  } catch { fail("google_additional_owner_permission_invalid"); }
  decision = typed(decision, ["schema", "status", "case_name", "transport", "attempt",
    "authority_id", "additional_stock_cases", "lineage_baseline_sha256", "limits", "commands"],
  "google_additional_owner_permission_invalid");
  baseline = typed(baseline, ["schema", "original_authority_sha256", "original_stock_sha256",
    "original_chamber_sha256"], "google_additional_owner_permission_invalid");
  if (decision.schema !== "airlock.owner-additional-google-case-decision.v1"
    || decision.status !== "approved_additional_bounded_case_scope" || decision.case_name !== "google-stock"
    || decision.transport !== "inspected-network" || decision.attempt !== permission.attempt
    || typeof decision.authority_id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(decision.authority_id)
    || decision.additional_stock_cases !== 1
    || permission.canonical_slot_path !== join(dirname(locator.path),
      `native-stock-slots-${decision.authority_id}`, "google-stock.reserved")
    || decision.lineage_baseline_sha256 !== binding.baseline.sha256
    || !equal(decision.limits, LIMITS) || !equal(decision.commands, commands)
    || baseline.schema !== "airlock.additional-google-original-lineage-baseline.v1"
    || ![baseline.original_authority_sha256, baseline.original_stock_sha256,
      baseline.original_chamber_sha256].every(hex))
    fail("google_additional_owner_permission_invalid");
  if (!nativeOwnerEvidence.some(entry => entry.decision_sha256 === binding.decision.sha256
    && entry.baseline_sha256 === binding.baseline.sha256))
    fail("google_additional_owner_permission_unavailable");
  return { permission, decision, baseline };
}

export function createNativeAdditionalGoogleReader() {
  const snapshots = [];
  return {
    read(handle, maximum = 65536) {
      try {
        record(handle, ["path", "sha256"]);
        if (typeof handle.path !== "string" || resolve(handle.path) !== handle.path || !hex(handle.sha256))
          fail("google_additional_handle_invalid");
        const original = readPrivateOriginal(handle.path, { uid: process.getuid(), maximum });
        if (original.handle.sha256 !== handle.sha256) fail("google_additional_handle_stale");
        snapshots.push({ handle: original.handle, maximum });
        return original.bytes;
      } catch (error) {
        if (["google_additional_handle_invalid", "google_additional_handle_stale"].includes(error.message)) throw error;
        fail("google_additional_handle_unavailable");
      }
    },
    unchanged() {
      try {
        for (const before of snapshots) {
          const current = readPrivateOriginal(before.handle.path, { uid: process.getuid(), maximum: before.maximum });
          if (!equal(before.handle, current.handle)) fail("google_additional_source_changed");
        }
      } catch { fail("google_additional_source_changed"); }
    },
  };
}

export function validateNativeAdditionalGoogle(binding, reader) {
  const owner = authenticateAdditionalGoogleOwner(binding, reader.read);
  binding = typed(data(binding), ["authority", "baseline", "decision", "inputs", "witness", "review",
    "case_permission", "source_sha256", "source_pins", "cohort", "window", "observation_end_ms", "limits", "commands"],
  "google_additional_binding_invalid");
  if (binding.source_sha256 !== loadedGoogleSourcePin || additionalGoogleSourcePin() !== loadedGoogleSourcePin)
    fail("google_additional_source_stale");
  if (!equal(binding.cohort, currentGoogleCohort())) fail("google_additional_cohort_invalid");
  if (!equal(binding.limits, LIMITS) || !equal(binding.commands, commands))
    fail("google_additional_envelope_invalid");
  checkWindow(binding.window);
  if (!Number.isSafeInteger(binding.observation_end_ms) || Date.now() >= binding.observation_end_ms
    || binding.observation_end_ms > binding.window.expires_at_ms - 6000)
    fail("google_additional_window_inactive");
  const root = dirname(binding.authority.path);
  if (binding.inputs.path !== join(root, "google-additional-inputs.json")
    || binding.witness.path !== join(root, "google-additional-witness.json")
    || binding.review.path !== join(root, "google-additional-review.json"))
    fail("google_additional_binding_invalid");
  const authority = typed(json(reader.read(binding.authority)), ["schema_version", "kind", "status",
    "authority_variant", "authority_id", "attempt", "self_locator", "lineage_baseline", "cases", "limits", "commands"],
  "google_additional_authority_invalid");
  const locator = typed(authority.self_locator, ["path", "dev", "ino"], "google_additional_authority_invalid");
  if (authority.schema_version !== 1 || authority.kind !== "owner_conversation_authority"
    || authority.status !== "approved_conditional" || authority.authority_variant !== "google-additional"
    || authority.authority_id !== owner.decision.authority_id
    || !/^google-stock-additional-[a-z0-9-]+$/.test(authority.authority_id)
    || authority.attempt !== owner.decision.attempt || locator.path !== owner.permission.authority_locator.path
    || locator.dev !== owner.permission.authority_locator.dev || locator.ino !== owner.permission.authority_locator.ino
    || !equal(authority.lineage_baseline, binding.baseline)
    || !equal(authority.cases, { "google-stock": { reserved: false, admitted: false, spent: false } })
    || !equal(authority.limits, LIMITS) || !equal(authority.commands, commands))
    fail("google_additional_authority_invalid");
  const input = typed(json(reader.read(binding.inputs)), ["schema_version", "case_name", "attempt", "profile",
    "retained_source"], "google_additional_inputs_invalid");
  const source = typed(input.retained_source, ["path", "sha256"], "google_additional_inputs_invalid");
  const sourcePin = "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50";
  if (input.schema_version !== 1 || input.case_name !== "google-stock" || input.attempt !== authority.attempt
    || source.path !== join(dirname(binding.authority.path), "google-additional-retained-source.bin")
    || source.sha256 !== sourcePin || input.profile?.profile !== "google-ads-conversion"
    || input.profile?.case_name !== "google-stock"
    || !Array.isArray(input.profile.resources)
    || !input.profile.resources.some(item => item.role === "runtime" && item.sha256 === sourcePin))
    fail("google_additional_inputs_invalid");
  try { createNativeStockPolicy(input.profile); }
  catch { fail("google_additional_inputs_invalid"); }
  const sourceBytes = reader.read(source, LIMITS.response_bytes);
  const witness = typed(json(reader.read(binding.witness)), ["schema", "case_name", "attempt", "authority_sha256",
    "baseline_sha256", "decision_sha256", "inputs_sha256", "source_sha256", "cohort_sha256"],
  "google_additional_witness_invalid");
  if (witness.schema !== "airlock.additional-google-case-witness.v1" || witness.case_name !== "google-stock"
    || witness.attempt !== authority.attempt || witness.authority_sha256 !== binding.authority.sha256
    || witness.baseline_sha256 !== binding.baseline.sha256 || witness.decision_sha256 !== binding.decision.sha256
    || witness.inputs_sha256 !== binding.inputs.sha256 || witness.source_sha256 !== binding.source_sha256
    || witness.cohort_sha256 !== digest(binding.cohort)) fail("google_additional_witness_invalid");
  const review = typed(json(reader.read(binding.review)), ["schema", "case_name", "attempt", "witness_sha256",
    "source_sha256", "verdict"], "google_additional_review_invalid");
  if (review.schema !== "airlock.additional-google-case-review.v1" || review.case_name !== "google-stock"
    || review.attempt !== authority.attempt || review.witness_sha256 !== binding.witness.sha256
    || review.source_sha256 !== binding.source_sha256 || review.verdict !== "reviewed")
    fail("google_additional_review_invalid");
  reader.unchanged();
  checkWindow(binding.window);
  return { authority, canonical: owner.permission.canonical_slot_path, binding, profile: input.profile,
    source: sourceBytes };
}

// These records are deliberately fixture-only: none authenticates an owner.
export function validateSyntheticAdditionalGoogle(binding, reader) {
  binding = typed(data(binding), ["authority", "baseline", "decision", "inputs", "witness", "review",
    "case_permission", "source_sha256", "cohort", "window", "limits", "commands"], "google_additional_binding_invalid");
  if (binding.source_sha256 !== additionalGoogleSourcePin()) fail("google_additional_source_stale");
  if (!equal(binding.cohort, cohort)) fail("google_additional_cohort_invalid");
  if (!equal(binding.limits, LIMITS) || !equal(binding.commands, commands))
    fail("google_additional_envelope_invalid");
  checkWindow(binding.window);
  const authority = typed(reader.read(binding.authority, "authority.json"),
    ["schema", "synthetic_only", "authority_id", "case_name", "lineage", "attempt", "self_locator", "limits", "commands"],
    "google_additional_authority_invalid");
  const root = dirname(binding.authority.path), suffix = root.slice(-16);
  const expectedId = `synthetic-google-additional-${suffix}`;
  const lineage = `synthetic-lineage-${suffix}`, attempt = `synthetic-attempt-${suffix}`;
  const locator = typed(authority.self_locator, ["path", "dev", "ino"], "google_additional_authority_invalid");
  const stat = lstatSync(binding.authority.path, { bigint: true });
  if (authority.schema !== "airlock.synthetic-google-additional-authority.v1" || authority.synthetic_only !== true
    || authority.authority_id !== expectedId || authority.case_name !== "google-stock"
    || authority.lineage !== lineage || authority.attempt !== attempt || !equal(authority.limits, LIMITS)
    || !equal(authority.commands, commands) || locator.path !== binding.authority.path
    || locator.dev !== String(stat.dev) || locator.ino !== String(stat.ino)) fail("google_additional_authority_invalid");
  const baseline = typed(reader.read(binding.baseline, "baseline.json"),
    ["schema", "synthetic_only", "lineage", "original_authority_sha256", "original_stock_sha256", "original_chamber_sha256"],
    "google_additional_lineage_invalid");
  if (baseline.schema !== "airlock.synthetic-google-original-baseline.v1" || baseline.synthetic_only !== true
    || baseline.lineage !== lineage
    || baseline.original_authority_sha256 !== hash(`synthetic-original-authority:${lineage}`)
    || baseline.original_stock_sha256 !== hash(`synthetic-original-stock:${lineage}`)
    || baseline.original_chamber_sha256 !== hash(`synthetic-original-chamber:${lineage}`))
    fail("google_additional_lineage_invalid");
  const decision = typed(reader.read(binding.decision, "decision.json"),
    ["schema", "synthetic_only", "lineage", "attempt", "case_name", "limits", "commands"],
    "google_additional_decision_invalid");
  if (decision.schema !== "airlock.synthetic-google-additional-decision.v1" || decision.synthetic_only !== true
    || decision.lineage !== lineage || decision.attempt !== attempt || decision.case_name !== "google-stock"
    || !equal(decision.limits, LIMITS) || !equal(decision.commands, commands)) fail("google_additional_decision_invalid");
  const inputs = typed(reader.read(binding.inputs, "inputs.json"),
    ["schema", "synthetic_only", "lineage", "attempt", "case_name", "transaction_id", "profile"],
    "google_additional_inputs_invalid");
  if (inputs.schema !== "airlock.synthetic-google-additional-inputs.v1" || inputs.synthetic_only !== true
    || inputs.lineage !== lineage || inputs.attempt !== attempt || inputs.case_name !== "google-stock"
    || inputs.transaction_id !== `synthetic-${suffix}`) fail("google_additional_inputs_invalid");
  const expectedProfile = { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
    document_url: "https://owned.example/inspection",
    owned: { conversion_id: "AW-000000000", conversion_label: "synthetic", value: 1, currency: "USD",
      transaction_id: inputs.transaction_id },
    resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
      sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
    companion_authorized: true };
  if (!equal(inputs.profile, expectedProfile)) fail("google_additional_inputs_invalid");
  try { createNativeStockPolicy(inputs.profile); }
  catch { fail("google_additional_inputs_invalid"); }
  const witness = typed(reader.read(binding.witness, "witness.json"),
    ["schema", "synthetic_only", "lineage", "attempt", "baseline_sha256", "decision_sha256", "inputs_sha256"],
    "google_additional_witness_invalid");
  if (witness.schema !== "airlock.synthetic-google-additional-witness.v1" || witness.synthetic_only !== true
    || witness.lineage !== lineage || witness.attempt !== attempt || witness.baseline_sha256 !== binding.baseline.sha256
    || witness.decision_sha256 !== binding.decision.sha256 || witness.inputs_sha256 !== binding.inputs.sha256)
    fail("google_additional_witness_invalid");
  const review = typed(reader.read(binding.review, "review.json"),
    ["schema", "synthetic_only", "lineage", "attempt", "witness_sha256", "source_sha256", "verdict"],
    "google_additional_review_invalid");
  if (review.schema !== "airlock.synthetic-google-additional-review.v1" || review.synthetic_only !== true
    || review.lineage !== lineage || review.attempt !== attempt || review.witness_sha256 !== binding.witness.sha256
    || review.source_sha256 !== binding.source_sha256 || review.verdict !== "fixture-only")
    fail("google_additional_review_invalid");
  const permission = typed(reader.read(binding.case_permission, "case.json"),
    ["schema", "synthetic_only", "lineage", "attempt", "authority_sha256", "canonical_slot_path", "binding_sha256", "valid_until_ms"],
    "google_additional_case_invalid");
  const canonical = join(root, `native-stock-slots-${expectedId}`, "google-stock.reserved");
  if (permission.schema !== "airlock.synthetic-google-additional-case.v1" || permission.synthetic_only !== true
    || permission.lineage !== lineage || permission.attempt !== attempt || permission.authority_sha256 !== binding.authority.sha256
    || permission.canonical_slot_path !== canonical || permission.binding_sha256 !== additionalGoogleBindingDigest(binding)
    || permission.valid_until_ms !== binding.window.expires_at_ms) fail("google_additional_case_invalid");
  reader.unchanged();
  checkWindow(binding.window);
  return { authority, canonical, binding, profile: inputs.profile };
}

export function inspectSyntheticAdditionalGoogle(binding) {
  const copied = data(binding);
  const reader = createAdditionalGoogleReader(dirname(copied.authority.path));
  const state = validateSyntheticAdditionalGoogle(copied, reader);
  try { lstatSync(join(dirname(state.canonical), "google-stock.consumed")); }
  catch (error) {
    if (error.code !== "ENOENT") fail("google_additional_reservation_invalid");
    const plan = Object.freeze({ execution_authority: false, native_execution_qualified: false });
    plans.set(plan, { ...state, reader, kind: "synthetic" });
    return plan;
  }
  fail("google_additional_attempt_spent");
}

export function prepareNativeAdditionalGoogle(binding) {
  const copied = data(binding), reader = createNativeAdditionalGoogleReader();
  const state = validateNativeAdditionalGoogle(copied, reader);
  for (const [path, reason] of [[state.canonical, "google_stock_slot_spent"],
    [join(dirname(state.canonical), "google-stock.consumed"), "google_additional_attempt_spent"]]) {
    try { lstatSync(path); fail(reason); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const plan = Object.freeze({ execution_authority: false, native_execution_qualified: false });
  plans.set(plan, { ...state, reader, kind: "native" });
  return plan;
}

function consumeAttempt(state) {
  const directory = dirname(state.canonical), marker = join(directory, "google-stock.consumed");
  let directoryFd, fd;
  try {
    const before = privateOriginalDirectory(directory, process.getuid());
    directoryFd = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    const held = fstatSync(directoryFd);
    if (held.dev !== before.dev || held.ino !== before.ino) fail("google_additional_reservation_invalid");
    fd = openSync(marker, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o600)
      fail("google_additional_reservation_invalid");
    writeFileSync(fd, JSON.stringify({ schema: state.kind === "native"
      ? "airlock.google-additional-consumption.v1" : "airlock.synthetic-google-additional-consumption.v1",
      binding_sha256: digest(state.binding), state: "consumed" }) + "\n");
    fsyncSync(fd);
    fsyncSync(directoryFd);
  } catch (error) {
    if (error.code === "EEXIST") fail("google_additional_attempt_spent");
    fail("google_additional_reservation_invalid");
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (directoryFd !== undefined) closeSync(directoryFd);
  }
  try { return readPrivateOriginal(marker, { uid: process.getuid(), maximum: 65536 }).handle; }
  catch { fail("google_additional_reservation_invalid"); }
}

function takeAdditionalPlan(plan, kind) {
  if (!plan || isProxy(plan) || !plans.has(plan))
    fail(spentPlans.has(plan) ? "google_additional_plan_spent" : "google_additional_plan_invalid");
  const state = plans.get(plan);
  if (state.kind !== kind) fail("google_additional_plan_invalid");
  plans.delete(plan);
  spentPlans.add(plan);
  return state;
}

function verifyAdditionalReservation(state, reservation) {
  const entry = typed(reservation, ["case_name", "reserved", "network_authorized", "owner_identity_authenticated",
    "execution_prerequisites_proved", "canonical_record_path", "canonical_record_identity"], "google_additional_reservation_invalid");
  if (entry.case_name !== "google-stock" || entry.reserved !== true || entry.network_authorized !== false
    || entry.owner_identity_authenticated !== false || entry.execution_prerequisites_proved !== false
    || entry.canonical_record_path !== state.canonical) fail("google_additional_reservation_invalid");
  let original;
  try { original = readPrivateOriginal(state.canonical, { uid: process.getuid(), maximum: 65536 }); }
  catch { fail("google_additional_reservation_invalid"); }
  let stat;
  try { stat = lstatSync(state.canonical, { bigint: true }); }
  catch { fail("google_additional_reservation_invalid"); }
  const identity = [stat.dev, stat.ino, stat.nlink, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(":");
  const item = json(original.bytes);
  if (identity !== entry.canonical_record_identity || item.state !== "spent" || item.case_name !== "google-stock"
    || item.authority_id !== state.authority.authority_id || item.authority_sha256 !== state.binding.authority.sha256
    || item.source_sha256 !== state.binding.source_sha256 || item.input_sha256 !== state.binding.inputs.sha256
    || item.authority_variant !== (state.kind === "native" ? "google-additional" : "synthetic-google-additional")
    || item.lineage_baseline_sha256 !== state.binding.baseline.sha256
    || item.binding_sha256 !== digest(state.binding) || !equal(item.window, state.binding.window))
    fail("google_additional_reservation_invalid");
}

function additionalLeaseLifetime(state, reservation, assertOwner) {
  const deadline = state.binding.observation_end_ms ?? state.binding.window.expires_at_ms - 6000;
  const started = performance.now();
  let stopped = false, lastWall = Date.now();
  const monotonicBudget = deadline - lastWall;
  const checkClock = () => {
    const now = Date.now();
    if (now < lastWall || now >= deadline || performance.now() - started >= monotonicBudget)
      fail("case_window_inactive");
    lastWall = now;
  };
  return Object.freeze({
    check() {
      if (stopped) fail("google_additional_case_stopped");
      checkClock();
      assertOwner();
      checkWindow(state.binding.window);
      checkClock();
      state.reader.unchanged();
      if (additionalGoogleSourcePin() !== state.binding.source_sha256) fail("google_additional_source_stale");
      verifyAdditionalReservation(state, reservation);
      try {
        const marker = readPrivateOriginal(state.consumption.path, { uid: process.getuid(), maximum: 65536 });
        if (!equal(marker.handle, state.consumption)) fail("google_additional_reservation_invalid");
      } catch { fail("google_additional_reservation_invalid"); }
      checkClock();
    },
    stop() { stopped = true; },
  });
}

export async function consumeSyntheticAdditionalGoogle(plan, reservation) {
  const state = takeAdditionalPlan(plan, "synthetic");
  state.consumption = consumeAttempt(state);
  const { claimSyntheticGoogleReservation } = await import("./native-stock-capture.mjs");
  claimSyntheticGoogleReservation(reservation, digest(state.binding));
  checkWindow(state.binding.window);
  state.reader.unchanged();
  if (additionalGoogleSourcePin() !== state.binding.source_sha256) fail("google_additional_source_stale");
  verifyAdditionalReservation(state, reservation);
  state.reader.unchanged();
  checkWindow(state.binding.window);
  const { createInspectedHttpWire } = await import("./inspected-http-wire.mjs");
  state.reader.unchanged();
  checkWindow(state.binding.window);
  if (additionalGoogleSourcePin() !== state.binding.source_sha256) fail("google_additional_source_stale");
  const logical = [];
  const observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile: state.profile,
    resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
  const lifetime = additionalLeaseLifetime(state, reservation, () => {});
  lifetime.check();
  const lease = issueGoogleTransportLease({ kind: "synthetic", observer, logical, lifetime });
  return Object.freeze({ execution_authority: false, native_execution_qualified: false, lease });
}

export async function consumeNativeAdditionalGoogle(plan, reservation, engineToken) {
  const { claimNativeGoogleEngine } = await import("./inspected-google-admission.mjs");
  const engine = claimNativeGoogleEngine(engineToken, plan);
  const state = takeAdditionalPlan(plan, "native");
  state.consumption = consumeAttempt(state);
  const { claimNativeGoogleReservation } = await import("./native-stock-capture.mjs");
  claimNativeGoogleReservation(reservation, digest(state.binding));
  const lifetime = additionalLeaseLifetime(state, reservation, engine.assertAdmission);
  const assertAdmission = () => lifetime.check();
  assertAdmission();
  return issueGoogleTransportLease({ kind: "native", config: engine.config, assertAdmission });
}

function issueGoogleTransportLease(state) {
  const lease = Object.freeze({});
  transportLeases.set(lease, state);
  return lease;
}

function claimGoogleTransportLease(lease, kind) {
  if (!lease || isProxy(lease) || !transportLeases.has(lease))
    fail(kind === "native" ? "invalid_native_google_transport_lease" : "google_additional_lease_invalid");
  const state = transportLeases.get(lease);
  transportLeases.delete(lease);
  if (state.kind !== kind)
    fail(kind === "native" ? "invalid_native_google_transport_lease" : "google_additional_lease_invalid");
  return state;
}

export function claimNativeGoogleTransportLease(lease) {
  return claimGoogleTransportLease(lease, "native");
}

export function claimSyntheticGoogleLease(lease) {
  const state = claimGoogleTransportLease(lease, "synthetic");
  let stopped = false;
  const connection = state.observer.connection("h1");
  const stop = reason => {
    stopped = true;
    state.lifetime.stop();
    state.observer.stop(reason);
  };
  const active = () => {
    try { state.lifetime.check(); return true; }
    catch (error) { stop(error.message); return false; }
  };
  return Object.freeze({
    observe(value) {
      if (stopped || !active()) fail("google_synthetic_case_stopped");
      let row;
      try {
        row = data(value);
        record(row, ["network_id", "url", "method", "resource_type"], ["fetch_id", "redirect_from", "response_parent"]);
        if (typeof row.network_id !== "string" || typeof row.method !== "string"
          || typeof row.resource_type !== "string" || typeof row.url !== "string"
          || Buffer.byteLength(row.url) > LIMITS.url_bytes) throw Error("invalid");
      } catch {
        stop("invalid_google_observation");
        fail("invalid_google_observation");
      }
      if (state.logical.length >= LIMITS.observations
        || !state.observer.reserveObservation(Buffer.byteLength(JSON.stringify(row)))) {
        stop("google_observation_limit");
        fail("google_observation_limit");
      }
      state.logical.push(row);
    },
    request(bytes) {
      if (stopped || !active()) return Buffer.alloc(0);
      return connection.request(bytes);
    },
    stop() { stop("google_synthetic_case_stopped"); },
  });
}
