import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { data } from "./inspected-meta-record.mjs";

const fake = vi.hoisted(() => ({
  host: null, rows: new Map(), signals: [], onSignal: null, source: null, ignoreTerm: new Set(),
}));
vi.mock("node:process", () => ({ default: new Proxy({}, { get: (_target, key) => {
  const value = fake.host[key];
  return typeof value === "function" ? value.bind(fake.host) : value;
} }) }));
vi.mock("./meta-additional-supervision.mjs", async () => ({
  inspectAdditionalBrowserMembers: (await vi.importActual("./meta-additional-supervision.mjs")).inspectAdditionalBrowserMembers,
  sameAdditionalProcess: (a, b) => !!a && !!b &&
    ["pid", "pgid", "uid", "started", "command_sha256"].every((key) => a[key] === b[key]),
  readAdditionalProcesses: vi.fn(async (ids, _deadline, groups) => groups
    ? [...fake.rows.values()].filter(row => ids.includes(row.pgid))
    : ids.flatMap((id) => fake.rows.has(id) ? [fake.rows.get(id)] : [])),
  signalAdditionalOwnedProcess: vi.fn(async (expected, signal, _deadline, log) => {
    const current = fake.rows.get(expected.pid);
    if (!current || current.started !== expected.started || current.command_sha256 !== expected.command_sha256) {
      throw new Error("additional_process_replaced");
    }
    fake.signals.push({ pid: expected.pid, signal });
    log.push({ pid: expected.pid, signal, outcome: "sent" });
    await fake.onSignal?.(expected, signal);
    if (signal === "SIGSTOP") fake.rows.set(expected.pid, { ...current, state: "T" });
    else if (signal !== "SIGTERM" || !fake.ignoreTerm.has(expected.pid)) fake.rows.delete(expected.pid);
  }),
}));
vi.mock("./inspected-meta-stock.mjs", () => ({ inspectedMetaSourcePins: () => fake.source }));

const roots = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entry = fileURLToPath(new URL("./meta-attended-reference.mjs", import.meta.url));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  fake.rows.clear(); fake.signals.length = 0; fake.ignoreTerm.clear();
});

