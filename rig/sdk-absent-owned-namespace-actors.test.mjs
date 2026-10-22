import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn(), writeSync: vi.fn(), fstatSync: vi.fn(),
  fsyncSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("OS_PROCESS_FORBIDDEN"); }) }));
vi.mock("node:process", async () => {
  const { EventEmitter } = await import("node:events");
  const p = new EventEmitter();
  Object.assign(p, { argv: [], env: {}, execPath: "/source-fixture/node", pid: 100, ppid: 90,
    platform: "darwin", arch: "arm64", version: "v22.16.0", connected: true,
    hrtime: { bigint: vi.fn(() => { throw Error("CLOCK_NOT_MOCKED"); }) },
    send: vi.fn(), disconnect: vi.fn(), stdout: { write: vi.fn() }, stderr: { write: vi.fn() } });
  return { default: p, hrtime: p.hrtime };
});
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); }) }));
vi.mock("node:http", () => ({ request: vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); }) }));
vi.mock("./sdk-absent-owned-namespace-admission.mjs", () => ({
  requireOwnedNamespaceRuntimeAdmission: vi.fn(), assertOwnedNamespacePayloadContext: vi.fn(),
}));
import process from "node:process";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import { fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { namespaceActorCompletion, namespaceActorSnapshot, startOwnedNamespaceSupervisor } from "./sdk-absent-owned-namespace-actors.mjs";
import { namespacePlanEvidence, prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";
import { normalizeOwnedNamespaceInspection, ownedNamespaceExpectedProjection,
  ownedNamespaceInspectionTemplate } from "./sdk-absent-owned-namespace-wire.mjs";
import { launchOwnedNamespaceCase, parseOwnedNamespacePublicArgv } from "./sdk-absent-owned-namespace-entry.mjs";
import { startOwnedNamespaceWorker } from "./sdk-absent-owned-namespace-worker.mjs";
import { requireOwnedNamespaceRuntimeAdmission } from "./sdk-absent-owned-namespace-admission.mjs";
import { bytesHash, CID, NONCE, clock, events, fakeChild, files, installSourceFixtureFs, makeSupervisorRequest,
  put, ROOT, descriptors } from "./sdk-absent-owned-namespace-actors.fixture.mjs";

let metadata, children, containerState;
const plan = () => prepareOwnedNamespacePlan({ case_id: "source-case-01", nonce: NONCE, root: ROOT });
const flush = async () => { for (let n = 0; n < 24; n++) await Promise.resolve(); };
const currentWorker = () => children.find(c => c.kind === "W")?.child;
const currentStart = () => children.find(c => c.kind === "start")?.child;
function workerFrame(type) {
  return { type, case_id: "source-case-01", nonce: NONCE, source_sha256: namespacePlanEvidence(plan()).source_sha256 };
}
async function respond(c, text, code = 0, signal = null) {
  if (text) c.child.stdout.emit("data", Buffer.from(text));
  c.closed = true; c.child.close(code, signal);
  await flush();
}
async function drain(stop = () => false) {
  for (let n = 0; n < 80; n++) {
    await flush();
    if (stop()) return;
    const c = children.find(r => !r.closed && !r.hold && !["W", "S", "start"].includes(r.kind));
    if (!c) return;
    if (c.kind === "info") await respond(c, JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    else if (c.kind === "create") await respond(c, CID + "\n");
    else if (c.kind === "inspect") await respond(c, JSON.stringify(ownedNamespaceExpectedProjection(plan(), CID, containerState)) + "\n");
    else if (c.kind === "stop") { containerState = "exited"; await respond(c, CID + "\n"); }
    else if (c.kind === "wait") await respond(c, "0\n");
    else if (c.kind === "rm") await respond(c, CID + "\n");
    else throw Error("UNEXPECTED_MOCK_COMMAND:" + c.kind);
  }
  throw Error("MOCK_DRIVER_BOUND");
}
async function pendingStart(control = "normal") {
  const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest(control));
  await drain(() => !!currentWorker());
  const w = currentWorker();
  w.emit("message", workerFrame("READY")); w.emit("message", workerFrame("REQUEST_START"));
  await drain(() => !!currentStart());
  return { h, worker: w, start: currentStart() };
}
async function arm(s) {
  s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
  await flush();
  s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "ARMED", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); process.removeAllListeners();
  metadata = installSourceFixtureFs(); clock(100); children = []; containerState = "created";
  process.env = { AIRLOCK_ROLE: "S" }; process.connected = true; process.argv = []; process.exitCode = undefined;
  process.send.mockImplementation((_m, callback) => callback?.());
  process.disconnect.mockImplementation(() => { process.connected = false; process.emit("disconnect"); });
  requireOwnedNamespaceRuntimeAdmission.mockImplementation(() => {});
  spawn.mockImplementation((executable, argv, options) => {
    events.push({ type: "spawn", executable, argv, options });
    const child = fakeChild();
    const kind = executable === "/usr/local/bin/docker" ? argv[4]
      : argv[0].endsWith("namespace-worker.mjs") ? "W" : "S";
    children.push({ child, kind, argv, options, closed: false });
    return child;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("actual fixed S branch durably owns its first daemon client before spawning, not a command-description proxy", async () => {
  await startOwnedNamespaceSupervisor(makeSupervisorRequest());
  expect(spawn).toHaveBeenCalledOnce();
  expect(spawn.mock.calls[0][0]).toBe("/usr/local/bin/docker");
  expect(files.has(ROOT + "/s-owner.json")).toBe(true);
  const publication = events.findIndex(e => e.type === "publish" && e.path === ROOT + "/s-op-1-registered.json");
  const issuance = events.findIndex(e => e.type === "spawn");
  expect(publication).toBeGreaterThan(-1);
  expect(publication).toBeLessThan(issuance);
});

describe("actual fixed S/CLI implementation with all OS boundaries mocked", () => {
  it("binds and fsyncs returned CID/configuration before instantiating its fixed W process", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await drain(() => !!currentWorker());
    const state = namespaceActorSnapshot(h), worker = children.find(c => c.kind === "W");
    expect(state.cid).toBe(CID); expect(state.custody_durable).toBe(true);
    expect(worker.options).toMatchObject({ stdio: ["ignore", "pipe", "pipe", "ipc"], shell: false });
    expect(worker.options.env).toEqual({ HOME: ROOT + "/empty-home", PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_ROLE: "W" });
    const workerIndex = events.findIndex(e => e.type === "spawn" && e.argv[0].endsWith("namespace-worker.mjs"));
    const custodyIndex = events.findIndex(e => e.type === "publish" && /s-custody-1\.json$/.test(e.path));
    const registrationIndex = events.findIndex(e => e.type === "publish" && /s-worker-registered\.json$/.test(e.path));
    expect(custodyIndex).toBeLessThan(workerIndex); expect(registrationIndex).toBeLessThan(workerIndex);
    expect(children.some(c => c.kind === "start")).toBe(false);
  });
  it("normal actual S branch owns CLI, ARM/WORK writes, stop/wait/rm and stream closure through publication", async () => {
    const s = await pendingStart();
    await arm(s);
    expect(s.start.stdin.write).toHaveBeenCalledTimes(1);
    const permit = JSON.parse(s.start.stdin.write.mock.calls[0][0]);
    expect(permit).toMatchObject({ type: "ARM", tau0_ms: 9000000, work_remaining_ms: Math.floor((35100 - 100) * 0.99 - 100) });
    s.worker.emit("message", workerFrame("REQUEST_WORK")); await flush();
    expect(JSON.parse(s.start.stdin.write.mock.calls[1][0]).type).toBe("WORK");
    s.start.stdout.emit("data", Buffer.from('{"type":"PAYLOAD_CLOSE_CANDIDATE","code":0,"signal":null,"stream_close_observed":true}\n'));
    await flush();
    await respond(children.find(c => c.child === s.start), "", 0);
    await drain();
    expect(s.worker.send.mock.calls.some(([m]) => m.type === "FINISH")).toBe(true);
    s.worker.close(0, null); await flush();
    const done = await namespaceActorCompletion(s.h);
    expect(done).toMatchObject({ qualified: false, disposition: "UNQUALIFIED_ACTOR_CANDIDATE" });
    expect(done.ledger.operations.every(o => o.owner === "S" && o.daemon === "SETTLED" && o.streams_settled)).toBe(true);
    expect(children.some(c => c.kind === "wait")).toBe(true); expect(children.some(c => c.kind === "rm")).toBe(true);
    expect(children.every(c => c.child.kill.mock.calls.length === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("W loss before init keeps the actual pending start client owned, stops exact CID, and never ARM/WORK", async () => {
    const s = await pendingStart("worker-loss-before-init");
    s.worker.disconnect(); s.worker.close(2, null); await flush();
    await drain();
    let state = namespaceActorSnapshot(s.h);
    expect(state.worker_loss_phase).toBe("pending-start-before-init");
    expect(state.operations.find(o => o.kind === "start")).toMatchObject({ daemon: "PENDING", client_closed: false, owner: "S" });
    expect(children.filter(c => c.kind === "stop")).toHaveLength(1);
    expect(children.some(c => c.kind === "rm")).toBe(false);
    expect(s.start.stdin.write).not.toHaveBeenCalled();
    // A late init may appear after the first stop. W is gone; no permit is
    // issued, and S still owns the original start and its continuation.
    containerState = "running";
    s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 1234567 }) + "\n"));
    await flush();
    expect(s.start.stdin.write).not.toHaveBeenCalled();
    await respond(children.find(c => c.child === s.start), "", 0);
    await drain(); state = namespaceActorSnapshot(s.h);
    expect(children.filter(c => c.kind === "stop")).toHaveLength(2);
    expect(state.operations.find(o => o.kind === "stop-after-late-start")).toMatchObject({ owner: "S", daemon: "SETTLED" });
    expect((await namespaceActorCompletion(s.h)).qualified).toBe(false);
  });
  it("W loss after ARM leaves the real start client under S and blocks one-use WORK", async () => {
    const s = await pendingStart("worker-loss-after-arm"); await arm(s);
    expect(namespaceActorSnapshot(s.h).armed).toBe(true);
    s.worker.disconnect(); s.worker.close(2, null); await flush(); await drain();
    expect(namespaceActorSnapshot(s.h).worker_loss_phase).toBe("after-arm");
    expect(s.start.stdin.write.mock.calls.map(([m]) => JSON.parse(m).type)).toEqual(["ARM"]);
    await respond(children.find(c => c.child === s.start), "", 0); await drain();
    expect((await namespaceActorCompletion(s.h)).qualified).toBe(false);
  });
  it("CLI loss is not cancellation; S keeps sticky UNKNOWN and never removes or claims whole-command close", async () => {
    const s = await pendingStart("worker-loss-before-init");
    s.worker.disconnect(); s.worker.close(2, null);
    await respond(children.find(c => c.child === s.start), "", null, "SIGTERM");
    await drain();
    const state = namespaceActorSnapshot(s.h);
    expect(state.operations.find(o => o.kind === "start")).toMatchObject({ daemon: "UNKNOWN", signal: "SIGTERM", owner: "S" });
    expect(children.some(c => c.kind === "rm")).toBe(false);
    let completed = false; namespaceActorCompletion(s.h).then(() => { completed = true; });
    clock(45100); await vi.advanceTimersByTimeAsync(45000);
    expect(completed).toBe(false); expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(children.every(c => !c.child.kill.mock.calls.length)).toBe(true);
  });
  it("unsettled daemon/stream closure does not become qualified when the original total fence expires", async () => {
    const s = await pendingStart();
    s.worker.disconnect(); s.worker.close(2, null); await drain();
    clock(45101); await vi.advanceTimersByTimeAsync(45001);
    expect(namespaceActorSnapshot(s.h).errors).toContain("original_total_fence_expired_with_unsettled_resources");
    expect(namespaceActorSnapshot(s.h).operations.find(o => o.kind === "start").daemon).toBe("PENDING");
    expect(files.has(ROOT + "/case/actor-result.json")).toBe(false);
    expect(children.some(c => c.kind === "rm")).toBe(false);
  });
  it("refuses W forgery/extra fields without issuing start or any foreign query", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await drain(() => !!currentWorker());
    currentWorker().emit("message", { ...workerFrame("REQUEST_START"), program: "/bin/sh" });
    await flush(); await drain();
    expect(children.some(c => c.kind === "start")).toBe(false);
    expect(namespaceActorSnapshot(h).errors.length).toBeGreaterThan(0);
    expect(children.filter(c => c.kind === "inspect").every(c => c.argv.at(-1) === CID)).toBe(true);
  });
  it("source/runtime admission remains before every actual spawn path, not a positive JSON boolean", async () => {
    const locator = makeSupervisorRequest();
    requireOwnedNamespaceRuntimeAdmission.mockImplementation(() => { throw Error("EXACT_CLOCK_CONTRACT_MISSING"); });
    await expect(startOwnedNamespaceSupervisor(locator)).rejects.toThrow("EXACT_CLOCK_CONTRACT_MISSING");
    expect(spawn).not.toHaveBeenCalled();
    expect(() => namespaceActorSnapshot({ owner: "S", prepared: true })).toThrow("private_namespace_S_actor");
  });
  it("actual S refuses CLI spawn when its pending-operation registration cannot be durably synced", async () => {
    const sync = fs.fsyncSync.getMockImplementation();
    fs.fsyncSync.mockImplementation(fd => {
      if (descriptors.get(fd)?.endsWith("/s-op-1-registered.json.staging")) throw Error("SIMULATED_OPERATION_FSYNC_FAILURE");
      return sync(fd);
    });
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await flush();
    expect(spawn).not.toHaveBeenCalled();
    expect(namespaceActorSnapshot(h).errors.some(e => e.includes("SIMULATED_OPERATION_FSYNC_FAILURE"))).toBe(true);
    expect(namespaceActorSnapshot(h).operations[0]).toMatchObject({ owner: "S", daemon: "PENDING", issued_ms: null });
  });
  it.each(["source", "client", "config"])("F1 registration-time %s replacement must prevent actual spawn", async kind => {
    const source = namespacePlanEvidence(plan()).prepared_identity.sources[0].path;
    const sync = fs.fsyncSync.getMockImplementation();
    let replaced = false;
    fs.fsyncSync.mockImplementation(fd => {
      const result = sync(fd);
      if (!replaced && descriptors.get(fd)?.endsWith("/s-op-1-registered.json.staging")) {
        replaced = true;
        if (kind === "source") put(source, "REPLACED_DURING_PUBLICATION", 0o100644);
        else if (kind === "client") put("/source-fixture/docker", "REPLACED_DURING_PUBLICATION", 0o100755);
        else put(ROOT + "/docker-config/config.json", "{} ");
      }
      return result;
    });
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await flush();
    expect(replaced).toBe(true);
    expect(spawn).not.toHaveBeenCalled();
    expect(namespaceActorSnapshot(h).operations[0].issued_ms).toBe(null);
  });
  it("F1 source replacement during W registration cannot invoke stale W bytes", async () => {
    const source = namespacePlanEvidence(plan()).prepared_identity.sources[0].path, sync = fs.fsyncSync.getMockImplementation();
    let replaced = false;
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (!replaced && descriptors.get(fd)?.endsWith("/s-worker-registered.json.staging")) {
        replaced = true; put(source, "REPLACED_WHILE_REGISTERING_W", 0o100644);
      }
      return value;
    });
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await drain();
    expect(replaced).toBe(true);
    expect(children.some(c => c.kind === "W")).toBe(false);
    expect(namespaceActorSnapshot(h).errors.some(e => e.includes("namespace_source_changed"))).toBe(true);
  });
  it("F1 private config replacement during P registration cannot invoke stale S custody", () => {
    const sync = fs.fsyncSync.getMockImplementation();
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (descriptors.get(fd)?.endsWith("/p-owner.json.staging")) put(ROOT + "/docker-config/config.json", "{} ");
      return value;
    });
    expect(() => launchOwnedNamespaceCase(["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"]))
      .toThrow("namespace_source_changed");
    expect(spawn).not.toHaveBeenCalled();
  });
  it.each(["malformed", "not-found"])("F2 failed %s recovery must retain late-create cleanup inside the original budget", async failure => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await respond(children[0], JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    const create = children.find(c => c.kind === "create");
    create.hold = true;
    clock(35100); await vi.advanceTimersByTimeAsync(35000);
    await drain(() => children.some(c => c.kind === "inspect"));
    const recovery = children.find(c => c.kind === "inspect");
    expect(recovery.argv.at(-1)).toBe("airlock-owned-source-case-01");
    if (failure === "malformed") await respond(recovery, "{}\n");
    else {
      recovery.child.stderr.emit("data", Buffer.from("Error: No such container: airlock-owned-source-case-01\n"));
      await respond(recovery, "", 1);
    }
    await drain();
    expect(namespaceActorSnapshot(h).operations.find(o => o.kind === "create").daemon).toBe("PENDING");
    expect(namespaceActorSnapshot(h).cid).toBe(null);
    await respond(create, CID + "\n"); await drain();
    const state = namespaceActorSnapshot(h);
    expect(state.cid).toBe(CID);
    expect(state.original_total_deadline_ms).toBe(45100);
    expect(children.filter(c => c.kind === "inspect" && c.argv.at(-1) === "airlock-owned-source-case-01")).toHaveLength(1);
    expect(children.filter(c => c.kind === "inspect").every(c => [CID, "airlock-owned-source-case-01"].includes(c.argv.at(-1)))).toBe(true);
    expect(children.some(c => c.kind === "rm")).toBe(true);
    expect(children.some(c => c.kind === "start" || c.kind === "W")).toBe(false);
    const done = await namespaceActorCompletion(h);
    expect(done.qualified).toBe(false); expect(done.disposition).toBe("UNKNOWN");
  });
  it("F2 creation later than the original fence remains UNKNOWN with no renewed cleanup operation", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await respond(children[0], JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    const create = children.find(c => c.kind === "create");
    create.hold = true;
    clock(35100); await vi.advanceTimersByTimeAsync(35000);
    await drain(() => children.some(c => c.kind === "inspect"));
    await respond(children.find(c => c.kind === "inspect"), "{}\n"); await drain();
    const issued = children.length;
    clock(45101); await respond(create, CID + "\n"); await drain();
    expect(children).toHaveLength(issued);
    const s = namespaceActorSnapshot(h);
    expect(s.original_total_deadline_ms).toBe(45100);
    expect(s.operations.find(o => o.kind === "create")).toMatchObject({ daemon: "UNKNOWN", stdout: CID + "\n" });
    expect(children.some(c => c.kind === "rm" || c.kind === "start")).toBe(false);
  });
  it("lost create response allows only one preissued-name full-custody recovery and never starts", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await respond(children[0], JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    const create = children.find(c => c.kind === "create");
    await respond(create, "", null, "SIGPIPE"); await drain();
    const state = namespaceActorSnapshot(h), queries = children.filter(c => c.kind === "inspect");
    expect(queries[0].argv.at(-1)).toBe("airlock-owned-source-case-01");
    expect(queries.filter(c => c.argv.at(-1) === "airlock-owned-source-case-01")).toHaveLength(1);
    expect(state.cid).toBe(CID); expect(state.custody_durable).toBe(true);
    expect(state.operations.find(o => o.kind === "create").daemon).toBe("UNKNOWN");
    expect(children.some(c => c.kind === "start" || c.kind === "rm")).toBe(false);
  });
  it("foreign exact-name recovery never adopts, queries by foreign ID, starts, stops or removes it", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await respond(children[0], JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    await respond(children.find(c => c.kind === "create"), "", null, "SIGPIPE");
    await drain(() => children.some(c => c.kind === "inspect"));
    const query = children.find(c => c.kind === "inspect"), projection = ownedNamespaceExpectedProjection(plan(), "f".repeat(64));
    projection.Nonce = "b".repeat(64);
    await respond(query, JSON.stringify(projection) + "\n"); await drain();
    expect(namespaceActorSnapshot(h).cid).toBe(null);
    expect(children.filter(c => c.kind === "inspect")).toHaveLength(1);
    expect(children.some(c => ["start", "stop", "rm"].includes(c.kind))).toBe(false);
  });
  it("actual engine identity change blocks W/start and retains UNKNOWN instead of trusting matching marker files", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await respond(children[0], JSON.stringify(metadata.adapter_contract.engine_info) + "\n");
    await respond(children.find(c => c.kind === "create"), CID + "\n");
    metadata.adapter_contract.engine_info.ID = "FOREIGN_ENGINE";
    await drain();
    expect(children.some(c => c.kind === "W" || c.kind === "start")).toBe(false);
    expect(namespaceActorSnapshot(h).errors.some(e => e.includes("namespace_engine_changed"))).toBe(true);
    expect(children.some(c => c.kind === "stop" || c.kind === "rm")).toBe(false);
  });
  it("missing actual stdout EOF remains UNKNOWN even when the CLI child emits close(0)", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    const c = children[0]; c.child.stdout.emit("data", Buffer.from(JSON.stringify(metadata.adapter_contract.engine_info) + "\n"));
    c.child.emit("close", 0, null); await flush();
    expect(namespaceActorSnapshot(h).operations[0]).toMatchObject({ daemon: "UNKNOWN", client_closed: true });
    expect(namespaceActorSnapshot(h).operations[0].errors).toContain("stream_closed_without_complete_EOF");
    expect(children.some(c => c.kind === "create")).toBe(false);
  });
  it("actual S rechecks the original work fence AFTER durable ARM publication and sends no late bytes", async () => {
    const s = await pendingStart(), sync = fs.fsyncSync.getMockImplementation();
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (descriptors.get(fd)?.endsWith("/s-permit-1-registered.json.staging")) clock(35100);
      return value;
    });
    s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
    await flush();
    expect(s.start.stdin.write).not.toHaveBeenCalled();
    expect(namespaceActorSnapshot(s.h).errors).toContain("namespace_original_deadline_expired");
    expect(namespaceActorSnapshot(s.h).operations.find(o => o.kind === "start").owner).toBe("S");
  });
  it.each(["ARM-source", "ARM-client", "ARM-config", "WORK-source", "WORK-client", "WORK-config"])(
    "R1 publication-time %s replacement must prevent the actual continuation write", async change => {
      const [kind, target] = change.split("-");
      const s = await pendingStart(), source = namespacePlanEvidence(plan()).prepared_identity.sources[0].path;
      if (kind === "WORK") await arm(s);
      const sync = fs.fsyncSync.getMockImplementation(), id = kind === "ARM" ? 1 : 2;
      let replaced = false;
      fs.fsyncSync.mockImplementation(fd => {
        const value = sync(fd);
        if (!replaced && descriptors.get(fd)?.endsWith("/s-permit-" + id + "-registered.json.staging")) {
          replaced = true;
          if (target === "source") put(source, "REPLACED_DURING_PERMIT_PUBLICATION", 0o100644);
          else if (target === "client") put("/source-fixture/docker", "REPLACED_DURING_PERMIT_PUBLICATION", 0o100755);
          else put(ROOT + "/docker-config/config.json", "{} ");
        }
        return value;
      });
      if (kind === "ARM") s.start.stdout.emit("data", Buffer.from(JSON.stringify({
        type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000,
      }) + "\n"));
      else s.worker.emit("message", workerFrame("REQUEST_WORK"));
      await flush();
      expect(replaced).toBe(true);
      expect(s.start.stdin.write).toHaveBeenCalledTimes(kind === "ARM" ? 0 : 1);
      expect(namespaceActorSnapshot(s.h).continuations.at(-1)).toMatchObject({
        kind, owner: "S", issued_ms: null, settled: false,
      });
    });
  it("R1 ARMED worker notification rechecks custody after ARM settlement publication", async () => {
    const s = await pendingStart(), sync = fs.fsyncSync.getMockImplementation();
    let replaced = false;
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (!replaced && descriptors.get(fd)?.endsWith("/s-permit-1-settled.json.staging")) {
        replaced = true; put(ROOT + "/docker-config/config.json", "{} ");
      }
      return value;
    });
    await arm(s);
    expect(replaced).toBe(true);
    expect(s.start.stdin.write).toHaveBeenCalledTimes(1); // Already-issued ARM is not revoked.
    expect(s.worker.send.mock.calls.some(([m]) => m.type === "ARMED")).toBe(false);
  });
  it("R1 W spawn rechecks abort state after blocking worker registration", async () => {
    const sync = fs.fsyncSync.getMockImplementation();
    let lost = false;
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (!lost && descriptors.get(fd)?.endsWith("/s-worker-registered.json.staging")) {
        lost = true; process.emit("disconnect");
      }
      return value;
    });
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest());
    await drain();
    expect(lost).toBe(true);
    expect(children.some(c => c.kind === "W")).toBe(false);
    expect(namespaceActorSnapshot(h).aborted).toBe(true);
  });
  it("W loss during actual ARM registration cannot transfer the continuation or issue an ARM afterward", async () => {
    const s = await pendingStart("normal"), sync = fs.fsyncSync.getMockImplementation();
    let lost = false;
    fs.fsyncSync.mockImplementation(fd => {
      const value = sync(fd);
      if (!lost && descriptors.get(fd)?.endsWith("/s-permit-1-registered.json.staging")) {
        lost = true; s.worker.disconnect(); s.worker.close(2, null);
      }
      return value;
    });
    s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
    await flush();
    expect(lost).toBe(true); expect(s.start.stdin.write).not.toHaveBeenCalled();
    expect(namespaceActorSnapshot(s.h).continuations[0]).toMatchObject({ owner: "S", issued_ms: null, settled: false });
  });
  it("an unsettled actual stdin callback is owned by S through client close and cannot be reported settled", async () => {
    const s = await pendingStart("worker-loss-after-arm"), callbacks = [];
    s.start.stdin.write.mockImplementation((_bytes, callback) => { callbacks.push(callback); return true; });
    s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
    await flush();
    s.worker.disconnect(); s.worker.close(2, null); await drain();
    await respond(children.find(c => c.child === s.start), "", 0);
    expect(namespaceActorSnapshot(s.h).operations.find(o => o.kind === "start").daemon).toBe("PENDING");
    expect(namespaceActorSnapshot(s.h).continuations[0].settled).toBe(false);
    expect(children.some(c => c.kind === "rm")).toBe(false);
    callbacks[0](Error("SIMULATED_CONTROL_WRITE_FAILURE")); await flush(); await drain();
    expect(namespaceActorSnapshot(s.h).operations.find(o => o.kind === "start").daemon).toBe("UNKNOWN");
    expect(namespaceActorSnapshot(s.h).continuations[0]).toMatchObject({ settled: true, error: "SIMULATED_CONTROL_WRITE_FAILURE" });
  });
  it("a preinit control whose HELLO wins the race cannot arm or claim the required before-init loss witness", async () => {
    const s = await pendingStart("worker-loss-before-init");
    s.start.stdout.emit("data", Buffer.from(JSON.stringify({ type: "HELLO", case_id: "source-case-01", nonce: NONCE, tau0_ms: 9000000 }) + "\n"));
    await flush();
    expect(s.start.stdin.write).not.toHaveBeenCalled();
    expect(namespaceActorSnapshot(s.h).errors).toContain("preinit_loss_control_missed_before_HELLO");
  });
  it("W loss before any start request removes only the owned never-started object, without wait(created)", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest("worker-loss-before-init"));
    await drain(() => !!currentWorker());
    currentWorker().disconnect(); currentWorker().close(2, null); await flush(); await drain();
    const done = await namespaceActorCompletion(h);
    expect(done.qualified).toBe(false);
    expect(done.ledger.worker_loss_phase).toBe("before-arm");
    expect(done.disposition).toBe("UNKNOWN");
    expect(children.some(c => ["start", "stop", "wait"].includes(c.kind))).toBe(false);
    expect(children.some(c => c.kind === "rm")).toBe(true);
  });
  it("W loss during a pre-start inspection keeps its query continuation in S until exact cleanup can proceed", async () => {
    const h = await startOwnedNamespaceSupervisor(makeSupervisorRequest("worker-loss-before-init"));
    await drain(() => !!currentWorker());
    currentWorker().emit("message", workerFrame("READY"));
    currentWorker().emit("message", workerFrame("REQUEST_START"));
    await flush();
    currentWorker().disconnect(); currentWorker().close(2, null);
    await drain();
    const done = await namespaceActorCompletion(h);
    expect(done.qualified).toBe(false);
    expect(done.ledger.operations.every(o => o.owner === "S" && o.daemon === "SETTLED")).toBe(true);
    expect(children.some(c => c.kind === "start")).toBe(false);
    expect(children.some(c => c.kind === "rm")).toBe(true);
  });
});

