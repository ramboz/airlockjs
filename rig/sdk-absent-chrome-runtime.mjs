import { randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { connect, createServer } from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { assessSyntheticBootstrapPeer, assessSyntheticSocketIsolation } from "./meta-preexec-bootstrap.mjs";
import { assessSdkAbsentChromeAcquisition, assessSdkAbsentChromePostexecSockets, parseSdkAbsentChromeArgv, sdkAbsentChromeReadiness } from "./sdk-absent-chrome-preexec.mjs";
import { ACTORS, CHROME, CONFINED, NODE, POLICY, SHELL, directory, fail, frame, hash,
  preparedObserver, read, safeMessage, save, sendFrame, sleep, sources, syncDirectory, until } from "./sdk-absent-chrome-io.mjs";

const execute = promisify(execFile);
const lifetime = ["pid", "ppid", "pgid", "uid", "started", "command_sha256"];
const same = (a, b) => !!a && !!b && lifetime.every(k => a[k] === b[k]);
const birth = (a, b) => !!a && !!b && ["pid", "pgid", "uid", "started"].every(k => a[k] === b[k]);
const live = row => typeof row?.state === "string" && /^[RSIU]/.test(row.state);
const dead = (expected, row) => !row || birth(expected, row) && row.state.startsWith("Z");
const identity = ({ command: _command, ...row }) => row;
const commandHash = parts => hash(parts.join(" "));
const env = Object.freeze({ PATH: "/opt/homebrew/bin:/usr/bin:/bin", LC_ALL: "C" });

/** Fixed 45-second SDK-absent acquisition/control only, not a native lease.
 * Mirrors the case-owned specific-PID lifetime/group disposition in
 * meta-additional-supervision.mjs:rows/signalOwned/closeBrowser (059-18).
 * No process listing by name, arbitrary executable, URL, observer or signal API. */
export async function runSdkAbsentChromePreexec(options) {
  const v = record(data(options), ["outputDir", "control"]);
  if (process.env.AIRLOCK_RUN_SDK_ABSENT_CHROME !== "explicit-sdk-absent-only")
    fail("sdk_absent_explicit_opt_in_required");
  const readiness = sdkAbsentChromeReadiness();
  if (!readiness.ready) fail(readiness.reason);
  if (!["normal", "pre-return-abort"].includes(v.control) || process.execPath !== NODE
    || Object.keys(process.env).some(k => k.startsWith("DYLD_")
      || ["NODE_OPTIONS", "NODE_DEBUG", "NODE_V8_COVERAGE", "PLAYWRIGHT_LEGACY_SCREENSHOT"].includes(k)))
    fail("sdk_absent_fixed_control");
  const start = performance.now(), end = start + 45000, workEnd = end - 15000;
  if (typeof v.outputDir !== "string" || !isAbsolute(v.outputDir) || resolve(v.outputDir) !== v.outputDir)
    fail("sdk_absent_output_path");
  directory(dirname(v.outputDir), "private-output-parent");
  mkdirSync(v.outputDir, { mode: 0o700 }); syncDirectory(v.outputDir); syncDirectory(dirname(v.outputDir));
  const root = directory(v.outputDir, "case-evidence-root"), errors = [], registrations = [], commands = [], signals = [];
  // The metadata-save preflight must precede even the first self observation.
  save(root.path, "metadata-save-preflight", { root, actual_browser_started: false, at_ms: Date.now() });
  const known = new Map(), sockets = new Set(), probeSockets = new Set(), probeDispositions = [], endpoints = new Set(), tempDirs = new Map();
  let parent, E, roles, profile, argv, argvSha, fdGuard, observer, server, peer, child, childExit, childExitAt, fatal;
  let temp, issuedSha, expires, sourceVector, launchAllowed = false, pending = false, browserReturned = false;
  let normalCdp = false, witnessed = false, engineStopped = false, chromeObserved = false, cleanupPhase = false;
  let tempRemoved = false, profileRemoved = false, closureUnknown = false, chromeExecPermitted = false;
  const preReturn = { engine_stopped_before_exec_ready: false, actual_chrome_while_engine_stopped: false,
    post_stop_descriptor_query: false };
  const messages = [];
  const persist = (phase, extra = {}) => {
    const locator = save(root.path, "registration-" + String(registrations.length).padStart(3, "0"),
      { phase, at_ms: Date.now(), monotonic_ms: performance.now(), root, temp: temp ?? null,
        pending_launch: pending, known: [...known.values()], profile: profile ?? null, ...extra });
    registrations.push(locator); return locator;
  };
  const checkTime = deadline => { if (performance.now() >= deadline) fail("sdk_absent_deadline"); };
  async function command(kind, expected, phase, extra = null) {
    const deadline = cleanupPhase ? end - 1000 : workEnd;
    const program = { row: "/bin/ps", children: "/usr/bin/pgrep", group: "/usr/bin/pgrep",
      peer: "/usr/sbin/lsof", descriptor: observer?.path }[kind];
    const pid = expected.pid;
    if (!program || !Number.isSafeInteger(pid) || pid < 1) fail("sdk_absent_command_scope");
    let args;
    if (kind === "row") args = ["-p", String(pid), "-ww", "-o", "pid=,ppid=,pgid=,uid=,lstart=,stat=,command="];
    if (kind === "children") args = ["-P", String(pid)];
    if (kind === "group") args = ["-g", String(expected.pgid)];
    if (kind === "peer") args = ["-nP", "-a", "-p", String(pid), "-iTCP:" + extra, "-sTCP:ESTABLISHED", "-Fpn"];
    if (kind === "descriptor") {
      if (engineStopped || !equal(preparedObserver(), observer)) fail("sdk_absent_descriptor_context");
      args = [extra, String(pid), String(E.pid), String(roles.L.pid), String(parent.pid)];
    }
    const sequence = commands.length, issued = save(root.path, "os-" + sequence + "-issued",
      { case_root: root, issued_ticket_sha256: issuedSha ?? null,
        kind, phase, program, args, expected_not_this_observation: expected,
        started_monotonic_ms: performance.now(), deadline_monotonic_ms: deadline });
    const receipt = { issued, completed: null }; commands.push(receipt);
    const remaining = Math.floor(deadline - performance.now()), timeout = Math.min(1000, remaining);
    let stdout, stderr, status = 0, errorCode = null, signal = null, killed = false, failure = null;
    let signalAvailable = true, killedAvailable = true;
    if (timeout <= 0) { failure = "deadline-before-query"; status = null; signalAvailable = killedAvailable = false; killed = null; }
    else {
      try {
        ({ stdout, stderr } = await execute(program, args, { env, encoding: "buffer", timeout,
          killSignal: "SIGKILL", maxBuffer: 32768 }));
      } catch (error) {
        ({ stdout, stderr } = error); errorCode = error.code ?? null;
        status = typeof error.code === "number" ? error.code : null; signal = error.signal ?? null;
        signalAvailable = typeof error.signal === "string" || error.signal === null;
        killedAvailable = typeof error.killed === "boolean";
        killed = typeof error.killed === "boolean" ? error.killed : null;
        failure = "os-query-error";
      }
    }
    const capture = bytes => Buffer.isBuffer(bytes) ? { available: true, bytes: bytes.length,
      base64: bytes.subarray(0, 32768).toString("base64"), sha256: hash(bytes.subarray(0, 32768)),
      truncated: bytes.length > 32768 } : { available: false };
    const out = capture(stdout), err = capture(stderr);
    const noMatch = status === 1 && !signal && killed !== true && out.available && err.available
      && out.bytes === 0 && err.bytes === 0 && ["row", "children", "group"].includes(kind);
    if (noMatch && (kind === "row" || known.has(pid) || pid === parent?.pid)) failure = null;
    if (!out.available || !err.available || out.truncated || err.truncated
      || !failure && status === 0 && !out.bytes && kind !== "children" && kind !== "group") failure ??= "invalid-query-output";
    receipt.completed = save(root.path, "os-" + sequence + "-completed",
      { issued, actual_exit_code: status, error_code: errorCode, signal, signal_available: signalAvailable,
        killed, killed_available: killedAvailable, timeout_ms: Math.max(0, timeout),
        completed_monotonic_ms: performance.now(), stdout: out, stderr: err,
        upstream_truncation_possible: errorCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
        error: failure, no_match: noMatch });
    if (failure) fail(timeout <= 0 ? "sdk_absent_deadline" : "sdk_absent_os_observation_failed");
    if (kind === "descriptor" && !equal(preparedObserver(), observer)) fail("sdk_absent_observer_changed");
    return stdout.toString("utf8");
  }
  async function row(expected, phase) {
    const text = (await command("row", expected, phase)).trim();
    if (!text) return null;
    const m = text.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+(.+)$/);
    if (!m || +m[1] !== expected.pid) fail("sdk_absent_process_shape");
    return { pid: +m[1], ppid: +m[2], pgid: +m[3], uid: +m[4],
      started: m[5], state: m[6], command_sha256: hash(m[7]), command: m[7] };
  }
  async function ids(kind, expected, phase) {
    const text = (await command(kind, expected, phase)).trim();
    const values = text ? text.split(/\s+/).map(Number) : [];
    if (values.length > 64 || new Set(values).size !== values.length
      || values.some(n => !Number.isSafeInteger(n) || n < 1)) fail("sdk_absent_process_inventory");
    return values;
  }
  async function waitMessage(type) {
    for (;;) {
      if (fatal) throw fatal;
      const at = messages.findIndex(m => m.type === type);
      if (at >= 0) return messages.splice(at, 1)[0];
      if (childExit) fail("sdk_absent_engine_exited");
      checkTime(workEnd); await sleep(5);
    }
  }
  function stableDirectories() {
    if (!equal(directory(root.path, root.kind), root)
      || !equal(directory(temp.path, temp.kind), temp)
      || profile && !equal(directory(profile.path, profile.kind), profile)) fail("sdk_absent_directory_substituted");
    if (!equal(sources(), sourceVector)) fail("sdk_absent_source_changed");
  }
  async function renewed(phase) {
    const after = {};
    for (const role of ["P", "E", "L", "H"]) {
      const current = await row(roles[role], phase);
      after[role] = current ? identity(current) : null;
    }
    stableDirectories();
    const check = assessSdkAbsentChromeAcquisition({ expected: roles, before: roles, after,
      profile, expected_profile: profile, temporary_root: temp.path });
    if (!check.allowed) fail(check.reason);
    return after;
  }
  async function handles(phase) {
    const launcher = json(Buffer.from(await command("descriptor", roles.L, phase, "launcher")), 16384);
    const helper = json(Buffer.from(await command("descriptor", roles.H, phase, "helper")), 16384);
    const checked = assessSyntheticSocketIsolation({ expected: roles, launcher, helper });
    if (!checked.allowed) fail(checked.reason);
    if (fdGuard && !equal(checked.debug_handles, fdGuard.debug_handles)) fail("sdk_absent_debug_changed");
    stableDirectories();
    return { launcher, helper, debug_handles: checked.debug_handles };
  }
  function chromeChain(current) {
    return argv && [CHROME, "/bin/sh " + CONFINED, CONFINED,
      "/usr/bin/sandbox-exec -f " + POLICY + " " + CHROME].some(image => current.command === [image, ...argv].join(" "));
  }
  function adoptRoot(current) {
    const expected = known.get(roles.L.pid);
    const parentOkay = current && (current.ppid === expected.ppid || childExit && current.ppid === 1);
    if (!birth(expected, current) || !parentOkay || !chromeChain(current)) fail("sdk_absent_exec_lifetime");
    stableDirectories(); known.set(current.pid, identity(current));
    return current.command === [CHROME, ...argv].join(" ");
  }
  async function refreshKnown(expected, current) {
    if (same(expected, current)) return;
    if (roles && expected.pid === roles.L.pid) { adoptRoot(current); return; }
    // Only an already witnessed child may be reparented after its recorded
    // parent has actually closed. Reparenting never admits a new group member.
    const previousParent = known.get(expected.ppid);
    if (!birth(expected, current) || current.command_sha256 !== expected.command_sha256
      || current.ppid !== 1 || !previousParent
      || !dead(previousParent, await row(previousParent, "recorded-parent-disposition")))
      fail("sdk_absent_descendant_replaced");
    known.set(current.pid, identity(current));
    persist("recorded-child-reparented", { prior: expected, current: identity(current) });
  }
  async function signalOwned(expected, signal) {
    const current = await row(expected, "pre-signal");
    if (dead(expected, current)) return;
    if (!same(expected, current)) fail("sdk_absent_signal_identity_changed");
    const action = { pid: expected.pid, signal, expected, checked: identity(current), at_ms: Date.now(), outcome: "pending" };
    persist("signal-intent", { action });
    try { process.kill(expected.pid, signal); action.outcome = "sent"; }
    catch (error) { action.outcome = error.code === "ESRCH" ? "vanished" : "error"; action.error_code = error.code ?? null;
      if (action.outcome === "error") { signals.push(action); persist("signal-error", { action }); throw error; } }
    signals.push(action); persist("signal-observed", { action });
  }
  async function descendants() {
    if (!roles) return;
    // Serialized caller: each scan is fresh, including late Chrome children.
    // Only current known lifetimes can anchor discovery; groups alone cannot.
    const queue = [...known.values()];
    for (let n = 0; n < queue.length; n++) {
      const expected = queue[n];
      if (expected.pid === E.pid || expected.pid === roles.H.pid) continue;
      const current = await row(expected, "descendant-anchor");
      if (dead(expected, current)) continue;
      await refreshKnown(expected, current);
      for (const pid of await ids("children", known.get(expected.pid), "descendant-enumeration")) {
        if (known.has(pid)) continue;
        const candidate = await row({ pid }, "scoped-descendant");
        if (!candidate || candidate.ppid !== expected.pid || candidate.uid !== expected.uid
          || !live(candidate) || !(candidate.command.startsWith("/Applications/Google Chrome.app/Contents/")
            || expected.pid === roles.L.pid && candidate.command === "/usr/bin/profiles status -type enrollment"))
          fail("sdk_absent_descendant_unattributed");
        if (known.size >= 64) fail("sdk_absent_descendant_limit");
        const member = identity(candidate);
        known.set(pid, member); queue.push(member);
        persist("descendant-owned", { ancestry: expected.pid, member });
      }
    }
  }
  async function endpointClosed(port) {
    checkTime(end - 750);
    persist("endpoint-probe-intent", { port, owner: parent, deadline_monotonic_ms: end - 750 });
    const socket = connect({ host: "127.0.0.1", port });
    probeSockets.add(socket);
    let settleDecision, settleClose, finished = false, closeObserved = false, decisionError = null;
    const disposalErrors = [];
    const decision = new Promise(done => { settleDecision = done; });
    const close = new Promise(done => { settleClose = done; });
    const finish = value => { if (!finished) { finished = true; settleDecision(value); } };
    const onConnect = () => finish(false);
    const onError = error => finish(error.code === "ECONNREFUSED");
    socket.once("close", () => {
      closeObserved = true; probeSockets.delete(socket);
      socket.off("connect", onConnect); socket.off("error", onError);
      finish(false); settleClose();
    });
    try {
      socket.once("connect", onConnect); socket.on("error", onError);
      socket.setTimeout(200, () => finish(false));
      return await until(decision, end - 750);
    } catch (error) { decisionError = error.message; throw error; }
    finally {
      try { socket.setTimeout(0); } catch (error) { disposalErrors.push(error.message); }
      try { socket.destroy(); } catch (error) { disposalErrors.push(error.message); }
      try { await until(close, end - 100); } catch (error) { disposalErrors.push(error.message); }
      const record = { port, owner_pid: parent.pid, close_observed: closeObserved, decision_error: decisionError,
        disposal_errors: disposalErrors, disposition: closeObserved && !disposalErrors.length ? "closed" : "UNKNOWN" };
      probeDispositions.push(record);
      persist("endpoint-probe-disposition", { probe: record });
      if (record.disposition !== "closed") fail("sdk_absent_probe_disposition_UNKNOWN");
    }
  }
  try {
    sourceVector = sources();
    observer = preparedObserver(); // Fixed prepared cohort; never compile in a case.
    parent = identity(await row({ pid: process.pid }, "parent-self"));
    if (!live(parent) || parent.uid !== process.getuid() || parent.ppid !== process.ppid) fail("sdk_absent_parent_identity");
    const tempPath = join(root.path, "tmp");
    mkdirSync(tempPath, { mode: 0o700 }); syncDirectory(root.path);
    temp = directory(tempPath, "registered-temporary-subtree");
    save(root.path, "root-issued", { root, temp, parent, source_vector: sourceVector, at_ms: Date.now() });
    pending = true;
    save(root.path, "pending-owned", { parent, temp, pending_launch: true, at_ms: Date.now() });
    persist("temporary-root-and-pending-owned");
    server = createServer(socket => {
      sockets.add(socket); socket.on("error", () => {}); socket.once("close", () => sockets.delete(socket));
      if (peer) { fatal = Error("sdk_absent_extra_peer"); socket.destroy(); return; }
      peer = socket;
    });
    server.on("error", error => { fatal = error; });
    await until(new Promise((done, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", done);
    }), workEnd);
    endpoints.add(server.address().port);
    expires = Date.now() + Math.max(1, Math.floor(workEnd - performance.now()));
    const ticketHandle = save(root.path, "issued", { schema: "airlock.sdk-absent-chrome-issue.v1",
      parent, temp, control: v.control, port: server.address().port, expires_at_ms: expires, sources: sourceVector });
    issuedSha = ticketHandle.sha256;
    save(root.path, "issued-digest", { ticket_sha256: issuedSha });
    child = spawn(NODE, [ACTORS, "--sdk-absent-e"], { detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { ...env, TMPDIR: temp.path, AIRLOCK_SDK_ABSENT_CHROME_ROOT: root.path } });
    child.on("message", message => { try { messages.push(safeMessage(message)); } catch (e) { fatal = e; } });
    child.on("error", error => { fatal = error; });
    child.once("exit", (code, signal) => { childExit = { code, signal }; childExitAt = Date.now(); });
    child.stdout.resume(); child.stderr.resume();
    const engine = await row({ pid: child.pid }, "engine-acquisition");
    if (!live(engine) || engine.ppid !== parent.pid || engine.pgid !== engine.pid || engine.uid !== parent.uid
      || engine.command_sha256 !== commandHash([NODE, ACTORS, "--sdk-absent-e"])) fail("sdk_absent_engine_unattributed");
    E = identity(engine); known.set(E.pid, E); persist("engine-owned");
    child.send({ type: "engine-owner", ticket_sha256: issuedSha, identity: E });
    await waitMessage("engine-ready");
    stableDirectories();
    launchAllowed = true; persist("launch-permission");
    child.send({ type: "launch-permission" });
    await waitMessage("launch-pending");
    let announced;
    while (!announced) {
      checkTime(workEnd);
      const current = await row(E, "pre-attribution-engine");
      if (!same(E, current) || !live(current)) fail("sdk_absent_engine_lost_before_attribution");
      try { announced = read(join(root.path, "helper-announcement.json")); }
      catch (error) { if (error.code !== "ENOENT") throw error; await sleep(5); }
    }
    const parsed = parseSdkAbsentChromeArgv({ argv: announced.argv, temporary_root: temp.path });
    argv = parsed.argv; argvSha = parsed.argv_sha256;
    profile = directory(parsed.profile_path, "REAL-isolated-browser-profile");
    for (const name of readdirSync(temp.path)) {
      if (!/^(playwright_chromiumdev_profile|playwright-artifacts)-[A-Za-z0-9]{6}$/.test(name)) fail("sdk_absent_unregistered_temp_allocation");
      const dir = directory(join(temp.path, name), name.startsWith("playwright_chromium") ? profile.kind : "real-driver-artifacts");
      tempDirs.set(dir.path, dir);
    }
    const launchers = await ids("children", E, "launcher-discovery");
    let L;
    for (const pid of launchers) {
      const candidate = await row({ pid }, "scoped-launcher");
      if (live(candidate) && candidate.ppid === E.pid && candidate.pgid === candidate.pid && candidate.uid === E.uid
        && candidate.command_sha256 === commandHash(["/bin/sh", SHELL, ...argv])) {
        if (L) fail("sdk_absent_multiple_launchers");
        L = identity(candidate); known.set(L.pid, L); persist("launcher-and-real-profile-owned");
      } else fail("sdk_absent_launcher_unattributed");
    }
    if (!L) fail("sdk_absent_launcher_unattributed");
    let H;
    for (const pid of await ids("children", L, "helper-discovery")) {
      const candidate = await row({ pid }, "scoped-helper");
      if (live(candidate) && candidate.ppid === L.pid && candidate.pgid === L.pid && candidate.uid === L.uid
        && candidate.command_sha256 === commandHash([NODE, ACTORS, "--sdk-absent-h", ...argv])) {
        if (H) fail("sdk_absent_multiple_helpers");
        H = identity(candidate); known.set(H.pid, H);
      } else fail("sdk_absent_helper_unattributed");
    }
    if (!H) fail("sdk_absent_helper_unattributed");
    roles = { P: parent, E, L, H };
    const enrolled = await renewed("pre-enrollment");
    fdGuard = await handles("pre-enrollment");
    persist("roles-profile-fds-enrolled", { roles, observed: enrolled, descriptor_observations: fdGuard });
    const permit = (stage, correlation) => save(root.path, stage, {
      schema: "airlock.sdk-absent-chrome-permit.v1", stage, ticket_sha256: issuedSha, roles, profile,
      argv_sha256: argvSha, issued_at_ms: Date.now(), expires_at_ms: expires, correlation_sha256: correlation });
    permit("tcp-only", null);
    while (!peer) { checkTime(workEnd); if (fatal) throw fatal; await sleep(1); }
    const hello = await frame(peer, workEnd);
    await renewed("peer-before");
    const tuple = { server_address: peer.localAddress, server_port: peer.localPort,
      client_address: peer.remoteAddress, client_port: peer.remotePort };
    const kernel = await command("peer", H, "peer-owner", tuple.server_port);
    const peerCheck = assessSyntheticBootstrapPeer({ roles, tuple, hello, kernel, ticket_sha256: issuedSha });
    if (!peerCheck.allowed) fail(peerCheck.reason);
    await renewed("peer-after"); persist("kernel-helper-peer-owned", { tuple, kernel_sha256: hash(kernel) });
    const correlation = randomBytes(32).toString("hex"), response = frame(peer, workEnd);
    sendFrame(peer, { stage: "challenge", correlation });
    if ((await response).correlation_sha256 !== hash(correlation)) fail("sdk_absent_challenge");
    await renewed("exec-ready-before");
    const finalHandles = await handles("exec-ready-before");
    // No C invocation occurs beyond this point in the abort control.
    if (v.control === "pre-return-abort") {
      await signalOwned(E, "SIGSTOP");
      for (;;) {
        const stopped = await row(E, "engine-stop-witness");
        if (!same(E, stopped)) fail("sdk_absent_engine_stop_identity");
        if (stopped.state.startsWith("T")) break;
        checkTime(workEnd); await sleep(2);
      }
      engineStopped = true; preReturn.engine_stopped_before_exec_ready = true;
      persist("pre-return-engine-stopped", { E, no_browser_server_returned: true });
    }
    stableDirectories();
    persist("exec-ready-durable", { roles, descriptor_observations: finalHandles, engine_stopped: engineStopped });
    chromeExecPermitted = true;
    const ready = permit("exec-ready", hash(correlation));
    sendFrame(peer, { stage: "exec-ready", allowed: true, registration_sha256: ready.sha256 });
    for (;;) {
      checkTime(workEnd);
      const current = await row(L, "chrome-exec-observation");
      if (dead(L, current)) fail("sdk_absent_chrome_not_observed");
      if (same(L, current)) { await sleep(2); continue; }
      if (adoptRoot(current)) { chromeObserved = true; break; }
      await sleep(2);
    }
    persist("actual-chrome-owned", { launcher_pid_preserved: true });
    if (v.control === "pre-return-abort") {
      const stopped = await row(E, "late-chrome-engine-still-stopped");
      if (!same(E, stopped) || !stopped.state.startsWith("T") || messages.some(m => m.type === "browser-returned"))
        fail("sdk_absent_not_genuine_pre_return");
      preReturn.actual_chrome_while_engine_stopped = true;
      persist("actual-pre-return-late-chrome", { E_stopped: identity(stopped),
        actual_chrome: known.get(L.pid), browser_server_returned: false, post_stop_C_query: false });
      await descendants();
      await signalOwned(E, "SIGKILL");
      while (!childExit) { checkTime(workEnd); await sleep(2); }
      if (childExit.code !== null || childExit.signal !== "SIGKILL") fail("sdk_absent_engine_abort_exit");
      witnessed = true;
    } else {
      const returned = await waitMessage("browser-returned");
      if (returned.pid !== L.pid || !Number.isSafeInteger(returned.port) || returned.port < 1 || returned.port > 65535)
        fail("sdk_absent_browser_server_identity");
      browserReturned = true; endpoints.add(returned.port);
      const post = json(Buffer.from(await command("descriptor", known.get(L.pid), "postexec-whole-inventory", "launcher")), 16384);
      const postCheck = assessSdkAbsentChromePostexecSockets({ expected: roles,
        preexec_handles: fdGuard.debug_handles, preexec_kernel_roles: fdGuard.launcher.roles_before, inventory: post });
      if (!postCheck.allowed) fail(postCheck.reason);
      persist("postexec-handles-and-returned-pid", { postexec_inventory: post, returned });
      await descendants();
      child.send({ type: "browser-owner", pid: L.pid });
      const proof = await waitMessage("normal-proof");
      if (proof.pid !== L.pid) fail("sdk_absent_cdp_identity");
      const original = read(join(root.path, "engine-normal-proof.json"));
      if (original.pid !== L.pid || original.ticket_sha256 !== issuedSha || original.version !== "155.0.8059.85"
        || !equal(original.cookies, []) || original.page_url !== "about:blank"
        || !/^[a-f0-9]{64}$/.test(original.renderer_roundtrip_sha256)) fail("sdk_absent_cdp_proof");
      normalCdp = true; persist("normal-cdp-owned", { original });
      await descendants();
      // No close-permission: public Playwright shutdown removes temporary
      // directories while the runnable-descendant boundary is still unproved.
      witnessed = true;
    }
  } catch (error) { errors.push(error.message); persist("unqualified-abort", { reason: error.message }); }
  finally {
    cleanupPhase = true;
    const dispositions = [], groups = [];
    try {
      if (chromeExecPermitted) {
        closureUnknown = true;
        errors.push("sdk_absent_descendant_closure_UNPROVED");
        persist("runnable-descendant-boundary-UNKNOWN", {
          descendant_boundary: "UNKNOWN-runnable-fork-detach-escape",
          old_group_emptiness_is_not_exhaustive: true, parent_profile_deletion_allowed: false,
        });
        // Prevent deliberate SDK temporary-directory cleanup before terminating
        // only the lifetimes we actually attributed. This is not containment
        // of Chrome forks, and cannot establish whole-tree termination.
        if (!childExit) {
          try {
            if (!engineStopped) {
              await signalOwned(E, "SIGSTOP");
              const stopped = await row(E, "cleanup-engine-stopped");
              if (!same(E, stopped) || !stopped.state.startsWith("T")) fail("sdk_absent_engine_stop_identity");
              engineStopped = true;
            }
            await signalOwned(E, "SIGKILL");
            while (!childExit) { checkTime(end - 1500); await sleep(2); }
          } catch (error) { errors.push(error.message); }
        }
      }
      if (roles) {
        try { await descendants(); } catch (error) { closureUnknown = true; errors.push(error.message); }
      } else if (launchAllowed) closureUnknown = true; // Earliest post-fork attribution gap remains unproved.
      for (const expected of [...known.values()].reverse()) {
        try {
          for (const signal of ["SIGTERM", "SIGKILL"]) {
            let current = await row(expected, "cleanup-lifetime");
            if (dead(expected, current)) break;
            await refreshKnown(known.get(expected.pid), current);
            const owned = known.get(expected.pid);
            await signalOwned(owned, engineStopped && expected.pid === E.pid ? "SIGKILL" : signal);
            const settle = Math.min(end - 1500, performance.now() + (signal === "SIGTERM" ? 250 : 50));
            while (performance.now() < settle) {
              const after = await row(owned, "cleanup-settle");
              if (dead(owned, after)) break;
              await sleep(5);
            }
          }
          const owned = known.get(expected.pid), final = await row(owned, "cleanup-final-lifetime");
          const closed = dead(owned, final);
          dispositions.push({ expected: owned, final: final ? identity(final) : null, disposition: closed ? "closed" : "UNKNOWN" });
          if (!closed) closureUnknown = true;
        } catch (error) { closureUnknown = true; dispositions.push({ expected, disposition: "UNKNOWN", error: error.message }); }
      }
      for (const pgid of new Set([...known.values()].map(r => r.pgid))) {
        try {
          const anchor = [...known.values()].find(r => r.pgid === pgid);
          const members = [];
          let groupUnknown = false;
          for (const pid of await ids("group", anchor, "final-recorded-group")) {
            const current = await row({ pid }, "final-recorded-group-member");
            const owned = known.get(pid);
            if (!owned || !dead(owned, current)) {
              closureUnknown = true;
              groupUnknown = true;
            }
            members.push(current ? identity(current) : null);
          }
          groups.push({ pgid, members, disposition: groupUnknown ? "UNKNOWN" : "closed" });
        } catch (error) { closureUnknown = true; groups.push({ pgid, disposition: "UNKNOWN", error: error.message }); }
      }
    } finally {
      // Release every P-owned handle even when observation/signal/save fails.
      for (const socket of sockets) { try { socket.destroy(); } catch (error) { errors.push(error.message); closureUnknown = true; } }
      try { if (server) await until(new Promise(done => server.close(done)), end - 1000); }
      catch (error) { errors.push(error.message); closureUnknown = true; }
      if (child) {
        for (const stream of [child.stdout, child.stderr]) { try { stream?.destroy(); } catch { closureUnknown = true; } }
        try { if (child.connected) child.disconnect(); } catch { closureUnknown = true; }
        try { child.unref(); } catch { closureUnknown = true; }
      }
    }
    const ports = [];
    for (const port of endpoints) {
      try { const closed = await endpointClosed(port); ports.push({ port, closed }); if (!closed) closureUnknown = true; }
      catch (error) { ports.push({ port, closed: false, error: error.message }); closureUnknown = true; }
    }
    if (server?.listening || sockets.size !== 0 || probeSockets.size !== 0 || child && !childExit) closureUnknown = true;
    if (!closureUnknown && temp) {
      try {
        if (!equal(directory(root.path, root.kind), root) || !equal(directory(temp.path, temp.kind), temp))
          fail("sdk_absent_cleanup_directory_substituted");
        for (const name of readdirSync(temp.path)) {
          const path = join(temp.path, name), expected = tempDirs.get(path);
          if (!expected || !equal(directory(path, expected.kind), expected)) fail("sdk_absent_cleanup_directory_substituted");
        }
        for (const owned of tempDirs.values()) {
          if (existsSync(owned.path)) {
            if (!equal(directory(owned.path, owned.kind), owned)) fail("sdk_absent_cleanup_directory_substituted");
            checkTime(end - 1000); rmSync(owned.path, { recursive: true }); syncDirectory(temp.path);
          }
        }
        profileRemoved = !profile || !existsSync(profile.path);
        if (readdirSync(temp.path).length) fail("sdk_absent_temp_not_empty");
        checkTime(end - 1000); rmdirSync(temp.path); syncDirectory(root.path);
        tempRemoved = !existsSync(temp.path);
      } catch (error) { closureUnknown = true; errors.push(error.message); }
    }
    if (closureUnknown || !tempRemoved || !profileRemoved) errors.push("sdk_absent_resource_disposition_UNKNOWN");
    pending = !tempRemoved || closureUnknown;
    persist("final-resource-disposition", { dispositions, groups, ports, pending_launch: pending,
      child_exit: childExit ?? null, child_exit_at_ms: childExitAt ?? null, profile_removed: profileRemoved,
      temporary_subtree_removed: tempRemoved, closure_unknown: closureUnknown,
      probe_dispositions: probeDispositions, outstanding_probe_count: probeSockets.size,
      descendant_boundary: chromeExecPermitted ? "UNKNOWN-runnable-fork-detach-escape" : "not-activated",
      exhaustive_descendant_termination_proved: false,
      attribution_gap: launchAllowed && !roles ? "UNPROVED-post-fork-pre-attribution" : null });
  }
  const elapsedBeforePublication = performance.now() - start;
  if (elapsedBeforePublication >= 45000) errors.push("sdk_absent_deadline_before_publication");
  // This process cannot attest to its own future fsync/return/exit. The
  // immutable candidate stays unqualified in memory and on disk; only the
  // separate whole-command consumer may evaluate an external completion.
  const result = { schema: "airlock.sdk-absent-chrome-preexec-candidate.v2", control: v.control,
    qualified: false, case_root: root, source_vector_sha256: hash(JSON.stringify(data(sourceVector ?? null))),
    sdk_absent: true, native_authority: false, native_qualified: false, sdk_executions: 0, explicit_provider_operations: 0,
    network_scope: "pinned-loopback-policy; no provider-traffic or filesystem-confinement observation",
    control_witnessed: false, resource_complete: !pending && !closureUnknown,
    acquisition_control_observed: witnessed,
    descendant_boundary: chromeExecPermitted ? "UNKNOWN-runnable-fork-detach-escape" : "not-activated",
    browser_server_returned: browserReturned, actual_chrome_observed: chromeObserved, normal_cdp: normalCdp,
    launch_permission_issued: launchAllowed, acquisition_roles_fully_attributed: !!roles,
    pre_return_abort: preReturn, profile_kind: profile?.kind ?? null,
    earliest_postfork_loss: "UNPROVED", mechanical_budget_ms: 45000,
    publication_contract: { status: "UNQUALIFIED-candidate", external_completion_required: true,
      mechanical_budget_ms: 45000, producer_elapsed_before_publication_ms: elapsedBeforePublication },
    child_exit: childExit ?? null, registrations, commands, signals, probe_dispositions: probeDispositions, errors };
  save(root.path, "result", result);
  return result;
}
