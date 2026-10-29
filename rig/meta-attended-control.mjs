import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, realpathSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import host from "node:process";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { inspectAdditionalBrowserMembers, readAdditionalProcesses, sameAdditionalProcess,
  signalAdditionalOwnedProcess } from "./meta-additional-supervision.mjs";

const ENTRY = fileURLToPath(new URL("./meta-attended-reference.mjs", import.meta.url));
const STOP_ENTRY = fileURLToPath(new URL("./meta-attended-stop.mjs", import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = reason => { throw new Error(reason); };
const requireFact = (value, reason) => { if (!value) fail(reason); };
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const identity = ({ command: _command, state: _state, ...row }) => row;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const modes = ["--native", "--local-h1", "--local-h2", "--local-owner-stop"];
const handle = path => ({ path, sha256: hash(readMetaPrivate(path, 65536)) });
function absolute(path) {
  requireFact(typeof path === "string" && isAbsolute(path) && resolve(path) === path &&
    !/[\s\0]/.test(path), "attended_case_path");
  return path;
}
function directory(path) {
  absolute(path);
  const stat = lstatSync(path);
  requireFact(stat.isDirectory() && !stat.isSymbolicLink() && realpathSync(path) === path &&
    stat.uid === host.getuid() && (stat.mode & 0o7777) === 0o700, "attended_case_directory");
  return { path, dev: stat.dev, ino: stat.ino, birthtime_ms: stat.birthtimeMs, uid: stat.uid };
}
function readHandle(value) {
  const h = record(value, ["path", "sha256"]);
  absolute(h.path); requireFact(digest(h.sha256), "attended_case_digest");
  const before = lstatSync(h.path), bytes = readMetaPrivate(h.path, 65536), after = lstatSync(h.path);
  requireFact(["dev", "ino", "size", "mtimeMs", "ctimeMs"].every(k => before[k] === after[k]) &&
    hash(bytes) === h.sha256, "attended_case_changed");
  return json(bytes);
}
function manifestContext(manifest, output, source, bindingDigest, command) {
  requireFact(manifest.schema_version === 1 && manifest.case_name === "meta-stock" &&
    manifest.output_dir === output && equal(manifest.binding.source_pins, source) &&
    manifest.binding.additional?.variant === "additional-meta-2026-10-21" &&
    hash(JSON.stringify(data(manifest.binding))) === bindingDigest &&
    command.length === 5 && command[1] === ENTRY && modes.includes(command[2]) &&
    (command[2] === "--native"
      ? manifest.kind === "airlock.inspected-meta-stock.v1"
      : manifest.kind === "airlock.inspected-meta-local.v1"), "attended_case_context");
}
function validateStart(owner, source, read = readHandle) {
  const value = read(owner);
  record(value, ["schema", "control_path", "manifest", "binding_sha256", "source_pins",
    "window", "output", "controller", "controller_observation", "command", "started_at_ms", "file_identity"]);
  const stat = lstatSync(owner.path);
  requireFact(value.schema === "airlock.meta-attended-control.v1" &&
    value.control_path === owner.path && owner.path === join(value.output.path, "attended-control.json") &&
    equal(directory(value.output.path), value.output) && equal(source, value.source_pins),
  "attended_case_context");
  requireFact(equal(value.file_identity, { dev: stat.dev, ino: stat.ino }) &&
    equal(identity(value.controller_observation), value.controller) &&
    value.controller_observation.command === value.command.join(" "),
  "attended_case_identity");
  requireFact(value.command[0] === host.execPath && value.command[3] === value.manifest.path &&
    value.command[4] === value.manifest.sha256 &&
    [value.controller.pid, value.controller.ppid, value.controller.pgid].every(n => Number.isSafeInteger(n) && n > 0) &&
    Number.isSafeInteger(value.controller.uid) && value.controller.uid >= 0 &&
    typeof value.controller.started === "string" && value.controller.started.length > 0 &&
    value.controller.uid === host.getuid() &&
    value.controller.command_sha256 === hash(value.command.join(" ")), "attended_controller_context");
  record(value.window, ["not_before_ms", "expires_at_ms"]);
  requireFact([value.window.not_before_ms, value.window.expires_at_ms, value.started_at_ms].every(Number.isSafeInteger) &&
    value.window.expires_at_ms > value.window.not_before_ms &&
    value.window.expires_at_ms - value.window.not_before_ms <= 60000 &&
    value.started_at_ms >= value.window.not_before_ms && value.started_at_ms < value.window.expires_at_ms,
  "attended_case_window");
  const manifest = read(value.manifest);
  requireFact(equal(value.window, manifest.binding.window), "attended_case_window");
  manifestContext(manifest, value.output.path, value.source_pins,
    value.binding_sha256, value.command);
  return value;
}
function writeStart(path, value, retain) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fstatSync(fd), body = { ...value, file_identity: { dev: stat.dev, ino: stat.ino } };
    retain(body);
    const bytes = Buffer.from(JSON.stringify(body) + "\n");
    requireFact(bytes.length <= 65536, "attended_case_byte_limit");
    for (let offset = 0; offset < bytes.length;) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset);
      requireFact(written > 0, "attended_case_write_failed"); offset += written;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  const parent = openSync(dirname(path), "r");
  try { fsyncSync(parent); } finally { closeSync(parent); }
  return handle(path);
}
function profileIdentity(path) {
  requireFact(typeof path === "string" && !lstatSync(path).isSymbolicLink(), "attended_profile_identity");
  const canonical = realpathSync(path), stat = lstatSync(canonical);
  requireFact(dirname(canonical) === realpathSync(tmpdir()) &&
    /^playwright_chromiumdev_profile-[A-Za-z0-9]+$/.test(canonical.split("/").at(-1)) &&
    stat.isDirectory() && stat.uid === host.getuid() && (stat.mode & 0o7777) === 0o700,
  "attended_profile_identity");
  return { path: canonical, argument_path: path, dev: stat.dev, ino: stat.ino,
    birthtime_ms: stat.birthtimeMs, uid: stat.uid };
}
async function untilSettled(promise, deadline) {
  let timer;
  try {
    const remaining = deadline - performance.now();
    requireFact(remaining > 0, "attended_deadline");
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("attended_deadline")), remaining);
    })]);
  } finally { clearTimeout(timer); }
}

