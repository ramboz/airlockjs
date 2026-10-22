import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

// These pure paths perform real private-file fsync/publication and evidence
// copies. Use the existing 45-second mechanical cap, not Vitest's default 5s.
// Production work/cleanup deadlines and actual-browser budgets are unchanged.
vi.setConfig({ testTimeout: 45000 });

async function boundaryCase(control, fault = "") {
  mkdirSync(resolve("rig/out"), { recursive: true, mode: 0o700 });
  const container = mkdtempSync(resolve("rig/out/sdk-absent-pure-"));
  const outputDir = join(container, "case"), ids = { E: 620002, L: 620003, H: 620004, member: 620005 };
  const entry = resolve("rig/sdk-absent-chrome-actors.mjs"), shell = resolve("rig/sdk-absent-chrome-launcher");
  const profile = join(outputDir, "tmp/playwright_chromiumdev_profile-aB12cd");
  const child = new EventEmitter(), socket = new EventEmitter(), server = new EventEmitter();
  let allocated = false, chrome = false, stopped = false, exited = false, gone = false, hello = false, virtual = 0, sourceReads = 0;
  let memberAlive = fault === "detached-descendant", escapedAfterScan = null;
  const saved = name => existsSync(join(outputDir, name + ".json"))
    ? JSON.parse(readFileSync(join(outputDir, name + ".json"))) : null;
  const signals = [], queries = [], frames = [], receipts = [], probes = [];
  let publicationBeforeProbeClose = false;
  const originalNow = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => originalNow() + virtual);
  const args = () => saved("helper-announcement").argv;
  const row = (pid, ppid, pgid, command, state = "S") =>
    `${pid} ${ppid} ${pgid} ${process.getuid()} Thu Oct 22 11:00:00 2026 ${state} ${command}\n`;
  Object.assign(child, { pid: ids.E, connected: true, stdout: new PassThrough(), stderr: new PassThrough(),
    disconnect: vi.fn(() => { child.connected = false; }), unref: vi.fn() });
  const complete = () => { exited = true; gone = true; queueMicrotask(() => child.emit("exit", 0, null)); };
  child.send = message => {
    if (message.type === "engine-owner") {
      if (fault === "early-engine-loss") { exited = true; queueMicrotask(() => child.emit("exit", 2, null)); }
      else queueMicrotask(() => child.emit("message", { type: "engine-ready" }));
    }
    if (message.type === "launch-permission") {
      allocated = true;
      mkdirSync(profile, { mode: 0o700 });
      mkdirSync(join(outputDir, "tmp/playwright-artifacts-dE34fg"), { mode: 0o700 });
      const source = readFileSync(resolve("rig/sdk-absent-chrome-preexec.test.mjs"), "utf8");
      const flags = source.slice(source.indexOf("const switches = [") + "const switches = [".length, source.indexOf("];", source.indexOf("const switches = [")));
      // Test inputs use the independently pinned literal argv in the parser suite.
      const vector = JSON.parse("[" + flags.replace(/\/\/[^\n]*/g, "").replace(/,\s*$/, "") + "]");
      const announcement = { argv: [...vector, "--user-data-dir=" + profile, "--remote-debugging-pipe", "--no-startup-window"] };
      receipts.push({ phase: "launch-permission", root: !!saved("root-issued"), pending: !!saved("pending-owned") });
      // Only boundary allocation creates these pure fixture directories.
      import("./sdk-absent-chrome-io.mjs").then(({ save }) => {
        save(outputDir, "helper-announcement", announcement);
        child.emit("message", { type: "launch-pending" });
      });
    }
    if (message.type === "browser-owner") {
      import("./sdk-absent-chrome-io.mjs").then(({ save }) => {
        save(outputDir, "engine-normal-proof", {
          pid: ids.L, ticket_sha256: saved("issued-digest").ticket_sha256, version: "155.0.8059.85",
          cookies: [], page_url: "about:blank", renderer_roundtrip_sha256: "a".repeat(64),
        });
        child.emit("message", { type: "normal-proof", pid: ids.L });
      });
    }
    if (message.type === "close-permission") {
      rmSync(profile, { recursive: true }); rmSync(join(outputDir, "tmp/playwright-artifacts-dE34fg"), { recursive: true });
      queueMicrotask(() => child.emit("message", { type: "engine-complete" })); complete();
    }
  };
  Object.assign(socket, { localAddress: "127.0.0.1", localPort: 62001, remoteAddress: "127.0.0.1",
    remotePort: 62002, destroyed: false, destroy: vi.fn(() => { socket.destroyed = true; socket.emit("close"); }) });
  const originalOn = socket.on.bind(socket);
  socket.on = (event, fn) => {
    const result = originalOn(event, fn);
    if (event === "data" && !hello) {
      hello = true;
      queueMicrotask(() => socket.emit("data", Buffer.from(JSON.stringify({
        helper_pid: ids.H, launcher_pid: ids.L, ticket_sha256: saved("issued-digest").ticket_sha256,
      }) + "\n")));
    }
    return result;
  };
  socket.write = text => {
    const message = JSON.parse(text); frames.push(message);
    if (message.stage === "challenge") {
      import("node:crypto").then(({ createHash }) => socket.emit("data", Buffer.from(JSON.stringify({
        correlation_sha256: createHash("sha256").update(message.correlation).digest("hex"),
      }) + "\n")));
    }
    if (message.stage === "exec-ready") {
      chrome = true;
      if (control === "normal") queueMicrotask(() => child.emit("message", { type: "browser-returned", pid: ids.L, port: 62003 }));
    }
    return true;
  };
  let enrollmentPoll;
  Object.assign(server, { listening: false, address: () => ({ port: 62001 }),
    listen: (_port, _host, done) => { server.listening = true; done(); },
    close: done => { clearInterval(enrollmentPoll); server.listening = false; done(); } });
  const execFile = vi.fn(), spawn = vi.fn(() => child);
  const empty = () => { throw Object.assign(Error("no matches"), { code: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }); };
  execFile[promisify.custom] = async (program, commandArgs, options) => {
    queries.push({ program, args: commandArgs, env: options.env, stopped });
    if (program === "/bin/ps") {
      const pid = Number(commandArgs[1]);
      if (fault === "cleanup-observation-error" && gone && pid === ids.L)
        throw Object.assign(Error("pure EIO"), { code: "EIO", stdout: Buffer.alloc(0), stderr: Buffer.from("pure observation failed") });
      if (pid === process.pid) return { stdout: Buffer.from(row(pid, process.ppid, pid, "pure-owned-P")), stderr: Buffer.alloc(0) };
      if (pid === ids.E) {
        if (exited) return empty();
        const state = stopped && !(fault === "engine-resumed-after-exec" && chrome) ? "T" : "S";
        return { stdout: Buffer.from(row(pid, process.pid, pid, [process.execPath, entry, "--sdk-absent-e"].join(" "), state)), stderr: Buffer.alloc(0) };
      }
      if (pid === ids.member && fault === "detached-descendant") {
        if (!memberAlive || !chrome) return empty();
        return { stdout: Buffer.from(row(pid, gone ? 1 : ids.L, ids.member,
          "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper (Renderer) --type=renderer")),
        stderr: Buffer.alloc(0) };
      }
      if (!allocated || gone || pid === ids.H && chrome) return empty();
      let image = pid === ids.L ? chrome
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ...args()].join(" ")
        : ["/bin/sh", shell, ...args()].join(" ")
        : [process.execPath, entry, "--sdk-absent-h", ...args()].join(" ");
      if (fault === "exec-image-replaced" && chrome && pid === ids.L) image = "/foreign/unowned/program";
      return { stdout: Buffer.from(row(pid, pid === ids.L ? exited ? 1 : ids.E : ids.L, ids.L, image)), stderr: Buffer.alloc(0) };
    }
    if (program === "/usr/bin/pgrep") {
      if (commandArgs[0] === "-g") {
        if (Number(commandArgs[1]) === ids.member)
          return memberAlive ? { stdout: Buffer.from(String(ids.member)), stderr: Buffer.alloc(0) } : empty();
        if (fault === "unattributed-group" && Number(commandArgs[1]) === ids.L)
          return { stdout: Buffer.from(String(ids.member)), stderr: Buffer.alloc(0) };
        return gone || !allocated ? empty()
          : { stdout: Buffer.from(String(Number(commandArgs[1]) === ids.E ? ids.E : ids.L)), stderr: Buffer.alloc(0) };
      }
      const parent = Number(commandArgs[1]);
      if (parent === ids.L && chrome && memberAlive)
        return { stdout: Buffer.from(String(ids.member)), stderr: Buffer.alloc(0) };
      if (parent === ids.member) return empty();
      if (!allocated || gone || parent === ids.H || chrome && parent === ids.L) return empty();
      return { stdout: Buffer.from(String(parent === ids.E ? ids.L : ids.H)), stderr: Buffer.alloc(0) };
    }
    if (program === "/usr/sbin/lsof")
      return { stdout: Buffer.from(`p${fault === "wrong-kernel-peer" ? ids.L : ids.H}\nn127.0.0.1:62002->127.0.0.1:62001\n`), stderr: Buffer.alloc(0) };
    if (program !== "/fixed/pure-observer") throw Error("unexpected OS boundary");
    if (stopped) throw Error("C observer after SIGSTOP is forbidden");
    const role = commandArgs[0], uid = process.getuid();
    const kernel = [{ pid: process.pid, ppid: process.ppid, pgid: process.pid, uid },
      { pid: ids.E, ppid: process.pid, pgid: ids.E, uid }, { pid: ids.L, ppid: ids.E, pgid: ids.L, uid },
      ...(role === "helper" ? [{ pid: ids.H, ppid: ids.L, pgid: ids.L, uid }] : [])]
      .map((r, n) => ({ ...r, birth_seconds: 1792690000, birth_microseconds: n + 1 }));
    const descriptors = [{ fd: 0, type: 1, family: null, identity: null },
      ...(role === "launcher" ? [3, 4].map((fd, n) => ({
        fd: chrome ? fd + 14 : fd, type: 2, family: 1, identity: ["0x0000000000000123", "0x0000000000000456"][n],
      })) : [])];
    if (fault === "inherited-debug" && role === "helper")
      descriptors.push({ fd: 19, type: 2, family: 1, identity: "0x0000000000000123" });
    if (fault === "deadline" && role === "helper") virtual = 46000;
    if (fault === "profile-substitution" && role === "helper" && !existsSync(join(container, "held-profile"))) {
      renameSync(profile, join(container, "held-profile")); mkdirSync(profile, { mode: 0o700 });
    }
    return { stdout: Buffer.from(JSON.stringify({
      schema: "airlock.owned-macos-socket-inventory.v1", role, pid: Number(commandArgs[1]), caller_pid: process.pid,
      complete: true, roles_before: kernel, roles_after: kernel, descriptor_count: descriptors.length, descriptors,
      inventory_before: descriptors.map(({ fd, type }) => ({ fd, type })),
      inventory_after: descriptors.map(({ fd, type }) => ({ fd, type })), native_authority: false,
    })), stderr: Buffer.alloc(0) };
  };
  const kill = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
    signals.push({ pid, signal });
    if (fault === "fork-detach-after-final-scan" && pid === ids.L && signal === "SIGTERM") {
      // The last runnable ancestor forks after the completed descendants()
      // scan, before its termination. The new lifetime leaves every recorded
      // group and becomes orphaned; old-group emptiness cannot reveal it.
      escapedAfterScan = { pid: 620006, ppid: 1, pgid: 620006, alive: true };
    }
    if (fault === "signal-error" && pid === ids.E && signal === "SIGKILL") throw Object.assign(Error("pure EPERM"), { code: "EPERM" });
    if (pid === ids.E && signal === "SIGSTOP") stopped = true;
    else if (pid === ids.E) { exited = true; queueMicrotask(() => child.emit("exit", null, signal)); }
    else if (pid === ids.L) gone = true;
    else if (pid === ids.member) memberAlive = false;
    return true;
  });
  vi.doMock("node:child_process", () => ({ spawn, execFile }));
  vi.doMock("node:net", () => ({
    createServer: callback => {
      enrollmentPoll = setInterval(() => { if (saved("tcp-only")) { clearInterval(enrollmentPoll); callback(socket); } }, 1);
      return server;
    },
    connect: () => {
      const probe = new EventEmitter();
      let timer;
      Object.assign(probe, { destroyed: false, closeObserved: false, timerActive: false,
        allocatedAfterGenericDisposal: !server.listening && child.stdout.destroyed && child.stderr.destroyed });
      probe.destroy = vi.fn(() => {
        probe.destroyed = true;
        if (fault !== "probe-close-unsettled") queueMicrotask(() => { probe.closeObserved = true; probe.emit("close"); });
        return probe;
      });
      probe.setTimeout = vi.fn((ms, fn) => {
        clearTimeout(timer); probe.timerActive = ms > 0;
        if (ms > 0) timer = setTimeout(() => { probe.timerActive = false; fn(); }, ms);
        return probe;
      });
      probes.push(probe);
      if (["probe-deadline", "probe-close-unsettled"].includes(fault)) virtual += 45000;
      if (fault !== "probe-deadline")
        queueMicrotask(() => probe.emit("error", Object.assign(Error("refused"), { code: "ECONNREFUSED" })));
      return probe;
    },
  }));
  vi.doMock("./sdk-absent-chrome-io.mjs", async () => {
    const actual = await vi.importActual("./sdk-absent-chrome-io.mjs");
    return { ...actual, sources: () => ({ pure_boundary_not_qualified: true,
      revision: fault === "source-changed-before-exec" && ++sourceReads > 4 ? "changed" : "fixed" }),
      save: (root, name, value) => {
        if (name === "result") publicationBeforeProbeClose = probes.some(probe => !probe.closeObserved);
        const locator = actual.save(root, name, value);
        if (name === "result" && fault === "slow-final-publication") virtual += 46000;
        return locator;
      },
      preparedObserver: () => ({ path: "/fixed/pure-observer", sha256: "a".repeat(64), dev: 1, ino: 2 }) };
  });
  // Open only the module-level admission boundary in this pure traversal.
  // Cleanup still reports UNKNOWN; this is not a kernel-custody capability.
  vi.doMock("./sdk-absent-chrome-preexec.mjs", async () => ({
    ...await vi.importActual("./sdk-absent-chrome-preexec.mjs"),
    sdkAbsentChromeReadiness: () => ({ ready: true, reason: "pure-module-boundary-double-only" }),
  }));
  vi.stubEnv("AIRLOCK_RUN_SDK_ABSENT_CHROME", "explicit-sdk-absent-only");
  vi.resetModules();
  try {
    const { runSdkAbsentChromePreexec } = await import("./sdk-absent-chrome-runtime.mjs");
    const outerStarted = performance.now();
    const result = await runSdkAbsentChromePreexec({ outputDir, control });
    const outerElapsed = performance.now() - outerStarted;
    let lateCompletionVerdict = null, missingCompletionVerdict = null;
    if (fault === "slow-final-publication") {
      const { inspectSdkAbsentChromeCompletion } = await import("./sdk-absent-chrome-completion.mjs");
      const { hash, NODE } = await import("./sdk-absent-chrome-io.mjs");
      const path = join(outputDir, "result.json"), s = lstatSync(path), bytes = readFileSync(path);
      // Pure outer-observer boundary data, not an actual command/exit receipt.
      const receiptPath = join(container, "external-completion.json");
      writeFileSync(receiptPath, JSON.stringify({
        schema: "airlock.sdk-absent-chrome-whole-command-completion.v1",
        observer_scope: "external-whole-command-after-exit", exit_observed: true,
        command: [NODE, resolve("node_modules/vitest/vitest.mjs"), "run", "--config",
          resolve("rig/sdk-absent-chrome.browser.config.mjs"), "-t", "^ACTUAL SDK-ABSENT real Chrome " + control + "$"],
        actual_exit_code: 0, signal: null, timed_out: false,
        started_monotonic_ms: outerStarted, completed_monotonic_ms: outerStarted + outerElapsed,
        candidate: { path, dev: s.dev, ino: s.ino, bytes: bytes.length, sha256: hash(bytes) },
        source_vector_sha256: result.source_vector_sha256, sdk_absent: true, native_authority: false,
      }), { mode: 0o600 });
      const external = lstatSync(receiptPath), receiptBytes = readFileSync(receiptPath);
      missingCompletionVerdict = inspectSdkAbsentChromeCompletion({ outputDir, completion: null });
      lateCompletionVerdict = inspectSdkAbsentChromeCompletion({ outputDir, completion: {
        path: receiptPath, dev: external.dev, ino: external.ino, bytes: receiptBytes.length, sha256: hash(receiptBytes),
      } });
    }
    const finalDisposition = JSON.parse(readFileSync(result.registrations.at(-1).path));
    return { result, signals, queries, frames, receipts, child, socket, server, escapedAfterScan,
      probes, publicationBeforeProbeClose,
      outerElapsed, diskResult: saved("result"), lateCompletionVerdict, missingCompletionVerdict,
      probeStates: probes.map(probe => ({ allocatedAfterGenericDisposal: probe.allocatedAfterGenericDisposal,
        destroyed: probe.destroyed, closeObserved: probe.closeObserved, timerActive: probe.timerActive })),
      finalDisposition, profileRetained: existsSync(profile), tempRetained: existsSync(join(outputDir, "tmp")) };
  } finally {
    const evidence = process.env.AIRLOCK_SDK_ABSENT_PURE_EVIDENCE;
    if (evidence && existsSync(outputDir)) {
      mkdirSync(evidence, { recursive: true, mode: 0o700 });
      cpSync(container, join(evidence, control + "-" + (fault || "positive") + "-" + Date.now()),
        { recursive: true, errorOnExist: true, force: false });
    }
    for (const probe of probes) probe.setTimeout(0);
    clearInterval(enrollmentPoll); kill.mockRestore(); vi.restoreAllMocks(); vi.unstubAllEnvs();
    vi.doUnmock("node:child_process"); vi.doUnmock("node:net"); vi.doUnmock("./sdk-absent-chrome-io.mjs");
    vi.doUnmock("./sdk-absent-chrome-preexec.mjs"); vi.resetModules();
    rmSync(container, { recursive: true });
  }
}