describe("closed Docker inspect normalization", () => {
  it("projects only selected safe fields; full Env and host paths are never dumped", () => {
    const p = plan(), template = ownedNamespaceInspectionTemplate(p);
    expect(template).toContain("EnvMatches");
    expect(template).not.toContain('"Env":{{json .Config.Env}}');
    expect(template).not.toContain('"Binds":{{json .HostConfig.Binds}}');
    expect(template).not.toContain(".State.Pid");
    expect(normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(ownedNamespaceExpectedProjection(p, CID))), CID).cid).toBe(CID);
  });
  it.each(["Image", "Nonce", "Source", "User", "PidMode", "IpcMode", "NetworkMode", "Privileged", "ReadonlyRootfs",
    "EnvMatches", "BindsEmpty", "MountsMatch", "CapDropMatches", "SecurityOptMatches", "Memory", "Init"])(
    "rejects foreign/changed %s before actuation", key => {
      const p = plan(), projection = ownedNamespaceExpectedProjection(p, CID);
      projection[key] = typeof projection[key] === "boolean" ? !projection[key] : "foreign";
      expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(projection)), CID)).toThrow("namespace_foreign_container");
    });
  it("rejects foreign CID, duplicate/truncated records, unknown fields and invalid state", () => {
    const p = plan(), projection = ownedNamespaceExpectedProjection(p, CID);
    expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(projection)), "f".repeat(64))).toThrow();
    expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from('{"Id":'), CID)).toThrow();
    expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from('{"Id":"a","Id":"b"}'), CID)).toThrow();
    projection.Foreign = true;
    expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(projection)), CID)).toThrow();
    delete projection.Foreign; projection.State.Status = "paused";
    expect(() => normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(projection)), CID)).toThrow("namespace_container_state_UNKNOWN");
  });
});

