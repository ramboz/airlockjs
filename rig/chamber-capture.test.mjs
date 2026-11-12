import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, openSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, mkdir, writeFile, cp, chmod, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";

const load = () => import("./chamber-capture.mjs");
const entry = fileURLToPath(new URL("./chamber-capture.mjs", import.meta.url));
const execute = promisify(execFile);
const temporary = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function retainJson(path, value) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  const directory = openSync(dirname(path), "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
function httpFixture(bytes = Buffer.from([0, 255, 128, 65, 13, 10])) {
  const headers = ["Content-Length", String(bytes.length), "X-Duplicate", "one", "X-Duplicate", "two"];
  const sink = { url: "/sink/meta?dup=one&dup=two", method: "GET",
    headers: ["Host", "127.0.0.1:1234"], body: "",
    response: { status: 200, headers, body: bytes.toString("base64") } };
  const observed = { url: "http://127.0.0.1:1234" + sink.url, method: "GET", resource: "Fetch",
    body: { state: "absent", base64: null }, extra: { headers: { Host: "127.0.0.1:1234" } },
    response: { status: 200, extra: { statusCode: 200,
      headers: { "Content-Length": String(bytes.length), "X-Duplicate": "one\ntwo" },
      headersText: "HTTP/1.1 200 OK\r\nContent-Length: " + bytes.length
        + "\r\nX-Duplicate: one\r\nX-Duplicate: two\r\n\r\n" },
    body: { state: "available", base64: bytes.toString("base64") } } };
  return { observed, sink };
}
async function witnessedCommand(root, control) {
  const output = join(root, `chamber-${control}-${Date.now()}-${randomUUID()}`);
  const external = output + "-command";
  await mkdir(external, { mode: 0o700 });
  const sourcePaths = [entry, fileURLToPath(import.meta.url)];
  const source = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(path))])));
  const started = Date.now(), monotonic = performance.now();
  const pending = execute(process.execPath, [entry, "capture", "--output-dir", output,
    "--control", control], { timeout: 61000, maxBuffer: 16384 });
  const pid = pending.child.pid;
  let command;
  try { command = { ...await pending, code: 0, signal: null, killed: false }; }
  catch (caught) { command = caught; }
  // Observed only AFTER execFile's actual close, including pipe completion.
  const closed = Date.now(), duration = performance.now() - monotonic;
  const names = ["start.json", "capture.json", "report.json", "pre-expiry.json", "publication.json",
    "abort-originals.json", "abort-parent.json", "witness.json"];
  const files = {};
  for (const name of names) {
    try { files[name] = hash(await readFile(join(output, name))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const current = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(path))])));
  const witness = { schema: "airlock.chamber-whole-cli-witness.v1", output, pid,
    started_ms: started, closed_ms: closed, duration_ms: duration,
    exit_code: command.code, signal: command.signal || null, timeout: command.killed === true,
    source_before: source, source_after: current, files,
    stdout: command.stdout || "", stderr: command.stderr || "" };
  retainJson(join(external, "command.json"), witness);
  return { output, external, command, witness };
}
async function scratch() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "airlock-chamber-"));
  temporary.push(root);
  return root;
}
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