describe("SDK-absent fixed runtime admission (no effects)", () => {
  it("cannot start without the explicit SDK-absent Chrome opt-in", async () => {
    const spawn = vi.fn(() => { throw Error("unexpected child allocation"); });
    vi.doMock("node:child_process", () => ({ spawn, execFile: vi.fn() }));
    vi.resetModules();
    try {
      const { runSdkAbsentChromePreexec } = await import("./sdk-absent-chrome-runtime.mjs");
      expect(typeof runSdkAbsentChromePreexec).toBe("function");
      await expect(runSdkAbsentChromePreexec({ outputDir: "/private/not-created", control: "normal" }))
        .rejects.toThrow("sdk_absent_explicit_opt_in_required");
      expect(spawn).not.toHaveBeenCalled();
    } finally { vi.doUnmock("node:child_process"); vi.resetModules(); }
  });

  describe("actual supervisor branch with OS/child/socket boundaries doubled", () => {
    it("never publishes a self-qualified candidate when final durable publication crosses 45 seconds", async () => {
      const value = await boundaryCase("pre-return-abort", "slow-final-publication");
      expect(value.outerElapsed).toBeGreaterThan(45000);
      expect(value.result).toEqual(value.diskResult);
      expect(value.diskResult.qualified).toBe(false);
      expect(value.diskResult.publication_contract.external_completion_required).toBe(true);
      expect(value.diskResult.publication_contract.producer_elapsed_before_publication_ms).toBeLessThan(45000);
      expect(value.missingCompletionVerdict).toMatchObject({ qualified: false, reason: "external_completion_missing" });
      expect(value.lateCompletionVerdict).toMatchObject({ qualified: false,
        external_completion_valid: false, reason: "external_completion_deadline" });
    });
    it("destroys, disarms and settles the exact P-owned probe when deadline wins after generic disposal", async () => {
      const value = await boundaryCase("pre-return-abort", "probe-deadline");
      expect(value.probes).toHaveLength(1);
      expect(value.probeStates[0]).toMatchObject({ allocatedAfterGenericDisposal: true,
        destroyed: true, closeObserved: true, timerActive: false });
      expect(value.publicationBeforeProbeClose).toBe(false);
      expect(value.result.probe_dispositions[0]).toMatchObject({ close_observed: true, disposition: "closed" });
    });
    it("preserves a missing probe close event as UNKNOWN rather than a settled socket", async () => {
      const value = await boundaryCase("pre-return-abort", "probe-close-unsettled");
      expect(value.probeStates[0]).toMatchObject({ destroyed: true, closeObserved: false, timerActive: false });
      expect(value.result.probe_dispositions[0]).toMatchObject({ close_observed: false, disposition: "UNKNOWN" });
      expect(value.finalDisposition.outstanding_probe_count).toBe(1);
      expect(value.result.resource_complete).toBe(false);
    });
    it("cannot certify or delete a profile when a runnable ancestor forks and detaches AFTER the final scan", async () => {
      const value = await boundaryCase("pre-return-abort", "fork-detach-after-final-scan");
      expect(value.escapedAfterScan).toEqual({ pid: 620006, ppid: 1, pgid: 620006, alive: true });
      expect(value.result.acquisition_roles_fully_attributed).toBe(true);
      expect(value.result.actual_chrome_observed).toBe(true);
      expect(value.finalDisposition.attribution_gap).toBeNull();
      expect(value.finalDisposition.groups.every(group => group.members.length === 0)).toBe(true);
      expect(value.signals.some(action => action.pid === 620006)).toBe(false);
      expect(value.result.resource_complete).toBe(false);
      expect(value.result.control_witnessed).toBe(false);
      expect(value.result.descendant_boundary).toBe("UNKNOWN-runnable-fork-detach-escape");
      expect(value.profileRetained && value.tempRetained).toBe(true);
      expect(value.finalDisposition.profile_removed).toBe(false);
    });
    it("registers before acquisition, then verifies normal CDP and moved socket handles", async () => {
      const { result, receipts, queries } = await boundaryCase("normal");
      // Sampled discovery cannot justify the old whole-tree success assertion.
      expect(result.errors).toContain("sdk_absent_descendant_closure_UNPROVED");
      expect(result).toMatchObject({ acquisition_control_observed: true, control_witnessed: false, resource_complete: false,
        normal_cdp: true, browser_server_returned: true, native_qualified: false });
      expect(receipts).toEqual([{ phase: "launch-permission", root: true, pending: true }]);
      expect(queries.filter(q => q.program === "/fixed/pure-observer").length).toBeGreaterThanOrEqual(5);
    });
    it("stops E before exec-ready, observes actual late Chrome image and never queries C after STOP", async () => {
      const { result, signals, queries } = await boundaryCase("pre-return-abort");
      expect(result.errors).toContain("sdk_absent_descendant_closure_UNPROVED");
      expect(result).toMatchObject({ acquisition_control_observed: true, control_witnessed: false, resource_complete: false,
        normal_cdp: false, browser_server_returned: false,
        pre_return_abort: { engine_stopped_before_exec_ready: true, actual_chrome_while_engine_stopped: true } });
      expect(signals).toContainEqual({ pid: 620002, signal: "SIGSTOP" });
      expect(queries.some(q => q.program === "/fixed/pure-observer" && q.stopped)).toBe(false);
    });
    it.each(["normal", "pre-return-abort"])("attributes and closes a detached renderer by exact lifetime in %s", async control => {
      const { result, signals, outerElapsed } = await boundaryCase(control, "detached-descendant");
      expect(outerElapsed).toBeLessThan(45000);
      expect(result.errors).toContain("sdk_absent_descendant_closure_UNPROVED");
      expect(result.resource_complete).toBe(false);
      expect(signals).toContainEqual({ pid: 620005, signal: "SIGTERM" });
      expect(result.registrations.length).toBeGreaterThan(10);
    });
    it.each(["early-engine-loss", "profile-substitution", "deadline"])(
      "refuses %s through real registration/abort logic, not a copied algorithm", async fault => {
        const { result, frames, child } = await boundaryCase("pre-return-abort", fault);
        expect(result.control_witnessed).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(frames.some(f => f.stage === "exec-ready")).toBe(false);
        expect(child.stdout.destroyed && child.stderr.destroyed).toBe(true);
        if (fault === "profile-substitution") expect(result.resource_complete).toBe(false);
        if (fault === "early-engine-loss") {
          expect(result.resource_complete).toBe(true);
          expect(result.launch_permission_issued).toBe(false);
          expect(result.actual_chrome_observed).toBe(false);
        }
      });
    it.each(["wrong-kernel-peer", "inherited-debug", "source-changed-before-exec"])(
      "rejects actual %s boundary evidence before any exec-ready", async fault => {
        const { result, frames } = await boundaryCase("pre-return-abort", fault);
        expect(result.control_witnessed).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(frames.some(f => f.stage === "exec-ready")).toBe(false);
      });
    it.each(["exec-image-replaced", "engine-resumed-after-exec", "unattributed-group", "signal-error", "cleanup-observation-error"])(
      "preserves %s as unqualified and never signals an unattributed PID", async fault => {
        const { result, signals, child, finalDisposition } = await boundaryCase("pre-return-abort", fault);
        expect(result.control_witnessed).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(signals.every(action => [620002, 620003, 620004].includes(action.pid))).toBe(true);
        expect(child.stdout.destroyed && child.stderr.destroyed).toBe(true);
        if (["exec-image-replaced", "unattributed-group", "signal-error", "cleanup-observation-error"].includes(fault))
          expect(result.resource_complete).toBe(false);
        if (fault === "engine-resumed-after-exec") {
          expect(result.errors).toContain("sdk_absent_not_genuine_pre_return");
          expect(result.acquisition_control_observed).toBe(false);
          expect(result.pre_return_abort.actual_chrome_while_engine_stopped).toBe(false);
        }
        if (fault === "unattributed-group") {
          expect(finalDisposition.groups.find(group => group.pgid === 620003))
            .toMatchObject({ disposition: "UNKNOWN", members: [null] });
        }
      });
  });
});
