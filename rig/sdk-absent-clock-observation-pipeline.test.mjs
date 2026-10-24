import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn(), writeSync: vi.fn(), fstatSync: vi.fn(),
  fsyncSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:process", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage();
  const base = { argv: [], env: {}, pid: 100, ppid: 99, platform: "darwin", arch: "arm64",
    version: "v22.16.0", execPath: "/source-fixture/node", getuid: () => 501 };
  const proxy = new Proxy(base, {
    get(_target, key) {
      const p = context.getStore() ?? base;
      if (["on", "once", "removeListener"].includes(key)) return p.bus[key].bind(p.bus);
      return p[key];
    },
    set(_target, key, value) { (context.getStore() ?? base)[key] = value; return true; },
  });
  return { default: proxy, clockTestContext: context, clockTestBase: base };
});
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("OS_FORBIDDEN"); }) }));
vi.mock("node:crypto", async original => ({
  ...await original(), randomBytes: vi.fn(() => { throw Error("OS_ENTROPY_FORBIDDEN"); }),
}));
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); }) }));
vi.mock("./sdk-absent-clock-observation-admission.mjs", () => ({
  requireClockObservationRuntime: vi.fn(), requireClockObservationH: vi.fn(), requireClockObservationImage: vi.fn(),
}));

import { EventEmitterAsyncResource } from "node:events";
import { clockTestBase as base, clockTestContext as context } from "node:process";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { Script } from "node:vm";
import { runClockObservationEntry } from "./sdk-absent-clock-observation-entry.mjs";
import { runClockObservationOuter } from "./sdk-absent-clock-observation-outer.mjs";
import { runClockObservationProducer } from "./sdk-absent-clock-observation-producer.mjs";
import { runClockObservationSupervisor } from "./sdk-absent-clock-observation-supervisor.mjs";
import { CLOCK_OBSERVATION_PROGRAM } from "./sdk-absent-clock-observation-program.mjs";
import { inspectClockObservation } from "./sdk-absent-clock-observation-reader.mjs";
import { CLOCK_OBSERVATION_SOURCES, clockObservationPlanEvidence, prepareClockObservationPlan } from "./sdk-absent-clock-observation-plan.mjs";
import { data } from "./inspected-meta-record.mjs";
import { requireClockObservationRuntime } from "./sdk-absent-clock-observation-admission.mjs";
import { observationRead, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { ns } from "./sdk-absent-clock-observation-protocol.mjs";
import { clockObservationCompletionOriginal } from "./sdk-absent-clock-observation-observer.mjs";
import { collectObservationChild } from "./sdk-absent-clock-observation-streams.mjs";

const ROOT = "/source-fixture/clock-observation", CID = "c".repeat(64);
const hash = b => createHash("sha256").update(b).digest("hex");
const files = new Map(), fds = new Map();
const openedObjects = new Map(), pendingSync = new Map();
let ino, fd, calls, publications, roles, facts, result, failure, state, switches;
let expectedEndpoint;
let createdConfig;
let guestExit;
// Literal oracle, independent of production hash/command builders and of the
// refreshable source-facts fixture. VM execution below also checks semantics.
const PROGRAM_SHA256 = "9ee66c906a3d8e0120909697b692a50075e08659d7335b8224432dc0b4e969da";
const COMMAND_SHA256 = "e866168e6423612ea99abb6f267e58bdb0a6fb1a5a88c8e34e5152cb3a9b4c05";
const fixedCommand = ["--input-type=module", "--eval", CLOCK_OBSERVATION_PROGRAM];
function independentProgramCommand(command) {
  expect(command).toEqual(fixedCommand);
  expect(hash(command[2])).toBe(PROGRAM_SHA256);
  expect(hash(JSON.stringify(command))).toBe(COMMAND_SHA256);
}
const flush = async () => { for (let n = 0; n < 1800; n++) await Promise.resolve(); };
class Port extends EventEmitterAsyncResource {
  constructor() { super({ name: "clock-observation-boundary-double" }); this.closed = false; }
  destroy() { if (!this.closed) { this.closed = true; this.emit("close"); } }
}
function put(path, bytes, mode = 0o100600) {
  bytes = Buffer.from(bytes);
  files.set(path, { bytes, dev: 1, ino: ++ino, nlink: 1, size: bytes.length, mode, uid: 501,
    mtimeMs: 100, ctimeMs: 100, isFile: () => (mode & 0o170000) === 0o100000,
    isDirectory: () => (mode & 0o170000) === 0o040000, isSymbolicLink: () => false,
    isSocket: () => (mode & 0o170000) === 0o140000 });
}
function child() {
  const c = new Port();
  c.stdout = new Port(); c.stderr = new Port(); c.stdin = new Port(); c.connected = true;
  c.stdin.end = vi.fn(() => c.stdin.destroy());
  c.stdin.write = vi.fn(() => { throw Error("INPUT_FRAME_FORBIDDEN"); });
  c.kill = vi.fn(() => { throw Error("SIGNALS_FORBIDDEN"); });
  c.close = (code = 0, signal = null) => {
    if (c.closed) return;
    if (!switches.missingEOF) { c.stdout.emit("end"); c.stderr.emit("end"); }
    if (!switches.unsettledStream) c.stdout.destroy();
    c.stderr.destroy(); c.stdin.destroy();
    c.closed = true; c.emit("close", code, signal);
  };
  return c;
}
function role(name, parent) {
  const p = { ...base, name, parent, argv: [], env: {}, connected: !!parent, exitCode: 0,
    ticks: name === "H" ? 1000000000n : name === "O" ? 9000000000000n : name === "P" ? 700000000n : 300000000000n };
  context.run(p, () => { p.bus = new Port(); });
  p.hrtime = { bigint: vi.fn(() => { p.ticks += 1000n; return p.ticks; }) };
  p.stdout = { write: vi.fn((bytes, cb) => {
    const output = name === "init" && switches.initOutput ? switches.initOutput(String(bytes)) : bytes;
    if (output !== null) parent?.stdout.emit("data", Buffer.from(output));
    queueMicrotask(() => cb?.(name === "init" && switches.initWriteError ? Error("SOURCE_WRITE_ERROR") : undefined));
    return true;
  }) };
  p.stderr = { write: vi.fn((bytes, cb) => { parent?.stderr.emit("data", Buffer.from(bytes)); cb?.(); return true; }) };
  p.send = vi.fn((m, cb) => {
    let message = m;
    if (switches.changeMessage) message = switches.changeMessage(name, m);
    queueMicrotask(() => { parent?.emit("message", message); cb?.(); });
  });
  p.disconnect = vi.fn(() => {
    p.connected = false;
    if (parent) {
      parent.connected = false; parent.emit("disconnect");
      if (name === "O" && switches.beforeOClose) switches.beforeOClose(roles.H);
      queueMicrotask(() => parent.close(p.exitCode));
    }
  });
  p.exit = vi.fn(code => {
    p.exitCode = code; guestExit = code; state = "exited"; queueMicrotask(() => parent?.close(code));
  });
  roles[name] = p; return p;
}
async function setupFs() {
  files.clear(); fds.clear(); openedObjects.clear(); pendingSync.clear(); ino = 1; fd = 10;
  fs.openSync.mockImplementation((path, flags) => {
    if (flags === "wx") { if (files.has(path)) throw Error("EEXIST"); put(path, ""); }
    if (!files.has(path)) throw Error("MISSING_ORIGINAL:" + path);
    fds.set(++fd, path); openedObjects.set(fd, files.get(path)); return fd;
  });
  fs.lstatSync.mockImplementation(path => {
    if (!files.has(path)) throw Error("MISSING_ORIGINAL:" + path);
    return { ...files.get(path) };
  });
  fs.fstatSync.mockImplementation(n => ({ ...openedObjects.get(n) }));
  fs.readFileSync.mockImplementation(n => Buffer.from(openedObjects.get(n).bytes));
  fs.writeSync.mockImplementation((n, bytes, offset, length) => {
    const f = openedObjects.get(n);
    f.bytes = Buffer.concat([f.bytes, Buffer.from(bytes).subarray(offset, offset + length)]);
    f.size = f.bytes.length; return length;
  });
  fs.closeSync.mockImplementation(n => { fds.delete(n); openedObjects.delete(n); });
  fs.fsyncSync.mockImplementation(n => {
    const path = fds.get(n), row = openedObjects.get(n);
    if (row.isFile()) pendingSync.set(path.slice(0, path.lastIndexOf("/")), path);
    else if (pendingSync.has(path)) {
      const published = pendingSync.get(path); pendingSync.delete(path);
      // Visible/synced bytes are still not the private protocol handoff.
      publications.push({ path: published, role: context.getStore()?.name });
      switches.publication?.(published);
    }
  });
  fs.linkSync.mockImplementation((from, to) => {
    if (files.has(to)) throw Error("EEXIST");
    const f = files.get(from); f.nlink++; files.set(to, f);
  });
  fs.unlinkSync.mockImplementation(path => { files.get(path).nlink--; files.delete(path); });
  fs.realpathSync.mockImplementation(path => path === "/usr/local/bin/docker" ? "/source-fixture/docker" : path);
  for (const path of [ROOT, ROOT + "/docker-config", ROOT + "/empty-home"]) put(path, "", 0o040700);
  put(ROOT + "/docker-config/config.json", "{}\n");
  put("/source-fixture/node", "SOURCE_DOUBLE_NODE", 0o100755);
  put("/source-fixture/docker", "SOURCE_DOUBLE_DOCKER", 0o100755);
  put("/var/run/docker.sock", "", 0o140600);
  // Read-only fixture setup occurs before execution; ALL positive pipeline
  // filesystem operations below use the in-memory boundary double.
  const actualFs = await vi.importActual("node:fs");
  const sources = CLOCK_OBSERVATION_SOURCES.map(path => {
    const bytes = actualFs.readFileSync(path); put(path, bytes, 0o100644);
    return { path, sha256: hash(bytes) };
  });
  const sourceHash = hash(JSON.stringify(data(sources)));
  facts = { schema: "airlock.clock-observation-source-facts.v2", scope: "SOURCE_INPUTS_NOT_RUNTIME_PROOF",
    case_id: "source-clock-01", root: ROOT, uid: 501, node_realpath: "/source-fixture/node",
    node_sha256: hash("SOURCE_DOUBLE_NODE"), node_version: "v22.16.0",
    client_realpath: "/source-fixture/docker", client_sha256: hash("SOURCE_DOUBLE_DOCKER"),
    endpoint: "unix:///var/run/docker.sock",
    endpoint_original: { path: "/var/run/docker.sock", dev: 1, ino: files.get("/var/run/docker.sock").ino,
      uid: 501, mode: 0o140600, mtime_ms: 100, ctime_ms: 100 },
    engine: { ID: "SOURCE_DOUBLE_ENGINE", OSType: "linux", Architecture: "aarch64", ServerVersion: "source-double" },
    target: "PINNED_BARE_NODE_NO_WORK_SOURCE",
    image_id: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    image_manifest_sha256: "5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    image_config_sha256: "d4c19a76851d19b6473bcba5ec21630000c6469fcea58623ec166d19402f207f",
    program_source_sha256: sourceHash, program_sha256: PROGRAM_SHA256, command_sha256: COMMAND_SHA256,
    image_env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"],
    sources };
  put(ROOT + "/source-facts.json", JSON.stringify(facts));
}
// Independent backend contract: never derive confinement expectations from
// the production command/template builders being exercised.
function independentDockerContract(kind, target) {
  const prefix = ["--config", ROOT + "/docker-config", "--host", expectedEndpoint];
  if (kind === "info") return { argv: [...prefix, "info", "--format",
    '{"ID":{{json .ID}},"OSType":{{json .OSType}},"Architecture":{{json .Architecture}},"ServerVersion":{{json .ServerVersion}}}'] };
  const b = JSON.parse(files.get(ROOT + "/o-ticket.json").bytes).binding;
  const labels = { case_id: "source-clock-01", run_id: b.run_id, nonce: b.nonce, ticket: b.ticket,
    source_sha256: facts.program_source_sha256, cohort_sha256: b.cohort_sha256 };
  const env = {
    AIRLOCK_OBSERVATION_CASE: "source-clock-01", AIRLOCK_OBSERVATION_RUN: b.run_id,
    AIRLOCK_OBSERVATION_NONCE: b.nonce, AIRLOCK_OBSERVATION_TICKET: b.ticket,
    AIRLOCK_OBSERVATION_SOURCE: facts.program_source_sha256, AIRLOCK_OBSERVATION_COHORT: b.cohort_sha256,
    AIRLOCK_OBSERVATION_IMAGE: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    AIRLOCK_OBSERVATION_ENGINE: facts.engine.ID, HOME: "/",
  };
  if (kind === "create") return { argv: [...prefix, "create", "--name", "airlock-clock-source-clock-01",
    "--hostname=airlock-clock-source-clock-01", "--pull=never", "--platform=linux/arm64/v8",
    "--network=none", "--ipc=private", "--read-only", "--workdir=/",
    "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--privileged=false",
    "--init=false", "--pids-limit=16", "--memory=64m", "--memory-swap=64m", "--cpus=0.25",
    "--restart=no", "--log-driver=none", "--no-healthcheck",
    ...Object.entries(labels).map(([key, value]) => "--label=" + key + "=" + value),
    ...Object.entries(env).map(([key, value]) => "--env=" + key + "=" + value),
    "--entrypoint=/usr/local/bin/node", "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    ...fixedCommand] };
  if (kind === "inspect") {
    const predicates = [
      ["Entrypoint", ".Config.Entrypoint", ["/usr/local/bin/node"]],
      ["Cmd", ".Config.Cmd", fixedCommand],
      ["Env", ".Config.Env", [...Object.entries(env).map(([key, value]) => key + "=" + value), ...facts.image_env]],
      ["Labels", ".Config.Labels", labels], ["Hostname", ".Config.Hostname", "airlock-clock-source-clock-01"],
      ["WorkingDir", ".Config.WorkingDir", "/"],
      ["User", ".Config.User", "65532:65532"], ["Healthcheck", ".Config.Healthcheck", { Test: ["NONE"] }],
      ["Volumes", ".Config.Volumes", null], ["ExposedPorts", ".Config.ExposedPorts", null],
      ["PidMode", ".HostConfig.PidMode", ""], ["IpcMode", ".HostConfig.IpcMode", "private"],
      ["NetworkMode", ".HostConfig.NetworkMode", "none"], ["UTSMode", ".HostConfig.UTSMode", ""],
      ["UsernsMode", ".HostConfig.UsernsMode", ""], ["CgroupnsMode", ".HostConfig.CgroupnsMode", "private"],
      ["Privileged", ".HostConfig.Privileged", false], ["ReadonlyRootfs", ".HostConfig.ReadonlyRootfs", true],
      ["AutoRemove", ".HostConfig.AutoRemove", false], ["Init", ".HostConfig.Init", false],
      ["CapDrop", ".HostConfig.CapDrop", ["ALL"]], ["CapAdd", ".HostConfig.CapAdd", null],
      ["SecurityOpt", ".HostConfig.SecurityOpt", ["no-new-privileges"]],
      ["Binds", ".HostConfig.Binds", null], ["HostMounts", ".HostConfig.Mounts", null], ["Mounts", ".Mounts", []],
      ["Devices", ".HostConfig.Devices", []], ["DeviceRequests", ".HostConfig.DeviceRequests", null],
      ["PortBindings", ".HostConfig.PortBindings", {}], ["DNS", ".HostConfig.DNS", []],
      ["DNSOptions", ".HostConfig.DNSOptions", []], ["DNSSearch", ".HostConfig.DNSSearch", []],
      ["ExtraHosts", ".HostConfig.ExtraHosts", null], ["GroupAdd", ".HostConfig.GroupAdd", null],
      ["Links", ".HostConfig.Links", null], ["VolumesFrom", ".HostConfig.VolumesFrom", null],
      ["Tmpfs", ".HostConfig.Tmpfs", null], ["PidsLimit", ".HostConfig.PidsLimit", 16],
      ["Memory", ".HostConfig.Memory", 67108864], ["MemorySwap", ".HostConfig.MemorySwap", 67108864],
      ["NanoCpus", ".HostConfig.NanoCPUs", 250000000],
      ["RestartPolicy", ".HostConfig.RestartPolicy", { Name: "no", MaximumRetryCount: 0 }],
      ["LogConfig", ".HostConfig.LogConfig", { Type: "none", Config: {} }],
    ];
    const pairs = ['"Id":{{json .Id}}', '"Name":{{json .Name}}', '"Image":{{json .Image}}',
      ...predicates.map(([key, path, value]) =>
        JSON.stringify(key) + ":{{eq (json " + path + ") " + JSON.stringify(JSON.stringify(data(value))) + "}}"),
      '"State":{"Status":{{json .State.Status}},"Running":{{json .State.Running}},"Dead":{{json .State.Dead}},"Restarting":{{json .State.Restarting}},"Paused":{{json .State.Paused}},"ExitCode":{{json .State.ExitCode}}}'];
    return { argv: [...prefix, "inspect", "--type=container", "--format", "{" + pairs.join(",") + "}",
      target === "airlock-clock-source-clock-01" ? target : CID],
    inspection: { Id: CID, Name: "/airlock-clock-source-clock-01",
      Image: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
      ...Object.fromEntries(predicates.map(([key, , value]) =>
        [key, Object.hasOwn(createdConfig, key) ? JSON.stringify(createdConfig[key]) === JSON.stringify(value) : true])),
      State: { Status: state, Running: state === "running", Dead: false, Restarting: false, Paused: false,
        ExitCode: state === "exited" ? guestExit : 0 } } };
  }
  const actions = {
    start: ["start", "--attach", "--interactive", CID], stop: ["stop", "--time=1", CID],
    wait: ["wait", CID], rm: ["rm", CID],
  };
  expect(Object.hasOwn(actions, kind)).toBe(true);
  return { argv: [...prefix, ...actions[kind]] };
}
function independentBareBaseConfig(argv) {
  // No inherited User/WorkingDir and no /airlock modules on this bare base.
  const flag = prefix => argv.find(a => a.startsWith(prefix))?.slice(prefix.length);
  return {
    Entrypoint: flag("--entrypoint=") ? [flag("--entrypoint=")] : ["docker-entrypoint.sh"],
    Cmd: argv.slice(argv.indexOf(facts.image_id) + 1),
    WorkingDir: flag("--workdir=") ?? "", User: flag("--user=") ?? "",
    Hostname: flag("--hostname=") ?? CID.slice(0, 12),
    Env: [...argv.filter(a => a.startsWith("--env=")).map(a => a.slice(6)), ...facts.image_env],
  };
}
function dispatch(executable, argv, options) {
  const c = child(), owner = context.getStore()?.name;
  const call = { executable, argv, options, owner, child: c }; calls.push(call);
  if (executable === "/source-fixture/node") {
    const name = argv[0].endsWith("-outer.mjs") ? "O" : argv[0].endsWith("-producer.mjs") ? "P" : "S";
    const p = role(name, c); p.argv = [executable, ...argv]; p.env = options.env;
    if (switches.lossRole === name) { queueMicrotask(() => c.close(2)); return c; }
    c.send = vi.fn((m, cb) => {
      queueMicrotask(() => {
        const messages = switches.parentMessages ? switches.parentMessages(name, m) : [m];
        for (const message of messages) p.bus.emit("message", message);
        cb?.();
      });
    });
    queueMicrotask(() => context.run(p, async () => {
      try {
        const fn = { O: runClockObservationOuter, P: runClockObservationProducer, S: runClockObservationSupervisor }[name];
        await fn(argv.slice(1));
      } catch (e) { failure = e; c.stderr.emit("data", Buffer.from(e.message)); c.close(2); }
    }));
    return c;
  }
  if (executable !== "/source-fixture/docker") throw Error("UNEXPECTED_EXECUTABLE");
  const kind = argv[4]; call.kind = kind;
  const contract = independentDockerContract(kind, argv.at(-1));
  if (kind === "create") independentProgramCommand(argv.slice(argv.indexOf(facts.image_id) + 1));
  expect(argv).toEqual(contract.argv);
  expect(options).toEqual({ env: { HOME: ROOT + "/empty-home", DOCKER_CONFIG: ROOT + "/docker-config",
    DOCKER_HOST: expectedEndpoint, PATH: "/usr/local/bin:/usr/bin:/bin" },
  cwd: ROOT + "/empty-home", shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  if (kind === "create") {
    // Explicit env precedes inherited image env in the inspected Config.
    createdConfig = independentBareBaseConfig(argv);
  }
  if (kind === "start") {
    if (switches.sLossOnStart) queueMicrotask(() => roles.S.parent.close(2));
    if (switches.pendingStart) return c;
    const p = role("init", c);
    independentProgramCommand(createdConfig.Cmd);
    p.argv = [createdConfig.Entrypoint[0]]; p.execPath = createdConfig.Entrypoint[0];
    p.execArgv = [...createdConfig.Cmd];
    p.platform = "linux"; p.arch = "arm64"; p.version = "v24.10.0"; p.pid = 1;
    p.getuid = () => Number(createdConfig.User.split(":")[0]);
    p.getgid = () => Number(createdConfig.User.split(":")[1]);
    p.cwd = () => createdConfig.WorkingDir || "/";
    p.env.HOSTNAME = createdConfig.Hostname;
    p.env.HOME = "/";
    for (const e of facts.image_env) {
      const [key, ...value] = e.split("="); p.env[key] = value.join("=");
    }
    for (const a of createdConfig.Env.slice(0, -facts.image_env.length)) {
      const [key, ...value] = a.split("="); p.env[key] = value.join("=");
    }
    switches.initContext?.(p);
    state = "running";
    queueMicrotask(() => context.run(p, () => {
      // Trusted own code only. VM is an interpreter, NOT a security boundary.
      // No imports, host process, input, Buffer, require or effectful globals.
      const guest = Object.fromEntries(["platform", "arch", "version", "pid", "getuid", "getgid", "cwd",
        "execPath", "argv", "execArgv", "env", "hrtime", "stdout", "exit"].map(k => [k, p[k]]));
      new Script(createdConfig.Cmd[2]).runInNewContext({ process: guest, console: undefined },
        { timeout: 100, codeGeneration: { strings: false, wasm: false } })
        .catch(e => { failure = e; c.close(70); });
    }));
    return c;
  }
  queueMicrotask(() => {
    let out;
    if (kind === "info") out = JSON.stringify(facts.engine) + "\n";
    else if (kind === "create" || kind === "rm") out = CID + "\n";
    else if (kind === "inspect") {
      out = JSON.stringify(contract.inspection) + "\n";
    }
    else if (kind === "stop") {
      state = "exited"; out = CID + "\n";
      const pending = calls.find(x => x.kind === "start");
      if (pending && !pending.child.closed && switches.settleStartOnStop) queueMicrotask(() => {
        if (switches.lateStartOnStop) { state = "running"; switches.lateStartOnStop = false; }
        pending.child.close();
      });
    } else if (kind === "wait") out = guestExit + "\n";
    else throw Error("UNEXPECTED_DOCKER_OPERATION");
    if (switches.backendOutput) out = switches.backendOutput(kind, out);
    c.stdout.emit("data", Buffer.from(out)); c.close();
  });
  return c;
}
beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers(); requireClockObservationRuntime.mockReset();
  let entropySequence = 0;
  randomBytes.mockImplementation(size => Buffer.alloc(size, ++entropySequence));
  switches = {}; calls = []; publications = []; roles = {}; result = null; failure = null; state = "created";
  expectedEndpoint = "unix:///var/run/docker.sock";
  createdConfig = null; guestExit = 0;
  await setupFs(); role("H"); spawn.mockImplementation(dispatch);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
async function execute() {
  context.run(roles.H, () => {
    runClockObservationEntry(["--clock-observation", "source-clock-01", ROOT])
      .then(r => { result = r; }).catch(e => { failure = e; });
  });
  await flush();
}
function changeOwnedOriginal(name, action) {
  const path = ROOT + "/" + name;
  if (action === "delete") files.delete(path);
  else put(path, files.get(path).bytes);
}
function correctionRawWitness(label, read) {
  console.info("CLOCK_CORRECTION_RAW_WITNESS " + JSON.stringify({
    label, simulation_only: true, expected_source_valid: false, source_lease_qualified: false, reader: read,
    commands: calls.map(c => ({ owner: c.owner, executable: c.executable, argv: c.argv, options: c.options })),
    originals: [...files].filter(([path]) => path.startsWith(ROOT + "/") && path.endsWith(".json"))
      .map(([path, f]) => ({ path, bytes_base64: f.bytes.toString("base64"), sha256: hash(f.bytes),
        simulated_file_identity: { dev: f.dev, ino: f.ino, nlink: f.nlink, mode: f.mode, uid: f.uid } })),
  }));
}
describe("SOURCE/PURE actual fixed H/O/P/S/init/reader pipeline", () => {
  it("selects a standalone inline Node command and explicitly overrides the empty bare-base workdir", async () => {
    await execute();
    expect(failure).toBeNull();
    const create = calls.find(c => c.kind === "create");
    expect(create.argv).toContain("--workdir=/");
    expect(create.argv).toContain("--env=HOME=/");
    expect(create.argv.slice(create.argv.indexOf(facts.image_id) + 1)).toEqual([
      "--input-type=module", "--eval", expect.any(String),
    ]);
    expect(createdConfig.WorkingDir).toBe("/");
    expect(roles.init.cwd()).toBe("/");
    expect(roles.init.getuid()).toBe(65532);
    expect(roles.H.getuid()).toBe(501);
    expect(roles.init.exit).toHaveBeenCalledExactlyOnceWith(0);
    const read = inspectClockObservation(result.completion);
    expect(read.source_observation_evidence_valid).toBe(true);
    expect(read.diagnostics).toMatchObject({ program_sha256: PROGRAM_SHA256, command_sha256: COMMAND_SHA256,
      program_source_sha256: facts.program_source_sha256, image_manifest_sha256: facts.image_manifest_sha256,
      image_config_sha256: facts.image_config_sha256 });
    console.info("BARE_BASE_CLOCK_SOURCE_CAUSAL_WITNESS " + JSON.stringify({
      simulation_only: true, runtime_proof: false, qualified_clock: false, native_admission: false,
      source_facts: facts, create_argv: create.argv, selected_config: createdConfig,
      actual_generated_stdout_base64: Buffer.from(roles.init.stdout.write.mock.calls.map(([line]) => line).join("")).toString("base64"),
      actual_doubled_exit: roles.init.exit.mock.calls, reader: read,
    }));
  });
  it("separates the pinned base from the full source lease and exact inline body/argv digests", () => {
    const plan = context.run(roles.H, () => prepareClockObservationPlan({ case_id: facts.case_id, root: ROOT }));
    const p = context.run(roles.H, () => clockObservationPlanEvidence(plan));
    expect(p).toMatchObject({
      target: "PINNED_BARE_NODE_NO_WORK_SOURCE", source_sha256: facts.program_source_sha256,
      program_source_sha256: facts.program_source_sha256, program_sha256: PROGRAM_SHA256,
      command_sha256: COMMAND_SHA256, image_id: facts.image_id,
      image_manifest_sha256: "5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
      image_config_sha256: "d4c19a76851d19b6473bcba5ec21630000c6469fcea58623ec166d19402f207f",
    });
    expect(p.source_sha256).toBe(hash(JSON.stringify(data(facts.sources))));
    expect(p.source_sha256).not.toBe(p.program_sha256);
    expect(p.source_sha256).not.toBe(p.image_config_sha256);
    expect(Object.hasOwn(p, "image_source_sha256")).toBe(false);
    expect(calls).toEqual([]);
  });
  it.each([
    ["v1 schema", f => { f.schema = "airlock.clock-observation-source-facts.v1"; }],
    ["v1 derived facts", f => {
      f.schema = "airlock.clock-observation-source-facts.v1"; f.image_source_sha256 = f.program_source_sha256;
      for (const k of ["target", "image_manifest_sha256", "image_config_sha256", "program_source_sha256",
        "program_sha256", "command_sha256"]) delete f[k];
    }],
    ["v2 derived image source claim", f => { f.image_source_sha256 = f.program_source_sha256; }],
    ["derived target", f => { f.target = "DERIVED_NODE_INIT_IMAGE"; }],
    ["wrong manifest", f => { f.image_manifest_sha256 = "e".repeat(64); }],
    ["wrong config and image", f => { f.image_config_sha256 = "e".repeat(64); f.image_id = "sha256:" + f.image_config_sha256; }],
    ["wrong image", f => { f.image_id = "sha256:" + "e".repeat(64); }],
    ["config blob as image identity", f => { f.image_id = "sha256:" + f.image_config_sha256; }],
    ["wrong program hash", f => { f.program_sha256 = "e".repeat(64); }],
    ["source hash as program hash", f => { f.program_sha256 = f.program_source_sha256; }],
    ["wrong command hash", f => { f.command_sha256 = "e".repeat(64); }],
    ["body hash as command hash", f => { f.command_sha256 = f.program_sha256; }],
    ["program data field", f => { f.program = CLOCK_OBSERVATION_PROGRAM; }],
    ["profile selector", f => { f.profile = "peer-hello-only"; }],
    ["runtime claim", f => { f.scope = "PREPARED_RUNTIME_PROOF"; }],
  ])("rejects %s without recasting it as bare-base SOURCE provenance", async (_label, change) => {
    change(facts); put(ROOT + "/source-facts.json", JSON.stringify(facts));
    await execute();
    expect(failure?.message).toBe(Object.hasOwn(facts, "image_source_sha256")
      || Object.hasOwn(facts, "program") || Object.hasOwn(facts, "profile") ? "invalid_case_input" : "observation_fixed_source_facts");
    expect(calls).toEqual([]);
  });
  it("binds an explicit alternate owned socket and canonical client through every source role and reader", async () => {
    expect(CLOCK_OBSERVATION_SOURCES).toHaveLength(20);
    for (const name of ["private-original-file.mjs", "private-original-file.test.mjs",
      "sdk-absent-clock-observation-program.mjs", "sdk-absent-clock-observation-program.test.mjs"])
      expect(CLOCK_OBSERVATION_SOURCES).toContain(new URL(name, import.meta.url).pathname);
    expectedEndpoint = "unix:///source-fixture/desktop.sock";
    put("/source-fixture/desktop.sock", "", 0o140600);
    facts.endpoint = expectedEndpoint;
    facts.endpoint_original = { path: "/source-fixture/desktop.sock", dev: 1,
      ino: files.get("/source-fixture/desktop.sock").ino, uid: 501, mode: 0o140600, mtime_ms: 100, ctime_ms: 100 };
    put(ROOT + "/source-facts.json", JSON.stringify(facts));
    await execute();
    expect(failure).toBeNull();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
    expect(calls.filter(c => c.kind).length).toBeGreaterThan(0);
    for (const c of calls.filter(c => c.kind)) {
      expect(c.executable).toBe("/source-fixture/docker");
      expect(c.argv.slice(2, 4)).toEqual(["--host", expectedEndpoint]);
      expect(c.options.env.DOCKER_HOST).toBe(expectedEndpoint);
    }
  });
  it.each(["tcp://localhost:2375", "ssh://host", "unix://relative", "unix:///a/../b",
    "unix:///a/./b", "unix:///a//b", "unix:///a?b", "unix:///a#b", "unix:///%2fa", "unix:///a\n", null])(
    "refuses endpoint %j before any source actor is spawned", async endpoint => {
      facts.endpoint = endpoint; put(ROOT + "/source-facts.json", JSON.stringify(facts));
      await execute();
      expect(failure).not.toBeNull(); expect(calls).toEqual([]);
    });
  it("rejects a wrong scheme even when slicing off that scheme reaches the valid socket original", () => {
    facts.endpoint = "http:///var/run/docker.sock";
    put(ROOT + "/source-facts.json", JSON.stringify(facts));
    context.run(roles.H, () => expect(() => prepareClockObservationPlan({ case_id: facts.case_id, root: ROOT }))
      .toThrow("observation_canonical_owned_endpoint"));
    expect(calls).toEqual([]);
  });
  it.each(["inode", "uid", "mode", "type", "symlink", "canonical"])(
    "refuses changed socket %s at retrospective reader acceptance", async change => {
      await execute(); expect(failure).toBeNull();
      const socket = files.get("/var/run/docker.sock");
      if (change === "inode") socket.ino++;
      if (change === "uid") socket.uid++;
      if (change === "mode") socket.mode = 0o140666;
      if (change === "type") socket.isSocket = () => false;
      if (change === "symlink") socket.isSymbolicLink = () => true;
      if (change === "canonical") fs.realpathSync.mockImplementation(path =>
        path === "/usr/local/bin/docker" ? "/source-fixture/docker" : path === "/var/run/docker.sock" ? "/elsewhere.sock" : path);
      expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    });
  it("refuses socket replacement during pre-create registration instead of issuing CREATE", async () => {
    switches.publication = path => {
      if (path.endsWith("/s-op-2-registered.json")) files.get("/var/run/docker.sock").ino++;
    };
    await execute();
    expect(calls.some(c => c.kind === "create")).toBe(false);
    expect(result === null || !inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
  });
  it.each(["owner", "type", "shared-mode", "symlink"])(
    "refuses initially unsafe socket %s even when its supplied original is refreshed", async change => {
      const socket = files.get("/var/run/docker.sock");
      if (change === "owner") { socket.uid++; facts.endpoint_original.uid++; }
      if (change === "type") {
        socket.isSocket = () => false; socket.mode = 0o100600; facts.endpoint_original.mode = socket.mode;
      }
      if (change === "shared-mode") { socket.mode = 0o140660; facts.endpoint_original.mode = socket.mode; }
      if (change === "symlink") socket.isSymbolicLink = () => true;
      put(ROOT + "/source-facts.json", JSON.stringify(facts));
      await execute(); expect(failure).not.toBeNull(); expect(calls).toEqual([]);
    });
  it("does not accept another UID merely because the socket and supplied owner agree", async () => {
    roles.H.getuid = () => 502;
    await execute(); expect(failure?.message).toBe("observation_fixed_source_facts"); expect(calls).toEqual([]);
  });
  it.each(["bytes", "inode", "alias"])("refuses canonical client %s changes at the reader", async change => {
    await execute(); expect(failure).toBeNull();
    if (change === "bytes") files.get("/source-fixture/docker").bytes[0] ^= 1;
    if (change === "inode") files.get("/source-fixture/docker").ino++;
    if (change === "alias") fs.realpathSync.mockImplementation(path =>
      path === "/usr/local/bin/docker" ? "/another-client" : path);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it("does not recapture a replacement socket as a fresh lease in a later source role", async () => {
    switches.publication = path => {
      if (path.endsWith("/h-child-registered.json")) files.get("/var/run/docker.sock").ino++;
    };
    await execute();
    expect(calls.some(c => c.kind)).toBe(false);
    expect(result === null || !inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
  });
  it("executes all source roles under doubles and yields retrospective SOURCE evidence only", async () => {
    await execute();
    expect(failure).toBeNull();
    expect(result).not.toBeNull();
    const read = inspectClockObservation(result.completion);
    expect(read).toMatchObject({ source_observation_evidence_valid: true, observation_valid: false,
      qualified_clock: false, workload_admission: false, native_qualified: false, runtime_provenance: false });
    expect(calls.filter(c => c.kind).every(c => c.owner === "S")).toBe(true);
    expect(calls.filter(c => c.executable === "/source-fixture/node").map(c => c.owner)).toEqual(["H", "O", "P"]);
    expect(roles.init.stdout.write).toHaveBeenCalledTimes(2);
    expect(calls.find(c => c.kind === "start").child.stdin.write).not.toHaveBeenCalled();
    expect(publications.find(p => p.path.endsWith("/o-ticket.json")).role).toBe("O");
    // The runner's private log retains the raw SOURCE witness without any
    // real filesystem writes from this fully doubled pipeline.
    console.info("CLOCK_OBSERVATION_SOURCE_WITNESS " + JSON.stringify({
      schema: "airlock.clock-observation-source-witness.v1", simulation_only: true,
      observation_valid: false, qualified_clock: false, workload_admission: false, native_qualified: false,
      commands: calls.map(c => ({ owner: c.owner, executable: c.executable, argv: c.argv, options: c.options })),
      originals: [...files].filter(([path]) => path.startsWith(ROOT + "/") && path.endsWith(".json"))
        .map(([path, f]) => ({ path, bytes_base64: f.bytes.toString("base64"), sha256: hash(f.bytes),
          simulated_file_identity: { dev: f.dev, ino: f.ino, nlink: f.nlink, mode: f.mode, uid: f.uid } })),
      source_leases: CLOCK_OBSERVATION_SOURCES.map(path => ({ path, sha256: hash(files.get(path).bytes) })),
      result: read,
    }));
  });
  it("accepts a strict-under-45s H interval, with unrelated O/P/S/init epochs", async () => {
    switches.beforeOClose = h => {
      const start = BigInt(JSON.parse(files.get(ROOT + "/h-start.json").bytes).original_start_ns);
      h.ticks = start + 44999997000n;
    };
    await execute();
    expect(failure).toBeNull();
    const read = inspectClockObservation(result.completion);
    expect(read.source_observation_evidence_valid).toBe(true);
    expect(BigInt(read.diagnostics.observed_whole_O_interval_ns)).toBeLessThan(45000000000n);
    expect(read.diagnostics.host_domain).not.toBe(read.diagnostics.guest_domain);
  });
  it.each([45000000000n, 45000001000n])("rejects original H close/settlement at or after %s ns", async elapsed => {
    switches.beforeOClose = h => {
      const start = BigInt(JSON.parse(files.get(ROOT + "/h-start.json").bytes).original_start_ns);
      h.ticks = start + elapsed - 1000n;
    };
    await execute();
    expect(result).not.toBeNull();
    expect(inspectClockObservation(result.completion)).toMatchObject({ status: "UNKNOWN", source_observation_evidence_valid: false });
    expect(JSON.parse(files.get(ROOT + "/s-result.json").bytes).disposition).toBe("SOURCE_SETTLED_CANDIDATE");
  });
  it("includes acquisition and O's final durable publication, not P/S-start or S-close", async () => {
    switches.publication = path => {
      if (path.endsWith("/o-result.json")) {
        const start = BigInt(JSON.parse(files.get(ROOT + "/h-start.json").bytes).original_start_ns);
        roles.H.ticks = start + 45000000000n;
      }
    };
    await execute();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    const s = JSON.parse(files.get(ROOT + "/s-result.json").bytes);
    expect(s.disposition).toBe("SOURCE_SETTLED_CANDIDATE");
    expect(BigInt(s.handshake.received_ns) - BigInt(s.handshake.hello.tau0_ns)).toBeLessThan(45000000000n);
  });
  it("does not mint a whole-O receipt from O's self-published or P/S-close candidate", async () => {
    switches.beforeOClose = () => { switches.unsettledStream = true; };
    await execute();
    expect(files.has(ROOT + "/o-result.json")).toBe(true);
    expect(result).toBeNull();
    expect(inspectClockObservation({ completion: JSON.parse(files.get(ROOT + "/o-result.json").bytes) }).status).toBe("UNKNOWN");
    expect(inspectClockObservation(observationRead(ROOT + "/o-result.json").handle).reason).toContain("genuine_H_receipt");
  });
  it.each([
    ["unit", f => { f.unit = "ms"; }],
    ["domain", f => { f.domain = "NODE_S_HRTIME_MONOTONIC_NS"; }],
    ["clock reversal", f => { if (f.sample_ns) f.sample_ns = "1"; }],
    ["CID-independent image", f => { f.image_id = "sha256:" + "e".repeat(64); }],
    ["engine", f => { f.engine_id = "FOREIGN_ENGINE"; }],
    ["source", f => { f.binding.source_sha256 = "e".repeat(64); }],
    ["nonce", f => { f.binding.nonce = "e".repeat(64); }],
    ["ticket", f => { f.binding.ticket = "e".repeat(64); }],
    ["extra ARM field", f => { f.ARM = true; }],
    ["mistyped ns", f => { f.tau0_ns = 1; }],
    ["unbounded ns", f => { f.tau0_ns = "1".repeat(25); }],
    ["wrong sequence", f => { if (f.sequence) f.sequence = 2; }],
  ])("rejects actual init output with changed %s", async (_label, change) => {
    switches.initOutput = line => { const f = JSON.parse(line); change(f); return JSON.stringify(f) + "\n"; };
    await execute();
    expect(failure).toBeNull();
    const read = inspectClockObservation(result.completion);
    expect(read).toMatchObject({ status: "UNKNOWN", source_observation_evidence_valid: false, qualified_clock: false });
  });
  it.each([
    ["duplicate", line => line + line],
    ["truncated", line => line.trimEnd()],
    ["empty", () => null],
    ["unknown WORK frame", line => line + '{"type":"WORK"}\n'],
    ["fork request", line => line + '{"type":"FORK","program":"unowned"}\n'],
    ["duplicate JSON key", line => line.replace('"unit":"ns"', '"unit":"ns","unit":"ns"')],
    ["invalid UTF8", () => Buffer.from([0xff, 0x0a])],
    ["oversize frame", line => line.slice(0, -1) + " ".repeat(4096) + "\n"],
    ["missing HELLO", line => JSON.parse(line).schema.endsWith("hello.v1") ? null : line],
    ["missing CLOCK", line => JSON.parse(line).schema.endsWith("clock.v1") ? null : line],
  ])("rejects %s raw generated-init stream", async (_label, transform) => {
    switches.initOutput = transform;
    await execute();
    expect(inspectClockObservation(result.completion)).toMatchObject({ source_observation_evidence_valid: false, observation_valid: false });
  });
  it("rejects reversed raw frame order despite a genuine doubled exit and complete streams", async () => {
    let hello;
    switches.initOutput = line => {
      if (JSON.parse(line).schema.endsWith("hello.v1")) { hello = line; return null; }
      return line + hello;
    };
    await execute();
    expect(roles.init.exit).toHaveBeenCalledExactlyOnceWith(0);
    const start = JSON.parse(files.get(ROOT + "/s-op-6-closed.json").bytes);
    expect(start.close).toMatchObject({ code: 0, eof: { stdout: true, stderr: true },
      closed: { stdin: true, stdout: true, stderr: true } });
    expect(inspectClockObservation(result.completion).reason).toBe("invalid_case_input");
  });
  it.each([
    ["UID", p => { p.getuid = () => 65534; }],
    ["PID", p => { p.pid = 2; }],
    ["Node version", p => { p.version = "v24.10.1"; }],
    ["OS", p => { p.platform = "darwin"; }],
    ["architecture", p => { p.arch = "x64"; }],
    ["cwd", p => { p.cwd = () => "/case"; }],
    ["Node flags", p => { p.execArgv.push("WORK"); }],
  ])("observes failed init exit 2 for wrong %s, never just returned expected frames", async (_label, change) => {
    switches.initContext = change;
    await execute();
    expect(roles.init.stdout.write).not.toHaveBeenCalled();
    expect(roles.init.exit).toHaveBeenCalledExactlyOnceWith(2);
    const close = JSON.parse(files.get(ROOT + "/s-op-6-closed.json").bytes).close;
    expect(close).toMatchObject({ code: 2, signal: null, eof: { stdout: true, stderr: true },
      closed: { stdin: true, stdout: true, stderr: true } });
    expect(close.output.stdout.branch).toBe("EXPLICIT_EMPTY_NO_FRAMES");
    expect(JSON.parse(files.get(ROOT + "/s-result.json").bytes).errors)
      .toContain("observation_cleanup_UNKNOWN:observation_exact_owned_CID_configuration");
    expect(inspectClockObservation(result.completion).reason).toBe("observation_external_H_incomplete");
    console.info("BARE_BASE_CLOCK_FAILED_INIT_CAUSAL_WITNESS " + JSON.stringify({
      simulation_only: true, changed_guest_context: _label, actual_doubled_exit: roles.init.exit.mock.calls,
      retained_start_close: close, reader: inspectClockObservation(result.completion),
    }));
  });
  it("retains actual write-failure exit 70 and refuses a partial generated stream", async () => {
    switches.initWriteError = true;
    await execute();
    expect(roles.init.exit).toHaveBeenCalledExactlyOnceWith(70);
    expect(roles.init.stdout.write).toHaveBeenCalledTimes(1);
    const close = JSON.parse(files.get(ROOT + "/s-op-6-closed.json").bytes).close;
    expect(close.code).toBe(70);
    expect(Buffer.from(close.output.stdout.base64, "base64").toString().split("\n")).toHaveLength(2);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each(["ARM", "WORK", "FORK"])("refuses %s through the fixed parent IPC before any S allocation", async type => {
    switches.parentMessages = (name, m) => name === "S" ? [{ ...m, type }] : [m];
    await execute();
    expect(calls.some(c => c.kind)).toBe(false);
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it("rejects duplicate budgets without allocating after a fresh local budget reset", async () => {
    switches.parentMessages = (name, m) => name === "S" ? [m, m] : [m];
    await execute();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    expect(JSON.parse(files.get(ROOT + "/s-result.json").bytes).errors).toContain("observation_duplicate_or_unexpected_IPC");
  });
  it("ages a delayed budget from the retained pre-HELLO tau0, not receipt time", async () => {
    switches.parentMessages = (name, m) => {
      if (name === "S") roles.S.ticks += 45000000000n;
      return [m];
    };
    await execute();
    expect(calls.some(c => c.kind)).toBe(false);
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    expect(failure.message).toContain("budget_expired");
  });
  it("retains a late but still-valid OBSERVE_ONLY budget at its old tau0, without ARM or WORK", async () => {
    switches.parentMessages = (name, m) => {
      if (name === "S") roles.S.ticks += 1000000000n;
      return [m];
    };
    await execute();
    expect(failure).toBeNull();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
    const s = JSON.parse(files.get(ROOT + "/s-result.json").bytes);
    expect(BigInt(s.handshake.received_ns) - BigInt(s.handshake.hello.tau0_ns)).toBeGreaterThan(1000000000n);
    expect(calls.find(c => c.kind === "start").child.stdin.write).not.toHaveBeenCalled();
  });
  it("fails host monotonic reversal before O allocation", async () => {
    switches.publication = path => { if (path.endsWith("/h-start.json")) roles.H.ticks = 1n; };
    await execute();
    expect(failure.message).toContain("clock_reversal");
    expect(calls).toHaveLength(0);
    expect(inspectClockObservation(result?.completion).status).toBe("UNKNOWN");
  });
  it.each(["file-fsync", "directory-fsync", "final-readback"])(
    "does not hand off H or dispatch O after complete-looking start bytes fail at %s", async frontier => {
      const path = ROOT + "/h-start.json", sync = fs.fsyncSync.getMockImplementation();
      const read = fs.readFileSync.getMockImplementation();
      fs.fsyncSync.mockImplementation(fd => {
        const name = fds.get(fd);
        if ((frontier === "file-fsync" && name === path) || (frontier === "directory-fsync" && name === ROOT))
          throw Error("SOURCE_LATE_PUBLICATION_FAILURE");
        return sync(fd);
      });
      if (frontier === "final-readback") fs.readFileSync.mockImplementation(fd => {
        const name = fds.get(fd);
        if (name === path && publications.some(p => p.path === path)) throw Error("SOURCE_LATE_PUBLICATION_FAILURE");
        return read(fd);
      });
      await execute();
      expect(failure?.message).toBe("SOURCE_LATE_PUBLICATION_FAILURE");
      expect(result).toBeNull(); expect(calls).toHaveLength(0);
      const diagnostic = Buffer.from(files.get(path).bytes);
      expect(JSON.parse(diagnostic).binding.case_id).toBe(facts.case_id);
      fs.fsyncSync.mockImplementation(sync); fs.readFileSync.mockImplementation(read);
      expect(() => observationWrite(ROOT, "h-start.json", {}, 501)).toThrow("EEXIST");
      expect(files.get(path).bytes.equals(diagnostic)).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled(); expect(fds.size).toBe(0);
    });
  it("rejects delayed init receipt beyond S's retained original budget", async () => {
    switches.initOutput = bytes => { roles.S.ticks += 45000000000n; return bytes; };
    await execute();
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it("refuses an unbound image/source input before O allocation", async () => {
    facts.program_source_sha256 = "e".repeat(64);
    put(ROOT + "/source-facts.json", JSON.stringify(facts));
    await execute();
    expect(failure.message).toContain("program_source_substitution");
    expect(calls).toHaveLength(0);
  });
  it("durably owns pending start even after the observation window; client exit is not cancellation", async () => {
    switches.pendingStart = true;
    await execute();
    expect(calls.some(c => c.kind === "start")).toBe(true);
    await vi.advanceTimersByTimeAsync(2001); await flush();
    expect(calls.some(c => c.kind === "stop")).toBe(true);
    expect(result).toBeNull();
    expect(calls.some(c => ["wait", "rm"].includes(c.kind))).toBe(false);
    expect(JSON.parse(files.get(ROOT + "/s-op-6-registered.json").bytes)).toMatchObject({ owner: "S", kind: "start", cid: CID });
    expect(files.has(ROOT + "/s-op-6-closed.json")).toBe(false);
    expect(inspectClockObservation(undefined).status).toBe("UNKNOWN");
    for (const call of calls) expect(call.child.kill).not.toHaveBeenCalled();
  });
  it("retains late start settlement and repeats exact-CID stop, never calls it a valid observation", async () => {
    switches.pendingStart = true; switches.settleStartOnStop = true; switches.lateStartOnStop = true;
    await execute(); await vi.advanceTimersByTimeAsync(2001); await flush();
    expect(calls.filter(c => c.kind === "stop")).toHaveLength(2);
    expect(calls.filter(c => c.kind === "stop").every(c => c.argv.at(-1) === CID)).toBe(true);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it("does not convert missing stream EOF to settlement success", async () => {
    switches.missingEOF = true;
    await execute();
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it("does not complete while any queried stream is unsettled", async () => {
    switches.unsettledStream = true;
    await execute(); await vi.advanceTimersByTimeAsync(45001); await flush();
    expect(result).toBeNull();
    expect(inspectClockObservation(undefined).source_observation_evidence_valid).toBe(false);
    expect(files.has(ROOT + "/h-pending.json")).toBe(true);
  });
  it.each(["O", "P", "S"])("records simulated %s loss as UNKNOWN, not as cancellation/cleanup or H proof", async lossRole => {
    switches.lossRole = lossRole;
    await execute();
    expect(result).not.toBeNull();
    expect(inspectClockObservation(result.completion)).toMatchObject({ status: "UNKNOWN", observation_valid: false });
    expect(calls.some(c => c.kind)).toBe(false);
  });
  it("never claims S-loss settled a previously issued pending start", async () => {
    switches.pendingStart = true; switches.sLossOnStart = true;
    await execute();
    expect(files.has(ROOT + "/s-op-6-registered.json")).toBe(true);
    expect(files.has(ROOT + "/s-op-6-closed.json")).toBe(false);
    expect(calls.some(c => c.kind === "rm")).toBe(false);
    expect(inspectClockObservation(result.completion)).toMatchObject({
      source_observation_evidence_valid: false, qualified_clock: false, observation_valid: false });
    for (const call of calls) expect(call.child.kill).not.toHaveBeenCalled();
  });
  it("marks engine substitution UNKNOWN without issuing CREATE", async () => {
    switches.backendOutput = (kind, out) => kind === "info"
      ? JSON.stringify({ ...facts.engine, ID: "FOREIGN_ENGINE" }) + "\n" : out;
    await execute();
    expect(calls.some(c => c.kind === "create")).toBe(false);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each([
    ["CID", r => { r.Id = "e".repeat(64); }],
    ["image", r => { r.Image = "sha256:" + "e".repeat(64); }],
    ["namespace", r => { r.PidMode = false; }],
    ["source/env", r => { r.Env = false; }],
  ])("rejects %s substitution before START", async (_label, transform) => {
    switches.backendOutput = (kind, out) => {
      if (kind === "inspect") { const r = JSON.parse(out); transform(r); return JSON.stringify(r) + "\n"; }
      return out;
    };
    await execute();
    expect(calls.some(c => c.kind === "start")).toBe(false);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each(["-plan.mjs", "-program.mjs", "-program.test.mjs"])(
    "reacquires the %s source lease after durable registration at the START actuator boundary", async suffix => {
      switches.publication = path => {
        if (path.endsWith("/s-op-6-registered.json")) {
          const source = CLOCK_OBSERVATION_SOURCES.find(p => p.endsWith(suffix));
          put(source, Buffer.concat([files.get(source).bytes, Buffer.from("\n// changed\n")]), 0o100644);
        }
      };
      await execute();
      expect(calls.some(c => c.kind === "start")).toBe(false);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it("cannot hand off O's published SOURCE candidate after its program-source lease changes", async () => {
    let reached = false;
    switches.publication = path => {
      if (path.endsWith("/o-result.json")) {
        reached = true;
        const source = CLOCK_OBSERVATION_SOURCES.find(p => p.endsWith("-program.mjs"));
        files.get(source).ctimeMs++;
      }
    };
    await execute();
    expect(reached).toBe(true);
    expect(files.has(ROOT + "/o-result.json")).toBe(true);
    expect(roles.O.send.mock.calls.filter(([m]) => m.type === "RESULT")).toEqual([]);
    expect(result).toBeNull();
    expect(failure?.message).toBe("observation_source_or_preparation_lease_changed");
  });
  it("rejects changed original bytes, inode aliases, or a source/cohort lease after completion", async () => {
    await execute();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
    const old = files.get(ROOT + "/s-op-6-closed.json");
    files.set(ROOT + "/s-op-6-closed.json", { ...old, nlink: 2 });
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    files.set(ROOT + "/s-op-6-closed.json", old);
    put(ROOT + "/s-op-6-closed.json", old.bytes);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each(["-cohort.json", "-init.mjs", "-program.mjs", "-program.test.mjs"])("invalidates a completed chain on changed %s lease", async suffix => {
    await execute();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
    const source = CLOCK_OBSERVATION_SOURCES.find(p => p.endsWith(suffix));
    put(source, files.get(source).bytes, 0o100644);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it("rejects prospective certificate/rate additions to the closed frame grammar", async () => {
    switches.initOutput = line => {
      const frame = JSON.parse(line);
      frame.minimum_future_rate = "1"; frame.qualified_clock = true;
      return JSON.stringify(frame) + "\n";
    };
    await execute();
    expect(inspectClockObservation(result.completion).status).toBe("UNKNOWN");
  });
  it("refuses raw JSON plans and helpers without a private plan, owned IPC and exact fixed argv", async () => {
    expect(() => clockObservationPlanEvidence({ ready: true })).toThrow("private_clock_observation_plan");
    for (const fn of [runClockObservationOuter, runClockObservationProducer, runClockObservationSupervisor]) {
      await expect(context.run(roles.H, () => fn([{ ready: true }]))).rejects.toThrow("direct_actor_refused");
    }
    expect(calls).toHaveLength(0);
    for (const argv of [{ ready: true }, ["--fixed-namespace-case", "source-clock-01", ROOT],
      ["--clock-observation", "source-clock-01", ROOT, "ARM"], ["--clock-observation", { ready: true }, ROOT]]) {
      expect(() => runClockObservationEntry(argv)).toThrow();
    }
  });
  it("rejects init CLI/payload extras even behind a mocked image boundary", async () => {
    switches.initContext = p => { p.argv.push("WORK"); };
    await execute();
    expect(roles.init.stdout.write).not.toHaveBeenCalled();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    expect(calls.filter(c => c.executable === "/source-fixture/node")).toHaveLength(3);
  });
  it("rejects an init environment request or ready switch without reading stdin or forking", async () => {
    switches.initContext = p => { p.env.AIRLOCK_ARM = "ready"; };
    await execute();
    expect(roles.init.stdout.write).not.toHaveBeenCalled();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
    expect(calls.find(c => c.kind === "start").child.stdin.write).not.toHaveBeenCalled();
  });
  it("publishes exclusive originals without overwrite and accepts only bounded canonical ns", () => {
    context.run(roles.H, () => {
      observationWrite(ROOT, "closed-original.json", { schema: "source-only" }, 501);
      expect(() => observationWrite(ROOT, "closed-original.json", { schema: "changed" }, 501)).toThrow("EEXIST");
    });
    for (const v of [1, -1, "01", "-1", "1.0", "1e3", "1".repeat(25), ""]) expect(() => ns(v)).toThrow("canonical_ns");
    expect(ns("0")).toBe(0n);
    expect(ns("45000000000")).toBe(45000000000n);
  });
});

describe("405a4945 finite owned-evidence and publication corrections", () => {
  it.each(["replace", "delete"])("HIGH no START on custody %s during its durable registration", async action => {
    let reached = false;
    switches.publication = path => {
      if (path.endsWith("/s-op-6-registered.json")) {
        reached = true; changeOwnedOriginal("s-custody.json", action);
      }
    };
    await execute();
    expect(reached).toBe(true);
    expect(calls.some(c => c.kind === "start")).toBe(false);
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each(["engine", "stop", "inspect", "wait", "remove"])(
    "HIGH rechecks custody at the equivalent %s frontier after registration", async kind => {
      let frontier = null;
      switches.publication = path => {
        if (!/\/s-op-[0-9]+-registered\.json$/.test(path) || frontier !== null) return;
        const reg = JSON.parse(files.get(path).bytes);
        if (reg.kind === kind && reg.custody !== null) {
          frontier = calls.length; changeOwnedOriginal("s-custody.json", "replace");
        }
      };
      await execute();
      expect(frontier).not.toBeNull();
      expect(calls.slice(frontier).filter(c => c.kind)).toEqual([]);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it.each([
    ["H", "o-request.json"], ["H", "h-start.json"],
    ["O", "p-request.json"], ["O", "o-ticket.json"],
    ["P", "s-request.json"], ["P", "o-ticket.json"],
  ])("HIGH %s cannot spawn its child after registration replaces %s", async (owner, name) => {
    let reached = false;
    switches.publication = path => {
      if (path.endsWith("/" + owner.toLowerCase() + "-child-registered.json")) {
        reached = true; changeOwnedOriginal(name, "replace");
      }
    };
    await execute();
    expect(reached).toBe(true);
    expect(calls.some(c => c.executable === "/source-fixture/node" && c.owner === owner)).toBe(false);
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each(["s-request.json", "o-ticket.json"])(
    "HIGH S cannot CREATE after registration deletes retained %s", async name => {
      let reached = false;
      switches.publication = path => {
        if (!/\/s-op-[0-9]+-registered\.json$/.test(path) || reached) return;
        if (JSON.parse(files.get(path).bytes).kind === "create") {
          reached = true; changeOwnedOriginal(name, "delete");
        }
      };
      await execute();
      expect(reached).toBe(true);
      expect(calls.some(c => c.kind === "create")).toBe(false);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it.each([["O", "o-request.json"], ["P", "o-ticket.json"], ["S", "s-request.json"]])(
    "HIGH no OBSERVE_ONLY handoff to %s after HELLO loses %s", async (roleName, name) => {
      switches.changeMessage = (actor, message) => {
        if (actor === roleName && message.schema === "airlock.clock-observation-hello.v1")
          changeOwnedOriginal(name, "delete");
        return message;
      };
      await execute();
      expect(roles[roleName].parent.send).not.toHaveBeenCalled();
      expect(calls.some(c => c.kind)).toBe(false);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it.each([["O", "o-child-close.json"], ["P", "p-child-close.json"], ["S", "s-custody.json"]])(
    "HIGH %s cannot hand off RESULT when publication deletes %s", async (roleName, name) => {
      let reached = false;
      switches.publication = path => {
        if (path.endsWith("/" + roleName.toLowerCase() + "-result.json")) {
          reached = true; changeOwnedOriginal(name, "delete");
        }
      };
      await execute();
      expect(reached).toBe(true);
      expect(roles[roleName].send.mock.calls.filter(([m]) => m.type === "RESULT")).toEqual([]);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it("HIGH H cannot mint its SOURCE receipt after completion publication loses O-close originals", async () => {
    switches.publication = path => {
      if (path.endsWith("/h-completion.json")) changeOwnedOriginal("h-child-close.json", "delete");
    };
    await execute();
    expect(files.has(ROOT + "/h-completion.json")).toBe(true);
    expect(result).toBeNull();
    expect(failure.message).toContain("MISSING_ORIGINAL");
  });
  it.each(["o-request.json", "h-start.json"])(
    "HIGH O cannot issue/use its one-use ticket after ticket publication deletes %s", async name => {
      switches.publication = path => {
        if (path.endsWith("/o-ticket.json")) changeOwnedOriginal(name, "delete");
      };
      await execute();
      expect(files.has(ROOT + "/o-ticket.json")).toBe(true);
      expect(files.has(ROOT + "/p-request.json")).toBe(false);
      expect(calls.some(c => c.executable === "/source-fixture/node" && c.owner === "O")).toBe(false);
      expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
    });
  it.each(["o-request.json", "h-child-registered.json"])(
    "HIGH H cannot mint its SOURCE receipt after completion publication deletes its owned %s", async name => {
      switches.publication = path => {
        if (path.endsWith("/h-completion.json")) changeOwnedOriginal(name, "delete");
      };
      await execute();
      expect(files.has(ROOT + "/h-completion.json")).toBe(true);
      expect(result).toBeNull();
      expect(failure.message).toContain("MISSING_ORIGINAL");
    });
  it.each([
    ["O", "streams"], ["O", "actual-close"], ["O", "IPC"],
    ["P", "streams"], ["P", "actual-close"], ["P", "IPC"],
  ])("MEDIUM %s publication must contain child %s settlement with refreshed raw and outer hashes", async (owner, phase) => {
    let contradiction;
    switches.changeMessage = (actor, message) => {
      if (actor === owner && message.type === "RESULT") {
        const close = JSON.parse(files.get(ROOT + "/" + owner.toLowerCase() + "-child-close.json").bytes).close;
        const at = phase === "streams" ? close.streams_settled_ns
          : phase === "actual-close" ? close.actual_close_ns : close.messages.at(-1).received_ns;
        contradiction = { ...message, publication_sample_ns: (BigInt(at) - 1n).toString() };
        return contradiction;
      }
      return message;
    };
    await execute();
    expect(failure).toBeNull();
    expect(result.status).toBe("SOURCE_CANDIDATE");
    expect(roles.init.stdout.write).toHaveBeenCalledTimes(2);
    expect(clockObservationCompletionOriginal(result.completion).original)
      .toEqual(observationRead(ROOT + "/h-completion.json").handle);
    const parent = JSON.parse(files.get(ROOT + "/" + owner.toLowerCase() + "-result.json").bytes);
    expect(BigInt(contradiction.publication_sample_ns)).toBeGreaterThan(BigInt(parent.handshake.received_ns));
    const read = inspectClockObservation(result.completion);
    if (phase === "streams") correctionRawWitness(owner + "-publication-before-child-streams", read);
    expect(read).toMatchObject({ source_observation_evidence_valid: false, observation_valid: false,
      reason: "observation_child_settlement_after_parent_publication" });
  });
  it.each(["O", "P"])("MEDIUM %s allows equal child settlement/publication in its OWN clock domain only", async owner => {
    switches.changeMessage = (actor, message) => {
      if (actor !== owner || message.type !== "RESULT") return message;
      const close = JSON.parse(files.get(ROOT + "/" + owner.toLowerCase() + "-child-close.json").bytes).close;
      return { ...message, publication_sample_ns: close.streams_settled_ns };
    };
    await execute();
    expect(failure).toBeNull();
    expect(inspectClockObservation(result.completion)).toMatchObject({
      source_observation_evidence_valid: true, observation_valid: false, qualified_clock: false, workload_admission: false });
  });
  it("MEDIUM retains the equivalent S-operation settlement/publication boundary", async () => {
    switches.changeMessage = (actor, message) => {
      if (actor !== "S" || message.type !== "RESULT") return message;
      const s = JSON.parse(files.get(message.file.path).bytes);
      const last = JSON.parse(files.get(s.operations.at(-1).closed.path).bytes);
      return { ...message, publication_sample_ns: (BigInt(last.close.streams_settled_ns) - 1n).toString() };
    };
    await execute();
    expect(failure).toBeNull();
    expect(inspectClockObservation(result.completion)).toMatchObject({
      source_observation_evidence_valid: false, reason: "observation_operation_after_publication" });
  });
});

describe("independent confinement and bounded diagnostics", () => {
  it("models empty bare-base User/WorkingDir defaults, never the legacy /case file image", async () => {
    await execute();
    const create = calls.find(c => c.kind === "create");
    const withoutOverrides = create.argv.filter(a => !["--workdir=/", "--user=65532:65532", "--entrypoint=/usr/local/bin/node"].includes(a));
    expect(independentBareBaseConfig(withoutOverrides)).toMatchObject({
      WorkingDir: "", User: "", Entrypoint: ["docker-entrypoint.sh"],
    });
    expect(createdConfig).toMatchObject({
      WorkingDir: "/", User: "65532:65532", Entrypoint: ["/usr/local/bin/node"], Cmd: fixedCommand,
    });
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
  });
  it("models Docker-added HOSTNAME/HOME and validates the fixed no-work environment", async () => {
    await execute();
    expect(failure).toBeNull();
    expect(roles.init.env).toMatchObject({ HOSTNAME: "airlock-clock-source-clock-01", HOME: "/",
      YARN_VERSION: "1.22.22" });
    expect(roles.init.stdout.write).toHaveBeenCalledTimes(2);
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
  });
  it.each([
    ["HOSTNAME", "foreign-host"], ["HOME", "/foreign"], ["HOSTNAME", undefined], ["TERM", "xterm"],
    ["YARN_VERSION", undefined], ["YARN_VERSION", ""], ["YARN_VERSION", "1.22.21"], ["YARN_VERSION", "1.22.23"],
  ])("refuses unsupported daemon environment %s=%s", async (key, value) => {
    switches.initContext = p => { if (value === undefined) delete p.env[key]; else p.env[key] = value; };
    await execute();
    expect(roles.init.stdout.write).not.toHaveBeenCalled();
    expect(inspectClockObservation(result?.completion).source_observation_evidence_valid).toBe(false);
  });
  it.each([
    ["missing", ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "NODE_VERSION=24.10.0"]],
    ["wrong", ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.21"]],
    ["extra", ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22", "TERM=xterm"]],
  ])("rejects unpinned image environment %s before source actor launch", async (_name, env) => {
    facts.image_env = env; put(ROOT + "/source-facts.json", JSON.stringify(facts));
    await execute();
    expect(failure?.message).toBe("observation_fixed_source_facts");
    expect(calls).toEqual([]);
  });
  it.each([
    ["network", argv => argv.filter(a => a !== "--network=none")],
    ["read-only root", argv => argv.filter(a => a !== "--read-only")],
    ["privilege", argv => argv.map(a => a === "--privileged=false" ? "--privileged=true" : a)],
    ["capabilities", argv => argv.filter(a => a !== "--cap-drop=ALL")],
    ["hostname", argv => argv.filter(a => !a.startsWith("--hostname="))],
    ["home", argv => argv.filter(a => a !== "--env=HOME=/")],
    ["empty inherited workdir", argv => argv.filter(a => a !== "--workdir=/")],
    ["foreign workdir", argv => argv.map(a => a === "--workdir=/" ? "--workdir=/case" : a)],
    ["file Cmd", argv => [...argv.slice(0, -3), "/airlock/sdk-absent-clock-observation-init.mjs"]],
    ["extra arguments", argv => [...argv, "WORK"]],
    ["changed program", argv => [...argv.slice(0, -1), argv.at(-1).replace('unit: "ns"', 'unit: "ms"')]],
    ["foreign image", argv => argv.map(a => a === facts.image_id ? "sha256:" + "e".repeat(64) : a)],
    ["host mount", argv => [...argv.slice(0, -2), "--volume=/host:/case", ...argv.slice(-2)]],
  ])("the doubled backend independently rejects changed CREATE %s", async (_name, change) => {
    await execute();
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(true);
    const create = calls.find(call => call.kind === "create"), changed = change(create.argv);
    expect(changed).not.toEqual(create.argv);
    expect(() => dispatch(create.executable, changed, create.options)).toThrow();
  });
  it("the doubled backend independently rejects a weakened inspection predicate", async () => {
    await execute();
    const inspect = calls.find(call => call.kind === "inspect");
    const changed = inspect.argv.map(a => a.replace(".HostConfig.NetworkMode", ".HostConfig.PidMode"));
    expect(changed).not.toEqual(inspect.argv);
    expect(() => dispatch(inspect.executable, changed, inspect.options)).toThrow();
  });
  it.each(["Cmd", "WorkingDir", "Env"])("the doubled backend rejects changed %s inspection predicates", async key => {
    await execute();
    const inspect = calls.find(call => call.kind === "inspect");
    const changed = inspect.argv.map(a => a.replace(".Config." + key, ".Config.Foreign"));
    expect(changed).not.toEqual(inspect.argv);
    expect(() => dispatch(inspect.executable, changed, inspect.options)).toThrow();
  });
  it("cannot refresh source/hash fixtures to admit a semantically changed standalone command", async () => {
    await execute();
    const create = calls.find(call => call.kind === "create");
    const changed = [...create.argv.slice(0, -1), create.argv.at(-1).replace('unit: "ns"', 'unit: "ms"')];
    const path = CLOCK_OBSERVATION_SOURCES.find(p => p.endsWith("-program.mjs"));
    put(path, files.get(path).bytes.toString().replace('unit: "ns"', 'unit: "ms"'), 0o100644);
    facts.sources = facts.sources.map(pin => ({ path: pin.path, sha256: hash(files.get(pin.path).bytes) }));
    facts.program_source_sha256 = hash(JSON.stringify(data(facts.sources)));
    facts.program_sha256 = hash(changed.at(-1));
    facts.command_sha256 = hash(JSON.stringify(changed.slice(changed.indexOf(facts.image_id) + 1)));
    put(ROOT + "/source-facts.json", JSON.stringify(facts));
    expect(() => independentProgramCommand(changed.slice(changed.indexOf(facts.image_id) + 1))).toThrow();
    expect(() => dispatch(create.executable, changed, create.options)).toThrow();
    context.run(roles.H, () => expect(() => prepareClockObservationPlan({ case_id: facts.case_id, root: ROOT }))
      .toThrow("observation_fixed_source_facts"));
    expect(inspectClockObservation(result.completion).source_observation_evidence_valid).toBe(false);
  });
  it("bounds repeated output/IPC diagnostics while still observing owned stream settlement", async () => {
    const c = context.run(roles.H, child);
    const watched = context.run(roles.H, () => collectObservationChild(c, { role: "H", last: null }, { ipc: true }));
    context.run(roles.H, () => {
      for (let n = 0; n < 500; n++) {
        c.stdout.emit("data", Buffer.alloc(16385));
        c.emit("message", { excess: "x".repeat(4097) });
      }
      c.connected = false; c.close();
    });
    const close = await watched.done;
    expect(close.errors.length).toBeLessThanOrEqual(16);
    expect(close.errors).toContain("observation_output_bound");
    expect(close.errors).toContain("observation_unexpected_or_bounded_IPC");
    expect(close.output.stdout.chunks).toEqual([]);
    expect(close.eof).toEqual({ stdout: true, stderr: true });
    expect(close.closed).toEqual({ stdin: true, stdout: true, stderr: true });
  });
});
