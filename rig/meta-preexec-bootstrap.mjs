// First-party synthetic FD candidate ONLY. No browser, native grant or transport.
import { createHash, randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { createServer, connect, Socket } from "node:net";
import { lstatSync, mkdirSync, openSync, closeSync, fsyncSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";

const NODE = "/opt/homebrew/Cellar/node/24.10.0/bin/node";
const ENTRY = fileURLToPath(import.meta.url), SHELL = fileURLToPath(new URL("meta-preexec-bootstrap-launcher", import.meta.url));
const OBSERVER_SOURCE = fileURLToPath(new URL("meta-owned-socket-observer.c", import.meta.url));
const OBSERVER_COHORT = fileURLToPath(new URL("meta-owned-socket-observer.cohort.json", import.meta.url));
const SDK = "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk";
const execute = promisify(execFile), hash = value => createHash("sha256").update(value).digest("hex");
const fail = category => { throw Error(category); }, sleep = ms => new Promise(done => setTimeout(done, ms));
const answer = (allowed, reason) => ({ allowed, reason, native_authority: false });
const lifetime = ["pid", "ppid", "pgid", "uid", "started", "command_sha256"];
const same = (a, b) => !!a && !!b && lifetime.every(key => a[key] === b[key]);
// macOS ps(1) U is a waiting lifetime, not proof of progress or eventual cleanup.
const live = row => row && typeof row.state === "string" && /^[RSIU]/.test(row.state);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const read = path => json(readMetaPrivate(path, 65536));
const pin = path => ({ path, sha256: hash(readMetaPrivate(path, 65536)) });
const identity = path => {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o7777) !== 0o700)
    fail("synthetic_directory_identity");
  return { path, dev: s.dev, ino: s.ino, birthtime_ms: s.birthtimeMs, uid: s.uid, mode: s.mode & 0o7777, synthetic: true };
};
function sync(path) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function createRoot(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) fail("synthetic_output_path");
  for (let p = dirname(path);;) {
    const s = lstatSync(p);
    if (!s.isDirectory() || s.isSymbolicLink()) fail("synthetic_output_path");
    if (p === dirname(path) && (s.uid !== process.getuid() || (s.mode & 0o7777) !== 0o700)) fail("synthetic_output_parent");
    if (p === dirname(p)) break;
    p = dirname(p);
  }
  const repo = fileURLToPath(new URL("../", import.meta.url));
  if (path.startsWith(repo) && !path.startsWith(join(repo, "rig/out") + "/")) fail("synthetic_output_path");
  mkdirSync(path, { mode: 0o700 }); sync(path); sync(dirname(path));
}

export function parseSyntheticBootstrapArgv(value) {
  const v = record(data(value), ["argv", "temporary_root", "issued_argv_sha256"]);
  if (!Array.isArray(v.argv) || v.argv.length !== 3 || !digest(v.issued_argv_sha256)
    || typeof v.temporary_root !== "string" || !isAbsolute(v.temporary_root) || resolve(v.temporary_root) !== v.temporary_root)
    fail("synthetic_arguments");
  const path = join(v.temporary_root, "synthetic-user-data");
  const expected = ["--user-data-dir=" + path, "--remote-debugging-pipe", "--no-startup-window"];
  if (!equal(v.argv, expected) || hash(JSON.stringify(v.argv)) !== v.issued_argv_sha256) fail("synthetic_arguments");
  return { argv: v.argv, fixture_path: path, argv_sha256: v.issued_argv_sha256, synthetic: true, native_authority: false };
}

/** A separate role predicate. The established direct/group-leader peer rule is unchanged. */
export function assessSyntheticBootstrapRoles(value) {
  const v = record(data(value), ["expected", "before", "after", "fixture", "expected_fixture"]);
  for (const rows of [v.expected, v.before, v.after]) {
    record(rows, ["P", "E", "L", "H"]);
    for (const row of Object.values(rows)) {
      record(row, [...lifetime, "state"]);
      if (!["pid", "ppid", "pgid", "uid"].every(k => Number.isSafeInteger(row[k]) && row[k] >= (k === "uid" ? 0 : 1))
        || !digest(row.command_sha256) || typeof row.started !== "string" || !row.started
        || !live(row)) return answer(false, "role_lifetime");
    }
    const { P, E, L, H } = rows;
    if (new Set([P.pid, E.pid, L.pid, H.pid]).size !== 4 || E.ppid !== P.pid || E.pgid !== E.pid
      || L.ppid !== E.pid || L.pgid !== L.pid || H.ppid !== L.pid || H.pgid !== L.pid
      || ![E, L, H].every(r => r.uid === P.uid)) return answer(false, "role_ancestry");
  }
  for (const role of ["P", "E", "L", "H"])
    if (!same(v.expected[role], v.before[role]) || !same(v.before[role], v.after[role])) return answer(false, "role_changed");
  if (!equal(v.fixture, v.expected_fixture) || v.fixture.synthetic !== true || v.fixture.mode !== 0o700
    || v.fixture.uid !== v.expected.P.uid) return answer(false, "fixture_changed");
  return answer(true, "owned_roles");
}

export function assessSyntheticBootstrapPeer(value) {
  const v = record(data(value), ["roles", "hello", "tuple", "kernel", "ticket_sha256"]);
  const { H, L } = v.roles, t = v.tuple;
  if (t.server_address !== "127.0.0.1" || t.client_address !== "127.0.0.1"
    || !["server_port", "client_port"].every(k => Number.isInteger(t[k]) && t[k] > 0 && t[k] < 65536)
    || !digest(v.ticket_sha256) || v.hello.helper_pid !== H.pid || v.hello.launcher_pid !== L.pid
    || v.hello.ticket_sha256 !== v.ticket_sha256) return answer(false, "synthetic_peer_claim");
  const expected = `${t.client_address}:${t.client_port}->${t.server_address}:${t.server_port}`;
  let pid = null;
  const owners = new Set();
  for (const line of v.kernel.split("\n")) {
    if (/^p\d+$/.test(line)) pid = Number(line.slice(1));
    if (line === "n" + expected) owners.add(pid);
  }
  if (owners.size !== 1 || !owners.has(H.pid)) return answer(false, "synthetic_kernel_peer_owner");
  return answer(true, "owned_helper_peer");
}

/** Documented lsof +ff / -FpfFt file-structure identities, NOT numeric FD absence,
 * zero/guessed fstat inodes, or Node private stream fields. Missing OS support is fatal. */
