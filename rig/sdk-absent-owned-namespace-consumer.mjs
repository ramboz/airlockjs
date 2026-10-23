// No executor. Expected external handles come from an independent whole-command
// observer AFTER close, not from the producer or a poll of candidate.json.
import process from "node:process";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail, fixedRead, hash } from "./sdk-absent-owned-namespace-io.mjs";
import { namespacePlanEvidence, ownedNamespaceReadiness } from "./sdk-absent-owned-namespace.mjs";
import { conservativeArm, TOTAL_MS, WORK_MS, tick } from "./sdk-absent-owned-namespace-time.mjs";
import { ownedNamespacePublicCommand } from "./sdk-absent-owned-namespace-entry.mjs";
import { normalizeOwnedNamespaceEngine, normalizeOwnedNamespaceInspection, ownedNamespaceDockerArgv } from "./sdk-absent-owned-namespace-wire.mjs";

const S_FILE = fileURLToPath(new URL("sdk-absent-owned-namespace-actors.mjs", import.meta.url));
const W_FILE = fileURLToPath(new URL("sdk-absent-owned-namespace-worker.mjs", import.meta.url));
export function ownedNamespaceWholeCommand(plan, control = "normal") {
  const p = namespacePlanEvidence(plan);
  return ownedNamespacePublicCommand(["--fixed-namespace-case", p.case_id, p.labels.nonce, p.prepared_identity.root.path, control]);
}
function handle(value) {
  const v = record(data(value), ["path", "dev", "ino", "size", "mode", "uid", "nlink", "mtime_ms", "ctime_ms", "sha256"]);
  if (!digest(v.sha256) || v.nlink !== 1 || !["dev", "ino", "size", "mode", "uid"].every(k => Number.isSafeInteger(v[k]) && v[k] > 0)
    || !["mtime_ms", "ctime_ms"].every(k => Number.isFinite(v[k]) && v[k] >= 0)) fail("namespace_external_handle");
  return v;
}
function snapshot(expected) {
  const actual = fixedRead(expected.path);
  if (!equal(actual.handle, expected)) fail("namespace_original_hash_or_identity_changed");
  return { file: actual.handle, value: json(actual.bytes) };
}
function supervisor(value, candidate, evidence, external) {
  const s = record(value, ["schema", "scope", "case_id", "source_sha256", "prepared_identity", "revision", "started_ms", "work_deadline_ms",
    "total_deadline_ms", "cid", "custody", "worker_lost", "supervisor_lost", "workload_permitted", "armed",
    "started_payload", "stopped", "waited", "removed", "control", "control_witness", "worker_lost_phase",
    "disposition", "operations", "errors"]);
  if (s.schema !== "airlock.owned-namespace-supervisor-model.v1" || s.scope !== "SOURCE_PURE_MODEL_ONLY"
    || s.case_id !== evidence.case_id || s.source_sha256 !== evidence.source_sha256 || !equal(s.prepared_identity, evidence.prepared_identity)
    || !Number.isSafeInteger(s.revision) || s.revision <= 0 || !digest(s.cid)
    || s.supervisor_lost !== false || s.started_payload !== true || s.stopped !== true || s.waited !== true || s.removed !== true
    || s.disposition !== "SIMULATED_SETTLED_NOT_QUALIFIED" || !equal(s.errors, [])) fail("namespace_model_incomplete_or_failed");
  [s.started_ms, s.work_deadline_ms, s.total_deadline_ms].forEach(tick);
  if (s.started_ms !== external.started_monotonic_ms || s.work_deadline_ms !== s.started_ms + WORK_MS
    || s.total_deadline_ms !== s.started_ms + TOTAL_MS) fail("namespace_original_fences_changed");
  const custody = record(s.custody, ["cid", "name", "endpoint", "engine_id", "image_id", "source_sha256", "config", "labels"]);
  if (!equal(custody, { cid: s.cid, name: "airlock-owned-" + evidence.case_id, endpoint: evidence.endpoint,
    engine_id: evidence.engine_id, image_id: evidence.image_id, source_sha256: evidence.source_sha256,
    config: evidence.config, labels: evidence.labels })) fail("namespace_custody_changed");
  if (!Array.isArray(s.operations) || s.operations.length < 6 || s.operations.length > 16) fail("namespace_operation_settlement");
  const kinds = [];
  let previousRegistration = s.started_ms;
  for (const [n, item] of s.operations.entries()) {
    const o = record(item, ["id", "kind", "owner", "daemon", "issued", "registered_ms", "issued_ms", "replied_ms",
      "client_closed_ms", "client_closed", "streams_settled", "exit_code", "reply"]);
    if (o.id !== n + 1 || o.owner !== "S" || o.daemon !== "SETTLED" || o.issued !== true
      || o.client_closed !== true || o.streams_settled !== true || o.exit_code !== 0) fail("namespace_operation_settlement");
    [o.registered_ms, o.issued_ms, o.replied_ms, o.client_closed_ms].forEach(tick);
    if (o.registered_ms < previousRegistration || o.issued_ms < o.registered_ms || o.replied_ms < o.issued_ms
      || o.client_closed_ms < o.issued_ms || Math.max(o.replied_ms, o.client_closed_ms) > external.completed_monotonic_ms)
      fail("namespace_operation_timing");
    previousRegistration = o.registered_ms;
    const reply = record(o.reply, ["operation", "outcome", "value", "now_ms"]);
    if (reply.operation !== o.id || reply.outcome !== "reply" || reply.now_ms !== o.replied_ms) fail("namespace_original_reply");
    const expectedReply = o.kind === "create" ? { cid: s.cid } : o.kind === "inspect-cid" ? custody
      : o.kind === "start" ? { started: true } : o.kind === "stop" ? { stopped_cid: s.cid }
        : o.kind === "wait" ? { waited_cid: s.cid, exit_code: 0 } : o.kind === "remove" ? { removed_cid: s.cid } : null;
    if (!expectedReply || !equal(reply.value, expectedReply)) fail("namespace_original_reply");
    kinds.push(o.kind);
  }
  if (!equal(kinds, ["create", "inspect-cid", "start", "stop", "wait", "remove"])) fail("namespace_fixed_operation_sequence");
  if (candidate.control === "worker-loss-before-init") {
    if (s.worker_lost !== true || s.worker_lost_phase !== "pending-start-before-init" || s.armed !== false
      || s.workload_permitted !== false || s.control !== null || s.control_witness !== null) fail("namespace_preinit_loss_missing");
  } else if (candidate.control === "worker-loss-after-arm") {
    if (s.worker_lost !== true || s.worker_lost_phase !== "after-arm" || s.armed !== true
      || s.workload_permitted !== false || s.control !== null || s.control_witness !== null) fail("namespace_postarm_loss_missing");
  } else {
    if (s.worker_lost !== false || s.worker_lost_phase !== null || s.armed !== true
      || s.workload_permitted !== true || s.control !== candidate.control) fail("namespace_control_missing");
    if (candidate.control === "normal") {
      if (s.control_witness !== null) fail("namespace_control_missing");
    } else {
      const witness = record(s.control_witness, ["type", "case_id", "nonce", "observed_ms", "scope"]);
      if (witness.type !== "SOURCE_MODEL_LATE_FORK_SETSID_ORPHAN" || witness.case_id !== evidence.case_id
        || witness.nonce !== evidence.labels.nonce || witness.scope !== "SIMULATED_NOT_OS_PROOF"
        || !Number.isFinite(witness.observed_ms) || witness.observed_ms < s.started_ms
        || witness.observed_ms >= s.work_deadline_ms) fail("namespace_detached_orphan_witness_missing");
    }
  }
}
// Explicit historical model assessment. Never selected by the actual-output
// consumer below, and never a runtime receipt or qualification fallback.
export function inspectOwnedNamespaceModelCompletion(plan, value) {
  const denied = reason => ({ qualified: false, external_completion_valid: false,
    source_model_evidence_valid: false, sdk_absent: true, native_authority: false, reason });
  try {
    const v = record(data(value), ["completion"]);
    if (v.completion === null) return denied("namespace_external_completion_missing");
    const p = namespacePlanEvidence(plan), externalHandle = handle(v.completion);
    const root = p.case_root.slice(0, -"/case".length);
    if (externalHandle.path !== root + "/external-completion.json") fail("namespace_external_observer_scope");
    const external = snapshot(externalHandle);
    const e = record(external.value, ["schema", "observer_scope", "command", "case_id", "source_sha256", "cohort_sha256",
      "exit_observed", "actual_exit_code", "signal", "timed_out", "started_monotonic_ms", "completed_monotonic_ms",
      "candidate", "publication_closed_monotonic_ms", "observer_streams_settled", "observer_queries_settled",
      "supervisor_lost", "errors", "scope", "qualified"]);
    if (e.schema !== "airlock.owned-namespace-external-completion.v1" || e.observer_scope !== "external-whole-command-after-close"
      || e.scope !== "SOURCE_PURE_MODEL_ONLY" || e.qualified !== false
      || e.exit_observed !== true || e.actual_exit_code !== 0 || e.signal !== null || e.timed_out !== false
      || e.observer_streams_settled !== true || e.observer_queries_settled !== true || e.supervisor_lost !== false
      || !equal(e.errors, [])) fail("namespace_external_command_failed_or_unsettled");
    [e.started_monotonic_ms, e.completed_monotonic_ms, e.publication_closed_monotonic_ms].forEach(tick);
    if (e.completed_monotonic_ms < e.started_monotonic_ms
      || e.completed_monotonic_ms - e.started_monotonic_ms >= TOTAL_MS
      || e.publication_closed_monotonic_ms < e.started_monotonic_ms
      || e.publication_closed_monotonic_ms > e.completed_monotonic_ms) fail("namespace_external_original_45s_fence");
    if (e.case_id !== p.case_id || e.source_sha256 !== p.source_sha256 || e.cohort_sha256 !== p.cohort_sha256)
      fail("namespace_original_sources_changed");
    const candidateHandle = handle(e.candidate);
    if (candidateHandle.path !== p.case_root + "/candidate.json") fail("namespace_candidate_scope");
    const candidate = snapshot(candidateHandle);
    const c = record(candidate.value, ["schema", "case_id", "source_sha256", "cohort_sha256", "image_id", "engine_id",
      "endpoint", "case_root", "config", "labels", "prepared_identity", "scope", "qualified", "native_authority", "sdk_absent",
      "control", "supervisor", "source_model_settled"]);
    if (c.schema !== "airlock.owned-namespace-candidate.v1" || c.scope !== "SOURCE_PURE_MODEL_ONLY"
      || c.qualified !== false || c.native_authority !== false || c.sdk_absent !== true || c.source_model_settled !== true
      || !["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"].includes(c.control))
      fail("namespace_candidate_failed_or_success_claim");
    if (!equal(e.command, ownedNamespaceWholeCommand(plan, c.control))) fail("namespace_external_command_failed_or_unsettled");
    for (const k of Object.keys(p)) if (!equal(c[k], p[k])) fail("namespace_candidate_identity_changed");
    supervisor(c.supervisor, c, p, e);
    // Re-read originals and fixed leases after all parsing/consumption.
    snapshot(externalHandle); snapshot(candidateHandle); namespacePlanEvidence(plan);
    // Passing SOURCE/PURE data is NEVER actual S/namespace/clock qualification.
    return { ...denied(ownedNamespaceReadiness().reason), external_completion_valid: true,
      source_model_evidence_valid: true, simulation_only: true };
  } catch (error) { return denied(error.message); }
}

