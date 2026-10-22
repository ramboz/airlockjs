import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

const load = () => import("./meta-preexec-bootstrap.mjs");
const hash = value => createHash("sha256").update(value).digest("hex");
function expectQualifiedRefusal(value) {
  expect(value.control).toBe("refuse-exec");
  expect(value.witnessed).toBe(false);
  expect(value.errors).toEqual([]);
  expect(value.registrations.some(row => row.path.endsWith("/helper-refusal-observed.json"))).toBe(true);
  expect(value.child_exit).toEqual({ code: 2, signal: null });
  expect(value.connected_peer).toBe(true);
  expect(value.target_executed).toBe(false);
  expect(value.native_qualified).toBe(false);
}
function fixture() {
  const temp = "/private/synthetic-case/tmp", path = join(temp, "synthetic-user-data");
  const argv = ["--user-data-dir=" + path, "--remote-debugging-pipe", "--no-startup-window"];
  const make = (pid, ppid, pgid) => ({ pid, ppid, pgid, uid: process.getuid(),
    started: "Wed Oct 21 17:00:00 2026", state: "S", command_sha256: hash("fixed-" + pid) });
  const roles = { P: make(810001, 1, 810001), E: make(810002, 810001, 810002),
    L: make(810003, 810002, 810003), H: make(810004, 810003, 810003) };
  const dir = { path, dev: 1, ino: 2, birthtime_ms: 1000, uid: process.getuid(), mode: 448, synthetic: true };
  return { temp, argv, dir, roles, argv_sha256: hash(JSON.stringify(argv)) };
}
function socketInventories() {
  const expected = fixture().roles;
  const roles = Object.values(expected).map((role, n) => ({
    pid: role.pid, ppid: role.ppid, pgid: role.pgid, uid: role.uid,
    birth_seconds: 1792620000, birth_microseconds: n + 1,
  }));
  const socket = (fd, identity) => ({ fd, type: 2, family: 1, identity });
  const other = { fd: 0, type: 1, family: null, identity: null };
  const value = (role, descriptors) => ({
    schema: "airlock.owned-macos-socket-inventory.v1", role,
    pid: expected[role === "launcher" ? "L" : "H"].pid,
    caller_pid: expected.P.pid, complete: true,
    roles_before: structuredClone(roles.slice(0, role === "launcher" ? 3 : 4)),
    roles_after: structuredClone(roles.slice(0, role === "launcher" ? 3 : 4)),
    inventory_before: descriptors.map(({ fd, type }) => ({ fd, type })),
    inventory_after: descriptors.map(({ fd, type }) => ({ fd, type })),
    descriptor_count: descriptors.length, descriptors, native_authority: false,
  });
  return { expected, launcher: value("launcher", [other, socket(3, "0x0000000000000123"),
    socket(4, "0x0000000000000456")]),
  helper: value("helper", [other, socket(3, "0x0000000000000789")]) };
}

describe("owned macOS socket inventory", () => {
  it("compares actual socket identities while preserving complete non-socket rows", async () => {
    const { assessSyntheticSocketIsolation } = await load();
    expect(assessSyntheticSocketIsolation(socketInventories())).toMatchObject({
      allowed: true, reason: "owned_debug_sockets_absent", native_authority: false });
  });
  it("allows no helper sockets only when a complete nonempty inventory proves that", async () => {
    const { assessSyntheticSocketIsolation } = await load(), value = socketInventories();
    value.helper.descriptors.pop(); value.helper.descriptor_count = 1;
    value.helper.inventory_before.pop(); value.helper.inventory_after.pop();
    expect(assessSyntheticSocketIsolation(value).allowed).toBe(true);
    value.helper.descriptors = []; value.helper.descriptor_count = 0;
    expect(() => assessSyntheticSocketIsolation(value)).toThrow("synthetic_socket_inventory");
  });
  it("rejects an inherited socket under a different helper descriptor number", async () => {
    const { assessSyntheticSocketIsolation } = await load(), value = socketInventories();
    value.helper.descriptors[1] = { ...value.launcher.descriptors[1], fd: 9 };
    value.helper.inventory_before[1].fd = 9; value.helper.inventory_after[1].fd = 9;
    expect(assessSyntheticSocketIsolation(value)).toMatchObject({
      allowed: false, reason: "inherited_debug_handle", native_authority: false });
  });
  it.each(["zero", "duplicate-debug", "unknown-type", "incomplete", "count", "duplicate-fd",
    "changed-birth", "changed-parent", "caller", "uid", "non-socket-identity", "wrong-family",
    "inventory-omission", "inventory-change"])(
    "refuses %s instead of accepting incomplete or foreign observations", async fault => {
      const { assessSyntheticSocketIsolation } = await load(), value = socketInventories();
      if (fault === "zero") value.launcher.descriptors[1].identity = "0x0000000000000000";
      if (fault === "duplicate-debug") value.launcher.descriptors[2].identity = value.launcher.descriptors[1].identity;
      if (fault === "unknown-type") value.helper.descriptors[0].type = 8;
      if (fault === "incomplete") value.helper.complete = false;
      if (fault === "count") value.helper.descriptor_count++;
      if (fault === "duplicate-fd") value.helper.descriptors[1].fd = 0;
      if (fault === "changed-birth") value.helper.roles_after[3].birth_microseconds++;
      if (fault === "changed-parent") value.helper.roles_before[3].ppid++;
      if (fault === "caller") value.helper.caller_pid++;
      if (fault === "uid") value.helper.roles_before[3].uid++;
      if (fault === "non-socket-identity") value.helper.descriptors[0] = { ...value.helper.descriptors[0], identity: "0x123" };
      if (fault === "wrong-family") value.launcher.descriptors[1].family = 2;
      if (fault === "inventory-omission") value.helper.inventory_before.pop();
      if (fault === "inventory-change") value.helper.inventory_after[0].type = 2;
      expect(() => assessSyntheticSocketIsolation(value)).toThrow("synthetic_socket_inventory");
    });
});