export function parseSyntheticScopedDescriptors(text, ownedPid) {
  const descriptors = [];
  let pid, current;
  for (const line of text.split("\n")) {
    if (/^p\d+$/.test(line)) {
      pid = Number(line.slice(1)); if (pid !== ownedPid) fail("synthetic_descriptor_scope");
    } else if (line.startsWith("f")) {
      current = /^\d+$/.test(line.slice(1)) ? { fd: Number(line.slice(1)), type: null, identity: null } : null;
      if (current) { if (pid !== ownedPid) fail("synthetic_descriptor_scope"); descriptors.push(current); }
    } else if (current && line.startsWith("F")) {
      if (current.identity !== null) fail("synthetic_descriptor_shape");
      current.identity = line.slice(1).toLowerCase();
    } else if (current && line.startsWith("t")) current.type = line.slice(1);
  }
  return descriptors;
}
export function assessSyntheticDebugIsolation(value) {
  const v = record(data(value), ["launcher", "helper"]);
  const identified = row => Number.isSafeInteger(row.fd) && row.fd >= 0
    && typeof row.type === "string" && /^0x[0-9a-f]+$/.test(row.identity) && BigInt(row.identity) !== 0n;
  if (!Array.isArray(v.launcher) || !Array.isArray(v.helper) || v.launcher.length !== 2 || !v.helper.length
    || ![...v.launcher, ...v.helper].every(identified)) return answer(false, "unsupported_debug_handle_identity");
  const [a, b] = [...v.launcher].sort((x, y) => x.fd - y.fd);
  if (a.fd !== 3 || b.fd !== 4 || a.identity === b.identity || ![a, b].every(r => ["unix", "PIPE", "FIFO"].includes(r.type)))
    return answer(false, "unsupported_debug_handle_identity");
  if (v.helper.some(row => row.identity === a.identity || row.identity === b.identity))
    return answer(false, "inherited_debug_handle");
  return answer(true, "specific_debug_handles_absent");
}
function validateSocketInventory(inventory, role, expectedRoles) {
  record(expectedRoles, ["P", "E", "L", "H"]);
  const invalid = () => fail("synthetic_socket_inventory");
  const { P, E, L, H } = expectedRoles;
  if (new Set([P.pid, E.pid, L.pid, H.pid]).size !== 4 || E.ppid !== P.pid || E.pgid !== E.pid
    || L.ppid !== E.pid || L.pgid !== L.pid || H.ppid !== L.pid || H.pgid !== L.pid
    || ![E, L, H].every(r => r.uid === P.uid)) invalid();
    record(inventory, ["schema", "role", "pid", "caller_pid", "complete", "roles_before", "roles_after",
      "inventory_before", "inventory_after", "descriptor_count", "descriptors", "native_authority"]);
    const expected = [P, E, L, H].slice(0, role === "launcher" ? 3 : 4);
    if (inventory.schema !== "airlock.owned-macos-socket-inventory.v1" || inventory.role !== role
      || inventory.pid !== expected.at(-1).pid || inventory.caller_pid !== P.pid
      || inventory.complete !== true || inventory.native_authority !== false
      || !Array.isArray(inventory.roles_before) || inventory.roles_before.length !== expected.length
      || !equal(inventory.roles_before, inventory.roles_after)) invalid();
    for (const [n, row] of inventory.roles_before.entries()) {
      record(row, ["pid", "ppid", "pgid", "uid", "birth_seconds", "birth_microseconds"]);
      if (!["pid", "ppid", "pgid", "uid", "birth_seconds", "birth_microseconds"]
        .every(k => Number.isSafeInteger(row[k]) && row[k] >= (["uid", "birth_microseconds"].includes(k) ? 0 : 1))
        || row.birth_microseconds >= 1000000
        || !["pid", "ppid", "pgid", "uid"].every(k => row[k] === expected[n][k])) invalid();
    }
    if (!Number.isSafeInteger(inventory.descriptor_count) || inventory.descriptor_count < 1
      || inventory.descriptor_count >= 256 || !Array.isArray(inventory.descriptors)
      || inventory.descriptors.length !== inventory.descriptor_count) invalid();
    let previous = -1;
    for (const row of inventory.descriptors) {
      record(row, ["fd", "type", "family", "identity"]);
      if (!Number.isSafeInteger(row.fd) || row.fd <= previous || row.fd > 2147483647
        || !Number.isInteger(row.type) || row.type < 0 || row.type > 11 || row.type === 8) invalid();
      previous = row.fd;
      if (row.type === 2) {
        if (!Number.isInteger(row.family) || row.family < 1 || row.family > 255
          || typeof row.identity !== "string" || !/^0x[0-9a-f]{16}$/.test(row.identity)
          || BigInt(row.identity) === 0n) invalid();
      } else if (row.family !== null || row.identity !== null) invalid();
    }
    const fds = inventory.descriptors.map(({ fd, type }) => ({ fd, type }));
    if (!equal(fds, inventory.inventory_before) || !equal(fds, inventory.inventory_after)) invalid();
    return inventory;
}
export function assessSyntheticSocketIsolation(value) {
  const v = record(data(value, 0, { nodes: 0, limit: 16384 }), ["expected", "launcher", "helper"]);
  const invalid = () => fail("synthetic_socket_inventory");
  const launcher = validateSocketInventory(v.launcher, "launcher", v.expected);
  const helper = validateSocketInventory(v.helper, "helper", v.expected);
  if (!equal(launcher.roles_before, helper.roles_before.slice(0, 3))) invalid();
  const debug = [3, 4].map(fd => launcher.descriptors.find(row => row.fd === fd));
  if (debug.some(row => !row || row.type !== 2 || row.family !== 1)
    || debug[0].identity === debug[1].identity) invalid();
  if (helper.descriptors.some(row => row.type === 2 && debug.some(owned => owned.identity === row.identity)))
    return answer(false, "inherited_debug_handle");
  return { ...answer(true, "owned_debug_sockets_absent"), debug_handles: debug };
}
export function assessSyntheticHelperRefusal(value) {
  const v = record(data(value), ["receipt", "launcher_status", "ticket_sha256", "argv_sha256",
    "correlation_sha256", "helper_pid", "launcher_pid", "refused_at_ms",
    "child_exit_at_ms", "expires_at_ms", "child_exit"]);
  const receipt = record(v.receipt, ["schema", "ticket_sha256", "argv_sha256", "correlation_sha256",
    "helper_pid", "launcher_pid", "observed_at_ms", "allowed", "native_authority"]);
  const status = record(v.launcher_status, ["schema", "launcher_pid", "helper_exit_code", "native_authority"]);
  record(v.child_exit, ["code", "signal"]);
  const valid = receipt.schema === "airlock.synthetic-helper-exec-refusal.v1"
    && status.schema === "airlock.synthetic-launcher-helper-exit.v1"
    && status.launcher_pid === v.launcher_pid && status.helper_exit_code === 2
    && status.native_authority === false && receipt.allowed === false && receipt.native_authority === false
    && ["ticket_sha256", "argv_sha256", "correlation_sha256"].every(k => digest(v[k]) && receipt[k] === v[k])
    && ["helper_pid", "launcher_pid"].every(k => Number.isSafeInteger(v[k]) && v[k] > 0 && receipt[k] === v[k])
    && ["refused_at_ms", "child_exit_at_ms", "expires_at_ms"].every(k => Number.isSafeInteger(v[k]) && v[k] >= 0)
    && Number.isSafeInteger(receipt.observed_at_ms) && receipt.observed_at_ms >= v.refused_at_ms
    && receipt.observed_at_ms < v.expires_at_ms && receipt.observed_at_ms <= v.child_exit_at_ms
    && v.child_exit.code === 2 && v.child_exit.signal === null;
  return answer(valid, valid ? "helper_refusal_observed" : "synthetic_refusal_not_observed");
}
export function assessSyntheticBootstrapPermit(value) {
  const v = record(data(value), ["permit", "stage", "ticket_sha256", "roles", "fixture", "argv_sha256", "observed_at_ms"]);
  const p = v.permit;
  if (!p || p.schema !== "airlock.synthetic-bootstrap-permit.v1" || p.stage !== v.stage || p.allowed !== true
    || p.native_authority !== false || !digest(v.ticket_sha256) || p.ticket_sha256 !== v.ticket_sha256
    || p.argv_sha256 !== v.argv_sha256 || !equal(p.roles, v.roles) || !equal(p.fixture, v.fixture)
    || !Number.isSafeInteger(v.observed_at_ms) || !Number.isSafeInteger(p.issued_at_ms) || !Number.isSafeInteger(p.expires_at_ms)
    || p.issued_at_ms > v.observed_at_ms || v.observed_at_ms >= p.expires_at_ms
    || p.expires_at_ms - p.issued_at_ms > 25000) return answer(false, "synthetic_permit_refused");
  return assessSyntheticBootstrapRoles({ expected: v.roles, before: v.roles, after: v.roles,
    fixture: v.fixture, expected_fixture: v.fixture });
}
// No injected read function, clock, URL, target or driver. The live caller derives
// this deadline and expected context from the private immutable issued ticket.
export async function awaitSyntheticEnrollment(options) {
  const v = record(data(options), ["root", "stage", "ticket_sha256", "fixture", "argv_sha256", "expires_at_ms"]);
  const end = Math.min(v.expires_at_ms, Date.now() + 8000);
  while (Date.now() < end) {
    try {
      const enrolled = read(join(v.root, "roles-enrolled.json"));
      if (enrolled.ticket_sha256 !== v.ticket_sha256 || !equal(enrolled.fixture, v.fixture))
        fail("synthetic_enrollment_binding");
      const permit = read(join(v.root, v.stage + ".json"));
      const check = assessSyntheticBootstrapPermit({ permit, stage: v.stage, ticket_sha256: v.ticket_sha256,
        roles: enrolled.roles, fixture: v.fixture, argv_sha256: v.argv_sha256, observed_at_ms: Date.now() });
      if (!check.allowed) fail(check.reason);
      return permit;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await sleep(10);
  }
  fail("synthetic_enrollment_deadline");
}

// Fixed internal observations only: no new callable program/clock/observer API.
const phases = ["initial", "engine-acquisition", "launcher-discovery", "helper-discovery",
  "pre-enrollment", "peer-before", "peer-after", "exec-ready", "target-exec", "cleanup", "group-final"];
const scope = (phase, role, expected) => ({ phase, role, expected_owned_role_identity: expected,
  expected_is_not_this_query_observation: true });
const commandPin = path => ({ path, sha256: hash(readMetaPrivate(path, 262144)) });
function commandCase(root) {
  const path = join(root, "os-command-case.json");
  writeMetaPrivate(path, { schema: "airlock.synthetic-os-command-case.v1", root: identity(root),
    parent_runtime: { pid: process.pid, ppid: process.ppid, uid: process.getuid() },
    parent_runtime_is_not_a_fresh_os_observation: true, native_authority: false });
  return { root, case: commandPin(path), receipts: [], failures: [], rows: new Map() };
}
function byteFrame(value, upstreamTruncation = false) {
  if (!Buffer.isBuffer(value)) return { available: false, byte_length: null, captured_bytes: 0,
    base64: null, sha256: null, truncated: null, upstream_truncation_possible: upstreamTruncation };
  const bytes = value.subarray(0, 65536);
  return { available: true, byte_length: value.length, captured_bytes: bytes.length, base64: bytes.toString("base64"),
    sha256: hash(bytes), truncated: value.length > bytes.length, upstream_truncation_possible: upstreamTruncation };
}
const fullIdentity = expected => expected && lifetime.every(k => Object.hasOwn(expected, k))
  && Number.isSafeInteger(expected.pid) && expected.pid > 0 && expected.uid === process.getuid()
  && typeof expected.started === "string" && digest(expected.command_sha256);
function emptyOutcome(program, args, observation, diagnostics) {
  const expected = observation.expected_owned_role_identity;
  if (!fullIdentity(expected)) return null;
  if (program === "/bin/ps" && args[1] === String(expected.pid)) return "owned-pid-absent";
  if (program !== "/usr/bin/pgrep") return null; // Required descriptor/socket queries never qualify by absence.
  if (args[0] === "-g" && expected.pid === expected.pgid && args[1] === String(expected.pgid)) return "owned-group-empty";
  const last = diagnostics.rows.get(expected.pid);
  if (args[0] === "-P" && args[1] === String(expected.pid) && same(expected, last?.row) && live(last.row))
    return "owned-children-empty";
  return null;
}
function executionError(error) {
  const code = error?.code ?? null, signal = error?.signal ?? null;
  const signalAvailable = typeof error?.signal === "string" || error?.signal === null;
  const killedAvailable = typeof error?.killed === "boolean", killed = killedAvailable ? error.killed : null;
  const classification = code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ? "maxbuffer"
    : killed && signal === "SIGKILL" && code === null ? "timeout"
    : typeof error?.syscall === "string" && error.syscall.startsWith("spawn ") ? "spawn"
    : signal ? "signal" : typeof code === "number" ? "exit" : "exec";
  return { classification, code, errno: typeof error?.errno === "number" ? error.errno : null,
    exit_code: typeof code === "number" ? code : null,
    signal, signal_available: signalAvailable, killed, killed_available: killedAvailable,
    syscall: typeof error?.syscall === "string" ? error.syscall.slice(0, 256) : null };
}
async function command(program, args, end, diagnostics, observation, callsite) {
  const utilities = { row: "/bin/ps", children: "/usr/bin/pgrep", group: "/usr/bin/pgrep",
    descriptors: diagnostics.observer?.path, peer: "/usr/sbin/lsof" };
  if (utilities[callsite] !== program || !phases.includes(observation.phase)
    || !["P", "E", "L", "H", "member-E", "member-L"].includes(observation.role)) fail("synthetic_command_scope");
  const sequence = diagnostics.receipts.length + 1, prefix = "os-command-" + String(sequence).padStart(3, "0");
  const issuedPath = join(diagnostics.root, prefix + "-issued.json"), completedPath = join(diagnostics.root, prefix + "-completed.json");
  const issuedTime = performance.now();
  writeMetaPrivate(issuedPath, { schema: "airlock.synthetic-os-command-issued.v1", case: diagnostics.case,
    sequence, ...observation, callsite, program, args, issued_monotonic_ms: issuedTime,
    prior_os_row: diagnostics.rows.get(observation.expected_owned_role_identity.pid) ?? null,
    deadline_monotonic_ms: end, remaining_deadline_ms: Math.floor(end - issuedTime),
    maximum_query_timeout_ms: 1000, max_buffer_bytes: 65536, native_authority: false });
  const pair = { issued: commandPin(issuedPath), completed: null };
  diagnostics.receipts.push(pair);
  // Fsync is inside the original budget. Recompute, never extend that budget.
  const start = performance.now(), remaining = Math.floor(end - start), timeout = Math.min(1000, remaining);
  let output, failure, status, outcome = "ok";
  if (timeout <= 0) { failure = { classification: "deadline-before-exec", code: null, exit_code: null, signal: null, killed: false, syscall: null }; }
  else {
    try {
      output = await execute(program, args, { timeout, killSignal: "SIGKILL", maxBuffer: 65536,
        encoding: "buffer", env: callsite === "descriptors" ? { PATH: "/usr/bin:/bin", LC_ALL: "C" }
          : { ...process.env, LC_ALL: "C" } });
    } catch (error) { output = error; failure = status = executionError(error); }
  }
  const ended = performance.now();
  const upstreamTruncation = failure?.classification === "maxbuffer";
  const stdout = byteFrame(output?.stdout, upstreamTruncation), stderr = byteFrame(output?.stderr, upstreamTruncation);
  if (stdout.available && stderr.available && stdout.byte_length === 0 && stderr.byte_length === 0
    && (!failure || failure.code === 1 && !failure.signal && !failure.killed)) {
    outcome = emptyOutcome(program, args, observation, diagnostics);
    if (outcome) failure = null;
    else { outcome = "error"; failure = { ...(failure ?? executionError(null)), classification: "required-no-match" }; }
  } else if (!failure && (!stdout.available || !stderr.available || stdout.truncated || stderr.truncated)) {
    failure = { ...executionError(null), classification: "invalid-output-capture" };
  }
  if (failure) outcome = "error";
  const completed = { schema: "airlock.synthetic-os-command-completed.v1", case: diagnostics.case, sequence,
    issued: pair.issued, started_monotonic_ms: start, ended_monotonic_ms: ended,
    remaining_deadline_ms: remaining, remaining_at_completion_ms: Math.floor(end - ended),
    effective_timeout_ms: Math.max(0, timeout), outcome, stdout, stderr,
    exit_code: status ? status.exit_code : timeout <= 0 ? null : 0,
    signal: status?.signal ?? null, signal_available: status ? status.signal_available : timeout > 0,
    killed: status ? status.killed : timeout <= 0 ? null : false,
    killed_available: status ? status.killed_available : timeout > 0,
    error: failure ?? null, native_authority: false };
  // Two bounded raw streams plus framing fit this fixed private receipt limit.
  try {
    if (Buffer.byteLength(JSON.stringify(completed)) > 262144) fail("synthetic_command_receipt_limit");
    writeMetaPrivate(completedPath, completed);
    pair.completed = commandPin(completedPath);
  } catch (error) {
    diagnostics.failures.push({ ...pair, phase: observation.phase, role: observation.role, callsite,
      category: "synthetic_command_receipt_failed", error_code: error.code ?? null });
    const surfaced = Error("synthetic_command_receipt_failed", { cause: error });
    surfaced.command_receipt = { ...pair }; throw surfaced;
  }
  if (failure) {
    const category = timeout <= 0 ? "synthetic_deadline" : "synthetic_os_observation_failed";
    diagnostics.failures.push({ ...pair, phase: observation.phase, role: observation.role, callsite, category });
    const error = Error(category); error.command_receipt = { ...pair }; throw error;
  }
  return { stdout: Buffer.from(stdout.base64, "base64").toString("utf8"), outcome, receipt: pair.completed };
}
async function row(pid, end, diagnostics, observation) {
  const observed = await command("/bin/ps", ["-p", String(pid), "-ww",
    "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="], end, diagnostics, observation, "row");
  if (observed.outcome === "owned-pid-absent") return null;
  const text = observed.stdout;
  if (!text.trim()) fail("synthetic_process_shape");
  const m = text.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+(.+)$/);
  if (!m || +m[1] !== pid) fail("synthetic_process_shape");
  const value = { pid, ppid: +m[2], pgid: +m[3], uid: +m[4], started: m[5], state: m[6], command_sha256: hash(m[7]) };
  diagnostics.rows.set(pid, { row: value, receipt: observed.receipt });
  return value;
}
async function children(pid, end, diagnostics, observation) {
  const observed = await command("/usr/bin/pgrep", ["-P", String(pid)], end, diagnostics, observation, "children");
  if (observed.outcome === "owned-children-empty") return [];
  const text = observed.stdout;
  if (!text.trim()) fail("synthetic_child_scope");
  const ids = text.trim().split(/\s+/).map(Number);
  if (ids.length > 4 || ids.some(n => !Number.isSafeInteger(n) || n < 1)) fail("synthetic_child_scope");
  return ids;
}
function observerIdentity(path) {
  const before = lstatSync(path);
  const parent = lstatSync(dirname(path));
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== process.getuid()
    || before.nlink !== 1 || (before.mode & 0o7777) !== 0o700 || before.size < 1 || before.size > 1048576
    || !parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()
    || (parent.mode & 0o7777) !== 0o700)
    fail("synthetic_observer_binary");
  const bytes = readFileSync(path), after = lstatSync(path);
  if (["dev", "ino", "size", "mtimeMs", "ctimeMs"].some(k => before[k] !== after[k]) || bytes.length !== before.size)
    fail("synthetic_observer_binary_changed");
  return { path, dev: String(before.dev), ino: String(before.ino), bytes: bytes.length, sha256: hash(bytes) };
}
function prepareObserver(root, diagnostics) {
  const bytes = readFileSync(OBSERVER_COHORT);
  const cohort = record(json(bytes), ["schema", "source_sha256", "binary_sha256", "compiler_sha256", "sdk", "headers"]);
  if (cohort.schema !== "airlock.owned-socket-observer-cohort.v1" || cohort.sdk !== SDK
    || ![cohort.source_sha256, cohort.binary_sha256, cohort.compiler_sha256].every(digest)
    || hash(readFileSync(OBSERVER_SOURCE)) !== cohort.source_sha256)
    fail("synthetic_observer_cohort");
  record(cohort.headers, ["libproc.h", "sys/proc_info.h", "sys/proc.h"]);
  for (const [name, expected] of Object.entries(cohort.headers))
    if (!digest(expected) || hash(readFileSync(join(SDK, "usr/include", name))) !== expected)
      fail("synthetic_observer_header_changed");
  const path = fileURLToPath(new URL("out/owned-socket-observer/" + cohort.binary_sha256 + "/observer", import.meta.url));
  let binary;
  try { binary = observerIdentity(path); }
  catch (error) {
    writeMetaPrivate(join(root, "descriptor-observer-unavailable.json"), {
      schema: "airlock.synthetic-socket-observer-error.v1", phase: "observer-preparation", path,
      os_error_code: error.code ?? null, message: error.message.slice(0, 2048),
      message_truncated: error.message.length > 2048, native_authority: false,
    });
    throw Error("synthetic_observer_unavailable", { cause: error });
  }
  if (binary.sha256 !== cohort.binary_sha256) fail("synthetic_observer_binary_changed");
  diagnostics.observer = binary;
  writeMetaPrivate(join(root, "descriptor-observer-prepared.json"), {
    schema: "airlock.synthetic-socket-observer-prepared.v1",
    cohort: { path: OBSERVER_COHORT, sha256: hash(bytes) },
    source: { path: OBSERVER_SOURCE, sha256: cohort.source_sha256 },
    sdk: SDK, headers: cohort.headers, compiler_sha256: cohort.compiler_sha256,
    binary, compiled_during_case: false, native_authority: false,
  });
}
async function descriptors(pid, debugOnly, end, diagnostics, observation) {
  const binary = diagnostics.observer;
  if (!binary || !equal(observerIdentity(binary.path), binary)) fail("synthetic_observer_binary_changed");
  const roles = diagnostics.observerRoles;
  if (!roles || pid !== roles[debugOnly ? "L" : "H"].pid) fail("synthetic_observer_role");
  const observed = await command(binary.path, [debugOnly ? "launcher" : "helper", String(pid),
    String(roles.E.pid), String(roles.L.pid), String(roles.P.pid)],
    end, diagnostics, observation, "descriptors");
  if (!equal(observerIdentity(binary.path), binary)) fail("synthetic_observer_binary_changed");
  return json(Buffer.from(observed.stdout), 16384);
}
async function within(promise, end) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("synthetic_deadline")), Math.max(1, end - performance.now()));
    })]);
  } finally { clearTimeout(timer); }
}
function socketFrame(socket, end) {
  return within(new Promise((done, reject) => {
    let bytes = Buffer.alloc(0);
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); socket.off("close", onClose); };
    const onError = () => { cleanup(); reject(Error("synthetic_socket_error")); };
    const onClose = () => { cleanup(); reject(Error("synthetic_socket_disconnected")); };
    const onData = chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 2048) { cleanup(); reject(Error("synthetic_frame_limit")); return; }
      const at = bytes.indexOf(10);
      if (at < 0) return;
      cleanup();
      try { if (at !== bytes.length - 1) fail("synthetic_frame_tail"); done(json(bytes.subarray(0, at))); }
      catch (error) { reject(error); }
    };
    socket.on("data", onData); socket.once("error", onError); socket.once("close", onClose);
  }), end);
}
const sendFrame = (socket, value) => socket.write(JSON.stringify(value) + "\n");
function ticketAt(root) {
  identity(root);
  const ticket = read(join(root, "issued.json"));
  if (ticket.schema !== "airlock.synthetic-pelh-issue.v1" || ticket.native_authority !== false
    || ticket.node !== NODE || process.execPath !== NODE || ticket.entry !== ENTRY
    || ticket.expires_at_ms <= Date.now() || !equal(identity(ticket.temp.path), ticket.temp))
    fail("synthetic_ticket");
  parseSyntheticBootstrapArgv({ argv: ticket.argv, temporary_root: ticket.temp.path, issued_argv_sha256: ticket.argv_sha256 });
  return { ticket, ticket_sha256: pin(join(root, "issued.json")).sha256 };
}

