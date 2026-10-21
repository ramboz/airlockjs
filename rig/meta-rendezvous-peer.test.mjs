import { readFileSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

const load = () => import("./meta-rendezvous-peer.mjs");
function observation() {
  const make = pid => ({ pid, ppid: 123, pgid: pid, uid: process.getuid(),
    started: "Wed Oct 21 15:00:00 2026", state: "S", command_sha256: "a".repeat(64) });
  const launcher = make(610001), sibling = make(610002);
  return { expected: launcher, claimed_pid: launcher.pid,
    issued_correlation_sha256: "b".repeat(64), received_correlation_sha256: "b".repeat(64),
    tuple: { server_address: "127.0.0.1", server_port: 41001, client_address: "127.0.0.1", client_port: 41002 },
    before: [launcher, sibling], after: [{ ...launcher }, { ...sibling }],
    connections: [{ pid: launcher.pid, name: "127.0.0.1:41002->127.0.0.1:41001" }] };
}

describe("SDK-absent owned rendezvous peer primitive", () => {
  it.each(["observation-error", "signal-error", "changed-identity"])(
    "always disposes parent handles for a non-exiting child after real cleanup %s", async fault => {
      // Real run/stopPeer/caller error path; only process, OS and listener
      // boundaries are doubled. No actual fork, socket, observation or signal.
      const root = mkdtempSync(join(realpathSync(tmpdir()), "owned-peer-disposal-unit-"));
      const outputDir = join(root, "run"), child = new EventEmitter();
      let command, cleanup = false, spawned = 0, retainedHandle = true, serverClosed = false;
      Object.assign(child, { pid: 720001, connected: true, stdout: new PassThrough(), stderr: new PassThrough(),
        disconnect: vi.fn(() => { child.connected = false; }),
        unref: vi.fn(() => { retainedHandle = false; }) });
      child.send = message => {
        if (message.type === "owner-ack")
          queueMicrotask(() => child.emit("message", { type: "owner-acknowledged", role: "launcher" }));
        if (message.type === "stop") cleanup = true; // Deliberately never emits exit/close.
      };
      const spawn = vi.fn((executable, args) => {
        if (++spawned !== 1) throw Error("pure_unit_enter_cleanup");
        command = [executable, ...args].join(" ");
        queueMicrotask(() => child.emit("message", { type: "owner-ready", role: "launcher" }));
        return child;
      });
      const row = (pid, ppid, pgid, image) =>
        `${pid} ${ppid} ${pgid} ${process.getuid()} Wed Oct 21 16:35:00 2026 S ${image}\n`;
      const execFile = vi.fn();
      execFile[promisify.custom] = async (program, args) => {
        if (program === "/usr/sbin/lsof") return {
          stdout: serverClosed ? "" : `p${process.pid}\nn127.0.0.1:42001\n`, stderr: "" };
        if (program !== "/bin/ps") throw Error("unexpected_pure_unit_command");
        if (args[0] === "-g") return { stdout: `${child.pid} ${process.getuid()} S\n`, stderr: "" };
        if (args[1] === String(process.pid)) return {
          stdout: row(process.pid, 1, process.pid, "pure-unit-parent"), stderr: "" };
        if (cleanup && fault === "observation-error") throw Object.assign(Error("unit-ps-error"), { code: "EIO" });
        return { stdout: row(child.pid, process.pid, child.pid,
          cleanup && fault === "changed-identity" ? "unit-replaced-image" : command), stderr: "" };
      };
      const server = new EventEmitter();
      server.listen = (_port, host, callback) => { expect(host).toBe("127.0.0.1"); callback(); };
      server.address = () => ({ port: 42001 });
      server.close = callback => { serverClosed = true; callback(); };
      vi.resetModules();
      vi.doMock("node:child_process", () => ({ spawn, execFile }));
      vi.doMock("node:net", () => ({ createServer: () => server,
        connect: () => { throw Error("pure_unit_must_not_connect"); } }));
      vi.doMock("./inspected-meta-stock.mjs", () => ({ inspectedMetaSourcePins: () => ({ pure_unit_only: true }) }));
      const signal = vi.spyOn(process, "kill").mockImplementation(() => {
        throw Object.assign(Error("unit-signal-error"), { code: "EPERM" });
      });
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
      try {
        const { runOwnedRendezvousPeerFeasibility } = await load();
        const finished = runOwnedRendezvousPeerFeasibility({ outputDir }).then(
          () => ({ unexpectedSuccess: true }), error => ({ error: error.message }));
        await vi.runAllTimersAsync();
        expect(await finished).toEqual({ error: "rendezvous_feasibility_unqualified" });
        const report = JSON.parse(readFileSync(join(outputDir, "report.json")));
        expect(report.witnessed).toBe(false);
        expect(report.native_qualified).toBe(false);
        expect(report.resource_disposition).toBe("unknown");
        expect(report.children).toHaveLength(1);
        expect(report.children[0]).toMatchObject({ pid: child.pid, final: "unknown", exit: null });
        if (fault === "observation-error") expect(report.errors).toContain("rendezvous_os_observation_failed");
        if (fault === "signal-error") {
          expect(report.errors).toContain("rendezvous_signal_failed");
          expect(signal).toHaveBeenCalledExactlyOnceWith(child.pid, "SIGTERM");
        } else expect(signal).not.toHaveBeenCalled();
        expect(child.stdout.destroyed).toBe(true);
        expect(child.stderr.destroyed).toBe(true);
        expect(child.connected).toBe(false);
        expect(child.disconnect).toHaveBeenCalledTimes(1);
        expect(child.unref).toHaveBeenCalledTimes(1);
        expect(retainedHandle).toBe(false);
      } finally {
        child.stdout.destroy(); child.stderr.destroy();
        vi.useRealTimers(); vi.restoreAllMocks();
        vi.doUnmock("node:child_process"); vi.doUnmock("node:net"); vi.doUnmock("./inspected-meta-stock.mjs");
        vi.resetModules(); rmSync(root, { recursive: true, force: true });
      }
    }, 10000);
  it("accepts only a kernel tuple owned by the exact stable issued launcher", async () => {
    const { assessOwnedRendezvousPeer } = await load();
    expect(assessOwnedRendezvousPeer(observation())).toMatchObject({
      accepted: true, reason: "owned_peer", kernel_owner_pid: 610001, native_authority: false });
  });
  it("rejects an owned sibling even when it forges the launcher PID and has the right correlation", async () => {
    const { assessOwnedRendezvousPeer } = await load(), value = observation();
    value.connections[0].pid = value.before[1].pid;
    expect(assessOwnedRendezvousPeer(value)).toMatchObject({
      accepted: false, reason: "peer_owner_mismatch", kernel_owner_pid: 610002 });
  });
  it.each(["pid", "ppid", "pgid", "uid", "started", "command_sha256", "state"])(
    "rejects changed %s across the actual OS socket observation", async key => {
      const { assessOwnedRendezvousPeer } = await load(), value = observation();
      value.after[0][key] = key === "state" ? "Z" : "changed";
      expect(assessOwnedRendezvousPeer(value).accepted).toBe(false);
    });
  it.each(["no-kernel-owner", "ambiguous-owner", "wrong-tuple", "wrong-claim", "wrong-correlation"])(
    "refuses %s instead of accepting claimed metadata", async fault => {
      const { assessOwnedRendezvousPeer } = await load(), value = observation();
      if (fault === "no-kernel-owner") value.connections = [];
      if (fault === "ambiguous-owner") value.connections.push({ ...value.connections[0], pid: value.before[1].pid });
      if (fault === "wrong-tuple") value.connections[0].name = "127.0.0.1:1->127.0.0.1:2";
      if (fault === "wrong-claim") value.claimed_pid = 610002;
      if (fault === "wrong-correlation") value.received_correlation_sha256 = "c".repeat(64);
      expect(assessOwnedRendezvousPeer(value).accepted).toBe(false);
    });
  it("refuses open input, accessors and proxies without invoking them or allocating resources", async () => {
    const { assessOwnedRendezvousPeer, runOwnedRendezvousPeerFeasibility } = await load();
    let calls = 0;
    for (const input of [{ outputDir: "/unused", program: "arbitrary" }, { outputDir: "/unused", clock: () => 1 },
      { outputDir: "/unused", url: "forbidden" }, { get outputDir() { calls++; return "/unused"; } },
      new Proxy({}, { ownKeys() { calls++; return []; } })])
      await expect(runOwnedRendezvousPeerFeasibility(input)).rejects.toThrow();
    expect(() => assessOwnedRendezvousPeer({ ...observation(), override: true })).toThrow();
    expect(calls).toBe(0);
  });
});