describe("observed helper refusal, not a generic child failure", () => {
  function refusal() {
    return {
      ticket_sha256: "a".repeat(64), argv_sha256: "b".repeat(64), correlation_sha256: "c".repeat(64),
      helper_pid: 810004, launcher_pid: 810003, refused_at_ms: 100, child_exit_at_ms: 140, expires_at_ms: 200,
      child_exit: { code: 2, signal: null },
      launcher_status: { schema: "airlock.synthetic-launcher-helper-exit.v1",
        launcher_pid: 810003, helper_exit_code: 2, native_authority: false },
      receipt: { schema: "airlock.synthetic-helper-exec-refusal.v1", ticket_sha256: "a".repeat(64),
        argv_sha256: "b".repeat(64), correlation_sha256: "c".repeat(64), helper_pid: 810004,
        launcher_pid: 810003, observed_at_ms: 120, allowed: false, native_authority: false },
    };
  }
  it("requires the helper's case-bound refusal observation before its actual exit", async () => {
    const { assessSyntheticHelperRefusal } = await load();
    expect(assessSyntheticHelperRefusal(refusal())).toMatchObject({
      allowed: true, reason: "helper_refusal_observed", native_authority: false });
  });
  it.each(["errors", "missing-registration", "signal"])(
    "the qualification consumer rejects connected-but-failed %s", fault => {
      const result = { control: "refuse-exec", witnessed: false, errors: [], connected_peer: true,
        target_executed: false, native_qualified: false, child_exit: { code: 2, signal: null },
        registrations: [{ path: "/private/fixture/helper-refusal-observed.json" }] };
      if (fault === "errors") result.errors.push("synthetic_refusal_not_observed");
      if (fault === "missing-registration") result.registrations = [];
      if (fault === "signal") result.child_exit = { code: null, signal: "SIGKILL" };
      expect(() => expectQualifiedRefusal(result)).toThrow();
    });
  it.each(["generic-exit", "signal", "helper-returned-zero", "wrong-status-launcher",
    "wrong-helper", "wrong-launcher", "wrong-ticket", "wrong-argv",
    "wrong-challenge", "before-refusal", "after-exit", "expired", "allowed"])(
    "does not promote %s into the requested refusal proof", async fault => {
      const { assessSyntheticHelperRefusal } = await load(), value = refusal();
      if (fault === "generic-exit") value.child_exit.code = 1;
      if (fault === "signal") value.child_exit = { code: null, signal: "SIGKILL" };
      if (fault === "helper-returned-zero") value.launcher_status.helper_exit_code = 0;
      if (fault === "wrong-status-launcher") value.launcher_status.launcher_pid++;
      if (fault === "wrong-helper") value.receipt.helper_pid++;
      if (fault === "wrong-launcher") value.receipt.launcher_pid++;
      if (fault === "wrong-ticket") value.receipt.ticket_sha256 = "d".repeat(64);
      if (fault === "wrong-argv") value.receipt.argv_sha256 = "d".repeat(64);
      if (fault === "wrong-challenge") value.receipt.correlation_sha256 = "d".repeat(64);
      if (fault === "before-refusal") value.receipt.observed_at_ms = 99;
      if (fault === "after-exit") value.receipt.observed_at_ms = 141;
      if (fault === "expired") value.expires_at_ms = 120;
      if (fault === "allowed") value.receipt.allowed = true;
      expect(assessSyntheticHelperRefusal(value).allowed).toBe(false);
    });
});