/** Fixed-case bookkeeping, not a native lease or unattended shutdown promise. */
export async function createMetaAttendedControl(options) {
  const { onStop, retain, ...input } = record(options,
    ["output_dir", "manifest", "binding_sha256", "source_pins", "window", "deadline_ms", "onStop", "retain"]);
  record(input, ["output_dir", "manifest", "binding_sha256", "source_pins", "window", "deadline_ms"]);
  requireFact(typeof onStop === "function" && typeof retain === "function", "attended_case_callbacks");
  const start = performance.now(), now = Date.now(), window = record(input.window, ["not_before_ms", "expires_at_ms"]);
  requireFact([window.not_before_ms, window.expires_at_ms].every(Number.isSafeInteger) &&
    now >= window.not_before_ms && now < window.expires_at_ms &&
    window.expires_at_ms - window.not_before_ms <= 60000, "attended_case_window");
  requireFact(Number.isFinite(input.deadline_ms) && input.deadline_ms > start, "attended_deadline");
  const end = Math.min(input.deadline_ms, start + Math.min(60000, window.expires_at_ms - now));
  const output = directory(input.output_dir), manifest = readHandle(input.manifest);
  requireFact(equal(window, manifest.binding.window), "attended_case_window");
  requireFact(host.argv[3] === input.manifest.path && host.argv[4] === input.manifest.sha256,
    "attended_controller_context");
  manifestContext(manifest, output.path, input.source_pins, input.binding_sha256, host.argv);
  const current = (await readAdditionalProcesses([host.pid], end, false))[0];
  requireFact(current && current.pid === host.pid && current.uid === host.getuid() &&
    current.command === host.argv.join(" "), "attended_controller_context");
  const controlPath = join(output.path, "attended-control.json");
  const startRecord = {
    schema: "airlock.meta-attended-control.v1", control_path: controlPath, manifest: input.manifest,
    binding_sha256: input.binding_sha256, source_pins: input.source_pins, window, output,
    controller: identity(current), controller_observation: current, command: [...host.argv], started_at_ms: now,
  };
  const save = (name, value) => {
    retain(value);
    requireFact(Buffer.byteLength(JSON.stringify(value)) <= 65536, "attended_case_byte_limit");
    const path = join(output.path, name); writeMetaPrivate(path, value); return handle(path);
  };
  const startHandle = writeStart(controlPath, startRecord, retain);
  save("attended-owner-command.json", {
    schema: "airlock.meta-attended-owner-command.v1", control: startHandle,
    command: [host.execPath, STOP_ENTRY, "--stop", startHandle.path, startHandle.sha256],
    native_qualification: false,
  });
  const errors = [];
  let stopping = false, stopReason = null, pending = false, settled = false, tracked, server, owned, ownedIdentity, browserItem, finished;
  let exit = null, close = null;
  const error = reason => { if (errors.length < 8 && !errors.includes(reason)) errors.push(reason); };
  const requestStop = reason => {
    if (stopReason !== null) return;
    stopping = true; stopReason = reason; onStop(reason);
  };
  const signal = () => requestStop("owner_stop_requested");
  host.on("SIGINT", signal); host.on("SIGTERM", signal);
  const poll = setInterval(() => {
    const path = join(output.path, "attended-stop-request.json");
    try {
      lstatSync(path);
      const request = readHandle(handle(path));
      requireFact(equal(request.control, startHandle), "attended_stop_context");
      requestStop("owner_stop_requested");
    } catch (caught) {
      if (caught.code !== "ENOENT") { error("attended_stop_record_invalid"); requestStop("attended_stop_record_invalid"); }
    }
  }, 25);
  const closeLate = async () => {
    if (!server) return;
    try {
      requireFact(browserItem && equal(profileIdentity(browserItem.profile.argument_path), browserItem.profile),
        "attended_profile_replaced");
      await untilSettled(Promise.resolve().then(() => server.close()), end);
    }
    catch { error("attended_browser_close_unknown"); }
  };
  return {
    ownerCommand: () => ({ control_path: startHandle.path, control_sha256: startHandle.sha256 }),
    requestStop,
    stopped: () => stopReason !== null,
    check(allowStopped = false) {
      validateStart(startHandle, input.source_pins);
      if (owned) {
        const browser = readHandle(owned), stat = lstatSync(owned.path);
        requireFact(equal(ownedIdentity, { dev: stat.dev, ino: stat.ino }), "attended_browser_record_replaced");
        if (!stopping) requireFact(equal(profileIdentity(browser.profile.argument_path), browser.profile),
          "attended_profile_replaced");
      }
      if (!allowStopped) {
        const request = readStopRequest(output.path);
        if (request) {
          requireFact(equal(json(request).control, startHandle), "attended_stop_context");
          requestStop("owner_stop_requested");
        }
        if (stopReason) fail(stopReason);
      }
    },
    beforeClose() {
      if (!browserItem) return;
      try {
        requireFact(equal(profileIdentity(browserItem.profile.argument_path), browserItem.profile),
          "attended_profile_replaced");
      } catch (caught) { if (caught.code !== "ENOENT") throw caught; }
    },
    async killBrowser() {
      requireFact(browserItem, "attended_browser_identity_unknown");
      await signalAdditionalOwnedProcess(browserItem.root, "SIGKILL", end, []);
    },
    async beforeBrowser() {
      requireFact(!stopping, "owner_stop_requested");
      requireFact(Date.now() < window.expires_at_ms && performance.now() < end, "attended_case_window");
      requireFact(!pending, "attended_browser_already_pending");
      save("attended-browser-pending.json", { phase: "browser-pending", control: startHandle, at_ms: Date.now() });
      pending = true;
    },
    trackBrowser(promise) {
      requireFact(pending && !tracked, "attended_browser_not_pending");
      tracked = Promise.resolve(promise).then(async value => {
        server = value;
        const child = value.process();
        child.once("exit", (code, signal) => { exit = { code, signal }; });
        child.once("close", (code, signal) => { close = { code, signal }; });
        const row = (await readAdditionalProcesses([child.pid], end, false))[0];
        const profiles = child.spawnargs.filter(arg => arg.startsWith("--user-data-dir="));
        requireFact(row && row.ppid === current.pid && row.uid === current.uid && row.pgid === row.pid &&
          row.command.startsWith(CHROME + " ") && profiles.length === 1 &&
          row.command.includes(profiles[0]), "attended_browser_identity");
        const profile = profileIdentity(profiles[0].slice("--user-data-dir=".length));
        requireFact(profile.birthtime_ms >= startRecord.started_at_ms - 1000 &&
          profile.birthtime_ms <= Date.now(), "attended_profile_not_fresh");
        browserItem = { root: identity(row), root_command: row.command, profile, chromeReady: true,
          members: new Map([[row.pid, identity(row)]]) };
        const group = await readAdditionalProcesses([row.pgid], end, true);
        const members = inspectAdditionalBrowserMembers(browserItem, group);
        owned = save("attended-browser-owned.json", {
          phase: "browser-owned", control: startHandle, browser: identity(row), observation: row,
          spawnargs: [...child.spawnargs], profile, members, group_observations: group, at_ms: Date.now(),
        });
        const ownedStat = lstatSync(owned.path);
        ownedIdentity = { dev: ownedStat.dev, ino: ownedStat.ino };
        settled = true;
        if (stopping) await closeLate();
        return value;
      }, caught => {
        settled = true; error("attended_browser_acquisition_failed"); throw caught;
      });
      void tracked.catch(() => { error("attended_browser_acquisition_failed"); requestStop("attended_browser_acquisition_failed"); });
      return tracked;
    },
    async finish() {
      if (finished) return finished;
      stopping = true;
      finished = (async () => {
        try {
        if (pending && !settled) {
          try { await untilSettled(tracked, end); }
          catch { error("attended_acquisition_unknown"); }
        }
        if (server && (!exit || !close)) await closeLate();
        let browser = null;
        if (owned) {
          try { browser = readHandle(owned); }
          catch { error("attended_browser_record_invalid"); }
        }
        let absent = !pending, profileAbsent = !pending, group = null, processes = null;
        if (browser) {
          try {
            group = await readAdditionalProcesses([browser.browser.pgid], end, true);
            processes = inspectAdditionalBrowserMembers(browserItem, group);
            absent = processes.every(row => ["absent", "zombie"].includes(row.final));
          } catch { error("attended_process_observation_failed"); }
          try { lstatSync(browser.profile.path); }
          catch (caught) {
            if (caught.code === "ENOENT") profileAbsent = true;
            else error("attended_profile_observation_failed");
          }
        }
        const result = {
          schema: "airlock.meta-attended-final.v1", control: startHandle, browser: owned ?? null,
          pending_settled: !pending || settled, browser_closed: !pending || !!browser && absent &&
            exit?.code === 0 && exit.signal === null && close?.code === 0 && close.signal === null,
          profile_absent: profileAbsent, process_exit: exit, process_close: close,
          group_observations: group, processes,
          stop_requested: stopReason !== null || !!readStopRequest(output.path),
          errors, completed_at_ms: Date.now(), native_qualification: false,
        };
        if (pending && !result.browser_closed && !errors.length) error("attended_browser_closure_unknown");
        const final = save("attended-final.json", result);
        return { ...result, final };
        } finally {
          clearInterval(poll);
          host.off("SIGINT", signal); host.off("SIGTERM", signal);
        }
      })();
      return finished;
    },
  };
}
function readStopRequest(output) {
  try { return readMetaPrivate(join(output, "attended-stop-request.json"), 65536); }
  catch (error) { if (error.code !== "ENOENT") throw error; return null; }
}