export async function runSyntheticBootstrapHelper(root, argv) {
  const { ticket, ticket_sha256 } = ticketAt(root);
  parseSyntheticBootstrapArgv({ argv, temporary_root: ticket.temp.path, issued_argv_sha256: ticket.argv_sha256 });
  // Announcement is notification only. P discovers E -> L -> H independently.
  writeMetaPrivate(join(root, "helper-announcement.json"), { pid: process.pid, ppid: process.ppid, argv_sha256: ticket.argv_sha256 });
  const expected = { root, stage: "tcp-only", ticket_sha256,
    fixture: identity(ticket.fixture_path), argv_sha256: ticket.argv_sha256, expires_at_ms: ticket.expires_at_ms };
  const permit = await awaitSyntheticEnrollment(expected);
  if (permit.roles.H.pid !== process.pid || permit.roles.H.ppid !== process.ppid) fail("synthetic_helper_identity");
  const socket = connect({ host: "127.0.0.1", port: ticket.port });
  socket.on("error", () => {});
  const stop = performance.now() + Math.min(5000, ticket.expires_at_ms - Date.now());
  try {
    await within(new Promise((done, reject) => { socket.once("connect", done); socket.once("error", reject); }), stop);
    const incoming = socketFrame(socket, stop);
    sendFrame(socket, { helper_pid: process.pid, launcher_pid: process.ppid, ticket_sha256 });
    const challenge = await incoming;
    if (challenge.stage !== "challenge" || !digest(challenge.correlation)) fail("synthetic_challenge");
    const ready = socketFrame(socket, stop);
    sendFrame(socket, { correlation_sha256: hash(challenge.correlation) });
    const response = await ready;
    if (response.stage === "exec-ready" && response.allowed === false)
      writeMetaPrivate(join(root, "helper-exec-refused.json"), {
        schema: "airlock.synthetic-helper-exec-refusal.v1", ticket_sha256,
        argv_sha256: ticket.argv_sha256, correlation_sha256: hash(challenge.correlation),
        helper_pid: process.pid, launcher_pid: process.ppid, observed_at_ms: Date.now(),
        allowed: false, native_authority: false,
      });
    if (response.stage !== "exec-ready" || response.allowed !== true) fail("synthetic_exec_refused");
    const final = await awaitSyntheticEnrollment({ ...expected, stage: "exec-ready" });
    if (response.registration_sha256 !== pin(join(root, "exec-ready.json")).sha256
      || final.correlation_sha256 !== hash(challenge.correlation)) fail("synthetic_exec_binding");
  } finally { socket.destroy(); }
}

