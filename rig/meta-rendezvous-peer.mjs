import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { createServer, connect } from "node:net";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { data, json, record } from "./inspected-meta-record.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";

const ENTRY = fileURLToPath(import.meta.url), execute = promisify(execFile);
const hash = value => createHash("sha256").update(value).digest("hex");
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fail = category => { throw Error(category); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const keys = ["pid", "ppid", "pgid", "uid", "started", "state", "command_sha256"];
const same = (a, b) => !!a && !!b && keys.filter(key => key !== "state").every(key => a[key] === b[key]);
// macOS ps(1) U is a waiting lifetime; protocol and cleanup deadlines still apply.
const live = value => value && typeof value.state === "string" && /^[RSIU]/.test(value.state);
const tupleName = value => `${value.client_address}:${value.client_port}->${value.server_address}:${value.server_port}`;
const result = (accepted, reason, kernel_owner_pid = null) =>
  Object.freeze({ accepted, reason, kernel_owner_pid, native_authority: false });

/** Pure assessment of a supported OS observation, not an execution capability.
 * The actual collector below obtains tuples from public Socket fields and
 * queries only already-issued, independently verified child PIDs. */
export function assessOwnedRendezvousPeer(value) {
  const input = record(data(value), ["expected", "claimed_pid", "issued_correlation_sha256",
    "received_correlation_sha256", "tuple", "before", "after", "connections"]);
  record(input.expected, keys);
  record(input.tuple, ["server_address", "server_port", "client_address", "client_port"]);
  if (!Array.isArray(input.before) || !Array.isArray(input.after) || !Array.isArray(input.connections)
    || input.before.length !== 2 || input.after.length !== 2 || input.connections.length > 16
    || !digest(input.issued_correlation_sha256) || !digest(input.received_correlation_sha256)
    || input.tuple.server_address !== "127.0.0.1" || input.tuple.client_address !== "127.0.0.1"
    || !["server_port", "client_port"].every(key =>
      Number.isInteger(input.tuple[key]) && input.tuple[key] > 0 && input.tuple[key] < 65536))
    fail("invalid_rendezvous_observation");
  for (const entry of [...input.before, ...input.after]) record(entry, keys);
  const ids = new Set(input.before.map(entry => entry.pid));
  if (ids.size !== 2) fail("invalid_rendezvous_observation");
  for (const before of input.before) {
    const after = input.after.find(entry => entry.pid === before.pid);
    if (!same(before, after) || !live(before) || !live(after) || before.uid !== input.expected.uid
      || !Number.isSafeInteger(before.pid) || before.pid < 1 || before.pgid !== before.pid)
      return result(false, "ownership_changed");
  }
  if (!same(input.expected, input.before.find(entry => entry.pid === input.expected.pid)))
    return result(false, "ownership_changed");
  const owners = new Set();
  for (const connection of input.connections) {
    record(connection, ["pid", "name"]);
    if (!ids.has(connection.pid)) fail("unissued_rendezvous_pid");
    if (connection.name === tupleName(input.tuple)) owners.add(connection.pid);
  }
  if (owners.size !== 1) return result(false, "kernel_owner_unproved");
  const [owner] = owners;
  if (owner !== input.expected.pid) return result(false, "peer_owner_mismatch", owner);
  if (input.claimed_pid !== input.expected.pid) return result(false, "claim_mismatch", owner);
  if (!timingSafeEqual(Buffer.from(input.issued_correlation_sha256, "hex"),
    Buffer.from(input.received_correlation_sha256, "hex"))) return result(false, "correlation_mismatch", owner);
  return result(true, "owned_peer", owner);
}

function remaining(end, maximum = 1000) {
  const ms = Math.floor(Math.min(maximum, end - performance.now()));
  if (ms <= 0) fail("rendezvous_deadline");
  return ms;
}
async function until(promise, end, category) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(category)), remaining(end, 45000));
    })]);
  } finally { clearTimeout(timer); }
}
async function osCommand(command, args, end) {
  try {
    const value = await execute(command, args, { timeout: remaining(end), killSignal: "SIGKILL",
      maxBuffer: 65536, env: { ...process.env, LC_ALL: "C" } });
    return value.stdout;
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return "";
    fail("rendezvous_os_observation_failed");
  }
}
async function processRow(pid, end) {
  const text = await osCommand("/bin/ps", ["-p", String(pid), "-ww",
    "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="], end);
  if (!text.trim()) return null;
  const match = text.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+(.+)$/);
  if (!match || Number(match[1]) !== pid) fail("rendezvous_process_shape");
  return { pid: +match[1], ppid: +match[2], pgid: +match[3], uid: +match[4],
    started: match[5], state: match[6], command_sha256: hash(match[7]), command: match[7] };
}
const identity = ({ command: _command, ...value }) => value;
async function fresh(peer, end) {
  const current = await processRow(peer.pid, end);
  if (!same(peer.identity, current) || !live(current)) fail("rendezvous_owned_lifetime_changed");
  return identity(current);
}
function lsofConnections(text, ownedPid) {
  const values = [];
  let pid = null;
  for (const line of text.split("\n")) {
    if (/^p\d+$/.test(line)) { pid = Number(line.slice(1)); if (pid !== ownedPid) fail("rendezvous_lsof_scope"); }
    if (line.startsWith("n")) {
      if (pid !== ownedPid) fail("rendezvous_lsof_shape");
      values.push({ pid, name: line.slice(1) });
    }
  }
  return values;
}
async function observe(socket, peers, end) {
  const tuple = { server_address: socket.localAddress, server_port: socket.localPort,
    client_address: socket.remoteAddress, client_port: socket.remotePort };
  if (tuple.server_address !== "127.0.0.1" || tuple.client_address !== "127.0.0.1")
    fail("nonloopback_rendezvous");
  const before = [], after = [], connections = [];
  for (const peer of peers) before.push(await fresh(peer, end));
  for (const peer of peers) {
    const text = await osCommand("/usr/sbin/lsof", ["-nP", "-a", "-p", String(peer.pid),
      "-iTCP:" + tuple.server_port, "-sTCP:ESTABLISHED", "-Fpn"], end);
    connections.push(...lsofConnections(text, peer.pid));
  }
  for (const peer of peers) after.push(await fresh(peer, end));
  return { tuple, before, after, connections };
}
function output(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) fail("invalid_peer_output");
  const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (path.startsWith(project + "/") && !path.startsWith(join(project, "rig/out") + "/")) fail("invalid_peer_output");
  for (let parent = dirname(path);;) {
    const stat = lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink() || parent === dirname(path)
      && (stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700)) fail("invalid_peer_output");
    if (parent === dirname(parent)) break;
    parent = dirname(parent);
  }
  mkdirSync(path, { mode: 0o700 });
  for (const directory of [path, dirname(path)]) {
    const fd = openSync(directory, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
}
const CASES = ["owned-launcher", "owned-sibling", "forged-launcher-pid", "wrong-correlation", "frame-timeout"];
const pin = path => ({ path, sha256: hash(readMetaPrivate(path)) });
async function stopPeer(peer, end) {
  const signals = [];
  try {
  if (!peer.exit && peer.child.connected) peer.child.send({ type: "stop" });
  for (const signal of [null, "SIGTERM", "SIGKILL"]) {
    if (peer.exit) break;
    if (signal) {
      const actual = await processRow(peer.pid, end);
      if (!same(peer.identity, actual)) break; // Never target a replaced/unverified lifetime.
      let outcome = "sent";
      try { process.kill(peer.pid, signal); }
      catch (error) { if (error.code === "ESRCH") outcome = "vanished"; else fail("rendezvous_signal_failed"); }
      signals.push({ pid: peer.pid, signal, outcome, at_ms: Date.now() });
    }
    const grace = Math.min(end, performance.now() + 750);
    while (!peer.exit && performance.now() < grace) await sleep(10);
  }
  const current = await processRow(peer.pid, end);
  const originalZombie = current?.state.startsWith("Z") && peer.identity
    && ["pid", "pgid", "uid", "started"].every(key => current[key] === peer.identity[key]);
  return { role: peer.role, pid: peer.pid, identity: peer.identity ?? null, exit: peer.exit,
    signals, final: !current ? "absent" : originalZombie ? "zombie" : "unknown",
    command_exit_observed: !!peer.exit };
  } finally {
    // Observation/signalling failure cannot leave the parent's CLI handles
    // referenced. Disposal errors still propagate; later handles are attempted.
    try { peer.child.stdout.destroy(); }
    finally {
      try { peer.child.stderr.destroy(); }
      finally {
        try { if (peer.child.connected) peer.child.disconnect(); }
        finally { peer.child.unref(); }
      }
    }
  }
}

/** Mechanical Node/TCP feasibility only. Not a native runner or resource ticket.
 * Fixed 45 s overall; no caller program/URL/clock/timer/driver/control options. */
export async function runOwnedRendezvousPeerFeasibility(options) {
  const input = record(options, ["outputDir"]);
  if (["NODE_OPTIONS", "NODE_DEBUG", "NODE_V8_COVERAGE"].some(key => Object.hasOwn(process.env, key)))
    fail("unsafe_peer_diagnostics_environment");
  const start = performance.now(), end = start + 45000, workEnd = end - 10000;
  output(input.outputDir);
  const rootStat = lstatSync(input.outputDir);
  const root = { path: input.outputDir, dev: rootStat.dev, ino: rootStat.ino,
    birthtime_ms: rootStat.birthtimeMs, uid: rootStat.uid };
  const parentRow = await processRow(process.pid, workEnd), parent = identity(parentRow);
  const caseId = randomBytes(16).toString("hex");
  const secrets = CASES.map(() => randomBytes(32).toString("hex")); // Never written to any receipt/argv.
  const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
  const source = inspectedMetaSourcePins(), sourceHash = hash(readFileSync(ENTRY));
  const commands = Object.fromEntries(["launcher", "sibling"].map(role =>
    [role, [process.execPath, ENTRY, "--peer-node", role, input.outputDir, caseId]]));
  const issuePath = join(input.outputDir, "issued.json");
  writeMetaPrivate(issuePath, { schema: "airlock.owned-node-rendezvous-issue.v1", at_ms: Date.now(),
    root, parent, case_id: caseId, source_sha256: sourceHash, source_pins: source, commands,
    absolute_duration_ms: 45000, cases: CASES.map((name, n) => ({ sequence: n + 1, name, correlation_sha256: hash(secrets[n]) })) });
  const issued = pin(issuePath), peers = [], sockets = new Set(), results = [], events = [], errors = [];
  let server, active = null, listenerPort = null;
  const recordEvent = (phase, value = {}) => {
    const path = join(input.outputDir, "event-" + String(events.length).padStart(3, "0") + ".json");
    writeMetaPrivate(path, { phase, at_ms: Date.now(), ...value }); events.push(pin(path));
  };
  try {
    server = createServer(socket => {
      sockets.add(socket); socket.on("error", () => {}); socket.once("close", () => sockets.delete(socket));
      if (!active || active.connected) { errors.push("unexpected_rendezvous_connection"); socket.destroy(); return; }
      const attempt = active; attempt.connected = true;
      const acceptedAt = Date.now();
      const observed = observe(socket, peers, Math.min(workEnd, performance.now() + 4000));
      observed.catch(() => {}); // Rejection is awaited/recorded below, not a passing default.
      let bytes = Buffer.alloc(0), timer;
      const frame = new Promise((resolve, reject) => {
        timer = setTimeout(() => resolve(null), 2000);
        socket.on("data", chunk => {
          bytes = Buffer.concat([bytes, chunk]);
          if (bytes.length > 2048) { reject(Error("rendezvous_frame_limit")); return; }
          const at = bytes.indexOf(10);
          if (at >= 0) {
            if (at !== bytes.length - 1) { reject(Error("rendezvous_extra_frame")); return; }
            try { resolve(json(bytes.subarray(0, at))); } catch { reject(Error("rendezvous_frame_invalid")); }
          }
        });
      });
      (async () => {
        const [observation, message] = await Promise.all([observed, frame]);
        const owners = [...new Set(observation.connections.filter(row => row.name === tupleName(observation.tuple)).map(row => row.pid))];
        let assessment = { accepted: false, reason: "frame_timeout", kernel_owner_pid: owners.length === 1 ? owners[0] : null,
          native_authority: false }, receivedDigest = null;
        if (message !== null) {
          record(message, ["case_id", "sequence", "claimed_pid", "correlation"]);
          if (message.case_id !== caseId || message.sequence !== attempt.sequence
            || typeof message.correlation !== "string" || !/^[a-f0-9]{64}$/.test(message.correlation))
            fail("rendezvous_frame_context");
          receivedDigest = hash(message.correlation);
          assessment = assessOwnedRendezvousPeer({ ...observation, expected: peers[0].identity,
            claimed_pid: message.claimed_pid, issued_correlation_sha256: hash(secrets[attempt.sequence - 1]),
            received_correlation_sha256: receivedDigest });
        }
        const value = { name: attempt.name, sequence: attempt.sequence, connected: true,
          accepted_at_ms: acceptedAt, observed_at_ms: Date.now(), observation, assessment,
          claimed_pid: message?.claimed_pid ?? null,
          issued_correlation_sha256: hash(secrets[attempt.sequence - 1]), received_correlation_sha256: receivedDigest };
        writeMetaPrivate(join(input.outputDir, "attempt-" + attempt.sequence + ".json"), value);
        socket.end(JSON.stringify({ accepted: assessment.accepted, reason: assessment.reason }) + "\n");
        attempt.resolve(value);
      })().catch(error => { socket.destroy(); attempt.reject(error); }).finally(() => clearTimeout(timer));
    });
    server.on("error", () => {});
    await until(new Promise((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    }), workEnd, "rendezvous_listen_deadline");
    listenerPort = server.address().port;
    const listenerText = await osCommand("/usr/sbin/lsof", ["-nP", "-a", "-p", String(process.pid),
      "-iTCP:" + listenerPort, "-sTCP:LISTEN", "-Fpn"], workEnd);
    if (!lsofConnections(listenerText, process.pid).some(row => row.name === "127.0.0.1:" + listenerPort))
      fail("rendezvous_listener_not_owned");
    const listenerPath = join(input.outputDir, "listener.json");
    writeMetaPrivate(listenerPath, { parent, root, port: listenerPort, at_ms: Date.now(), issued });
    for (const role of ["launcher", "sibling"]) {
      recordEvent("before-fork", { role, command: commands[role], issued });
      const child = spawn(process.execPath, commands[role].slice(1), { detached: true,
        stdio: ["ignore", "pipe", "pipe", "ipc"], env: { PATH: process.env.PATH, LC_ALL: "C" } });
      const peer = { role, child, pid: child.pid, identity: null, exit: null, closed: new Set(), acknowledgements: new Set() };
      peers.push(peer);
      let ownerReady;
      const ready = new Promise(resolve => { ownerReady = resolve; });
      child.once("exit", (code, signal) => { peer.exit = { code, signal, at_ms: Date.now() }; });
      child.once("error", error => errors.push(error.code ?? "peer_spawn_error"));
      let outputBytes = 0;
      for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
        outputBytes += chunk.length;
        if (outputBytes > 4096) errors.push("peer_output_limit");
      });
      child.on("message", value => {
        if (value?.type === "owner-ready" && value.role === role) ownerReady();
        else if (value?.type === "owner-acknowledged" && value.role === role) peer.acknowledged = true;
        else if (value?.type === "attempt-closed" && Number.isInteger(value.sequence)) peer.closed.add(value.sequence);
        else errors.push("peer_ipc_invalid");
      });
      recordEvent("spawn-issued", { role, pid: peer.pid, issued });
      await until(ready, Math.min(workEnd, performance.now() + 5000), "peer_owner_ready_deadline");
      const actual = await processRow(peer.pid, workEnd);
      if (!actual || actual.ppid !== process.pid || actual.pgid !== peer.pid || actual.uid !== process.getuid()
        || actual.command !== commands[role].join(" ") || !live(actual)) fail("peer_birth_image_unverified");
      peer.identity = identity(actual);
      recordEvent("owner-registered", { role, identity: peer.identity, issued });
      child.send({ type: "owner-ack", role, issued_sha256: issued.sha256, listener: pin(listenerPath),
        launcher_pid: peers[0].pid });
      while (!peer.acknowledged && !peer.exit) {
        remaining(workEnd); await sleep(10);
      }
      if (!peer.acknowledged) fail("peer_owner_ack_failed");
      recordEvent("owner-acknowledged", { role, identity: peer.identity });
    }
    for (const [n, name] of CASES.entries()) {
      if (errors.length) fail("rendezvous_protocol_error");
      const sequence = n + 1, actor = [2, 3].includes(sequence) ? peers[1] : peers[0];
      let accept, reject;
      const done = new Promise((resolve, fail) => { accept = resolve; reject = fail; });
      active = { name, sequence, connected: false, resolve: accept, reject };
      recordEvent("before-connect", { name, sequence, actor: actor.identity,
        correlation_sha256: hash(secrets[n]) });
      const secret = sequence === 4 ? (secrets[n][0] === "a" ? "b" : "a") + secrets[n].slice(1) : secrets[n];
      actor.child.send({ type: "attempt", sequence, correlation: secret });
      const value = await until(done, Math.min(workEnd, performance.now() + 5000), "rendezvous_attempt_deadline");
      while (!actor.closed.has(sequence)) { remaining(workEnd); await sleep(10); }
      results.push(value); active = null;
    }
  } catch (error) { errors.push(error.message); }
  // Admission is now sealed. Cleanup does not depend on child TCP/graceful
  // promises; signals, if required, revalidate only these exact issued PIDs.
  active = null;
  for (const socket of sockets) socket.destroy();
  let listenerClosed = !server;
  if (server) {
    try {
      await until(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
        end - 6000, "rendezvous_listener_close_deadline");
      listenerClosed = true;
    } catch (error) { errors.push(error.message); }
  }
  const children = [];
  for (const peer of peers) {
    try { children.push(await stopPeer(peer, end - 3000)); }
    catch (error) { errors.push(error.message); children.push({ role: peer.role, pid: peer.pid, final: "unknown", exit: peer.exit }); }
  }
  const groups = [];
  for (const peer of peers) {
    try {
      const text = await osCommand("/bin/ps", ["-g", String(peer.pid), "-ww", "-o", "pid=,uid=,stat="], end - 2000);
      const members = text.trim() ? text.trim().split("\n").map(line => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)$/);
        if (!match) fail("rendezvous_group_shape");
        return { pid: +match[1], uid: +match[2], state: match[3] };
      }) : [];
      groups.push({ pgid: peer.pid, members, closed: members.every(row =>
        row.pid === peer.pid && row.uid === process.getuid() && row.state.startsWith("Z")) });
    } catch (error) {
      errors.push(error.message); groups.push({ pgid: peer.pid, closed: false, observation: "unknown" });
    }
  }
  let kernelListenerClosed = listenerPort === null;
  try {
    if (listenerPort !== null) {
      const listenerAfter = await osCommand("/usr/sbin/lsof", ["-nP", "-a", "-p", String(process.pid),
        "-iTCP:" + listenerPort, "-sTCP:LISTEN", "-Fpn"], end - 2000);
      kernelListenerClosed = !lsofConnections(listenerAfter, process.pid)
        .some(row => row.name === "127.0.0.1:" + listenerPort);
    }
  } catch (error) { errors.push(error.message); }
  const expectedOwners = [peers[0]?.pid, peers[1]?.pid, peers[1]?.pid, peers[0]?.pid, peers[0]?.pid];
  const expectedReasons = ["owned_peer", "peer_owner_mismatch", "peer_owner_mismatch", "correlation_mismatch", "frame_timeout"];
  const matched = results.length === 5 && results.every((value, n) => value.connected
    && value.assessment.kernel_owner_pid === expectedOwners[n]
    && value.assessment.reason === expectedReasons[n] && value.assessment.accepted === (n === 0));
  const closed = listenerClosed && kernelListenerClosed && sockets.size === 0 && children.length === 2
    && children.every(peer => peer.command_exit_observed && peer.exit?.code === 0 && ["absent", "zombie"].includes(peer.final))
    && groups.every(group => group.closed);
  let sourceAfter = null;
  try { sourceAfter = inspectedMetaSourcePins(); } catch { errors.push("rendezvous_source_after_unavailable"); }
  const elapsed = Math.ceil(performance.now() - start);
  const report = { schema: "airlock.owned-rendezvous-peer-feasibility.v1", issued, events, parent, root,
    source_before: source, source_after: sourceAfter, cases: results, children, groups,
    listener: { port: listenerPort, closed: listenerClosed, kernel_listener_closed: kernelListenerClosed },
    accepted_sockets_closed: sockets.size === 0,
    resource_disposition: closed ? "closed" : "unknown", elapsed_ms: elapsed, errors,
    witnessed: matched && closed && !errors.length && JSON.stringify(source) === JSON.stringify(sourceAfter) && elapsed < 45000,
    correlation_material_retained: false, native_qualified: false, native_sdk_executed: false,
    public_provider_requests: 0, actual_owner_slots_reserved: 0, profiles_or_browsers_created: 0,
    producer_exit_observed: false };
  writeMetaPrivate(join(input.outputDir, "report.json"), report);
  remaining(end, 1);
  if (!report.witnessed) fail("rendezvous_feasibility_unqualified");
  return report;
}

