import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

// No source test may reach an operating-system, Docker or socket boundary.
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => { throw Error("OS_PROCESS_FORBIDDEN"); }),
  execFileSync: vi.fn(() => { throw Error("OS_PROCESS_FORBIDDEN"); }),
}));
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("SOCKET_FORBIDDEN"); }) }));
vi.mock("node:perf_hooks", () => ({ performance: { now: vi.fn(() => { throw Error("CLOCK_NOT_MOCKED"); }) } }));
vi.mock("node:readline", () => ({ createInterface: vi.fn(() => { throw Error("LISTENER_FORBIDDEN"); }) }));
vi.mock("./sdk-absent-owned-namespace-image-admission.mjs", () => ({
  assertOwnedNamespacePayloadContext: vi.fn(() => ({ case_id: "source-case-01", nonce: "a".repeat(64) })),
  requireOwnedNamespaceImageClockContract: vi.fn(() => { throw Error("RUNTIME_CLOCK_PROOF_UNAVAILABLE"); }),
}));
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  lstatSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  realpathSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  openSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  fstatSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  writeSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  fsyncSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  closeSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  linkSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  unlinkSync: vi.fn(() => { throw Error("FS_NOT_MOCKED"); }),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));

import * as ns from "./sdk-absent-owned-namespace.mjs";
import * as time from "./sdk-absent-owned-namespace-time.mjs";
import { atomicPrivateWrite, fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { inspectOwnedNamespaceModelCompletion as inspectOwnedNamespaceCompletion,
  ownedNamespaceWholeCommand } from "./sdk-absent-owned-namespace-consumer.mjs";
import { startOwnedNamespaceInit } from "./sdk-absent-owned-namespace-init.mjs";
import { runOwnedNamespacePayload } from "./sdk-absent-owned-namespace-payload.mjs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
const { createOwnedNamespaceSupervisor } = ns;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ROOT = "/source-model/owned-case";
const CID = "c".repeat(64);
const NONCE = "a".repeat(64);
const files = new Map(), descriptors = new Map();
let nextFd, ino, metadata;
const cohortPath = fileURLToPath(new URL("sdk-absent-owned-namespace-cohort.json", import.meta.url));
function put(path, text, mode = 0o100600) {
  files.set(path, { bytes: Buffer.from(text), meta: { dev: 1, ino: ++ino, mode, uid: 501,
    size: Buffer.byteLength(text), mtimeMs: 100, ctimeMs: 100,
    isFile: () => (mode & 0o170000) === 0o100000,
    isDirectory: () => (mode & 0o170000) === 0o040000, isSymbolicLink: () => false } });
}
function prepare() {
  return ns.prepareOwnedNamespacePlan({ case_id: "source-case-01", nonce: NONCE, root: ROOT });
}
beforeEach(() => {
  vi.clearAllMocks();
  spawn.mockImplementation(() => { throw Error("OS_PROCESS_FORBIDDEN"); });
  performance.now.mockImplementation(() => { throw Error("CLOCK_NOT_MOCKED"); });
  files.clear(); descriptors.clear(); nextFd = 10; ino = 20;
  fs.openSync.mockImplementation((path, flags) => {
    if (flags === "wx") {
      if (files.has(path)) throw Error("EEXIST");
      put(path, "");
    }
    if (!files.has(path)) throw Error("mock_file_missing:" + path);
    const fd = ++nextFd; descriptors.set(fd, path); return fd;
  });
  fs.fstatSync.mockImplementation(fd => ({ ...files.get(descriptors.get(fd)).meta }));
  fs.lstatSync.mockImplementation(path => {
    if (!files.has(path)) throw Error("mock_file_missing:" + path);
    return { ...files.get(path).meta };
  });
  fs.readFileSync.mockImplementation(fd => Buffer.from(files.get(descriptors.get(fd)).bytes));
  fs.writeSync.mockImplementation((fd, bytes, offset = 0, length = bytes.length) => {
    const row = files.get(descriptors.get(fd)), part = Buffer.from(bytes).subarray(offset, offset + length);
    row.bytes = Buffer.concat([row.bytes, part]); row.meta.size = row.bytes.length; return part.length;
  });
  fs.closeSync.mockImplementation(fd => descriptors.delete(fd));
  fs.fsyncSync.mockImplementation(() => {});
  fs.linkSync.mockImplementation((from, to) => {
    if (files.has(to)) throw Error("EEXIST");
    files.set(to, files.get(from));
  });
  fs.unlinkSync.mockImplementation(path => files.delete(path));
  fs.realpathSync.mockImplementation(path => path === "/usr/local/bin/docker" ? "/source-model/fixed-docker" : path);
  put(ROOT, "", 0o040700); put(ROOT + "/case", "", 0o040700);
  put(ROOT + "/docker-config", "", 0o040700); put(ROOT + "/empty-home", "", 0o040700);
  put(ROOT + "/docker-config/config.json", "{}\n");
  put("/source-model/fixed-docker", "SIMULATED CLIENT BYTES", 0o100755);
  const sources = (ns.OWNED_NAMESPACE_SOURCES ?? []).map(path => {
    put(path, "SIMULATED SOURCE:" + path, 0o100644);
    return { path, sha256: hash("SIMULATED SOURCE:" + path) };
  });
  metadata = {
    schema: "airlock.owned-namespace-cohort.v1", status: "PREPARED_SOURCE_MODEL_ONLY",
    endpoint: "unix:///var/run/docker.sock", engine_id: "SIMULATED-engine-not-runtime-evidence",
    client_realpath: "/source-model/fixed-docker", client_sha256: hash("SIMULATED CLIENT BYTES"),
    image_id: "sha256:" + "d".repeat(64), platform: "linux/arm64/v8", node_version: "24.10.0",
    base_digest: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    root_uid: 501, sources, clock: {
      schema: "airlock.owned-namespace-clock-bounds.v1", status: "SIMULATED_NOT_PROVEN",
      minimum_init_ticks_per_supervisor_tick: 0.99, maximum_init_ticks_per_supervisor_tick: 1.01,
      conservative_margin_ms: 100, evidence_sha256: "e".repeat(64),
    },
  };
  put(cohortPath, JSON.stringify(metadata), 0o100644);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function updateCohort() { put(cohortPath, JSON.stringify(metadata), 0o100644); }
function atStart() { return ns.createOwnedNamespaceSupervisor(prepare(), 100); }
function command(h, kind, now = 110) {
  const op = ns.registerNamespaceOperation(h, { kind, now_ms: now });
  const durable = ns.persistNamespaceJournal(h, now);
  return { op, command: ns.issueNamespaceCommand(h, { operation: op, journal: durable, now_ms: now }) };
}
function reply(h, op, value, now = 120) {
  ns.observeNamespaceDaemonReply(h, { operation: op, outcome: "reply", value, now_ms: now });
  ns.observeNamespaceClientClose(h, { operation: op, exit_code: 0, streams_settled: true, now_ms: now });
}
function bound(h = atStart()) {
  reply(h, command(h, "create").op, { cid: CID });
  reply(h, command(h, "inspect-cid", 125).op, ns.namespaceExpectedIdentity(h), 130);
  ns.persistNamespaceJournal(h, 131);
  return h;
}

describe("SOURCE/PURE owned namespace private preparation", () => {
  it("rejects a serialized or boolean substitute for the private plan", () => {
    expect(() => createOwnedNamespaceSupervisor({ prepared: true }, 100)).toThrow("private_namespace_plan");
  });
  it("keeps the real cohort NOT_PREPARED and does not inspect a daemon or client", () => {
    put(cohortPath, JSON.stringify({ schema: "airlock.owned-namespace-cohort.v1", status: "NOT_PREPARED" }), 0o100644);
    expect(() => prepare()).toThrow("namespace_cohort_NOT_PREPARED");
    expect(fs.realpathSync).not.toHaveBeenCalled();
  });
  it("creates an immutable private plan only from fixed filesystem/source metadata", () => {
    const p = prepare();
    expect(Object.isFrozen(p)).toBe(true);
    expect(() => createOwnedNamespaceSupervisor(JSON.parse(JSON.stringify(p)), 100)).toThrow("private_namespace_plan");
    expect(ns.namespaceState(createOwnedNamespaceSupervisor(p, 100))).toMatchObject({
      scope: "SOURCE_PURE_MODEL_ONLY", total_deadline_ms: 45100, work_deadline_ms: 35100,
    });
  });
  it("cannot reuse a genuine private plan to restart the original case budget", () => {
    const p = prepare();
    createOwnedNamespaceSupervisor(p, 100);
    expect(() => createOwnedNamespaceSupervisor(p, 50000)).toThrow("namespace_plan_already_owned");
  });
  it.each(["endpoint", "platform", "node_version", "base_digest"])("rejects changed fixed %s", key => {
    metadata[key] = "foreign"; updateCohort();
    expect(() => prepare()).toThrow();
  });
  it("refuses credentials, extra fields, getters and proxy plans", () => {
    put(ROOT + "/docker-config/config.json", '{"credsStore":"foreign"}');
    expect(() => prepare()).toThrow("namespace_empty_config");
    const getter = vi.fn(() => "source-case-01");
    expect(() => ns.prepareOwnedNamespacePlan({ get case_id() { return getter(); }, nonce: NONCE, root: ROOT })).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => createOwnedNamespaceSupervisor(new Proxy({}, {}), 100)).toThrow("private_namespace_plan");
  });
});

describe("SOURCE/PURE supervisor owns pending operations, never a worker or CLI", () => {
  it("durably registers create BEFORE issuing a fixed, non-starting command", () => {
    const h = atStart(), op = ns.registerNamespaceOperation(h, { kind: "create", now_ms: 110 });
    expect(() => ns.issueNamespaceCommand(h, { operation: op, journal: {}, now_ms: 110 })).toThrow("durable_registration_required");
    const journal = ns.persistNamespaceJournal(h, 111);
    const cmd = ns.issueNamespaceCommand(h, { operation: op, journal, now_ms: 112 });
    expect(cmd.argv).toContain("create"); expect(cmd.argv).not.toContain("run"); expect(cmd.argv).not.toContain("start");
    expect(cmd.argv).toContain("--pull=never"); expect(cmd.argv).toContain("--network=none");
    expect(cmd.env).toEqual({ HOME: ROOT + "/empty-home", DOCKER_CONFIG: ROOT + "/docker-config",
      DOCKER_HOST: "unix:///var/run/docker.sock", PATH: "/usr/local/bin:/usr/bin:/bin" });
    expect(ns.namespaceState(h).operations[0]).toMatchObject({ owner: "S", daemon: "PENDING", issued: true });
    expect(ns.namespaceState(h).prepared_identity).toMatchObject({
      endpoint: "unix:///var/run/docker.sock", engine_id: metadata.engine_id, image_id: metadata.image_id,
      preissued_name: "airlock-owned-source-case-01", original_configuration: { pid_namespace: "private", binds: [] },
    });
  });
  it("retains CID and exact custody durably before permitting start", () => {
    const h = atStart();
    reply(h, command(h, "create").op, { cid: CID });
    expect(() => command(h, "start", 123)).toThrow("namespace_custody_not_durable");
    reply(h, command(h, "inspect-cid", 125).op, ns.namespaceExpectedIdentity(h), 130);
    ns.persistNamespaceJournal(h, 131);
    const start = command(h, "start", 132);
    expect(start.command.argv.slice(-4)).toEqual(["start", "--attach", "--interactive", CID]);
  });
  it("worker loss before init keeps an unresolved daemon start owned by S", () => {
    const h = bound(), op = command(h, "start", 140).op;
    ns.loseNamespaceWorker(h, 141);
    ns.observeNamespaceClientClose(h, { operation: op, exit_code: null, streams_settled: true, now_ms: 142 });
    expect(ns.namespaceState(h)).toMatchObject({ worker_lost: true, disposition: "UNKNOWN", workload_permitted: false });
    expect(ns.namespaceState(h).operations.at(-1)).toMatchObject({ owner: "S", daemon: "PENDING" });
    expect(() => ns.namespaceHello(h, { case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }, 145)).toThrow();
    ns.observeNamespaceDaemonReply(h, { operation: op, outcome: "reply", value: { started: true }, now_ms: 150 });
    expect(command(h, "stop", 151).command.argv.at(-1)).toBe(CID);
    expect(ns.namespaceState(h).workload_permitted).toBe(false);
  });
  it("client loss is not cancellation, supervisor loss is sticky UNKNOWN", () => {
    const h = bound(), op = command(h, "start", 140).op;
    ns.observeNamespaceClientClose(h, { operation: op, exit_code: null, streams_settled: false, now_ms: 141 });
    ns.loseNamespaceSupervisor(h, 142);
    expect(ns.namespaceState(h).operations.at(-1).daemon).toBe("PENDING");
    expect(ns.namespaceState(h).errors).toContain("supervisor_lost_no_supported_handoff");
    expect(() => command(h, "stop", 143)).toThrow("supervisor_lost");
  });
  it("lost creation permits only the exact preissued-name query, never start or global inventory", () => {
    const h = atStart(), op = command(h, "create").op;
    ns.observeNamespaceClientClose(h, { operation: op, exit_code: null, streams_settled: true, now_ms: 120 });
    expect(() => command(h, "start", 121)).toThrow();
    expect(() => command(h, "ps", 121)).toThrow();
    const query = command(h, "inspect-name", 122);
    expect(query.command.argv.at(-1)).toBe("airlock-owned-source-case-01");
    const foreign = ns.namespaceExpectedIdentity(h);
    foreign.cid = "f".repeat(64); foreign.labels.case_id = "foreign";
    expect(() => ns.observeNamespaceDaemonReply(h, { operation: query.op, outcome: "reply", value: foreign, now_ms: 123 })).toThrow("namespace_foreign_identity");
    expect(ns.namespaceState(h).cid).toBe(null);
  });
  it.each(["engine_id", "endpoint", "image_id", "config", "labels", "source_sha256"])("rejects foreign/changed %s before any start", key => {
    const h = atStart();
    reply(h, command(h, "create").op, { cid: CID });
    const op = command(h, "inspect-cid", 125).op, identity = ns.namespaceExpectedIdentity(h);
    identity[key] = key === "config" || key === "labels" ? {} : "foreign";
    expect(() => ns.observeNamespaceDaemonReply(h, { operation: op, outcome: "reply", value: identity, now_ms: 130 })).toThrow("namespace_foreign_identity");
    expect(ns.namespaceState(h).disposition).toBe("UNKNOWN");
  });
  it("rejects stale journal/JSON replacements and source changes after preparation", () => {
    const h = atStart(), op = ns.registerNamespaceOperation(h, { kind: "create", now_ms: 110 });
    const j = ns.persistNamespaceJournal(h, 111);
    expect(() => ns.issueNamespaceCommand(h, { operation: op, journal: JSON.parse(JSON.stringify(j)), now_ms: 112 })).toThrow();
    put(ns.OWNED_NAMESPACE_SOURCES[0], "changed");
    expect(() => ns.issueNamespaceCommand(h, { operation: op, journal: j, now_ms: 113 })).toThrow("namespace_source_changed");
  });
  it("refuses foreign IDs, signals, arbitrary images/programs and unknown operation fields without issuing anything", () => {
    const h = bound();
    for (const kind of ["kill", "prune", "ps", "run", "pull", "build", "exec", "inspect"]) {
      expect(() => ns.registerNamespaceOperation(h, { kind, now_ms: 140 })).toThrow("namespace_fixed_operation");
    }
    expect(() => ns.registerNamespaceOperation(h, { kind: "stop", now_ms: 140, cid: "f".repeat(64) })).toThrow();
    expect(() => ns.registerNamespaceOperation(h, { kind: "stop", now_ms: 140, signal: "SIGKILL" })).toThrow();
    expect(spawn).not.toHaveBeenCalled();
    expect(ns.namespaceState(h).operations.map(o => o.kind)).toEqual(["create", "inspect-cid"]);
  });
  it("recovers only exact full custody after a lost create reply, but cannot call the original daemon request settled", () => {
    const h = atStart(); command(h, "create");
    const op = command(h, "inspect-name", 120).op;
    const found = ns.namespaceExpectedIdentity(h); found.cid = CID;
    reply(h, op, found, 125); ns.persistNamespaceJournal(h, 126);
    expect(ns.namespaceState(h).cid).toBe(CID);
    expect(() => command(h, "start", 130)).toThrow("namespace_start_not_permitted");
    expect(command(h, "stop", 131).command.argv.at(-1)).toBe(CID);
    expect(ns.namespaceState(h).operations[0].daemon).toBe("PENDING");
  });
  it.each(["client", "cohort", "root", "image", "config"])("refuses a changed %s after preparation", key => {
    const h = bound();
    if (key === "client") put("/source-model/fixed-docker", "changed", 0o100755);
    else if (key === "root") put(ROOT, "", 0o040700);
    else if (key === "config") put(ROOT + "/docker-config/config.json", "{} ");
    else { metadata.image_id = "sha256:" + "f".repeat(64); updateCohort(); }
    expect(() => command(h, "start", 140)).toThrow();
    expect(ns.namespaceState(h).errors.length).toBeGreaterThan(0);
  });
});

function hello(h, now = 160) {
  return ns.namespaceHello(h, { type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }, now);
}
function armed(h, now = 161) {
  ns.namespaceArmed(h, { type: "ARMED", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }, now);
}
function running() {
  const h = bound(); reply(h, command(h, "start", 140).op, { started: true }, 150); return h;
}
function finished(control = "normal") {
  const plan = prepare(), h = bound(ns.createOwnedNamespaceSupervisor(plan, 100));
  const start = command(h, "start", 140).op;
  if (control === "worker-loss-before-init") ns.loseNamespaceWorker(h, 141);
  reply(h, start, { started: true }, 150);
  if (control !== "worker-loss-before-init") {
    hello(h); armed(h);
    if (control === "worker-loss-after-arm") ns.loseNamespaceWorker(h, 162);
    else {
      ns.issueNamespaceWork(h, control, 162);
      if (control === "late-detached-orphan") ns.observeNamespaceControlEvent(h, {
        type: "SOURCE_MODEL_LATE_FORK_SETSID_ORPHAN", case_id: "source-case-01", nonce: NONCE,
      }, 163);
    }
  }
  reply(h, command(h, "stop", 170).op, { stopped_cid: CID }, 180);
  reply(h, command(h, "wait", 190).op, { waited_cid: CID, exit_code: 0 }, 200);
  reply(h, command(h, "remove", 210).op, { removed_cid: CID }, 220);
  const publication = ns.publishNamespaceCandidate(h, control, 230), evidence = ns.namespacePlanEvidence(plan);
  const external = {
    schema: "airlock.owned-namespace-external-completion.v1", observer_scope: "external-whole-command-after-close",
    command: ownedNamespaceWholeCommand(plan, control), case_id: evidence.case_id, source_sha256: evidence.source_sha256,
    cohort_sha256: evidence.cohort_sha256, exit_observed: true, actual_exit_code: 0, signal: null, timed_out: false,
    started_monotonic_ms: 100, completed_monotonic_ms: 300, candidate: publication.file,
    publication_closed_monotonic_ms: 250, observer_streams_settled: true, observer_queries_settled: true,
    supervisor_lost: false, errors: [], scope: "SOURCE_PURE_MODEL_ONLY", qualified: false,
  };
  // File-level adversaries mutate a parsed copy of ORIGINAL bytes, not the
  // producer's frozen in-memory return value.
  const f = { plan, h, publication, external, candidate: JSON.parse(files.get(ROOT + "/case/candidate.json").bytes) };
  return writeExternal(f);
}
function writeExternal(f) {
  put(ROOT + "/external-completion.json", JSON.stringify(f.external));
  f.completion = fixedRead(ROOT + "/external-completion.json").handle;
  return f;
}
function rewriteCandidate(f) {
  put(ROOT + "/case/candidate.json", JSON.stringify(f.candidate));
  f.external.candidate = fixedRead(ROOT + "/case/candidate.json").handle;
  return writeExternal(f);
}
const inspect = f => inspectOwnedNamespaceCompletion(f.plan, { completion: f.completion });

describe("SOURCE/PURE original fences and causal init handshake", () => {
  it("uses explicit unproved rate bounds, never equal host/VM clock epochs", () => {
    const h = running(), arm = hello(h, 200);
    expect(arm.tau0_ms).toBe(9000000);
    expect(arm.work_remaining_ms).toBe(Math.floor((35100 - 200) * 0.99 - 100));
    const model = time.createNamespaceInitModel({ case_id: arm.case_id, nonce: arm.nonce,
      tau0_ms: arm.tau0_ms, clock: metadata.clock });
    time.namespaceInitHello(model, 9000001);
    const watchdog = time.namespaceInitArm(model, arm, 9000010);
    expect(watchdog.arm_watchdog_until_ms).toBe(9000000 + arm.total_remaining_ms);
    const permit = { type: "WORK", case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, control: "normal" };
    expect(() => time.namespaceInitWork(model, permit, 9000011)).toThrow("namespace_work_fence_or_permit");
  });
  it("arms watchdog before ARMED and checks the existing work fence again", () => {
    const h = running(), arm = hello(h);
    const init = time.createNamespaceInitModel({ case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, clock: metadata.clock });
    const message = time.namespaceInitHello(init, 9000000);
    expect(message.type).toBe("HELLO");
    time.namespaceInitArm(init, arm, 9000001);
    expect(time.namespaceInitWatchdogArmed(init, 9000002).type).toBe("ARMED");
    armed(h);
    const work = ns.issueNamespaceWork(h, "normal", 162);
    expect(time.namespaceInitWork(init, work, 9000003).work_deadline_ms).toBe(9000000 + arm.work_remaining_ms);
    expect(() => ns.issueNamespaceWork(h, "normal", 163)).toThrow("namespace_work_not_permitted");
  });
  it("never renews a delayed permit from receipt time", () => {
    const h = running(), arm = hello(h);
    const init = time.createNamespaceInitModel({ case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, clock: metadata.clock });
    time.namespaceInitHello(init, 9000000);
    expect(() => time.namespaceInitArm(init, { ...arm, work_remaining_ms: 5, total_remaining_ms: 10 }, 9000006))
      .toThrow("namespace_expired_arm");
  });
  it("rejects delayed prepermit start, duplicate/renewed ARM, mismatched nonce/tau0 and absent clock proof", () => {
    const make = () => {
      const arm = time.conservativeArm({ case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000,
        now_ms: 160, work_deadline_ms: 35100, total_deadline_ms: 45100, clock: metadata.clock });
      const init = time.createNamespaceInitModel({ case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, clock: metadata.clock });
      time.namespaceInitHello(init, arm.tau0_ms); return { arm, init };
    };
    let x = make();
    expect(() => time.namespaceInitArm(x.init, x.arm, 9001000)).toThrow("namespace_init_deadline");
    x = make(); time.namespaceInitArm(x.init, x.arm, 9000001);
    expect(() => time.namespaceInitArm(x.init, x.arm, 9000002)).toThrow("namespace_invalid_or_renewed_arm");
    for (const change of [{ nonce: "b".repeat(64) }, { tau0_ms: 9000001 }]) {
      x = make();
      expect(() => time.namespaceInitArm(x.init, { ...x.arm, ...change }, 9000002)).toThrow();
    }
    expect(() => time.clockBounds({})).toThrow();
    expect(() => time.clockBounds({ ...metadata.clock, conservative_margin_ms: 0 })).toThrow("namespace_clock_bounds_UNPROVED");
  });
  it("S rechecks its original work fence before WORK and init rechecks its own", () => {
    const h = running(), arm = hello(h); armed(h);
    expect(() => ns.issueNamespaceWork(h, "normal", 35100)).toThrow("namespace_work_not_permitted");
    const init = time.createNamespaceInitModel({ case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, clock: metadata.clock });
    time.namespaceInitHello(init, 9000000); time.namespaceInitArm(init, arm, 9000001); time.namespaceInitWatchdogArmed(init, 9000002);
    expect(() => time.namespaceInitWork(init, { type: "WORK", case_id: arm.case_id, nonce: arm.nonce, tau0_ms: arm.tau0_ms, control: "normal" },
      9000000 + arm.work_remaining_ms)).toThrow("namespace_work_fence_or_permit");
  });
  it("retains late start and pending query/stream failures as UNKNOWN without a new case", () => {
    const h = bound(), op = command(h, "start", 140).op;
    ns.observeNamespaceDaemonReply(h, { operation: op, outcome: "reply", value: { started: true }, now_ms: 45101 });
    ns.observeNamespaceClientClose(h, { operation: op, exit_code: 0, streams_settled: false, now_ms: 45102 });
    expect(ns.namespaceState(h).errors).toContain("daemon_reply_after_original_deadline");
    expect(ns.namespaceState(h).disposition).toBe("UNKNOWN");
    expect(() => command(h, "create", 45103)).toThrow();
  });
});

describe("SOURCE/PURE atomic publication and external original consumer", () => {
  it.each(["normal", "late-detached-orphan", "worker-loss-before-init", "worker-loss-after-arm"])(
    "%s is SIMULATED only, never namespace/native qualification", control => {
      const f = finished(control);
      expect(inspect(f)).toMatchObject({ source_model_evidence_valid: true, external_completion_valid: true,
        qualified: false, simulation_only: true, reason: "namespace_runtime_and_independent_owner_UNPROVED" });
    });
  it("rejects a still-open external observer stream", () => {
    const f = finished(); f.external.observer_streams_settled = false; writeExternal(f);
    expect(inspect(f).source_model_evidence_valid).toBe(false);
    expect(inspect(f).reason).toBe("namespace_external_command_failed_or_unsettled");
  });
  it.each([
    { exit_observed: false }, { actual_exit_code: 2 }, { signal: "SIGTERM" }, { timed_out: true },
    { observer_queries_settled: false }, { supervisor_lost: true }, { errors: ["unsettled probe"] },
    { command: ["foreign"] }, { qualified: true },
  ])("rejects failed/missing/foreign external close %j", delta => {
    const f = finished(); Object.assign(f.external, delta); writeExternal(f);
    expect(inspect(f).source_model_evidence_valid).toBe(false);
  });
  it.each([
    { completed_monotonic_ms: 45100 }, { completed_monotonic_ms: 45101 },
    { publication_closed_monotonic_ms: 301 }, { started_monotonic_ms: 101 },
    { publication_closed_monotonic_ms: 99 },
  ])("rejects late publication, renewed fences and missing original timing %j", delta => {
    const f = finished(); Object.assign(f.external, delta); writeExternal(f);
    expect(inspect(f).source_model_evidence_valid).toBe(false);
  });
  it("rejects missing external evidence, truncated/duplicate-key JSON and changed originals", () => {
    const f = finished();
    expect(inspectOwnedNamespaceCompletion(f.plan, { completion: null }).reason).toBe("namespace_external_completion_missing");
    put(ROOT + "/case/candidate.json", '{"schema":');
    f.external.candidate = fixedRead(ROOT + "/case/candidate.json").handle; writeExternal(f);
    expect(inspect(f).source_model_evidence_valid).toBe(false);
    put(ROOT + "/case/candidate.json", '{"a":1,"a":2}');
    f.external.candidate = fixedRead(ROOT + "/case/candidate.json").handle; writeExternal(f);
    expect(inspect(f).reason).toBe("duplicate_case_key");
    put(ROOT + "/external-completion.json", "{}");
    expect(inspect(f).reason).toBe("namespace_original_hash_or_identity_changed");
  });
  it.each(["daemon", "owner", "client_closed", "streams_settled", "reply", "client_closed_ms"])(
    "replays original operation %s instead of trusting a settled marker", key => {
      const f = finished();
      const operation = f.candidate.supervisor.operations[2];
      operation[key] = key === "client_closed_ms" ? 301 : key === "reply" ? {} : key === "daemon" ? "PENDING"
        : key === "owner" ? "W" : false;
      rewriteCandidate(f);
      expect(inspect(f).source_model_evidence_valid).toBe(false);
    });
  it("cannot substitute post-arm loss for the pending-start seam", () => {
    const f = finished("worker-loss-after-arm");
    f.external.command = ownedNamespaceWholeCommand(f.plan, "worker-loss-before-init");
    f.candidate.control = "worker-loss-before-init"; rewriteCandidate(f);
    expect(inspect(f).reason).toBe("namespace_preinit_loss_missing");
  });
  it("cannot substitute a marker for the orphan control", () => {
    const f = finished("late-detached-orphan");
    f.candidate.supervisor.control_witness = null; rewriteCandidate(f);
    expect(inspect(f).source_model_evidence_valid).toBe(false);
  });
  it("cannot publish start after a foreign identity, failed daemon or unsettled stream", () => {
    const h = bound(), start = command(h, "start", 140).op;
    expect(() => ns.observeNamespaceDaemonReply(h, { operation: start, outcome: "failure", value: { error: "lost" }, now_ms: 150 }))
      .toThrow("namespace_daemon_failure");
    const result = ns.publishNamespaceCandidate(h, "normal", 160);
    expect(result.candidate.supervisor.errors).toContain("daemon_operation_failed:start");
    expect(result.candidate.source_model_settled).toBe(false);
    expect(result.qualified).toBe(false);
  });
  it("fsync failure retains UNKNOWN and supplies no durable permit; a partial publication is never completion", () => {
    const h = atStart(), op = ns.registerNamespaceOperation(h, { kind: "create", now_ms: 110 });
    fs.fsyncSync.mockImplementationOnce(() => { throw Error("SIMULATED_FSYNC_FAILURE"); });
    expect(() => ns.persistNamespaceJournal(h, 111)).toThrow("SIMULATED_FSYNC_FAILURE");
    expect(ns.namespaceState(h).errors).toContain("journal_publication:SIMULATED_FSYNC_FAILURE");
    expect(() => ns.issueNamespaceCommand(h, { operation: op, journal: {}, now_ms: 112 })).toThrow();
    expect(descriptors.size).toBe(0);
  });
  it("rejects source/client/config/root changes during consumption", () => {
    const f = finished();
    put(ROOT + "/docker-config/config.json", "{} ");
    expect(inspect(f).reason).toBe("namespace_source_changed");
  });
  it("keeps final bytes invisible until the staging inode is durable and refuses to overwrite originals", () => {
    const events = [];
    const sync = fs.fsyncSync.getMockImplementation(), link = fs.linkSync.getMockImplementation();
    fs.fsyncSync.mockImplementation(fd => { events.push("fsync"); return sync(fd); });
    fs.linkSync.mockImplementation((from, to) => { events.push("link-final"); return link(from, to); });
    const file = atomicPrivateWrite(ROOT, "original.json", { source_only: true }, 501);
    expect(events.slice(0, 4)).toEqual(["fsync", "fsync", "link-final", "fsync"]);
    const original = Buffer.from(files.get(file.path).bytes);
    expect(() => atomicPrivateWrite(ROOT, "original.json", { source_only: false }, 501)).toThrow("EEXIST");
    expect(files.get(file.path).bytes.equals(original)).toBe(true);
    expect(descriptors.size).toBe(0);
  });
  it("handles short writes without publishing partial final JSON and rejects zero-progress writes", () => {
    const write = fs.writeSync.getMockImplementation();
    fs.writeSync.mockImplementation((fd, bytes, offset, length) => write(fd, bytes, offset, Math.min(length, 2)));
    const result = atomicPrivateWrite(ROOT, "short-write.json", { source_only: true }, 501);
    expect(JSON.parse(files.get(result.path).bytes)).toEqual({ source_only: true });
    fs.writeSync.mockReturnValueOnce(0);
    expect(() => atomicPrivateWrite(ROOT, "zero-write.json", { source_only: true }, 501)).toThrow("namespace_short_write");
    expect(files.has(ROOT + "/zero-write.json")).toBe(false);
    expect(descriptors.size).toBe(0);
  });
});

describe("SOURCE/PURE fixed image/payload import and refusal boundaries", () => {
  it("imports without launching, listening, querying an engine, or reading a runtime proof", () => {
    expect(spawn).not.toHaveBeenCalled();
    expect(createInterface).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(() => startOwnedNamespaceInit()).toThrow("namespace_fixed_linux_pid1_cohort");
  });
  it.each([["sh", "20"], ["normal", "35001"], ["normal", "1", "foreign"], ["orphan", "0"], ["orphan", "1;evil"]])(
    "rejects non-fixed payload argv %j without effects", (...argv) => {
      expect(() => runOwnedNamespacePayload(argv)).toThrow("namespace_fixed_payload_arguments");
      expect(spawn).not.toHaveBeenCalled();
    });
  it("models late fork, setsid/new group, and orphan lifetime using mocked children and timers only", () => {
    vi.useFakeTimers(); performance.now.mockReturnValue(100);
    const child = { on: vi.fn(), unref: vi.fn() };
    spawn.mockReturnValue(child);
    runOwnedNamespacePayload(["late-detached-orphan", "100"]);
    expect(spawn).not.toHaveBeenCalled(); vi.advanceTimersByTime(1);
    expect(spawn).toHaveBeenCalledWith("/usr/local/bin/node", [
      fileURLToPath(new URL("sdk-absent-owned-namespace-payload.mjs", import.meta.url)), "late-parent", "100",
    ], { env: { PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_CASE: "source-case-01", AIRLOCK_NONCE: NONCE },
      stdio: ["ignore", "ignore", "ignore"], cwd: "/case" });
    runOwnedNamespacePayload(["late-parent", "90"]);
    expect(spawn.mock.calls[1][2]).toEqual({
      detached: true, env: { PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_CASE: "source-case-01", AIRLOCK_NONCE: NONCE },
      stdio: "ignore", cwd: "/case",
    });
    expect(child.unref).toHaveBeenCalledOnce();
    runOwnedNamespacePayload(["orphan", "80"]);
    expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(80);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps all readiness obligations unproved, including source closure integration", () => {
    expect(ns.ownedNamespaceReadiness()).toMatchObject({ ready: false, qualified: false, native_authority: false });
    expect(ns.ownedNamespaceReadiness().blockers).toHaveLength(7);
  });
});
