import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { CLOCK_OBSERVATION_COMMAND, CLOCK_OBSERVATION_PROGRAM } from "./sdk-absent-clock-observation-program.mjs";

const PROGRAM_SHA256 = "9ee66c906a3d8e0120909697b692a50075e08659d7335b8224432dc0b4e969da";
const COMMAND_SHA256 = "e866168e6423612ea99abb6f267e58bdb0a6fb1a5a88c8e34e5152cb3a9b4c05";
const IMAGE = "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb";
function fixture({ samples = [100n, 101n, 102n], deferWrites = false, writeError = 0 } = {}) {
  const events = [], callbacks = [], reads = new Set();
  const p = {
    platform: "linux", arch: "arm64", version: "v24.10.0", pid: 1,
    getuid: vi.fn(() => 65532), getgid: vi.fn(() => 65532), cwd: vi.fn(() => "/"),
    execPath: "/usr/local/bin/node", argv: ["/usr/local/bin/node"],
    execArgv: ["--input-type=module", "--eval", CLOCK_OBSERVATION_PROGRAM],
    env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      NODE_VERSION: "24.10.0", YARN_VERSION: "1.22.22", HOSTNAME: "airlock-clock-source-clock-01", HOME: "/",
      AIRLOCK_OBSERVATION_CASE: "source-clock-01", AIRLOCK_OBSERVATION_RUN: "a".repeat(64),
      AIRLOCK_OBSERVATION_NONCE: "b".repeat(64), AIRLOCK_OBSERVATION_TICKET: "c".repeat(64),
      AIRLOCK_OBSERVATION_SOURCE: "d".repeat(64), AIRLOCK_OBSERVATION_COHORT: "e".repeat(64),
      AIRLOCK_OBSERVATION_IMAGE: IMAGE, AIRLOCK_OBSERVATION_ENGINE: "SOURCE_ONLY_ENGINE" },
    hrtime: { bigint: vi.fn(() => samples.shift()) },
    stdout: { write: vi.fn((line, cb) => {
      const index = callbacks.length + 1;
      events.push("write:" + index);
      const callback = () => {
        events.push("callback:" + index);
        cb(index === writeError ? Error("SOURCE_WRITE_FAILURE") : undefined);
      };
      callbacks.push(callback);
      if (!deferWrites) queueMicrotask(callback);
      return false; // Backpressure is not failure; the callback is decisive.
    }) },
    exit: vi.fn(code => { events.push("exit:" + code); }),
  };
  const process = new Proxy(p, { get(target, key) {
    reads.add(key);
    if (!Object.hasOwn(target, key)) throw Error("UNEXPECTED_PROCESS_CAPABILITY:" + String(key));
    return target[key];
  } });
  return { p, events, callbacks, reads, process };
}
function interpret(f, globals = {}) {
  // Only these exact, trusted first-party bytes run. VM is not a sandbox or
  // evidence of a guest. There is no OS process/import/input/effect capability.
  return new Script(CLOCK_OBSERVATION_PROGRAM).runInNewContext(
    { process: f.process, console: undefined, ...globals },
    { timeout: 100, codeGeneration: { strings: false, wasm: false } });
}

