import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { data } from "./inspected-meta-record.mjs";

// The injected hooks exist only in this process's isolated module graph.
// They do not authenticate an owner or modify the production pin set.
const files = {
  additional: resolve("rig/inspected-google-additional.mjs"),
  admission: resolve("rig/inspected-google-admission.mjs"),
  capture: resolve("rig/native-stock-capture.mjs"),
  transport: resolve("rig/inspected-transport.mjs"),
};
const tails = {
  additional: "\nexport function isolatedSeedPlan(plan, state) { plans.set(plan, state); }\n",
  admission: "\nexport function isolatedSeedEngine(token, engine) { nativeEngines.set(token, engine); }\n"
    + "export function isolatedAssertAdmission(state) { return assertNativeGoogleAdmission(state); }\n",
  capture: "\nexport function isolatedSeedReservation(reservation, binding) {"
    + " googleAdditionalReservations.set(reservation, { kind: 'native', binding }); }\n",
  transport: "",
};
const modules = {};
async function wrapped(namespace) {
  const keys = Object.keys(namespace);
  return new SyntheticModule(keys, function () {
    for (const key of keys) this.setExport(key, namespace[key]);
  });
}
async function load(name, replacements = {}) {
  const url = pathToFileURL(files[name]).href;
  let source = readFileSync(files[name], "utf8");
  if (name === "additional" && process.argv[2] === "--without-native-issuer") {
    const issuance = 'return issueGoogleTransportLease({ kind: "native", config: engine.config, assertAdmission });';
    assert.ok(source.includes(issuance));
    source = source.replace(issuance, "return Object.freeze({});");
  }
  const module = new SourceTextModule(source + tails[name], {
    identifier: url,
    initializeImportMeta(meta) { meta.url = url; },
    async importModuleDynamically(specifier) {
      if (specifier === "./inspected-google-admission.mjs") return modules.admission;
      if (specifier === "./native-stock-capture.mjs") return modules.capture;
      if (specifier === "./inspected-google-additional.mjs") return modules.additional;
      return import(specifier.startsWith(".") ? new URL(specifier, url).href : specifier);
    },
  });
  await module.link(async specifier => {
    if (replacements[specifier]) return wrapped(replacements[specifier].namespace ?? replacements[specifier]);
    return wrapped(await import(specifier.startsWith(".") ? new URL(specifier, url).href : specifier));
  });
  await module.evaluate();
  modules[name] = module;
  return module.namespace;
}

const additional = await load("additional");
const sourcePins = Object.freeze({ fixture: "isolated-source-pins" });
const cohort = Object.freeze({ fixture: "isolated-cohort" });
const admission = await load("admission", { "./inspected-google-additional.mjs": modules.additional,
  "./inspected-meta-stock.mjs": { inspectedMetaSourcePins: () => sourcePins },
  "./inspected-google-cohort.mjs": { currentGoogleCohort: () => cohort } });
const capture = await load("capture");
const transport = await load("transport");
const actualTransport = await import("./inspected-transport.mjs");
const { createInspectedHttpWire } = await import("./inspected-http-wire.mjs");
const hash = value => createHash("sha256").update(value).digest("hex");
const root = resolve("rig/out", `google-native-lease-fixture-${randomBytes(8).toString("hex")}`);
mkdirSync(root, { mode: 0o700 });
const profile = { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
  document_url: "https://owned.example/inspection",
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
    value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true };

