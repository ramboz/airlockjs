import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { json } from "./inspected-meta-record.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fingerprint = value => hash(JSON.stringify(value));
const target = "/pagead/conversion/000000000/?label=synthetic&value=1&currency_code=USD"
  + "&oid=synthetic-transaction&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const expectedRequest = Buffer.from(`GET ${target} HTTP/1.1\r\nHost: www.googleadservices.com\r\n\r\n`);
const expectedResponse = Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok");

// This observes a fixed Node child, not a browser or native Google execution.
export async function witnessLocalGoogleController(output) {
  const parent = resolve("rig/out");
  if (typeof output !== "string" || dirname(output) !== parent || resolve(output) !== output
    || !/^google-witness-[a-f0-9]{16}$/.test(output.slice(parent.length + 1)))
    throw Error("nonlocal_google_fixture");
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent
    || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700) throw Error("unsafe_google_fixture_parent");
  const id = output.slice(-16), result = join(parent, `google-result-${id}`);
  const sourceBefore = fingerprint(inspectedMetaSourcePins()), cohortBefore = fingerprint(currentGoogleCohort());
  mkdirSync(output, { mode: 0o700 });
  for (const path of [output, parent]) {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
  const program = fileURLToPath(new URL("./inspected-google-controller-fixture.mjs", import.meta.url));
  const start = performance.now(), child = spawn(process.execPath, [program, id],
    { cwd: resolve("."), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), overflow = false, exit = null, spawnError = false;
  let timedOut = false, forceTimeout;
  for (const [stream, append] of [[child.stdout, bytes => { stdout = Buffer.concat([stdout, bytes]); }],
    [child.stderr, bytes => { stderr = Buffer.concat([stderr, bytes]); }]]) {
    stream.on("data", bytes => {
      if (stdout.length + stderr.length + bytes.length > 16384) { overflow = true; return; }
      append(bytes);
    });
  }
  child.once("exit", (code, signal) => { exit = { code, signal }; });
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    forceTimeout = setTimeout(() => child.kill("SIGKILL"), 2000);
  }, 55000);
  const close = await new Promise(resolve => {
    child.once("error", () => { spawnError = true; });
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timeout);
  clearTimeout(forceTimeout);
  const completion = { schema: "airlock.sdk-absent-google-node-command-completion.v1",
    complete: false, producer_evidence: "not_validated", command_exit_observed: exit !== null,
    command_close_observed: true, exit_code: exit?.code ?? null, signal: exit?.signal ?? null,
    close_code: close.code, close_signal: close.signal, spawn_failed: spawnError,
    elapsed_ms: performance.now() - start, timed_out: timedOut,
    stdout_sha256: hash(stdout), stderr_sha256: hash(stderr),
    source_before_sha256: sourceBefore, cohort_before_sha256: cohortBefore, output_overflow: overflow };
  writeMetaPrivate(join(output, "command-completion.json"), completion);
  try {
    if (spawnError || timedOut || !exit || exit.code !== 0 || exit.signal !== null || exit.code !== close.code
      || exit.signal !== close.signal || overflow || completion.elapsed_ms >= 60000) throw Error("child_incomplete");
    const reportBytes = readMetaPrivate(join(result, "result.json"));
    const report = json(reportBytes), binding = json(readMetaPrivate(join(result, "source-binding.json")));
    const sourceAfter = fingerprint(inspectedMetaSourcePins()), cohortAfter = fingerprint(currentGoogleCohort());
    if (sourceBefore !== sourceAfter || sourceBefore !== binding.source_before || sourceBefore !== binding.source_after
      || cohortBefore !== cohortAfter || cohortBefore !== binding.cohort_before || cohortBefore !== binding.cohort_after
      || report.outcome !== "inconclusive" || report.capture_complete !== true
      || !Array.isArray(report.errors) || report.errors.length !== 0 || report.native_sdk_executed !== false
      || report.public_upstream_requests !== 0 || report.native_execution_qualified !== false
      || report.deadline_qualified !== false || report.independent_completion_observed !== false
      || JSON.stringify(report.commands) !== JSON.stringify(["initialize", "configure", "conversion"])
      || report.physical?.forwarded !== 1 || report.physical?.stopped !== false)
      throw Error("producer_incomplete");
    const wire = report.originals?.wire, responses = report.originals?.responses;
    if (!Array.isArray(wire) || !Array.isArray(responses) || wire.length !== 1 || responses.length !== 1
      || wire[0].connection !== 1 || wire[0].protocol !== "h1"
      || responses[0].ordinal !== 1 || responses[0].state !== "complete")
      throw Error("originals_incomplete");
    const names = new Set();
    let total = 0, index = 0;
    for (const original of [wire[0].request, wire[0].response, responses[0].body]) {
      if (!original || !/^original-[1-9][0-9]*\.bin$/.test(original.file) || names.has(original.file)
        || !Number.isSafeInteger(original.bytes) || original.bytes < 0 || !Array.isArray(original.chunks)
        || original.chunks.some(size => !Number.isSafeInteger(size) || size < 0)
        || original.chunks.reduce((sum, size) => sum + size, 0) !== original.bytes)
        throw Error("originals_invalid");
      names.add(original.file);
      const bytes = readMetaPrivate(join(result, original.file), 8388608);
      total += bytes.length;
      if (total + reportBytes.length > 8388608 || bytes.length !== original.bytes
        || hash(bytes) !== original.sha256) throw Error("originals_invalid");
      if (!bytes.equals([expectedRequest, expectedResponse, Buffer.from("ok")][index++]))
        throw Error("originals_mismatch");
    }
    const witness = { schema: "airlock.sdk-absent-google-node-witness.v1", complete: true,
      command_exit_observed: true, command_close_observed: true, result_sha256: hash(reportBytes),
      source_sha256: sourceBefore, cohort_sha256: cohortBefore,
      native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
    writeMetaPrivate(join(output, "witness.json"), witness);
    return witness;
  } catch (error) {
    try { writeMetaPrivate(join(output, "witness.json"), { ...completion,
      schema: "airlock.sdk-absent-google-node-witness.v1", failure_category: "local_google_controller_incomplete" }); }
    catch (writeError) { throw new AggregateError([error, writeError], "google_witness_write_failed", { cause: writeError }); }
    throw Error("local_google_controller_incomplete", { cause: error });
  }
}