function fixture(mode = "--local-h1") {
  fake.onSignal = null; fake.source = { candidate: "unit-only" };
  const root = mkdtempSync(join(realpathSync(tmpdir()), "meta-attended-unit-"));
  roots.push(root);
  const output = join(root, "run"); mkdirSync(output, { mode: 0o700 });
  const window = { not_before_ms: Date.now() - 10, expires_at_ms: Date.now() + 59000 };
  const binding = { source_pins: { candidate: "unit-only" }, window,
    additional: { variant: "additional-meta-2026-10-21" } };
  const manifestPath = join(root, "manifest.json");
  const manifestBody = Buffer.from(JSON.stringify({
    schema_version: 1, kind: "airlock.inspected-meta-local.v1", case_name: "meta-stock",
    output_dir: output, binding,
  }));
  writeFileSync(manifestPath, manifestBody, { mode: 0o600 });
  const manifest = { path: manifestPath, sha256: hash(manifestBody) };
  fake.host = Object.assign(new EventEmitter(), {
    pid: 710001, execPath: process.execPath, getuid: () => process.getuid(),
    argv: [process.execPath, entry, mode, manifest.path, manifest.sha256],
  });
  fake.rows.set(fake.host.pid, { pid: fake.host.pid, ppid: 710000, pgid: 710000,
    uid: process.getuid(), started: "Tue Oct 27 09:00:00 2026", state: "S",
    command: fake.host.argv.join(" "), command_sha256: hash(fake.host.argv.join(" ")) });
  const profile = mkdtempSync(join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-"));
  roots.push(profile);
  const child = Object.assign(new EventEmitter(), {
    pid: 710002, exitCode: null, signalCode: null, spawnargs: [chrome, `--user-data-dir=${profile}`],
  });
  const row = { pid: child.pid, ppid: fake.host.pid, pgid: child.pid, uid: process.getuid(),
    started: "Tue Oct 27 09:00:01 2026", state: "S",
    command: `${chrome} --user-data-dir=${profile}` };
  row.command_sha256 = hash(row.command);
  fake.rows.set(child.pid, row);
  const server = {
    process: () => child,
    close: vi.fn(async () => {
      fake.rows.delete(child.pid);
      rmSync(profile, { recursive: true });
      child.exitCode = 0; child.emit("exit", 0, null); child.emit("close", 0, null);
    }),
  };
  const onStop = vi.fn();
  return { root, output, manifest, binding, profile, child, server, onStop,
    options: { output_dir: output, manifest, binding_sha256: hash(JSON.stringify(data(binding))),
      source_pins: binding.source_pins, window, deadline_ms: performance.now() + 60000,
      onStop, retain: (value) => value } };
}

describe("attended control — controlled OS/process events and private temp files, NOT browser proof", () => {
  it("persists pending ownership before allocation and binds returned browser before readiness", async () => {
    const f = fixture();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    const owner = JSON.parse(readFileSync(join(f.output, "attended-owner-command.json")));
    expect(owner.command.slice(2)).toEqual([
      "--stop", control.ownerCommand().control_path, control.ownerCommand().control_sha256,
    ]);
    await control.beforeBrowser();
    expect(JSON.parse(readFileSync(join(f.output, "attended-browser-pending.json"))).phase).toBe("browser-pending");
    await control.trackBrowser(Promise.resolve(f.server));
    const owned = JSON.parse(readFileSync(join(f.output, "attended-browser-owned.json")));
    expect(owned.browser.pid).toBe(f.child.pid);
    expect(owned.profile.path).toBe(f.profile);
    expect(f.onStop).not.toHaveBeenCalled();
    await f.server.close();
    const final = await control.finish();
    expect(final).toMatchObject({ pending_settled: true, browser_closed: true, profile_absent: true, errors: [] });
  });

  it("retains a late browser and closes it after stopping, not a discarded timed-out promise", async () => {
    const f = fixture(), late = deferred();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser();
    const tracked = control.trackBrowser(late.promise);
    control.requestStop("owner_stop_requested");
    expect(f.onStop).toHaveBeenCalledWith("owner_stop_requested");
    late.resolve(f.server);
    await tracked;
    expect(f.server.close).toHaveBeenCalledOnce();
    expect((await control.finish()).browser_closed).toBe(true);
  });

  it("reports an unsettled acquisition as UNKNOWN inside the original bound", async () => {
    const f = fixture();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser();
    void control.trackBrowser(new Promise(() => {}));
    const afterOriginalBound = performance.now() + 61000;
    vi.spyOn(performance, "now").mockReturnValue(afterOriginalBound);
    const final = await control.finish();
    expect(final.pending_settled).toBe(false);
    expect(final.errors).toContain("attended_acquisition_unknown");
    expect(final.browser_closed).toBe(false);
  });

  it("handles cooperative signals by stopping admission first and restoring listeners", async () => {
    const f = fixture();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    fake.host.emit("SIGTERM");
    expect(f.onStop).toHaveBeenCalledWith("owner_stop_requested");
    await expect(control.beforeBrowser()).rejects.toThrow("owner_stop_requested");
    await control.finish();
    expect(fake.host.listenerCount("SIGTERM")).toBe(0);
    expect(fake.host.listenerCount("SIGINT")).toBe(0);
  });

  it.each(["started", "command_sha256", "uid", "pgid"])("refuses a replaced controller %s before signaling", async (key) => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    const owner = control.ownerCommand();
    fake.rows.set(710001, { ...fake.rows.get(710001), [key]: "replaced" });
    fake.host.pid = 710003;
    await expect(stopMetaAttendedCase(owner)).rejects.toThrow("attended_controller_replaced");
    expect(fake.signals).toEqual([]);
    await control.finish();
  });

  it("stops only recorded case processes; a digest is not arbitrary PID authority", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    fake.host.pid = 710003;
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(fake.signals.map((row) => row.pid)).toEqual([710001, 710002]);
    expect(result.controller_stopped).toBe(true);
    expect(result.browser_stopped).toBe(true);
    expect(existsSync(f.profile)).toBe(true); // Manual stop never deletes a profile.
    await control.finish();
  });

  it("still stops the verified controller when a recorded browser helper changes", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const root = fake.rows.get(f.child.pid), helperCommand = chrome + " Helper --type=unit";
    const helper = { ...root, pid: 710004, ppid: root.pid, command: helperCommand,
      command_sha256: hash(helperCommand) };
    fake.rows.set(helper.pid, helper);
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    const changed = helperCommand + " --changed";
    fake.rows.set(helper.pid, { ...helper, command: changed, command_sha256: hash(changed) });
    fake.host.pid = 710003;
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result).toMatchObject({ status: "UNKNOWN", controller_stopped: true, browser_stopped: false });
    expect(result.errors).toContain("additional_process_replaced");
    expect(fake.signals).toEqual([{ pid: 710001, signal: "SIGTERM" }]);
    expect(existsSync(join(f.output, "attended-stop-request.json"))).toBe(true);
    expect(existsSync(join(f.output, "attended-owner-stop.json"))).toBe(true);
    await control.finish();
  });

  it("rejects copied or symlinked control records without any signal", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options), owner = control.ownerCommand();
    const copied = join(f.output, "copied.json");
    writeFileSync(copied, readFileSync(owner.control_path), { mode: 0o600 });
    const link = join(f.output, "linked.json"); symlinkSync(owner.control_path, link);
    fake.host.pid = 710003;
    await expect(stopMetaAttendedCase({ ...owner, control_path: copied })).rejects.toThrow();
    await expect(stopMetaAttendedCase({ ...owner, control_path: link })).rejects.toThrow();
    expect(fake.signals).toEqual([]);
    await control.finish();
  });

  it("rejects same-byte replacement at the original control path by its committed inode", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options), owner = control.ownerCommand();
    const bytes = readFileSync(owner.control_path);
    // Keep the original inode occupied so the replacement cannot reuse it.
    const displaced = join(f.output, "displaced.json");
    const { renameSync } = await import("node:fs");
    renameSync(owner.control_path, displaced);
    writeFileSync(owner.control_path, bytes, { mode: 0o600 });
    fake.host.pid = 710003;
    await expect(stopMetaAttendedCase(owner)).rejects.toThrow("attended_case_identity");
    expect(fake.signals).toEqual([]);
    await control.finish();
  });

  it("allows stopping an expired owned case but refuses starting expired work", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    vi.spyOn(Date, "now").mockReturnValue(f.options.window.expires_at_ms + 1);
    await expect(control.beforeBrowser()).rejects.toThrow("attended_case_window");
    fake.host.pid = 710003;
    const stopped = await stopMetaAttendedCase(control.ownerCommand());
    expect(stopped.controller_stopped).toBe(true);
    expect(stopped.status).toBe("UNKNOWN"); // No returned browser identity is invented.
    await control.finish();
  });

  it("rejects changed source pins before any owner signal", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    fake.source = { candidate: "changed" }; fake.host.pid = 710003;
    await expect(stopMetaAttendedCase(control.ownerCommand())).rejects.toThrow("attended_case_context");
    expect(fake.signals).toEqual([]);
    await control.finish();
  });

  it("cannot turn a forged browser parent into ownership of another process", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    const path = join(f.output, "attended-browser-owned.json"), value = JSON.parse(readFileSync(path));
    const foreign = { ...fake.rows.get(f.child.pid), pid: 710009, pgid: 710009, ppid: 99999 };
    foreign.command_sha256 = hash(foreign.command); fake.rows.set(foreign.pid, foreign);
    value.browser = { ...foreign, ppid: 710001 };
    delete value.browser.state; delete value.browser.command;
    value.observation = { ...foreign, ppid: 710001 };
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
    fake.host.pid = 710003;
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result).toMatchObject({ status: "UNKNOWN", controller_stopped: true, browser_stopped: false });
    expect(result.errors).toContain("attended_browser_context");
    // The verified controller remains stoppable; the forged browser is never signalled.
    expect(fake.signals).toEqual([{ pid: 710001, signal: "SIGTERM" }]);
    await control.finish();
  });

  it("does not signal a browser PID that appears after the initial observation was absent", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    const original = fake.rows.get(f.child.pid);
    fake.rows.delete(f.child.pid); fake.host.pid = 710003;
    fake.onSignal = async (target, signal) => {
      if (target.pid === 710001 && signal === "SIGTERM")
        fake.rows.set(f.child.pid, { ...original, ppid: 99999 });
    };
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result).toMatchObject({ status: "UNKNOWN", controller_stopped: true, browser_stopped: false });
    expect(result.errors).toContain("attended_browser_reappeared");
    expect(fake.signals).toEqual([{ pid: 710001, signal: "SIGTERM" }]);
    await control.finish();
  });

  it("does not cooperatively close or kill a browser after a known helper changes", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    const helper = { ...fake.rows.get(f.child.pid), pid: 710004, ppid: f.child.pid,
      command: `${chrome} Helper --type=unit-only` };
    helper.command_sha256 = hash(helper.command); fake.rows.set(helper.pid, helper);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    const changed = { ...helper, command: helper.command + " --changed" };
    changed.command_sha256 = hash(changed.command); fake.rows.set(helper.pid, changed);
    fake.host.pid = 710003;
    let closeError, killError;
    fake.onSignal = async (target, signal) => {
      if (target.pid !== 710001 || signal !== "SIGTERM") return;
      control.requestStop("owner_stop_requested");
      try { await control.beforeClose(); } catch (error) { closeError = error.message; }
      try { await control.killBrowser(); } catch (error) { killError = error.message; }
    };
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result.status).toBe("UNKNOWN");
    expect(closeError).toBe("additional_process_replaced");
    expect(killError).toBe("attended_browser_identity_unknown");
    await control.finish();
    expect(f.server.close).not.toHaveBeenCalled();
    expect(fake.signals).toEqual([{ pid: 710001, signal: "SIGTERM" }]);
  });

  it("does not cooperatively close a browser whose root cannot be observed", async () => {
    const f = fixture();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    fake.rows.delete(f.child.pid);
    await expect(control.beforeClose()).rejects.toThrow("attended_browser_identity_unknown");
    await control.finish();
    expect(f.server.close).not.toHaveBeenCalled();
    expect(fake.signals).toEqual([]);
  });

  it("does not interpret a missing controller or an observation error as stop authority", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    fake.rows.delete(710001); fake.host.pid = 710003;
    await expect(stopMetaAttendedCase(control.ownerCommand())).rejects.toThrow("attended_controller_replaced");
    expect(fake.signals).toEqual([]);
    await control.finish();
  });

  it("binds the pre-launch manifest stop route to the same canonical control and process checks", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedManifest } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    fake.host.pid = 710003;
    await expect(stopMetaAttendedManifest({
      manifest_path: f.manifest.path, manifest_sha256: "f".repeat(64),
    })).rejects.toThrow("attended_case_changed");
    expect(fake.signals).toEqual([]);
    const stopped = await stopMetaAttendedManifest({
      manifest_path: f.manifest.path, manifest_sha256: f.manifest.sha256,
    });
    expect(stopped.controller_stopped).toBe(true);
    expect(stopped.browser_stopped).toBe(true);
    await control.finish();
  });

  it("does not call a root-only exit complete while a late group member survives", async () => {
    const f = fixture();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    const member = { ...fake.rows.get(f.child.pid), pid: 710004, ppid: f.child.pid,
      command: `${chrome} Helper --type=unit-only` };
    member.command_sha256 = hash(member.command); fake.rows.set(member.pid, member);
    await f.server.close();
    const result = await control.finish();
    expect(result.browser_closed).toBe(false);
    expect(result.errors).toContain("attended_process_observation_failed");
  });

  it("uses only freshly verified exact PIDs when the controller ignores cooperative stop", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    fake.ignoreTerm.add(710001); fake.host.pid = 710003;
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result.controller_stopped).toBe(true);
    expect(result.browser_stopped).toBe(true);
    expect(fake.signals).toEqual([
      { pid: 710001, signal: "SIGTERM" }, { pid: 710001, signal: "SIGSTOP" },
      { pid: 710001, signal: "SIGKILL" }, { pid: 710002, signal: "SIGTERM" },
    ]);
    expect(existsSync(f.profile)).toBe(true);
    await control.finish();
  });

  it("persists UNKNOWN and never signals a reused controller after the first stop signal", async () => {
    const f = fixture();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    fake.ignoreTerm.add(710001); fake.host.pid = 710003;
    fake.onSignal = async (target, signal) => {
      if (target.pid === 710001 && signal === "SIGTERM") {
        fake.rows.set(710001, { ...fake.rows.get(710001), started: "replacement lifetime" });
      }
    };
    const result = await stopMetaAttendedCase(control.ownerCommand());
    expect(result.status).toBe("UNKNOWN");
    expect(result.errors).toContain("attended_controller_replaced");
    expect(fake.signals.filter(row => row.pid === 710001)).toEqual([{ pid: 710001, signal: "SIGTERM" }]);
    expect(JSON.parse(readFileSync(join(f.output, "attended-owner-stop.json"))).status).toBe("UNKNOWN");
    await control.finish();
  });
});