/** Independent owner entry: a private digest binds context, never arbitrary PID authority. */
export async function stopMetaAttendedCase(options) {
  const input = record(data(options), ["control_path", "control_sha256"]);
  const owner = { path: input.control_path, sha256: input.control_sha256 };
  const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
  const start = validateStart(owner, inspectedMetaSourcePins()), end = performance.now() + 10000;
  requireFact(start.controller.pid !== host.pid, "attended_cannot_stop_self");
  const current = (await readAdditionalProcesses([start.controller.pid], end, false))[0];
  requireFact(current && sameAdditionalProcess(start.controller, current), "attended_controller_replaced");
  let browser = null, browserHandle = null, browserFileIdentity = null, browserBefore = null, browserItem = null;
  const groupObservations = [];
  let groupBytes = 0;
  const observeGroup = async () => {
    const rows = await readAdditionalProcesses([browser.browser.pgid], end, true);
    if (!equal(rows, groupObservations.at(-1)?.rows ?? null)) {
      const bytes = Buffer.byteLength(JSON.stringify(rows));
      requireFact(groupObservations.length < 64 && groupBytes + bytes <= 24576,
        "attended_stop_evidence_limit");
      groupBytes += bytes;
      groupObservations.push({ at_ms: Date.now(), rows });
    }
    return rows;
  };
  const browserPath = join(start.output.path, "attended-browser-owned.json");
  const refreshBrowser = async () => {
    try { lstatSync(browserPath); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    if (browserHandle) {
      readHandle(browserHandle);
      const stat = lstatSync(browserPath);
      requireFact(equal(browserFileIdentity, { dev: stat.dev, ino: stat.ino }), "attended_browser_record_replaced");
      return;
    }
    browserHandle = handle(browserPath);
    browser = readHandle(browserHandle);
    const stat = lstatSync(browserPath);
    browserFileIdentity = { dev: stat.dev, ino: stat.ino };
    const observed = (await readAdditionalProcesses([browser.browser.pid], end, false))[0];
    browserBefore = observed ?? null;
    requireFact(equal(browser.control, owner) && browser.phase === "browser-owned" &&
      browser.browser.ppid === start.controller.pid && browser.browser.uid === start.controller.uid &&
      browser.browser.pid !== host.pid && browser.browser.pgid === browser.browser.pid &&
      equal(identity(browser.observation), browser.browser) &&
      hash(browser.observation.command) === browser.browser.command_sha256 &&
      browser.observation.command.startsWith(CHROME + " ") &&
      (!observed || observed.ppid === start.controller.pid && sameAdditionalProcess(browser.browser, observed)),
    "attended_browser_context");
    if (observed) requireFact(equal(profileIdentity(browser.profile.argument_path), browser.profile),
      "attended_profile_replaced");
    browserItem = { root: browser.browser, root_command: browser.observation.command,
      profile: browser.profile, chromeReady: true,
      members: new Map(browser.members.map(member => [member.pid,
        Object.fromEntries(Object.entries(member).filter(([key]) => key !== "final"))])) };
    const group = await observeGroup();
    inspectAdditionalBrowserMembers(browserItem, group);
  };
  const checkedSignal = async (target, signal, log) => {
    validateStart(owner, inspectedMetaSourcePins());
    if (browserHandle && target.pid !== start.controller.pid) {
      readHandle(browserHandle);
      const stat = lstatSync(browserPath);
      requireFact(equal(browserFileIdentity, { dev: stat.dev, ino: stat.ino }), "attended_browser_record_replaced");
    }
    const observed = (await readAdditionalProcesses([target.pid], end, false))[0] ?? null;
    requireFact(!observed || sameAdditionalProcess(target, observed), "attended_signal_identity_changed");
    const index = log.length;
    await signalAdditionalOwnedProcess(target, signal, end, log);
    requireFact(log.length === index + 1, "attended_signal_receipt_missing");
    Object.assign(log[index], { expected: target, observed: observed ? identity(observed) : null, at_ms: Date.now() });
  };
  writeMetaPrivate(join(start.output.path, "attended-stop-request.json"), {
    schema: "airlock.meta-attended-stop-request.v1", control: owner, requested_at_ms: Date.now(),
  });
  const signals = [], errors = [];
  const failed = caught => {
    const code = typeof caught?.message === "string" && /^(attended|additional)_[a-z0-9_]+$/.test(caught.message)
      ? caught.message : "attended_stop_operation_failed";
    if (errors.length < 8 && !errors.includes(code)) errors.push(code);
  };
  let browserUnknown = false;
  const refreshBrowserSafely = async () => {
    if (browserUnknown) return;
    try { await refreshBrowser(); }
    catch (caught) { browserUnknown = true; failed(caught); }
  };
  await refreshBrowserSafely();
  try {
    await checkedSignal(start.controller, "SIGTERM", signals);
    let controllerLive = current;
    const grace = Math.min(end - 2000, performance.now() + 1000);
    while (controllerLive && performance.now() < grace) {
      controllerLive = (await readAdditionalProcesses([start.controller.pid], end, false))[0];
      if (controllerLive) {
        requireFact(sameAdditionalProcess(start.controller, controllerLive), "attended_controller_replaced");
        await refreshBrowserSafely();
        await sleep(20);
      }
    }
    if (controllerLive) {
      await checkedSignal(start.controller, "SIGSTOP", signals);
      await refreshBrowserSafely();
      await checkedSignal(start.controller, "SIGKILL", signals);
    }
  } catch (caught) { failed(caught); }
  if (!browser) errors.push("attended_browser_identity_unknown");
  let browserStopped = false;
  if (browser && !browserUnknown) try {
    let states = inspectAdditionalBrowserMembers(browserItem, await observeGroup());
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      for (const member of states.filter(row => row.final === "live")) {
        const expected = Object.fromEntries(Object.entries(member).filter(([key]) => key !== "final"));
        await checkedSignal(expected, signal, signals);
      }
      const grace = Math.min(end - 500, performance.now() + 500);
      do {
        states = inspectAdditionalBrowserMembers(browserItem, await observeGroup());
        if (states.every(row => ["absent", "zombie"].includes(row.final))) break;
        await sleep(20);
      } while (performance.now() < grace);
      if (states.every(row => ["absent", "zombie"].includes(row.final))) break;
    }
    browserStopped = states.every(row => ["absent", "zombie"].includes(row.final));
  } catch (caught) { failed(caught); }
  let controllerAfter = null, browserAfter = null, browserProcesses = null;
  try { controllerAfter = await readAdditionalProcesses([start.controller.pid], end, false); }
  catch (caught) { failed(caught); }
  if (browser && browserItem) try {
    browserAfter = await observeGroup();
    browserProcesses = inspectAdditionalBrowserMembers(browserItem, browserAfter);
  } catch (caught) { failed(caught); }
  const controllerStopped = controllerAfter?.length === 0;
  let profileAbsent = false;
  if (browser) {
    try { lstatSync(browser.profile.path); }
    catch (caught) { if (caught.code === "ENOENT") profileAbsent = true; else failed(caught); }
  }
  const result = {
    schema: "airlock.meta-attended-owner-stop.v1", control: owner, signals,
    browser: browserHandle, controller_before: current, browser_before: browserBefore,
    controller_after: controllerAfter, browser_after: browserAfter,
    group_observations: groupObservations,
    browser_processes: browserProcesses, profile_absent: profileAbsent,
    controller_stopped: controllerStopped, browser_stopped: browserStopped, errors,
    status: controllerStopped && browserStopped && errors.length === 0 ? "stopped" : "UNKNOWN",
    native_qualification: false, completed_at_ms: Date.now(),
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 65536) {
    failed(new Error("attended_stop_byte_limit"));
    result.observed_signal_count = signals.length;
    result.signals = signals.slice(0, 4);
    result.signals_truncated = true;
    result.browser_after = null;
    result.browser_processes = null;
    result.observations_truncated = true;
    result.group_observations = [];
    result.status = "UNKNOWN";
  }
  requireFact(Buffer.byteLength(JSON.stringify(result)) <= 65536, "attended_stop_byte_limit");
  writeMetaPrivate(join(start.output.path, "attended-owner-stop.json"), result);
  return result;
}

