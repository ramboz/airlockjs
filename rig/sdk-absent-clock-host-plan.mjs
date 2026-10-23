import process from "node:process";
import { readdirSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, equal, record } from "./inspected-meta-record.mjs";
import { fail, freeze, hash, observationDirectory, observationRead } from "./sdk-absent-clock-observation-io.mjs";
import { CLOCK_OBSERVATION_SOURCES } from "./sdk-absent-clock-observation-plan.mjs";

export const CLOCK_HOST_SOURCES = Object.freeze([...new Set([
  ...CLOCK_OBSERVATION_SOURCES,
  ...["plan.mjs", "protocol.mjs", "io.mjs", "observer.mjs", "fixture.mjs", "reader.mjs", "source.test.mjs",
    "actual.mjs", "actual.config.mjs", "source.config.mjs", "source.setup.mjs",
  ].map(name => fileURLToPath(new URL("sdk-absent-clock-host-" + name, import.meta.url))),
  fileURLToPath(new URL("sdk-absent-clock-observation-integration.setup.mjs", import.meta.url)),
])]);
const plans = new WeakMap(), nonces = new Set(), roots = new Set();
export const HOST_TARGET = "FIXED_NODE_HOST_FIXTURE_ONLY";
export function hostRequest(value) {
  const v = record(data(value), ["root", "case_id", "nonce", "control"]);
  if (typeof v.root !== "string" || !isAbsolute(v.root) || resolve(v.root) !== v.root
    || typeof v.case_id !== "string" || !/^[a-z0-9-]{1,48}$/.test(v.case_id)
    || typeof v.nonce !== "string" || !/^[a-f0-9]{64}$/.test(v.nonce)
    || !["normal", "failed-child"].includes(v.control)) fail("host_fixed_request_required");
  return v;
}
export function prepareClockHostPlan(value) {
  const v = freeze(hostRequest(value));
  if (nonces.has(v.nonce) || roots.has(v.root)) fail("host_nonce_or_root_already_issued");
  nonces.add(v.nonce); roots.add(v.root);
  const uid = process.getuid();
  if (!Number.isSafeInteger(uid) || uid < 1) fail("host_nonroot_owner_required");
  const directory = observationDirectory(v.root, uid);
  if (readdirSync(v.root).length) fail("host_exclusive_empty_root_required");
  const node = observationRead(realpathSync(process.execPath), { executable: true, maximum: 134217728 }).handle;
  const sources = CLOCK_HOST_SOURCES.map(path => observationRead(path).handle);
  const plan = Object.freeze(Object.create(null));
  const source_sha256 = hash(JSON.stringify(data(sources)));
  plans.set(plan, { input: value, value: v, evidence: freeze({
    ...v, uid, target: HOST_TARGET, directory, node, node_version: process.version, sources, source_sha256,
  }), used: false });
  return plan;
}
export function clockHostPlanEvidence(plan) {
  const state = plans.get(plan);
  if (!state) fail("host_private_plan_required");
  const p = state.evidence;
  if (!equal(hostRequest(state.input), state.value)) fail("host_parent_request_changed");
  const fresh = observationDirectory(p.root, p.uid);
  if (fresh.dev !== p.directory.dev || fresh.ino !== p.directory.ino) fail("host_root_custody_changed");
  if (process.getuid() !== p.uid || process.version !== p.node_version
    || realpathSync(process.execPath) !== p.node.path) fail("host_executable_custody_changed");
  for (const h of [p.node, ...p.sources]) {
    const now = observationRead(h.path, { executable: h === p.node,
      maximum: h === p.node ? 134217728 : 1048576 }).handle;
    // Exact ctime is load-bearing. Same bytes and restored mtime are not renewal.
    if (!equal(now, h)) fail("host_source_or_executable_original_changed");
  }
  return p;
}
export function consumeClockHostPlan(plan) {
  const state = plans.get(plan);
  if (!state) fail("host_private_plan_required");
  if (state.used) fail("host_private_plan_already_used");
  state.used = true;
  return clockHostPlanEvidence(plan);
}