describe("actual P/S actor construction and strict direct worker entry", () => {
  it("P creates its durable original request and launches ONLY fixed S with private closed env", () => {
    launchOwnedNamespaceCase(["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"]);
    expect(children).toHaveLength(1); expect(children[0].kind).toBe("S");
    expect(children[0].options.env).toEqual({ HOME: ROOT + "/empty-home", PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_ROLE: "S" });
    const pub = events.findIndex(e => e.type === "publish" && e.path.endsWith("/p-owner.json"));
    const start = events.findIndex(e => e.type === "spawn");
    expect(pub).toBeLessThan(start);
    expect(children[0].argv[0]).toMatch(/sdk-absent-owned-namespace-actors\.mjs$/);
  });
  it("P records S loss, never treats W-loss coverage as S-loss qualification or transfers Docker ownership", async () => {
    const pending = launchOwnedNamespaceCase(["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"]);
    children[0].child.close(2, null);
    const result = await pending;
    expect(result.errors).toContain("S_loss_or_failed_close_not_W_loss_coverage");
    expect(result.errors).toContain("S_closed_without_owned_resource_result");
    expect(result.qualified).toBe(false); expect(result.external_whole_command_completion_required).toBe(true);
    expect(children).toHaveLength(1); expect(children[0].child.kill).not.toHaveBeenCalled();
  });
  it("P timeout does not kill its owned S or claim whole-command completion", async () => {
    const pending = launchOwnedNamespaceCase(["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"]);
    let resolved = false; pending.then(() => { resolved = true; });
    clock(45100); await vi.advanceTimersByTimeAsync(45000);
    expect(resolved).toBe(false); expect(children[0].child.kill).not.toHaveBeenCalled();
    expect(files.has(ROOT + "/p-timeout.json")).toBe(true);
  });
  it.each([
    ["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal", "--image=foreign"],
    ["--worker", "source-case-01", NONCE, ROOT, "normal"],
    ["--fixed-namespace-case", "source-case-01", NONCE, ROOT + "/../foreign", "normal"],
    ["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "foreign"],
  ])("strict public entry refuses extra/foreign argv %j", (...args) => {
    expect(() => parseOwnedNamespacePublicArgv(args)).toThrow("namespace_fixed_public_arguments");
    expect(spawn).not.toHaveBeenCalled();
  });
  it("direct worker needs its owned IPC channel and a genuine immutable S authority, never prepared:true", () => {
    process.env = { AIRLOCK_ROLE: "W" }; process.connected = false;
    expect(() => startOwnedNamespaceWorker({ prepared: true })).toThrow("namespace_direct_worker_refused");
    expect(spawn).not.toHaveBeenCalled();
  });
  it("direct S entry without its fixed role/IPC channel is refused before files, clients or W", async () => {
    process.env = { AIRLOCK_ROLE: "W" };
    await expect(startOwnedNamespaceSupervisor({ prepared: true })).rejects.toThrow("namespace_direct_S_entry_refused");
    expect(spawn).not.toHaveBeenCalled();
  });
  it.each(["normal", "worker-loss-before-init", "worker-loss-after-arm"])(
    "fixed W executes only its %s request protocol, not Docker or a supplied program", control => {
      const locator = makeSupervisorRequest(control), request = JSON.parse(files.get(locator.request_path).bytes);
      const p = plan(), evidence = namespacePlanEvidence(p);
      const authority = { schema: "airlock.owned-namespace-worker-authority.v2", request,
        request_file: fixedRead(locator.request_path).handle, source_sha256: evidence.source_sha256, owner: "S", cid: CID,
        custody: normalizeOwnedNamespaceInspection(p, Buffer.from(JSON.stringify(ownedNamespaceExpectedProjection(p, CID))), CID) };
      const path = ROOT + "/worker-authority.json", bytes = Buffer.from(JSON.stringify(authority));
      put(path, bytes); process.env = { AIRLOCK_ROLE: "W" };
      startOwnedNamespaceWorker({ authority_path: path, authority_sha256: bytesHash(bytes) });
      expect(process.send.mock.calls.map(([m]) => m.type)).toEqual(["READY", "REQUEST_START"]);
      if (control === "worker-loss-before-init") {
        expect(process.disconnect).not.toHaveBeenCalled();
        process.emit("message", workerFrame("START_ISSUED"));
        expect(process.disconnect).toHaveBeenCalledOnce();
      }
      else {
        process.emit("message", workerFrame("ARMED"));
        if (control === "worker-loss-after-arm") expect(process.disconnect).toHaveBeenCalledOnce();
        else expect(process.send.mock.calls.at(-1)[0].type).toBe("REQUEST_WORK");
      }
      expect(spawn).not.toHaveBeenCalled();
    });
});
