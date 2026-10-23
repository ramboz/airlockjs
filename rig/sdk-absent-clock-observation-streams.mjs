import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { data, equal, record } from "./inspected-meta-record.mjs";
import { fail, hash, observationSnapshot, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence } from "./sdk-absent-clock-observation-plan.mjs";
import { hello, makeBudget, ns, remaining, revalidateObservationRequest, sample } from "./sdk-absent-clock-observation-protocol.mjs";
import { requireClockObservationRuntime } from "./sdk-absent-clock-observation-admission.mjs";

// Observes an already-owned fixed child. No executable, PID, signal, backend
// or policy selection is accepted by this stream collector.
export function collectObservationChild(child, clock, { ipc = false, onMessage = null } = {}) {
  const raw = { stdout: [], stderr: [] }, chunks = { stdout: [], stderr: [] }, errors = [], messages = [];
  let code = null, signal = null, actualClose = null, settled = false, sends = 0, bytesSeen = 0;
  const eof = { stdout: false, stderr: false }, closed = { stdout: false, stderr: false, stdin: false };
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const note = reason => {
    if (errors.includes(reason)) return;
    if (errors.length < 15) errors.push(reason);
    else if (!errors.includes("observation_diagnostic_bound")) errors.push("observation_diagnostic_bound");
  };
  const stamp = () => {
    try { return sample(clock); } catch (e) { note(e.message); return null; }
  };
  const finish = () => {
    if (settled || actualClose === null || !closed.stdout || !closed.stderr || !closed.stdin || sends) return;
    settled = true;
    if (!eof.stdout || !eof.stderr) note("observation_stream_EOF_missing");
    if (ipc && child.connected) note("observation_IPC_unsettled");
    if (code !== 0 || signal !== null) note("observation_child_loss_NOT_cancellation");
    const output = {};
    for (const which of ["stdout", "stderr"]) {
      const bytes = Buffer.concat(raw[which]);
      output[which] = { branch: bytes.length ? "BYTES" : "EXPLICIT_EMPTY_NO_FRAMES",
        base64: bytes.toString("base64"), sha256: hash(bytes), chunks: chunks[which] };
    }
    resolveDone({ schema: "airlock.clock-observation-stream-close.v1", code, signal,
      actual_close_ns: actualClose, streams_settled_ns: stamp(), eof, closed,
      ipc_settled: !ipc || !child.connected, pending_sends: sends, output, messages, errors });
  };
  for (const which of ["stdout", "stderr"]) {
    child[which].on("data", value => {
      const bytes = Buffer.from(value); bytesSeen += bytes.length;
      if (bytesSeen > 16384 || chunks[which].length >= 64) { note("observation_output_bound"); return; }
      const received = stamp();
      raw[which].push(bytes);
      chunks[which].push({ received_ns: received, base64: bytes.toString("base64"), sha256: hash(bytes) });
    });
    child[which].on("end", () => { eof[which] = true; });
    child[which].on("close", () => { closed[which] = true; finish(); });
    child[which].on("error", () => note("observation_" + which + "_error"));
  }
  child.stdin.on("close", () => { closed.stdin = true; finish(); });
  child.stdin.on("error", () => note("observation_stdin_error"));
  child.on("error", () => note("observation_child_error_NOT_cancellation"));
  child.on("disconnect", finish);
  child.on("close", (exitCode, exitSignal) => {
    actualClose = stamp(); code = exitCode; signal = exitSignal;
    // Never destroy pending queried streams and call them successful EOF.
    finish();
  });
  child.on("message", value => {
    try {
      const at = stamp(), copy = data(value);
      if (!ipc || messages.length >= 8 || Buffer.byteLength(JSON.stringify(copy)) > 4096)
        fail("observation_unexpected_or_bounded_IPC");
      messages.push({ received_ns: at, value: copy });
      onMessage?.(copy, at);
    } catch (e) { note(e.message); }
  });
  return {
    done, errors, child,
    send(value) {
      if (!ipc || !child.connected) fail("observation_owned_IPC_disconnected");
      sends++;
      child.send(value, e => { sends--; if (e) note("observation_IPC_send_failed"); finish(); });
    },
  };
}
const FILES = { O: "outer", P: "producer", S: "supervisor" };
export async function observeFixedClockActor(state, role, b, request) {
  if ({ H: "O", O: "P", P: "S" }[state.role] !== role) fail("observation_fixed_actor_edge");
  const p = clockObservationPlanEvidence(state.plan), preSpawn = sample(state.clock);
  remaining(state, preSpawn);
  const command = { executable: p.node.path, argv: [
    fileURLToPath(new URL("sdk-absent-clock-observation-" + FILES[role] + ".mjs", import.meta.url)),
    "--clock-observation-" + role.toLowerCase(), request.path, request.sha256],
  env: { HOME: p.root + "/empty-home", PATH: "/usr/local/bin:/usr/bin:/bin" },
  cwd: p.root + "/empty-home", shell: false, stdio: ["pipe", "pipe", "pipe", "ipc"] };
  const registration = observationWrite(p.root, state.role.toLowerCase() + "-child-registered.json", {
    schema: "airlock.clock-observation-child-registration.v1", owner: state.role, role, binding: b,
    request, command, domain: "NODE_" + state.role + "_HRTIME_MONOTONIC_NS", unit: "ns",
    pre_spawn_ns: preSpawn, budget: state.budget,
  }, p.uid);
  const ownedOriginals = () => {
    revalidateObservationRequest(state.plan, role, b, request);
    if (state.request_file)
      revalidateObservationRequest(state.plan, state.role, state.binding, state.request_file);
    observationSnapshot(registration, p.uid);
  };
  clockObservationPlanEvidence(state.plan); requireClockObservationRuntime();
  ownedOriginals();
  const issued = sample(state.clock); remaining(state, issued);
  const child = spawn(command.executable, command.argv, { env: command.env, cwd: command.cwd,
    shell: false, windowsHide: true, stdio: command.stdio });
  let h = null, transfer = null, candidate = null;
  const watched = collectObservationChild(child, state.clock, { ipc: true, onMessage(raw, at) {
    if (raw.schema === "airlock.clock-observation-hello.v1" && h === null) {
      h = hello(raw, role, b);
      ownedOriginals();
      transfer = makeBudget(state.role, h, preSpawn, sample(state.clock), state.budget);
      watched.send(transfer);
    } else {
      const m = record(raw, ["schema", "type", "role", "binding", "file", "publication_sample_ns"]);
      if (!h || candidate !== null || m.schema !== "airlock.clock-observation-result-message.v1"
        || m.type !== "RESULT" || m.role !== role || !equal(m.binding, b)
        || m.file.path !== p.root + "/" + role.toLowerCase() + "-result.json"
        || ns(m.publication_sample_ns) < ns(h.hello_ns)) fail("observation_actor_message_order");
      remaining(state, at);
      candidate = m;
    }
  } });
  child.stdin.end(); // No ARM, WORK, program or other stdin frame exists.
  const timeout = setTimeout(() => {
    watched.errors.push("observation_original_budget_expired_pending_child_NOT_cancelled");
    try {
      observationWrite(p.root, state.role.toLowerCase() + "-pending.json", {
        schema: "airlock.clock-observation-pending.v1", owner: state.role, registration,
        disposition: "UNKNOWN", errors: watched.errors,
      }, p.uid);
    } catch (e) { state.errors.push(e.message); }
  }, Number(remaining(state, sample(state.clock)) / 1000000n));
  const close = await watched.done;
  clearTimeout(timeout);
  if (h === null || transfer === null || candidate === null) close.errors.push("observation_child_originals_missing");
  if (close.output.stdout.branch !== "EXPLICIT_EMPTY_NO_FRAMES" || close.output.stderr.branch !== "EXPLICIT_EMPTY_NO_FRAMES")
    close.errors.push("observation_fixed_actor_unexpected_output");
  try {
    remaining(state, close.actual_close_ns); remaining(state, close.streams_settled_ns);
    clockObservationPlanEvidence(state.plan);
  } catch (e) { close.errors.push(e.message); }
  state.errors.push(...close.errors);
  const file = observationWrite(p.root, state.role.toLowerCase() + "-child-close.json", {
    schema: "airlock.clock-observation-child-close.v1", registration, issued_ns: issued,
    hello: h, transfer, candidate, close,
  }, p.uid);
  return { file, candidate, close };
}