export async function runSyntheticBootstrapEngine(root) {
  const { ticket, ticket_sha256 } = ticketAt(root);
  if (tmpdir() !== ticket.temp.path || !process.send || process.ppid !== ticket.parent.pid) fail("synthetic_engine_context");
  const ack = await within(new Promise(done => process.once("message", done)), performance.now() + 5000);
  if (ack.type !== "owner-ack" || ack.ticket_sha256 !== ticket_sha256 || ack.identity.pid !== process.pid
    || ack.identity.ppid !== process.ppid || ack.identity.uid !== process.getuid()) fail("synthetic_owner_ack");
  mkdirSync(ticket.fixture_path, { mode: 0o700 }); sync(ticket.temp.path);
  writeMetaPrivate(join(root, "fixture-issued.json"), { fixture: identity(ticket.fixture_path), synthetic: true });
  const allow = within(new Promise(done => process.once("message", done)), performance.now() + 5000);
  process.send({ type: "fixture-ready" });
  if ((await allow).type !== "launcher-ack") fail("synthetic_launcher_ack");
  const child = spawn("/bin/sh", [SHELL, ...ticket.argv], { detached: true, stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
    env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LC_ALL: "C", TMPDIR: ticket.temp.path,
      AIRLOCK_SYNTHETIC_BOOTSTRAP_ROOT: root,
      AIRLOCK_SYNTHETIC_BOOTSTRAP_INHERIT_DEBUG: ticket.control === "inherited-debug" ? "1" : "0" } });
  let exit;
  child.once("exit", (code, signal) => { exit = { code, signal }; });
  child.on("error", () => {});
  const output = { stdout_bytes: 0, stderr_bytes: 0 };
  child.stdout.on("data", b => { output.stdout_bytes += b.length; });
  child.stderr.on("data", b => { output.stderr_bytes += b.length; });
  try {
    process.send({ type: "launcher-issued", pid: child.pid });
    // First challenge is sent BEFORE helper enrollment/exec, solely on FD3.
    const first = randomBytes(32).toString("hex");
    const firstReply = socketFrame(child.stdio[4], performance.now() + 15000);
    sendFrame(child.stdio[3], { first });
    const one = await firstReply;
    if (one.first_sha256 !== hash(first) || one.argv_sha256 !== ticket.argv_sha256 || one.pid !== child.pid)
      fail("synthetic_fd_first");
    const secondMessage = within(new Promise(done => process.once("message", done)), performance.now() + 5000);
    process.send({ type: "fd-first", pid: child.pid, first_sha256: hash(first), response_sha256: hash(JSON.stringify(one)) });
    const second = await secondMessage;
    if (second.type !== "fd-second" || !digest(second.value)) fail("synthetic_fd_second");
    const secondReply = socketFrame(child.stdio[4], performance.now() + 5000);
    sendFrame(child.stdio[3], { second: second.value, first_sha256: hash(first) });
    const two = await secondReply;
    if (two.chain_sha256 !== hash(first + second.value)) fail("synthetic_fd_chain");
    process.send({ type: "fd-complete", response_sha256: hash(JSON.stringify(two)), ...output });
    while (!exit) await sleep(10);
    if (exit.code !== 0 || exit.signal) fail("synthetic_target_exit");
    process.send({ type: "target-exit", pid: child.pid, exit, ...output });
  } finally {
    // P owns disposition/signals; E only releases its inherited pipe handles.
    try { for (const stream of child.stdio) stream?.destroy(); }
    finally { child.unref(); }
  }
}
async function fixedTarget(root, argv) {
  const { ticket, ticket_sha256 } = ticketAt(root), permit = read(join(root, "exec-ready.json"));
  const check = assessSyntheticBootstrapPermit({ permit, stage: "exec-ready", ticket_sha256, roles: permit.roles,
    fixture: identity(ticket.fixture_path), argv_sha256: ticket.argv_sha256, observed_at_ms: Date.now() });
  if (!check.allowed || permit.roles.L.pid !== process.pid || permit.roles.L.ppid !== process.ppid) fail("synthetic_target_permission");
  parseSyntheticBootstrapArgv({ argv, temporary_root: ticket.temp.path, issued_argv_sha256: ticket.argv_sha256 });
  // Public inherited-FD Socket API; no private stream handles or blocking read
  // that could prevent this fixed target's watchdog/deadline from firing.
  const input = new Socket({ fd: 3, readable: true, writable: false });
  const output = new Socket({ fd: 4, readable: false, writable: true });
  input.on("error", () => {}); output.on("error", () => {});
  const end = performance.now() + 8000;
  try {
    const first = await socketFrame(input, end);
    if (!digest(first.first)) fail("synthetic_fd_token");
    const next = socketFrame(input, end);
    sendFrame(output, { pid: process.pid, first_sha256: hash(first.first), argv_sha256: ticket.argv_sha256 });
    const second = await next;
    if (!digest(second.second) || second.first_sha256 !== hash(first.first)) fail("synthetic_fd_token");
    await within(new Promise((done, reject) => {
      output.end(JSON.stringify({ chain_sha256: hash(first.first + second.second) }) + "\n", error => error ? reject(error) : done());
    }), end);
    process.stdout.write("synthetic-fd-target-stdout\n"); process.stderr.write("synthetic-fd-target-stderr\n");
  } finally { input.destroy(); output.destroy(); }
}