describe("fixed bare-base no-work program SOURCE interpretation", () => {
  it("pins literal program and command digests, not a refreshable expected builder", () => {
    const hash = value => createHash("sha256").update(value).digest("hex");
    expect(hash(CLOCK_OBSERVATION_PROGRAM)).toBe(PROGRAM_SHA256);
    expect(hash(JSON.stringify(CLOCK_OBSERVATION_COMMAND))).toBe(COMMAND_SHA256);
    expect(CLOCK_OBSERVATION_COMMAND).toEqual(["--input-type=module", "--eval", CLOCK_OBSERVATION_PROGRAM]);
    expect(Object.isFrozen(CLOCK_OBSERVATION_COMMAND)).toBe(true);
  });
  it("generates exactly two independently read frames and exits only after both stdout callbacks", async () => {
    const f = fixture({ deferWrites: true }), done = interpret(f);
    expect(f.p.stdout.write).toHaveBeenCalledTimes(1);
    expect(f.p.exit).not.toHaveBeenCalled();
    f.callbacks[0](); await Promise.resolve(); await Promise.resolve();
    expect(f.p.stdout.write).toHaveBeenCalledTimes(2);
    expect(f.p.exit).not.toHaveBeenCalled();
    f.callbacks[1](); await done;
    expect(f.events).toEqual(["write:1", "callback:1", "write:2", "callback:2", "exit:0"]);
    const frames = f.p.stdout.write.mock.calls.map(([line]) => {
      expect(line.endsWith("\n")).toBe(true);
      expect(line.split("\n")).toHaveLength(2);
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(4096);
      return JSON.parse(line);
    });
    const common = {
      role: "I", domain: "NODE_I_HRTIME_MONOTONIC_NS", unit: "ns", tau0_ns: "100",
      image_id: IMAGE, engine_id: "SOURCE_ONLY_ENGINE",
      binding: { case_id: "source-clock-01", run_id: "a".repeat(64), nonce: "b".repeat(64),
        ticket: "c".repeat(64), source_sha256: "d".repeat(64), cohort_sha256: "e".repeat(64) },
    };
    expect(frames).toEqual([
      { schema: "airlock.clock-observation-init-hello.v1", ...common, hello_ns: "101" },
      { schema: "airlock.clock-observation-init-clock.v1", ...common, sequence: 1, sample_ns: "102" },
    ]);
    expect([...f.reads].sort()).toEqual(Object.keys(f.p).sort());
  });
  it.each([
    ["platform", "darwin"], ["arch", "x64"], ["version", "v24.10.1"], ["pid", 2],
    ["execPath", "/usr/bin/node"], ["argv", ["/usr/local/bin/node", "WORK"]],
    ["argv", ["/foreign/node"]], ["execArgv", ["--eval", CLOCK_OBSERVATION_PROGRAM]],
    ["execArgv", ["--input-type=commonjs", "--eval", CLOCK_OBSERVATION_PROGRAM]],
    ["execArgv", ["--input-type=module", "-e", CLOCK_OBSERVATION_PROGRAM]],
    ["execArgv", ["--input-type=module", "--eval", CLOCK_OBSERVATION_PROGRAM, "WORK"]],
    ["execArgv", ["--input-type=module", "--eval", ""]],
  ])("rejects changed process identity/argv %s", async (key, value) => {
    const f = fixture(); f.p[key] = value;
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(2);
    expect(f.p.stdout.write).not.toHaveBeenCalled();
    expect(f.p.hrtime.bigint).not.toHaveBeenCalled();
  });
  it.each([["getuid", 501], ["getuid", 65534], ["getgid", 0], ["cwd", "/case"]])(
    "rejects wrong guest %s without emitting any frame", async (key, value) => {
      const f = fixture(); f.p[key] = () => value;
      await interpret(f);
      expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(2);
      expect(f.p.stdout.write).not.toHaveBeenCalled();
    });
  it.each([
    ["PATH", "/usr/bin"], ["NODE_VERSION", "24.10.1"], ["YARN_VERSION", undefined],
    ["HOME", "/case"], ["HOSTNAME", "foreign"], ["AIRLOCK_ARM", "ready"], ["NODE_OPTIONS", "--inspect"],
    ["AIRLOCK_OBSERVATION_CASE", "foreign/case"], ["AIRLOCK_OBSERVATION_CASE", "x".repeat(49)],
    ["AIRLOCK_OBSERVATION_RUN", "a".repeat(63)], ["AIRLOCK_OBSERVATION_NONCE", null],
    ["AIRLOCK_OBSERVATION_TICKET", "A".repeat(64)], ["AIRLOCK_OBSERVATION_SOURCE", undefined],
    ["AIRLOCK_OBSERVATION_COHORT", ""], ["AIRLOCK_OBSERVATION_IMAGE", "sha256:" + "d".repeat(64)],
    ["AIRLOCK_OBSERVATION_ENGINE", "bad engine"], ["AIRLOCK_OBSERVATION_ENGINE", "x".repeat(129)],
  ])("rejects non-closed or invalid environment %s", async (key, value) => {
    const f = fixture();
    if (value === undefined) delete f.p.env[key]; else f.p.env[key] = value;
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(2);
    expect(f.p.stdout.write).not.toHaveBeenCalled();
  });
  it.each([
    [undefined], [1], ["1"], [-1n], [10n ** 24n], [100n, 99n, 101n], [100n, 101n, 100n],
  ])("fails closed on missing, mistyped, unbounded or reversed samples %s", async (...samples) => {
    const f = fixture({ samples });
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(70);
    expect(f.p.stdout.write).not.toHaveBeenCalled();
  });
  it("accepts equal monotonic samples and zero without inventing a future rate or budget", async () => {
    const f = fixture({ samples: [0n, 0n, 0n] });
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(f.p.stdout.write).toHaveBeenCalledTimes(2);
  });
  it("refuses the config blob digest as the selected containerd image identity", async () => {
    const f = fixture();
    f.p.env.AIRLOCK_OBSERVATION_IMAGE = "sha256:d4c19a76851d19b6473bcba5ec21630000c6469fcea58623ec166d19402f207f";
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(2);
    expect(f.p.stdout.write).not.toHaveBeenCalled();
  });
  it.each([1, 2])("exits 70 on stdout callback error %s, not success or an extra frame", async writeError => {
    const f = fixture({ writeError });
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(70);
    expect(f.p.stdout.write).toHaveBeenCalledTimes(writeError);
    expect(f.events.at(-2)).toBe("callback:" + writeError);
  });
  it("fails a throwing output operation without retry, diagnostics or extra effects", async () => {
    const f = fixture();
    f.p.stdout.write.mockImplementation(() => { throw Error("SOURCE_WRITE_THROW"); });
    await interpret(f);
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(70);
    expect(f.p.stdout.write).toHaveBeenCalledTimes(1);
  });
  it.each(["x".repeat(4096), "non-ascii:\u00e9"])("enforces the frame size/ASCII guard on a serializer fault", async line => {
    const f = fixture();
    await interpret(f, { JSON: { stringify: () => line } });
    expect(f.p.exit).toHaveBeenCalledExactlyOnceWith(70);
    expect(f.p.stdout.write).not.toHaveBeenCalled();
  });
});