const save = (root, name, value) => {
  const path = join(root, name);
  const bytes = Buffer.from(JSON.stringify(value));
  writeFileSync(path, bytes, { mode: 0o600 });
  return { path, sha256: hash(bytes) };
};
async function unitQualification() {
  const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
  const root = mkdtempSync(join(realpathSync(tmpdir()), "meta-attended-proof-unit-")); roots.push(root);
  const cases = [];
  for (const [n, mode] of ["--local-h1", "--local-h2"].entries()) {
    const f = fixture(mode), control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
    await f.server.close();
    const result = await control.finish(), owner = control.ownerCommand();
    const browserPath = join(f.output, "attended-browser-owned.json");
    cases.push({
      control: { path: owner.control_path, sha256: owner.control_sha256 },
      browser: { path: browserPath, sha256: hash(readFileSync(browserPath)) }, final: result.final,
      actual_exit: save(root, `normal-${n}-exit.json`, {
        schema: "airlock.meta-attended-command-exit.v1",
        case_record_sha256: owner.control_sha256, result_sha256: result.final.sha256, exited_at_ms: Date.now(),
        command_exit_observed: true, code: 0, signal: null, command: [...fake.host.argv], elapsed_external_ms: 10,
      }),
    });
  }
  const f = fixture("--local-owner-stop"), control = await createMetaAttendedControl(f.options);
  await control.beforeBrowser(); await control.trackBrowser(Promise.resolve(f.server));
  const owner = control.ownerCommand();
  fake.onSignal = async expected => { if (expected.pid === f.child.pid) await f.server.close(); };
  fake.host.pid = 710003;
  const stopped = await stopMetaAttendedCase(owner);
  expect(stopped.profile_absent).toBe(true);
  const controllerFinal = await control.finish();
  const stopPath = join(f.output, "attended-owner-stop.json");
  const index = {
    schema: "airlock.meta-attended-qualification.v1", source_pins: { candidate: "unit-only" }, cases,
    owner_stop: { path: stopPath, sha256: hash(readFileSync(stopPath)) },
    owner_stop_exit: save(root, "owner-stop-exit.json", {
      schema: "airlock.meta-attended-command-exit.v1", case_record_sha256: owner.control_sha256,
      result_sha256: hash(readFileSync(stopPath)), exited_at_ms: Date.now(),
      command_exit_observed: true, code: 0, signal: null, elapsed_external_ms: 10,
      command: [process.execPath, fileURLToPath(new URL("./meta-attended-stop.mjs", import.meta.url)),
        "--stop", owner.control_path, owner.control_sha256],
    }),
    owner_stop_controller_final: controllerFinal.final,
    owner_stop_controller_exit: save(root, "controller-stop-exit.json", {
      schema: "airlock.meta-attended-command-exit.v1", command_exit_observed: true,
      case_record_sha256: owner.control_sha256, result_sha256: controllerFinal.final.sha256,
      code: 2, signal: null, command: [...fake.host.argv], exited_at_ms: Date.now(), elapsed_external_ms: 10,
    }),
    official_sdk_executed: false, actual_owner_slots_reserved: 0,
  };
  return { root, index, handle: () => save(root, "index.json", index) };
}

