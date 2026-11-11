import { createHash } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProxy } from "node:util/types";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { runLocalGoogleQualification } from "./inspected-google-qualification.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ownedCustodies = new WeakSet();
export const isOwnedGoogleWitnessCustody = value => ownedCustodies.has(value);
const controls = ["positive", "marker", "marker-bypass", "path", "path-bypass", "changed-input", "changed-input-bypass",
  "ambiguous", "ambiguous-bypass", "authority", "authority-bypass", "body", "body-bypass", "expiration", "expiration-bypass",
  "unsupported-transport", "unsupported-transport-bypass",
  "response-parent", "response-parent-unlinked", "response-parent-unlinked-bypass",
  "response-parent-incomplete", "response-parent-incomplete-bypass",
  "aggregate", "aggregate-bypass",
  "close", "close-positive", "no-ticket", "abort", "redirect",
  "budget", "budget-bypass", "certificate", "wrong-name", "response-limit", "response-limit-bypass",
  "header-limit", "header-limit-bypass",
  "truncated", "truncated-bypass",
  "retry", "retry-bypass", "goaway", "goaway-bypass"];
const fail = reason => { throw Error(reason); };

/** Independent custody and child-exit observation for fixed SDK-free controls only. */
export async function witnessLocalGoogleQualification(options) {
  const started = performance.now(), expires = Date.now() + 60000;
  if (!options || isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).length !== 3
    || Reflect.ownKeys(options).some(key => !["protocol", "control", "outputDir"].includes(key)
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value"))
    || !["h1", "h2"].includes(options.protocol) || !controls.includes(options.control)
    || options.control.startsWith("goaway") && options.protocol !== "h2"
    || typeof options.outputDir !== "string" || !isAbsolute(options.outputDir)
    || resolve(options.outputDir) !== options.outputDir || options.outputDir === root
    || options.outputDir.startsWith(root + "/"))
    fail("invalid_google_witness");
  const { protocol, control, outputDir } = options, parent = lstatSync(dirname(outputDir));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()
    || (parent.mode & 0o7777) !== 0o700) fail("invalid_google_witness_parent");
  try { mkdirSync(outputDir, { mode: 0o700 }); }
  catch (error) {
    if (error.code === "EEXIST") fail("google_witness_output_exists");
    throw error;
  }
  const parentFd = openSync(dirname(outputDir), "r");
  try { fsyncSync(parentFd); } finally { closeSync(parentFd); }
  const runDir = join(outputDir, "run");
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), overflow = false;
  let exit = null, close = null, spawnError = null, child = null, transport = null;
  const retainedResources = { browserServer: null, browser: null, context: null, browserProcess: null };
  let stopped = false, stopReason = null, receiptError = null, stopError = null, escalation = null;
  const stop = reason => {
    if (stopped) return;
    stopped = true;
    stopReason = reason;
    try { transport?.closeAdmission(); } catch (error) { stopError = error; }
    if (child && !exit) {
      try { child.kill("SIGTERM"); } catch (error) { stopError ??= error; }
      escalation = setTimeout(() => {
        if (!exit) try { child.kill("SIGKILL"); } catch (error) { stopError ??= error; }
      }, 2000);
    }
    try {
      writeMetaPrivate(join(outputDir, "custody-incomplete.json"), {
        schema: "airlock.sdk-absent-google-custody-incomplete.v1", complete: false,
        reason, native_execution_qualified: false, descendant_cleanup: "unknown_manual",
        retained_resources: Object.fromEntries(Object.entries(retainedResources).map(([name, value]) => [name, value !== null])),
      });
    } catch (error) { receiptError = error; }
  };
  const remaining = () => Math.min(expires - Date.now(), 60000 - (performance.now() - started));
  const timeout = setTimeout(() => stop("qualification_expired"), Math.max(0, remaining()));
  const custody = {
    started, expires, stopped: () => stopped, onFailure: stop,
    onResource(name, value) {
      if (!Object.hasOwn(retainedResources, name) || !value
        || retainedResources[name] && retainedResources[name] !== value) throw Error("invalid_google_owned_resource");
      retainedResources[name] = value;
    },
    recoveryResources: () => Object.freeze({ ...retainedResources }),
    onTransport(value) {
      transport = value;
      if (stopped) try { transport.closeAdmission(); } catch (error) { stopError ??= error; }
    },
    onChild(value) {
      if (child) throw Error("google_scenario_child_already_owned");
      child = value;
      for (const [stream, append] of [[child.stdout, bytes => { stdout = Buffer.concat([stdout, bytes]); }],
        [child.stderr, bytes => { stderr = Buffer.concat([stderr, bytes]); }]]) {
        stream.on("data", bytes => {
          if (stdout.length + stderr.length + bytes.length > 16384) {
            overflow = true;
            stop("scenario_output_overflow");
            return;
          }
          append(bytes);
        });
      }
      child.once("error", error => { spawnError = error; stop("scenario_spawn_failed"); });
      child.once("exit", (code, signal) => {
        exit = { code, signal };
        if (code !== 0 || signal !== null) stop("scenario_exit_incomplete");
      });
      child.once("close", (code, signal) => { close = { code, signal }; });
      if (stopped) {
        try { child.kill("SIGTERM"); } catch (error) { stopError ??= error; }
        escalation = setTimeout(() => {
          if (!exit) try { child.kill("SIGKILL"); } catch (error) { stopError ??= error; }
        }, 2000);
      }
    },
  };
  ownedCustodies.add(custody);
  let sourceBefore, cohortBefore, runError = null;
  try {
    sourceBefore = inspectedMetaSourcePins();
    cohortBefore = currentGoogleCohort();
    if (remaining() <= 0) stop("qualification_expired");
    if (!stopped) await runLocalGoogleQualification({ protocol, control, outputDir: runDir }, custody);
  } catch (error) {
    runError = error;
    stop("qualification_incomplete");
  }
  if (!stopped && remaining() <= 0) stop("qualification_expired");
  try {
  const duration = performance.now() - started;
  const completion = {
    schema: "airlock.sdk-absent-google-command-completion.v1", protocol, control, complete: false,
    producer_evidence: "not_validated", command_exit_observed: exit !== null, command_close_observed: close !== null,
    exit_code: exit?.code ?? null, signal: exit?.signal ?? null, close_code: close?.code ?? null, close_signal: close?.signal ?? null,
    spawn_failed: spawnError !== null,
    spawn_error_code: typeof spawnError?.code === "string" && /^[A-Z0-9_]+$/.test(spawnError.code)
      ? spawnError.code : spawnError ? "unknown" : null,
    elapsed_ms: duration, stdout_sha256: hash(stdout), stderr_sha256: hash(stderr),
    source_before_sha256: sourceBefore ? hash(JSON.stringify(sourceBefore)) : null,
    cohort_before_sha256: cohortBefore ? hash(JSON.stringify(cohortBefore)) : null,
    output_overflow: overflow, stop_reason: stopReason,
  };
  writeMetaPrivate(join(outputDir, "command-completion.json"), completion);
  if (!stopped && remaining() <= 0) stop("qualification_expired");
  let stage = "child_completion", witness;
  try {
    if (receiptError || stopError || runError || stopped || spawnError || !exit || !close
      || exit.code !== close.code || exit.signal !== close.signal)
      fail("local_google_child_completion_invalid");
    stage = "source_cohort";
    const sourceAfter = inspectedMetaSourcePins(), cohortAfter = currentGoogleCohort();
    stage = "result";
    const bytes = readMetaPrivate(join(runDir, "result.json"));
    const report = JSON.parse(bytes.toString("utf8"));
    stage = "originals";
    const wire = report.originals?.wire;
    const responses = report.originals?.responses;
    if ((wire !== undefined && !Array.isArray(wire)) || !Array.isArray(responses))
      fail("local_google_originals_invalid");
    const originals = [...(wire ?? []).flatMap(row => [row.request, row.response]),
      ...responses.map(row => row.body)];
    const names = new Set();
    let originalBytes = 0;
    for (const original of originals) {
      if (!original || typeof original.file !== "string" || !/^original-[1-9][0-9]*\.bin$/.test(original.file)
        || names.has(original.file) || !Number.isSafeInteger(original.bytes) || original.bytes < 0
        || !Array.isArray(original.chunks) || original.chunks.some(size => !Number.isSafeInteger(size) || size < 0)
        || original.chunks.reduce((sum, size) => sum + size, 0) !== original.bytes
        || typeof original.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(original.sha256))
        fail("local_google_originals_invalid");
      names.add(original.file);
      const data = readMetaPrivate(join(runDir, original.file), 8388608);
      originalBytes += data.length;
      if (data.length !== original.bytes || hash(data) !== original.sha256
        || originalBytes + bytes.length > 8388608) fail("local_google_originals_invalid");
    }
    stage = "producer_report";
    const expectedAbort = control === "abort";
    const outcomeMatches = expectedAbort
      ? report.outcome === "inconclusive" && JSON.stringify(report.errors) === JSON.stringify(["synthetic_abort"])
        && report.receiver_attempts === 1 && report.cleanup.guard_at_context_close === true
      : report.outcome === "pass" && Array.isArray(report.errors) && report.errors.length === 0;
    const reportValid = exit.code === (expectedAbort ? 1 : 0) && exit.signal === null && !overflow && Number.isFinite(duration)
      && duration > 0 && duration < 60000 && report.protocol === protocol && report.control === control
      && outcomeMatches
      && report.native_sdk_executed === false && report.public_upstream_requests === 0
      && report.native_execution_qualified === false
      && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter)
      && JSON.stringify(sourceBefore) === JSON.stringify(report.source_before)
      && JSON.stringify(report.source_before) === JSON.stringify(report.source_after)
      && JSON.stringify(cohortBefore) === JSON.stringify(cohortAfter)
      && JSON.stringify(cohortBefore) === JSON.stringify(report.cohort_before)
      && JSON.stringify(report.cohort_before) === JSON.stringify(report.cohort_after);
    witness = { schema: "airlock.sdk-absent-google-child-witness.v1",
      protocol, control, command_exit_observed: true, exit_code: exit.code, signal: exit.signal,
      elapsed_ms: duration, producer_outcome: report.outcome, result_sha256: hash(bytes),
      stdout_sha256: hash(stdout), stderr_sha256: hash(stderr),
      source_sha256: hash(JSON.stringify(sourceBefore)), cohort_sha256: hash(JSON.stringify(cohortBefore)), complete: false,
      failure_category: reportValid ? "google_guard_release_unqualified" : "local_google_witness_inconclusive",
      native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
  } catch (error) {
    try {
      writeMetaPrivate(join(outputDir, "witness.json"), { ...completion,
        schema: "airlock.sdk-absent-google-child-witness.v1", failure_category: `local_google_${stage}_failed` });
    } catch (writeError) {
      throw new AggregateError([error, writeError], "local_google_failure_witness_write_failed", { cause: writeError });
    }
    throw new Error(`local_google_${stage}_failed`, { cause: error });
  }
  writeMetaPrivate(join(outputDir, "witness.json"), witness);
  if (!stopped && remaining() <= 0) stop("qualification_expired");
  if (!witness.complete) fail("local_google_witness_inconclusive");
  return witness;
  } catch (error) {
    stop("witness_incomplete");
    throw error;
  } finally {
    clearTimeout(timeout);
    if (exit) clearTimeout(escalation);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const witness = await witnessLocalGoogleQualification({
      protocol: process.argv[2], control: process.argv[3], outputDir: process.argv[4],
    });
    console.log(JSON.stringify({ protocol: witness.protocol, control: witness.control, complete: witness.complete }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
