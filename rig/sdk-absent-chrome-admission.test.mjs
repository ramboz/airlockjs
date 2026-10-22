import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const ACTORS = fileURLToPath(new URL("sdk-absent-chrome-actors.mjs", import.meta.url));
async function boundaries() {
  const directory = vi.fn(() => { throw Error("unexpected-directory-access"); });
  const issued = vi.fn(() => { throw Error("unexpected-ticket-access"); });
  const spawn = vi.fn(() => { throw Error("unexpected-process-launch"); });
  const launchServer = vi.fn(() => { throw Error("unexpected-browser-launch"); });
  vi.doMock("./sdk-absent-chrome-io.mjs", async () => ({
    ...await vi.importActual("./sdk-absent-chrome-io.mjs"), directory, issued,
  }));
  vi.doMock("node:child_process", () => ({ spawn, execFile: vi.fn() }));
  vi.doMock("playwright-core", () => ({ chromium: { launchServer } }));
  vi.stubEnv("AIRLOCK_RUN_SDK_ABSENT_CHROME", "explicit-sdk-absent-only");
  vi.resetModules();
  return { directory, issued, spawn, launchServer };
}
function reset() {
  vi.doUnmock("./sdk-absent-chrome-io.mjs"); vi.doUnmock("node:child_process"); vi.doUnmock("playwright-core");
  vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules();
}
function noAcquisition(v) {
  for (const fn of Object.values(v)) expect(fn).not.toHaveBeenCalled();
}

describe("unsafe Mac prototype public routes are inert before acquisition", () => {
  it("refuses the direct P export despite the actual-test opt-in environment", async () => {
    const v = await boundaries();
    try {
      const { runSdkAbsentChromePreexec } = await import("./sdk-absent-chrome-runtime.mjs");
      await expect(runSdkAbsentChromePreexec({ outputDir: resolve("rig/out/not-created"), control: "normal" }))
        .rejects.toThrow("sdk_absent_descendant_closure_UNPROVED");
      noAcquisition(v);
    } finally { reset(); }
  });
  it("refuses the E export in a worker-like no-IPC context before ticket/SDK access", async () => {
    const v = await boundaries(), originalSend = process.send;
    process.send = undefined;
    try {
      const { runSdkAbsentChromeEngine } = await import("./sdk-absent-chrome-actors.mjs");
      await expect(runSdkAbsentChromeEngine(resolve("rig/out/raw-json-cannot-issue-a-plan")))
        .rejects.toThrow("sdk_absent_descendant_closure_UNPROVED");
      noAcquisition(v);
    } finally { process.send = originalSend; reset(); }
  });
  it.each(["--sdk-absent-e", "--sdk-absent-h"])("refuses %s CLI dispatch before even the actor watchdog timer", async mode => {
    const v = await boundaries(), argv = process.argv, exitCode = process.exitCode;
    const originalTimeout = globalThis.setTimeout;
    const timer = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...args) =>
      ms === 29000 ? 0 : originalTimeout(fn, ms, ...args));
    if (process.disconnect) vi.spyOn(process, "disconnect").mockImplementation(() => {});
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.argv = [process.execPath, ACTORS, mode];
    try {
      await import("./sdk-absent-chrome-actors.mjs");
      expect(process.exitCode).toBe(2);
      expect(timer.mock.calls.filter(call => call[1] === 29000)).toEqual([]);
      noAcquisition(v);
    } finally { process.argv = argv; process.exitCode = exitCode; reset(); }
  });
  it("keeps the shell entry stopped by a builtin before its fixed H subprocess", () => {
    const body = readFileSync(new URL("sdk-absent-chrome-launcher", import.meta.url), "utf8")
      .split("\n").filter(line => line && !line.startsWith("#")).join("\n");
    expect(body).toMatch(/^set -eu\nexit 2\n/);
  });
});
