import { afterEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ stop: vi.fn(), manifest: vi.fn() }));
vi.mock("./meta-attended-control.mjs", () => ({
  stopMetaAttendedCase: fake.stop, stopMetaAttendedManifest: fake.manifest,
}));
afterEach(() => vi.clearAllMocks());

it("rejects arbitrary PIDs, options and programs before invoking any stop logic", async () => {
  const { runMetaAttendedStopEntry } = await import("./meta-attended-stop.mjs");
  for (const args of [[], ["--pid", "123", "a".repeat(64)], ["--stop", "/tmp/file", "x"],
    ["--stop", "/tmp/file", "a".repeat(64), "--force"]]) {
    await expect(runMetaAttendedStopEntry(args)).rejects.toThrow("fixed_attended_stop_arguments");
  }
  expect(fake.stop).not.toHaveBeenCalled();
});

it("passes exactly the private locator and expected digest, not a process selector", async () => {
  const { runMetaAttendedStopEntry } = await import("./meta-attended-stop.mjs");
  fake.stop.mockResolvedValue({ status: "UNKNOWN" });
  expect(await runMetaAttendedStopEntry(["--stop", "/tmp/file", "a".repeat(64)])).toEqual({ status: "UNKNOWN" });
  expect(fake.stop).toHaveBeenCalledWith({ control_path: "/tmp/file", control_sha256: "a".repeat(64) });
});

it("rejects argument accessors and proxies without evaluating them", async () => {
  const { runMetaAttendedStopEntry } = await import("./meta-attended-stop.mjs");
  let calls = 0;
  const args = ["--stop", "/tmp/file", "a".repeat(64)];
  Object.defineProperty(args, "1", { get() { calls++; return "/tmp/file"; } });
  await expect(runMetaAttendedStopEntry(args)).rejects.toThrow("invalid_case_input");
  await expect(runMetaAttendedStopEntry(new Proxy([], { get() { calls++; } }))).rejects.toThrow("invalid_case_input");
  expect(calls).toBe(0);
  expect(fake.stop).not.toHaveBeenCalled();
});

it("supports only the exact manifest-based route that can be supplied before launch", async () => {
  const { runMetaAttendedStopEntry } = await import("./meta-attended-stop.mjs");
  fake.manifest.mockResolvedValue({ status: "UNKNOWN" });
  await runMetaAttendedStopEntry(["--stop-manifest", "/tmp/manifest", "a".repeat(64)]);
  expect(fake.manifest).toHaveBeenCalledWith({ manifest_path: "/tmp/manifest", manifest_sha256: "a".repeat(64) });
  expect(fake.stop).not.toHaveBeenCalled();
});
