import process from "node:process";
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail, freeze, hash, observationDirectory, observationRead } from "./sdk-absent-clock-observation-io.mjs";
import { requireClockObservationRuntime } from "./sdk-absent-clock-observation-admission.mjs";
import { CLOCK_OBSERVATION_COMMAND, CLOCK_OBSERVATION_PROGRAM } from "./sdk-absent-clock-observation-program.mjs";

export const CLOCK_OBSERVATION_SOURCES = Object.freeze([
  "admission.mjs", "io.mjs", "plan.mjs", "protocol.mjs", "streams.mjs", "entry.mjs", "observer.mjs",
  "outer.mjs", "producer.mjs", "supervisor.mjs", "wire.mjs", "init.mjs", "reader.mjs", "cohort.json",
  "program.mjs", "program.test.mjs",
].map(name => fileURLToPath(new URL("sdk-absent-clock-observation-" + name, import.meta.url)))
  .concat(fileURLToPath(new URL("sdk-absent-clock-observation.Dockerfile", import.meta.url)),
    fileURLToPath(new URL("private-original-file.mjs", import.meta.url)),
    fileURLToPath(new URL("private-original-file.test.mjs", import.meta.url)),
    fileURLToPath(new URL("inspected-meta-record.mjs", import.meta.url))));
