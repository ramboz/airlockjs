// Private preparation and pure state model. Fixed actor/CLI execution lives in
// sdk-absent-owned-namespace-actors.mjs behind disarmed runtime admission.
import { realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { atomicPrivateWrite, digest, fail, fixedRead, freeze, hash, privateDirectory } from "./sdk-absent-owned-namespace-io.mjs";
import { clockBounds, conservativeArm, tick, TOTAL_MS, WORK_MS } from "./sdk-absent-owned-namespace-time.mjs";

const ENDPOINT = "unix:///var/run/docker.sock", CLIENT = "/usr/local/bin/docker";
const BASE = "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb";
const COHORT = fileURLToPath(new URL("sdk-absent-owned-namespace-cohort.json", import.meta.url));
export const OWNED_NAMESPACE_SOURCES = Object.freeze([
  "sdk-absent-owned-namespace.mjs", "sdk-absent-owned-namespace-io.mjs",
  "sdk-absent-owned-namespace-time.mjs", "sdk-absent-owned-namespace-init.mjs",
  "sdk-absent-owned-namespace-payload.mjs", "sdk-absent-owned-namespace-consumer.mjs",
  "sdk-absent-owned-namespace-clock.json", "sdk-absent-owned-namespace.Dockerfile", "inspected-meta-record.mjs",
  "sdk-absent-owned-namespace-admission.mjs", "sdk-absent-owned-namespace-actors.mjs",
  "sdk-absent-owned-namespace-image-admission.mjs",
  "sdk-absent-owned-namespace-wire.mjs", "sdk-absent-owned-namespace-entry.mjs", "sdk-absent-owned-namespace-worker.mjs",
  "sdk-absent-owned-namespace.test.mjs", "sdk-absent-owned-namespace-actors.test.mjs",
  "sdk-absent-owned-namespace-actors.fixture.mjs", "sdk-absent-owned-namespace-admission.test.mjs",
  "sdk-absent-owned-namespace-closures.config.mjs", "sdk-absent-owned-namespace-closures.setup.mjs",
  "sdk-absent-owned-namespace-pipeline.test.mjs",
].map(name => fileURLToPath(new URL(name, import.meta.url))));
const plans = new WeakMap(), usedPlans = new WeakSet(), supervisors = new WeakMap(), journals = new WeakMap();
const handle = () => Object.freeze(Object.create(null));
const cloned = value => JSON.parse(JSON.stringify(data(value)));
const CONFIG = freeze({
  pid_namespace: "private", ipc_namespace: "private", network: "none", readonly_rootfs: true,
  user: "65532:65532", cap_drop: ["ALL"], cap_add: [], privileged: false,
  security_opt: ["no-new-privileges"], binds: [], mounts: [], devices: [],
  pids_limit: 32, memory_bytes: 67108864, nano_cpus: 250000000, restart: "no",
  tmpfs: { "/case": "rw,noexec,nosuid,nodev,size=1048576,mode=700,uid=65532,gid=65532" },
  entrypoint: ["/usr/local/bin/node"], command: ["/airlock/sdk-absent-owned-namespace-init.mjs"],
  output_limit_bytes: 16384, logging: "none", auto_remove: false,
});
const refused = reason => ({ ready: false, qualified: false, scope: "SOURCE_PURE_MODEL_ONLY", reason,
  native_authority: false, sdk_absent: true });
export function ownedNamespaceReadiness() {
  return { ...refused("namespace_runtime_and_independent_owner_UNPROVED"), blockers: [
    "exact owner choice/Accepted ADR/separate execution GO absent",
    "real external S ownership before W/start, S-loss handoff and daemon settlement unproved",
    "engine/endpoint/client/derived-image/Linux Node cohort NOT_PREPARED",
    "clock-rate/margin bounds and private PID namespace termination unproved",
    "actual late detached/orphan and W-loss pre-init/post-arm controls absent",
    "actual external command close/publication within original 45s absent",
    "both source closures require parent integration before qualification",
  ] };
}
export function prepareOwnedNamespacePlan(value) {
  const v = record(data(value), ["case_id", "nonce", "root"]);
  if (!/^[a-z0-9-]{1,48}$/.test(v.case_id) || !digest(v.nonce) || typeof v.root !== "string"
    || !isAbsolute(v.root) || resolve(v.root) !== v.root) fail("namespace_plan_arguments");
  const cohort = fixedRead(COHORT), parsed = json(cohort.bytes);
  if (parsed.status === "NOT_PREPARED") fail("namespace_cohort_NOT_PREPARED");
  const c = record(parsed, ["schema", "status", "endpoint", "engine_id", "client_realpath", "client_sha256",
    "image_id", "platform", "node_version", "base_digest", "root_uid", "sources", "clock"], ["adapter_contract"]);
  if (c.schema !== "airlock.owned-namespace-cohort.v1" || c.status !== "PREPARED_SOURCE_MODEL_ONLY"
    || c.endpoint !== ENDPOINT || c.platform !== "linux/arm64/v8" || c.node_version !== "24.10.0" || c.base_digest !== BASE
    || typeof c.engine_id !== "string" || !c.engine_id || c.engine_id.length > 128
    || !Number.isSafeInteger(c.root_uid) || c.root_uid < 1 || !digest(c.client_sha256)
    || !/^sha256:[a-f0-9]{64}$/.test(c.image_id)) fail("namespace_fixed_cohort");
  const directories = [v.root, v.root + "/case", v.root + "/docker-config", v.root + "/empty-home"]
    .map(path => privateDirectory(path, c.root_uid));
  if (realpathSync(CLIENT) !== c.client_realpath) fail("namespace_client_changed");
  const client = fixedRead(c.client_realpath, { maximum: 134217728, executable: true });
  if (client.handle.sha256 !== c.client_sha256) fail("namespace_client_changed");
  const config = fixedRead(v.root + "/docker-config/config.json", { maximum: 64, privateUid: c.root_uid });
  if (!config.bytes.equals(Buffer.from("{}\n"))) fail("namespace_empty_config");
  if (!Array.isArray(c.sources) || c.sources.length !== OWNED_NAMESPACE_SOURCES.length) fail("namespace_source_lease");
  const sources = OWNED_NAMESPACE_SOURCES.map((path, n) => {
    const expected = record(c.sources[n], ["path", "sha256"]), read = fixedRead(path);
    if (expected.path !== path || expected.sha256 !== read.handle.sha256) fail("namespace_source_lease");
    return read.handle;
  });
  const p = handle();
  plans.set(p, freeze({ ...v, cohort: cohort.handle, metadata: c, directories, client: client.handle, config: config.handle,
    sources, source_sha256: hash(JSON.stringify(data(sources))), clock: clockBounds(c.clock) }));
  return p;
}
function prepared(p) {
  const v = plans.get(p);
  if (!v) fail("private_namespace_plan");
  return v;
}
function revalidate(p) {
  const v = prepared(p);
  for (const old of [v.cohort, v.config, ...v.sources]) {
    if (!equal(fixedRead(old.path).handle, old)) fail("namespace_source_changed");
  }
  if (realpathSync(CLIENT) !== v.client.path
    || !equal(fixedRead(v.client.path, { maximum: 134217728, executable: true }).handle, v.client)) fail("namespace_client_changed");
  for (const d of v.directories) {
    const fresh = privateDirectory(d.path, v.metadata.root_uid);
    if (fresh.dev !== d.dev || fresh.ino !== d.ino) fail("namespace_directory_changed");
  }
  return v;
}
export function createOwnedNamespaceSupervisor(plan, started) {
  const p = prepared(plan); tick(started);
  if (usedPlans.has(plan)) fail("namespace_plan_already_owned");
  usedPlans.add(plan);
  const h = handle();
  supervisors.set(h, { plan, p, started, last: started, work: started + WORK_MS, total: started + TOTAL_MS,
    revision: 0, publication: 0, ops: [], cid: null, custody: null, custodyDurable: false, workerLost: false,
    supervisorLost: false, startedPayload: false, stopped: false, waited: false, removed: false,
    hello: null, arm: null, armed: false, worked: false, control: null, controlWitness: null,
    workerLostPhase: null, errors: [] });
  return h;
}
function state(h, now, { allowLost = false, allowExpired = false } = {}) {
  const s = supervisors.get(h);
  if (!s) fail("private_namespace_supervisor");
  tick(now);
  if (now < s.last) { s.errors.push("supervisor_clock_reversed"); fail("namespace_clock_reversed"); }
  s.last = now;
  if (s.supervisorLost && !allowLost) fail("supervisor_lost");
  if (now >= s.total && !allowExpired) {
    s.errors.push("original_total_deadline_expired"); fail("namespace_original_deadline_expired");
  }
  try { revalidate(s.plan); } catch (error) { s.errors.push(error.message); throw error; }
  return s;
}
function complete(s) {
  return !!s.cid && s.stopped && s.waited && s.removed && !s.supervisorLost && !s.errors.length
    && s.ops.length > 0 && s.ops.every(op => op.daemon === "SETTLED" && op.client_closed && op.streams_settled && op.exit_code === 0);
}
function retainedIdentity(p) {
  return { preparation_scope: "SOURCE_PURE_MODEL_ONLY", preissued_name: "airlock-owned-" + p.case_id,
    case_id: p.case_id, nonce: p.nonce, endpoint: ENDPOINT, engine_id: p.metadata.engine_id,
    image_id: p.metadata.image_id, original_configuration: CONFIG, root: p.directories[0],
    client: p.client, client_config: p.config, cohort: p.cohort, sources: p.sources, clock_bounds: p.clock,
    adapter_contract: p.metadata.adapter_contract ?? null };
}
function snapshot(s) {
  return { schema: "airlock.owned-namespace-supervisor-model.v1", scope: "SOURCE_PURE_MODEL_ONLY",
    case_id: s.p.case_id, source_sha256: s.p.source_sha256, prepared_identity: retainedIdentity(s.p),
    revision: s.revision, started_ms: s.started,
    work_deadline_ms: s.work, total_deadline_ms: s.total, cid: s.cid, custody: s.custody,
    worker_lost: s.workerLost, supervisor_lost: s.supervisorLost, workload_permitted: s.worked,
    armed: s.armed, started_payload: s.startedPayload, stopped: s.stopped, waited: s.waited, removed: s.removed,
    control: s.control, control_witness: s.controlWitness, worker_lost_phase: s.workerLostPhase,
    disposition: complete(s) ? "SIMULATED_SETTLED_NOT_QUALIFIED" : "UNKNOWN", operations: s.ops, errors: s.errors };
}
export function namespaceState(h) {
  const s = supervisors.get(h);
  if (!s) fail("private_namespace_supervisor");
  return cloned(snapshot(s));
}
export function namespaceExpectedIdentity(h) {
  const s = supervisors.get(h);
  if (!s) fail("private_namespace_supervisor");
  return cloned({ cid: s.cid, name: "airlock-owned-" + s.p.case_id, endpoint: ENDPOINT,
    engine_id: s.p.metadata.engine_id, image_id: s.p.metadata.image_id, source_sha256: s.p.source_sha256,
    config: CONFIG, labels: { case_id: s.p.case_id, nonce: s.p.nonce, source_sha256: s.p.source_sha256 } });
}
export function registerNamespaceOperation(h, value) {
  const v = record(data(value), ["kind", "now_ms"]), s = state(h, v.now_ms);
  if (!["create", "inspect-name", "inspect-cid", "start", "stop", "wait", "remove"].includes(v.kind)) fail("namespace_fixed_operation");
  if (s.ops.length >= 16) fail("namespace_operation_bound");
  const issued = kind => s.ops.some(o => o.kind === kind);
  if (v.kind === "create" && (s.cid || issued("create"))) fail("namespace_create_once");
  if (v.kind === "inspect-name" && (s.cid || !issued("create") || issued("inspect-name"))) fail("namespace_exact_name_recovery_only");
  if (v.kind === "inspect-cid" && (!s.cid || issued("inspect-cid"))) fail("namespace_bound_id_required");
  if (v.kind === "start") {
    if (!s.custodyDurable || !s.cid || !s.custody) fail("namespace_custody_not_durable");
    if (s.workerLost || s.errors.length || issued("start") || s.ops.some(o => o.daemon !== "SETTLED" || !o.client_closed || !o.streams_settled)
      || v.now_ms >= s.work) fail("namespace_start_not_permitted");
  }
  if (["stop", "wait", "remove"].includes(v.kind) && (!s.cid || !s.custodyDurable)) fail("namespace_bound_id_required");
  if (["stop", "wait", "remove"].includes(v.kind) && issued(v.kind)) fail("namespace_operation_once");
  if (v.kind === "remove" && (!s.waited || !s.stopped || s.ops.some(o => o.daemon !== "SETTLED" || !o.client_closed || !o.streams_settled)))
    fail("namespace_remove_before_settlement");
  const op = { id: s.ops.length + 1, kind: v.kind, owner: "S", daemon: "PENDING", issued: false,
    registered_ms: v.now_ms, issued_ms: null, replied_ms: null, client_closed_ms: null,
    client_closed: false, streams_settled: false, exit_code: null,
    reply: null };
  s.ops.push(op); s.revision++;
  return op.id;
}
export function persistNamespaceJournal(h, now) {
  const s = state(h, now);
  try {
    if (s.publication >= 32) fail("namespace_publication_bound");
    const file = atomicPrivateWrite(s.p.root, "journal-" + (++s.publication) + ".json", snapshot(s), s.p.metadata.root_uid);
    state(h, now);
    const j = handle(); journals.set(j, { supervisor: h, revision: s.revision, file });
    if (s.custody) s.custodyDurable = true;
    return j;
  } catch (error) { s.errors.push("journal_publication:" + error.message); throw error; }
}
export function issueNamespaceCommand(h, value) {
  // The journal capability is NOT data and must not pass through data()/JSON.
  const v = record(value, ["operation", "journal", "now_ms"]), s = state(h, v.now_ms);
  const j = journals.get(v.journal), op = s.ops.find(o => o.id === v.operation);
  if (!j || j.supervisor !== h || j.revision !== s.revision || !op || op.issued
    || !equal(fixedRead(j.file.path).handle, j.file)) fail("durable_registration_required");
  if ((op.kind === "create" || op.kind === "start") && (s.workerLost || s.errors.length || v.now_ms >= s.work))
    fail("namespace_start_not_permitted");
  const argv = ["--config", s.p.root + "/docker-config", "--host", ENDPOINT];
  if (op.kind === "create") argv.push("create", "--name", "airlock-owned-" + s.p.case_id,
    "--pull=never", "--platform=linux/arm64/v8", "--network=none", "--ipc=private", "--read-only",
    "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=32",
    "--memory=64m", "--cpus=0.25", "--restart=no", "--log-driver=none", "--no-healthcheck",
    "--tmpfs=/case:" + CONFIG.tmpfs["/case"], "--label=case_id=" + s.p.case_id, "--label=nonce=" + s.p.nonce,
    "--label=source_sha256=" + s.p.source_sha256, "--env=AIRLOCK_CASE=" + s.p.case_id,
    "--env=AIRLOCK_NONCE=" + s.p.nonce, "--entrypoint=/usr/local/bin/node", s.p.metadata.image_id,
    "/airlock/sdk-absent-owned-namespace-init.mjs");
  else if (op.kind === "inspect-name" || op.kind === "inspect-cid")
    argv.push("inspect", "--type=container", op.kind === "inspect-name" ? "airlock-owned-" + s.p.case_id : s.cid);
  else if (op.kind === "start") argv.push("start", "--attach", "--interactive", s.cid);
  else if (op.kind === "stop") argv.push("stop", "--time=1", s.cid);
  else argv.push(op.kind === "remove" ? "rm" : op.kind, s.cid);
  op.issued = true; op.issued_ms = v.now_ms; s.revision++;
  // A command description only. No spawn/exec/Docker adapter is implemented.
  return freeze({ executable: CLIENT, argv, env: { HOME: s.p.root + "/empty-home",
    DOCKER_CONFIG: s.p.root + "/docker-config", DOCKER_HOST: ENDPOINT, PATH: "/usr/local/bin:/usr/bin:/bin" },
  endpoint: ENDPOINT, engine_id: s.p.metadata.engine_id, operation: op.id, owner: "S",
  total_deadline_ms: s.total, output_limit_bytes: CONFIG.output_limit_bytes, executable_sha256: s.p.client.sha256,
  scope: "SOURCE_PURE_MODEL_ONLY" });
}
export function observeNamespaceDaemonReply(h, value) {
  const v = record(data(value), ["operation", "outcome", "value", "now_ms"]);
  // Preserve a late reply as evidence, never as a new budget or a success.
  const s = state(h, v.now_ms, { allowLost: true, allowExpired: true });
  const op = s.ops.find(o => o.id === v.operation);
  if (!op || !op.issued || op.daemon !== "PENDING") fail("namespace_unissued_or_duplicate_reply");
  if (v.now_ms >= s.total) s.errors.push("daemon_reply_after_original_deadline");
  op.reply = v; op.replied_ms = v.now_ms; s.revision++;
  if (v.outcome !== "reply") { s.errors.push("daemon_operation_failed:" + op.kind); fail("namespace_daemon_failure"); }
  try {
    if (op.kind === "create") {
      const c = record(v.value, ["cid"]);
      if (!digest(c.cid) || (s.cid && s.cid !== c.cid)) fail("namespace_foreign_identity");
      s.cid = c.cid;
    } else if (op.kind === "inspect-name" || op.kind === "inspect-cid") {
      const observed = record(v.value, ["cid", "name", "endpoint", "engine_id", "image_id", "source_sha256", "config", "labels"]);
      const expected = namespaceExpectedIdentity(h);
      if (!digest(observed.cid) || (s.cid && observed.cid !== s.cid)) fail("namespace_foreign_identity");
      expected.cid = observed.cid;
      if (!equal(expected, observed)) fail("namespace_foreign_identity");
      s.cid = observed.cid; s.custody = freeze(cloned(observed)); s.custodyDurable = false;
    } else if (op.kind === "start") {
      if (!equal(v.value, { started: true })) fail("namespace_start_reply");
      s.startedPayload = true;
    } else if (op.kind === "stop") {
      if (!equal(v.value, { stopped_cid: s.cid })) fail("namespace_stop_reply");
      s.stopped = true;
    } else if (op.kind === "wait") {
      if (!equal(v.value, { waited_cid: s.cid, exit_code: 0 })) fail("namespace_wait_reply");
      s.waited = true;
    } else if (op.kind === "remove") {
      if (!equal(v.value, { removed_cid: s.cid })) fail("namespace_remove_reply");
      s.removed = true;
    }
    op.daemon = "SETTLED";
  } catch (error) { s.errors.push(error.message); throw error; }
}
export function observeNamespaceClientClose(h, value) {
  const v = record(data(value), ["operation", "exit_code", "streams_settled", "now_ms"]);
  const s = state(h, v.now_ms, { allowLost: true, allowExpired: true }), op = s.ops.find(o => o.id === v.operation);
  if (!op || !op.issued || op.client_closed || ![null, 0, 1, 2, 137].includes(v.exit_code)
    || typeof v.streams_settled !== "boolean") fail("namespace_client_close");
  op.client_closed = true; op.client_closed_ms = v.now_ms; op.streams_settled = v.streams_settled; op.exit_code = v.exit_code; s.revision++;
  if (v.exit_code !== 0) s.errors.push("client_loss_does_not_cancel_daemon:" + op.kind);
  if (!v.streams_settled) s.errors.push("client_streams_unsettled:" + op.kind);
  if (v.now_ms >= s.total) s.errors.push("client_close_after_original_deadline");
}
export function loseNamespaceWorker(h, now) {
  const s = state(h, now);
  if (s.workerLost) fail("namespace_worker_loss_once");
  s.workerLost = true;
  s.workerLostPhase = s.armed ? "after-arm" : s.ops.some(op => op.kind === "start" && op.issued && op.daemon === "PENDING")
    ? "pending-start-before-init" : "before-arm";
  s.revision++;
}
export function loseNamespaceSupervisor(h, now) {
  const s = state(h, now); s.supervisorLost = true; s.errors.push("supervisor_lost_no_supported_handoff"); s.revision++;
}
export function namespaceHello(h, value, now) {
  const v = record(data(value), ["type", "case_id", "nonce", "tau0_ms"]), s = state(h, now);
  if (v.type !== "HELLO" || s.workerLost || s.hello || !s.startedPayload || v.case_id !== s.p.case_id || v.nonce !== s.p.nonce)
    fail("namespace_hello_not_permitted");
  tick(v.tau0_ms); s.hello = { case_id: v.case_id, nonce: v.nonce, tau0_ms: v.tau0_ms };
  s.arm = conservativeArm({ ...s.hello, now_ms: now, work_deadline_ms: s.work, total_deadline_ms: s.total, clock: s.p.clock });
  s.revision++;
  return s.arm;
}
export function namespaceArmed(h, value, now) {
  const v = record(data(value), ["type", "case_id", "nonce", "tau0_ms"]), s = state(h, now);
  if (!s.arm || s.armed || s.workerLost || !equal(v, { type: "ARMED", ...s.hello }) || now >= s.work)
    fail("namespace_armed_not_permitted");
  s.armed = true; s.revision++;
}
export function issueNamespaceWork(h, control, now) {
  const s = state(h, now);
  if (!["normal", "late-detached-orphan"].includes(control)
    || !s.armed || s.worked || s.workerLost || s.errors.length || now >= s.work)
    fail("namespace_work_not_permitted");
  s.worked = true; s.control = control; s.revision++;
  return freeze({ type: "WORK", ...s.hello, control });
}
export function observeNamespaceControlEvent(h, value, now) {
  const v = record(data(value), ["type", "case_id", "nonce"]), s = state(h, now);
  if (!s.worked || s.control !== "late-detached-orphan" || s.controlWitness
    || v.type !== "SOURCE_MODEL_LATE_FORK_SETSID_ORPHAN" || v.case_id !== s.p.case_id || v.nonce !== s.p.nonce)
    fail("namespace_control_witness");
  s.controlWitness = { ...v, observed_ms: now, scope: "SIMULATED_NOT_OS_PROOF" }; s.revision++;
}
export function namespacePlanEvidence(plan) {
  const p = revalidate(plan);
  return cloned({ case_id: p.case_id, source_sha256: p.source_sha256, cohort_sha256: p.cohort.sha256,
    image_id: p.metadata.image_id, engine_id: p.metadata.engine_id, endpoint: ENDPOINT, case_root: p.root + "/case",
    config: CONFIG, labels: { case_id: p.case_id, nonce: p.nonce, source_sha256: p.source_sha256 },
    prepared_identity: retainedIdentity(p) });
}
export function publishNamespaceCandidate(h, control, now) {
  const s = state(h, now);
  if (!["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"].includes(control)) fail("namespace_fixed_control");
  const candidate = { schema: "airlock.owned-namespace-candidate.v1", ...namespacePlanEvidence(s.plan),
    scope: "SOURCE_PURE_MODEL_ONLY", qualified: false, native_authority: false, sdk_absent: true,
    control, supervisor: snapshot(s), source_model_settled: complete(s) };
  try {
    const file = atomicPrivateWrite(s.p.root + "/case", "candidate.json", candidate, s.p.metadata.root_uid);
    state(h, now);
    return freeze({ file, candidate: cloned(candidate), qualified: false, external_completion_required: true });
  } catch (error) { s.errors.push("candidate_publication:" + error.message); throw error; }
}
