import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn(), writeSync: vi.fn(), fstatSync: vi.fn(),
  fsyncSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  readdirSync: vi.fn(), constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("ACTUAL_PROCESS_FORBIDDEN"); }) }));
vi.mock("node:process", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage(), base = { execPath: "/source-host/node", version: "v22.16.0",
    pid: 100, ppid: 99, connected: false, getuid: () => 501, argv: [] };
  const proxy = new Proxy(base, { get(_t, key) {
    const p = context.getStore() ?? base;
    if (["on", "once", "removeListener"].includes(key)) return p.bus[key].bind(p.bus);
    return p[key];
  }, set(_t, key, value) { (context.getStore() ?? base)[key] = value; return true; } });
  return { default: proxy, hostTestContext: context, hostTestBase: base };
});

import * as fs from "node:fs";
import { spawn } from "node:child_process";
import { EventEmitterAsyncResource } from "node:events";
import { hostTestContext as context, hostTestBase as base } from "node:process";
import { CLOCK_HOST_SOURCES, prepareClockHostPlan, clockHostPlanEvidence } from "./sdk-absent-clock-host-plan.mjs";
import { observeClockHostControl } from "./sdk-absent-clock-host-observer.mjs";
import * as hostObserver from "./sdk-absent-clock-host-observer.mjs";
import { inspectClockHostControl } from "./sdk-absent-clock-host-reader.mjs";
import { runClockHostFixture } from "./sdk-absent-clock-host-fixture.mjs";
import { observationRead } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence } from "./sdk-absent-clock-observation-plan.mjs";
import { clockObservationCompletionOriginal } from "./sdk-absent-clock-observation-observer.mjs";
import actualConfig from "./sdk-absent-clock-host-actual.config.mjs";
import sourceConfig from "./sdk-absent-clock-host-source.config.mjs";
import { publishClockHostOriginal } from "./sdk-absent-clock-host-io.mjs";

