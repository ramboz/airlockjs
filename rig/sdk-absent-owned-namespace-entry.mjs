// P is the external whole-command observer. It launches only the fixed S file;
// S independently reprepares its own private plan from immutable file handles.
import process from "node:process";
import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { atomicPrivateWrite, digest, fail, fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { namespacePlanEvidence, prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";
import { ownedNamespaceHostNow } from "./sdk-absent-owned-namespace-actors.mjs";
import { TOTAL_MS, WORK_MS } from "./sdk-absent-owned-namespace-time.mjs";
import { requireOwnedNamespaceRuntimeAdmission } from "./sdk-absent-owned-namespace-admission.mjs";

const S_FILE = fileURLToPath(new URL("sdk-absent-owned-namespace-actors.mjs", import.meta.url));
const observers = new WeakMap();
export function parseOwnedNamespacePublicArgv(value) {
  const a = data(value);
  if (!Array.isArray(a) || a.length !== 5 || a[0] !== "--fixed-namespace-case"
    || !/^[a-z0-9-]{1,48}$/.test(a[1]) || !digest(a[2]) || typeof a[3] !== "string"
    || !isAbsolute(a[3]) || resolve(a[3]) !== a[3]
    || !["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"].includes(a[4]))
    fail("namespace_fixed_public_arguments");
  return { case_id: a[1], nonce: a[2], root: a[3], control: a[4] };
}
export function ownedNamespacePublicCommand(argv) {
  parseOwnedNamespacePublicArgv(argv);
  return [process.execPath, fileURLToPath(import.meta.url), ...data(argv)];
}
export function launchOwnedNamespaceCase(rawArgv) {
  const v = parseOwnedNamespacePublicArgv(rawArgv), started = ownedNamespaceHostNow();
  const plan = prepareOwnedNamespacePlan({ case_id: v.case_id, nonce: v.nonce, root: v.root });
  requireOwnedNamespaceRuntimeAdmission(plan);
  const p = namespacePlanEvidence(plan), uid = p.prepared_identity.root.uid, deadline = started + TOTAL_MS;
  const command = ownedNamespacePublicCommand(rawArgv);
  const request = { schema: "airlock.owned-namespace-launch-request.v2", ...v, clock_domain: "NODE_HOST_HRTIME_MONOTONIC",
    started_monotonic_ms: started, work_deadline_ms: started + WORK_MS, total_deadline_ms: deadline,
    source_sha256: p.source_sha256, cohort_sha256: p.cohort_sha256 };
  const requestFile = atomicPrivateWrite(v.root, "launch-request.json", request, uid);
  const registration = { schema: "airlock.owned-namespace-P-owner.v2", owner: "P", request: requestFile, command,
    supervisor_executable: process.execPath, supervisor_argv: [S_FILE, "--namespace-supervisor", requestFile.path, requestFile.sha256],
    total_deadline_ms: deadline, child_close_observed: false, qualified: false };
  atomicPrivateWrite(v.root, "p-owner.json", registration, uid);
  namespacePlanEvidence(plan);
  if (ownedNamespaceHostNow() >= started + WORK_MS) fail("namespace_original_launch_expired");
  const child = spawn(process.execPath, registration.supervisor_argv, { env: { HOME: v.root + "/empty-home",
    PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_ROLE: "S" }, shell: false, windowsHide: true,
  stdio: ["ignore", "pipe", "pipe", "ipc"], cwd: v.root + "/empty-home" });
  let result = null, closed = false, outClosed = false, errClosed = false, outEnded = false, errEnded = false,
    code = null, signal = null, total = 0, timedOut = false, completed = false;
  const errors = [];
  let resolveDone;
  const completion = new Promise(resolveCompletion => { resolveDone = resolveCompletion; });
  const timer = setTimeout(() => {
    timedOut = true; errors.push("original_45s_expired_no_supported_S_handoff");
    try { atomicPrivateWrite(v.root, "p-timeout.json", { ...registration, errors, timed_out: true }, uid); }
    catch (e) { errors.push("timeout_publication_failed:" + e.message); }
    // Deliberately no kill(S), new case or claimed bounded command close.
  }, Math.max(0, deadline - ownedNamespaceHostNow()));
  const finish = () => {
    if (completed || !closed || !outClosed || !errClosed) return;
    completed = true; clearTimeout(timer);
    const end = ownedNamespaceHostNow();
    if (!outEnded || !errEnded) errors.push("external_stream_EOF_missing");
    if (end >= deadline) timedOut = true;
    let candidate = null;
    try {
      if (!result) fail("S_closed_without_owned_resource_result");
      const r = record(data(result), ["type", "file", "disposition"]);
      if (r.type !== "S_RESULT" || r.file?.path !== v.root + "/case/actor-result.json") fail("foreign_S_result");
      const original = fixedRead(r.file.path, { privateUid: uid });
      candidate = original.handle;
      if (!equal(candidate, r.file)) fail("S_publication_original_changed");
      const c = json(original.bytes);
      if (c.schema !== "airlock.owned-namespace-S-ledger.v2" || c.qualified !== false
        || c.scope !== "UNQUALIFIED_SOURCE_EXECUTOR" || c.owner !== "S" || !equal(c.request, request)
        || c.source_sha256 !== p.source_sha256 || c.mechanical_resources_settled !== true
        || !Array.isArray(c.operations) || !c.operations.length
        || c.operations.some(o => o.owner !== "S" || o.daemon !== "SETTLED" || o.client_closed !== true || o.streams_settled !== true))
        fail("S_resource_result_incomplete_or_foreign");
      namespacePlanEvidence(plan);
    } catch (e) { errors.push(e.message); }
    const external = { schema: "airlock.owned-namespace-P-observed-S-close-candidate.v2",
      observer_scope: "P-observed-S-close-only-NOT-whole-P-command-completion",
      whole_command_candidate: command, supervisor_command: [process.execPath, ...registration.supervisor_argv], request: requestFile,
      started_monotonic_ms: started, completed_monotonic_ms: end, actual_exit_code: code, signal,
      exit_observed: true, observer_streams_settled: true, timed_out: timedOut, candidate,
      source_sha256: p.source_sha256, cohort_sha256: p.cohort_sha256, errors, qualified: false,
      external_whole_command_completion_required: true };
    let file = null;
    try { file = atomicPrivateWrite(v.root, "p-s-close-candidate.json", external, uid); }
    catch (e) { errors.push("S_close_publication_failed:" + e.message); }
    resolveDone({ qualified: false, S_close_candidate: file, errors, timed_out: timedOut,
      external_whole_command_completion_required: true,
      actual_exit_code: code, signal, sdk_absent: true, native_authority: false });
  };
  for (const [stream, stdout] of [[child.stdout, true], [child.stderr, false]]) {
    stream.on("data", bytes => { total += bytes.length; if (total > 16384) { errors.push("external_output_bound"); stream.destroy(); } });
    stream.on("end", () => { if (stdout) outEnded = true; else errEnded = true; });
    stream.on("close", () => { if (stdout) outClosed = true; else errClosed = true; finish(); });
    stream.on("error", () => errors.push("external_stream_error"));
  }
  child.on("message", value => { if (result !== null) errors.push("duplicate_S_result"); else result = value; });
  child.on("error", () => errors.push("S_client_error_not_cleanup"));
  child.on("close", (exitCode, exitSignal) => {
    closed = true; code = exitCode; signal = exitSignal;
    if (exitCode !== 0 || exitSignal !== null) errors.push("S_loss_or_failed_close_not_W_loss_coverage");
    if (!outClosed) child.stdout.destroy();
    if (!errClosed) child.stderr.destroy();
    finish();
  });
  observers.set(completion, { plan, deadline });
  return completion;
}
export async function runOwnedNamespacePublicEntry(argv) {
  const completion = launchOwnedNamespaceCase(argv), result = await completion, observer = observers.get(completion);
  namespacePlanEvidence(observer.plan);
  if (ownedNamespaceHostNow() >= observer.deadline) {
    result.timed_out = true;
    result.errors.push("original_total_fence_expired_before_P_output");
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.errors.length || result.timed_out ? 2 : 0;
  return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runOwnedNamespacePublicEntry(process.argv.slice(2)).catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