describe("unit-shaped ownership proof reader — NOT actual qualification", () => {
  it("checks related original records without granting native qualification", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    expect(inspectMetaAttendedQualification({ qualification: f.handle(), source_pins: { candidate: "unit-only" } }))
      .toEqual({ source_evidence_verified: true, native_qualification: false });
  });

  it("rejects an intermediate replaced browser even if a known helper anchors the group", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const stop = JSON.parse(readFileSync(f.index.owner_stop.path));
    const browser = JSON.parse(readFileSync(stop.browser.path));
    const root = browser.observation;
    const helperCommand = chrome + " Helper --type=unit";
    const helper = { ...root, pid: root.pid + 1, ppid: root.pid,
      command: helperCommand, command_sha256: hash(helperCommand) };
    const helperIdentity = Object.fromEntries(Object.entries(helper).filter(([key]) => key !== "command"));
    browser.group_observations.push(helper);
    browser.members.push({ ...helperIdentity, final: "live" });
    stop.browser = save(f.root, "browser-with-helper.json", browser);
    const replaced = { ...root, command: root.command + " --changed",
      command_sha256: hash(root.command + " --changed") };
    stop.group_observations.unshift({ at_ms: browser.at_ms, rows: [replaced, helper] });
    stop.browser_processes.push({ ...helperIdentity, final: "absent" });
    f.index.owner_stop = save(f.root, "stop-with-intermediate-replacement.json", stop);
    const stopExit = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
    stopExit.result_sha256 = f.index.owner_stop.sha256;
    f.index.owner_stop_exit = save(f.root, "rebound-stop-exit.json", stopExit);
    const final = JSON.parse(readFileSync(f.index.owner_stop_controller_final.path));
    final.browser = stop.browser;
    final.processes.push({ ...helperIdentity, final: "absent" });
    f.index.owner_stop_controller_final = save(f.root, "rebound-controller-final.json", final);
    const finalExit = JSON.parse(readFileSync(f.index.owner_stop_controller_exit.path));
    finalExit.result_sha256 = f.index.owner_stop_controller_final.sha256;
    f.index.owner_stop_controller_exit = save(f.root, "rebound-controller-exit.json", finalExit);
    expect(() => inspectMetaAttendedQualification({ qualification: f.handle(),
      source_pins: { candidate: "unit-only" } })).toThrow("additional_process_replaced");
  });

  it.each(["pending_settled", "browser_closed", "profile_absent", "stop_requested", "errors"])(
    "rejects a refreshed-hash contradictory normal %s", async key => {
      const f = await unitQualification();
      const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
      const final = JSON.parse(readFileSync(f.index.cases[0].final.path));
      final[key] = key === "errors" ? ["hidden-failure"] : key === "stop_requested";
      f.index.cases[0].final = save(f.root, "mutated-final.json", final);
      const exit = JSON.parse(readFileSync(f.index.cases[0].actual_exit.path));
      exit.result_sha256 = f.index.cases[0].final.sha256;
      f.index.cases[0].actual_exit = save(f.root, "rebound-exit.json", exit);
      expect(() => inspectMetaAttendedQualification({
        qualification: f.handle(), source_pins: { candidate: "unit-only" },
      })).toThrow("attended_qualification_invalid");
    });

  it.each(["controller_before", "controller_after", "signals", "profile_absent"])(
    "rejects refreshed-hash stop contradiction %s", async key => {
      const f = await unitQualification();
      const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
      const stopped = JSON.parse(readFileSync(f.index.owner_stop.path));
      if (key === "controller_before") stopped.controller_before.started = "changed";
      else if (key === "controller_after") stopped.controller_after = [stopped.controller_before];
      else if (key === "signals") stopped.signals[0].pid = 99999;
      else stopped.profile_absent = false;
      f.index.owner_stop = save(f.root, "mutated-stop.json", stopped);
      const exit = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
      exit.result_sha256 = f.index.owner_stop.sha256;
      f.index.owner_stop_exit = save(f.root, "rebound-stop-exit.json", exit);
      expect(() => inspectMetaAttendedQualification({
        qualification: f.handle(), source_pins: { candidate: "unit-only" },
      })).toThrow("attended_stop_qualification_missing");
    });

  it("rejects an absent command-exit witness, even if producer flags say stopped", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const exited = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
    exited.command_exit_observed = false;
    f.index.owner_stop_exit = save(f.root, "unobserved-exit.json", exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });
});