function fixture(name) {
  const directory = join(root, name);
  mkdirSync(directory, { mode: 0o700 });
  const canonical = join(directory, "google-stock.reserved");
  const reader = additional.createNativeAdditionalGoogleReader();
  const original = name => {
    const path = join(directory, `${name}.json`), bytes = Buffer.from(`{"fixture":"${name}"}`);
    writeFileSync(path, bytes, { mode: 0o600 });
    const handle = { path, sha256: hash(bytes) };
    reader.read(handle);
    return handle;
  };
  const now = Date.now();
  const binding = { authority: original("authority"), inputs: original("input"), baseline: original("baseline"),
    review: original("review"), case_permission: original("case"),
    source_sha256: additional.additionalGoogleSourcePin(),
    source_pins: sourcePins, cohort: { ...cohort },
    window: { not_before_ms: now - 1000, expires_at_ms: now + 50000 }, observation_end_ms: now + 40000 };
  const authority = { authority_id: "local-only-fixture" };
  const digest = hash(JSON.stringify(data(binding)));
  writeFileSync(canonical, JSON.stringify({ state: "spent", case_name: "google-stock",
    authority_id: authority.authority_id, authority_sha256: binding.authority.sha256,
    source_sha256: binding.source_sha256, input_sha256: binding.inputs.sha256,
    authority_variant: "google-additional", lineage_baseline_sha256: binding.baseline.sha256,
    binding_sha256: digest, window: binding.window }), { mode: 0o600 });
  const stat = lstatSync(canonical, { bigint: true });
  const identity = [stat.dev, stat.ino, stat.nlink, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(":");
  const reservation = Object.freeze({ case_name: "google-stock", reserved: true, network_authorized: false,
    owner_identity_authenticated: false, execution_prerequisites_proved: false,
    canonical_record_path: canonical, canonical_record_identity: identity });
  const plan = Object.freeze({}), token = Object.freeze({});
  let stopped = false;
  const admissionState = { kind: "additional", nativeReady: true, blockers: [], reader, binding };
  const check = () => {
    if (stopped) throw Error("case_window_inactive");
    admission.isolatedAssertAdmission(admissionState);
  };
  const observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile,
    resolveObservation: () => [] });
  const wait = promise => promise;
  additional.isolatedSeedPlan(plan, { kind: "native", binding, authority, canonical, reader });
  admission.isolatedSeedEngine(token, { additionalPlan: plan, assertAdmission: check,
    config: { inspector: {}, observer, check, wait, beforeConnect: check, logicalAuthority: () => false } });
  capture.isolatedSeedReservation(reservation, digest);
  return { plan, token, reservation, binding, stop() { stopped = true; }, directory };
}

try {
  const valid = fixture("valid");
  await assert.rejects(additional.consumeNativeAdditionalGoogle(valid.plan, valid.reservation, {}),
    /invalid_google_native_engine/);
  const lease = await additional.consumeNativeAdditionalGoogle(valid.plan, valid.reservation, valid.token);
  assert.ok(lstatSync(join(valid.directory, "google-stock.consumed")).isFile());
  await assert.rejects(additional.consumeNativeAdditionalGoogle(valid.plan, valid.reservation, valid.token),
    /invalid_google_native_engine/);
  await assert.rejects(actualTransport.startNativeGoogleInspectedTransport(lease),
    /invalid_native_google_transport_lease/);
  await assert.rejects(transport.startNativeGoogleInspectedTransport(structuredClone(lease)),
    /invalid_native_google_transport_lease/);
  const broker = await transport.startNativeGoogleInspectedTransport(lease);
  assert.ok(Number.isInteger(broker.port) && broker.port > 0);
  await assert.rejects(transport.startNativeGoogleInspectedTransport(lease),
    /invalid_native_google_transport_lease/);
  broker.closeAdmission();
  await broker.close();
  assert.equal(broker.snapshot().sockets_closed, true);

  const revoked = fixture("revoked");
  const revokedLease = await additional.consumeNativeAdditionalGoogle(revoked.plan, revoked.reservation, revoked.token);
  revoked.stop();
  await assert.rejects(transport.startNativeGoogleInspectedTransport(revokedLease), /case_window_inactive/);
  await assert.rejects(transport.startNativeGoogleInspectedTransport(revokedLease),
    /invalid_native_google_transport_lease/);

  const foreign = fixture("foreign");
  await assert.rejects(additional.consumeNativeAdditionalGoogle(foreign.plan, structuredClone(foreign.reservation),
    foreign.token), /google_additional_reservation_invalid/);
  assert.ok(lstatSync(join(foreign.directory, "google-stock.consumed")).isFile());

  for (const original of ["input", "review", "case"]) {
    const changed = fixture(`changed-${original}`);
    const changedLease = await additional.consumeNativeAdditionalGoogle(changed.plan, changed.reservation, changed.token);
    writeFileSync(join(changed.directory, `${original}.json`), '{"fixture":"changed"}', { mode: 0o600 });
    await assert.rejects(transport.startNativeGoogleInspectedTransport(changedLease), /google_additional_source_changed/);
  }
  for (const field of ["source_sha256", "cohort"]) {
    const changed = fixture(`changed-${field}`);
    const changedLease = await additional.consumeNativeAdditionalGoogle(changed.plan, changed.reservation, changed.token);
    changed.binding[field] = field === "cohort" ? { fixture: "different" } : hash("different-source");
    await assert.rejects(transport.startNativeGoogleInspectedTransport(changedLease), /google_source_or_cohort_changed/);
  }
  const expired = fixture("expired");
  const expiredLease = await additional.consumeNativeAdditionalGoogle(expired.plan, expired.reservation, expired.token);
  expired.binding.observation_end_ms = Date.now() - 1;
  await assert.rejects(transport.startNativeGoogleInspectedTransport(expiredLease), /case_window_inactive/);
  process.stdout.write("isolated native issuer, ownership, single-use and revocation passed; no owner permission\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}
