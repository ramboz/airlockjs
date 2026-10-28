import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ pid: 710000, rows: new Map(), signals: [], inventoryError: null, inventoryStderr: "" }));
vi.mock("node:process", () => ({ default: {
  get pid() { return fake.pid; }, getuid: () => process.getuid(),
} }));
vi.mock("node:child_process", async importOriginal => ({ ...await importOriginal(),
  execFileSync: vi.fn(() => Buffer.from("p710000\nn127.0.0.1:12345\n")),
  spawnSync: vi.fn(() => fake.inventoryError
    ? { error: fake.inventoryError, status: fake.inventoryError.status ?? null,
      signal: fake.inventoryError.signal ?? null, stdout: fake.inventoryError.stdout, stderr: fake.inventoryError.stderr }
    : { status: 0, signal: null, stdout: Buffer.from("p710000\nn127.0.0.1:12345\n"), stderr: Buffer.from(fake.inventoryStderr) }),
}));
vi.mock("./meta-additional-supervision.mjs", async () => {
  const actual = await vi.importActual("./meta-additional-supervision.mjs");
  return { ...actual,
    readAdditionalProcesses: vi.fn(async (ids, _deadline, groups = false) => [...fake.rows.values()]
      .filter(row => groups ? ids.includes(row.pgid) : ids.includes(row.pid))),
    signalAdditionalOwnedProcess: vi.fn(async (expected, signal, _deadline, log) => {
      const current = fake.rows.get(expected.pid);
      if (current && !actual.sameAdditionalProcess(expected, current)) throw Error("additional_process_replaced");
      fake.signals.push({ pid: expected.pid, signal });
      log.push({ pid: expected.pid, signal, outcome: current ? "sent" : "vanished" });
      if (current && signal === "SIGCONT") fake.rows.delete(expected.pid);
    }),
  };
});