describe("attended shutdown-race regressions — controlled events only", () => {
  it("keeps signal handlers active while finish awaits a late browser", async () => {
    const f = fixture(), late = deferred();
    const { createMetaAttendedControl } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser();
    const tracked = control.trackBrowser(late.promise);
    const finishing = control.finish();
    try {
      fake.host.emit("SIGTERM");
      expect(f.onStop).toHaveBeenCalledWith("owner_stop_requested");
      expect(fake.host.listenerCount("SIGTERM")).toBe(1);
    } finally {
      late.resolve(f.server);
      await tracked;
      await finishing;
    }
    expect(fake.host.listenerCount("SIGTERM")).toBe(0);
  });

  it("refreshes ownership registered during stop grace before terminating the controller", async () => {
    const f = fixture(), late = deferred(), releaseClose = deferred();
    const { createMetaAttendedControl, stopMetaAttendedCase } = await import("./meta-attended-control.mjs");
    const control = await createMetaAttendedControl(f.options);
    await control.beforeBrowser();
    const originalClose = f.server.close;
    f.server.close = vi.fn(() => releaseClose.promise.then(() => originalClose()));
    const tracked = control.trackBrowser(late.promise);
    fake.ignoreTerm.add(710001); fake.host.pid = 710003;
    fake.onSignal = async (target, signal) => {
      if (target.pid === 710001 && signal === "SIGTERM") {
        fake.host.emit("SIGTERM");
        late.resolve(f.server);
        await vi.waitFor(() => expect(existsSync(join(f.output, "attended-browser-owned.json"))).toBe(true));
      }
    };
    try {
      const result = await stopMetaAttendedCase(control.ownerCommand());
      expect(fake.signals).toContainEqual({ pid: f.child.pid, signal: "SIGTERM" });
      expect(result.browser_stopped).toBe(true);
    } finally {
      releaseClose.resolve();
      await tracked;
      await control.finish();
    }
  });
});