async function fixedPeerNode(role, root, caseId) {
  if (!process.send || !process.connected || !["launcher", "sibling"].includes(role)) fail("invalid_fixed_peer");
  const issuedBytes = readMetaPrivate(join(root, "issued.json"), 65536), issued = json(issuedBytes);
  if (issued.case_id !== caseId || issued.parent.pid !== process.ppid || issued.parent.uid !== process.getuid()
    || issued.source_sha256 !== hash(readFileSync(ENTRY))) fail("fixed_peer_issue_mismatch");
  const sockets = new Set(), attempted = new Set();
  let armed = false, stopping = false, listenerPort, launcherPid;
  const finish = code => {
    if (stopping) return;
    stopping = true; clearTimeout(watchdog); clearTimeout(ackTimer);
    for (const socket of sockets) socket.destroy();
    if (process.connected) process.disconnect();
    process.exitCode = code;
  };
  const watchdog = setTimeout(() => finish(2), 35000);
  const ackTimer = setTimeout(() => finish(2), 5000);
  process.once("disconnect", () => { if (!stopping) finish(2); });
  process.on("message", message => {
    try {
      if (message?.type === "owner-ack" && !armed) {
        if (message.role !== role || message.issued_sha256 !== hash(issuedBytes)) fail("fixed_peer_ack_mismatch");
        const listenerBytes = readMetaPrivate(message.listener.path, 65536), listener = json(listenerBytes);
        if (hash(listenerBytes) !== message.listener.sha256 || listener.parent.pid !== process.ppid
          || listener.root.path !== root || !Number.isInteger(listener.port) || listener.port < 1 || listener.port > 65535)
          fail("fixed_peer_listener_mismatch");
        listenerPort = listener.port; launcherPid = message.launcher_pid;
        armed = true; clearTimeout(ackTimer); process.send({ type: "owner-acknowledged", role }); return;
      }
      if (message?.type === "stop") { finish(0); return; }
      if (message?.type !== "attempt" || !armed || !Number.isInteger(message.sequence)
        || attempted.has(message.sequence) || !(role === "launcher" ? [1, 4, 5] : [2, 3]).includes(message.sequence)
        || typeof message.correlation !== "string" || !/^[a-f0-9]{64}$/.test(message.correlation))
        fail("fixed_peer_command_invalid");
      const sequence = message.sequence; attempted.add(sequence);
      const socket = connect({ host: "127.0.0.1", port: listenerPort });
      sockets.add(socket); socket.on("error", () => finish(2));
      socket.once("close", () => { sockets.delete(socket); if (process.connected) process.send({ type: "attempt-closed", sequence }); });
      socket.on("data", () => {}); socket.on("end", () => socket.end());
      socket.once("connect", () => {
        if (sequence !== 5) socket.write(JSON.stringify({ case_id: caseId, sequence,
          claimed_pid: sequence === 3 ? launcherPid : process.pid, correlation: message.correlation }) + "\n");
      });
    } catch { finish(2); }
  });
  process.send({ type: "owner-ready", role });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length === 4 && args[0] === "--peer-node") await fixedPeerNode(args[1], args[2], args[3]);
  else if (args.length === 3 && args[0] === "--qualify-owned-peer" && args[1] === "--output-dir") {
    await runOwnedRendezvousPeerFeasibility({ outputDir: args[2] });
    console.log("owned_node_tcp_rendezvous_witnessed; native_qualified=false");
  } else fail("invalid_owned_peer_options");
}
