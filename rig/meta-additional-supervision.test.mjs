import { readFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe("closed additional SDK-absent process supervision", () => {
  it("does not treat a changed launcher image as the same process from second-resolution birth alone", async () => {
    const { inspectAdditionalBrowserMembers } = await import("./meta-additional-supervision.mjs");
    const path = mkdtempSync(join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-transition"));
    roots.push(path);
    const stat = lstatSync(path);
    const profile = { argument_path: path, path, dev: stat.dev, ino: stat.ino,
      birthtime_ms: stat.birthtimeMs, uid: process.getuid() };
    const launcher = "/bin/sh " + new URL("./qualification-loopback-chrome", import.meta.url).pathname +
      " --user-data-dir=" + path;
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=" + path;
    const hash = value => createHash("sha256").update(value).digest("hex");
    const original = { pid: 710002, ppid: 710001, pgid: 710002, uid: process.getuid(),
      started: "Thu Oct 29 12:00:00 2026", state: "S", command_sha256: hash(launcher) };
    const item = { root: original, root_command: launcher, profile, chromeReady: false,
      members: new Map([[original.pid, original]]) };
    const changed = { ...original, command: chrome, command_sha256: hash(chrome) };
    expect(() => inspectAdditionalBrowserMembers(item, [changed])).toThrow("additional_process_replaced");
    expect(item.root).toEqual(original);
    expect(item.chromeReady).toBe(false);
  });
  it("does not ignore a replaced root when a known helper still anchors its group", async () => {
    const { inspectAdditionalBrowserMembers } = await import("./meta-additional-supervision.mjs");
    const command = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --type=unit";
    const hash = value => createHash("sha256").update(value).digest("hex");
    const root = { pid: 710002, ppid: 710001, pgid: 710002, uid: process.getuid(),
      started: "Thu Oct 29 12:00:00 2026", state: "S", command_sha256: hash(command) };
    const helper = { ...root, pid: 710003, ppid: root.pid };
    const item = { root, root_command: command, chromeReady: true,
      members: new Map([[root.pid, root], [helper.pid, helper]]) };
    const replaced = { ...root, command: command + " --changed", command_sha256: hash(command + " --changed") };
    expect(() => inspectAdditionalBrowserMembers(item, [replaced, { ...helper, command }]))
      .toThrow("additional_process_replaced");
  });
  it.each(["stable", "replaced", "reappeared", "unknown-image", "cleanup-replaced"])(
    "serializes discovery and preserves %s group observations through cleanup", async (scenario) => {
    // Pure unit: execute the REAL supervisor/discover/ledger code, but replace
    // process launch, ps/pgrep/lsof and TCP with deterministic in-memory doubles.
    // No child/browser/socket is created and the simulated child exits 2:
    // this must never produce a qualified or browser-qualification artifact.
    const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
    const f = createAdditionalMetaFixture(), output_dir = join(f.root, "pure-overlap");
    roots.push(f.root);
    const profile = mkdtempSync(join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-overlap"));
    roots.push(profile);
    const run = join(f.root, "run"); mkdirSync(run, { mode: 0o700 });
    for (const name of ["inspector-key.pem", "receiver-key.pem"])
      writeFileSync(join(run, name), "pure-unit-placeholder-not-a-key", { mode: 0o600 });
    const deferred = () => {
      let resolve;
      const promise = new Promise(value => { resolve = value; });
      return { promise, resolve };
    };
    const entered = deferred(), barrier = deferred(), readyAck = deferred(), replacementObserved = deferred();
    const child = new EventEmitter();
    Object.assign(child, { pid: 710001, connected: true, stdout: new PassThrough(), stderr: new PassThrough(),
      disconnect() { this.connected = false; }, unref() {} });
    let argv, finished = false, acknowledged = false, groupCalls = 0, discoveries = 0;
    const now = new Date(), [weekday, month, date, year] = now.toDateString().split(" ");
    const started = `${weekday} ${month} ${Number(date)} ${now.toTimeString().slice(0, 8)} ${year}`;
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const browserCommand = chrome + " --user-data-dir=" + profile;
    const row = (pid, ppid, pgid, command) =>
      `${pid} ${ppid} ${pgid} ${process.getuid()} ${started} S ${command}\n`;
    const nodeRow = () => row(child.pid, process.pid, child.pid, argv.join(" "));
    const browserRow = () => row(710002, child.pid, 710002, browserCommand);
    const lateRow = () => row(710003, 710002, 710002, chrome + " Helper --type=unit-only");
    child.send = value => {
      if (value.id === 1) queueMicrotask(() => child.emit("message", { type: "additional-browser-pending", id: 2 }));
      if (value.id === 3) { acknowledged = true; readyAck.resolve(); }
    };
    const spawn = vi.fn((executable, args) => {
      argv = [executable, ...args];
      setImmediate(() => child.emit("message", { type: "additional-ports", id: 1, ports: [41001, 41002, 41003] }));
      return child;
    });
    const execFile = vi.fn();
    execFile[promisify.custom] = async (command, args) => {
      if (command === "/usr/bin/pgrep") { discoveries++; return { stdout: finished ? "" : "710002\n", stderr: "" }; }
      if (command === "/usr/sbin/lsof")
        return { stdout: [41001, 41002, 41003, 41004].map(port => "n127.0.0.1:" + port).join("\n"), stderr: "" };
      if (command !== "/bin/ps") throw Error("unexpected_pure_unit_command");
      if (finished) {
        if (scenario === "cleanup-replaced" && args[0] === "-g" && args[1] === "710002")
          return { stdout: row(710002, child.pid, 710002, browserCommand + " --changed") + lateRow(), stderr: "" };
        if (scenario === "reappeared" && args[0] === "-g" && args[1] === "710002")
          return { stdout: browserRow() + lateRow(), stderr: "" };
        return { stdout: "", stderr: "" };
      }
      if (args[0] === "-p") {
        if (args[1] === String(child.pid)) return { stdout: nodeRow(), stderr: "" };
        if (scenario === "unknown-image" && discoveries >= 3) {
          replacementObserved.resolve();
          return { stdout: row(710002, child.pid, 710099, "/unrecognized/replacement"), stderr: "" };
        }
        return { stdout: browserRow(), stderr: "" };
      }
      if (args[1] === String(child.pid)) return { stdout: nodeRow(), stderr: "" };
      if (++groupCalls === 1) {
        entered.resolve();
        await barrier.promise; // Real discover has already inserted ownership.
      }
      if (["replaced", "reappeared"].includes(scenario) && groupCalls >= 4) {
        replacementObserved.resolve();
        return { stdout: row(710002, child.pid, 710002, browserCommand + " --changed") + lateRow(), stderr: "" };
      }
      if (scenario === "unknown-image" && groupCalls >= 4) return { stdout: lateRow(), stderr: "" };
      return { stdout: browserRow() + (discoveries >= 2 ? lateRow() : ""), stderr: "" };
    };
    const connect = vi.fn(() => {
      const socket = new EventEmitter();
      socket.destroy = () => {}; socket.setTimeout = () => socket;
      queueMicrotask(() => socket.emit("error", Object.assign(Error("unit-only-refused"), { code: "ECONNREFUSED" })));
      return socket;
    });
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ spawn, execFile }));
    vi.doMock("node:net", async () => ({ ...await vi.importActual("node:net"), connect }));
    const signal = vi.spyOn(process, "kill").mockImplementation((pid, name) => {
      if (pid !== child.pid || name !== "SIGTERM") throw Error("pure_unit_unexpected_signal");
      finished = true; child.emit("exit", 2, null); child.emit("close", 2, null);
      return true;
    });
    let supervising, proof;
    try {
      const { superviseAdditionalMetaChild } = await import("./meta-additional-supervision.mjs");
      supervising = superviseAdditionalMetaChild({ ...f.options(), protocol: "h2", output_dir });
      await entered.promise;
      child.emit("message", { type: "additional-browser-ready", id: 3, pid: 710002, port: 41004 });
      // All runnable mocked OS work drains in this turn. Only the first real
      // discovery's inventory await remains blocked; no wall-time race/sleep.
      await new Promise(setImmediate);
      const acknowledgedBeforeInventory = acknowledged;
      barrier.resolve();
      await new Promise(setImmediate);
      await readyAck.promise;
      if (["replaced", "reappeared", "unknown-image"].includes(scenario)) {
        child.emit("message", { type: "additional-browser-ready", id: 4, pid: 710002, port: 41004 });
        await replacementObserved.promise;
        await new Promise(setImmediate);
      }
      finished = true; child.emit("exit", 2, null); child.emit("close", 2, null);
      const result = await supervising;
      proof = JSON.parse(readFileSync(result.supervision.path));
      expect(result.actual_exit_code).toBe(2);
      expect(proof.qualified).toBe(false);
      expect(acknowledgedBeforeInventory).toBe(false);
      const records = proof.registrations.map(handle => JSON.parse(readFileSync(handle.path)));
      const expected = ["node", "ports", "browser-pending", "browser-discovered", "browser-ready"];
      if (["replaced", "reappeared", "unknown-image"].includes(scenario)) expected.push("ownership-mismatch");
      expected.push("resources-final");
      expect(records.map(record => record.phase)).toEqual(expected);
      expect(records.find(record => record.phase === "browser-ready").browsers[0].members
        .some(member => member.pid === 710003)).toBe(true);
      expect(discoveries).toBeGreaterThanOrEqual(2);
      if (scenario === "stable") expect(proof.errors).toEqual([]);
      else if (scenario === "cleanup-replaced") {
        expect(proof.resource_disposition).toBe("unknown");
        expect(proof.browsers[0]).toMatchObject({ status: "unknown", profile_removed: false,
          errors: ["additional_process_replaced"], error_observation: { complete: true } });
        expect(proof.browsers[0].error_observation.rows.map(row => row.pid)).toEqual([710002, 710003]);
        expect(proof.private_keys.every(key => key.removed === false)).toBe(true);
      } else {
        expect(proof.errors).toContain("additional_process_replaced");
        expect(proof.resource_disposition).toBe("unknown");
        expect(proof.browsers[0]).toMatchObject({ status: "unknown", profile_removed: false });
        expect(proof.private_keys.every(key => key.removed === false)).toBe(true);
        if (scenario === "reappeared")
          expect(proof.browsers[0].errors).toContain("additional_browser_ownership_unknown");
      }
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(signal.mock.calls.every(([pid, name]) => pid === child.pid && name === "SIGTERM")).toBe(true);
      if (["stable", "cleanup-replaced"].includes(scenario)) expect(signal).not.toHaveBeenCalled();
    } finally {
      barrier.resolve();
      if (!finished) { finished = true; child.emit("exit", 2, null); child.emit("close", 2, null); }
      if (supervising) await supervising;
      vi.doUnmock("node:child_process"); vi.doUnmock("node:net");
      vi.restoreAllMocks(); vi.resetModules();
    }
  }, 10000);
  it("retains registered keys after an error even when no browser was acquired", async () => {
    const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
    const f = createAdditionalMetaFixture(), output_dir = join(f.root, "no-browser-error");
    roots.push(f.root);
    const run = join(f.root, "run"); mkdirSync(run, { mode: 0o700 });
    for (const name of ["inspector-key.pem", "receiver-key.pem"])
      writeFileSync(join(run, name), "pure-unit-placeholder-not-a-key", { mode: 0o600 });
    const child = new EventEmitter();
    Object.assign(child, { pid: 720001, connected: true, stdout: new PassThrough(), stderr: new PassThrough(),
      disconnect() { this.connected = false; }, unref() {} });
    let argv, finished = false;
    const now = new Date(), [weekday, month, date, year] = now.toDateString().split(" ");
    const started = `${weekday} ${month} ${Number(date)} ${now.toTimeString().slice(0, 8)} ${year}`;
    child.send = value => {
      if (value.id !== 1) return;
      queueMicrotask(() => child.emit("message", { type: "unexpected", id: 2 }));
      setImmediate(() => { finished = true; child.emit("exit", 2, null); child.emit("close", 2, null); });
    };
    const spawn = vi.fn((executable, args) => {
      argv = [executable, ...args];
      setImmediate(() => child.emit("message", { type: "additional-ports", id: 1, ports: [42001, 42002, 42003] }));
      return child;
    });
    const execFile = vi.fn();
    execFile[promisify.custom] = async (command) => {
      if (command === "/usr/sbin/lsof")
        return { stdout: [42001, 42002, 42003].map(port => "n127.0.0.1:" + port).join("\n"), stderr: "" };
      if (command !== "/bin/ps") throw Error("unexpected_pure_unit_command");
      return { stdout: finished ? "" : `${child.pid} ${process.pid} ${child.pid} ${process.getuid()} ${started} S ${argv.join(" ")}\n`, stderr: "" };
    };
    const connect = vi.fn(() => {
      const socket = new EventEmitter();
      socket.destroy = () => {}; socket.setTimeout = () => socket;
      queueMicrotask(() => socket.emit("error", Object.assign(Error("unit-only-refused"), { code: "ECONNREFUSED" })));
      return socket;
    });
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ spawn, execFile }));
    vi.doMock("node:net", async () => ({ ...await vi.importActual("node:net"), connect }));
    try {
      const { superviseAdditionalMetaChild } = await import("./meta-additional-supervision.mjs");
      const result = await superviseAdditionalMetaChild({ ...f.options(), protocol: "h2", output_dir });
      const proof = JSON.parse(readFileSync(result.supervision.path));
      expect(proof.errors).toContain("additional_supervision_message");
      expect(proof).toMatchObject({ resource_disposition: "unknown", browsers: [] });
      expect(proof.private_keys).toHaveLength(2);
      expect(proof.private_keys.every(key => key.removed === false && existsSync(key.path))).toBe(true);
    } finally {
      vi.doUnmock("node:child_process"); vi.doUnmock("node:net");
      vi.restoreAllMocks(); vi.resetModules();
    }
  }, 10000);
  it.each(["pid", "pgid", "uid", "started", "command_sha256"])(
    "refuses a changed %s in the actual pre-signal ownership guard", async key => {
      const { sameAdditionalProcess } = await import("./meta-additional-supervision.mjs");
      const identity = { pid: 123, ppid: 122, pgid: 123, uid: 501,
        started: "Wed Oct 21 12:00:00 2026", command_sha256: "a".repeat(64) };
      expect(sameAdditionalProcess(identity, { ...identity })).toBe(true);
      expect(sameAdditionalProcess(identity, { ...identity, [key]: "changed" })).toBe(false);
    });
  it("refuses arbitrary programs, timers, drivers, proxies and accessors before allocation", async () => {
    const { superviseAdditionalMetaChild } = await import("./meta-additional-supervision.mjs");
    let calls = 0;
    for (const value of [{}, { control: "native" }, { timeout: 1 },
      { get protocol() { calls++; return "h2"; } }, new Proxy({}, { ownKeys() { calls++; return []; } })])
      await expect(superviseAdditionalMetaChild(value)).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it.runIf(process.env.AIRLOCK_ADDITIONAL_META_QUALIFICATION === "1")(
    "actually bounds an ignoring Node shutdown after owned Chromium allocation and proves forced cleanup", async () => {
      const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
      const { superviseAdditionalMetaChild } = await import("./meta-additional-supervision.mjs");
      const f = createAdditionalMetaFixture();
      const output_dir = process.env.AIRLOCK_ADDITIONAL_META_OUTPUT + "-stuck-supervision";
      const child = await superviseAdditionalMetaChild({ ...f.options(), protocol: "h2",
        output_dir, control: "stuck-shutdown" });
      expect(child).toMatchObject({ actual_exit_code: null, signal: "SIGKILL", command_exit_observed: true });
      const proof = JSON.parse(readFileSync(child.supervision.path));
      expect(proof).toMatchObject({ timed_out: true, qualified: false, child_exit_observed: true,
        node_term_observed: true, resource_disposition: "closed", stuck_after_allocation_observed: true });
      expect(proof.elapsed_ms).toBeLessThan(60000);
      expect(proof.registrations.length).toBeGreaterThan(0);
      expect(proof.node_signals.some(row => row.signal === "SIGTERM" && row.outcome === "sent")).toBe(true);
      expect(proof.node_signals.some(row => row.signal === "SIGKILL" && row.outcome === "sent")).toBe(true);
      expect(proof.browsers).toHaveLength(1);
      const browser = proof.browsers[0];
      expect(browser.signals.some(row => row.signal === "SIGKILL" && row.outcome === "sent")).toBe(true);
      expect(browser.processes.every(row => ["absent", "zombie"].includes(row.final))).toBe(true);
      expect(browser.profile_removed).toBe(true);
      expect(proof.ports.every(row => row.closed === true)).toBe(true);
      expect(proof.private_keys).toHaveLength(2);
      expect(proof.private_keys.every(row => row.removed === true && !existsSync(row.path))).toBe(true);
      expect(existsSync(browser.profile.path)).toBe(false);
      expect(existsSync(join(f.root, "run/supervision-abort-originals.json"))).toBe(true);
      expect(existsSync(join(f.root, "run/completion.json"))).toBe(false);
      expect(existsSync(join(f.root, "native-stock-slots-synthetic-inspected-meta-additional/meta-stock.reserved"))).toBe(true);
    }, 65000);
});