describe("closed synthetic P/E/L/H bootstrap", () => {
  it("preserves the issued argument vector and its single in-root synthetic fixture argument", async () => {
    const { parseSyntheticBootstrapArgv } = await load(), f = fixture();
    expect(parseSyntheticBootstrapArgv({ argv: f.argv, temporary_root: f.temp,
      issued_argv_sha256: f.argv_sha256 })).toEqual({ argv: f.argv, fixture_path: f.dir.path,
      argv_sha256: f.argv_sha256, synthetic: true, native_authority: false });
  });
  it.each(["duplicate", "outside", "relative", "changed", "url", "accessor"])(
    "refuses %s arguments without rewriting them", async fault => {
      const { parseSyntheticBootstrapArgv } = await load(), f = fixture();
      if (fault === "duplicate") f.argv.push(f.argv[0]);
      if (fault === "outside") f.argv[0] = "--user-data-dir=/private/other/synthetic-user-data";
      if (fault === "relative") f.argv[0] = "--user-data-dir=relative";
      if (fault === "changed") f.argv.reverse();
      if (fault === "url") f.argv.push("forbidden-destination");
      const input = { argv: f.argv, temporary_root: f.temp, issued_argv_sha256: f.argv_sha256 };
      let calls = 0;
      if (fault === "accessor") Object.defineProperty(input, "argv", { get() { calls++; return []; } });
      expect(() => parseSyntheticBootstrapArgv(input)).toThrow();
      expect(calls).toBe(0);
    });
  it("binds H as L's child/member, not as the launcher or a separate group leader", async () => {
    const { assessSyntheticBootstrapRoles } = await load(), f = fixture();
    expect(assessSyntheticBootstrapRoles({ expected: f.roles, before: f.roles, after: f.roles,
      fixture: f.dir, expected_fixture: f.dir })).toMatchObject({ allowed: true, native_authority: false });
  });
  it.each(["P", "E", "L", "H"].flatMap(role => ["U", "Us"].map(state => [role, state])))(
    "retains %s identity during macOS %s wait without proving progress", async (role, state) => {
      const { assessSyntheticBootstrapRoles } = await load(), f = fixture();
      const after = structuredClone(f.roles);
      after[role].state = state;
      expect(assessSyntheticBootstrapRoles({ expected: f.roles, before: f.roles, after,
        fixture: f.dir, expected_fixture: f.dir })).toEqual({
        allowed: true, reason: "owned_roles", native_authority: false });
    });
  it.each(["T", "Ts", "Z", "Zs", "?", "", null, 7])(
    "refuses non-live or unknown run state %s", async state => {
      const { assessSyntheticBootstrapRoles } = await load(), f = fixture();
      const after = structuredClone(f.roles);
      after.P.state = state;
      expect(assessSyntheticBootstrapRoles({ expected: f.roles, before: f.roles, after,
        fixture: f.dir, expected_fixture: f.dir }).allowed).toBe(false);
    });
  it.each(["pid", "ppid", "pgid", "uid", "started", "command_sha256"])(
    "uninterruptible wait cannot conceal a changed %s", async key => {
      const { assessSyntheticBootstrapRoles } = await load(), f = fixture();
      const after = structuredClone(f.roles);
      after.H.state = "Us";
      after.H[key] = typeof after.H[key] === "number" ? after.H[key] + 1 : "changed";
      expect(assessSyntheticBootstrapRoles({ expected: f.roles, before: f.roles, after,
        fixture: f.dir, expected_fixture: f.dir }).allowed).toBe(false);
    });
  it.each(["helper-parent", "helper-group", "helper-pid", "launcher-parent", "launcher-group", "birth",
    "uid", "image", "engine-dead", "fixture-inode", "fixture-mode", "not-synthetic"])(
    "refuses %s despite an enrollment/claim", async fault => {
      const { assessSyntheticBootstrapRoles } = await load(), f = fixture();
      const after = structuredClone(f.roles), dir = { ...f.dir };
      if (fault === "helper-parent") after.H.ppid = f.roles.E.pid;
      if (fault === "helper-group") after.H.pgid = after.H.pid;
      if (fault === "helper-pid") after.H.pid = after.L.pid;
      if (fault === "launcher-parent") after.L.ppid = 1;
      if (fault === "launcher-group") after.L.pgid = after.E.pgid;
      if (fault === "birth") after.H.started = "changed";
      if (fault === "uid") after.H.uid++;
      if (fault === "image") after.H.command_sha256 = "f".repeat(64);
      if (fault === "engine-dead") after.E.state = "Z";
      if (fault === "fixture-inode") dir.ino++;
      if (fault === "fixture-mode") dir.mode = 493;
      if (fault === "not-synthetic") dir.synthetic = false;
      expect(assessSyntheticBootstrapRoles({ expected: f.roles, before: f.roles, after,
        fixture: dir, expected_fixture: f.dir }).allowed).toBe(false);
    });
  it.each(["expired", "future", "refused", "wrong-stage", "wrong-ticket", "changed-role", "changed-fixture"])(
    "real enrollment/exec-ready gate refuses %s", async fault => {
      const { assessSyntheticBootstrapPermit } = await load(), f = fixture();
      const permit = { schema: "airlock.synthetic-bootstrap-permit.v1", stage: "exec-ready",
        ticket_sha256: "a".repeat(64), roles: f.roles, fixture: f.dir, argv_sha256: f.argv_sha256,
        issued_at_ms: 100, expires_at_ms: 200, allowed: true, native_authority: false };
      if (fault === "expired") permit.expires_at_ms = 150;
      if (fault === "future") permit.issued_at_ms = 151;
      if (fault === "refused") permit.allowed = false;
      if (fault === "wrong-stage") permit.stage = "tcp-only";
      if (fault === "wrong-ticket") permit.ticket_sha256 = "b".repeat(64);
      if (fault === "changed-role") permit.roles = { ...f.roles, H: { ...f.roles.H, pgid: f.roles.H.pid } };
      if (fault === "changed-fixture") permit.fixture = { ...f.dir, ino: 9 };
      expect(assessSyntheticBootstrapPermit({ permit, stage: "exec-ready", ticket_sha256: "a".repeat(64),
        roles: f.roles, fixture: f.dir, argv_sha256: f.argv_sha256, observed_at_ms: 150 }).allowed).toBe(false);
    });
  it("TCP enrollment is admissible only for TCP, never exec-ready authority", async () => {
    const { assessSyntheticBootstrapPermit } = await load(), f = fixture();
    const permit = { schema: "airlock.synthetic-bootstrap-permit.v1", stage: "tcp-only",
      ticket_sha256: "a".repeat(64), roles: f.roles, fixture: f.dir, argv_sha256: f.argv_sha256,
      issued_at_ms: 100, expires_at_ms: 200, allowed: true, native_authority: false };
    const context = { permit, stage: "tcp-only", ticket_sha256: "a".repeat(64), roles: f.roles,
      fixture: f.dir, argv_sha256: f.argv_sha256, observed_at_ms: 150 };
    expect(assessSyntheticBootstrapPermit(context).allowed).toBe(true);
    expect(assessSyntheticBootstrapPermit({ ...context, stage: "exec-ready" }).allowed).toBe(false);
  });
  it.each(["owned", "wrong-owner", "forged-claim", "wrong-tuple", "non-loopback"])(
    "kernel-attributed H connection: %s", async fault => {
      const { assessSyntheticBootstrapPeer } = await load(), f = fixture();
      const tuple = { server_address: "127.0.0.1", server_port: 12345, client_address: "127.0.0.1", client_port: 12346 };
      const hello = { helper_pid: f.roles.H.pid, launcher_pid: f.roles.L.pid, ticket_sha256: "a".repeat(64) };
      let kernel = "p" + f.roles.H.pid + "\nn127.0.0.1:12346->127.0.0.1:12345\n";
      if (fault === "wrong-owner") kernel = kernel.replace("p" + f.roles.H.pid, "p" + f.roles.E.pid);
      if (fault === "forged-claim") hello.helper_pid = f.roles.L.pid;
      if (fault === "wrong-tuple") kernel = kernel.replace("12346", "23456");
      if (fault === "non-loopback") tuple.client_address = "not-loopback";
      expect(assessSyntheticBootstrapPeer({ roles: f.roles, tuple, hello, kernel,
        ticket_sha256: "a".repeat(64) }).allowed).toBe(fault === "owned");
    });
  it("parses only scoped, nonzero OS handle identities and rejects a foreign PID", async () => {
    const { parseSyntheticScopedDescriptors, assessSyntheticDebugIsolation } = await load();
    const text = "p810003\nf3\nFunused\nF0x123\ntunix\n";
    expect(() => parseSyntheticScopedDescriptors(text, 810004)).toThrow("synthetic_descriptor_scope");
    const parsed = parseSyntheticScopedDescriptors("p810003\nf3\nF0x123\ntunix\nf4\nF0x456\ntunix\n", 810003);
    expect(parsed.map(r => r.identity)).toEqual(["0x123", "0x456"]);
    expect(assessSyntheticDebugIsolation({ launcher: parsed, helper: [{ fd: 3, type: "unix", identity: "0x0" }] }).allowed).toBe(false);
  });
  it("does not confuse reused H FD numbers with the specific inherited debugger handles", async () => {
    const { assessSyntheticDebugIsolation } = await load();
    const launcher = [{ fd: 3, type: "unix", identity: "0x123" }, { fd: 4, type: "unix", identity: "0x456" }];
    expect(assessSyntheticDebugIsolation({ launcher, helper: [
      { fd: 3, type: "unix", identity: "0x789" }, { fd: 4, type: "PIPE", identity: "0xabc" },
    ] }).allowed).toBe(true);
    expect(assessSyntheticDebugIsolation({ launcher, helper: [
      { fd: 9, type: "unix", identity: "0x123" },
    ] }).allowed).toBe(false);
    expect(assessSyntheticDebugIsolation({ launcher: launcher.map(x => ({ ...x, identity: null })), helper: [] }).allowed).toBe(false);
  });
  it("real helper admission refuses missing enrollment finitely, without connecting", async () => {
    // Boundary mocks only; no injected reader/clock/program in the helper API.
    vi.resetModules();
    const absent = vi.fn(() => { throw Object.assign(Error("missing"), { code: "ENOENT" }); });
    const connect = vi.fn(() => { throw Error("must_not_connect"); });
    vi.doMock("./native-stock-meta.mjs", () => ({ readMetaPrivate: absent, writeMetaPrivate: vi.fn() }));
    vi.doMock("node:net", () => ({ connect, createServer: vi.fn() }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
    try {
      const { awaitSyntheticEnrollment } = await load(), f = fixture();
      const finished = awaitSyntheticEnrollment({ root: "/private/synthetic-case", stage: "tcp-only",
        ticket_sha256: "a".repeat(64), fixture: f.dir, argv_sha256: f.argv_sha256,
        expires_at_ms: Date.now() + 50 }).then(() => "unexpected", error => error.message);
      await vi.runAllTimersAsync();
      expect(await finished).toBe("synthetic_enrollment_deadline");
      expect(absent).toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers(); vi.doUnmock("./native-stock-meta.mjs"); vi.doUnmock("node:net"); vi.resetModules();
    }
  });
  it.each(["missing-enrollment", "expired-enrollment", "fixture-mutation", "exec-refusal", "disconnect", "bad-owner-ack"])(
    "runs the real fixed-role control path with doubled boundaries: %s", async fault => {
      vi.resetModules();
      const f = fixture(), root = "/private/synthetic-case";
      const directory = path => ({ path, dev: 1, ino: 2, birthtime_ms: 1000, uid: process.getuid(), mode: 448, synthetic: true });
      const ticket = { schema: "airlock.synthetic-pelh-issue.v1", native_authority: false,
        node: process.execPath, entry: fileURLToPath(new URL("./meta-preexec-bootstrap.mjs", import.meta.url)),
        expires_at_ms: Date.now() + 80, temp: directory(f.temp), fixture_path: f.dir.path, argv: f.argv,
        argv_sha256: f.argv_sha256, parent: { pid: process.ppid }, port: 12345 };
      const bytes = Buffer.from(JSON.stringify(ticket)), ticketSha = hash(bytes);
      f.roles.L.pid = process.ppid; f.roles.L.pgid = process.ppid;
      f.roles.H.pid = process.pid; f.roles.H.ppid = process.ppid; f.roles.H.pgid = process.ppid;
      const permit = { schema: "airlock.synthetic-bootstrap-permit.v1", native_authority: false,
        stage: "tcp-only", ticket_sha256: ticketSha, roles: f.roles, fixture: f.dir,
        argv_sha256: f.argv_sha256, allowed: true, issued_at_ms: Date.now(), expires_at_ms: ticket.expires_at_ms };
      if (fault === "expired-enrollment") permit.expires_at_ms = Date.now() - 1;
      const absent = () => { throw Object.assign(Error("missing"), { code: "ENOENT" }); };
      const metadata = vi.fn(path => {
        if (path.endsWith("/issued.json")) return bytes;
        if (["missing-enrollment", "bad-owner-ack"].includes(fault)) return absent();
        if (path.endsWith("/roles-enrolled.json")) return Buffer.from(JSON.stringify({
          roles: f.roles, ticket_sha256: ticketSha, fixture: f.dir }));
        if (path.endsWith("/tcp-only.json")) return Buffer.from(JSON.stringify(permit));
        throw Error("unexpected_private_read");
      });
      const socket = new EventEmitter(); socket.destroy = vi.fn();
      const frames = [];
      socket.write = vi.fn(text => {
        frames.push(JSON.parse(text));
        if (fault === "disconnect") { queueMicrotask(() => socket.emit("close")); return; }
        const next = frames.length === 1 ? { stage: "challenge", correlation: "b".repeat(64) }
          : { stage: "exec-ready", allowed: false };
        queueMicrotask(() => socket.emit("data", Buffer.from(JSON.stringify(next) + "\n")));
      });
      const connect = vi.fn(() => { queueMicrotask(() => socket.emit("connect")); return socket; });
      const mkdirSync = vi.fn(), spawn = vi.fn(), persist = vi.fn();
      vi.doMock("node:fs", async original => ({ ...await original(), mkdirSync,
        lstatSync: vi.fn(path => ({ dev: 1, ino: path === f.dir.path && fault === "fixture-mutation" ? 3 : 2,
          birthtimeMs: 1000, uid: process.getuid(), mode: 448,
          isDirectory: () => true, isSymbolicLink: () => false })) }));
      vi.doMock("node:os", () => ({ tmpdir: () => f.temp }));
      vi.doMock("node:child_process", async original => ({ ...await original(), spawn }));
      vi.doMock("node:net", async original => ({ ...await original(), connect }));
      vi.doMock("./native-stock-meta.mjs", () => ({ readMetaPrivate: metadata, writeMetaPrivate: persist }));
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
      const originalSend = process.send;
      let once;
      try {
        const api = await load();
        let operation;
        if (fault === "bad-owner-ack") {
          process.send = vi.fn();
          once = vi.spyOn(process, "once").mockImplementation(function (event, listener) {
            if (event !== "message") throw Error("unexpected_process_event");
            queueMicrotask(() => listener({ type: "not-owner-ack" })); return this;
          });
          operation = api.runSyntheticBootstrapEngine(root);
        } else operation = api.runSyntheticBootstrapHelper(root, f.argv);
        const finished = operation.then(() => "unexpected-success", error => error.message);
        await vi.runAllTimersAsync();
        const reasons = { "bad-owner-ack": "synthetic_owner_ack", "exec-refusal": "synthetic_exec_refused",
          "missing-enrollment": "synthetic_enrollment_deadline", "expired-enrollment": "synthetic_permit_refused",
          "fixture-mutation": "synthetic_enrollment_binding", disconnect: "synthetic_socket_disconnected" };
        expect(await finished).toBe(reasons[fault]);
        expect(mkdirSync).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled();
        expect(connect).toHaveBeenCalledTimes(["exec-refusal", "disconnect"].includes(fault) ? 1 : 0);
        if (["exec-refusal", "disconnect"].includes(fault)) expect(socket.destroy).toHaveBeenCalledOnce();
        if (fault === "exec-refusal") {
          expect(frames[1]).toEqual({ correlation_sha256: hash("b".repeat(64)) });
          expect(persist).toHaveBeenCalledWith(join(root, "helper-exec-refused.json"), expect.objectContaining({
            schema: "airlock.synthetic-helper-exec-refusal.v1", helper_pid: process.pid,
            launcher_pid: process.ppid, allowed: false, ticket_sha256: ticketSha,
            correlation_sha256: hash("b".repeat(64)), native_authority: false,
          }));
        }
      } finally {
        once?.mockRestore(); process.send = originalSend; vi.useRealTimers();
        for (const name of ["node:fs", "node:os", "node:child_process", "node:net", "./native-stock-meta.mjs"]) vi.doUnmock(name);
        vi.resetModules();
      }
    });
});

describe("fixed OS command diagnostics through the real pre-enrollment caller (pure boundaries)", () => {
  it.each(["exit-stderr", "closed-env", "parallel-ps-error", "waiting-parent", "missing-observer", "bad-cohort",
    "changed-headers", "source-mismatch", "binary-changed", "timeout", "spawn", "spawn-permission", "maxbuffer", "oversized-capture", "signal", "unavailable-output",
    "required-no-match", "empty-children-once", "cleanup-observation-error", "cleanup-signal-error"])(
    "retains causal command receipts and fail-closed disposal: %s", async fault => {
      // All OS/child/socket/signal boundaries are doubled. Real private metadata
      // IO and the actual producer/observation/cleanup control path are used.
      const root = mkdtempSync(join(realpathSync(tmpdir()), "pelh-diagnostic-pure-"));
      const outputDir = join(root, "case"), entry = fileURLToPath(new URL("./meta-preexec-bootstrap.mjs", import.meta.url));
      const shell = fileURLToPath(new URL("./meta-preexec-bootstrap-launcher", import.meta.url));
      const observerBytes = "pure-unit-observer-not-executed", observerSha = hash(observerBytes);
      const observerPath = fileURLToPath(new URL("out/owned-socket-observer/" + observerSha + "/observer", import.meta.url));
      const observerFixture = join(outputDir, "owned-socket-observer");
      const ids = { E: 720001, L: 720002, H: 720003 }, child = new EventEmitter();
      let cleanup = false, firstEmpty = fault === "empty-children-once", serverClosed = false, binaryReads = 0;
      const argv = ["--user-data-dir=" + join(outputDir, "tmp/synthetic-user-data"), "--remote-debugging-pipe", "--no-startup-window"];
      const image = { E: [process.execPath, entry, "--fixed-e"].join(" "),
        L: ["/bin/sh", shell, ...argv].join(" "), H: [process.execPath, entry, "--fixed-h", ...argv].join(" ") };
      const ps = (pid, ppid, pgid, command, state = "S") =>
        `${pid} ${ppid} ${pgid} ${process.getuid()} Wed Oct 21 18:10:00 2026 ${state} ${command}\n`;
      Object.assign(child, { pid: ids.E, connected: true, stdout: new PassThrough(), stderr: new PassThrough(),
        disconnect: vi.fn(() => { child.connected = false; }), unref: vi.fn() });
      child.send = message => {
        if (message.type === "owner-ack") {
          mkdirSync(join(outputDir, "tmp/synthetic-user-data"), { mode: 0o700 });
          queueMicrotask(() => child.emit("message", { type: "fixture-ready" }));
        }
        if (message.type === "launcher-ack")
          queueMicrotask(() => child.emit("message", { type: "launcher-issued", pid: ids.L }));
      };
      const spawn = vi.fn(() => child), execFile = vi.fn(), queries = [], issuedAtExecute = [];
      const connect = vi.fn(() => { throw Error("pure_unit_must_not_connect"); });
      execFile[promisify.custom] = async (program, args, options) => {
        queries.push({ program, args, options });
        const issuedNames = readdirSync(outputDir).filter(n => /^os-command-\d+-issued\.json$/.test(n)).sort();
        issuedAtExecute.push(issuedNames.length ? JSON.parse(readFileSync(join(outputDir, issuedNames.at(-1)))) : null);
        const output = text => options.encoding === "buffer" ? Buffer.from(text) : text;
        const empty = () => { throw Object.assign(Error("no matches"), { code: 1, stdout: output(""), stderr: output("") }); };
        if (program === "/bin/ps") {
          if (fault !== "missing-observer" && !existsSync(observerFixture))
            writeFileSync(observerFixture, observerBytes, { mode: 0o700 });
          const pid = Number(args[1]);
          if (fault === "parallel-ps-error" && issuedAtExecute.at(-1)?.phase === "pre-enrollment") {
            if (pid === process.pid) {
              cleanup = true; queueMicrotask(() => child.emit("exit", 2, null));
              throw Object.assign(Error("unit process query failure"), {
                code: 2, signal: null, killed: false, stdout: output(""), stderr: output("unit OS diagnostic\n") });
            }
            await new Promise(done => setTimeout(done, 500));
          } else
          if (cleanup && pid !== process.pid) {
            if (fault === "cleanup-observation-error" && pid === ids.H)
              throw Object.assign(Error("query EIO"), { code: "EIO", syscall: "spawn /bin/ps" });
            if (!(fault === "cleanup-signal-error" && pid === ids.H)) return empty();
          }
          const text = pid === process.pid ? ps(pid, process.ppid, pid, "pure-unit-P",
            fault === "waiting-parent" && issuedAtExecute.at(-1)?.phase === "pre-enrollment" ? "Us" : "S")
            : pid === ids.E ? ps(pid, process.pid, pid, image.E)
            : pid === ids.L ? ps(pid, ids.E, pid, image.L) : ps(pid, ids.L, ids.L, image.H);
          return { stdout: output(text), stderr: output("") };
        }
        if (program === "/usr/bin/pgrep") {
          if (args[0] === "-g") return empty();
          if (firstEmpty && Number(args[1]) === ids.E) { firstEmpty = false; return empty(); }
          return { stdout: output(String(Number(args[1]) === ids.E ? ids.L : ids.H) + "\n"), stderr: output("") };
        }
        if (program !== observerPath) throw Error("unexpected_pure_boundary");
        cleanup = true;
        if (!fault.startsWith("cleanup-")) queueMicrotask(() => child.emit("exit", 2, null));
        const error = Object.assign(Error("unit utility failure"), {
          code: 1, signal: null, killed: false, stdout: output("partial OS bytes\n"), stderr: output("unit OS diagnostic\n"),
        });
        if (fault === "timeout") {
          vi.advanceTimersByTime(options.timeout);
          Object.assign(error, { code: null, signal: "SIGKILL", killed: true });
        }
        if (["spawn", "spawn-permission"].includes(fault)) {
          Object.assign(error, { code: fault === "spawn" ? "ENOENT" : "EPERM", errno: fault === "spawn" ? -2 : -1,
            syscall: "spawn " + observerPath, stdout: output(""), stderr: output("") });
          delete error.signal; delete error.killed;
        }
        if (["maxbuffer", "oversized-capture"].includes(fault)) {
          Object.assign(error, { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
            stdout: output("x".repeat(fault === "maxbuffer" ? 65536 : 65537)) });
          delete error.signal; delete error.killed; // Node's pre-created maxBuffer error need not have either.
        }
        if (fault === "signal") Object.assign(error, { code: null, signal: "SIGTERM", killed: false });
        if (fault === "unavailable-output") { delete error.stdout; delete error.stderr; }
        if (fault === "required-no-match") Object.assign(error, { stdout: output(""), stderr: output("") });
        throw error;
      };
      const server = new EventEmitter();
      server.listen = (_port, host, callback) => { expect(host).toBe("127.0.0.1"); server.listening = true; callback(); };
      server.address = () => ({ port: 42001 });
      server.close = done => { serverClosed = true; server.listening = false; done(); };
      vi.resetModules();
      vi.doMock("node:child_process", () => ({ spawn, execFile }));
      vi.doMock("node:net", async original => ({ ...await original(), createServer: () => server, connect }));
      vi.doMock("node:fs", async original => {
        const fs = await original();
        return { ...fs,
          readFileSync: (path, ...args) => {
            if (String(path).startsWith("/Library/Developer/CommandLineTools/SDKs/"))
              return Buffer.from("fixed-unit-sdk-header");
            if (String(path).endsWith("/meta-owned-socket-observer.cohort.json"))
              return Buffer.from(JSON.stringify({
                schema: fault === "bad-cohort" ? "not-a-cohort" : "airlock.owned-socket-observer-cohort.v1",
                source_sha256: fault === "source-mismatch" ? "f".repeat(64) : hash(fs.readFileSync(
                  fileURLToPath(new URL("./meta-owned-socket-observer.c", import.meta.url)))),
                binary_sha256: observerSha, compiler_sha256: "a".repeat(64),
                sdk: "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk",
                headers: Object.fromEntries(["libproc.h", "sys/proc_info.h", "sys/proc.h"]
                  .map(n => [n, fault === "changed-headers" ? "f".repeat(64) : hash("fixed-unit-sdk-header")])),
              }));
            if (String(path) === observerPath && fault === "binary-changed"
              && ++binaryReads === 2) {
              fs.writeFileSync(observerFixture, "changed-observer");
              cleanup = true; queueMicrotask(() => child.emit("exit", 2, null));
            }
            return fs.readFileSync(String(path) === observerPath ? observerFixture : path, ...args);
          },
          lstatSync: (path, ...args) => fs.lstatSync(String(path) === observerPath ? observerFixture
            : String(path) === observerPath.slice(0, observerPath.lastIndexOf("/")) ? outputDir : path, ...args),
        };
      });
      vi.doMock("./inspected-meta-stock.mjs", () => ({ inspectedMetaSourcePins: () => ({ pure_unit_only: true }) }));
      const signal = vi.spyOn(process, "kill").mockImplementation(() => {
        throw Object.assign(Error("unit EPERM"), { code: "EPERM" });
      });
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
      const originalDyld = process.env.DYLD_INSERT_LIBRARIES;
      if (fault === "closed-env") process.env.DYLD_INSERT_LIBRARIES = "/forbidden-unit-library";
      try {
        const { runSyntheticPreexecFdFeasibility } = await load();
        const finished = runSyntheticPreexecFdFeasibility({ outputDir, control: "normal" });
        await vi.runAllTimersAsync();
        const result = await finished;
        expect(result.witnessed).toBe(false); expect(result.native_qualified).toBe(false);
        expect(result.connected_peer).toBe(false); expect(result.target_executed).toBe(false);
        if (["missing-observer", "bad-cohort", "changed-headers", "source-mismatch", "binary-changed"].includes(fault)) {
          const reason = { "missing-observer": "synthetic_observer_unavailable",
            "bad-cohort": "synthetic_observer_cohort", "changed-headers": "synthetic_observer_header_changed",
            "source-mismatch": "synthetic_observer_cohort", "binary-changed": "synthetic_observer_binary_changed" }[fault];
          expect(result.errors).toContain(reason);
          expect(queries.some(q => q.program === observerPath)).toBe(false);
          if (fault !== "binary-changed") {
            expect(spawn).not.toHaveBeenCalled();
            if (fault === "missing-observer")
              expect(JSON.parse(readFileSync(join(outputDir, "descriptor-observer-unavailable.json"))))
                .toMatchObject({ phase: "observer-preparation", path: observerPath, os_error_code: "ENOENT" });
            expect(serverClosed).toBe(false);
          } else {
            expect(child.stdout.destroyed).toBe(true); expect(child.stderr.destroyed).toBe(true);
            expect(child.disconnect).toHaveBeenCalledOnce(); expect(child.unref).toHaveBeenCalledOnce();
            expect(serverClosed).toBe(true);
          }
          const names = readdirSync(outputDir);
          expect(names).not.toContain("tcp-only.json"); expect(names).not.toContain("exec-ready.json");
          expect(connect).not.toHaveBeenCalled(); expect(signal).not.toHaveBeenCalled();
          return;
        }
        if (fault !== "parallel-ps-error")
          expect(queries.some(q => q.program === observerPath
            && q.args[0] === "launcher" && q.args[1] === String(ids.L))).toBe(true);
        const diagnostic = result.command_diagnostics;
        expect(diagnostic).toBeDefined(); // RED on frozen v1's generic-only error.
        const published = JSON.parse(readFileSync(join(outputDir, "result.json")));
        expect(published.command_diagnostics.receipts.every(pair => pair.completed !== null)).toBe(true);
        const records = diagnostic.receipts.map(pair => ({
          issued: JSON.parse(readFileSync(pair.issued.path)),
          completed: JSON.parse(readFileSync(pair.completed.path)),
        }));
        expect(issuedAtExecute.every((r, n) => r && r.program === queries[n].program
          && JSON.stringify(r.args) === JSON.stringify(queries[n].args))).toBe(true);
        expect(queries.every(q => q.options.encoding === "buffer" && q.options.maxBuffer === 65536
          && q.options.timeout > 0 && q.options.timeout <= 1000)).toBe(true);
        if (fault === "closed-env")
          expect(queries.filter(q => q.program === observerPath).map(q => Object.keys(q.options.env).sort()))
            .toEqual([["LC_ALL", "PATH"]]);
        const failed = records.find(r => r.issued.phase === "pre-enrollment"
          && (fault === "parallel-ps-error" ? r.issued.callsite === "row" && r.issued.role === "P" : r.issued.callsite === "descriptors"));
        expect(failed.issued).toMatchObject({ ...(fault === "parallel-ps-error" ? {
          role: "P", program: "/bin/ps", args: ["-p", String(process.pid), "-ww",
            "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="], expected_owned_role_identity: { pid: process.pid },
        } : { role: "L", program: observerPath,
          args: ["launcher", String(ids.L), String(ids.E), String(ids.L), String(process.pid)],
          expected_owned_role_identity: { pid: ids.L, ppid: ids.E, pgid: ids.L } }),
          expected_is_not_this_query_observation: true, case: diagnostic.case });
        expect(failed.issued.sequence).toBeGreaterThan(1);
        expect(failed.completed).toMatchObject({ outcome: "error", effective_timeout_ms: 1000 });
        expect(failed.completed.started_monotonic_ms).toBeGreaterThanOrEqual(failed.issued.issued_monotonic_ms);
        expect(failed.completed.ended_monotonic_ms).toBeGreaterThanOrEqual(failed.completed.started_monotonic_ms);
        expect(failed.completed.remaining_deadline_ms).toBeGreaterThan(0);
        expect(result.command_diagnostics.failures[0].completed.path).toContain("completed.json");
        const category = { timeout: "timeout", spawn: "spawn", "spawn-permission": "spawn",
          maxbuffer: "maxbuffer", "oversized-capture": "maxbuffer", signal: "signal", "required-no-match": "required-no-match" }[fault] ?? "exit";
        expect(failed.completed.error.classification).toBe(category);
        if (fault === "unavailable-output") {
          expect(failed.completed.stderr).toMatchObject({ available: false, base64: null, sha256: null });
        } else {
          expect(Buffer.from(failed.completed.stderr.base64, "base64").toString()).toBe(
            ["required-no-match", "spawn", "spawn-permission"].includes(fault) ? "" : "unit OS diagnostic\n");
          expect(failed.completed.stderr.sha256).toBe(hash(Buffer.from(failed.completed.stderr.base64, "base64")));
        }
        if (["maxbuffer", "oversized-capture"].includes(fault)) expect(failed.completed.stdout).toMatchObject({
          captured_bytes: 65536, truncated: fault === "oversized-capture", upstream_truncation_possible: true });
        if (["spawn", "spawn-permission", "maxbuffer", "oversized-capture"].includes(fault))
          expect(failed.completed).toMatchObject({ signal: null, signal_available: false,
            killed: null, killed_available: false, error: { killed: null, signal_available: false, killed_available: false } });
        if (fault === "spawn") expect(failed.completed.error).toMatchObject({ code: "ENOENT", errno: -2, exit_code: null });
        if (fault === "timeout") expect(failed.completed.error).toMatchObject({ code: null, signal: "SIGKILL", killed: true });
        if (fault === "empty-children-once")
          expect(records.some(r => r.issued.callsite === "children" && r.completed.outcome === "owned-children-empty")).toBe(true);
        expect(records.some(r => r.issued.callsite === "group" && r.completed.outcome === "owned-group-empty")).toBe(true);
        expect(records.every(r => r.issued.case.path === diagnostic.case.path)).toBe(true);
        expect(records.map(r => r.issued.sequence).sort((a, b) => a - b)).toEqual(
          Array.from({ length: records.length }, (_, n) => n + 1));
        const names = readdirSync(outputDir);
        expect(names).not.toContain("tcp-only.json"); expect(names).not.toContain("exec-ready.json");
        const disposition = JSON.parse(readFileSync(join(outputDir, "resource-disposition.json")));
        if (fault.startsWith("cleanup-")) {
          expect(disposition.disposition.find(d => d.role === "H").disposition).toBe("UNKNOWN");
          expect(result.errors).toContain("synthetic_resource_disposition_unknown");
        }
        if (fault === "cleanup-observation-error") expect(signal).not.toHaveBeenCalled();
        if (fault === "cleanup-signal-error") {
          expect(signal).toHaveBeenCalledExactlyOnceWith(ids.H, "SIGTERM");
          expect(disposition.disposition.find(d => d.role === "H").error_code).toBe("EPERM");
        }
        expect(child.stdout.destroyed).toBe(true); expect(child.stderr.destroyed).toBe(true);
        expect(child.disconnect).toHaveBeenCalledOnce(); expect(child.unref).toHaveBeenCalledOnce();
        expect(serverClosed).toBe(true); expect(connect).not.toHaveBeenCalled();
      } finally {
        if (originalDyld === undefined) delete process.env.DYLD_INSERT_LIBRARIES;
        else process.env.DYLD_INSERT_LIBRARIES = originalDyld;
        child.stdout.destroy(); child.stderr.destroy();
        vi.useRealTimers(); vi.restoreAllMocks();
        for (const name of ["node:child_process", "node:net", "node:fs", "./inspected-meta-stock.mjs"]) vi.doUnmock(name);
        vi.resetModules(); rmSync(root, { recursive: true, force: true });
      }
    });
});

describe("actual first-party shell/FD candidate (explicit opt-in only)", () => {
  it.runIf(process.env.AIRLOCK_SYNTHETIC_PREEXEC_FD === "1")(
    "proves real normal PID/argv/FD causality with no browser", async () => {
      const { runSyntheticPreexecFdFeasibility } = await load();
      const root = process.env.AIRLOCK_SYNTHETIC_PREEXEC_OUTPUT;
      const started = performance.now();
      const normal = await runSyntheticPreexecFdFeasibility({ outputDir: root + "-normal", control: "normal" });
      expect(performance.now() - started).toBeLessThan(45000);
      expect(normal.witnessed).toBe(true);
      expect(normal.errors).toEqual([]);
      expect(normal.debug_handle_identity_supported).toBe(true);
      expect(normal.fd_round_trips).toBe(2);
      expect(normal.launcher_pid_preserved).toBe(true);
      expect(normal.native_qualified).toBe(false);
    }, 50000);
  it.runIf(process.env.AIRLOCK_SYNTHETIC_PREEXEC_FD === "1")(
    "observes the actual connected helper refusal with no target execution", async () => {
      const { runSyntheticPreexecFdFeasibility } = await load();
      const root = process.env.AIRLOCK_SYNTHETIC_PREEXEC_OUTPUT;
      const started = performance.now();
      const refused = await runSyntheticPreexecFdFeasibility({ outputDir: root + "-refused", control: "refuse-exec" });
      expect(performance.now() - started).toBeLessThan(45000);
      expectQualifiedRefusal(refused);
    }, 50000);
  it.runIf(process.env.AIRLOCK_SYNTHETIC_PREEXEC_FD === "1")(
    "rejects real inherited debugger sockets before enrollment or exec", async () => {
      const { runSyntheticPreexecFdFeasibility } = await load();
      const root = process.env.AIRLOCK_SYNTHETIC_PREEXEC_OUTPUT;
      const started = performance.now();
      const inherited = await runSyntheticPreexecFdFeasibility({ outputDir: root + "-inherited", control: "inherited-debug" });
      expect(performance.now() - started).toBeLessThan(45000);
      expect(inherited.errors).toEqual(["inherited_debug_handle"]);
      expect(inherited.connected_peer).toBe(false);
      expect(inherited.target_executed).toBe(false);
      expect(inherited.native_qualified).toBe(false);
      expect(inherited.child_exit).toEqual({ code: 2, signal: null });
    }, 50000);
});