function request(value, p, externalStart) {
  const r = record(value, ["schema", "case_id", "nonce", "root", "control", "clock_domain", "started_monotonic_ms",
    "work_deadline_ms", "total_deadline_ms", "source_sha256", "cohort_sha256"]);
  if (r.schema !== "airlock.owned-namespace-launch-request.v2" || r.case_id !== p.case_id || r.nonce !== p.labels.nonce
    || r.root !== p.prepared_identity.root.path || r.clock_domain !== "NODE_HOST_HRTIME_MONOTONIC"
    || !["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"].includes(r.control)
    || r.source_sha256 !== p.source_sha256 || r.cohort_sha256 !== p.cohort_sha256
    || r.started_monotonic_ms !== externalStart || r.work_deadline_ms !== externalStart + WORK_MS
    || r.total_deadline_ms !== externalStart + TOTAL_MS) fail("namespace_actual_original_request");
  return r;
}
function original(bytes, digestValue, text) {
  if (typeof bytes !== "string" || !digest(digestValue)) fail("namespace_actual_original_bytes");
  const decoded = Buffer.from(bytes, "base64");
  if (decoded.length > 16384 || decoded.toString("base64") !== bytes || hash(decoded) !== digestValue)
    fail("namespace_actual_original_bytes");
  let utf8;
  try { utf8 = new TextDecoder("utf-8", { fatal: true }).decode(decoded); } catch { fail("namespace_actual_original_bytes"); }
  if (utf8 !== text) fail("namespace_actual_original_bytes");
  return decoded;
}
function replaySettlementDAG(operations) {
  const actions = operations.filter(o => o.kind !== "engine-info");
  const late = actions.some(o => o.kind === "stop-after-late-start");
  const expected = ["create", "inspect-cid", "inspect-cid", "start", "stop", "inspect-cid",
    ...(late ? ["stop-after-late-start", "inspect-cid"] : []), "wait", "remove"];
  if (!equal(actions.map(o => o.kind), expected)) fail("namespace_actual_producer_path");
  const [create, bootInspect, prestartInspect, start, stop, postStopInspect] = actions;
  const wait = actions.at(-2), remove = actions.at(-1);
  const closedBefore = (prior, next) => {
    if (prior.close_ms > next.registered_ms) fail("namespace_actual_settlement_dependency");
  };
  // Registration/issuance is serial; client lifetimes need not be. In
  // particular, stop is deliberately allowed while start is still pending.
  for (let n = 1; n < operations.length; n++) {
    if (operations[n - 1].issued_ms > operations[n].registered_ms)
      fail("namespace_actual_settlement_dependency");
  }
  for (let n = 0; n < actions.length; n++) {
    const current = actions[n], previous = actions[n - 1];
    const probes = operations.filter(o => o.kind === "engine-info"
      && o.id > (previous?.id ?? 0) && o.id < current.id);
    if (!probes.some(o => o.close_ms <= current.registered_ms))
      fail("namespace_actual_engine_dependency");
  }
  closedBefore(create, bootInspect);
  closedBefore(bootInspect, prestartInspect);
  closedBefore(prestartInspect, start);
  for (const op of operations.filter(o => o.id < start.id)) closedBefore(op, start);
  closedBefore(stop, postStopInspect);
  closedBefore(start, postStopInspect);
  closedBefore(start, wait);
  const postState = json(Buffer.from(postStopInspect.stdout)).State.Status;
  if (postState !== (late ? "running" : "exited")) fail("namespace_actual_cleanup_state");
  if (late) {
    const lateStop = actions[6], finalInspect = actions[7];
    closedBefore(postStopInspect, lateStop);
    closedBefore(lateStop, finalInspect);
    if (json(Buffer.from(finalInspect.stdout)).State.Status !== "exited") fail("namespace_actual_cleanup_state");
    closedBefore(finalInspect, wait);
  } else closedBefore(postStopInspect, wait);
  closedBefore(wait, remove);
  // The producer checks all previously issued operations before removal, not
  // merely the array order of start/wait/rm. close_ms includes stream/callback
  // settlement, already checked in the individual operation replay.
  for (const op of operations.filter(o => o.id < remove.id)) closedBefore(op, remove);
  const tail = operations.filter(o => o.id > remove.id);
  if (tail.length !== 1 || tail[0].kind !== "engine-info") fail("namespace_actual_final_verification");
  closedBefore(remove, tail[0]);
}
function actualLedger(value, p, r, requestHandle, plan, completed) {
  const s = record(value, ["schema", "qualified", "scope", "request", "request_file", "source_sha256", "retained_preparation",
    "owner", "actor", "cid", "custody", "custody_durable", "phase", "worker", "worker_lost", "worker_loss_phase", "armed",
    "work_issued", "aborted", "operations", "continuations", "errors", "events", "disposition", "original_total_deadline_ms",
    "sdk_absent", "native_authority", "mechanical_resources_settled"]);
  if (s.schema !== "airlock.owned-namespace-S-ledger.v2" || s.qualified !== false || s.scope !== "UNQUALIFIED_SOURCE_EXECUTOR"
    || s.owner !== "S" || !equal(s.request, r) || !equal(s.request_file, requestHandle) || s.source_sha256 !== p.source_sha256
    || !equal(s.retained_preparation, p.prepared_identity) || !digest(s.cid) || s.custody_durable !== true
    || s.original_total_deadline_ms !== r.total_deadline_ms || s.disposition !== "UNQUALIFIED_ACTOR_CANDIDATE"
    || s.mechanical_resources_settled !== true || s.sdk_absent !== true || s.native_authority !== false || !equal(s.errors, []))
    fail("namespace_actual_actor_incomplete");
  const actor = record(s.actor, ["role", "pid", "ppid", "executable", "started_monotonic_ms"]);
  if (actor.role !== "S" || actor.executable !== process.execPath || ![actor.pid, actor.ppid].every(n => Number.isSafeInteger(n) && n > 0)
    || !Number.isFinite(actor.started_monotonic_ms) || actor.started_monotonic_ms < r.started_monotonic_ms
    || actor.started_monotonic_ms >= r.work_deadline_ms) fail("namespace_actual_S_identity");
  const custody = record(s.custody, ["cid", "name", "image_id", "endpoint", "engine_id", "source_sha256",
    "labels", "configuration_projection", "state"]);
  const normalized = normalizeOwnedNamespaceInspection(plan, Buffer.from(JSON.stringify(custody.configuration_projection)), s.cid);
  if (!equal(custody, normalized)) fail("namespace_actual_custody");
  if (!Array.isArray(s.operations) || !s.operations.length || s.operations.length > 40) fail("namespace_actual_operation_count");
  let start = null;
  const kinds = [];
  for (const [n, item] of s.operations.entries()) {
    const o = record(item, ["id", "kind", "owner", "cid", "endpoint", "engine_id", "executable", "executable_sha256",
      "argv", "env", "registered_ms", "issued_ms", "close_ms", "daemon", "client_closed", "streams_settled",
      "exit_code", "signal", "stdout", "stderr", "errors", "stdout_original_base64", "stderr_original_base64",
      "stdout_sha256", "stderr_sha256"]);
    if (o.id !== n + 1 || o.owner !== "S" || (o.cid !== null && o.cid !== s.cid) || o.endpoint !== p.endpoint || o.engine_id !== p.engine_id
      || o.executable !== p.prepared_identity.client.path || o.executable_sha256 !== p.prepared_identity.client.sha256
      || o.daemon !== "SETTLED" || o.client_closed !== true || o.streams_settled !== true || o.exit_code !== 0 || o.signal !== null
      || !equal(o.errors, []) || !equal(o.env, { HOME: r.root + "/empty-home", DOCKER_CONFIG: r.root + "/docker-config",
        DOCKER_HOST: p.endpoint, PATH: "/usr/local/bin:/usr/bin:/bin" })
      || !equal(o.argv, ownedNamespaceDockerArgv(plan, o.kind, o.cid))) fail("namespace_actual_operation_changed");
    [o.registered_ms, o.issued_ms, o.close_ms].forEach(tick);
    if (o.registered_ms < r.started_monotonic_ms || o.issued_ms < o.registered_ms || o.close_ms < o.issued_ms
      || o.close_ms > completed || o.close_ms >= r.total_deadline_ms) fail("namespace_actual_operation_timing");
    const out = original(o.stdout_original_base64, o.stdout_sha256, o.stdout);
    original(o.stderr_original_base64, o.stderr_sha256, o.stderr);
    if (o.stderr !== "") fail("namespace_actual_stderr");
    if (o.kind === "engine-info") normalizeOwnedNamespaceEngine(plan, out);
    else if (o.kind === "inspect-cid" || o.kind === "inspect-name") normalizeOwnedNamespaceInspection(plan, out, s.cid);
    else if (["create", "stop", "stop-after-late-start", "remove"].includes(o.kind)) {
      if (o.stdout !== s.cid + "\n") fail("namespace_actual_CID_response");
    } else if (o.kind === "wait") {
      if (o.stdout !== "0\n") fail("namespace_actual_wait_response");
    } else if (o.kind === "start") {
      if (start || (o.stdout !== "" && !o.stdout.endsWith("\n"))) fail("namespace_actual_start_originals");
      start = o;
    } else fail("namespace_actual_fixed_operation");
    if (o.kind !== "engine-info") kinds.push(o.kind);
  }
  if (!start || kinds[0] !== "create" || kinds.at(-1) !== "remove"
    || kinds.filter(k => k === "create" || k === "start" || k === "wait" || k === "remove").length !== 4
    || kinds.filter(k => k === "stop").length !== 1 || kinds.filter(k => k === "stop-after-late-start").length > 1
    || kinds.indexOf("start") > kinds.indexOf("stop") || kinds.indexOf("stop") > kinds.indexOf("wait")
    || !kinds.slice(1, kinds.indexOf("start")).includes("inspect-cid")) fail("namespace_actual_operation_order");
  replaySettlementDAG(s.operations);
  const lines = start.stdout === "" ? [] : start.stdout.slice(0, -1).split("\n").map(line => json(Buffer.from(line)));
  const hello = lines.filter(m => m.type === "HELLO");
  const armed = lines.filter(m => m.type === "ARMED");
  const payload = lines.filter(m => m.type === "PAYLOAD_CLOSE_CANDIDATE");
  for (const m of lines) {
    if (m.type === "HELLO" || m.type === "ARMED") {
      record(m, ["type", "case_id", "nonce", "tau0_ms"]);
      if (m.case_id !== r.case_id || m.nonce !== r.nonce || !Number.isFinite(m.tau0_ms) || m.tau0_ms < 0)
        fail("namespace_actual_init_identity");
    } else if (m.type === "PAYLOAD_CLOSE_CANDIDATE") {
      record(m, ["type", "code", "signal", "stream_close_observed"]);
      if (m.code !== 0 || m.signal !== null || m.stream_close_observed !== true) fail("namespace_actual_payload_close");
    } else if (m.type === "FIRST_PARTY_NORMAL_CANDIDATE") {
      record(m, ["type", "qualified"]); if (m.qualified !== false) fail("namespace_actual_payload_claim");
    } else fail("namespace_actual_init_record");
  }
  const normal = r.control === "normal";
  if (r.control === "late-detached-orphan") fail("namespace_late_orphan_observation_UNPROVED");
  const expectedFrames = normal ? ["HELLO", "ARMED", "FIRST_PARTY_NORMAL_CANDIDATE", "PAYLOAD_CLOSE_CANDIDATE"]
    : s.armed ? ["HELLO", "ARMED"] : hello.length ? ["HELLO"] : [];
  if (!equal(lines.map(m => m.type), expectedFrames)) fail("namespace_actual_init_transcript_order");
  if (normal) {
    if (s.worker_lost !== false || s.worker_loss_phase !== null || s.armed !== true || s.work_issued !== true
      || s.aborted !== false || !equal(s.events, []) || hello.length !== 1 || armed.length !== 1 || payload.length !== 1)
      fail("namespace_actual_normal_incomplete");
  } else if (s.worker_lost !== true || s.aborted !== true || s.work_issued !== false || payload.length
    || s.worker_loss_phase !== (r.control === "worker-loss-before-init" ? "pending-start-before-init" : "after-arm")
    || s.armed !== (r.control === "worker-loss-after-arm") || (s.armed ? armed.length !== 1 || hello.length !== 1 : armed.length !== 0))
    fail("namespace_actual_loss_control_missing");
  const w = record(s.worker, ["role", "executable", "argv", "authority", "closed", "streams_settled", "exit_code", "signal"]);
  const authorityHandle = handle(w.authority);
  if (authorityHandle.path !== r.root + "/worker-authority.json") fail("namespace_actual_worker_scope");
  const authority = snapshot(authorityHandle);
  const a = record(authority.value, ["schema", "request", "request_file", "source_sha256", "owner", "cid", "custody"]);
  if (a.schema !== "airlock.owned-namespace-worker-authority.v2" || a.owner !== "S" || !equal(a.request, r)
    || !equal(a.request_file, requestHandle) || a.source_sha256 !== p.source_sha256 || a.cid !== s.cid
    || !equal(a.custody, s.custody) || w.role !== "W" || w.executable !== process.execPath
    || !equal(w.argv, [W_FILE, "--namespace-worker", authorityHandle.path, authorityHandle.sha256])
    || w.closed !== true || w.streams_settled !== true || w.signal !== null || w.exit_code !== (normal ? 0 : 2))
    fail("namespace_actual_worker_incomplete");
  if (!Array.isArray(s.continuations) || s.continuations.length !== (normal ? 2 : s.armed ? 1 : 0))
    fail("namespace_actual_permit_count");
  for (const [n, item] of s.continuations.entries()) {
    const c = record(item, ["id", "owner", "kind", "operation", "cid", "original_work_deadline_ms", "original_total_deadline_ms",
      "message", "registered_ms", "after_init_frame", "wire_base64", "wire_sha256", "issued_ms", "settled", "error"]);
    if (c.id !== n + 1 || c.owner !== "S" || c.operation !== start.id || c.cid !== s.cid || c.settled !== true || c.error !== null
      || c.original_work_deadline_ms !== r.work_deadline_ms || c.original_total_deadline_ms !== r.total_deadline_ms
      || c.registered_ms < start.issued_ms || c.issued_ms < c.registered_ms || c.issued_ms > start.close_ms
      || c.issued_ms >= r.work_deadline_ms
      || (n > 0 && c.registered_ms < s.continuations[n - 1].issued_ms)
      || !Number.isFinite(c.registered_ms) || !Number.isFinite(c.issued_ms)) fail("namespace_actual_permit_unsettled");
    const m = record(c.message, n === 0 ? ["type", "case_id", "nonce", "tau0_ms", "work_remaining_ms",
      "total_remaining_ms", "clock_evidence_sha256"] : ["type", "case_id", "nonce", "tau0_ms", "control"]);
    if (c.kind !== (n === 0 ? "ARM" : "WORK") || m.type !== c.kind || m.case_id !== r.case_id || m.nonce !== r.nonce
      || m.tau0_ms !== hello[0]?.tau0_ms || armed[0]?.tau0_ms !== hello[0]?.tau0_ms) fail("namespace_actual_permit_identity");
    if (c.after_init_frame !== n + 1) fail("namespace_actual_permit_causality");
    original(c.wire_base64, c.wire_sha256, JSON.stringify(data(c.message)) + "\n");
    if (n === 0 ? !Number.isSafeInteger(m.work_remaining_ms) || m.work_remaining_ms <= 0
      || !Number.isSafeInteger(m.total_remaining_ms) || m.total_remaining_ms <= m.work_remaining_ms
      || m.total_remaining_ms > TOTAL_MS || m.clock_evidence_sha256 !== p.prepared_identity.clock_bounds.evidence_sha256
      : m.control !== r.control) fail("namespace_actual_permit_bound");
    if (n === 0 && !equal(m, conservativeArm({
      case_id: r.case_id, nonce: r.nonce, tau0_ms: hello[0].tau0_ms, now_ms: c.registered_ms,
      work_deadline_ms: r.work_deadline_ms, total_deadline_ms: r.total_deadline_ms,
      clock: p.prepared_identity.clock_bounds,
    }))) fail("namespace_actual_original_conservative_budget");
  }
  return authorityHandle;
}
export function inspectOwnedNamespaceCompletion(plan, value) {
  const denied = reason => ({ qualified: false, external_completion_valid: false, source_execution_evidence_valid: false,
    source_model_evidence_valid: false, runtime_provenance_qualified: false, sdk_absent: true, native_authority: false, reason });
  try {
    const v = record(data(value), ["completion"]);
    if (v.completion === null) return denied("namespace_external_completion_missing");
    const p = namespacePlanEvidence(plan), root = p.prepared_identity.root.path;
    const handles = [], read = (raw, path) => {
      const h = handle(raw);
      if (h.path !== path) fail("namespace_actual_artifact_scope");
      const result = snapshot(h); handles.push(h); return result.value;
    };
    const e = record(read(v.completion, root + "/external-completion.json"),
      ["schema", "observer_scope", "command", "case_id", "source_sha256", "cohort_sha256", "exit_observed", "actual_exit_code",
        "signal", "timed_out", "started_monotonic_ms", "completed_monotonic_ms", "publication_closed_monotonic_ms",
        "observer_streams_settled", "observer_queries_settled", "supervisor_lost", "p_output", "errors", "scope", "qualified"]);
    if (e.schema !== "airlock.owned-namespace-whole-command-completion.v2" || e.observer_scope !== "external-whole-P-command-after-close"
      || e.scope !== "UNQUALIFIED_SOURCE_EXECUTOR" || e.qualified !== false || e.exit_observed !== true || e.actual_exit_code !== 0
      || e.signal !== null || e.timed_out !== false || e.observer_streams_settled !== true || e.observer_queries_settled !== true
      || e.supervisor_lost !== false || !equal(e.errors, []) || e.case_id !== p.case_id || e.source_sha256 !== p.source_sha256
      || e.cohort_sha256 !== p.cohort_sha256) fail("namespace_actual_external_command_failed");
    [e.started_monotonic_ms, e.completed_monotonic_ms, e.publication_closed_monotonic_ms].forEach(tick);
    if (e.completed_monotonic_ms < e.started_monotonic_ms || e.completed_monotonic_ms - e.started_monotonic_ms >= TOTAL_MS
      || e.publication_closed_monotonic_ms < e.started_monotonic_ms || e.publication_closed_monotonic_ms > e.completed_monotonic_ms)
      fail("namespace_external_original_45s_fence");
    const output = record(read(e.p_output, root + "/p-output.json"), ["qualified", "S_close_candidate", "errors", "timed_out",
      "external_whole_command_completion_required", "actual_exit_code", "signal", "sdk_absent", "native_authority"]);
    if (output.qualified !== false || !equal(output.errors, []) || output.timed_out !== false
      || output.external_whole_command_completion_required !== true || output.actual_exit_code !== 0 || output.signal !== null
      || output.sdk_absent !== true || output.native_authority !== false) fail("namespace_actual_P_output_failed");
    const sc = record(read(output.S_close_candidate, root + "/p-s-close-candidate.json"),
      ["schema", "observer_scope", "whole_command_candidate", "supervisor_command", "request", "started_monotonic_ms",
        "completed_monotonic_ms", "actual_exit_code", "signal", "exit_observed", "observer_streams_settled", "timed_out", "candidate",
        "source_sha256", "cohort_sha256", "errors", "qualified", "external_whole_command_completion_required"]);
    if (sc.schema !== "airlock.owned-namespace-P-observed-S-close-candidate.v2"
      || sc.observer_scope !== "P-observed-S-close-only-NOT-whole-P-command-completion" || sc.actual_exit_code !== 0 || sc.signal !== null
      || sc.exit_observed !== true || sc.observer_streams_settled !== true || sc.timed_out !== false || !equal(sc.errors, [])
      || sc.qualified !== false || sc.external_whole_command_completion_required !== true || sc.source_sha256 !== p.source_sha256
      || sc.cohort_sha256 !== p.cohort_sha256 || sc.started_monotonic_ms !== e.started_monotonic_ms
      || !Number.isFinite(sc.completed_monotonic_ms) || sc.completed_monotonic_ms < sc.started_monotonic_ms
      || sc.completed_monotonic_ms > e.publication_closed_monotonic_ms) fail("namespace_actual_S_close_failed");
    const rh = handle(sc.request), r = request(read(rh, root + "/launch-request.json"), p, e.started_monotonic_ms);
    const command = ownedNamespaceWholeCommand(plan, r.control);
    if (!equal(e.command, command) || !equal(sc.whole_command_candidate, command)
      || !equal(sc.supervisor_command, [process.execPath, S_FILE, "--namespace-supervisor", rh.path, rh.sha256]))
      fail("namespace_actual_command_mismatch");
    const ledger = read(sc.candidate, root + "/case/actor-result.json");
    handles.push(actualLedger(ledger, p, r, rh, plan, sc.completed_monotonic_ms));
    for (const h of handles) snapshot(h);
    namespacePlanEvidence(plan);
    return { ...denied(ownedNamespaceReadiness().reason), source_execution_evidence_valid: true, external_completion_valid: true,
      clock_provenance: "UNPROVED" };
  } catch (e) { return denied(e.message); }
}