const files = new Map(), descriptors = new Map(), openedObjects = new Map(), ROOT = "/source-host/case";
let inode, fd, index = 0, request, root, switches, calls, role, publications, publishing;
class Port extends EventEmitterAsyncResource {
  constructor() { super({ name: "SOURCE_ONLY_host_boundary" }); this.closed = false; }
  close() { if (!this.closed) { this.closed = true; this.emit("close"); } }
}
const flush = async () => { for (let n = 0; n < 1600; n++) await Promise.resolve(); };
function put(path, bytes, mode = 0o100600) {
  bytes = Buffer.from(bytes);
  files.set(path, { bytes, dev: 1, ino: ++inode, nlink: 1, size: bytes.length, mode, uid: 501,
    mtimeMs: 100, ctimeMs: 100, isFile: () => (mode & 0o170000) === 0o100000,
    isDirectory: () => (mode & 0o170000) === 0o040000, isSymbolicLink: () => false });
}
async function setup() {
  files.clear(); descriptors.clear(); openedObjects.clear();
  inode = 1; fd = 10; switches = {}; calls = []; publications = []; publishing = null;
  root = ROOT + "-" + ++index;
  request = { root, case_id: "host-source-" + index, nonce: index.toString(16).padStart(64, "0"), control: "normal" };
  fs.openSync.mockImplementation((path, flags) => {
    switches.beforeOpen?.(path, flags);
    if (flags === "wx") { if (files.has(path)) throw Error("EEXIST"); put(path, ""); }
    if (!files.has(path)) throw Error("MISSING:" + path);
    const number = ++fd;
    descriptors.set(number, path); openedObjects.set(number, files.get(path));
    switches.afterOpen?.(path, flags, number);
    return number;
  });
  fs.closeSync.mockImplementation(n => { descriptors.delete(n); openedObjects.delete(n); });
  fs.fstatSync.mockImplementation(n => ({ ...openedObjects.get(n) }));
  fs.lstatSync.mockImplementation(path => {
    if (!files.has(path)) throw Error("MISSING:" + path);
    return { ...files.get(path) };
  });
  fs.readFileSync.mockImplementation(n => {
    switches.read?.(descriptors.get(n), n);
    return Buffer.from(openedObjects.get(n).bytes);
  });
  fs.writeSync.mockImplementation((n, bytes, offset, length) => {
    const f = openedObjects.get(n);
    f.bytes = Buffer.concat([f.bytes, bytes.subarray(offset, offset + length)]); f.size = f.bytes.length;
    return length;
  });
  fs.fsyncSync.mockImplementation(n => {
    const path = descriptors.get(n);
    switches.fsync?.(path, n);
    if (path.endsWith(".json")) publishing = path;
    if (path === root && publishing) {
      const published = publishing; publishing = null;
      publications.push({ path: published, owner: context.getStore()?.owner ?? "host" });
      switches.publication?.(published);
    }
  });
  fs.realpathSync.mockImplementation(path => path);
  fs.readdirSync.mockImplementation(path => [...files.keys()]
    .filter(name => name.startsWith(path + "/") && !name.slice(path.length + 1).includes("/")));
  fs.linkSync.mockImplementation((from, to) => {
    if (files.has(to)) throw Error("EEXIST");
    const f = files.get(from); f.nlink++; files.set(to, f);
    publications.push({ path: to, owner: context.getStore()?.owner ?? "host" });
    switches.publication?.(to);
  });
  fs.unlinkSync.mockImplementation(path => { files.get(path).nlink--; files.delete(path); });
  put(root, "", 0o040700); put("/source-host/node", "SOURCE_ONLY_NODE_BYTES", 0o100755);
  // Only read source bytes before the doubled pipeline. No actual writes, clock,
  // IPC, timer, or child process are used by any positive SOURCE case.
  const actual = await vi.importActual("node:fs");
  for (const path of CLOCK_HOST_SOURCES) put(path, actual.readFileSync(path), 0o100644);
  base.bus = new Port(); base.ticks = 1000000000n; base.connected = false;
  base.hrtime = { bigint: vi.fn(() => { base.ticks += 1000n; return base.ticks; }) };
  spawn.mockImplementation(dispatch);
}
function dispatch(executable, argv, options) {
  expect(executable).toBe("/source-host/node");
  expect(argv).toEqual([
    new URL("sdk-absent-clock-host-fixture.mjs", import.meta.url).pathname,
    "--fixed-host-fixture", root + "/host-request.json",
    JSON.parse(files.get(root + "/host-intent.json").bytes).request.sha256,
  ]);
  expect(options).toEqual({ cwd: root, env: { HOME: root, PATH: "/usr/bin:/bin" },
    shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  if (switches.spawnThrow) throw Error("SOURCE_SPAWN_FAILED");
  const c = new Port(); c.connected = true;
  c.pid = Object.hasOwn(switches, "childPid") ? switches.childPid : 101;
  for (const name of ["stdout", "stderr", "stdin"]) c[name] = new Port();
  c.kill = vi.fn(() => { throw Error("SIGNALS_FORBIDDEN"); });
  c.stdin.end = vi.fn(() => c.stdin.close());
  c.send = vi.fn((message, callback) => {
    if (switches.beforeAck) switches.beforeAck(message);
    queueMicrotask(() => {
      context.run(role, () => {
        if (!switches.dropAck) {
          role.bus.emit("message", switches.ack?.(message) ?? message);
          if (switches.duplicateAck) role.bus.emit("message", message);
          role.ackDelivered = true;
        }
      });
      if (!switches.pendingSend) callback?.(switches.ackFailure ? Error("ACK_LOST") : null);
    });
  });
  const close = () => {
    if (switches.neverClose || c.closed) return;
    c.closed = true;
    if (!switches.noExit) c.emit("exit", switches.exitCode ?? role.exitCode,
      switches.missingExitSignal ? undefined : switches.signal ?? null);
    for (const name of ["stdout", "stderr"]) {
      if (!switches.noEOF) c[name].emit("end");
      if (!switches.pendingStream) c[name].close();
    }
    c.stdin.close(); c.connected = !!switches.connected;
    c.emit("close", switches.closeCode ?? role.exitCode,
      switches.missingCloseSignal ? undefined : switches.closeSignal ?? switches.signal ?? null);
  };
  calls.push(c);
  role = { ...base, owner: "fixture", bus: null, pid: switches.fixturePid ?? 101, ppid: 100, connected: true,
    ticks: 900000000000n, exitCode: 0, argv: [executable, ...argv] };
  context.run(role, () => { role.bus = new Port(); });
  role.hrtime = { bigint: vi.fn(() => {
    role.ticks += switches.fixtureReverse ? -1000n : 1000n; return role.ticks;
  }) };
  role.send = vi.fn((message, callback) => {
    queueMicrotask(() => {
      const changed = switches.message?.(message) ?? message;
      c.emit("message", changed);
      if (switches.duplicateMessage) c.emit("message", changed);
      if (message.schema === "airlock.clock-host-result.v1") role.resultDelivered = true;
      if (message.schema === "airlock.clock-host-complete.v1") switches.afterComplete?.();
      if (!switches.fixtureSendPending) callback?.(switches.fixtureSendFailure ? Error("SEND_FAILED") : null);
    });
  });
  role.disconnect = vi.fn(() => {
    role.connected = false; c.connected = !!switches.connected; c.emit("disconnect");
    switches.beforeClose?.();
    queueMicrotask(close);
  });
  role.exit = vi.fn(code => {
    if (role.exited) return;
    role.exited = true; role.exitCode = code; role.disconnect();
  });
  queueMicrotask(() => context.run(role, async () => {
    if (switches.parentLoss) { role.connected = false; role.bus.emit("disconnect"); }
    if (switches.streamBytes) c.stdout.emit("data", Buffer.alloc(switches.streamBytes, 120));
    if (switches.streamError) c.stderr.emit("error", Error("SOURCE_STREAM_FAILURE"));
    try { await runClockHostFixture(argv.slice(1)); }
    catch (e) { role.failure = e.message; role.exit(70); }
  }));
  if (switches.slowSpawn) base.ticks += 45000000000n;
  if (switches.hostLossOnSpawn) { base.connected = false; base.bus.emit("disconnect"); }
  return c;
}
async function run() {
  const plan = prepareClockHostPlan(request);
  const state = { plan, result: undefined, error: undefined };
  observeClockHostControl(plan).then(v => { state.result = v; }, e => { state.error = e; });
  await flush();
  return { ...state, state, settle: async () => { await flush(); return state.result; } };
}
beforeEach(() => {
  vi.useFakeTimers();
  const timer = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation((callback, delay, ...args) => {
    const owner = context.getStore();
    return timer(() => context.run(owner, () => callback(...args)), delay);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("SOURCE ONLY fixed host observer", () => {
  it("rejects raw plans without touching filesystem or spawning", () => {
    for (const raw of [{}, { ready: true }, { target: "O" }, JSON.parse('{"control":"normal"}')])
      expect(() => clockHostPlanEvidence(raw)).toThrow("host_private_plan_required");
    expect(fs.openSync).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("keeps actual controls outside source/default discovery, without an enabling environment flag", () => {
    expect(actualConfig.test.include).toEqual(["rig/sdk-absent-clock-host-actual.mjs"]);
    expect(actualConfig.test.retry).toBe(0);
    expect(actualConfig.test.fileParallelism).toBe(false);
    expect(actualConfig.test.testTimeout).toBe(55000);
    for (const project of sourceConfig.test.projects)
      expect(project.test.include).not.toContain("rig/sdk-absent-clock-host-actual.mjs");
    expect(actualConfig.test.include[0]).not.toMatch(/\.(test|spec)\.[cm]?[jt]s$/);
  });

  it("refuses programs, backends, signals and observation O before any effect", () => {
    for (const extra of [{ program: "node" }, { backend: "docker" }, { signal: "SIGTERM" }, { target: "O" }, { fixture_pid: 101 }])
      expect(() => prepareClockHostPlan({ root: "/source-host/case", case_id: "host-01",
        nonce: "a".repeat(64), control: "normal", ...extra })).toThrow();
    expect(fs.openSync).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("observes the real fixed source through the shared collector; mocks are not qualification", async () => {
    await setup();
    expect(CLOCK_HOST_SOURCES).toHaveLength(32);
    for (const name of ["private-original-file.mjs", "private-original-file.test.mjs",
      "sdk-absent-clock-observation-program.mjs", "sdk-absent-clock-observation-program.test.mjs"])
      expect(CLOCK_HOST_SOURCES).toContain(new URL(name, import.meta.url).pathname);
    const f = await run();
    expect(f.error).toBeUndefined();
    expect(f.result.status).toBe("HOST_FIXTURE_CANDIDATE");
    expect(inspectClockHostControl(f.result.completion)).toMatchObject({
      host_mechanics_candidate: true, outer_tool_close_required: true, host_qualified: false,
      observation_valid: false, qualified_clock: false, workload_admission: false, native_qualified: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].kill).not.toHaveBeenCalled();
    expect(publications.filter(p => p.owner === "fixture").map(p => p.path))
      .toEqual([root + "/fixture-output.json"]);
    const intent = JSON.parse(files.get(root + "/host-intent.json").bytes);
    const close = JSON.parse(files.get(root + "/host-close.json").bytes);
    expect(intent.original_start_ns).toBe("1000001000");
    expect(BigInt(intent.original_deadline_ns) - BigInt(intent.original_start_ns)).toBe(45000000000n);
    expect(BigInt(close.issued_ns)).toBeGreaterThan(BigInt(intent.original_start_ns));
    expect(BigInt(close.close.actual_close_ns)).toBeGreaterThanOrEqual(BigInt(close.exit.observed_ns));
    expect(BigInt(close.close.streams_settled_ns) - BigInt(intent.original_start_ns)).toBeLessThan(45000000000n);
    expect(BigInt(close.hello.tau0_ns)).toBeGreaterThan(BigInt(close.close.actual_close_ns));
    expect(close.outer_tool_close_required).toBe(true);
    expect(files.get(root + "/host-request.json").nlink).toBe(1);
    expect(fs.linkSync).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(descriptors.size).toBe(0);
  });

  it("rejects a same-byte rewrite with restored mtime while the file fsync blocks", async () => {
    await setup();
    switches.fsync = path => {
      if (path.startsWith(root + "/host-request.json")) {
        const f = files.get(path), mtime = f.mtimeMs;
        f.bytes = Buffer.from(f.bytes); f.ctimeMs++; f.mtimeMs = mtime;
      }
    };
    const f = await run();
    expect(f.error?.message).toBe("private_original_publication_changed");
    expect(calls).toHaveLength(0);
  });

  it("also publishes the pending outer-tool diagnostic without a hardlink/ctime exception", async () => {
    await setup();
    const original = publishClockHostOriginal(root, "pending-outer-tool-close.json", {
      schema: "SOURCE_ONLY_DIAGNOSTIC", qualification_claimed: false,
    }, 501);
    expect(files.get(original.path).bytes.toString()).toBe(
      '{"qualification_claimed":false,"schema":"SOURCE_ONLY_DIAGNOSTIC"}\n');
    expect(fs.linkSync).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(descriptors.size).toBe(0);
  });

  it("rejects directory substitution inside open even when the original pathname is restored before fsync", async () => {
    await setup();
    const original = files.get(root);
    let substituted = false;
    switches.beforeOpen = (path, flags) => {
      if (path === root && (flags & fs.constants.O_DIRECTORY) && !substituted) {
        substituted = true;
        files.set(root, { ...original, ino: original.ino + 10000 });
      }
    };
    switches.afterOpen = (path, flags) => {
      if (path === root && (flags & fs.constants.O_DIRECTORY)) files.set(root, original);
    };
    const f = await run();
    expect(substituted).toBe(true);
    expect(files.get(root)).toBe(original);
    expect(f.error?.message).toBe("private_original_directory_fd_changed");
    expect(calls).toHaveLength(0);
    expect(descriptors.size).toBe(0);
    expect(openedObjects.size).toBe(0);
  });

  it.each(["type", "uid", "mode", "dev", "ino"])(
    "rejects directory descriptor %s changes during fsync even with the pathname restored", async field => {
      await setup();
      const original = files.get(root);
      switches.fsync = (path, number) => {
        if (path !== root) return;
        const changed = { ...original };
        if (field === "type") changed.isDirectory = () => false;
        else if (field === "uid") changed.uid++;
        else if (field === "mode") changed.mode = 0o040755;
        else changed[field]++;
        openedObjects.set(number, changed);
      };
      const f = await run();
      expect(files.get(root)).toBe(original);
      expect(f.error?.message).toBe("private_original_directory_fd_changed");
      expect(calls).toHaveLength(0);
      expect(descriptors.size).toBe(0);
    });

  it("permits owned publication directory entry-count changes without relaxing original file identity", async () => {
    await setup();
    const original = files.get(root), before = original.nlink;
    switches.afterOpen = (path, flags) => {
      if (path === root + "/pending-outer-tool-close.json" && flags === "wx") original.nlink++;
    };
    const published = publishClockHostOriginal(root, "pending-outer-tool-close.json",
      { qualification_claimed: false }, 501);
    expect(original.nlink).toBe(before + 1);
    expect(published.nlink).toBe(1);
    expect(descriptors.size).toBe(0);
  });

  it("retains and rechecks the directory descriptor through final original-file readback", async () => {
    await setup();
    let injected = false;
    switches.read = path => {
      if (path !== root + "/host-request.json" || injected
        || !publications.some(p => p.path === path)) return;
      const entry = [...descriptors].find(([, openedPath]) => openedPath === root);
      if (entry) {
        injected = true;
        const [number] = entry, original = openedObjects.get(number);
        openedObjects.set(number, { ...original, ino: original.ino + 10000 });
      }
    };
    const f = await run();
    expect(injected).toBe(true);
    expect(f.error?.message).toBe("private_original_directory_fd_changed");
    expect(calls).toHaveLength(0);
    expect(descriptors.size).toBe(0);
  });
  it.each(["file-fsync", "directory-fsync", "final-readback"])(
    "does not dispatch or acknowledge complete-looking request bytes after %s failure", async frontier => {
      await setup();
      const path = root + "/host-request.json";
      switches.fsync = name => {
        if ((frontier === "file-fsync" && name === path) || (frontier === "directory-fsync" && name === root))
          throw Error("SOURCE_LATE_PUBLICATION_FAILURE");
      };
      if (frontier === "final-readback") switches.read = name => {
        if (name === path && publications.some(p => p.path === path)) throw Error("SOURCE_LATE_PUBLICATION_FAILURE");
      };
      const f = await run(), diagnostic = Buffer.from(files.get(path).bytes);
      expect(f.error?.message).toBe("SOURCE_LATE_PUBLICATION_FAILURE");
      expect(f.result).toBeUndefined(); expect(calls).toHaveLength(0);
      expect(JSON.parse(diagnostic).case_id).toBe(request.case_id);
      switches = {};
      expect(() => publishClockHostOriginal(root, "host-request.json", {}, 501)).toThrow("EEXIST");
      expect(files.get(path).bytes.equals(diagnostic)).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled(); expect(descriptors.size).toBe(0);
    });

  it("retains the explicit failed-child control as code 2, never as a signal or cancellation", async () => {
    await setup(); request.control = "failed-child";
    const f = await run(), checked = inspectClockHostControl(f.result.completion);
    expect(checked).toMatchObject({ control: "failed-child", host_mechanics_candidate: true, host_qualified: false });
    const v = JSON.parse(files.get(root + "/host-close.json").bytes);
    expect(v.exit).toMatchObject({ code: 2, signal: null });
    expect(v.close).toMatchObject({ code: 2, signal: null, ipc_settled: true, pending_sends: 0 });
    expect(v.close.errors).toEqual(["observation_child_loss_NOT_cancellation"]);
  });

  it.each(["normal", "failed-child"])("binds the actual owned fixture PID across issued/close/reader evidence: %s", async control => {
    await setup(); request.control = control;
    const f = await run(), inspected = inspectClockHostControl(f.result.completion);
    const issued = JSON.parse(files.get(root + "/host-issued.json").bytes);
    const closed = JSON.parse(files.get(root + "/host-close.json").bytes);
    const output = JSON.parse(files.get(root + "/fixture-output.json").bytes);
    expect(calls[0].pid).toBe(101);
    expect(base.pid).toBe(100);
    expect(issued.fixture_pid).toBe(101);
    expect(closed.fixture_pid).toBe(101);
    expect(closed.issuance.path).toBe(root + "/host-issued.json");
    expect(closed.hello.fixture_pid).toBe(101);
    expect(closed.candidate.fixture_pid).toBe(101);
    expect(closed.exit.fixture_pid).toBe(101);
    expect(closed.completion.fixture_pid).toBe(101);
    expect(output.fixture_pid).toBe(101);
    expect(inspected).toMatchObject({ fixture_pid: 101, host_mechanics_candidate: true, host_qualified: false });
    expect(closed.close.messages.map(m => m.value.schema)).toEqual([
      "airlock.clock-host-hello.v1", "airlock.clock-host-result.v1", "airlock.clock-host-complete.v1",
    ]);
  });

  it("independently reads an intact SOURCE completion extracted from the actual doubled pipeline", async () => {
    await setup();
    const f = await run(), retained = hostObserver.takeClockHostCompletion(f.result.completion);
    const spy = vi.spyOn(hostObserver, "takeClockHostCompletion").mockReturnValueOnce(retained);
    expect(inspectClockHostControl(f.result.completion)).toMatchObject({
      fixture_pid: 101, host_mechanics_candidate: true, host_qualified: false, observation_valid: false,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["close", "host_completion_binding_changed"], ["hello", "host_complete_command_originals_required"],
    ["result", "host_complete_command_originals_required"], ["exit", "host_complete_command_originals_required"],
    ["complete", "host_reader_validation_completion_required"], ["output", "host_exact_fixture_output_required"],
    ["issued", "host_reader_owned_pid_issuance_changed"],
  ])("reader rejects a refreshed SOURCE %s PID contradiction against the retained owned PID", async (target, reason) => {
    await setup();
    const f = await run(), retained = hostObserver.takeClockHostCompletion(f.result.completion);
    const value = structuredClone(retained.value), changed = { ...retained, value };
    const rewrite = (path, v) => {
      const file = files.get(path);
      file.bytes = Buffer.from(JSON.stringify(v) + "\n"); file.size = file.bytes.length;
      return observationRead(path, { uid: 501 }).handle;
    };
    if (target === "close") value.fixture_pid = 102;
    else if (target === "hello") {
      value.hello.fixture_pid = 102; value.close.messages[0].value.fixture_pid = 102;
    } else if (target === "result") {
      value.candidate.fixture_pid = 102; value.close.messages[1].value.fixture_pid = 102;
    } else if (target === "exit") value.exit.fixture_pid = 102;
    else if (target === "complete") {
      value.completion.fixture_pid = 102; value.close.messages[2].value.fixture_pid = 102;
    } else if (target === "output") {
      const path = root + "/fixture-output.json", out = JSON.parse(files.get(path).bytes);
      out.fixture_pid = 102;
      const handle = rewrite(path, out);
      value.candidate.file = handle; value.completion.file = handle;
      value.close.messages[1].value.file = handle; value.close.messages[2].value.file = handle;
    } else {
      const path = root + "/host-issued.json", issued = JSON.parse(files.get(path).bytes);
      issued.fixture_pid = 102;
      changed.issuance = rewrite(path, issued); value.issuance = changed.issuance;
    }
    // Only the final evidence extraction is doubled for these negative reader
    // controls; the retained PID and all baseline artifacts came from the real
    // source business path above. Refreshed hashes cannot redefine that PID.
    const spy = vi.spyOn(hostObserver, "takeClockHostCompletion").mockReturnValueOnce(changed);
    expect(() => inspectClockHostControl(f.result.completion)).toThrow(reason);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", undefined], ["null", null], ["zero", 0], ["negative-zero", -0], ["negative", -1],
    ["fraction", 1.5], ["string", "101"], ["nan", NaN], ["infinite", Infinity],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1], ["bigint", 101n],
  ])("refuses ACK and keeps unknown owned lifetime for invalid public spawn PID: %s", async (_label, pid) => {
    await setup(); switches.childPid = pid;
    const f = await run();
    if (!f.result) await vi.advanceTimersByTimeAsync(5000);
    const v = f.result ?? await f.settle();
    expect(f.state.error).toBeUndefined();
    expect(v).toMatchObject({ status: "UNKNOWN", completion: null, child_close_claimed: false });
    expect(calls[0].send).not.toHaveBeenCalled();
    expect(files.has(root + "/fixture-output.json")).toBe(false);
    expect(JSON.parse(files.get(root + "/host-issued.json").bytes).fixture_pid).toBe(null);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it.each(["normal", "failed-child"])("refuses a fixture HELLO PID different from the owned handle: %s", async control => {
    await setup(); request.control = control; switches.fixturePid = 102;
    const f = await run();
    if (!f.result) await vi.advanceTimersByTimeAsync(5000);
    expect((f.result ?? await f.settle()).status).toBe("UNKNOWN");
    expect(calls[0].send).not.toHaveBeenCalled();
    expect(files.has(root + "/fixture-output.json")).toBe(false);
  });

  it.each(["hello", "close"])("rejects a changed public handle PID at %s without rebinding it", async frontier => {
    await setup();
    if (frontier === "hello") switches.message = m => { calls[0].pid = 102; return m; };
    else switches.beforeClose = () => { calls[0].pid = 102; };
    const f = await run();
    if (!f.result) await vi.advanceTimersByTimeAsync(5000);
    expect((f.result ?? await f.settle()).status).toBe("UNKNOWN");
    expect(JSON.parse(files.get(root + "/host-issued.json").bytes).fixture_pid).toBe(101);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it("requires the ACK PID to match the fixture's own public process PID", async () => {
    await setup(); switches.ack = m => ({ ...m, fixture_pid: 102 });
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
  });

  it("does not drop unsettled streams when the owned spawn handle has no PID", async () => {
    await setup(); switches.childPid = undefined; switches.pendingStream = true;
    const f = await run();
    expect(f.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await f.settle()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(40000);
    expect(await f.settle()).toMatchObject({ status: "UNKNOWN", completion: null, child_close_claimed: false });
    expect(calls[0].stdout.listenerCount("close")).toBeGreaterThan(0);
    expect(calls[0].send).not.toHaveBeenCalled();
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it("keeps issued-record publication failure diagnostic without abandoning the spawned child", async () => {
    await setup();
    switches.fsync = path => { if (path === root + "/host-issued.json") throw Error("SOURCE_ISSUANCE_FAILED"); };
    const f = await run();
    expect(f.error).toBeUndefined();
    if (!f.result) await vi.advanceTimersByTimeAsync(5000);
    expect((f.result ?? await f.settle()).status).toBe("UNKNOWN");
    expect(calls[0].send).not.toHaveBeenCalled();
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it.each(["deadline", "reparent", "disconnect"])(
    "cannot turn a late/aborted validation into a failed-child witness using code 2 alone: %s", async fault => {
      await setup(); request.control = "failed-child"; switches.exitCode = 2; switches.closeCode = 2;
      let injected = false;
      switches.read = path => {
        if (path !== "/source-host/node" || context.getStore()?.owner !== "fixture" || !role.resultDelivered || injected) return;
        injected = true;
        if (fault === "deadline") role.ticks += 5000000000n;
        else if (fault === "reparent") role.ppid = 1;
        else role.connected = false;
      };
      const f = await run();
      expect(injected).toBe(true);
      expect(role.exitCode).toBe(70);
      expect(f.result.status).toBe("UNKNOWN");
      expect(role.send.mock.calls.some(([m]) => m.schema === "airlock.clock-host-complete.v1")).toBe(false);
    });

  it.each(["deadline", "reparent", "disconnect"].flatMap(fault =>
    ["normal", "failed-child"].map(control => [fault, control])))(
    "fences expected exit and watchdog clearance after COMPLETE callback: %s / %s", async (fault, control) => {
      await setup(); request.control = control;
      switches.afterComplete = () => {
        if (fault === "deadline") role.ticks += 5000000000n;
        else if (fault === "reparent") role.ppid = 1;
        else role.connected = false;
      };
      const f = await run();
      expect(role.send.mock.calls.some(([m]) => m.schema === "airlock.clock-host-complete.v1")).toBe(true);
      expect(role.exitCode).toBe(70);
      expect(f.result.status).toBe("UNKNOWN");
      expect(calls[0].kill).not.toHaveBeenCalled();
    });

  it("cannot redeem a host plan or fixture receipt for observation O, including with copied JSON", async () => {
    await setup();
    const f = await run();
    expect(() => clockObservationPlanEvidence(f.plan)).toThrow("private_clock_observation_plan_required");
    expect(() => clockObservationCompletionOriginal(f.result.completion)).toThrow("genuine_H_receipt_UNAVAILABLE");
    for (const value of [{}, JSON.parse(files.get(root + "/host-close.json").bytes), { ready: true }])
      expect(() => inspectClockHostControl(value)).toThrow("host_genuine_one_use_completion_required");
    const first = inspectClockHostControl(f.result.completion);
    expect(first.observation_valid).toBe(false);
    expect(() => inspectClockHostControl(f.result.completion)).toThrow("one_use_completion");
    await expect(observeClockHostControl(f.plan)).rejects.toThrow("already_used");
    expect(calls).toHaveLength(1);
  });

  it("consumes the parent nonce/root even when a second private plan is requested", async () => {
    await setup(); prepareClockHostPlan(request);
    expect(() => prepareClockHostPlan({ ...request })).toThrow("already_issued");
    const other = root + "-other"; put(other, "", 0o040700);
    expect(() => prepareClockHostPlan({ ...request, root: other })).toThrow("already_issued");
    expect(() => prepareClockHostPlan({ ...request, nonce: "b".repeat(64) })).toThrow("already_issued");
    expect(calls).toHaveLength(0);
  });

  it.each(["request", "metadata"])("burns the private plan before fallible %s evidence validation", async kind => {
    await setup();
    const plan = prepareClockHostPlan(request), originalCase = request.case_id, originalMode = files.get(root).mode;
    if (kind === "request") request.case_id = "changed-valid-case";
    else files.get(root).mode = 0o040755;
    await expect(observeClockHostControl(plan)).rejects.toThrow(
      kind === "request" ? "host_parent_request_changed" : "private_original_directory");
    request.case_id = originalCase; files.get(root).mode = originalMode;
    await expect(observeClockHostControl(plan)).rejects.toThrow("host_private_plan_already_used");
    expect(calls).toHaveLength(0);
    expect(files.has(root + "/host-request.json")).toBe(false);
  });

  it.each(["owner", "root", "node", "source"])(
    "burns the canonical nonce/root before a failed preparation %s check, even after exact restoration", async kind => {
      await setup();
      const getuid = base.getuid;
      const path = kind === "node" ? "/source-host/node" : kind === "source" ? CLOCK_HOST_SOURCES[0] : root;
      const file = files.get(path), mode = file.mode;
      if (kind === "owner") base.getuid = () => 0;
      else file.mode = kind === "root" ? 0o040755 : kind === "node" ? 0o100644 : 0o100666;
      expect(() => prepareClockHostPlan(request)).toThrow();
      base.getuid = getuid; file.mode = mode;
      const beforeStats = fs.lstatSync.mock.calls.length, beforeReads = fs.readFileSync.mock.calls.length;
      expect(() => prepareClockHostPlan({ ...request })).toThrow("host_nonce_or_root_already_issued");
      expect(fs.lstatSync.mock.calls.length).toBe(beforeStats);
      expect(fs.readFileSync.mock.calls.length).toBe(beforeReads);
      expect(calls).toHaveLength(0);
    });

  it("validates the closed tuple before burning; invalid program JSON cannot mint or consume a plan", async () => {
    await setup();
    expect(() => prepareClockHostPlan({ ...request, program: "/foreign-program" })).toThrow("invalid_case_input");
    expect(fs.openSync).not.toHaveBeenCalled();
    const plan = prepareClockHostPlan(request);
    expect(clockHostPlanEvidence(plan).target).toBe("FIXED_NODE_HOST_FIXTURE_ONLY");
    expect(calls).toHaveLength(0);
  });

  it.each(["case_id", "nonce", "control", "root", "client"])(
    "rejects parent request %s mutation during blocking intent publication", async key => {
      await setup();
      switches.publication = path => {
        if (path.endsWith("/host-intent.json"))
          request[key] = key === "nonce" ? "b".repeat(64) : key === "control" ? "failed-child" : "/changed";
      };
      const f = await run();
      expect(f.error).toBeDefined();
      expect(calls).toHaveLength(0);
    });

  it.each(["source", "node", "root", "request", "intent"])(
    "rejects %s custody replacement during intent publication", async target => {
      await setup();
      switches.publication = path => {
        if (!path.endsWith("/host-intent.json")) return;
        const victim = { source: CLOCK_HOST_SOURCES[0], node: "/source-host/node", root,
          request: root + "/host-request.json", intent: root + "/host-intent.json" }[target];
        files.get(victim).ino++;
      };
      const f = await run();
      expect(f.error).toBeDefined();
      expect(calls).toHaveLength(0);
    });

  it.each(["host-request.json", "host-intent.json", "fixture-output.json", "host-close.json"])(
    "rejects source replacement after blocking %s publication", async name => {
      await setup();
      switches.publication = path => {
        if (path.endsWith("/" + name)) files.get(CLOCK_HOST_SOURCES[0]).ctimeMs++;
      };
      const f = await run();
      if (f.error) expect(calls.length).toBeLessThanOrEqual(1);
      else if (f.result.completion)
        expect(() => inspectClockHostControl(f.result.completion)).toThrow(/changed/);
      else expect(f.result.status).toBe("UNKNOWN");
    });

  it.each(["source", "node", "request", "output", "completion"])(
    "rejects identical-byte/mtime-restored %s originals after completion", async target => {
      await setup();
      const f = await run();
      const path = { source: CLOCK_HOST_SOURCES[0], node: "/source-host/node",
        request: root + "/host-request.json", output: root + "/fixture-output.json",
        completion: root + "/host-close.json" }[target];
      const file = files.get(path), mtime = file.mtimeMs;
      file.bytes = Buffer.from(file.bytes); file.ctimeMs++; file.mtimeMs = mtime;
      expect(() => inspectClockHostControl(f.result.completion)).toThrow(/changed/);
      expect(() => inspectClockHostControl(f.result.completion)).toThrow("one_use_completion");
    });

  it.each(["bytes", "hash", "inode", "hardlink"])("rejects changed output %s", async mutation => {
    await setup();
    const f = await run(), file = files.get(root + "/fixture-output.json");
    if (mutation === "bytes" || mutation === "hash") {
      file.bytes[5] = file.bytes[5] === 120 ? 121 : 120;
    } else if (mutation === "inode") file.ino++;
    else file.nlink = 2;
    expect(() => inspectClockHostControl(f.result.completion)).toThrow();
  });

  it.each([
    ["noExit", true], ["exitCode", 2], ["signal", "SIGTERM"], ["closeSignal", "SIGTERM"],
    ["closeCode", 2], ["noEOF", true], ["connected", true], ["ackFailure", true],
    ["duplicateMessage", true], ["parentLoss", true], ["fixtureSendFailure", true], ["streamError", true],
    ["streamBytes", 1], ["streamBytes", 17000], ["fixtureReverse", true],
  ])("cannot claim success for %s", async (key, value) => {
    await setup(); switches[key] = value;
    const f = await run();
    expect(f.error).toBeUndefined();
    expect(f.result?.status).toBe("UNKNOWN");
    if (f.result?.completion)
      expect(inspectClockHostControl(f.result.completion).host_mechanics_candidate).toBe(false);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it.each(["before-result", "final-exit"].flatMap(frontier =>
    ["request", "node", "source", "output"].flatMap(target =>
      ["deadline", "reparent", "disconnect"].flatMap(fault =>
        ["normal", "failed-child"].map(control => [frontier, target, fault, control])))))(
    "fences %s after blocking %s validation: %s / %s", async (frontier, target, fault, control) => {
      await setup(); request.control = control;
      const path = target === "request" ? root + "/host-request.json" : target === "node" ? "/source-host/node"
        : target === "source" ? CLOCK_HOST_SOURCES[0] : root + "/fixture-output.json";
      let injected = false, outputReads = 0;
      switches.read = readPath => {
        if (context.getStore()?.owner !== "fixture") return;
        if (readPath === root + "/fixture-output.json") outputReads++;
        const final = !!role.resultDelivered;
        if (readPath !== path || !files.has(root + "/fixture-output.json") || injected
          || final !== (frontier === "final-exit") || (target === "output" && outputReads < (final ? 3 : 2))) return;
        injected = true;
        if (fault === "deadline") role.ticks += 5000000000n;
        else if (fault === "reparent") role.ppid = 1;
        else role.connected = false;
      };
      const f = await run();
      expect(injected).toBe(true);
      expect(f.error).toBeUndefined();
      expect(files.has(root + "/fixture-output.json")).toBe(true);
      expect(role.exitCode).toBe(70);
      expect(f.result.status).toBe("UNKNOWN");
      expect(role.send.mock.calls.some(([m]) => m.schema === "airlock.clock-host-complete.v1")).toBe(false);
      if (frontier === "before-result")
        expect(role.send.mock.calls.some(([m]) => m.schema === "airlock.clock-host-result.v1")).toBe(false);
      expect(calls[0].kill).not.toHaveBeenCalled();
    });

  it.each(["exitCode", "signal", "noExit"])("failed-child control cannot excuse %s", async key => {
    await setup(); request.control = "failed-child";
    switches[key] = key === "exitCode" ? 0 : key === "signal" ? "SIGTERM" : true;
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(inspectClockHostControl(f.result.completion).host_mechanics_candidate).toBe(false);
  });

  it.each(["missingExitSignal", "missingCloseSignal"])("rejects absent failed-child signal: %s", async key => {
    await setup(); request.control = "failed-child"; switches[key] = true;
    const f = await run();
    expect(f.error).toBeUndefined();
    expect(f.result).toMatchObject({ status: "UNKNOWN", completion: null, child_close_claimed: false });
    const diagnostic = JSON.parse(files.get(root + "/host-unknown.json").bytes);
    expect(diagnostic.reason).toBe("public_exit_or_close_signal_missing_NOT_qualified");
  });

  it.each(["pendingSend", "pendingStream", "neverClose"])(
    "preserves UNKNOWN without claiming closure or signalling when %s remains", async key => {
      await setup(); switches[key] = true;
      const f = await run();
      expect(f.result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(45000);
      const v = await f.settle();
      expect(v).toMatchObject({ status: "UNKNOWN", completion: null, observation_valid: false });
      const diagnostic = JSON.parse(files.get(root + "/host-unknown.json").bytes);
      expect(diagnostic).toMatchObject({ child_close_claimed: false, cancellation_claimed: false });
      expect(calls[0].kill).not.toHaveBeenCalled();
      // Even if the original stream settles later, the timed-out capability
      // cannot reappear and the original deadline cannot be renewed.
      switches.pendingStream = false;
      calls[0].stdout.emit("end"); calls[0].stderr.emit("end");
      calls[0].stdout.close(); calls[0].stderr.close();
      expect(await f.settle()).toBe(v);
    });

  it("requires the no-work ACK before the fixture publishes anything", async () => {
    await setup(); switches.dropAck = true;
    const f = await run();
    expect(files.has(root + "/fixture-output.json")).toBe(false);
    expect(f.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    const v = await f.settle();
    expect(v.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
  });

  it.each([
    ["request", "deadline"], ["node", "deadline"], ["source", "deadline"],
    ["request", "reparent"], ["node", "reparent"], ["source", "reparent"],
    ["request", "disconnect"], ["node", "disconnect"], ["source", "disconnect"],
  ])("refuses publication after %s validation blocks across fixture %s", async (target, fault) => {
    await setup();
    const path = target === "request" ? root + "/host-request.json"
      : target === "node" ? "/source-host/node" : CLOCK_HOST_SOURCES[0];
    let injected = false;
    switches.read = readPath => {
      if (readPath !== path || context.getStore()?.owner !== "fixture" || !role.ackDelivered || injected) return;
      injected = true;
      if (fault === "deadline") role.ticks += 5000000000n;
      else if (fault === "reparent") role.ppid = 1;
      else role.connected = false;
    };
    const f = await run();
    expect(injected).toBe(true);
    expect(f.error).toBeUndefined();
    expect(f.result.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
    expect(publications.filter(p => p.owner === "fixture")).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it.each(["ARM", "WORK", "OBSERVE_ONLY"])("rejects an ACK changed to %s", async type => {
    await setup(); switches.ack = message => ({ ...message, type });
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
  });

  it("rejects duplicate parent ACK before output and cannot turn it into restart authority", async () => {
    await setup(); switches.duplicateAck = true;
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
    await expect(observeClockHostControl(f.plan)).rejects.toThrow("already_used");
  });

  it.each(["target", "nonce", "request", "source"])("refuses %s substitution at the ACK boundary", async key => {
    await setup();
    switches.ack = message => {
      const m = structuredClone(message);
      if (key === "target") m.target = "O";
      else if (key === "nonce") m.binding.nonce = "f".repeat(64);
      else if (key === "source") m.binding.source_sha256 = "f".repeat(64);
      else m.request.sha256 = "f".repeat(64);
      return m;
    };
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
  });

  it("retains failed RESULT-send as diagnostic, never as successful closure or retry authority", async () => {
    await setup(); switches.fixtureSendPending = true;
    const f = await run();
    expect(files.has(root + "/fixture-output.json")).toBe(true);
    expect(f.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    const v = await f.settle();
    expect(v.status).toBe("UNKNOWN");
    expect(inspectClockHostControl(v.completion).host_mechanics_candidate).toBe(false);
    await expect(observeClockHostControl(f.plan)).rejects.toThrow("already_used");
    expect(calls).toHaveLength(1);
  });

  it("never renews the original start after slow request/intent publication", async () => {
    await setup();
    switches.publication = path => { if (path.endsWith("/host-intent.json")) base.ticks += 45000000000n; };
    const f = await run();
    expect(f.error?.message).toBe("host_original_deadline_expired");
    expect(calls).toHaveLength(0);
  });

  it("rejects externally late close even when the child claimed an early publication", async () => {
    await setup(); switches.beforeClose = () => { base.ticks += 45000000000n; };
    const f = await run();
    expect(f.result.status).toBe("UNKNOWN");
    expect(inspectClockHostControl(f.result.completion).host_mechanics_candidate).toBe(false);
  });

  it("retains a child issued by a slow spawn instead of throwing away its ownership", async () => {
    await setup(); switches.slowSpawn = true;
    const f = await run();
    expect(f.error).toBeUndefined();
    if (!f.result) await vi.advanceTimersByTimeAsync(45000);
    const v = await f.settle();
    expect(v.status).toBe("UNKNOWN");
    expect(calls).toHaveLength(1);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it("classifies a synchronous failed spawn without claiming any child closure", async () => {
    await setup(); switches.spawnThrow = true;
    const f = await run();
    expect(f.error).toBeUndefined();
    expect(f.result).toMatchObject({ status: "UNKNOWN", completion: null, child_close_claimed: false });
    expect(files.has(root + "/host-intent.json")).toBe(true);
    await expect(observeClockHostControl(f.plan)).rejects.toThrow("already_used");
  });

  it("refuses ACK after observer-parent loss during the blocking spawn seam", async () => {
    await setup(); base.connected = true; switches.hostLossOnSpawn = true;
    const f = await run();
    if (!f.result) await vi.advanceTimersByTimeAsync(5000);
    const v = f.result ?? await f.settle();
    expect(v.status).toBe("UNKNOWN");
    expect(files.has(root + "/fixture-output.json")).toBe(false);
    expect(calls[0].kill).not.toHaveBeenCalled();
  });

  it.each(["partial", "duplicate", "malformed", "extra", "O"])(
    "rejects %s output independently of a producer-reported success", async mutation => {
      await setup();
      switches.message = message => {
        if (message.schema !== "airlock.clock-host-result.v1") return message;
        const path = root + "/fixture-output.json", file = files.get(path);
        let bytes;
        if (mutation === "partial") bytes = file.bytes.subarray(0, file.bytes.length - 4);
        else if (mutation === "duplicate") bytes = Buffer.from('{"schema":"x","schema":"y"}');
        else if (mutation === "malformed") bytes = Buffer.from("{not-json}\n");
        else {
          const value = JSON.parse(file.bytes);
          if (mutation === "extra") value.ready = true;
          else value.target = "O";
          bytes = Buffer.from(JSON.stringify(value) + "\n");
        }
        file.bytes = bytes; file.size = bytes.length;
        // The attacker refreshes the reported hash. It still cannot replace
        // the private observer's target/source/request relationships.
        return { ...message, file: observationRead(path, { uid: 501 }).handle };
      };
      const f = await run();
      if (f.result.status === "UNKNOWN") {
        expect(inspectClockHostControl(f.result.completion).host_mechanics_candidate).toBe(false);
      } else expect(() => inspectClockHostControl(f.result.completion)).toThrow();
    });
});
