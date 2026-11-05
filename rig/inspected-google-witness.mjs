import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProxy } from "node:util/types";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
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

/** Separate child-exit observation for fixed SDK-free controls only. */
export async function witnessLocalGoogleQualification(options) {
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
  const sourceBefore = inspectedMetaSourcePins();
  const cohortBefore = currentGoogleCohort();
  try { mkdirSync(outputDir, { mode: 0o700 }); }
  catch (error) {
    if (error.code === "EEXIST") fail("google_witness_output_exists");
    throw error;
  }
  const parentFd = openSync(dirname(outputDir), "r");
  try { fsyncSync(parentFd); } finally { closeSync(parentFd); }
  const runDir = join(outputDir, "run");
  const program = fileURLToPath(new URL("./inspected-google-qualification.mjs", import.meta.url));
  const command = [process.execPath, program, protocol, control, runDir], started = performance.now();
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), overflow = false;
  for (const [stream, append] of [[child.stdout, bytes => { stdout = Buffer.concat([stdout, bytes]); }],
    [child.stderr, bytes => { stderr = Buffer.concat([stderr, bytes]); }]]) {
    stream.on("data", bytes => {
      if (stdout.length + stderr.length + bytes.length > 16384) { overflow = true; return; }
      append(bytes);
    });
  }
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const duration = performance.now() - started, sourceAfter = inspectedMetaSourcePins(), cohortAfter = currentGoogleCohort();
  const bytes = readMetaPrivate(join(runDir, "result.json"));
  const report = JSON.parse(bytes.toString("utf8"));
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
  const expectedAbort = control === "abort";
  const outcomeMatches = expectedAbort
    ? report.outcome === "inconclusive" && JSON.stringify(report.errors) === JSON.stringify(["synthetic_abort"])
      && report.receiver_attempts === 1 && report.cleanup.guard_at_context_close === true
    : report.outcome === "pass" && Array.isArray(report.errors) && report.errors.length === 0;
  const valid = exit.code === (expectedAbort ? 1 : 0) && exit.signal === null && !overflow && Number.isFinite(duration)
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
  const witness = { schema: "airlock.sdk-absent-google-child-witness.v1",
    protocol, control, command_exit_observed: true, exit_code: exit.code, signal: exit.signal,
    elapsed_ms: duration, producer_outcome: report.outcome, result_sha256: hash(bytes),
    stdout_sha256: hash(stdout), stderr_sha256: hash(stderr),
    source_sha256: hash(JSON.stringify(sourceBefore)), cohort_sha256: hash(JSON.stringify(cohortBefore)), complete: valid,
    native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
  writeMetaPrivate(join(outputDir, "witness.json"), witness);
  if (!valid) fail("local_google_witness_inconclusive");
  return witness;
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
