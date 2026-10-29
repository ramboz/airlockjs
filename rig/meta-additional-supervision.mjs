import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, rmSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";

const execute = promisify(execFile), hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ENTRY = fileURLToPath(new URL("./meta-additional-qualification.mjs", import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LAUNCHER = fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url));
const POLICY = fileURLToPath(new URL("./qualification-loopback-network.sb", import.meta.url));
const fail = reason => { throw Error(reason); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const handle = path => ({ path, sha256: hash(readMetaPrivate(path)) });
const identity = ({ command: _command, ...row }) => row;
export function sameAdditionalProcess(expected, current) {
  return !!expected && !!current && ["pid", "pgid", "uid", "started", "command_sha256"]
    .every(key => expected[key] === current[key]);
}
const zombie = (expected, row) => !!row && row.state.startsWith("Z")
  && ["pid", "pgid", "uid", "started"].every(key => expected[key] === row[key]);
function check(deadline) { if (performance.now() >= deadline) fail("additional_supervision_deadline"); }
async function command(path, args, deadline) {
  check(deadline);
  try {
    return (await execute(path, args, { timeout: Math.max(1, Math.min(1000, deadline - performance.now())),
      killSignal: "SIGKILL", maxBuffer: 2097152, env: { ...process.env, LC_ALL: "C" } })).stdout;
  } catch (error) {
    if (error.code === 1 && error.stdout === "" && error.stderr === "") return "";
    throw error;
  }
}
// Inline mirror of 059-16's Darwin lifetime/group/image checks. No global
// process catalogue or name-based signals: inspect only exact PIDs/groups.
async function rows(ids, deadline, groups = true) {
  if (!ids.length) return [];
  const stdout = await command("/bin/ps", [groups ? "-g" : "-p", ids.join(","), "-ww",
    "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="], deadline);
  return stdout.trim() ? stdout.trim().split("\n").map(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+(.+)$/);
    if (!match) fail("additional_process_shape");
    return { pid: +match[1], ppid: +match[2], pgid: +match[3], uid: +match[4],
      started: match[5], state: match[6], command: match[7], command_sha256: hash(match[7]) };
  }) : [];
}
function profileIdentity(argument_path) {
  const path = realpathSync(argument_path), stat = lstatSync(path);
  if (dirname(path) !== realpathSync(tmpdir())
    || !/^playwright_chromiumdev_profile-[A-Za-z0-9]+$/.test(path.split("/").at(-1))
    || !stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o777) !== 0o700) fail("additional_profile_identity");
  return { argument_path, path, dev: stat.dev, ino: stat.ino, birthtime_ms: stat.birthtimeMs, uid: stat.uid };
}
async function signalOwned(expected, signal, deadline, log) {
  const current = (await rows([expected.pid], deadline, false))[0];
  if (!current || zombie(expected, current)) { log.push({ pid: expected.pid, signal, outcome: "vanished" }); return; }
  if (!sameAdditionalProcess(expected, current)) fail("additional_process_replaced");
  let outcome = "sent";
  try { process.kill(expected.pid, signal); }
  catch (error) { if (error.code === "ESRCH") outcome = "vanished"; else throw error; }
  log.push({ pid: expected.pid, signal, outcome, at_ms: Date.now() });
}
function assertKnownMembers(item, current) {
  for (const known of item.members.values()) {
    const observed = current.find(row => row.pid === known.pid);
    if (observed && !sameAdditionalProcess(known, observed) && !zombie(known, observed)) {
      const error = Error("additional_process_replaced"); error.observed = current; throw error;
    }
  }
}
function membersOf(item, current) {
  assertKnownMembers(item, current);
  if (current.length && !current.some(row => [...item.members.values()]
    .some(known => sameAdditionalProcess(known, row) || zombie(known, row)))) fail("additional_group_unanchored");
  for (const row of current) {
    if ([...item.members.values()].some(known => zombie(known, row))) continue;
    if (row.uid !== item.root.uid || row.pgid !== item.root.pgid
      || !(row.command.startsWith("/Applications/Google Chrome.app/Contents/")
        || row.ppid === item.root.pid && row.command === "/usr/bin/profiles status -type enrollment"
        || row.pid === item.root.pid && !item.chromeReady && browserImage(row.command))) {
      // Only already-tracked, unchanged members may use their recorded identity.
      if (item.members.has(row.pid)) continue;
      const error = Error("additional_group_identity"); error.observed = current; throw error;
    }
    if (item.members.size >= 64 && !item.members.has(row.pid)) fail("additional_process_limit");
    if (!item.members.has(row.pid)) item.members.set(row.pid, identity(row));
  }
  return [...item.members.values()].map(known => {
    const row = current.find(row => row.pid === known.pid);
    return { ...known, final: !row ? "absent" : zombie(known, row) ? "zombie"
      : sameAdditionalProcess(known, row) ? "live" : "replaced" };
  });
}
function browserImage(command) {
  if (command.startsWith(CHROME + " ")) return "chrome";
  if (command.startsWith("/bin/sh " + LAUNCHER + " ") || command.startsWith(LAUNCHER + " ")
    || command.startsWith("/usr/bin/sandbox-exec -f " + POLICY + " " + CHROME + " ")) return "launcher";
  return null;
}
async function portClosed(port) {
  return new Promise(resolve => {
    const socket = connect({ host: "127.0.0.1", port });
    let done = false;
    const finish = value => { if (!done) { done = true; socket.destroy(); resolve(value); } };
    socket.once("connect", () => finish(false));
    socket.once("error", error => finish(error.code === "ECONNREFUSED"));
    socket.setTimeout(200, () => finish(false));
  });
}
async function closeBrowser(item, deadline, uncertain) {
  const result = { root: item.root, root_command: item.root_command, profile: item.profile, processes: [], signals: [],
    profile_removed: false, status: "unknown", errors: [] };
  const observe = async () => {
    assertKnownMembers(item, await rows([...item.members.keys()], deadline, false));
    return membersOf(item, await rows([item.root.pgid], deadline));
  };
  try {
    let states = await observe();
    result.initially_left_behind = states.some(row => row.final === "live");
    if (uncertain) {
      result.processes = states;
      fail("additional_browser_ownership_unknown");
    }
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      for (const member of states.filter(row => row.final === "live"))
        await signalOwned(member, signal, deadline, result.signals);
      const settle = Math.min(deadline, performance.now() + 500);
      do {
        states = await observe();
        if (states.every(row => ["absent", "zombie"].includes(row.final))) break;
        await sleep(25);
      } while (performance.now() < settle);
      if (states.every(row => ["absent", "zombie"].includes(row.final))) break;
    }
    result.processes = states;
    if (states.some(row => !["absent", "zombie"].includes(row.final))) fail("additional_browser_closure_unknown");
    if (existsSync(item.profile.path)) {
      if (!equal(profileIdentity(item.profile.argument_path), item.profile)) fail("additional_profile_replaced");
      check(deadline); rmSync(item.profile.path, { recursive: true });
    }
    result.profile_removed = !existsSync(item.profile.path);
    if (!result.profile_removed) fail("additional_profile_closure_unknown");
    result.status = "closed";
  } catch (error) {
    result.errors.push(error.message);
    if (Array.isArray(error.observed)) result.error_observation = {
      complete: error.observed.length <= 64,
      rows: error.observed.slice(0, 64).map(identity),
    };
  }
  return result;
}
function privateOutput(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) fail("invalid_supervision_output");
  for (let parent = dirname(path);;) {
    const stat = lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink() || parent === dirname(path)
      && (stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700)) fail("invalid_supervision_output");
    if (parent === dirname(parent)) break;
    parent = dirname(parent);
  }
  mkdirSync(path, { mode: 0o700 });
  for (const directory of [path, dirname(path)]) {
    const fd = openSync(directory, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
}

/** Fixed child only; no arbitrary driver, URL, clock, executable or timer.
 * Each child gets <=59 s, including TERM/KILL, resource proof and fsynced
 * receipts. Work stops at 40 s (8 s for the genuine stuck-shutdown control).
 * Unknown ownership/closure is durable and unqualified, never silently closed. */
export async function superviseAdditionalMetaChild(options) {
  const input = record(options, ["manifest_path", "manifest_sha256", "protocol", "output_dir"], ["control"]);
  const control = input.control ?? "normal", start = performance.now(), started_ms = Date.now();
  if (!["normal", "stuck-shutdown"].includes(control) || !["h1", "h2"].includes(input.protocol)
    || typeof input.manifest_path !== "string" || !input.manifest_path.startsWith(resolve("rig/out") + "/059-18-additional-")
    || !/\/059-18-additional-[a-f0-9]{24}\/manifest\.json$/.test(input.manifest_path))
    fail("invalid_additional_supervision");
  const manifestBytes = readMetaPrivate(input.manifest_path);
  if (hash(manifestBytes) !== input.manifest_sha256) fail("stale_case_handle");
  const manifest = json(manifestBytes), end = start + Math.min(59000, manifest.binding.window.expires_at_ms - started_ms);
  if (end - start < 15000) fail("additional_supervision_reserve");
  privateOutput(input.output_dir);
  const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
  const source = inspectedMetaSourcePins(), args = [ENTRY, "--supervised-child", input.protocol, control,
    input.manifest_path, input.manifest_sha256], argv = [process.execPath, ...args];
  const owned = new Map(), ports = new Set(), keys = new Map(), pending = new Set(), registrations = [], node_signals = [], errors = [];
  let node = null, childExit = null, childClose = false, stdout = "", stderr = "", bytes = 0;
  let launchPending = false, ready = false, stuck = false, termObserved = false, timedOut = false;
  const persist = (phase, extra = {}) => {
    const path = join(input.output_dir, "registration-" + String(registrations.length).padStart(3, "0") + ".json");
    writeMetaPrivate(path, { phase, at_ms: Date.now(), node, ports: [...ports], private_keys: [...keys.values()],
      browsers: [...owned.values()].map(item => ({ root: item.root, root_command: item.root_command,
        profile: item.profile, members: [...item.members.values()] })),
      ...extra });
    registrations.push(handle(path));
  };
  writeMetaPrivate(join(input.output_dir, "start.json"), { command: argv, started_ms,
    absolute_seconds: 60, control, manifest: { path: input.manifest_path, sha256: input.manifest_sha256 }, source_pins: source });
  const child = spawn(process.execPath, args, { detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  child.once("exit", (actual_exit_code, signal) => { childExit = { actual_exit_code, signal, at_ms: Date.now() }; });
  child.once("close", () => { childClose = true; });
  child.once("error", error => { errors.push(error.code ?? "additional_child_spawn_failed"); });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    bytes += chunk.length;
    if (bytes <= 16384) { if (stream === child.stdout) stdout += chunk; else stderr += chunk; }
  });
  const nodeCurrent = async () => {
    const current = (await rows([child.pid], end - 4000, false))[0];
    if (current && !sameAdditionalProcess(node, current)) fail("additional_node_replaced");
    return current;
  };
  let discovery = Promise.resolve();
  const discover = () => {
    // Polling and browser-ready must each get a fresh, serialized inventory.
    // Do not coalesce callers or recover a rejected acquisition silently.
    discovery = discovery.then(async () => {
    if (!node || childExit) return;
    await nodeCurrent();
    // pgrep is parent-PID enumeration only, never a name lookup or kill.
    const children = (await command("/usr/bin/pgrep", ["-P", String(child.pid)], end - 5000))
      .trim().split(/\s+/).filter(Boolean).map(Number);
    if (children.some(pid => !Number.isSafeInteger(pid) || pid < 1) || children.length > 64)
      fail("additional_child_catalogue_invalid");
    const childrenRows = await rows(children, end - 5000, false);
    for (const row of childrenRows) {
      const tracked = owned.get(row.pid);
      if (tracked && !sameAdditionalProcess(tracked.root, row) && !zombie(tracked.root, row)) {
        const error = Error("additional_process_replaced"); error.observed = childrenRows; throw error;
      }
      if (row.ppid !== child.pid || row.uid !== process.getuid()) fail("additional_browser_parent_changed");
      const image = browserImage(row.command);
      if (!image) continue; // Other Node-owned cohort/OpenSSL subprocesses are not browser grants.
      const match = row.command.match(/(?:^| )--user-data-dir=(\S+)/);
      if (row.pgid !== row.pid || !match) fail("additional_browser_identity");
      if (!owned.has(row.pid)) {
        const item = { root: identity(row), root_command: row.command, profile: profileIdentity(match[1]),
          chromeReady: image === "chrome", members: new Map([[row.pid, identity(row)]]) };
        owned.set(row.pid, item);
        membersOf(item, await rows([row.pgid], end - 5000)); persist("browser-discovered");
      }
    }
    for (const item of owned.values()) membersOf(item, await rows([item.root.pgid], end - 5000));
    });
    return discovery;
  };
  const registerPorts = async values => {
    if (!Array.isArray(values) || values.length > 8
      || values.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) fail("additional_port_identity");
    await nodeCurrent();
    const listeners = await command("/usr/sbin/lsof", ["-nP", "-a", "-p", String(child.pid),
      "-iTCP", "-sTCP:LISTEN", "-Fn"], end - 5000);
    for (const port of values) {
      if (!listeners.split("\n").includes("n127.0.0.1:" + port)) fail("additional_port_not_owned");
      ports.add(port);
    }
    for (const name of ["inspector-key.pem", "receiver-key.pem"]) {
      const path = join(dirname(input.manifest_path), "run", name), stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.uid !== process.getuid()
        || (stat.mode & 0o7777) !== 0o600) fail("additional_private_key_identity");
      if (!keys.has(path)) keys.set(path, { path, dev: stat.dev, ino: stat.ino,
        birthtime_ms: stat.birthtimeMs, uid: stat.uid, size: stat.size });
    }
  };
  child.on("message", message => {
    const work = (async () => {
      const value = data(message);
      if (value.type === "additional-term-observed") { termObserved = true; persist("node-term-observed"); return; }
      if (value.type === "additional-ports") {
        await registerPorts(value.ports); persist("ports"); child.send({ type: "additional-ack", id: value.id }); return;
      }
      if (value.type === "additional-browser-pending") {
        launchPending = true; persist("browser-pending"); child.send({ type: "additional-ack", id: value.id }); return;
      }
      if (value.type === "additional-browser-ready") {
        await discover(); await registerPorts([value.port]);
        if (!owned.get(value.pid)?.chromeReady) fail("additional_browser_unregistered");
        ready = true; persist("browser-ready"); child.send({ type: "additional-ack", id: value.id }); return;
      }
      if (value.type === "additional-stuck-ready" && control === "stuck-shutdown") {
        const item = owned.get(value.pid);
        if (!ready || !item) fail("additional_stuck_ownership_missing");
        const path = join(dirname(input.manifest_path), "run/supervision-abort-originals.json");
        await signalOwned(item.root, "SIGSTOP", end - 5000, node_signals);
        const current = (await rows([item.root.pid], end - 5000, false))[0];
        if (!sameAdditionalProcess(item.root, current) || !current.state.includes("T")) fail("additional_browser_not_stopped");
        stuck = true; persist("stuck-after-allocation", { originals: handle(path), stopped_root: identity(current) }); return;
      }
      fail("additional_supervision_message");
    })().catch(error => {
      errors.push(error.message);
      if (error.observed) persist("ownership-mismatch", { observed: error.observed });
    }).finally(() => pending.delete(work));
    pending.add(work);
  });
  const workEnd = Math.min(start + (control === "normal" ? 40000 : 8000), end - 15000);
  try {
    while (!childExit && !node && performance.now() < Math.min(workEnd, start + 1500)) {
      const current = (await rows([child.pid], end - 5000, false))[0];
      if (current) {
        if (current.pgid !== child.pid || current.uid !== process.getuid() || current.ppid !== process.pid
          || current.command !== argv.join(" ")) fail("additional_node_identity");
        node = identity(current); persist("node");
      } else await sleep(10);
    }
    let last = 0;
    while (!childExit && performance.now() < workEnd && bytes <= 16384 && !errors.length) {
      if (launchPending && performance.now() - last > 200) { await discover(); last = performance.now(); }
      await sleep(20);
    }
    if (!childExit) {
      timedOut = performance.now() >= workEnd;
      if (!node) fail("additional_node_ownership_unknown");
      await signalOwned(node, "SIGTERM", end - 5000, node_signals);
      const grace = Math.min(end - 13000, performance.now() + 750);
      while (!childExit && performance.now() < grace) { await sleep(20); if (launchPending) await discover(); }
      if (!childExit) {
        // Freeze the specific verified Node before the final child inventory:
        // it cannot allocate an unregistered detached browser between scan/KILL.
        await signalOwned(node, "SIGSTOP", end - 5000, node_signals);
        if (launchPending) await discover();
        await signalOwned(node, "SIGKILL", end - 5000, node_signals);
      }
    }
  } catch (error) {
    errors.push(error.message);
    if (error.observed) persist("ownership-mismatch", { observed: error.observed });
    // Identity is rechecked by signalOwned; never fall back to an unattributed PID.
    if (node && !childExit) {
      try {
        await signalOwned(node, "SIGTERM", end - 5000, node_signals);
        const grace = Math.min(end - 13000, performance.now() + 750);
        while (!childExit && performance.now() < grace) await sleep(20);
        if (!childExit) {
          await signalOwned(node, "SIGSTOP", end - 5000, node_signals);
          if (launchPending) {
            try { await discover(); } catch (failure) { errors.push(failure.message); }
          }
          await signalOwned(node, "SIGKILL", end - 5000, node_signals);
        }
      }
      catch (failure) { errors.push(failure.message); }
    }
  }
  const exitDeadline = end - 11000;
  while (!childExit && performance.now() < exitDeadline) await sleep(10);
  // Do NOT await `close`: inherited pipes/Playwright shutdown may never close.
  child.stdout.destroy(); child.stderr.destroy();
  if (child.connected) child.disconnect();
  // A kernel-stalled/identity-changed child must not retain the supervisor's
  // event-loop handle after its finite observation budget. Such a handoff is
  // explicitly unknown/unqualified below, never a claim that the child exited.
  child.unref();
  while (pending.size && performance.now() < end - 10000) await sleep(10);
  if (pending.size) errors.push("additional_registration_unsettled");
  const exitedPath = join(input.output_dir, "actual-child-exit.json");
  writeMetaPrivate(exitedPath, { command: argv, command_exit_observed: !!childExit,
    actual_exit_code: childExit?.actual_exit_code ?? null, signal: childExit?.signal ?? null,
    exited_at_ms: childExit?.at_ms ?? null, elapsed_ms: Math.ceil(performance.now() - start), stdout, stderr });
  const browsers = [];
  for (const item of owned.values()) browsers.push(await closeBrowser(item, end - 4000, errors.length > 0));
  const portStates = await Promise.all([...ports].map(async port => ({ port, closed: await portClosed(port) })));
  const nodeStates = node ? await rows([node.pgid], end - 2500) : [];
  const nodeClosed = !!childExit && nodeStates.every(row => node && zombie(node, row));
  const privateKeys = [];
  for (const key of keys.values()) {
    const result = { ...key, removed: false };
    try {
      if (existsSync(key.path)) {
        const stat = lstatSync(key.path);
        if (errors.length || !nodeClosed || browsers.some(item => item.status !== "closed") || !stat.isFile() || stat.isSymbolicLink()
          || stat.dev !== key.dev || stat.ino !== key.ino || stat.birthtimeMs !== key.birthtime_ms
          || stat.uid !== key.uid || stat.size !== key.size || stat.nlink !== 1 || (stat.mode & 0o7777) !== 0o600)
          fail("additional_private_key_changed_or_in_use");
        check(end - 2500); unlinkSync(key.path);
        const fd = openSync(dirname(key.path), "r");
        try { fsyncSync(fd); } finally { closeSync(fd); }
      }
      result.removed = !existsSync(key.path);
    } catch (error) { result.error = error.message; }
    privateKeys.push(result);
  }
  for (const name of ["inspector-key.pem", "receiver-key.pem"]) {
    const path = join(dirname(input.manifest_path), "run", name);
    if (existsSync(path) && !keys.has(path)) {
      privateKeys.push({ path, removed: false, error: "additional_unregistered_private_key" });
      errors.push("additional_unregistered_private_key");
    }
  }
  const closed = errors.length === 0 && nodeClosed && !pending.size && browsers.every(item => item.status === "closed")
    && portStates.every(item => item.closed) && privateKeys.every(item => item.removed)
    && (!launchPending || ready && browsers.length === 1 && privateKeys.length === 2);
  // Evidence only: freeze the complete observed ownership ledger after cleanup,
  // including members acquired after browser-ready. No termination-policy change.
  persist("resources-final");
  const proof = { schema: "airlock.additional-meta-supervision.v1", command: argv, control,
    started_ms, elapsed_ms: Math.ceil(performance.now() - start), source_before: source,
    source_after: inspectedMetaSourcePins(), node, node_signals, node_close_observed: childClose,
    child_exit_observed: !!childExit, pipes_closed: child.stdout.destroyed && child.stderr.destroyed && !child.connected,
    actual_exit: handle(exitedPath), registrations, browsers, ports: portStates, private_keys: privateKeys,
    node_processes: nodeStates.map(row => ({ ...identity(row), final: zombie(node, row) ? "zombie" : "unknown" })),
    timed_out: timedOut, node_term_observed: termObserved, stuck_after_allocation_observed: stuck,
    resource_disposition: closed ? "closed" : "unknown", errors,
    qualified: control === "normal" && childExit?.actual_exit_code === 0 && childExit.signal === null
      && closed && ready && !timedOut && !errors.length && performance.now() < end - 1000 };
  check(end - 1000);
  const proofPath = join(input.output_dir, "supervision.json"); writeMetaPrivate(proofPath, proof);
  check(end);
  return { command: argv, command_exit_observed: !!childExit, actual_exit_code: childExit?.actual_exit_code ?? null,
    signal: childExit?.signal ?? null, elapsed_external_ms: Math.ceil(performance.now() - start), stdout, stderr,
    supervision: handle(proofPath) };
}