describe("059-16 closed SDK-absent capture", () => {
  it("AC1: has only fixed capture/inspect commands, never URL/source/program overrides", async () => {
    const { parseArgs } = await load();
    expect(parseArgs(["capture", "--output-dir", "/private/new"])).toEqual({
      command: "capture", outputDir: "/private/new", control: "none",
    });
    for (const args of [
      ["capture", "--output-dir", "relative"],
      ["capture", "--output-dir", "/private/new", "--url", "https://example.invalid"],
      ["capture", "--output-dir", "/private/new", "--control", "live"],
      ["inspect", "--output-dir", "/private/new", "--control", "none"],
      ["capture", "--output-dir", "/private/new", "--output-dir", "/other"],
    ]) expect(() => parseArgs(args)).toThrow("invalid_options");
  });

  it("AC2: retains undefined, binary backing/offsets, holes and shared structured-clone originals", async () => {
    const { encodeOriginal, decodeOriginal } = await load();
    const buffer = new Uint8Array([0, 255, 128, 65]).buffer;
    const original = { missing: undefined, buffer, view: new Uint8Array(buffer, 1, 2),
      special: [-0, NaN, Infinity, 4n], holes: new Array(2) };
    original.self = original;
    const restored = decodeOriginal(JSON.parse(JSON.stringify(encodeOriginal(original))));
    expect(Object.hasOwn(restored, "missing")).toBe(true);
    expect(restored.missing).toBeUndefined();
    expect([...restored.view]).toEqual([255, 128]);
    expect(restored.view.byteOffset).toBe(1);
    expect(restored.view.buffer).toBe(restored.buffer);
    expect(restored.self).toBe(restored);
    expect(0 in restored.holes).toBe(false);
    expect(Object.is(restored.special[0], -0)).toBe(true);
    expect(Number.isNaN(restored.special[1])).toBe(true);
    expect(restored.special[3]).toBe(4n);
    expect(() => encodeOriginal(new Map())).toThrow("unsupported_original");
    expect(() => decodeOriginal(["unknown"])).toThrow("original_shape");
  });

  it("AC3: pins the current closed first-party graph and unchanged resolver-denying launcher", async () => {
    const { currentIdentity, verifyIdentity } = await load();
    const identity = currentIdentity();
    expect(identity.browser.expected_version).toBe("155.0.8059.85");
    expect(identity.sources.some(row => row.path === "core/airlock.js")).toBe(true);
    expect(identity.sources.some(row => row.path === "rig/chamber-capture.test.mjs")).toBe(true);
    expect(() => verifyIdentity(identity)).not.toThrow();
    for (const changed of [
      { ...identity, sources: identity.sources.slice(1) },
      { ...identity, sources: identity.sources.map((row, i) => i ? row : { ...row, sha256: "0".repeat(64) }) },
      { ...identity, unexpected: true },
    ]) expect(() => verifyIdentity(changed)).toThrow("source_identity");
  });

  it("AC4: compares original HTTP, duplicate order, final headers, body state and resource type", async () => {
    const { compareHttp } = await load();
    const { sink, observed } = httpFixture();
    expect(() => compareHttp(observed, sink)).not.toThrow();
    for (const mutate of [
      row => { row.url = row.url.replace("one&dup=two", "two&dup=one"); },
      row => { row.resource = "Image"; },
      row => { delete row.extra; },
      row => { row.response.body = { state: "unavailable", base64: null }; },
      row => { row.response.extra.headersText = "HTTP/1.1 200 OK\r\nX-Duplicate: two\r\nX-Duplicate: one\r\n\r\n"; },
    ]) {
      const changed = structuredClone(observed); mutate(changed);
      expect(() => compareHttp(changed, sink)).toThrow();
    }
  });

  it.each([
    ["empty", "", "response_original_length"],
    ["invalid", "!!!!", "response_original_encoding"],
    ["noncanonical", "AB==", "response_original_encoding"],
    ["short", "AP8=", "response_original_length"],
  ])("correction 1: rejects coordinated %s originals despite equal browser/sink fields", async (_, body, reason) => {
    const { compareHttp } = await load();
    const { sink, observed } = httpFixture();
    sink.response.body = observed.response.body.base64 = body;
    expect(() => compareHttp(observed, sink)).toThrow(reason);
  });

  it.each(["6", "7"])("correction 1: rejects duplicate/conflicting Content-Length %s explicitly", async value => {
    const { compareHttp } = await load();
    const { sink, observed } = httpFixture();
    sink.response.headers.push("Content-Length", value);
    observed.response.extra.headers["Content-Length"] += "\n" + value;
    observed.response.extra.headersText = observed.response.extra.headersText.replace("\r\n\r\n",
      "\r\nContent-Length: " + value + "\r\n\r\n");
    expect(() => compareHttp(observed, sink)).toThrow("response_content_length");
  });

  it("correction 1: measures decoded response, URL and request-header byte caps at their boundaries", async () => {
    const { compareHttp, CAPS } = await load();
    const good = httpFixture(Buffer.alloc(CAPS.response_bytes));
    expect(() => compareHttp(good.observed, good.sink)).not.toThrow();
    const excess = httpFixture(Buffer.alloc(CAPS.response_bytes + 1));
    expect(() => compareHttp(excess.observed, excess.sink)).toThrow("response_limit");
    const url = httpFixture(), prefix = "http://127.0.0.1:1234";
    url.sink.url = "/" + "x".repeat(CAPS.url_bytes - prefix.length - 1);
    url.observed.url = prefix + url.sink.url;
    expect(() => compareHttp(url.observed, url.sink)).not.toThrow();
    url.sink.url += "x"; url.observed.url += "x";
    expect(() => compareHttp(url.observed, url.sink)).toThrow("url_limit");
    const headers = httpFixture();
    headers.sink.headers.push("X-Excess", "x".repeat(CAPS.request_bytes));
    headers.observed.extra.headers["X-Excess"] = "x".repeat(CAPS.request_bytes);
    expect(() => compareHttp(headers.observed, headers.sink)).toThrow("request_limit");
  });

  it("correction 2: one real publisher enforces the exact deadline before and after IO", async () => {
    const { publishReport, assertDeadline } = await load();
    expect(() => assertDeadline(1000, "publication_deadline", 999)).not.toThrow();
    expect(() => assertDeadline(1000, "publication_deadline", 1000)).toThrow("publication_deadline");
    expect(() => assertDeadline(1000, "publication_deadline", 1001)).toThrow("publication_deadline");
    const root = await scratch();
    await chmod(root, 0o700);
    const result = publishReport(root, { fixed: "firstparty-unit" }, Date.now() + 60000);
    expect(result.completed_ms).toBeLessThan(result.deadline_ms);
    const expired = join(root, "expired"); await mkdir(expired, { mode: 0o700 });
    expect(() => publishReport(expired, { fixed: "firstparty-unit" }, Date.now() - 1))
      .toThrow("publication_deadline");
    await expect(readFile(join(expired, "report.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("correction 3: launch timeout is finite with ownership-settlement and cleanup reserves", async () => {
    const { launchSchedule } = await load();
    const now = Date.now();
    const schedule = launchSchedule(now, now);
    expect(schedule.timeout_ms).toBeGreaterThanOrEqual(1000);
    expect(schedule.timeout_ms).toBeLessThanOrEqual(12000);
    expect(schedule.deadline_ms + 5000).toBeLessThanOrEqual(now + 50000);
    expect(() => launchSchedule(now, now + 44000)).toThrow("launch_reserve");
  });

  it("correction 4: whole-CLI origin precedes module import and has one absolute budget", async () => {
    const { CLI_STARTED_MS, executionLimits, assertDeadline } = await load();
    expect(CLI_STARTED_MS).toBeLessThanOrEqual(performance.timeOrigin + 1);
    const limits = executionLimits(CLI_STARTED_MS);
    expect(limits.absolute_ms - CLI_STARTED_MS).toBe(60000);
    expect(limits.report_ms).toBeLessThan(limits.absolute_ms);
    expect(() => assertDeadline(limits.absolute_ms, "cli_deadline", limits.absolute_ms)).toThrow("cli_deadline");
  });

  it("craft: a reused PID, changed group, user or image is never the registered owned process", async () => {
    const { sameOwnedProcess } = await load();
    const expected = { pid: 100, pgid: 100, uid: 501, started: "fixed-birth", command_sha256: "fixed-image" };
    expect(sameOwnedProcess(expected, { ...expected, ppid: 1, state: "T" })).toBe(true);
    for (const change of [{ pid: 101 }, { pgid: 101 }, { uid: 0 }, { started: "new-birth" },
      { command_sha256: "new-image" }]) expect(sameOwnedProcess(expected, { ...expected, ...change })).toBe(false);
    expect(sameOwnedProcess(expected, null)).toBe(false);
  });

  it("craft: vanished-between-probe-and-signal is evidence, not a lost witness or success for unknown errors", async () => {
    const { signalDisposition } = await load();
    expect(signalDisposition(Object.assign(new Error("gone"), { code: "ESRCH" }))).toBe("vanished");
    expect(signalDisposition(Object.assign(new Error("denied"), { code: "EPERM" }))).toBe("unknown");
    expect(signalDisposition(null)).toBe("sent");
  });

  it("AC5: removing proof changes the rejection, not just a reported pass flag", async () => {
    const { qualifyCase } = await load();
    expect(() => qualifyCase({ vendor: "meta", workers: [], sinks: [{ url: "/sink/meta" }] }))
      .toThrow("worker_proof_missing");
    expect(() => qualifyCase({ vendor: "google", workers: [{ url: "/worker" }], traffic: [] }))
      .toThrow("worker_source_missing");
  });

  it("AC6: the read-only inspector rejects empty and report-only self-certification", async () => {
    const { inspectCapture } = await load();
    const root = await scratch();
    await expect(inspectCapture(root)).rejects.toThrow();
    await writeFile(join(root, "report.json"), JSON.stringify({
      schema: "airlock.chamber-capture.v1", qualified: true, command_exit_observed: true,
    }), { mode: 0o600 });
    await expect(inspectCapture(root)).rejects.toThrow();
    expect(JSON.parse(await readFile(join(root, "report.json"))).qualified).toBe(true);
  });

  it("AC7: exclusively creates private output and refuses existing/symlink paths before work", async () => {
    const { createPrivateOutput, CAPS } = await load();
    const root = await scratch();
    expect(CAPS).toEqual({ duration_ms: 60000, observed_requests: 64, url_bytes: 2048,
      request_bytes: 65536, response_bytes: 2097152, retained_bytes: 8388608 });
    const output = join(root, "new");
    createPrivateOutput(output);
    expect(() => createPrivateOutput(output)).toThrow("output_unavailable");
    await symlink(root, join(root, "alias"));
    expect(() => createPrivateOutput(join(root, "alias", "newer"))).toThrow("output_unavailable");
    expect(() => createPrivateOutput("relative")).toThrow("invalid_options");
  });

  describe.runIf(process.env.AIRLOCK_CHAMBER_QUALIFICATION === "1")("actual bounded CLI/browser controls", () => {
    it("craft: actual aborted producer leaves a stopped owned Chrome; parent escalates and observes full closure", async () => {
      const root = process.env.AIRLOCK_CHAMBER_OUTPUT_PARENT || await scratch();
      const { output, external, command, witness: whole } = await witnessedCommand(root, "producer-abort");
      expect(command.code).toBe(2);
      expect(whole.signal).toBeNull();
      expect(whole.timeout).toBe(false);
      expect(whole.duration_ms).toBeLessThanOrEqual(60000);
      expect(whole.source_after).toEqual(whole.source_before);
      const witness = JSON.parse(await readFile(join(output, "witness.json")));
      expect(witness.child.exit_code).toBeNull();
      expect(witness.child.signal).toBe("SIGKILL");
      expect(witness.owned_acquisitions[0].running_after_child).toBe(true);
      const cleanup = witness.parent_cleanup[0];
      expect(cleanup.initially_left_behind).toBe(true);
      expect(cleanup.status).toBe("closed");
      expect(cleanup.signals.some(row => row.signal === "SIGTERM" && row.outcome === "sent")).toBe(true);
      expect(cleanup.signals.some(row => row.signal === "SIGKILL" && row.outcome === "sent")).toBe(true);
      expect(cleanup.processes.every(row => row.final === "absent" || row.final === "zombie")).toBe(true);
      expect(cleanup.profile_removed).toBe(true);
      expect(cleanup.endpoint_closed).toBe(true);
      expect(cleanup.receiver_closed).toBe(true);
      await expect(readFile(cleanup.profile.path)).rejects.toMatchObject({ code: "ENOENT" });
      const originals = JSON.parse(await readFile(join(output, "abort-originals.json")));
      expect(originals.cases.filter(row => row.control === "positive")).toHaveLength(2);
      expect(originals.cleanup.browser_process_exited).toBe(false);
      const { inspectCapture } = await load();
      await expect(inspectCapture(output)).rejects.toThrow("child_completion");
      console.log(JSON.stringify({ output, external, actual_exit: command.code, child_signal: witness.child.signal,
        whole_cli_ms: whole.duration_ms, final_cleanup: cleanup.status, escalated: true }));
    }, 65000);

    it.each(["none", "cleanup-deadline", "publication-deadline"])(
      "observes actual child completion and %s on exact current sources", async control => {
        // Optional retained parent must already exist; never reuse an output.
        const root = process.env.AIRLOCK_CHAMBER_OUTPUT_PARENT || await scratch();
        const { output, external, command, witness: whole } = await witnessedCommand(root, control);
        expect(whole.source_after).toEqual(whole.source_before);
        expect(whole.timeout).toBe(false);
        expect(whole.signal).toBeNull();
        expect(whole.duration_ms).toBeLessThanOrEqual(60000);
        expect(command.code).toBe(control === "none" ? 0 : 2);
        const { inspectCapture } = await load();
        const result = await inspectCapture(output);
        expect(result.guard_qualification).toBe("PASS");
        expect(result.case_conclusive).toBe(control === "none");
        const witness = JSON.parse(await readFile(join(output, "witness.json")));
        expect(witness.child.exit_code).toBe(control === "none" ? 0 : 2);
        expect(witness.child.signal).toBeNull();
        expect(witness.child.timeout).toBe(false);
        expect(witness.observed_ms - witness.started_ms).toBeLessThanOrEqual(60000);
        const rawBytes = await readFile(join(output, "capture.json"));
        expect(witness.files["capture.json"]).toBe(hash(rawBytes));
        const raw = JSON.parse(rawBytes);
        expect(raw.cases.filter(row => row.control === "positive")).toHaveLength(2);
        expect(Object.values(raw.cleanup).every(value => value === true)).toBe(true);
        expect(raw.acquisitions).toHaveLength(2);
        const late = raw.acquisitions[1];
        expect(late.pending_at_timeout).toBe(true);
        expect(late.delivered_ms).toBeGreaterThanOrEqual(late.deadline_ms);
        expect(late.closed_ms).toBeGreaterThanOrEqual(late.deadline_ms);
        expect(late.settled_ms).toBeGreaterThanOrEqual(late.closed_ms);
        expect(late.pid).toBeGreaterThan(0);
        expect(witness.owned_acquisitions.every(row => row.running_after_child === false)).toBe(true);
        expect(result.native_qualified).toBe(false);
        console.log(JSON.stringify({ output, external, whole_cli_ms: whole.duration_ms,
          actual_exit: command.code, capture_sha256: hash(rawBytes),
          witness_sha256: hash(await readFile(join(output, "witness.json"))), cleanup: raw.cleanup }));
        if (control !== "none") {
          expect(raw.lifecycle.hold_started_ms).toBeGreaterThan(raw.lifecycle.browser_done_ms);
          expect(raw.lifecycle.expired_ms - raw.lifecycle.hold_started_ms).toBeGreaterThan(5000);
          return;
        }
        const table = [
          ...[["empty", ""], ["invalid", "!!!!"], ["noncanonical", "AB=="], ["short", "AP8="]]
            .map(([name, body]) => ["coordinated-" + name, data => {
              const c = data.cases[0], h = c.http.find(row => row.resource === "Fetch");
              h.response.body.base64 = body;
              c.sinks[0].response.body = body;
              c.receiver.find(row => row.url === c.sinks[0].url).response.body = body;
            }, ["empty", "short"].includes(name) ? "response_original_length" : "response_original_encoding"]),
          ["missing-pin", data => { data.identity.sources.pop(); }, "source_identity"],
          ["changed-pin", data => { data.identity.sources[0].sha256 = "0".repeat(64); }, "source_identity"],
          ["worker-proof", data => { data.cases[0].workers = []; }, "worker_proof_missing"],
          ["worker-source", data => { data.cases[0].workers[0].source = null; }, "worker_source_missing"],
          ["worker-traffic", data => { data.cases[0].worker_traffic = []; }, "worker_boundary_missing"],
          ["worker-url", data => { data.cases[0].workers[0].url += "?changed"; }, "worker_execution_missing"],
          ["event-link", data => { data.cases[0].input = ["undefined"]; }, "input_relationship"],
          ["original", data => { data.cases[0].http.find(row => row.resource === "Fetch").response.body = null; },
            "response_original_missing"],
          ["claims", data => { data.claims.native_qualified = true; }, "claims"],
          ["unknown-source", data => { data.cases[0].sources.push({ url: "http://127.0.0.1/unknown.js" }); },
            "source_closure"],
          ["cohort", data => { data.browser_version = "155.0.0.0"; }, "browser_cohort"],
          ["shape", data => { data.extra = true; }, "capture_shape"],
          ["cleanup-shape", data => { data.cleanup = {}; }, "cleanup_shape"],
          ["url-cap", data => { data.cases[0].http[0].url += "x".repeat(2049); }, "url_limit"],
          ["asset-graph", data => { data.assets[0].modules = []; }, "asset_graph"],
          ["main-proof-removal", data => { data.cases.find(row => row.control === "main-only").sinks = []; },
            "control_not_received"],
          ["source-proof-removal", data => { data.cases.find(row => row.control === "source-bypass").marker = null; },
            "source_control"],
        ];
        for (const [name, mutate, reason] of table) {
          const copy = join(root, `tamper-${name}-${Date.now()}`);
          await cp(output, copy, { recursive: true }); await chmod(copy, 0o700);
          const changed = structuredClone(raw); mutate(changed);
          const bytes = Buffer.from(JSON.stringify(changed));
          await writeFile(join(copy, "capture.json"), bytes, { mode: 0o600 });
          const changedWitness = structuredClone(witness);
          changedWitness.files["capture.json"] = hash(bytes);
          await writeFile(join(copy, "witness.json"), JSON.stringify(changedWitness), { mode: 0o600 });
          await expect(inspectCapture(copy), name).rejects.toThrow(reason);
        }
        const collision = await execute(process.execPath, [entry, "capture", "--output-dir", output])
          .catch(error => error);
        expect(collision.code).toBe(2);
        expect(hash(await readFile(join(output, "capture.json")))).toBe(hash(rawBytes));
        const badWitnessDir = join(root, `bad-witness-${Date.now()}`);
        await mkdir(badWitnessDir, { mode: 0o700 });
        await cp(output, badWitnessDir, { recursive: true });
        const bad = structuredClone(witness); bad.child.exit_code = 19;
        await writeFile(join(badWitnessDir, "witness.json"), JSON.stringify(bad), { mode: 0o600 });
        await expect(inspectCapture(badWitnessDir)).rejects.toThrow("child_completion");
        const digestDir = join(root, `bad-digest-${Date.now()}`);
        await cp(output, digestDir, { recursive: true });
        await writeFile(join(digestDir, "capture.json"), Buffer.concat([rawBytes, Buffer.from(" ")]),
          { mode: 0o600 });
        await expect(inspectCapture(digestDir)).rejects.toThrow("raw_digest:capture.json");
        const excessDir = join(root, `excess-originals-${Date.now()}`);
        await cp(output, excessDir, { recursive: true });
        await writeFile(join(excessDir, "extra-original.bin"), Buffer.alloc(8388608), { mode: 0o600 });
        await expect(inspectCapture(excessDir)).rejects.toThrow("retention_limit");
      }, 65000,
    );
  });
});
