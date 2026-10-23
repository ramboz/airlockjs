import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn(), writeSync: vi.fn(), fstatSync: vi.fn(),
  fsyncSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:process", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const storage = new AsyncLocalStorage();
  const base = { argv: [], env: {}, pid: 10, ppid: 9, platform: "darwin", arch: "arm64", version: "v22.16.0",
    execPath: "/source-fixture/node", hrtime: { bigint: vi.fn(() => 100000000n) }, getuid: () => 501 };
  const proxy = new Proxy(base, { get(_target, key) {
    const role = storage.getStore() ?? base;
    if (["on", "once", "emit", "removeListener", "removeAllListeners"].includes(key)) return role.bus[key].bind(role.bus);
    return role[key];
  }, set(_target, key, value) { (storage.getStore() ?? base)[key] = value; return true; } });
  return { default: proxy, namespaceTestStorage: storage, namespaceTestBase: base };
});
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("OS_PROCESS_FORBIDDEN"); }) }));
vi.mock("node:perf_hooks", async () => {
  const { namespaceTestStorage } = await import("node:process");
  return { performance: { now: vi.fn(() => namespaceTestStorage.getStore()?.guestNow ?? 9000000) } };
});
vi.mock("node:readline", () => ({ createInterface: vi.fn() }));
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); }) }));
vi.mock("./sdk-absent-owned-namespace-admission.mjs", () => ({ requireOwnedNamespaceRuntimeAdmission: vi.fn() }));
vi.mock("./sdk-absent-owned-namespace-image-admission.mjs", async () => {
  const { default: process } = await import("node:process");
  return {
    requireOwnedNamespaceImageClockContract: vi.fn(), // The unframed proof boundary ONLY is mocked.
    assertOwnedNamespacePayloadContext: vi.fn(() => {
      if (process.platform !== "linux" || process.arch !== "arm64" || process.version !== "v24.10.0" || process.pid <= 1
        || !/^[a-z0-9-]{1,48}$/.test(process.env.AIRLOCK_CASE ?? "")
        || !/^[a-f0-9]{64}$/.test(process.env.AIRLOCK_NONCE ?? "")) throw Error("namespace_direct_payload_context_refused");
      return { case_id: process.env.AIRLOCK_CASE, nonce: process.env.AIRLOCK_NONCE };
    }),
  };
});
import { namespaceTestStorage as context, namespaceTestBase as base } from "node:process";
import { EventEmitterAsyncResource } from "node:events";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createInterface } from "node:readline";
import { runOwnedNamespacePublicEntry } from "./sdk-absent-owned-namespace-entry.mjs";
import { runOwnedNamespaceSupervisorEntry } from "./sdk-absent-owned-namespace-actors.mjs";
import { runOwnedNamespaceWorkerEntry } from "./sdk-absent-owned-namespace-worker.mjs";
import { startOwnedNamespaceInit } from "./sdk-absent-owned-namespace-init.mjs";
import { runOwnedNamespacePayload } from "./sdk-absent-owned-namespace-payload.mjs";
import { ownedNamespaceExpectedProjection } from "./sdk-absent-owned-namespace-wire.mjs";
import { namespacePlanEvidence, prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";
import { inspectOwnedNamespaceCompletion, ownedNamespaceWholeCommand } from "./sdk-absent-owned-namespace-consumer.mjs";
import { fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { CID, NONCE, ROOT, bytesHash, descriptors, files, installSourceFixtureFs, put } from "./sdk-absent-owned-namespace-actors.fixture.mjs";
import { data } from "./inspected-meta-record.mjs";
import { fileURLToPath } from "node:url";

let metadata, calls, state, guest, result, failure, rootProcess, caseControl, lateStartAfterStop;
const actualArgv = ["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"];
const flush = async () => { for (let n = 0; n < 1200; n++) await Promise.resolve(); };
const plan = () => prepareOwnedNamespacePlan({ case_id: "source-case-01", nonce: NONCE, root: ROOT });
class Port extends EventEmitterAsyncResource {
  constructor() { super({ name: "namespace-source-fake-port" }); this.closed = false; }
  destroy() { if (!this.closed) { this.closed = true; this.emit("close"); } }
}
function child() {
  const c = new Port();
  c.stdout = new Port(); c.stderr = new Port(); c.stdin = new Port(); c.connected = true;
  c.stdin.write = vi.fn((_bytes, callback) => { callback?.(); return true; });
  c.stdin.end = vi.fn(() => c.stdin.destroy());
  c.kill = vi.fn(() => { throw Error("SIGNALS_FORBIDDEN"); });
  c.close = (code = 0) => {
    if (c.closed) return;
    c.closed = true; c.stdout.emit("end"); c.stderr.emit("end");
    c.stdout.destroy(); c.stderr.destroy(); c.stdin.destroy(); c.emit("close", code, null);
  };
  return c;
}
function role(name, parent = null, env = {}) {
  const r = { ...base, name, argv: [], env, pid: name === "init" ? 1 : name === "payload" ? 2 : 100,
    ppid: 1, platform: ["init", "payload"].includes(name) ? "linux" : "darwin",
    version: ["init", "payload"].includes(name) ? "v24.10.0" : "v22.16.0", connected: !!parent, exitCode: 0, guestNow: 9000000,
    output: [], errors: [] };
  context.run(r, () => { r.bus = new Port(); });
  r.stdout = { write: vi.fn(bytes => { r.output.push(Buffer.from(bytes)); parent?.stdout.emit("data", Buffer.from(bytes)); return true; }) };
  r.stderr = { write: vi.fn(bytes => { r.errors.push(Buffer.from(bytes)); parent?.stderr.emit("data", Buffer.from(bytes)); return true; }) };
  r.send = vi.fn((message, callback) => { parent.emit("message", message); callback?.(); });
  r.disconnect = vi.fn(() => {
    r.connected = false;
    if (parent) { parent.connected = false; parent.emit("disconnect"); queueMicrotask(() => parent.close(r.exitCode)); }
  });
  r.exit = vi.fn(code => { r.exitCode = code; queueMicrotask(() => parent?.close(code)); });
  return r;
}
function dispatch(executable, argv, options) {
  const owner = context.getStore(), c = child();
  const call = { executable, argv, options, owner: owner?.name, child: c }; calls.push(call);
  if (executable === "/source-fixture/docker") {
    const kind = argv[4]; call.kind = kind;
    if (kind === "start") {
      if (caseControl === "worker-loss-before-init") return c;
      const create = calls.find(row => row.kind === "create");
      const value = key => create.argv.find(arg => arg.startsWith("--env=" + key + "="))?.slice(("--env=" + key + "=").length);
      state = "running"; guest = role("init", c, { AIRLOCK_CASE: value("AIRLOCK_CASE"), AIRLOCK_NONCE: value("AIRLOCK_NONCE"),
        DOCKER_HOST: "tcp://untrusted.invalid:2375" });
      c.stdin.write.mockImplementation((bytes, callback) => {
        callback?.();
        queueMicrotask(() => context.run(guest, () => guest.reader.emit("line", String(bytes).trimEnd())));
        return true;
      });
      queueMicrotask(() => context.run(guest, () => {
        try { startOwnedNamespaceInit(); } catch (e) { failure = e; c.stderr.emit("data", Buffer.from(e.message)); c.close(2); }
      }));
      return c;
    }
    queueMicrotask(() => {
      let stdout;
      if (kind === "info") stdout = JSON.stringify(metadata.adapter_contract.engine_info) + "\n";
      else if (kind === "create" || kind === "rm") stdout = CID + "\n";
      else if (kind === "inspect") {
        const create = calls.find(row => row.kind === "create");
        const env = [...create.argv.filter(arg => arg.startsWith("--env=")).map(arg => arg.slice(6)),
          ...metadata.adapter_contract.image_env];
        const expected = '"EnvMatches":{{eq (json .Config.Env) ' + JSON.stringify(JSON.stringify(env)) + "}}";
        const projection = ownedNamespaceExpectedProjection(plan(), CID, state);
        projection.EnvMatches = argv[7].includes(expected);
        stdout = JSON.stringify(projection) + "\n";
      }
      else if (kind === "stop") { state = "exited"; stdout = CID + "\n"; }
      else if (kind === "wait") stdout = "0\n";
      else throw Error("UNEXPECTED_FIXED_DOCKER_COMMAND:" + kind);
      c.stdout.emit("data", Buffer.from(stdout)); c.close(0);
      const start = calls.find(row => row.kind === "start");
      if (kind === "stop" && caseControl === "worker-loss-before-init" && !start.child.closed)
        queueMicrotask(() => {
          if (lateStartAfterStop) state = "running";
          start.child.close(0);
        });
    });
    return c;
  }
  if (argv[0].endsWith("namespace-actors.mjs") || argv[0].endsWith("namespace-worker.mjs")) {
    const isS = argv[0].endsWith("namespace-actors.mjs"), r = role(isS ? "S" : "W", c, options.env);
    call.process = r;
    c.send = vi.fn((message, callback) => { queueMicrotask(() => r.bus.emit("message", message)); callback?.(); });
    queueMicrotask(() => context.run(r, () => {
      try {
        if (isS) runOwnedNamespaceSupervisorEntry(argv.slice(1)).catch(e => { failure = e; c.close(2); });
        else runOwnedNamespaceWorkerEntry(argv.slice(1));
      } catch (e) { failure = e; c.close(2); }
    }));
    return c;
  }
  if (executable === "/usr/local/bin/node" && argv[0].endsWith("namespace-payload.mjs")) {
    call.kind = "payload";
    const r = role("payload", c, options.env);
    queueMicrotask(() => context.run(r, () => {
      try { runOwnedNamespacePayload(argv.slice(1)); state = "exited"; c.close(0); }
      catch (e) { failure = e; state = "exited"; c.close(2); }
    }));
    return c;
  }
  throw Error("UNEXPECTED_SUBPROCESS_BOUNDARY");
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  base.hrtime.bigint.mockReturnValue(100000000n);
  metadata = installSourceFixtureFs(); calls = []; state = "created"; guest = null; result = null; failure = null;
  caseControl = "normal";
  lateStartAfterStop = false;
  rootProcess = role("P");
  spawn.mockImplementation(dispatch);
  createInterface.mockImplementation(() => {
    const r = context.getStore(), reader = new Port(); reader.close = () => reader.emit("close");
    r.reader = reader; return reader;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
async function executePipeline(control = "normal") {
  caseControl = control;
  context.run(rootProcess, () => {
    runOwnedNamespacePublicEntry([...actualArgv.slice(0, -1), control])
      .then(value => { result = value; }).catch(e => { failure = e; });
  });
  await flush();
}
function externalCompletion() {
  const p = namespacePlanEvidence(plan());
  put(ROOT + "/p-output.json", Buffer.concat(rootProcess.output));
  const external = { schema: "airlock.owned-namespace-whole-command-completion.v2",
    observer_scope: "external-whole-P-command-after-close", command: JSON.parse(files.get(ROOT + "/p-owner.json").bytes).command,
    case_id: p.case_id, source_sha256: p.source_sha256, cohort_sha256: p.cohort_sha256,
    exit_observed: true, actual_exit_code: rootProcess.exitCode, signal: null, timed_out: false,
    started_monotonic_ms: JSON.parse(files.get(ROOT + "/launch-request.json").bytes).started_monotonic_ms,
    completed_monotonic_ms: Math.max(300, JSON.parse(files.get(ROOT + "/p-s-close-candidate.json").bytes).completed_monotonic_ms + 200),
    publication_closed_monotonic_ms: Math.max(250, JSON.parse(files.get(ROOT + "/p-s-close-candidate.json").bytes).completed_monotonic_ms + 100),
    observer_streams_settled: true, observer_queries_settled: true, supervisor_lost: false,
    p_output: fixedRead(ROOT + "/p-output.json").handle, errors: [], scope: "UNQUALIFIED_SOURCE_EXECUTOR", qualified: false };
  put(ROOT + "/external-completion.json", JSON.stringify(external));
  return { external, completion: fixedRead(ROOT + "/external-completion.json").handle };
}
function rewriteExternal(f) {
  put(ROOT + "/external-completion.json", JSON.stringify(f.external));
  f.completion = fixedRead(ROOT + "/external-completion.json").handle;
}
function rewriteOutput(f, change) {
  const output = JSON.parse(files.get(ROOT + "/p-output.json").bytes);
  change(output); put(ROOT + "/p-output.json", JSON.stringify(output));
  f.external.p_output = fixedRead(ROOT + "/p-output.json").handle; rewriteExternal(f);
}
function rewriteSClose(f, change) {
  const value = JSON.parse(files.get(ROOT + "/p-s-close-candidate.json").bytes);
  change(value); put(ROOT + "/p-s-close-candidate.json", JSON.stringify(value));
  rewriteOutput(f, output => { output.S_close_candidate = fixedRead(ROOT + "/p-s-close-candidate.json").handle; });
}
function rewriteActor(f, change) {
  const value = JSON.parse(files.get(ROOT + "/case/actor-result.json").bytes);
  change(value); put(ROOT + "/case/actor-result.json", JSON.stringify(value));
  rewriteSClose(f, sc => { sc.candidate = fixedRead(ROOT + "/case/actor-result.json").handle; });
}
function rewriteFrames(actor, change) {
  const op = actor.operations.find(o => o.kind === "start");
  const frames = op.stdout.slice(0, -1).split("\n").map(line => JSON.parse(line));
  change(frames);
  const bytes = Buffer.from(frames.map(frame => JSON.stringify(frame)).join("\n") + "\n");
  op.stdout = bytes.toString("utf8"); op.stdout_original_base64 = bytes.toString("base64"); op.stdout_sha256 = bytesHash(bytes);
}
const inspect = f => inspectOwnedNamespaceCompletion(plan(), { completion: f.completion });
describe("SOURCE/PURE complete P/S/W/init/payload execution with subprocess boundaries mocked", () => {
  it("carries an alternate explicit owned endpoint and canonical client through custody and independent consumption", async () => {
    put("/source-fixture/desktop.sock", "", 0o140600);
    metadata.endpoint = "unix:///source-fixture/desktop.sock";
    metadata.endpoint_original = { path: "/source-fixture/desktop.sock", dev: 1,
      ino: files.get("/source-fixture/desktop.sock").ino, uid: 501, mode: 0o140600, mtime_ms: 100, ctime_ms: 100 };
    put(fileURLToPath(new URL("sdk-absent-owned-namespace-cohort.json", import.meta.url)), JSON.stringify(metadata), 0o100644);
    await executePipeline(); expect(failure).toBeNull(); expect(result.errors).toEqual([]);
    for (const c of calls.filter(c => c.kind && c.kind !== "payload")) {
      expect(c.executable).toBe("/source-fixture/docker");
      expect(c.argv.slice(2, 4)).toEqual(["--host", "unix:///source-fixture/desktop.sock"]);
      expect(c.options.env.DOCKER_HOST).toBe("unix:///source-fixture/desktop.sock");
    }
    expect(inspect(externalCompletion())).toMatchObject({ source_execution_evidence_valid: true, qualified: false });
  });
  it.each(["inode", "uid", "mode"])("refuses changed socket %s before independent consumption", async change => {
    await executePipeline(); const completion = externalCompletion(), retained = plan();
    const socket = files.get("/var/run/docker.sock");
    if (change === "inode") socket.ino++;
    if (change === "uid") socket.uid++;
    if (change === "mode") socket.mode = 0o140660;
    expect(inspectOwnedNamespaceCompletion(retained, { completion: completion.completion }).source_execution_evidence_valid).toBe(false);
    expect(() => plan()).toThrow();
  });
  it("F3 actual init-to-payload execution carries exactly its case and nonce, not an injected init success", async () => {
    await executePipeline();
    const payload = calls.find(c => c.kind === "payload");
    expect(payload).toBeDefined();
    expect(payload.options.env).toEqual({ PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_CASE: "source-case-01", AIRLOCK_NONCE: NONCE });
    expect(failure).toBe(null);
    const actor = JSON.parse(files.get(ROOT + "/case/actor-result.json")?.bytes ?? "{}");
    expect(result?.errors, JSON.stringify({ actor_errors: actor.errors, worker: actor.worker })).toEqual([]);
    expect(guest.exit).toHaveBeenCalledWith(0);
    expect(rootProcess.exitCode).toBe(0);
    expect(calls.every(c => !c.child.kill.mock.calls.length)).toBe(true);
  });
  it("F4 expected whole command is the actual fixed public entry with complete closed argv", async () => {
    await executePipeline();
    const command = JSON.parse(files.get(ROOT + "/p-owner.json").bytes).command;
    expect(ownedNamespaceWholeCommand(plan(), "normal")).toEqual(command);
  });
  it("F4 strict consumption replays actual P output, S originals and independently mocked whole-command close", async () => {
    await executePipeline();
    expect(failure).toBe(null); expect(result?.errors).toEqual([]);
    const f = externalCompletion();
    expect(inspectOwnedNamespaceCompletion(plan(), { completion: f.completion })).toMatchObject({
      qualified: false, source_execution_evidence_valid: true, external_completion_valid: true,
      runtime_provenance_qualified: false, clock_provenance: "UNPROVED",
    });
  });
  it.each(["inert-model-entry", "missing-closed-argv", "wrong-control"])("F4 rejects %s despite complete actual originals", async change => {
    await executePipeline(); const f = externalCompletion();
    if (change === "inert-model-entry") f.external.command[1] = f.external.command[1].replace("-entry.mjs", ".mjs");
    else if (change === "missing-closed-argv") f.external.command = f.external.command.slice(0, 4);
    else f.external.command[6] = "worker-loss-before-init";
    rewriteExternal(f);
    expect(inspect(f)).toMatchObject({ qualified: false, source_execution_evidence_valid: false, external_completion_valid: false });
  });
  it.each([
    { actual_exit_code: 2 }, { exit_observed: false }, { observer_streams_settled: false },
    { observer_queries_settled: false }, { supervisor_lost: true }, { timed_out: true }, { signal: "SIGTERM" },
    { completed_monotonic_ms: 45100 }, { publication_closed_monotonic_ms: 301 }, { started_monotonic_ms: 101 },
  ])("F4 rejects missing/failed/late original whole-command close %j", async change => {
    await executePipeline(); const f = externalCompletion();
    Object.assign(f.external, change); rewriteExternal(f);
    expect(inspect(f).source_execution_evidence_valid).toBe(false);
  });
  it("F4 rejects historical model artifacts with no automatic model fallback", async () => {
    await executePipeline(); const f = externalCompletion();
    rewriteOutput(f, output => {
      delete output.S_close_candidate;
      output.schema = "airlock.owned-namespace-candidate.v1"; output.scope = "SOURCE_PURE_MODEL_ONLY";
    });
    expect(inspect(f)).toMatchObject({ qualified: false, source_execution_evidence_valid: false, source_model_evidence_valid: false });
  });
  it("F4 rejects model candidate.json references even when their original hashes are recomputed", async () => {
    await executePipeline(); const f = externalCompletion();
    put(ROOT + "/case/candidate.json", '{"schema":"airlock.owned-namespace-candidate.v1","qualified":false}');
    rewriteSClose(f, sc => { sc.candidate = fixedRead(ROOT + "/case/candidate.json").handle; });
    expect(inspect(f).reason).toBe("namespace_actual_artifact_scope");
  });
  it("F4 does not accept P's S-close candidate as whole-P-command completion", async () => {
    await executePipeline(); const f = externalCompletion();
    put(ROOT + "/external-completion.json", files.get(ROOT + "/p-s-close-candidate.json").bytes);
    f.completion = fixedRead(ROOT + "/external-completion.json").handle;
    expect(inspect(f).external_completion_valid).toBe(false);
  });
  it.each(["pending-daemon", "unsettled-stdin", "foreign-client-env", "original-byte-hash", "renewed-permit", "model-ledger"])(
    "F4 replays nested actual source receipts and rejects %s despite updated outer hashes", async change => {
      await executePipeline(); const f = externalCompletion();
      rewriteActor(f, actor => {
        if (change === "pending-daemon") actor.operations[0].daemon = "PENDING";
        else if (change === "unsettled-stdin") actor.continuations[0].settled = false;
        else if (change === "foreign-client-env") actor.operations[0].env.DOCKER_HOST = "tcp://untrusted.invalid:2375";
        else if (change === "original-byte-hash") actor.operations[0].stdout_sha256 = "f".repeat(64);
        else if (change === "renewed-permit") actor.continuations[0].message.total_remaining_ms = 45001;
        else actor.scope = "SOURCE_PURE_MODEL_ONLY";
      });
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
  it("F4 rejects absent external completion and truncated original P output", async () => {
    await executePipeline(); const f = externalCompletion();
    expect(inspectOwnedNamespaceCompletion(plan(), { completion: null }).external_completion_valid).toBe(false);
    put(ROOT + "/p-output.json", '{"qualified":false');
    f.external.p_output = fixedRead(ROOT + "/p-output.json").handle; rewriteExternal(f);
    expect(inspect(f).source_execution_evidence_valid).toBe(false);
  });
  it.each(["armed-before-hello", "payload-before-armed", "close-before-marker", "duplicate-marker", "duplicate-hello"])(
    "R2 rejects refreshed-hash raw transcript %s by semantic replay", async change => {
      await executePipeline(); const f = externalCompletion();
      rewriteActor(f, actor => rewriteFrames(actor, frames => {
        if (change === "armed-before-hello") [frames[0], frames[1]] = [frames[1], frames[0]];
        else if (change === "payload-before-armed") [frames[1], frames[2]] = [frames[2], frames[1]];
        else if (change === "close-before-marker") [frames[2], frames[3]] = [frames[3], frames[2]];
        else if (change === "duplicate-marker") frames.splice(3, 0, { ...frames[2] });
        else frames.splice(1, 0, { ...frames[0] });
      }));
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
  it.each(["work-only", "total-only", "both", "relationship"])(
    "R3 rejects within-45s %s ARM alteration with raw and outer hashes refreshed", async change => {
      await executePipeline(); const f = externalCompletion();
      rewriteActor(f, actor => {
        const c = actor.continuations[0];
        expect(c.message).toMatchObject({ work_remaining_ms: 34550, total_remaining_ms: 44450 });
        if (change === "work-only" || change === "both") c.message.work_remaining_ms = 35000;
        if (change === "total-only" || change === "both") c.message.total_remaining_ms = 45000;
        if (change === "relationship") c.message.work_remaining_ms -= 100;
        if ("wire_base64" in c) {
          const bytes = Buffer.from(JSON.stringify(data(c.message)) + "\n");
          c.wire_base64 = bytes.toString("base64"); c.wire_sha256 = bytesHash(bytes);
        }
      });
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
  it("R2 rejects a WORK continuation that claims issuance before the ARMED stage", async () => {
    await executePipeline(); const f = externalCompletion();
    rewriteActor(f, actor => { actor.continuations[1].after_init_frame = 1; });
    expect(inspect(f).reason).toBe("namespace_actual_permit_causality");
  });
  it("R2 rejects a permit timestamp later than its actual start-client close", async () => {
    await executePipeline(); const f = externalCompletion();
    rewriteActor(f, actor => { actor.continuations[1].issued_ms = 101; });
    expect(inspect(f).reason).toBe("namespace_actual_permit_unsettled");
  });
  it("R1 final S_RESULT rechecks custody after awaited actor completion", async () => {
    const read = fs.readFileSync.getMockImplementation(); let replaced = false;
    fs.readFileSync.mockImplementation(fd => {
      const value = read(fd);
      if (!replaced && descriptors.get(fd)?.endsWith("/case/actor-result.json")) {
        replaced = true; queueMicrotask(() => put(ROOT + "/docker-config/config.json", "{} "));
      }
      return value;
    });
    await executePipeline();
    expect(replaced).toBe(true);
    const s = calls.find(c => c.argv[0].endsWith("namespace-actors.mjs"));
    expect(s.process.send).not.toHaveBeenCalled();
    expect(failure?.message).toBe("namespace_source_changed");
    expect(rootProcess.output).toHaveLength(0);
  });
  it("R1 final P output rechecks custody after awaited S-close publication", async () => {
    const read = fs.readFileSync.getMockImplementation(); let replaced = false;
    fs.readFileSync.mockImplementation(fd => {
      const value = read(fd);
      if (!replaced && descriptors.get(fd)?.endsWith("/p-s-close-candidate.json")) {
        replaced = true; queueMicrotask(() => put(ROOT + "/docker-config/config.json", "{} "));
      }
      return value;
    });
    await executePipeline();
    expect(replaced).toBe(true);
    expect(failure?.message).toBe("namespace_source_changed");
    expect(rootProcess.output).toHaveLength(0);
  });
  it("R1 P output after the original fence is diagnostic failure, not a fresh successful case", async () => {
    const read = fs.readFileSync.getMockImplementation(); let delayed = false;
    fs.readFileSync.mockImplementation(fd => {
      const value = read(fd);
      if (!delayed && descriptors.get(fd)?.endsWith("/p-s-close-candidate.json")) {
        delayed = true; queueMicrotask(() => base.hrtime.bigint.mockReturnValue(45101000000n));
      }
      return value;
    });
    await executePipeline();
    expect(delayed).toBe(true);
    expect(result?.timed_out).toBe(true);
    expect(result?.errors).toContain("original_total_fence_expired_before_P_output");
    expect(rootProcess.exitCode).toBe(2);
    expect(result?.qualified).toBe(false);
  });
  it.each(["start-after-wait-remove", "wait-after-remove", "state-inspect-after-wait", "stop-after-state-inspect",
    "prestart-inspect-after-start", "create-after-prestart-inspect", "pre-remove-probe-after-remove"])(
    "CRAFT DAG rejects inside-fence %s chronology with all outer hashes refreshed", async change => {
      await executePipeline(); const f = externalCompletion();
      rewriteActor(f, actor => {
        const start = actor.operations.find(o => o.kind === "start");
        const remove = actor.operations.find(o => o.kind === "remove");
        const pre = actor.operations.filter(o => o.kind === "inspect-cid" && o.id < start.id);
        const post = actor.operations.filter(o => o.kind === "inspect-cid" && o.id > start.id);
        const target = change === "start-after-wait-remove" ? start : change === "wait-after-remove"
          ? actor.operations.find(o => o.kind === "wait") : change === "state-inspect-after-wait"
            ? post[0] : change === "stop-after-state-inspect" ? actor.operations.find(o => o.kind === "stop")
              : change === "prestart-inspect-after-start" ? pre.at(-1) : change === "create-after-prestart-inspect"
                ? actor.operations.find(o => o.kind === "create") : actor.operations[remove.id - 2];
        expect(target.kind).not.toBe("remove");
        target.close_ms = 150;
      });
      rewriteSClose(f, sc => { sc.completed_monotonic_ms = 200; });
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
  it("CRAFT zero-HELLO W-loss executes actual SOURCE actor→P output→consumer without a model candidate", async () => {
    await executePipeline("worker-loss-before-init");
    expect(failure).toBe(null); expect(result?.errors).toEqual([]);
    const actor = JSON.parse(files.get(ROOT + "/case/actor-result.json").bytes);
    expect(actor.worker_loss_phase).toBe("pending-start-before-init");
    expect(actor.operations.find(o => o.kind === "start").stdout).toBe("");
    expect(actor.continuations).toEqual([]);
    expect(guest).toBe(null);
    const f = externalCompletion();
    expect(inspect(f)).toMatchObject({
      qualified: false, runtime_provenance_qualified: false, source_execution_evidence_valid: true, external_completion_valid: true,
    });
  });
  it("CRAFT actual source chronology with nonconstant S-domain ticks remains a valid unqualified receipt", async () => {
    let host = 100;
    base.hrtime.bigint.mockImplementation(() => BigInt(host++) * 1000000n);
    await executePipeline();
    expect(failure).toBe(null); expect(result?.errors).toEqual([]);
    expect(inspect(externalCompletion())).toMatchObject({ source_execution_evidence_valid: true, qualified: false });
  });
  it.each(["missing-start-settlement", "unsettled-stream", "wait-after-remove", "expired-outer", "truncated-json", "blank-frame"])(
    "CRAFT zero-frame exception still rejects %s", async change => {
      await executePipeline("worker-loss-before-init"); const f = externalCompletion();
      if (change === "expired-outer") {
        f.external.completed_monotonic_ms = 45100; rewriteExternal(f);
      } else rewriteActor(f, actor => {
        const start = actor.operations.find(o => o.kind === "start");
        if (change === "missing-start-settlement") start.daemon = "PENDING";
        else if (change === "unsettled-stream") start.streams_settled = false;
        else if (change === "wait-after-remove") actor.operations.find(o => o.kind === "wait").close_ms = 150;
        else {
          const bytes = Buffer.from(change === "blank-frame" ? "\n" : '{"type":"HELLO"');
          start.stdout = bytes.toString("utf8"); start.stdout_original_base64 = bytes.toString("base64");
          start.stdout_sha256 = bytesHash(bytes);
        }
      });
      if (change === "wait-after-remove") rewriteSClose(f, sc => { sc.completed_monotonic_ms = 200; });
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
  it("CRAFT late-start source path permits stop while start is pending, then settles before wait/removal", async () => {
    let host = 100;
    base.hrtime.bigint.mockImplementation(() => BigInt(host++) * 1000000n);
    lateStartAfterStop = true;
    await executePipeline("worker-loss-before-init");
    expect(failure).toBe(null); expect(result?.errors).toEqual([]);
    const actor = JSON.parse(files.get(ROOT + "/case/actor-result.json").bytes);
    const start = actor.operations.find(o => o.kind === "start"), stop = actor.operations.find(o => o.kind === "stop");
    const wait = actor.operations.find(o => o.kind === "wait"), remove = actor.operations.find(o => o.kind === "remove");
    expect(stop.issued_ms).toBeLessThan(start.close_ms);
    expect(start.close_ms).toBeLessThan(wait.issued_ms);
    expect(wait.close_ms).toBeLessThan(remove.issued_ms);
    expect(actor.operations.some(o => o.kind === "stop-after-late-start")).toBe(true);
    expect(inspect(externalCompletion())).toMatchObject({ source_execution_evidence_valid: true, qualified: false });
  });
  it.each(["late-stop-after-final-inspect", "final-inspect-after-wait", "late-branch-exited-first-observation"])(
    "CRAFT finite late-start dependency replay rejects %s", async change => {
      lateStartAfterStop = true;
      await executePipeline("worker-loss-before-init"); const f = externalCompletion();
      rewriteActor(f, actor => {
        const late = actor.operations.find(o => o.kind === "stop-after-late-start");
        const first = actor.operations.find(o => o.kind === "inspect-cid" && o.id > actor.operations.find(o => o.kind === "start").id);
        const last = actor.operations.find(o => o.kind === "inspect-cid" && o.id > late.id);
        if (change === "late-stop-after-final-inspect") late.close_ms = 150;
        else if (change === "final-inspect-after-wait") last.close_ms = 150;
        else {
          const projection = JSON.parse(first.stdout);
          projection.State.Status = "exited"; projection.State.Running = false;
          const bytes = Buffer.from(JSON.stringify(projection) + "\n");
          first.stdout = bytes.toString("utf8"); first.stdout_original_base64 = bytes.toString("base64");
          first.stdout_sha256 = bytesHash(bytes);
        }
      });
      rewriteSClose(f, sc => { sc.completed_monotonic_ms = 200; });
      expect(inspect(f).source_execution_evidence_valid).toBe(false);
    });
});
