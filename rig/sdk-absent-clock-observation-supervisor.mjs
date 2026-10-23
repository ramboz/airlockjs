import process from "node:process";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { equal, record } from "./inspected-meta-record.mjs";
import { fail, observationSnapshot, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence } from "./sdk-absent-clock-observation-plan.mjs";
import { clockState, finishActor, loadActor, ns, receiveBudget, remaining, revalidateObservationRequest, sample } from "./sdk-absent-clock-observation-protocol.mjs";
import { collectObservationChild } from "./sdk-absent-clock-observation-streams.mjs";
import { clockObservationDockerArgv, normalizeObservationEngine, normalizeObservationInspection, observationText } from "./sdk-absent-clock-observation-wire.mjs";
import { requireClockObservationRuntime } from "./sdk-absent-clock-observation-admission.mjs";

function ownedOperationOriginals(s) {
  revalidateObservationRequest(s.plan, "S", s.binding, s.request_file);
  for (const op of s.ops) {
    observationSnapshot(op.registration, s.p.uid);
    if (op.closed) observationSnapshot(op.closed, s.p.uid);
  }
  if (s.custody !== null) {
    const c = record(observationSnapshot(s.custody, s.p.uid).value, [
      "schema", "owner", "binding", "cid", "engine", "image_id", "endpoint",
      "create_registration", "inspection", "request_file", "acquired_ns"]);
    const create = s.ops.find(op => op.kind === "create");
    const inspection = s.ops.find(op => op.kind === "inspect" && equal(op.closed, c.inspection));
    if (s.custody.path !== s.p.root + "/s-custody.json" || c.schema !== "airlock.clock-observation-S-custody.v1"
      || c.owner !== "S" || !s.cid || c.cid !== s.cid || !equal(c.binding, s.binding)
      || !equal(c.engine, s.p.engine) || c.image_id !== s.p.image_id || c.endpoint !== s.p.endpoint
      || !equal(c.request_file, s.request_file) || !equal(c.create_registration, create?.registration)
      || !inspection || inspection.parsed?.Id !== s.cid) fail("observation_exact_custody_changed_at_effect");
    ns(c.acquired_ns);
  }
}
function issue(s, kind) {
  const p = clockObservationPlanEvidence(s.plan), stamp = sample(s.clock);
  remaining(s, stamp);
  if (s.ops.length >= 32) fail("observation_S_operation_bound");
  if (!["engine", "create", "inspect-name", "inspect"].includes(kind)) {
    if (!s.cid || !s.custody) fail("observation_durable_exact_custody_required");
    observationSnapshot(s.custody, p.uid);
  }
  const id = s.ops.length + 1;
  const command = { executable: "/usr/local/bin/docker", executable_sha256: p.client.sha256,
    argv: clockObservationDockerArgv(p, s.binding, kind, s.cid), env: {
      HOME: p.root + "/empty-home", DOCKER_CONFIG: p.root + "/docker-config", DOCKER_HOST: p.endpoint,
      PATH: "/usr/local/bin:/usr/bin:/bin",
    }, cwd: p.root + "/empty-home", shell: false, stdio: ["pipe", "pipe", "pipe"] };
  const op = { id, kind, registration: null, closed: null, parsed: null };
  s.ops.push(op); // Real S custody of the pending operation BEFORE issue.
  op.registration = observationWrite(p.root, "s-op-" + id + "-registered.json", {
    schema: "airlock.clock-observation-S-registration.v1", owner: "S", id, kind, binding: s.binding,
    cid: s.cid, custody: s.custody, domain: "NODE_S_HRTIME_MONOTONIC_NS", unit: "ns",
    registered_ns: stamp, command, request_file: s.request_file,
    depends_on: s.ops.filter(o => o.closed).map(o => ({ id: o.id, receipt: o.closed })),
  }, p.uid);
  clockObservationPlanEvidence(s.plan); requireClockObservationRuntime();
  ownedOperationOriginals(s);
  const issued = sample(s.clock); remaining(s, issued);
  const child = spawn(command.executable, command.argv, { env: command.env, cwd: command.cwd,
    shell: false, windowsHide: true, stdio: command.stdio });
  const watch = collectObservationChild(child, s.clock);
  child.stdin.end();
  op.done = watch.done.then(close => {
    try {
      remaining(s, close.actual_close_ns); remaining(s, close.streams_settled_ns);
      clockObservationPlanEvidence(s.plan);
    } catch (e) { close.errors.push(e.message); }
    op.closed = observationWrite(p.root, "s-op-" + id + "-closed.json", {
      schema: "airlock.clock-observation-S-close.v1", registration: op.registration, issued_ns: issued,
      daemon: close.errors.length ? "UNKNOWN" : "SETTLED", close,
    }, p.uid);
    s.errors.push(...close.errors);
    const stdout = Buffer.from(close.output.stdout.base64, "base64");
    if (close.output.stderr.branch !== "EXPLICIT_EMPTY_NO_FRAMES") s.errors.push("observation_backend_stderr");
    return { op, close, stdout };
  });
  op.done.catch(e => s.errors.push("observation_pending_operation_UNKNOWN:" + e.message));
  return op;
}
async function engine(s) {
  const r = await issue(s, "engine").done;
  if (r.close.errors.length) fail("observation_engine_query_UNKNOWN");
  normalizeObservationEngine(s.p, r.stdout); return r;
}
async function checked(s, kind) {
  await engine(s);
  const r = await issue(s, kind).done;
  if (r.close.errors.length) fail("observation_operation_UNKNOWN:" + kind);
  return r;
}
async function inspect(s, byName = false) {
  const r = await checked(s, byName ? "inspect-name" : "inspect");
  r.op.parsed = normalizeObservationInspection(s.p, s.binding, r.stdout, byName ? null : s.cid);
  return r;
}
function exactReply(r, expected) {
  if (observationText(r.stdout) !== expected + "\n") fail("observation_exact_command_reply");
}
function bindCustody(s, r) {
  if (s.cid && s.cid !== r.op.parsed.Id) fail("observation_CID_substitution");
  s.cid = r.op.parsed.Id;
  s.custody = observationWrite(s.p.root, "s-custody.json", {
    schema: "airlock.clock-observation-S-custody.v1", owner: "S", binding: s.binding,
    cid: s.cid, engine: s.p.engine, image_id: s.p.image_id, endpoint: s.p.endpoint,
    create_registration: s.ops.find(o => o.kind === "create").registration,
    inspection: r.op.closed, request_file: s.request_file, acquired_ns: sample(s.clock),
  }, s.p.uid);
}
async function allocate(s) {
  const create = await checked(s, "create");
  const text = observationText(create.stdout);
  if (!/^[a-f0-9]{64}\n$/.test(text)) fail("observation_create_CID_missing");
  s.cid = text.slice(0, -1);
  const boot = await inspect(s);
  if (boot.op.parsed.State.Status !== "created") fail("observation_prestart_state");
  bindCustody(s, boot);
}
async function cleanup(s, start) {
  if (!s.custody) return;
  const stop = await checked(s, "stop"); exactReply(stop, s.cid);
  // Client close is NOT cancellation. Keep the original pending start owned,
  // then inspect AFTER its actual stream/exit settlement for a late start.
  if (start) await start.done;
  let after = await inspect(s);
  if (after.op.parsed.State.Status === "running") {
    const again = await checked(s, "stop-after-late-start"); exactReply(again, s.cid);
    after = await inspect(s);
  }
  if (after.op.parsed.State.Status !== "exited") fail("observation_cleanup_state_UNKNOWN");
  const waited = await checked(s, "wait"); exactReply(waited, "0");
  if (s.ops.some(o => !o.closed)) fail("observation_remove_with_pending_operation");
  const removed = await checked(s, "remove"); exactReply(removed, s.cid);
  await engine(s);
}
export async function runClockObservationSupervisor(argv) {
  const clock = clockState("S"), tau0 = sample(clock);
  const s = await receiveBudget(loadActor(argv, "S", clock, tau0));
  Object.assign(s, { ops: [], cid: null, custody: null });
  let start = null;
  try {
    await allocate(s);
    await engine(s);
    start = issue(s, "start");
    let timer;
    const guard = new Promise(resolveGuard => {
      timer = setTimeout(() => { s.errors.push("observation_init_window_elapsed_NOT_cancellation"); resolveGuard(); },
        Number((remaining(s, sample(clock)) < 2000000000n ? remaining(s, sample(clock)) : 2000000000n) / 1000000n));
    });
    await Promise.race([start.done, guard]); clearTimeout(timer);
  } catch (e) {
    s.errors.push(e.message);
    // Only the exact preissued name may recover a failed CREATE. No global
    // inventory, guessed PID or foreign cleanup is ever requested.
    if (!s.custody && s.ops.some(o => o.kind === "create")) {
      try { bindCustody(s, await inspect(s, true)); } catch (recovery) { s.errors.push("observation_create_recovery_UNKNOWN:" + recovery.message); }
    }
  }
  try { await cleanup(s, start); } catch (e) { s.errors.push("observation_cleanup_UNKNOWN:" + e.message); }
  const operations = s.ops.map(o => ({ id: o.id, kind: o.kind, registration: o.registration, closed: o.closed }));
  if (!start || operations.some(o => !o.closed)) s.errors.push("observation_operations_unsettled");
  // Sample only this domain. There is no guest/host rate or epoch inference.
  ns(sample(clock));
  return finishActor(s, { owner: "S", cid: s.cid, custody: s.custody, operations,
    disposition: s.errors.length ? "UNKNOWN" : "SOURCE_SETTLED_CANDIDATE" });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockObservationSupervisor(process.argv.slice(2)).catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