const load = () => import("./local-guard-observation.mjs");
const roots = [], hash = value => createHash("sha256").update(value).digest("hex");
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  fake.rows.clear(); fake.signals.length = 0; fake.inventoryError = null; fake.inventoryStderr = "";
  fake.pid = 710000; vi.clearAllMocks();
});
function root() {
  const path = mkdtempSync(join(realpathSync(tmpdir()), "local-guard-offline-"));
  roots.push(path); return path;
}
function row(pid, ppid, command) {
  return { pid, ppid, pgid: pid, uid: process.getuid(), started: "Tue Oct 27 18:30:00 2026",
    state: "S", command, command_sha256: hash(command) };
}
function fixture() {
  const directory = root();
  const launchProfile = mkdtempSync(join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-"));
  roots.push(launchProfile);
  const controller = row(710000, 709999, "/controlled/node producer");
  const browser = row(710001, controller.pid,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=" + launchProfile);
  const observer = row(720000, 719999, "/controlled/node observer");
  fake.rows.set(controller.pid, controller); fake.rows.set(browser.pid, browser); fake.rows.set(observer.pid, observer);
  return { directory, launchProfile, controller, browser, observer,
    source_sha256: "a".repeat(64), window: { not_before_ms: Date.now() - 100, expires_at_ms: Date.now() + 59000 } };
}

describe("local guard observation repair - controlled OS only", () => {
  it("retains complete captured lsof failure details and rethrows rather than treating partial output as absence", async () => {
    const { readLocalGuardListeners } = await load(), directory = root();
    const original = Object.assign(Error("controlled lsof failure"), {
      status: 1, signal: null, code: "CONTROLLED", stdout: Buffer.from("partial stdout\n"),
      stderr: Buffer.from("controlled diagnostic\n"),
    });
    fake.inventoryError = original;
    let caught;
    try { readLocalGuardListeners({ pids: [710000], directory }); } catch (error) { caught = error; }
    expect(caught).toBe(original);
    const receipt = JSON.parse(readFileSync(caught.guard_observation.path));
    expect(receipt).toMatchObject({ status: 1, signal: null, code: "CONTROLLED",
      stdout_base64: original.stdout.toString("base64"), stderr_base64: original.stderr.toString("base64"),
      qualification: false, outcome: "failed" });
  });

  it("records the no-listener exit explicitly, preserving the narrow empty-exit convention", async () => {
    const { readLocalGuardListeners } = await load(), directory = root();
    fake.inventoryError = Object.assign(Error("empty"), { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
    const result = readLocalGuardListeners({ pids: [710000], directory });
    expect(result.stdout).toBe("");
    expect(JSON.parse(readFileSync(result.receipt.path)).outcome).toBe("no_listeners");
  });

  it("terminates verified nodes without ever invoking the broken listener inventory", async () => {
    const { stopLocalGuardKnownNodes } = await load();
    const node = row(710003, 710000, "/controlled/node child"); fake.rows.set(node.pid, node);
    fake.inventoryError = Error("must not be needed for cleanup");
    const result = await stopLocalGuardKnownNodes({ nodes: [node], deadline: performance.now() + 5000 });
    expect(result).toMatchObject({ status: "closed", errors: [], processes: [] });
    expect(fake.signals).toEqual(expect.arrayContaining([{ pid: node.pid, signal: "SIGTERM" },
      { pid: node.pid, signal: "SIGCONT" }]));
    expect((await import("node:child_process")).spawnSync).not.toHaveBeenCalled();
  });

  it("does not signal a replaced lifetime and still cleans another verified node", async () => {
    const { stopLocalGuardKnownNodes } = await load();
    const old = row(710003, 710000, "/controlled/old"), good = row(710004, 710000, "/controlled/good");
    fake.rows.set(old.pid, { ...old, started: "changed" }); fake.rows.set(good.pid, good);
    const result = await stopLocalGuardKnownNodes({ nodes: [old, good], deadline: performance.now() + 5000 });
    expect(result.status).toBe("unknown");
    expect(result.errors).toContain("additional_process_replaced");
    expect(fake.signals.some(signal => signal.pid === old.pid)).toBe(false);
    expect(fake.rows.has(good.pid)).toBe(false);
  });

  it("writes pending before launch and blocks work until independent registration is durable", async () => {
    const { beginLocalGuardRegistration, acknowledgeLocalGuardRegistration } = await load();
    const f = fixture();
    const gate = await beginLocalGuardRegistration({
      directory: f.directory, source_sha256: f.source_sha256, window: f.window,
    });
    expect(existsSync(join(f.directory, "guard-browser-pending.json"))).toBe(true);
    let workStarted = false;
    const ready = gate.ready({ process: () => ({ pid: f.browser.pid }) }).then(() => { workStarted = true; });
    await vi.waitFor(() => expect(existsSync(join(f.directory, "guard-browser-ready.json"))).toBe(true));
    expect(workStarted).toBe(false);
    fake.pid = f.observer.pid;
    const registered = await acknowledgeLocalGuardRegistration({ directory: f.directory,
      source_sha256: f.source_sha256, controller: f.controller, deadline: performance.now() + 5000, release: true });
    const observed = readFileSync(join(f.directory, "guard-browser-observed.json"));
    await acknowledgeLocalGuardRegistration({ directory: f.directory, source_sha256: f.source_sha256,
      controller: f.controller, deadline: performance.now() + 5000, release: true });
    expect(readFileSync(join(f.directory, "guard-browser-observed.json"))).toEqual(observed);
    fake.pid = f.controller.pid;
    await ready;
    expect(workStarted).toBe(true);
    expect(registered.status).toBe("registered");
    expect(JSON.parse(readFileSync(join(f.directory, "guard-browser-observed.json")))).toMatchObject({
      independent: true, qualification: false, browser: { pid: f.browser.pid },
    });
  });

  it("cannot release a foreign browser and does not create an acknowledgement", async () => {
    const { beginLocalGuardRegistration, acknowledgeLocalGuardRegistration } = await load(), f = fixture();
    const gate = await beginLocalGuardRegistration({
      directory: f.directory, source_sha256: f.source_sha256, window: f.window,
    });
    const wait = gate.ready({ process: () => ({ pid: f.browser.pid }) });
    const rejected = expect(wait).rejects.toThrow("local_guard_registration_deadline");
    await vi.waitFor(() => expect(existsSync(join(f.directory, "guard-browser-ready.json"))).toBe(true));
    fake.rows.set(f.browser.pid, { ...f.browser, ppid: 123 });
    fake.pid = f.observer.pid;
    await expect(acknowledgeLocalGuardRegistration({ directory: f.directory,
      source_sha256: f.source_sha256, controller: f.controller,
      deadline: performance.now() + 5000, release: true })).rejects.toThrow("local_guard_browser_identity");
    expect(existsSync(join(f.directory, "guard-browser-ack.json"))).toBe(false);
    fake.pid = f.controller.pid;
    await rejected;
  }, 6000);

  it("retains timeout signal and binary captured output without labelling it complete", async () => {
    const { readLocalGuardListeners } = await load(), directory = root();
    const original = Object.assign(Error("controlled timeout"), { status: null, signal: "SIGTERM",
      code: "ETIMEDOUT", stdout: Buffer.from([0, 255, 1]), stderr: Buffer.from("timeout") });
    fake.inventoryError = original;
    let caught;
    try { readLocalGuardListeners({ pids: [710000], directory }); } catch (error) { caught = error; }
    const receipt = JSON.parse(readFileSync(caught.guard_observation.path));
    expect(caught).toBe(original);
    expect(receipt).toMatchObject({ status: null, signal: "SIGTERM", code: "ETIMEDOUT", output_complete: false,
      stdout_base64: "AP8B", stderr_base64: original.stderr.toString("base64"), qualification: false });
  });

  it("retains stderr even when the listener command exits zero", async () => {
    const { readLocalGuardListeners } = await load(), directory = root();
    fake.inventoryStderr = "controlled successful diagnostic\n";
    const result = readLocalGuardListeners({ pids: [710000], directory });
    const receipt = JSON.parse(readFileSync(result.receipt.path));
    expect(receipt).toMatchObject({ status: 0, outcome: "observed", output_complete: true,
      stderr_base64: Buffer.from(fake.inventoryStderr).toString("base64") });
  });

  it("does not label a timed-out child complete even if it exits cleanly after termination", async () => {
    const { readLocalGuardListeners } = await load(), directory = root();
    fake.inventoryError = Object.assign(Error("controlled timeout with clean termination"), {
      status: 0, signal: null, code: "ETIMEDOUT", stdout: Buffer.from("partial"), stderr: Buffer.alloc(0),
    });
    let caught;
    try { readLocalGuardListeners({ pids: [710000], directory }); } catch (error) { caught = error; }
    expect(JSON.parse(readFileSync(caught.guard_observation.path))).toMatchObject({
      status: 0, signal: null, code: "ETIMEDOUT", output_complete: false, outcome: "failed",
    });
  });

  it("observes an expired owned case for cleanup but never publishes a work-release acknowledgement", async () => {
    const { beginLocalGuardRegistration, acknowledgeLocalGuardRegistration } = await load(), f = fixture();
    f.window.expires_at_ms = Date.now() + 150;
    const gate = await beginLocalGuardRegistration({
      directory: f.directory, source_sha256: f.source_sha256, window: f.window,
    });
    const work = gate.ready({ process: () => ({ pid: f.browser.pid }) });
    const rejected = expect(work).rejects.toThrow("local_guard_registration_deadline");
    await vi.waitFor(() => expect(existsSync(join(f.directory, "guard-browser-ready.json"))).toBe(true));
    fake.pid = f.observer.pid;
    const now = vi.spyOn(Date, "now").mockReturnValue(f.window.expires_at_ms + 1);
    try {
      await expect(acknowledgeLocalGuardRegistration({ directory: f.directory, source_sha256: f.source_sha256,
        controller: f.controller, deadline: performance.now() + 5000, release: true })).rejects.toThrow("local_guard_window");
      const observed = await acknowledgeLocalGuardRegistration({ directory: f.directory, source_sha256: f.source_sha256,
        controller: f.controller, deadline: performance.now() + 5000, release: false });
      expect(observed.status).toBe("observed");
      expect(existsSync(join(f.directory, "guard-browser-ack.json"))).toBe(false);
    } finally { now.mockRestore(); fake.pid = f.controller.pid; }
    await rejected;
  });

  it("preserves rejected group rows at the new registration boundary without releasing work", async () => {
    const { beginLocalGuardRegistration, acknowledgeLocalGuardRegistration } = await load(), f = fixture();
    f.window.expires_at_ms = Date.now() + 1000;
    const gate = await beginLocalGuardRegistration({
      directory: f.directory, source_sha256: f.source_sha256, window: f.window,
    });
    const work = gate.ready({ process: () => ({ pid: f.browser.pid }) });
    const rejected = expect(work).rejects.toThrow("local_guard_registration_deadline");
    await vi.waitFor(() => expect(existsSync(join(f.directory, "guard-browser-ready.json"))).toBe(true));
    const foreign = { ...row(710002, f.browser.pid, "/controlled/not-an-allowed-group-member"),
      pgid: f.browser.pgid };
    fake.rows.set(foreign.pid, foreign); fake.pid = f.observer.pid;
    let caught;
    try {
      await acknowledgeLocalGuardRegistration({ directory: f.directory, source_sha256: f.source_sha256,
        controller: f.controller, deadline: performance.now() + 5000, release: true });
    } catch (error) { caught = error; }
    expect(caught.message).toBe("additional_group_identity");
    expect(JSON.parse(readFileSync(caught.guard_observation.path))).toMatchObject({
      group_observations: [f.browser, foreign], exact: true, signal_authority: false, qualification: false,
    });
    expect(existsSync(join(f.directory, "guard-browser-ack.json"))).toBe(false);
    fake.pid = f.controller.pid;
    await rejected;
  });

  it("wires pending before allocation and acknowledgement before controller/relay work", () => {
    const controller = readFileSync(new URL("./inspected-meta-stock.mjs", import.meta.url), "utf8");
    const relay = readFileSync(new URL("./reference-inspection.mjs", import.meta.url), "utf8");
    for (const [source, allocated] of [[controller, "const browserAcquisition = chromium.launchServer"],
      [relay, "browserServer = await chromium.launchServer"]]) {
      const create = source.lastIndexOf("beginLocalGuardRegistration({");
      const launch = source.indexOf(allocated);
      const released = source.indexOf("localGuard.ready(browserServer)");
      const connected = source.indexOf("chromium.connect(browserServer.wsEndpoint())");
      expect(create).toBeGreaterThan(0);
      expect(create).toBeLessThan(launch);
      expect(released).toBeGreaterThan(launch);
      expect(released).toBeLessThan(connected);
      expect(source).toContain('AIRLOCK_LOCAL_GUARD_REGISTRATION === "1"');
    }
    expect(controller).toContain("local && !state.additional && !state.attended");
  });
});
