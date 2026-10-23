// Fixed S owns every Docker client, CID, deadline and continuation. W owns no
// Docker handle. No effects on import, no selectable executor or signal API.
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { atomicPrivateWrite, digest, fail, fixedRead, freeze, hash } from "./sdk-absent-owned-namespace-io.mjs";
import { namespacePlanEvidence, prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";
import { conservativeArm, TOTAL_MS, WORK_MS } from "./sdk-absent-owned-namespace-time.mjs";
import { namespaceAdapterContract, normalizeOwnedNamespaceEngine,
  normalizeOwnedNamespaceInspection, ownedNamespaceDockerArgv } from "./sdk-absent-owned-namespace-wire.mjs";
import { requireOwnedNamespaceRuntimeAdmission } from "./sdk-absent-owned-namespace-admission.mjs";

const WORKER = fileURLToPath(new URL("sdk-absent-owned-namespace-worker.mjs", import.meta.url));
const actors = new WeakMap(), LIMIT = 16384;
const copy = value => JSON.parse(JSON.stringify(data(value)));
export const ownedNamespaceHostNow = () => Number(process.hrtime.bigint() / 1000000n);
export function readOwnedNamespaceLaunchRequest(value) {
  const v = record(data(value), ["request_path", "request_sha256"]);
  if (!digest(v.request_sha256) || typeof v.request_path !== "string") fail("namespace_launch_locator");
  const read = fixedRead(v.request_path, { maximum: 16384 }), r = record(json(read.bytes),
    ["schema", "case_id", "nonce", "root", "control", "clock_domain", "started_monotonic_ms",
      "work_deadline_ms", "total_deadline_ms", "source_sha256", "cohort_sha256"]);
  if (read.handle.sha256 !== v.request_sha256 || r.schema !== "airlock.owned-namespace-launch-request.v2"
    || r.clock_domain !== "NODE_HOST_HRTIME_MONOTONIC" || v.request_path !== r.root + "/launch-request.json"
    || !["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"].includes(r.control)
    || !Number.isSafeInteger(r.started_monotonic_ms) || r.started_monotonic_ms < 0
    || r.work_deadline_ms !== r.started_monotonic_ms + WORK_MS
    || r.total_deadline_ms !== r.started_monotonic_ms + TOTAL_MS) fail("namespace_original_launch_request");
  const plan = prepareOwnedNamespacePlan({ case_id: r.case_id, nonce: r.nonce, root: r.root });
  const p = namespacePlanEvidence(plan);
  if (r.source_sha256 !== p.source_sha256 || r.cohort_sha256 !== p.cohort_sha256
    || !equal(fixedRead(v.request_path, { maximum: 16384, privateUid: p.prepared_identity.root.uid }).handle, read.handle))
    fail("namespace_launch_lease_changed");
  return { plan, request: freeze(r), request_file: read.handle };
}
function error(s, reason) {
  if (!s.errors.includes(reason) && s.errors.length < 32) s.errors.push(reason);
}
function now(s, forWork = false) {
  const n = ownedNamespaceHostNow();
  if (!Number.isSafeInteger(n) || n < s.last) { error(s, "host_monotonic_clock_reversed"); fail("namespace_host_clock"); }
  s.last = n;
  if (n >= (forWork ? s.request.work_deadline_ms : s.request.total_deadline_ms)) {
    error(s, forWork ? "original_work_fence_expired" : "original_total_fence_expired");
    fail("namespace_original_deadline_expired");
  }
  return n;
}
function snapshot(s) {
  return { schema: "airlock.owned-namespace-S-ledger.v2", qualified: false, scope: "UNQUALIFIED_SOURCE_EXECUTOR",
    request: s.request, request_file: s.requestFile, source_sha256: s.p.source_sha256,
    retained_preparation: s.p.prepared_identity, owner: "S", actor: s.actor, cid: s.cid, custody: s.custody,
    custody_durable: s.custodyDurable, phase: s.phase, worker: s.workerRecord, worker_lost: s.workerLost,
    worker_loss_phase: s.workerLossPhase, armed: s.armed, work_issued: s.workIssued, aborted: s.aborted,
    operations: s.ops, continuations: s.continuations, errors: s.errors, events: s.events,
    disposition: s.finished ? s.finalDisposition : "UNKNOWN", original_total_deadline_ms: s.request.total_deadline_ms };
}
function persist(s, name, extra = {}) {
  if (++s.publications > 128) fail("namespace_S_publication_bound");
  try {
    return atomicPrivateWrite(s.request.root, name, { ...snapshot(s), ...extra }, s.p.prepared_identity.root.uid);
  } catch (e) { error(s, "durable_S_publication_failed:" + e.message); s.fsFailed = true; throw e; }
}
function failureReceipt(s, reason) {
  error(s, reason);
  try { persist(s, "s-failure-" + (++s.failureReceipts) + ".json"); } catch { /* The original pending record remains UNKNOWN. */ }
}
function env(s) {
  return { HOME: s.request.root + "/empty-home", DOCKER_CONFIG: s.request.root + "/docker-config",
    DOCKER_HOST: s.p.endpoint, PATH: "/usr/local/bin:/usr/bin:/bin" };
}
function argv(s, kind) {
  if (["start", "stop", "stop-after-late-start", "wait", "remove"].includes(kind)
    && (!digest(s.cid) || !s.custodyDurable)) fail("namespace_S_exact_custody_required");
  return ownedNamespaceDockerArgv(s.plan, kind, s.cid);
}
function issue(s, kind, onLine = null) {
  now(s, kind === "create" || kind === "start");
  namespacePlanEvidence(s.plan);
  if (s.fsFailed || s.ops.length >= 40) fail("namespace_S_operation_bound_or_durability");
  const op = { id: s.ops.length + 1, kind, owner: "S", cid: s.cid, endpoint: s.p.endpoint, engine_id: s.p.engine_id,
    executable: s.p.prepared_identity.client.path, executable_sha256: s.p.prepared_identity.client.sha256, argv: argv(s, kind),
    env: env(s), registered_ms: now(s), issued_ms: null, close_ms: null, daemon: "PENDING", client_closed: false,
    streams_settled: false, exit_code: null, signal: null, stdout: "", stderr: "", errors: [] };
  s.ops.push(op);
  // This fsynced original is BEFORE spawn, including when W is already lost.
  persist(s, "s-op-" + op.id + "-registered.json");
  namespacePlanEvidence(s.plan);
  if ((kind === "create" || kind === "start") && (s.workerLost || s.aborted)) fail("namespace_work_no_longer_permitted");
  now(s, kind === "create" || kind === "start");
  let resolveDone, rejectDone;
  const client = { op, child: null, close: false, outputEnded: false, errorEnded: false,
    outputClosed: false, errorClosed: false, inputClosed: false, writes: 0, buffer: "", settled: false,
    stdoutOriginals: [], stderrOriginals: [] };
  client.promise = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  // Register S's client object before creating the OS child.
  s.clients.add(client);
  const settle = () => {
    if (client.settled || !client.close || !client.outputClosed || !client.errorClosed || !client.inputClosed || client.writes)
      return;
    client.settled = true;
    op.client_closed = true; op.streams_settled = true; op.close_ms = ownedNamespaceHostNow();
    op.stdout_original_base64 = Buffer.concat(client.stdoutOriginals).toString("base64");
    op.stderr_original_base64 = Buffer.concat(client.stderrOriginals).toString("base64");
    op.stdout_sha256 = hash(Buffer.concat(client.stdoutOriginals)); op.stderr_sha256 = hash(Buffer.concat(client.stderrOriginals));
    if (!client.outputEnded || !client.errorEnded) op.errors.push("stream_closed_without_complete_EOF");
    if (kind === "start" && client.buffer.length) op.errors.push("truncated_init_protocol_line");
    if (op.close_ms >= s.request.total_deadline_ms) op.errors.push("client_close_after_original_deadline");
    const absent = kind === "inspect-name" && op.exit_code === 1 && op.signal === null
      && op.stdout === "" && op.stderr === "Error: No such container: airlock-owned-" + s.request.case_id + "\n";
    if (absent) op.negative_reply = "exact_preissued_name_absent";
    if ((op.exit_code !== 0 && !absent) || op.signal !== null) op.errors.push("client_loss_is_not_daemon_cancellation");
    if (op.errors.length) {
      op.daemon = "UNKNOWN"; error(s, "operation_UNKNOWN:" + kind);
    } else op.daemon = "SETTLED";
    try { persist(s, "s-op-" + op.id + "-closed.json"); } catch (e) { op.errors.push(e.message); op.daemon = "UNKNOWN"; }
    if (op.daemon === "SETTLED" && absent) rejectDone(Error("namespace_exact_preissued_name_absent"));
    else if (op.daemon === "SETTLED") resolveDone(client);
    else rejectDone(Error("namespace_daemon_operation_UNKNOWN:" + kind));
  };
  const capture = (which, bytes) => {
    if (client.settled) return;
    const text = Buffer.from(bytes).toString("utf8");
    if (Buffer.byteLength(op.stdout) + Buffer.byteLength(op.stderr) + Buffer.byteLength(text) > LIMIT) {
      op.errors.push("output_bound"); error(s, "bounded_client_output_exceeded");
      client.child.stdout.destroy(); client.child.stderr.destroy();
      return;
    }
    client[which === "stdout" ? "stdoutOriginals" : "stderrOriginals"].push(Buffer.from(bytes));
    op[which] += text;
    if (which === "stdout" && onLine) {
      client.buffer += text;
      let pos;
      while ((pos = client.buffer.indexOf("\n")) >= 0) {
        const line = client.buffer.slice(0, pos); client.buffer = client.buffer.slice(pos + 1);
        if (Buffer.byteLength(line) > 4096) { op.errors.push("protocol_line_bound"); abort(s, "init_protocol_bound"); return; }
        s.protocol = s.protocol.then(() => onLine(line)).catch(e => abort(s, e.message));
      }
    }
  };
  client.settle = settle;
  try {
    // Publication is blocking: retain the registration, but reacquire the
    // immutable source/client/config lease at the actual invocation boundary.
    namespacePlanEvidence(s.plan);
    const issued = now(s, kind === "create" || kind === "start");
    if ((kind === "create" || kind === "start") && (s.workerLost || s.aborted))
      fail("namespace_work_no_longer_permitted");
    op.issued_ms = issued;
    client.child = spawn(op.executable, op.argv, { env: op.env, shell: false, windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"], cwd: s.request.root + "/empty-home" });
    for (const [stream, ended, closed, which] of [
      [client.child.stdout, "outputEnded", "outputClosed", "stdout"],
      [client.child.stderr, "errorEnded", "errorClosed", "stderr"],
    ]) {
      stream.on("data", bytes => capture(which, bytes));
      stream.on("end", () => { client[ended] = true; });
      stream.on("error", () => { op.errors.push(which + "_stream_error"); });
      stream.on("close", () => { client[closed] = true; settle(); });
    }
    client.child.stdin.on("error", () => { op.errors.push("stdin_stream_error"); });
    client.child.stdin.on("close", () => { client.inputClosed = true; settle(); });
    client.child.on("error", () => { op.errors.push("client_error_not_cancellation"); });
    client.child.on("close", (code, signal) => {
      client.close = true; op.exit_code = code; op.signal = signal;
      if (!client.inputClosed) client.child.stdin.destroy();
      // Destruction settles owned streams, but missing EOF stays UNKNOWN.
      if (!client.outputClosed) client.child.stdout.destroy();
      if (!client.errorClosed) client.child.stderr.destroy();
      settle();
    });
    if (kind !== "start") client.child.stdin.end();
  } catch (e) {
    op.daemon = "UNKNOWN"; op.errors.push("spawn_failed:" + e.message); client.settled = true;
    failureReceipt(s, "client_creation_unknown:" + kind); rejectDone(e);
  }
  // Observe rejection immediately, including a client that closes before its
  // caller reaches await. The original promise remains rejecting.
  client.promise.catch(() => {});
  return client;
}
async function engine(s) {
  const client = await issue(s, "engine-info").promise;
  normalizeOwnedNamespaceEngine(s.plan, Buffer.from(client.op.stdout));
  return client;
}
async function checked(s, kind) {
  await engine(s);
  const client = await issue(s, kind).promise;
  await engine(s);
  return client;
}
async function inspect(s, byName = false) {
  const client = await checked(s, byName ? "inspect-name" : "inspect-cid");
  return normalizeOwnedNamespaceInspection(s.plan, Buffer.from(client.op.stdout), byName ? null : s.cid);
}
function bind(s, custody) {
  if (s.cid !== null && custody.cid !== s.cid) fail("namespace_foreign_container");
  s.cid = custody.cid; s.custody = custody; s.custodyDurable = false;
  persist(s, "s-custody-" + (++s.bindings) + ".json");
  s.custodyDurable = true;
}
function ipc(s, message) {
  namespacePlanEvidence(s.plan);
  now(s, message.type !== "FINISH");
  if (!s.worker || !s.worker.connected || s.workerLost || (message.type !== "FINISH" && s.aborted))
    fail("namespace_owned_worker_disconnected");
  s.ipcPending++;
  s.worker.send(message, e => {
    s.ipcPending--;
    if (e) workerLoss(s, "worker_IPC_send_failed");
    maybeFinish(s);
  });
}
function workerMessage(s, raw) {
  try {
    const m = record(data(raw), ["type", "case_id", "nonce", "source_sha256"]);
    if (m.case_id !== s.request.case_id || m.nonce !== s.request.nonce || m.source_sha256 !== s.p.source_sha256)
      fail("namespace_foreign_worker_message");
    if (m.type === "READY" && !s.workerReady) { s.workerReady = true; return; }
    if (m.type === "REQUEST_START" && s.workerReady && !s.startRequested && !s.workerLost && !s.aborted) {
      s.startRequested = true; s.startFlow = startContainer(s).catch(e => abort(s, e.message)); return;
    }
    if (m.type === "REQUEST_WORK" && s.workerReady && s.armed && !s.workRequested
      && ["normal", "late-detached-orphan"].includes(s.request.control)) {
      s.workRequested = true;
      s.protocol = s.protocol.then(() => permit(s, { type: "WORK", case_id: s.request.case_id, nonce: s.request.nonce,
        tau0_ms: s.hello.tau0_ms, control: s.request.control })).catch(e => abort(s, e.message));
      return;
    }
    fail("namespace_worker_protocol_order");
  } catch (e) { abort(s, e.message); }
}
function workerLoss(s, reason) {
  if (s.workerExpectedExit || s.workerLost) return;
  s.workerLost = true;
  s.workerLossPhase = s.armed ? "after-arm" : s.startIssued && !s.hello ? "pending-start-before-init" : "before-arm";
  s.events.push({ type: "W_LOSS", phase: s.workerLossPhase, observed_ms: ownedNamespaceHostNow(), reason });
  const expected = s.request.control === "worker-loss-before-init" && s.workerLossPhase === "pending-start-before-init"
    || s.request.control === "worker-loss-after-arm" && s.workerLossPhase === "after-arm";
  if (!expected) error(s, "unexpected_worker_loss_phase");
  try { persist(s, "s-worker-loss.json"); } catch { /* Keep original S ownership. */ }
  abort(s, null);
}
function launchWorker(s) {
  now(s, true); namespacePlanEvidence(s.plan); requireOwnedNamespaceRuntimeAdmission(s.plan);
  if (!s.custodyDurable || s.aborted || s.workerLost) fail("namespace_worker_launch_without_custody");
  const authority = { schema: "airlock.owned-namespace-worker-authority.v2", request: s.request,
    request_file: s.requestFile, source_sha256: s.p.source_sha256, owner: "S", cid: s.cid, custody: s.custody };
  const file = atomicPrivateWrite(s.request.root, "worker-authority.json", authority, s.p.prepared_identity.root.uid);
  s.workerRecord = { role: "W", executable: process.execPath, argv: [WORKER, "--namespace-worker", file.path, file.sha256],
    authority: file, closed: false, streams_settled: false, exit_code: null, signal: null };
  persist(s, "s-worker-registered.json");
  namespacePlanEvidence(s.plan);
  now(s, true);
  if (!s.custodyDurable || s.workerLost || s.aborted || s.fsFailed) fail("namespace_worker_launch_without_custody");
  s.worker = spawn(process.execPath, s.workerRecord.argv, { env: { HOME: s.request.root + "/empty-home",
    PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_ROLE: "W" }, shell: false, windowsHide: true,
  stdio: ["ignore", "pipe", "pipe", "ipc"], cwd: s.request.root + "/empty-home" });
  let outClosed = false, errClosed = false, outEnded = false, errEnded = false, workerBytes = 0;
  const settled = () => {
    s.workerRecord.streams_settled = outClosed && errClosed;
    if (s.workerRecord.closed && outClosed && errClosed && (!outEnded || !errEnded)) error(s, "worker_stream_EOF_missing");
    maybeFinish(s);
  };
  for (const [stream, stdout] of [[s.worker.stdout, true], [s.worker.stderr, false]]) {
    stream.on("data", bytes => {
      workerBytes += bytes.length;
      if (workerBytes > LIMIT) { error(s, "worker_output_bound"); stream.destroy(); workerLoss(s, "worker_output_bound"); }
    });
    stream.on("end", () => { if (stdout) outEnded = true; else errEnded = true; });
    stream.on("close", () => { if (stdout) outClosed = true; else errClosed = true; settled(); });
    stream.on("error", () => workerLoss(s, "worker_stream_error"));
  }
  s.worker.on("message", message => workerMessage(s, message));
  s.worker.on("disconnect", () => workerLoss(s, "worker_disconnect"));
  s.worker.on("error", () => workerLoss(s, "worker_error"));
  s.worker.on("close", (code, signal) => {
    s.workerRecord.closed = true; s.workerRecord.exit_code = code; s.workerRecord.signal = signal;
    workerLoss(s, "worker_close");
    if (!outClosed) s.worker.stdout.destroy();
    if (!errClosed) s.worker.stderr.destroy();
    settled();
  });
  s.phase = "W_WAITING";
}
async function permit(s, message) {
  requireOwnedNamespaceRuntimeAdmission(s.plan);
  now(s, true); namespacePlanEvidence(s.plan);
  if (s.workerLost || s.aborted || !s.startClient || s.startClient.close || s.fsFailed) fail("namespace_permit_after_worker_or_client_loss");
  if (message.type === "WORK" && (!s.armed || s.workIssued)) fail("namespace_one_use_work");
  const registered = now(s, true);
  const outbound = message.type === "ARM" ? conservativeArm({
    case_id: message.case_id, nonce: message.nonce, tau0_ms: message.tau0_ms, now_ms: registered,
    work_deadline_ms: s.request.work_deadline_ms, total_deadline_ms: s.request.total_deadline_ms,
    clock: s.p.prepared_identity.clock_bounds,
  }) : message;
  const wire = Buffer.from(JSON.stringify(data(outbound)) + "\n");
  const c = { id: s.continuations.length + 1, owner: "S", kind: message.type, operation: s.startClient.op.id,
    cid: s.cid, original_work_deadline_ms: s.request.work_deadline_ms, original_total_deadline_ms: s.request.total_deadline_ms,
    message: outbound, registered_ms: registered, after_init_frame: s.initFrameCount,
    wire_base64: wire.toString("base64"), wire_sha256: hash(wire), issued_ms: null, settled: false, error: null };
  if (c.id > 2) fail("namespace_permit_once");
  s.continuations.push(c);
  persist(s, "s-permit-" + c.id + "-registered.json");
  namespacePlanEvidence(s.plan);
  now(s, true);
  if (s.workerLost || s.aborted || s.startClient.close || s.startClient.inputClosed || s.fsFailed)
    fail("namespace_permit_after_worker_loss");
  c.issued_ms = ownedNamespaceHostNow();
  s.startClient.writes++;
  await new Promise((resolve, reject) => s.startClient.child.stdin.write(wire, e => {
    s.startClient.writes--;
    c.settled = true; c.error = e ? String(e.message) : null;
    if (e) s.startClient.op.errors.push("control_write_failed");
    s.startClient.settle();
    if (e) reject(e); else resolve();
  }));
  persist(s, "s-permit-" + c.id + "-settled.json");
  if (message.type === "ARM") s.armWritten = true; else s.workIssued = true;
}
async function initLine(s, line) {
  const m = json(Buffer.from(line));
  s.initFrameCount++;
  if (m.type === "HELLO") {
    const v = record(m, ["type", "case_id", "nonce", "tau0_ms"]);
    if (s.hello || v.case_id !== s.request.case_id || v.nonce !== s.request.nonce || !Number.isFinite(v.tau0_ms) || v.tau0_ms < 0)
      fail("namespace_init_hello");
    s.hello = v;
    if (s.workerLost || s.aborted) { abort(s, null); return; }
    if (s.request.control === "worker-loss-before-init") {
      // A raced HELLO cannot be relabelled as loss before init existed.
      abort(s, "preinit_loss_control_missed_before_HELLO"); return;
    }
    await permit(s, { type: "ARM", case_id: v.case_id, nonce: v.nonce, tau0_ms: v.tau0_ms });
  } else if (m.type === "ARMED") {
    const v = record(m, ["type", "case_id", "nonce", "tau0_ms"]);
    if (!s.armWritten || s.armed || !equal(v, { ...s.hello, type: "ARMED" })) fail("namespace_init_armed");
    now(s, true);
    if (s.workerLost || s.aborted) { abort(s, null); return; }
    s.armed = true; ipc(s, { type: "ARMED", case_id: s.request.case_id, nonce: s.request.nonce, source_sha256: s.p.source_sha256 });
  } else if (m.type === "PAYLOAD_CLOSE_CANDIDATE") {
    const v = record(m, ["type", "code", "signal", "stream_close_observed"]);
    if (!s.workIssued || v.code !== 0 || v.signal !== null || v.stream_close_observed !== true) fail("namespace_payload_close_candidate");
    s.payloadCandidate = true;
  } else if (m.type === "FIRST_PARTY_NORMAL_CANDIDATE") {
    const v = record(m, ["type", "qualified"]);
    if (!s.workIssued || v.qualified !== false) fail("namespace_normal_payload_marker");
  } else fail("namespace_unrecognized_init_message");
}
async function startContainer(s) {
  if (s.aborted || s.workerLost) fail("namespace_start_after_W_loss");
  const custody = await inspect(s);
  if (custody.state.Status !== "created") fail("namespace_container_not_created");
  bind(s, custody);
  await engine(s);
  requireOwnedNamespaceRuntimeAdmission(s.plan); now(s, true);
  if (s.workerLost || s.aborted) fail("namespace_start_after_W_loss");
  s.startClient = issue(s, "start", line => initLine(s, line));
  s.startIssued = true; s.phase = "START_PENDING";
  if (s.request.control === "worker-loss-before-init") ipc(s, {
    type: "START_ISSUED", case_id: s.request.case_id, nonce: s.request.nonce, source_sha256: s.p.source_sha256,
  });
  // S owns this continuation even when W disappears before init/HELLO exists.
  s.startClient.promise.then(async () => {
    await s.protocol;
    await engine(s);
    if (!s.payloadCandidate && !s.workerLost) error(s, "payload_receipt_missing");
    await cleanup(s);
  }).catch(e => abort(s, e.message));
}
function abort(s, reason) {
  if (s.finished) return;
  if (reason) error(s, reason);
  s.aborted = true;
  if (s.worker && !s.workerLost && !s.workerExpectedExit) {
    s.workerExpectedExit = true;
    try { ipc(s, { type: "FINISH", case_id: s.request.case_id, nonce: s.request.nonce, source_sha256: s.p.source_sha256 }); }
    catch (e) { error(s, e.message); }
  }
  void cleanup(s).catch(e => failureReceipt(s, "cleanup_UNKNOWN:" + e.message));
}
async function cleanup(s) {
  if (s.cleanupPromise) return s.cleanupPromise;
  const attempt = (async () => {
    s.phase = "CLEANUP";
    if (s.startRequested && !s.startIssued && s.startFlow) await s.startFlow;
    if (!s.cid && s.createIssued && !s.nameRecoveryIssued) {
      s.nameRecoveryIssued = true;
      bind(s, await inspect(s, true));
    }
    if (!s.cid) { maybeFinish(s); return; }
    if (!s.custodyDurable) bind(s, await inspect(s));
    if (s.startIssued) {
      // Stopping once does NOT cancel or settle a still-pending start request.
      const firstStop = await checked(s, "stop");
      if (firstStop.op.stdout !== s.cid + "\n") fail("namespace_stop_response");
      const start = await s.startClient.promise.catch(() => null);
      if (!start) { failureReceipt(s, "original_start_remains_UNKNOWN"); return; }
      let observed = await inspect(s);
      if (observed.state.Running) {
        const lateStop = await checked(s, "stop-after-late-start");
        if (lateStop.op.stdout !== s.cid + "\n") fail("namespace_late_stop_response");
        observed = await inspect(s);
      }
      if (observed.state.Status !== "exited") fail("namespace_late_start_not_terminated");
      const wait = await checked(s, "wait");
      if (wait.op.stdout !== "0\n") fail("namespace_container_exit_failed");
    } else {
      const observed = await inspect(s);
      if (observed.state.Status !== "created") fail("namespace_unstarted_container_changed");
    }
    if (s.ops.some(o => o.daemon !== "SETTLED")) fail("namespace_pending_daemon_prevents_remove");
    const removed = await checked(s, "remove");
    if (removed.op.stdout !== s.cid + "\n") fail("namespace_remove_response");
    s.removed = true;
    if (s.worker && !s.workerLost && !s.workerExpectedExit) {
      s.workerExpectedExit = true;
      ipc(s, { type: "FINISH", case_id: s.request.case_id, nonce: s.request.nonce, source_sha256: s.p.source_sha256 });
    }
    maybeFinish(s);
  })();
  s.cleanupPromise = attempt;
  try { return await attempt; }
  finally {
    // Only coalesce in-flight cleanup. A later original create response must
    // still reach exact-CID cleanup after an earlier name recovery failed.
    if (s.cleanupPromise === attempt) s.cleanupPromise = null;
  }
}
function maybeFinish(s) {
  if (s.finished || !s.removed || s.fsFailed || s.ipcPending || s.continuations.some(c => !c.settled)
    || s.ops.some(o => o.daemon !== "SETTLED" || !o.client_closed || !o.streams_settled)
    || (s.workerRecord && (!s.workerRecord.closed || !s.workerRecord.streams_settled))) return;
  try {
    now(s);
    s.finalDisposition = s.errors.length ? "UNKNOWN" : "UNQUALIFIED_ACTOR_CANDIDATE";
    const result = atomicPrivateWrite(s.request.root + "/case", "actor-result.json",
      { ...snapshot(s), disposition: s.finalDisposition, sdk_absent: true, native_authority: false,
        mechanical_resources_settled: true }, s.p.prepared_identity.root.uid);
    now(s); namespacePlanEvidence(s.plan);
    s.finished = true; s.phase = "FINISHED";
    clearTimeout(s.workTimer); clearTimeout(s.totalTimer); clearInterval(s.retention);
    process.removeListener("disconnect", s.parentLost);
    s.resolve({ qualified: false, disposition: s.finalDisposition, file: result, ledger: copy(snapshot(s)) });
  } catch (e) { failureReceipt(s, "final_publication_UNKNOWN:" + e.message); }
}
async function boot(s) {
  try {
    await engine(s);
    s.createIssued = true;
    const created = await issue(s, "create").promise;
    if (!/^[a-f0-9]{64}\n$/.test(created.op.stdout)) fail("namespace_create_CID_response");
    s.cid = created.op.stdout.trim();
    persist(s, "s-cid-returned.json");
    await engine(s);
    bind(s, await inspect(s));
    if (s.aborted || s.workerLost) { void cleanup(s).catch(e => failureReceipt(s, e.message)); return; }
    launchWorker(s);
  } catch (e) { abort(s, e.message); }
}
export function namespaceActorSnapshot(handle) {
  const s = actors.get(handle);
  if (!s) fail("private_namespace_S_actor");
  return copy(snapshot(s));
}
export function namespaceActorCompletion(handle) {
  const s = actors.get(handle);
  if (!s) fail("private_namespace_S_actor");
  return s.completion;
}
export async function startOwnedNamespaceSupervisor(locator) {
  if (typeof process.send !== "function" || !process.connected || process.env.AIRLOCK_ROLE !== "S")
    fail("namespace_direct_S_entry_refused");
  const loaded = readOwnedNamespaceLaunchRequest(locator);
  requireOwnedNamespaceRuntimeAdmission(loaded.plan);
  namespaceAdapterContract(loaded.plan);
  const p = namespacePlanEvidence(loaded.plan), initial = ownedNamespaceHostNow();
  if (initial < loaded.request.started_monotonic_ms || initial >= loaded.request.work_deadline_ms) fail("namespace_original_launch_expired");
  let resolveCompletion;
  const s = { plan: loaded.plan, p, request: loaded.request, requestFile: loaded.request_file,
    actor: { role: "S", pid: process.pid, ppid: process.ppid, executable: process.execPath, started_monotonic_ms: initial },
    last: initial, phase: "S_OWNED_BEFORE_W", cid: null, custody: null, custodyDurable: false, bindings: 0,
    ops: [], clients: new Set(), continuations: [], ipcPending: 0, publications: 0, failureReceipts: 0,
    worker: null, workerRecord: null, workerReady: false, workerLost: false, workerLossPhase: null, workerExpectedExit: false,
    startRequested: false, startIssued: false, createIssued: false, nameRecoveryIssued: false, startClient: null,
    hello: null, initFrameCount: 0, armWritten: false, armed: false, workRequested: false, workIssued: false, payloadCandidate: false,
    aborted: false, fsFailed: false, removed: false, finished: false, errors: [], events: [], protocol: Promise.resolve(),
    finalDisposition: "UNKNOWN", completion: new Promise(resolve => { resolveCompletion = resolve; }), resolve: null };
  s.resolve = resolveCompletion;
  // Actual S has claimed its immutable request and original fences BEFORE its
  // first CLI client, before W exists, and before any start can be requested.
  persist(s, "s-owner.json");
  const h = Object.freeze(Object.create(null)); actors.set(h, s);
  s.parentLost = () => { failureReceipt(s, "external_observer_lost_not_S_handoff"); abort(s, null); };
  process.on("disconnect", s.parentLost);
  s.workTimer = setTimeout(() => abort(s, "original_work_fence_expired"),
    Math.max(0, s.request.work_deadline_ms - ownedNamespaceHostNow()));
  s.totalTimer = setTimeout(() => {
    s.aborted = true; failureReceipt(s, "original_total_fence_expired_with_unsettled_resources");
    // No kill(client), refreshed daemon budget or implicit S handoff.
  }, Math.max(0, s.request.total_deadline_ms - ownedNamespaceHostNow()));
  // A lost CLI can leave a daemon operation unresolved. S must stay its owner;
  // no bounded/hard OS exit is claimed in that UNKNOWN case.
  s.retention = setInterval(() => {}, 250);
  void boot(s);
  return h;
}
export async function runOwnedNamespaceSupervisorEntry(argv) {
  const [mode, request_path, request_sha256, ...extra] = data(argv);
  if (mode !== "--namespace-supervisor" || extra.length || !process.send || !process.connected || process.env.AIRLOCK_ROLE !== "S") {
    fail("namespace_direct_S_entry_refused");
  }
  const h = await startOwnedNamespaceSupervisor({ request_path, request_sha256 });
  const result = await namespaceActorCompletion(h);
  const s = actors.get(h);
  namespacePlanEvidence(s.plan);
  now(s);
  if (!s.finished || s.ipcPending || (s.workerRecord && (!s.workerRecord.closed || !s.workerRecord.streams_settled)))
    fail("namespace_final_actor_not_settled");
  await new Promise(resolve => process.send({ type: "S_RESULT", file: result.file, disposition: result.disposition }, e => {
    process.exitCode = e || result.disposition !== "UNQUALIFIED_ACTOR_CANDIDATE" ? 2 : 0;
    process.disconnect(); resolve();
  }));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runOwnedNamespaceSupervisorEntry(process.argv.slice(2)).catch(e => {
    process.stderr.write(e.message + "\n"); process.exitCode = 2;
    if (process.connected) process.disconnect();
  });
}