/** Fixed, offline-only mechanical program. Not a native API or reusable RPC.
 * No caller program/URL/driver/clock/timing inputs. Real execution requires a
 * separately coordinated explicit opt-in; source/pure tests do not call this. */
export async function runSyntheticPreexecFdFeasibility(options) {
  const v = record(data(options), ["outputDir", "control"]);
  if (!["normal", "refuse-exec", "inherited-debug"].includes(v.control) || process.execPath !== NODE
    || ["NODE_OPTIONS", "NODE_DEBUG", "NODE_V8_COVERAGE"].some(k => Object.hasOwn(process.env, k))) fail("synthetic_fixed_program");
  const end = performance.now() + 45000, workEnd = end - 15000;
  createRoot(v.outputDir);
  const diagnostics = commandCase(v.outputDir);
  const parent = await row(process.pid, workEnd, diagnostics, scope("initial", "P",
    { pid: process.pid, ppid: process.ppid, uid: process.getuid(), ownership: "source-owned-self-not-yet-PS-observed" }));
  const tempPath = join(v.outputDir, "tmp");
  writeMetaPrivate(join(v.outputDir, "root-issued.json"), { root: identity(v.outputDir), parent,
    temporary_subtree_intent: tempPath, E_command: [NODE, ENTRY, "--fixed-e"],
    command_case: diagnostics.case, native_authority: false });
  mkdirSync(tempPath, { mode: 0o700 }); sync(v.outputDir);
  const temp = identity(tempPath), fixturePath = join(tempPath, "synthetic-user-data");
  const argv = ["--user-data-dir=" + fixturePath, "--remote-debugging-pipe", "--no-startup-window"];
  const argvSha = hash(JSON.stringify(argv)), fixtureIntent = { argv, fixture_path: fixturePath, synthetic: true };
  writeMetaPrivate(join(v.outputDir, "allocation-intent.json"), { parent, temp, fixture_intent: fixtureIntent,
    roles: ["E", "L", "H"], native_authority: false });
  const sockets = new Set(), known = new Map(), messages = [], errors = [], registrations = [];
  let child, childExit, childExitAt, roles, fixture, debugHandles, peer, server, serverError, targetExecuted = false;
  let connectedPeer = false, fdRounds = 0, finished = false, helperExited = false;
  const save = (name, value) => {
    const path = join(v.outputDir, name + ".json");
    writeMetaPrivate(path, { ...value, at_ms: Date.now(), native_authority: false }); return pin(path);
  };
  try {
    prepareObserver(v.outputDir, diagnostics);
    server = createServer(socket => {
      sockets.add(socket); socket.on("error", () => {}); socket.once("close", () => sockets.delete(socket));
      if (peer) { socket.destroy(); serverError = Error("synthetic_extra_peer"); return; }
      peer = socket;
    });
    server.on("error", error => { serverError = error; });
    await within(new Promise((done, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", done);
    }), workEnd);
    save("listener-owned", { owner: parent, host: "127.0.0.1", port: server.address().port });
    const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
    writeMetaPrivate(join(v.outputDir, "issued.json"), { schema: "airlock.synthetic-pelh-issue.v1", node: NODE, entry: ENTRY,
      parent, temp, argv, argv_sha256: argvSha, fixture_path: fixturePath, expires_at_ms: Date.now() + 25000,
      port: server.address().port, source_pins: inspectedMetaSourcePins(), control: v.control,
      command_case: diagnostics.case, native_authority: false });
    const { ticket, ticket_sha256 } = ticketAt(v.outputDir);
    child = spawn(NODE, [ENTRY, "--fixed-e"], { detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LC_ALL: "C", TMPDIR: tempPath, AIRLOCK_SYNTHETIC_BOOTSTRAP_ROOT: v.outputDir } });
    child.on("message", message => messages.push(data(message)));
    child.on("error", error => { serverError = error; });
    child.once("exit", (code, signal) => { childExit = { code, signal }; childExitAt = Date.now(); });
    child.stdout.resume(); child.stderr.resume();
    const E = await row(child.pid, workEnd, diagnostics, scope("engine-acquisition", "E",
      { pid: child.pid, ppid: process.pid, pgid: child.pid, uid: parent.uid,
        command_sha256: hash([NODE, ENTRY, "--fixed-e"].join(" ")), ownership: "issued-child-not-yet-PS-observed" }));
    if (!E || !live(E) || E.ppid !== process.pid || E.pgid !== E.pid || E.uid !== parent.uid
      || E.command_sha256 !== hash([NODE, ENTRY, "--fixed-e"].join(" "))) fail("synthetic_engine_ownership");
    known.set("E", E);
    registrations.push(save("engine-owned", { E, ticket_sha256 }));
    child.send({ type: "owner-ack", ticket_sha256, identity: E });
    const waitMessage = async type => {
      for (;;) {
        if (serverError) throw serverError;
        const at = messages.findIndex(m => m.type === type);
        if (at >= 0) return messages.splice(at, 1)[0];
        if (childExit) fail("synthetic_engine_exited");
        if (performance.now() >= workEnd) fail("synthetic_deadline");
        await sleep(10);
      }
    };
    await waitMessage("fixture-ready");
    fixture = identity(fixturePath);
    registrations.push(save("launcher-allowed", { parent, E, fixture, argv_sha256: argvSha }));
    child.send({ type: "launcher-ack" });
    const issuedL = await waitMessage("launcher-issued");
    let L, H;
    while (performance.now() < workEnd) {
      if (!same(E, await row(E.pid, workEnd, diagnostics, scope("launcher-discovery", "E", E)))) fail("synthetic_engine_lost_before_attribution");
      // Enumerate only independently issued E's direct children, never a claimed PID.
      for (const pid of await children(E.pid, workEnd, diagnostics, scope("launcher-discovery", "E", E))) {
        const candidate = await row(pid, workEnd, diagnostics, scope("launcher-discovery", "L",
          { pid, ppid: E.pid, pgid: pid, uid: E.uid, ownership: "scoped-child-not-yet-attributed" }));
        if (candidate?.pid === issuedL.pid && candidate.command_sha256 === hash(["/bin/sh", SHELL, ...argv].join(" "))
          && candidate.ppid === E.pid && candidate.pgid === candidate.pid && candidate.uid === E.uid) {
          L = candidate; known.set("L", L); registrations.push(save("launcher-owned", { L, fixture, argv_sha256: argvSha })); break;
        }
      }
      if (L) break;
      await sleep(10);
    }
    if (!L) fail("synthetic_launcher_unattributed");
    while (performance.now() < workEnd) {
      if (!same(E, await row(E.pid, workEnd, diagnostics, scope("helper-discovery", "E", E)))
        || !same(L, await row(L.pid, workEnd, diagnostics, scope("helper-discovery", "L", L)))) fail("synthetic_ancestor_lost");
      for (const pid of await children(L.pid, workEnd, diagnostics, scope("helper-discovery", "L", L))) {
        const candidate = await row(pid, workEnd, diagnostics, scope("helper-discovery", "H",
          { pid, ppid: L.pid, pgid: L.pid, uid: L.uid, ownership: "scoped-child-not-yet-attributed" }));
        if (candidate?.command_sha256 === hash([NODE, ENTRY, "--fixed-h", ...argv].join(" "))
          && candidate.ppid === L.pid && candidate.pgid === L.pid && candidate.uid === E.uid) {
          H = candidate; known.set("H", H); break;
        }
      }
      if (H) break;
      await sleep(10);
    }
    if (!H) fail("synthetic_helper_unattributed");
    roles = { P: parent, E, L, H };
    diagnostics.observerRoles = roles;
    const freshRoles = async phase => {
      // Keep all already-started, individually bounded observations/receipts
      // settled before cleanup/publication; rejection must not orphan a ledger.
      const observed = await Promise.allSettled(Object.entries(roles).map(async ([k, r]) =>
        [k, await row(r.pid, workEnd, diagnostics, scope(phase, k, r))]));
      const failed = observed.find(value => value.status === "rejected");
      if (failed) throw failed.reason;
      return Object.fromEntries(observed.map(value => value.value));
    };
    const checkRoles = async phase => {
      const after = await freshRoles(phase), currentFixture = identity(fixturePath);
      const checked = assessSyntheticBootstrapRoles({ expected: roles, before: roles, after,
        fixture: currentFixture, expected_fixture: fixture });
      if (!checked.allowed) fail(checked.reason);
      return after;
    };
    const checkHandles = async phase => {
      const launcher = await descriptors(L.pid, true, workEnd, diagnostics, scope(phase, "L", L));
      const helper = await descriptors(H.pid, false, workEnd, diagnostics, scope(phase, "H", H));
      const check = assessSyntheticSocketIsolation({ expected: roles, launcher, helper });
      if (!check.allowed) fail(check.reason);
      if (debugHandles && !equal(debugHandles, check.debug_handles)) fail("synthetic_debug_handles_changed");
      debugHandles = check.debug_handles;
      return { launcher, helper };
    };
    const beforeEnrollment = await checkRoles("pre-enrollment"), fdEnrollment = await checkHandles("pre-enrollment");
    registrations.push(save("roles-enrolled", { roles, before: beforeEnrollment, fixture, fd: fdEnrollment, ticket_sha256 }));
    const permit = stage => ({ schema: "airlock.synthetic-bootstrap-permit.v1", stage, ticket_sha256, roles, fixture,
      argv_sha256: argvSha, issued_at_ms: Date.now(), expires_at_ms: ticket.expires_at_ms, allowed: true, native_authority: false });
    writeMetaPrivate(join(v.outputDir, "tcp-only.json"), permit("tcp-only"));
    while (!peer && performance.now() < workEnd) { if (serverError) throw serverError; await sleep(10); }
    if (!peer) fail("synthetic_peer_missing");
    const hello = await socketFrame(peer, workEnd);
    const beforePeer = await checkRoles("peer-before");
    const tuple = { server_address: peer.localAddress, server_port: peer.localPort,
      client_address: peer.remoteAddress, client_port: peer.remotePort };
    const kernel = await command("/usr/sbin/lsof", ["-nP", "-a", "-p", String(H.pid),
      "-iTCP:" + tuple.server_port, "-sTCP:ESTABLISHED", "-Fpn"], workEnd, diagnostics, scope("peer-before", "H", H), "peer");
    const checkedPeer = assessSyntheticBootstrapPeer({ roles, tuple, hello, kernel: kernel.stdout, ticket_sha256 });
    if (!checkedPeer.allowed) fail(checkedPeer.reason);
    const afterPeer = await checkRoles("peer-after");
    registrations.push(save("kernel-peer", { roles, before: beforePeer, after: afterPeer, tuple,
      kernel_sha256: hash(kernel.stdout), kernel: kernel.stdout, command_receipt: kernel.receipt, ticket_sha256 }));
    connectedPeer = true;
    const correlation = randomBytes(32).toString("hex"), response = socketFrame(peer, workEnd);
    sendFrame(peer, { stage: "challenge", correlation });
    if ((await response).correlation_sha256 !== hash(correlation)) fail("synthetic_correlation");
    const readyRoles = await checkRoles("exec-ready"), readyHandles = await checkHandles("exec-ready");
    if (v.control === "refuse-exec") {
      const refusedAt = Date.now();
      registrations.push(save("exec-refused", { roles: readyRoles, fixture, fd: readyHandles, connected_peer: true }));
      sendFrame(peer, { stage: "exec-ready", allowed: false });
      while (!childExit && performance.now() < workEnd) await sleep(10);
      if (!childExit || childExit.code !== 2 || childExit.signal) fail("synthetic_refusal_not_observed");
      const helperPath = join(v.outputDir, "helper-exec-refused.json");
      const statusPath = join(v.outputDir, "launcher-helper-status.json");
      const receipt = read(helperPath), status = read(statusPath);
      const check = assessSyntheticHelperRefusal({
        receipt, launcher_status: status, ticket_sha256, argv_sha256: argvSha,
        correlation_sha256: hash(correlation), helper_pid: H.pid, launcher_pid: L.pid,
        refused_at_ms: refusedAt, child_exit_at_ms: childExitAt,
        expires_at_ms: ticket.expires_at_ms, child_exit: childExit,
      });
      if (!check.allowed) fail(check.reason);
      sync(helperPath); sync(statusPath); sync(v.outputDir);
      registrations.push(save("helper-refusal-observed", { helper: pin(helperPath),
        launcher_status: pin(statusPath), child_exit: childExit, child_exit_at_ms: childExitAt }));
    } else {
      const ready = { ...permit("exec-ready"), correlation_sha256: hash(correlation), registrations };
      writeMetaPrivate(join(v.outputDir, "exec-ready.json"), ready);
      sendFrame(peer, { stage: "exec-ready", allowed: true, registration_sha256: pin(join(v.outputDir, "exec-ready.json")).sha256 });
      const first = await waitMessage("fd-first");
      const current = await row(L.pid, workEnd, diagnostics, scope("target-exec", "L", L));
      const target = { ...L, command_sha256: hash([NODE, ENTRY, "--fixed-fd-target", ...argv].join(" ")) };
      if (!same(target, current) || !live(current) || first.pid !== L.pid) fail("synthetic_exec_lifetime");
      targetExecuted = true; known.set("L", target);
      const finalDescriptors = await descriptors(L.pid, true, workEnd, diagnostics, scope("target-exec", "L", target));
      const finalInventory = validateSocketInventory(finalDescriptors, "launcher", { ...roles, L: target });
      const finalDebug = finalInventory.descriptors.filter(row => row.fd === 3 || row.fd === 4);
      if (!equal(debugHandles, finalDebug)) fail("synthetic_exec_debug_handles");
      registrations.push(save("target-exec-owned", { before: L, after: current, fd: finalDescriptors, first }));
      fdRounds = 1;
      child.send({ type: "fd-second", value: randomBytes(32).toString("hex") });
      const complete = await waitMessage("fd-complete");
      const exit = await waitMessage("target-exit");
      if (exit.exit.code !== 0 || exit.exit.signal || !complete.response_sha256
        || exit.stdout_bytes !== Buffer.byteLength("synthetic-fd-target-stdout\n")
        || exit.stderr_bytes !== Buffer.byteLength("synthetic-fd-target-stderr\n")) fail("synthetic_fd_completion");
      fdRounds = 2; helperExited = true;
      registrations.push(save("fd-complete", { complete, exit }));
      while (!childExit && performance.now() < workEnd) await sleep(10);
      if (!childExit || childExit.code !== 0 || childExit.signal) fail("synthetic_engine_exit");
    }
    finished = true;
  } catch (error) { errors.push(error.message); }
  finally {
    const disposition = [];
    try {
      for (const [role, expected] of [...known].reverse()) {
        try {
          const signals = [];
          for (const signal of ["SIGTERM", "SIGKILL"]) {
            const actual = await row(expected.pid, end, diagnostics, scope("cleanup", role, expected));
            if (!actual || actual.state.startsWith("Z")) break;
            // L's one legitimate exec image is fixed, with unchanged lifetime.
            const target = role === "L" ? { ...expected,
              command_sha256: hash([NODE, ENTRY, "--fixed-fd-target", ...argv].join(" ")) } : null;
            if (!same(expected, actual) && !(target && same(target, actual))) fail("synthetic_cleanup_identity_changed");
            process.kill(expected.pid, signal); signals.push({ pid: expected.pid, signal, at_ms: Date.now() });
            await sleep(signal === "SIGTERM" ? 250 : 50);
          }
          const final = await row(expected.pid, end, diagnostics, scope("cleanup", role, expected));
          const closed = !final || final.state.startsWith("Z") && ["pid", "pgid", "uid", "started"].every(k => final[k] === expected[k]);
          disposition.push({ role, expected, final, signals, disposition: closed ? "closed" : "UNKNOWN" });
        } catch (error) { disposition.push({ role, expected, disposition: "UNKNOWN", error: error.message,
          error_code: error.code ?? null, command_receipt: error.command_receipt ?? null }); }
      }
    } finally { try {
      try { for (const socket of sockets) socket.destroy(); }
      finally {
        try { if (server) await within(new Promise(done => server.close(done)), end); }
        finally {
          if (child) {
            try { child.stdout.destroy(); }
            finally { try { child.stderr.destroy(); }
              finally { try { if (child.connected) child.disconnect(); } finally { child.unref(); } } }
          }
        }
      }
    } catch (error) { errors.push("synthetic_parent_disposal:" + error.message); } }
    const groups = [];
    for (const role of ["E", "L"]) if (known.has(role)) {
      try {
        const expected = known.get(role);
        const observed = await command("/usr/bin/pgrep", ["-g", String(expected.pgid)], end,
          diagnostics, scope("group-final", role, expected), "group");
        if (observed.outcome === "ok" && !observed.stdout.trim()) fail("synthetic_group_shape");
        const ids = observed.outcome === "owned-group-empty" ? [] : observed.stdout.trim().split(/\s+/).map(Number);
        const members = [];
        if (ids.length > 8 || ids.some(n => !Number.isSafeInteger(n) || n < 1)) fail("synthetic_group_shape");
        for (const pid of ids) members.push(await row(pid, end, diagnostics, scope("group-final", "member-" + role,
          [...known.values()].find(k => k.pid === pid) ?? { pid, pgid: expected.pgid, uid: expected.uid,
            ownership: "enumerated-in-recorded-group-not-attributed" })));
        groups.push({ role, pgid: known.get(role).pgid, members });
        if (members.some(m => !m || !m.state.startsWith("Z") || ![...known.values()].some(k =>
          ["pid", "pgid", "uid", "started"].every(key => k[key] === m[key])))) errors.push("synthetic_group_unknown");
      } catch (error) { groups.push({ role, disposition: "UNKNOWN", error: error.message }); errors.push("synthetic_group_unknown"); }
    }
    save("resource-disposition", { disposition, child_exit: childExit ?? null,
      groups,
      descendant_disposition: roles ? "attributed-see-dispositions" : "UNKNOWN-not-fully-attributed",
      listener_closed: !server?.listening, sockets_closed: [...sockets].every(s => s.destroyed),
      temporary_fixture_retained: true, synthetic: true, helper_exit_protocol_observed: helperExited });
    if (!roles || disposition.some(r => r.disposition !== "closed")) errors.push("synthetic_resource_disposition_unknown");
  }
  const result = { schema: "airlock.synthetic-pelh-fd-result.v1", witnessed: finished && !errors.length && v.control === "normal",
    native_qualified: false, native_authority: false, control: v.control, connected_peer: connectedPeer,
    target_executed: targetExecuted, launcher_pid_preserved: targetExecuted, fd_round_trips: fdRounds,
    debug_handle_identity_supported: !!debugHandles, child_exit: childExit ?? null, registrations, errors,
    command_diagnostics: { case: diagnostics.case, receipts: diagnostics.receipts, failures: diagnostics.failures } };
  writeMetaPrivate(join(v.outputDir, "result.json"), result);
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2], root = process.env.AIRLOCK_SYNTHETIC_BOOTSTRAP_ROOT;
  // Source-only candidate: there is intentionally no native/public CLI.
  const watchdog = setTimeout(() => process.exit(2), mode === "--fixed-h" ? 10000 : 30000);
  try {
    if (mode === "--fixed-e") await runSyntheticBootstrapEngine(root);
    else if (mode === "--fixed-h") await runSyntheticBootstrapHelper(root, process.argv.slice(3));
    else if (mode === "--fixed-fd-target") await fixedTarget(root, process.argv.slice(3));
    else fail("synthetic_fixed_role");
  } catch { process.exitCode = 2; }
  finally { clearTimeout(watchdog); if (process.connected) process.disconnect(); }
}