const plans = new WeakMap();
function endpointOriginal(endpoint, uid) {
  if (typeof endpoint !== "string" || endpoint.length > 110
    || !/^unix:\/\/(?:\/[A-Za-z0-9._-]+)+$/.test(endpoint) || /[\r\n]/.test(endpoint))
    fail("observation_canonical_owned_endpoint");
  const path = endpoint.slice(7);
  if (resolve(path) !== path) fail("observation_canonical_owned_endpoint");
  const s = lstatSync(path);
  if (realpathSync(path) !== path || s.isSymbolicLink()
    || !s.isSocket() || s.uid !== uid || (s.mode & 0o022)) fail("observation_canonical_owned_endpoint");
  return { path, dev: s.dev, ino: s.ino, uid: s.uid, mode: s.mode, mtime_ms: s.mtimeMs, ctime_ms: s.ctimeMs };
}
export function observationArguments(value) {
  const v = record(data(value), ["case_id", "root"]);
  if (typeof v.case_id !== "string" || !/^[a-z0-9-]{1,48}$/.test(v.case_id)
    || typeof v.root !== "string" || !isAbsolute(v.root) || resolve(v.root) !== v.root) fail("observation_fixed_arguments");
  return v;
}
export function prepareClockObservationPlan(value) {
  const v = observationArguments(value);
  // No positive implementation exists for this gate. Source tests mock ONLY
  // the unavailable preparation boundary, never a ready file or environment.
  requireClockObservationRuntime();
  const facts = observationRead(v.root + "/source-facts.json");
  const f = record(json(facts.bytes), ["schema", "scope", "case_id", "root", "uid", "node_realpath", "node_sha256",
    "node_version", "client_realpath", "client_sha256", "endpoint", "endpoint_original",
    "engine", "target", "image_id", "image_manifest_sha256", "image_config_sha256", "image_env",
    "program_source_sha256", "program_sha256", "command_sha256", "sources"]);
  const engine = record(f.engine, ["ID", "OSType", "Architecture", "ServerVersion"]);
  if (f.schema !== "airlock.clock-observation-source-facts.v2" || f.scope !== "SOURCE_INPUTS_NOT_RUNTIME_PROOF"
    || f.case_id !== v.case_id || f.root !== v.root || !Number.isSafeInteger(f.uid) || f.uid < 1 || f.uid !== process.getuid()
    || !digest(f.node_sha256) || !digest(f.client_sha256) || !digest(f.program_source_sha256)
    || f.target !== "PINNED_BARE_NODE_NO_WORK_SOURCE"
    || f.image_manifest_sha256 !== "5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb"
    || f.image_config_sha256 !== "d4c19a76851d19b6473bcba5ec21630000c6469fcea58623ec166d19402f207f"
    || f.image_id !== "sha256:" + f.image_manifest_sha256
    || f.program_sha256 !== hash(CLOCK_OBSERVATION_PROGRAM)
    || f.command_sha256 !== hash(JSON.stringify(CLOCK_OBSERVATION_COMMAND)) || f.node_version !== process.version
    || realpathSync(process.execPath) !== f.node_realpath
    || realpathSync("/usr/local/bin/docker") !== f.client_realpath
    || typeof engine.ID !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(engine.ID)
    || engine.OSType !== "linux" || !["aarch64", "arm64"].includes(engine.Architecture)
    || typeof engine.ServerVersion !== "string" || !/^[A-Za-z0-9.+-]{1,64}$/.test(engine.ServerVersion)
    || !equal(f.image_env, ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"])
    || !Array.isArray(f.sources) || f.sources.length !== CLOCK_OBSERVATION_SOURCES.length)
    fail("observation_fixed_source_facts");
  const socket = record(f.endpoint_original, ["path", "dev", "ino", "uid", "mode", "mtime_ms", "ctime_ms"]);
  if (!equal(socket, endpointOriginal(f.endpoint, f.uid))) fail("observation_endpoint_lease_changed");
  const directories = [v.root, v.root + "/empty-home", v.root + "/docker-config"].map(path => observationDirectory(path, f.uid));
  if (!equal(observationRead(facts.handle.path, { uid: f.uid }).handle, facts.handle)) fail("observation_private_facts");
  const config = observationRead(v.root + "/docker-config/config.json", { uid: f.uid, maximum: 64 });
  if (!config.bytes.equals(Buffer.from("{}\n"))) fail("observation_empty_client_config");
  const node = observationRead(f.node_realpath, { executable: true, maximum: 134217728 });
  const client = observationRead(f.client_realpath, { executable: true, maximum: 134217728 });
  if (node.handle.sha256 !== f.node_sha256 || client.handle.sha256 !== f.client_sha256) fail("observation_executable_changed");
  const sources = CLOCK_OBSERVATION_SOURCES.map((path, i) => {
    const pin = record(f.sources[i], ["path", "sha256"]), r = observationRead(path);
    if (pin.path !== path || pin.sha256 !== r.handle.sha256) fail("observation_source_changed");
    return r.handle;
  });
  const source = hash(JSON.stringify(data(f.sources)));
  // Controller/program dependency lease, NOT provenance of a derived image.
  if (source !== f.program_source_sha256) fail("observation_program_source_substitution");
  const cohort = sources.find(h => h.path.endsWith("-cohort.json"));
  const p = Object.freeze(Object.create(null));
  plans.set(p, freeze({ ...v, uid: f.uid, facts: facts.handle, directories, config: config.handle,
    node: node.handle, client: client.handle, sources, source_sha256: source, cohort_sha256: cohort.sha256,
    target: f.target, image_id: f.image_id, image_manifest_sha256: f.image_manifest_sha256,
    image_config_sha256: f.image_config_sha256, image_env: f.image_env,
    program_source_sha256: source, program_sha256: f.program_sha256, command_sha256: f.command_sha256,
    engine: f.engine, endpoint: f.endpoint, socket }));
  return p;
}
export function clockObservationPlanEvidence(plan) {
  const p = plans.get(plan);
  if (!p) fail("private_clock_observation_plan_required");
  for (const h of [p.facts, p.config, p.node, p.client, ...p.sources]) {
    if (!equal(observationRead(h.path, { maximum: h === p.node || h === p.client ? 134217728 : 1048576 }).handle, h))
      fail("observation_source_or_preparation_lease_changed");
  }
  for (const d of p.directories) {
    const fresh = observationDirectory(d.path, p.uid);
    if (d.dev !== fresh.dev || d.ino !== fresh.ino) fail("observation_directory_lease_changed");
  }
  if (realpathSync(process.execPath) !== p.node.path || realpathSync("/usr/local/bin/docker") !== p.client.path)
    fail("observation_executable_lease_changed");
  if (!equal(endpointOriginal(p.endpoint, p.uid), p.socket)) fail("observation_endpoint_lease_changed");
  return p;
}