/** Pre-launch usable route: the operator already knows this exact manifest locator/hash. */
export async function stopMetaAttendedManifest(options) {
  const input = record(data(options), ["manifest_path", "manifest_sha256"]);
  const manifest = readHandle({ path: input.manifest_path, sha256: input.manifest_sha256 });
  requireFact(manifest.case_name === "meta-stock" && typeof manifest.output_dir === "string",
    "attended_case_context");
  const control = handle(join(absolute(manifest.output_dir), "attended-control.json"));
  const start = readHandle(control);
  requireFact(equal(start.manifest, { path: input.manifest_path, sha256: input.manifest_sha256 }),
    "attended_case_context");
  return stopMetaAttendedCase({ control_path: control.path, control_sha256: control.sha256 });
}

// New owner-path proof must be supplied separately; a legacy guard index cannot satisfy it.
export function inspectMetaAttendedQualification(value, readOriginal = readHandle) {
  record(value, ["qualification", "source_pins"]);
  const index = readOriginal(value.qualification);
  record(index, ["schema", "source_pins", "cases", "owner_stop", "owner_stop_exit",
    "official_sdk_executed", "actual_owner_slots_reserved"],
  ["owner_stop_controller_final", "owner_stop_controller_exit"]);
  requireFact(index.schema === "airlock.meta-attended-qualification.v1" &&
    equal(index.source_pins, value.source_pins) && index.official_sdk_executed === false &&
    index.actual_owner_slots_reserved === 0 && Array.isArray(index.cases) && index.cases.length === 2,
  "attended_qualification_invalid");
  for (const [n, row] of index.cases.entries()) {
    record(row, ["control", "browser", "final", "actual_exit"]);
    const start = validateStart(row.control, value.source_pins, readOriginal), browser = readOriginal(row.browser),
      final = readOriginal(row.final), exit = readOriginal(row.actual_exit);
    const item = { root: browser.browser, root_command: browser.observation.command,
      profile: browser.profile, chromeReady: true, members: new Map([[browser.browser.pid, browser.browser]]) };
    const before = inspectAdditionalBrowserMembers(item, browser.group_observations);
    const after = inspectAdditionalBrowserMembers(item, final.group_observations);
    requireFact(start.command[2] === ["--local-h1", "--local-h2"][n] &&
      [browser.at_ms, final.completed_at_ms, exit.exited_at_ms].every(Number.isSafeInteger) &&
      final.schema === "airlock.meta-attended-final.v1" &&
      browser.phase === "browser-owned" && equal(identity(browser.observation), browser.browser) &&
      browser.profile.birthtime_ms >= start.started_at_ms - 1000 && browser.profile.birthtime_ms <= browser.at_ms &&
      equal(browser.members, before) && equal(final.processes, after) &&
      browser.browser.ppid === start.controller.pid && browser.browser.uid === start.controller.uid &&
      browser.browser.pgid === browser.browser.pid && browser.observation.command.startsWith(CHROME + " ") &&
      hash(browser.observation.command) === browser.browser.command_sha256 &&
      equal(browser.control, row.control) && equal(final.control, row.control) &&
      equal(final.browser, row.browser) && final.pending_settled === true && final.browser_closed === true &&
      final.profile_absent === true && final.stop_requested === false && equal(final.errors, []) &&
      Array.isArray(final.processes) && final.processes.length > 0 &&
      final.processes.every(row => ["absent", "zombie"].includes(row.final)) &&
      Array.isArray(final.group_observations) &&
      final.group_observations.every(row => row.state.startsWith("Z") &&
        final.processes.some(known => known.pid === row.pid && known.started === row.started &&
          known.uid === row.uid && known.pgid === row.pgid)) &&
      equal(final.process_exit, { code: 0, signal: null }) && equal(final.process_close, { code: 0, signal: null }) &&
      exit.schema === "airlock.meta-attended-command-exit.v1" &&
      exit.command_exit_observed === true && exit.code === 0 && exit.signal === null &&
      exit.case_record_sha256 === row.control.sha256 && exit.result_sha256 === row.final.sha256 &&
      equal(exit.command, start.command) && exit.elapsed_external_ms > 0 && exit.elapsed_external_ms < 60000 &&
      start.started_at_ms <= browser.at_ms && browser.at_ms <= final.completed_at_ms &&
      final.completed_at_ms <= exit.exited_at_ms && exit.exited_at_ms < start.window.expires_at_ms &&
      exit.exited_at_ms <= Date.now(),
    "attended_qualification_invalid");
  }
  const stop = readOriginal(index.owner_stop);
  requireFact(stop.schema === "airlock.meta-attended-owner-stop.v1" && stop.status === "stopped" &&
    stop.controller_stopped === true && stop.browser_stopped === true && equal(stop.errors, []),
  "attended_stop_qualification_missing");
  const stoppedCase = validateStart(stop.control, value.source_pins, readOriginal);
  const stoppedBrowser = readOriginal(stop.browser), stopExit = readOriginal(index.owner_stop_exit);
  const stoppedItem = { root: stoppedBrowser.browser, root_command: stoppedBrowser.observation.command,
    profile: stoppedBrowser.profile, chromeReady: true,
    members: new Map([[stoppedBrowser.browser.pid, stoppedBrowser.browser]]) };
  const initialMembers = inspectAdditionalBrowserMembers(stoppedItem, stoppedBrowser.group_observations);
  requireFact(equal(initialMembers, stoppedBrowser.members) && Array.isArray(stop.group_observations) &&
    stop.group_observations.length > 0 && stop.group_observations.length <= 64,
  "attended_stop_qualification_missing");
  requireFact(Number.isSafeInteger(stoppedBrowser.at_ms) &&
    stoppedCase.started_at_ms <= stoppedBrowser.at_ms, "attended_stop_qualification_missing");
  let observedAt = stoppedBrowser.at_ms;
  for (const observation of stop.group_observations) {
    record(observation, ["at_ms", "rows"]);
    requireFact(Number.isSafeInteger(observation.at_ms) && observation.at_ms >= observedAt &&
      observation.at_ms <= stop.completed_at_ms, "attended_stop_qualification_missing");
    inspectAdditionalBrowserMembers(stoppedItem, observation.rows);
    observedAt = observation.at_ms;
  }
  const stoppedStates = inspectAdditionalBrowserMembers(stoppedItem, stop.browser_after);
  requireFact(index.owner_stop_controller_final && index.owner_stop_controller_exit,
    "attended_stop_qualification_missing");
  const controllerFinal = readOriginal(index.owner_stop_controller_final);
  const controllerExit = readOriginal(index.owner_stop_controller_exit);
  requireFact(stoppedCase.command[2] === "--local-owner-stop" &&
    [stop.completed_at_ms, stopExit.exited_at_ms].every(Number.isSafeInteger) &&
    stoppedBrowser.at_ms <= stop.completed_at_ms &&
    equal(identity(stop.controller_before), stoppedCase.controller) &&
    equal(stoppedBrowser.control, stop.control) &&
    equal(identity(stop.browser_before), stoppedBrowser.browser) &&
    stoppedBrowser.browser.ppid === stoppedCase.controller.pid &&
    stoppedBrowser.browser.uid === stoppedCase.controller.uid &&
    stoppedBrowser.observation.command.startsWith(CHROME + " ") &&
    hash(stoppedBrowser.observation.command) === stoppedBrowser.browser.command_sha256 &&
    equal(stop.controller_after, []) && equal(stop.browser_after, []) && stop.profile_absent === true &&
    equal(stop.group_observations.at(-1).rows, stop.browser_after) &&
    equal(stoppedStates, stop.browser_processes) &&
    Array.isArray(stop.browser_processes) && stop.browser_processes.length > 0 &&
    stop.browser_processes.every(row => ["absent", "zombie"].includes(row.final)) &&
    Array.isArray(stop.signals) && stop.signals.length > 0 && stop.signals.length <= 131 &&
    stop.signals.every(signal => ["SIGTERM", "SIGSTOP", "SIGKILL"].includes(signal.signal) &&
      ["sent", "vanished"].includes(signal.outcome) &&
      Number.isSafeInteger(signal.at_ms) && signal.at_ms >= stoppedCase.started_at_ms &&
      signal.at_ms <= stop.completed_at_ms &&
      [stoppedCase.controller, ...stoppedItem.members.values()].some(expected =>
        equal(expected, signal.expected) && signal.pid === expected.pid &&
        (signal.observed === null ? signal.outcome === "vanished" :
          sameAdditionalProcess(expected, signal.observed)))) &&
    stop.completed_at_ms < stoppedCase.window.expires_at_ms &&
    stopExit.schema === "airlock.meta-attended-command-exit.v1" &&
    stopExit.command_exit_observed === true && stopExit.code === 0 && stopExit.signal === null &&
    stopExit.case_record_sha256 === stop.control.sha256 && stopExit.result_sha256 === index.owner_stop.sha256 &&
    stop.completed_at_ms <= stopExit.exited_at_ms && stopExit.exited_at_ms < stoppedCase.window.expires_at_ms &&
    stopExit.exited_at_ms <= Date.now() &&
    (equal(stopExit.command, [host.execPath, STOP_ENTRY, "--stop", stop.control.path, stop.control.sha256]) ||
      equal(stopExit.command, [host.execPath, STOP_ENTRY, "--stop-manifest",
        stoppedCase.manifest.path, stoppedCase.manifest.sha256])) &&
    stopExit.elapsed_external_ms > 0 && stopExit.elapsed_external_ms < 60000,
  "attended_stop_qualification_missing");
  const controllerItem = { root: stoppedBrowser.browser, root_command: stoppedBrowser.observation.command,
    profile: stoppedBrowser.profile, chromeReady: true,
    members: new Map([[stoppedBrowser.browser.pid, stoppedBrowser.browser]]) };
  inspectAdditionalBrowserMembers(controllerItem, stoppedBrowser.group_observations);
  const controllerStates = inspectAdditionalBrowserMembers(controllerItem, controllerFinal.group_observations);
  requireFact(controllerFinal.schema === "airlock.meta-attended-final.v1" &&
    [controllerFinal.completed_at_ms, controllerExit.exited_at_ms].every(Number.isSafeInteger) &&
    stoppedBrowser.at_ms <= controllerFinal.completed_at_ms &&
    equal(controllerFinal.control, stop.control) && equal(controllerFinal.browser, stop.browser) &&
    controllerFinal.stop_requested === true && controllerFinal.pending_settled === true &&
    controllerFinal.browser_closed === true && controllerFinal.profile_absent === true &&
    equal(controllerFinal.errors, []) && equal(controllerStates, controllerFinal.processes) &&
    equal(controllerFinal.process_exit, { code: 0, signal: null }) &&
    equal(controllerFinal.process_close, { code: 0, signal: null }) &&
    controllerStates.every(row => ["absent", "zombie"].includes(row.final)) &&
    controllerExit.schema === "airlock.meta-attended-command-exit.v1" &&
    controllerExit.command_exit_observed === true && controllerExit.code === 2 && controllerExit.signal === null &&
    controllerExit.case_record_sha256 === stop.control.sha256 &&
    controllerExit.result_sha256 === index.owner_stop_controller_final.sha256 &&
    equal(controllerExit.command, stoppedCase.command) &&
    controllerFinal.completed_at_ms <= controllerExit.exited_at_ms &&
    controllerExit.exited_at_ms <= Date.now() && controllerExit.exited_at_ms < stoppedCase.window.expires_at_ms &&
    controllerExit.elapsed_external_ms > 0 && controllerExit.elapsed_external_ms < 60000,
  "attended_stop_qualification_missing");
  return { source_evidence_verified: true, native_qualification: false };
}