let sequence = 0;
async function register(message) {
  if (!process.send || !process.connected) fail("additional_supervisor_required");
  const id = ++sequence;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { process.off("message", receive); reject(Error("additional_registration_deadline")); }, 4000);
    const receive = value => {
      if (value?.type === "additional-ack" && value.id === id) {
        clearTimeout(timer); process.off("message", receive); resolve();
      }
    };
    process.on("message", receive);
    process.send({ ...message, id }, error => {
      if (error) { clearTimeout(timer); process.off("message", receive); reject(error); }
    });
  });
}
export const registerAdditionalPorts = ports => register({ type: "additional-ports", ports });
export const registerAdditionalPending = () => register({ type: "additional-browser-pending" });
export const registerAdditionalBrowser = server => register({ type: "additional-browser-ready",
  pid: server.process().pid, port: Number(new URL(server.wsEndpoint()).port) });
// Observations/signals only. Callers must establish their own closed case authority.
export { rows as readAdditionalProcesses, signalOwned as signalAdditionalOwnedProcess,
  membersOf as inspectAdditionalBrowserMembers };
export async function holdAdditionalShutdown(pid) {
  if (!process.send) fail("additional_supervisor_required");
  process.on("SIGTERM", () => process.send({ type: "additional-term-observed" }));
  process.send({ type: "additional-stuck-ready", pid });
  await new Promise(() => {}); // Only the finite, identity-checked parent owns termination.
}
