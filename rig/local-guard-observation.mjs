import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import host from "node:process";
import { record, data, equal, json } from "./inspected-meta-record.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { inspectAdditionalBrowserMembers, readAdditionalProcesses, sameAdditionalProcess,
  signalAdditionalOwnedProcess } from "./meta-additional-supervision.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = reason => { throw Error(reason); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const handle = path => ({ path, sha256: hash(readMetaPrivate(path)) });
export const localGuardSourceDigest = pins => hash(JSON.stringify(data(pins)));
function directory(path) {
  const stat = lstatSync(path);
  if (resolve(path) !== path || realpathSync(path) !== path || !stat.isDirectory() || stat.isSymbolicLink() ||
    stat.uid !== host.getuid() || (stat.mode & 0o7777) !== 0o700) fail("local_guard_directory");
}
function publish(path, value) {
  if (Buffer.byteLength(JSON.stringify(value)) + 1 > 262144) fail("local_guard_publication_bound");
  writeMetaPrivate(path, value);
  // The fsynced original is complete before this zero-byte publication signal.
  writeFileSync(path + ".published", "", { flag: "wx", mode: 0o600, flush: true });
  return handle(path);
}
function published(path) {
  try { lstatSync(path + ".published"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  if (readMetaPrivate(path + ".published", 1).length !== 0) fail("local_guard_publication");
  return json(readMetaPrivate(path, 262144));
}
function boundedWindow(window) {
  record(window, ["not_before_ms", "expires_at_ms"]);
  if (![window.not_before_ms, window.expires_at_ms].every(Number.isSafeInteger) ||
    window.expires_at_ms <= window.not_before_ms ||
    window.expires_at_ms - window.not_before_ms > 60000) fail("local_guard_window");
}
function active(window) {
  boundedWindow(window);
  if (Date.now() < window.not_before_ms || Date.now() >= window.expires_at_ms) fail("local_guard_window");
}
function profileIdentity(command, startedAt) {
  const matches = [...command.matchAll(/(?:^| )--user-data-dir=(\S+)/g)];
  if (matches.length !== 1) fail("local_guard_profile_identity");
  const argument_path = matches[0][1], path = realpathSync(argument_path), stat = lstatSync(path);
  if (dirname(path) !== realpathSync(tmpdir()) ||
    !/^playwright_chromiumdev_profile-[A-Za-z0-9]+$/.test(path.split("/").at(-1)) ||
    !stat.isDirectory() || lstatSync(argument_path).isSymbolicLink() || stat.uid !== host.getuid() ||
    (stat.mode & 0o7777) !== 0o700 || stat.birthtimeMs < startedAt - 1000)
    fail("local_guard_profile_identity");
  return { path, argument_path, dev: stat.dev, ino: stat.ino, birthtime_ms: stat.birthtimeMs, uid: stat.uid };
}

let inventorySequence = 0;
/** Fixed scoped command. A failed/partial inventory is never resource absence. */
export function readLocalGuardListeners(options) {
  const { pids, directory: output } = record(data(options), ["pids", "directory"]);
  directory(output);
  if (!Array.isArray(pids) || !pids.length || pids.length > 64 ||
    pids.some(pid => !Number.isSafeInteger(pid) || pid < 1)) fail("local_guard_inventory_pids");
  if (inventorySequence >= 256) fail("local_guard_inventory_budget");
  const command = ["/usr/sbin/lsof", "-nP", "-a", "-p", [...new Set(pids)].join(","),
    "-iTCP", "-sTCP:LISTEN", "-Fpn"];
  const started = performance.now();
  let result;
  try { result = spawnSync(command[0], command.slice(1), { timeout: 1000, maxBuffer: 65536 }); }
  catch (error) {
    result = { error, status: error.status ?? null, signal: error.signal ?? null,
      stdout: error.stdout ?? null, stderr: error.stderr ?? null };
  }
  const stdout = result.stdout == null ? null : Buffer.from(result.stdout);
  const stderr = result.stderr == null ? null : Buffer.from(result.stderr);
  const original = result.error ?? (result.status !== 0 || result.signal != null
    ? Object.assign(Error("local_guard_listener_inventory_failed"), {
      status: result.status, signal: result.signal, stdout, stderr,
    }) : null);
  const noListeners = result.status === 1 && result.signal == null && original?.killed !== true &&
    original?.code == null && stdout?.length === 0 && stderr?.length === 0;
  const receipt = {
    schema: "airlock.local-guard-listener-observation.v1", command, elapsed_ms: performance.now() - started,
    status: result.status ?? null, signal: result.signal ?? null,
    code: original?.code ?? null, killed: original?.killed ?? null,
    stdout_base64: stdout === null ? null : stdout.toString("base64"),
    stderr_base64: stderr === null ? null : stderr.toString("base64"),
    output_complete: Number.isInteger(result.status) && result.signal == null && original?.killed !== true &&
      stdout !== null && stderr !== null && !["ENOBUFS", "ETIMEDOUT"].includes(original?.code) &&
      (stdout?.length ?? 0) < 65536 && (stderr?.length ?? 0) < 65536,
    outcome: original && !noListeners ? "failed" : noListeners ? "no_listeners" : "observed",
    qualification: false,
  };
  const path = join(output, "listener-observation-" + host.pid + "-" + inventorySequence++ + ".json");
  try { writeMetaPrivate(path, receipt); }
  catch (error) {
    if (original) throw new AggregateError([original, error], "local_guard_inventory_persistence_failed", { cause: error });
    throw error;
  }
  const reference = handle(path);
  if (original && !noListeners) { original.guard_observation = reference; throw original; }
  return { stdout: stdout?.toString("utf8") ?? "", receipt: reference };
}

/** Callers provide already verified identities; listener discovery is deliberately absent. */
export async function stopLocalGuardKnownNodes(options) {
  const { nodes, deadline } = record(data(options), ["nodes", "deadline"]);
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 64 || !Number.isFinite(deadline) ||
    nodes.some(node => !Number.isSafeInteger(node.pid) || node.pid < 1 || node.pid === host.pid ||
      node.uid !== host.getuid()))
    fail("local_guard_cleanup_targets");
  const signals = [], errors = [];
  const attempt = async (node, signal) => {
    try { await signalAdditionalOwnedProcess(node, signal, deadline, signals); }
    catch (error) { errors.push(error.message); }
  };
  for (const node of [...nodes].reverse()) {
    await attempt(node, "SIGTERM");
    await attempt(node, "SIGCONT");
  }
  await sleep(Math.max(0, Math.min(200, deadline - performance.now())));
  for (const node of [...nodes].reverse()) await attempt(node, "SIGKILL");
  let processes = null;
  try { processes = await readAdditionalProcesses(nodes.map(node => node.pid), deadline, false); }
  catch (error) { errors.push(error.message); }
  const closed = processes !== null && processes.every(row => row.state.startsWith("Z") &&
    nodes.some(node => ["pid", "pgid", "uid", "started"].every(key => node[key] === row[key])));
  return { status: closed && !errors.length ? "closed" : "unknown", signals, errors, processes,
    qualification: false };
}

/** SDK-absent producers use this only when the fixed local observer flag is enabled. */
export async function beginLocalGuardRegistration(options) {
  const { directory: output, source_sha256, window } = record(data(options), ["directory", "source_sha256", "window"]);
  directory(output); active(window);
  if (!digest(source_sha256)) fail("local_guard_source");
  const end = performance.now() + Math.min(4000, window.expires_at_ms - Date.now());
  const controller = (await readAdditionalProcesses([host.pid], end, false))[0];
  if (!controller || controller.pid !== host.pid || controller.uid !== host.getuid()) fail("local_guard_controller");
  active(window);
  const pending = publish(join(output, "guard-browser-pending.json"), {
    schema: "airlock.local-guard-browser-pending.v1", directory: output, source_sha256, window,
    controller, at_ms: Date.now(), qualification: false,
  });
  return {
    async ready(server) {
      active(window);
      const browserPid = server.process().pid;
      if (!Number.isSafeInteger(browserPid) || browserPid < 1 || browserPid === controller.pid)
        fail("local_guard_browser_identity");
      const ready = publish(join(output, "guard-browser-ready.json"), {
        schema: "airlock.local-guard-browser-ready.v1", pending, browser_pid: browserPid,
        at_ms: Date.now(), qualification: false,
      });
      const deadline = performance.now() + Math.min(4000, window.expires_at_ms - Date.now());
      while (performance.now() < deadline) {
        const ack = published(join(output, "guard-browser-ack.json"));
        if (ack) {
          active(window);
          record(ack, ["schema", "pending", "ready", "source_sha256", "controller", "browser", "observer",
            "profile", "group_observations", "members", "independent", "qualification", "at_ms"]);
          if (ack.schema !== "airlock.local-guard-browser-observed.v1" || ack.qualification !== false ||
            !equal(ack.pending, pending) || !equal(ack.ready, ready) ||
            ack.source_sha256 !== source_sha256 || ack.independent !== true ||
            ack.browser.pid !== browserPid || !sameAdditionalProcess(controller, ack.controller) ||
            ack.observer.pid === controller.pid || ack.observer.pid === browserPid ||
            ack.observer.uid !== controller.uid) fail("local_guard_ack_invalid");
          const current = (await readAdditionalProcesses([ack.observer.pid], deadline, false))[0];
          if (!sameAdditionalProcess(ack.observer, current)) fail("local_guard_observer_changed");
          return { pending, ready, acknowledgement: handle(join(output, "guard-browser-ack.json")) };
        }
        await sleep(20);
      }
      fail("local_guard_registration_deadline");
    },
  };
}

/** Independent observer: validate real current lifetimes before publishing any release. */
export async function acknowledgeLocalGuardRegistration(options) {
  const { directory: output, source_sha256, controller, deadline, release } =
    record(data(options), ["directory", "source_sha256", "controller", "deadline", "release"]);
  directory(output);
  if (!digest(source_sha256) || !Number.isFinite(deadline) || typeof release !== "boolean")
    fail("local_guard_observer_input");
  const pendingPath = join(output, "guard-browser-pending.json"), pending = published(pendingPath);
  if (!pending) return { status: "pending" };
  const readyPath = join(output, "guard-browser-ready.json"), ready = published(readyPath);
  if (!ready) return { status: "pending" };
  boundedWindow(pending.window);
  if (release) active(pending.window);
  if (pending.schema !== "airlock.local-guard-browser-pending.v1" || pending.directory !== output ||
    pending.source_sha256 !== source_sha256 || pending.qualification !== false ||
    !sameAdditionalProcess(pending.controller, controller) || ready.qualification !== false ||
    ready.schema !== "airlock.local-guard-browser-ready.v1" || !equal(ready.pending, handle(pendingPath)))
    fail("local_guard_case_changed");
  const current = await readAdditionalProcesses([controller.pid, ready.browser_pid, host.pid], deadline, false);
  const actualController = current.find(row => row.pid === controller.pid);
  const browser = current.find(row => row.pid === ready.browser_pid), observer = current.find(row => row.pid === host.pid);
  if (!sameAdditionalProcess(controller, actualController)) fail("local_guard_controller_changed");
  if (!browser || browser.ppid !== controller.pid || browser.uid !== controller.uid || browser.pgid !== browser.pid ||
    !browser.command.startsWith("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome "))
    fail("local_guard_browser_identity");
  if (!observer || observer.pid === controller.pid || observer.pid === browser.pid || observer.uid !== controller.uid)
    fail("local_guard_observer_identity");
  const profile = profileIdentity(browser.command, pending.at_ms);
  const item = { root: browser, root_command: browser.command, profile, chromeReady: true,
    members: new Map([[browser.pid, browser]]) };
  const group = await readAdditionalProcesses([browser.pgid], deadline, true);
  try { inspectAdditionalBrowserMembers(item, group); }
  catch (error) {
    const bytes = Buffer.from(JSON.stringify(group));
    const rejection = { schema: "airlock.local-guard-browser-rejected.v1",
      pending: handle(pendingPath), ready: handle(readyPath), source_sha256, controller, browser, profile,
      category: error.message, group_observations: bytes.length <= 131072 ? group : null,
      group_sha256: hash(bytes), group_bytes: bytes.length, exact: bytes.length <= 131072,
      signal_authority: false, qualification: false, at_ms: Date.now() };
    const path = join(output, "guard-browser-rejected.json");
    try { writeMetaPrivate(path, rejection); error.guard_observation = handle(path); }
    catch (failure) { throw new AggregateError([error, failure], "local_guard_rejection_persistence_failed", { cause: failure }); }
    throw error;
  }
  const body = { schema: "airlock.local-guard-browser-observed.v1", pending: handle(pendingPath),
    ready: handle(readyPath), source_sha256, controller: actualController, browser, observer, profile,
    group_observations: group, members: [...item.members.values()], independent: true,
    qualification: false, at_ms: Date.now() };
  const observedPath = join(output, "guard-browser-observed.json"), previous = published(observedPath);
  if (previous) {
    if (!equal(previous.pending, body.pending) || !equal(previous.ready, body.ready) ||
      previous.source_sha256 !== source_sha256 || !sameAdditionalProcess(previous.browser, browser) ||
      !equal(previous.profile, profile)) fail("local_guard_observation_changed");
  } else publish(observedPath, body);
  if (release) {
    active(pending.window);
    const ackPath = join(output, "guard-browser-ack.json"), ack = published(ackPath);
    if (ack) {
      if (!equal(ack.pending, body.pending) || !equal(ack.ready, body.ready) ||
        !sameAdditionalProcess(ack.browser, browser) || ack.source_sha256 !== source_sha256)
        fail("local_guard_ack_invalid");
    } else publish(ackPath, body);
  }
  return { status: release ? "registered" : "observed", item, proof: handle(join(output, "guard-browser-observed.json")) };
}