const overwrite = (original, value) => {
  const bytes = Buffer.from(JSON.stringify(value));
  writeFileSync(original.path, bytes, { mode: 0o600 });
  return { path: original.path, sha256: hash(bytes) };
};
describe("qualification chronology and cohort reconstruction regressions — UNIT data", () => {
  it("rejects a rebound manifest-window contradiction even below the sixty-second ceiling", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const row = f.index.cases[0], control = JSON.parse(readFileSync(row.control.path));
    const originalExpiry = control.window.expires_at_ms;
    control.window.expires_at_ms += 500;
    row.control = overwrite(row.control, control);
    const browser = JSON.parse(readFileSync(row.browser.path)); browser.control = row.control;
    row.browser = overwrite(row.browser, browser);
    const final = JSON.parse(readFileSync(row.final.path));
    final.control = row.control; final.browser = row.browser; final.completed_at_ms = originalExpiry + 100;
    row.final = overwrite(row.final, final);
    const exit = JSON.parse(readFileSync(row.actual_exit.path));
    exit.case_record_sha256 = row.control.sha256; exit.result_sha256 = row.final.sha256;
    exit.exited_at_ms = final.completed_at_ms + 1;
    row.actual_exit = overwrite(row.actual_exit, exit);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_case_window");
  });

  it("reconstructs the stopped browser cohort instead of trusting unrelated absent-process flags", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const stop = JSON.parse(readFileSync(f.index.owner_stop.path));
    const controller = { ...stop.controller_before }; delete controller.command; delete controller.state;
    stop.browser_processes = [{ ...controller, final: "absent" }];
    stop.signals = stop.signals.filter(signal => signal.pid === controller.pid);
    f.index.owner_stop = overwrite(f.index.owner_stop, stop);
    const exited = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
    exited.result_sha256 = f.index.owner_stop.sha256;
    f.index.owner_stop_exit = overwrite(f.index.owner_stop_exit, exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });

  it("rejects an impossible signal outcome despite matching process identities", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const stop = JSON.parse(readFileSync(f.index.owner_stop.path));
    stop.signals[0].outcome = "pretended";
    f.index.owner_stop = overwrite(f.index.owner_stop, stop);
    const exited = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
    exited.result_sha256 = f.index.owner_stop.sha256;
    f.index.owner_stop_exit = overwrite(f.index.owner_stop_exit, exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });

  it("rejects a future command-exit witness that was not yet observable", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const exited = JSON.parse(readFileSync(f.index.cases[0].actual_exit.path));
    exited.exited_at_ms = Date.now() + 500;
    f.index.cases[0].actual_exit = overwrite(f.index.cases[0].actual_exit, exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_qualification_invalid");
  });

  it("binds the external stop exit to the exact fixed case command", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const exited = JSON.parse(readFileSync(f.index.owner_stop_exit.path));
    exited.command[3] = "/tmp/unrelated-case";
    f.index.owner_stop_exit = overwrite(f.index.owner_stop_exit, exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });

  it("requires the stopped controller's actual exit as well as the owner-command exit", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    delete f.index.owner_stop_controller_exit;
    delete f.index.owner_stop_controller_final;
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });

  it("rejects a rebound controller completion and exit dated before its acquisition", async () => {
    const f = await unitQualification();
    const { inspectMetaAttendedQualification } = await import("./meta-attended-control.mjs");
    const stop = JSON.parse(readFileSync(f.index.owner_stop.path));
    const start = JSON.parse(readFileSync(stop.control.path));
    const final = JSON.parse(readFileSync(f.index.owner_stop_controller_final.path));
    final.completed_at_ms = start.started_at_ms - 2;
    f.index.owner_stop_controller_final = overwrite(f.index.owner_stop_controller_final, final);
    const exited = JSON.parse(readFileSync(f.index.owner_stop_controller_exit.path));
    exited.result_sha256 = f.index.owner_stop_controller_final.sha256;
    exited.exited_at_ms = start.started_at_ms - 1;
    f.index.owner_stop_controller_exit = overwrite(f.index.owner_stop_controller_exit, exited);
    expect(() => inspectMetaAttendedQualification({
      qualification: f.handle(), source_pins: { candidate: "unit-only" },
    })).toThrow("attended_stop_qualification_missing");
  });
});
