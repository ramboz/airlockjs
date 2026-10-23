import { vi } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { OWNED_NAMESPACE_SOURCES, namespacePlanEvidence, prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";

export const ROOT = "/source-fixture/owned-namespace";
export const CID = "c".repeat(64), NONCE = "a".repeat(64);
export const bytesHash = bytes => createHash("sha256").update(bytes).digest("hex");
export const files = new Map(), descriptors = new Map(), events = [];
const openedObjects = new Map(), pendingSync = new Map();
let ino = 1, fd = 10;
export function put(path, bytes, mode = 0o100600) {
  bytes = Buffer.from(bytes);
  files.set(path, { bytes, dev: 1, ino: ++ino, size: bytes.length, nlink: 1, uid: 501, mode, mtimeMs: 100, ctimeMs: 100,
    isFile: () => (mode & 0o170000) === 0o100000, isDirectory: () => (mode & 0o170000) === 0o040000,
    isSymbolicLink: () => false, isSocket: () => (mode & 0o170000) === 0o140000 });
}
export function installSourceFixtureFs() {
  files.clear(); descriptors.clear(); openedObjects.clear(); pendingSync.clear(); events.length = 0; ino = 1; fd = 10;
  fs.openSync.mockImplementation((path, flags) => {
    if (flags === "wx") { if (files.has(path)) throw Error("EEXIST"); put(path, ""); }
    if (!files.has(path)) throw Error("MOCK_FILE_MISSING:" + path);
    descriptors.set(++fd, path); openedObjects.set(fd, files.get(path)); return fd;
  });
  fs.lstatSync.mockImplementation(path => ({ ...files.get(path) }));
  fs.fstatSync.mockImplementation(n => ({ ...openedObjects.get(n) }));
  fs.readFileSync.mockImplementation(n => {
    if (!descriptors.has(n)) throw Error("MOCK_UNOPENED_READ");
    return Buffer.from(openedObjects.get(n).bytes);
  });
  fs.writeSync.mockImplementation((n, bytes, offset, length) => {
    const f = openedObjects.get(n);
    f.bytes = Buffer.concat([f.bytes, Buffer.from(bytes).subarray(offset, offset + length)]);
    f.size = f.bytes.length; return length;
  });
  fs.closeSync.mockImplementation(n => { descriptors.delete(n); openedObjects.delete(n); });
  fs.fsyncSync.mockImplementation(n => {
    const path = descriptors.get(n), row = openedObjects.get(n);
    events.push({ type: "fsync", path });
    if (row.isFile()) pendingSync.set(path.slice(0, path.lastIndexOf("/")), path);
    else if (pendingSync.has(path)) {
      // This is the directory-durability frontier, not an ACK/permit.
      events.push({ type: "publish", path: pendingSync.get(path) }); pendingSync.delete(path);
    }
  });
  fs.linkSync.mockImplementation((from, to) => {
    if (files.has(to)) throw Error("EEXIST");
    files.get(from).nlink++; files.set(to, files.get(from));
  });
  fs.unlinkSync.mockImplementation(path => { files.get(path).nlink--; files.delete(path); });
  fs.realpathSync.mockImplementation(path => path === "/usr/local/bin/docker" ? "/source-fixture/docker" : path);
  for (const path of [ROOT, ROOT + "/case", ROOT + "/docker-config", ROOT + "/empty-home"]) put(path, "", 0o040700);
  put(ROOT + "/docker-config/config.json", "{}\n");
  put("/source-fixture/docker", "SIMULATED_FIXED_DOCKER", 0o100755);
  put("/var/run/docker.sock", "", 0o140600);
  const sources = OWNED_NAMESPACE_SOURCES.map(path => {
    const bytes = "SOURCE_FIXTURE:" + path; put(path, bytes, 0o100644);
    return { path, sha256: bytesHash(bytes) };
  });
  const metadata = {
    schema: "airlock.owned-namespace-cohort.v1", status: "PREPARED_SOURCE_MODEL_ONLY",
    endpoint: "unix:///var/run/docker.sock", engine_id: "SIMULATED_ENGINE",
    endpoint_original: { path: "/var/run/docker.sock", dev: 1, ino: files.get("/var/run/docker.sock").ino,
      uid: 501, mode: 0o140600, mtime_ms: 100, ctime_ms: 100 },
    client_realpath: "/source-fixture/docker", client_sha256: bytesHash("SIMULATED_FIXED_DOCKER"),
    image_id: "sha256:" + "d".repeat(64), platform: "linux/arm64/v8", node_version: "24.10.0",
    base_digest: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
    root_uid: 501, sources, clock: {
      schema: "airlock.owned-namespace-clock-bounds.v1", status: "SIMULATED_NOT_PROVEN",
      minimum_init_ticks_per_supervisor_tick: 0.99, maximum_init_ticks_per_supervisor_tick: 1.01,
      conservative_margin_ms: 100, evidence_sha256: "e".repeat(64),
    },
    adapter_contract: {
      schema: "airlock.owned-namespace-docker-contract.v2", status: "SIMULATED_NOT_RUNTIME_PROOF",
      engine_info: { ID: "SIMULATED_ENGINE", OSType: "linux", Architecture: "aarch64", ServerVersion: "SIMULATED-version" },
      image_env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"], mounts: [],
    },
  };
  const clockPath = fileURLToPath(new URL("sdk-absent-owned-namespace-clock.json", import.meta.url));
  const clockBytes = JSON.stringify(metadata.clock);
  put(clockPath, clockBytes, 0o100644);
  metadata.sources.find(row => row.path === clockPath).sha256 = bytesHash(clockBytes);
  put(fileURLToPath(new URL("sdk-absent-owned-namespace-cohort.json", import.meta.url)), JSON.stringify(metadata), 0o100644);
  return metadata;
}
export function makeSupervisorRequest(control = "normal") {
  const plan = prepareOwnedNamespacePlan({ case_id: "source-case-01", nonce: NONCE, root: ROOT });
  const evidence = namespacePlanEvidence(plan);
  const value = {
    schema: "airlock.owned-namespace-launch-request.v2", case_id: evidence.case_id, nonce: NONCE, root: ROOT, control,
    clock_domain: "NODE_HOST_HRTIME_MONOTONIC",
    started_monotonic_ms: 100, work_deadline_ms: 35100, total_deadline_ms: 45100,
    source_sha256: evidence.source_sha256, cohort_sha256: evidence.cohort_sha256,
  };
  const path = ROOT + "/launch-request.json", bytes = Buffer.from(JSON.stringify(value));
  put(path, bytes);
  return { request_path: path, request_sha256: bytesHash(bytes) };
}
export function clock(ms) { process.hrtime.bigint.mockReturnValue(BigInt(ms) * 1000000n); }
export function fakeStream() {
  const s = new EventEmitter();
  s.destroyed = false; s.closed = false;
  s.write = vi.fn((_bytes, callback) => { callback?.(); return true; });
  s.end = vi.fn(() => { s.closed = true; s.emit("close"); });
  s.destroy = vi.fn(() => { s.destroyed = true; s.closed = true; s.emit("close"); });
  return s;
}
export function fakeChild() {
  const child = new EventEmitter();
  child.stdout = fakeStream(); child.stderr = fakeStream(); child.stdin = fakeStream();
  child.connected = true; child.send = vi.fn((_message, callback) => callback?.());
  child.disconnect = vi.fn(() => { child.connected = false; child.emit("disconnect"); });
  child.kill = vi.fn(() => { throw Error("SIGNAL_FORBIDDEN"); });
  child.close = (code = 0, signal = null) => {
    child.stdout.emit("end"); child.stderr.emit("end");
    for (const stream of [child.stdout, child.stderr, child.stdin]) stream.destroy();
    child.emit("close", code, signal);
  };
  child.pid = 111; return child;
}
