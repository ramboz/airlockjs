import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { equal, record } from "./inspected-meta-record.mjs";
import { fail, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { clockState, ns, sample, TOTAL_NS } from "./sdk-absent-clock-observation-protocol.mjs";
import { collectObservationChild } from "./sdk-absent-clock-observation-streams.mjs";
import { clockHostPlanEvidence, consumeClockHostPlan, HOST_TARGET } from "./sdk-absent-clock-host-plan.mjs";
import { hostBeforeDeadline, hostBinding, hostFixturePid, hostMessage, hostOriginalRequest } from "./sdk-absent-clock-host-protocol.mjs";
import { publishClockHostOriginal as observationWrite } from "./sdk-absent-clock-host-io.mjs";

const completions = new WeakMap();
// Keep ownership of unresolved handles. A timeout never means cancellation,
// never destroys queried streams, and never mints a closed-child receipt.
const pending = new Map();
export async function observeClockHostControl(plan) {
  const clock = clockState("HOST_OBSERVER"), start = sample(clock);
  const parent = process.ppid, parentConnected = process.connected;
  let observerParentLost = false;
  const observerAlive = () => {
    if (observerParentLost || process.ppid !== parent || (parentConnected && !process.connected)) {
      observerParentLost = true;
      fail("host_observer_parent_lost");
    }
  };
  const p = consumeClockHostPlan(plan), binding = hostBinding(p);
  const request = observationWrite(p.root, "host-request.json", {
    schema: "airlock.clock-host-request.v1", target: HOST_TARGET, root: p.root,
    case_id: p.case_id, nonce: p.nonce, control: p.control, uid: p.uid,
    node: p.node, node_version: p.node_version, sources: p.sources, source_sha256: p.source_sha256,
    directory: p.directory, start_ns: start, deadline_ns: (ns(start) + TOTAL_NS).toString(),
  }, p.uid);
  const command = { executable: p.node.path,
    argv: [fileURLToPath(new URL("sdk-absent-clock-host-fixture.mjs", import.meta.url)),
      "--fixed-host-fixture", request.path, request.sha256],
    options: { cwd: p.root, env: { HOME: p.root, PATH: "/usr/bin:/bin" },
      shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] } };
  const registration = observationWrite(p.root, "host-intent.json", {
    schema: "airlock.clock-host-intent.v1", target: HOST_TARGET, binding, request, command,
    original_start_ns: start, original_deadline_ns: (ns(start) + TOTAL_NS).toString(),
  }, p.uid);
  let fixturePid = null, issuance = null;
  const originals = () => {
    clockHostPlanEvidence(plan);
    const r = hostOriginalRequest(request);
    if (!equal(hostBinding(r), binding) || r.start_ns !== start) fail("host_original_request_changed");
    observationSnapshot(registration, p.uid);
    if (issuance) observationSnapshot(issuance, p.uid);
  };
  originals();
  const issued = sample(clock); hostBeforeDeadline(start, issued);
  observerAlive();
  const unknown = reason => {
    const diagnostic = observationWrite(p.root, "host-unknown.json", {
      schema: "airlock.clock-host-unknown.v1", target: HOST_TARGET, binding, registration, issuance, fixture_pid: fixturePid,
      disposition: "UNKNOWN", child_close_claimed: false, cancellation_claimed: false, reason,
    }, p.uid);
    return { status: "UNKNOWN", completion: null, diagnostic, child_close_claimed: false, host_qualified: false,
      observation_valid: false, qualified_clock: false, workload_admission: false, native_qualified: false };
  };
  const owned = { child: null, plan, request, registration, clock, start, issued,
    fixture_pid: null, issuance: null, timedOut: false, taken: false };
  pending.set(plan, owned);
  let timer;
  // Installed from the ORIGINAL start before issuance. A blocking spawn can
  // consume this budget, but cannot throw away ownership or restart the timer.
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => { owned.timedOut = true; resolve(null); },
      Number(hostBeforeDeadline(start, issued) / 1000000n));
  });
  let child;
  try {
    child = spawn(command.executable, command.argv, command.options);
    owned.child = child;
  } catch {
    clearTimeout(timer); pending.delete(plan);
    return unknown("fixed_spawn_threw_NO_child_close_claim");
  }
  let hello = null, candidate = null, completion = null, ackSent = null, exit = null;
  const errors = [];
  try { fixturePid = hostFixturePid(child.pid); } catch (e) { errors.push(e.message); }
  owned.fixture_pid = fixturePid;
  const ownedPid = () => {
    if (fixturePid === null || hostFixturePid(child.pid) !== fixturePid) fail("host_owned_fixture_pid_changed_or_unavailable");
    if (!issuance) fail("host_owned_pid_issuance_missing");
    const i = record(observationSnapshot(issuance, p.uid).value,
      ["schema", "target", "binding", "registration", "request", "fixture_pid", "issued_ns", "handle_observed_ns"]);
    if (i.schema !== "airlock.clock-host-issued.v1" || i.target !== HOST_TARGET || !equal(i.binding, binding)
      || !equal(i.registration, registration) || !equal(i.request, request) || i.fixture_pid !== fixturePid
      || i.issued_ns !== issued || ns(i.handle_observed_ns) < ns(issued)
      || hostFixturePid(child.pid) !== fixturePid) fail("host_owned_pid_issuance_changed");
  };
  const parentLost = () => { observerParentLost = true; errors.push("host_observer_parent_lost"); };
  if (process.connected) process.on("disconnect", parentLost);
  child.on("exit", (code, signal) => {
    try {
      if (exit) errors.push("host_duplicate_exit");
      exit = { fixture_pid: fixturePid, code, signal, observed_ns: sample(clock) };
    } catch (e) { errors.push(e.message); }
  });
  const watched = collectObservationChild(child, clock, { ipc: true, onMessage(raw) {
    observerAlive(); originals(); ownedPid(); hostBeforeDeadline(start, sample(clock));
    if (raw.schema === "airlock.clock-host-hello.v1" && hello === null) {
      const h = hostMessage(raw, "airlock.clock-host-hello.v1", p, request, ["fixture_pid", "tau0_ns", "hello_ns"]);
      if (hostFixturePid(h.fixture_pid) !== fixturePid) fail("host_fixture_HELLO_pid_mismatch");
      if (ns(h.hello_ns) < ns(h.tau0_ns)) fail("host_fixture_clock_reversed");
      hello = h;
      ackSent = sample(clock); hostBeforeDeadline(start, ackSent);
      observerAlive();
      watched.send({ schema: "airlock.clock-host-ack.v1", target: HOST_TARGET, binding, request,
        fixture_pid: fixturePid, type: "NO_WORK_ACK" });
    } else if (raw.schema === "airlock.clock-host-result.v1") {
      const m = hostMessage(raw, "airlock.clock-host-result.v1", p, request, ["file", "fixture_pid", "published_ns"]);
      if (!hello || candidate || m.file.path !== p.root + "/fixture-output.json"
        || hostFixturePid(m.fixture_pid) !== fixturePid || ns(m.published_ns) < ns(hello.hello_ns))
        fail("host_result_order_pid_or_path");
      observationSnapshot(m.file, p.uid); candidate = m;
    } else {
      const m = hostMessage(raw, "airlock.clock-host-complete.v1", p, request, ["file", "fixture_pid", "completed_ns"]);
      if (!candidate || completion || hostFixturePid(m.fixture_pid) !== fixturePid || !equal(m.file, candidate.file)
        || ns(m.completed_ns) < ns(candidate.published_ns) || ns(m.completed_ns) - ns(hello.tau0_ns) >= 5000000000n)
        fail("host_validation_completion_order_pid_or_fence");
      completion = m;
    }
  } });
  owned.watched = watched;
  try { child.stdin.end(); } catch { errors.push("host_stdin_end_failed_NOT_cancellation"); }
  // Post-spawn publication failure cannot abandon the already-owned child.
  try {
    issuance = observationWrite(p.root, "host-issued.json", {
      schema: "airlock.clock-host-issued.v1", target: HOST_TARGET, binding, registration, request,
      fixture_pid: fixturePid, issued_ns: issued, handle_observed_ns: sample(clock),
    }, p.uid);
    owned.issuance = issuance;
  } catch (e) { errors.push(e.message); }
  const close = await Promise.race([watched.done, timeout]);
  clearTimeout(timer);
  process.removeListener("disconnect", parentLost);
  if (close === null) return unknown("original_deadline_unsettled_child_or_streams_or_IPC");
  pending.delete(plan);
  if ((close.signal !== null && typeof close.signal !== "string")
    || (exit && exit.signal !== null && typeof exit.signal !== "string"))
    return unknown("public_exit_or_close_signal_missing_NOT_qualified");
  const expectedCode = p.control === "normal" ? 0 : 2;
  const expectedLoss = "observation_child_loss_NOT_cancellation";
  errors.push(...close.errors.filter(e => !(p.control === "failed-child" && e === expectedLoss)));
  if (!exit || exit.code !== expectedCode || exit.signal !== null || close.code !== expectedCode || close.signal !== null
    || (exit && ns(exit.observed_ns) > ns(close.actual_close_ns))) errors.push("host_exit_or_nonsignal_close_missing");
  if (!hello || !ackSent || !candidate) errors.push("host_handshake_or_output_original_missing");
  if (!completion) errors.push("host_validation_completion_original_missing");
  if (!close.ipc_settled || close.pending_sends || process.ppid !== parent) errors.push("host_lifetime_or_IPC_unsettled");
  for (const stream of ["stdout", "stderr"])
    if (close.output[stream].branch !== "EXPLICIT_EMPTY_NO_FRAMES") errors.push("host_unexpected_stream_output");
  try {
    observerAlive(); originals(); ownedPid();
    hostBeforeDeadline(start, close.actual_close_ns); hostBeforeDeadline(start, close.streams_settled_ns);
    hostBeforeDeadline(start, sample(clock));
    if (candidate) observationSnapshot(candidate.file, p.uid);
  } catch (e) { errors.push(e.message); }
  const original = observationWrite(p.root, "host-close.json", {
    schema: "airlock.clock-host-close.v1", target: HOST_TARGET, binding, registration, request,
    fixture_pid: fixturePid, issuance, issued_ns: issued, hello, ack_sent_ns: ackSent, candidate, completion, exit, close, errors,
    // This filing is after the observed fixture command; it cannot certify
    // its own future fsync or the tool caller's future command close.
    outer_tool_close_required: true,
  }, p.uid);
  try { observerAlive(); ownedPid(); } catch { return unknown("owned_pid_or_parent_unavailable_before_completion_ack"); }
  const receipt = Object.freeze(Object.create(null));
  completions.set(receipt, { ...owned, original, candidate, originals, ownedPid });
  return { status: errors.length ? "UNKNOWN" : "HOST_FIXTURE_CANDIDATE", completion: receipt,
    host_qualified: false, observation_valid: false, qualified_clock: false,
    workload_admission: false, native_qualified: false };
}
export function takeClockHostCompletion(receipt) {
  const c = completions.get(receipt);
  if (!c || c.taken || c.timedOut) fail("host_genuine_one_use_completion_required");
  c.taken = true;
  c.originals(); c.ownedPid();
  const p = clockHostPlanEvidence(c.plan);
  const original = observationSnapshot(c.original, p.uid);
  if (c.candidate) observationSnapshot(c.candidate.file, p.uid);
  return { p, original, value: original.value, fixture_pid: c.fixture_pid, issuance: c.issuance };
}
